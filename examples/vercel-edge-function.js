// Example: Vercel Edge Function
// File: api/send-message.js

import Whaple from 'whaple';

const sdk = new Whaple({
  whatsappServerUrl: process.env.WHATSAPP_SERVER_URL,
  apiKey: process.env.WHATSAPP_API_KEY,
  firebaseConfig: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),
  healthCheckTimeout: 3000,
  queueThreshold: 5, // Force queue if >5 pending messages
  enableSmartRouting: true
});

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { number, message, options = {} } = req.body;

    // Validate input
    if (!number || !message) {
      return res.status(400).json({ 
        error: 'Phone number and message are required' 
      });
    }

    // Send message with smart routing
    const result = await sdk.sendMessage(number, message, options);

    return res.json({
      success: true,
      result,
      method: result.method,
      messageId: result.messageId
    });

  } catch (error) {
    console.error('WhatsApp message send failed:', error.message);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
}

// Optional: Add CORS headers for browser requests
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}