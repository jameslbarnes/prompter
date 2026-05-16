// Journal View / Activity Feed Module

import { escapeXml } from './xml-utils.js';

// Use window functions instead of imports since journal-threads.js is not a module
// These are defined in journal-threads.js which loads before this module
const loadJournalThreads = (...args) => window.loadJournalThreads(...args);
const createJournalThread = (...args) => window.createJournalThread(...args);
const loadThreadMessages = (...args) => window.loadThreadMessages(...args);
const saveThreadMessage = (...args) => window.saveThreadMessage(...args);
const deleteJournalThread = (...args) => window.deleteJournalThread(...args);
const updateJournalThread = (...args) => window.updateJournalThread(...args);

export async function showJournalView() { 
    console.log('[showJournalView] Function called.');
    if (!firebase.auth().currentUser) {
        alert("Please log in to view your journal.");
        return;
    }
    const adminUser = firebase.auth().currentUser;
    const adminUserId = adminUser.uid;

    const configPanelHeaderTitle = document.querySelector('#configPanel .panel-custom-header .panel-header-title');
    const configPanelHeaderSubheadline = document.querySelector('#configPanel .panel-custom-header .panel-header-subheadline');

    if (configPanelHeaderTitle) {
        configPanelHeaderTitle.textContent = 'Interview Feed';
    }
    if (configPanelHeaderSubheadline) {
        configPanelHeaderSubheadline.textContent = 'Review and analyze past interview sessions based on your templates.';
    }

    // Ensure config panel is expanded when showing journal view
    if (appState.uiState.configPanelCollapsed) {
        appState.setConfigPanelCollapsed(false);
    }

    appState.setCurrentEditingInterviewId(null);
    
    // Only set journal analysis mode if not already in it to avoid resetting thread state
    if (!appState.isJournalAnalysisMode) {
        appState.setJournalAnalysisMode(true);
    }
    
    // Update URL hash to reflect journal view
    if (window.updateUrlForInterview) {
        window.updateUrlForInterview(null); // This will set hash to 'journal' since we're in journal mode
    } 

    // Explicitly hide the Begin Interview button when journal view is active
    const openInterviewPreviewBtn = document.getElementById('openInterviewPreviewBtn');
    if (openInterviewPreviewBtn) {
        openInterviewPreviewBtn.classList.add('hidden');
    }

    const myJournalBtnEl = document.getElementById('myActivityBtn');
    document.querySelectorAll('#interviewsList .interview-card.selected').forEach(el => el.classList.remove('selected'));

    const specNullStateEl = document.getElementById('specificationNullState');
    const specContentWrapperEl = document.getElementById('specificationContentWrapper');
    const journalViewContainerEl = document.getElementById('activityFeedContainer');
    const journalEntriesListEl = document.getElementById('activityFeedDisplayArea');
    const globalUserFilterContainerEl = document.getElementById('globalUserFilterContainer');

    if (specNullStateEl) specNullStateEl.style.display = 'none';
    if (specContentWrapperEl) specContentWrapperEl.style.display = 'none';
    if (journalViewContainerEl) journalViewContainerEl.classList.remove('hidden');
    if (globalUserFilterContainerEl) globalUserFilterContainerEl.classList.remove('hidden');
    if (journalEntriesListEl) journalEntriesListEl.innerHTML = '<p class="text-gray-400">Loading journal entries...</p>';

    const emailFilterDropdownEl = document.getElementById('emailFilterDropdown');
    if (emailFilterDropdownEl) {
        emailFilterDropdownEl.innerHTML = '<option value="all">All Users</option>'; 
        console.log('[showJournalView] Email filter dropdown reset.');
        // Ensure the function is available on window before attaching listener
        window.handleEmailFilterChange = handleEmailFilterChange;
        emailFilterDropdownEl.removeEventListener('change', window.handleEmailFilterChange);
        emailFilterDropdownEl.addEventListener('change', window.handleEmailFilterChange);
        console.log('[showJournalView] Event listener attached to email filter dropdown');
    }

    if (window.updateHeaderInterviewTitle) window.updateHeaderInterviewTitle(); 
    if (window.setCopilotMode) window.setCopilotMode('analyst'); 

    // Show thread tabs in copilot panel
    const copilotPanel = document.getElementById('copilotPanel');
    const journalThreadTabs = document.getElementById('journalThreadTabs');
    if (copilotPanel && journalThreadTabs) {
        copilotPanel.classList.add('with-thread-tabs');
        journalThreadTabs.classList.remove('hidden');
    }

    // Load threads for "all users" initially
    await loadAndDisplayThreads('all');

    try {
        // 1. Fetch interview template IDs created by the current admin
        console.log(`[showJournalView] Fetching interview templates created by admin: ${adminUserId}`);
        const adminTemplatesSnapshot = await firebase.firestore().collection('interviews')
            .where('createdBy', '==', adminUserId)
            .get();
        
        // 2. Fetch interview templates shared with the current admin
        console.log(`[showJournalView] Fetching interview templates shared with admin: ${adminUser.email}`);
        const sharedTemplatesSnapshot = await firebase.firestore().collection('interviews')
            .where('sharedWith', 'array-contains', adminUser.email)
            .get();
        
        const adminTemplateIds = [];
        
        // Add created interviews
        adminTemplatesSnapshot.forEach(doc => {
            adminTemplateIds.push(doc.id);
        });
        
        // Add shared interviews (avoid duplicates)
        sharedTemplatesSnapshot.forEach(doc => {
            if (!adminTemplateIds.includes(doc.id)) {
                adminTemplateIds.push(doc.id);
            }
        });
        
        console.log(`[showJournalView] Admin has access to ${adminTemplateIds.length} templates (${adminTemplatesSnapshot.size} created, ${sharedTemplatesSnapshot.size} shared):`, adminTemplateIds);

        // DEBUG: Log the actual template IDs for debugging
        console.log(`[DEBUG] Admin template IDs:`, adminTemplateIds);
        console.log(`[DEBUG] Admin email:`, adminUser.email);
        console.log(`[DEBUG] Admin UID:`, adminUserId);

        if (adminTemplateIds.length === 0) {
            if (journalEntriesListEl) journalEntriesListEl.innerHTML = '<p class="text-gray-400">You have not created any interview templates yet and none have been shared with you. The feed shows reports from interviews based on your templates.</p>';
            appState.setAllFetchedJournalEntries([]);
            if (window.renderJournalEntries) window.renderJournalEntries('all');
            return;
        }

        // 3. Fetch all reports
        const reportsSnapshot = await firebase.firestore().collection('reports')
            .orderBy('start_timestamp', 'desc')
            .get();

        const allEntriesForDropdown = [];
        const uniqueEmails = new Set();
        console.log('[showJournalView] Processing reportsSnapshot. Number of docs fetched:', reportsSnapshot.docs.length); 
        
        // DEBUG: Track filtering
        let totalReports = 0;
        let filteredReports = 0;
        
        for (const reportDoc of reportsSnapshot.docs) {
            const report = reportDoc.data();
            totalReports++;

            // DEBUG: Log each report's interview_id
            if (totalReports <= 5) { // Only log first 5 to avoid spam
                console.log(`[DEBUG] Report ${reportDoc.id}: interview_id="${report.interview_id}", user_email="${report.user_email}"`);
            }

            // 4. Filter reports: keep only those whose interview_id is in adminTemplateIds
            if (report.interview_id && adminTemplateIds.includes(report.interview_id)) {
                filteredReports++;
                if (!report.admin_report_content && !report.report_content) continue;
                
                if (report.user_email) {
                    uniqueEmails.add(report.user_email);
                }
                
                let interviewTitle = 'Interview';
                
                // Try to find the template in created interviews first
                let templateDoc = adminTemplatesSnapshot.docs.find(doc => doc.id === report.interview_id);
                
                // If not found in created, check shared interviews
                if (!templateDoc) {
                    templateDoc = sharedTemplatesSnapshot.docs.find(doc => doc.id === report.interview_id);
                }
                
                if (templateDoc) {
                    interviewTitle = templateDoc.data().title || 'Untitled Interview';
                } else {
                    try {
                        const fetchedInterviewDoc = await firebase.firestore().collection('interviews').doc(report.interview_id).get();
                        if (fetchedInterviewDoc.exists) interviewTitle = fetchedInterviewDoc.data().title || 'Untitled Interview (Fallback Fetch)';
                    } catch (e) { console.warn(`Could not fetch title for report ${reportDoc.id} (fallback):`, e); }
                }

                allEntriesForDropdown.push({
                    reportId: reportDoc.id, sessionTitle: interviewTitle, user_email: report.user_email,
                    startTimestamp: report.start_timestamp ? (report.start_timestamp.toDate ? report.start_timestamp.toDate().toISOString() : new Date(report.start_timestamp).toISOString()) : null,
                    report_content: report.admin_report_content || report.report_content
                });
            }
        }
        console.log(`[showJournalView] Filtered down to ${allEntriesForDropdown.length} relevant reports.`);

        // DEBUG: Log filtering results
        console.log(`[DEBUG] Filtering results: ${filteredReports} reports matched out of ${totalReports} total reports`);
        console.log(`[DEBUG] Final entries for display: ${allEntriesForDropdown.length}`);

        appState.setAllFetchedJournalEntries(allEntriesForDropdown);
        if (emailFilterDropdownEl) {
            console.log('[showJournalView] Unique emails found for relevant reports:', Array.from(uniqueEmails)); 
            uniqueEmails.forEach(email => {
                const option = document.createElement('option');
                option.value = email; option.textContent = email;
                emailFilterDropdownEl.appendChild(option);
                console.log('[showJournalView] Appended option for email:', email); 
            });
            
            // Check if there's an email filter in the URL hash and apply it
            const currentHash = window.location.hash.substring(1);
            if (currentHash.includes('&email=')) {
                const emailMatch = currentHash.match(/&email=([^&]*)/);
                if (emailMatch) {
                    const emailFilter = decodeURIComponent(emailMatch[1]);
                    const optionExists = emailFilterDropdownEl.querySelector(`option[value="${emailFilter}"]`);
                    if (optionExists) {
                        emailFilterDropdownEl.value = emailFilter;
                        console.log('[showJournalView] Applied email filter from URL:', emailFilter);
                        // Trigger the filter change to update the display (skip URL update to avoid loop)
                        if (window.handleEmailFilterChange) {
                            window.handleEmailFilterChange(true);
                        }
                        return; // Exit early since we've applied the filter
                    } else {
                        console.warn('[showJournalView] Email filter from URL not found in dropdown options:', emailFilter);
                    }
                }
            }
        }
        if (window.renderJournalEntries) window.renderJournalEntries('all');
    } catch (error) {
        console.error("Error loading journal entries in admin.js:", error);
        if (journalEntriesListEl) journalEntriesListEl.innerHTML = `<p class="text-red-500">Error loading journal: ${error.message}</p>`;
    }
}

// Load and display threads for a specific user filter
export async function loadAndDisplayThreads(userFilter) {
    console.log('[loadAndDisplayThreads] Loading threads for user filter:', userFilter);
    
    // Set the filter directly without resetting thread state
    appState.currentJournalUserFilter = userFilter;
    
    try {
        const threads = await loadJournalThreads(userFilter);
        appState.journalThreads = threads;
        
        // Update thread tabs UI
        updateThreadTabsUI(threads);
        
        // Try to restore the last used thread for this filter
        const lastUsedThreadId = appState.getLastUsedThreadForFilter(userFilter);
        let threadToSelect = null;
        
        if (lastUsedThreadId && threads.find(t => t.id === lastUsedThreadId)) {
            threadToSelect = lastUsedThreadId;
            console.log('[loadAndDisplayThreads] Restoring last used thread:', lastUsedThreadId);
        } else if (threads.length > 0) {
            threadToSelect = threads[0].id;
            console.log('[loadAndDisplayThreads] Selecting first available thread:', threadToSelect);
        }
        
        if (threadToSelect) {
            await selectThread(threadToSelect);
        } else {
            console.log('[loadAndDisplayThreads] No threads found, creating new one');
            await createNewThread();
        }
    } catch (error) {
        console.error('[loadAndDisplayThreads] Error:', error);
    }
}

// Update the thread tabs UI
function updateThreadTabsUI(threads) {
    const threadTabsList = document.getElementById('threadTabsList');
    if (!threadTabsList) return;
    
    // Clear existing tabs
    threadTabsList.innerHTML = '';
    
    // Add tab for each thread
    threads.forEach((thread, index) => {
        const tabButton = document.createElement('button');
        tabButton.className = 'thread-tab';
        tabButton.dataset.threadId = thread.id;
        
        const title = thread.threadTitle || `Thread ${index + 1}`;
        tabButton.innerHTML = `
            <span class="thread-tab-title">${escapeXml(title)}</span>
            <span class="thread-tab-close" title="Close thread">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </span>
        `;
        
        // Add click handler for tab selection
        tabButton.addEventListener('click', (e) => {
            if (!e.target.closest('.thread-tab-close')) {
                selectThread(thread.id);
            }
        });
        
        // Add click handler for close button
        const closeBtn = tabButton.querySelector('.thread-tab-close');
        closeBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await closeThread(thread.id);
        });
        
        threadTabsList.appendChild(tabButton);
    });
    
    // Add "New Thread" button
    const newThreadBtn = document.createElement('button');
    newThreadBtn.id = 'newThreadBtn';
    newThreadBtn.className = 'thread-tab';
    newThreadBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
    `;
    newThreadBtn.title = 'New Thread';
    newThreadBtn.addEventListener('click', createNewThread);
    threadTabsList.appendChild(newThreadBtn);
    
    // Highlight active thread
    if (appState.currentJournalThreadId) {
        const activeTab = threadTabsList.querySelector(`[data-thread-id="${appState.currentJournalThreadId}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }
}

// Select a thread
async function selectThread(threadId) {
    console.log('[selectThread] Selecting thread:', threadId);
    
    // Use the state method to properly save to localStorage
    appState.setCurrentJournalThreadId(threadId);
    
    // Update UI to show active thread
    document.querySelectorAll('.thread-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const activeTab = document.querySelector(`[data-thread-id="${threadId}"]`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Load thread messages
    try {
        const messages = await loadThreadMessages(threadId);
        appState.setCurrentThreadMessages(messages);
        console.log('[selectThread] Loaded messages for thread:', threadId, 'Count:', messages.length);
        
        // Clear chat and display messages
        const copilotMessagesEl = document.getElementById('copilotMessages');
        if (copilotMessagesEl) {
            copilotMessagesEl.innerHTML = '';
            
            // Display each message
            messages.forEach((msg, index) => {
                console.log('[selectThread] Displaying message', index, ':', { sender: msg.sender, content: msg.content.substring(0, 50) + '...' });
                if (msg.sender === 'user') {
                    window.appendUserMessage(msg.content, false);
                } else if (msg.sender === 'assistant') {
                    window.appendAIMessage(msg.content, false);
                }
            });
            
            // If no messages, show welcome message
            if (messages.length === 0) {
                const userFilter = appState.currentJournalUserFilter;
                const welcomeMsg = userFilter === 'all' 
                    ? "I can help you analyze trends and insights across all your past interviews. What would you like to know?"
                    : `I can help you analyze ${userFilter}'s interview responses. What would you like to explore?`;
                window.appendAIMessage(welcomeMsg, false, false);
                console.log('[selectThread] No messages found, showing welcome message');
            }
        }
    } catch (error) {
        console.error('[selectThread] Error loading messages:', error);
    }
}

// Create a new thread
async function createNewThread() {
    console.log('[createNewThread] Creating new thread for user filter:', appState.currentJournalUserFilter);
    
    try {
        const thread = await createJournalThread(appState.currentJournalUserFilter);
        
        if (!thread) {
            console.error('[createNewThread] Failed to create thread');
            return;
        }
        
        // Add to state and UI
        updateThreadTabsUI(appState.journalThreads);
        
        // Select the new thread
        await selectThread(thread.id);
    } catch (error) {
        console.error('[createNewThread] Error:', error);
    }
}

// Close a thread
async function closeThread(threadId) {
    console.log('[closeThread] Closing thread:', threadId);
    
    // If this is the last thread, create a new one first
    if (appState.journalThreads.length === 1) {
        await createNewThread();
    }
    
    try {
        // Delete the thread
        await deleteJournalThread(threadId);
        
        // Remove from state
        appState.journalThreads = appState.journalThreads.filter(t => t.id !== threadId);
        
        // If we're closing the active thread, select another one
        if (appState.currentJournalThreadId === threadId) {
            const remainingThreads = appState.journalThreads;
            if (remainingThreads.length > 0) {
                await selectThread(remainingThreads[0].id);
            }
        }
        
        // Update UI
        updateThreadTabsUI(appState.journalThreads);
    } catch (error) {
        console.error('[closeThread] Error:', error);
    }
}

// Override the global saveThreadMessage to use our thread system
window.saveJournalThreadMessage = async function(role, content) {
    console.log('[saveJournalThreadMessage] Called with:', { role, content: content.substring(0, 100) + '...', threadId: appState.currentJournalThreadId });
    
    if (!appState.currentJournalThreadId) {
        console.error('[saveJournalThreadMessage] No current thread ID');
        return;
    }
    
    try {
        const success = await saveThreadMessage(appState.currentJournalThreadId, role, content);
        console.log('[saveJournalThreadMessage] Save result:', success);
        
        // Update thread title if this is the first user message
        const thread = appState.journalThreads.find(t => t.id === appState.currentJournalThreadId);
        if (thread && !thread.threadTitle && role === 'user') {
            // Generate a title from the first user message
            const title = content.substring(0, 50) + (content.length > 50 ? '...' : '');
            await updateJournalThread(appState.currentJournalThreadId, { threadTitle: title });
            
            // Update local state and UI
            thread.threadTitle = title;
            updateThreadTabsUI(appState.journalThreads);
            console.log('[saveJournalThreadMessage] Updated thread title:', title);
        }
    } catch (error) {
        console.error('[saveJournalThreadMessage] Error:', error);
    }
};

export function renderJournalEntries(selectedEmail) {
    const journalEntriesListEl = document.getElementById('activityFeedDisplayArea');
    if (!journalEntriesListEl) return;
    journalEntriesListEl.innerHTML = ''; 
    const entriesToDisplay = selectedEmail === 'all'
        ? appState.allFetchedJournalEntries
        : appState.allFetchedJournalEntries.filter(entry => entry.user_email === selectedEmail);
    if (entriesToDisplay.length === 0) {
        journalEntriesListEl.innerHTML = '<p class="text-gray-400 italic">No journal entries found for the selected filter.</p>';
        return;
    }
    entriesToDisplay.forEach(report => {
        const entryCard = document.createElement('div');
        entryCard.className = 'saved-synthesis-item bg-gray-750 border border-gray-700 p-4 rounded-lg mb-4 shadow-md';
        entryCard.id = `journal-entry-${report.reportId}`;
        let reportDate = 'Date N/A';
        if (report.startTimestamp) {
            try {
                reportDate = new Date(report.startTimestamp).toLocaleString(undefined, {
                    year: 'numeric', month: 'long', day: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
            } catch (e) { console.warn("Error formatting date:", e); }
        }
        let processedFullContent = report.report_content || '';
        processedFullContent = processedFullContent.replace(
            /<audio_clip[^>]*>([\s\S]*?)<\/audio_clip>/gi,
            (match, audioContent) => {
                const contentStr = String(audioContent || "").trim();
                if (!contentStr) return "";
                return `<blockquote>${escapeXml(contentStr)}</blockquote>`;
            }
        );
        const isLongContent = processedFullContent.length > 250;
        const renderedFullContentHTML = marked.parse(processedFullContent);
        const renderedShortContentHTML = isLongContent ? marked.parse(processedFullContent.substring(0, 250) + "...") : renderedFullContentHTML;
        entryCard.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex-grow">
                    <h4 class="text-md font-semibold text-white mb-0.5">${report.sessionTitle}</h4>
                    <p class="text-xs text-gray-400">User: ${report.user_email || 'N/A'}</p>
                    <div class="text-xs text-gray-400">Taken: ${reportDate}</div>
                    <div class="journal-audio-status text-xs text-gray-500 mt-1"></div>
                </div>
                <button class="play-journal-audio-btn icon-button" data-report-id="${report.reportId}" title="Play Journal Entry Audio">
                    <svg class="h-5 w-5 play-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" /></svg>
                    <svg class="h-5 w-5 pause-icon hidden" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" /></svg>
                </button>
            </div>
            <div class="journal-content-display markdown-body whitespace-pre-wrap text-sm mb-3">${renderedShortContentHTML}</div>
            ${isLongContent ? '<button class="read-more-journal text-accent-primary hover:text-accent-secondary text-xs mt-1">Read more</button>' : ''}
            <div class="mt-3">
                 <button class="view-journal-details-btn secondary-button text-xs py-1 px-3" data-report-id="${report.reportId}" title="View full details of this interview session">View Details</button>
            </div>
        `;
        journalEntriesListEl.appendChild(entryCard);
        if (isLongContent) {
            const readMoreBtn = entryCard.querySelector('.read-more-journal');
            const contentDisplay = entryCard.querySelector('.journal-content-display');
            readMoreBtn.addEventListener('click', () => {
                if (readMoreBtn.textContent === 'Read more') {
                    contentDisplay.innerHTML = renderedFullContentHTML;
                    readMoreBtn.textContent = 'Read less';
                } else {
                    contentDisplay.innerHTML = renderedShortContentHTML;
                    readMoreBtn.textContent = 'Read more';
                }
            });
        }
    });
}

export function handleEmailFilterChange(skipUrlUpdate = false) {
    const emailFilterDropdownEl = document.getElementById('emailFilterDropdown');
    if (emailFilterDropdownEl) {
        const selectedEmail = emailFilterDropdownEl.value;
        console.log('[handleEmailFilterChange] Filter changed to:', selectedEmail);
        
        // Update URL hash to include email filter (unless we're restoring from URL)
        if (!skipUrlUpdate) {
            // Ensure the URL update function is available
            if (typeof window.updateUrlForEmailFilter === 'function') {
                window.updateUrlForEmailFilter(selectedEmail);
            } else {
                console.error('[handleEmailFilterChange] updateUrlForEmailFilter function not available on window');
            }
        }
        
        if (window.renderJournalEntries) {
            window.renderJournalEntries(selectedEmail);
        } else {
            console.error('[handleEmailFilterChange] renderJournalEntries function not found on window.');
        }

        // Load threads for the new user filter
        loadAndDisplayThreads(selectedEmail);

        const copilotSubtitleEl = document.getElementById('copilotSubtitle');
        if (copilotSubtitleEl && appState.isJournalAnalysisMode && appState.copilotMode === 'analyst') {
            if (selectedEmail && selectedEmail !== 'all') {
                copilotSubtitleEl.textContent = `Ask questions about ${selectedEmail}`;
            } else {
                copilotSubtitleEl.textContent = 'Ask questions about your past activity.';
            }
            console.log('[handleEmailFilterChange] Copilot subtitle updated to:', copilotSubtitleEl.textContent);
        }
    } else {
        console.error('[handleEmailFilterChange] Email filter dropdown element not found!');
    }
}

// Hide thread tabs when exiting journal view
window.hideJournalThreadTabs = function() {
    const copilotPanel = document.getElementById('copilotPanel');
    const journalThreadTabs = document.getElementById('journalThreadTabs');
    if (copilotPanel && journalThreadTabs) {
        copilotPanel.classList.remove('with-thread-tabs');
        journalThreadTabs.classList.add('hidden');
    }
};

// Expose functions to global scope for compatibility with non-module scripts
window.showJournalView = showJournalView;
window.loadAndDisplayThreads = loadAndDisplayThreads;
window.renderJournalEntries = renderJournalEntries;
window.handleEmailFilterChange = handleEmailFilterChange;