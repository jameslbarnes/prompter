// Interview List Management

// Lazy loading configuration
const INTERVIEWS_PER_PAGE = 20;
let currentPage = 0;
let isLoadingInterviews = false;
let hasMoreInterviews = true;
let displayedInterviewIds = new Set();
let isSearchMode = false;
let cachedAllInterviews = null;
let lastCacheTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Handle events on the interviews list
function handleInterviewListEvents(event) {
    const target = event.target;

    // Handle ellipsis button click
    const ellipsisButton = target.closest('.ellipsis-btn');
    if (ellipsisButton) {
        const menu = ellipsisButton.closest('.ellipsis-menu');
        const dropdown = menu.querySelector('.ellipsis-dropdown');
        // Close other open menus
        document.querySelectorAll('.ellipsis-dropdown.block').forEach(openDropdown => {
            if (openDropdown !== dropdown) {
                openDropdown.classList.add('hidden');
                openDropdown.classList.remove('block');
                const parentMenu = openDropdown.closest('.ellipsis-menu');
                if (parentMenu) {
                    parentMenu.classList.remove('open');
                }
            }
        });
        // Toggle current menu
        dropdown.classList.toggle('hidden');
        dropdown.classList.toggle('block');
        const parentMenu = dropdown.closest('.ellipsis-menu');
        if (parentMenu) {
            parentMenu.classList.toggle('open', dropdown.classList.contains('block'));
        }
        event.stopPropagation(); // Prevent closing immediately if clicking outside
        return; // Stop further processing
    }

    // Handle click on the card itself (for editing)
    const interviewCard = target.closest('.interview-card');
    if (interviewCard && !target.closest('.ellipsis-menu')) {
        const editButton = interviewCard.querySelector('.edit-btn'); // Find the edit button within the card
        if (editButton) {
            const id = editButton.getAttribute('data-id');
            if (window.loadInterviewForEditing) window.loadInterviewForEditing(id);
            closeAllDropdowns(); // Close any open menus
            // Optional: Add a visual indicator for the selected item
            document.querySelectorAll('#interviewsList .interview-card.selected').forEach(el => el.classList.remove('selected', 'bg-gray-700'));
            interviewCard.classList.add('selected', 'bg-gray-700'); // Example selection style
            return;
        }
    }

    // Handle actions within the dropdown
    const copyButton = target.closest('.copy-btn');
    if (copyButton) {
        const url = copyButton.getAttribute('data-url');
        if (window.copyToClipboard) {
            window.copyToClipboard(url)
                .then(() => {
                    copyButton.textContent = 'Copied!';
                    setTimeout(() => {
                        copyButton.textContent = 'Copy URL';
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy URL:', err);
                    copyButton.textContent = 'Failed';
                    setTimeout(() => {
                        copyButton.textContent = 'Copy URL';
                    }, 2000);
                });
        }
        closeAllDropdowns();
        return;
    }

    const deleteButton = target.closest('.delete-btn');
    if (deleteButton) {
        const id = deleteButton.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this interview? This action cannot be undone.')) {
            if (window.deleteInterview) window.deleteInterview(id);
        }
        closeAllDropdowns();
        return;
    }

    const shareButton = target.closest('.share-btn');
    if (shareButton) {
        const id = shareButton.getAttribute('data-id');
        if (window.openSharingModal) window.openSharingModal(id);
        closeAllDropdowns();
        return;
    }

    const addToTemplatesButton = target.closest('.add-to-templates-btn');
    if (addToTemplatesButton) {
        const id = addToTemplatesButton.getAttribute('data-id');
        if (window.addInterviewToTemplates) window.addInterviewToTemplates(id);
        closeAllDropdowns();
        return;
    }

    const createFromResponsesButton = target.closest('.create-from-responses-btn');
    if (createFromResponsesButton) {
        const id = createFromResponsesButton.getAttribute('data-id');
        const title = createFromResponsesButton.getAttribute('data-title');
        if (window.createInterviewFromResponses) {
            window.createInterviewFromResponses(id, title).then(() => {
                // After context is loaded, populate the copilot input with a helpful prompt
                setTimeout(() => {
                    const copilotInput = document.getElementById('copilotInput');
                    if (copilotInput) {
                        copilotInput.value = 'Create a personalized interview based on these responses';
                        // Auto-send the message
                        const sendButton = document.getElementById('sendCopilotMessage');
                        if (sendButton) sendButton.click();
                    }
                }, 500);
            });
        }
        closeAllDropdowns();
        return;
    }
}

// Close all dropdown menus
function closeAllDropdowns() {
    // Close ellipsis dropdowns
    document.querySelectorAll('.ellipsis-dropdown').forEach(dropdown => {
        dropdown.classList.add('hidden');
        dropdown.classList.remove('block');
        const parentMenu = dropdown.closest('.ellipsis-menu');
        if (parentMenu) {
            parentMenu.classList.remove('open');
        }
    });
    
    // Close sort dropdown
    const sortDropdownMenu = document.getElementById('sortDropdownMenu');
    if (sortDropdownMenu) {
        sortDropdownMenu.classList.add('hidden');
    }
}

// Handle document click for closing dropdowns
function handleDocumentClickForDropdowns(event) {
    if (!event.target.closest('.ellipsis-menu') && !event.target.closest('#sortDropdownToggle') && !event.target.closest('#sortDropdownMenu')) {
        closeAllDropdowns();
    }
}

// Get sort preference from localStorage
function getSortPreference() {
    return localStorage.getItem('interviewSortPreference') || 'lastUpdated';
}

// Update sort dropdown UI to show selected option
function updateSortDropdownUI(selectedValue) {
    const sortOptions = document.querySelectorAll('.sort-option');
    sortOptions.forEach(option => {
        const checkmark = option.querySelector('.sort-check');
        if (option.getAttribute('data-value') === selectedValue) {
            checkmark?.classList.remove('hidden');
        } else {
            checkmark?.classList.add('hidden');
        }
    });
}

// Save sort preference to localStorage
function saveSortPreference(sortBy) {
    localStorage.setItem('interviewSortPreference', sortBy);
}

// Process interviews with basic data
async function processInterviewsBasicData(interviewDocs, db) {
    return Promise.all(
        interviewDocs.map(async ({ doc, isOwner }) => {
            const interview = doc.data();
            let completedCount = 0;
            let partialCount = 0;
            let lastCompletedAt = null;
            
            try {
                // Get all reports for this interview to check completion status
                const allReportsSnapshot = await db.collection('reports')
                    .where('interview_id', '==', doc.id)
                    .get();
                
                if (!allReportsSnapshot.empty) {
                    let latestTimestamp = null;
                    let completedReports = 0;
                    let partialReports = 0;
                    
                    // Check each report for completion status
                    allReportsSnapshot.forEach(reportDoc => {
                        const reportData = reportDoc.data();
                        
                        // Count as completed if status is 'completed' or if we have an end_timestamp
                        const isCompleted = reportData.status === 'completed' || reportData.end_timestamp;
                        
                        // Count as partial if has responses or currentQuestionIndex > 0 but not completed
                        const isPartial = !isCompleted && (
                            (reportData.responses && reportData.responses.length > 0) ||
                            (reportData.currentQuestionIndex && reportData.currentQuestionIndex > 0) ||
                            reportData.start_timestamp
                        );
                        
                        if (isCompleted) {
                            completedReports++;
                        } else if (isPartial) {
                            partialReports++;
                        }
                        
                        // Track latest activity timestamp
                        const timestamp = reportData.end_timestamp || reportData.start_timestamp;
                        if (timestamp && (!latestTimestamp || timestamp.toDate() > latestTimestamp.toDate())) {
                            latestTimestamp = timestamp;
                        }
                    });
                    
                    completedCount = completedReports;
                    partialCount = partialReports;
                    lastCompletedAt = latestTimestamp;
                }
            } catch (error) {
                console.warn(`Error fetching basic data for interview ${doc.id}:`, error);
            }

            return {
                id: doc.id,
                data: interview,
                lastCompletedAt: lastCompletedAt,
                completedCount: completedCount,
                partialCount: partialCount || 0,
                createdAt: interview.createdAt || null,
                isOwner: isOwner,
                isInvalid: false
            };
        })
    );
}

// Sort interviews based on preference
function sortInterviews(interviews) {
    const sortBy = getSortPreference();
    const sorted = [...interviews];
    
    sorted.sort((a, b) => {
        // Helper function to check if an interview is "recently created" (within last 24 hours and no completions)
        const isRecentlyCreated = (item) => {
            if (item.completedCount > 0) return false;
            if (!item.createdAt) return false;
            const createdDate = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
            const hoursSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
            return hoursSinceCreation <= 24;
        };

        const aRecentlyCreated = isRecentlyCreated(a);
        const bRecentlyCreated = isRecentlyCreated(b);

        // Always prioritize recently created interviews at the top
        if (aRecentlyCreated && !bRecentlyCreated) return -1;
        if (!aRecentlyCreated && bRecentlyCreated) return 1;
        
        // If both are recently created, sort by creation date (newest first)
        if (aRecentlyCreated && bRecentlyCreated) {
            const aCreatedDate = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(0);
            const bCreatedDate = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(0);
            return bCreatedDate - aCreatedDate;
        }

        // For non-recently-created interviews, apply normal sorting
        if (sortBy === 'completions') {
            // Sort by number of completions (descending), then by last updated
            if (a.completedCount !== b.completedCount) {
                return b.completedCount - a.completedCount;
            }
            // If completion counts are equal, fall back to last updated
            if (a.lastCompletedAt && b.lastCompletedAt) {
                return b.lastCompletedAt.toDate() - a.lastCompletedAt.toDate();
            }
            if (a.lastCompletedAt && !b.lastCompletedAt) return -1;
            if (!a.lastCompletedAt && b.lastCompletedAt) return 1;
            const aCreatedDate = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(0);
            const bCreatedDate = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(0);
            return bCreatedDate - aCreatedDate;
        } else {
            // Default: Sort by last updated (most recent first)
            if (a.lastCompletedAt && b.lastCompletedAt) {
                return b.lastCompletedAt.toDate() - a.lastCompletedAt.toDate();
            }
            if (a.lastCompletedAt && !b.lastCompletedAt) return -1;
            if (!a.lastCompletedAt && b.lastCompletedAt) return 1;
            const aCreatedDate = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(0);
            const bCreatedDate = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(0);
            return bCreatedDate - aCreatedDate;
        }
    });
    
    return sorted;
}

// Search functionality for interviews
let searchTimeout;
function handleInterviewSearch() {
    const searchInput = document.getElementById('interviewSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    if (!searchInput) return;
    
    // Clear any existing timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    const searchTerm = searchInput.value.trim().toLowerCase();
    
    // Show/hide clear button
    if (searchTerm) {
        clearSearchBtn?.classList.remove('hidden');
        isSearchMode = true;
    } else {
        clearSearchBtn?.classList.add('hidden');
        isSearchMode = false;
    }
    
    // Debounce the search to avoid too frequent filtering
    searchTimeout = setTimeout(async () => {
        if (searchTerm) {
            // Load all interviews for search
            currentPage = 0;
            displayedInterviewIds.clear();
            await loadInterviews(false, true);
            filterInterviewCards(searchTerm);
        } else {
            // Clear search - reload with pagination
            currentPage = 0;
            displayedInterviewIds.clear();
            hasMoreInterviews = true;
            await loadInterviews(false, false);
        }
    }, 300);
}

function filterInterviewCards(searchTerm) {
    const interviewsList = document.getElementById('interviewsList');
    if (!interviewsList) return;
    
    const cards = interviewsList.querySelectorAll('.interview-card:not(.loading-more-indicator):not(.no-search-results)');
    let visibleCount = 0;
    
    cards.forEach(card => {
        const titleElement = card.querySelector('.interview-title');
        if (!titleElement) return;
        
        const title = titleElement.textContent.toLowerCase();
        const shouldShow = !searchTerm || title.includes(searchTerm);
        
        if (shouldShow) {
            card.style.display = '';
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });
    
    // Hide loading indicator during search
    const loadingIndicator = interviewsList.querySelector('.loading-more-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
    
    // Show a message if no results found
    let noResultsMessage = interviewsList.querySelector('.no-search-results');
    if (searchTerm && visibleCount === 0) {
        if (!noResultsMessage) {
            noResultsMessage = document.createElement('div');
            noResultsMessage.className = 'no-search-results interview-card';
            noResultsMessage.innerHTML = '<p class="text-sm text-gray-500">No interviews found matching your search.</p>';
            interviewsList.appendChild(noResultsMessage);
        }
        noResultsMessage.style.display = '';
    } else if (noResultsMessage) {
        noResultsMessage.style.display = 'none';
    }
}

async function clearInterviewSearch() {
    const searchInput = document.getElementById('interviewSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    if (searchInput) {
        searchInput.value = '';
        clearSearchBtn?.classList.add('hidden');
        isSearchMode = false;
        
        // Remove any no results message
        const interviewsList = document.getElementById('interviewsList');
        const noResultsMessage = interviewsList?.querySelector('.no-search-results');
        if (noResultsMessage) {
            noResultsMessage.remove();
        }
        
        // Reload with pagination
        currentPage = 0;
        displayedInterviewIds.clear();
        hasMoreInterviews = true;
        await loadInterviews(false, false);
    }
}

// Initialize interview list event handlers
function initializeInterviewList() {
    const interviewsList = document.getElementById('interviewsList');
    const refreshBtn = document.getElementById('refreshBtn');
    const newInterviewBtn = document.getElementById('newInterviewBtn');
    const sortDropdownToggle = document.getElementById('sortDropdownToggle');
    const sortDropdownMenu = document.getElementById('sortDropdownMenu');
    const searchInput = document.getElementById('interviewSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const sidebarContent = document.querySelector('.sidebar-content');
    
    // Event delegation for the interviews list
    interviewsList?.addEventListener('click', handleInterviewListEvents);
    
    // Add scroll event listener for lazy loading
    if (sidebarContent) {
        sidebarContent.addEventListener('scroll', handleInterviewsScroll);
    }
    
    // Document click handler for closing dropdowns
    document.addEventListener('click', handleDocumentClickForDropdowns);
    
    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', handleInterviewSearch);
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                clearInterviewSearch();
                this.blur();
            }
        });
    }
    
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => clearInterviewSearch());
    }
    
    // Sort dropdown functionality
    if (sortDropdownToggle && sortDropdownMenu) {
        // Load saved preference and update UI
        const savedSort = localStorage.getItem('interviewSortPreference') || 'lastUpdated';
        updateSortDropdownUI(savedSort);
        
        // Handle sort dropdown toggle
        sortDropdownToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            const isVisible = !sortDropdownMenu.classList.contains('hidden');
            
            // Close all other dropdowns first
            closeAllDropdowns();
            
            if (!isVisible) {
                sortDropdownMenu.classList.remove('hidden');
            }
        });
        
        // Handle sort option selection
        sortDropdownMenu.addEventListener('click', function(e) {
            if (e.target.classList.contains('sort-option')) {
                e.stopPropagation();
                const sortValue = e.target.getAttribute('data-value');
                saveSortPreference(sortValue);
                updateSortDropdownUI(sortValue);
                sortDropdownMenu.classList.add('hidden');
                
                // Reset and reload with new sort
                currentPage = 0;
                hasMoreInterviews = true;
                displayedInterviewIds.clear();
                cachedAllInterviews = null; // Force refresh to apply new sort
                
                if (window.refreshInterviewsList) {
                    window.refreshInterviewsList();
                } else if (window.loadInterviewsGlobal) {
                    window.loadInterviewsGlobal();
                }
            }
        });
    }
    
    // Refresh button functionality
    refreshBtn?.addEventListener('click', () => {
        if (window.refreshInterviewsList) {
            window.refreshInterviewsList();
        } else if (window.loadInterviewsGlobal) {
            window.loadInterviewsGlobal();
        } else {
            console.error("loadInterviewsGlobal not found for refresh");
        }
    });
    
    // New Interview button functionality
    newInterviewBtn?.addEventListener('click', function() {
        if (window.resetToNewInterviewStateUI) window.resetToNewInterviewStateUI(false);
        if (window.updateUrlForInterview) window.updateUrlForInterview(null); // Clear URL hash
        
        // Auto-collapse the config panel when creating a new interview
        if (window.appState && !window.appState.uiState.configPanelCollapsed) {
            window.appState.setConfigPanelCollapsed(true);
            if (window.applyPanelCollapseStates) {
                window.applyPanelCollapseStates();
            }
        }
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeInterviewList();
});

// Export functions for global use
window.closeAllDropdowns = closeAllDropdowns;

// Delete file from storage
async function deleteFileFromStorage(filePath) {
    if (!filePath) return;
    try {
        const response = await fetch('/api/files', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ filePath: filePath }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }
        console.log(`Deleted file via backend: ${filePath}`);
    } catch (error) {
        console.error(`Error deleting file ${filePath} via backend:`, error);
    }
}

// Delete interview and its associated files
function deleteInterview(id) {
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    if (!db || !auth.currentUser) return;
    
    db.collection('interviews').doc(id).get().then(doc => {
        if (!doc.exists) {
            alert('Interview not found for deletion.');
            return;
        }
        const data = doc.data();
        const filesToDelete = data.contextFiles || [];
        db.collection('interviews').doc(id).delete()
            .then(() => {
                alert('Interview data deleted successfully. Removing associated files...');
                
                // Clear cache to force refresh
                cachedAllInterviews = null;
                lastCacheTime = null;
                
                if (window.refreshInterviewsList) {
                    window.refreshInterviewsList();
                } else if (window.loadInterviewsGlobal) {
                    window.loadInterviewsGlobal();
                }
                if (window.showSpecificationNullState) window.showSpecificationNullState();
                if (appState.currentEditingInterviewId === id) {
                    appState.setCurrentEditingInterviewId(null);
                    appState.resetInterviewSpec();
                    if(window.resetToNewInterviewStateUI) window.resetToNewInterviewStateUI(true);
                }
                const deletePromises = filesToDelete.map(fileData => deleteFileFromStorage(fileData.path));
                return Promise.all(deletePromises);
            })
            .then(() => {
                console.log('Associated files removed from storage.');
            })
            .catch((error) => {
                alert(`Error deleting interview or associated files: ${error.message}`);
            });
    }).catch(error => {
        alert(`Error retrieving interview data for deletion: ${error.message}`);
    });
}

// Load interviews list with true lazy loading
async function loadInterviews(append = false, forceLoadAll = false) {
    const interviewsList = document.getElementById('interviewsList');
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    if (!interviewsList || !db || !auth.currentUser) {
        console.error("Missing elements or Firebase services for loadInterviews");
        if (interviewsList && !append) interviewsList.innerHTML = '<div class="interview-card"><p class="text-red-500">Error: Could not load interviews (dependencies not ready).</p></div>';
        return;
    }
    
    if (isLoadingInterviews) return;
    isLoadingInterviews = true;
    
    if (!append) {
        currentPage = 0;
        hasMoreInterviews = true;
        displayedInterviewIds.clear();
        if (!forceLoadAll && !isSearchMode) {
            interviewsList.innerHTML = '<div class="interview-card animate-fade-in"><p class="text-sm text-gray-500">Loading interviews...</p></div>';
        }
    }

    try {
        let interviewsToDisplay = [];
        
        // Check if we need to load all interviews (for search or if cache is expired)
        const needsFullLoad = forceLoadAll || isSearchMode || !cachedAllInterviews || 
                            !lastCacheTime || (Date.now() - lastCacheTime > CACHE_DURATION);
        
        if (needsFullLoad) {
            console.log('[Interview List] Loading all interviews...');
            
            // Show loading message
            if (!append) {
                interviewsList.innerHTML = '<div class="interview-card animate-fade-in"><p class="text-sm text-gray-500">Loading all interviews...</p></div>';
            }
            
            // Load ALL interviews
            const [createdSnapshot, sharedSnapshot] = await Promise.all([
                db.collection('interviews')
                    .where('createdBy', '==', auth.currentUser.uid)
                    .get(),
                db.collection('interviews')
                    .where('sharedWith', 'array-contains', auth.currentUser.email)
                    .get()
            ]);
            
            // Combine results
            const interviewDocs = new Map();
            createdSnapshot.docs.forEach(doc => {
                interviewDocs.set(doc.id, { doc, isOwner: true });
            });
            sharedSnapshot.docs.forEach(doc => {
                if (!interviewDocs.has(doc.id)) {
                    interviewDocs.set(doc.id, { doc, isOwner: false });
                }
            });
            
            console.log(`[Interview List] Found ${interviewDocs.size} total interviews`);
            
            if (interviewDocs.size === 0) {
                interviewsList.innerHTML = '<div class="interview-card"><p>No interviews available. Create a new interview or ask someone to share one with you.</p></div>';
                isLoadingInterviews = false;
                return;
            }
            
            // Process all interviews with basic data
            cachedAllInterviews = await processInterviewsBasicData(Array.from(interviewDocs.values()), db);
            lastCacheTime = Date.now();
        }
        
        // Sort all interviews
        const sortedInterviews = sortInterviews(cachedAllInterviews);
        
        if (forceLoadAll || isSearchMode) {
            // Show all interviews for search
            interviewsToDisplay = sortedInterviews;
            hasMoreInterviews = false;
        } else {
            // Paginate for normal browsing
            const startIdx = currentPage * INTERVIEWS_PER_PAGE;
            const endIdx = startIdx + INTERVIEWS_PER_PAGE;
            interviewsToDisplay = sortedInterviews.slice(startIdx, endIdx);
            hasMoreInterviews = endIdx < sortedInterviews.length;
            currentPage++;
            
            console.log(`[Interview List] Showing interviews ${startIdx + 1}-${Math.min(endIdx, sortedInterviews.length)} of ${sortedInterviews.length}`);
        }
        
        // Clear list if not appending
        if (!append) {
            interviewsList.innerHTML = '';
            displayedInterviewIds.clear();
        }
        
        // Remove loading indicator if appending
        if (append) {
            const loadingIndicator = interviewsList.querySelector('.loading-more-indicator');
            if (loadingIndicator) loadingIndicator.remove();
        }
        
        // Display the interviews
        interviewsToDisplay.forEach((interviewItem, interviewIndex) => {
            // Skip if already displayed
            if (displayedInterviewIds.has(interviewItem.id)) return;
            displayedInterviewIds.add(interviewItem.id);
            
            const interview = interviewItem.data;
            const interviewUrl = `${window.location.origin}/i/?interview=${interviewItem.id}`;
            const card = document.createElement('div');
            card.className = 'interview-card animate-fade-in';
            if (appState.currentEditingInterviewId === interviewItem.id) {
                card.classList.add('selected');
            }

            // Determine what date to show and format stats
            let lastUpdatedText = '';
            let statsText = '';
            
            if (interviewItem.lastCompletedAt) {
                try {
                    const lastCompletedDate = new Date(interviewItem.lastCompletedAt.toDate());
                    const dateStr = lastCompletedDate.toLocaleDateString();
                    const timeStr = lastCompletedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    lastUpdatedText = `Last updated ${dateStr} ${timeStr}`;
                } catch (error) {
                    console.warn(`Error formatting completion date for interview ${interviewItem.id}:`, error);
                    lastUpdatedText = 'Last updated recently';
                }
            } else if (interview.createdAt) {
                try {
                    const createdDate = interview.createdAt.toDate ? 
                        new Date(interview.createdAt.toDate()) : 
                        new Date(interview.createdAt);
                    const dateStr = createdDate.toLocaleDateString();
                    const timeStr = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    lastUpdatedText = `Created ${dateStr} ${timeStr}`;
                } catch (error) {
                    console.warn(`Error formatting creation date for interview ${interviewItem.id}:`, error);
                    lastUpdatedText = 'Created recently';
                }
            } else {
                lastUpdatedText = 'Date unknown';
            }

            // Format completion stats
            if (interviewItem.completedCount > 0 || interviewItem.partialCount > 0) {
                const parts = [];
                if (interviewItem.completedCount > 0) {
                    const plural = interviewItem.completedCount === 1 ? 'interview' : 'interviews';
                    parts.push(`${interviewItem.completedCount} ${plural} completed`);
                }
                if (interviewItem.partialCount > 0) {
                    const plural = interviewItem.partialCount === 1 ? 'interview' : 'interviews';
                    parts.push(`${interviewItem.partialCount} ${plural} in progress`);
                }
                statsText = parts.join(', ');
            } else {
                statsText = 'No interviews started';
            }

            // Add ownership indicator
            const ownershipIndicator = interviewItem.isOwner ? '' : '<span class="text-xs text-blue-400 font-medium">Shared</span>';
            
            // Add "new" indicator for recently created interviews
            const isRecentlyCreated = interviewItem.completedCount === 0 && interviewItem.createdAt && (() => {
                const createdDate = interviewItem.createdAt.toDate ? interviewItem.createdAt.toDate() : new Date(interviewItem.createdAt);
                const hoursSinceCreation = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60);
                return hoursSinceCreation <= 24;
            })();
            const newIndicator = isRecentlyCreated ? '<span class="text-xs text-green-400 font-medium">New</span>' : '';
            
            // Add sample indicator for onboarding interviews
            const sampleIndicator = interview.isOnboardingSample ? '<span class="text-xs text-yellow-400 font-medium">Sample</span>' : '';

            // Build dropdown menu based on ownership
            let dropdownItems = '';
            if (interviewItem.isOwner) {
                dropdownItems = `
                    <button class="edit-btn block w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600" data-id="${interviewItem.id}">Edit</button>
                    <button class="share-btn block w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600" data-id="${interviewItem.id}">Share</button>
                    <button class="copy-btn block w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600" data-url="${interviewUrl}">Copy URL</button>
                    <button class="add-to-templates-btn block w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600" data-id="${interviewItem.id}">Add to templates</button>`;
                
                // Add "Create interview from responses" option if there are completed interviews
                if (interviewItem.completedCount > 0) {
                    dropdownItems += `
                    <button class="create-from-responses-btn block w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600" data-id="${interviewItem.id}" data-title="${interview.title || 'Untitled Interview'}">Create interview from responses</button>`;
                }
                
                dropdownItems += `
                    <button class="delete-btn block w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-gray-600 hover:text-red-300" data-id="${interviewItem.id}">Delete</button>
                `;
            } else {
                dropdownItems = `
                    <button class="edit-btn block w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600" data-id="${interviewItem.id}">Edit</button>
                    <button class="copy-btn block w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600" data-url="${interviewUrl}">Copy URL</button>
                `;
                
                // Add "Create interview from responses" option for shared interviews too if there are completed interviews
                if (interviewItem.completedCount > 0) {
                    dropdownItems += `
                    <button class="create-from-responses-btn block w-full text-left px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-600" data-id="${interviewItem.id}" data-title="${interview.title || 'Untitled Interview'}">Create interview from responses</button>`;
                }
            }

            card.innerHTML = `
                <div class="flex justify-between items-start">
                                     <div class="flex-grow overflow-hidden mr-2">
                         <div class="flex items-center gap-2">
                             <h3 class="interview-title">${interview.title || 'Untitled Interview'}</h3>
                             ${sampleIndicator}
                             ${newIndicator}
                             ${ownershipIndicator}
                         </div>
                        <div class="interview-stats mt-1">
                            <p class="text-xs text-gray-400 font-medium">${statsText}</p>
                            <p class="text-xs text-gray-500">${lastUpdatedText}</p>
                        </div>
                    </div>
                    <div class="ellipsis-menu flex-shrink-0">
                        <button class="ellipsis-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                        </button>
                        <div class="ellipsis-dropdown hidden absolute right-0 mt-1 w-36 bg-gray-700 rounded-md shadow-lg z-20 py-1">
                            ${dropdownItems}
                        </div>
                    </div>
                </div>
            `;
            interviewsList.appendChild(card);
        });
        
        // Add loading indicator at the end if there are more interviews
        if (hasMoreInterviews && !isSearchMode && !forceLoadAll) {
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'interview-card loading-more-indicator animate-fade-in';
            loadingIndicator.innerHTML = '<p class="text-sm text-gray-500">Scroll for more...</p>';
            interviewsList.appendChild(loadingIndicator);
        }

        // Reapply search filter if there's an active search
        const searchInput = document.getElementById('interviewSearchInput');
        if (searchInput && searchInput.value.trim()) {
            filterInterviewCards(searchInput.value.trim().toLowerCase());
        }
        
        isLoadingInterviews = false;

    } catch (error) {
        console.error('Error loading interviews:', error);
        if (!append) {
            interviewsList.innerHTML = `<div class="interview-card"><p class="text-red-500">Error loading interviews: ${error.message}</p></div>`;
        }
        isLoadingInterviews = false;
        hasMoreInterviews = false;
    }
}

// Load more interviews when scrolling near the bottom
function handleInterviewsScroll() {
    const sidebar = document.querySelector('.sidebar-content');
    if (!sidebar || !hasMoreInterviews || isLoadingInterviews || isSearchMode) return;
    
    const scrollBottom = sidebar.scrollTop + sidebar.clientHeight;
    const scrollThreshold = sidebar.scrollHeight - 100; // Load more when within 100px of bottom
    
    if (scrollBottom >= scrollThreshold) {
        loadInterviews(true); // Append more interviews
    }
}

// Backfill statistics for a single template
async function backfillSingleTemplateStatistics(templateId) {
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    if (!db || !auth.currentUser) {
        console.error('Firebase not available or user not authenticated');
        return;
    }
    
    try {
        console.log(`Backfilling statistics for template: ${templateId}`);
        
        // Get the template data
        const templateDoc = await db.collection('templates').doc(templateId).get();
        
        if (!templateDoc.exists) {
            console.error(`Template ${templateId} not found for backfill`);
            return;
        }
        
        const templateData = templateDoc.data();
        
        // Count interviews created from this template
        const interviewsFromTemplate = await db.collection('interviews')
            .where('sourceTemplateId', '==', templateId)
            .get();
        
        const totalCreated = interviewsFromTemplate.size;
        console.log(`  - Found ${totalCreated} interviews created from this template`);
        
        // Count completed interviews from this template AND from the original interview
        let totalCompleted = 0;
        let lastCompletedAt = null;
        let lastUsedAt = null;
        
        // Track interviews created from template
        for (const interviewDoc of interviewsFromTemplate.docs) {
            const interviewData = interviewDoc.data();
            const interviewId = interviewDoc.id;
            
            // Update lastUsedAt based on interview creation time
            if (interviewData.createdAt) {
                if (!lastUsedAt || interviewData.createdAt.toDate() > lastUsedAt.toDate()) {
                    lastUsedAt = interviewData.createdAt;
                }
            }
            
            // Check for completed reports for this interview
            const reportsSnapshot = await db.collection('reports')
                .where('interview_id', '==', interviewId)
                .where('status', '==', 'completed')
                .get();
            
            if (!reportsSnapshot.empty) {
                totalCompleted += reportsSnapshot.size;
                
                // Find the most recent completion
                reportsSnapshot.forEach(reportDoc => {
                    const reportData = reportDoc.data();
                    const completionTime = reportData.end_timestamp || reportData.start_timestamp;
                    
                    if (completionTime && (!lastCompletedAt || completionTime.toDate() > lastCompletedAt.toDate())) {
                        lastCompletedAt = completionTime;
                    }
                });
            }
        }
        
        // Also count completed interviews from the original interview ID
        if (templateData.originalInterviewId) {
            console.log(`  - Checking completions for original interview: ${templateData.originalInterviewId}`);
            const originalReportsSnapshot = await db.collection('reports')
                .where('interview_id', '==', templateData.originalInterviewId)
                .where('status', '==', 'completed')
                .get();
            
            if (!originalReportsSnapshot.empty) {
                const originalCompletions = originalReportsSnapshot.size;
                totalCompleted += originalCompletions;
                console.log(`  - Found ${originalCompletions} completions from original interview`);
                
                // Find the most recent completion from original interview
                originalReportsSnapshot.forEach(reportDoc => {
                    const reportData = reportDoc.data();
                    const completionTime = reportData.end_timestamp || reportData.start_timestamp;
                    
                    if (completionTime && (!lastCompletedAt || completionTime.toDate() > lastCompletedAt.toDate())) {
                        lastCompletedAt = completionTime;
                    }
                });
            }
        }
        
        console.log(`  - Found ${totalCompleted} completed interviews`);
        
        // Update the template with calculated statistics
        const updateData = {
            'usageStats.totalInterviewsCreated': totalCreated,
            'usageStats.totalInterviewsCompleted': totalCompleted
        };
        
        if (lastUsedAt) {
            updateData['usageStats.lastUsedAt'] = lastUsedAt;
        }
        
        if (lastCompletedAt) {
            updateData['usageStats.lastCompletedAt'] = lastCompletedAt;
        }
        
        await db.collection('templates').doc(templateId).update(updateData);
        
        console.log(`  - Updated template ${templateId} with stats: ${totalCreated} created, ${totalCompleted} completed`);
        
    } catch (error) {
        console.error('Error during single template statistics backfill:', error);
        throw error; // Re-throw to be caught by the caller
    }
}

// Add interview to templates collection
async function addInterviewToTemplates(interviewId) {
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    if (!db || !auth.currentUser) {
        alert('Error: Firebase not available or user not authenticated.');
        return;
    }
    
    try {
        // Get the interview data
        const interviewDoc = await db.collection('interviews').doc(interviewId).get();
        
        if (!interviewDoc.exists) {
            alert('Error: Interview not found.');
            return;
        }
        
        const interviewData = interviewDoc.data();
        
        // Get the current user's organization
        let userOrganization = null;
        try {
            const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                userOrganization = userData.organization || null;
            }
        } catch (error) {
            console.warn('Error fetching user organization:', error);
        }
        
        // Prepare the template data (copy the entire interview spec)
        const templateData = {
            ...interviewData,
            // Add template-specific metadata
            originalInterviewId: interviewId,
            templateCreatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            templateCreatedBy: auth.currentUser.uid,
            templateCreatedByEmail: auth.currentUser.email,
            // Update the title to indicate it's a template
            title: `${interviewData.title || 'Untitled Interview'} (Template)`,
            // Ensure category is included
            category: interviewData.category || '',
            // Remove fields that shouldn't be copied to templates
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: auth.currentUser.uid,
            sharedWith: [], // Reset sharing for the template
            // Add usage tracking fields
            usageStats: {
                totalInterviewsCreated: 0,
                totalInterviewsCompleted: 0,
                lastUsedAt: null,
                lastCompletedAt: null
            }
        };
        
        // Add organization if available
        if (userOrganization) {
            templateData.organization = userOrganization;
        }
        
        // Add to templates collection
        const templateRef = await db.collection('templates').add(templateData);
        
        console.log(`Interview "${interviewData.title}" added to templates with ID: ${templateRef.id}`);
        
        // Automatically backfill the interview count for this new template
        try {
            await backfillSingleTemplateStatistics(templateRef.id);
            console.log(`Successfully backfilled statistics for template ${templateRef.id}`);
        } catch (backfillError) {
            console.error('Error during automatic backfill (template creation still successful):', backfillError);
            // Don't throw the error - template creation was successful
        }
        
        alert(`Interview "${interviewData.title}" successfully added to templates!`);
        
    } catch (error) {
        console.error('Error adding interview to templates:', error);
        alert(`Error adding interview to templates: ${error.message}`);
    }
}

// Export additional functions for global use
window.deleteFileFromStorage = deleteFileFromStorage;
window.deleteInterview = deleteInterview;
function refreshInterviewsList() {
    // Reset pagination and clear cache so we fetch fresh data from Firestore
    currentPage = 0;
    hasMoreInterviews = true;
    displayedInterviewIds.clear();
    cachedAllInterviews = null;
    lastCacheTime = null;

    loadInterviews(false, false);
}

// Cache for Q&A carousel data
const qaCarouselCache = new Map();
const QA_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

// Intersection observer for lazy loading carousels
let carouselObserver = null;

function initializeCarouselObserver() {
    if (carouselObserver) return;
    
    carouselObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const card = entry.target;
                const interviewId = card.querySelector('.qa-carousel-container')?.dataset.interviewId;
                if (interviewId) {
                    loadInterviewQACarousel(interviewId);
                    carouselObserver.unobserve(card);
                }
            }
        });
    }, {
        rootMargin: '50px' // Start loading 50px before card becomes visible
    });
}

function observeCardForLazyLoading(card, interviewId) {
    if (!carouselObserver) {
        initializeCarouselObserver();
    }
    carouselObserver.observe(card);
}

// Simple throttle mechanism for carousel loading
const carouselLoadThrottle = {
    activeLoads: 0,
    maxConcurrent: 2,
    queue: []
};

// Q&A Carousel functionality for Interviews Tab - Multiple carousels
async function loadInterviewTabQACarousels(interviewId, reportList) {
    const container = document.getElementById('interviewQACarouselContainer');
    if (!container) return;
    
    // Clear container
    container.innerHTML = '';
    
    // Reset throttle
    carouselLoadThrottle.activeLoads = 0;
    carouselLoadThrottle.queue = [];
    
    try {
        // Use the reportList passed from responses-tab.js
        if (!reportList || reportList.length === 0) {
            container.innerHTML = '<div class="text-sm text-gray-500">No responses yet</div>';
            return;
        }
        
        // Get all reports with valid responses
        const validReports = reportList.filter(report => report.hasValidResponses !== false);
        if (validReports.length === 0) {
            container.innerHTML = '<div class="text-sm text-gray-500">No valid responses available</div>';
            return;
        }
        
        // Create placeholders for lazy loading
        validReports.forEach((report, index) => {
            const placeholder = document.createElement('div');
            placeholder.className = 'report-carousel-placeholder mb-6';
            placeholder.dataset.reportId = report.id;
            placeholder.dataset.reportIndex = index;
            placeholder.innerHTML = `
                <div class="carousel-loading p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div class="animate-pulse">
                        <div class="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                        <div class="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                </div>
            `;
            container.appendChild(placeholder);
        });
        
        // Set up intersection observer for lazy loading
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const placeholder = entry.target;
                        const reportId = placeholder.dataset.reportId;
                        const reportIndex = parseInt(placeholder.dataset.reportIndex);
                        const report = validReports[reportIndex];
                        
                        if (report && !placeholder.classList.contains('loading')) {
                            placeholder.classList.add('loading');
                            observer.unobserve(placeholder);
                            
                            // Throttle the loading
                            const loadCarousel = async () => {
                                // Wait if we're at max concurrent loads
                                while (carouselLoadThrottle.activeLoads >= carouselLoadThrottle.maxConcurrent) {
                                    await new Promise(resolve => setTimeout(resolve, 100));
                                }
                                
                                carouselLoadThrottle.activeLoads++;
                                try {
                                    await loadSingleReportCarousel(report, placeholder, true);
                                    // Add a small delay after each load
                                    await new Promise(resolve => setTimeout(resolve, 200));
                                } catch (error) {
                                    console.error(`Error loading carousel for report ${reportId}:`, error);
                                    placeholder.innerHTML = '<div class="text-sm text-gray-500 p-4">Failed to load responses</div>';
                                } finally {
                                    carouselLoadThrottle.activeLoads--;
                                }
                            };
                            
                            loadCarousel();
                        }
                    }
                });
            },
            {
                root: null,
                rootMargin: '100px',
                threshold: 0.1
            }
        );
        
        // Observe all placeholders
        container.querySelectorAll('.report-carousel-placeholder').forEach(placeholder => {
            observer.observe(placeholder);
        });
        
        // Load first 3 carousels immediately with throttling
        const initialLoadCount = Math.min(3, validReports.length);
        const initialLoads = [];
        
        for (let i = 0; i < initialLoadCount; i++) {
            const placeholder = container.querySelector(`[data-report-index="${i}"]`);
            if (placeholder && !placeholder.classList.contains('loading')) {
                placeholder.classList.add('loading');
                observer.unobserve(placeholder);
                
                const loadCarousel = async (report, placeholder) => {
                    // Wait if we're at max concurrent loads
                    while (carouselLoadThrottle.activeLoads >= carouselLoadThrottle.maxConcurrent) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    
                    carouselLoadThrottle.activeLoads++;
                    try {
                        await loadSingleReportCarousel(report, placeholder, true);
                        // Add a small delay after each load
                        await new Promise(resolve => setTimeout(resolve, 200));
                    } finally {
                        carouselLoadThrottle.activeLoads--;
                    }
                };
                
                initialLoads.push(loadCarousel(validReports[i], placeholder));
            }
        }
        
        // Wait for initial loads to complete
        await Promise.all(initialLoads);
        
    } catch (error) {
        console.error('Error loading Q&A carousels:', error);
        container.innerHTML = '<div class="text-sm text-gray-500">Q&A preview unavailable</div>';
    }
}

// Load a single report's carousel
async function loadSingleReportCarousel(report, targetElement, replacePlaceholder = false) {
    const carouselId = `tab-${report.id}`;
    
    // Check cache first
    const cacheKey = `qa-report-${report.id}`;
    const cached = qaCarouselCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < QA_CACHE_DURATION) {
        if (replacePlaceholder) {
            targetElement.className = 'report-carousel-wrapper mb-6';
            targetElement.innerHTML = cached.html;
        } else {
            const carouselWrapper = document.createElement('div');
            carouselWrapper.className = 'report-carousel-wrapper mb-6';
            carouselWrapper.innerHTML = cached.html;
            targetElement.appendChild(carouselWrapper);
        }
        initializeCarouselEvents(carouselId);
        return;
    }
    
    try {
        // Fetch responses for this report
        const responsesResponse = await fetch(`/api/reports/${report.id}/responses`);
        if (!responsesResponse.ok) throw new Error('Failed to fetch responses');
        
        const responsesData = await responsesResponse.json();
        console.log(`Responses for report ${report.id}:`, responsesData);
        
        // The API returns { responses: [...] }
        const responses = Array.isArray(responsesData) ? responsesData : responsesData.responses;
        
        if (!responses || !Array.isArray(responses) || responses.length === 0) {
            if (replacePlaceholder) {
                targetElement.innerHTML = '<div class="text-sm text-gray-500 p-4">No responses available</div>';
            }
            return; // Skip reports with no responses
        }
        
        // Create carousel HTML for this report
        const carouselHTML = createTabQACarouselHTML(responses, report.id, report);
        
        // Add to container
        if (replacePlaceholder) {
            targetElement.className = 'report-carousel-wrapper mb-6';
            targetElement.innerHTML = carouselHTML;
        } else {
            const carouselWrapper = document.createElement('div');
            carouselWrapper.className = 'report-carousel-wrapper mb-6';
            carouselWrapper.innerHTML = carouselHTML;
            targetElement.appendChild(carouselWrapper);
        }
        
        // Cache the result
        qaCarouselCache.set(cacheKey, {
            html: carouselHTML,
            timestamp: Date.now()
        });
        
        // Initialize carousel event listeners
        initializeCarouselEvents(carouselId);
        
    } catch (error) {
        console.error(`Error loading carousel for report ${report.id}:`, error);
        if (replacePlaceholder) {
            targetElement.innerHTML = '<div class="text-sm text-gray-500 p-4">Failed to load responses</div>';
        }
    }
}

// Helper function to escape HTML - defined outside to avoid duplication
function escapeHtmlForCarousel(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function createTabQACarouselHTML(responses, interviewId, report) {
    const carouselId = `carousel-tab-${interviewId}`;
    
    // Show all Q&A pairs without limitation
    const allResponses = responses;
    
    // Create carousel items
    const items = allResponses.map((response, index) => {
        // Clean question text by removing <question> tags
        const cleanQuestion = (response.question || '').replace(/<\/?question>/gi, '').trim();
        
        // Truncate answer to show more in the tab view
        const answerPreview = truncateAnswer(response.answer || '', 250);
        
        // Determine media element (video or audio)
        let mediaElement = '';
        if (response.video_signed_url) {
            // Log video URL for debugging
            console.log('Creating video element with URL:', response.video_signed_url);
            mediaElement = `
                <div class="qa-media-container mb-3">
                    <video class="qa-video-tab" controls preload="metadata" playsinline style="width: 100%; max-height: 300px;">
                        <source src="${response.video_signed_url}" type="video/mp4">
                        <source src="${response.video_signed_url}" type="video/webm">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `;
        } else if (response.audio_signed_url) {
            mediaElement = `
                <div class="qa-media-container mb-3">
                    <audio class="qa-audio-tab" controls preload="metadata" style="width: 100%;">
                        <source src="${response.audio_signed_url}" type="audio/mpeg">
                    </audio>
                </div>
            `;
        }
        
        return `
            <div class="carousel-item ${index === 0 ? 'active' : ''}" data-index="${index}" data-question="${escapeHtmlForCarousel(cleanQuestion)}">
                <div class="qa-content-tab">
                    ${mediaElement}
                    <p class="text-sm text-gray-400 leading-relaxed mb-3 ${mediaElement ? 'mt-3' : ''}">A: ${escapeHtmlForCarousel(answerPreview)}</p>
                    <button class="view-carousel-details-btn text-xs py-1 px-3" 
                            data-report-id="${report.id}" 
                            title="Read full interview response"
                            style="background-color: var(--bg-tertiary); color: var(--text-primary); border: 1px solid var(--border-color); border-radius: 0.25rem; padding: 0.25rem 0.75rem; cursor: pointer; transition: all 0.2s ease;">
                        Read more
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    
    // Add respondent info and metadata
    let metadata = '';
    if (report) {
        // Format timestamp
        let reportDate = 'Date N/A';
        const timestampSource = report.start_timestamp || report.timestamp;
        if (timestampSource) {
            try {
                const dateObj = typeof timestampSource.toDate === 'function'
                    ? timestampSource.toDate()
                    : new Date(timestampSource);
                reportDate = dateObj.toLocaleString(undefined, {
                    year: 'numeric', month: 'long', day: 'numeric', 
                    hour: '2-digit', minute: '2-digit'
                });
            } catch (e) {
                console.warn("Could not parse report timestamp:", timestampSource, e);
            }
        }
        
        // Calculate duration if available
        let durationText = '';
        if (report.start_timestamp && report.end_timestamp) {
            try {
                const startDate = typeof report.start_timestamp.toDate === 'function' 
                    ? report.start_timestamp.toDate() 
                    : new Date(report.start_timestamp);
                const endDate = typeof report.end_timestamp.toDate === 'function' 
                    ? report.end_timestamp.toDate() 
                    : new Date(report.end_timestamp);
                const durationMs = endDate - startDate;
                if (durationMs > 0) {
                    const durationMinutes = Math.round(durationMs / (1000 * 60));
                    durationText = `${durationMinutes} min`;
                }
            } catch (e) {
                console.warn('Error calculating duration:', e);
            }
        }
        
        metadata = `
            <div class="carousel-metadata pb-4 mb-4">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="text-lg font-semibold text-white mb-1">${escapeHtmlForCarousel(report.userName || 'Anonymous')}</h3>
                        <p class="text-sm text-gray-400 mb-1">${escapeHtmlForCarousel(report.userEmail || 'No email provided')}</p>
                        <p class="text-xs text-gray-500">Taken: ${reportDate}</p>
                    </div>
                    <div class="text-right">
                        <div class="flex items-start gap-2">
                            <div>
                                <div class="text-sm text-gray-300 mb-1">${allResponses.length} responses</div>
                                ${durationText ? `<div class="text-xs text-gray-500 mb-2">Duration: ${durationText}</div>` : ''}
                            </div>
                        </div>
                        ${allResponses.length > 1 ? `
                            <div class="carousel-nav-inline flex items-center justify-end gap-2 mt-2">
                                <button class="carousel-prev-tab" data-carousel="carousel-tab-${interviewId}">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                                <span class="carousel-counter text-xs text-gray-500">1 / ${allResponses.length}</span>
                                <button class="carousel-next-tab" data-carousel="carousel-tab-${interviewId}">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                        <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    // Build inline navigation if more than one item
    let inlineNavHTML = '';
    // Navigation is now in the metadata section above
    
    return `
        <div class="qa-carousel-tab bg-gray-800 rounded-lg p-6" id="${carouselId}">
            ${metadata}
            <div class="carousel-wrapper">
                <div class="carousel-question-section">
                    <p class="text-base font-medium text-gray-200 mb-3 carousel-question">Q: ${allResponses[0] ? escapeHtmlForCarousel((allResponses[0].question || '').replace(/<\/?question>/gi, '').trim()) : ''}</p>
                    ${inlineNavHTML}
                </div>
                <div class="carousel-inner">
                    ${items}
                </div>
            </div>
        </div>
    `;
}

function createQACarouselHTML(responses, interviewId, report) {
    const carouselId = `carousel-${interviewId}`;
    
    // Show all Q&A pairs without limitation
    const allResponses = responses;
    
    // Create carousel items
    const items = allResponses.map((response, index) => {
        // Clean question text by removing <question> tags
        const cleanQuestion = (response.question || '').replace(/<\/?question>/gi, '').trim();
        
        // Truncate answer to first few sentences
        const answerPreview = truncateAnswer(response.answer || '', 120);
        
        // Determine media element (video or audio)
        let mediaElement = '';
        if (response.video_signed_url) {
            console.log('Creating carousel video element with URL:', response.video_signed_url);
            mediaElement = `
                <div class="qa-media-container">
                    <video class="qa-video" controls preload="none" playsinline width="100%">
                        <source src="${response.video_signed_url}" type="video/mp4">
                        <source src="${response.video_signed_url}" type="video/webm">
                        Your browser does not support the video tag.
                    </video>
                </div>
            `;
        } else if (response.audio_signed_url) {
            mediaElement = `
                <div class="qa-media-container">
                    <audio class="qa-audio" controls preload="none">
                        <source src="${response.audio_signed_url}" type="audio/mpeg">
                    </audio>
                </div>
            `;
        }
        
        return `
            <div class="carousel-item ${index === 0 ? 'active' : ''}" data-index="${index}">
                ${mediaElement}
                <div class="qa-content">
                    <p class="text-xs font-medium text-gray-300 mb-1">Q: ${escapeHtmlForCarousel(cleanQuestion)}</p>
                    <p class="text-xs text-gray-400">A: ${escapeHtmlForCarousel(answerPreview)}</p>
                </div>
            </div>
        `;
    }).join('');
    
    // Navigation dots (only show if more than 1 item)
    let navigationHTML = '';
    if (allResponses.length > 1) {
        const dots = allResponses.map((_, index) => 
            `<button class="carousel-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></button>`
        ).join('');
        
        navigationHTML = `
            <div class="carousel-nav">
                <button class="carousel-prev" data-carousel="${carouselId}">‹</button>
                <div class="carousel-dots">${dots}</div>
                <button class="carousel-next" data-carousel="${carouselId}">›</button>
            </div>
        `;
    }
    
    // Add respondent info if available
    let respondentInfo = '';
    if (report && report.userName) {
        respondentInfo = `<div class="text-xs text-gray-500 mb-2">Respondent: ${escapeHtmlForCarousel(report.userName)}</div>`;
    }
    
    return `
        <div class="qa-carousel" id="${carouselId}">
            ${respondentInfo}
            <div class="carousel-inner">
                ${items}
            </div>
            ${navigationHTML}
        </div>
    `;
}

function truncateAnswer(answer, maxLength) {
    if (answer.length <= maxLength) return answer;
    
    // Try to cut at sentence boundary
    const truncated = answer.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastExclamation = truncated.lastIndexOf('!');
    
    const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
    
    if (lastSentenceEnd > maxLength * 0.5) {
        return truncated.substring(0, lastSentenceEnd + 1);
    }
    
    return truncated.trim() + '...';
}

function initializeCarouselEvents(carouselId) {
    const carousel = document.getElementById(`carousel-${carouselId}`);
    if (!carousel) return;
    
    const items = carousel.querySelectorAll('.carousel-item');
    const dots = carousel.querySelectorAll('.carousel-dot');
    const prevBtn = carousel.querySelector('.carousel-prev, .carousel-prev-tab');
    const nextBtn = carousel.querySelector('.carousel-next, .carousel-next-tab');
    
    let currentIndex = 0;
    
    // Add error handling for video elements
    const videos = carousel.querySelectorAll('video');
    videos.forEach((video, index) => {
        video.addEventListener('error', (e) => {
            console.error('Video playback error:', {
                error: e,
                videoSrc: video.querySelector('source')?.src,
                videoIndex: index,
                errorCode: video.error?.code,
                errorMessage: video.error?.message
            });
        });
        
        video.addEventListener('loadedmetadata', () => {
            console.log('Video metadata loaded:', {
                src: video.querySelector('source')?.src,
                duration: video.duration,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight
            });
        });
        
        video.addEventListener('canplay', () => {
            console.log('Video can play:', video.querySelector('source')?.src);
        });
        
        // Add click handler to manually trigger play if controls aren't working
        video.addEventListener('click', (e) => {
            if (video.paused) {
                video.play().catch(error => {
                    console.error('Error playing video:', error);
                });
            } else {
                video.pause();
            }
        });
    });
    
    function showItem(index) {
        // Hide all items
        items.forEach(item => item.classList.remove('active'));
        dots.forEach(dot => dot.classList.remove('active'));
        
        // Show selected item
        if (items[index]) {
            items[index].classList.add('active');
            currentIndex = index;
            
            // Update question text
            const question = items[index].dataset.question;
            const questionElement = carousel.querySelector('.carousel-question');
            if (questionElement && question) {
                questionElement.innerHTML = `Q: ${question}`;
            }
            
            // Update counter
            const counter = carousel.querySelector('.carousel-counter');
            if (counter) {
                counter.textContent = `${index + 1} / ${items.length}`;
            }
        }
        if (dots[index]) {
            dots[index].classList.add('active');
        }
        
        // Pause any playing media
        carousel.querySelectorAll('video, audio').forEach(media => {
            if (!media.paused) media.pause();
        });
    }
    
    // Previous button
    prevBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        showItem(newIndex);
    });
    
    // Next button
    nextBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        const newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        showItem(newIndex);
    });
    
    // Dot navigation
    dots.forEach((dot, index) => {
        dot.addEventListener('click', (e) => {
            e.stopPropagation();
            showItem(index);
        });
    });
    
    // Keyboard navigation when carousel is focused
    carousel.setAttribute('tabindex', '0');
    carousel.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            const newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
            showItem(newIndex);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            const newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
            showItem(newIndex);
        }
    });
    
    // View Details button functionality - attach to all buttons
    const viewDetailsBtns = carousel.querySelectorAll('.view-carousel-details-btn');
    viewDetailsBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const reportId = btn.dataset.reportId;
            if (reportId) {
                // Open the report detail panel
                if (window.appState) {
                    window.appState.setReportDetailPanelOpen(true, reportId);
                    window.appState.setReportDetailPanelTab('interviewContent');
                }
                if (window.applyReportDetailPanelState) {
                    window.applyReportDetailPanelState();
                }
                if (window.showReportDetailsGlobal) {
                    window.showReportDetailsGlobal(reportId);
                }
            }
        });
    });
}

window.loadInterviewsGlobal = loadInterviews;
window.refreshInterviewsList = refreshInterviewsList;
window.addInterviewToTemplates = addInterviewToTemplates;
window.backfillSingleTemplateStatistics = backfillSingleTemplateStatistics;
window.loadInterviewTabQACarousels = loadInterviewTabQACarousels;