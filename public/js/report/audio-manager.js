// Audio Manager for Report Page
let activeAudioTriggerButton = null;

// Format time function
export function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Global audio player functions
export function updateGlobalPlayPauseIcon(isPlaying) {
    const globalPlayIcon = document.getElementById('globalPlayIcon');
    const globalPauseIcon = document.getElementById('globalPauseIcon');
    
    if (isPlaying) {
        globalPlayIcon.classList.add('hidden');
        globalPauseIcon.classList.remove('hidden');
    } else {
        globalPlayIcon.classList.remove('hidden');
        globalPauseIcon.classList.add('hidden');
    }
}

export function updateTriggerButtonIcon(button, isPlaying) {
    if (!button) return;
    
    const playIcon = button.querySelector('.play-icon');
    const pauseIcon = button.querySelector('.pause-icon');
    
    if (isPlaying) {
        if (playIcon) playIcon.classList.add('hidden');
        if (pauseIcon) pauseIcon.classList.remove('hidden');
        button.classList.add('playing');
    } else {
        if (playIcon) playIcon.classList.remove('hidden');
        if (pauseIcon) pauseIcon.classList.add('hidden');
        button.classList.remove('playing');
    }
}

export async function playOnGlobalPlayer(audioSrc, title, artist, triggerButton) {
    const globalAudioPlayerElement = document.getElementById('globalAudioPlayerElement');
    const globalAudioPlayerContainer = document.getElementById('globalAudioPlayerContainer');
    const globalTrackTitle = document.getElementById('globalTrackTitle');
    const globalTrackArtist = document.getElementById('globalTrackArtist');
    
    if (!globalAudioPlayerElement) return;

    // Reset all trigger buttons
    if (activeAudioTriggerButton && activeAudioTriggerButton !== triggerButton) {
        updateTriggerButtonIcon(activeAudioTriggerButton, false);
    }

    // Set new active trigger button
    activeAudioTriggerButton = triggerButton;

    // Update global player
    globalAudioPlayerElement.src = audioSrc;
    if (globalTrackTitle) globalTrackTitle.textContent = title || 'Audio Track';
    if (globalTrackArtist) globalTrackArtist.textContent = artist || 'Report Audio';

    // Player will be shown automatically when audio starts playing
    try {
        await globalAudioPlayerElement.play();
        updateGlobalPlayPauseIcon(true);
        updateTriggerButtonIcon(triggerButton, true);
    } catch (error) {
        console.error('Error playing audio:', error);
        updateTriggerButtonIcon(triggerButton, false);
    }
}

// Initialize global audio player controls
export function initializeGlobalAudioPlayer() {
    const globalAudioPlayerElement = document.getElementById('globalAudioPlayerElement');
    const globalPlayPauseBtn = document.getElementById('globalPlayPauseBtn');
    const globalSeekBar = document.getElementById('globalSeekBar');
    const globalVolumeBar = document.getElementById('globalVolumeBar');
    const globalCurrentTime = document.getElementById('globalCurrentTime');
    const globalDuration = document.getElementById('globalDuration');

    if (globalPlayPauseBtn) {
        globalPlayPauseBtn.addEventListener('click', () => {
            if (globalAudioPlayerElement.paused) {
                globalAudioPlayerElement.play();
            } else {
                globalAudioPlayerElement.pause();
            }
        });
    }

    if (globalAudioPlayerElement) {
        globalAudioPlayerElement.addEventListener('play', () => {
            updateGlobalPlayPauseIcon(true);
            if (activeAudioTriggerButton) {
                updateTriggerButtonIcon(activeAudioTriggerButton, true);
            }
            // Show global player when audio starts playing
            const globalAudioPlayerContainer = document.getElementById('globalAudioPlayerContainer');
            if (globalAudioPlayerContainer) {
                globalAudioPlayerContainer.classList.add('visible');
            }
        });

        globalAudioPlayerElement.addEventListener('pause', () => {
            updateGlobalPlayPauseIcon(false);
            if (activeAudioTriggerButton) {
                updateTriggerButtonIcon(activeAudioTriggerButton, false);
            }
            // Hide global player when audio is paused
            const globalAudioPlayerContainer = document.getElementById('globalAudioPlayerContainer');
            if (globalAudioPlayerContainer) {
                globalAudioPlayerContainer.classList.remove('visible');
            }
        });

        globalAudioPlayerElement.addEventListener('ended', () => {
            updateGlobalPlayPauseIcon(false);
            if (activeAudioTriggerButton) {
                updateTriggerButtonIcon(activeAudioTriggerButton, false);
                activeAudioTriggerButton = null;
            }
            // Hide global player when audio ends
            const globalAudioPlayerContainer = document.getElementById('globalAudioPlayerContainer');
            if (globalAudioPlayerContainer) {
                globalAudioPlayerContainer.classList.remove('visible');
            }
        });

        globalAudioPlayerElement.addEventListener('timeupdate', () => {
            if (globalAudioPlayerElement.duration) {
                const progress = (globalAudioPlayerElement.currentTime / globalAudioPlayerElement.duration) * 100;
                if (globalSeekBar) globalSeekBar.value = progress;
                if (globalCurrentTime) globalCurrentTime.textContent = formatTime(globalAudioPlayerElement.currentTime);
            }
        });

        globalAudioPlayerElement.addEventListener('loadedmetadata', () => {
            if (globalDuration) globalDuration.textContent = formatTime(globalAudioPlayerElement.duration);
        });
    }

    if (globalSeekBar) {
        globalSeekBar.addEventListener('input', () => {
            if (globalAudioPlayerElement.duration) {
                const seekTime = (globalSeekBar.value / 100) * globalAudioPlayerElement.duration;
                globalAudioPlayerElement.currentTime = seekTime;
            }
        });
    }

    if (globalVolumeBar) {
        globalVolumeBar.addEventListener('input', () => {
            globalAudioPlayerElement.volume = globalVolumeBar.value / 100;
        });
    }
    
    // Handle close button
    const globalCloseBtn = document.getElementById('globalCloseBtn');
    if (globalCloseBtn) {
        globalCloseBtn.addEventListener('click', () => {
            // Stop the audio
            globalAudioPlayerElement.pause();
            globalAudioPlayerElement.currentTime = 0;
            
            // Hide the player
            const globalAudioPlayerContainer = document.getElementById('globalAudioPlayerContainer');
            if (globalAudioPlayerContainer) {
                globalAudioPlayerContainer.classList.remove('visible');
            }
            
            // Reset active button reference
            if (activeAudioTriggerButton) {
                updateTriggerButtonIcon(activeAudioTriggerButton, false);
                activeAudioTriggerButton = null;
            }
        });
    }
}

// Function to check audio status and update button state using AppState
export async function checkAndUpdateVideoButtonState(reportId, buttonElement) {
    if (!reportId || !buttonElement) return;
    
    try {
        const videoSrc = `/api/reports/${reportId}/video-artifact`;
        
        // Try to fetch with redirect: 'manual' to avoid following redirects
        const response = await fetch(videoSrc, { 
            method: 'HEAD',
            redirect: 'manual'
        });
        
        // If we get a redirect (302) or success (200), video exists
        if (response.status === 302 || response.status === 200 || response.ok) {
            // Video is ready - show and enable the button
            buttonElement.classList.remove('hidden');
            buttonElement.disabled = false;
            console.log(`Video is ready for report ${reportId}`);
        } else if (response.status === 404) {
            // No video available - keep button hidden
            buttonElement.classList.add('hidden');
            console.log(`No video available for report ${reportId}`);
        } else {
            // Other error - assume video exists but there's a temporary issue
            // Show the button and let the user try
            buttonElement.classList.remove('hidden');
            buttonElement.disabled = false;
            console.log(`Video status unclear for report ${reportId}, showing button`);
        }
    } catch (error) {
        console.error('Error checking video status:', error);
        // On network error, optimistically show the button
        // The user will see an error if video doesn't actually exist
        buttonElement.classList.remove('hidden');
        buttonElement.disabled = false;
    }
}

export async function checkAndUpdateAudioButtonState(reportId, buttonElement) {
    if (!reportId || !buttonElement) return;
    
    // Store button reference in state and update the report ID
    appState.uiState.reportAudioGeneration.buttonElement = buttonElement;
    appState.uiState.reportAudioGeneration.reportId = reportId;
    
    try {
        const audioSrc = `/api/reports/${reportId}/audio-artifact`;
        const response = await fetch(audioSrc, { method: 'HEAD' });
        
        if (response.ok) {
            // Audio is ready - enable the button directly
            buttonElement.disabled = false;
            console.log(`Audio is ready for report ${reportId}`);
            appState.setReportAudioReady(reportId);
        } else if (response.status === 202) {
            // Audio is being generated - set generating state with the new report ID
            buttonElement.disabled = true;
            buttonElement.title = 'Generating Audio...';
            appState.setReportAudioGenerating(reportId, buttonElement);
            
            // Poll for completion
            const pollForAudio = async () => {
                try {
                    const checkResponse = await fetch(audioSrc, { method: 'HEAD' });
                    if (checkResponse.ok) {
                        // Audio is ready - enable the button directly
                        buttonElement.disabled = false;
                        buttonElement.title = 'Listen to Report';
                        appState.setReportAudioReady(reportId);
                        return true;
                    } else if (checkResponse.status === 202) {
                        // Still generating, check again
                        setTimeout(pollForAudio, 3000);
                        return false;
                    } else {
                        // Error occurred
                        throw new Error(`Audio generation failed (${checkResponse.status})`);
                    }
                } catch (error) {
                    console.error('Error polling for audio:', error);
                    // Reset to ready state on error but keep disabled
                    buttonElement.disabled = true;
                    buttonElement.title = 'Audio Unavailable';
                    appState.setReportAudioReady(reportId);
                }
            };
            
            // Start polling
            setTimeout(pollForAudio, 3000);
        } else {
            // Audio not available/error - keep disabled
            buttonElement.disabled = true;
            buttonElement.title = 'Audio Unavailable';
            console.warn(`Audio not available for report ${reportId}: ${response.status}`);
            appState.setReportAudioReady(reportId);
        }
    } catch (error) {
        console.error('Error checking audio status:', error);
        // Keep button disabled on network errors
        buttonElement.disabled = true;
        buttonElement.title = 'Audio Unavailable';
        appState.setReportAudioReady(reportId);
    }
}

// Export active audio trigger button for other modules
export function getActiveAudioTriggerButton() {
    return activeAudioTriggerButton;
}

export function setActiveAudioTriggerButton(button) {
    activeAudioTriggerButton = button;
}