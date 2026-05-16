// File Management Functions

// File input change handler
function setupFileInputHandler() {
    const contextFileInput = document.getElementById('contextFileInput');
    const contextAddButton = document.getElementById('contextAddButton');
    const saveCopilotInterview = document.getElementById('saveCopilotInterview');
    const saveCopilotInterviewFromFilesTab = document.getElementById('saveCopilotInterviewFromFilesTab');
    
    // Modal elements - reuse the same modals from copilot
    const uploadOptionsModal = document.getElementById('uploadOptionsModal');
    const uploadFileOption = document.getElementById('uploadFileOption');
    const pasteTextOption = document.getElementById('pasteTextOption');
    const closeUploadModal = document.getElementById('closeUploadModal');
    const uploadOptionsOverlay = document.getElementById('uploadOptionsOverlay');
    
    const textPasteModal = document.getElementById('textPasteModal');
    const pastedTextFileName = document.getElementById('pastedTextFileName');
    const pastedTextContent = document.getElementById('pastedTextContent');
    const confirmTextPaste = document.getElementById('confirmTextPaste');
    const cancelTextPaste = document.getElementById('cancelTextPaste');
    const textPasteOverlay = document.getElementById('textPasteOverlay');
    
    // Handle context add button click
    contextAddButton?.addEventListener('click', () => {
        window._currentUploadContext = 'context';
        uploadOptionsModal?.classList.remove('hidden');
    });
    
    // Override the upload file option handler to handle both contexts
    if (uploadFileOption && !uploadFileOption._contextHandlerAdded) {
        uploadFileOption._contextHandlerAdded = true;
        uploadFileOption.addEventListener('click', (e) => {
            if (window._currentUploadContext === 'context') {
                e.stopImmediatePropagation();
                uploadOptionsModal?.classList.add('hidden');
                contextFileInput?.click();
            }
        });
    }
    
    // Override the paste text option handler to handle both contexts
    if (pasteTextOption && !pasteTextOption._contextHandlerAdded) {
        pasteTextOption._contextHandlerAdded = true;
        pasteTextOption.addEventListener('click', (e) => {
            if (window._currentUploadContext === 'context') {
                e.stopImmediatePropagation();
                uploadOptionsModal?.classList.add('hidden');
                textPasteModal?.classList.remove('hidden');
                pastedTextFileName.value = '';
                pastedTextContent.value = '';
                pastedTextContent.focus();
            }
        });
    }
    
    // Override text paste confirmation for context tab
    if (confirmTextPaste && !confirmTextPaste._contextHandlerAdded) {
        confirmTextPaste._contextHandlerAdded = true;
        confirmTextPaste.addEventListener('click', async (e) => {
            if (window._currentUploadContext === 'context') {
                e.stopImmediatePropagation();
                const fileName = pastedTextFileName.value.trim() || 'pasted-content.txt';
                const content = pastedTextContent.value.trim();
                
                if (!content) {
                    alert('Please paste some content before continuing.');
                    return;
                }
                
                // Create a file from the pasted text
                const blob = new Blob([content], { type: 'text/plain' });
                const file = new File([blob], fileName, { type: 'text/plain' });
                
                // Close modal
                textPasteModal?.classList.add('hidden');
                
                // Create a FileList-like object
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                
                // Simulate file selection
                displaySelectedFiles(dataTransfer.files);
                
                // Store the files for later upload
                window._contextPastedFiles = dataTransfer.files;
                
                // Enable save buttons
                if (saveCopilotInterview) saveCopilotInterview.disabled = false;
                if (saveCopilotInterviewFromFilesTab) saveCopilotInterviewFromFilesTab.disabled = false;
            }
        });
    }
    
    contextFileInput?.addEventListener('change', (event) => {
        displaySelectedFiles(event.target.files);
        // Enable save buttons whenever the file input changes
        if (saveCopilotInterview) saveCopilotInterview.disabled = false;
        if (saveCopilotInterviewFromFilesTab) saveCopilotInterviewFromFilesTab.disabled = false;
    });
}

// Display files selected in the input (before upload)
function displaySelectedFiles(fileList) {
    const uploadedFilesList = document.getElementById('uploadedFilesList');
    if (!uploadedFilesList) return;
    
    uploadedFilesList.innerHTML = '';
    if (!fileList || fileList.length === 0) {
        // If selection is cleared, show the saved files again
        displaySavedFiles(appState.currentInterviewFiles);
        return;
    }
    uploadedFilesList.innerHTML = '<p class="text-sm font-semibold text-gray-300 mb-1">Files to upload:</p>';
    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const fileElement = document.createElement('div');
        fileElement.className = 'text-sm text-gray-400 pl-2';
        fileElement.textContent = `- ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        uploadedFilesList.appendChild(fileElement);
    }
}

// Display files already saved (from Firestore)
function displaySavedFiles(filesArray) {
    const uploadedFilesList = document.getElementById('uploadedFilesList');
    if (!uploadedFilesList) return;
    
    uploadedFilesList.innerHTML = '';

    if (!filesArray || filesArray.length === 0) {
        uploadedFilesList.innerHTML = '<p class="text-sm text-gray-500 italic">No context files associated with this interview.</p>';
    } else {
        uploadedFilesList.innerHTML = '<p class="text-sm font-semibold text-gray-300 mb-2">Associated context files:</p>';
        filesArray.forEach(fileData => {
            const fileElement = document.createElement('div');
            fileElement.className = 'flex justify-between items-center text-sm text-gray-300 bg-gray-700 px-2 py-1 rounded mb-1';
            fileElement.innerHTML = `
                <span>${fileData.name}</span>
                <button class="remove-file-btn text-red-400 hover:text-red-300 text-xs ml-2" data-path="${fileData.path}" title="Remove File">[Remove]</button>
            `;
            // Add listener for the remove button
            fileElement.querySelector('.remove-file-btn').addEventListener('click', handleRemoveFile);
            uploadedFilesList.appendChild(fileElement);
        });
    }
}

// Handle file removal (marks for removal on save)
function handleRemoveFile(event) {
    const button = event.target;
    const fileElement = button.closest('div');
    const filePath = button.getAttribute('data-path');
    const saveCopilotInterview = document.getElementById('saveCopilotInterview');
    const saveCopilotInterviewFromFilesTab = document.getElementById('saveCopilotInterviewFromFilesTab');

    // Toggle a visual indicator and mark for removal
    if (fileElement.classList.toggle('marked-for-removal')) {
        fileElement.style.textDecoration = 'line-through';
        fileElement.style.opacity = '0.6';
        button.textContent = '[Undo Remove]';
        button.title = 'Undo Remove';
    } else {
        fileElement.style.textDecoration = 'none';
        fileElement.style.opacity = '1';
        button.textContent = '[Remove]';
        button.title = 'Remove File';
    }
    
    // Enable save buttons as changes were made
    if (saveCopilotInterview) saveCopilotInterview.disabled = false;
    if (saveCopilotInterviewFromFilesTab) saveCopilotInterviewFromFilesTab.disabled = false;
}

// Upload a single file via backend
async function uploadFile(interviewId, file) { 
    const formData = new FormData();
    formData.append('contextFile', file, file.name);

    try {
        // Get auth token if user is logged in
        let headers = {};
        if (window.firebase && window.firebase.auth().currentUser) {
            const idToken = await window.firebase.auth().currentUser.getIdToken();
            headers['Authorization'] = `Bearer ${idToken}`;
            console.log('[uploadFile] Sending request with auth token');
        } else {
            console.warn('[uploadFile] No auth token available - user may not be authenticated');
        }

        console.log('[uploadFile] Uploading file:', {
            interviewId,
            fileName: file.name,
            fileSize: file.size,
            hasAuth: !!headers['Authorization']
        });

        const response = await fetch(`/api/interviews/${interviewId}/upload`, {
            method: 'POST',
            headers: headers,
            body: formData,
        });

        if (!response.ok) {
            let errorMessage = `Server error: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
            } catch (e) {
                // Response wasn't JSON, likely an HTML error page
                console.error('Error response was not JSON:', e);
            }
            throw new Error(errorMessage);
        }

        const result = await response.json();
        console.log(`Uploaded ${result.name} via backend to ${result.path}`);
        return result; 
    } catch (error) {
        console.error(`Error uploading ${file.name} via backend:`, error);
        throw error;
    }
}



// Toggle file upload section visibility
function toggleFileUploadSectionVisibility(isVisible) {
    const fileUploadSection = document.getElementById('fileUploadSection');
    if (fileUploadSection) {
        console.log(`Debug: toggleFileUploadSectionVisibility called. isVisible: ${isVisible}, fileUploadSection display was: ${fileUploadSection.style.display}`);
        fileUploadSection.style.display = isVisible ? 'block' : 'none';
    } else {
        console.error("Debug: fileUploadSection element not found in toggleFileUploadSectionVisibility");
    }
}

// Initialize file management
document.addEventListener('DOMContentLoaded', function() {
    setupFileInputHandler();
});

// Export functions for global use
window.displaySelectedFiles = displaySelectedFiles;
window.displaySavedFiles = displaySavedFiles;
window.uploadFile = uploadFile;

window.toggleFileUploadSectionVisibility = toggleFileUploadSectionVisibility;

// Debug function to test context loading
window.testInterviewContext = async function() {
    if (!appState.currentEditingInterviewId) {
        alert('No interview currently loaded');
        return;
    }
    
    const db = window.firebase.firestore();
    try {
        const doc = await db.collection('interviews').doc(appState.currentEditingInterviewId).get();
        if (!doc.exists) {
            alert('Interview not found');
            return;
        }
        
        const data = doc.data();
        const contextFiles = data.contextFiles || [];
        
        let message = `Interview: ${data.title}\n\n`;
        message += `Context Files: ${contextFiles.length}\n\n`;
        
        if (contextFiles.length > 0) {
            message += 'Files that will be available to AI:\n';
            contextFiles.forEach((file, index) => {
                message += `${index + 1}. ${file.name} (${file.path})\n`;
            });
            
            message += '\n\nThese files will be processed and their content will be available to the AI interviewer through the {{CONTEXT}} placeholder in prompts.';
            
            if (data.initialPrompt && data.initialPrompt.includes('{{CONTEXT}}')) {
                message += '\n\n✓ Initial prompt uses {{CONTEXT}}';
            } else {
                message += '\n\n✗ Initial prompt does NOT use {{CONTEXT}}';
            }
            
            if (data.followupPrompt && data.followupPrompt.includes('{{CONTEXT}}')) {
                message += '\n✓ Followup prompt uses {{CONTEXT}}';
            } else {
                message += '\n✗ Followup prompt does NOT use {{CONTEXT}}';
            }
        } else {
            message += 'No context files uploaded yet.';
        }
        
        alert(message);
        
    } catch (error) {
        console.error('Error testing context:', error);
        alert('Error loading interview data: ' + error.message);
    }
}; 