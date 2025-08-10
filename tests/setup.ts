// Jest setup file for Whaple tests

// Suppress console.log during tests
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock environment variables
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(10000);