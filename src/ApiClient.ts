import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { SendMessageOptions, ApiResponse } from './types';

interface ApiConfig {
  whatsappServerUrl: string;
  apiKey: string;
  apiTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  debug?: boolean;
}

interface SendMessageResult {
  success: boolean;
  messageId: string;
  timestamp: number;
  response?: any;
}

interface ConnectionTestResult {
  success: boolean;
  connected: boolean;
  authenticated: boolean;
  serverStatus?: any;
  error?: string;
  timestamp: number;
}

interface BatchMessage {
  number: string;
  message: string;
  options?: SendMessageOptions;
}

interface BatchResult {
  index: number;
  success: boolean;
  messageId?: string;
  timestamp?: number;
  error?: string;
  number?: string;
  message?: string;
}

interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

interface HttpRequestOptions {
  hostname: string;
  port: number;
  path: string;
  method: string;
  headers: Record<string, string>;
  timeout: number;
}

export class ApiClient {
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
  }

  /**
   * Send message directly to WhatsApp API
   * @param number - Phone number
   * @param message - Message content
   * @param options - Additional options
   * @returns API response
   */
  async sendMessage(
    number: string, 
    message: string, 
    options: SendMessageOptions = {}
  ): Promise<SendMessageResult> {
    const payload = {
      number,
      message,
      ...options
    };

    try {
      const response = await this.makeApiRequest('/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.success) {
        throw new Error(response.error || 'API request failed');
      }

      return {
        success: true,
        messageId: response.messageId || response.key?.id || `api-${Date.now()}`,
        timestamp: response.messageTimestamp || Date.now(),
        response
      };
    } catch (error) {
      throw new Error(`API request failed: ${(error as Error).message}`);
    }
  }

  /**
   * Make HTTP/HTTPS request to WhatsApp API
   * @param endpoint - API endpoint path
   * @param options - Request options
   * @returns Parsed response
   */
  async makeApiRequest(endpoint: string, options: RequestOptions = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = this.buildApiUrl(endpoint);
      const requestOptions = this.buildRequestOptions(url, options);
      
      const request = this.createRequest(url, requestOptions);
      let responseData = '';

      // Handle request timeout
      const timeout = setTimeout(() => {
        request.destroy();
        reject(new Error(`Request timeout after ${this.config.apiTimeout || 10000}ms`));
      }, this.config.apiTimeout || 10000);

      request.on('response', (response) => {
        clearTimeout(timeout);

        response.on('data', (chunk) => {
          responseData += chunk;
        });

        response.on('end', () => {
          try {
            const parsedResponse = JSON.parse(responseData);
            
            if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
              resolve(parsedResponse);
            } else {
              reject(new Error(parsedResponse.error || `HTTP ${response.statusCode}`));
            }
          } catch (parseError) {
            if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
              // Non-JSON success response
              resolve({ success: true, data: responseData });
            } else {
              reject(new Error(`Invalid JSON response: ${(parseError as Error).message}`));
            }
          }
        });
      });

      request.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Network error: ${error.message}`));
      });

      request.on('timeout', () => {
        clearTimeout(timeout);
        request.destroy();
        reject(new Error('Request timeout'));
      });

      // Send request body if provided
      if (options.body) {
        request.write(options.body);
      }

      request.end();
    });
  }

  /**
   * Build full API URL
   * @param endpoint - API endpoint
   * @returns Full URL
   */
  private buildApiUrl(endpoint: string): string {
    const baseUrl = this.config.whatsappServerUrl.replace(/\/+$/, '');
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    return `${baseUrl}${cleanEndpoint}`;
  }

  /**
   * Build request options for HTTP client
   * @param url - Target URL
   * @param options - Request options
   * @returns HTTP request options
   */
  private buildRequestOptions(url: string, options: RequestOptions): HttpRequestOptions {
    const urlObj = new URL(url);
    
    return {
      hostname: urlObj.hostname,
      port: parseInt(urlObj.port) || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': `Whaple-SDK/1.0.0`,
        ...options.headers
      },
      timeout: options.timeout || this.config.apiTimeout || 10000
    };
  }

  /**
   * Create HTTP/HTTPS request
   * @param url - Target URL  
   * @param requestOptions - Request options
   * @returns HTTP request
   */
  private createRequest(url: string, requestOptions: HttpRequestOptions): http.ClientRequest {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;
    
    return client.request(requestOptions);
  }

  /**
   * Check API connectivity and authentication
   * @returns Connection test result
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const response = await this.makeApiRequest('/api/status', {
        method: 'GET',
        headers: {
          'X-API-Key': this.config.apiKey
        }
      });

      return {
        success: true,
        connected: true,
        authenticated: true,
        serverStatus: response,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        connected: false,
        authenticated: false,
        error: (error as Error).message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Retry API request with exponential backoff
   * @param requestFn - Request function to retry
   * @param maxAttempts - Maximum retry attempts
   * @param baseDelay - Base delay in milliseconds
   * @returns Final result
   */
  async retryRequest<T>(
    requestFn: () => Promise<T>, 
    maxAttempts: number = 3, 
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          break; // Don't delay on final attempt
        }

        // Exponential backoff
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await this.delay(delay);
      }
    }

    throw lastError!;
  }

  /**
   * Delay execution
   * @param ms - Milliseconds to delay
   * @returns Delay promise
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send message with automatic retry
   * @param number - Phone number
   * @param message - Message content  
   * @param options - Additional options
   * @returns Result with retry information
   */
  async sendMessageWithRetry(
    number: string, 
    message: string, 
    options: SendMessageOptions = {}
  ): Promise<SendMessageResult> {
    const maxRetries = options.retryCount || this.config.retryAttempts || 2;
    const retryDelay = this.config.retryDelay || 1000;

    try {
      return await this.retryRequest(
        () => this.sendMessage(number, message, options),
        maxRetries + 1, // +1 because retryRequest includes the initial attempt
        retryDelay
      );
    } catch (error) {
      throw new Error(`Failed after ${maxRetries + 1} attempts: ${(error as Error).message}`);
    }
  }

  /**
   * Batch send multiple messages (sequential to respect rate limits)
   * @param messages - Array of message objects
   * @param options - Batch options
   * @returns Array of results
   */
  async sendBatch(
    messages: BatchMessage[], 
    options: { batchDelay?: number } = {}
  ): Promise<BatchResult[]> {
    const results: BatchResult[] = [];
    const delay = options.batchDelay || 1000; // 1 second between messages

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      try {
        const result = await this.sendMessage(msg.number, msg.message, msg.options);
        results.push({
          index: i,
          success: true,
          messageId: result.messageId,
          timestamp: result.timestamp
        });
      } catch (error) {
        results.push({
          index: i,
          success: false,
          error: (error as Error).message,
          number: msg.number,
          message: msg.message
        });
      }

      // Add delay between messages (except for the last one)
      if (i < messages.length - 1) {
        await this.delay(delay);
      }
    }

    return results;
  }
}