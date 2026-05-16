// Panel Management Module
// Handles the state and UI updates for various slide-out panels

// Apply report detail panel state from appState
function applyReportDetailPanelState() {
    const panel = document.getElementById('reportDetailPanel');
    const overlay = document.getElementById('reportDetailOverlay');
    if (!panel || !overlay) return;

    const isOpen = appState.uiState.reportDetailPanel.isOpen;

    if (isOpen) {
        panel.style.display = 'flex';
        overlay.classList.add('visible');
        // Trigger reflow for transition
        void panel.offsetWidth;
        panel.classList.add('open');
        applyReportDetailPanelActiveTab(); // Apply active tab when opening
    } else {
        panel.classList.remove('open');
        overlay.classList.remove('visible');
        setTimeout(() => {
            if (!appState.uiState.reportDetailPanel.isOpen) { // Check state again before hiding
                panel.style.display = 'none';
            }
        }, 300); // Match CSS transition duration
    }
}

// Apply active tab within the report detail panel
function applyReportDetailPanelActiveTab() {
    const activeTabId = appState.uiState.reportDetailPanel.activeTab;
    const panel = document.getElementById('reportDetailPanel');
    if (!panel) return;

    const navButtons = panel.querySelectorAll('.panel-nav-button');
    const contentSections = panel.querySelectorAll('.report-detail-content');

    navButtons.forEach(btn => {
        if (btn.getAttribute('data-target') === activeTabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    contentSections.forEach(section => {
        if (section.id === activeTabId) {
            section.classList.remove('hidden');
        } else {
            section.classList.add('hidden');
        }
    });
}

// Apply interview live preview panel state from appState
function applyInterviewLivePreviewPanelState() {
    const panel = document.getElementById('interviewLivePreviewPanel');
    const overlay = document.getElementById('interviewLivePreviewOverlay');
    const iframe = document.getElementById('livePreviewIframe');
    if (!panel || !overlay || !iframe) return;

    const isOpen = appState.uiState.interviewLivePreviewPanel.isOpen;
    const iframeSrc = appState.uiState.interviewLivePreviewPanel.iframeSrc;

    if (isOpen) {
        // If opening preview, ensure other panels are closed
        if (appState.uiState.reportDetailPanel.isOpen) {
            appState.setReportDetailPanelOpen(false);
            applyReportDetailPanelState(); // Update report panel UI
        }
        if (appState.uiState.pricingPanel.isOpen) {
            appState.setPricingPanelOpen(false);
            if (window.applyPricingPanelState) window.applyPricingPanelState();
        }

        iframe.src = iframeSrc;
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
            if (!appState.uiState.interviewLivePreviewPanel.isOpen) { // Check state again
                panel.style.display = 'none';
                iframe.src = 'about:blank'; // Clear iframe src when fully closed
            }
        }, 300); // Match CSS transition duration
    }
}

// Panel Collapse/Expand Logic
function initializePanelCollapse() {
    const collapseConfigPanelBtn = document.getElementById('collapseConfigPanelBtn');
    const collapseCopilotPanelBtn = document.getElementById('collapseCopilotPanelBtn');
    const configPanel = document.getElementById('configPanel');
    const copilotPanel = document.getElementById('copilotPanel');

    collapseConfigPanelBtn?.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent double-triggering when panel is clicked
        appState.setConfigPanelCollapsed(!appState.uiState.configPanelCollapsed);
        // applyPanelCollapseStates is called by the appState mutator
    });

    collapseCopilotPanelBtn?.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent double-triggering when panel is clicked
        appState.setCopilotPanelCollapsed(!appState.uiState.copilotPanelCollapsed);
        // applyPanelCollapseStates is called by the appState mutator
    });

    // Click anywhere on panel to expand or maximize
    configPanel?.addEventListener('click', (e) => {
        // Don't trigger if clicking on buttons or interactive elements
        if (e.target.closest('.panel-collapse-btn') || 
            e.target.closest('button') || 
            e.target.closest('input') || 
            e.target.closest('textarea') ||
            e.target.closest('select') ||
            e.target.closest('a')) {
            return;
        }
        
        if (configPanel.classList.contains('is-collapsed')) {
            // If collapsed, expand it
            appState.setConfigPanelCollapsed(false);
        } else if (!appState.uiState.copilotPanelCollapsed) {
            // If both panels are visible, collapse the other one to maximize this one
            appState.setCopilotPanelCollapsed(true);
        }
    });

    copilotPanel?.addEventListener('click', (e) => {
        // Don't trigger if clicking on buttons or interactive elements
        // Exception: DO trigger when clicking in the messages area or message input
        const isMessageArea = e.target.closest('#copilotMessages') || 
                            e.target.closest('.copilot-message') ||
                            e.target.closest('#copilotInput');
        
        if (!isMessageArea && (
            e.target.closest('.panel-collapse-btn') || 
            e.target.closest('button') || 
            e.target.closest('input') || 
            e.target.closest('textarea') ||
            e.target.closest('select') ||
            e.target.closest('a'))) {
            return;
        }
        
        if (copilotPanel.classList.contains('is-collapsed')) {
            // If collapsed, expand it
            appState.setCopilotPanelCollapsed(false);
        } else if (!appState.uiState.configPanelCollapsed) {
            // If both panels are visible, collapse the other one to maximize this one
            appState.setConfigPanelCollapsed(true);
        }
    });

    // Initial application of collapse states
    applyPanelCollapseStates();
}

function applyPanelCollapseStates() {
    const mainArea = document.querySelector('.main-content-area');
    const configPanel = document.getElementById('configPanel');
    const copilotPanel = document.getElementById('copilotPanel');

    if (!mainArea || !configPanel || !copilotPanel) {
        console.warn('One or more panel elements missing for collapse/expand functionality.');
        return;
    }

    const isConfigCollapsed = appState.uiState.configPanelCollapsed;
    const isCopilotCollapsed = appState.uiState.copilotPanelCollapsed;
    const collapsedWidth = getComputedStyle(document.documentElement).getPropertyValue('--panel-collapsed-width').trim();

    // Remove old classes from mainArea if they exist (though they are no longer used for display:none)
    mainArea.classList.remove('config-panel-collapsed', 'copilot-panel-collapsed');

    // Toggle .is-collapsed class on panels directly
    if (isConfigCollapsed) {
        configPanel.classList.add('is-collapsed');
        // Set data-panel-title for tooltip
        const configHeader = configPanel.querySelector('.panel-custom-header');
        const configTitle = configPanel.querySelector('#configPanelHeaderTitle')?.textContent || 'Details';
        if (configHeader) configHeader.setAttribute('data-panel-title', configTitle);
    } else {
        configPanel.classList.remove('is-collapsed');
    }

    if (isCopilotCollapsed) {
        copilotPanel.classList.add('is-collapsed');
        // Set data-panel-title for tooltip
        const copilotHeader = copilotPanel.querySelector('.copilot-header');
        const copilotTitle = copilotPanel.querySelector('#copilotTitle')?.textContent || 'AI Copilot';
        if (copilotHeader) copilotHeader.setAttribute('data-panel-title', copilotTitle);
    } else {
        copilotPanel.classList.remove('is-collapsed');
    }

    // Adjust grid layout
    if (isConfigCollapsed && !isCopilotCollapsed) {
        mainArea.style.gridTemplateColumns = `${collapsedWidth} 1fr`;
    } else if (!isConfigCollapsed && isCopilotCollapsed) {
        mainArea.style.gridTemplateColumns = `1fr ${collapsedWidth}`;
    } else if (!isConfigCollapsed && !isCopilotCollapsed) {
        mainArea.style.gridTemplateColumns = '1fr 1fr';
    } else {
        // This case (both collapsed) should be prevented by appState mutators,
        // but as a fallback, set to default.
        mainArea.style.gridTemplateColumns = '1fr 1fr';
        // And force one to be open if this state is somehow reached
        if (isConfigCollapsed && isCopilotCollapsed) {
            appState.setConfigPanelCollapsed(false); // This will re-trigger applyPanelCollapseStates
            return; // Exit early as state will be re-evaluated
        }
    }

    // Update icons for collapse buttons
    const collapseConfigPanelBtn = document.getElementById('collapseConfigPanelBtn');
    const collapseCopilotPanelBtn = document.getElementById('collapseCopilotPanelBtn');
    updateCollapseButtonIcon(collapseConfigPanelBtn, isConfigCollapsed, true); // true for left panel (config)
    updateCollapseButtonIcon(collapseCopilotPanelBtn, isCopilotCollapsed, false); // false for right panel (copilot)

    // Toggle visibility of panel titles and function icons
    const configPanelHeaderTitle = configPanel.querySelector('.panel-custom-header .panel-header-title');
    const configPanelFunctionIcon = configPanel.querySelector('.panel-custom-header .panel-function-icon');
    const shareUrlBtn = document.getElementById('shareUrlBtn');
    const copilotHeaderContent = copilotPanel.querySelector('.copilot-header .flex > div:first-child'); // Contains title, subtitle, function icon
    const copilotTitle = copilotPanel.querySelector('#copilotTitle');
    const copilotSubtitle = copilotPanel.querySelector('#copilotSubtitle');
    const copilotFunctionIcon = copilotPanel.querySelector('.copilot-header .panel-function-icon');
    const copilotModeToggle = copilotPanel.querySelector('#copilotModeToggle');
    
    // Update analyst thread UI when copilot panel collapse state changes
    if (appState.copilotMode === 'analyst' && window.updateAnalystThreadUI) {
        window.updateAnalystThreadUI();
    }

    if (isConfigCollapsed) {
        if (configPanelHeaderTitle) configPanelHeaderTitle.classList.add('hidden');
        if (configPanelFunctionIcon) configPanelFunctionIcon.classList.remove('hidden');
        if (shareUrlBtn) shareUrlBtn.classList.add('hidden');
    } else {
        if (configPanelHeaderTitle) configPanelHeaderTitle.classList.remove('hidden');
        if (configPanelFunctionIcon) configPanelFunctionIcon.classList.add('hidden');
        // Only show share URL button if there's a URL to share (when an interview is loaded)
        if (shareUrlBtn && shareUrlBtn.hasAttribute('data-share-url')) {
            shareUrlBtn.classList.remove('hidden');
        }
    }

    if (isCopilotCollapsed) {
        if (copilotTitle) copilotTitle.classList.add('hidden');
        if (copilotSubtitle) copilotSubtitle.classList.add('hidden');
        if (copilotFunctionIcon) copilotFunctionIcon.classList.remove('hidden');
        if (copilotModeToggle) copilotModeToggle.classList.add('hidden');
    } else {
        if (copilotTitle) copilotTitle.classList.remove('hidden');
        if (copilotSubtitle) copilotSubtitle.classList.remove('hidden');
        if (copilotFunctionIcon) copilotFunctionIcon.classList.add('hidden');
        if (copilotModeToggle) copilotModeToggle.classList.remove('hidden');
    }
}

function updateCollapseButtonIcon(button, isCollapsed, isLeftPanel) {
    if (!button) return;
    const iconCollapse = button.querySelector('.icon-collapse');
    const iconExpand = button.querySelector('.icon-expand');
    if (!iconCollapse || !iconExpand) return;

    if (isCollapsed) {
        iconCollapse.classList.add('hidden');
        iconExpand.classList.remove('hidden');
    } else {
        iconCollapse.classList.remove('hidden');
        iconExpand.classList.add('hidden');
    }
}

// Expose functions globally
window.applyReportDetailPanelState = applyReportDetailPanelState;
window.applyReportDetailPanelActiveTab = applyReportDetailPanelActiveTab;
window.applyInterviewLivePreviewPanelState = applyInterviewLivePreviewPanelState;
window.applyPanelCollapseStates = applyPanelCollapseStates;
window.initializePanelCollapse = initializePanelCollapse; 