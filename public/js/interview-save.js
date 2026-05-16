// Interview Save Functionality

// Handle save interview action
async function handleSaveInterviewAction(buttonElement) {
    console.log('[handleSaveInterviewAction] Started saving interview...');
    console.log('[handleSaveInterviewAction] Button element:', buttonElement);
    console.log('[handleSaveInterviewAction] appState.interviewSpec:', appState.interviewSpec);
    
    buttonElement.disabled = true;
    const originalButtonText = buttonElement.textContent;
    buttonElement.textContent = 'Saving...';
    buttonElement.classList.add('cursor-wait');
    
    const saveCopilotInterview = document.getElementById('saveCopilotInterview');
    const saveCopilotInterviewFromFilesTab = document.getElementById('saveCopilotInterviewFromFilesTab');
    const otherButtons = [saveCopilotInterview, saveCopilotInterviewFromFilesTab].filter(btn => btn !== buttonElement);
    
    otherButtons.forEach(btn => {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Saving...';
            btn.classList.add('cursor-wait');
        }
    });

    // Get values from appState.interviewSpec
    const spec = appState.interviewSpec;
    const title = spec.title;
    const description = spec.description;
    const category = spec.category;
    const purpose = spec.purpose;
    const requiredInformation = spec.requiredInformation || [];
    const initialPrompt = spec.initialPrompt;
    const followupPrompt = spec.followupPrompt;
    const reportPrompt = spec.reportPrompt;
    const indexHeader = spec.pageHeaders.intro;
    const indexSubheader = spec.pageHeaders.interview;
    const reportHeader = spec.pageHeaders.report;
    const reportSubheader = spec.pageHeaders.reportSub;
    const hasExternalDocuments = spec.hasExternalDocuments;
    const adminReportPrompt = spec.adminReportPrompt;
    const userNote = spec.userNote;

    const exampleFollowupQuestion = spec.exampleFollowupQuestion;
    const exampleReportContent = spec.exampleReportContent;
    const exampleAdminReport = spec.exampleAdminReport;

    const enableWebSearch = spec.enableWebSearch;
    const enableThinking = spec.enableThinking !== undefined ? spec.enableThinking : true;
    const enableMemoryService = spec.enableMemoryService !== undefined ? spec.enableMemoryService : false;
    const followupModel = spec.followupModel || 'claude-opus-4-5';
    const allowPublicGallery = spec.allowPublicGallery !== undefined ? spec.allowPublicGallery : false;
    const interviewTheme = spec.interviewTheme || 'dark';
    const completionRedirectUrl = spec.completionRedirectUrl || '';

    const enableVideoRecording = spec.enableVideoRecording !== undefined ? spec.enableVideoRecording : false;

    
    const interviewId = appState.currentEditingInterviewId || window.generateUUID();

    // File Handling
    let savedFilesMetaData = [];
    const contextFileInput = document.getElementById('contextFileInput');
    // Check for pasted files first, then fall back to file input
    const filesToUpload = window._contextPastedFiles || contextFileInput?.files || [];
    const uploadPromises = [];
    
    // Check for copilot uploaded files
    const copilotFiles = appState.copilotContextFiles || [];
    console.log('[handleSaveInterviewAction] Checking copilot files:', {
        copilotFilesCount: copilotFiles.length,
        isNewInterview: !appState.currentEditingInterviewId,
        copilotFiles: copilotFiles.map(f => ({ name: f.name, contentLength: f.content?.length || 0 }))
    });
    
    if (copilotFiles.length > 0) {
        console.log('[handleSaveInterviewAction] Processing copilot files for', appState.currentEditingInterviewId ? 'existing' : 'new', 'interview');
        // Process copilot files for both new and existing interviews
        // They're already in memory, we just need to upload them
        for (const copilotFile of copilotFiles) {
            console.log('[handleSaveInterviewAction] Creating file from copilot data:', {
                fileName: copilotFile.name,
                contentLength: copilotFile.content?.length || 0
            });
            // Create a blob from the content
            const blob = new Blob([copilotFile.content], { type: 'text/plain' });
            const file = new File([blob], copilotFile.name, { type: 'text/plain' });
            uploadPromises.push(window.uploadFile(interviewId, file));
        }
        // Clear copilot files after processing
        console.log('[handleSaveInterviewAction] Clearing copilot files after processing');
        appState.copilotContextFiles = [];
        if (window.clearCopilotFile) window.clearCopilotFile();
    }

    if (filesToUpload.length > 0) {
        buttonElement.textContent = `Uploading ${filesToUpload.length} file(s)...`;
        for (let i = 0; i < filesToUpload.length; i++) {
            uploadPromises.push(window.uploadFile(interviewId, filesToUpload[i]));
        }
    }
    
    try {
        // Wait for all uploads to complete
        console.log('[handleSaveInterviewAction] Waiting for', uploadPromises.length, 'file uploads');
        const newFileMetaData = await Promise.all(uploadPromises);
        console.log('[handleSaveInterviewAction] All uploads complete:', newFileMetaData);
        buttonElement.textContent = 'Saving...';

        // Determine files to keep and files to delete
        const uploadedFilesList = document.getElementById('uploadedFilesList');
        const filesToKeep = [];
        const filePathsToDelete = [];
        const displayedFileElements = uploadedFilesList?.querySelectorAll('div:not(.marked-for-removal)') || [];
        const removedFileElements = uploadedFilesList?.querySelectorAll('div.marked-for-removal') || [];

        // Keep files that were previously saved and are NOT marked for removal
        displayedFileElements.forEach(el => {
            const path = el.querySelector('.remove-file-btn')?.getAttribute('data-path');
            const existingFile = appState.currentInterviewFiles.find(f => f.path === path);
            if (existingFile) {
                filesToKeep.push(existingFile);
            }
        });

        // Identify file paths marked for removal
        removedFileElements.forEach(el => {
            const path = el.querySelector('.remove-file-btn')?.getAttribute('data-path');
            if (path) {
                filePathsToDelete.push(path);
            }
        });

        // Combine kept old files with newly uploaded files
        savedFilesMetaData = [...filesToKeep, ...newFileMetaData];
        console.log('[handleSaveInterviewAction] Final file list for interview:', {
            keptFiles: filesToKeep.length,
            newFiles: newFileMetaData.length,
            totalFiles: savedFilesMetaData.length,
            files: savedFilesMetaData.map(f => ({ name: f.name, path: f.path }))
        });

        // Delete files marked for removal from Storage
        if (filePathsToDelete.length > 0) {
            console.log('[handleSaveInterviewAction] Removing files marked for deletion:', filePathsToDelete);
            const deletePromises = filePathsToDelete.map(path => window.deleteFileFromStorage(path));
            await Promise.all(deletePromises);
        }
        
        // Proceed to save interview data to Firestore
        await window.saveInterviewToFirestore({
            id: interviewId,
            title: title,
            description: description,
            category: category,
            purpose: purpose,
            requiredInformation: requiredInformation,
            initialPrompt: initialPrompt,
            followupPrompt: followupPrompt,
            reportPrompt: reportPrompt,
            indexHeader: indexHeader,
            indexSubheader: indexSubheader,
            reportHeader: reportHeader,
            reportSubheader: reportSubheader,
            hasExternalDocuments: hasExternalDocuments,
            enableWebSearch: enableWebSearch,
            enableThinking: enableThinking,
            enableMemoryService: enableMemoryService,
            followupModel: followupModel,
            allowPublicGallery: allowPublicGallery,
            interviewTheme: interviewTheme,
            completionRedirectUrl: completionRedirectUrl,

            enableVideoRecording: enableVideoRecording,

            contextFiles: savedFilesMetaData,
            adminReportPrompt: adminReportPrompt,
            userNote: userNote,

            exampleFollowupQuestion: exampleFollowupQuestion,
            exampleReportContent: exampleReportContent,
            exampleAdminReport: exampleAdminReport,

        }, buttonElement);

        // Update the UI after successful save
        appState.setCurrentInterviewFiles(savedFilesMetaData);
        if (contextFileInput) contextFileInput.value = '';
        // Clear pasted files after successful upload
        window._contextPastedFiles = null;
        if (window.displaySavedFiles) window.displaySavedFiles(appState.currentInterviewFiles);
        if (window.updateCopilotContextIndicator) window.updateCopilotContextIndicator();

    } catch (error) {
        alert(`Error during file upload or processing: ${error.message}`);
        // Re-enable buttons on error
        buttonElement.disabled = false;
        buttonElement.textContent = originalButtonText;
        buttonElement.classList.remove('cursor-wait');
        otherButtons.forEach(btn => {
            if (btn) {
                btn.disabled = false;
                btn.textContent = originalButtonText;
                btn.classList.remove('cursor-wait');
            }
        });
    }
}

// Save interview to Firestore
window.saveInterviewToFirestore = function(interviewData, buttonElement) {
    // Validate required fields
    if (buttonElement && (!interviewData.title ||
        !interviewData.initialPrompt ||
        !interviewData.followupPrompt)) {
        alert('Missing required fields from appState. Please ensure Title, Initial Prompt, and Follow-up Prompt are generated.');
        
        if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.textContent = buttonElement.hasAttribute('data-editing-id') ? 'Update Interview' : 'Save Interview';
            buttonElement.classList.remove('cursor-wait');

            const saveCopilotInterview = document.getElementById('saveCopilotInterview');
            const saveCopilotInterviewFromFilesTab = document.getElementById('saveCopilotInterviewFromFilesTab');
            const otherButtons = [saveCopilotInterview, saveCopilotInterviewFromFilesTab].filter(btn => btn !== buttonElement);
            otherButtons.forEach(btn => {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = btn.hasAttribute('data-editing-id') ? 'Update Interview' : 'Save Interview';
                    btn.classList.remove('cursor-wait');
                }
            });
        }
        return false;
    }

    const isUpdating = appState.currentEditingInterviewId && appState.currentEditingInterviewId === interviewData.id;
    const interviewDocRef = db.collection('interviews').doc(interviewData.id);

    let dataToSave = { ...interviewData };
    delete dataToSave.id; // Don't save id as a field in the document

    // Add/update timestamps and creator
    if (isUpdating) {
        dataToSave.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        if (!dataToSave.createdBy && auth.currentUser) {
            dataToSave.createdBy = auth.currentUser.uid;
        }
    } else {
        dataToSave.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        dataToSave.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
        if (auth.currentUser) {
            dataToSave.createdBy = auth.currentUser.uid;
        }
    }

    return interviewDocRef.set(dataToSave, { merge: true })
        .then(() => {
            const action = isUpdating ? 'updated' : 'created';
            console.log(`Interview "${interviewData.title}" ${action} successfully!`);

            // Set the current ID for new interviews after successful save
            const newlyCreatedId = !isUpdating ? interviewDocRef.id : null;
            if (newlyCreatedId) {
                appState.setCurrentEditingInterviewId(newlyCreatedId);
                
                const messagesToSaveNow = [...appState.initialChatMessages];
                appState.clearInitialChatMessages();

                // Save initial chat history
                if (messagesToSaveNow.length > 0) {
                    const chatSavePromises = messagesToSaveNow.map(msg =>
                        db.collection('interviews').doc(appState.currentEditingInterviewId).collection('copilotChat').add({
                            sender: msg.sender,
                            content: msg.content,
                            timestamp: firebase.firestore.FieldValue.serverTimestamp()
                        })
                    );
                    Promise.all(chatSavePromises)
                        .then(() => console.log('Initial chat history saved for new interview.'))
                        .catch(err => console.error('Error saving initial chat history:', err));
                }
                if (window.updateUrlForInterview) window.updateUrlForInterview(newlyCreatedId);
            } else {
                appState.clearInitialChatMessages();
                if (interviewData.id && window.updateUrlForInterview) window.updateUrlForInterview(interviewData.id);
            }

            // Update button UI if buttonElement exists
            if (buttonElement) {
                const finalId = newlyCreatedId || interviewData.id;
                const saveCopilotInterview = document.getElementById('saveCopilotInterview');
                const saveCopilotInterviewFromFilesTab = document.getElementById('saveCopilotInterviewFromFilesTab');

                buttonElement.disabled = false;
                buttonElement.textContent = 'Update Interview';
                buttonElement.classList.remove('cursor-wait');
                buttonElement.setAttribute('data-editing-id', finalId);

                const otherButtons = [saveCopilotInterview, saveCopilotInterviewFromFilesTab].filter(btn => btn !== buttonElement);
                otherButtons.forEach(btn => {
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = 'Update Interview';
                        btn.setAttribute('data-editing-id', finalId);
                        btn.classList.remove('cursor-wait');
                    }
                });
            }
            
            // Show the "Begin Interview" button and update its URL
            const openInterviewPreviewBtn = document.getElementById('openInterviewPreviewBtn');
            if (openInterviewPreviewBtn) {
                const finalId = newlyCreatedId || interviewData.id;
                let interviewUrlForPreview = `${window.location.origin}/i/?interview=${finalId}`;
                
                // Add admin parameters for preview
                if (auth.currentUser) {
                    if (auth.currentUser.email) {
                        interviewUrlForPreview += `&adminEmail=${encodeURIComponent(auth.currentUser.email)}`;
                    }
                    const adminName = auth.currentUser.displayName || auth.currentUser.email?.split('@')[0];
                    if (adminName) {
                        interviewUrlForPreview += `&adminName=${encodeURIComponent(adminName)}`;
                    }
                }
                
                openInterviewPreviewBtn.setAttribute('data-url', interviewUrlForPreview);
                openInterviewPreviewBtn.classList.remove('hidden');
            }
            
            // Also show the share URL button
            const shareUrlBtn = document.getElementById('shareUrlBtn');
            if (shareUrlBtn) {
                const finalId = newlyCreatedId || interviewData.id;
                const interviewUrlForShare = `${window.location.origin}/i/?interview=${finalId}`;
                shareUrlBtn.setAttribute('data-share-url', interviewUrlForShare);
                shareUrlBtn.classList.remove('hidden');
            }

            if (window.refreshInterviewsList) {
                window.refreshInterviewsList();
            } else if (window.loadInterviewsGlobal) {
                window.loadInterviewsGlobal();
            }
            return true;
        })
        .catch((error) => {
            alert(`Error saving interview data: ${error.message}`);
            
            if (buttonElement) {
                const saveCopilotInterview = document.getElementById('saveCopilotInterview');
                const saveCopilotInterviewFromFilesTab = document.getElementById('saveCopilotInterviewFromFilesTab');
                
                buttonElement.disabled = false;
                buttonElement.textContent = isUpdating ? 'Update Interview' : 'Save Interview';
                buttonElement.classList.remove('cursor-wait');

                const otherButtons = [saveCopilotInterview, saveCopilotInterviewFromFilesTab].filter(btn => btn !== buttonElement);
                otherButtons.forEach(btn => {
                    if (btn) {
                        btn.disabled = false;
                        btn.textContent = btn.hasAttribute('data-editing-id') ? 'Update Interview' : 'Save Interview';
                        btn.classList.remove('cursor-wait');
                    }
                });
            }
            throw error;
        });
}

// Initialize save buttons
function initializeSaveButtons() {
    const saveCopilotInterview = document.getElementById('saveCopilotInterview');
    const saveCopilotInterviewFromFilesTab = document.getElementById('saveCopilotInterviewFromFilesTab');
    
    console.log('[initializeSaveButtons] Initializing save buttons...');
    console.log('[initializeSaveButtons] Button 1 found:', !!saveCopilotInterview);
    console.log('[initializeSaveButtons] Button 2 found:', !!saveCopilotInterviewFromFilesTab);
    
    saveCopilotInterview?.addEventListener('click', function() {
        console.log('[Save Button 1] Clicked! Disabled:', this.disabled);
        if (!this.disabled) {
            handleSaveInterviewAction(this);
        }
    });
    
    saveCopilotInterviewFromFilesTab?.addEventListener('click', function() {
        console.log('[Save Button 2] Clicked! Disabled:', this.disabled);
        if (!this.disabled) {
            handleSaveInterviewAction(this);
        }
    });
}

// Expose functions globally for debugging and cross-script access
window.handleSaveInterviewAction = handleSaveInterviewAction;
window.initializeSaveButtons = initializeSaveButtons;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeSaveButtons();
}); 