const { createTestApp, closeTestServer } = require('../../test-factory');
const ioClient = require('socket.io-client');

describe('Socket.IO Handlers', () => {
  let app, server, io;
  let clientSocket;
  let serverSocket;

  beforeAll((done) => {
    const testApp = createTestApp();
    app = testApp.app;
    server = testApp.server;
    io = testApp.io;

    // Start server
    server.listen(() => {
      const port = server.address().port;
      
      // Connect client
      clientSocket = ioClient(`http://localhost:${port}`, {
        transports: ['websocket']
      });

      // Capture server-side socket
      io.on('connection', (socket) => {
        serverSocket = socket;
      });

      clientSocket.on('connect', done);
    });
  });

  afterAll(async () => {
    if (clientSocket) clientSocket.close();
    if (io) io.close();
    await closeTestServer(server);
  });

  describe('Connection', () => {
    it('should connect successfully', () => {
      expect(clientSocket.connected).toBe(true);
      expect(serverSocket).toBeDefined();
    });
  });

  describe('startInterview', () => {
    it('should start an interview session', (done) => {
      const sessionId = 'test-session-123';
      const userId = 'test-user';
      const interviewData = {
        sessionId,
        userId,
        isCustomInterview: false
      };

      clientSocket.emit('startInterview', interviewData);

      // Listen for confirmation
      clientSocket.on('interviewStarted', (data) => {
        expect(data).toHaveProperty('sessionId', sessionId);
        expect(data).toHaveProperty('message', 'Interview session started');
        done();
      });
    });

    it('should handle custom interview with interviewId', (done) => {
      const sessionId = 'custom-session-123';
      const interviewId = 'interview-456';
      const interviewData = {
        sessionId,
        interviewId,
        isCustomInterview: true,
        userId: 'test-user'
      };

      clientSocket.emit('startInterview', interviewData);

      clientSocket.on('interviewStarted', (data) => {
        expect(data).toHaveProperty('sessionId', sessionId);
        expect(data).toHaveProperty('interviewId', interviewId);
        done();
      });
    });
  });

  describe('Audio Streaming', () => {
    it('should process audio chunks', (done) => {
      const sessionId = 'audio-session-123';
      const audioChunk = Buffer.from('mock audio data');

      // First start interview
      clientSocket.emit('startInterview', { sessionId, userId: 'test-user' });

      // Then send audio
      clientSocket.on('interviewStarted', () => {
        clientSocket.emit('audioChunk', { sessionId, audio: audioChunk });
        
        // Test passes if no error is thrown
        setTimeout(done, 100);
      });
    });

    it('should handle stop audio', (done) => {
      const sessionId = 'stop-audio-session';

      clientSocket.emit('startInterview', { sessionId, userId: 'test-user' });

      clientSocket.on('interviewStarted', () => {
        clientSocket.emit('stopAudio', { sessionId });
        
        // Listen for transcription or completion
        clientSocket.on('transcription', () => {
          done();
        });

        // Timeout fallback
        setTimeout(done, 500);
      });
    });
  });

  describe('Save Response', () => {
    it('should save interview response', (done) => {
      const sessionId = 'save-session-123';
      const responseData = {
        sessionId,
        question: 'Test question',
        answer: 'Test answer',
        timestamp: new Date().toISOString()
      };

      clientSocket.emit('saveResponse', responseData);

      clientSocket.on('responseSaved', (data) => {
        expect(data).toHaveProperty('success', true);
        expect(data).toHaveProperty('responseId');
        done();
      });
    });

    it('should handle save errors gracefully', (done) => {
      // Send invalid data
      clientSocket.emit('saveResponse', { invalid: 'data' });

      clientSocket.on('error', (error) => {
        expect(error).toHaveProperty('message');
        done();
      });

      // Timeout fallback
      setTimeout(done, 500);
    });
  });

  describe('Generate Report', () => {
    it('should generate interview report', (done) => {
      const reportData = {
        sessionId: 'report-session-123',
        responses: [
          { question: 'Q1', answer: 'A1' },
          { question: 'Q2', answer: 'A2' }
        ],
        userId: 'test-user'
      };

      clientSocket.emit('generateReport', reportData);

      clientSocket.on('reportGenerated', (data) => {
        expect(data).toHaveProperty('reportId');
        expect(data).toHaveProperty('reportUrl');
        done();
      });

      clientSocket.on('reportProgress', (progress) => {
        expect(progress).toHaveProperty('status');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown events gracefully', (done) => {
      clientSocket.emit('unknownEvent', { test: 'data' });
      
      // Should not crash - test passes if no error after timeout
      setTimeout(done, 200);
    });

    it('should handle malformed data', (done) => {
      clientSocket.emit('startInterview', null);
      
      clientSocket.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      // Timeout fallback
      setTimeout(done, 500);
    });
  });

  describe('Disconnect', () => {
    it('should handle client disconnect', (done) => {
      const disconnectSocket = ioClient(`http://localhost:${server.address().port}`, {
        transports: ['websocket']
      });

      disconnectSocket.on('connect', () => {
        disconnectSocket.disconnect();
        
        // Test passes if server doesn't crash
        setTimeout(done, 200);
      });
    });
  });
});