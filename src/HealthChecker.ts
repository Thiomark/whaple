import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { ServerStatus, HealthCheckResult } from './types';

interface HealthConfig {
  whatsappServerUrl: string;
  apiKey: string;
  healthCheckTimeout: number;
  debug?: boolean;
}

interface HealthCache {
  lastCheck: number | null;
  lastResult: boolean | null;
  cacheTimeMs: number;
}

interface RequestOptions {
  timeout: number;
  method: string;
  headers?: Record<string, string>;
}

interface ApiStatusResponse {
  connected?: boolean;
  authenticated?: boolean;
  status?: string;
  version?: string;
  uptime?: number;
}

export class HealthChecker {
  private config: HealthConfig;
  private cache: HealthCache;

  constructor(config: HealthConfig) {
    this.config = config;
    this.cache = {
      lastCheck: null,
      lastResult: null,
      cacheTimeMs: 5000 // Cache health check for 5 seconds
    };
  }

  /**
   * Check if the WhatsApp server is healthy and ready
   * @returns True if server is healthy
   */
  async isServerHealthy(): Promise<boolean> {
    // Check cache first to avoid excessive health checks
    if (this.isCacheValid()) {
      return this.cache.lastResult!;
    }

    try {
      const healthResult = await this.checkServerHealth();
      
      // Update cache
      this.cache.lastCheck = Date.now();
      this.cache.lastResult = healthResult;
      
      return healthResult;
    } catch (error) {
      // Cache negative result too
      this.cache.lastCheck = Date.now();
      this.cache.lastResult = false;
      
      if (this.config.debug) {
        console.error('Health check failed:', error);
      }
      
      return false;
    }
  }

  /**
   * Get detailed server status information
   * @returns Detailed status object
   */
  async getDetailedStatus(): Promise<ServerStatus> {
    try {
      const [healthCheck, apiStatus] = await Promise.all([
        this.checkServerHealth().catch(() => false),
        this.checkApiStatus().catch(() => null)
      ]);

      return {
        isHealthy: healthCheck,
        responseTime: this.getLastResponseTime(),
        timestamp: Date.now(),
        version: apiStatus?.version,
        uptime: apiStatus?.uptime
      };
    } catch (error) {
      return {
        isHealthy: false,
        timestamp: Date.now(),
        error: (error as Error).message
      };
    }
  }

  /**
   * Check basic server health endpoint
   * @returns True if health check passes
   */
  private async checkServerHealth(): Promise<boolean> {
    const healthUrl = this.buildHealthUrl();
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const request = this.createRequest(healthUrl, {
        timeout: this.config.healthCheckTimeout,
        method: 'GET'
      });

      request.on('response', (response) => {
        const responseTime = Date.now() - startTime;
        this.updateResponseTime(responseTime);
        
        if (response.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      });

      request.on('timeout', () => {
        request.destroy();
        resolve(false);
      });

      request.on('error', (error) => {
        if (this.config.debug) {
          console.error('Health check request error:', error);
        }
        resolve(false);
      });

      request.end();
    });
  }

  /**
   * Check API status endpoint for WhatsApp connection details
   * @returns API status or null if failed
   */
  private async checkApiStatus(): Promise<ApiStatusResponse | null> {
    const statusUrl = this.buildApiUrl('/api/status');
    
    return new Promise((resolve) => {
      const request = this.createRequest(statusUrl, {
        timeout: this.config.healthCheckTimeout,
        method: 'GET',
        headers: {
          'X-API-Key': this.config.apiKey
        }
      });

      let responseData = '';

      request.on('response', (response) => {
        response.on('data', (chunk) => {
          responseData += chunk;
        });

        response.on('end', () => {
          if (response.statusCode === 200) {
            try {
              const status = JSON.parse(responseData);
              resolve(status);
            } catch (parseError) {
              if (this.config.debug) {
                console.error('Failed to parse API status response:', parseError);
              }
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
      });

      request.on('timeout', () => {
        request.destroy();
        resolve(null);
      });

      request.on('error', (error) => {
        if (this.config.debug) {
          console.error('API status request error:', error);
        }
        resolve(null);
      });

      request.end();
    });
  }

  /**
   * Build health check URL
   * @returns Health check URL
   */
  private buildHealthUrl(): string {
    const baseUrl = this.config.whatsappServerUrl.replace(/\/+$/, '');
    return `${baseUrl}/health`;
  }

  /**
   * Build API endpoint URL
   * @param path - API path
   * @returns Full API URL
   */
  private buildApiUrl(path: string): string {
    const baseUrl = this.config.whatsappServerUrl.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${cleanPath}`;
  }

  /**
   * Create HTTP/HTTPS request based on URL
   * @param url - Target URL
   * @param options - Request options
   * @returns HTTP request object
   */
  private createRequest(url: string, options: RequestOptions): http.ClientRequest {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestOptions = {
      hostname: urlObj.hostname,
      port: parseInt(urlObj.port) || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 3000
    };

    return client.request(requestOptions);
  }

  /**
   * Check if cached result is still valid
   * @returns True if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.cache.lastCheck) return false;
    
    const now = Date.now();
    const cacheAge = now - this.cache.lastCheck;
    
    return cacheAge < this.cache.cacheTimeMs;
  }

  /**
   * Clear health check cache
   */
  clearCache(): void {
    this.cache.lastCheck = null;
    this.cache.lastResult = null;
  }

  /**
   * Configure cache settings
   * @param cacheTimeMs - Cache duration in milliseconds
   */
  setCacheTime(cacheTimeMs: number): void {
    this.cache.cacheTimeMs = cacheTimeMs;
  }

  /**
   * Store response time for performance tracking
   */
  private lastResponseTime: number | undefined;

  private updateResponseTime(responseTime: number): void {
    this.lastResponseTime = responseTime;
  }

  private getLastResponseTime(): number | undefined {
    return this.lastResponseTime;
  }
}