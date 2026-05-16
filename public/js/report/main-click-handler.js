// Main Click Handler for Report Page
import { reportState } from './report-state.js';
import { activateReportTab } from './tab-manager.js';
import { loadTranscriptContent } from './transcript-manager.js';
import { playOnGlobalPlayer } from './audio-manager.js';

export function initializeMainClickHandler() {
    // Main event handler for all click events
    document.addEventListener('click', async function(event) {
        console.log('[Document Click] Target:', event.target, 'Closest button:', event.target.closest('.play-transcript-audio-btn'));
        
        // Handle navigation tab clicks FIRST
        const navButton = event.target.closest('.report-nav-button');
        if (navButton) {
            const targetId = navButton.getAttribute('data-target');
            console.log('[Tab Navigation] Switching to tab:', targetId);
            
            // Special handling for transcript tab to ensure content is loaded
            if (targetId === 'transcriptContentArea' && reportState.currentReportId) {
                const transcriptContent = document.getElementById('transcriptContent');
                if (transcriptContent) {
                    const hasContent = transcriptContent.innerHTML.trim() !== '' && 
                                     !transcriptContent.innerHTML.includes('Loading transcript...');
                    if (!hasContent) {
                        console.log('[Tab Navigation] Transcript tab clicked but content missing, loading...');
                        loadTranscriptContent(reportState.currentReportId);
                    }
                }
            }
            
            activateReportTab(targetId);
            
            // Handle mobile navigation closing if needed
            if (appState.uiState.mobileNavOpen && window.innerWidth <= 768) {
                console.log('Closing mobile nav after tab click');
                setTimeout(() => {
                    appState.setMobileNavOpen(false);
                }, 150);
            }
            return;
        }

        // Handle transcript audio play buttons
        const transcriptPlayButton = event.target.closest('.play-transcript-audio-btn');
        if (transcriptPlayButton) {
            console.log('[Transcript Audio] Button clicked:', transcriptPlayButton);
            const audioUrl = transcriptPlayButton.getAttribute('data-audio-url');
            const trackTitle = transcriptPlayButton.getAttribute('data-track-title');
            const trackArtist = transcriptPlayButton.getAttribute('data-track-artist');
            
            console.log('[Transcript Audio] Audio URL:', audioUrl);
            console.log('[Transcript Audio] Track Title:', trackTitle);
            console.log('[Transcript Audio] Track Artist:', trackArtist);
            
            if (audioUrl) {
                try {
                    console.log('[Transcript Audio] Calling playOnGlobalPlayer...');
                    await playOnGlobalPlayer(audioUrl, trackTitle, trackArtist, transcriptPlayButton);
                    console.log('[Transcript Audio] playOnGlobalPlayer completed successfully');
                } catch (error) {
                    console.error('[Transcript Audio] Error in playOnGlobalPlayer:', error);
                    alert('Error playing audio: ' + error.message);
                }
            } else {
                console.error('[Transcript Audio] No audio URL found on button');
                alert('No audio URL available for this response');
            }
            return;
        }

        // Handle transcript video play buttons
        const transcriptVideoButton = event.target.closest('.play-transcript-video-btn');
        if (transcriptVideoButton) {
            console.log('[Transcript Video] Button clicked:', transcriptVideoButton);
            const videoUrl = transcriptVideoButton.getAttribute('data-video-url');
            const qaIndex = transcriptVideoButton.getAttribute('data-qa-index');
            
            console.log('[Transcript Video] Video URL:', videoUrl);
            
            if (videoUrl) {
                try {
                    // Create a modal to show the video
                    const modal = document.createElement('div');
                    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
                    modal.innerHTML = `
                        <div class="relative max-w-4xl w-full mx-4">
                            <button class="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors" onclick="this.closest('.fixed').remove()">
                                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                            </button>
                            <video controls autoplay class="w-full rounded-lg shadow-2xl" style="max-height: 80vh;">
                                <source src="${videoUrl}" type="video/mp4">
                                Your browser does not support the video tag.
                            </video>
                        </div>
                    `;
                    
                    // Close modal on background click
                    modal.addEventListener('click', (e) => {
                        if (e.target === modal) {
                            modal.remove();
                        }
                    });
                    
                    // Close modal on ESC key
                    const escHandler = (e) => {
                        if (e.key === 'Escape') {
                            modal.remove();
                            document.removeEventListener('keydown', escHandler);
                        }
                    };
                    document.addEventListener('keydown', escHandler);
                    
                    document.body.appendChild(modal);
                    console.log('[Transcript Video] Video modal created');
                } catch (error) {
                    console.error('[Transcript Video] Error playing video:', error);
                    alert('Error playing video: ' + error.message);
                }
            } else {
                console.error('[Transcript Video] No video URL found on button');
                alert('No video URL available for this response');
            }
            return;
        }

        // Handle full report audio play button
        const fullReportPlayButton = event.target.closest('#playFullReportAudioBtn');
        if (fullReportPlayButton && reportState.currentReportId) {
            const audioSrc = `/api/reports/${reportState.currentReportId}/audio-artifact`;
            await playOnGlobalPlayer(audioSrc, 'Full Report Audio', 'Generated Report', fullReportPlayButton);
            return;
        }

        // Handle full report video play button
        const fullReportVideoButton = event.target.closest('#playFullReportVideoBtn');
        if (fullReportVideoButton && reportState.currentReportId) {
            const videoSrc = `/api/reports/${reportState.currentReportId}/video-artifact`;
            
            // Create a modal to show the video
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="relative max-w-6xl w-full mx-4">
                    <button class="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors" onclick="this.closest('.fixed').remove()">
                        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                    <video controls autoplay class="w-full rounded-lg shadow-2xl" style="max-height: 80vh;">
                        <source src="${videoSrc}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `;
            
            // Close modal on background click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
            // Close modal on ESC key
            const escHandler = (e) => {
                if (e.key === 'Escape') {
                    modal.remove();
                    document.removeEventListener('keydown', escHandler);
                }
            };
            document.addEventListener('keydown', escHandler);
            
            document.body.appendChild(modal);
            console.log('[Full Report Video] Video modal created');
            return;
        }

        // Handle download report audio button
        const downloadReportButton = event.target.closest('#downloadFullReportAudioBtn');
        if (downloadReportButton && reportState.currentReportId) {
            try {
                const response = await fetch(`/api/reports/${reportState.currentReportId}/audio-artifact`);
                if (response.ok) {
                    const audioBlob = await response.blob();
                    const downloadUrl = URL.createObjectURL(audioBlob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = downloadUrl;
                    a.download = `report_audio_${reportState.currentReportId}.mp3`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(downloadUrl);
                    document.body.removeChild(a);
                }
            } catch (error) {
                console.error('Error downloading audio:', error);
                alert('Error downloading audio file');
            }
            return;
        }
    });
}