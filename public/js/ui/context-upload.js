// Context Upload UI Module
// Handles file upload, text paste, and website scraping for interview context

import { state } from '../state.js';
import { elements } from '../dom.js';

// Module state
let currentUploadMethod = null; // 'file', 'paste', or 'scrape'

/**
 * Initialize the context upload UI
 */
export function initializeContextUpload() {
    // Create the enhanced UI structure
    const uploadSection = document.getElementById('uploadSection');
    if (!uploadSection) return;
    
    // Clear the uploadSection but preserve its classes
    const uploadSectionClasses = uploadSection.className;
    uploadSection.className = uploadSectionClasses;
    
    // Replace the existing content with new tabbed interface
    const isOptional = !state.interview.requiresDocument;
    
    // Use custom context statement if available, otherwise use default
    const contextGuidance = (state.interview.customData && state.interview.customData.contextStatement) 
        ? state.interview.customData.contextStatement
        : "Adding context like your resume, portfolio, or relevant documents helps the interviewer ask more specific and relevant questions tailored to your experience.";
    
    uploadSection.innerHTML = `
        <div class="w-full">
            <!-- Context Upload Header -->
            <div>
                <div class="text-center mb-6">
                    <h3 class="text-xl font-bold text-white mb-3">
                        Add Context to Your Interview
                        ${isOptional ? '<span class="text-base font-normal text-gray-400 ml-2">(optional)</span>' : ''}
                    </h3>
                    <p class="text-base text-gray-300 max-w-2xl mx-auto">
                        ${contextGuidance}
                    </p>
                </div>
            </div>
            
                ${isOptional ? '<p class="text-sm text-gray-400 mt-2">You can skip this step, but providing context leads to a more personalized interview.</p>' : ''}
            </div>
            
            <!-- Content -->
            <div id="contextUploadContent">
        
        <!-- Context Upload Tabs -->
        <div class="context-tabs mb-6">
            <div class="flex border-b border-gray-700">
                <button class="context-tab active" data-method="file">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                    Upload File
                </button>
                <button class="context-tab" data-method="paste">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                    Paste Text
                </button>
                <button class="context-tab" data-method="scrape">
                    <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9M3 12a9 9 0 019-9m0 18a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"></path>
                    </svg>
                    Scrape Website
                </button>
            </div>
        </div>
        
        <!-- File Upload Content -->
        <div class="context-content active" data-method="file">
            <div class="file-drop-area bg-gray-800 border-2 border-dashed border-gray-600 hover:border-gray-500 transition-colors rounded-lg p-8" id="dropArea">
                <svg class="w-12 h-12 md:w-14 md:h-14 text-gray-500 mb-3 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 0115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                <p class="mb-2 text-base text-gray-300">Drop your file here or click to browse</p>
                <p class="text-sm text-gray-500">PDF, DOC, TXT, or image files</p>
                <input type="file" id="fileInput" class="hidden" accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.png,.jpg,.jpeg,.gif,.webp,.svg">
            </div>
        </div>
        
        <!-- Paste Text Content -->
        <div class="context-content hidden" data-method="paste">
            <textarea id="pastedResumeText" 
                class="w-full p-4 border-2 border-gray-600 rounded-lg h-48 md:h-56 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 text-gray-100 placeholder-gray-500 transition duration-150 ease-in-out" 
                placeholder="Paste your document content here..."></textarea>
        </div>
        
        <!-- Website Scrape Content -->
        <div class="context-content hidden" data-method="scrape">
            <div class="space-y-4">
                <div>
                    <label for="websiteUrl" class="block text-sm font-medium text-gray-300 mb-2">Website URL</label>
                    <input type="url" 
                        id="websiteUrl" 
                        class="w-full p-4 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800 text-gray-100 placeholder-gray-500 transition duration-150 ease-in-out"
                        placeholder="https://example.com">
                </div>
                <button id="scrapeWebsiteBtn" 
                    class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-150 ease-in-out font-medium">
                    Scrape Website
                </button>
            </div>
        </div>
        
        <!-- Status Display Area -->
        <div id="contextStatusContainer" class="mt-4">
            <div id="uploadStatus" class="upload-status hidden">
                <div id="uploadStatusIcon" class="upload-status-icon"></div>
                <p id="uploadStatusText"></p>
            </div>
            <div id="uploadedFile" class="uploaded-file-card hidden">
                <div class="file-icon">
                    <svg class="w-8 h-8 md:w-10 md:h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                </div>
                <div class="file-info flex-1">
                    <p id="fileName" class="file-name text-gray-200 font-medium"></p>
                    <p id="fileSize" class="file-size text-gray-400 text-sm"></p>
                </div>
                <button id="removeFileBtn" class="text-red-500 hover:text-red-400 ml-3 p-2 remove-file-btn transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </div>
            </div>
        </div>
    `;
    
    // Add styles for the tabs
    addContextUploadStyles();
    
    // Initialize event handlers
    initializeTabHandlers();
    initializeUploadHandlers();
    initializePasteHandlers();
    initializeScrapeHandlers();
    
    
    // Set initial method
    currentUploadMethod = 'file';
}

/**
 * Add CSS styles for context upload tabs
 */
function addContextUploadStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .context-tabs {
            margin-top: 1rem;
            width: 100%;
        }
        
        .context-tab {
            flex: 1;
            padding: 1rem 1.25rem;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.9375rem;
            font-weight: 500;
            color: #9ca3af;
            background-color: transparent;
            border: none;
            border-bottom: 3px solid transparent;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .context-tab:hover {
            color: #e5e7eb;
            background-color: rgba(75, 85, 99, 0.3);
        }
        
        .context-tab.active {
            color: #60a5fa;
            border-bottom-color: #60a5fa;
            background-color: transparent;
        }
        
        .context-tab svg {
            opacity: 0.8;
        }
        
        .context-tab.active svg {
            opacity: 1;
        }
        
        .context-content {
            padding: 1rem 0;
        }
        
        .context-content.hidden {
            display: none;
        }
        
        .context-content.active {
            display: block;
        }
        
        .uploaded-file-card {
            background-color: rgba(31, 41, 55, 0.5);
            border: 1px solid rgba(75, 85, 99, 0.5);
            border-radius: 0.5rem;
            padding: 1rem;
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        
        .upload-status {
            background-color: rgba(31, 41, 55, 0.5);
            border: 1px solid rgba(75, 85, 99, 0.5);
            border-radius: 0.5rem;
            padding: 1rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            color: #d1d5db;
        }
        
        .upload-status.error {
            border-color: rgba(239, 68, 68, 0.5);
            color: #f87171;
        }
        
        .upload-status.success {
            border-color: rgba(34, 197, 94, 0.5);
            color: #86efac;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Initialize tab switching handlers
 */
function initializeTabHandlers() {
    const tabs = document.querySelectorAll('.context-tab');
    const contents = document.querySelectorAll('.context-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const method = tab.dataset.method;
            currentUploadMethod = method;
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update visible content
            contents.forEach(content => {
                if (content.dataset.method === method) {
                    content.classList.remove('hidden');
                    content.classList.add('active');
                } else {
                    content.classList.add('hidden');
                    content.classList.remove('active');
                }
            });
            
            // Clear any existing errors/status when switching tabs
            hideUploadStatus();
        });
    });
}

/**
 * Initialize file upload handlers
 */
function initializeUploadHandlers() {
    const dropArea = document.getElementById('dropArea');
    const fileInput = document.getElementById('fileInput');
    
    if (!dropArea || !fileInput) return;
    
    // Existing file upload logic from fileUpload.js
    dropArea.addEventListener('click', () => fileInput.click());
    
    // Drag and drop handlers
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('drag-over');
        });
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('drag-over');
        });
    });
    
    dropArea.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);
}

/**
 * Initialize paste handlers
 */
function initializePasteHandlers() {
    const pasteTextarea = document.getElementById('pastedResumeText');
    console.log('[Context Upload] initializePasteHandlers - textarea found:', !!pasteTextarea);
    if (!pasteTextarea) return;
    
    // Handle paste events
    pasteTextarea.addEventListener('paste', (e) => {
        console.log('[Context Upload] Paste event detected');
        // Let the default paste happen, then process
        setTimeout(() => {
            const text = pasteTextarea.value.trim();
            console.log('[Context Upload] Pasted text length:', text.length);
            if (text) {
                handleTextPaste(text);
            }
        }, 100);
    });
    
    // Handle manual input
    pasteTextarea.addEventListener('input', debounce(() => {
        const text = pasteTextarea.value.trim();
        if (text) {
            handleTextPaste(text);
        } else {
            hideUploadStatus();
            state.form.resumeText = '';
            state.form.fileUploaded = false;
            
            // Hide start button when text is cleared
            const step2Container = document.getElementById('step2Container');
            if (step2Container && !step2Container.classList.contains('hidden')) {
                const startButtonContainer = document.getElementById('startButtonContainer');
                if (startButtonContainer && state.interview.requiresDocument) {
                    startButtonContainer.classList.add('hidden');
                }
            }
            
            // Update form completion status
            if (window.checkFormCompletion) {
                window.checkFormCompletion();
            }
        }
    }, 500));
}

/**
 * Initialize website scraping handlers
 */
function initializeScrapeHandlers() {
    const scrapeBtn = document.getElementById('scrapeWebsiteBtn');
    const urlInput = document.getElementById('websiteUrl');
    
    if (!scrapeBtn || !urlInput) return;
    
    scrapeBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            showUploadError('Please enter a website URL');
            return;
        }
        
        // Validate URL
        try {
            new URL(url);
        } catch (e) {
            showUploadError('Please enter a valid URL (e.g., https://example.com)');
            return;
        }
        
        await scrapeWebsite(url);
    });
    
    // Handle Enter key in URL input
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            scrapeBtn.click();
        }
    });
}

/**
 * Handle file drop
 */
function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
}

/**
 * Handle file selection
 */
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFileUpload(files[0]);
    }
}

/**
 * Handle file upload
 */
async function handleFileUpload(file) {
    showUploadProgress('Uploading file...');
    
    try {
        // Use the universal upload endpoint for all files
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/universal/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to upload file');
        }
        
        const data = await response.json();
        
        // Store file metadata
        state.uploadedFile = data.file;
        
        if (data.extractedText) {
            // If text was extracted, use it
            state.form.resumeText = data.extractedText;
            const charCount = data.textLength || data.extractedText.length;
            showUploadSuccess(file.name, charCount);
        } else if (data.file.isImage) {
            // For images, store the placeholder text
            state.form.resumeText = `[Image: ${data.file.name}]`;
            showUploadSuccess(file.name, data.file.size);
        } else {
            showUploadSuccess(file.name, data.file.size);
        }
        
        state.form.fileUploaded = true;
        
        // Show start button when file is uploaded (on step 2)
        const step2Container = document.getElementById('step2Container');
        const startButtonContainer = document.getElementById('startButtonContainer');
        const startChatBtn = document.getElementById('startChatBtn');
        
        console.log('[Context Upload] Context added, checking button visibility:', {
            step2Visible: step2Container && !step2Container.classList.contains('hidden'),
            startButtonContainerExists: !!startButtonContainer,
            startChatBtnExists: !!startChatBtn,
            requiresDocument: state.interview.requiresDocument,
            fileUploaded: state.form.fileUploaded
        });
        
        if (step2Container && !step2Container.classList.contains('hidden')) {
            if (startButtonContainer) {
                startButtonContainer.classList.remove('hidden');
                console.log('[Context Upload] Start button container shown');
            }
            if (startChatBtn) {
                startChatBtn.disabled = false;
                console.log('[Context Upload] Start button enabled');
            }
        }
        
        // Also call checkFormCompletion if it exists
        if (window.checkFormCompletion) {
            console.log('[Context Upload] Calling checkFormCompletion');
            window.checkFormCompletion();
        }
        
    } catch (error) {
        console.error('Error uploading file:', error);
        showUploadError(error.message || 'Failed to upload file');
    }
}

/**
 * Handle text paste
 */
function handleTextPaste(text) {
    console.log('[Context Upload] handleTextPaste called with text length:', text.length);
    
    // Store in state
    state.form.resumeText = text;
    state.form.fileUploaded = true;
    state.uploadedFile = {
        name: 'Pasted Text',
        size: text.length,
        type: 'text/plain'
    };
    
    // Show success
    showUploadSuccess('Pasted Text', text.length);
    
    // Show start button when file is uploaded (on step 2)
    const step2Container = document.getElementById('step2Container');
    const startButtonContainer = document.getElementById('startButtonContainer');
    const startChatBtn = document.getElementById('startChatBtn');
    
    console.log('[Context Upload] Context added, checking button visibility:', {
        step2Visible: step2Container && !step2Container.classList.contains('hidden'),
        startButtonContainerExists: !!startButtonContainer,
        startChatBtnExists: !!startChatBtn,
        requiresDocument: state.interview.requiresDocument,
        fileUploaded: state.form.fileUploaded
    });
    
    if (step2Container && !step2Container.classList.contains('hidden')) {
        if (startButtonContainer) {
            startButtonContainer.classList.remove('hidden');
            console.log('[Context Upload] Start button container shown');
        }
        if (startChatBtn) {
            startChatBtn.disabled = false;
            console.log('[Context Upload] Start button enabled');
        }
    }
    
    // Also call checkFormCompletion if it exists
    if (window.checkFormCompletion) {
        console.log('[Context Upload] Calling checkFormCompletion');
        window.checkFormCompletion();
    }
}

/**
 * Scrape website content
 */
async function scrapeWebsite(url) {
    showUploadProgress('Scraping website...');
    
    try {
        // Get auth token if available
        let token = null;
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) {
            token = await firebase.auth().currentUser.getIdToken();
        }
        
        // Call the API
        const response = await fetch('/api/scrape-website', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ url, depth: 1 })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Failed to scrape website');
        }
        
        const result = await response.json();
        
        // Store scraped content
        state.form.resumeText = result.content;
        state.form.fileUploaded = true;
        
        // Show start button when file is uploaded (on step 2)
        const step2Container = document.getElementById('step2Container');
        const startButtonContainer = document.getElementById('startButtonContainer');
        const startChatBtn = document.getElementById('startChatBtn');
        
        console.log('[Context Upload] Context added, checking button visibility:', {
            step2Visible: step2Container && !step2Container.classList.contains('hidden'),
            startButtonContainerExists: !!startButtonContainer,
            startChatBtnExists: !!startChatBtn,
            requiresDocument: state.interview.requiresDocument,
            fileUploaded: state.form.fileUploaded
        });
        
        if (step2Container && !step2Container.classList.contains('hidden')) {
            if (startButtonContainer) {
                startButtonContainer.classList.remove('hidden');
                console.log('[Context Upload] Start button container shown');
            }
            if (startChatBtn) {
                startChatBtn.disabled = false;
                console.log('[Context Upload] Start button enabled');
            }
        }
        
        // Also call checkFormCompletion if it exists
        if (window.checkFormCompletion) {
            console.log('[Context Upload] Calling checkFormCompletion');
            window.checkFormCompletion();
        }
        state.uploadedFile = {
            name: new URL(url).hostname + '_scraped.txt',
            size: result.content.length,
            type: 'text/plain'
        };
        
        // Show success
        showUploadSuccess(new URL(url).hostname, result.content.length);
        
    } catch (error) {
        console.error('Error scraping website:', error);
        showUploadError(error.message || 'Failed to scrape website');
    }
}


/**
 * Show upload progress
 */
function showUploadProgress(message) {
    const statusContainer = document.getElementById('uploadStatus');
    const statusText = document.getElementById('uploadStatusText');
    const statusIcon = document.getElementById('uploadStatusIcon');
    const fileCard = document.getElementById('uploadedFile');
    
    if (statusContainer && statusText && statusIcon) {
        statusContainer.classList.remove('hidden');
        statusText.textContent = message;
        statusIcon.innerHTML = `<div class="spinner"></div>`;
        statusContainer.classList.remove('error', 'success');
    }
    
    if (fileCard) {
        fileCard.classList.add('hidden');
    }
}

/**
 * Show upload success
 */
function showUploadSuccess(fileName, fileSize) {
    const statusContainer = document.getElementById('uploadStatus');
    const fileCard = document.getElementById('uploadedFile');
    const fileNameEl = document.getElementById('fileName');
    const fileSizeEl = document.getElementById('fileSize');
    
    if (statusContainer) {
        statusContainer.classList.add('hidden');
    }
    
    if (fileCard && fileNameEl && fileSizeEl) {
        fileNameEl.textContent = fileName;
        fileSizeEl.textContent = formatFileSize(fileSize);
        fileCard.classList.remove('hidden');
    }
}

/**
 * Show upload error
 */
function showUploadError(message) {
    const statusContainer = document.getElementById('uploadStatus');
    const statusText = document.getElementById('uploadStatusText');
    const statusIcon = document.getElementById('uploadStatusIcon');
    
    if (statusContainer && statusText && statusIcon) {
        statusContainer.classList.remove('hidden');
        statusText.textContent = message;
        statusIcon.innerHTML = `<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>`;
        statusContainer.classList.add('error');
        statusContainer.classList.remove('success');
    }
}

/**
 * Hide upload status
 */
function hideUploadStatus() {
    const statusContainer = document.getElementById('uploadStatus');
    if (statusContainer) {
        statusContainer.classList.add('hidden');
    }
}

/**
 * Format file size
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Debounce helper
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Handle remove file button
document.addEventListener('click', (e) => {
    if (e.target.closest('#removeFileBtn')) {
        state.form.resumeText = '';
        state.form.fileUploaded = false;
        state.uploadedFile = null;
        
        const fileCard = document.getElementById('uploadedFile');
        if (fileCard) {
            fileCard.classList.add('hidden');
        }
        
        // Clear inputs
        const fileInput = document.getElementById('fileInput');
        const pasteTextarea = document.getElementById('pastedResumeText');
        const urlInput = document.getElementById('websiteUrl');
        
        if (fileInput) fileInput.value = '';
        if (pasteTextarea) pasteTextarea.value = '';
        if (urlInput) urlInput.value = '';
        
        // Hide start button if context is required and on step 2
        if (state.interview.requiresDocument) {
            const step2Container = document.getElementById('step2Container');
            if (step2Container && !step2Container.classList.contains('hidden')) {
                const startButtonContainer = document.getElementById('startButtonContainer');
                if (startButtonContainer) {
                    startButtonContainer.classList.add('hidden');
                }
            }
        }
        
        // Also update form completion status
        if (window.checkFormCompletion) {
            window.checkFormCompletion();
        }
    }
});