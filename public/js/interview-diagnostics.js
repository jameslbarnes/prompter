// Interview Diagnostics Tool
// This module provides real-time diagnostics for interview reliability issues

export class InterviewDiagnostics {
    constructor() {
        this.events = [];
        this.metrics = {
            socketReconnects: 0,
            deepgramFailures: 0,
            transcriptionTimeouts: 0,
            progressJumps: 0,
            thinkingStateStuck: 0,
            audioChunksSent: 0,
            audioChunksDropped: 0
        };
        this.lastProgressTime = 0;
        this.isMonitoring = false;
        this.diagnosticPanel = null;
    }

    start() {
        if (this.isMonitoring) return;
        this.isMonitoring = true;
        
        console.log('[Diagnostics] Starting interview diagnostics...');
        this.createDiagnosticPanel();
        this.attachEventListeners();
        this.startMetricsCollection();
    }

    stop() {
        this.isMonitoring = false;
        if (this.diagnosticPanel) {
            this.diagnosticPanel.remove();
        }
        console.log('[Diagnostics] Stopped interview diagnostics');
    }

    createDiagnosticPanel() {
        // Create floating diagnostic panel
        const panel = document.createElement('div');
        panel.id = 'diagnostic-panel';
        panel.innerHTML = `
            <style>
                #diagnostic-panel {
                    position: fixed;
                    bottom: 20px;
                    left: 20px;
                    background: rgba(0, 0, 0, 0.9);
                    color: #fff;
                    padding: 15px;
                    border-radius: 8px;
                    font-family: monospace;
                    font-size: 12px;
                    z-index: 10000;
                    max-width: 400px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                }
                #diagnostic-panel h4 {
                    margin: 0 0 10px 0;
                    color: #4CAF50;
                }
                .diagnostic-metric {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                }
                .diagnostic-value {
                    color: #FFC107;
                    font-weight: bold;
                }
                .diagnostic-warning {
                    color: #FF5722;
                    margin-top: 10px;
                    padding: 5px;
                    background: rgba(255, 87, 34, 0.2);
                    border-radius: 4px;
                }
                .diagnostic-log {
                    max-height: 150px;
                    overflow-y: auto;
                    margin-top: 10px;
                    padding: 5px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 4px;
                }
                .log-entry {
                    margin: 2px 0;
                    font-size: 11px;
                }
                .log-error { color: #FF5722; }
                .log-warning { color: #FFC107; }
                .log-info { color: #03A9F4; }
                .close-diagnostics {
                    position: absolute;
                    top: 5px;
                    right: 10px;
                    cursor: pointer;
                    color: #999;
                }
                .close-diagnostics:hover {
                    color: #fff;
                }
            </style>
            <span class="close-diagnostics" onclick="window.interviewDiagnostics?.stop()">×</span>
            <h4>Interview Diagnostics</h4>
            <div id="diagnostic-metrics">
                <div class="diagnostic-metric">
                    <span>Socket Status:</span>
                    <span class="diagnostic-value" id="diag-socket">Unknown</span>
                </div>
                <div class="diagnostic-metric">
                    <span>Deepgram Stream:</span>
                    <span class="diagnostic-value" id="diag-deepgram">Inactive</span>
                </div>
                <div class="diagnostic-metric">
                    <span>Recording State:</span>
                    <span class="diagnostic-value" id="diag-recording">Not Recording</span>
                </div>
                <div class="diagnostic-metric">
                    <span>Audio Chunks:</span>
                    <span class="diagnostic-value" id="diag-chunks">0 sent / 0 dropped</span>
                </div>
                <div class="diagnostic-metric">
                    <span>Progress Time:</span>
                    <span class="diagnostic-value" id="diag-progress">0:00</span>
                </div>
                <div class="diagnostic-metric">
                    <span>Reconnects:</span>
                    <span class="diagnostic-value" id="diag-reconnects">0</span>
                </div>
            </div>
            <div id="diagnostic-warnings"></div>
            <div class="diagnostic-log" id="diagnostic-log"></div>
        `;
        
        document.body.appendChild(panel);
        this.diagnosticPanel = panel;
    }

    attachEventListeners() {
        // Import state and socket from global scope
        const { state } = window;
        if (!state || !state.socket || !state.socket.instance) {
            this.log('No socket instance found', 'error');
            return;
        }

        const socket = state.socket.instance;

        // Monitor socket events
        const originalOn = socket.on.bind(socket);
        socket.on = (event, handler) => {
            const wrappedHandler = (...args) => {
                this.recordEvent(event, args);
                return handler(...args);
            };
            return originalOn(event, wrappedHandler);
        };

        // Monitor specific events
        socket.on('connect', () => {
            this.log('Socket connected', 'info');
            this.updateMetric('diag-socket', 'Connected');
        });

        socket.on('disconnect', (reason) => {
            this.log(`Socket disconnected: ${reason}`, 'error');
            this.updateMetric('diag-socket', 'Disconnected');
            this.metrics.socketReconnects++;
            this.updateMetric('diag-reconnects', this.metrics.socketReconnects);
        });

        socket.on('deepgramStreamOpened', () => {
            this.log('Deepgram stream opened', 'info');
            this.updateMetric('diag-deepgram', 'Active');
        });

        socket.on('deepgramStreamClosed', () => {
            this.log('Deepgram stream closed', 'warning');
            this.updateMetric('diag-deepgram', 'Inactive');
        });

        socket.on('deepgramError', (error) => {
            this.log(`Deepgram error: ${error.message}`, 'error');
            this.metrics.deepgramFailures++;
            this.addWarning('Deepgram transcription errors detected');
        });

        // Monitor audio chunks
        const originalEmit = socket.emit.bind(socket);
        socket.emit = (event, ...args) => {
            if (event === 'audioChunkToServer') {
                if (state.deepgram.streamActive) {
                    this.metrics.audioChunksSent++;
                } else {
                    this.metrics.audioChunksDropped++;
                    this.log('Audio chunk dropped - stream not active', 'warning');
                }
                this.updateChunksDisplay();
            }
            
            if (event === 'startDeepgramStream') {
                this.log('Requesting Deepgram stream start', 'info');
                
                // Set timeout to check if stream opened
                setTimeout(() => {
                    if (!state.deepgram.streamActive) {
                        this.log('Deepgram stream failed to open after 3s', 'error');
                        this.addWarning('Deepgram stream initialization timeout');
                    }
                }, 3000);
            }
            
            return originalEmit(event, ...args);
        };
    }

    startMetricsCollection() {
        const { state } = window;
        
        // Monitor state changes
        setInterval(() => {
            if (!state) return;

            // Update recording state
            if (state.recording?.isRecording) {
                this.updateMetric('diag-recording', state.recording.isPaused ? 'Paused' : 'Recording');
            } else {
                this.updateMetric('diag-recording', state.ui?.thinking ? 'Thinking' : 'Not Recording');
            }

            // Monitor progress time
            if (state.recording) {
                const currentTime = state.recording.accumulatedTime + 
                    (state.recording.isRecording ? state.recording.duration : 0);
                
                // Check for time jumps
                if (this.lastProgressTime > 0) {
                    const timeDiff = currentTime - this.lastProgressTime;
                    if (timeDiff > 10) { // More than 10 second jump
                        this.log(`Progress time jumped by ${timeDiff}s`, 'error');
                        this.metrics.progressJumps++;
                        this.addWarning(`Time jump detected: +${timeDiff}s`);
                    }
                }
                
                this.lastProgressTime = currentTime;
                this.updateMetric('diag-progress', this.formatTime(currentTime));
            }

            // Check for stuck thinking state
            if (state.ui?.thinking) {
                if (!this.thinkingStartTime) {
                    this.thinkingStartTime = Date.now();
                } else {
                    const thinkingDuration = (Date.now() - this.thinkingStartTime) / 1000;
                    if (thinkingDuration > 30) {
                        if (!this.warnedAboutThinking) {
                            this.log(`Thinking state stuck for ${Math.round(thinkingDuration)}s`, 'error');
                            this.metrics.thinkingStateStuck++;
                            this.addWarning('Thinking state may be stuck');
                            this.warnedAboutThinking = true;
                        }
                    }
                }
            } else {
                this.thinkingStartTime = null;
                this.warnedAboutThinking = false;
            }

        }, 1000);
    }

    recordEvent(eventName, args) {
        const event = {
            timestamp: Date.now(),
            name: eventName,
            args: args
        };
        
        this.events.push(event);
        
        // Keep only last 100 events
        if (this.events.length > 100) {
            this.events.shift();
        }
    }

    log(message, type = 'info') {
        const logEl = document.getElementById('diagnostic-log');
        if (!logEl) return;

        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        
        logEl.appendChild(entry);
        logEl.scrollTop = logEl.scrollHeight;

        // Also log to console
        console.log(`[Diagnostics] ${message}`);
    }

    updateMetric(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    updateChunksDisplay() {
        const sent = this.metrics.audioChunksSent;
        const dropped = this.metrics.audioChunksDropped;
        this.updateMetric('diag-chunks', `${sent} sent / ${dropped} dropped`);
        
        if (dropped > 0) {
            const dropRate = (dropped / (sent + dropped)) * 100;
            if (dropRate > 10) {
                this.addWarning(`High audio drop rate: ${dropRate.toFixed(1)}%`);
            }
        }
    }

    addWarning(message) {
        const warningsEl = document.getElementById('diagnostic-warnings');
        if (!warningsEl) return;

        // Check if warning already exists
        const existingWarnings = warningsEl.querySelectorAll('.diagnostic-warning');
        for (const warning of existingWarnings) {
            if (warning.textContent === message) return;
        }

        const warning = document.createElement('div');
        warning.className = 'diagnostic-warning';
        warning.textContent = message;
        warningsEl.appendChild(warning);

        // Auto-remove after 10 seconds
        setTimeout(() => warning.remove(), 10000);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    // Generate diagnostic report
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            metrics: this.metrics,
            recentEvents: this.events.slice(-20),
            state: {
                socketConnected: window.state?.socket?.connected || false,
                deepgramActive: window.state?.deepgram?.streamActive || false,
                isRecording: window.state?.recording?.isRecording || false,
                isThinking: window.state?.ui?.thinking || false,
                accumulatedTime: window.state?.recording?.accumulatedTime || 0,
                questionCount: window.state?.ui?.questionCount || 0
            }
        };

        console.log('[Diagnostics] Full diagnostic report:', report);
        return report;
    }
}

// Create global instance
window.interviewDiagnostics = new InterviewDiagnostics();

// Auto-start diagnostics in development mode
if (window.location.hostname === 'localhost') {
    console.log('[Diagnostics] Auto-starting diagnostics in development mode');
    setTimeout(() => {
        if (window.state && window.state.socket && window.state.socket.instance) {
            window.interviewDiagnostics.start();
        }
    }, 2000);
}