// Keyboard module - handles keyboard shortcuts and event handling
import { state } from '../state.js';
import { elements } from '../dom.js';

// Initialize keyboard event handlers
export function initializeKeyboardHandlers() {
    // Add iframe-specific Enter key prevention early with capture phase
    if (window.self !== window.top) {
        console.log('Detected iframe context - adding early Enter key prevention');
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                const activeElement = document.activeElement;
                const isTypingInInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
                if (!isTypingInInput) {
                    event.preventDefault();
                    event.stopPropagation();
                    console.log('Early iframe Enter key prevention triggered');
                }
            }
        }, true); // Use capture phase to catch event early
    }
    
    document.addEventListener('keydown', handleGlobalKeydown);
    
    // Add modal-specific keyboard handling
    document.addEventListener('keydown', handleModalKeydown);
}

// Handle global keyboard events
function handleGlobalKeydown(event) {
    // Handle Enter key for recording
    if (event.key === 'Enter') {
        // Check if user is not typing in an input field
        const activeElement = document.activeElement;
        const isTypingInInput = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
        
        // Check if we're in an iframe - always prevent default to avoid page reload
        const isInIframe = window.self !== window.top;
        
        // ALWAYS prevent default in iframe to avoid page reload, regardless of other conditions
        if (isInIframe && !isTypingInInput) {
            event.preventDefault();
            event.stopPropagation();
            console.log('Enter key in iframe - preventing default to avoid page reload');
        }
        
        // Check if we're on the file upload screen
        const isFileUploadVisible = elements.fileUploadArea && !elements.fileUploadArea.classList.contains('hidden');
        const isStartButtonEnabled = elements.startChatBtn && !elements.startChatBtn.disabled;
        
        // If on file upload screen and start button is enabled, trigger it
        if (isFileUploadVisible && isStartButtonEnabled && !isTypingInInput) {
            event.preventDefault();
            console.log('Enter key pressed on file upload screen, triggering start interview button.');
            elements.startChatBtn.click();
            return;
        }
        
        // Otherwise, check for recording button in interview interface
        const isInterviewVisible = elements.interviewInterface && !elements.interviewInterface.classList.contains('hidden');
        const isModalVisible = elements.modalThinkingTrace && !elements.modalThinkingTrace.classList.contains('hidden');
        const isQuestionStreaming = state.ui.isStreamingResponse || state.ui.typewriterTimeout;
        
        // Check if we have a question displayed (not the initial "Waiting for the first question..." message)
        const hasQuestion = elements.currentQuestionDisplay && 
                          !elements.currentQuestionDisplay.innerHTML.includes('Waiting for the first question');
        
        const canTrigger = elements.recordBtn && 
                          !elements.recordBtn.disabled && 
                          isInterviewVisible && 
                          !isModalVisible && 
                          !state.ui.thinking && 
                          !isQuestionStreaming &&
                          hasQuestion;

        // Debug logging
        if (isInterviewVisible || isInIframe) {
            console.log('Enter key debug:', {
                isInterviewVisible,
                isInIframe,
                recordBtnExists: !!elements.recordBtn,
                recordBtnDisabled: elements.recordBtn?.disabled,
                isModalVisible,
                isThinking: state.ui.thinking,
                isQuestionStreaming,
                hasQuestion,
                canTrigger,
                questionCount: state.ui.questionCount,
                currentQuestion: elements.currentQuestionDisplay?.textContent?.substring(0, 50),
                activeElement: document.activeElement?.tagName,
                activeElementId: document.activeElement?.id,
                videoEnabled: state.video?.isEnabled
            });
        }

        // Always prevent default when in iframe or interview is visible (unless typing in input)
        if (!isTypingInInput && (isInIframe || isInterviewVisible)) {
            event.preventDefault();
            
            if (canTrigger) {
                console.log('Enter key pressed, triggering record/submit button.');
                elements.recordBtn.click();
            } else {
                console.log('Enter key pressed, but conditions not met for recording. Default prevented.');
                
                // Provide more specific feedback about why recording can't start
                if (elements.recordBtn?.disabled) {
                    console.log('Record button is disabled');
                } else if (state.ui.thinking) {
                    console.log('AI is still thinking');
                } else if (isQuestionStreaming) {
                    console.log('Question is still being displayed');
                } else if (!hasQuestion) {
                    console.log('No question has been displayed yet');
                }
            }
        }
    }

    // Handle Space key for pause/resume
    if (event.code === 'Space') {
        const isInterviewVisible = elements.interviewInterface && !elements.interviewInterface.classList.contains('hidden');
        const isModalVisible = elements.modalThinkingTrace && !elements.modalThinkingTrace.classList.contains('hidden');
        const canPause = elements.pauseBtn && !elements.pauseBtn.disabled && isInterviewVisible && !isModalVisible && state.recording.isRecording && !state.ui.thinking;

        if (canPause) {
            event.preventDefault();
            console.log('Space key pressed, toggling pause/resume.');
            elements.pauseBtn.click();
        }
    }
}

// Handle modal-specific keyboard events
function handleModalKeydown(event) {
    // Handle Escape key for closing modals
    if (event.key === 'Escape') {
        if (elements.modalThinkingTrace && !elements.modalThinkingTrace.classList.contains('hidden')) {
            event.preventDefault();
            hideThinkingModal();
        }
    }
}

// Helper function to hide thinking modal
function hideThinkingModal() {
    if (window.hideThinkingModal) {
        window.hideThinkingModal();
    } else if (elements.modalThinkingTrace) {
        elements.modalThinkingTrace.classList.add('hidden');
    }
}

// Add keyboard shortcut for theme toggle (Ctrl/Cmd + Shift + T)
function handleThemeToggleShortcut(event) {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'T') {
        event.preventDefault();
        if (elements.themeToggle) {
            elements.themeToggle.click();
        }
    }
}

// Add the theme toggle shortcut to global keydown handler
document.addEventListener('keydown', handleThemeToggleShortcut);

// Export keyboard utilities
export const keyboardUtils = {
    // Check if a key combination is pressed
    isKeyCombo: (event, keys) => {
        const modifiers = {
            ctrl: event.ctrlKey,
            cmd: event.metaKey,
            shift: event.shiftKey,
            alt: event.altKey
        };
        
        return keys.every(key => {
            if (key in modifiers) {
                return modifiers[key];
            }
            return event.key === key || event.code === key;
        });
    },
    
    // Prevent default behavior for specific keys
    preventDefaults: (event, keys) => {
        if (keys.includes(event.key) || keys.includes(event.code)) {
            event.preventDefault();
            return true;
        }
        return false;
    }
}; 