import * as admin from 'firebase-admin';
import { HealthChecker } from './HealthChecker';
import { QueueManager } from './QueueManager';
import { ApiClient } from './ApiClient';
import { WhatsAppConnection } from './WhatsAppConnection';
import {
  WhapleConfig,
  SendMessageOptions,
  SendMessageResult,
  QueueStatus,
  ServerStatus,
  MessageStatus,
  ConfigurationError,
  ValidationError,
  FirebaseServiceAccount,
  WhatsAppConnectionConfig,
  WhatsAppConnectionStatus
} from './types';

export class Whaple {
  private config: Required<WhapleConfig> & { [key: string]: any };
  private firebaseApp!: admin.app.App;
  private database!: admin.database.Database;
  private healthChecker!: HealthChecker;
  private queueManager!: QueueManager;
  private apiClient!: ApiClient;
  private whatsappConnection?: WhatsAppConnection;
  private useDirectWhatsApp: boolean;

  constructor(config: WhapleConfig & { useDirectWhatsApp?: boolean } = {}) {
    this.useDirectWhatsApp = config.useDirectWhatsApp || false;
    this.config = {
      whatsappServerUrl: config.whatsappServerUrl || process.env.WHATSAPP_SERVER_URL || '',
      apiKey: config.apiKey || process.env.WHATSAPP_API_KEY || '',
      firebaseConfig: config.firebaseConfig || this.parseFirebaseConfig(),
      debug: config.debug || false,
      healthCheckTimeout: config.healthCheckTimeout || 3000,
      queueTimeout: config.queueTimeout || 30000,
      queueThreshold: (config as any).queueThreshold || 0,
      enableSmartRouting: (config as any).enableSmartRouting !== false,
      retryAttempts: (config as any).retryAttempts || 2,
      retryDelay: (config as any).retryDelay || 1000,
      ...config
    } as Required<WhapleConfig> & { [key: string]: any };

    this.validateConfig();
    this.initializeServices();
  }

  private validateConfig(): void {
    if (!this.useDirectWhatsApp && !this.config.whatsappServerUrl) {
      throw new ConfigurationError('WhatsApp server URL is required when not using direct WhatsApp connection');
    }
    if (!this.useDirectWhatsApp && !this.config.apiKey) {
      throw new ConfigurationError('API key is required when not using direct WhatsApp connection');
    }
    if (!this.config.firebaseConfig) {
      throw new ConfigurationError('Firebase configuration is required');
    }
  }

  private parseFirebaseConfig(): FirebaseServiceAccount | null {
    try {
      const configStr = process.env.FIREBASE_SERVICE_ACCOUNT;
      return configStr ? JSON.parse(configStr) as FirebaseServiceAccount : null;
    } catch (error) {
      if (this.config?.debug) {
        console.error('Failed to parse Firebase config:', error);
      }
      return null;
    }
  }

  private initializeServices(): void {
    // Initialize Firebase (reuse existing app if available)
    try {
      const existingApp = admin.apps.find(app => app?.name === 'whatsapp-sdk');
      
      if (!existingApp) {
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(this.config.firebaseConfig as admin.ServiceAccount),
          databaseURL: `https://${this.config.firebaseConfig!.project_id}-default-rtdb.firebaseio.com/`
        }, 'whatsapp-sdk');
      } else {
        this.firebaseApp = existingApp;
      }

      this.database = admin.database(this.firebaseApp);
    } catch (error) {
      throw new ConfigurationError(`Firebase initialization failed: ${(error as Error).message}`);
    }

    // Initialize service modules
    this.healthChecker = new HealthChecker(this.config);
    this.queueManager = new QueueManager(this.database, this.config);
    
    if (!this.useDirectWhatsApp) {
      this.apiClient = new ApiClient(this.config);
    }
    
    // Initialize WhatsApp connection if using direct mode
    if (this.useDirectWhatsApp) {
      this.initializeWhatsAppConnection();
    }
  }

  private initializeWhatsAppConnection(): void {
    const whatsappConfig: WhatsAppConnectionConfig = {
      printQRInTerminal: this.config.debug || false,
      useFirebaseAuth: true,
      authPath: 'auth_info_baileys'
    };
    
    this.whatsappConnection = new WhatsAppConnection(whatsappConfig);
    this.whatsappConnection.setFirebaseApp(this.firebaseApp);
  }

  /**
   * Connect to WhatsApp (only available in direct mode)
   */
  async connectToWhatsApp(): Promise<void> {
    if (!this.useDirectWhatsApp || !this.whatsappConnection) {
      throw new Error('Direct WhatsApp connection is not enabled');
    }
    await this.whatsappConnection.connect();
  }

  /**
   * Disconnect from WhatsApp (only available in direct mode)
   */
  async disconnectFromWhatsApp(): Promise<void> {
    if (this.whatsappConnection) {
      await this.whatsappConnection.disconnect();
    }
  }

  /**
   * Get WhatsApp connection status (only available in direct mode)
   */
  getWhatsAppConnectionStatus(): WhatsAppConnectionStatus | null {
    if (!this.whatsappConnection) {
      return null;
    }
    return this.whatsappConnection.getConnectionStatus();
  }

  /**
   * Get current QR code for WhatsApp authentication
   */
  getCurrentQR(): string | null {
    if (!this.whatsappConnection) {
      return null;
    }
    return this.whatsappConnection.getCurrentQR() || null;
  }

  /**
   * Send a WhatsApp message with smart routing or direct connection
   * @param number - Phone number (with or without + prefix)
   * @param message - Message content
   * @param options - Additional options
   * @returns Result object with success status and details
   */
  async sendMessage(
    number: string, 
    message: string, 
    options: SendMessageOptions = {}
  ): Promise<SendMessageResult> {
    const messageData = {
      number: this.normalizePhoneNumber(number),
      message,
      options,
      source: 'sdk',
      version: '1.0.0',
      timestamp: Date.now(),
      priority: options.priority || 'medium'
    };

    try {
      if (this.useDirectWhatsApp && this.whatsappConnection) {
        // Use direct WhatsApp connection
        const connectionStatus = this.whatsappConnection.getConnectionStatus();
        if (connectionStatus.isConnected && connectionStatus.isAuthenticated) {
          try {
            return await this.whatsappConnection.sendMessage(messageData.number, messageData.message);
          } catch (error) {
            // Fallback to queue if direct send fails
            if (this.config.debug) {
              console.warn('Direct WhatsApp send failed, falling back to queue:', (error as Error).message);
            }
            return await this.queueManager.addMessage(messageData);
          }
        } else {
          // WhatsApp not connected, use queue
          return await this.queueManager.addMessage(messageData);
        }
      } else if (this.config.enableSmartRouting) {
        // Use API-based smart routing
        return await this.smartRoutingDecision(messageData);
      } else {
        // Force queue mode
        return await this.queueMessage(messageData.number, messageData.message, options);
      }
    } catch (error) {
      throw new Error(`Failed to send message: ${(error as Error).message}`);
    }
  }

  /**
   * Smart routing logic: direct API or queue based on server status
   */
  private async smartRoutingDecision(messageData: any): Promise<SendMessageResult> {
    try {
      // Step 1: Check server health
      const isServerHealthy = await this.healthChecker.isServerHealthy();
      
      // Step 2: Check queue status
      const queueStatus = await this.queueManager.getQueueStatus();
      const shouldUseQueue = !isServerHealthy || 
                           queueStatus.pendingMessages > this.config.queueThreshold ||
                           queueStatus.processingMessages > 0;

      if (shouldUseQueue) {
        // Route to queue
        return await this.queueManager.addMessage(messageData);
      } else {
        // Route to direct API with fallback
        return await this.sendDirectWithFallback(messageData);
      }
    } catch (error) {
      // Fallback to queue on any routing decision error
      if (this.config.debug) {
        console.warn('Smart routing failed, falling back to queue:', (error as Error).message);
      }
      return await this.queueManager.addMessage(messageData);
    }
  }

  /**
   * Send directly to API with automatic fallback to queue
   */
  private async sendDirectWithFallback(messageData: any): Promise<SendMessageResult> {
    try {
      const result = await this.apiClient.sendMessage(
        messageData.number, 
        messageData.message, 
        messageData.options
      );
      
      return {
        success: true,
        method: 'direct',
        messageId: result.messageId || `direct-${Date.now()}`,
        timestamp: Date.now()
      };
    } catch (error) {
      // Fallback to queue if direct API fails
      if (this.config.debug) {
        console.warn('Direct API failed, falling back to queue:', (error as Error).message);
      }
      const queueResult = await this.queueManager.addMessage(messageData);
      return {
        success: queueResult.success,
        method: queueResult.method,
        messageId: queueResult.messageId,
        timestamp: queueResult.timestamp,
        position: queueResult.position,
        error: `Fallback: ${(error as Error).message}`
      };
    }
  }

  /**
   * Force message to queue (bypass health checks)
   * @param number - Phone number
   * @param message - Message content  
   * @param options - Additional options
   * @returns Queue result
   */
  async queueMessage(
    number: string, 
    message: string, 
    options: SendMessageOptions = {}
  ): Promise<SendMessageResult> {
    const messageData = {
      number: this.normalizePhoneNumber(number),
      message,
      options,
      source: 'sdk',
      version: '1.0.0',
      timestamp: Date.now(),
      priority: options.priority || 'medium'
    };

    return await this.queueManager.addMessage(messageData);
  }

  /**
   * Force direct API send (bypass queue checks)
   * @param number - Phone number
   * @param message - Message content
   * @param options - Additional options  
   * @returns API result
   */
  async sendDirect(
    number: string, 
    message: string, 
    options: SendMessageOptions = {}
  ): Promise<any> {
    return await this.apiClient.sendMessage(
      this.normalizePhoneNumber(number),
      message,
      options
    );
  }

  /**
   * Get current queue status
   * @returns Queue statistics
   */
  async getQueueStatus(): Promise<QueueStatus> {
    return await this.queueManager.getQueueStatus();
  }

  /**
   * Get server health status
   * @returns Server health information
   */
  async getServerStatus(): Promise<ServerStatus> {
    return await this.healthChecker.getDetailedStatus();
  }

  /**
   * Check if a specific message was processed
   * @param messageId - Message ID to check
   * @returns Message status
   */
  async getMessageStatus(messageId: string): Promise<MessageStatus> {
    return await this.queueManager.getMessageStatus(messageId);
  }

  /**
   * Get detailed queue information including individual messages
   * @returns Detailed queue data
   */
  async getQueueDetails(): Promise<any> {
    return await this.queueManager.getQueueDetails();
  }

  /**
   * Get comprehensive system status including queue, server, and health info
   * @returns Complete system status
   */
  async getSystemStatus(): Promise<any> {
    try {
      const [queueStatus, serverStatus, queueDetails] = await Promise.all([
        this.getQueueStatus(),
        this.getServerStatus(), 
        this.getQueueDetails()
      ]);

      return {
        timestamp: Date.now(),
        queue: {
          status: queueStatus,
          details: queueDetails
        },
        server: serverStatus,
        sdk: {
          version: '1.0.0',
          config: {
            whatsappServerUrl: this.config.whatsappServerUrl,
            enableSmartRouting: this.config.enableSmartRouting,
            queueThreshold: this.config.queueThreshold,
            healthCheckTimeout: this.config.healthCheckTimeout
          }
        }
      };
    } catch (error) {
      return {
        timestamp: Date.now(),
        error: (error as Error).message,
        sdk: {
          version: '1.0.0',
          status: 'error'
        }
      };
    }
  }

  /**
   * Get message history for a specific number (only available in direct WhatsApp mode)
   * @param number - Phone number
   * @param limit - Number of messages to retrieve
   * @returns Message history
   */
  async getMessageHistory(number: string, limit: number = 20): Promise<any> {
    if (!this.useDirectWhatsApp || !this.whatsappConnection) {
      throw new Error('Message history is only available in direct WhatsApp mode');
    }
    
    return await this.whatsappConnection.getMessageHistory(number, limit);
  }

  /**
   * Get current queue status from QueueManager
   * @returns Queue status
   */
  async getWhapleQueueStatus(): Promise<any> {
    return await this.queueManager.getQueueStatus();
  }

  /**
   * Normalize phone number format
   * @param number - Raw phone number
   * @returns Normalized phone number
   */
  private normalizePhoneNumber(number: string): string {
    if (!number) {
      throw new ValidationError('Phone number is required');
    }
    
    // Remove all non-digit characters except +
    let normalized = number.toString().replace(/[^\d+]/g, '');
    
    // Add + prefix if not present
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    
    return normalized;
  }

  /**
   * Configure SDK settings
   * @param newConfig - Configuration updates
   */
  configure(newConfig: Partial<WhapleConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Reinitialize services if critical config changed
    const criticalKeys = ['firebaseConfig', 'whatsappServerUrl', 'apiKey'];
    if (criticalKeys.some(key => newConfig.hasOwnProperty(key))) {
      this.initializeServices();
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.whatsappConnection) {
        await this.whatsappConnection.disconnect();
      }
      if (this.firebaseApp) {
        await this.firebaseApp.delete();
      }
    } catch (error) {
      if (this.config.debug) {
        console.warn('Cleanup warning:', (error as Error).message);
      }
    }
  }
}