// Tab Navigation Manager
import { reportState } from './report-state.js';
import { loadTranscriptContent } from './transcript-manager.js';

// Navigation between tabs
export function activateReportTab(targetId) {
    console.log('[Tab Activation] Activating tab:', targetId);
    const navContainer = document.getElementById('reportDetailNav');
    if (!navContainer) {
        console.error('[Tab Activation] Navigation container not found');
        return false;
    }
    
    const navButtons = navContainer.querySelectorAll('.report-nav-button');
    const contentWrapper = document.getElementById('reportContentWrapper');
    if (!contentWrapper) {
        console.error('[Tab Activation] Content wrapper not found');
        return false;
    }
    
    const contentSections = contentWrapper.querySelectorAll('.report-content-section');
    console.log('[Tab Activation] Found nav buttons:', navButtons.length, 'content sections:', contentSections.length);

    // Update navigation buttons
    let activeButtonFound = false;
    navButtons.forEach(btn => {
        if (btn.getAttribute('data-target') === targetId) {
            btn.classList.add('active');
            activeButtonFound = true;
            console.log('[Tab Activation] Activated button for:', targetId);
        } else {
            btn.classList.remove('active');
        }
    });

    // Update content sections
    let targetSectionFound = false;
    contentSections.forEach(section => {
        if (section.id === targetId) {
            section.classList.remove('hidden');
            targetSectionFound = true;
            console.log('[Tab Activation] Showed section:', targetId);
            
            // Special handling for transcript tab to ensure content is visible
            if (targetId === 'transcriptContentArea') {
                const transcriptContent = section.querySelector('#transcriptContent');
                if (transcriptContent) {
                    console.log('[Tab Activation] Transcript content found, checking if populated...');
                    const hasContent = transcriptContent.innerHTML.trim() !== '' && 
                                     !transcriptContent.innerHTML.includes('Loading transcript...');
                    console.log('[Tab Activation] Transcript has content:', hasContent);
                    
                    if (!hasContent && reportState.currentReportId) {
                        console.log('[Tab Activation] Transcript appears empty, attempting to reload...');
                        // Reload transcript content if it appears to be missing
                        loadTranscriptContent(reportState.currentReportId);
                    }
                }
            }
        } else {
            section.classList.add('hidden');
        }
    });

    if (!activeButtonFound) {
        console.warn('[Tab Activation] No button found for target:', targetId);
    }
    if (!targetSectionFound) {
        console.warn('[Tab Activation] No section found for target:', targetId);
    }

    return activeButtonFound && targetSectionFound;
}

// Initialize tab navigation
export function initializeTabNavigation() {
    // Tab navigation is handled via click events in the main click handler
    console.log('[Tab Navigation] Initialized');
}