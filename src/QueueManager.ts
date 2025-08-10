import * as admin from 'firebase-admin';
import {
  QueueMessage,
  QueueStatus,
  MessageStatus,
  SendMessageResult,
  SendMessageOptions
} from './types';

import { randomUUID } from 'crypto';

// UUID generation with fallback for different environments
function generateUUID(): string {
  try {
    return randomUUID();
  } catch (error) {
    // Fallback to manual UUID generation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

interface QueueConfig {
  debug?: boolean;
  queueTimeout?: number;
  [key: string]: any;
}

interface MessageData {
  number: string;
  message: string;
  options: SendMessageOptions;
  source: string;
  version: string;
  timestamp: number;
  priority: 'high' | 'medium' | 'low';
}

interface QueueStatusWithServer extends QueueStatus {
  serverAlive: boolean;
  serverConnected: boolean;
  serverStatus: string;
  lastServerSeen: number | null;
  serverId: string | null;
  error?: string;
}

interface ProcessingEstimate {
  found: boolean;
  position?: number;
  messagesAhead?: number;
  estimatedWaitTimeMs?: number;
  estimatedWaitTimeMin?: number;
  serverStatus?: string;
  note?: string;
  error?: string;
}

interface RecentActivity {
  success: boolean;
  activity: any[];
  total: number;
  error?: string;
}

interface QueueDetails {
  success: boolean;
  pending: Record<string, any>;
  processing: Record<string, any>;
  completed: Record<string, any>;
  failed: Record<string, any>;
  serverHeartbeat: any;
  timestamp: number;
  summary: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  };
  error?: string;
}

interface ConditionalAddConditions {
  custom?: (queueStatus: QueueStatusWithServer) => boolean;
}

interface ConditionalAddResult {
  success: boolean;
  method: string;
  reason?: string;
  queueStatus?: QueueStatusWithServer;
  messageId?: string;
  queuedAt?: number;
  position?: number;
}

export class QueueManager {
  private database: admin.database.Database;
  private config: QueueConfig;
  private queueRef: admin.database.Reference;

  constructor(database: admin.database.Database, config: QueueConfig) {
    this.database = database;
    this.config = config;
    this.queueRef = this.database.ref('message_queue');
  }

  /**
   * Add message to Firebase queue
   * @param messageData - Message data object
   * @returns Queue result with message ID
   */
  async addMessage(messageData: MessageData): Promise<SendMessageResult> {
    try {
      const messageId = this.generateMessageId();
      const queueData: QueueMessage = {
        ...messageData,
        id: messageId,
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0,
        position: await this.getQueuePosition(messageId)
      };

      // Add to pending queue
      await this.queueRef.child(`pending/${messageId}`).set({
        ...queueData,
        queuedAt: Date.now(),
        attempts: 0
      });

      return {
        success: true,
        method: 'queued',
        messageId,
        timestamp: queueData.timestamp,
        position: await this.getQueuePosition(messageId)
      };
    } catch (error) {
      throw new Error(`Failed to queue message: ${(error as Error).message}`);
    }
  }

  /**
   * Get current queue status and statistics
   * @returns Queue statistics
   */
  async getQueueStatus(): Promise<QueueStatus> {
    try {
      const [pendingSnap, processingSnap, heartbeatSnap] = await Promise.all([
        this.queueRef.child('pending').once('value'),
        this.queueRef.child('processing').once('value'),
        this.queueRef.child('server_status/heartbeat').once('value')
      ]);

      const pendingMessages = pendingSnap.exists() ? Object.keys(pendingSnap.val()).length : 0;
      const processingMessages = processingSnap.exists() ? Object.keys(processingSnap.val()).length : 0;
      const heartbeat = heartbeatSnap.exists() ? heartbeatSnap.val() : null;

      const isServerAlive = heartbeat && 
                           heartbeat.alive === true && 
                           (Date.now() - (heartbeat.lastSeen || 0)) < 60000; // 1 minute tolerance

      return {
        totalMessages: pendingMessages + processingMessages,
        pendingMessages,
        processingMessages,
        sentMessages: 0, // Would need to track this separately
        failedMessages: 0, // Would need to track this separately
        isProcessing: processingMessages > 0,
        lastProcessed: heartbeat?.lastProcessed || undefined,
        nextProcessingTime: heartbeat?.nextProcessingTime || undefined
      };
    } catch (error) {
      return {
        totalMessages: 0,
        pendingMessages: 0,
        processingMessages: 0,
        sentMessages: 0,
        failedMessages: 0,
        isProcessing: false
      };
    }
  }

  /**
   * Get status of a specific message
   * @param messageId - Message ID to check
   * @returns Message status information
   */
  async getMessageStatus(messageId: string): Promise<MessageStatus> {
    try {
      // Check all queue states for the message
      const [pendingSnap, processingSnap, completedSnap, failedSnap] = await Promise.all([
        this.queueRef.child(`pending/${messageId}`).once('value'),
        this.queueRef.child(`processing/${messageId}`).once('value'),
        this.queueRef.child(`completed/${messageId}`).once('value'),
        this.queueRef.child(`failed/${messageId}`).once('value')
      ]);

      if (pendingSnap.exists()) {
        const data = pendingSnap.val();
        return {
          id: messageId,
          status: 'pending',
          timestamp: data.queuedAt,
          position: await this.getQueuePosition(messageId)
        };
      }

      if (processingSnap.exists()) {
        const data = processingSnap.val();
        return {
          id: messageId,
          status: 'processing',
          timestamp: data.startedAt
        };
      }

      if (completedSnap.exists()) {
        const data = completedSnap.val();
        return {
          id: messageId,
          status: 'sent',
          timestamp: data.completedAt,
          sentAt: data.completedAt
        };
      }

      if (failedSnap.exists()) {
        const data = failedSnap.val();
        return {
          id: messageId,
          status: 'failed',
          timestamp: data.failedAt,
          error: data.error
        };
      }

      return {
        id: messageId,
        status: 'failed',
        timestamp: Date.now(),
        error: 'Message not found in any queue state'
      };

    } catch (error) {
      return {
        id: messageId,
        status: 'failed',
        timestamp: Date.now(),
        error: (error as Error).message
      };
    }
  }

  /**
   * Get position of message in pending queue
   * @param messageId - Message ID
   * @returns Queue position (0-based)
   */
  async getQueuePosition(messageId: string): Promise<number> {
    try {
      const snapshot = await this.queueRef.child('pending')
        .orderByChild('queuedAt')
        .once('value');

      if (!snapshot.exists()) return -1;

      const messages = snapshot.val();
      const messageIds = Object.keys(messages)
        .sort((a, b) => messages[a].queuedAt - messages[b].queuedAt);

      return messageIds.indexOf(messageId);
    } catch (error) {
      return -1;
    }
  }

  /**
   * Get recent queue activity (last N completed/failed messages)
   * @param limit - Number of recent messages to fetch
   * @returns Recent activity data
   */
  async getRecentActivity(limit: number = 10): Promise<RecentActivity> {
    try {
      const [completedSnap, failedSnap] = await Promise.all([
        this.queueRef.child('completed')
          .orderByChild('completedAt')
          .limitToLast(limit)
          .once('value'),
        this.queueRef.child('failed')
          .orderByChild('failedAt')
          .limitToLast(limit)
          .once('value')
      ]);

      const completed = completedSnap.exists() ? 
        Object.entries(completedSnap.val()).map(([id, data]) => ({ id, ...(data as any), type: 'completed' })) : [];
      
      const failed = failedSnap.exists() ? 
        Object.entries(failedSnap.val()).map(([id, data]) => ({ id, ...(data as any), type: 'failed' })) : [];

      // Combine and sort by timestamp
      const activity = [...completed, ...failed]
        .sort((a: any, b: any) => (b.completedAt || b.failedAt || 0) - (a.completedAt || a.failedAt || 0))
        .slice(0, limit);

      return {
        success: true,
        activity,
        total: activity.length
      };
    } catch (error) {
      return {
        success: false,
        activity: [],
        total: 0,
        error: (error as Error).message
      };
    }
  }

  /**
   * Estimate processing time for a message in queue
   * @param messageId - Message ID
   * @returns Estimated processing information
   */
  async getProcessingEstimate(messageId: string): Promise<ProcessingEstimate> {
    try {
      const [queueStatus, position] = await Promise.all([
        this.getQueueStatus() as Promise<QueueStatusWithServer>,
        this.getQueuePosition(messageId)
      ]);

      if (position === -1) {
        return {
          found: false,
          error: 'Message not found in pending queue'
        };
      }

      // Rough estimate: 3 seconds per message + processing overhead
      const avgProcessingTime = 3000; // 3 seconds
      const estimatedWaitTime = position * avgProcessingTime;

      return {
        found: true,
        position: position + 1, // 1-based position for user display
        messagesAhead: position,
        estimatedWaitTimeMs: estimatedWaitTime,
        estimatedWaitTimeMin: Math.ceil(estimatedWaitTime / 60000),
        serverStatus: (queueStatus as any).serverAlive ? 'online' : 'offline',
        note: (queueStatus as any).serverAlive ? 
          'Server is processing messages' : 
          'Server is offline, messages will be processed when server comes online'
      };
    } catch (error) {
      return {
        found: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get detailed queue information including individual messages
   * @returns Detailed queue data
   */
  async getQueueDetails(): Promise<QueueDetails> {
    try {
      const [pendingSnap, processingSnap, completedSnap, failedSnap, heartbeatSnap] = await Promise.all([
        this.queueRef.child('pending').once('value'),
        this.queueRef.child('processing').once('value'),
        this.queueRef.child('completed').limitToLast(50).once('value'),
        this.queueRef.child('failed').limitToLast(50).once('value'),
        this.queueRef.child('server_status/heartbeat').once('value')
      ]);

      return {
        success: true,
        pending: pendingSnap.exists() ? pendingSnap.val() : {},
        processing: processingSnap.exists() ? processingSnap.val() : {},
        completed: completedSnap.exists() ? completedSnap.val() : {},
        failed: failedSnap.exists() ? failedSnap.val() : {},
        serverHeartbeat: heartbeatSnap.exists() ? heartbeatSnap.val() : null,
        timestamp: Date.now(),
        summary: {
          pending: pendingSnap.exists() ? Object.keys(pendingSnap.val()).length : 0,
          processing: processingSnap.exists() ? Object.keys(processingSnap.val()).length : 0,
          completed: completedSnap.exists() ? Object.keys(completedSnap.val()).length : 0,
          failed: failedSnap.exists() ? Object.keys(failedSnap.val()).length : 0,
          total: (pendingSnap.exists() ? Object.keys(pendingSnap.val()).length : 0) +
                (processingSnap.exists() ? Object.keys(processingSnap.val()).length : 0)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        timestamp: Date.now(),
        pending: {},
        processing: {},
        completed: {},
        failed: {},
        serverHeartbeat: null,
        summary: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          total: 0
        }
      };
    }
  }

  /**
   * Generate unique message ID
   * @returns Unique message ID
   */
  generateMessageId(): string {
    try {
      return generateUUID();
    } catch (error) {
      // Fallback ID generation if UUID generation fails
      return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Atomic operation to check queue and add message if conditions are met
   * @param messageData - Message data
   * @param conditions - Conditions to check before adding
   * @returns Result of conditional add
   */
  async conditionalAdd(
    messageData: MessageData, 
    conditions: ConditionalAddConditions = {}
  ): Promise<ConditionalAddResult> {
    try {
      const queueStatus = await this.getQueueStatus() as QueueStatusWithServer;
      
      // Check conditions
      const shouldAdd = this.evaluateConditions(queueStatus, conditions);
      
      if (shouldAdd.result) {
        const result = await this.addMessage(messageData);
        return {
          ...result,
          success: true,
          method: 'queued'
        };
      } else {
        return {
          success: false,
          method: 'condition_failed',
          reason: shouldAdd.reason,
          queueStatus
        };
      }
    } catch (error) {
      throw new Error(`Conditional add failed: ${(error as Error).message}`);
    }
  }

  /**
   * Evaluate conditions for adding to queue
   * @param queueStatus - Current queue status
   * @param conditions - Conditions to evaluate
   * @returns Evaluation result
   */
  private evaluateConditions(
    queueStatus: QueueStatusWithServer, 
    conditions: ConditionalAddConditions
  ): { result: boolean; reason: string } {
    // Default condition: add if server is offline or queue has messages
    if (!conditions.custom) {
      if (!(queueStatus as any).serverAlive) {
        return { result: true, reason: 'server_offline' };
      }
      if (queueStatus.totalMessages > 0) {
        return { result: true, reason: 'queue_not_empty' };
      }
      return { result: false, reason: 'server_online_queue_empty' };
    }

    // Custom condition evaluation
    if (typeof conditions.custom === 'function') {
      try {
        const customResult = conditions.custom(queueStatus);
        return {
          result: Boolean(customResult),
          reason: customResult ? 'custom_condition_met' : 'custom_condition_failed'
        };
      } catch (error) {
        return {
          result: false,
          reason: `custom_condition_error: ${(error as Error).message}`
        };
      }
    }

    return { result: false, reason: 'invalid_conditions' };
  }
}