// Main Admin Module - Imports and initializes all sub-modules

// Import modules
import { initializeTabNavigation } from './js/tab-navigation.js';
import { extractTagContent, escapeXml } from './js/xml-utils.js';
import { 
    initializeGlobalAudioPlayer, 
    playOnGlobalPlayer, 
    applyGlobalAudioPlayerState,
    updateTriggerButtonIcon,
    formatTime,
    updateGlobalPlayPauseIcon
} from './js/audio-player.js';
import { 
    showReportDetails, 
    formatInterviewTranscript,
    regenerateReportAdmin,
    regenerateUserReport
} from './js/report-management.js';
import { 
    showJournalView, 
    renderJournalEntries,
    handleEmailFilterChange
} from './js/journal-view.js';
import { processMessageWithAI } from './js/copilot-process-message.js';
import { updateSpecificationUIFromAppState, addMessageToChat } from './js/copilot-ai-processing.js';
import { initializeNotifications } from './js/notifications.js';

// Expose functions to window for global access
window.extractTagContent = extractTagContent;
window.escapeXml = escapeXml;
window.playOnGlobalPlayer = playOnGlobalPlayer;
window.applyGlobalAudioPlayerState = applyGlobalAudioPlayerState;
window.updateTriggerButtonIcon = updateTriggerButtonIcon;
window.showReportDetailsGlobal = showReportDetails;
window.formatInterviewTranscriptGlobal = formatInterviewTranscript;
window.regenerateReportAdmin = regenerateReportAdmin;
window.regenerateUserReport = regenerateUserReport;
window.showJournalView = showJournalView;
window.renderJournalEntries = renderJournalEntries;
window.handleEmailFilterChange = handleEmailFilterChange;
window.processMessageWithAI = processMessageWithAI;
window.updateSpecificationUIFromAppState = updateSpecificationUIFromAppState;
window.updateSpecificationInputs = updateSpecificationUIFromAppState; // Alias

// Feature gating system
window.userFeatures = null;
window.userSubscription = null;

// Update pricing button with current plan and usage
function updatePricingButtonText() {
    const pricingBtn = document.getElementById('pricingBtn');
    if (!pricingBtn) {
        console.log('[updatePricingButtonText] Pricing button not found');
        return;
    }
    
    if (!window.userSubscription) {
        console.log('[updatePricingButtonText] No subscription data available');
        return;
    }
    
    console.log('[updatePricingButtonText] Subscription data:', window.userSubscription);
    
    // The API returns subscription which contains the full user data
    const userData = window.userSubscription.subscription || {};
    const subscription = userData.subscription || {};
    const usage = userData.usage || {};
    const freeTrialLimit = window.userSubscription.freeTrialLimit || 3;
    
    console.log('[updatePricingButtonText] Plan:', subscription.plan);
    console.log('[updatePricingButtonText] Usage:', usage);
    
    let buttonText = '';
    let remainingInterviews = 0;
    
    if (subscription.plan === 'free' || !subscription.plan) {
        // Free trial users
        remainingInterviews = Math.max(0, freeTrialLimit - usage.interviewsCompleted);
        buttonText = `Trial: ${remainingInterviews}/${freeTrialLimit} Interviews`;
    } else {
        // Paid plan users
        const planData = window.userSubscription.pricingPlans?.[subscription.plan];
        if (planData) {
            const planInterviews = planData.includedInterviews || 0;
            const planRemaining = Math.max(0, planInterviews - (usage.currentPeriodUsage || 0));
            const purchasedRemaining = Math.max(0, (usage.purchasedInterviews || 0) - (usage.purchasedInterviewsUsed || 0));
            remainingInterviews = planRemaining + purchasedRemaining;
            
            // Capitalize plan name
            const planName = subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1);
            buttonText = `${planName}: ${remainingInterviews} Interviews`;
        } else {
            buttonText = 'Pricing';
        }
    }
    
    console.log('[updatePricingButtonText] Setting button text to:', buttonText);
    
    // Update button content while preserving icon
    pricingBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
        </svg>
        ${buttonText}
    `;
}

// Load user features from API
window.loadUserFeatures = async function loadUserFeatures() {
    console.log('[loadUserFeatures] Starting to load user features');
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.log('[loadUserFeatures] No current user');
            return;
        }
        
        const idToken = await currentUser.getIdToken();
        const response = await fetch('/api/subscription', {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });
        
        console.log('[loadUserFeatures] Response status:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('[loadUserFeatures] Subscription data received:', data);
            window.userFeatures = data.features || {};
            window.userSubscription = data;
            applyFeatureGates();
            updatePricingButtonText();
        } else {
            console.error('[loadUserFeatures] Failed to load subscription:', response.status, response.statusText);
        }
    } catch (error) {
        console.error('Error loading user features:', error);
        window.userFeatures = {
            memoryService: false,
            webSearch: false,
            thinkingToggle: false,
            followupModelSelector: false,
            isSuperAdmin: false
        };
        applyFeatureGates();
    }
}

// Apply feature gates to UI elements
window.applyFeatureGates = function applyFeatureGates() {
    if (!window.userFeatures) return;
    
    const features = window.userFeatures;
    
    
    // Web Search
    const webSearchContainer = document.querySelector('#specEnableWebSearch').closest('.mb-4');
    if (webSearchContainer) {
        if (!features.webSearch) {
            applyFeatureRestriction(webSearchContainer, 'Growth plan required');
        } else {
            removeFeatureRestriction(webSearchContainer);
        }
    }
    
    // Thinking Toggle - Hide completely for non-super-admins
    const thinkingContainer = document.querySelector('#specEnableThinking').closest('.mb-4');
    if (thinkingContainer) {
        if (!features.thinkingToggle && !features.isSuperAdmin) {
            thinkingContainer.style.display = 'none';
        } else {
            thinkingContainer.style.display = 'block';
            removeFeatureRestriction(thinkingContainer);
        }
    }
    
    // Followup Model Selector - Hide completely for non-super-admins
    const modelContainer = document.querySelector('#specFollowupModel').closest('.mb-4');
    if (modelContainer) {
        if (!features.followupModelSelector && !features.isSuperAdmin) {
            modelContainer.style.display = 'none';
        } else {
            modelContainer.style.display = 'block';
            removeFeatureRestriction(modelContainer);
        }
    }
    
    // Video Recording Toggle - Available to all users
    // No need for special checks, the toggle is now visible by default
}

// Apply restriction to a feature container
function applyFeatureRestriction(container, message) {
    // Add greyed out styling
    container.style.opacity = '0.5';
    container.style.position = 'relative';
    
    // Disable inputs
    const inputs = container.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.disabled = true;
        input.style.cursor = 'not-allowed';
    });
    
    // Remove any existing tooltip
    const existingTooltip = container.querySelector('.feature-restriction-tooltip');
    if (existingTooltip) {
        existingTooltip.remove();
    }
    
    // Add tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'feature-restriction-tooltip';
    tooltip.innerHTML = `
        <div class="absolute top-0 right-0 bg-gray-900 text-yellow-400 text-xs px-2 py-1 rounded-md shadow-lg flex items-center space-x-1 z-10">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
            </svg>
            <span>${message}</span>
        </div>
    `;
    container.appendChild(tooltip);
}

// Remove restriction from a feature container
function removeFeatureRestriction(container) {
    // Remove greyed out styling
    container.style.opacity = '1';
    
    // Enable inputs
    const inputs = container.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.disabled = false;
        input.style.cursor = 'default';
    });
    
    // Remove tooltip
    const tooltip = container.querySelector('.feature-restriction-tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// Initialize all modules when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Add click handler to detect Interview Designer "Design new interview" clicks
    document.addEventListener('click', function(e) {
        const INTERVIEW_DESIGNER_ID = '5dbb409d-fade-4ece-ae9d-0bfb8ff34097';
        
        // Check if the clicked element or its parents contain the Interview Designer ID
        let element = e.target;
        let foundDesigner = false;
        
        while (element && element !== document) {
            // Check various attributes that might contain the ID
            const elementText = element.textContent || '';
            const elementHTML = element.innerHTML || '';
            const dataId = element.getAttribute('data-id') || '';
            const href = element.getAttribute('href') || '';
            
            if (dataId.includes(INTERVIEW_DESIGNER_ID) || 
                href.includes(INTERVIEW_DESIGNER_ID) ||
                (elementText.includes('Design new interview') && elementHTML.includes(INTERVIEW_DESIGNER_ID))) {
                foundDesigner = true;
                break;
            }
            element = element.parentElement;
        }
        
        // If this is a click on the Interview Designer card and it says "Design new interview"
        if (foundDesigner && (e.target.textContent.includes('Design new interview') || 
            e.target.closest('[class*="card"]')?.textContent.includes('Design new interview'))) {
            console.log('[Interview Designer] Design new interview clicked - setting pending flag');
            window._pendingInterviewDesignerFlow = true;
        }
    });
    
    // Initialize tab navigation
    initializeTabNavigation();
    
    // Initialize global audio player
    initializeGlobalAudioPlayer();
    
    // Initialize notifications
    initializeNotifications();
    
    // Initialize b-roll prompts panel
    if (window.initializeBrollPromptsPanel) {
        window.initializeBrollPromptsPanel();
    }
    
    // Refresh subscription data when window regains focus
    window.addEventListener('focus', function() {
        if (auth.currentUser && window.loadUserFeatures) {
            window.loadUserFeatures();
        }
    });

    // Listen for subscription updates from popup windows
    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'subscriptionUpdated') {
            if (auth.currentUser && window.loadUserFeatures) {
                window.loadUserFeatures();
            }

            const pricingIframe = document.getElementById('pricingIframe');
            if (pricingIframe) {
                pricingIframe.src = pricingIframe.src;
            }
        }
    });
    
    // Initialize panel collapse functionality
    if (window.initializePanelCollapse) {
        window.initializePanelCollapse();
    }
    
    // Initialize report detail panel event listeners
    initializeReportDetailPanel();
    
    // Initialize interview live preview panel event listeners
    initializeInterviewLivePreviewPanel();
    initializeBeginInterviewButton();
    
    // Initialize interview modal if in modal mode
    if (INTERVIEW_PREVIEW_MODE === 'modal') {
        initializeInterviewModal();
    }
    
    // Initialize Interview Designer completion handler
    initializeInterviewDesignerCompletionHandler();
    
    // Initialize pricing panel event listeners
    if (window.initializePricingPanel) {
        window.initializePricingPanel();
    }
    
    // Initialize journal/activity feed event listeners
    initializeJournalViewListeners();
    
    // Initialize transcript audio playback
    initializeTranscriptAudioPlayback();
    
    // Initialize missing event listeners
    initializeMissingEventListeners();
    
    // Initialize streaming panel
    if (window.initializeStreamingPanel) {
        window.initializeStreamingPanel();
    }
    
    // Initialize templates panel
    if (window.initializeTemplatesPanel) {
        window.initializeTemplatesPanel();
    }
    
    // Initialize edit preview panel
    if (window.editPreviewPanel) {
        window.editPreviewPanel.initialize();
    }
    
    // Apply panel states from appState
    if (window.applyPanelCollapseStates) {
        window.applyPanelCollapseStates();
    }
    if (window.applyReportDetailPanelState) {
        window.applyReportDetailPanelState();
    }
    if (window.applyInterviewLivePreviewPanelState) {
        window.applyInterviewLivePreviewPanelState();
    }
    if (window.applyUserSettingsPanelState) {
        window.applyUserSettingsPanelState();
    }
    if (window.applyPricingPanelState) {
        window.applyPricingPanelState();
    }
    if (window.applyStreamingPanelState) {
        window.applyStreamingPanelState();
    }
    if (window.applyTemplatesPanelState) {
        window.applyTemplatesPanelState();
    }
    
    // Update specification UI if needed
    if (typeof appState !== 'undefined' && appState.interviewSpec) {
        updateSpecificationUIFromAppState();
    }
});

// Initialize report detail panel event listeners
function initializeReportDetailPanel() {
    const reportDetailPanel = document.getElementById('reportDetailPanel');
    
    reportDetailPanel?.addEventListener('click', function(event) {
        const navButton = event.target.closest('.panel-nav-button');
        if (navButton) {
            const targetId = navButton.getAttribute('data-target');
            if (targetId) {
                appState.setReportDetailPanelTab(targetId);
                if (window.applyReportDetailPanelActiveTab) window.applyReportDetailPanelActiveTab();
            }
        }

        const closeButton = event.target.closest('#closeReportPanelXBtn');
        if (closeButton) {
            appState.setReportDetailPanelOpen(false);
            if (window.applyReportDetailPanelState) window.applyReportDetailPanelState();
        }

        // Event listener for the "Play User Report Audio" button
        const playUserReportAudioBtn = event.target.closest('#playUserReportAudioBtn');
        if (playUserReportAudioBtn) {
            const currentReportId = appState.uiState.reportDetailPanel.currentReportId;
            if (!currentReportId) {
                alert('No report loaded in detail panel.');
                return;
            }
            const audioSrcForThisButton = `/api/reports/${currentReportId}/audio-artifact`;
            const reportContentEl = document.getElementById('reportContent');
            const reportTitleText = reportContentEl?.querySelector('h2')?.textContent || `User Summary: ${currentReportId}`;
            const globalAudioPlayerElement = document.getElementById('globalAudioPlayerElement');

            if (globalAudioPlayerElement && globalAudioPlayerElement.src && globalAudioPlayerElement.src.endsWith(audioSrcForThisButton) && !globalAudioPlayerElement.paused && appState.uiState.globalAudioPlayer.activeTriggerButton === playUserReportAudioBtn) {
                globalAudioPlayerElement.pause();
            } else {
                fetch(audioSrcForThisButton)
                    .then(response => {
                        if (response.ok) return response.blob();
                        throw new Error(`Error fetching user report audio: ${response.status}`);
                    })
                    .then(audioBlob => {
                        const audioUrl = URL.createObjectURL(audioBlob);
                        playOnGlobalPlayer(audioUrl, reportTitleText, 'User-Facing Summary Audio', playUserReportAudioBtn);
                    })
                    .catch(error => {
                        alert(error.message);
                        updateTriggerButtonIcon(playUserReportAudioBtn, false);
                    });
            }
        }

        // Event listener for the "Play Admin Report Audio" button
        const playAdminReportAudioBtn = event.target.closest('#playAdminReportAudioBtn');
        if (playAdminReportAudioBtn) {
            const currentReportId = appState.uiState.reportDetailPanel.currentReportId;
            if (!currentReportId) {
                alert('No report loaded in detail panel.');
                return;
            }
            const audioSrcForAdminButton = `/api/reports/${currentReportId}/audio-artifact?type=admin`;
            const adminReportDisplaySectionEl = document.getElementById('adminReportDisplaySection');
            const adminReportTitleText = adminReportDisplaySectionEl?.querySelector('h2')?.textContent || `Admin Report: ${currentReportId}`;
            const globalAudioPlayerElement = document.getElementById('globalAudioPlayerElement');

            if (globalAudioPlayerElement && globalAudioPlayerElement.src && globalAudioPlayerElement.src.includes(audioSrcForAdminButton) && !globalAudioPlayerElement.paused && appState.uiState.globalAudioPlayer.activeTriggerButton === playAdminReportAudioBtn) {
                globalAudioPlayerElement.pause();
            } else {
                fetch(audioSrcForAdminButton)
                    .then(response => {
                        if (response.ok) return response.blob();
                        throw new Error(`Error fetching admin report audio: ${response.status}`);
                    })
                    .then(audioBlob => {
                        const audioUrl = URL.createObjectURL(audioBlob);
                        playOnGlobalPlayer(audioUrl, adminReportTitleText, 'Admin-Only Report Audio', playAdminReportAudioBtn);
                    })
                    .catch(error => {
                        alert(error.message);
                        updateTriggerButtonIcon(playAdminReportAudioBtn, false);
                    });
            }
        }
        
        // Event listener for the "Regenerate User-Facing Summary" button
        const regenerateUserReportBtn = event.target.closest('#regenerateUserReportBtn');
        if (regenerateUserReportBtn) {
            const currentReportId = appState.uiState.reportDetailPanel.currentReportId;
            if (!currentReportId) {
                alert('No report loaded in detail panel to regenerate.');
                return;
            }
            regenerateUserReport(currentReportId, regenerateUserReportBtn);
        }

        // Event listener for the "Regenerate Admin Report" button
        const regenerateAdminReportBtn = event.target.closest('#regenerateAdminReportBtn');
        if (regenerateAdminReportBtn) {
            const currentReportId = appState.uiState.reportDetailPanel.currentReportId;
            if (!currentReportId) {
                alert('No report loaded in detail panel to regenerate.');
                return;
            }
            regenerateReportAdmin(currentReportId, regenerateAdminReportBtn);
        }

        // Event listener for the "View User-Facing Report" button
        const viewUserReportBtn = event.target.closest('#viewUserReportBtn');
        if (viewUserReportBtn) {
            const currentReportId = appState.uiState.reportDetailPanel.currentReportId;
            if (!currentReportId) {
                alert('No report loaded in detail panel to view.');
                return;
            }
            
            // Open the user-facing report in a new tab
            const reportUrl = `${window.location.origin}/report.html?id=${currentReportId}`;
            window.open(reportUrl, '_blank');
        }
        
        // Event listener for the "Download User Report Audio" button
        const downloadUserReportAudioBtn = event.target.closest('#downloadUserReportAudioBtn');
        if (downloadUserReportAudioBtn) {
            const currentReportId = appState.uiState.reportDetailPanel.currentReportId;
            if (!currentReportId) {
                alert('No report loaded in detail panel.');
                return;
            }
            
            const audioSrc = `/api/reports/${currentReportId}/audio-artifact`;
            const link = document.createElement('a');
            link.href = audioSrc;
            link.download = `user-report-${currentReportId}.mp3`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        // Event listener for the "Download Admin Report Audio" button
        const downloadAdminReportAudioBtn = event.target.closest('#downloadAdminReportAudioBtn');
        if (downloadAdminReportAudioBtn) {
            const currentReportId = appState.uiState.reportDetailPanel.currentReportId;
            if (!currentReportId) {
                alert('No report loaded in detail panel.');
                return;
            }
            
            const audioSrc = `/api/reports/${currentReportId}/audio-artifact?type=admin`;
            const link = document.createElement('a');
            link.href = audioSrc;
            link.download = `admin-report-${currentReportId}.mp3`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    });
}

// Helper function to show/hide interviewer actions
window.setInterviewerActionsVisible = function(visible) {
    const beginInterviewBtn = document.getElementById('beginInterviewBtn');
    
    if (beginInterviewBtn) {
        if (visible) {
            beginInterviewBtn.classList.remove('hidden');
            // Update data-url attribute when showing
            if (window.appState?.selectedInterview) {
                const interviewUrl = `/i/?interview=${window.appState.selectedInterview.id}`;
                beginInterviewBtn.setAttribute('data-url', interviewUrl);
            }
        } else {
            beginInterviewBtn.classList.add('hidden');
            // Clear data-url when hiding
            beginInterviewBtn.removeAttribute('data-url');
        }
    } else {
        console.warn('[setInterviewerActionsVisible] Begin Interview button not found');
    }
};

// Configuration for interview preview display mode
const INTERVIEW_PREVIEW_MODE = 'modal'; // 'panel' or 'modal'
window.INTERVIEW_PREVIEW_MODE = INTERVIEW_PREVIEW_MODE; // Expose to window for other modules

// Initialize begin interview button
function initializeBeginInterviewButton() {
    const beginInterviewBtn = document.getElementById('beginInterviewBtn');
    
    if (beginInterviewBtn) {
        console.log('[initializeBeginInterviewButton] Button found, adding event listener');
        beginInterviewBtn.addEventListener('click', () => {
            const interviewUrlFromButton = beginInterviewBtn.getAttribute('data-url');

            if (interviewUrlFromButton) {
                // Hide report detail panel and its overlay if they are open
                if (appState.uiState.reportDetailPanel.isOpen) {
                    appState.setReportDetailPanelOpen(false);
                    if (window.applyReportDetailPanelState) window.applyReportDetailPanelState();
                }

                // Check if this is the Interview Designer and add design mode flag
                const INTERVIEW_DESIGNER_ID = '5dbb409d-fade-4ece-ae9d-0bfb8ff34097';
                let finalInterviewUrl = interviewUrlFromButton;
                
                // Check if the URL contains the Interview Designer ID
                if (interviewUrlFromButton.includes(INTERVIEW_DESIGNER_ID)) {
                    // Check if we should be in design mode (e.g., from "Design new interview" button)
                    // For now, we'll need to set this flag elsewhere when the design button is clicked
                    if (window._pendingInterviewDesignerFlow) {
                        window._interviewDesignerFlowActive = true;
                        window._pendingInterviewDesignerFlow = false;
                        // Add a parameter to the URL to indicate design mode
                        const separator = interviewUrlFromButton.includes('?') ? '&' : '?';
                        finalInterviewUrl = interviewUrlFromButton + separator + 'designMode=true';
                        console.log('[Interview Designer] Launching in design mode');
                    }
                }
                
                if (INTERVIEW_PREVIEW_MODE === 'modal') {
                    openInterviewModal(finalInterviewUrl);
                } else {
                    appState.setInterviewLivePreviewPanelOpen(true, finalInterviewUrl);
                    if (window.applyInterviewLivePreviewPanelState) window.applyInterviewLivePreviewPanelState();
                }
            } else {
                alert('Interview URL not found. Please load an interview first or ensure the URL is set on the button.');
            }
        });
    } else {
        console.error('[initializeBeginInterviewButton] Begin Interview button not found!');
    }
}

// Initialize interview modal
function initializeInterviewModal() {
    const closeBtn = document.getElementById('closeInterviewModalBtn');
    const refreshBtn = document.getElementById('refreshModalIframeBtn');
    const modalOverlay = document.getElementById('interviewModalOverlay');
    const modalIframe = document.getElementById('modalIframe');
    
    closeBtn?.addEventListener('click', () => {
        closeInterviewModal();
    });
    
    refreshBtn?.addEventListener('click', () => {
        if (modalIframe && modalIframe.src && modalIframe.src !== 'about:blank') {
            modalIframe.src = modalIframe.src;
        }
    });
    
    // Close on overlay click
    modalOverlay?.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeInterviewModal();
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modalOverlay?.classList.contains('hidden')) {
            closeInterviewModal();
        }
    });
}

// Open interview modal
window.openInterviewModal = function openInterviewModal(interviewUrl) {
    const modalOverlay = document.getElementById('interviewModalOverlay');
    const modalIframe = document.getElementById('modalIframe');
    
    if (modalOverlay && modalIframe) {
        modalIframe.src = interviewUrl;
        modalOverlay.classList.remove('hidden');
        
        // Store state for consistency with panel approach
        appState.uiState.interviewLivePreviewPanel.isOpen = true;
        appState.uiState.interviewLivePreviewPanel.iframeSrc = interviewUrl;
    }
}

// Close interview modal
window.closeInterviewModal = function closeInterviewModal() {
    const modalOverlay = document.getElementById('interviewModalOverlay');
    const modalIframe = document.getElementById('modalIframe');
    
    if (modalOverlay && modalIframe) {
        modalOverlay.classList.add('hidden');
        modalIframe.src = 'about:blank';
        
        // Update state
        appState.uiState.interviewLivePreviewPanel.isOpen = false;
        appState.uiState.interviewLivePreviewPanel.iframeSrc = '';
    }
}

// Initialize interview live preview panel event listeners
function initializeInterviewLivePreviewPanel() {
    const refreshLivePreviewFrameBtn = document.getElementById('refreshLivePreviewFrameBtn');
    const closeInterviewLivePreviewPanelBtn = document.getElementById('closeInterviewLivePreviewPanelBtn');
    const livePreviewIframe = document.getElementById('livePreviewIframe');

    refreshLivePreviewFrameBtn?.addEventListener('click', () => {
        if (livePreviewIframe && livePreviewIframe.src && livePreviewIframe.src !== 'about:blank') {
            livePreviewIframe.src = livePreviewIframe.src;
        }
    });

    closeInterviewLivePreviewPanelBtn?.addEventListener('click', () => {
        appState.setInterviewLivePreviewPanelOpen(false);
        if (window.applyInterviewLivePreviewPanelState) window.applyInterviewLivePreviewPanelState();
    });
}

// Function to launch Interview Designer in design mode
window.launchInterviewDesignerForDesign = function() {
    console.log('[Interview Designer] Setting pending design flow flag');
    window._pendingInterviewDesignerFlow = true;
    
    // The actual interview launch will happen through the normal flow
    // but with the pending flag set, it will add designMode=true
};

// Initialize Interview Designer completion handler
function initializeInterviewDesignerCompletionHandler() {
    // TODO: Replace this hardcoded ID with proper template system
    const INTERVIEW_DESIGNER_ID = '5dbb409d-fade-4ece-ae9d-0bfb8ff34097';
    
    // Listen for messages from the interview iframe
    window.addEventListener('message', async (event) => {
        // Verify origin for security
        if (event.origin !== window.location.origin) return;
        
        // Check if this is an interview completion message
        // TODO: The interview iframe needs to send a message like:
        // parent.postMessage({ 
        //     type: 'interviewCompleted', 
        //     interviewId: 'xxx', 
        //     responseId: 'xxx' 
        // }, window.location.origin);
        if (event.data && event.data.type === 'interviewCompleted') {
            // Check if we're in the Interview Designer flow
            if (window._interviewDesignerFlowActive) {
                const completedInterviewId = event.data.interviewId;
                
                // Check if this is the Interview Designer interview
                if (completedInterviewId === INTERVIEW_DESIGNER_ID) {
                    console.log('[Interview Designer] Interview completed, auto-forking...');
                    
                    // Reset the flag
                    window._interviewDesignerFlowActive = false;
                    
                    // Close the interview preview panel or modal
                    if (INTERVIEW_PREVIEW_MODE === 'modal') {
                        closeInterviewModal();
                    } else {
                        appState.setInterviewLivePreviewPanelOpen(false);
                        if (window.applyInterviewLivePreviewPanelState) window.applyInterviewLivePreviewPanelState();
                    }
                    
                    // Get the response ID for the completed interview
                    const responseId = event.data.responseId;
                    
                    if (responseId) {
                        // Automatically trigger the fork flow
                        // Wait a moment for the response to be saved
                        setTimeout(async () => {
                            // Use the response directly without showing the selection panel
                            if (window.createInterviewFromSingleResponse) {
                                // Create interview from the just-completed response
                                await window.createInterviewFromSingleResponse(responseId, 'Interview Designer Response');
                                
                                // Wait for the file preview to update
                                setTimeout(() => {
                                    // Set the prompt in the input
                                    const copilotInput = document.getElementById('copilotInput');
                                    if (copilotInput) {
                                        // Use the specific Interview Designer completion prompt
                                        copilotInput.value = "Based on the responses from the Interview Designer, create the exact interview that was described. Pay careful attention to the goals, audience, tone, and any specific requirements mentioned.";
                                        
                                        // Clear prompt cards and send message
                                        setTimeout(() => {
                                            const copilotMessagesEl = document.getElementById('copilotMessages');
                                            if (copilotMessagesEl) {
                                                copilotMessagesEl.innerHTML = '';
                                            }
                                            const sendButton = document.getElementById('sendCopilotMessage');
                                            if (sendButton) sendButton.click();
                                        }, 200);
                                    }
                                }, 500);
                            }
                        }, 1000); // Give time for response to be saved
                    }
                }
            }
        }
    });
}

// Initialize transcript audio playback
function initializeTranscriptAudioPlayback() {
    const interviewContentBody = document.getElementById('interviewContentBody');
    
    interviewContentBody?.addEventListener('click', function(event) {
        const targetButton = event.target.closest('.play-transcript-item-audio-btn');
        if (targetButton) {
            const audioUrl = targetButton.dataset.audioUrl;
            const trackTitle = targetButton.dataset.trackTitle;
            const trackArtist = targetButton.dataset.trackArtist;
            const globalAudioPlayerElement = document.getElementById('globalAudioPlayerElement');

            if (audioUrl) {
                if (globalAudioPlayerElement && globalAudioPlayerElement.src === audioUrl && !globalAudioPlayerElement.paused && appState.uiState.globalAudioPlayer.activeTriggerButton === targetButton) {
                    globalAudioPlayerElement.pause();
                } else {
                    playOnGlobalPlayer(audioUrl, trackTitle, trackArtist, targetButton);
                }
            }
        }
    });
}

// Initialize journal view event listeners
function initializeJournalViewListeners() {
    // Interview Feed Button
    const myActivityBtn = document.getElementById('myActivityBtn');
    if (myActivityBtn) {
        myActivityBtn.addEventListener('click', function() {
            console.log('[admin.js] Interview Feed button clicked');
            showJournalView();
        });
    }

    // Templates Button
    const templatesBtn = document.getElementById('templatesBtn');
    if (templatesBtn) {
        templatesBtn.addEventListener('click', function() {
            console.log('[admin.js] Templates button clicked');
            window.location.hash = 'templates';
        });
    }

    // Event delegation for Journal View - View Details buttons
    const activityFeedDisplayArea = document.getElementById('activityFeedDisplayArea');
    if (activityFeedDisplayArea) {
        activityFeedDisplayArea.addEventListener('click', function(event) {
            const target = event.target;
            
            // Handle View Details button click
            const viewDetailsBtn = target.closest('.view-journal-details-btn');
            if (viewDetailsBtn) {
                const reportId = viewDetailsBtn.getAttribute('data-report-id');
                console.log('[admin.js] View Details button clicked for report:', reportId);
                if (reportId) {
                    appState.setReportDetailPanelOpen(true, reportId);
                    appState.setReportDetailPanelTab('interviewContent');
                    if (window.applyReportDetailPanelState) window.applyReportDetailPanelState();
                    showReportDetails(reportId);
                }
                return;
            }
            
            // Handle Play Audio button click
            const playAudioBtn = target.closest('.play-journal-audio-btn');
            if (playAudioBtn) {
                const reportId = playAudioBtn.getAttribute('data-report-id');
                console.log('[admin.js] Play Audio button clicked for report:', reportId);
                
                if (!reportId) {
                    alert('No report ID found for this audio.');
                    return;
                }
                
                const audioSrc = `/api/reports/${reportId}/audio-artifact`;
                const trackTitle = `Journal Entry ${reportId}`;
                const globalAudioPlayerElement = document.getElementById('globalAudioPlayerElement');
                
                // Check if already playing this audio
                if (globalAudioPlayerElement && globalAudioPlayerElement.src && globalAudioPlayerElement.src.endsWith(audioSrc) && !globalAudioPlayerElement.paused && appState.uiState.globalAudioPlayer.activeTriggerButton === playAudioBtn) {
                    globalAudioPlayerElement.pause();
                } else {
                    // Fetch and play the audio
                    fetch(audioSrc)
                        .then(response => {
                            if (response.ok) return response.blob();
                            throw new Error(`Error fetching journal audio: ${response.status}`);
                        })
                        .then(audioBlob => {
                            const audioUrl = URL.createObjectURL(audioBlob);
                            playOnGlobalPlayer(audioUrl, trackTitle, 'Journal Entry Audio', playAudioBtn);
                        })
                        .catch(error => {
                            alert(error.message);
                            updateTriggerButtonIcon(playAudioBtn, false);
                        });
                }
                return;
            }
        });
    }
}

// Initialize missing event listeners
function initializeMissingEventListeners() {
    // Add event listener for Share URL button
    const shareUrlBtn = document.getElementById('shareUrlBtn');
    if (shareUrlBtn) {
        shareUrlBtn.addEventListener('click', function() {
            const shareUrl = shareUrlBtn.getAttribute('data-share-url');
            if (shareUrl) {
                // Use navigator.clipboard directly with proper feedback
                navigator.clipboard.writeText(shareUrl)
                    .then(() => {
                        // Provide visual feedback
                        const originalText = shareUrlBtn.innerHTML;
                        shareUrlBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                        </svg>Copied!`;
                        shareUrlBtn.classList.add('text-green-400');
                        shareUrlBtn.classList.remove('text-gray-400');
                        
                        // Reset button after 2 seconds
                        setTimeout(() => {
                            shareUrlBtn.innerHTML = originalText;
                            shareUrlBtn.classList.remove('text-green-400');
                            shareUrlBtn.classList.add('text-gray-400');
                        }, 2000);
                    })
                    .catch(err => {
                        console.error('Failed to copy URL:', err);
                        
                        // Fallback for older browsers
                        try {
                            const textarea = document.createElement('textarea');
                            textarea.value = shareUrl;
                            textarea.style.position = 'fixed';
                            textarea.style.opacity = '0';
                            document.body.appendChild(textarea);
                            textarea.select();
                            const successful = document.execCommand('copy');
                            document.body.removeChild(textarea);
                            
                            if (successful) {
                                const originalText = shareUrlBtn.innerHTML;
                                shareUrlBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                                </svg>Copied!`;
                                shareUrlBtn.classList.add('text-green-400');
                                shareUrlBtn.classList.remove('text-gray-400');
                                
                                setTimeout(() => {
                                    shareUrlBtn.innerHTML = originalText;
                                    shareUrlBtn.classList.remove('text-green-400');
                                    shareUrlBtn.classList.add('text-gray-400');
                                }, 2000);
                            } else {
                                alert('Failed to copy URL to clipboard');
                            }
                        } catch (fallbackErr) {
                            console.error('Fallback copy failed:', fallbackErr);
                            alert('Failed to copy URL to clipboard');
                        }
                    });
            } else {
                alert('No interview URL available to copy. Please ensure an interview is loaded.');
            }
        });
    }
    
    // Event delegation for Responses Tab - View Details and Summary buttons
    const responsesListContainer = document.getElementById('responsesListContainer');
    if (responsesListContainer) {
        responsesListContainer.addEventListener('click', function(event) {
            const target = event.target;
            
            // Handle View Details button click in responses tab
            const viewDetailsBtn = target.closest('.view-responses-tab-details-btn');
            if (viewDetailsBtn) {
                const reportId = viewDetailsBtn.getAttribute('data-report-id');
                console.log('[admin.js] Responses Tab - View Details button clicked for report:', reportId);
                if (reportId) {
                    appState.setReportDetailPanelOpen(true, reportId);
                    appState.setReportDetailPanelTab('interviewContent');
                    if (window.applyReportDetailPanelState) window.applyReportDetailPanelState();
                    showReportDetails(reportId);
                }
                return;
            }
            
            // Handle Summary button click in responses tab
            const summaryBtn = target.closest('.view-summary-btn');
            if (summaryBtn) {
                const reportId = summaryBtn.getAttribute('data-report-id');
                console.log('[admin.js] Responses Tab - Summary button clicked for report:', reportId);
                if (reportId) {
                    appState.setReportDetailPanelOpen(true, reportId);
                    appState.setReportDetailPanelTab('reportContent'); // Show report tab
                    if (window.applyReportDetailPanelState) window.applyReportDetailPanelState();
                    showReportDetails(reportId);
                }
                return;
            }
        });
    }
    
    // Add delegated event listener for audio quote play buttons
    console.log('[admin.js] Adding audio play button click listener...');
    document.addEventListener('click', async function(e) {
        console.log('[Audio Click Event] Clicked element:', e.target);
        console.log('[Audio Click Event] Element classes:', e.target.className);
        console.log('[Audio Click Event] Closest .audio-quote-play-btn:', e.target.closest('.audio-quote-play-btn'));
        
        // Handle clicks on audio summary buttons
        if (e.target.closest('.create-audio-summary')) {
            console.log('[Audio Summary Button] Click detected in admin.js!');
            e.preventDefault();
            const messageElement = e.target.closest('.message');
            console.log('[Audio Summary Button] Message element:', messageElement);
            if (messageElement) {
                await handleCreateAudioSummary(messageElement);
            } else {
                console.error('[Audio Summary Button] Could not find parent message element');
            }
        }
        
        // Handle clicks on video summary buttons
        if (e.target.closest('.create-video-summary')) {
            console.log('[Video Summary Button] Click detected in admin.js!');
            e.preventDefault();
            e.stopPropagation();
            const messageElement = e.target.closest('.message');
            console.log('[Video Summary Button] Message element:', messageElement);
            if (messageElement) {
                await handleCreateVideoSummary(messageElement);
            } else {
                console.error('[Video Summary Button] Could not find parent message element');
            }
        }
        
        // Handle clicks on audio quote play buttons
        if (e.target.closest('.audio-quote-play-btn')) {
            console.log('[Audio Play Button] Click detected in admin.js!');
            e.preventDefault();
            const button = e.target.closest('.audio-quote-play-btn');
            console.log('[Audio Play Button] Button element:', button);
            const blockquote = button.closest('blockquote[data-audio-id]');
            console.log('[Audio Play Button] Blockquote element:', blockquote);
            const audioId = blockquote ? blockquote.getAttribute('data-audio-id') : null;
            console.log('[Audio Play Button] Audio ID:', audioId);
            if (audioId) {
                console.log('[Audio Play Button] Calling playAudioClip...');
                await playAudioClipFromAnalyst(audioId, blockquote, button);
            } else {
                console.error('[Audio Play Button] No audio ID found!');
            }
        }
        
        // Handle clicks on audio citations
        if (e.target.closest('.audio-citation')) {
            console.log('[Audio Citation] Click detected in admin.js!');
            e.preventDefault();
            const citation = e.target.closest('.audio-citation');
            const audioId = citation.getAttribute('data-audio-id');
            console.log('[Audio Citation] Audio ID:', audioId);
            if (audioId) {
                console.log('[Audio Citation] Calling playAudioClipFromAnalyst...');
                await playAudioClipFromAnalyst(audioId, citation, null);
            } else {
                console.error('[Audio Citation] No audio ID found!');
            }
        }
    });
}

// Play individual audio clip from analyst view
async function playAudioClipFromAnalyst(audioId, element, button) {
    console.log('[playAudioClipFromAnalyst] Attempting to play audio clip with ID:', audioId);
    try {
        // Show loading state if button exists
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="loading-spinner"></span>';
        }
        
        // Fetch the audio URL and trimming info for this clip with timeout
        console.log('[playAudioClipFromAnalyst] Fetching from:', `/api/audio-clip/${audioId}?trimmed=true`);
        
        // Create a timeout promise (30 seconds for searching through many reports)
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout after 30 seconds')), 30000);
        });
        
        // Race between fetch and timeout
        const response = await Promise.race([
            fetch(`/api/audio-clip/${audioId}?trimmed=true`),
            timeoutPromise
        ]);
        
        console.log('[playAudioClipFromAnalyst] API response status:', response.status);
        if (!response.ok) {
            const errorData = await response.json();
            console.error('[playAudioClipFromAnalyst] API error:', errorData);
            console.error('[playAudioClipFromAnalyst] Error message:', errorData.message);
            console.error('[playAudioClipFromAnalyst] Error details:', errorData.details);
            throw new Error(errorData.message || 'Failed to fetch audio clip');
        }
        
        const { audioUrl, trimmedUrl, text } = await response.json();
        console.log('[playAudioClipFromAnalyst] Received URLs:', { audioUrl: audioUrl ? 'present' : 'missing', trimmedUrl: trimmedUrl ? 'present' : 'missing' });
        
        // Check if global audio player is playing this same clip
        const globalAudioElement = document.getElementById('globalAudioPlayerElement');
        const currentGlobalSrc = globalAudioElement ? globalAudioElement.src : null;
        const newAudioSrc = trimmedUrl || audioUrl;
        
        if (currentGlobalSrc === newAudioSrc && globalAudioElement && !globalAudioElement.paused) {
            // Same audio is already playing in global player - just pause it
            globalAudioElement.pause();
            blockquote.classList.remove('playing');
            button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
            button.disabled = false;
            return;
        }
        
        // Reset any other playing blockquotes
        document.querySelectorAll('.audio-quote.playing').forEach(el => {
            el.classList.remove('playing');
            const btn = el.querySelector('.audio-quote-play-btn');
            if (btn) {
                btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
                btn.disabled = false;
            }
        });
        // Reset any playing citations
        document.querySelectorAll('.audio-citation.playing').forEach(el => {
            el.classList.remove('playing');
        });
        
        // Add visual feedback
        element.classList.add('playing');
        if (button) {
            button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
            button.disabled = false;
        }
        
        // Extract quote text for display
        const quoteText = element.querySelector('.audio-quote-content')?.textContent || element.textContent || text || 'Audio Clip';
        const title = quoteText.length > 50 ? quoteText.substring(0, 50) + '...' : quoteText;
        
        // Play on global audio player
        if (window.playOnGlobalPlayer) {
            await window.playOnGlobalPlayer(
                newAudioSrc,
                title,
                'Interview Response',
                button
            );
            
            // Set up listener for when audio ends
            if (globalAudioElement) {
                // Remove any existing ended listener
                globalAudioElement.onended = null;
                
                // Add new ended listener
                globalAudioElement.addEventListener('ended', function onAudioEnded() {
                    element.classList.remove('playing');
                    if (button) {
                        button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
                    }
                    // Remove this listener
                    globalAudioElement.removeEventListener('ended', onAudioEnded);
                }, { once: true });
                
                // Also listen for pause events
                globalAudioElement.addEventListener('pause', function onAudioPause() {
                    // Only update if this is still the same audio
                    if (globalAudioElement.src === newAudioSrc) {
                        element.classList.remove('playing');
                        if (button) {
                            button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
                        }
                    }
                    globalAudioElement.removeEventListener('pause', onAudioPause);
                }, { once: true });
            }
        } else {
            console.error('[playAudioClipFromAnalyst] Global audio player not available');
            throw new Error('Global audio player not available');
        }
        
    } catch (error) {
        console.error('[playAudioClipFromAnalyst] Error playing audio clip:', error);
        console.error('[playAudioClipFromAnalyst] Error details:', {
            message: error.message,
            stack: error.stack,
            audioId: audioId
        });
        if (button) {
            button.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
            button.disabled = false;
        }
        
        // Reset playing state on element
        element.classList.remove('playing');
        
        alert(`Failed to play audio clip: ${error.message}`);
    }
}

// Handle creating audio summary from analyst message
async function handleCreateAudioSummary(messageElement) {
    console.log('[handleCreateAudioSummary] Creating audio summary for message:', messageElement);
    
    try {
        // Get the message content
        const messageContent = messageElement.querySelector('.message-content');
        if (!messageContent) {
            console.error('[handleCreateAudioSummary] No message content found');
            return;
        }
        
        // Get the full message HTML content
        const fullContent = messageContent.innerHTML;
        console.log('[handleCreateAudioSummary] Message content length:', fullContent.length);
        
        // Show loading state
        const button = messageElement.querySelector('.create-audio-summary');
        const originalText = button.innerHTML;
        button.innerHTML = '<span class="loading-spinner"></span> Creating...';
        button.disabled = true;
        
        // Get current interview ID from state
        const interviewId = window.currentEditingInterviewId || window.appState?.currentEditingInterviewId;
        const threadId = window.currentAnalystThreadId || window.appState?.currentAnalystThreadId;
        
        console.log('[handleCreateAudioSummary] Interview ID:', interviewId, 'Thread ID:', threadId);
        
        // Use the new analyst message audio endpoint
        const response = await fetch('/api/analyst/create-message-audio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messageContent: fullContent,
                interviewId: interviewId,
                threadId: threadId
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create audio summary');
        }
        
        const result = await response.json();
        console.log('[handleCreateAudioSummary] Audio created successfully:', result);
        
        // Show success and add link to the message
        button.innerHTML = originalText;
        button.disabled = false;
        
        // Add a link to the audio summary
        const audioLink = document.createElement('a');
        audioLink.href = result.audioUrl;
        audioLink.target = '_blank';
        audioLink.className = 'audio-summary-link';
        audioLink.innerHTML = '🎧 Listen to Audio Summary';
        messageElement.querySelector('.message-actions').appendChild(audioLink);
        
        // Show success message
        const successMsg = document.createElement('div');
        successMsg.className = 'success-message fade-in';
        successMsg.textContent = 'Audio created successfully!';
        messageElement.appendChild(successMsg);
        
        setTimeout(() => successMsg.remove(), 3000);
        
    } catch (error) {
        console.error('[handleCreateAudioSummary] Error creating audio summary:', error);
        alert('Failed to create audio summary: ' + error.message);
        
        // Reset button state
        const button = messageElement.querySelector('.create-audio-summary');
        if (button) {
            button.innerHTML = button.innerHTML.replace('<span class="loading-spinner"></span> Creating...', 'Audio Summary');
            button.disabled = false;
        }
    }
}

// Handle creating video summary from analyst message
async function handleCreateVideoSummary(messageElement) {
    console.log('[handleCreateVideoSummary] Creating video summary for message:', messageElement);
    
    try {
        // Get the button and original text first
        const button = messageElement.querySelector('.create-video-summary');
        const originalText = button ? button.innerHTML : 'Video Summary';
        
        // Get the message content
        const messageContent = messageElement.querySelector('.message-content');
        if (!messageContent) {
            console.error('[handleCreateVideoSummary] No message content found');
            return;
        }

        // Check if message content is empty or only has the user's prompt
        const contentText = messageContent.textContent.trim();
        if (!contentText || contentText.length < 100) {
            console.error('[handleCreateVideoSummary] Message content is empty or too short:', contentText.length);
            alert('This message doesn\'t have any content to create a video from. Please try a different message.');
            if (button) {
                button.innerHTML = originalText;
                button.disabled = false;
            }
            return;
        }

        // Check if audio clips are properly rendered with data-audio-id
        const audioQuotes = messageContent.querySelectorAll('blockquote.audio-quote[data-audio-id]');
        const plainBlockquotes = messageContent.querySelectorAll('blockquote:not([data-audio-id])');
        const citations = messageContent.querySelectorAll('.audio-citation[data-audio-id]');

        console.log('[handleCreateVideoSummary] Audio quotes with IDs:', audioQuotes.length);
        console.log('[handleCreateVideoSummary] Plain blockquotes without IDs:', plainBlockquotes.length);
        console.log('[handleCreateVideoSummary] Citations with IDs:', citations.length);

        // Check if we have NO audio references at all
        if (audioQuotes.length === 0 && citations.length === 0) {
            console.error('[handleCreateVideoSummary] No audio quotes or citations found in message');
            alert('This message doesn\'t contain any audio clips or citations. Please select a message from the AI with audio references.');
            if (button) {
                button.innerHTML = originalText;
                button.disabled = false;
            }
            return;
        }

        if (plainBlockquotes.length > 0 && audioQuotes.length === 0 && citations.length === 0) {
            // Audio clips haven't been rendered yet
            alert('Audio clips are still loading. Please wait a moment and try again, or refresh the page first.');
            if (button) {
                button.innerHTML = originalText;
                button.disabled = false;
            }
            return;
        }
        
        // Get the full message HTML content
        const fullContent = messageContent.innerHTML;
        console.log('[handleCreateVideoSummary] Message content length:', fullContent.length);
        console.log('[handleCreateVideoSummary] Full HTML content being sent:', fullContent);
        
        // Show loading state
        if (button) {
            button.innerHTML = '<span class="loading-spinner"></span> Creating Video...';
            button.disabled = true;
        }
        
        // Get current interview ID from state
        const interviewId = window.currentEditingInterviewId || window.appState?.currentEditingInterviewId;
        const threadId = window.currentAnalystThreadId || window.appState?.currentAnalystThreadId;
        
        // Get the current user ID - check multiple sources
        const userId = auth.currentUser?.uid || window.currentUserId || window.appState?.userId;
        
        if (!userId) {
            console.error('[handleCreateVideoSummary] No user ID available');
            if (button) {
                button.innerHTML = originalText;
                button.disabled = false;
            }
            alert('Please sign in to create video summaries');
            return;
        }
        
        console.log('[handleCreateVideoSummary] Interview ID:', interviewId, 'Thread ID:', threadId, 'User ID:', userId);
        
        // Show b-roll prompt review modal
        const brollPrompts = await window.showBrollPromptReview(fullContent, messageElement, button, originalText);
        
        if (!brollPrompts) {
            // User cancelled
            button.innerHTML = originalText;
            button.disabled = false;
            return;
        }
        
        // Use the new analyst message video endpoint with b-roll prompts
        const response = await fetch('/api/analyst/create-message-video', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messageContent: fullContent,
                brollPrompts: brollPrompts,
                interviewId: interviewId,
                threadId: threadId,
                userId: userId
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create video summary');
        }
        
        const result = await response.json();
        console.log('[handleCreateVideoSummary] Video created successfully:', result);
        
        // Reset button state
        if (button) {
            button.innerHTML = originalText;
            button.disabled = false;
        }
        
        // Check if video was queued or completed
        if (result.status === 'queued' || result.status === 'processing') {
            // Show processing message
            const processingMsg = document.createElement('div');
            processingMsg.className = 'info-message fade-in';
            processingMsg.innerHTML = '🎬 Video generation started! Check the Content tab in a few minutes.';
            messageElement.appendChild(processingMsg);
            
            setTimeout(() => processingMsg.remove(), 5000);
            
            // Remove the button and show processing status
            if (button) {
                button.style.display = 'none';
                const statusSpan = document.createElement('span');
                statusSpan.className = 'video-processing-status';
                statusSpan.innerHTML = '⏳ Video processing...';
                if (button.parentElement) {
                    button.parentElement.appendChild(statusSpan);
                }
            }
        } else if (result.status === 'completed' && result.message === 'Video already exists') {
            // Video already exists
            const existingMsg = document.createElement('div');
            existingMsg.className = 'info-message fade-in';
            existingMsg.innerHTML = '✅ Video already created! Check the Content tab.';
            messageElement.appendChild(existingMsg);
            
            setTimeout(() => existingMsg.remove(), 5000);
            
            // Update button to show completed state
            if (button) {
                button.innerHTML = '✅ Video ready';
                button.disabled = true;
            }
            
            // Refresh content tab if it's active
            if (window.isContentTabActive && window.isContentTabActive()) {
                if (window.fetchAndDisplayContent) {
                    window.fetchAndDisplayContent(window.currentEditingInterviewId || window.appState?.currentEditingInterviewId);
                }
            }
            
        } else if (result.videoUrl) {
            // Video was generated synchronously (old behavior)
            // Add a link to the video summary
            const videoLink = document.createElement('a');
            videoLink.href = result.videoUrl;
            videoLink.target = '_blank';
            videoLink.className = 'video-summary-link';
            videoLink.innerHTML = '🎬 Watch Video Summary';
            messageElement.querySelector('.message-actions').appendChild(videoLink);
            
            // Show success message
            const successMsg = document.createElement('div');
            successMsg.className = 'success-message fade-in';
            successMsg.textContent = 'Video created successfully!';
            messageElement.appendChild(successMsg);
            
            setTimeout(() => successMsg.remove(), 3000);
        }
        
    } catch (error) {
        console.error('[handleCreateVideoSummary] Error creating video summary:', error);
        alert('Failed to create video summary: ' + error.message);
        
        // Reset button state
        if (button) {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }
}

// Listen for video generation completion events
if (window.socket) {
    window.socket.on('reportVideoGenerationSuccess', (data) => {
        console.log('[admin] Video generation completed:', data);
        
        // Update the processing status in analyst messages
        const processingButtons = document.querySelectorAll('.video-processing-status');
        processingButtons.forEach(status => {
            // Replace with completed message
            status.innerHTML = '✅ Video ready';
            status.className = 'video-completed-status text-green-400';
        });
        
        // Refresh content tab if it's active
        if (window.isContentTabActive && window.isContentTabActive()) {
            if (window.fetchAndDisplayContent) {
                window.fetchAndDisplayContent(window.currentEditingInterviewId || window.appState?.currentEditingInterviewId);
            }
        }
    });
    
    window.socket.on('reportVideoGenerationError', (data) => {
        console.error('[admin] Video generation failed:', data);
        
        // Update the processing status to show error
        const processingButtons = document.querySelectorAll('.video-processing-status');
        processingButtons.forEach(status => {
            status.innerHTML = '❌ Video failed';
            status.className = 'video-failed-status text-red-400';
        });
    });
} 