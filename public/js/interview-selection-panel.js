// Interview Selection Panel Module
// Handles the interview selection panel for choosing an interview to use as context

(function() {
    // Module-scoped variables for pagination and state
    const ITEMS_PER_PAGE = 20;
    let currentPage = 0;
    let sortedInterviews = [];
    let filteredInterviews = [];
    let pendingPrompt = null;

    /**
     * Opens the interview selection panel
     * @param {string} prompt - The prompt to use after selection
     */
    async function openInterviewSelectionPanel(prompt) {
        console.log('[InterviewSelection] Opening interview selection panel');
        
        // Store the prompt for later use
        pendingPrompt = prompt;
        
        // Close other panels first
        if (appState.uiState.reportDetailPanel.isOpen) {
            appState.setReportDetailPanelOpen(false);
            if (window.applyReportDetailPanelState) window.applyReportDetailPanelState();
        }
        if (appState.uiState.interviewLivePreviewPanel.isOpen) {
            appState.setInterviewLivePreviewPanelOpen(false);
            if (window.applyInterviewLivePreviewPanelState) window.applyInterviewLivePreviewPanelState();
        }
        if (appState.uiState.pricingPanel.isOpen) {
            appState.setPricingPanelOpen(false);
            if (window.applyPricingPanelState) window.applyPricingPanelState();
        }
        
        // Open the interview selection panel
        const panel = document.getElementById('interviewSelectionPanel');
        const overlay = document.getElementById('interviewSelectionOverlay');
        
        if (panel && overlay) {
            panel.style.display = 'flex';
            overlay.style.opacity = '1';
            overlay.style.pointerEvents = 'auto';
            void panel.offsetWidth; // Trigger reflow
            panel.style.transform = 'translateX(0)';
            
            // Initialize the panel content
            await initializeInterviewSelection();
        }
    }

    /**
     * Closes the interview selection panel
     */
    function closeInterviewSelectionPanel() {
        const panel = document.getElementById('interviewSelectionPanel');
        const overlay = document.getElementById('interviewSelectionOverlay');
        
        if (panel && overlay) {
            panel.style.transform = 'translateX(100%)';
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
            setTimeout(() => {
                panel.style.display = 'none';
                pendingPrompt = null;
            }, 300); // Match CSS transition duration
        }
    }

    /**
     * Initialize the interview selection panel content
     */
    async function initializeInterviewSelection() {
        const searchInput = document.getElementById('interviewSelectionSearchInput');
        const interviewListContainer = document.getElementById('interviewSelectionList');
        const responseListContainer = document.getElementById('responseSelectionList');
        const responsesDiv = document.getElementById('responsesList');
        const backBtn = document.getElementById('backToInterviewsBtn');
        
        // Reset state for new panel
        currentPage = 0;
        sortedInterviews = [];
        filteredInterviews = [];
        
        // Store interviews for search
        let allInterviews = [];
        
        // Back button handler
        if (backBtn) {
            backBtn.onclick = () => {
                responseListContainer.classList.add('hidden');
                interviewListContainer.classList.remove('hidden');
                searchInput.placeholder = 'Search interviews...';
                searchInput.value = '';
            };
        }
        
        try {
            // Fetch all interviews first (without checking for responses)
            const db = firebase.firestore();
            const auth = firebase.auth();
            
            console.log('[InterviewSelection] Starting to fetch interviews...');
            
            if (!auth.currentUser) {
                throw new Error('User not authenticated');
            }
            
            // Get all interviews the user has access to
            const [sharedQuery, ownedQuery] = await Promise.all([
                db.collection('interviews')
                    .where('sharedWith', 'array-contains', auth.currentUser.email)
                    .get(),
                db.collection('interviews')
                    .where('createdBy', '==', auth.currentUser.uid)
                    .get()
            ]);
            
            // Combine and deduplicate
            const interviewsMap = new Map();
            [...sharedQuery.docs, ...ownedQuery.docs].forEach(doc => {
                interviewsMap.set(doc.id, { 
                    id: doc.id, 
                    ...doc.data(),
                    isOwner: doc.data().createdBy === auth.currentUser.uid
                });
            });
            
            allInterviews = Array.from(interviewsMap.values());
            console.log(`[InterviewSelection] Found ${allInterviews.length} interviews`);
            
            // Show loading while fetching response counts
            interviewListContainer.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <div class="mb-2">Loading interviews and counting responses...</div>
                    <div class="text-xs">This may take a moment for ${allInterviews.length} interviews</div>
                </div>
            `;
            
            // Fetch response counts for all interviews in batches
            const batchSize = 30;
            for (let i = 0; i < allInterviews.length; i += batchSize) {
                const batch = allInterviews.slice(i, i + batchSize);
                
                await Promise.all(batch.map(async (interview) => {
                    try {
                        // Only count documents with status='completed' or end_timestamp
                        const [completedQuery, endTimestampQuery] = await Promise.all([
                            db.collection('reports')
                                .where('interview_id', '==', interview.id)
                                .where('status', '==', 'completed')
                                .get(),
                            db.collection('reports')
                                .where('interview_id', '==', interview.id)
                                .where('end_timestamp', '!=', null)
                                .limit(1) // Just check if any exist
                                .get()
                        ]);
                        
                        // If we have completed status reports, use that count
                        if (!completedQuery.empty) {
                            interview.responseCount = completedQuery.size;
                        } else if (!endTimestampQuery.empty) {
                            // If no completed status but has end_timestamp, do full count
                            const fullQuery = await db.collection('reports')
                                .where('interview_id', '==', interview.id)
                                .where('end_timestamp', '!=', null)
                                .get();
                            interview.responseCount = fullQuery.size;
                        } else {
                            interview.responseCount = 0;
                        }
                    } catch (error) {
                        console.error(`Error counting responses for ${interview.id}:`, error);
                        interview.responseCount = 0;
                    }
                }));
                
                // Update progress
                const progress = Math.min(i + batchSize, allInterviews.length);
                interviewListContainer.innerHTML = `
                    <div class="text-center text-gray-500 py-8">
                        <div class="mb-2">Loading interviews and counting responses...</div>
                        <div class="text-xs">${progress} / ${allInterviews.length} processed</div>
                    </div>
                `;
            }
            
            // Sort by response count (highest first)
            sortedInterviews = [...allInterviews].sort((a, b) => {
                // First sort by response count
                if (b.responseCount !== a.responseCount) {
                    return b.responseCount - a.responseCount;
                }
                // Then by last modified date
                const dateA = a.lastModified?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.lastModified?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });
            
            // Filter to only show interviews with responses
            filteredInterviews = sortedInterviews.filter(interview => interview.responseCount > 0);
            
            // Display first page
            currentPage = 0;
            displayInterviewPage(filteredInterviews);
            console.log('[InterviewSelection] Display complete');
            
            // Set up search
            if (searchInput) {
                searchInput.oninput = (e) => {
                    const searchTerm = e.target.value.toLowerCase();
                    
                    // Check if we're viewing responses or interviews
                    if (!responseListContainer.classList.contains('hidden')) {
                        // Filter responses - this will be handled in displayResponses
                        return;
                    }
                    
                    // Filter interviews
                    if (searchTerm) {
                        filteredInterviews = sortedInterviews.filter(interview => 
                            (interview.title?.toLowerCase().includes(searchTerm) ||
                             interview.description?.toLowerCase().includes(searchTerm)) &&
                            interview.responseCount > 0
                        );
                    } else {
                        filteredInterviews = sortedInterviews.filter(interview => interview.responseCount > 0);
                    }
                    
                    // Reset to first page and display
                    currentPage = 0;
                    displayInterviewPage(filteredInterviews);
                };
            }
            
        } catch (error) {
            console.error('[InterviewSelection] Error loading interviews:', error);
            interviewListContainer.innerHTML = `
                <div class="text-center text-red-400 py-8">
                    Failed to load interviews. Please try again.
                </div>
            `;
        }
    }

    /**
     * Displays a page of interviews with pagination
     */
    function displayInterviewPage(interviews) {
        const container = document.getElementById('interviewSelectionList');
        const totalPages = Math.ceil(interviews.length / ITEMS_PER_PAGE);
        const startIndex = currentPage * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, interviews.length);
        const pageInterviews = interviews.slice(startIndex, endIndex);
        
        if (interviews.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <div class="mb-2">No interviews with responses found.</div>
                    <div class="text-xs">Try adjusting your search criteria.</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="mb-4 text-sm text-gray-400">
                Showing ${startIndex + 1}-${endIndex} of ${interviews.length} interviews with responses
            </div>
            <div class="space-y-2 mb-4">
                ${pageInterviews.map(interview => `
                    <div class="interview-template-item bg-gray-600 hover:bg-gray-500 rounded-lg p-4 cursor-pointer transition-colors" 
                         data-interview-id="${interview.id}" 
                         data-interview-title="${escapeHtml(interview.title || 'Untitled Interview')}">
                        <div class="flex justify-between items-center">
                            <div class="flex-grow">
                                <h4 class="text-white font-medium">${escapeHtml(interview.title || 'Untitled Interview')}</h4>
                                ${interview.description ? `<p class="text-sm text-gray-300 mt-1">${escapeHtml(interview.description)}</p>` : ''}
                                <p class="text-xs text-gray-400 mt-1">
                                    ${interview.responseCount} response${interview.responseCount !== 1 ? 's' : ''}
                                </p>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                            </svg>
                        </div>
                    </div>
                `).join('')}
            </div>
            ${totalPages > 1 ? `
                <div class="flex justify-center items-center gap-2 pt-4 border-t border-gray-600">
                    <button id="prevPageBtn" class="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed" ${currentPage === 0 ? 'disabled' : ''}>
                        Previous
                    </button>
                    <span class="text-sm text-gray-400">
                        Page ${currentPage + 1} of ${totalPages}
                    </span>
                    <button id="nextPageBtn" class="px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 rounded disabled:opacity-50 disabled:cursor-not-allowed" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>
                        Next
                    </button>
                </div>
            ` : ''}
        `;
        
        // Add click handlers to load responses
        container.querySelectorAll('.interview-template-item').forEach(item => {
            item.addEventListener('click', async () => {
                const interviewId = item.getAttribute('data-interview-id');
                const interviewTitle = item.getAttribute('data-interview-title');
                await loadInterviewResponses(interviewId, interviewTitle);
            });
        });
        
        // Add pagination handlers
        const prevBtn = container.querySelector('#prevPageBtn');
        const nextBtn = container.querySelector('#nextPageBtn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 0) {
                    currentPage--;
                    displayInterviewPage(interviews);
                }
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (currentPage < totalPages - 1) {
                    currentPage++;
                    displayInterviewPage(interviews);
                }
            });
        }
    }

    /**
     * Loads and displays responses for a specific interview
     */
    async function loadInterviewResponses(interviewId, interviewTitle) {
        const responseListContainer = document.getElementById('responseSelectionList');
        const interviewListContainer = document.getElementById('interviewSelectionList');
        const responsesDiv = document.getElementById('responsesList');
        const searchInput = document.getElementById('interviewSelectionSearchInput');
        
        // Show loading state
        responsesDiv.innerHTML = `
            <div class="text-center text-gray-500 py-8">
                Loading responses for ${escapeHtml(interviewTitle)}...
            </div>
        `;
        
        // Switch views
        interviewListContainer.classList.add('hidden');
        responseListContainer.classList.remove('hidden');
        searchInput.placeholder = 'Search responses...';
        searchInput.value = '';
        
        try {
            const db = firebase.firestore();
            
            // Fetch all reports for this interview
            const reportsQuery = await db.collection('reports')
                .where('interview_id', '==', interviewId)
                .orderBy('end_timestamp', 'desc')
                .get();
            
            const completedReports = reportsQuery.docs.filter(doc => {
                const data = doc.data();
                return data.end_timestamp || data.status === 'completed';
            });
            
            if (completedReports.length === 0) {
                responsesDiv.innerHTML = `
                    <div class="text-center text-gray-500 py-8">
                        No completed responses found for this interview.
                    </div>
                `;
                return;
            }
            
            displayResponses(completedReports, responsesDiv, interviewTitle);
            
        } catch (error) {
            console.error('[InterviewSelection] Error loading responses:', error);
            responsesDiv.innerHTML = `
                <div class="text-center text-red-400 py-8">
                    Failed to load responses. Please try again.
                </div>
            `;
        }
    }

    /**
     * Displays the response list
     */
    function displayResponses(reports, container, interviewTitle) {
        container.innerHTML = reports.map(doc => {
            const report = doc.data();
            const reportId = doc.id;
            
            // Format date
            let dateStr = 'Date unknown';
            if (report.end_timestamp) {
                const date = report.end_timestamp.toDate ? report.end_timestamp.toDate() : new Date(report.end_timestamp);
                dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            }
            
            return `
                <div class="response-item bg-gray-600 hover:bg-gray-500 rounded-lg p-4 cursor-pointer transition-colors"
                     data-report-id="${reportId}"
                     data-user-name="${escapeHtml(report.user_name || 'Anonymous')}">
                    <div class="flex justify-between items-start">
                        <div class="flex-grow">
                            <h5 class="text-white font-medium">${escapeHtml(report.user_name || 'Anonymous')}</h5>
                            <p class="text-sm text-gray-300">${escapeHtml(report.user_email || 'No email')}</p>
                            <p class="text-xs text-gray-400 mt-1">${dateStr}</p>
                        </div>
                        <button class="select-response-btn bg-accent-primary hover:bg-accent-secondary text-white px-3 py-1 rounded text-sm">
                            Use this response
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        // Add click handlers
        container.querySelectorAll('.response-item').forEach(item => {
            const btn = item.querySelector('.select-response-btn');
            const reportId = item.getAttribute('data-report-id');
            const userName = item.getAttribute('data-user-name');
            
            const handleClick = async () => {
                // Close panel
                closeInterviewSelectionPanel();
                
                // Use the single response function
                if (window.createInterviewFromSingleResponse) {
                    await window.createInterviewFromSingleResponse(reportId, userName);
                    
                    // Wait a bit for the file preview to update
                    setTimeout(() => {
                        // Set the prompt in the input
                        const copilotInput = document.getElementById('copilotInput');
                        if (copilotInput) {
                            // Use a more specific prompt for interview creation from responses
                            copilotInput.value = "Please use this interview transcript to create a new interview using the insights contained within it. Be sure to ask me if you have any questions about the audience or topic.";
                            
                            // Clear prompt cards and send message (following the same pattern as content interview)
                            setTimeout(() => {
                                const copilotMessagesEl = document.getElementById('copilotMessages');
                                if (copilotMessagesEl) {
                                    copilotMessagesEl.innerHTML = '';
                                }
                                const sendButton = document.getElementById('sendCopilotMessage');
                                if (sendButton) sendButton.click();
                                
                                // Clean up
                                pendingPrompt = null;
                            }, 200);
                        }
                    }, 500);
                }
            };
            
            item.addEventListener('click', handleClick);
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleClick();
            });
        });
    }

    /**
     * Escape HTML for safe display
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize panel event handlers
    function initializePanelHandlers() {
        const closeBtn = document.getElementById('closeInterviewSelectionPanelBtn');
        const overlay = document.getElementById('interviewSelectionOverlay');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeInterviewSelectionPanel);
        }
        
        if (overlay) {
            overlay.addEventListener('click', closeInterviewSelectionPanel);
        }
    }

    // Export to global scope
    window.openInterviewSelectionPanel = openInterviewSelectionPanel;
    window.closeInterviewSelectionPanel = closeInterviewSelectionPanel;

    // Initialize handlers when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePanelHandlers);
    } else {
        initializePanelHandlers();
    }

    console.log('[InterviewSelectionPanel] Module loaded');
})();