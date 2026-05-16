// Specification UI Management

// HTML Content Constants for Specification Null State
const originalSpecificationNullStateHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
        <path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
    <p class="text-center text-gray-400">Select an interviewer from the list, <a href="#templates" class="text-accent-primary hover:text-accent-secondary underline">find a template</a>, or use the <span class="font-medium text-gray-300">AI Copilot</span> to generate or refine your interview guide.</p>
`;

const specThinkingHTML = `
    <div class="flex flex-col items-center justify-center h-full text-center p-4">
        <div class="flex space-x-2 mb-4">
            <div class="w-3 h-3 bg-accent-primary rounded-full animate-pulse"></div>
            <div class="w-3 h-3 bg-accent-primary rounded-full animate-pulse" style="animation-delay: 150ms;"></div>
            <div class="w-3 h-3 bg-accent-primary rounded-full animate-pulse" style="animation-delay: 300ms;"></div>
        </div>
        <p class="text-base font-medium text-gray-300">AI Copilot is generating...</p>
        <p class="text-sm text-gray-400 mt-1">This may take a moment.</p>
    </div>`;

// Make HTML constants available globally
window.originalSpecificationNullStateHTML = originalSpecificationNullStateHTML;
window.specThinkingHTML = specThinkingHTML;

// Initialize event listeners for form fields when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Helper function to sync field to appState
    function syncFieldToAppState(elementId, propertyPath, isArray = false) {
        const element = document.getElementById(elementId);
        if (element) {
            // Function to set nested property
            function setNestedProperty(obj, path, value) {
                const keys = path.split('.');
                let current = obj;
                for (let i = 0; i < keys.length - 1; i++) {
                    if (!current[keys[i]]) {
                        current[keys[i]] = {};
                    }
                    current = current[keys[i]];
                }
                current[keys[keys.length - 1]] = value;
            }
            
            // Sync on blur (when user leaves field)
            element.addEventListener('blur', function() {
                if (window.appState && window.appState.interviewSpec) {
                    if (isArray) {
                        // Convert newline-separated string to array
                        const lines = element.value.split('\n').filter(line => line.trim());
                        setNestedProperty(window.appState.interviewSpec, propertyPath, lines);
                    } else {
                        setNestedProperty(window.appState.interviewSpec, propertyPath, element.value);
                    }
                    console.log(`[specification-ui] Updated ${propertyPath}:`, element.value);
                }
            });
            
            // Also sync on input for real-time updates
            element.addEventListener('input', function() {
                if (window.appState && window.appState.interviewSpec) {
                    if (isArray) {
                        // Convert newline-separated string to array
                        const lines = element.value.split('\n').filter(line => line.trim());
                        setNestedProperty(window.appState.interviewSpec, propertyPath, lines);
                    } else {
                        setNestedProperty(window.appState.interviewSpec, propertyPath, element.value);
                    }
                }
            });
        }
    }
    
    // Sync all form fields to appState
    syncFieldToAppState('specTitle', 'title');
    syncFieldToAppState('specDescription', 'description');
    syncFieldToAppState('specCategory', 'category');
    syncFieldToAppState('specPurpose', 'purpose');
    syncFieldToAppState('specRequiredInformation', 'requiredInformation', true);
    syncFieldToAppState('specInitialQuestion', 'initialPrompt');
    
    // Also sync other existing fields that might not have sync
    syncFieldToAppState('specIndexHeader', 'pageHeaders.intro');
    syncFieldToAppState('specIndexSubheader', 'pageHeaders.interview');
    syncFieldToAppState('specReportHeader', 'pageHeaders.report');
    syncFieldToAppState('specReportSubheader', 'pageHeaders.reportSub');
});

// Function to show the null state and hide details
window.showSpecificationNullState = function() {
    const nullState = document.getElementById('specificationNullState');
    const contentWrapper = document.getElementById('specificationContentWrapper');
    const currentJournalViewContainer = document.getElementById('activityFeedContainer');
    const saveCopilotInterview = document.getElementById('saveCopilotInterview');
    const saveCopilotInterviewFromFilesTab = document.getElementById('saveCopilotInterviewFromFilesTab');
    const openInterviewPreviewBtn = document.getElementById('openInterviewPreviewBtn');

    if (currentJournalViewContainer) currentJournalViewContainer.classList.add('hidden');

    if (nullState) {
        nullState.innerHTML = originalSpecificationNullStateHTML;
        nullState.style.display = 'flex';
    }
    if (contentWrapper) contentWrapper.style.display = 'none';

    // Remove selection highlight
    document.querySelectorAll('#interviewsList .interview-card.selected').forEach(el => el.classList.remove('selected'));
    
    // Disable save buttons in null state
    if (saveCopilotInterview) {
        saveCopilotInterview.disabled = true;
        saveCopilotInterview.textContent = 'Save Interview';
        saveCopilotInterview.removeAttribute('data-editing-id');
    }
    if (saveCopilotInterviewFromFilesTab) {
        saveCopilotInterviewFromFilesTab.disabled = true;
        saveCopilotInterviewFromFilesTab.textContent = 'Save Interview';
        saveCopilotInterviewFromFilesTab.removeAttribute('data-editing-id');
    }
    
    window.updateHeaderInterviewTitle();
    if (window.setInterviewerActionsVisible) window.setInterviewerActionsVisible(false);
    appState.setActiveSpecTab('spec-interview-details');
    if (window.applyActiveSpecTabFromState) window.applyActiveSpecTabFromState();

    // Hide share URL button in null state
    const shareUrlBtn = document.getElementById('shareUrlBtn');
    if (shareUrlBtn) {
        shareUrlBtn.classList.add('hidden');
        shareUrlBtn.removeAttribute('data-share-url');
    }
}

// Function to show details and hide null state
window.showSpecificationDetails = function() {
    const nullState = document.getElementById('specificationNullState');
    const contentWrapper = document.getElementById('specificationContentWrapper');
    const journalContainer = document.getElementById('activityFeedContainer');
    const specTabsContainer = document.querySelector('.spec-tabs');
    const responsesContent = document.getElementById('spec-responses');


    // Don't auto-expand the panel here - let the AI processing logic decide when to expand

    if (journalContainer) journalContainer.classList.add('hidden');
    if (nullState) nullState.style.display = 'none';
    if (contentWrapper) contentWrapper.style.display = 'block';

    // Check if any tab is currently active. If not, set the default.
    const isActive = specTabsContainer?.querySelector('.spec-tab-button.active');

    if (!isActive) {
        const interviewDetailsButton = specTabsContainer?.querySelector('button[data-tab="spec-interview-details"]');
        const filesButton = specTabsContainer?.querySelector('button[data-tab="spec-files"]');
        const responsesButton = specTabsContainer?.querySelector('button[data-tab="spec-responses"]');
    
        const interviewDetailsContent = document.getElementById('spec-interview-details');
        const filesContent = document.getElementById('spec-files');

        if (interviewDetailsButton) interviewDetailsButton.classList.add('active');
        if (filesButton) filesButton.classList.remove('active');
        if (responsesButton) responsesButton.classList.remove('active');

        
        if (interviewDetailsContent) interviewDetailsContent.classList.remove('hidden');
        if (filesContent) filesContent.classList.add('hidden');
        if (responsesContent) responsesContent.classList.add('hidden');

    }
    
    // Dispatch event to update edit buttons visibility
    document.dispatchEvent(new Event('specTabChanged'));
}

// Function to update specification UI elements from appState.interviewSpec
window.updateSpecificationUIFromAppState = function() {
    const spec = appState.interviewSpec;
    console.log('[specification-ui] updateSpecificationUIFromAppState called with spec:', spec);
    const saveCopilotInterview = document.getElementById('saveCopilotInterview');
    const saveCopilotInterviewFromFilesTab = document.getElementById('saveCopilotInterviewFromFilesTab');
    
    // Update form fields
    const titleEl = document.getElementById('specTitle');
    const descEl = document.getElementById('specDescription');
    const categoryEl = document.getElementById('specCategory');
    const purposeEl = document.getElementById('specPurpose');
    const requiredInfoEl = document.getElementById('specRequiredInformation');
    const initialQuestionEl = document.getElementById('specInitialQuestion');
    console.log('[specification-ui] initialQuestionEl element:', initialQuestionEl);
    const initialPromptEl = document.getElementById('specInitialPrompt');
    const followupPromptEl = document.getElementById('specFollowupPrompt');
    const reportPromptEl = document.getElementById('specReportPrompt');
    const adminReportPromptEl = document.getElementById('specAdminReportPrompt');
    const userNoteEl = document.getElementById('specUserNote');
    
    if (titleEl) titleEl.value = spec.title || '';
    if (descEl) descEl.value = spec.description || '';
    if (categoryEl) categoryEl.value = spec.category || '';
    if (purposeEl) purposeEl.value = spec.purpose || '';
    if (requiredInfoEl) {
        // Convert array to newline-separated string for textarea
        requiredInfoEl.value = Array.isArray(spec.requiredInformation) 
            ? spec.requiredInformation.join('\n') 
            : '';
    }
    if (initialQuestionEl) {
        console.log('[specification-ui] Setting initial question field:', spec.initialPrompt);
        initialQuestionEl.value = spec.initialPrompt || '';
    }
    if (initialPromptEl) initialPromptEl.value = spec.initialPrompt || '';
    if (followupPromptEl) followupPromptEl.value = spec.followupPrompt || '';
    if (reportPromptEl) reportPromptEl.value = spec.reportPrompt || '';
    if (adminReportPromptEl) adminReportPromptEl.value = spec.adminReportPrompt || '';
    if (userNoteEl) userNoteEl.value = spec.userNote || '';


    const indexHeaderEl = document.getElementById('specIndexHeader');
    const indexSubheaderEl = document.getElementById('specIndexSubheader');
    const reportHeaderEl = document.getElementById('specReportHeader');
    const reportSubheaderEl = document.getElementById('specReportSubheader');
    
    if (indexHeaderEl) indexHeaderEl.value = spec.pageHeaders.intro || '';
    if (indexSubheaderEl) indexSubheaderEl.value = spec.pageHeaders.interview || '';
    if (reportHeaderEl) reportHeaderEl.value = spec.pageHeaders.report || '';
    if (reportSubheaderEl) reportSubheaderEl.value = spec.pageHeaders.reportSub || '';

    // Update preview content
    const previewInitialEl = document.getElementById('previewInitialQuestion');
    const previewFollowupEl = document.getElementById('previewFollowupQuestion');
    const previewReportEl = document.getElementById('previewReport');
    
    if (previewInitialEl) previewInitialEl.textContent = spec.initialPrompt || 'Not generated yet.';
    if (previewFollowupEl) previewFollowupEl.textContent = spec.exampleFollowupQuestion || 'Not generated yet.';
    if (previewReportEl) previewReportEl.innerHTML = spec.exampleReportContent ? marked.parse(spec.exampleReportContent) : 'Not generated yet.';
    
    const previewAdminReportEl = document.getElementById('previewAdminReportContent');
    if (previewAdminReportEl) previewAdminReportEl.innerHTML = spec.exampleAdminReport ? marked.parse(spec.exampleAdminReport) : 'Not generated yet.';


    // Update checkboxes
    const hasExtDocsCheckbox = document.getElementById('specHasExternalDocument');
    if (hasExtDocsCheckbox) {
        hasExtDocsCheckbox.checked = spec.hasExternalDocuments;
    }

    const enableWebSearchCheckbox = document.getElementById('specEnableWebSearch');
    if (enableWebSearchCheckbox) {
        enableWebSearchCheckbox.checked = spec.enableWebSearch;
    }

    const enableThinkingCheckbox = document.getElementById('specEnableThinking');
    if (enableThinkingCheckbox) {
        enableThinkingCheckbox.checked = spec.enableThinking !== undefined ? spec.enableThinking : true;
    }


    const enableVideoRecordingCheckbox = document.getElementById('specEnableVideoRecording');
    if (enableVideoRecordingCheckbox) {
        enableVideoRecordingCheckbox.checked = spec.enableVideoRecording || false;
    }

    const followupModelSelect = document.getElementById('specFollowupModel');
    if (followupModelSelect) {
        followupModelSelect.value = spec.followupModel || 'claude-opus-4-5';
    }


    const completionRedirectInput = document.getElementById('specCompletionRedirect');
    if (completionRedirectInput) {
        completionRedirectInput.value = spec.completionRedirectUrl || '';
    }

    const interviewThemeSelect = document.getElementById('specInterviewTheme');
    if (interviewThemeSelect) {
        interviewThemeSelect.value = spec.interviewTheme || 'dark';
    }

    // Enable/disable save buttons
    const canSave = !!appState.currentEditingInterviewId || (spec.title && spec.initialPrompt && spec.followupPrompt);
    if (saveCopilotInterview) saveCopilotInterview.disabled = !canSave;
    if (saveCopilotInterviewFromFilesTab) saveCopilotInterviewFromFilesTab.disabled = !canSave;
}

// Function to apply active spec tab from appState
window.applyActiveSpecTabFromState = function() {
    const activeTabId = appState.uiState.activeSpecTab;
    const specTabsContainer = document.querySelector('.spec-tabs');
    const specTabButtons = specTabsContainer?.querySelectorAll('.spec-tab-button');
    const specTabContents = document.getElementById('specificationContentWrapper')?.querySelectorAll('.spec-tab-content');

    // Deactivate all buttons and hide all content panels
    specTabButtons?.forEach(btn => btn.classList.remove('active'));
    specTabContents?.forEach(content => content.classList.add('hidden'));

    // Activate the button and show content for the activeTabId
    const activeButton = specTabsContainer?.querySelector(`.spec-tab-button[data-tab="${activeTabId}"]`);
    const activeContent = document.getElementById(activeTabId);

    if (activeButton) {
        activeButton.classList.add('active');
    }
    if (activeContent) {
        activeContent.classList.remove('hidden');
    }


}

// Initialize specification tabs
function initializeSpecificationTabs() {
    const specTabsContainer = document.querySelector('.spec-tabs');
    const specTabButtons = specTabsContainer?.querySelectorAll('.spec-tab-button');

    specTabButtons?.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            appState.setActiveSpecTab(tabId);
            if (window.applyActiveSpecTabFromState) window.applyActiveSpecTabFromState();
            // Dispatch event for other modules to react to tab changes
            document.dispatchEvent(new Event('specTabChanged'));
        });
    });
}

// Initialize event listeners for specification input fields
function initializeSpecificationInputs() {
    const saveCopilotInterview = document.getElementById('saveCopilotInterview');
    const saveCopilotInterviewFromFilesTab = document.getElementById('saveCopilotInterviewFromFilesTab');
    
    // Monitor specification fields
    const specFieldsToMonitor = [
        { id: 'specTitle', key: 'title' },
        { id: 'specDescription', key: 'description' },
        { id: 'specCategory', key: 'category' },
        { id: 'specInitialQuestion', key: 'initialPrompt' },
        { id: 'specFollowupPrompt', key: 'followupPrompt' },
        { id: 'specReportPrompt', key: 'reportPrompt' },
        { id: 'specAdminReportPrompt', key: 'adminReportPrompt' },
        { id: 'specUserNote', key: 'userNote' },

    ];

    specFieldsToMonitor.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            element.addEventListener('input', (e) => {
                appState.setInterviewSpec({ [field.key]: e.target.value });
                // Enable save buttons when fields change
                if (saveCopilotInterview) saveCopilotInterview.disabled = false;
                if (saveCopilotInterviewFromFilesTab) saveCopilotInterviewFromFilesTab.disabled = false;
            });
        }
    });

    // Monitor page header fields
    const pageHeaderFieldsToMonitor = [
        { id: 'specIndexHeader', key: 'intro' },
        { id: 'specIndexSubheader', key: 'interview' },
        { id: 'specReportHeader', key: 'report' },
        { id: 'specReportSubheader', key: 'reportSub' }
    ];

    pageHeaderFieldsToMonitor.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            element.addEventListener('input', (e) => {
                const currentHeaders = appState.interviewSpec.pageHeaders || {};
                appState.setInterviewSpec({ 
                    pageHeaders: { 
                        ...currentHeaders, 
                        [field.key]: e.target.value 
                    } 
                });
                // Enable save buttons when fields change
                if (saveCopilotInterview) saveCopilotInterview.disabled = false;
                if (saveCopilotInterviewFromFilesTab) saveCopilotInterviewFromFilesTab.disabled = false;
            });
        }
    });

    // Monitor checkboxes
    const specHasExternalDocumentCheckbox = document.getElementById('specHasExternalDocument');
    specHasExternalDocumentCheckbox?.addEventListener('change', (event) => {
        const isChecked = event.target.checked;
        appState.setInterviewSpec({ hasExternalDocuments: isChecked });
        if (appState.currentEditingInterviewId) {
            if (saveCopilotInterview) saveCopilotInterview.disabled = false;
            if (saveCopilotInterviewFromFilesTab) saveCopilotInterviewFromFilesTab.disabled = false;
        }
    });

    const specEnableWebSearchCheckbox = document.getElementById('specEnableWebSearch');
    specEnableWebSearchCheckbox?.addEventListener('change', (event) => {
        const isChecked = event.target.checked;
        appState.setInterviewSpec({ enableWebSearch: isChecked });
        if (appState.currentEditingInterviewId) {
            if (saveCopilotInterview) saveCopilotInterview.disabled = false;
            if (saveCopilotInterviewFromFilesTab) saveCopilotInterviewFromFilesTab.disabled = false;
        }
    });

    const specEnableThinkingCheckbox = document.getElementById('specEnableThinking');
    specEnableThinkingCheckbox?.addEventListener('change', (event) => {
        const isChecked = event.target.checked;
        appState.setInterviewSpec({ enableThinking: isChecked });
        if (appState.currentEditingInterviewId) {
            if (saveCopilotInterview) saveCopilotInterview.disabled = false;
            if (saveCopilotInterviewFromFilesTab) saveCopilotInterviewFromFilesTab.disabled = false;
        }
    });


    const specEnableVideoRecordingCheckbox = document.getElementById('specEnableVideoRecording');
    specEnableVideoRecordingCheckbox?.addEventListener('change', (event) => {
        const isChecked = event.target.checked;
        appState.setInterviewSpec({ enableVideoRecording: isChecked });
        if (appState.currentEditingInterviewId) {
            if (saveCopilotInterview) saveCopilotInterview.disabled = false;
            if (saveCopilotInterviewFromFilesTab) saveCopilotInterviewFromFilesTab.disabled = false;
        }
    });

    const specFollowupModelSelect = document.getElementById('specFollowupModel');
    specFollowupModelSelect?.addEventListener('change', (event) => {
        const selectedModel = event.target.value;
        appState.setInterviewSpec({ followupModel: selectedModel });
        if (appState.currentEditingInterviewId) {
            if (saveCopilotInterview) saveCopilotInterview.disabled = false;
            if (saveCopilotInterviewFromFilesTab) saveCopilotInterviewFromFilesTab.disabled = false;
        }
    });


    const specInterviewThemeSelect = document.getElementById('specInterviewTheme');
    specInterviewThemeSelect?.addEventListener('change', (event) => {
        const selectedTheme = event.target.value;
        appState.setInterviewSpec({ interviewTheme: selectedTheme });
        if (appState.currentEditingInterviewId) {
            if (saveCopilotInterview) saveCopilotInterview.disabled = false;
            if (saveCopilotInterviewFromFilesTab) saveCopilotInterviewFromFilesTab.disabled = false;
        }
    });

    const specCompletionRedirectInput = document.getElementById('specCompletionRedirect');
    specCompletionRedirectInput?.addEventListener('input', (event) => {
        appState.setInterviewSpec({ completionRedirectUrl: event.target.value });
        if (appState.currentEditingInterviewId) {
            if (saveCopilotInterview) saveCopilotInterview.disabled = false;
            if (saveCopilotInterviewFromFilesTab) saveCopilotInterviewFromFilesTab.disabled = false;
        }
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeSpecificationTabs();
    initializeSpecificationInputs();
    
    // Re-initialize save buttons in case they weren't initialized properly
    if (window.initializeSaveButtons) {
        console.log('[specification-ui] Re-initializing save buttons...');
        window.initializeSaveButtons();
    }
}); 