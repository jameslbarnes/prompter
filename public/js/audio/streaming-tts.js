// Streaming TTS module - handles text-to-speech with chunk encoding for seamless playback
// Based on: https://medium.com/@pshanarat/tts-text-to-speech-streaming-with-chunk-encoding-a-technique-used-by-openai-4852458f7270
import { config } from '../config.js';
import { state } from '../state.js';

class StreamingTTS {
    constructor() {
        this.enabled = false;
        this.buffer = '';
        this.bufferTimeout = null;
        this.minChunkSize = 30; // Minimum characters before speaking
        this.bufferDelay = 300; // ms to wait for more text
        this.audioContext = null;
        this.isProcessing = false;
        
        // SSE streaming
        this.eventSource = null;
        this.audioChunks = [];
        this.audioBufferQueue = [];
        this.isPlaying = false;
        this.nextStartTime = 0;
        this.scheduledSources = [];
        
        // Voice settings
        this.voice = 'nova'; // OpenAI voice options: alloy, echo, fable, onyx, nova, shimmer
        this.speed = 1.1;
        
        // Initialize audio context
        this.initializeAudioContext();
    }
    
    initializeAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error('StreamingTTS: Failed to create AudioContext:', e);
        }
    }
    
    enable() {
        this.enabled = true;
        // Resume audio context if suspended
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        console.log('StreamingTTS: Enabled');
    }
    
    disable() {
        this.enabled = false;
        this.stop();
        console.log('StreamingTTS: Disabled');
    }
    
    toggle() {
        if (this.enabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.enabled;
    }
    
    // Add text chunk to be spoken
    addChunk(text) {
        if (!this.enabled || !text.trim()) return;
        
        // Add to buffer
        this.buffer += text;
        
        // Clear existing timeout
        if (this.bufferTimeout) {
            clearTimeout(this.bufferTimeout);
        }
        
        // Check if we should speak now
        if (this.shouldSpeakNow()) {
            this.speakBuffer();
        } else {
            // Wait for more text or timeout
            this.bufferTimeout = setTimeout(() => {
                this.speakBuffer();
            }, this.bufferDelay);
        }
    }
    
    shouldSpeakNow() {
        // Speak if we have a sentence boundary
        const sentenceEnders = ['.', '!', '?', ':', ';'];
        const lastChar = this.buffer.trim().slice(-1);
        if (sentenceEnders.includes(lastChar)) {
            return true;
        }
        
        // Speak if we have a natural pause (comma, dash) and enough text
        const pauseChars = [',', '-', '\n'];
        if (pauseChars.includes(lastChar) && this.buffer.length > this.minChunkSize) {
            return true;
        }
        
        // Speak if buffer is getting long
        return this.buffer.length > 80;
    }
    
    async speakBuffer() {
        if (!this.buffer.trim()) return;
        
        const textToSpeak = this.buffer.trim();
        this.buffer = '';
        
        // Clear timeout
        if (this.bufferTimeout) {
            clearTimeout(this.bufferTimeout);
            this.bufferTimeout = null;
        }
        
        // Stream audio using SSE
        await this.streamAudioSSE(textToSpeak);
    }
    
    async streamAudioSSE(text) {
        if (!this.enabled || this.eventSource) return;
        
        this.isProcessing = true;
        this.audioChunks = [];
        this.audioBufferQueue = [];
        
        // Close existing connection if any
        this.closeSSE();
        
        // Create SSE connection with properly encoded parameters
        const params = new URLSearchParams({
            text: text,
            voice: this.voice,
            speed: this.speed.toString()
        });
        this.eventSource = new EventSource('/api/tts/stream?' + params.toString());
        
        this.eventSource.addEventListener('connected', (event) => {
            console.log('StreamingTTS: SSE connected');
        });
        
        this.eventSource.addEventListener('audioChunk', async (event) => {
            const data = JSON.parse(event.data);
            await this.handleAudioChunk(data);
        });
        
        this.eventSource.addEventListener('complete', (event) => {
            console.log('StreamingTTS: Stream complete');
            this.closeSSE();
            this.isProcessing = false;
        });
        
        this.eventSource.addEventListener('error', (event) => {
            console.error('StreamingTTS: SSE error', event);
            this.closeSSE();
            this.isProcessing = false;
        });
    }
    
    async handleAudioChunk(data) {
        const { chunk, index, isLast } = data;
        
        // Decode base64 chunk
        const binaryString = atob(chunk);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Store chunk
        this.audioChunks[index] = bytes;
        
        // If we have enough chunks, start decoding and playing
        if (this.audioChunks.length >= 2 || isLast) {
            await this.processAudioChunks();
        }
    }
    
    async processAudioChunks() {
        // Combine available chunks
        const chunks = this.audioChunks.filter(chunk => chunk !== undefined);
        if (chunks.length === 0) return;
        
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combinedArray = new Uint8Array(totalLength);
        
        let offset = 0;
        for (const chunk of chunks) {
            combinedArray.set(chunk, offset);
            offset += chunk.length;
        }
        
        // Clear processed chunks
        this.audioChunks = [];
        
        try {
            // Decode audio data
            const audioBuffer = await this.audioContext.decodeAudioData(combinedArray.buffer);
            
            // Schedule seamless playback
            this.scheduleAudioPlayback(audioBuffer);
            
        } catch (error) {
            console.error('StreamingTTS: Error decoding audio chunk:', error);
        }
    }
    
    scheduleAudioPlayback(audioBuffer) {
        if (!this.audioContext) return;
        
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        
        // Calculate when to start this chunk
        const currentTime = this.audioContext.currentTime;
        const startTime = Math.max(currentTime, this.nextStartTime);
        
        // Schedule playback
        source.start(startTime);
        
        // Update next start time for seamless playback
        this.nextStartTime = startTime + audioBuffer.duration;
        
        // Track scheduled sources
        this.scheduledSources.push(source);
        
        // Clean up when done
        source.onended = () => {
            const index = this.scheduledSources.indexOf(source);
            if (index > -1) {
                this.scheduledSources.splice(index, 1);
            }
            
            // Reset if all done
            if (this.scheduledSources.length === 0) {
                this.nextStartTime = 0;
                this.isPlaying = false;
            }
        };
        
        this.isPlaying = true;
    }
    
    // Force speak any remaining buffer
    flush() {
        if (this.buffer.trim()) {
            this.speakBuffer();
        }
    }
    
    // Stop all speech
    stop() {
        // Clear buffer
        this.buffer = '';
        this.isProcessing = false;
        this.isPlaying = false;
        
        if (this.bufferTimeout) {
            clearTimeout(this.bufferTimeout);
            this.bufferTimeout = null;
        }
        
        // Close SSE connection
        this.closeSSE();
        
        // Stop all scheduled audio
        for (const source of this.scheduledSources) {
            try {
                source.stop();
            } catch (e) {
                // Already stopped
            }
        }
        this.scheduledSources = [];
        this.nextStartTime = 0;
        this.audioChunks = [];
        this.audioBufferQueue = [];
    }
    
    closeSSE() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }
    
    // Check if TTS is available
    isAvailable() {
        return !!(window.AudioContext || window.webkitAudioContext);
    }
    
    // Get current state
    getState() {
        return {
            enabled: this.enabled,
            speaking: this.isPlaying,
            bufferLength: this.buffer.length,
            available: this.isAvailable(),
            isProcessing: this.isProcessing,
            scheduledSources: this.scheduledSources.length
        };
    }
}

// Create singleton instance
export const streamingTTS = new StreamingTTS();

// Export for debugging
window.streamingTTS = streamingTTS;