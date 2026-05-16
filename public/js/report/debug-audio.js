// Debug Audio Utilities
import { reportState } from './report-state.js';
import { playOnGlobalPlayer } from './audio-manager.js';

// DEBUG: Test function for troubleshooting transcript audio issues
export function debugTranscriptAudio() {
    console.log('=== TRANSCRIPT AUDIO DEBUG ===');
    
    // Check if global audio player exists
    const globalPlayer = document.getElementById('globalAudioPlayerElement');
    console.log('Global audio player element:', globalPlayer);
    
    // Check for transcript buttons
    const transcriptButtons = document.querySelectorAll('.play-transcript-audio-btn');
    console.log('Number of transcript audio buttons found:', transcriptButtons.length);
    
    transcriptButtons.forEach((btn, index) => {
        const audioUrl = btn.getAttribute('data-audio-url');
        const trackTitle = btn.getAttribute('data-track-title');
        console.log(`Button ${index + 1}:`, {
            button: btn,
            audioUrl: audioUrl ? audioUrl.substring(0, 80) + '...' : 'none',
            trackTitle: trackTitle,
            isVisible: btn.offsetParent !== null
        });
    });
    
    // Check current report state
    console.log('Current report ID:', reportState?.currentReportId);
    
    // Test clicking the first button if available
    if (transcriptButtons.length > 0) {
        console.log('Testing click on first button...');
        const firstButton = transcriptButtons[0];
        const audioUrl = firstButton.getAttribute('data-audio-url');
        if (audioUrl) {
            console.log('Attempting to play audio:', audioUrl);
            playOnGlobalPlayer(audioUrl, 'Test Audio', 'Debug Test', firstButton)
                .then(() => console.log('Audio play test successful'))
                .catch(error => console.error('Audio play test failed:', error));
        } else {
            console.log('First button has no audio URL');
        }
    }
    
    console.log('=== END DEBUG ===');
}

// Make debug function globally available
window.debugTranscriptAudio = debugTranscriptAudio;

// Log instructions for users
console.log('💡 TRANSCRIPT AUDIO DEBUG: Run debugTranscriptAudio() in console to troubleshoot audio issues');