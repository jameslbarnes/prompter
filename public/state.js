class AppState {
    constructor() {
        // Core Application State
        this.currentEditingInterviewId = null;
        this.currentInterviewTitleForHeader = '';
        this.isJournalAnalysisMode = false;
        this.copilotMode = 'editor'; // 'editor' or 'analyst'
        this.initialChatMessages = []; // For new interviews before first save
        this.currentInterviewFiles = []; // Files associated with the current interview
        this.allFetchedJournalEntries = []; // Cache for journal entries
        this.userProfile = { // ADDED: User Profile State
            displayName: '',
            organization: ''
        };
        
        // Journal Analyst Thread State
        this.currentJournalThreadId = null;
        this.journalThreads = []; // Array of thread metadata for current user filter
        this.currentThreadMessages = []; // Messages for the active thread
        this.currentJournalUserFilter = 'all'; // Track current filter

        // Analyst Thread State (per interview)
        this.currentAnalystThreadId = null;
        this.analystThreads = []; // Array of thread metadata for current interview
        this.currentAnalystThreadMessages = []; // Messages for the active analyst thread

        // Interview Specification (managed by Copilot)
        this.interviewSpec = {
            title: "Untitled Interview",
            description: "",
            category: "", // ADDED: Interview category
            purpose: "", // ADDED: Interview purpose
            requiredInformation: [], // ADDED: Required information to collect
            initialPrompt: "",
            followupPrompt: "",
            reportPrompt: "",
            adminReportPrompt: "",
            exampleFollowupQuestion: "",
            exampleReportContent: "",
            exampleAdminReport: "",
            pageHeaders: {
                intro: "AI Readiness Interview",
                interview: "Tell us about your experience",
                report: "Personal AI Readiness Report",
                reportSub: "Your personalized assessment"
            },
            hasExternalDocuments: false, // Default from admin.html
            enableWebSearch: false, // ADDED DEFAULT
            enableThinking: true, // ADDED DEFAULT - thinking enabled by default
            enableMemoryService: true, // ADDED DEFAULT - memory service enabled by default
            followupModel: 'claude-opus-4-5', // ADDED DEFAULT - Claude Sonnet 4 default
            enableVideoRecording: false, // ADDED DEFAULT - video recording disabled by default
            contextFiles: [], // This will mirror currentInterviewFiles but is part of the spec
            completionRedirectUrl: '',
        };

        // UI State
        this.uiState = {
            sidebarCollapsed: localStorage.getItem('sidebarCollapsed') === 'true',
            activeSpecTab: 'spec-preview', // Default active tab in the config panel
            reportDetailPanel: {
                isOpen: false,
                currentReportId: null,
                activeTab: 'interviewContent', // Default tab in report detail
            },
            interviewLivePreviewPanel: {
                isOpen: false,
                iframeSrc: 'about:blank',
            },
            globalAudioPlayer: {
                src: null,
                isPlaying: false,
                title: 'No track loaded',
                artist: 'Select audio to play',
                currentTime: 0,
                duration: 0,
                volume: 1,
                activeTriggerButton: null, // Reference to the button that triggered the current audio
            },
            reportAudioGeneration: {
                isGenerating: false,
                reportId: null,
                buttonElement: null, // Reference to the listen button
                originalButtonText: 'Listen to Report',
            },
            theme: localStorage.getItem('adminTheme') || 'dark',
            isLoadingChatHistory: false,
            isSavingInterview: false,
            isLoadingResponses: false,

            isLoadingJournalEntries: false,
            copilotInputFocused: false,
            configPanelCollapsed: true, // Default to collapsed for null state
            copilotPanelCollapsed: false,
            userSettingsPanel: { isOpen: false }, // ADDED: User Settings Panel UI State
            pricingPanel: { isOpen: false }, // ADDED: Pricing Panel UI State
            brollPromptsPanel: { isOpen: false }, // ADDED: B-Roll Prompts Panel UI State
            mobileNavOpen: false, // ADDED: Mobile Navigation State
            streamingPanel: { isOpen: false }, // ADDED: Streaming Panel UI State
            templatesPanel: { isOpen: false }, // ADDED: Templates Panel UI State
        };
    }

    // --- MUTATORS ---
    // These methods will be the primary way to update the state.
    // They can also trigger UI updates or events if necessary.

    setCurrentEditingInterviewId(id) {
        if (this.currentEditingInterviewId === id && id !== null) return; // Avoid unnecessary updates if ID is same and not null
                                                                    // Allow re-setting to null even if already null, to trigger URL update if needed.

        this.currentEditingInterviewId = id;
        // Update URL hash when interview ID changes
        if (typeof window.updateUrlForInterview === 'function') {
            window.updateUrlForInterview(id); // id can be null
        } else {
            console.warn("updateUrlForInterview function not found on window. URL hash will not be updated from appState.");
        }
        // Potentially trigger event: 'interviewIdChanged'
    }

    setCurrentInterviewTitleForHeader(title) {
        this.currentInterviewTitleForHeader = title || '';
        // Potentially trigger event: 'headerTitleChanged'
    }

    setJournalAnalysisMode(isJournalMode) {
        if (this.isJournalAnalysisMode === isJournalMode) return; // Avoid unnecessary updates

        this.isJournalAnalysisMode = isJournalMode;
        if (isJournalMode) {
            this.setCopilotMode('analyst'); // Force analyst mode
            this.setCurrentInterviewTitleForHeader("Activity Feed"); // Corrected title

            // If entering journal mode, currentEditingInterviewId should be null.
            // This will also trigger the URL update via the setCurrentEditingInterviewId method.
            if (this.currentEditingInterviewId !== null) {
                 this.setCurrentEditingInterviewId(null);
            }
        } else {
            // Clear thread state when leaving journal mode
            this.currentJournalThreadId = null;
            this.journalThreads = [];
            this.currentThreadMessages = [];
        }
        // Update 'My Activity' button state
        const myJournalBtn = document.getElementById('myActivityBtn');
        if (myJournalBtn) {
            if (isJournalMode) {
                myJournalBtn.classList.add('active-journal-button');
            } else {
                myJournalBtn.classList.remove('active-journal-button');
            }
        } else {
            console.warn("myActivityBtn element not found. Cannot update its active state from appState.");
        }
        // Potentially trigger event: 'journalModeChanged'
    }

    setCopilotMode(mode) {
        if (this.isJournalAnalysisMode && mode !== 'analyst') {
            console.warn("Cannot change copilot mode from 'analyst' when in Journal Analysis Mode.");
            this.copilotMode = 'analyst';
        } else {
            this.copilotMode = mode;
        }
        // Potentially trigger event: 'copilotModeChanged'
    }

    setInterviewSpec(newSpec) {
        console.log('[DEBUG] AppState.setInterviewSpec called with:', newSpec);
        console.log('[DEBUG] Current interviewSpec before merge:', JSON.stringify(this.interviewSpec));
        this.interviewSpec = { ...this.interviewSpec, ...newSpec };
        if (newSpec.pageHeaders) {
            this.interviewSpec.pageHeaders = { ...this.interviewSpec.pageHeaders, ...newSpec.pageHeaders };
        }
        console.log('[DEBUG] New interviewSpec after merge:', JSON.stringify(this.interviewSpec));
        // Potentially trigger event: 'interviewSpecChanged'
    }
    
    resetInterviewSpec() {
        console.log('[DEBUG] AppState.resetInterviewSpec called - this will reset enableThinking to true');
        console.trace('[DEBUG] Stack trace for resetInterviewSpec call');
        this.interviewSpec = {
            title: "Untitled Interview",
            description: "",
            category: "",
            purpose: "",
            requiredInformation: [],
            initialPrompt: "",
            followupPrompt: "",
            reportPrompt: "",
            adminReportPrompt: "",
            exampleFollowupQuestion: "",
            exampleReportContent: "",
            exampleAdminReport: "",
            pageHeaders: {
                intro: "AI Readiness Interview",
                interview: "Tell us about your experience",
                report: "Personal AI Readiness Report",
                reportSub: "Your personalized assessment"
            },
            hasExternalDocuments: false,
            enableWebSearch: false, // ADDED DEFAULT
            enableThinking: true, // ADDED DEFAULT - thinking enabled by default
            enableMemoryService: false, // ADDED DEFAULT - memory service disabled by default
            followupModel: 'claude-opus-4-5', // ADDED DEFAULT - Claude Sonnet 4 default
            allowPublicGallery: false,
            interviewTheme: 'dark',
            completionRedirectUrl: '',
            enableVideoRecording: false,
            contextFiles: [],
        };
         this.currentInterviewFiles = [];
    }

    setCurrentInterviewFiles(files) {
        this.currentInterviewFiles = files || [];
        this.interviewSpec.contextFiles = this.currentInterviewFiles; // Keep in sync
        // Potentially trigger event: 'interviewFilesChanged'
    }

    setInitialChatMessages(messages) {
        this.initialChatMessages = messages || [];
    }

    addInitialChatMessage(message) {
        this.initialChatMessages.push(message);
    }

    clearInitialChatMessages() {
        this.initialChatMessages = [];
    }
    
    setAllFetchedJournalEntries(entries) {
        this.allFetchedJournalEntries = entries || [];
    }

    // UI State Mutators
    setSidebarCollapsed(isCollapsed) {
        this.uiState.sidebarCollapsed = isCollapsed;
        localStorage.setItem('sidebarCollapsed', isCollapsed);
        // Potentially trigger event: 'sidebarCollapseChanged'
    }

    setMobileNavOpen(isOpen) {
        if (this.uiState.mobileNavOpen === isOpen) return; // Avoid unnecessary updates

        this.uiState.mobileNavOpen = isOpen;
        console.log(`[AppState] setMobileNavOpen called. New state: ${isOpen}`);

        const reportSidebar = document.getElementById('reportSidebar');
        const mobileNavOverlay = document.getElementById('mobileNavOverlay');

        if (!reportSidebar || !mobileNavOverlay) {
            console.error('[AppState] Mobile nav elements not found in DOM for setMobileNavOpen');
            return;
        }

        if (isOpen) {
            reportSidebar.classList.add('show');
            mobileNavOverlay.classList.add('show');
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.height = '100vh';
            document.body.style.width = '100vw';
            console.log('[AppState] Mobile nav visually OPENED');
        } else {
            reportSidebar.classList.remove('show');
            mobileNavOverlay.classList.remove('show');
            document.body.style.overflow = '';
            document.body.style.position = '';
            document.body.style.height = '';
            document.body.style.width = '';
            console.log('[AppState] Mobile nav visually CLOSED');
        }
        // Potentially trigger event: 'mobileNavToggled'
    }

    setUserSettingsPanelOpen(isOpen) { // ADDED: Mutator for User Settings Panel
        this.uiState.userSettingsPanel.isOpen = isOpen;
        // Potentially trigger event: 'userSettingsPanelToggled'
    }

    setPricingPanelOpen(isOpen) {
        this.uiState.pricingPanel.isOpen = isOpen;
        // Potentially trigger event: 'pricingPanelToggled'
    }

    setBrollPromptsPanelOpen(isOpen) {
        this.uiState.brollPromptsPanel.isOpen = isOpen;
        // Potentially trigger event: 'brollPromptsPanelToggled'
    }

    setStreamingPanelOpen(isOpen) {
        this.uiState.streamingPanel.isOpen = isOpen;
        // Potentially trigger event: 'streamingPanelToggled'
    }

    setTemplatesPanelOpen(isOpen) {
        this.uiState.templatesPanel.isOpen = isOpen;
        // Potentially trigger event: 'templatesPanelToggled'
    }

    setActiveSpecTab(tabId) {
        this.uiState.activeSpecTab = tabId;
        // Potentially trigger event: 'specTabChanged'
    }
    
    setReportDetailPanelOpen(isOpen, reportId = null) {
        this.uiState.reportDetailPanel.isOpen = isOpen;
        if (isOpen && reportId) {
            this.uiState.reportDetailPanel.currentReportId = reportId;
        } else if (!isOpen) {
            this.uiState.reportDetailPanel.currentReportId = null;
        }
        // Potentially trigger event: 'reportDetailPanelToggled'
    }
    
    setReportDetailPanelTab(tabId) {
        this.uiState.reportDetailPanel.activeTab = tabId;
        // Potentially trigger event: 'reportDetailTabChanged'
    }

    setInterviewLivePreviewPanelOpen(isOpen, iframeSrc = 'about:blank') {
        this.uiState.interviewLivePreviewPanel.isOpen = isOpen;
        if (isOpen) {
            this.uiState.interviewLivePreviewPanel.iframeSrc = iframeSrc;
        } else {
            this.uiState.interviewLivePreviewPanel.iframeSrc = 'about:blank';
        }
        // Potentially trigger event: 'livePreviewPanelToggled'
    }
    
    setGlobalAudioPlayerState(newState) {
        this.uiState.globalAudioPlayer = { ...this.uiState.globalAudioPlayer, ...newState };
        // Potentially trigger event: 'globalAudioPlayerStateChanged'
    }

    resetGlobalAudioPlayer() {
        this.uiState.globalAudioPlayer = {
            src: null,
            isPlaying: false,
            title: 'No track loaded',
            artist: 'Select audio to play',
            currentTime: 0,
            duration: 0,
            volume: 1,
            activeTriggerButton: null,
        };
    }

    // Report Audio Generation State Mutators
    setReportAudioGenerating(reportId, buttonElement = null) {
        this.uiState.reportAudioGeneration.isGenerating = true;
        this.uiState.reportAudioGeneration.reportId = reportId;
        
        if (buttonElement) {
            this.uiState.reportAudioGeneration.buttonElement = buttonElement;
        }
        
        this.updateAudioGenerationUI();
        console.log(`[AppState] Audio generation started for report ${reportId}`);
    }

    setReportRegenerating(buttonElement = null) {
        this.uiState.reportAudioGeneration.isGenerating = true;
        this.uiState.reportAudioGeneration.reportId = null; // No specific report ID during regeneration
        
        if (buttonElement) {
            this.uiState.reportAudioGeneration.buttonElement = buttonElement;
        }
        
        this.updateAudioGenerationUI();
        console.log(`[AppState] Report regeneration started - audio will be generated for new report`);
    }

    setReportAudioReady(reportId = null) {
        // Only update if this is for the current generating report or if no specific reportId given
        if (!reportId || this.uiState.reportAudioGeneration.reportId === reportId) {
            this.uiState.reportAudioGeneration.isGenerating = false;
            this.updateAudioGenerationUI();
            console.log(`[AppState] Audio generation completed for report ${reportId || this.uiState.reportAudioGeneration.reportId}`);
        }
    }

    resetReportAudioGeneration() {
        this.uiState.reportAudioGeneration = {
            isGenerating: false,
            reportId: null,
            buttonElement: null,
            originalButtonText: 'Listen to Report',
        };
    }

    updateAudioGenerationUI() {
        const audioState = this.uiState.reportAudioGeneration;
        if (!audioState.buttonElement) {
            console.warn('[AppState] updateAudioGenerationUI called but no buttonElement found');
            return;
        }

        console.log(`[AppState] updateAudioGenerationUI: isGenerating=${audioState.isGenerating}, reportId=${audioState.reportId}`);
        
        if (audioState.isGenerating) {
            audioState.buttonElement.disabled = true;
            audioState.buttonElement.title = 'Generating Audio...';
        } else {
            audioState.buttonElement.disabled = false;
            audioState.buttonElement.title = 'Listen to Report';
        }
    }

    setTheme(theme) {
        this.uiState.theme = theme;
        localStorage.setItem('adminTheme', theme);
        document.documentElement.setAttribute('data-theme', theme);
        // Potentially trigger event: 'themeChanged'
    }

    setLoadingState(key, isLoading) {
        if (this.uiState.hasOwnProperty(key) && typeof this.uiState[key] === 'boolean') {
            this.uiState[key] = isLoading;
            // Potentially trigger event for specific loading states
        } else {
            console.warn(`Invalid loading state key: ${key}`);
        }
    }

    setConfigPanelCollapsed(isCollapsed) {
        if (this.uiState.configPanelCollapsed === isCollapsed) return;

        this.uiState.configPanelCollapsed = isCollapsed;
        if (isCollapsed && this.uiState.copilotPanelCollapsed) {
            this.setCopilotPanelCollapsed(false); // Ensure one panel is always open
        }
        // Potentially trigger event: 'configPanelCollapseChanged'
        if (typeof window.applyPanelCollapseStates === 'function') {
            window.applyPanelCollapseStates();
        }
    }

    setCopilotPanelCollapsed(isCollapsed) {
        if (this.uiState.copilotPanelCollapsed === isCollapsed) return;

        this.uiState.copilotPanelCollapsed = isCollapsed;
        if (isCollapsed && this.uiState.configPanelCollapsed) {
            this.setConfigPanelCollapsed(false); // Ensure one panel is always open
        }
        // Potentially trigger event: 'copilotPanelCollapseChanged'
        if (typeof window.applyPanelCollapseStates === 'function') {
            window.applyPanelCollapseStates();
        }
    }

    // ADDED: Mutator for User Profile
    setUserProfile(profileData) {
        this.userProfile = { ...this.userProfile, ...profileData };
        // Potentially trigger event: 'userProfileChanged'
    }

    // Journal Thread Management Methods
    setCurrentJournalThreadId(threadId) {
        this.currentJournalThreadId = threadId;
        if (threadId) {
            localStorage.setItem(`journalThread_${this.currentJournalUserFilter}`, threadId);
        }
    }

    setJournalThreads(threads) {
        this.journalThreads = threads || [];
    }

    addJournalThread(thread) {
        this.journalThreads.push(thread);
    }

    updateJournalThread(threadId, updates) {
        const index = this.journalThreads.findIndex(t => t.id === threadId);
        if (index !== -1) {
            this.journalThreads[index] = { ...this.journalThreads[index], ...updates };
        }
    }

    removeJournalThread(threadId) {
        this.journalThreads = this.journalThreads.filter(t => t.id !== threadId);
        if (this.currentJournalThreadId === threadId) {
            this.currentJournalThreadId = null;
        }
    }

    setCurrentThreadMessages(messages) {
        this.currentThreadMessages = messages || [];
    }

    addThreadMessage(message) {
        this.currentThreadMessages.push(message);
    }

    setCurrentJournalUserFilter(filter) {
        this.currentJournalUserFilter = filter;
        // Reset thread state when filter changes
        this.currentJournalThreadId = null;
        this.journalThreads = [];
        this.currentThreadMessages = [];
    }

    getLastUsedThreadForFilter(filter) {
        return localStorage.getItem(`journalThread_${filter}`);
    }

    // Analyst Thread Management Methods
    setCurrentAnalystThreadId(threadId) {
        this.currentAnalystThreadId = threadId;
        if (threadId && this.currentEditingInterviewId) {
            localStorage.setItem(`analystThread_${this.currentEditingInterviewId}`, threadId);
        }
    }

    setAnalystThreads(threads) {
        this.analystThreads = threads || [];
    }

    addAnalystThread(thread) {
        this.analystThreads.push(thread);
    }

    updateAnalystThread(threadId, updates) {
        const index = this.analystThreads.findIndex(t => t.id === threadId);
        if (index !== -1) {
            this.analystThreads[index] = { ...this.analystThreads[index], ...updates };
        }
    }

    removeAnalystThread(threadId) {
        this.analystThreads = this.analystThreads.filter(t => t.id !== threadId);
        if (this.currentAnalystThreadId === threadId) {
            this.currentAnalystThreadId = null;
        }
    }

    setCurrentAnalystThreadMessages(messages) {
        this.currentAnalystThreadMessages = messages || [];
    }

    addAnalystThreadMessage(message) {
        this.currentAnalystThreadMessages.push(message);
    }

    getLastUsedAnalystThreadForInterview(interviewId) {
        return localStorage.getItem(`analystThread_${interviewId}`);
    }

    resetAnalystThreadState() {
        this.currentAnalystThreadId = null;
        this.analystThreads = [];
        this.currentAnalystThreadMessages = [];
    }
}

// Initialize a global AppState instance
// This instance will be accessible in other scripts if state.js is loaded first.
const appState = new AppState();

// Optional: For easier debugging in the console
window.appState = appState;

// We could also implement a simple event emitter here if needed for reactivity,
// or integrate with a more robust state management library later.
// For now, direct mutation and observation will be used. 