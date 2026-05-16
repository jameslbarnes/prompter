// Content Tab Management - displays videos created for an interview

// Store current interview ID for socket event handling
let currentContentInterviewId = null;

// Initialize content tab functionality
window.initializeContentTab = function() {
    console.log('[content-tab] Initializing content tab');
    
    // Add click handler for spec-tab-buttons if not already handled
    document.addEventListener('click', function(e) {
        if (e.target.matches('.spec-tab-button[data-tab="spec-content"]')) {
            console.log('[content-tab] Content tab clicked');
            
            // Get the current interview ID
            const interviewId = window.currentEditingInterviewId || window.appState?.currentEditingInterviewId;
            if (interviewId) {
                currentContentInterviewId = interviewId;
                fetchAndDisplayContent(interviewId);
            } else {
                console.warn('[content-tab] No interview ID available');
                showNoContentMessage();
            }
        }
    });
    
    // Listen for video generation completion
    if (window.socket) {
        window.socket.on('reportVideoGenerationSuccess', (data) => {
            console.log('[content-tab] Video generation completed:', data);
            
            // Update the processing status in analyst messages
            const processingButtons = document.querySelectorAll('.video-processing-status');
            processingButtons.forEach(status => {
                // Replace with completed message
                status.innerHTML = '✅ Storyboard ready';
                status.className = 'video-completed-status text-green-400';
            });
            
            // Refresh content if we're viewing the same interview
            if (currentContentInterviewId && isContentTabActive()) {
                fetchAndDisplayContent(currentContentInterviewId);
            }
        });
        
        window.socket.on('reportVideoGenerationError', (data) => {
            console.error('[content-tab] Video generation failed:', data);
            
            // Update the processing status to show error
            const processingButtons = document.querySelectorAll('.video-processing-status');
            processingButtons.forEach(status => {
                status.innerHTML = '❌ Storyboard failed';
                status.className = 'video-failed-status text-red-400';
            });
            
            // Refresh content if we're viewing the same interview
            if (currentContentInterviewId && isContentTabActive()) {
                fetchAndDisplayContent(currentContentInterviewId);
            }
        });
    }
};

// Fetch and display videos for the interview
async function fetchAndDisplayContent(interviewId) {
    console.log('[content-tab] Fetching content for interview:', interviewId);
    
    const loadingIndicator = document.getElementById('contentLoadingIndicator');
    const videosGrid = document.getElementById('contentVideosGrid');
    const noContentMessage = document.getElementById('noContentMessage');
    const errorMessage = document.getElementById('contentErrorMessage');
    
    // Show loading state
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    if (videosGrid) {
        videosGrid.innerHTML = '';
        videosGrid.classList.remove('hidden');
    }
    if (noContentMessage) noContentMessage.classList.add('hidden');
    if (errorMessage) errorMessage.classList.add('hidden');
    
    try {
        // Fetch videos for this interview
        const response = await fetch(`/api/interview/${interviewId}/videos`);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch videos: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('[content-tab] Received videos:', data);
        
        // Hide loading
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        
        if (data.videos && data.videos.length > 0) {
            displayVideos(data.videos);
        } else {
            showNoContentMessage();
        }
        
    } catch (error) {
        console.error('[content-tab] Error fetching videos:', error);
        
        // Hide loading and show error
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        if (videosGrid) videosGrid.classList.add('hidden');
        if (noContentMessage) noContentMessage.classList.add('hidden');
        if (errorMessage) {
            errorMessage.classList.remove('hidden');
            errorMessage.innerHTML = `<p>Error loading storyboards: ${error.message}</p>`;
        }
    }
}

// Display videos in the grid
function displayVideos(videos) {
    const videosGrid = document.getElementById('contentVideosGrid');
    if (!videosGrid) return;
    
    videosGrid.innerHTML = '';
    videosGrid.className = 'space-y-6'; // Change from grid to stacked layout
    
    videos.forEach(video => {
        const videoElement = createEmbeddedVideo(video);
        videosGrid.appendChild(videoElement);
    });
}

// Create an embedded video element with metadata
function createEmbeddedVideo(video) {
    const container = document.createElement('div');
    container.className = 'bg-gray-800 rounded-lg overflow-hidden border border-gray-700 shadow-lg';
    
    const createdDate = new Date(video.createdAt || video.created_at);
    const formattedDate = createdDate.toLocaleDateString() + ' ' + createdDate.toLocaleTimeString();
    
    // Check if video is still processing
    const isProcessing = video.status === 'processing' || (!video.url && video.videoStatus === 'processing');
    
    if (isProcessing) {
        container.innerHTML = `
            <div class="p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold text-white">${escapeHtml(video.title || 'Storyboard')}</h3>
                    <span class="px-3 py-1 bg-yellow-600 bg-opacity-20 text-yellow-400 rounded-full text-sm">Processing</span>
                </div>
                <div class="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                    <div class="text-center px-8 py-12">
                        <div class="mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-gray-600 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h4 class="text-lg font-medium text-gray-300 mb-2">Your storyboard is being generated</h4>
                        <p class="text-gray-500 text-sm">Check back in a few minutes</p>
                    </div>
                </div>
                <div class="mt-4 space-y-2 text-sm text-gray-400">
                    <div class="flex justify-between">
                        <span>Created:</span>
                        <span>${formattedDate}</span>
                    </div>
                    ${video.threadId ? `<div class="flex justify-between">
                        <span>Thread ID:</span>
                        <span class="font-mono text-xs">${video.threadId}</span>
                    </div>` : ''}
                </div>
            </div>
        `;
    } else {
        // Extract metadata safely
        const responseCount = video.metadata?.responsesCount || 0;
        const contentPreview = video.metadata?.videoContent || '';
        const brollPrompts = video.metadata?.brollPrompts || [];
        
        container.innerHTML = `
            <div class="p-6">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-xl font-semibold text-white">${escapeHtml(video.title || 'Storyboard')}</h3>
                    <span class="px-3 py-1 bg-green-600 bg-opacity-20 text-green-400 rounded-full text-sm">Ready</span>
                </div>
                
                <!-- Embedded Video Player -->
                <div class="aspect-video bg-black rounded-lg overflow-hidden mb-4">
                    <video 
                        controls 
                        controlsList="nodownload"
                        class="w-full h-full"
                        poster="${video.thumbnailUrl || video.thumbnail || ''}"
                        preload="metadata"
                    >
                        <source src="${video.url}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
                
                <!-- Metadata -->
                <div class="space-y-4">
                    <!-- Basic Info -->
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div class="space-y-2">
                            <div class="flex justify-between text-gray-400">
                                <span>Type:</span>
                                <span class="text-gray-300">${video.type || 'Analyst Summary'}</span>
                            </div>
                            <div class="flex justify-between text-gray-400">
                                <span>Created:</span>
                                <span class="text-gray-300">${formattedDate}</span>
                            </div>
                            ${video.duration ? `<div class="flex justify-between text-gray-400">
                                <span>Duration:</span>
                                <span class="text-gray-300">${formatDuration(video.duration)}</span>
                            </div>` : ''}
                        </div>
                        <div class="space-y-2">
                            ${responseCount > 0 ? `<div class="flex justify-between text-gray-400">
                                <span>Responses:</span>
                                <span class="text-gray-300">${responseCount}</span>
                            </div>` : ''}
                            ${video.threadId ? `<div class="flex justify-between text-gray-400">
                                <span>Thread:</span>
                                <span class="text-gray-300 font-mono text-xs truncate" title="${video.threadId}">${video.threadId.substring(0, 8)}...</span>
                            </div>` : ''}
                            <div class="flex justify-between text-gray-400">
                                <span>ID:</span>
                                <span class="text-gray-300 font-mono text-xs truncate" title="${video.id}">${video.id.substring(0, 8)}...</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- B-Roll Prompts (if available) -->
                    ${brollPrompts.length > 0 ? `
                    <div class="mt-4 pt-4 border-t border-gray-700">
                        <details class="group">
                            <summary class="cursor-pointer text-sm text-gray-400 hover:text-gray-300 flex items-center justify-between">
                                <span>B-Roll Prompts (${brollPrompts.length} segments)</span>
                                <svg class="w-4 h-4 transform transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </summary>
                            <div class="mt-3 space-y-3">
                                ${brollPrompts.map((prompt, index) => `
                                    <div class="bg-gray-900 rounded p-3">
                                        <div class="text-xs text-gray-500 mb-1">Segment ${index + 1}</div>
                                        <div class="text-sm text-gray-300">${escapeHtml(prompt)}</div>
                                    </div>
                                `).join('')}
                                <button onclick="downloadBrollPrompts(${JSON.stringify(brollPrompts).replace(/"/g, '&quot;')})" class="mt-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-xs transition-colors">
                                    Download Prompts as Text
                                </button>
                            </div>
                        </details>
                    </div>
                    ` : ''}
                    
                    <!-- Content Preview (if available) -->
                    ${contentPreview ? `
                    <div class="mt-4 pt-4 border-t border-gray-700">
                        <details class="group">
                            <summary class="cursor-pointer text-sm text-gray-400 hover:text-gray-300 flex items-center justify-between">
                                <span>Content Preview</span>
                                <svg class="w-4 h-4 transform transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                                </svg>
                            </summary>
                            <div class="mt-3 text-sm text-gray-400 bg-gray-900 rounded p-3 max-h-32 overflow-y-auto">
                                ${escapeHtml(contentPreview)}
                            </div>
                        </details>
                    </div>
                    ` : ''}
                    
                    <!-- Actions -->
                    <div class="flex gap-3 mt-4 pt-4 border-t border-gray-700">
                        <a href="${video.url}" download class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm text-center transition-colors">
                            Download Storyboard
                        </a>
                        <button onclick="copyVideoUrl('${video.url}')" class="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors">
                            Copy Link
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    return container;
}

// Create a video card element
function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'bg-gray-700 rounded-lg overflow-hidden border border-gray-600 hover:border-gray-500 transition-all';
    
    const createdDate = new Date(video.createdAt || video.created_at);
    const formattedDate = createdDate.toLocaleDateString() + ' ' + createdDate.toLocaleTimeString();
    
    // Check if video is still processing
    const isProcessing = video.status === 'processing' || (!video.url && video.videoStatus === 'processing');
    
    if (isProcessing) {
        card.innerHTML = `
            <div class="aspect-video bg-gray-800 relative flex items-center justify-center">
                <!-- Processing indicator -->
                <div class="text-center">
                    <div class="inline-flex items-center justify-center w-16 h-16 mb-4">
                        <svg class="animate-spin h-12 w-12 text-accent-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                    <p class="text-gray-400 text-sm">Processing storyboard...</p>
                </div>
            </div>
            <div class="p-4">
                <h4 class="font-medium text-white mb-1">${escapeHtml(video.title || 'Storyboard')}</h4>
                <p class="text-sm text-gray-400 mb-2">${video.type || 'Analyst Summary'}</p>
                <div class="flex items-center justify-between text-xs text-gray-500">
                    <span>${formattedDate}</span>
                    <span class="text-accent-primary">Processing</span>
                </div>
                ${video.threadId ? `<div class="mt-2 text-xs text-gray-500">Thread: ${video.threadId}</div>` : ''}
            </div>
        `;
    } else {
        card.innerHTML = `
            <div class="aspect-video bg-gray-800 relative group cursor-pointer" onclick="playVideo('${video.url}', '${escapeHtml(video.title || 'Storyboard')}')">
                <!-- Video thumbnail or placeholder -->
                <div class="absolute inset-0 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-gray-600 group-hover:text-accent-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <!-- Play overlay -->
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                    <div class="opacity-0 group-hover:opacity-100 transition-opacity">
                        <div class="bg-accent-primary rounded-full p-3">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
            <div class="p-4">
                <h4 class="font-medium text-white mb-1">${escapeHtml(video.title || 'Storyboard')}</h4>
                <p class="text-sm text-gray-400 mb-2">${video.type || 'Analyst Summary'}</p>
                <div class="flex items-center justify-between text-xs text-gray-500">
                    <span>${formattedDate}</span>
                    ${video.duration ? `<span>${formatDuration(video.duration)}</span>` : ''}
                </div>
                ${video.threadId ? `<div class="mt-2 text-xs text-gray-500">Thread: ${video.threadId}</div>` : ''}
            </div>
        `;
    }
    
    return card;
}

// Show no content message
function showNoContentMessage() {
    const videosGrid = document.getElementById('contentVideosGrid');
    const noContentMessage = document.getElementById('noContentMessage');
    const loadingIndicator = document.getElementById('contentLoadingIndicator');
    
    if (loadingIndicator) loadingIndicator.classList.add('hidden');
    if (videosGrid) videosGrid.classList.add('hidden');
    if (noContentMessage) noContentMessage.classList.remove('hidden');
}

// Play video in a modal
window.playVideo = function(videoUrl, title) {
    console.log('[content-tab] Playing video:', videoUrl);
    
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="relative max-w-4xl w-full mx-4">
            <div class="bg-gray-800 rounded-lg overflow-hidden">
                <div class="flex items-center justify-between p-4 border-b border-gray-700">
                    <h3 class="text-lg font-medium text-white">${escapeHtml(title)}</h3>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div class="relative bg-black">
                    <video controls autoplay class="w-full" style="max-height: 70vh;">
                        <source src="${videoUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            </div>
        </div>
    `;
    
    // Add click handler to close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
    
    document.body.appendChild(modal);
};

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to format duration
function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Helper function to check if content tab is active
function isContentTabActive() {
    const activeTab = document.querySelector('.spec-tab-button.active[data-tab="spec-content"]');
    return activeTab !== null;
}

// Copy video URL to clipboard
window.copyVideoUrl = function(url) {
    navigator.clipboard.writeText(url).then(() => {
        // Show success message
        const toast = document.createElement('div');
        toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg z-50';
        toast.textContent = 'Storyboard link copied to clipboard!';
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }).catch(err => {
        console.error('Failed to copy URL:', err);
        alert('Failed to copy link');
    });
};

// Download b-roll prompts as text file
window.downloadBrollPrompts = function(prompts) {
    const promptsText = prompts.map((prompt, index) => {
        return `B-Roll Segment ${index + 1}:\n${prompt}\n`;
    }).join('\n---\n\n');
    
    // Create and trigger download
    const blob = new Blob([promptsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `broll-prompts-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentTab);
} else {
    initializeContentTab();
}