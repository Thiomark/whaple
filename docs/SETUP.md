# Whaple Setup Guide

Complete setup instructions for installing and configuring Whaple in your project.

## Quick Start Checklist

- [ ] Install Whaple package
- [ ] Get WhatsApp server URL and API key
- [ ] Create Firebase project and service account
- [ ] Configure environment variables
- [ ] Test the setup

## Step 1: Installation

### Install from Private Server
```bash
npm install https://your-whatsapp-server.com/packages/whaple-1.0.0.tgz
```

### Install from NPM (when public)
```bash
npm install whaple
```

## Step 2: Get Server Access

Contact your WhatsApp server administrator to get:

1. **Server URL**: e.g., `https://your-whatsapp-server.com`
2. **API Key**: Your unique access key
3. **Rate Limits**: Your message limits (if any)

## Step 3: Firebase Setup

### 3.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `your-app-whatsapp` (or similar)
4. Enable Google Analytics (optional)
5. Create project

### 3.2 Enable Realtime Database

1. In Firebase Console, go to **Realtime Database**
2. Click "Create Database"
3. Choose location (closest to your users)
4. Start in **test mode** for now
5. Note your database URL: `https://your-project-default-rtdb.firebaseio.com/`

### 3.3 Create Service Account

1. Go to **Project Settings** (gear icon)
2. Click **Service Accounts** tab
3. Click **Generate new private key**
4. Download the JSON file
5. **Keep this file secure** - it's your Firebase admin credentials

### 3.4 Security Rules (Optional)

For production, update your Realtime Database rules:

```json
{
  "rules": {
    "message_queue": {
      ".read": true,
      ".write": true
    }
  }
}
```

## Step 4: Environment Configuration

### 4.1 Copy Environment Template

```bash
# Copy the template
cp node_modules/whaple/.env.example .env.local

# Or create manually
touch .env.local
```

### 4.2 Configure Variables

Edit `.env.local`:

```bash
# Server configuration (provided by administrator)
WHATSAPP_SERVER_URL=https://your-whatsapp-server.com
WHATSAPP_API_KEY=your-api-key-here

# Firebase configuration (from your service account JSON)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project-id",...}
```

**Converting Firebase JSON to String:**

```bash
# If you have firebase-service-account.json
cat firebase-service-account.json | tr -d '\n' > firebase-string.txt
```

Or use online JSON minifier to create a single-line string.

### 4.3 Verify Configuration

Create a test script `test-config.js`:

```typescript
import Whaple from 'whaple';

async function testConfig() {
  try {
    const sdk = new Whaple();
    console.log('✅ Whaple initialized successfully');
    
    const serverStatus = await sdk.getServerStatus();
    console.log('Server Status:', serverStatus);
    
    const queueStatus = await sdk.getQueueStatus();
    console.log('Queue Status:', queueStatus);
    
    console.log('🎉 Configuration is working!');
  } catch (error) {
    console.error('❌ Configuration error:', (error as Error).message);
  }
}

testConfig();
```

Run the test:
```bash
node test-config.js
```

## Step 5: Basic Usage

### 5.1 Initialize SDK

```typescript
import Whaple from 'whaple';

const sdk = new Whaple({
  // Config is automatically loaded from environment variables
  // You can also override specific values here
});
```

### 5.2 Send Your First Message

```typescript
async function sendMessage() {
  try {
    const result = await sdk.sendMessage('+1234567890', 'Hello from Whaple!');
    console.log('Message sent:', result);
  } catch (error) {
    console.error('Failed to send message:', (error as Error).message);
  }
}

sendMessage();
```

## Environment-Specific Setup

### Next.js Setup
See [Next.js Setup Guide](./NEXTJS.md) for detailed instructions.

### Vercel Setup
1. Add environment variables in Vercel dashboard
2. Go to Project Settings → Environment Variables
3. Add each variable individually

### Other Platforms
- **Netlify**: Use Netlify dashboard environment variables
- **Heroku**: Use `heroku config:set VARIABLE_NAME=value`
- **Railway**: Use Railway dashboard environment variables

## Troubleshooting

### Common Issues

#### 1. "WhatsApp server URL is required"
- Check `WHATSAPP_SERVER_URL` is set
- Verify the URL is correct and accessible
- Make sure there are no trailing spaces

#### 2. "API key is required"
- Check `WHATSAPP_API_KEY` is set
- Verify the API key is correct
- Contact administrator if key is invalid

#### 3. "Firebase configuration is required"
- Check `FIREBASE_SERVICE_ACCOUNT` is set
- Verify it's valid JSON (use JSON validator)
- Make sure private key includes `\\n` for line breaks

#### 4. "Firebase initialization failed"
- Verify your Firebase service account has correct permissions
- Check project ID matches your Firebase project
- Ensure Realtime Database is enabled

#### 5. Connection timeouts
- Check server URL is accessible from your environment
- Verify firewall/network restrictions
- Try increasing health check timeout

### Debug Mode

Enable verbose logging:

```typescript
import Whaple from 'whaple';

const sdk = new Whaple({
  debug: true
});
```

### Test Connectivity

```typescript
// Test server health
const serverStatus = await sdk.getServerStatus();
console.log(serverStatus);

// Test Firebase connection
const queueStatus = await sdk.getQueueStatus();
console.log(queueStatus);
```

## Security Best Practices

### Environment Variables
- Never commit `.env` files to version control
- Use different Firebase projects for dev/staging/production
- Rotate API keys regularly
- Use environment-specific configurations

### Firebase Security
- Set up proper database rules for production
- Use service accounts with minimal required permissions
- Monitor Firebase usage and billing
- Enable Firebase security rules

### API Key Management
- Keep API keys secure
- Don't expose them in client-side code
- Use server-side API routes only
- Request new keys if compromised

## Getting Help

### Documentation
- [API Reference](../README.md#api-reference)
- [Examples](../examples/)
- [Next.js Guide](./NEXTJS.md)

### Support
- Check server status first
- Contact your WhatsApp server administrator
- Review server logs if accessible
- Test with minimal configuration first

### Community
- Share configuration templates (without sensitive data)
- Report bugs and feature requests
- Contribute examples and guides