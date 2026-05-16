// Pricing Panel Module
// Handles pricing panel state and UI updates

// Apply pricing panel state from appState
function applyPricingPanelState() {
    const panel = document.getElementById('pricingPanel'); 
    const overlay = document.getElementById('pricingOverlay'); 
    const iframe = document.getElementById('pricingIframe');
    if (!panel || !overlay || !iframe) {
        console.warn("Pricing panel, overlay, or iframe element not found.");
        return;
    }

    const isOpen = appState.uiState.pricingPanel.isOpen;

    if (isOpen) {
        // Close other slide-out panels if they are open
        if (appState.uiState.reportDetailPanel.isOpen) {
            appState.setReportDetailPanelOpen(false);
            if (window.applyReportDetailPanelState) window.applyReportDetailPanelState();
        }
        if (appState.uiState.interviewLivePreviewPanel.isOpen) {
            appState.setInterviewLivePreviewPanelOpen(false);
            if (window.applyInterviewLivePreviewPanelState) window.applyInterviewLivePreviewPanelState();
        }
        if (appState.uiState.userSettingsPanel.isOpen) {
            appState.setUserSettingsPanelOpen(false);
            if (window.applyUserSettingsPanelState) window.applyUserSettingsPanelState();
        }
        
        // Refresh the iframe src to ensure latest data
        iframe.src = iframe.src;
        
        panel.style.display = 'flex';
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
        void panel.offsetWidth; // Trigger reflow
        panel.style.transform = 'translateX(0)';
    } else {
        panel.style.transform = 'translateX(100%)';
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        setTimeout(() => {
            if (!appState.uiState.pricingPanel.isOpen) { // Check state again before hiding
                panel.style.display = 'none';
            }
        }, 300); // Match CSS transition duration
    }
}

// Initialize pricing panel event listeners
function initializePricingPanel() {
    const pricingBtn = document.getElementById('pricingBtn');
    const closePricingPanelBtn = document.getElementById('closePricingPanelBtn');
    const pricingOverlay = document.getElementById('pricingOverlay');

    // Open pricing panel
    pricingBtn?.addEventListener('click', () => {
        appState.setPricingPanelOpen(true);
        applyPricingPanelState();
    });

    // Close pricing panel via close button
    closePricingPanelBtn?.addEventListener('click', () => {
        appState.setPricingPanelOpen(false);
        applyPricingPanelState();
    });

    // Close pricing panel via overlay click
    pricingOverlay?.addEventListener('click', () => {
        appState.setPricingPanelOpen(false);
        applyPricingPanelState();
    });

    // Handle escape key to close panel
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && appState.uiState.pricingPanel.isOpen) {
            appState.setPricingPanelOpen(false);
            applyPricingPanelState();
        }
    });
}

// Expose functions globally
window.applyPricingPanelState = applyPricingPanelState;
window.initializePricingPanel = initializePricingPanel; 