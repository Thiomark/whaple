// Next.js API Route for sending WhatsApp messages using Whaple (TypeScript)
import Whaple from 'whaple';
import type { NextApiRequest, NextApiResponse } from 'next';

interface SendMessageRequest {
  number: string;
  message: string;
  options?: any;
}

interface SendMessageResponse {
  success: boolean;
  message?: string;
  data?: {
    messageId: string;
    method: string;
    timestamp: number;
    to: string;
    queuePosition?: number | null;
  };
  error?: string;
  details?: string;
  type?: string;
  timestamp?: number;
  received?: {
    number: boolean;
    message: boolean;
  };
}

// Initialize Whaple SDK (reused across requests)
let sdk: Whaple;
function getSDK() {
  if (!sdk) {
    sdk = new Whaple({
      // Configuration is automatically loaded from environment variables
      // You can override specific values here if needed
    });
  }
  return sdk;
}

export default async function handler(
  req: NextApiRequest & { body: SendMessageRequest },
  res: NextApiResponse<SendMessageResponse>
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false,
      error: 'Method not allowed. Use POST.' 
    });
  }

  const { number, message, options = {} } = req.body;

  // Validate required fields
  if (!number || !message) {
    return res.status(400).json({
      success: false,
      error: 'Both phone number and message are required',
      received: { number: !!number, message: !!message }
    });
  }

  try {
    const whaple = getSDK();
    
    // Send message with Whaple (includes smart routing)
    const result = await whaple.sendMessage(number, message, {
      source: 'nextjs-api',
      timestamp: Date.now(),
      ...options
    });

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        messageId: result.messageId,
        method: result.method, // 'direct' or 'queued'
        timestamp: result.timestamp,
        to: number,
        queuePosition: result.position || null
      }
    });

  } catch (error) {
    console.error('Whaple send error:', error);

    // Determine error type and status code
    let statusCode = 500;
    let errorType = 'SEND_ERROR';

    const errorMessage = (error as Error).message;
    if (errorMessage.includes('server URL') || errorMessage.includes('API key')) {
      statusCode = 500;
      errorType = 'CONFIGURATION_ERROR';
    } else if (errorMessage.includes('Firebase')) {
      statusCode = 500;
      errorType = 'DATABASE_ERROR';
    } else if (errorMessage.includes('Phone number')) {
      statusCode = 400;
      errorType = 'VALIDATION_ERROR';
    }

    res.status(statusCode).json({
      success: false,
      error: 'Failed to send WhatsApp message',
      details: errorMessage,
      type: errorType,
      timestamp: Date.now()
    });
  }
}