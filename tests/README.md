# Server Test Suite

This test suite helps verify that the refactored `server_staging.js` maintains compatibility with the original `server.js`.

## Installation

First, install the test dependencies:

```bash
npm install --save-dev jest supertest @types/jest socket.io-client
```

## Running Tests

### Basic Usage

Run all tests against the original server:
```bash
npm test
```

### Test Specific Server

Test the original server:
```bash
node tests/run-tests.js
```

Test the staging/refactored server:
```bash
node tests/run-tests.js staging
```

### Run Specific Test Suites

```bash
# Run only basic endpoint tests
node tests/run-tests.js basic

# Run only interview tests against staging
node tests/run-tests.js staging interview
```

### Compare Both Servers

Run the comparison script to see which tests pass/fail in each version:
```bash
node tests/test-comparison.js
```

## Test Structure

```
tests/
├── setup.js                    # Jest setup and mocks
├── test-factory.js            # Helper to create test app instances
├── run-tests.js              # Simple test runner
├── test-comparison.js        # Compare results between servers
└── __tests__/
    ├── unit/
    │   ├── basic-endpoints.test.js    # Basic API endpoints
    │   └── utility-functions.test.js  # Utility function tests
    ├── integration/
    │   ├── admin.test.js             # Admin endpoints
    │   ├── claude-api.test.js        # Claude API endpoint
    │   ├── files.test.js             # File upload/management
    │   ├── interviews.test.js        # Interview endpoints
    │   ├── memories.test.js          # Memory management
    │   ├── pricing.test.js           # Pricing/subscription
    │   ├── reports.test.js           # Report generation
    │   └── responses.test.js         # Response management
    └── sockets/
        └── socket-handlers.test.js    # Socket.IO handlers
```

## Test Categories

### Unit Tests
- Basic endpoint functionality
- Utility function behavior (tested indirectly)

### Integration Tests
- **Admin**: Session management, report regeneration
- **Claude API**: AI completions, streaming, usage limits
- **Files**: Resume upload, file deletion, audio streaming
- **Interviews**: Creating, sharing, uploading context files
- **Memories**: User memory storage and retrieval
- **Pricing**: Subscription management, usage tracking
- **Reports**: Report generation, listing, audio artifacts
- **Responses**: Interview response storage and retrieval

### Socket Tests
- WebSocket connection handling
- Audio streaming
- Real-time transcription
- Report generation via sockets

## Key Features Tested

1. **API Endpoints**: All REST endpoints are tested for success and error cases
2. **Authentication**: Usage limits and user identification
3. **File Handling**: Upload, storage, and retrieval
4. **Real-time Features**: Socket.IO events and streaming
5. **External Services**: Mocked (Firebase, Google Cloud Storage, Stripe, SendGrid, OpenAI, Deepgram)

## Troubleshooting

### Common Issues

1. **Port conflicts**: Kill any running servers before testing
2. **Missing env vars**: Tests set their own env vars, but check `.env` exists
3. **Module not found**: Clear require cache or restart test runner

### Debugging Failed Tests

1. Run a specific test file:
   ```bash
   npm test -- __tests__/integration/interviews.test.js
   ```

2. Run with verbose output:
   ```bash
   npm test -- --verbose
   ```

3. Run in watch mode:
   ```bash
   npm run test:watch
   ```

## Next Steps for Refactoring

When tests fail on `server_staging.js`, check:

1. **Route Registration**: Ensure all routes are properly imported and registered
2. **Middleware Order**: Verify middleware is applied in correct order
3. **Service Initialization**: Check that all services (memory, pricing) are initialized
4. **Error Handling**: Ensure error middleware is properly configured
5. **Socket Handlers**: Verify socket.io handlers are registered correctly

## Adding New Tests

1. Create test file in appropriate directory
2. Import test factory helpers
3. Use consistent patterns from existing tests
4. Mock external dependencies in `setup.js`
5. Run comparison script to ensure compatibility