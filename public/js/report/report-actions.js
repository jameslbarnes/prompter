// Report Actions Manager
import { reportState } from './report-state.js';
import { playOnGlobalPlayer } from './audio-manager.js';

// Copy markdown functionality
export function initializeCopyMarkdown() {
    const copyMarkdownButton = document.getElementById('copyMarkdownButton');
    
    if (copyMarkdownButton) {
        copyMarkdownButton.addEventListener('click', function() {
            const button = this;
            const originalText = button.textContent;
            
            if (!reportState.reportMarkdown || reportState.reportMarkdown.trim() === '') {
                alert('No report content available to copy.');
                button.textContent = 'Nothing to Copy';
                setTimeout(() => { button.textContent = originalText; }, 2000);
                return;
            }
            
            navigator.clipboard.writeText(reportState.reportMarkdown)
                .then(() => {
                    console.log('Markdown copied to clipboard');
                    button.textContent = 'Copied!';
                    button.disabled = true;
                    setTimeout(() => {
                        button.textContent = originalText;
                        button.disabled = false;
                    }, 2000);
                })
                .catch(err => {
                    console.error('Error copying markdown to clipboard:', err);
                    alert('Failed to copy markdown. Please try again or copy manually.');
                    button.textContent = 'Copy Failed';
                    setTimeout(() => { button.textContent = originalText; }, 2000);
                });
        });
    }
}

// Function to trigger report regeneration programmatically
export async function triggerReportRegeneration() {
    if (!reportState.currentReportId) {
        console.error('No report ID available for regeneration.');
        return;
    }

    console.log('[REGEN] Triggering report regeneration programmatically');
    
    try {
        // Reset the state to allow streaming UI to work
        reportState.resetForRegeneration();
        
        // Clear the old session ID to prevent auto-requesting old reports
        localStorage.removeItem('archiveSessionId');
        console.log('[REGEN] Cleared old session ID from localStorage');
        
        
        // Clear the report content area
        const reportContentEl = document.getElementById('reportContent');
        const actionButtons = reportContentEl.querySelector('#reportActionButtons');
        reportContentEl.innerHTML = '';
        if (actionButtons) {
            reportContentEl.appendChild(actionButtons);
        }
        
        // Disable copy button during regeneration
        const copyMarkdownButton = document.getElementById('copyMarkdownButton');
        if (copyMarkdownButton) {
            copyMarkdownButton.disabled = true;
        }
        
        // Check if socket is available
        if (!window.reportSocket) {
            throw new Error('Socket connection not available. Please refresh the page and try again.');
        }
        
        // Emit socket event to trigger streaming regeneration
        console.log(`[REGEN] About to emit regenerateReportWithStreaming. reportAlreadyLoaded=${reportState.reportAlreadyLoaded}`);
        window.reportSocket.emit('regenerateReportWithStreaming', { 
            reportId: reportState.currentReportId,
            interviewId: reportState.currentInterviewId 
        });
        
        console.log('Regeneration request sent via socket for reportId:', reportState.currentReportId);
        
    } catch (error) {
        console.error('Error starting regeneration:', error);
        alert(`Failed to start regeneration: ${error.message}`);
    }
}

// Regenerate report functionality
export function initializeReportRegeneration() {
    const regenerateReportButton = document.getElementById('regenerateReportButton');
    
    if (regenerateReportButton) {
        regenerateReportButton.addEventListener('click', async function() {
            if (!reportState.currentReportId) {
                alert('No report ID available for regeneration. Please ensure you accessed this report through a valid report link.');
                return;
            }

            const button = this;
            const originalText = button.textContent;

            if (confirm('Are you sure you want to regenerate this report? This will create a new report with the same streaming experience and may take several minutes.')) {
                try {
                    // Reset the state to allow streaming UI to work
                    reportState.resetForRegeneration();
                    
                    // Clear the old session ID to prevent auto-requesting old reports
                    localStorage.removeItem('archiveSessionId');
                    console.log('[REGEN] Cleared old session ID from localStorage');
                    
                    
                    // Hide the regeneration button during the process
                    button.classList.add('hidden');
                    button.classList.remove('flex');
                    
                    // Clear the report content area
                    const reportContentEl = document.getElementById('reportContent');
                    const actionButtons = reportContentEl.querySelector('#reportActionButtons');
                    reportContentEl.innerHTML = '';
                    if (actionButtons) {
                        reportContentEl.appendChild(actionButtons);
                    }
                    
                    // Disable copy button during regeneration
                    const copyMarkdownButton = document.getElementById('copyMarkdownButton');
                    if (copyMarkdownButton) {
                        copyMarkdownButton.disabled = true;
                    }
                    
                    // Check if socket is available
                    if (!window.reportSocket) {
                        throw new Error('Socket connection not available. Please refresh the page and try again.');
                    }
                    
                    // Emit socket event to trigger streaming regeneration
                    console.log(`[REGEN] About to emit regenerateReportWithStreaming. reportAlreadyLoaded=${reportState.reportAlreadyLoaded}`);
                    window.reportSocket.emit('regenerateReportWithStreaming', { 
                        reportId: reportState.currentReportId,
                        interviewId: reportState.currentInterviewId 
                    });
                    
                    console.log('Regeneration request sent via socket for reportId:', reportState.currentReportId);
                    
                } catch (error) {
                    console.error('Error starting regeneration:', error);
                    alert(`Failed to start regeneration: ${error.message}`);
                    
                    // Restore button state on error
                    button.textContent = originalText;
                    button.classList.remove('hidden');
                    button.classList.add('flex');
                }
            }
        });
    }
}


// Publish to gallery functionality
export function initializePublishToGallery() {
    const publishButton = document.getElementById('publishToGalleryButton');
    
    if (publishButton) {
        publishButton.addEventListener('click', async () => {
            if (!reportState.currentReportId) {
                alert('No report ID available. Please ensure the report is fully loaded.');
                return;
            }
            
            const isPublished = publishButton.dataset.isPublished === 'true';
            const span = publishButton.querySelector('span');
            
            if (isPublished) {
                // Unpublish flow
                const confirmUnpublish = confirm(
                    'Remove this report from the public gallery?\n\n' +
                    'The report will no longer be visible to other users.'
                );
                
                if (!confirmUnpublish) return;
                
                publishButton.disabled = true;
                const originalText = span ? span.textContent : '';
                if (span) {
                    span.textContent = 'Removing...';
                }
                
                try {
                    const response = await fetch(`/api/reports/${reportState.currentReportId}/unpublish-from-gallery`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    });
                    
                    if (response.ok) {
                        alert('Your report has been removed from the gallery.');
                        
                        // Update button state
                        publishButton.dataset.isPublished = 'false';
                        publishButton.classList.remove('published');
                        if (span) {
                            span.textContent = 'Publish to Gallery';
                            span.classList.add('sr-only');
                        }
                        publishButton.title = 'Publish to Gallery';
                    } else {
                        const error = await response.json();
                        throw new Error(error.message || 'Failed to unpublish report');
                    }
                } catch (error) {
                    console.error('Error unpublishing from gallery:', error);
                    alert(`Failed to unpublish report: ${error.message}`);
                    if (span) {
                        span.textContent = originalText;
                    }
                }
                publishButton.disabled = false;
            } else {
                // Publish flow
                const confirmPublish = confirm(
                    'Publish this report to the public gallery?\n\n' +
                    'Your report will be anonymized and made available as an example for others. ' +
                    'Note: Reports require approval before appearing in the gallery.'
                );
                
                if (!confirmPublish) return;
                
                publishButton.disabled = true;
                const originalText = span ? span.textContent : '';
                if (span) {
                    span.textContent = 'Publishing...';
                    span.classList.remove('sr-only'); // Make text visible during publishing
                }
                
                try {
                    const response = await fetch(`/api/reports/${reportState.currentReportId}/publish-to-gallery`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        alert('Your report has been submitted to the gallery! It will appear after review.');
                        
                        // Update button state
                        publishButton.dataset.isPublished = 'true';
                        publishButton.dataset.publicReportId = data.publicReportId;
                        if (span) {
                            span.textContent = 'Pending Review';
                        }
                        publishButton.classList.add('published');
                        publishButton.title = 'Your report is pending review';
                    } else {
                        const error = await response.json();
                        throw new Error(error.message || 'Failed to publish report');
                    }
                } catch (error) {
                    console.error('Error publishing to gallery:', error);
                    alert(`Failed to publish report: ${error.message}`);
                    publishButton.disabled = false;
                    if (span) {
                        span.textContent = originalText;
                        span.classList.add('sr-only'); // Hide text again on error
                    }
                }
            }
        });
    }
}

// Like report functionality
export function initializeLikeReport() {
    const likeReportButton = document.getElementById('likeReportButton');
    const likeCount = document.getElementById('likeCount');
    
    // Debug SVG issue
    if (likeReportButton) {
        const svg = likeReportButton.querySelector('svg');
        const svgStyles = window.getComputedStyle(svg);
        console.log('[Like Button Debug] SVG width:', svgStyles.width);
        console.log('[Like Button Debug] SVG height:', svgStyles.height);
        console.log('[Like Button Debug] SVG display:', svgStyles.display);
        console.log('[Like Button Debug] SVG visibility:', svgStyles.visibility);
        console.log('[Like Button Debug] SVG opacity:', svgStyles.opacity);
        console.log('[Like Button Debug] SVG fill:', svgStyles.fill);
        console.log('[Like Button Debug] SVG color:', svgStyles.color);
        console.log('[Like Button Debug] Button color:', window.getComputedStyle(likeReportButton).color);
        
        // Check if path is visible
        const path = svg.querySelector('path');
        if (path) {
            const bbox = path.getBBox();
            console.log('[Like Button Debug] Path bounding box:', bbox);
        }
    }
    
    if (likeReportButton) {
        // Check if user has already liked this report
        const checkUserLiked = () => {
            const likedReports = JSON.parse(localStorage.getItem('likedReports') || '[]');
            return likedReports.includes(reportState.currentReportId);
        };
        
        // Update like button state
        const updateLikeButton = (count, isLiked) => {
            if (likeCount) {
                if (count > 0) {
                    likeCount.textContent = `(${count})`;
                    likeCount.style.display = 'inline-block';
                } else {
                    likeCount.textContent = '';
                    likeCount.style.display = 'none';
                }
            }
            
            if (isLiked) {
                likeReportButton.classList.add('liked');
            } else {
                likeReportButton.classList.remove('liked');
            }
        };
        
        // Fetch current like count
        const fetchLikeCount = async () => {
            console.log('[Like Button] fetchLikeCount called, reportId:', reportState.currentReportId);
            if (!reportState.currentReportId) {
                console.log('[Like Button] No report ID, skipping fetch');
                return;
            }
            
            try {
                console.log('[Like Button] Fetching likes for report:', reportState.currentReportId);
                const response = await fetch(`/api/reports/${reportState.currentReportId}/likes`);
                console.log('[Like Button] Response status:', response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('[Like Button] Likes data:', data);
                    const isLiked = checkUserLiked();
                    updateLikeButton(data.likes || 0, isLiked);
                    likeReportButton.disabled = false;
                    console.log('[Like Button] Button enabled');
                } else {
                    console.error('[Like Button] Failed to fetch likes:', response.status, response.statusText);
                    const errorData = await response.json().catch(() => ({}));
                    console.error('[Like Button] Error details:', errorData);
                }
            } catch (error) {
                console.error('[Like Button] Error fetching like count:', error);
            }
        };
        
        // Handle like button click
        likeReportButton.addEventListener('click', async () => {
            if (!reportState.currentReportId) {
                alert('No report ID available. Please ensure the report is fully loaded.');
                return;
            }
            
            const isCurrentlyLiked = checkUserLiked();
            likeReportButton.disabled = true;
            
            try {
                const response = await fetch(`/api/reports/${reportState.currentReportId}/like`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        action: isCurrentlyLiked ? 'unlike' : 'like' 
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    
                    // Update local storage
                    const likedReports = JSON.parse(localStorage.getItem('likedReports') || '[]');
                    if (isCurrentlyLiked) {
                        const index = likedReports.indexOf(reportState.currentReportId);
                        if (index > -1) {
                            likedReports.splice(index, 1);
                        }
                    } else {
                        likedReports.push(reportState.currentReportId);
                    }
                    localStorage.setItem('likedReports', JSON.stringify(likedReports));
                    
                    // Update UI
                    updateLikeButton(data.likes || 0, !isCurrentlyLiked);
                }
            } catch (error) {
                console.error('Error toggling like:', error);
                alert('Failed to update like status. Please try again.');
            } finally {
                likeReportButton.disabled = false;
            }
        });
        
        // Initialize like count when report is loaded
        console.log('[Like Button] Setting onReportLoaded callback');
        reportState.onReportLoaded = fetchLikeCount;
        
        // Also try to fetch immediately if report is already loaded
        if (reportState.currentReportId) {
            console.log('[Like Button] Report already loaded, fetching likes immediately');
            fetchLikeCount();
        }
    }
}

// Initialize ellipsis menu functionality
export function initializeEllipsisMenu() {
    const reportMenuButton = document.getElementById('reportMenuButton');
    const reportDropdownMenu = document.getElementById('reportDropdownMenu');
    
    if (reportMenuButton && reportDropdownMenu) {
        // Toggle dropdown menu on button click
        reportMenuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = reportDropdownMenu.classList.contains('hidden');
            
            if (isHidden) {
                reportDropdownMenu.classList.remove('hidden');
                
                // Enable/disable menu items based on state
                const copyMarkdownMenuItem = document.getElementById('copyMarkdownMenuItem');
                const regenerateMenuItem = document.getElementById('regenerateReportMenuItem');
                const publishMenuItem = document.getElementById('publishToGalleryMenuItem');
                
                // Enable copy markdown if report content exists
                if (copyMarkdownMenuItem) {
                    copyMarkdownMenuItem.disabled = !reportState.reportMarkdown || reportState.reportMarkdown.trim() === '';
                }
                
                // Show regenerate option if user owns the report
                if (regenerateMenuItem && reportState.currentReportId) {
                    regenerateMenuItem.classList.remove('hidden');
                }
                
                // Enable publish if report is loaded
                if (publishMenuItem) {
                    publishMenuItem.disabled = !reportState.currentReportId;
                }
            } else {
                reportDropdownMenu.classList.add('hidden');
            }
        });
        
        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!reportMenuButton.contains(e.target) && !reportDropdownMenu.contains(e.target)) {
                reportDropdownMenu.classList.add('hidden');
            }
        });
        
        // Handle menu item clicks
        const regenerateMenuItem = document.getElementById('regenerateReportMenuItem');
        const copyMarkdownMenuItem = document.getElementById('copyMarkdownMenuItem');
        const publishMenuItem = document.getElementById('publishToGalleryMenuItem');
        
        if (regenerateMenuItem) {
            regenerateMenuItem.addEventListener('click', () => {
                reportDropdownMenu.classList.add('hidden');
                // Trigger the hidden regenerate button
                const regenerateButton = document.getElementById('regenerateReportButton');
                if (regenerateButton) {
                    regenerateButton.click();
                }
            });
        }
        
        if (copyMarkdownMenuItem) {
            copyMarkdownMenuItem.addEventListener('click', () => {
                reportDropdownMenu.classList.add('hidden');
                // Trigger the hidden copy button
                const copyButton = document.getElementById('copyMarkdownButton');
                if (copyButton) {
                    copyButton.click();
                }
            });
        }
        
        if (publishMenuItem) {
            publishMenuItem.addEventListener('click', () => {
                reportDropdownMenu.classList.add('hidden');
                // Trigger the hidden publish button
                const publishButton = document.getElementById('publishToGalleryButton');
                if (publishButton) {
                    publishButton.click();
                }
            });
        }
    }
}

// Watch video report functionality
export function initializeWatchVideoReport() {
    const watchVideoButton = document.getElementById('watchVideoReportButton');
    
    if (watchVideoButton) {
        watchVideoButton.addEventListener('click', async () => {
            if (!reportState.currentReportId) {
                console.error('No report ID available for video playback');
                return;
            }
            
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
            console.log('[Watch Video Report] Video modal created');
        });
    }
}