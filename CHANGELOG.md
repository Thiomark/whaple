# Changelog

All notable changes to the Whaple project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-08-10

### 🎉 Initial Release

First stable release of Whaple - WhatsApp SDK with Smart Routing

### ✨ Added

#### Core Features
- **Smart Routing System**: Automatic message routing based on server health and queue status
- **Direct WhatsApp Integration**: Built-in Baileys support for direct WhatsApp connections
- **Firebase Queue System**: Reliable message queuing with Firebase Realtime Database
- **Health Monitoring**: Automatic server health checks with fallback mechanisms
- **TypeScript Support**: Full TypeScript definitions and interfaces

#### API Methods
- `sendMessage()` - Send messages with automatic smart routing
- `queueMessage()` - Force messages to queue (bypass health checks)
- `sendDirect()` - Force direct API send (bypass queue checks)
- `getSystemStatus()` - Get comprehensive system status
- `getQueueStatus()` - Get current queue statistics
- `getServerStatus()` - Get WhatsApp server health status
- `getMessageStatus()` - Check status of specific messages
- `getQueueDetails()` - Get detailed queue information

#### Direct WhatsApp Features
- `connectToWhatsApp()` - Connect to WhatsApp using Baileys
- `disconnectFromWhatsApp()` - Disconnect from WhatsApp
- `getWhatsAppConnectionStatus()` - Get connection and authentication status
- `getCurrentQR()` - Get QR code for authentication
- `getMessageHistory()` - Get message history with contacts

#### Configuration Options
- WhatsApp server URL configuration
- API key authentication
- Firebase service account integration
- Debug mode and logging
- Health check timeout settings
- Queue processing configuration
- Smart routing threshold settings
- Retry mechanism with configurable attempts and delays

#### Error Handling
- `WhapleError` - Base error class
- `ConfigurationError` - Configuration-related errors
- `ValidationError` - Input validation errors
- `ConnectionError` - Connection and network errors

#### Platform Support
- Node.js applications
- Next.js API routes
- Vercel Edge Functions
- Express.js servers
- AWS Lambda functions
- Other serverless environments

### 🔧 Technical Details

#### Dependencies
- `@whiskeysockets/baileys` ^6.7.18 - WhatsApp Web API implementation
- `firebase-admin` ^13.4.0 - Firebase Admin SDK
- `qrcode` ^1.5.4 - QR code generation
- `qrcode-terminal` ^0.12.0 - Terminal QR code display

#### Requirements
- Node.js >= 16.0.0
- Firebase Realtime Database
- WhatsApp Business API server (for API mode)

#### Build System
- TypeScript compilation
- Jest testing framework
- Security audit integration
- npm packaging and distribution

### 📖 Documentation
- Comprehensive README with examples
- Complete API documentation
- TypeScript type definitions
- Framework integration examples
- Error handling guides

### 🚀 Examples Included
- Basic Node.js usage
- Next.js API route integration
- Vercel Edge Function example
- Express.js server setup
- Direct WhatsApp connection example
- Bulk messaging patterns
- Queue monitoring examples

### 🛡️ Security
- Input validation for phone numbers and messages
- Secure Firebase configuration handling
- API key protection
- Error message sanitization
- Security audit automation

### 📦 Package
- Main entry: `dist/index.js`
- TypeScript definitions: `dist/index.d.ts`
- Source maps included
- Examples and documentation bundled
- npm-ready package structure

---

## Future Releases

### Planned Features
- [ ] Bulk messaging with batch processing
- [ ] Message templates support
- [ ] Media files support (images, documents)
- [ ] Webhook integration
- [ ] Advanced analytics and reporting
- [ ] Multi-account management
- [ ] Rate limiting customization
- [ ] Message scheduling

### Potential Improvements
- [ ] Enhanced error recovery mechanisms
- [ ] Performance optimizations
- [ ] Additional platform integrations
- [ ] Extended configuration options
- [ ] More comprehensive logging
- [ ] Dashboard and monitoring UI

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## Support

- 🐛 [Report Issues](https://github.com/thiomark/whaple/issues)
- 💬 [Discussions](https://github.com/thiomark/whaple/discussions)
- 📖 [Documentation](https://whaple.vercel.app)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.