// Copilot File Handler

let copilotUploadedFile = null;
let copilotFileContent = null;

// Initialize copilot file upload functionality
function initializeCopilotFileUpload() {
    const fileInput = document.getElementById('copilotFileInput');
    const attachButton = document.getElementById('attachCopilotFile');
    const removeButton = document.getElementById('removeCopilotFile');
    const filePreview = document.getElementById('copilotFilePreview');
    
    // Modal elements
    const uploadOptionsModal = document.getElementById('uploadOptionsModal');
    const uploadFileOption = document.getElementById('uploadFileOption');
    const pasteTextOption = document.getElementById('pasteTextOption');
    const scrapeWebsiteOption = document.getElementById('scrapeWebsiteOption');
    const closeUploadModal = document.getElementById('closeUploadModal');
    const uploadOptionsOverlay = document.getElementById('uploadOptionsOverlay');
    
    const textPasteModal = document.getElementById('textPasteModal');
    const pastedTextFileName = document.getElementById('pastedTextFileName');
    const pastedTextContent = document.getElementById('pastedTextContent');
    const confirmTextPaste = document.getElementById('confirmTextPaste');
    const cancelTextPaste = document.getElementById('cancelTextPaste');
    const textPasteOverlay = document.getElementById('textPasteOverlay');
    
    const websiteScrapeModal = document.getElementById('websiteScrapeModal');
    const websiteUrlInput = document.getElementById('websiteUrl');
    const scrapeDepthSelect = document.getElementById('scrapeDepth');
    const confirmWebsiteScrape = document.getElementById('confirmWebsiteScrape');
    const cancelWebsiteScrape = document.getElementById('cancelWebsiteScrape');
    const websiteScrapeOverlay = document.getElementById('websiteScrapeOverlay');
    const websiteScrapeStatus = document.getElementById('websiteScrapeStatus');
    const websiteScrapeStatusText = document.getElementById('websiteScrapeStatusText');
    
    // Track which context triggered the modal
    window._currentUploadContext = null; // 'context' or 'copilot'
    
    // Handle attach button click - show modal instead of file picker
    attachButton?.addEventListener('click', () => {
        window._currentUploadContext = 'copilot';
        uploadOptionsModal?.classList.remove('hidden');
    });
    
    // Handle upload file option
    uploadFileOption?.addEventListener('click', () => {
        uploadOptionsModal?.classList.add('hidden');
        fileInput?.click();
    });
    
    // Handle paste text option
    pasteTextOption?.addEventListener('click', () => {
        uploadOptionsModal?.classList.add('hidden');
        textPasteModal?.classList.remove('hidden');
        pastedTextFileName.value = '';
        pastedTextContent.value = '';
        pastedTextContent.focus();
    });
    
    // Handle scrape website option
    scrapeWebsiteOption?.addEventListener('click', () => {
        uploadOptionsModal?.classList.add('hidden');
        websiteScrapeModal?.classList.remove('hidden');
        websiteUrlInput.value = '';
        websiteUrlInput.focus();
    });
    
    // Handle close upload modal
    closeUploadModal?.addEventListener('click', () => {
        uploadOptionsModal?.classList.add('hidden');
    });
    uploadOptionsOverlay?.addEventListener('click', () => {
        uploadOptionsModal?.classList.add('hidden');
    });
    
    // Handle text paste confirmation
    confirmTextPaste?.addEventListener('click', async () => {
        const fileName = (pastedTextFileName.value.trim() || 'pasted-content') + '.txt';
        const content = pastedTextContent.value.trim();
        
        if (!content) {
            alert('Please paste some content before continuing.');
            return;
        }
        
        // Create a file from the pasted text
        const blob = new Blob([content], { type: 'text/plain' });
        const file = new File([blob], fileName, { type: 'text/plain' });
        
        // Close modal and ensure it's properly hidden
        textPasteModal?.classList.add('hidden');
        uploadOptionsModal?.classList.add('hidden');
        
        // Clear the input fields
        pastedTextFileName.value = '';
        pastedTextContent.value = '';
        
        // Process the file as if it was uploaded
        await handleCopilotFileSelection(file);
        
        // Return focus to copilot input
        const copilotInput = document.getElementById('copilotInput');
        if (copilotInput) {
            copilotInput.focus();
        }
    });
    
    // Handle cancel text paste
    cancelTextPaste?.addEventListener('click', () => {
        textPasteModal?.classList.add('hidden');
        pastedTextFileName.value = '';
        pastedTextContent.value = '';
    });
    textPasteOverlay?.addEventListener('click', () => {
        textPasteModal?.classList.add('hidden');
        pastedTextFileName.value = '';
        pastedTextContent.value = '';
    });
    
    // Handle website scrape confirmation
    confirmWebsiteScrape?.addEventListener('click', async () => {
        const url = websiteUrlInput.value.trim();
        const depth = parseInt(scrapeDepthSelect.value);
        
        if (!url) {
            alert('Please enter a website URL.');
            return;
        }
        
        // Validate URL
        try {
            new URL(url);
        } catch (e) {
            alert('Please enter a valid URL (e.g., https://example.com)');
            return;
        }
        
        // Show loading state
        websiteScrapeStatus?.classList.remove('hidden');
        confirmWebsiteScrape.disabled = true;
        cancelWebsiteScrape.disabled = true;
        websiteScrapeStatusText.textContent = 'Scraping website...';
        
        try {
            // Call the server endpoint to scrape the website using Exa API
            const response = await fetch('/api/scrape-website', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await firebase.auth().currentUser?.getIdToken()}`
                },
                body: JSON.stringify({ url, depth })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to scrape website');
            }
            
            const result = await response.json();
            
            // Close modal
            websiteScrapeModal?.classList.add('hidden');
            websiteScrapeStatus?.classList.add('hidden');
            confirmWebsiteScrape.disabled = false;
            cancelWebsiteScrape.disabled = false;
            
            // Create a file from the scraped content
            const fileName = new URL(url).hostname.replace(/[^a-z0-9]/gi, '_') + '_scraped.txt';
            const content = result.content || 'No content scraped';
            const blob = new Blob([content], { type: 'text/plain' });
            const file = new File([blob], fileName, { type: 'text/plain' });
            
            // Process the file as if it was uploaded
            await handleCopilotFileSelection(file);
            
            // Return focus to copilot input
            const copilotInput = document.getElementById('copilotInput');
            if (copilotInput) {
                copilotInput.focus();
            }
            
        } catch (error) {
            console.error('[WebsiteScrape] Error:', error);
            alert('Failed to scrape website: ' + error.message);
            
            // Reset modal state
            websiteScrapeStatus?.classList.add('hidden');
            confirmWebsiteScrape.disabled = false;
            cancelWebsiteScrape.disabled = false;
        }
    });
    
    // Handle cancel website scrape
    cancelWebsiteScrape?.addEventListener('click', () => {
        websiteScrapeModal?.classList.add('hidden');
        websiteUrlInput.value = '';
        websiteScrapeStatus?.classList.add('hidden');
        confirmWebsiteScrape.disabled = false;
        cancelWebsiteScrape.disabled = false;
    });
    
    websiteScrapeOverlay?.addEventListener('click', () => {
        websiteScrapeModal?.classList.add('hidden');
        websiteUrlInput.value = '';
        websiteScrapeStatus?.classList.add('hidden');
        confirmWebsiteScrape.disabled = false;
        cancelWebsiteScrape.disabled = false;
    });
    
    // Handle file selection
    fileInput?.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            await handleCopilotFileSelection(file);
        }
    });
    
    // Handle remove file
    removeButton?.addEventListener('click', () => {
        removeCopilotFile();
    });
    
    // Listen for copilot mode changes
    document.addEventListener('copilotModeChanged', updateFileUploadVisibility);
    
    // Set initial visibility
    updateFileUploadVisibility();
}

// Update file upload visibility based on copilot mode
function updateFileUploadVisibility() {
    const attachButton = document.getElementById('attachCopilotFile');
    const copilotInput = document.getElementById('copilotInput');
    
    if (!attachButton || !copilotInput) {
        console.log('[updateFileUploadVisibility] Elements not found - attachButton:', !!attachButton, 'copilotInput:', !!copilotInput);
        return;
    }
    
    // Check both appState and if we're in journal mode
    const isEditorMode = window.appState && window.appState.copilotMode === 'editor' && !window.appState.isJournalAnalysisMode;
    
    console.log('[updateFileUploadVisibility] Mode:', window.appState?.copilotMode, 'IsJournal:', window.appState?.isJournalAnalysisMode, 'ShowUpload:', isEditorMode);
    console.log('[updateFileUploadVisibility] Button classes before:', attachButton.className);
    
    // Only show in editor mode (and not in journal mode)
    if (isEditorMode) {
        attachButton.classList.remove('hidden');
        attachButton.style.display = ''; // Remove inline style
        copilotInput.classList.remove('rounded-l-md');
        console.log('[updateFileUploadVisibility] Showing upload button');
    } else {
        attachButton.classList.add('hidden');
        attachButton.style.display = 'none'; // Force hide with inline style
        copilotInput.classList.add('rounded-l-md');
        console.log('[updateFileUploadVisibility] Hiding upload button');
        // Don't remove the file - it should remain available for context
        console.log('[updateFileUploadVisibility] Keeping file context when switching modes');
    }
    
    console.log('[updateFileUploadVisibility] Button classes after:', attachButton.className);
}

// Export for global access
window.updateFileUploadVisibility = updateFileUploadVisibility;

// Handle file selection
async function handleCopilotFileSelection(file) {
    console.log('[CopilotFileHandler] File selected:', {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified).toISOString()
    });
    
    const filePreview = document.getElementById('copilotFilePreview');
    const fileName = document.getElementById('copilotFileName');
    const fileSize = document.getElementById('copilotFileSize');
    
    // Store the file
    copilotUploadedFile = file;
    console.log('[CopilotFileHandler] File stored in copilotUploadedFile variable');
    
    // Update UI
    fileName.textContent = file.name;
    fileSize.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
    filePreview.classList.remove('hidden');
    
    // Read file content
    try {
        console.log('[CopilotFileHandler] Starting to read file content...');
        copilotFileContent = await readFileContent(file);
        console.log('[CopilotFileHandler] File content loaded:', {
            fileName: file.name,
            contentType: copilotFileContent?.type || 'text',
            contentLength: copilotFileContent?.type === 'image' ? copilotFileContent.base64.length : (copilotFileContent ? copilotFileContent.length : 0),
            contentPreview: copilotFileContent?.type === 'image' ? 'Image data' : (copilotFileContent ? copilotFileContent.substring(0, 200) + '...' : 'null')
        });
        
        // Add file to context for new interviews
        console.log('[CopilotFileHandler] Checking interview state:', {
            currentEditingInterviewId: window.appState.currentEditingInterviewId,
            hasAppState: !!window.appState,
            appStateKeys: window.appState ? Object.keys(window.appState) : []
        });
        
        if (!window.appState.currentEditingInterviewId) {
            console.log('[CopilotFileHandler] No currentEditingInterviewId, adding to copilot context files');
            window.addCopilotFileToInitialContext();
            console.log('[CopilotFileHandler] After addCopilotFileToInitialContext, appState.copilotContextFiles:', 
                window.appState.copilotContextFiles);
        } else {
            // For existing interviews, upload the file immediately
            console.log('[CopilotFileHandler] Existing interview detected:', window.appState.currentEditingInterviewId);
            console.log('[CopilotFileHandler] Starting immediate upload to context tab');
            
            // Show upload starting message immediately
            if (window.appendAIMessage) {
                window.appendAIMessage(`📎 Uploading "${copilotUploadedFile.name}"...`, false, true);
            }
            
            // Set the pending upload promise so messages wait for completion
            window.pendingCopilotFileUpload = uploadCopilotFileToExistingInterview()
                .then(() => {
                    console.log('[CopilotFileHandler] Upload completed successfully');
                    window.pendingCopilotFileUpload = null;
                    
                    // Show a success message in the chat
                    if (window.appendAIMessage) {
                        window.appendAIMessage(`✅ File "${copilotUploadedFile.name}" uploaded successfully and is now available as context.`, false, true);
                    }
                })
                .catch((uploadError) => {
                    console.error('[CopilotFileHandler] Error during upload:', uploadError);
                    alert('Error uploading file to interview context: ' + uploadError.message);
                    window.pendingCopilotFileUpload = null;
                    throw uploadError; // Re-throw so the message handler knows upload failed
                });
        }
    } catch (error) {
        console.error('[CopilotFileHandler] Error reading file:', error);
        alert('Error reading file. Please try again.');
        removeCopilotFile();
    }
}

// Read file content
async function readFileContent(file) {
    console.log('[readFileContent] Processing file:', {
        name: file.name,
        type: file.type,
        size: file.size
    });
    
    // Check if file is an image
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    const isImage = imageExtensions.some(ext => file.name.toLowerCase().endsWith(ext)) || 
                    file.type.startsWith('image/');
    
    if (isImage) {
        console.log('[readFileContent] Image file detected, converting to base64');
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                // Return an object with image data and metadata
                const imageData = {
                    type: 'image',
                    mimeType: file.type,
                    base64: e.target.result.split(',')[1], // Remove data:image/jpeg;base64, prefix
                    dataUrl: e.target.result,
                    fileName: file.name
                };
                console.log('[readFileContent] Image converted to base64:', {
                    fileName: file.name,
                    mimeType: file.type,
                    base64Length: imageData.base64.length
                });
                resolve(imageData);
            };
            
            reader.onerror = () => {
                reject(new Error('Failed to read image file'));
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    // For PDFs and Word docs, we need server-side extraction
    if (file.name.toLowerCase().endsWith('.pdf') || 
        file.name.toLowerCase().endsWith('.doc') || 
        file.name.toLowerCase().endsWith('.docx')) {
        
        console.log('[readFileContent] Binary file detected, uploading for server-side extraction');
        
        try {
            // Create a temporary upload to extract text
            const formData = new FormData();
            formData.append('file', file);
            formData.append('extractOnly', 'true'); // Flag to indicate we only want text extraction
            
            // Get auth token if available
            let headers = {};
            if (window.firebase && window.firebase.auth().currentUser) {
                const idToken = await window.firebase.auth().currentUser.getIdToken();
                headers['Authorization'] = `Bearer ${idToken}`;
                console.log('[readFileContent] Added auth token for extract-text request');
            }
            
            // Upload to a special endpoint that extracts and returns text
            const response = await fetch('/api/extract-text', {
                method: 'POST',
                headers: headers,
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Failed to extract text: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('[readFileContent] Text extraction complete:', {
                fileName: file.name,
                textLength: result.text ? result.text.length : 0
            });
            
            return result.text || `[Failed to extract text from ${file.name}]`;
            
        } catch (error) {
            console.error('[readFileContent] Error extracting text from binary file:', error);
            return `[Error extracting text from ${file.name}: ${error.message}]`;
        }
    }
    
    // For text-based files, read directly
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const content = e.target.result;
            console.log('[readFileContent] Text file read complete:', {
                fileName: file.name,
                contentLength: content.length,
                contentPreview: content.substring(0, 100) + '...'
            });
            resolve(content);
        };
        
        reader.onerror = () => {
            reject(new Error('Failed to read file'));
        };
        
        reader.readAsText(file);
    });
}

// Remove uploaded file
function removeCopilotFile() {
    const fileInput = document.getElementById('copilotFileInput');
    const filePreview = document.getElementById('copilotFilePreview');
    
    // Clear the file
    copilotUploadedFile = null;
    copilotFileContent = null;
    
    // Also clear from appState if not yet saved
    if (!window.appState.currentEditingInterviewId && window.appState.copilotContextFiles) {
        window.appState.copilotContextFiles = [];
    }
    
    // Reset UI
    filePreview.classList.add('hidden');
    if (fileInput) fileInput.value = '';
}

// Get current file content for context - DEPRECATED
// Context is now loaded from Firestore via the context API
window.getCopilotFileContext = function() {
    console.log('[getCopilotFileContext] DEPRECATED - Context now loaded from Firestore');
    return null;
};

// Clear file after it's been processed
window.clearCopilotFile = function() {
    removeCopilotFile();
};

// Add file content to initial chat messages for new interviews
window.addCopilotFileToInitialContext = function() {
    console.log('[addCopilotFileToInitialContext] Called. Current state:', {
        hasCopilotUploadedFile: !!copilotUploadedFile,
        hasCopilotFileContent: !!copilotFileContent,
        currentCopilotContextFiles: appState.copilotContextFiles
    });
    
    if (!copilotUploadedFile || !copilotFileContent) {
        console.log('[addCopilotFileToInitialContext] Missing file or content, returning early');
        return;
    }
    
    // Store file info in appState for persistence
    if (!appState.copilotContextFiles) {
        appState.copilotContextFiles = [];
        console.log('[addCopilotFileToInitialContext] Initialized empty copilotContextFiles array');
    }
    
    const fileInfo = {
        name: copilotUploadedFile.name,
        content: copilotFileContent,
        uploadedAt: new Date().toISOString()
    };
    
    appState.copilotContextFiles.push(fileInfo);
    
    console.log('[addCopilotFileToInitialContext] Added file to context:', {
        fileName: fileInfo.name,
        contentLength: fileInfo.content.length,
        uploadedAt: fileInfo.uploadedAt,
        totalFilesInContext: appState.copilotContextFiles.length
    });
};

// Upload file to existing interview's context
async function uploadCopilotFileToExistingInterview() {
    console.log('[uploadCopilotFileToExistingInterview] Called. State:', {
        hasCopilotUploadedFile: !!copilotUploadedFile,
        currentEditingInterviewId: window.appState.currentEditingInterviewId,
        currentInterviewFiles: window.appState.currentInterviewFiles
    });
    
    if (!copilotUploadedFile || !window.appState.currentEditingInterviewId) {
        console.log('[uploadCopilotFileToExistingInterview] Missing file or interview ID, returning');
        return;
    }
    
    if (!copilotFileContent) {
        console.log('[uploadCopilotFileToExistingInterview] No file content extracted, returning');
        alert('No text content was extracted from the file');
        return;
    }
    
    // Add uploading indicator to the copilot chat
    const copilotMessages = document.getElementById('copilotMessages');
    console.log('[uploadCopilotFileToExistingInterview] Adding upload indicator, copilotMessages exists:', !!copilotMessages);
    console.log('[uploadCopilotFileToExistingInterview] copilotMessages element:', copilotMessages);
    console.log('[uploadCopilotFileToExistingInterview] copilotMessages display style:', copilotMessages?.style.display);
    console.log('[uploadCopilotFileToExistingInterview] copilotMessages parent:', copilotMessages?.parentElement);
    
    if (copilotMessages) {
        const uploadingMessage = document.createElement('div');
        uploadingMessage.className = 'text-xs text-gray-500 text-center my-2';
        uploadingMessage.id = 'file-uploading-indicator';
        uploadingMessage.innerHTML = '📎 Uploading ' + copilotUploadedFile.name + '...';
        console.log('[uploadCopilotFileToExistingInterview] Created upload indicator element:', uploadingMessage);
        
        copilotMessages.appendChild(uploadingMessage);
        copilotMessages.scrollTop = copilotMessages.scrollHeight;
        
        // Double check it was added
        const addedIndicator = document.getElementById('file-uploading-indicator');
        console.log('[uploadCopilotFileToExistingInterview] Upload indicator added to DOM:', !!addedIndicator);
        console.log('[uploadCopilotFileToExistingInterview] Upload indicator text:', addedIndicator?.textContent);
        console.log('[uploadCopilotFileToExistingInterview] Total messages in chat:', copilotMessages.children.length);
    } else {
        console.error('[uploadCopilotFileToExistingInterview] copilotMessages element not found!');
    }
    
    try {
        // Show loading state
        const filePreview = document.getElementById('copilotFilePreview');
        const fileName = document.getElementById('copilotFileName');
        if (fileName) {
            fileName.textContent = copilotUploadedFile.name + ' (saving...)';
        }
        
        // Create a text file from the extracted content
        console.log('[uploadCopilotFileToExistingInterview] Creating text blob from extracted content:', {
            fileName: copilotUploadedFile.name,
            contentLength: copilotFileContent.length,
            originalFileType: copilotUploadedFile.type
        });
        
        // Create a text file with the extracted content
        const textBlob = new Blob([copilotFileContent], { type: 'text/plain' });
        const textFileName = copilotUploadedFile.name.replace(/\.[^/.]+$/, '') + '_extracted.txt';
        const textFile = new File([textBlob], textFileName, { type: 'text/plain' });
        
        console.log('[uploadCopilotFileToExistingInterview] Uploading extracted text as:', {
            fileName: textFileName,
            fileSize: textFile.size,
            fileType: textFile.type
        });
        
        if (!window.uploadFile) {
            throw new Error('window.uploadFile is not defined. File management module may not be loaded.');
        }
        
        const fileMetadata = await window.uploadFile(window.appState.currentEditingInterviewId, textFile);
        console.log('[uploadCopilotFileToExistingInterview] File upload complete, metadata:', fileMetadata);
        
        // Add to current interview files
        if (!window.appState.currentInterviewFiles) {
            window.appState.currentInterviewFiles = [];
            console.log('[uploadCopilotFileToExistingInterview] Initialized empty currentInterviewFiles array');
        }
        window.appState.currentInterviewFiles.push(fileMetadata);
        console.log('[uploadCopilotFileToExistingInterview] Added to currentInterviewFiles:', {
            totalFiles: window.appState.currentInterviewFiles.length,
            allFiles: window.appState.currentInterviewFiles
        });
        
        // DEBUG: Show alert with file info for quick testing
        if (window.location.hostname === 'localhost' || window.location.search.includes('debug=true')) {
            alert(`DEBUG: File uploaded successfully!\n\nFile: ${fileMetadata.name}\nPath: ${fileMetadata.path}\nSize: ${fileMetadata.size} bytes\n\nTotal context files: ${window.appState.currentInterviewFiles.length}`);
        }
        
        // Update the interview in Firestore with the new file
        const db = window.firebase.firestore();
        console.log('[uploadCopilotFileToExistingInterview] Updating Firestore interview document with contextFiles:', {
            interviewId: window.appState.currentEditingInterviewId,
            contextFiles: window.appState.currentInterviewFiles
        });
        
        await db.collection('interviews').doc(window.appState.currentEditingInterviewId).update({
            contextFiles: window.appState.currentInterviewFiles
        });
        
        console.log('[uploadCopilotFileToExistingInterview] Firestore update complete');
        
        // Update UI to show success
        if (fileName) {
            fileName.textContent = copilotUploadedFile.name + ' (uploaded)';
        }
        
        // Reload the interview data to ensure everything is synced
        console.log('[uploadCopilotFileToExistingInterview] Reloading interview to refresh context files');
        const currentInterviewId = window.appState.currentEditingInterviewId;
        
        // First update local state
        if (window.displaySavedFiles) {
            console.log('[uploadCopilotFileToExistingInterview] Refreshing context files display');
            window.displaySavedFiles(window.appState.currentInterviewFiles);
        }
        
        // Switch to the context tab to show the uploaded file
        const contextTab = document.querySelector('[data-tab="spec-files"]');
        if (contextTab && !contextTab.classList.contains('active')) {
            console.log('[uploadCopilotFileToExistingInterview] Switching to context tab to show uploaded file');
            contextTab.click();
        }
        
        // Reload interview data to ensure everything is fresh
        if (window.loadInterviewForEditing) {
            console.log('[uploadCopilotFileToExistingInterview] Triggering interview reload');
            // Set the active tab to context before reloading
            window.appState.setActiveSpecTab('spec-files');
            // Small delay to ensure Firestore has propagated the update
            setTimeout(() => {
                window.loadInterviewForEditing(currentInterviewId);
            }, 500);
        }
        
        // Don't clear the copilot file - keep it available for the conversation
        console.log('[uploadCopilotFileToExistingInterview] Keeping copilot file available for conversation context');
        
        // Set a flag to force context reload on next message
        window.forceContextReload = true;
        console.log('[uploadCopilotFileToExistingInterview] Set forceContextReload flag');
        
        // Clear any existing system messages from copilot chat to force reload
        if (window.firebase && window.appState.currentEditingInterviewId) {
            const db = window.firebase.firestore();
            try {
                const systemMessages = await db.collection('interviews')
                    .doc(window.appState.currentEditingInterviewId)
                    .collection('copilotChat')
                    .where('sender', '==', 'system')
                    .get();
                
                const deletePromises = [];
                systemMessages.forEach(doc => {
                    deletePromises.push(doc.ref.delete());
                });
                
                if (deletePromises.length > 0) {
                    await Promise.all(deletePromises);
                    console.log('[uploadCopilotFileToExistingInterview] Cleared', deletePromises.length, 'system messages');
                }
            } catch (error) {
                console.error('[uploadCopilotFileToExistingInterview] Error clearing system messages:', error);
            }
        }
        
        // Replace uploading indicator with success message
        const uploadingIndicator = document.getElementById('file-uploading-indicator');
        if (uploadingIndicator) {
            uploadingIndicator.remove();
        }
        
        // Update the context indicator in the copilot UI
        updateCopilotContextIndicator();
        
    } catch (error) {
        console.error('[uploadCopilotFileToExistingInterview] Error:', error);
        console.error('[uploadCopilotFileToExistingInterview] Error details:', {
            message: error.message,
            stack: error.stack,
            fileName: copilotUploadedFile?.name,
            interviewId: window.appState.currentEditingInterviewId
        });
        
        // Remove uploading indicator and show error
        const uploadingIndicator = document.getElementById('file-uploading-indicator');
        if (uploadingIndicator) {
            uploadingIndicator.innerHTML = '❌ Failed to upload ' + copilotUploadedFile.name;
            uploadingIndicator.classList.add('text-red-400');
            setTimeout(() => uploadingIndicator.remove(), 3000);
        }
        
        alert('Error uploading file to interview context. Please try again.');
        removeCopilotFile();
    }
}

// Update the context indicator in the copilot UI - now adds a simple chat message
function updateCopilotContextIndicator() {
    console.log('[updateCopilotContextIndicator] Called. State:', {
        copilotMode: window.appState.copilotMode,
        currentEditingInterviewId: window.appState.currentEditingInterviewId,
        currentInterviewFiles: window.appState.currentInterviewFiles,
        filesLength: window.appState.currentInterviewFiles ? window.appState.currentInterviewFiles.length : 0
    });
    
    // Only show in editor mode when we have files
    if (window.appState.copilotMode !== 'editor' || 
        !window.appState.currentEditingInterviewId || 
        !window.appState.currentInterviewFiles || 
        window.appState.currentInterviewFiles.length === 0) {
        console.log('[updateCopilotContextIndicator] Conditions not met, returning');
        return;
    }
    
    const copilotMessages = document.getElementById('copilotMessages');
    console.log('[updateCopilotContextIndicator] copilotMessages element exists:', !!copilotMessages);
    if (!copilotMessages) return;
    
    // Build the files list
    const fileNames = window.appState.currentInterviewFiles.map(f => f.name).join(', ');
    console.log('[updateCopilotContextIndicator] File names to display:', fileNames);
    
    // Add a simple system message about context files
    const contextMessage = document.createElement('div');
    contextMessage.className = 'text-xs text-gray-500 text-center my-2';
    contextMessage.innerHTML = `📎 Context files loaded: ${fileNames}`;
    
    // Add to chat (avoid duplicates by checking if similar message exists)
    const existingMessages = copilotMessages.querySelectorAll('.text-xs.text-gray-500');
    let alreadyExists = false;
    existingMessages.forEach(msg => {
        if (msg.textContent.includes('Context files loaded')) {
            msg.innerHTML = `📎 Context files loaded: ${fileNames}`;
            alreadyExists = true;
        }
    });
    
    if (!alreadyExists) {
        copilotMessages.appendChild(contextMessage);
        copilotMessages.scrollTop = copilotMessages.scrollHeight;
        console.log('[updateCopilotContextIndicator] Added new context message');
    } else {
        console.log('[updateCopilotContextIndicator] Updated existing context message');
    }
    
    console.log('[updateCopilotContextIndicator] Context indicator update complete');
}

// Export for global use
window.updateCopilotContextIndicator = updateCopilotContextIndicator;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeCopilotFileUpload();
});

// Cleanup function to remove system messages from Firestore
window.cleanupSystemMessages = async function() {
    if (!window.appState.currentEditingInterviewId) {
        console.log('[cleanupSystemMessages] No interview ID');
        return;
    }
    
    const db = window.firebase.firestore();
    try {
        const systemMessages = await db.collection('interviews')
            .doc(window.appState.currentEditingInterviewId)
            .collection('copilotChat')
            .where('sender', '==', 'system')
            .get();
        
        console.log(`[cleanupSystemMessages] Found ${systemMessages.size} system messages to clean up`);
        
        const deletePromises = [];
        systemMessages.forEach(doc => {
            deletePromises.push(doc.ref.delete());
        });
        
        if (deletePromises.length > 0) {
            await Promise.all(deletePromises);
            console.log(`[cleanupSystemMessages] Deleted ${deletePromises.length} system messages`);
        }
        
        // Reload chat history
        if (window.loadChatHistory) {
            window.loadChatHistory(window.appState.currentEditingInterviewId, window.appState.copilotMode);
        }
    } catch (error) {
        console.error('[cleanupSystemMessages] Error:', error);
    }
};

// Debug function to test file upload and context
window.debugFileUpload = async function() {
    console.log('=== FILE UPLOAD DEBUG ===');
    console.log('1. Current state:', {
        copilotUploadedFile: !!copilotUploadedFile,
        copilotFileContent: copilotFileContent ? copilotFileContent.substring(0, 100) + '...' : null,
        currentEditingInterviewId: window.appState.currentEditingInterviewId,
        currentInterviewFiles: window.appState.currentInterviewFiles,
        copilotMode: window.appState.copilotMode
    });
    
    if (window.appState.currentEditingInterviewId) {
        console.log('2. Checking Firestore for interview data...');
        const db = window.firebase.firestore();
        const doc = await db.collection('interviews').doc(window.appState.currentEditingInterviewId).get();
        if (doc.exists) {
            const data = doc.data();
            console.log('3. Interview data from Firestore:', {
                title: data.title,
                contextFiles: data.contextFiles,
                contextFilesCount: data.contextFiles ? data.contextFiles.length : 0
            });
            
            if (data.contextFiles && data.contextFiles.length > 0) {
                console.log('4. Context files:', data.contextFiles);
                
                // Try to fetch context from server
                console.log('5. Fetching context from server...');
                try {
                    let headers = {};
                    if (window.firebase.auth().currentUser) {
                        const idToken = await window.firebase.auth().currentUser.getIdToken();
                        headers['Authorization'] = `Bearer ${idToken}`;
                    }
                    
                    const response = await fetch(`/api/interviews/${window.appState.currentEditingInterviewId}/context`, { headers });
                    console.log('6. Context API response status:', response.status);
                    
                    if (response.ok) {
                        const contextData = await response.json();
                        console.log('7. Context data:', {
                            hasContext: !!contextData.context,
                            contextLength: contextData.context ? contextData.context.length : 0,
                            contextPreview: contextData.context ? contextData.context.substring(0, 200) + '...' : null
                        });
                    } else {
                        const errorText = await response.text();
                        console.error('7. Context API error:', errorText);
                    }
                } catch (error) {
                    console.error('7. Context fetch error:', error);
                }
            }
        }
    }
    
    console.log('=== END DEBUG ===');
};