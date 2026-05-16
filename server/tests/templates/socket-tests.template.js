/**
 * Test template for Socket.IO handlers
 * Copy this template when creating tests for socket modules
 */

const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const initializeHandlers = require('../../sockets/handlers');

describe('Socket Handler Tests', () => {
  let io, serverSocket, clientSocket;
  let httpServer;
  let mockDependencies;

  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer);
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = new Client(`http://localhost:${port}`);
      
      mockDependencies = {
        db: {
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({
              set: jest.fn().mockResolvedValue(),
              get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }),
              update: jest.fn().mockResolvedValue()
            })
          })
        },
        sessionData: new Map(),
        deepgramClients: new Map(),
        memoryService: {
          getMemoriesForInterview: jest.fn().mockResolvedValue([])
        }
      };

      io.on('connection', (socket) => {
        serverSocket = socket;
        initializeHandlers(socket, io, mockDependencies);
      });

      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
    httpServer.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockDependencies.sessionData.clear();
    mockDependencies.deepgramClients.clear();
  });

  describe('Connection handling', () => {
    test('should handle client connection', (done) => {
      expect(serverSocket).toBeDefined();
      expect(serverSocket.id).toBeDefined();
      done();
    });

    test('should handle client disconnection', (done) => {
      // Add some data to be cleaned up
      mockDependencies.sessionData.set(clientSocket.id, { test: 'data' });
      mockDependencies.deepgramClients.set(clientSocket.id, { connection: null });

      clientSocket.disconnect();

      setTimeout(() => {
        expect(mockDependencies.sessionData.has(clientSocket.id)).toBe(false);
        expect(mockDependencies.deepgramClients.has(clientSocket.id)).toBe(false);
        done();
      }, 100);
    });
  });

  describe('Event handlers', () => {
    test('should handle startInterview event', (done) => {
      const interviewData = {
        interviewId: 'test-interview-123',
        userName: 'Test User',
        userEmail: 'test@example.com'
      };

      clientSocket.emit('startInterview', interviewData);

      clientSocket.on('interviewStarted', (response) => {
        expect(response).toMatchObject({
          sessionId: expect.any(String),
          status: 'ready',
          interviewId: interviewData.interviewId
        });
        
        expect(mockDependencies.sessionData.has(response.sessionId)).toBe(true);
        const sessionData = mockDependencies.sessionData.get(response.sessionId);
        expect(sessionData.userName).toBe(interviewData.userName);
        
        done();
      });
    });

    test('should handle error in event handler', (done) => {
      // Force an error
      mockDependencies.db.collection.mockImplementation(() => {
        throw new Error('Database error');
      });

      clientSocket.emit('startInterview', { interviewId: 'test' });

      clientSocket.on('error', (error) => {
        expect(error.message).toContain('Database error');
        done();
      });
    });

    test('should handle concurrent events', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(
          new Promise((resolve) => {
            clientSocket.emit('testEvent', { id: i });
            clientSocket.once(`testResponse-${i}`, resolve);
          })
        );
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
    });
  });

  describe('Audio streaming', () => {
    test('should handle audio chunk streaming', (done) => {
      const audioChunk = Buffer.from('mock audio data');
      
      clientSocket.emit('startDeepgramStream');
      
      clientSocket.on('deepgramReady', () => {
        clientSocket.emit('audioChunkToServer', audioChunk);
        
        // Verify chunk was processed
        setTimeout(() => {
          const dgClient = mockDependencies.deepgramClients.get(clientSocket.id);
          expect(dgClient).toBeDefined();
          done();
        }, 100);
      });
    });

    test('should handle stream interruption', (done) => {
      clientSocket.emit('startDeepgramStream');
      
      clientSocket.on('deepgramReady', () => {
        // Simulate network interruption
        clientSocket.disconnect();
        
        setTimeout(() => {
          expect(mockDependencies.deepgramClients.has(clientSocket.id)).toBe(false);
          done();
        }, 100);
      });
    });
  });

  describe('State management', () => {
    test('should maintain session state', (done) => {
      const sessionId = 'test-session-123';
      const initialState = {
        responses: [],
        currentQuestionIndex: 0,
        startTime: Date.now()
      };

      mockDependencies.sessionData.set(sessionId, initialState);

      clientSocket.emit('requestCurrentState', { sessionId });

      clientSocket.on('currentState', (state) => {
        expect(state).toMatchObject(initialState);
        done();
      });
    });

    test('should restore session after disconnect', (done) => {
      const oldSessionId = 'old-session-123';
      const sessionState = {
        responses: ['response1', 'response2'],
        currentQuestionIndex: 2
      };

      mockDependencies.sessionData.set(oldSessionId, sessionState);

      clientSocket.emit('restoreSessionRequest', oldSessionId);

      clientSocket.on('sessionRestored', (response) => {
        expect(response.success).toBe(true);
        expect(response.state).toMatchObject(sessionState);
        done();
      });
    });
  });

  describe('Report generation', () => {
    test('should handle report request', (done) => {
      const sessionId = 'test-session-123';
      mockDependencies.sessionData.set(sessionId, {
        responses: [
          { question: 'Q1', answer: 'A1' },
          { question: 'Q2', answer: 'A2' }
        ]
      });

      clientSocket.emit('requestReport', sessionId);

      clientSocket.on('reportGenerationStarted', () => {
        clientSocket.on('reportComplete', (report) => {
          expect(report).toMatchObject({
            reportId: expect.any(String),
            content: expect.any(String),
            sessionId
          });
          done();
        });
      });
    });
  });
});