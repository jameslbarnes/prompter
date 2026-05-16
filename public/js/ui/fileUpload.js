// File upload module - handles file upload, drag & drop, and resume text functionality
import { state } from '../state.js';
import { elements } from '../dom.js';

// Use window functions since utils.js is not a module anymore
const showError = window.showError;
const clearError = window.clearError;

// Initialize file upload functionality
export function initializeFileUpload() {
    if (!elements.dropArea || !elements.fileInput) return;
    
    // File upload event listeners
    elements.dropArea.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileSelect);
    
    elements.dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropArea.classList.add('border-accent-primary');
    });
    
    elements.dropArea.addEventListener('dragleave', () => {
        elements.dropArea.classList.remove('border-accent-primary');
    });
    
    elements.dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropArea.classList.remove('border-accent-primary');
        if (e.dataTransfer.files.length) {
            handleFiles(e.dataTransfer.files);
        }
    });
    
    if (elements.removeFileBtn) {
        elements.removeFileBtn.addEventListener('click', resetFileUpload);
    }
    
    // Tab switching listeners
    if (elements.showPasteLink) {
        elements.showPasteLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('paste');
        });
    }
    
    if (elements.showUploadLink) {
        elements.showUploadLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('upload');
        });
    }
}

// Handle file selection
function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

// Handle file processing
function handleFiles(files) {
    if (files.length === 0) return;
    const file = files[0];
    
    // Support a wide range of file types
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.md', '.csv', '.json', '.xml', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
    const fileName = file.name.toLowerCase();
    const hasAllowedExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasAllowedExtension) {
        showUploadError(`Unsupported file type. Supported formats: ${allowedExtensions.join(', ')}`);
        state.form.fileUploaded = false;
        checkFormCompletion();
        return;
    }
    
    showUploadProgress('Reading file...');
    hideUploadedFile();
    
    const formData = new FormData();
    formData.append('file', file);
    
    fetch('/api/universal/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || 'Failed to process file');
            });
        }
        return response.json();
    })
    .then(data => {
        // Store file metadata
        state.uploadedFile = data.file;
        
        if (data.extractedText) {
            // If text was extracted, use it
            state.form.resumeText = data.extractedText;
            if (elements.resumeTextArea) elements.resumeTextArea.value = state.form.resumeText;
            const charCount = data.textLength || data.extractedText.length;
            showUploadSuccess(`File uploaded (${charCount} chars extracted)`);
        } else if (data.file.isImage) {
            // For images, store the URL
            state.form.resumeText = `[Image: ${data.file.name}]`;
            showUploadSuccess(`Image uploaded successfully`);
        } else {
            showUploadSuccess(`File uploaded (${data.file.size} bytes)`);
        }
        
        showFileDetails(file);
        state.form.fileUploaded = true;
        checkFormCompletion();
    })
    .catch(error => {
        console.error('Error uploading file:', error);
        showUploadError(error.message || 'Error processing file');
        hideUploadedFile();
        state.form.fileUploaded = false;
        checkFormCompletion();
    });
}

// Show upload progress
function showUploadProgress(message) {
    hidePasteStatus();
    if (elements.uploadStatus) elements.uploadStatus.classList.remove('hidden');
    if (elements.uploadStatusIcon) {
        elements.uploadStatusIcon.innerHTML = `<svg class="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    }
    if (elements.uploadStatusText) {
        elements.uploadStatusText.textContent = message;
        elements.uploadStatusText.className = 'text-sm text-blue-400';
    }
}

// Show upload success
function showUploadSuccess(message) {
    if (elements.uploadStatus) elements.uploadStatus.classList.remove('hidden');
    if (elements.uploadStatusIcon) {
        elements.uploadStatusIcon.innerHTML = `<svg class="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
    }
    if (elements.uploadStatusText) {
        elements.uploadStatusText.textContent = message;
        elements.uploadStatusText.className = 'text-sm text-green-400';
    }
    // Don't transform the UI - just show the file details normally
    // transformToSuccessState();
}

// Show upload error
function showUploadError(message) {
    if (elements.uploadStatus) elements.uploadStatus.classList.remove('hidden');
    if (elements.uploadStatusIcon) {
        elements.uploadStatusIcon.innerHTML = `<svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
    }
    if (elements.uploadStatusText) {
        elements.uploadStatusText.textContent = message;
        elements.uploadStatusText.className = 'text-sm text-red-400';
    }
}

// Transform UI to success state - DEPRECATED: Now we just show normal file status
// function transformToSuccessState() {
//     if (elements.dropArea) elements.dropArea.classList.add('hidden');
//     if (elements.showPasteLink) elements.showPasteLink.classList.add('hidden');
//     
//     const successContainer = document.createElement('div');
//     successContainer.id = 'successContainer';
//     successContainer.className = 'bg-green-50 dark:bg-green-900/20 rounded-lg p-6 my-4 text-center border border-green-200 dark:border-green-800';
//     
//     successContainer.innerHTML = `
//         <div class="mb-3">
//             <svg class="h-12 w-12 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
//                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
//             </svg>
//         </div>
//         <h3 class="text-lg font-semibold text-green-700 dark:text-green-300 mb-2">Context File Added</h3>
//         <p class="text-sm text-green-600 dark:text-green-400 mb-4">Your file has been processed and will provide context during the interview.</p>
//     `;
//     
//     if (elements.startChatBtn && elements.startChatBtn.parentNode) {
//         const originalBtn = elements.startChatBtn;
//         elements.startChatBtn.parentNode.removeChild(elements.startChatBtn);
//         
//         const btnContainer = document.createElement('div');
//         btnContainer.className = 'mt-4';
//         
//         originalBtn.className = 'primary-button bg-green-500 hover:bg-green-600 text-lg py-3 px-6 pulse-animation';
//         originalBtn.textContent = 'Continue to Interview →';
//         btnContainer.appendChild(originalBtn);
//         successContainer.appendChild(btnContainer);
//         
//         const isPasteMode = elements.pasteSection && !elements.pasteSection.classList.contains('hidden');
//         
//         if (isPasteMode && elements.pasteSection) {
//             elements.pasteSection.innerHTML = '';
//             elements.pasteSection.appendChild(successContainer);
//         } else if (elements.uploadSection) {
//             elements.uploadSection.innerHTML = '';
//             elements.uploadSection.appendChild(successContainer);
//         }
//     }
// }

// Show file details
function showFileDetails(file) {
    if (elements.uploadedFile) elements.uploadedFile.classList.remove('hidden');
    if (elements.fileName) elements.fileName.textContent = file.name;
    
    let size = file.size;
    let unit = 'bytes';
    if (size > 1024) { size /= 1024; unit = 'KB'; }
    if (size > 1024) { size /= 1024; unit = 'MB'; }
    if (elements.fileSize) elements.fileSize.textContent = `Size: ${size.toFixed(2)} ${unit}`;
}

// Hide elements
function hideUploadedFile() {
    if (elements.uploadedFile) elements.uploadedFile.classList.add('hidden');
}

function hideUploadStatus() {
    if (elements.uploadStatus) elements.uploadStatus.classList.add('hidden');
}

function hidePasteStatus() {
    if (elements.pasteStatus) elements.pasteStatus.classList.add('hidden');
}

// Reset file upload
function resetFileUpload() {
    if (elements.fileInput) elements.fileInput.value = '';
    hideUploadedFile();
    hideUploadStatus();
    
    if (elements.pastedResumeText) elements.pastedResumeText.value = '';
    hidePasteStatus();
    
    state.form.fileUploaded = false;
    state.form.resumeText = '';
    if (elements.resumeTextArea) elements.resumeTextArea.value = '';
    
    // Remove success container if it exists
    const successContainer = document.getElementById('successContainer');
    if (successContainer) {
        successContainer.remove();
    }
    
    // Restore original interface
    if (elements.uploadSection && elements.uploadSection.children.length === 0) {
        restoreOriginalUploadInterface();
    }
    
    if (elements.uploadSection) elements.uploadSection.classList.remove('hidden');
    if (elements.pasteSection) elements.pasteSection.classList.add('hidden');
    if (elements.dropArea) elements.dropArea.classList.remove('hidden');
    if (elements.showPasteLink) elements.showPasteLink.classList.remove('hidden');
    
    checkFormCompletion();
}

// Restore original upload interface
function restoreOriginalUploadInterface() {
    if (!elements.uploadSection) return;
    
    elements.uploadSection.innerHTML = `
        <div class="file-drop-area" id="dropArea">
            <svg class="w-10 h-10 md:w-12 md:h-12 text-gray-400 mb-2 md:mb-3 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
            <p class="mb-2 text-sm">Upload your resume to get started.</p>
            <p class="text-xs text-gray-500">Supported formats: PDF, DOC, DOCX</p>
            <input type="file" id="fileInput" class="hidden" accept=".pdf,.doc,.docx">
        </div>
        
        <div id="uploadStatusContainer" class="mt-4">
            <div id="uploadStatus" class="upload-status hidden">
                <div id="uploadStatusIcon" class="upload-status-icon"></div>
                <p id="uploadStatusText"></p>
            </div>
            <div id="uploadedFile" class="uploaded-file-card hidden">
                <div class="file-icon">
                    <svg class="w-6 h-6 md:w-8 md:h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                </div>
                <div class="file-info">
                    <p id="fileName" class="file-name"></p>
                    <p id="fileSize" class="file-size"></p>
                </div>
                <button id="removeFileBtn" class="text-red-400 hover:text-red-300 ml-2 p-1 remove-file-btn">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </div>

        <div class="text-center mt-4">
            <a href="#" id="showPasteLink" class="text-sm text-accent-primary hover:underline">Or paste resume text instead</a>
        </div>
    `;
    
    // Reinitialize event listeners
    initializeFileUpload();
}

// Switch between upload and paste tabs
export function switchTab(tab) {
    if (tab === 'upload') {
        if (elements.uploadSection) elements.uploadSection.classList.remove('hidden');
        if (elements.pasteSection) elements.pasteSection.classList.add('hidden');
        if (elements.pastedResumeText) elements.pastedResumeText.value = '';
        hidePasteStatus();
    } else if (tab === 'paste') {
        if (elements.uploadSection) elements.uploadSection.classList.add('hidden');
        if (elements.pasteSection) elements.pasteSection.classList.remove('hidden');
        if (elements.fileInput) elements.fileInput.value = '';
        hideUploadedFile();
        hideUploadStatus();
        if (elements.pastedResumeText) elements.pastedResumeText.focus();
    }
    
    state.form.fileUploaded = false;
    state.form.resumeText = '';
    if (elements.resumeTextArea) elements.resumeTextArea.value = '';
    checkFormCompletion();
}

// Validate pasted resume
export function validatePastedResume() {
    if (!elements.pastedResumeText) return;
    
    const text = elements.pastedResumeText.value.trim();
    hideUploadStatus();
    
    if (text.length > 0) {
        if (elements.pasteStatus) elements.pasteStatus.classList.remove('hidden');
        if (elements.pasteStatusIcon) {
            elements.pasteStatusIcon.innerHTML = `<svg class="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
        }
        if (elements.pasteStatusText) {
            elements.pasteStatusText.textContent = `Text accepted (${text.length} characters)`;
            elements.pasteStatusText.className = 'text-sm text-green-400';
        }
        
        state.form.resumeText = text;
        if (elements.resumeTextArea) elements.resumeTextArea.value = text;
        state.form.fileUploaded = true;
        
        // Don't transform UI for pasted text either
        // if (state.interview.requiresDocument) {
        //     transformToSuccessState();
        // }
    } else {
        hidePasteStatus();
        state.form.fileUploaded = false;
    }
    
    checkFormCompletion();
}

// Import checkFormCompletion from main module (will be available globally)
function checkFormCompletion() {
    if (window.checkFormCompletion) {
        window.checkFormCompletion();
    }
} 