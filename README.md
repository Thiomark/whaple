# =ñ Whaple - WhatsApp SDK with Smart Routing

[![npm version](https://badge.fury.io/js/whaple.svg)](https://badge.fury.io/js/whaple)
[![Node.js CI](https://github.com/thiomark/whaple/workflows/Node.js%20CI/badge.svg)](https://github.com/thiomark/whaple/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Whaple** is a standalone WhatsApp messaging SDK with direct Baileys integration, Firebase queue system, and intelligent smart routing. Zero Baileys exposure to your application - just clean, simple messaging APIs.

## ( Features

- =€ **Smart Routing**: Automatically routes messages via direct API or queue based on server health
- =ñ **Direct WhatsApp Integration**: Built-in Baileys support for direct WhatsApp connections
- =% **Firebase Queue System**: Reliable message queuing with Firebase Realtime Database
- =á **Health Monitoring**: Automatic server health checks with fallback mechanisms
- ¡ **Edge Function Ready**: Works with Vercel Edge Functions, AWS Lambda, and other serverless platforms
- =' **TypeScript Support**: Full TypeScript definitions included
- <¯ **Zero Dependencies Exposure**: Clean API without exposing underlying Baileys complexity
- =Ê **Queue Management**: Real-time queue status monitoring and message tracking
- = **Auto Retry**: Built-in retry mechanism with configurable attempts and delays
- < **Multi-Platform**: Works in Node.js, Next.js, and serverless environments

## =æ Installation

```bash
npm install whaple
```

## =€ Quick Start

### Basic Usage

```javascript
const Whaple = require('whaple');

// Initialize with your configuration
const sdk = new Whaple({
  whatsappServerUrl: 'https://your-whatsapp-server.com',
  apiKey: 'your-api-key',
  firebaseConfig: {
    type: 'service_account',
    project_id: 'your-project-id',
    private_key: 'your-private-key',
    client_email: 'service-account@project.iam.gserviceaccount.com',
    // ... other Firebase config fields
  },
  enableSmartRouting: true,
  debug: true
});

// Send a message with smart routing
async function sendMessage() {
  try {
    const result = await sdk.sendMessage('+1234567890', 'Hello from Whaple!');
    console.log('Message sent:', result);
  } catch (error) {
    console.error('Error:', error.message);
  }
}
```

### Direct WhatsApp Mode (New!)

```javascript
// Initialize in direct WhatsApp mode
const sdk = new Whaple({
  useDirectWhatsApp: true,
  firebaseConfig: { /* your config */ },
  debug: true
});

// Connect to WhatsApp
await sdk.connectToWhatsApp();

// Check connection status
const status = sdk.getWhatsAppConnectionStatus();
console.log('Connected:', status.isConnected);

// Get QR code for authentication
const qr = sdk.getCurrentQR();
if (qr) {
  console.log('Scan QR code:', qr);
}

// Send message directly
const result = await sdk.sendMessage('+1234567890', 'Direct WhatsApp message!');
```

## =' Configuration

### Environment Variables

Create a `.env` file:

```env
WHATSAPP_SERVER_URL=https://your-whatsapp-server.com
WHATSAPP_API_KEY=your-api-key
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
```

### Configuration Options

```typescript
interface WhapleConfig {
  whatsappServerUrl?: string;        // Your WhatsApp API server URL
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

## =Ö API Reference

### Core Methods

#### `sendMessage(number, message, options?)`
Send a WhatsApp message with automatic smart routing.

```javascript
const result = await sdk.sendMessage('+1234567890', 'Hello!', {
  priority: 'high',
  source: 'api'
});
```

**Returns:** `SendMessageResult`
```typescript
{
  success: boolean;
  messageId: string;
  method: 'direct' | 'queued';
  timestamp: number;
  position?: number;
  error?: string;
}
```

#### `queueMessage(number, message, options?)`
Force a message to be queued (bypass health checks).

```javascript
const result = await sdk.queueMessage('+1234567890', 'Queued message');
```

#### `sendDirect(number, message, options?)`
Force direct API send (bypass queue checks).

```javascript
const result = await sdk.sendDirect('+1234567890', 'Direct message');
```

### Status & Monitoring

#### `getSystemStatus()`
Get comprehensive system status including queue, server, and SDK information.

```javascript
const status = await sdk.getSystemStatus();
console.log(status);
```

#### `getQueueStatus()`
Get current queue statistics.

```javascript
const queueStatus = await sdk.getQueueStatus();
// { pendingMessages: 5, processingMessages: 1, isProcessing: true, ... }
```

#### `getServerStatus()`
Get WhatsApp server health status.

```javascript
const serverStatus = await sdk.getServerStatus();
// { isHealthy: true, responseTime: 150, timestamp: 1634567890 }
```

#### `getMessageStatus(messageId)`
Check the status of a specific message.

```javascript
const status = await sdk.getMessageStatus('msg_12345');
// { id: 'msg_12345', status: 'sent', timestamp: 1634567890 }
```

### Direct WhatsApp Methods

#### `connectToWhatsApp()`
Connect to WhatsApp (direct mode only).

```javascript
await sdk.connectToWhatsApp();
```

#### `disconnectFromWhatsApp()`
Disconnect from WhatsApp.

```javascript
await sdk.disconnectFromWhatsApp();
```

#### `getWhatsAppConnectionStatus()`
Get connection status and authentication info.

```javascript
const status = sdk.getWhatsAppConnectionStatus();
// { isConnected: true, isAuthenticated: true, userInfo: {...} }
```

#### `getCurrentQR()`
Get current QR code for WhatsApp authentication.

```javascript
const qr = sdk.getCurrentQR();
if (qr) {
  console.log('Scan this QR code:', qr);
}
```

#### `getMessageHistory(number, limit?)`
Get message history with a contact (direct mode only).

```javascript
const history = await sdk.getMessageHistory('+1234567890', 20);
```

### Utility Methods

#### `configure(newConfig)`
Update SDK configuration at runtime.

```javascript
sdk.configure({
  enableSmartRouting: false,
  debug: true
});
```

#### `cleanup()`
Clean up resources and connections.

```javascript
await sdk.cleanup();
```

## < Framework Examples

### Next.js API Route

```javascript
// pages/api/send-message.js
import Whaple from 'whaple';

const sdk = new Whaple(); // Uses environment variables

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { number, message } = req.body;

  try {
    const result = await sdk.sendMessage(number, message, {
      source: 'nextjs-api'
    });
    
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
```

### Vercel Edge Function

```javascript
// api/send-message.js
import Whaple from 'whaple';

export const config = {
  runtime: 'edge'
};

const sdk = new Whaple({
  whatsappServerUrl: process.env.WHATSAPP_SERVER_URL,
  apiKey: process.env.WHATSAPP_API_KEY,
  firebaseConfig: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
});

export default async function handler(req) {
  const { number, message } = await req.json();
  
  try {
    const result = await sdk.sendMessage(number, message);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### Express.js

```javascript
const express = require('express');
const Whaple = require('whaple');

const app = express();
const sdk = new Whaple();

app.post('/send', async (req, res) => {
  try {
    const { number, message } = req.body;
    const result = await sdk.sendMessage(number, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

## =Ê Smart Routing Logic

Whaple's smart routing automatically decides the best way to send your messages:

1. **Health Check**: Checks if your WhatsApp server is responding
2. **Queue Analysis**: Examines current queue load and processing status
3. **Routing Decision**: 
   - **Direct API**: If server is healthy and queue is light
   - **Queue System**: If server is down or queue is heavy
4. **Automatic Fallback**: Direct sends automatically fall back to queue on failure

```javascript
// Smart routing in action
const result = await sdk.sendMessage('+1234567890', 'Hello!');

if (result.method === 'direct') {
  console.log('Sent immediately via API');
} else if (result.method === 'queued') {
  console.log(`Queued at position ${result.position}`);
}
```

## = Queue System

### Queue Benefits
- **Reliability**: Messages are never lost
- **Rate Limiting**: Prevents API overload
- **Retry Logic**: Automatic retries on failure
- **Monitoring**: Real-time queue status

### Queue Monitoring

```javascript
// Monitor queue status
const status = await sdk.getQueueStatus();
console.log({
  pending: status.pendingMessages,
  processing: status.processingMessages,
  sent: status.sentMessages,
  failed: status.failedMessages
});

// Get detailed queue information
const details = await sdk.getQueueDetails();
console.log('Queue messages:', details.messages);
```

## =à Error Handling

Whaple provides specific error types for better error handling:

```javascript
const { ConfigurationError, ValidationError, ConnectionError } = require('whaple');

try {
  await sdk.sendMessage('invalid-number', 'Hello');
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('Invalid phone number format');
  } else if (error instanceof ConnectionError) {
    console.log('Server connection failed');
  } else if (error instanceof ConfigurationError) {
    console.log('SDK configuration error');
  }
}
```

## >ê Testing

```bash
# Run all tests
npm test

# Run TypeScript tests
npm run test:ts

# Build and test
npm run build && npm test
```

## <× Development

```bash
# Clone the repository
git clone https://github.com/thiomark/whaple.git
cd whaple

# Install dependencies
npm install

# Build the project
npm run build

# Watch for changes
npm run dev

# Run security audit
npm run audit
```

## =Ë Requirements

- Node.js >= 16.0.0
- Firebase Realtime Database
- WhatsApp Business API server (for API mode)

## > Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## =Ä License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## <˜ Support

- =Ö [Documentation](https://whaple.vercel.app)
- = [Issue Tracker](https://github.com/thiomark/whaple/issues)
- =¬ [Discussions](https://github.com/thiomark/whaple/discussions)

## =ú Roadmap

- [ ] Bulk messaging with batch processing
- [ ] Message templates support
- [ ] Media files support (images, documents)
- [ ] Webhook integration
- [ ] Advanced analytics and reporting
- [ ] Multi-account management
- [ ] Rate limiting customization
- [ ] Message scheduling

## =O Acknowledgments

- [Baileys](https://github.com/WhiskeySockets/Baileys) - WhatsApp Web API implementation
- [Firebase](https://firebase.google.com) - Real-time database and authentication
- All contributors and users of this project

---

**Made with d by the Whaple Team**

For more information, visit [whaple.vercel.app](https://whaple.vercel.app)