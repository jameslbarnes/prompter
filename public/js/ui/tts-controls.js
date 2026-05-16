// TTS UI Controls module
import { config } from '../config.js';
import { streamingTTS } from '../audio/streaming-tts.js';

export function initializeTTSControls() {
    const ttsToggle = document.getElementById('ttsToggleSwitch');
    const ttsSpeakingIndicator = document.getElementById('ttsSpeakingIndicator');
    const ttsContainer = document.querySelector('.tts-toggle-container');
    
    if (!ttsToggle || !streamingTTS.isAvailable()) {
        // Hide TTS controls if not available
        if (ttsContainer) {
            ttsContainer.classList.add('hidden');
        }
        return;
    }
    
    // Load saved preference from localStorage
    const savedTTSState = localStorage.getItem('ttsEnabled');
    if (savedTTSState !== null) {
        const enabled = savedTTSState === 'true';
        config.features.enableTTS = enabled;
        if (enabled) {
            ttsToggle.classList.add('active');
            streamingTTS.enable();
        }
    }
    
    // Handle toggle clicks
    ttsToggle.addEventListener('click', () => {
        const newState = streamingTTS.toggle();
        config.features.enableTTS = newState;
        
        // Update UI
        if (newState) {
            ttsToggle.classList.add('active');
        } else {
            ttsToggle.classList.remove('active');
        }
        
        // Save preference
        localStorage.setItem('ttsEnabled', newState.toString());
        
        console.log('TTS toggled:', newState ? 'enabled' : 'disabled');
    });
    
    // Handle label clicks
    const label = ttsContainer.querySelector('.tts-toggle-label');
    if (label) {
        label.addEventListener('click', () => {
            ttsToggle.click();
        });
    }
    
    // Update speaking indicator
    setInterval(() => {
        const ttsState = streamingTTS.getState();
        if (ttsState.speaking && ttsSpeakingIndicator) {
            ttsSpeakingIndicator.classList.add('active');
        } else if (ttsSpeakingIndicator) {
            ttsSpeakingIndicator.classList.remove('active');
        }
    }, 100);
    
    // Handle visibility based on question display
    const observer = new MutationObserver(() => {
        const questionDisplay = document.getElementById('currentQuestionDisplay');
        const hasQuestion = questionDisplay && questionDisplay.textContent.trim().length > 0;
        const isThinking = document.body.classList.contains('thinking-active');
        
        // Show TTS controls when there's a question and not thinking
        if (hasQuestion && !isThinking) {
            ttsContainer.classList.remove('hidden');
        } else {
            ttsContainer.classList.add('hidden');
        }
    });
    
    // Observe changes to question display and body class
    const questionDisplay = document.getElementById('currentQuestionDisplay');
    if (questionDisplay) {
        observer.observe(questionDisplay, { childList: true, subtree: true, characterData: true });
    }
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    
    // Initially hide until question appears
    ttsContainer.classList.add('hidden');
}

// Export for use in main.js
export { streamingTTS };