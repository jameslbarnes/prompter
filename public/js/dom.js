// DOM elements module - contains all DOM element references
export const elements = {
    // Main sections
    resumeSection: document.getElementById('resumeSection'),
    resumeTextArea: document.getElementById('resumeText'),
    fileUploadArea: document.getElementById('fileUploadArea'),
    interviewInterface: document.getElementById('interviewInterface'),
    currentQuestionArea: document.getElementById('currentQuestionArea'),
    currentQuestionDisplay: document.getElementById('currentQuestionDisplay'),
    currentQuestionAreaVideo: document.getElementById('currentQuestionAreaVideo'),
    currentQuestionDisplayVideo: document.getElementById('currentQuestionDisplayVideo'),
    interviewInfoMessage: document.getElementById('interviewInfoMessage'),
    introText: document.getElementById('introText'),
    
    // Recording controls
    recordBtn: document.getElementById('recordBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    recordBtnText: document.getElementById('recordBtnText'),
    recordingStatus: document.getElementById('recordingStatus'),
    generateReportBtn: document.getElementById('generateReportBtn'),
    
    // Form elements
    startChatBtn: document.getElementById('startChatBtn'),
    startButtonContainer: document.getElementById('startButtonContainer'),
    userNameInput: document.getElementById('userName'),
    userEmailInput: document.getElementById('userEmail'),
    nameError: document.getElementById('nameError'),
    emailError: document.getElementById('emailError'),
    enableVideoRecording: document.getElementById('enableVideoRecording'),
    
    // File upload elements
    dropArea: document.getElementById('dropArea'),
    fileInput: document.getElementById('fileInput'),
    uploadStatusContainer: document.getElementById('uploadStatusContainer'),
    uploadStatus: document.getElementById('uploadStatus'),
    uploadStatusIcon: document.getElementById('uploadStatusIcon'),
    uploadStatusText: document.getElementById('uploadStatusText'),
    uploadedFile: document.getElementById('uploadedFile'),
    fileName: document.getElementById('fileName'),
    fileSize: document.getElementById('fileSize'),
    removeFileBtn: document.getElementById('removeFileBtn'),
    
    // Tab/section elements
    uploadSection: document.getElementById('uploadSection'),
    pasteSection: document.getElementById('pasteSection'),
    pastedResumeText: document.getElementById('pastedResumeText'),
    pasteStatus: document.getElementById('pasteStatus'),
    pasteStatusIcon: document.getElementById('pasteStatusIcon'),
    pasteStatusText: document.getElementById('pasteStatusText'),
    showPasteLink: document.getElementById('showPasteLink'),
    showUploadLink: document.getElementById('showUploadLink'),
    
    // Progress tracking elements
    currentRecordingTimeElem: document.getElementById('currentRecordingTime'),
    targetRecordingTimeElem: document.getElementById('targetRecordingTime'),
    questionCounterElem: document.getElementById('questionCounter'),
    interviewContextElem: document.getElementById('interviewContext'),
    
    // Thinking trace elements
    thinkingTraceDisplay: document.getElementById('thinkingTraceDisplay'),
    thinkingCanvas: document.getElementById('thinkingCanvas'),
    viewThinkingToggle: document.getElementById('viewThinkingToggle'),
    modalThinkingTrace: document.getElementById('modalThinkingTrace'),
    modalThinkingContent: document.getElementById('modalThinkingContent'),
    modalThinkingCanvas: document.getElementById('modalThinkingCanvas'),
    
    // Other UI elements
    errorMessage: document.getElementById('errorMessage'),
    simulateWordCountBtn: document.getElementById('simulateWordCountBtn'),
    headerTitle: document.getElementById('headerTitle'),
    interviewTitleElement: document.getElementById('interviewTitle'),
    introTextHeadingElem: document.getElementById('introTextHeading'),
    introTextSubheadingElem: document.getElementById('introTextSubheading'),
    
    // Theme toggle
    themeToggle: document.getElementById('themeToggle'),
    sunIcon: document.querySelector('.sun-icon'),
    moonIcon: document.querySelector('.moon-icon')
};

// Helper function to safely get element
export function getElement(id) {
    return document.getElementById(id);
}

// Helper function to safely query selector
export function querySelector(selector) {
    return document.querySelector(selector);
}

// Helper function to safely query all
export function querySelectorAll(selector) {
    return document.querySelectorAll(selector);
} 