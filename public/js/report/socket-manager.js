// Socket Manager for Report Generation
import { reportState } from './report-state.js';
import { formatMagazineContent } from './report-content-formatter.js';
import { updateHeaderWithUserName } from './report-utils.js';

// Dynamic shape overlay for report generation
let dynamicOverlay = null;

export function initializeSocketConnection(initialReportLoaded = false, regenerateReportButtonElement) {
    // Set the global variable based on the parameter
    if (initialReportLoaded) {
        reportState.setReportLoaded(true, true);
    }
    
    const socket = io({
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
    });

    // Make socket globally accessible
    window.reportSocket = socket;
    reportState.reportSocket = socket;

    const reportContent = document.getElementById('reportContent');
    const copyMarkdownButton = document.getElementById('copyMarkdownButton');
    let connectionStatus = 'connected';
    let sessionId = localStorage.getItem('archiveSessionId');
    let reportRequested = false;
    let hasBeenDisconnected = false;
    
    // Debug logging
    console.log('[Socket Manager] Initializing with sessionId from localStorage:', sessionId);
    console.log('[Socket Manager] reportState.reportAlreadyLoaded:', reportState.reportAlreadyLoaded);
    console.log('[Socket Manager] reportState.currentReportId:', reportState.currentReportId);
    
    // Add debug logging for ALL socket events
    const originalOn = socket.on.bind(socket);
    socket.on = function(event, handler) {
        return originalOn(event, function(...args) {
            if (!['ping', 'pong'].includes(event)) {  // Skip ping/pong events
                console.log(`[Socket Debug] Event received: ${event}`, args);
            }
            return handler.apply(this, args);
        });
    };

    const createConnectionBanner = () => {
        const existingBanner = document.getElementById('connectionBanner');
        if (existingBanner) existingBanner.remove();
        const banner = document.createElement('div');
        banner.id = 'connectionBanner';
        banner.style.position = 'fixed'; 
        banner.style.top = '0'; 
        banner.style.left = '0'; 
        banner.style.right = '0';
        banner.style.padding = '0.5rem'; 
        banner.style.textAlign = 'center'; 
        banner.style.zIndex = '9999';
        banner.style.transition = 'all 0.3s ease';
        
        if (connectionStatus === 'disconnected') { 
            banner.style.backgroundColor = '#f44336'; 
            banner.style.color = 'white'; 
            banner.textContent = 'Connection lost. Attempting to reconnect...'; 
        } else if (connectionStatus === 'reconnecting') { 
            banner.style.backgroundColor = '#ff9800'; 
            banner.style.color = 'white'; 
            banner.textContent = 'Reconnecting...'; 
        } else if (connectionStatus === 'reconnected') { 
            banner.style.backgroundColor = '#4caf50'; 
            banner.style.color = 'white'; 
            banner.textContent = 'Connection restored!'; 
            setTimeout(() => { 
                if (banner.parentNode) banner.remove(); 
            }, 3000); 
        }
        
        if (connectionStatus !== 'connected') document.body.appendChild(banner);
    };

    // Configure marked for better output
    marked.use({
        breaks: true,
        gfm: true,
        headerIds: false,
        headerPrefix: false
    });

    // Socket event handlers
    socket.on('connect', function() {
        console.log('Socket connected to server');

        // Check if regeneration was in progress before disconnect
        const wasRegenerating = sessionStorage.getItem('isRegenerating') === 'true';
        if (wasRegenerating) {
            console.log('Socket connected but regeneration was in progress before disconnect. Stopping regeneration.');
            reportState.stopRegeneration();
            // Hide any regeneration UI elements
            const regenerateButton = document.getElementById('regenerateReportButton');
            if (regenerateButton) {
                regenerateButton.classList.remove('hidden');
                regenerateButton.classList.add('flex');
            }
            // Remove any overlays
            removeFullscreenOverlay();
        }

        if (hasBeenDisconnected) {
            connectionStatus = 'reconnected';
            console.log('Socket RECONNECTED.');
            createConnectionBanner();
            hasBeenDisconnected = false;
        } else {
            const oldStatus = connectionStatus;
            connectionStatus = 'connected';
            console.log('Socket INITIALLY CONNECTED.');

            const existingBanner = document.getElementById('connectionBanner');
            if (existingBanner) {
                if (oldStatus === 'disconnected' || oldStatus === 'reconnecting') {
                     existingBanner.remove();
                }
            }
        }

        if (sessionId && !reportRequested && !reportState.reportAlreadyLoaded && !reportState.currentReportId && !wasRegenerating) {
            console.log('[Socket Connected] Have sessionId, requesting report. sessionId:', sessionId);
            console.log('[Socket Connected] reportRequested:', reportRequested);
            console.log('[Socket Connected] reportAlreadyLoaded:', reportState.reportAlreadyLoaded);
            console.log('[Socket Connected] currentReportId:', reportState.currentReportId);
            console.log('[Socket Connected] wasRegenerating:', wasRegenerating);
            
            // Show loading overlay immediately
            const showOverlay = async () => {
                console.log('[Socket Connected] Showing loading overlay...');
                console.log('[Socket Connected] FlowingTextViz available:', typeof FlowingTextViz !== 'undefined');
                console.log('[Socket Connected] DynamicShapeOverlay available:', typeof DynamicShapeOverlay !== 'undefined');
                
                try {
                    handleShowGenerationInProgress({
                        message: 'Loading your report',
                        subtitle: 'Please wait...'
                    });
                    console.log('[Socket Connected] Loading overlay shown successfully');
                } catch (error) {
                    console.error('[Socket Connected] Error showing loading overlay:', error);
                    // Show a simple loading message as fallback
                    const reportContent = document.getElementById('reportContent');
                    if (reportContent) {
                        reportContent.innerHTML = '<div class="text-center p-8"><p class="text-lg">Loading your report...</p><div class="mt-4 thinking-indicator justify-center"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div></div></div>';
                    }
                }
            };
            
            showOverlay();
            
            // Add a small delay to ensure server is ready
            setTimeout(() => {
                console.log('[Socket Connected] About to emit requestReport');
                console.log('[Socket Connected] Socket connected:', socket.connected);
                console.log('[Socket Connected] Socket id:', socket.id);
                
                try {
                    socket.emit('requestReport', sessionId);
                    console.log('[Socket Connected] requestReport emitted successfully with sessionId:', sessionId);
                    reportRequested = true;
                } catch (error) {
                    console.error('[Socket Connected] Error emitting requestReport:', error);
                }
            }, 100);
        } else if (!sessionId && !reportState.reportAlreadyLoaded && !reportState.currentReportId) {
            console.log("[Socket Connected] No session ID found in localStorage, and report not loaded by API. Waiting for server to initiate if needed.");
        } else if (reportState.currentReportId) {
            console.log(`[Socket Connected] Already have report ID: ${reportState.currentReportId}. Not requesting new report.`);
        } else {
            console.log('[Socket Connected] Unhandled case:');
            console.log('  sessionId:', sessionId);
            console.log('  reportRequested:', reportRequested);
            console.log('  reportAlreadyLoaded:', reportState.reportAlreadyLoaded);
            console.log('  currentReportId:', reportState.currentReportId);
            console.log('  wasRegenerating:', wasRegenerating);
        }
    });

    socket.on('disconnect', function() {
        console.log('Socket disconnected');
        connectionStatus = 'disconnected';
        hasBeenDisconnected = true;
        createConnectionBanner();
    });

    socket.on('reconnecting', function(attemptNumber) {
        console.log('Socket reconnecting:', attemptNumber);
        connectionStatus = 'reconnecting';
        hasBeenDisconnected = true;
        createConnectionBanner();
    });

    socket.on('reconnect_failed', function() {
        console.log('Socket reconnect failed'); 
        connectionStatus = 'disconnected'; 
        createConnectionBanner(); 
        if (!reportState.reportAlreadyLoaded) {
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.innerHTML = `<strong>Connection Error</strong><p>Unable to connect. Please refresh.</p><button onclick="window.location.reload()">Refresh</button>`;
            reportContent.appendChild(errorMessage);
        }
    });

    // Report generation events are now handled on the interview page
    // The report page only loads completed reports
    /*
    socket.on('reportThinkingStarted', function() {
        console.log('[Socket Event] reportThinkingStarted received');
        handleReportThinkingStarted();
    });

    socket.on('reportThinkingUpdate', function(thinking) {
        console.log('[Socket Event] reportThinkingUpdate received, length:', thinking?.length || 0);
        handleReportThinkingUpdate(thinking);
    });

    socket.on('reportThinkingComplete', function() {
        console.log('[Socket Event] reportThinkingComplete received');
        handleReportThinkingComplete();
    });
    */

    socket.on('reportContentUpdate', function(content) {
        console.log('[Socket Event] reportContentUpdate received, length:', content?.length || 0);
        handleReportContentUpdate(content);
    });

    socket.on('reportGeneratedWithId', function(data) {
        console.log('[Socket Event] reportGeneratedWithId received:', data);
        handleReportGeneratedWithId(data, regenerateReportButtonElement, copyMarkdownButton);
    });

    socket.on('reportComplete', function(data) {
        console.log('[Socket Event] reportComplete received:', data);
        handleReportComplete(data, regenerateReportButtonElement, copyMarkdownButton);
    });
    
    socket.on('showGenerationInProgress', function(data) {
        console.log('[Socket Event] showGenerationInProgress received:', data);
        handleShowGenerationInProgress(data);
    });

    socket.on('redirectToReport', function(data) { 
        console.log('[Socket Event] redirectToReport received:', data);
        // Handle redirect with proper report ID parameters
        const reportId = data?.reportId || '';
        const interviewId = data?.interviewId || '';
        
        if (reportId) {
            window.location.href = `/report.html?id=${reportId}`;
        } else if (interviewId) {
            window.location.href = `/report.html?interview=${interviewId}`;
        } else {
            window.location.href = '/report.html';
        }
    });

    socket.on('error', function(error) { 
        console.error('[Socket Event] error received:', error);
        console.error('[Socket Event] Error stack trace:', new Error().stack);
        console.error('[Socket Event] Current state:', {
            reportAlreadyLoaded: reportState.reportAlreadyLoaded,
            currentReportId: reportState.currentReportId,
            sessionId: sessionId,
            socketId: socket.id,
            connected: socket.connected
        });
        
        if (!reportState.reportAlreadyLoaded) {
            // Clean up any visualization
            removeFullscreenOverlay();
            
            // Show more detailed error message
            const reportContent = document.getElementById('reportContent');
            if (reportContent) {
                const actionButtons = reportContent.querySelector('#reportActionButtons');
                reportContent.innerHTML = '';
                if (actionButtons) {
                    reportContent.appendChild(actionButtons);
                }
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message p-8 text-center';
                errorDiv.innerHTML = `
                    <h3 class="text-xl font-semibold text-red-500 mb-4">Report Generation Error</h3>
                    <p class="text-red-400 mb-4">${error || 'Unknown error occurred'}</p>
                    <p class="text-gray-400 text-sm mb-4">Please check the browser console for more details.</p>
                    <button onclick="window.location.reload()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Refresh Page
                    </button>
                `;
                reportContent.appendChild(errorDiv);
            }
        }
    });

    // Handle specific report generation errors
    socket.on('reportGenerationError', function(data) {
        console.error('[Socket Event] reportGenerationError received:', data);
        removeFullscreenOverlay();
        
        const reportContent = document.getElementById('reportContent');
        if (reportContent) {
            const actionButtons = reportContent.querySelector('#reportActionButtons');
            reportContent.innerHTML = '';
            if (actionButtons) {
                reportContent.appendChild(actionButtons);
            }
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message p-8 text-center';
            errorDiv.innerHTML = `
                <h3 class="text-xl font-semibold text-red-500 mb-4">Report Generation Failed</h3>
                <p class="text-red-400 mb-4">${data?.message || 'Failed to generate report'}</p>
                <p class="text-gray-400 text-sm mb-4">Error code: ${data?.code || 'UNKNOWN'}</p>
                <button onclick="window.location.reload()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                    Try Again
                </button>
            `;
            reportContent.appendChild(errorDiv);
        }
    });
    
    // Handle report generation timeout
    socket.on('reportGenerationTimeout', function() {
        console.error('[Socket Event] reportGenerationTimeout received');
        removeFullscreenOverlay();
        
        const reportContent = document.getElementById('reportContent');
        if (reportContent) {
            const actionButtons = reportContent.querySelector('#reportActionButtons');
            reportContent.innerHTML = '';
            if (actionButtons) {
                reportContent.appendChild(actionButtons);
            }
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message p-8 text-center';
            errorDiv.innerHTML = `
                <h3 class="text-xl font-semibold text-yellow-500 mb-4">Report Generation Timeout</h3>
                <p class="text-yellow-400 mb-4">The report generation is taking longer than expected.</p>
                <p class="text-gray-400 text-sm mb-4">Your report will be emailed to you when it's ready.</p>
                <button onclick="window.location.reload()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                    Refresh Page
                </button>
            `;
            reportContent.appendChild(errorDiv);
        }
    });
    
    // Global function for thinking toggle
    window.toggleThinking = function(messageId) {
        const thinkingPanel = document.getElementById(messageId);
        if (!thinkingPanel) return;
        const toggleButton = thinkingPanel.previousElementSibling;
        if (thinkingPanel.classList.contains('expanded')) { 
            thinkingPanel.classList.remove('expanded'); 
            toggleButton.querySelector('span').textContent = 'View thinking'; 
        } else { 
            thinkingPanel.classList.add('expanded'); 
            toggleButton.querySelector('span').textContent = 'Hide thinking'; 
        }
        toggleButton.classList.toggle('expanded');
    };
}

// Handler functions
async function handleReportThinkingStarted() {
    console.log(`[${window.reportSocket.id}] *** reportThinkingStarted event received ***`);
    console.log(`[${window.reportSocket.id}] reportThinkingStarted received. reportAlreadyLoaded: ${reportState.reportAlreadyLoaded}`);
    
    if (reportState.reportAlreadyLoaded) {
        console.log(`[${window.reportSocket.id}] reportThinkingStarted: Returning early because reportAlreadyLoaded is true`);
        return;
    }
    
    // Clean up any existing overlays first
    removeFullscreenOverlay();
    
    console.log(`[${window.reportSocket.id}] reportThinkingStarted: Creating visualization`);
    console.log(`[${window.reportSocket.id}] FlowingTextViz available: ${typeof FlowingTextViz !== 'undefined'}`);
    
    // Use FlowingTextViz for consistency with thinking trace streaming
    try {
        if (typeof FlowingTextViz !== 'undefined') {
            // Create a fullscreen container for the visualization
            const vizContainer = document.createElement('div');
            vizContainer.id = 'reportGenerationViz';
            vizContainer.style.position = 'fixed';
            vizContainer.style.top = '0';
            vizContainer.style.left = '0';
            vizContainer.style.width = '100vw';
            vizContainer.style.height = '100vh';
            vizContainer.style.zIndex = '9999';
            vizContainer.style.backgroundColor = '#000000';
            document.body.appendChild(vizContainer);
            
            // Create the visualization
            const viz = new FlowingTextViz(vizContainer);
            
            // Store reference for streaming updates
            window.reportGenerationViz = viz;
            window.reportGenerationContainer = vizContainer;
            
            console.log(`[${window.reportSocket.id}] FlowingTextViz created and shown successfully`);
        } else {
            // Fallback to DynamicShapeOverlay if FlowingTextViz is not available
            console.warn('FlowingTextViz not available, falling back to DynamicShapeOverlay');
            
            let shapeConfig;
            if (typeof DynamicShapeOverlay !== 'undefined' && DynamicShapeOverlay.loadUserConfig) {
                shapeConfig = await DynamicShapeOverlay.loadUserConfig('report');
            } else {
                // Fallback configuration
                shapeConfig = {
                    shapeType: 'lissajous',
                    shapeParams: { a: 4, b: 5, c: 6, scale: 3 },
                    textSize: 0.7,
                    textSpeed: 75,
                    bgColor: '#000000',
                    textOrientation: 'vertical'
                };
            }
            
            // Create and show dynamic overlay
            if (typeof DynamicShapeOverlay !== 'undefined') {
                console.log(`[${window.reportSocket.id}] Creating new DynamicShapeOverlay with config:`, shapeConfig);
                dynamicOverlay = new DynamicShapeOverlay(shapeConfig);
                const showResult = dynamicOverlay.show({
                    message: 'Say is analyzing your answers to create your report',
                    subtitle: 'Step 1 of 2'
                });
                console.log(`[${window.reportSocket.id}] Show result:`, showResult);
                
                // Store references for compatibility
                reportState.fullscreenThinkingOverlay = dynamicOverlay;
                reportState.currentThinkingMessage = dynamicOverlay;
                
                console.log(`[${window.reportSocket.id}] Dynamic shape overlay created and shown successfully. isVisible:`, dynamicOverlay.isVisible);
            } else {
                // Fallback to original overlay
                console.warn('DynamicShapeOverlay not available, using fallback');
                createOriginalOverlay();
            }
        }
    } catch (error) {
        console.error('Error creating visualization:', error);
        createOriginalOverlay();
    }
    
    // Preserve action buttons when clearing content during regeneration
    const reportContent = document.getElementById('reportContent');
    const actionButtons = reportContent.querySelector('#reportActionButtons');
    reportContent.innerHTML = '';
    if (actionButtons) {
        reportContent.appendChild(actionButtons);
    }
    console.log(`[${window.reportSocket.id}] reportThinkingStarted: Cleared reportContent (preserved action buttons)`);
}

// Fallback to original overlay
function createOriginalOverlay() {
    const fullscreenOverlay = createFullscreenThinkingOverlay();
    document.body.appendChild(fullscreenOverlay);
    
    // Hide the mobile navigation toggle while overlay is present
    const mobileNavToggle = document.getElementById('mobileNavToggle');
    if (mobileNavToggle) {
        mobileNavToggle.style.display = 'none';
    }
    
    // Disable scrolling while overlay is present
    document.body.style.overflow = 'hidden';
    
    reportState.currentThinkingMessage = fullscreenOverlay;
    reportState.reportStreamingBackgroundElement = fullscreenOverlay.querySelector('pre.streamed-content');
    reportState.fullscreenThinkingOverlay = fullscreenOverlay;
}

function handleReportThinkingUpdate(thinking) {
    console.log(`[${window.reportSocket.id}] reportThinkingUpdate received. reportAlreadyLoaded: ${reportState.reportAlreadyLoaded}, thinking length: ${thinking ? thinking.length : 0}`);
    
    if (reportState.reportAlreadyLoaded) {
        console.log(`[${window.reportSocket.id}] reportThinkingUpdate: Returning early because reportAlreadyLoaded is true`);
        return;
    }
    
    // Stream to FlowingTextViz if available
    if (window.reportGenerationViz) {
        console.log(`[${window.reportSocket.id}] Streaming thinking to FlowingTextViz`);
        window.reportGenerationViz.streamText(thinking);
        return;
    }
    
    // Update dynamic overlay if available (fallback)
    if (dynamicOverlay && dynamicOverlay.isVisible) {
        dynamicOverlay.updateStreamingText(thinking);
        return;
    }
    
    // Fallback to original background streaming
    if (!reportState.reportStreamingBackgroundElement) {
        console.log(`[${window.reportSocket.id}] reportThinkingUpdate: No streaming element available`);
        return;
    }
    
    const streamingBackground = reportState.reportStreamingBackgroundElement;
    console.log(`[${window.reportSocket.id}] reportThinkingUpdate: Using fallback streamingBackground`);
                    
    if (streamingBackground) {
        const bluePalette = ['#001f3f', '#003366', '#004080', '#0059b3', '#0073e6'];
        const words = thinking.split(/(\s+)/);
        words.forEach(word => {
            if (word.trim() !== '') {
                const span = document.createElement('span');
                span.style.color = bluePalette[Math.floor(Math.random() * bluePalette.length)];
                span.textContent = word;
                streamingBackground.appendChild(span);
            } else {
                streamingBackground.appendChild(document.createTextNode(word));
            }
        });
        streamingBackground.scrollTop = streamingBackground.scrollHeight;
    }
}

function handleReportThinkingComplete() {
    if (reportState.reportAlreadyLoaded) return;
    
    // Update FlowingTextViz if available
    if (window.reportGenerationViz) {
        return;
    }
    
    // Update dynamic overlay if available
    if (dynamicOverlay && dynamicOverlay.isVisible) {
        dynamicOverlay.updateMessage(
            'Say is finalizing your report', 
            'Step 2 of 2'
        );
        return;
    }
    
    // Fallback to original overlay
    if (!reportState.fullscreenThinkingOverlay) return;
    
    const stepIndicator = reportState.fullscreenThinkingOverlay.querySelector('#streamingStepIndicator');
    if (stepIndicator) {
        stepIndicator.innerHTML = `
            Say is finalizing your report (Step 2 of 2)...
            <div class="thinking-dots-container" style="display: inline-flex; gap: 4px; margin-left: 8px;">
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
                <div class="thinking-dot"></div>
            </div>
        `;
    } else {
        console.warn('[reportThinkingComplete] Streaming step indicator not found.');
    }
}

function handleReportContentUpdate(content) {
    console.log(`[${window.reportSocket.id}] *** reportContentUpdate received ***`);
    console.log(`[${window.reportSocket.id}] reportContentUpdate received. reportAlreadyLoaded: ${reportState.reportAlreadyLoaded}, content length: ${content ? content.length : 0}`);
    console.log(`[${window.reportSocket.id}] reportContentUpdate content preview: "${content ? content.substring(0, 50) : 'null'}..."`);
    
    if (reportState.reportAlreadyLoaded) {
        console.log(`[${window.reportSocket.id}] reportContentUpdate: Returning early because reportAlreadyLoaded is true`);
        return;
    }
    
    if (!reportState.reportBuffer) reportState.reportBuffer = '';
    reportState.reportBuffer += content;
    console.log(`[${window.reportSocket.id}] reportContentUpdate: Added to buffer. Total buffer length: ${reportState.reportBuffer.length}`);
    
    // Stream to FlowingTextViz if available
    if (window.reportGenerationViz) {
        console.log(`[${window.reportSocket.id}] Streaming content to FlowingTextViz`);
        window.reportGenerationViz.streamText(content);
        return;
    }
    
    // Update dynamic overlay if available (fallback)
    if (dynamicOverlay && dynamicOverlay.isVisible) {
        dynamicOverlay.updateStreamingText(content);
        return;
    }
    
    // Also add to streaming background with colored text (fallback)
    const streamingBackground = reportState.reportStreamingBackgroundElement;
    console.log(`[${window.reportSocket.id}] reportContentUpdate: streamingBackground element: ${streamingBackground ? 'found' : 'NOT FOUND'}`);
    
    if (streamingBackground) {
        console.log(`[${window.reportSocket.id}] reportContentUpdate: Adding content to streaming background`);
        const bluePalette = ['#001f3f', '#003366', '#004080', '#0059b3', '#0073e6'];
        const words = content.split(/(\s+)/);
        words.forEach(word => {
            if (word.trim() !== '') {
                const span = document.createElement('span');
                span.style.color = bluePalette[Math.floor(Math.random() * bluePalette.length)];
                span.textContent = word;
                streamingBackground.appendChild(span);
            } else {
                streamingBackground.appendChild(document.createTextNode(word));
            }
        });
        streamingBackground.scrollTop = streamingBackground.scrollHeight;
        console.log(`[${window.reportSocket.id}] reportContentUpdate: Content added to streaming background`);
    } else {
        console.warn(`[${window.reportSocket.id}] reportContentUpdate: No streaming background element found!`);
    }
}

// Handler for when user lands on report page while generation is in progress
async function handleShowGenerationInProgress(data) {
    console.log(`[${window.reportSocket.id}] showGenerationInProgress received:`, data);
    
    // Don't show overlay if report is already loaded
    if (reportState.reportAlreadyLoaded) {
        console.log('Report already loaded, not showing generation overlay');
        return;
    }
    
    try {
        // Use FlowingTextViz directly
        if (typeof FlowingTextViz !== 'undefined' && !window.reportGenerationViz) {
            // Create a fullscreen container for the visualization
            const vizContainer = document.createElement('div');
            vizContainer.id = 'reportGenerationViz';
            vizContainer.style.position = 'fixed';
            vizContainer.style.top = '0';
            vizContainer.style.left = '0';
            vizContainer.style.width = '100vw';
            vizContainer.style.height = '100vh';
            vizContainer.style.zIndex = '9999';
            vizContainer.style.backgroundColor = '#000000';
            document.body.appendChild(vizContainer);
            
            // Create the visualization
            const viz = new FlowingTextViz(vizContainer);
            
            // Store reference for cleanup
            window.reportGenerationViz = viz;
            window.reportGenerationContainer = vizContainer;
            
            console.log('FlowingTextViz shown for generation in progress');
        } else {
            console.warn('FlowingTextViz not available or already showing');
        }
    } catch (error) {
        console.error('Error showing generation in progress:', error);
    }
}

async function handleReportGeneratedWithId(data, regenerateReportButtonElement, copyMarkdownButton) {
    if (reportState.reportAlreadyLoaded) {
        console.log("[socket] 'reportGeneratedWithId' received, but reportAlreadyLoaded is true. Ignoring.");
        return;
    }
    
    // Stop regeneration state
    reportState.stopRegeneration();
    
    // Remove the fullscreen overlay
    removeFullscreenOverlay();
    
    console.log("[socket] Received 'reportGeneratedWithId'. data.reportId:", data ? data.reportId : 'data_is_null');
    console.log("[socket] Received 'reportGeneratedWithId'. data.reportTitle:", data ? data.reportTitle : 'data_is_null');

    reportState.setCurrentReportId(data ? data.reportId : null);
    console.log("[socket] 'reportGeneratedWithId' AFTER assignment, currentReportId is:", reportState.currentReportId);
    
    // Update header with user's name
    if (reportState.currentReportId) {
        updateHeaderWithUserName(reportState.currentReportId, reportState.currentInterviewId);
    }
    
    if (reportState.currentReportId) {
        localStorage.setItem('currentPersistentReportId', reportState.currentReportId);
    } else {
        console.warn("Report ID received from server was null/undefined.");
    }

    const finalContent = data.reportContent || '';
    reportState.reportBuffer = '';
    const cleanedContent = finalContent.replace(/<\/?final_report>/gi, '').trim();
    reportState.reportMarkdown = cleanedContent;
    copyMarkdownButton.disabled = false;

    // Update header title and document title
    const reportTitle = (data && data.reportTitle) ? data.reportTitle : "Personal AI Readiness Report";
    updateHeaderWithUserName(reportState.currentReportId, reportState.currentInterviewId, reportTitle);
    document.title = reportTitle;

    // Fetch metadata for the report
    const metadata = await fetchReportMetadata(reportState.currentReportId);
    const formattedContent = formatMagazineContent(cleanedContent, reportTitle, metadata);
    const reportContent = document.getElementById('reportContent');
    let finalReportContainer = document.getElementById('finalReportContainer');
    if (!finalReportContainer) { 
        finalReportContainer = document.createElement('div'); 
        finalReportContainer.id = 'finalReportContainer'; 
        reportContent.appendChild(finalReportContainer); 
    }
    
    // Clear previous messages
    const interviewMessages = document.querySelectorAll('.interview-complete-message, .compact-congrats-message');
    interviewMessages.forEach(message => message.remove());

    const reportWrapper = document.createElement('div');
    reportWrapper.className = 'report-wrapper animate-fade-in';
    reportWrapper.innerHTML = formattedContent;
    finalReportContainer.appendChild(reportWrapper);
    finalReportContainer.className = 'animate-fade-in';

    // Restore the regeneration button
    if (regenerateReportButtonElement) {
        regenerateReportButtonElement.classList.remove('hidden');
        regenerateReportButtonElement.classList.add('flex');
    }
    
    // Call the report loaded callback
    reportState.reportFullyLoaded();
}

async function handleReportComplete(data, regenerateReportButtonElement, copyMarkdownButton) {
    if (reportState.reportAlreadyLoaded) return;
    
    // Remove the fullscreen overlay
    removeFullscreenOverlay();
    
    console.log("[socket] Received 'reportComplete' (fallback/example flow).");
    console.log("[socket] reportComplete data.reportTitle:", data ? data.reportTitle : 'data_is_null');

    if (!reportState.currentReportId) {
        console.warn("'reportComplete' called but no currentReportId.");
    }

    const finalContent = (data && data.reportContent) ? data.reportContent : (reportState.reportBuffer || '');
    reportState.reportBuffer = '';
    const cleanedContent = finalContent.replace(/<\/?final_report>/gi, '').trim();
    reportState.reportMarkdown = cleanedContent;
    copyMarkdownButton.disabled = false;

    // Update header title and document title
    const reportTitle = (data && data.reportTitle) ? data.reportTitle : "Personal AI Readiness Report";
    updateHeaderWithUserName(reportState.currentReportId, reportState.currentInterviewId, reportTitle);
    document.title = reportTitle;

    // Fetch metadata for the report
    const metadata = await fetchReportMetadata(reportState.currentReportId);
    const formattedContent = formatMagazineContent(cleanedContent, reportTitle, metadata);
    const reportContent = document.getElementById('reportContent');
    let finalReportContainer = document.getElementById('finalReportContainer');
    if (!finalReportContainer) { 
        finalReportContainer = document.createElement('div'); 
        finalReportContainer.id = 'finalReportContainer'; 
        reportContent.appendChild(finalReportContainer); 
    }
    
    // Clear previous messages
    const interviewMessages = document.querySelectorAll('.interview-complete-message, .compact-congrats-message');
    interviewMessages.forEach(message => message.remove());

    const reportWrapper = document.createElement('div');
    reportWrapper.className = 'report-wrapper animate-fade-in';
    reportWrapper.innerHTML = formattedContent;
    finalReportContainer.appendChild(reportWrapper);
    finalReportContainer.className = 'animate-fade-in';

    // Restore the regeneration button
    if (regenerateReportButtonElement) {
        regenerateReportButtonElement.classList.remove('hidden');
        regenerateReportButtonElement.classList.add('flex');
    }
    
    // Call the report loaded callback
    reportState.reportFullyLoaded();
}

// Helper function to fetch report metadata
async function fetchReportMetadata(reportId) {
    try {
        const response = await fetch(`/api/reports/${reportId}`);
        if (response.ok) {
            const data = await response.json();
            return {
                user_name: data.user_name,
                start_timestamp: data.start_timestamp
            };
        }
    } catch (error) {
        console.error('Error fetching report metadata:', error);
    }
    return {};
}

// Helper functions
function createFullscreenThinkingOverlay() {
    const fullscreenOverlay = document.createElement('div');
    fullscreenOverlay.id = 'fullscreenThinkingOverlay';
    fullscreenOverlay.style.cssText = `
        position: fixed;
        top: 80px;
        left: 0;
        width: 100vw;
        height: calc(100vh - 80px);
        z-index: 9999;
        background-color: #4A4D53;
        border-radius: 8px;
        border: 10px solid teal;
        box-sizing: border-box;
    `;
    
    fullscreenOverlay.innerHTML = `
        <!-- Full screen streaming text background -->
        <pre class="streamed-content" style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 20px;
            overflow-y: hidden;
            color: rgba(59, 130, 246, 0.6);
            font-family: var(--font-mono, monospace);
            font-size: 0.7rem;
            line-height: 1.6;
            white-space: pre-wrap;
            background: transparent;
            border: none;
            z-index: 1;
        "></pre>
        
        <!-- Semitransparent mask over the streaming text -->
        <div style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(2px);
            -webkit-backdrop-filter: blur(2px);
            z-index: 2;
        "></div>
        
        <!-- UI elements on top of the mask -->
        <div style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 20px;
            z-index: 3;
        ">
            <img src="saylogo.png" alt="Say Logo" style="
                width: 100px;
                height: 100px;
                border-radius: 6px;
                margin-bottom: 2rem;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            ">
            
            <div id="streamingStepIndicator" style="
                color: #F3F4F6;
                font-size: 1.25rem;
                font-weight: 500;
                padding: 15px 30px;
                margin-bottom: 2rem;
                text-align: center;
                line-height: 1.4;
                max-width: 600px;
            ">
                Say is analyzing your answers to create your report (Step 1 of 2)...
            </div>
            
            <div style="
                position: absolute;
                bottom: 40px;
                left: 50%;
                transform: translateX(-50%);
                color: #D1D5DB;
                font-size: 0.9rem;
                text-align: center;
                padding: 10px 18px;
            ">
                Report generation can take up to five minutes. Your report will be emailed to you when it's ready. Please do not refresh this page.
            </div>
        </div>
    `;
    
    return fullscreenOverlay;
}

function removeFullscreenOverlay() {
    console.log(`[${window.reportSocket?.id || 'no-socket'}] removeFullscreenOverlay called. dynamicOverlay exists: ${!!dynamicOverlay}, isVisible: ${dynamicOverlay?.isVisible}`);
    
    // Check for FlowingTextViz first
    if (window.reportGenerationViz) {
        console.log(`[${window.reportSocket?.id || 'no-socket'}] Found FlowingTextViz, cleaning up`);
        window.reportGenerationViz.destroy();
        window.reportGenerationViz = null;
    }
    if (window.reportGenerationContainer) {
        window.reportGenerationContainer.remove();
        window.reportGenerationContainer = null;
    }
    
    // Check for global overlay reference
    if (window.reportGenerationOverlay) {
        console.log(`[${window.reportSocket?.id || 'no-socket'}] Found global reportGenerationOverlay, hiding it`);
        window.reportGenerationOverlay.hide();
        window.reportGenerationOverlay = null;
    }
    
    // Remove dynamic overlay if it exists (force cleanup even if visibility flag is wrong)
    if (dynamicOverlay) {
        console.log(`[${window.reportSocket?.id || 'no-socket'}] Hiding dynamic overlay (force cleanup)`);
        if (dynamicOverlay.isVisible) {
            dynamicOverlay.hide();
        } else {
            // Force cleanup if the visibility flag is incorrect
            console.log(`[${window.reportSocket?.id || 'no-socket'}] Force cleaning up dynamic overlay with incorrect visibility flag`);
            if (dynamicOverlay.overlay && dynamicOverlay.overlay.parentNode) {
                dynamicOverlay.overlay.parentNode.removeChild(dynamicOverlay.overlay);
            }
            dynamicOverlay.isVisible = false;
            document.body.style.overflow = '';
        }
        dynamicOverlay = null;
        
        // Clear state references
        reportState.fullscreenThinkingOverlay = null;
        reportState.reportStreamingBackgroundElement = null;
        reportState.currentThinkingMessage = null;
        console.log(`[${window.reportSocket?.id || 'no-socket'}] Dynamic overlay cleaned up`);
        return;
    }
    
    // Fallback to original overlay removal
    if (reportState.fullscreenThinkingOverlay) {
        document.body.removeChild(reportState.fullscreenThinkingOverlay);
        reportState.fullscreenThinkingOverlay = null;
        reportState.reportStreamingBackgroundElement = null;
        reportState.currentThinkingMessage = null;
        
        // Restore the mobile navigation toggle
        const mobileNavToggle = document.getElementById('mobileNavToggle');
        if (mobileNavToggle) {
            mobileNavToggle.style.display = '';
        }
        
        // Restore scrolling
        document.body.style.overflow = '';
    }
}