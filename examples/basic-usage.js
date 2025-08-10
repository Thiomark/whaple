// Example: Basic Node.js Usage
// This example shows how to use Whaple in a regular Node.js application

const Whaple = require('whaple');

// Initialize Whaple
const sdk = new Whaple({
  whatsappServerUrl: 'https://your-whatsapp-server.com',
  apiKey: 'your-api-key',
  firebaseConfig: {
    type: 'service_account',
    project_id: 'your-project-id',
    private_key: 'your-private-key',
    client_email: 'your-service-account-email@project.iam.gserviceaccount.com',
    // ... other Firebase config fields
  },
  healthCheckTimeout: 3000,
  queueThreshold: 0, // Always use smart routing
  enableSmartRouting: true
});

async function basicExample() {
  try {
    console.log('=== Basic WhatsApp SDK Usage ===\n');

    // 1. Check server status
    console.log('1. Checking server status...');
    const serverStatus = await sdk.getServerStatus();
    console.log('Server Status:', serverStatus);
    console.log();

    // 2. Check queue status
    console.log('2. Checking queue status...');
    const queueStatus = await sdk.getQueueStatus();
    console.log('Queue Status:', queueStatus);
    console.log();

    // 3. Send a message with smart routing
    console.log('3. Sending message with smart routing...');
    const result = await sdk.sendMessage('+1234567890', 'Hello from WhatsApp SDK!');
    console.log('Send Result:', result);
    console.log(`Message sent via: ${result.method}`);
    console.log(`Message ID: ${result.messageId}`);
    console.log();

    // 4. Force queue a message
    console.log('4. Force queuing a message...');
    const queueResult = await sdk.queueMessage('+1234567890', 'This message goes to queue');
    console.log('Queue Result:', queueResult);
    console.log();

    // 5. Check message status
    console.log('5. Checking message status...');
    const messageStatus = await sdk.getMessageStatus(result.messageId);
    console.log('Message Status:', messageStatus);
    console.log();

  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function bulkMessagesExample() {
  try {
    console.log('=== Bulk Messages Example ===\n');

    const messages = [
      { number: '+1234567890', message: 'Bulk message 1' },
      { number: '+0987654321', message: 'Bulk message 2' },
      { number: '+1122334455', message: 'Bulk message 3' }
    ];

    console.log(`Sending ${messages.length} messages...`);

    const results = [];
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      console.log(`Sending message ${i + 1}/${messages.length} to ${msg.number}`);
      
      try {
        const result = await sdk.sendMessage(msg.number, msg.message);
        results.push({ ...result, originalIndex: i });
        console.log(`✅ Sent via ${result.method} - ID: ${result.messageId}`);
      } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
        results.push({ success: false, error: error.message, originalIndex: i });
      }

      // Small delay between messages
      if (i < messages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n=== Bulk Results Summary ===');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const queued = results.filter(r => r.method === 'queued').length;
    const direct = results.filter(r => r.method === 'direct').length;

    console.log(`Total: ${results.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`Sent direct: ${direct}`);
    console.log(`Sent via queue: ${queued}`);

  } catch (error) {
    console.error('Bulk send error:', error.message);
  }
}

async function queueMonitoringExample() {
  try {
    console.log('=== Queue Monitoring Example ===\n');

    // Monitor queue status every 5 seconds for 30 seconds
    const monitorDuration = 30000; // 30 seconds
    const checkInterval = 5000;    // 5 seconds
    const endTime = Date.now() + monitorDuration;

    console.log(`Monitoring queue for ${monitorDuration / 1000} seconds...`);

    while (Date.now() < endTime) {
      const status = await sdk.getQueueStatus();
      const timestamp = new Date().toLocaleTimeString();
      
      console.log(`[${timestamp}] Queue: ${status.pending} pending, ${status.processing} processing, Server: ${status.serverAlive ? 'Online' : 'Offline'}`);

      if (status.pending > 0) {
        console.log(`  └── ${status.pending} messages waiting to be processed`);
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    console.log('Monitoring complete.');

  } catch (error) {
    console.error('Monitoring error:', error.message);
  }
}

// Run examples
async function runAllExamples() {
  await basicExample();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await bulkMessagesExample();
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await queueMonitoringExample();

  // Clean up resources
  await sdk.cleanup();
  console.log('SDK cleanup complete.');
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(error => {
    console.error('Example failed:', error.message);
    process.exit(1);
  });
}

module.exports = {
  basicExample,
  bulkMessagesExample,
  queueMonitoringExample,
  sdk
};