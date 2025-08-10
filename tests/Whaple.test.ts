import { Whaple } from '../src/Whaple';
import * as admin from 'firebase-admin';

// Mock Firebase Admin
const mockDatabase = {
  ref: jest.fn(() => ({
    once: jest.fn(() => Promise.resolve({ exists: () => false })),
    set: jest.fn(() => Promise.resolve()),
    update: jest.fn(() => Promise.resolve())
  }))
};

const mockApp = {
  delete: jest.fn(() => Promise.resolve())
};

jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(() => mockApp),
  database: jest.fn(() => mockDatabase),
  credential: {
    cert: jest.fn()
  }
}));

// Mock qrcode-terminal
jest.mock('qrcode-terminal', () => ({
  generate: jest.fn()
}));

describe('Whaple', () => {
  const mockFirebaseConfig = {
    type: 'service_account',
    project_id: 'test-project',
    private_key: 'mock-private-key',
    client_email: 'test@test.com',
    private_key_id: 'mock-key-id',
    client_id: 'mock-client-id',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs/test'
  };

  describe('Constructor', () => {
    it('should create instance with valid config', () => {
      const whaple = new Whaple({
        useDirectWhatsApp: true,
        firebaseConfig: mockFirebaseConfig,
        debug: false
      });

      expect(whaple).toBeInstanceOf(Whaple);
    });

    it('should throw error with invalid config', () => {
      expect(() => {
        new Whaple({
          whatsappServerUrl: 'http://test.com',
          // Missing apiKey
          firebaseConfig: mockFirebaseConfig
        });
      }).toThrow('API key is required when not using direct WhatsApp connection');
    });

    it('should throw error without Firebase config', () => {
      expect(() => {
        new Whaple({
          useDirectWhatsApp: true
          // Missing firebaseConfig
        });
      }).toThrow('Firebase configuration is required');
    });
  });

  describe('Phone Number Normalization', () => {
    let whaple: Whaple;

    beforeEach(() => {
      whaple = new Whaple({
        useDirectWhatsApp: true,
        firebaseConfig: mockFirebaseConfig,
        debug: false
      });
    });

    it('should normalize phone numbers correctly', () => {
      // Access private method via any for testing
      const normalizePhoneNumber = (whaple as any).normalizePhoneNumber;
      
      expect(normalizePhoneNumber('1234567890')).toBe('+1234567890');
      expect(normalizePhoneNumber('+1234567890')).toBe('+1234567890');
      expect(normalizePhoneNumber('(123) 456-7890')).toBe('+1234567890');
      expect(normalizePhoneNumber('123-456-7890')).toBe('+1234567890');
    });

    it('should throw error for invalid phone numbers', () => {
      const normalizePhoneNumber = (whaple as any).normalizePhoneNumber;
      
      expect(() => normalizePhoneNumber('')).toThrow('Phone number is required');
      expect(() => normalizePhoneNumber(null)).toThrow('Phone number is required');
      expect(() => normalizePhoneNumber(undefined)).toThrow('Phone number is required');
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration correctly', () => {
      const whaple = new Whaple({
        useDirectWhatsApp: true,
        firebaseConfig: mockFirebaseConfig,
        debug: false
      });

      expect(() => {
        whaple.configure({
          debug: true,
          queueThreshold: 10
        });
      }).not.toThrow();
    });
  });

  describe('Connection Status', () => {
    it('should return null for WhatsApp status when not in direct mode', () => {
      const whaple = new Whaple({
        whatsappServerUrl: 'http://test.com',
        apiKey: 'test-key',
        firebaseConfig: mockFirebaseConfig
      });

      const status = whaple.getWhatsAppConnectionStatus();
      expect(status).toBeNull();
    });

    it('should return connection status in direct mode', () => {
      const whaple = new Whaple({
        useDirectWhatsApp: true,
        firebaseConfig: mockFirebaseConfig
      });

      const status = whaple.getWhatsAppConnectionStatus();
      expect(status).toBeDefined();
      expect(status).toHaveProperty('isConnected');
      expect(status).toHaveProperty('isAuthenticated');
    });
  });

  describe('Error Handling', () => {
    it('should handle sendMessage errors gracefully', async () => {
      const whaple = new Whaple({
        useDirectWhatsApp: true,
        firebaseConfig: mockFirebaseConfig
      });

      // Should throw error when WhatsApp is not connected
      await expect(
        whaple.sendMessage('+1234567890', 'Test message')
      ).rejects.toThrow();
    });

    it('should handle getMessageHistory errors gracefully', async () => {
      const whaple = new Whaple({
        useDirectWhatsApp: true,
        firebaseConfig: mockFirebaseConfig
      });

      // Should throw error when WhatsApp is not connected
      await expect(
        whaple.getMessageHistory('+1234567890', 20)
      ).rejects.toThrow('WhatsApp not connected');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', async () => {
      const whaple = new Whaple({
        useDirectWhatsApp: true,
        firebaseConfig: mockFirebaseConfig
      });

      expect(() => whaple.cleanup()).not.toThrow();
    });
  });
});