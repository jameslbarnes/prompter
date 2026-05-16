// Thinking trace UI module - handles AI thinking visualization and streaming
import { state } from '../state.js';
import { elements } from '../dom.js';
import { config } from '../config.js';
import { enableInput, disableInput, clearStatus, updateRecordingStatus, updateQuestionCounter } from './controls.js';
import { streamingTTS } from '../audio/streaming-tts.js';
import { resetRecordingState } from '../audio/recorder.js';
// Use window functions since utils.js is not a module anymore
const clearError = window.clearError;
const showError = window.showError;


// Handle question generation failure
export function handleQuestionGenerationFailure() {
    console.error('Question generation failed - showing retry UI');
    
    // Clear thinking timeout if still active
    if (state.ui.thinkingTimeout) {
        clearTimeout(state.ui.thinkingTimeout);
        state.ui.thinkingTimeout = null;
    }
    
    // Hide thinking visualization
    const thinkingCanvas = document.getElementById('thinkingCanvas');
    if (thinkingCanvas) {
        thinkingCanvas.style.display = 'none';
    }
    
    // Reset thinking state
    state.ui.thinking = false;
    document.body.classList.remove('thinking-active');
    
    // Show retry message in question display
    const isVideoEnabled = document.body.classList.contains('video-enabled');
    const targetDisplay = isVideoEnabled ? elements.currentQuestionDisplayVideo : elements.currentQuestionDisplay;
    if (targetDisplay) {
        targetDisplay.innerHTML = `
            <div class="error-message">
                <p>Sorry, I had trouble generating a question.</p>
                <button class="retry-button" onclick="window.retryQuestionGeneration()">
                    Try Again
                </button>
            </div>
        `;
    }
    
    // Update status
    updateRecordingStatus('Failed to generate question. Click "Try Again" to retry.');
    
    // Re-enable input but keep record button disabled until retry
    if (elements.recordBtn) {
        elements.recordBtn.disabled = true;
        elements.recordBtn.classList.remove('thinking');
        elements.recordBtn.style.visibility = 'visible'; // Restore visibility on failure
        
        // Hide thinking ellipses inside the button
        const buttonEllipses = elements.recordBtn.querySelector('.thinking-ellipses');
        if (buttonEllipses) {
            buttonEllipses.classList.add('hidden');
        }
    }
    
    // Update keyboard hint
    const keyboardHint = document.querySelector('.keyboard-hints .hint-item');
    if (keyboardHint) {
        keyboardHint.innerHTML = 'Click "Try Again" to continue';
    }
}

// Global retry function
window.retryQuestionGeneration = function() {
    console.log('Retrying question generation...');
    
    // Clear error display
    const isVideoEnabled = document.body.classList.contains('video-enabled');
    const targetDisplay = isVideoEnabled ? elements.currentQuestionDisplayVideo : elements.currentQuestionDisplay;
    if (targetDisplay) {
        targetDisplay.innerHTML = '';
    }
    
    // Check socket connection
    const socket = state.socket.instance;
    if (socket && socket.connected) {
        console.log('Socket connected, requesting question retry');
        
        // Request a retry of the last question generation
        socket.emit('retryLastQuestion');
        
        // Show thinking UI again
        handleThinkingStart();
    } else {
        console.error('Socket not connected. Socket:', socket, 'Connected:', socket?.connected);
        showError('Connection lost. Please refresh the page.');
    }
};

// Handle thinking start
export async function handleThinkingStart() {
    state.timing.questionStartTime = Date.now();
    console.log(`⏱️ CLIENT TIMING - Question generation started at ${new Date().toISOString()}`);
    console.log('Thinking started event received');
    
    disableInput();
    state.ui.thinking = true;
    state.ui.currentThinkingTrace = '';
    
    // Log the expected max for this thinking session
    console.log(`[Thinking Start] Expected max: ${state.ui.averageThinkingChars} chars (from ${state.ui.thinkingCharacterHistory.length} previous sessions)`);

    // Clear the question display during thinking
    const isVideoEnabled = document.body.classList.contains('video-enabled');
    const targetDisplay = isVideoEnabled ? elements.currentQuestionDisplayVideo : elements.currentQuestionDisplay;
    if (targetDisplay) {
        // Don't clear it yet - we'll replace it with thinking panel
        console.log('[handleThinkingStart] Target display found, will be replaced with thinking panel');
    }

    // Hide info message for non-first questions
    if (elements.interviewInfoMessage && state.ui.questionCount > 0) {
        elements.interviewInfoMessage.classList.add('hidden');
    }

    // Keep recording status unchanged during thinking
    if (elements.recordingStatus) {
        elements.recordingStatus.classList.remove('recording');
    }

    // Update button state
    if (elements.recordBtn) {
        elements.recordBtn.classList.remove('recording');
        elements.recordBtn.classList.add('thinking');
        elements.recordBtn.disabled = true;
        // Keep button title generic since thinking is shown elsewhere
        
        // Show thinking ellipses inside the button
        const buttonEllipses = elements.recordBtn.querySelector('.thinking-ellipses');
        if (buttonEllipses) {
            buttonEllipses.classList.remove('hidden');
        }
    }

    // Log the state of all relevant elements BEFORE thinking starts
    console.log('[THINKING DEBUG] === BEFORE THINKING ACTIVE ===');
    const recordingControls = document.getElementById('recordingControls');
    const questionAreaVideo = document.getElementById('currentQuestionAreaVideo');
    const questionDisplayVideo = document.getElementById('currentQuestionDisplayVideo');
    
    console.log('[THINKING DEBUG] recordingControls:', {
        element: recordingControls,
        display: recordingControls ? window.getComputedStyle(recordingControls).display : 'null',
        visibility: recordingControls ? window.getComputedStyle(recordingControls).visibility : 'null',
        classList: recordingControls ? recordingControls.className : 'null'
    });
    
    console.log('[THINKING DEBUG] questionAreaVideo:', {
        element: questionAreaVideo,
        display: questionAreaVideo ? window.getComputedStyle(questionAreaVideo).display : 'null',
        visibility: questionAreaVideo ? window.getComputedStyle(questionAreaVideo).visibility : 'null',
        classList: questionAreaVideo ? questionAreaVideo.className : 'null'
    });
    
    console.log('[THINKING DEBUG] questionDisplayVideo:', {
        element: questionDisplayVideo,
        display: questionDisplayVideo ? window.getComputedStyle(questionDisplayVideo).display : 'null',
        visibility: questionDisplayVideo ? window.getComputedStyle(questionDisplayVideo).visibility : 'null',
        innerHTML: questionDisplayVideo ? questionDisplayVideo.innerHTML.substring(0, 100) + '...' : 'null'
    });
    
    // Create and show the thinking panel BEFORE adding thinking-active class
    // This ensures the panel is in place before any CSS rules take effect
    if (window.createThinkingPanel) {
        window.createThinkingPanel();
    } else {
        createThinkingPanel();
    }
    
    // Add thinking-active class to body for styling AFTER panel is created
    document.body.classList.add('thinking-active');
    
    // For mobile, ensure the question area stays in the normal flow
    if (window.innerWidth <= 768 && isVideoEnabled) {
        const questionArea = document.getElementById('currentQuestionAreaVideo');
        if (questionArea) {
            // Force the question area to be in the document flow on mobile
            questionArea.style.position = 'relative !important';
            questionArea.style.bottom = 'auto !important';
            console.log('[MOBILE FIX] Reset question area positioning for thinking');
        }
    }
    
    
    
    // Log the state AFTER thinking-active is added
    setTimeout(() => {
        console.log('[THINKING DEBUG] === AFTER THINKING ACTIVE (100ms) ===');
        console.log('[THINKING DEBUG] recordingControls after:', {
            display: recordingControls ? window.getComputedStyle(recordingControls).display : 'null',
            visibility: recordingControls ? window.getComputedStyle(recordingControls).visibility : 'null'
        });
        
        console.log('[THINKING DEBUG] questionAreaVideo after:', {
            display: questionAreaVideo ? window.getComputedStyle(questionAreaVideo).display : 'null',
            visibility: questionAreaVideo ? window.getComputedStyle(questionAreaVideo).visibility : 'null',
            opacity: questionAreaVideo ? window.getComputedStyle(questionAreaVideo).opacity : 'null',
            position: questionAreaVideo ? window.getComputedStyle(questionAreaVideo).position : 'null',
            rect: questionAreaVideo ? questionAreaVideo.getBoundingClientRect() : 'null',
            offsetHeight: questionAreaVideo ? questionAreaVideo.offsetHeight : 'null'
        });
        
        console.log('[THINKING DEBUG] questionDisplayVideo after:', {
            display: questionDisplayVideo ? window.getComputedStyle(questionDisplayVideo).display : 'null',
            visibility: questionDisplayVideo ? window.getComputedStyle(questionDisplayVideo).visibility : 'null',
            innerHTML: questionDisplayVideo ? questionDisplayVideo.innerHTML.substring(0, 100) + '...' : 'null'
        });
        
        const thinkingPanel = document.getElementById('thinkingTraceDisplay');
        console.log('[THINKING DEBUG] thinkingPanel:', {
            exists: !!thinkingPanel,
            display: thinkingPanel ? window.getComputedStyle(thinkingPanel).display : 'null',
            visibility: thinkingPanel ? window.getComputedStyle(thinkingPanel).visibility : 'null',
            parent: thinkingPanel ? thinkingPanel.parentElement.id : 'null'
        });
    }, 100);
    
    // Keep the record button visible to show thinking ellipses
    // (removed the visibility: hidden to show the thinking animation)
    
    // Hide the standalone thinking ellipses (not the ones in the button)
    const standaloneEllipses = document.querySelector('.thinking-ellipses-container .thinking-ellipses');
    if (standaloneEllipses) {
        standaloneEllipses.style.display = 'none';
    }
    
    // Ensure modal toggle is hidden during live trace display
    if (elements.viewThinkingToggle) elements.viewThinkingToggle.classList.add('hidden');
    if (window.hideThinkingModal) window.hideThinkingModal();
    
    // Add thinking timeout (45 seconds)
    if (state.ui.thinkingTimeout) {
        clearTimeout(state.ui.thinkingTimeout);
    }
    
    state.ui.thinkingTimeout = setTimeout(() => {
        console.error('Thinking timeout reached after 45 seconds - showing retry UI');
        
        // Clean up thinking state
        state.ui.thinking = false;
        state.ui.thinkingTimeout = null;
        document.body.classList.remove('thinking-active');
        
        // Hide thinking panel
        hideThinkingPanel();
        
        // Show retry UI
        handleQuestionGenerationFailure();
    }, 45000); // 45 second timeout
}

// Create thinking panel
function createThinkingPanel() {
    // Determine which display to use based on video mode
    const isVideoEnabled = document.body.classList.contains('video-enabled');
    const targetDisplay = isVideoEnabled ? elements.currentQuestionDisplayVideo : elements.currentQuestionDisplay;
    
    console.log('[createThinkingPanel] Video enabled:', isVideoEnabled, 'Target display:', targetDisplay);
    console.log('[createThinkingPanel] Window width:', window.innerWidth, 'Is mobile:', window.innerWidth <= 768);
    
    // Replace the question display with thinking panel
    if (targetDisplay) {
        // Make sure the parent container is visible first
        if (isVideoEnabled) {
            const questionArea = document.getElementById('currentQuestionAreaVideo');
            if (questionArea) {
                questionArea.classList.remove('hidden');
                
                // Force visibility with inline styles
                questionArea.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; position: relative !important;';
                console.log('[createThinkingPanel] Made question area visible');
                console.log('[createThinkingPanel] Made question area visible:', questionArea);
            }
        }
        
        // Apply inline styles to ensure visibility on both desktop and mobile - IDENTICAL STYLING
        const inlineStyles = isVideoEnabled ? 
            'style="display: block !important; visibility: visible !important; background: rgba(0,0,0,0.8) !important; border-radius: 8px !important; padding: 0.75rem !important; color: white !important; position: relative !important; z-index: 1000 !important; width: 100% !important; box-sizing: border-box !important;"' : '';
        
        targetDisplay.innerHTML = `
            <div id="thinkingTraceDisplay" class="thinking-inline minimized" ${inlineStyles}>
                <div class="thinking-trace-minimized-content" onclick="expandThinkingPanel()" style="display: flex !important; align-items: center !important; justify-content: space-between !important; cursor: pointer !important; color: white !important;">
                    <div class="thinking-progress-container" style="flex: 1 !important; margin-right: 1rem !important;">
                        <span>Interviewer is thinking</span>
                        <div class="thinking-progress-bar" style="background-color: rgba(255, 255, 255, 0.2) !important; height: 4px !important; border-radius: 2px !important; margin-top: 0.5rem !important;">
                            <div id="thinkingProgressFill" class="thinking-progress-fill" style="background-color: #3b82f6 !important; height: 100% !important; border-radius: 2px !important;"></div>
                        </div>
                    </div>
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="transform: rotate(90deg);">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                </div>
                <div class="thinking-trace-header" style="display: none;">
                    <span>Interviewer Thinking</span>
                    <div class="thinking-trace-actions">
                        <button class="thinking-trace-minimize" onclick="minimizeThinkingPanel()" title="Minimize">−</button>
                    </div>
                </div>
                <div class="thinking-trace-content" style="display: none;">
                    <div id="thinkingContent" class="thinking-stream"></div>
                </div>
            </div>
        `;
        console.log('[createThinkingPanel] Thinking panel HTML inserted');
        
        // Verify the panel was actually created
        const verifyPanel = document.getElementById('thinkingTraceDisplay');
        console.log('[createThinkingPanel] Verification:', {
            panelExists: !!verifyPanel,
            panelDisplay: verifyPanel ? window.getComputedStyle(verifyPanel).display : 'null',
            parentId: targetDisplay.parentElement ? targetDisplay.parentElement.id : 'null',
            parentDisplay: targetDisplay.parentElement ? window.getComputedStyle(targetDisplay.parentElement).display : 'null'
        });
    } else {
        console.error('[createThinkingPanel] Target display not found!');
    }
}

// Expand thinking panel
window.expandThinkingPanel = function() {
    const panel = document.getElementById('thinkingTraceDisplay');
    if (panel) {
        panel.classList.remove('minimized');
        panel.classList.add('expanded');
        
        // Show expanded content
        const header = panel.querySelector('.thinking-trace-header');
        const content = panel.querySelector('.thinking-trace-content');
        const minimizedContent = panel.querySelector('.thinking-trace-minimized-content');
        
        if (header) header.style.display = 'flex';
        if (content) content.style.display = 'block';
        if (minimizedContent) minimizedContent.style.display = 'none';
    }
};

// Minimize thinking panel
window.minimizeThinkingPanel = function() {
    const panel = document.getElementById('thinkingTraceDisplay');
    if (panel) {
        panel.classList.remove('expanded');
        panel.classList.add('minimized');
        
        // Show minimized content
        const header = panel.querySelector('.thinking-trace-header');
        const content = panel.querySelector('.thinking-trace-content');
        const minimizedContent = panel.querySelector('.thinking-trace-minimized-content');
        
        if (header) header.style.display = 'none';
        if (content) content.style.display = 'none';
        if (minimizedContent) minimizedContent.style.display = 'flex';
    }
};

// Hide thinking panel
function hideThinkingPanel() {
    // Panel will be cleared when question is displayed
    const panel = document.getElementById('thinkingTraceDisplay');
    const isVideoEnabled = document.body.classList.contains('video-enabled');
    const targetDisplay = isVideoEnabled ? elements.currentQuestionDisplayVideo : elements.currentQuestionDisplay;
    
    if (panel && panel.parentElement === targetDisplay) {
        targetDisplay.innerHTML = '';
    }
}

// Handle thinking updates
export function handleThinkingUpdate(thinkingChunk) {
    // Store thinking content for this message
    state.ui.currentThinkingTrace += thinkingChunk;

    // Client-side logging for debugging web search messages
    if (thinkingChunk.includes('[Say is searching the web for:')) {
        console.log('Received web search thinkingChunk:', thinkingChunk);
    }

    
    // Stream text to the thinking panel
    const thinkingContent = document.getElementById('thinkingContent');
    if (thinkingContent) {
        // Append the new chunk
        thinkingContent.textContent += thinkingChunk;
        
        // Auto-scroll to bottom
        const contentContainer = thinkingContent.parentElement;
        if (contentContainer) {
            contentContainer.scrollTop = contentContainer.scrollHeight;
        }
    }
    
    // Update progress bar based on running average
    const progressFill = document.getElementById('thinkingProgressFill');
    if (progressFill) {
        // Use the running average as the expected maximum
        const currentChars = state.ui.currentThinkingTrace.length;
        const expectedMax = state.ui.averageThinkingChars || 4096; // Default to 4096 if no average
        const progressPercent = Math.min((currentChars / expectedMax) * 100, 100);
        progressFill.style.width = `${progressPercent}%`;
        
        // Keep consistent blue color
        progressFill.style.backgroundColor = '#3b82f6';
        
        // Log for debugging
        console.log(`[Thinking Progress] Current: ${currentChars} chars, Expected max: ${expectedMax} chars, Progress: ${progressPercent.toFixed(1)}%`);
    }
    
    // Show info message when thinking trace appears for the first question
    if (state.ui.questionCount === 0 && state.ui.currentThinkingTrace.length > 0 && elements.interviewInfoMessage) {
        elements.interviewInfoMessage.classList.remove('hidden');
        elements.interviewInfoMessage.classList.add('animate-fade-in');
    }
}

// Handle response complete
export function handleResponseComplete(completeResponse) {
    if (state.timing.questionStartTime) {
        const questionGenerationDuration = Date.now() - state.timing.questionStartTime;
        console.log(`⏱️ CLIENT TIMING - Question generation completed in ${questionGenerationDuration}ms`);
    }
    console.log('Response complete received:', completeResponse);
    
    // Clear thinking timeout
    if (state.ui.thinkingTimeout) {
        clearTimeout(state.ui.thinkingTimeout);
        state.ui.thinkingTimeout = null;
        console.log('Cleared thinking timeout - question generation completed successfully');
    }
    
    // Check if this is just a completion signal for streamed response
    if (completeResponse === '' && state.ui.currentStreamedResponse) {
        // This is just a signal that streaming is complete
        console.log('Streaming completion signal received');
    } else if (!completeResponse || typeof completeResponse !== 'string') {
        // Only error if we didn't stream anything
        if (!state.ui.currentStreamedResponse) {
            console.error('Invalid or empty response received:', completeResponse);
            enableInput();
            clearError();
            updateRecordingStatus('Failed to generate question. Please try again.');
            return;
        }
    }
    
    // Handle non-streamed responses
    if (!state.ui.currentStreamedResponse && completeResponse) {
        // Use complete response as question (no tags expected)
        let questionText = completeResponse.trim();
        
        console.log('Response complete, question text:', questionText);
        
        // Validate extracted question
        if (!questionText || questionText.length === 0) {
            console.error('Empty question after extraction. Raw response was:', completeResponse);
            handleQuestionGenerationFailure();
            return;
        }
        
        // Display the non-streamed response immediately
        const isVideoEnabled = document.body.classList.contains('video-enabled');
        const targetDisplay = isVideoEnabled ? elements.currentQuestionDisplayVideo : elements.currentQuestionDisplay;
        console.log('[Question Display] Video enabled:', isVideoEnabled, 'Target display:', targetDisplay, 'Question text:', questionText);
        if (targetDisplay && questionText) {
            targetDisplay.innerHTML = '<span class="streaming-text"></span>';
            const textSpan = targetDisplay.querySelector('.streaming-text');
            
            // Display all text at once
            textSpan.textContent = questionText;
            state.ui.isStreamingResponse = false;
            
            // Scroll to top after displaying the question
            targetDisplay.scrollTop = 0;
            const questionArea = isVideoEnabled ? 
                document.getElementById('currentQuestionAreaVideo') : 
                document.getElementById('currentQuestionArea');
            if (questionArea) {
                questionArea.scrollTop = 0;
            }
            
            // Ensure record button is enabled immediately
            if (elements.recordBtn && !state.ui.thinking) {
                elements.recordBtn.disabled = false;
                console.log('Question displayed - record button enabled');
            }
        }
    } else {
        // For streamed responses, wait a bit before removing cursor
        console.log('Streamed response complete');
        
        // Flush any remaining TTS buffer
        if (config.features.enableTTS && streamingTTS.isAvailable()) {
            streamingTTS.flush();
        }
        
        setTimeout(() => {
            state.ui.isStreamingResponse = false;
            const isVideoEnabled = document.body.classList.contains('video-enabled');
            const targetDisplay = isVideoEnabled ? elements.currentQuestionDisplayVideo : elements.currentQuestionDisplay;
            if (targetDisplay) {
                const cursor = targetDisplay.querySelector('.streaming-cursor');
                if (cursor) cursor.remove();
                
                // Scroll the question display to the top
                targetDisplay.scrollTop = 0;
                
                // Also scroll the parent container if needed
                const questionArea = isVideoEnabled ? 
                    document.getElementById('currentQuestionAreaVideo') : 
                    document.getElementById('currentQuestionArea');
                if (questionArea) {
                    questionArea.scrollTop = 0;
                }
            }
            
            // Ensure record button is enabled after streaming completes
            if (elements.recordBtn && !state.ui.thinking) {
                elements.recordBtn.disabled = false;
                console.log('Streaming complete - record button enabled');
            }
        }, 500);
    }

    // Audio streaming removed - TTS no longer supported
    
    // Update thinking history and calculate new average
    if (state.ui.currentThinkingTrace.length > 0) {
        // Add this thinking session's character count to history
        state.ui.thinkingCharacterHistory.push(state.ui.currentThinkingTrace.length);
        
        // Calculate new average (weighted towards recent sessions)
        if (state.ui.thinkingCharacterHistory.length === 1) {
            // First question - use actual usage for next time
            state.ui.averageThinkingChars = state.ui.currentThinkingTrace.length;
        } else {
            // Calculate weighted average - give more weight to recent sessions
            const recentSessions = state.ui.thinkingCharacterHistory.slice(-5); // Last 5 sessions
            const totalChars = recentSessions.reduce((sum, chars) => sum + chars, 0);
            state.ui.averageThinkingChars = Math.round(totalChars / recentSessions.length);
        }
        
        console.log(`[Thinking Stats] Session ${state.ui.questionCount + 1}: ${state.ui.currentThinkingTrace.length} chars`);
        console.log(`[Thinking Stats] New average: ${state.ui.averageThinkingChars} chars (based on last ${Math.min(state.ui.thinkingCharacterHistory.length, 5)} sessions)`);
    }
    
    // Reset thinking flag and update counts
    state.ui.thinking = false;
    state.ui.currentThinkingTrace = ''; // Clear thinking trace
    state.ui.questionCount++;
    state.recording.currentAnswerDuration = 0;
    updateQuestionCounter();

    // Clear any thinking animation
    if (window.thinkingAnimInterval) {
        clearInterval(window.thinkingAnimInterval);
        window.thinkingAnimInterval = null;
    }

    // Clear streaming state
    state.ui.currentStreamedResponse = '';

    // Always hide info message when a question appears
    if (elements.interviewInfoMessage) {
        elements.interviewInfoMessage.classList.add('hidden');
    }

    // Remove thinking-active class from body
    document.body.classList.remove('thinking-active');
    
    // Hide thinking panel
    hideThinkingPanel();

    // Update button back to Record state
    if (elements.recordBtn) {
        elements.recordBtn.classList.remove('thinking');
        elements.recordBtn.disabled = false; // Explicitly enable the button here
        elements.recordBtn.title = 'Start Recording (or press Enter)';
        elements.recordBtn.style.visibility = 'visible'; // Restore visibility
        
        // Hide thinking ellipses inside the button
        const buttonEllipses = elements.recordBtn.querySelector('.thinking-ellipses');
        if (buttonEllipses) {
            buttonEllipses.classList.add('hidden');
        }
        
        // Restore original button HTML structure
        const recordBtnInner = elements.recordBtn.querySelector('.record-btn-inner');
        if (recordBtnInner) {
            recordBtnInner.innerHTML = `
                <!-- Microphone Icon -->
                <svg class="mic-icon" width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                </svg>
                <!-- Stop Icon (hidden initially) -->
                <svg class="stop-icon hidden" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2"></rect>
                </svg>
                <!-- Thinking Ellipses (hidden initially) -->
                <div class="thinking-ellipses hidden">
                    <span class="ellipse-dot"></span>
                    <span class="ellipse-dot"></span>
                    <span class="ellipse-dot"></span>
                </div>
            `;
        }
    }

    // Restore keyboard hint
    const keyboardHint = document.querySelector('.keyboard-hints .hint-item');
    if (keyboardHint) {
        keyboardHint.innerHTML = '<kbd>Enter</kbd> to record';
    }

    // Enable input and reset button/status
    // Use a small timeout to ensure state is properly updated
    setTimeout(() => {
        resetRecordingState();
        clearError();
    }, 10);
}

// Stream question text in real-time
export function streamQuestion(chunk) {
    if (!state.ui.isStreamingResponse) return;
    
    // Display chunks directly (no tags expected)
    state.ui.currentStreamedResponse += chunk;
    
    // Update the displayed content immediately
    const isVideoEnabled = document.body.classList.contains('video-enabled');
    const targetDisplay = isVideoEnabled ? elements.currentQuestionDisplayVideo : elements.currentQuestionDisplay;
    console.log('[Stream Question] Video enabled:', isVideoEnabled, 'Target display:', targetDisplay, 'Chunk:', chunk);
    if (targetDisplay && chunk) {
        // Add new content immediately
        const textSpan = targetDisplay.querySelector('.streaming-text') || 
                       (() => {
                           const span = document.createElement('span');
                           span.className = 'streaming-text';
                           targetDisplay.insertBefore(span, targetDisplay.querySelector('.streaming-cursor'));
                           return span;
                       })();
        
        // Add the chunk directly
        textSpan.textContent += chunk;

    }
    
    // Send chunk to TTS if enabled
    if (config.features.enableTTS && streamingTTS.isAvailable()) {
        streamingTTS.addChunk(chunk);

    }
}

// Functions are now properly imported from their respective modules 