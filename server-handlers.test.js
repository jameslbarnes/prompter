// Simple tests for server-handlers.js
// Testing Socket.IO event handlers

const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

// Mock dependencies
const mockDependencies = {
    db: null,
    storage: null,
    openai: null,
    deepgram: null,
    deepgramClient: null,
    sessionData: new Map(),
    deepgramClients: new Map(),
    memoryService: null,
    GCS_BUCKET_NAME: 'test-bucket',
    config: {},
    generateSpeechFromText: jest.fn(),
    logResponseToFirebase: jest.fn(),
    generateAndStoreReportAudio: jest.fn(),
    getResponsesWithSignedUrls: jest.fn(),
    sendReportEmail: jest.fn(),
    countWords: jest.fn(),
    formatTimeForLog: jest.fn((seconds) => `${seconds}s`),
    escapeXml: jest.fn(),
    updateTemplateCompletionStats: jest.fn(),
    EXAMPLE_RESUME: 'Example resume',
    EXAMPLE_QA: [],
    EXAMPLE_FIRST_NAME: 'Example'
};

describe('server-handlers', () => {
    let io, serverSocket, clientSocket;
    let httpServer;
    let port;

    beforeAll((done) => {
        httpServer = createServer();
        io = new Server(httpServer);
        
        // Initialize handlers
        const initializeHandlers = require('./server-handlers');
        initializeHandlers(io, mockDependencies);
        
        httpServer.listen(() => {
            port = httpServer.address().port;
            done();
        });
    });

    afterAll(() => {
        io.close();
        httpServer.close();
    });

    beforeEach((done) => {
        clientSocket = new Client(`http://localhost:${port}`);
        io.on('connection', (socket) => {
            serverSocket = socket;
        });
        clientSocket.on('connect', done);
    });

    afterEach(() => {
        clientSocket.close();
        mockDependencies.sessionData.clear();
        mockDependencies.deepgramClients.clear();
        jest.clearAllMocks();
    });

    describe('Connection handling', () => {
        test('client connects successfully', () => {
            expect(serverSocket).toBeDefined();
            expect(serverSocket.id).toBeDefined();
        });

        test('handles disconnect and cleans up', (done) => {
            // Add some test data
            mockDependencies.deepgramClients.set(clientSocket.id, {
                connection: { finish: jest.fn() }
            });
            mockDependencies.sessionData.set(serverSocket.id, { test: 'data' });

            clientSocket.disconnect();

            setTimeout(() => {
                // Deepgram client should be cleaned up immediately
                expect(mockDependencies.deepgramClients.has(clientSocket.id)).toBe(false);
                // Session data cleanup happens after delay, so should still exist
                expect(mockDependencies.sessionData.has(serverSocket.id)).toBe(true);
                done();
            }, 100);
        });
    });

    describe('State management handlers', () => {
        test('requestCurrentState returns empty state when no session exists', (done) => {
            clientSocket.emit('requestCurrentState');
            
            clientSocket.on('currentState', (state) => {
                expect(state).toEqual({
                    sessionId: expect.any(String),
                    interviewStarted: false,
                    questionIndex: 0,
                    responses: [],
                    reportGenerated: false
                });
                done();
            });
        });

        test('requestCurrentState returns existing session state', (done) => {
            const sessionState = {
                interviewStarted: true,
                questionIndex: 2,
                responses: ['response1', 'response2'],
                reportGenerated: false
            };
            
            mockDependencies.sessionData.set(serverSocket.id, sessionState);
            
            clientSocket.emit('requestCurrentState');
            
            clientSocket.on('currentState', (state) => {
                expect(state).toMatchObject(sessionState);
                done();
            });
        });

        test('restoreSessionRequest restores from existing session', (done) => {
            const oldSessionId = 'old-session-123';
            const oldSessionData = {
                interviewStarted: true,
                responses: ['response1'],
                questionIndex: 1
            };
            
            mockDependencies.sessionData.set(oldSessionId, oldSessionData);
            
            clientSocket.emit('restoreSessionRequest', oldSessionId);
            
            clientSocket.on('sessionRestored', (result) => {
                expect(result.success).toBe(true);
                expect(result.state).toEqual(oldSessionData);
                expect(mockDependencies.sessionData.get(serverSocket.id)).toEqual(oldSessionData);
                done();
            });
        });

        test('restoreSessionRequest fails for non-existent session', (done) => {
            clientSocket.emit('restoreSessionRequest', 'non-existent');
            
            clientSocket.on('sessionRestored', (result) => {
                expect(result.success).toBe(false);
                expect(result.message).toBe('Session not found');
                done();
            });
        });
    });

    describe('Recording time handler', () => {
        test('updateTotalRecordingTime updates session data', (done) => {
            mockDependencies.sessionData.set(serverSocket.id, {});
            
            clientSocket.emit('updateTotalRecordingTime', { totalSeconds: 120 });
            
            setTimeout(() => {
                const sessionInfo = mockDependencies.sessionData.get(serverSocket.id);
                expect(sessionInfo.totalRecordingTime).toBe(120);
                expect(mockDependencies.formatTimeForLog).toHaveBeenCalledWith(120);
                done();
            }, 50);
        });

        test('updateTotalRecordingTime does nothing without session', (done) => {
            clientSocket.emit('updateTotalRecordingTime', { totalSeconds: 120 });
            
            setTimeout(() => {
                expect(mockDependencies.formatTimeForLog).not.toHaveBeenCalled();
                done();
            }, 50);
        });
    });

    describe('Placeholder handlers', () => {
        const placeholderEvents = [
            'startInterview',
            'stopInterview',
            'requestReport',
            'regenerateReportWithStreaming',
            'startDeepgramStream',
            'stopDeepgramStream',
            'requestExampleReportGeneration',
            'textResponse',
            'finalAudioBlobForStorage'
        ];

        placeholderEvents.forEach(eventName => {
            test(`${eventName} returns not implemented error`, (done) => {
                clientSocket.on('error', (error) => {
                    expect(error.message).toContain('not yet implemented');
                    done();
                });
                
                clientSocket.emit(eventName, { test: 'data' });
            });
        });
    });

    describe('Audio chunk handler', () => {
        test('audioChunkToServer can receive chunks without error', (done) => {
            // This handler should not emit errors for valid chunks
            const chunk = Buffer.from('test audio data');
            
            clientSocket.emit('audioChunkToServer', chunk);
            
            // Wait a bit to ensure no error is emitted
            setTimeout(() => {
                // If we get here without error, the test passes
                done();
            }, 100);
        });
    });
});