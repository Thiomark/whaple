// Core types for Whaple SDK

export interface WhapleConfig {
  whatsappServerUrl?: string;
  apiKey?: string;
  firebaseConfig?: FirebaseServiceAccount;
  debug?: boolean;
  healthCheckTimeout?: number;
  queueTimeout?: number;
  enableSmartRouting?: boolean;
  queueThreshold?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export interface FirebaseServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export interface SendMessageOptions {
  source?: string;
  timestamp?: number;
  priority?: 'high' | 'medium' | 'low';
  retryCount?: number;
  [key: string]: any;
}

export interface SendMessageResult {
  success: boolean;
  messageId: string;
  method: 'direct' | 'queued';
  timestamp: number;
  position?: number;
  queueId?: string;
  error?: string;
  key?: any;
}

export interface QueueMessage {
  id: string;
  number: string;
  message: string;
  options: SendMessageOptions;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  timestamp: number;
  retryCount: number;
  lastError?: string;
  position?: number;
}

export interface QueueStatus {
  totalMessages: number;
  pendingMessages: number;
  processingMessages: number;
  sentMessages: number;
  failedMessages: number;
  isProcessing: boolean;
  lastProcessed?: number;
  nextProcessingTime?: number;
}

export interface ServerStatus {
  isHealthy: boolean;
  responseTime?: number;
  error?: string;
  timestamp: number;
  version?: string;
  uptime?: number;
}

export interface MessageStatus {
  id: string;
  status: 'pending' | 'processing' | 'sent' | 'failed';
  timestamp: number;
  error?: string;
  sentAt?: number;
  position?: number;
}

export interface HealthCheckResult {
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp?: number;
}

export interface BulkSendResult {
  results: SendMessageResult[];
  totalSent: number;
  totalFailed: number;
  summary: {
    successful: number;
    failed: number;
    direct: number;
    queued: number;
  };
}

export interface QueueMetrics {
  averageProcessingTime: number;
  throughputPerHour: number;
  successRate: number;
  peakQueueLength: number;
  currentLoad: number;
}

// Error types
export class WhapleError extends Error {
  public code: string;
  public timestamp: number;
  
  constructor(message: string, code: string = 'WHAPLE_ERROR') {
    super(message);
    this.name = 'WhapleError';
    this.code = code;
    this.timestamp = Date.now();
  }
}

export class ConfigurationError extends WhapleError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
  }
}

export class ConnectionError extends WhapleError {
  constructor(message: string) {
    super(message, 'CONNECTION_ERROR');
    this.name = 'ConnectionError';
  }
}

export class ValidationError extends WhapleError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

// WhatsApp Connection specific types
export interface WhatsAppConnectionConfig {
  printQRInTerminal?: boolean;
  useFirebaseAuth?: boolean;
  authPath?: string;
  firebaseApp?: any;
}

export interface WhatsAppConnectionStatus {
  isConnected: boolean;
  isAuthenticated: boolean;
  userInfo?: any;
  reconnectAttempts: number;
  isReconnecting: boolean;
  connectionState: string;
  currentQR?: string;
  lastQRTime?: Date;
}