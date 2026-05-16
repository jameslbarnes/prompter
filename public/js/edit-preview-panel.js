// Edit Preview Panel Module
// Handles the slide-out panel for editing interview questions and prompts

(function() {
    'use strict';

    let currentEditType = null;
    let isRegenerating = false;

    // Helper function to clean follow-up prompts by removing internal instructions
    function cleanFollowupPrompt(prompt) {
        if (!prompt) return '';
        
        // Remove the internal instructions that are appended to follow-up prompts
        const internalInstructionsStart = 'IT IS EXTREMELY IMPORTANT THAT YOUR QUESTION FEELS LIKE A NATURAL FOLLOWUP';
        const startIndex = prompt.indexOf(internalInstructionsStart);
        
        if (startIndex !== -1) {
            // Return only the part before the internal instructions
            return prompt.substring(0, startIndex).trim();
        }
        
        return prompt;
    }

    // Helper function to clean report prompts by removing internal instructions
    function cleanReportPrompt(prompt) {
        if (!prompt) return '';
        
        // Remove the internal instructions that are appended to report prompts
        const internalInstructionsStart = 'Make sure the quotes stand on their own so you can play the original audio';
        const startIndex = prompt.indexOf(internalInstructionsStart);
        
        if (startIndex !== -1) {
            // Return only the part before the internal instructions
            return prompt.substring(0, startIndex).trim();
        }
        
        return prompt;
    }

    // Helper function to add internal instructions back to follow-up prompts
    function addInternalInstructionsToFollowupPrompt(prompt) {
        if (!prompt) return '';
        
        // Check if internal instructions are already present
        if (prompt.includes('IT IS EXTREMELY IMPORTANT THAT YOUR QUESTION FEELS LIKE A NATURAL FOLLOWUP')) {
            return prompt; // Already has instructions
        }
        
        // Add the internal instructions
        return prompt
    }

    // Helper function to add internal instructions back to report prompts
    function addInternalInstructionsToReportPrompt(prompt) {
        if (!prompt) return '';
        
        // Check if internal instructions are already present
        if (prompt.includes('Make sure the quotes stand on their own so you can play the original audio')) {
            return prompt; // Already has instructions
        }
        
        // Add the internal instructions
        return prompt + `

Make sure the quotes stand on their own so you can play the original audio in the final edit (don't splice them with "he said," etc) - each quote should be played without interruption from the host.

IMPORTANT: Only use <audio_clip> tags for quotes that are at least a complete sentence - do not use them for fragments, single words, or incomplete phrases.

Ensure you return your response in <individual_summary_report> tags.`;
    }

    // Initialize the edit preview panel
    function initializeEditPreviewPanel() {
        // Add click handlers for all edit buttons
        document.querySelectorAll('.edit-preview-btn').forEach(btn => {
            btn.addEventListener('click', handleEditButtonClick);
        });

        // Panel controls
        const closeBtn = document.getElementById('closeEditPreviewPanelBtn');
        const cancelBtn = document.getElementById('cancelEditPreviewBtn');
        const saveBtn = document.getElementById('saveEditPreviewBtn');
        const regenerateBtn = document.getElementById('regeneratePreviewBtn');
        const overlay = document.getElementById('editPreviewOverlay');

        if (closeBtn) closeBtn.addEventListener('click', closeEditPanel);
        if (cancelBtn) cancelBtn.addEventListener('click', closeEditPanel);
        if (overlay) overlay.addEventListener('click', closeEditPanel);
        if (saveBtn) saveBtn.addEventListener('click', handleSaveChanges);
        if (regenerateBtn) regenerateBtn.addEventListener('click', handleRegeneratePreview);

        // Listen for tab changes to update edit buttons
        document.addEventListener('specTabChanged', updateEditButtonsVisibility);
    }

    // Handle edit button clicks
    function handleEditButtonClick(e) {
        const button = e.currentTarget;
        currentEditType = button.getAttribute('data-edit-type');
        openEditPanel(currentEditType);
    }

    // Open the edit panel with appropriate content
    function openEditPanel(editType) {
        const panel = document.getElementById('editPreviewPanel');
        const overlay = document.getElementById('editPreviewOverlay');
        const title = document.getElementById('editPreviewTitle');

        if (!panel || !overlay) return;

        // Hide all sections
        document.querySelectorAll('#editPreviewContent > div').forEach(section => {
            section.classList.add('hidden');
        });

        // Show appropriate section and set title
        switch (editType) {
            case 'initial':
                document.getElementById('editInitialSection')?.classList.remove('hidden');
                if (title) title.textContent = 'Edit Initial Question';
                loadInitialQuestionData();
                break;
            case 'followup':
                document.getElementById('editFollowupSection')?.classList.remove('hidden');
                if (title) title.textContent = 'Edit Follow-up Questions';
                loadFollowupData();
                break;
            case 'report':
                document.getElementById('editReportSection')?.classList.remove('hidden');
                if (title) title.textContent = 'Edit User Report';
                loadReportData();
                break;
            case 'admin-report':
                document.getElementById('editAdminReportSection')?.classList.remove('hidden');
                if (title) title.textContent = 'Edit Admin Report';
                loadAdminReportData();
                break;
        }

        // Show panel
        panel.style.display = 'flex';
        overlay.style.pointerEvents = 'auto';
        
        requestAnimationFrame(() => {
            panel.style.transform = 'translateX(0)';
            overlay.style.opacity = '1';
        });
    }

    // Close the edit panel
    function closeEditPanel() {
        const panel = document.getElementById('editPreviewPanel');
        const overlay = document.getElementById('editPreviewOverlay');

        if (!panel || !overlay) return;

        panel.style.transform = 'translateX(100%)';
        overlay.style.opacity = '0';

        setTimeout(() => {
            panel.style.display = 'none';
            overlay.style.pointerEvents = 'none';
            currentEditType = null;
        }, 300);
    }

    // Load data for initial question editing
    function loadInitialQuestionData() {
        const questionText = document.getElementById('editInitialQuestionText');
        const promptText = document.getElementById('editInitialPromptText');
        
        // Get current values from the main form and app state
        const currentQuestion = document.getElementById('previewInitialQuestion')?.textContent || '';
        let currentPrompt = document.getElementById('specInitialPrompt')?.value || '';
        
        // Fallback to appState if form field is empty
        if (!currentPrompt && window.appState && window.appState.interviewSpec) {
            currentPrompt = window.appState.interviewSpec.initialPrompt || '';
        }

        if (questionText) questionText.value = currentQuestion;
        if (promptText) {
            promptText.value = currentPrompt;
            // Ensure the textarea is properly sized to show content
            promptText.style.height = 'auto';
            promptText.style.height = Math.max(promptText.scrollHeight, 200) + 'px';
        }
        
        console.log('Loading initial question data:', { currentQuestion, currentPrompt });
    }

    // Load data for follow-up editing
    function loadFollowupData() {
        const questionText = document.getElementById('editFollowupQuestionText');
        const promptText = document.getElementById('editFollowupPromptText');
        
        const currentQuestion = document.getElementById('previewFollowupQuestion')?.textContent || '';
        let currentPrompt = document.getElementById('specFollowupPrompt')?.value || '';
        
        // Fallback to appState if form field is empty
        if (!currentPrompt && window.appState && window.appState.interviewSpec) {
            currentPrompt = window.appState.interviewSpec.followupPrompt || '';
        }

        // Clean the prompt by removing internal instructions
        currentPrompt = cleanFollowupPrompt(currentPrompt);

        if (questionText) questionText.value = currentQuestion;
        if (promptText) {
            promptText.value = currentPrompt;
            // Ensure the textarea is properly sized to show content
            promptText.style.height = 'auto';
            promptText.style.height = Math.max(promptText.scrollHeight, 200) + 'px';
        }
        
        console.log('Loading followup data:', { currentQuestion, currentPrompt });
    }

    // Load data for report editing
    function loadReportData() {
        const reportText = document.getElementById('editReportText');
        const promptText = document.getElementById('editReportPromptText');
        
        const currentReport = document.getElementById('previewReport')?.textContent || '';
        let currentPrompt = document.getElementById('specReportPrompt')?.value || '';
        
        // Fallback to appState if form field is empty
        if (!currentPrompt && window.appState && window.appState.interviewSpec) {
            currentPrompt = window.appState.interviewSpec.reportPrompt || '';
        }

        // Clean the prompt by removing internal instructions
        currentPrompt = cleanReportPrompt(currentPrompt);

        if (reportText) reportText.value = currentReport;
        if (promptText) {
            promptText.value = currentPrompt;
            // Ensure the textarea is properly sized to show content
            promptText.style.height = 'auto';
            promptText.style.height = Math.max(promptText.scrollHeight, 200) + 'px';
        }
        
        console.log('Loading report data:', { currentReport, currentPrompt });
    }

    // Load data for email intro editing

    // Load data for admin report editing
    function loadAdminReportData() {
        const reportText = document.getElementById('editAdminReportText');
        const promptText = document.getElementById('editAdminReportPromptText');
        
        const currentReport = document.getElementById('previewAdminReportContent')?.textContent || '';
        let currentPrompt = document.getElementById('specAdminReportPrompt')?.value || '';
        
        // Fallback to appState if form field is empty
        if (!currentPrompt && window.appState && window.appState.interviewSpec) {
            currentPrompt = window.appState.interviewSpec.adminReportPrompt || '';
        }

        if (reportText) reportText.value = currentReport;
        if (promptText) {
            promptText.value = currentPrompt;
            // Ensure the textarea is properly sized to show content
            promptText.style.height = 'auto';
            promptText.style.height = Math.max(promptText.scrollHeight, 200) + 'px';
        }
        
        console.log('Loading admin report data:', { currentReport, currentPrompt });
    }

    // Handle save changes
    async function handleSaveChanges() {
        if (!currentEditType) return;

        let updatedData = {};

        switch (currentEditType) {
            case 'initial':
                updatedData = {
                    initialQuestion: document.getElementById('editInitialQuestionText')?.value,
                    initialPrompt: document.getElementById('editInitialPromptText')?.value
                };
                break;
            case 'followup':
                updatedData = {
                    followupPrompt: document.getElementById('editFollowupPromptText')?.value
                };
                break;
            case 'report':
                updatedData = {
                    reportPrompt: document.getElementById('editReportPromptText')?.value
                };
                break;
            case 'admin-report':
                updatedData = {
                    adminReportPrompt: document.getElementById('editAdminReportPromptText')?.value
                };
                break;
        }

        // Update the main form
        updateMainForm(updatedData);
        
        // Update appState with the new values
        if (window.appState && window.appState.setInterviewSpec) {
            console.log('[Edit Preview] Updating appState with:', updatedData);
            window.appState.setInterviewSpec(updatedData);
        }
        
        // Update preview displays
        updatePreviewDisplays(updatedData);

        // Close the panel
        closeEditPanel();

        // Enable save button and trigger save
        const saveBtn = document.getElementById('saveCopilotInterview');
        if (saveBtn) {
            saveBtn.disabled = false;
            
            // Automatically trigger the save action
            setTimeout(() => {
                console.log('[Edit Preview] Auto-saving changes to interview');
                if (window.handleSaveInterviewAction) {
                    window.handleSaveInterviewAction(saveBtn);
                } else {
                    console.error('[Edit Preview] handleSaveInterviewAction not found');
                }
            }, 100);
        }
    }

    // Update main form fields
    function updateMainForm(data) {
        if (data.initialPrompt !== undefined) {
            const field = document.getElementById('specInitialPrompt');
            if (field) field.value = data.initialPrompt;
        }
        if (data.followupPrompt !== undefined) {
            const field = document.getElementById('specFollowupPrompt');
            // For follow-up prompts, we need to add back the internal instructions
            // since they're expected to be in the stored prompt
            if (field) field.value = addInternalInstructionsToFollowupPrompt(data.followupPrompt);
        }
        if (data.reportPrompt !== undefined) {
            const field = document.getElementById('specReportPrompt');
            // For report prompts, we need to add back the internal instructions
            // since they're expected to be in the stored prompt
            if (field) field.value = addInternalInstructionsToReportPrompt(data.reportPrompt);
        }
        if (data.adminReportPrompt !== undefined) {
            const field = document.getElementById('specAdminReportPrompt');
            if (field) field.value = data.adminReportPrompt;
        }
    }

    // Update preview displays
    function updatePreviewDisplays(data) {
        if (data.initialQuestion !== undefined) {
            const preview = document.getElementById('previewInitialQuestion');
            if (preview) preview.textContent = data.initialQuestion;
        }
    }

    // Handle regenerate preview
    async function handleRegeneratePreview() {
        if (isRegenerating || !currentEditType) return;

        isRegenerating = true;
        const regenerateBtn = document.getElementById('regeneratePreviewBtn');
        const originalText = regenerateBtn?.textContent;

        if (regenerateBtn) {
            regenerateBtn.textContent = 'Regenerating...';
            regenerateBtn.disabled = true;
        }

        let promptText = '';
        let previewField = null;

        switch (currentEditType) {
            case 'initial':
                promptText = document.getElementById('editInitialPromptText')?.value || '';
                previewField = document.getElementById('editInitialQuestionText');
                break;
            case 'followup':
                promptText = document.getElementById('editFollowupPromptText')?.value || '';
                previewField = document.getElementById('editFollowupQuestionText');
                break;
            case 'report':
                promptText = document.getElementById('editReportPromptText')?.value || '';
                previewField = document.getElementById('editReportText');
                break;
            case 'admin-report':
                promptText = document.getElementById('editAdminReportPromptText')?.value || '';
                previewField = document.getElementById('editAdminReportText');
                break;
        }

        if (!promptText || !previewField) {
            alert('Missing prompt or preview field');
            isRegenerating = false;
            if (regenerateBtn) {
                regenerateBtn.textContent = originalText || 'Regenerate Preview';
                regenerateBtn.disabled = false;
            }
            return;
        }

        // Call the copilot to generate preview
        window.generatePreviewContent(currentEditType, promptText)
            .then(response => {
                if (response && response.content) {
                    previewField.value = response.content;
                    
                    // For initial question, also update the preview
                    if (currentEditType === 'initial') {
                        const initialPreview = document.getElementById('previewInitialQuestion');
                        if (initialPreview) initialPreview.textContent = response.content;
                    }
                }
                
                isRegenerating = false;
                if (regenerateBtn) {
                    regenerateBtn.textContent = originalText || 'Regenerate Preview';
                    regenerateBtn.disabled = false;
                }
            })
            .catch(error => {
                console.error('Error in generatePreviewContent:', error);
                alert('Failed to regenerate preview. Please try again.');
                
                isRegenerating = false;
                if (regenerateBtn) {
                    regenerateBtn.textContent = originalText || 'Regenerate Preview';
                    regenerateBtn.disabled = false;
                }
            });
    }

    // Update edit buttons visibility based on active tab
    function updateEditButtonsVisibility() {
        const activeTab = document.querySelector('.spec-tab-button.active')?.getAttribute('data-tab');
        const editButtons = document.querySelectorAll('.edit-preview-btn');

        if (activeTab === 'spec-interview-details') {
            editButtons.forEach(btn => btn.style.display = 'flex');
        } else {
            editButtons.forEach(btn => btn.style.display = 'none');
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeEditPreviewPanel);
    } else {
        initializeEditPreviewPanel();
    }

    // Export functions for external use
    window.editPreviewPanel = {
        open: openEditPanel,
        close: closeEditPanel,
        initialize: initializeEditPreviewPanel
    };
})(); 