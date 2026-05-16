// Audio streaming module - handles Media Source Extensions for audio playback
import { state } from '../state.js';
import { elements } from '../dom.js';
import { config } from '../config.js';

// Initialize Media Source Extensions for audio streaming
export function initializeMediaSource() {
    if (!elements.audioPlayer) {
        console.warn('Audio player element not found');
        return;
    }

    if (!window.MediaSource) {
        console.warn('MediaSource API not supported');
        return;
    }

    try {
        state.audio.mediaSource = new MediaSource();
        elements.audioPlayer.src = URL.createObjectURL(state.audio.mediaSource);
        
        state.audio.mediaSource.addEventListener('sourceopen', () => {
            console.log('MediaSource opened');
            try {
                // Use a common audio codec
                const mimeType = 'audio/webm; codecs="opus"';
                if (MediaSource.isTypeSupported(mimeType)) {
                    state.audio.sourceBuffer = state.audio.mediaSource.addSourceBuffer(mimeType);
                    state.audio.sourceBuffer.addEventListener('updateend', processAudioQueue);
                    console.log('SourceBuffer created with codec:', mimeType);
                } else {
                    console.warn('Codec not supported:', mimeType);
                    // Fallback to basic audio element
                    state.audio.mediaSource = null;
                }
            } catch (error) {
                console.error('Error setting up SourceBuffer:', error);
                state.audio.mediaSource = null;
            }
        });

        state.audio.mediaSource.addEventListener('sourceended', () => {
            console.log('MediaSource ended');
        });

        state.audio.mediaSource.addEventListener('error', (e) => {
            console.error('MediaSource error:', e);
        });

    } catch (error) {
        console.error('Error initializing MediaSource:', error);
        state.audio.mediaSource = null;
    }
}

// Process queued audio chunks
export function processAudioQueue() {
    if (!state.audio.sourceBuffer || state.audio.sourceBuffer.updating || state.audio.audioQueue.length === 0) {
        return;
    }

    try {
        const chunk = state.audio.audioQueue.shift();
        if (chunk && chunk.byteLength > 0) {
            state.audio.sourceBuffer.appendBuffer(chunk);
        }
    } catch (error) {
        console.error('Error appending audio buffer:', error);
        // Clear the queue on error to prevent infinite loop
        state.audio.audioQueue = [];
    }
}

// Add audio chunk to queue
export function queueAudioChunk(chunk) {
    if (!chunk || chunk.byteLength === 0) {
        return;
    }

    state.audio.audioQueue.push(chunk);
    processAudioQueue();
}

// Play audio using MediaSource or fallback
export function playAudio(audioData) {
    if (!elements.audioPlayer) {
        console.warn('Audio player not available');
        return;
    }

    try {
        if (state.audio.mediaSource && state.audio.sourceBuffer) {
            // Use MediaSource for streaming
            queueAudioChunk(audioData);
        } else {
            // Fallback to blob URL
            const blob = new Blob([audioData], { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(blob);
            elements.audioPlayer.src = audioUrl;
            elements.audioPlayer.play().catch(error => {
                console.error('Error playing audio:', error);
            });
            
            // Clean up blob URL after playing
            elements.audioPlayer.addEventListener('ended', () => {
                URL.revokeObjectURL(audioUrl);
            }, { once: true });
        }
    } catch (error) {
        console.error('Error playing audio:', error);
    }
}

// Stop audio playback
export function stopAudio() {
    if (elements.audioPlayer) {
        elements.audioPlayer.pause();
        elements.audioPlayer.currentTime = 0;
    }
    
    // Clear audio queue
    state.audio.audioQueue = [];
    
    // Reset MediaSource if needed
    if (state.audio.mediaSource && state.audio.mediaSource.readyState === 'open') {
        try {
            if (state.audio.sourceBuffer) {
                state.audio.sourceBuffer.abort();
            }
        } catch (error) {
            console.warn('Error aborting source buffer:', error);
        }
    }
}

// Clean up MediaSource resources
export function cleanupMediaSource() {
    stopAudio();
    
    if (state.audio.mediaSource) {
        try {
            if (state.audio.mediaSource.readyState === 'open') {
                state.audio.mediaSource.endOfStream();
            }
        } catch (error) {
            console.warn('Error ending MediaSource stream:', error);
        }
        
        state.audio.mediaSource = null;
        state.audio.sourceBuffer = null;
    }
    
    if (elements.audioPlayer && elements.audioPlayer.src) {
        URL.revokeObjectURL(elements.audioPlayer.src);
        elements.audioPlayer.src = '';
    }
}

// Check if MediaSource is supported
export function isMediaSourceSupported() {
    return !!(window.MediaSource && MediaSource.isTypeSupported('audio/webm; codecs="opus"'));
}

// Get audio playback state
export function getAudioState() {
    return {
        isPlaying: elements.audioPlayer && !elements.audioPlayer.paused,
        currentTime: elements.audioPlayer ? elements.audioPlayer.currentTime : 0,
        duration: elements.audioPlayer ? elements.audioPlayer.duration : 0,
        queueLength: state.audio.audioQueue.length,
        mediaSourceReady: !!(state.audio.mediaSource && state.audio.sourceBuffer)
    };
} 