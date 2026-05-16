/**
 * Jest setup file - runs before all tests
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Mock environment variables
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.DEEPGRAM_API_KEY = 'test-deepgram-key';
process.env.STRIPE_SECRET_KEY = 'test-stripe-key';
process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
  project_id: 'test-project',
  private_key: 'test-key',
  client_email: 'test@test.com'
});

// Global test utilities
global.testUtils = require('./test-utils');

// Increase timeout for async operations
jest.setTimeout(30000);

// Mock console methods to reduce noise in tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Mock timers for tests that need them
global.mockTimers = () => {
  jest.useFakeTimers();
  return {
    restore: () => jest.useRealTimers(),
    runAllTimers: () => jest.runAllTimers(),
    advanceTimersByTime: (ms) => jest.advanceTimersByTime(ms)
  };
};

// Mock file system for tests
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn()
  },
  readFileSync: jest.fn().mockReturnValue('{}'),
  writeFileSync: jest.fn()
}));

// Mock child_process for FFmpeg tests
jest.mock('child_process', () => ({
  spawn: jest.fn().mockReturnValue({
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((event, callback) => {
      if (event === 'close') {
        callback(0);
      }
    })
  })
}));

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});