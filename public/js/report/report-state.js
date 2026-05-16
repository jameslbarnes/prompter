// Report State Management
class ReportState {
    constructor() {
        this.reportLoadedViaApi = false;
        this.reportAlreadyLoaded = false;
        this.currentReportId = null;
        this.currentInterviewId = null;
        this.reportSocket = null;
        this.reportBuffer = '';
        this.reportMarkdown = '';
        this.currentThinkingMessage = null;
        this.fullscreenThinkingOverlay = null;
        this.reportStreamingBackgroundElement = null;
        this.isRegenerating = false;
        this.onReportLoaded = null; // Callback for when report is loaded
        
        // Clear any persisted regeneration state on page load
        sessionStorage.removeItem('isRegenerating');
    }
    
    setReportLoaded(loadedViaApi = false, alreadyLoaded = false) {
        this.reportLoadedViaApi = loadedViaApi;
        this.reportAlreadyLoaded = alreadyLoaded;
        console.log(`[ReportState] Set reportLoadedViaApi=${this.reportLoadedViaApi}, reportAlreadyLoaded=${this.reportAlreadyLoaded}`);
    }
    
    setCurrentReportId(reportId) {
        this.currentReportId = reportId;
        if (reportId) {
            localStorage.setItem('currentPersistentReportId', reportId);
        }
    }
    
    // Call this when report is fully loaded to trigger any callbacks
    reportFullyLoaded() {
        if (this.onReportLoaded && typeof this.onReportLoaded === 'function') {
            console.log('[ReportState] Calling onReportLoaded callback');
            this.onReportLoaded();
        }
    }
    
    setCurrentInterviewId(interviewId) {
        this.currentInterviewId = interviewId;
    }
    
    resetForRegeneration() {
        console.log(`[ReportState] Resetting for regeneration`);
        this.reportLoadedViaApi = false;
        this.reportAlreadyLoaded = false;
        this.reportBuffer = '';
        this.currentThinkingMessage = null;
        this.fullscreenThinkingOverlay = null;
        this.reportStreamingBackgroundElement = null;
        this.isRegenerating = true;
        sessionStorage.setItem('isRegenerating', 'true');
        console.log(`[ReportState] After reset: reportLoadedViaApi=${this.reportLoadedViaApi}, reportAlreadyLoaded=${this.reportAlreadyLoaded}`);
    }
    
    stopRegeneration() {
        this.isRegenerating = false;
        sessionStorage.removeItem('isRegenerating');
        console.log(`[ReportState] Regeneration stopped`);
    }
}

// Initialize and export global report state
const reportState = new ReportState();
window.reportState = reportState;

export { reportState, ReportState };