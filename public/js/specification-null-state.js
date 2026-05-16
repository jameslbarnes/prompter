// Specification Null State Module
// Handles the display state when no interview is selected

// Remove duplicate constant declarations - these are already defined in specification-ui.js
// The constants originalSpecificationNullStateHTML and specThinkingHTML are available from specification-ui.js

// Function to show the null state and hide details
function showSpecificationNullState() {
    const nullState = document.getElementById('specificationNullState');
    const contentWrapper = document.getElementById('specificationContentWrapper');
    const specTabsContainer = document.querySelector('.spec-tabs');
    const responsesContent = document.getElementById('spec-responses');
    const currentJournalViewContainer = document.getElementById('activityFeedContainer');

    if (currentJournalViewContainer) currentJournalViewContainer.classList.add('hidden');

    if (nullState) {
        nullState.innerHTML = window.originalSpecificationNullStateHTML || originalSpecificationNullStateHTML;
        nullState.style.display = 'flex';
    }
    if (contentWrapper) contentWrapper.style.display = 'none';

    // Remove selection highlight
    document.querySelectorAll('#interviewsList .interview-card.selected').forEach(el => el.classList.remove('selected'));
    
    // Disable save button in null state
    const saveCopilotInterview = document.getElementById('saveCopilotInterview');
    const saveCopilotInterviewFromFilesTab = document.getElementById('saveCopilotInterviewFromFilesTab');
    const openInterviewPreviewBtn = document.getElementById('openInterviewPreviewBtn');
    
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
    if (openInterviewPreviewBtn) openInterviewPreviewBtn.classList.add('hidden');
    
    appState.setActiveSpecTab('spec-preview');
    if (window.applyActiveSpecTabFromState) {
        window.applyActiveSpecTabFromState();
    }

    // Hide share URL button in null state
    const shareUrlBtn = document.getElementById('shareUrlBtn');
    if (shareUrlBtn) {
        shareUrlBtn.classList.add('hidden');
        shareUrlBtn.removeAttribute('data-share-url');
    }
}

// Function to show details and hide null state
function showSpecificationDetails() {
    const nullState = document.getElementById('specificationNullState');
    const contentWrapper = document.getElementById('specificationContentWrapper');
    const journalContainer = document.getElementById('activityFeedContainer');
    const specTabsContainer = document.querySelector('.spec-tabs');
    const responsesContent = document.getElementById('spec-responses');


    // Panel expansion is now handled in loadInterviewForEditing after data loads

    if (journalContainer) journalContainer.classList.add('hidden');
    if (nullState) nullState.style.display = 'none';
    if (contentWrapper) contentWrapper.style.display = 'block';

    // Ensure "Preview" tab is active when details are shown initially for an interview
    const detailsButton = specTabsContainer?.querySelector('button[data-tab="spec-details"]');
    const previewButton = specTabsContainer?.querySelector('button[data-tab="spec-preview"]');
    const filesButton = specTabsContainer?.querySelector('button[data-tab="spec-files"]');
    const responsesButton = specTabsContainer?.querySelector('button[data-tab="spec-responses"]');
    
    const detailsContent = document.getElementById('spec-details');
    const previewContent = document.getElementById('spec-preview');
    const filesContent = document.getElementById('spec-files');

    // Check if *any* tab is currently active. If not, set the default.
    const isActive = specTabsContainer?.querySelector('.spec-tab-button.active');

    if (!isActive) {
        if (detailsButton) detailsButton.classList.remove('active');
        if (previewButton) previewButton.classList.add('active');
        if (filesButton) filesButton.classList.remove('active');
        if (responsesButton) responsesButton.classList.remove('active');
        if (detailsContent) detailsContent.classList.add('hidden');
        if (previewContent) previewContent.classList.remove('hidden');
        if (filesContent) filesContent.classList.add('hidden');
        if (responsesContent) responsesContent.classList.add('hidden');

    }
}

// Function to show thinking animation in null state
function showSpecificationThinking() {
    const nullState = document.getElementById('specificationNullState');
    if (nullState && nullState.style.display !== 'none') {
        nullState.innerHTML = window.specThinkingHTML || specThinkingHTML;
    }
}

// These functions are already exposed globally by specification-ui.js
// Only expose them if they haven't been already
if (!window.showSpecificationNullState) {
    window.showSpecificationNullState = showSpecificationNullState;
}
if (!window.showSpecificationDetails) {
    window.showSpecificationDetails = showSpecificationDetails;
}
if (!window.showSpecificationThinking) {
    window.showSpecificationThinking = showSpecificationThinking;
} 