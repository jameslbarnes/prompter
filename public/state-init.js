// Emergency fallback for appState initialization
if (typeof window.appState === 'undefined') {
    console.warn('AppState not initialized, creating fallback instance');
    window.appState = {
        currentEditingInterviewId: null,
        currentInterviewTitleForHeader: '',
        isJournalAnalysisMode: false,
        copilotMode: 'editor',
        initialChatMessages: [],
        currentInterviewFiles: [],
        allFetchedJournalEntries: [],
        userProfile: { displayName: '', organization: '' },
        currentJournalThreadId: null,
        journalThreads: [],
        currentThreadMessages: [],
        currentJournalUserFilter: 'all',
        currentAnalystThreadId: null,
        analystThreads: [],
        currentAnalystThreadMessages: [],
        interviewSpec: {
            title: "Untitled Interview",
            description: "",
            category: "",
            initialQuestion: "Tell me about yourself and what brings you here today.",
            initialPrompt: "",
            systemPrompt: "",
            interviewTheme: "light",
            completionRedirectUrl: ""
        },
        uiState: {
            isDarkMode: false,
            sidebarCollapsed: false,
            configPanelCollapsed: false,
            copilotPanelCollapsed: false,
            mobileNavOpen: false,
            activeTab: 'copilot',
            reportAudioGeneration: {
                reportId: null,
                isGenerating: false
            }
        },
        setActiveSpecTab: function(tabId) {
            this.uiState.activeSpecTab = tabId;
        }
    };
}