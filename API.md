# 📖 Whaple API Documentation

Complete API reference for the Whaple WhatsApp SDK.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Core Methods](#core-methods)
- [Status & Monitoring](#status--monitoring)
- [Direct WhatsApp Methods](#direct-whatsapp-methods)
- [Utility Methods](#utility-methods)
- [Types & Interfaces](#types--interfaces)
- [Error Handling](#error-handling)
- [Examples](#examples)

## Installation

```bash
npm install whaple
```

## Configuration

### Basic Configuration

```javascript
const Whaple = require('whaple');

const sdk = new Whaple({
  whatsappServerUrl: 'https://your-server.com',
  apiKey: 'your-api-key',
  firebaseConfig: {
    // Firebase service account configuration
  },
  enableSmartRouting: true,
  debug: false
});
```

### Configuration Interface

```typescript
interface WhapleConfig {
  whatsappServerUrl?: string;        // WhatsApp API server URL
  apiKey?: string;                   // API authentication key
  firebaseConfig?: FirebaseServiceAccount; // Firebase configuration
  useDirectWhatsApp?: boolean;       // Enable direct WhatsApp connection
  debug?: boolean;                   // Enable debug logging
  healthCheckTimeout?: number;       // Health check timeout (default: 3000ms)
  queueTimeout?: number;            // Queue processing timeout (default: 30000ms)
  enableSmartRouting?: boolean;     // Enable smart routing (default: true)
  queueThreshold?: number;          // Queue threshold for routing (default: 0)
  retryAttempts?: number;           // Number of retry attempts (default: 2)
  retryDelay?: number;              // Delay between retries (default: 1000ms)
}
```

## Core Methods

### `sendMessage(number, message, options?)`

Send a WhatsApp message with automatic smart routing.

**Parameters:**
- `number` (string): Phone number with country code (e.g., '+1234567890')
- `message` (string): Message content to send
- `options` (SendMessageOptions, optional): Additional options

**Returns:** `Promise<SendMessageResult>`

**Example:**
```javascript
const result = await sdk.sendMessage('+1234567890', 'Hello World!', {
  priority: 'high',
  source: 'api',
  timestamp: Date.now()
});

console.log(result);
// {
//   success: true,
//   messageId: 'msg_12345',
//   method: 'direct',
//   timestamp: 1634567890,
//   position: undefined
// }
```

### `queueMessage(number, message, options?)`

Force a message to be queued, bypassing health checks.

**Parameters:**
- `number` (string): Phone number with country code
- `message` (string): Message content
- `options` (SendMessageOptions, optional): Additional options

**Returns:** `Promise<SendMessageResult>`

**Example:**
```javascript
const result = await sdk.queueMessage('+1234567890', 'Queued message');

console.log(result);
// {
//   success: true,
//   messageId: 'queue_67890',
//   method: 'queued',
//   timestamp: 1634567890,
//   position: 3
// }
```

### `sendDirect(number, message, options?)`

Force direct API send, bypassing queue checks.

**Parameters:**
- `number` (string): Phone number with country code
- `message` (string): Message content
- `options` (SendMessageOptions, optional): Additional options

**Returns:** `Promise<any>`

**Example:**
```javascript
try {
  const result = await sdk.sendDirect('+1234567890', 'Direct message');
  console.log('Sent directly:', result);
} catch (error) {
  console.error('Direct send failed:', error.message);
}
```

## Status & Monitoring

### `getSystemStatus()`

Get comprehensive system status including queue, server, and SDK information.

**Returns:** `Promise<SystemStatus>`

**Example:**
```javascript
const status = await sdk.getSystemStatus();

console.log(status);
// {
//   timestamp: 1634567890,
//   queue: {
//     status: { pendingMessages: 5, processingMessages: 1, ... },
//     details: { messages: [...], ... }
//   },
//   server: { isHealthy: true, responseTime: 150, ... },
//   sdk: { version: '1.0.0', config: {...} }
// }
```

### `getQueueStatus()`

Get current queue statistics.

**Returns:** `Promise<QueueStatus>`

**Example:**
```javascript
const queueStatus = await sdk.getQueueStatus();

console.log(queueStatus);
// {
//   totalMessages: 10,
//   pendingMessages: 5,
//   processingMessages: 1,
//   sentMessages: 3,
//   failedMessages: 1,
//   isProcessing: true,
//   lastProcessed: 1634567890,
//   nextProcessingTime: 1634567900
// }
```

### `getServerStatus()`

Get WhatsApp server health status.

**Returns:** `Promise<ServerStatus>`

**Example:**
```javascript
const serverStatus = await sdk.getServerStatus();

console.log(serverStatus);
// {
//   isHealthy: true,
//   responseTime: 150,
//   timestamp: 1634567890,
//   version: '2.0.0',
//   uptime: 86400
// }
```

### `getMessageStatus(messageId)`

Check the status of a specific message.

**Parameters:**
- `messageId` (string): The message ID to check

**Returns:** `Promise<MessageStatus>`

**Example:**
```javascript
const status = await sdk.getMessageStatus('msg_12345');

console.log(status);
// {
//   id: 'msg_12345',
//   status: 'sent',
//   timestamp: 1634567890,
//   sentAt: 1634567895,
//   position: undefined
// }
```

### `getQueueDetails()`

Get detailed queue information including individual messages.

**Returns:** `Promise<QueueDetails>`

**Example:**
```javascript
const details = await sdk.getQueueDetails();

console.log(details);
// {
//   messages: [
//     {
//       id: 'queue_123',
//       number: '+1234567890',
//       message: 'Hello',
//       status: 'pending',
//       timestamp: 1634567890,
//       retryCount: 0,
//       position: 1
//     }
//   ],
//   totalCount: 5,
//   processingCount: 1
// }
```

## Direct WhatsApp Methods

These methods are only available when `useDirectWhatsApp: true` is set in configuration.

### `connectToWhatsApp()`

Connect to WhatsApp using direct Baileys integration.

**Returns:** `Promise<void>`

**Example:**
```javascript
try {
  await sdk.connectToWhatsApp();
  console.log('Connected to WhatsApp');
} catch (error) {
  console.error('Connection failed:', error.message);
}
```

### `disconnectFromWhatsApp()`

Disconnect from WhatsApp.

**Returns:** `Promise<void>`

**Example:**
```javascript
await sdk.disconnectFromWhatsApp();
console.log('Disconnected from WhatsApp');
```

### `getWhatsAppConnectionStatus()`

Get current WhatsApp connection status and authentication info.

**Returns:** `WhatsAppConnectionStatus | null`

**Example:**
```javascript
const status = sdk.getWhatsAppConnectionStatus();

if (status) {
  console.log(status);
  // {
  //   isConnected: true,
  //   isAuthenticated: true,
  //   userInfo: { id: '1234567890', name: 'Business Account' },
  //   reconnectAttempts: 0,
  //   isReconnecting: false,
  //   connectionState: 'open',
  //   currentQR: null,
  //   lastQRTime: undefined
  // }
}
```

### `getCurrentQR()`

Get current QR code for WhatsApp authentication.

**Returns:** `string | null`

**Example:**
```javascript
const qr = sdk.getCurrentQR();

if (qr) {
  console.log('Scan this QR code to authenticate:', qr);
  // Display QR code to user for scanning
} else {
  console.log('No QR code available - already authenticated or not needed');
}
```

### `getMessageHistory(number, limit?)`

Get message history with a specific contact (direct mode only).

**Parameters:**
- `number` (string): Phone number to get history for
- `limit` (number, optional): Number of messages to retrieve (default: 20)

**Returns:** `Promise<MessageHistory>`

**Example:**
```javascript
const history = await sdk.getMessageHistory('+1234567890', 50);

console.log(history);
// [
//   {
//     id: 'msg_1',
//     from: '+1234567890',
//     message: 'Hello',
//     timestamp: 1634567890,
//     fromMe: false
//   },
//   {
//     id: 'msg_2',
//     from: 'me',
//     message: 'Hi there!',
//     timestamp: 1634567900,
//     fromMe: true
//   }
// ]
```

## Utility Methods

### `configure(newConfig)`

Update SDK configuration at runtime.

**Parameters:**
- `newConfig` (Partial<WhapleConfig>): Configuration updates

**Returns:** `void`

**Example:**
```javascript
sdk.configure({
  enableSmartRouting: false,
  debug: true,
  queueThreshold: 10
});
```

### `cleanup()`

Clean up resources and close connections.

**Returns:** `Promise<void>`

**Example:**
```javascript
// Clean up when shutting down
process.on('SIGINT', async () => {
  await sdk.cleanup();
  process.exit(0);
});
```

## Types & Interfaces

### `SendMessageOptions`

```typescript
interface SendMessageOptions {
  source?: string;                    // Message source identifier
  timestamp?: number;                 // Custom timestamp
  priority?: 'high' | 'medium' | 'low'; // Message priority
  retryCount?: number;               // Number of retries attempted
  [key: string]: any;                // Additional custom fields
}
```

### `SendMessageResult`

```typescript
interface SendMessageResult {
  success: boolean;                   // Whether message was sent successfully
  messageId: string;                  // Unique message identifier
  method: 'direct' | 'queued';       // How the message was sent
  timestamp: number;                  // When the message was processed
  position?: number;                  // Queue position (if queued)
  queueId?: string;                   // Queue identifier
  error?: string;                     // Error message if failed
  key?: any;                         // WhatsApp message key (direct mode)
}
```

### `QueueStatus`

```typescript
interface QueueStatus {
  totalMessages: number;              // Total messages in queue
  pendingMessages: number;            // Messages waiting to be sent
  processingMessages: number;         // Messages currently being sent
  sentMessages: number;               // Successfully sent messages
  failedMessages: number;             // Failed messages
  isProcessing: boolean;              // Whether queue is actively processing
  lastProcessed?: number;             // Timestamp of last processed message
  nextProcessingTime?: number;        // When next processing will occur
}
```

### `ServerStatus`

```typescript
interface ServerStatus {
  isHealthy: boolean;                 // Server health status
  responseTime?: number;              // Response time in milliseconds
  error?: string;                     // Error message if unhealthy
  timestamp: number;                  // When status was checked
  version?: string;                   // Server version
  uptime?: number;                    // Server uptime in seconds
}
```

### `WhatsAppConnectionStatus`

```typescript
interface WhatsAppConnectionStatus {
  isConnected: boolean;               // Whether connected to WhatsApp
  isAuthenticated: boolean;           // Whether authenticated with WhatsApp
  userInfo?: any;                     // WhatsApp user information
  reconnectAttempts: number;          // Number of reconnection attempts
  isReconnecting: boolean;            // Whether currently reconnecting
  connectionState: string;            // Current connection state
  currentQR?: string;                 // Current QR code (if available)
  lastQRTime?: Date;                  // When QR code was last generated
}
```

## Error Handling

### Error Types

Whaple provides specific error classes for different types of failures:

```javascript
const { 
  WhapleError, 
  ConfigurationError, 
  ValidationError, 
  ConnectionError 
} = require('whaple');
```

### `WhapleError`

Base error class for all Whaple errors.

```typescript
class WhapleError extends Error {
  public code: string;
  public timestamp: number;
}
```

### `ConfigurationError`

Thrown when there are configuration issues.

**Common causes:**
- Missing required configuration
- Invalid Firebase credentials
- Invalid server URLs

**Example:**
```javascript
try {
  const sdk = new Whaple({}); // No configuration
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.log('Configuration error:', error.message);
  }
}
```

### `ValidationError`

Thrown when input validation fails.

**Common causes:**
- Invalid phone number format
- Empty message content
- Invalid options

**Example:**
```javascript
try {
  await sdk.sendMessage('invalid-number', 'Hello');
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Validation error:', error.message);
  }
}
```

### `ConnectionError`

Thrown when connection to external services fails.

**Common causes:**
- Server unreachable
- Network timeouts
- Authentication failures

**Example:**
```javascript
try {
  await sdk.sendMessage('+1234567890', 'Hello');
} catch (error) {
  if (error instanceof ConnectionError) {
    console.log('Connection error:', error.message);
    // Maybe retry or use fallback
  }
}
```

## Examples

### Basic Message Sending

```javascript
const Whaple = require('whaple');

const sdk = new Whaple({
  whatsappServerUrl: process.env.WHATSAPP_SERVER_URL,
  apiKey: process.env.WHATSAPP_API_KEY,
  firebaseConfig: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
});

async function sendMessage() {
  try {
    const result = await sdk.sendMessage('+1234567890', 'Hello from Whaple!');
    
    if (result.success) {
      console.log(`Message sent via ${result.method}`);
      console.log(`Message ID: ${result.messageId}`);
      
      if (result.method === 'queued') {
        console.log(`Queue position: ${result.position}`);
      }
    }
  } catch (error) {
    console.error('Failed to send message:', error.message);
  }
}

sendMessage();
```

### Queue Monitoring

```javascript
async function monitorQueue() {
  setInterval(async () => {
    try {
      const status = await sdk.getQueueStatus();
      
      console.log(`Queue Status:
        Pending: ${status.pendingMessages}
        Processing: ${status.processingMessages}
        Sent: ${status.sentMessages}
        Failed: ${status.failedMessages}
      `);
      
      if (status.pendingMessages > 10) {
        console.warn('Queue is getting backed up!');
      }
    } catch (error) {
      console.error('Failed to get queue status:', error.message);
    }
  }, 5000); // Check every 5 seconds
}

monitorQueue();
```

### Direct WhatsApp Integration

```javascript
const sdk = new Whaple({
  useDirectWhatsApp: true,
  firebaseConfig: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),
  debug: true
});

async function setupDirectWhatsApp() {
  try {
    console.log('Connecting to WhatsApp...');
    await sdk.connectToWhatsApp();
    
    // Check if QR code is needed
    const qr = sdk.getCurrentQR();
    if (qr) {
      console.log('Please scan this QR code:', qr);
      // You can also generate a QR code image and display it
    }
    
    // Wait for authentication
    let status = sdk.getWhatsAppConnectionStatus();
    while (!status.isAuthenticated) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      status = sdk.getWhatsAppConnectionStatus();
    }
    
    console.log('WhatsApp authenticated successfully!');
    
    // Now you can send messages
    const result = await sdk.sendMessage('+1234567890', 'Hello from direct WhatsApp!');
    console.log('Message sent:', result);
    
  } catch (error) {
    console.error('WhatsApp setup failed:', error.message);
  }
}

setupDirectWhatsApp();
```

### Bulk Message Sending

```javascript
async function sendBulkMessages(contacts, message) {
  const results = [];
  
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    
    try {
      console.log(`Sending ${i + 1}/${contacts.length} to ${contact}`);
      
      const result = await sdk.sendMessage(contact, message, {
        source: 'bulk-send',
        batchId: 'batch_123'
      });
      
      results.push({
        contact,
        success: true,
        messageId: result.messageId,
        method: result.method
      });
      
      // Add delay between messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Failed to send to ${contact}:`, error.message);
      results.push({
        contact,
        success: false,
        error: error.message
      });
    }
  }
  
  // Summary
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`Bulk send complete: ${successful} successful, ${failed} failed`);
  return results;
}

// Usage
const contacts = ['+1234567890', '+0987654321', '+1122334455'];
sendBulkMessages(contacts, 'Bulk message from Whaple!');
```

---

For more examples and advanced usage patterns, visit the [GitHub repository](https://github.com/thiomark/whaple) or [official documentation](https://whaple.vercel.app).