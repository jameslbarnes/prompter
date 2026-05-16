// Test setup file
require('dotenv').config();

// Mock external services
jest.mock('firebase-admin', () => {
  const mockFirestore = {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ exists: false, data: () => ({}) })),
        set: jest.fn(() => Promise.resolve()),
        update: jest.fn(() => Promise.resolve()),
        delete: jest.fn(() => Promise.resolve()),
      })),
      add: jest.fn(() => Promise.resolve({ id: 'mock-id' })),
      where: jest.fn(() => ({
        get: jest.fn(() => Promise.resolve({ docs: [] })),
        orderBy: jest.fn(() => ({
          limit: jest.fn(() => ({
            get: jest.fn(() => Promise.resolve({ docs: [] }))
          }))
        }))
      })),
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({ docs: [] }))
        }))
      }))
    }))
  };

  return {
    initializeApp: jest.fn(),
    credential: {
      cert: jest.fn()
    },
    firestore: jest.fn(() => mockFirestore)
  };
});

jest.mock('@google-cloud/storage', () => ({
  Storage: jest.fn(() => ({
    bucket: jest.fn(() => ({
      file: jest.fn(() => ({
        save: jest.fn(() => Promise.resolve()),
        createReadStream: jest.fn(() => {
          const { Readable } = require('stream');
          const stream = new Readable();
          stream.push('mock file content');
          stream.push(null);
          return stream;
        }),
        exists: jest.fn(() => Promise.resolve([true])),
        delete: jest.fn(() => Promise.resolve())
      }))
    }))
  }))
}));

jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(() => Promise.resolve())
}));

jest.mock('stripe', () => {
  return jest.fn(() => ({
    customers: {
      create: jest.fn(() => Promise.resolve({ id: 'cus_mock' })),
      retrieve: jest.fn(() => Promise.resolve({ id: 'cus_mock' }))
    },
    subscriptions: {
      create: jest.fn(() => Promise.resolve({ id: 'sub_mock' })),
      retrieve: jest.fn(() => Promise.resolve({ id: 'sub_mock' }))
    },
    checkout: {
      sessions: {
        create: jest.fn(() => Promise.resolve({ url: 'https://checkout.stripe.com/mock' }))
      }
    },
    webhookEndpoints: {
      create: jest.fn(() => Promise.resolve({ secret: 'whsec_mock' }))
    }
  }));
});

jest.mock('@deepgram/sdk', () => ({
  Deepgram: jest.fn(() => ({
    transcription: {
      live: jest.fn(() => ({
        on: jest.fn(),
        send: jest.fn(),
        finish: jest.fn()
      }))
    }
  })),
  createClient: jest.fn(() => ({
    listen: {
      live: jest.fn(() => ({
        on: jest.fn(),
        send: jest.fn(),
        finish: jest.fn()
      }))
    }
  })),
  LiveTranscriptionEvents: {
    Transcript: 'transcript',
    Error: 'error',
    Close: 'close'
  }
}));

jest.mock('openai', () => {
  return jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn(() => Promise.resolve({
          choices: [{
            message: {
              content: 'Mock AI response'
            }
          }]
        }))
      }
    }
  }));
});

// Mock memory service
jest.mock('../memoryService', () => ({
  initialize: jest.fn(() => Promise.resolve()),
  add: jest.fn(() => Promise.resolve()),
  search: jest.fn(() => Promise.resolve([])),
  deleteAll: jest.fn(() => Promise.resolve()),
  isInitialized: jest.fn(() => true)
}));

// Mock pricing service
jest.mock('../pricingService', () => ({
  PricingService: jest.fn(() => ({
    checkUsageLimit: jest.fn(() => Promise.resolve({ allowed: true })),
    incrementUsage: jest.fn(() => Promise.resolve()),
    getUsageStats: jest.fn(() => Promise.resolve({ count: 0, limit: 100 }))
  }))
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.DEEPGRAM_API_KEY = 'test-key';
process.env.SENDGRID_API_KEY = 'test-key';
process.env.STRIPE_SECRET_KEY = 'test-key';
process.env.BASE_URL = 'http://localhost:3001';

// Increase test timeout for async operations
jest.setTimeout(30000);

// Suppress console logs during tests unless explicitly needed
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};