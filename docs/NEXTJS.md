# Whaple + Next.js Setup Guide

Complete guide for integrating Whaple with Next.js applications.

## Quick Setup

### 1. Install Whaple

```bash
npm install https://your-whatsapp-server.com/packages/whaple-1.0.0.tgz
```

### 2. Environment Variables

Create `.env.local` in your Next.js root:

```bash
# Server configuration
WHATSAPP_SERVER_URL=https://your-whatsapp-server.com
WHATSAPP_API_KEY=your-api-key

# Firebase configuration
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

### 3. Create API Route

Create `pages/api/send-message.js` (Pages Router) or `app/api/send-message/route.js` (App Router):

## Pages Router Example

```typescript
// pages/api/send-message.ts
import Whaple from 'whaple';
import type { NextApiRequest, NextApiResponse } from 'next';

interface SendMessageRequest {
  number: string;
  message: string;
  options?: any;
}

interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  method?: string;
  timestamp?: number;
  error?: string;
  details?: string;
}

// Initialize Whaple (can be done outside handler for reuse)
const sdk = new Whaple();

export default async function handler(
  req: NextApiRequest & { body: SendMessageRequest },
  res: NextApiResponse<SendMessageResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).json({ 
      error: 'Phone number and message are required' 
    });
  }

  try {
    const result = await sdk.sendMessage(number, message);
    
    res.status(200).json({
      success: true,
      messageId: result.messageId,
      method: result.method, // 'direct' or 'queued'
      timestamp: result.timestamp
    });
  } catch (error) {
    console.error('WhatsApp send error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to send message',
      details: error.message
    });
  }
}
```

## App Router Example

```typescript
// app/api/send-message/route.ts
import { NextResponse } from 'next/server';
import Whaple from 'whaple';

interface SendMessageBody {
  number: string;
  message: string;
  options?: any;
}

const sdk = new Whaple();

export async function POST(request: Request) {
  try {
    const { number, message }: SendMessageBody = await request.json();

    if (!number || !message) {
      return NextResponse.json(
        { error: 'Phone number and message are required' },
        { status: 400 }
      );
    }

    const result = await sdk.sendMessage(number, message);

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      method: result.method,
      timestamp: result.timestamp
    });
  } catch (error) {
    console.error('WhatsApp send error:', error);

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to send message',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
```

## Frontend Component Examples

### React Hook for Sending Messages

```typescript
// hooks/useWhatsApp.ts
import { useState } from 'react';

export function useWhatsApp() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = async (number, message) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ number, message }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { sendMessage, loading, error };
}
```

### WhatsApp Form Component

```typescript
// components/WhatsAppForm.tsx
import { useState } from 'react';
import { useWhatsApp } from '../hooks/useWhatsApp';

export default function WhatsAppForm() {
  const [number, setNumber] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  
  const { sendMessage, loading, error } = useWhatsApp();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(false);

    try {
      await sendMessage(number, message);
      setSuccess(true);
      setMessage(''); // Clear message after success
    } catch (err) {
      // Error is handled by the hook
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Send WhatsApp Message</h2>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="number" className="block text-sm font-medium text-gray-700">
            Phone Number
          </label>
          <input
            type="tel"
            id="number"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="+1234567890"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            required
          />
        </div>

        <div className="mb-4">
          <label htmlFor="message" className="block text-sm font-medium text-gray-700">
            Message
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here..."
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </form>

      {success && (
        <div className="mt-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          ✅ Message sent successfully!
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          ❌ Error: {error}
        </div>
      )}
    </div>
  );
}
```

## Advanced Features

### Queue Status Dashboard

```typescript
// pages/api/queue-status.ts
import Whaple from 'whaple';

const sdk = new Whaple();

export default async function handler(req, res) {
  try {
    const [queueStatus, serverStatus] = await Promise.all([
      sdk.getQueueStatus(),
      sdk.getServerStatus()
    ]);

    res.status(200).json({
      queue: queueStatus,
      server: serverStatus,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### Message Status Tracking

```typescript
// pages/api/message-status/[messageId].ts
import Whaple from 'whaple';

const sdk = new Whaple();

export default async function handler(req, res) {
  const { messageId } = req.query;

  try {
    const status = await sdk.getMessageStatus(messageId);
    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### Bulk Message Sending

```typescript
// pages/api/send-bulk.ts
import Whaple from 'whaple';

const sdk = new Whaple();

export default async function handler(req, res) {
  const { messages } = req.body; // Array of { number, message }

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages must be an array' });
  }

  const results = [];

  for (const msg of messages) {
    try {
      const result = await sdk.sendMessage(msg.number, msg.message);
      results.push({ ...result, originalMessage: msg });
    } catch (error) {
      results.push({ 
        success: false, 
        error: error.message, 
        originalMessage: msg 
      });
    }

    // Small delay between messages
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  res.status(200).json({ results });
}
```

## Deployment

### Vercel

1. **Environment Variables**: Add in Vercel dashboard
   - Go to Project Settings → Environment Variables
   - Add each variable individually:
     ```
     WHATSAPP_SERVER_URL = https://your-server.com
     WHATSAPP_API_KEY = your-api-key
     FIREBASE_SERVICE_ACCOUNT = {"type":"service_account",...}
     ```

2. **Build Settings**: Default Next.js settings work fine

3. **Functions**: API routes automatically become serverless functions

### Other Platforms

#### Netlify
```bash
# netlify.toml
[build.environment]
  WHATSAPP_SERVER_URL = "https://your-server.com"
  # Add other variables in Netlify dashboard
```

#### Railway
- Use Railway dashboard to add environment variables
- Deploy directly from GitHub

## Error Handling

### Comprehensive Error Handler

```typescript
// utils/errorHandler.ts
export function handleWhatsAppError(error) {
  const errorMap = {
    'WhatsApp server URL is required': 'Server configuration missing',
    'API key is required': 'API authentication failed',
    'Firebase configuration is required': 'Database configuration missing',
    'Phone number is required': 'Invalid phone number format'
  };

  return {
    message: errorMap[error.message] || error.message,
    code: error.code || 'UNKNOWN_ERROR',
    timestamp: Date.now()
  };
}
```

### Use in API Routes

```javascript
import { handleWhatsAppError } from '../../utils/errorHandler';

export default async function handler(req, res) {
  try {
    // ... your code
  } catch (error) {
    const handledError = handleWhatsAppError(error);
    res.status(500).json(handledError);
  }
}
```

## Performance Optimization

### SDK Instance Reuse

```typescript
// lib/whaple.ts
import Whaple from 'whaple';

let sdk;

export function getWhapleSDK() {
  if (!sdk) {
    sdk = new Whaple();
  }
  return sdk;
}
```

### Connection Pooling

```typescript
// Use the singleton pattern
import { getWhapleSDK } from '../../lib/whaple';

export default async function handler(req, res) {
  const sdk = getWhapleSDK(); // Reuses existing instance
  // ... rest of your code
}
```

## Testing

### API Route Tests

```typescript
// __tests__/api/send-message.test.ts
import { createMocks } from 'node-mocks-http';
import handler from '../../pages/api/send-message';

describe('/api/send-message', () => {
  test('sends message successfully', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        number: '+1234567890',
        message: 'Test message'
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.success).toBe(true);
  });
});
```

## Troubleshooting Next.js Issues

### Common Problems

1. **Environment variables not loading**
   - Use `.env.local` not `.env`
   - Restart Next.js dev server after changes
   - Check variable names match exactly

2. **API routes timing out**
   - Increase timeout in next.config.js
   - Check server connectivity
   - Add error handling

3. **Firebase connection issues**
   - Verify JSON format is correct
   - Check Firebase project permissions
   - Enable Realtime Database

### Debug Configuration

```typescript
// pages/api/debug-config.ts
export default function handler(req, res) {
  res.status(200).json({
    hasServerUrl: !!process.env.WHATSAPP_SERVER_URL,
    hasApiKey: !!process.env.WHATSAPP_API_KEY,
    hasFirebaseConfig: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    nodeEnv: process.env.NODE_ENV
  });
}
```

This guide should get you up and running with Whaple in Next.js! 🚀