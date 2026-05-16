/**
 * Test utilities and helpers for server testing
 */

const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');

/**
 * Creates a test Express app with mock dependencies
 */
function createTestApp(dependencies = {}) {
  const app = express();
  
  // Middleware
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  
  // Add mock dependencies to req object
  app.use((req, res, next) => {
    req.dependencies = dependencies;
    next();
  });
  
  // Initialize routes with dependencies
  const initializeRoutes = require('../routes');
  initializeRoutes(app, dependencies);
  
  return app;
}

/**
 * Creates mock Firestore database
 */
function mockFirestore() {
  const mockCollection = {
    doc: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(),
    update: jest.fn().mockResolvedValue(),
    delete: jest.fn().mockResolvedValue(),
    onCreate: jest.fn(),
    onUpdate: jest.fn(),
    onDelete: jest.fn()
  };

  return {
    collection: jest.fn().mockReturnValue(mockCollection),
    batch: jest.fn().mockReturnValue({
      set: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      commit: jest.fn().mockResolvedValue()
    }),
    runTransaction: jest.fn()
  };
}

/**
 * Creates mock Firebase Auth
 */
function mockAuth() {
  return {
    verifyIdToken: jest.fn(),
    getUser: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn()
  };
}

/**
 * Creates mock Storage
 */
function mockStorage() {
  const mockFile = {
    save: jest.fn().mockResolvedValue(),
    delete: jest.fn().mockResolvedValue(),
    exists: jest.fn().mockResolvedValue([true]),
    download: jest.fn().mockResolvedValue([Buffer.from('mock data')]),
    getSignedUrl: jest.fn().mockResolvedValue(['https://mock-signed-url.com']),
    getMetadata: jest.fn().mockResolvedValue([{ size: 1024 }])
  };

  const mockBucket = {
    file: jest.fn().mockReturnValue(mockFile),
    upload: jest.fn().mockResolvedValue([mockFile]),
    getFiles: jest.fn().mockResolvedValue([[]])
  };

  return {
    bucket: jest.fn().mockReturnValue(mockBucket)
  };
}

/**
 * Creates mock OpenAI client
 */
function mockOpenAI() {
  return {
    audio: {
      speech: {
        create: jest.fn().mockResolvedValue({
          arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(8))
        })
      },
      transcriptions: {
        create: jest.fn().mockResolvedValue({
          text: 'Mock transcription'
        })
      }
    },
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Mock AI response'
            }
          }]
        })
      }
    }
  };
}

/**
 * Creates mock Anthropic Claude client
 */
function mockClaude() {
  return {
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{
          type: 'text',
          text: 'Mock Claude response'
        }],
        usage: {
          input_tokens: 100,
          output_tokens: 50
        }
      })
    }
  };
}

/**
 * Creates mock Deepgram client
 */
function mockDeepgram() {
  const mockConnection = {
    on: jest.fn(),
    send: jest.fn(),
    finish: jest.fn()
  };

  return {
    transcription: {
      live: jest.fn().mockReturnValue(mockConnection)
    }
  };
}

/**
 * Creates mock SendGrid client
 */
function mockSendGrid() {
  return {
    send: jest.fn().mockResolvedValue({ statusCode: 202 }),
    setApiKey: jest.fn()
  };
}

/**
 * Creates mock Stripe client
 */
function mockStripe() {
  return {
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({
          id: 'cs_test_123',
          url: 'https://checkout.stripe.com/pay/cs_test_123'
        })
      }
    },
    webhooks: {
      constructEvent: jest.fn()
    },
    prices: {
      list: jest.fn().mockResolvedValue({
        data: [
          { id: 'price_123', unit_amount: 1000, currency: 'usd' }
        ]
      })
    }
  };
}

/**
 * Creates mock session data
 */
function createMockSessionData() {
  return {
    sessionId: 'test-session-123',
    userName: 'Test User',
    userEmail: 'test@example.com',
    interviewId: 'interview-123',
    responses: [],
    startTime: Date.now(),
    lastActive: Date.now()
  };
}

/**
 * Creates mock interview data
 */
function createMockInterview() {
  return {
    id: 'interview-123',
    title: 'Test Interview',
    initialPrompt: 'Tell me about yourself',
    createdAt: new Date().toISOString(),
    userId: 'user-123',
    isPublic: false,
    enableWebSearch: false
  };
}

/**
 * Creates mock report data
 */
function createMockReport() {
  return {
    id: 'report-123',
    interviewId: 'interview-123',
    sessionId: 'session-123',
    content: '# Test Report\n\nThis is a test report.',
    createdAt: new Date().toISOString(),
    responses: []
  };
}

/**
 * Wait for async operations to complete
 */
function waitFor(condition, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const checkCondition = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for condition'));
      } else {
        setTimeout(checkCondition, 50);
      }
    };
    
    checkCondition();
  });
}

/**
 * Mock file upload
 */
function createMockFile(filename = 'test.txt', content = 'test content', mimetype = 'text/plain') {
  return {
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype: mimetype,
    buffer: Buffer.from(content),
    size: content.length
  };
}

module.exports = {
  createTestApp,
  mockFirestore,
  mockAuth,
  mockStorage,
  mockOpenAI,
  mockClaude,
  mockDeepgram,
  mockSendGrid,
  mockStripe,
  createMockSessionData,
  createMockInterview,
  createMockReport,
  waitFor,
  createMockFile
};