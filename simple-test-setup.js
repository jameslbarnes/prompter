// Simple test setup - just enough to verify things work
require('dotenv').config();

// Mock only what breaks without it
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn()
  },
  firestore: jest.fn(() => ({
    collection: jest.fn(() => ({
      get: jest.fn(() => Promise.resolve({ 
        forEach: jest.fn() 
      })),
      doc: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ 
          exists: false 
        })),
        set: jest.fn(() => Promise.resolve()),
        update: jest.fn(() => Promise.resolve())
      }))
    }))
  }))
}));

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn(() => ({
    bucket: jest.fn()
  }))
}));

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(() => Promise.resolve())
}));

// Set test env vars
process.env.NODE_ENV = 'test';
process.env.PORT = '3099'; // Different port for tests