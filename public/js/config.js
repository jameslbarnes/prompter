// Configuration module - contains all constants and initial settings
export const config = {
    // Socket configuration
    socket: {
        url: (() => {
            // For localhost development
            if (window.location.hostname === 'localhost') {
                // Use the current port from window.location
                return `http://localhost:${window.location.port || '3001'}`;
            }
            
            // Check if we're in an iframe
            const isInIframe = window.self !== window.top;
            
            // If in iframe, try to use the parent's origin or fall back to current origin
            let origin = window.location.origin;
            if (isInIframe) {
                try {
                    // Try to get parent origin (may fail due to same-origin policy)
                    origin = window.parent.location.origin;
                } catch (e) {
                    // If cross-origin, use the current origin
                    console.log('Cross-origin iframe detected, using current origin for socket');
                }
            }
            
            // Convert HTTPS to WSS for production WebSocket connections
            return origin.replace('https://', 'wss://').replace('http://', 'ws://');
        })(),
        options: {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            // Add path to ensure correct socket.io endpoint
            path: '/socket.io/'
        },
        maxRetries: 3
    },
    
    // Recording configuration
    recording: {
        initialTargetDurationSeconds: 300, // 5 minutes
        maxRecordingDurationSeconds: 1200, // 20 minutes auto-stop
        audioBitsPerSecond: 128000,
        chunkInterval: 1000 // Collect data every second
    },
    
    // UI configuration
    ui: {
        progressUpdateInterval: 100, // Smooth progress bar updates
        typewriterDelaySpace: 15,
        typewriterDelayChar: 30,
        typewriterDelayPunctuation: 100
    },
    
    // Feature flags
    features: {
        enableTTS: false,
        defaultRequiresDocument: true,
        enableTorusKnotViz: false // Toggle for torus knot visualization
    },
    
    // Torus Knot Visualization configuration (deprecated - replaced with thinking panel)
    torusKnotViz: {
        enabled: false, // Disabled - using thinking panel instead
        
        // Knot parameters
        knotP: 1, // First parameter of torus knot (affects shape)
        knotQ: 1, // Second parameter of torus knot (affects shape)
        knotRadius: 2.6, // Base radius of the knot (increased by 30%)
        
        // Text streaming
        charsPerSecond: 20, // Speed of character streaming
        maxVisibleChars: 150, // Maximum characters visible at once
        letterSpacing: 0.4, // Spacing between characters on the curve
        
        // Visual appearance
        knotOpacity: 0.15, // Opacity of the torus knot mesh
        textColorRange: {
            min: 20, // Darkest grey value
            max: 160 // Lightest grey value
        },
        maxTextOpacity: 0.9, // Maximum opacity for text characters
        
        // Animation
        rotationSpeedY: 0.001, // Y-axis rotation speed
        rotationAmplitudeX: 0.05, // X-axis rotation amplitude
        textFlowSpeed: 0.02, // Speed of text flowing along curve
        
        // Lighting
        ambientLightIntensity: 0.8,
        directionalLightIntensity: 0.6
    },
    
    // Session storage keys
    storage: {
        sessionIdKey: 'pairrSessionId',
        archiveSessionIdKey: 'archiveSessionId'
    }
};

// Helper function to get the dynamic session storage key
export function getSessionStorageKey(interviewId) {
    const baseKey = config.storage.sessionIdKey;
    if (interviewId && interviewId.trim() !== '') {
        return `${baseKey}_${interviewId}`;
    }
    return `${baseKey}_default`;
}

// MIME types for audio recording
export const audioMimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4', 
    'audio/aac',
    'audio/mpeg',
    'audio/ogg;codecs=opus'
]; 