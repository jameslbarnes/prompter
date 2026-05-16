// URL Hash Management

let isProcessingHashChange = false; // Flag to prevent re-entry

function updateUrlForInterview(interviewId, emailFilter = null) {
    let newHash = '';
    if (interviewId) {
        newHash = `interview=${interviewId}`;
    } else if (appState.isJournalAnalysisMode) {
        newHash = 'journal';
        // Add email filter to journal hash if specified and not 'all'
        if (emailFilter && emailFilter !== 'all') {
            newHash += `&email=${encodeURIComponent(emailFilter)}`;
        }
    } else if (appState.uiState.templatesPanel.isOpen) {
        newHash = 'templates';
    }
    
    if (window.location.hash.substring(1) !== newHash) {
        isProcessingHashChange = true; // Set flag before changing hash
        window.location.hash = newHash;
        // The 'hashchange' event will fire, and handleHashChange will run.
        // Reset the flag after a short delay to allow event processing.
        setTimeout(() => { isProcessingHashChange = false; }, 0);
    }
}

async function handleHashChange() {
    if (isProcessingHashChange) {
        return;
    }

    const hash = window.location.hash.substring(1); // Remove #
    let interviewIdFromHash = null;

    if (hash.startsWith('interview=')) {
        interviewIdFromHash = hash.substring('interview='.length);
    } else if (hash === 'journal' || hash.startsWith('journal&')) {
        // Handle journal view restoration with optional email filter
        if (auth.currentUser && !appState.isJournalAnalysisMode) {
            console.log('[handleHashChange] Restoring journal view from URL hash');
            if (window.showJournalView) {
                await window.showJournalView();
            }
        }
        
        // Parse and restore email filter if present
        if (hash.includes('&email=')) {
            const emailMatch = hash.match(/&email=([^&]*)/);
            if (emailMatch) {
                const emailFilter = decodeURIComponent(emailMatch[1]);
                console.log('[handleHashChange] Restoring email filter from URL:', emailFilter);
                
                // Set the dropdown value and trigger the filter change
                const emailFilterDropdown = document.getElementById('emailFilterDropdown');
                if (emailFilterDropdown) {
                    const optionExists = emailFilterDropdown.querySelector(`option[value="${emailFilter}"]`);
                    if (optionExists) {
                        emailFilterDropdown.value = emailFilter;
                        if (window.handleEmailFilterChange) {
                            window.handleEmailFilterChange(true);
                        }
                    } else {
                        console.warn('[handleHashChange] Email filter from URL not found in dropdown options:', emailFilter);
                    }
                } else {
                    console.warn('[handleHashChange] Email filter dropdown not found');
                }
            }
        }
        return;
    } else if (hash === 'templates') {
        // Handle templates panel opening
        if (auth.currentUser && !appState.uiState.templatesPanel.isOpen) {
            console.log('[handleHashChange] Opening templates panel from URL hash');
            appState.setTemplatesPanelOpen(true);
            if (window.applyTemplatesPanelState) {
                window.applyTemplatesPanelState();
            }
        }
        return;
    }

    if (interviewIdFromHash) {
        if (interviewIdFromHash !== appState.currentEditingInterviewId) {
            // Ensure user is authenticated before trying to load
            if (auth.currentUser) {
                await loadInterviewForEditing(interviewIdFromHash);
            } else {
                // The auth state change listener will call this function again.
            }
        }
    } else { // No interviewId in hash (empty or different format)
        if (appState.currentEditingInterviewId !== null || appState.isJournalAnalysisMode) {
            resetToNewInterviewStateUI(true); // Reset UI without changing hash again
        } else {
            // If it's truly the initial load and no interview is specified,
            // ensure the default "new interview" state is shown.
            if (auth.currentUser && !appState.currentEditingInterviewId) {
                resetToNewInterviewStateUI(true); // Ensure clean state on initial load with empty hash
            }
        }
    }
}

// Listen for hash changes
window.addEventListener('hashchange', handleHashChange);

// Handle hash on initial page load
window.addEventListener('load', () => {
    // Small delay to ensure all modules are initialized
    setTimeout(() => {
        handleHashChange();
    }, 100);
});

// Function to update URL when email filter changes in journal view
function updateUrlForEmailFilter(emailFilter) {
    if (appState.isJournalAnalysisMode) {
        updateUrlForInterview(null, emailFilter);
    }
}

// Export functions for global use
window.updateUrlForInterview = updateUrlForInterview;
window.updateUrlForEmailFilter = updateUrlForEmailFilter;
window.handleHashChange = handleHashChange; 