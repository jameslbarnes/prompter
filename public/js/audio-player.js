// Global Audio Player Module

export function initializeGlobalAudioPlayer() {
    const globalAudioPlayerElement = document.getElementById('globalAudioPlayerElement');
    const globalPlayPauseBtn = document.getElementById('globalPlayPauseBtn');
    const globalSeekBar = document.getElementById('globalSeekBar');
    const globalVolumeBar = document.getElementById('globalVolumeBar');

    if (globalPlayPauseBtn && globalAudioPlayerElement) { 
        globalPlayPauseBtn.addEventListener('click', () => {
            if (appState.uiState.globalAudioPlayer.src && globalAudioPlayerElement) {
                if (globalAudioPlayerElement.paused) {
                    globalAudioPlayerElement.play().catch(e => console.error("Play error:", e));
                } else {
                    globalAudioPlayerElement.pause();
                }
            }
        });
    }

    if (globalAudioPlayerElement) { 
        globalAudioPlayerElement.addEventListener('loadedmetadata', () => {
            appState.setGlobalAudioPlayerState({ duration: globalAudioPlayerElement.duration });
            if (window.applyGlobalAudioPlayerState) window.applyGlobalAudioPlayerState();
        });

        globalAudioPlayerElement.addEventListener('timeupdate', () => {
            appState.setGlobalAudioPlayerState({ currentTime: globalAudioPlayerElement.currentTime });
            if (window.applyGlobalAudioPlayerState) window.applyGlobalAudioPlayerState();
        });

        globalAudioPlayerElement.addEventListener('play', () => {
            appState.setGlobalAudioPlayerState({ isPlaying: true });
            if (window.applyGlobalAudioPlayerState) window.applyGlobalAudioPlayerState();
        });

        globalAudioPlayerElement.addEventListener('pause', () => {
            appState.resetGlobalAudioPlayer();
            if (window.applyGlobalAudioPlayerState) window.applyGlobalAudioPlayerState();
        });

        globalAudioPlayerElement.addEventListener('ended', () => {
            appState.setGlobalAudioPlayerState({ isPlaying: false, currentTime: 0 });
            if (window.applyGlobalAudioPlayerState) window.applyGlobalAudioPlayerState();
        });

        globalAudioPlayerElement.addEventListener('error', (e) => {
            console.error("Global Audio Player Error:", e);
            appState.setGlobalAudioPlayerState({
                isPlaying: false,
                title: 'Error',
                artist: 'Could not load audio.',
                src: null, 
                currentTime: 0,
                duration: 0
            });
            if (window.applyGlobalAudioPlayerState) window.applyGlobalAudioPlayerState();
        });
    }

    if (globalSeekBar && globalAudioPlayerElement) { 
        globalSeekBar.addEventListener('input', () => {
            if(globalAudioPlayerElement && appState.uiState.globalAudioPlayer.src) {
                const newTime = parseFloat(globalSeekBar.value);
                globalAudioPlayerElement.currentTime = newTime;
                appState.setGlobalAudioPlayerState({ currentTime: newTime }); 
                if (window.applyGlobalAudioPlayerState) window.applyGlobalAudioPlayerState(); 
            }
        });
    }

    if (globalVolumeBar && globalAudioPlayerElement) { 
        globalVolumeBar.addEventListener('input', () => {
            const newVolume = globalVolumeBar.value / 100;
            if (globalAudioPlayerElement) globalAudioPlayerElement.volume = newVolume;
            appState.setGlobalAudioPlayerState({ volume: newVolume });
        });
    }
}

export async function playOnGlobalPlayer(audioSrc, title, artist, triggerButton) {
    if (!window.applyGlobalAudioPlayerState) {
        console.error("applyGlobalAudioPlayerState function not found on window!");
        return;
    }
    
    const globalAudioPlayerElement = document.getElementById('globalAudioPlayerElement');
    if (!globalAudioPlayerElement) {
        console.error("Global player audio element not found!");
        return;
    }

    const previousTriggerButton = appState.uiState.globalAudioPlayer.activeTriggerButton;
    if (previousTriggerButton && previousTriggerButton !== triggerButton) {
        if (window.updateTriggerButtonIcon) window.updateTriggerButtonIcon(previousTriggerButton, false);
    }

    appState.setGlobalAudioPlayerState({
        src: audioSrc,
        title: title,
        artist: artist,
        activeTriggerButton: triggerButton,
        isPlaying: false, 
        currentTime: 0, 
    });
    window.applyGlobalAudioPlayerState();

    if (globalAudioPlayerElement.src !== audioSrc) {
        globalAudioPlayerElement.src = audioSrc;
        globalAudioPlayerElement.load(); 
    }
    
    try {
        await globalAudioPlayerElement.play(); 
    } catch (e) {
        console.error("Error playing audio on global player:", e);
        appState.setGlobalAudioPlayerState({ isPlaying: false, artist: 'Error loading audio' });
        window.applyGlobalAudioPlayerState(); 
    }
}

export function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

export function updateGlobalPlayPauseIcon(isPlaying) {
    const globalPlayIcon = document.getElementById('globalPlayIcon');
    const globalPauseIcon = document.getElementById('globalPauseIcon');
    if (!globalPlayIcon || !globalPauseIcon) return;
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
    if (playIcon && pauseIcon) {
        if (isPlaying) {
            playIcon.classList.add('hidden');
            pauseIcon.classList.remove('hidden');
        } else {
            playIcon.classList.remove('hidden');
            pauseIcon.classList.add('hidden');
        }
    }
}

export function applyGlobalAudioPlayerState() {
    const playerState = appState.uiState.globalAudioPlayer;
    const globalAudioPlayerContainer = document.getElementById('globalAudioPlayerContainer');
    const globalAudioPlayerElement = document.getElementById('globalAudioPlayerElement');
    const globalTrackTitleEl = document.getElementById('globalTrackTitle');
    const globalTrackArtistEl = document.getElementById('globalTrackArtist');
    const globalCurrentTimeEl = document.getElementById('globalCurrentTime');
    const globalDurationEl = document.getElementById('globalDuration');
    const globalSeekBar = document.getElementById('globalSeekBar');

    if (!globalAudioPlayerContainer || !globalAudioPlayerElement || !globalTrackTitleEl || 
        !globalTrackArtistEl || !globalCurrentTimeEl || !globalDurationEl || !globalSeekBar) {
        console.warn("One or more global audio player UI elements missing in applyGlobalAudioPlayerState.");
        return;
    }

    if (playerState.src) {
        globalAudioPlayerContainer.classList.add('visible');
    } else {
        globalAudioPlayerContainer.classList.remove('visible');
    }

    globalTrackTitleEl.textContent = playerState.title;
    globalTrackArtistEl.textContent = playerState.artist;
    updateGlobalPlayPauseIcon(playerState.isPlaying);

    if (playerState.activeTriggerButton) {
        updateTriggerButtonIcon(playerState.activeTriggerButton, playerState.isPlaying);
    }

    if (!isNaN(playerState.duration) && playerState.duration > 0) {
        globalDurationEl.textContent = formatTime(playerState.duration);
        globalSeekBar.max = playerState.duration;
    } else {
        globalDurationEl.textContent = '0:00';
        globalSeekBar.max = 100;
    }

    if (!isNaN(playerState.currentTime)) {
        globalCurrentTimeEl.textContent = formatTime(playerState.currentTime);
        if (document.activeElement !== globalSeekBar) {
             globalSeekBar.value = playerState.currentTime;
        }
    } else {
        globalCurrentTimeEl.textContent = '0:00';
        if (document.activeElement !== globalSeekBar) {
            globalSeekBar.value = 0;
        }
    }
}

// Expose functions to global scope for compatibility with non-module scripts
window.initializeGlobalAudioPlayer = initializeGlobalAudioPlayer;
window.playOnGlobalPlayer = playOnGlobalPlayer;
window.formatTime = formatTime;
window.updateGlobalPlayPauseIcon = updateGlobalPlayPauseIcon;
window.updateTriggerButtonIcon = updateTriggerButtonIcon;
window.applyGlobalAudioPlayerState = applyGlobalAudioPlayerState;