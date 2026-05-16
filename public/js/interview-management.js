// Interview Management Functions

// Function to load interview data for editing
window.loadInterviewForEditing = async function loadInterviewForEditing(id) {
    appState.setJournalAnalysisMode(false);
    appState.setCurrentEditingInterviewId(id);
    console.log('[admin.html] loadInterviewForEditing CALLED for id:', id);
    
    // Clear analyst data cache when switching interviews
    const cacheKey = `analyst_data_${id}`;
    delete window.appState[cacheKey];
    delete window.appState[`${cacheKey}_expiry`];
    console.log('[Interview Management] Cleared analyst cache for interview:', id);
    
    // Clear special report details cache
    if (window.clearResponsesCache) {
        window.clearResponsesCache(id);
    }
    
    // Clear audio response data store
    if (window.audioResponseDataStore) {
        window.audioResponseDataStore = {};
        console.log('[Interview Management] Cleared audio response data store');
    }
    
    // Don't set mode yet - will be determined after checking for responses
    appState.setCurrentInterviewTitleForHeader('');
    appState.setActiveSpecTab('spec-responses');

    // Hide journal thread tabs when switching to regular interview
    if (window.hideJournalThreadTabs) {
        window.hideJournalThreadTabs();
    }

    // Get references to config panel elements (will update after data is loaded)
    const configPanelHeaderTitle = document.querySelector('#configPanel .panel-custom-header .panel-header-title');
    const configPanelHeaderSubheadline = document.querySelector('#configPanel .panel-custom-header .panel-header-subheadline');

    const globalUserFilterContainerEl = document.getElementById('globalUserFilterContainer');
    if (globalUserFilterContainerEl) globalUserFilterContainerEl.classList.add('hidden');

    // Highlight the selected interview in the list
    document.querySelectorAll('#interviewsList .interview-card.selected').forEach(el => el.classList.remove('selected')); 
    if (window.showSpecificationDetails) window.showSpecificationDetails(); 
    if (window.resetResponsesTab) window.resetResponsesTab(); 

    const cardToSelect = document.querySelector(`#interviewsList .edit-btn[data-id="${id}"]`)?.closest('.interview-card');
    if (cardToSelect) {
        cardToSelect.classList.add('selected'); 
    }

    // Load chat history for the current mode
    if (window.loadChatHistory) {
        window.loadChatHistory(appState.currentEditingInterviewId, appState.copilotMode);
    } else {
        // Wait for chat-copilot module to load
        setTimeout(() => {
            if (window.loadChatHistory) {
                window.loadChatHistory(appState.currentEditingInterviewId, appState.copilotMode);
            }
        }, 100);
    }

    db.collection('interviews').doc(id).get()
        .then(async (doc) => { 
            if (doc.exists) {
                const data = doc.data();
                const fetchedInterviewTitle = (data.title && data.title.trim() !== '') ? data.title.trim() : 'Untitled Interview'; 
                
                // Update appState with fetched data
                appState.setCurrentInterviewTitleForHeader(fetchedInterviewTitle);
                
                // Update Config Panel Title with the actual interview title
                if (configPanelHeaderTitle) {
                    configPanelHeaderTitle.textContent = fetchedInterviewTitle;
                }
                if (configPanelHeaderSubheadline) {
                    configPanelHeaderSubheadline.style.display = 'none'; // Hide when interview is loaded
                }
                appState.setCurrentInterviewFiles(data.contextFiles || []);
                
                // Update copilot context indicator
                if (window.updateCopilotContextIndicator) {
                    window.updateCopilotContextIndicator();
                }
                
                appState.setInterviewSpec({
                    title: data.title || 'Untitled Interview',
                    description: data.description || '',
                    category: data.category || '',
                    purpose: data.purpose || '',
                    requiredInformation: data.requiredInformation || [],
                    initialPrompt: data.initialPrompt || '',
                    followupPrompt: data.followupPrompt || '',
                    reportPrompt: data.reportPrompt || '',
                    adminReportPrompt: data.adminReportPrompt || '',
            
                    pageHeaders: {
                        intro: data.indexHeader || 'AI Readiness Interview',
                        interview: data.indexSubheader || 'Tell us about your experience',
                        report: data.reportHeader || 'Personal AI Readiness Report',
                        reportSub: data.reportSubheader || 'Your personalized assessment'
                    },
                    hasExternalDocuments: data.hasExternalDocuments !== undefined ? data.hasExternalDocuments : false,
                    enableWebSearch: data.enableWebSearch !== undefined ? data.enableWebSearch : false,
                    enableThinking: data.enableThinking !== undefined ? data.enableThinking : true,
                    enableMemoryService: data.enableMemoryService !== undefined ? data.enableMemoryService : false,
                    followupModel: data.followupModel || 'claude-opus-4-5',
                    allowPublicGallery: data.allowPublicGallery !== undefined ? data.allowPublicGallery : false,
                    completionRedirectUrl: data.completionRedirectUrl || '',

                    enableVideoRecording: data.enableVideoRecording !== undefined ? data.enableVideoRecording : false,

                    exampleFollowupQuestion: data.exampleFollowupQuestion || '',
                    exampleReportContent: data.exampleReportContent || '',
        
                    exampleAdminReport: data.exampleAdminReport || '',
                    userNote: data.userNote || '',
                    contextFiles: appState.currentInterviewFiles
                });
                
                // Update UI from appState
                if (typeof window.updateSpecificationUIFromAppState === 'function') {
                    window.updateSpecificationUIFromAppState();
                } else {
                    console.error('[admin.html] loadInterviewForEditing: window.updateSpecificationUIFromAppState IS NOT a function!');
                }
                
                if (window.displaySavedFiles) window.displaySavedFiles(appState.currentInterviewFiles);
                
                // Update URL and Share Link
                let interviewUrlForShare = `${window.location.origin}/i/?interview=${appState.currentEditingInterviewId}`;
                let interviewUrlForPreview = `${window.location.origin}/i/?interview=${appState.currentEditingInterviewId}`;

                if (auth.currentUser) {
                    if (auth.currentUser.email) {
                        interviewUrlForPreview += `&adminEmail=${encodeURIComponent(auth.currentUser.email)}`;
                    }
                    const adminName = auth.currentUser.displayName || auth.currentUser.email?.split('@')[0];
                    if (adminName) {
                        interviewUrlForPreview += `&adminName=${encodeURIComponent(adminName)}`;
                    }
                }
                
                const shareUrlBtn = document.getElementById('shareUrlBtn');
                const openInterviewPreviewBtn = document.getElementById('openInterviewPreviewBtn');
                const saveCopilotInterview = document.getElementById('saveCopilotInterview');
                const saveCopilotInterviewFromFilesTab = document.getElementById('saveCopilotInterviewFromFilesTab');
                
                // Store the interview URL on the share button for copying
                if (shareUrlBtn) {
                    shareUrlBtn.setAttribute('data-share-url', interviewUrlForShare);
                    shareUrlBtn.classList.remove('hidden');
                }

                // Set the interview URL on the Begin Interview button
                const beginInterviewBtn = document.getElementById('beginInterviewBtn');
                if (beginInterviewBtn) {
                    beginInterviewBtn.setAttribute('data-url', interviewUrlForPreview);
                }
                if (window.setInterviewerActionsVisible) window.setInterviewerActionsVisible(true);
                
                // Update save buttons state
                if (saveCopilotInterview) {
                    saveCopilotInterview.setAttribute('data-editing-id', appState.currentEditingInterviewId);
                    saveCopilotInterview.textContent = 'Update Interview';
                    saveCopilotInterview.disabled = false;
                }
                if (saveCopilotInterviewFromFilesTab) {
                    saveCopilotInterviewFromFilesTab.setAttribute('data-editing-id', appState.currentEditingInterviewId);
                    saveCopilotInterviewFromFilesTab.textContent = 'Update Interview';
                    saveCopilotInterviewFromFilesTab.disabled = false;
                }

                if (window.fetchAndDisplayResponses) window.fetchAndDisplayResponses(appState.currentEditingInterviewId);
                window.updateHeaderInterviewTitle();
                if (window.updateUrlForInterview) window.updateUrlForInterview(appState.currentEditingInterviewId);
                if (window.applyActiveSpecTabFromState) window.applyActiveSpecTabFromState();
                
                // Refresh campaigns tab if it's active
                if (window.campaignsTab && window.campaignsTab.refreshIfActive) {
                    window.campaignsTab.refreshIfActive();
                }
                
                // Dispatch event for campaigns tab
                window.dispatchEvent(new CustomEvent('interviewLoaded', { 
                    detail: { interviewId: appState.currentEditingInterviewId }
                }));

                // Check for responses to determine initial mode
                const checkResponsesAndSetMode = async () => {
                    try {
                        // Use the cached function if available
                        let data;
                        if (window.getSpecialReportDetails) {
                            data = await window.getSpecialReportDetails(appState.currentEditingInterviewId);
                        } else {
                            // Fallback to direct fetch if the cached function isn't available yet
                            const response = await fetch(`/api/interview/${appState.currentEditingInterviewId}/special-report-details`);
                            if (!response.ok) throw new Error('Failed to fetch report details');
                            data = await response.json();
                        }
                        
                        const validResponses = data.reportList?.filter(report => report.hasValidResponses !== false) || [];
                        
                        // Set mode based on whether responses exist
                        if (validResponses.length > 0) {
                            console.log('[loadInterviewForEditing] Found responses, setting producer mode');
                            if (window.setCopilotMode) {
                                window.setCopilotMode('analyst');
                            } else {
                                appState.setCopilotMode('analyst');
                            }
                        } else {
                            console.log('[loadInterviewForEditing] No responses yet, setting builder mode');
                            if (window.setCopilotMode) {
                                window.setCopilotMode('editor');
                            } else {
                                appState.setCopilotMode('editor');
                            }
                        }
                    } catch (error) {
                        console.error('[loadInterviewForEditing] Error checking responses:', error);
                        // Default to editor mode if we can't check responses
                        if (window.setCopilotMode) {
                            window.setCopilotMode('editor');
                        } else {
                            appState.setCopilotMode('editor');
                        }
                    }
                };
                
                await checkResponsesAndSetMode();
                
                // Expand config panel when loading an interview (if it's collapsed)
                if (appState.uiState.configPanelCollapsed) {
                    appState.setConfigPanelCollapsed(false);
                }

            } else {
                alert('Interview not found');
                appState.setCurrentEditingInterviewId(null);
                appState.resetInterviewSpec();
                appState.setCurrentInterviewFiles([]);
                appState.setCurrentInterviewTitleForHeader('');
                if (window.displaySavedFiles) window.displaySavedFiles(appState.currentInterviewFiles); 
                window.updateHeaderInterviewTitle();
                if (window.updateCopilotContextIndicator) window.updateCopilotContextIndicator(); 
                
                if (window.setInterviewerActionsVisible) window.setInterviewerActionsVisible(false); 
                
                if (window.updateUrlForInterview) window.updateUrlForInterview(null); 
                if (window.showSpecificationNullState) window.showSpecificationNullState();
            }
        })
        .catch((error) => {
            alert(`Error loading interview: ${error.message}`);
            appState.setCurrentEditingInterviewId(null);
            appState.resetInterviewSpec();
            appState.setCurrentInterviewFiles([]);
            appState.setCurrentInterviewTitleForHeader('');
            if (window.displaySavedFiles) window.displaySavedFiles(appState.currentInterviewFiles); 
            window.updateHeaderInterviewTitle();
            if (window.updateCopilotContextIndicator) window.updateCopilotContextIndicator(); 
            if (window.updateUrlForInterview) window.updateUrlForInterview(null); 
            if (window.showSpecificationNullState) window.showSpecificationNullState();
        });
}

// Function to reset the UI to a new interview state
window.resetToNewInterviewStateUI = function(calledFromHashChange = false) {
    appState.setCurrentEditingInterviewId(null);
    appState.setCurrentInterviewTitleForHeader('');
    appState.setJournalAnalysisMode(false);
    appState.resetInterviewSpec();
    appState.setCopilotMode('editor');
    appState.setActiveSpecTab('spec-preview');
    
    // Scroll to the top of the interview builder
    window.scrollTo(0, 0);

    // Hide journal thread tabs when switching to new interview
    if (window.hideJournalThreadTabs) {
        window.hideJournalThreadTabs();
    }

    // Set Config Panel Title and Subheadline for new/reset state
    const configPanelHeaderTitle = document.querySelector('#configPanel .panel-custom-header .panel-header-title');
    const configPanelHeaderSubheadline = document.querySelector('#configPanel .panel-custom-header .panel-header-subheadline');
    if (configPanelHeaderTitle) {
        configPanelHeaderTitle.textContent = 'New Interviewer';
    }
    if (configPanelHeaderSubheadline) {
        configPanelHeaderSubheadline.textContent = 'Create a new interviewer guide from scratch.';
    }

    const globalUserFilterContainerEl = document.getElementById('globalUserFilterContainer');
    if (globalUserFilterContainerEl) globalUserFilterContainerEl.classList.add('hidden');

    // Hide journal view if it's open
    const journalViewContainer = document.getElementById('activityFeedContainer');
    const myJournalBtn = document.getElementById('myActivityBtn');
    if (journalViewContainer) journalViewContainer.classList.add('hidden');
    if (myJournalBtn) myJournalBtn.classList.remove('active-journal-button');

    // Handle Chat Messages
    const copilotMessagesEl = document.getElementById('copilotMessages');
    if (copilotMessagesEl) copilotMessagesEl.innerHTML = '';
    appState.clearInitialChatMessages();

    if (!calledFromHashChange) { 
        // Show clickable prompt cards instead of text message
        if (window.showCopilotPromptCards) window.showCopilotPromptCards();
    } else if (copilotMessagesEl && copilotMessagesEl.innerHTML.trim() === '') {
        // Show clickable prompt cards instead of text message
        if (window.showCopilotPromptCards) window.showCopilotPromptCards();
    }

    // Update UI elements
    if (window.updateSpecificationUIFromAppState) window.updateSpecificationUIFromAppState(); 
    if (window.displaySavedFiles) window.displaySavedFiles(appState.currentInterviewFiles);

    const saveCopilotInterview = document.getElementById('saveCopilotInterview');
    const saveCopilotInterviewFromFilesTab = document.getElementById('saveCopilotInterviewFromFilesTab');
    const openInterviewPreviewBtn = document.getElementById('openInterviewPreviewBtn');
    
    if (saveCopilotInterview) {
        if (saveCopilotInterview.hasAttribute('data-editing-id')) {
            saveCopilotInterview.removeAttribute('data-editing-id');
        }
        saveCopilotInterview.textContent = 'Save Interview';
        saveCopilotInterview.disabled = true;
    }
    
    if (saveCopilotInterviewFromFilesTab) {
        if (saveCopilotInterviewFromFilesTab.hasAttribute('data-editing-id')) {
            saveCopilotInterviewFromFilesTab.removeAttribute('data-editing-id');
        }
        saveCopilotInterviewFromFilesTab.textContent = 'Save Interview';
        saveCopilotInterviewFromFilesTab.disabled = true;
    }
    
    if (openInterviewPreviewBtn) {
        if (window.setInterviewerActionsVisible) window.setInterviewerActionsVisible(false);
        openInterviewPreviewBtn.removeAttribute('data-url');
    }
    
    if (window.showSpecificationNullState) window.showSpecificationNullState();
    
    // Hide share URL button
    const shareUrlBtn = document.getElementById('shareUrlBtn');
    if (shareUrlBtn) {
        shareUrlBtn.classList.add('hidden');
        shareUrlBtn.removeAttribute('data-share-url');
    }
    
    window.updateHeaderInterviewTitle();
    if (window.applyActiveSpecTabFromState) window.applyActiveSpecTabFromState();

    // Remove selection highlight from list
    document.querySelectorAll('#interviewsList .interview-card.selected').forEach(el => el.classList.remove('selected'));

    // Ensure copilot mode UI is correctly set for 'editor'
    if (window.setCopilotMode) window.setCopilotMode('editor'); 

    // Don't auto-expand config panel when creating new interview
    // Let the user or calling function decide the panel state
    
    // Refresh campaigns tab if it's active (no campaigns for new interview)
    if (window.campaignsTab && window.campaignsTab.refreshIfActive) {
        window.campaignsTab.refreshIfActive();
    }
}

// Delete interview
async function deleteInterview(id) {
    try {
        await db.collection('interviews').doc(id).delete();
        console.log('Interview deleted successfully');
        
        // If the deleted interview was currently being edited, reset the UI
        if (appState.currentEditingInterviewId === id) {
            window.resetToNewInterviewStateUI();
            if (window.updateUrlForInterview) window.updateUrlForInterview(null);
        }
        
        // Reload the interviews list
        if (window.refreshInterviewsList) {
            window.refreshInterviewsList();
        } else if (window.loadInterviewsGlobal) {
            window.loadInterviewsGlobal();
        }
    } catch (error) {
        console.error('Error deleting interview:', error);
        alert('Failed to delete interview: ' + error.message);
    }
}

// Export function for global use
window.deleteInterview = deleteInterview; 