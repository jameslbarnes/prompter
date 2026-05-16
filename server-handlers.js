// Socket.IO handlers extracted from server.js
// This module contains all WebSocket event handlers

const { v4: uuidv4 } = require('uuid');

module.exports = function initializeHandlers(io, dependencies) {
    const {
        db,
        storage,
        openai,
        deepgram,
        deepgramClient,
        sessionData,
        deepgramClients,
        memoryService,
        GCS_BUCKET_NAME,
        config,
        // Import functions from other modules
        generateSpeechFromText,
        logResponseToFirebase,
        generateAndStoreReportAudio,
        getResponsesWithSignedUrls,
        sendReportEmail,
        countWords,
        formatTimeForLog,
        escapeXml,
        updateTemplateCompletionStats,
        // Example data
        EXAMPLE_RESUME,
        EXAMPLE_QA,
        EXAMPLE_FIRST_NAME
    } = dependencies;

    io.on('connection', (socket) => {
        console.log(`Client connected: ${socket.id}`);
        const sessionId = socket.id;

        // Socket disconnect handler
        socket.on('disconnect', (reason) => {
            console.log(`Client ${socket.id} disconnected: ${reason}`);
            
            // Clean up Deepgram client if exists
            if (deepgramClients && deepgramClients.has(socket.id)) {
                const dgClient = deepgramClients.get(socket.id);
                if (dgClient.connection) {
                    try {
                        dgClient.connection.finish();
                    } catch (error) {
                        console.error(`Error finishing Deepgram connection for ${socket.id}:`, error);
                    }
                }
                deepgramClients.delete(socket.id);
            }
            
            // Clean up session data after a delay
            setTimeout(() => {
                if (sessionData.has(sessionId)) {
                    console.log(`Cleaning up session data for ${sessionId}`);
                    sessionData.delete(sessionId);
                }
            }, 300000); // 5 minutes
        });

        // Socket error handler
        socket.on('error', (error) => {
            console.error(`Socket error for ${socket.id}:`, error);
        });

        // Interview handlers
        socket.on('startInterview', async (data) => {
            console.log(`[${sessionId}] Starting interview with data:`, data);
            // Placeholder for startInterview implementation
            socket.emit('error', { message: 'startInterview handler not yet implemented' });
        });

        socket.on('stopInterview', async () => {
            console.log(`[${sessionId}] Stopping interview`);
            // Placeholder for stopInterview implementation
            socket.emit('error', { message: 'stopInterview handler not yet implemented' });
        });

        // Report handlers
        socket.on('requestReport', async (previousSessionId) => {
            console.log(`[${sessionId}] Requesting report for session: ${previousSessionId}`);
            // Placeholder for requestReport implementation
            socket.emit('error', { message: 'requestReport handler not yet implemented' });
        });

        socket.on('regenerateReportWithStreaming', async (data) => {
            console.log(`[${sessionId}] Regenerating report with streaming`);
            // Placeholder for regenerateReportWithStreaming implementation
            socket.emit('error', { message: 'regenerateReportWithStreaming handler not yet implemented' });
        });

        // Deepgram streaming handlers
        socket.on('startDeepgramStream', async () => {
            console.log(`[${sessionId}] Starting Deepgram stream`);
            // Placeholder for startDeepgramStream implementation
            socket.emit('error', { message: 'startDeepgramStream handler not yet implemented' });
        });

        socket.on('audioChunkToServer', (chunk) => {
            // This handler processes audio chunks - no console log to avoid spam
            // Placeholder for audioChunkToServer implementation
        });

        socket.on('stopDeepgramStream', async () => {
            console.log(`[${sessionId}] Stopping Deepgram stream`);
            // Placeholder for stopDeepgramStream implementation
            socket.emit('error', { message: 'stopDeepgramStream handler not yet implemented' });
        });

        // Other handlers
        socket.on('requestExampleReportGeneration', () => {
            console.log(`[${sessionId}] Requesting example report generation`);
            // Placeholder for requestExampleReportGeneration implementation
            socket.emit('error', { message: 'requestExampleReportGeneration handler not yet implemented' });
        });

        socket.on('textResponse', async (textData) => {
            console.log(`[${sessionId}] Received text response`);
            // Placeholder for textResponse implementation
            socket.emit('error', { message: 'textResponse handler not yet implemented' });
        });

        socket.on('requestCurrentState', () => {
            console.log(`[${sessionId}] Requesting current state`);
            
            const sessionInfo = sessionData.get(sessionId);
            if (sessionInfo) {
                socket.emit('currentState', {
                    sessionId: sessionId,
                    interviewStarted: sessionInfo.interviewStarted || false,
                    questionIndex: sessionInfo.questionIndex || 0,
                    responses: sessionInfo.responses || [],
                    reportGenerated: sessionInfo.reportGenerated || false
                });
            } else {
                socket.emit('currentState', {
                    sessionId: sessionId,
                    interviewStarted: false,
                    questionIndex: 0,
                    responses: [],
                    reportGenerated: false
                });
            }
        });

        socket.on('restoreSessionRequest', (oldSessionId) => {
            console.log(`[${sessionId}] Restoring session from: ${oldSessionId}`);
            
            const oldSessionData = sessionData.get(oldSessionId);
            if (oldSessionData) {
                // Copy old session data to new session
                sessionData.set(sessionId, { ...oldSessionData });
                socket.emit('sessionRestored', {
                    success: true,
                    state: oldSessionData
                });
            } else {
                socket.emit('sessionRestored', {
                    success: false,
                    message: 'Session not found'
                });
            }
        });

        socket.on('updateTotalRecordingTime', (data) => {
            const sessionInfo = sessionData.get(sessionId);
            if (sessionInfo && data.totalSeconds) {
                sessionInfo.totalRecordingTime = data.totalSeconds;
                console.log(`[${sessionId}] Updated total recording time: ${formatTimeForLog(data.totalSeconds)}`);
            }
        });

        socket.on('finalAudioBlobForStorage', async ({ audioData, responseDocId, persistentSessionId, mimeType }) => {
            console.log(`[${sessionId}] Received final audio blob for storage`);
            // Placeholder for finalAudioBlobForStorage implementation
            socket.emit('error', { message: 'finalAudioBlobForStorage handler not yet implemented' });
        });

        // Note: The actual generateReport and generateAdminReport functions would need to be
        // defined here or imported, as they were originally defined within the socket handler scope
    });
};