// Main entry point for report page
import { reportState } from './report-state.js';
import { initializeTheme } from './theme-manager.js';
import { verifyInitialization, initializeWithInterviewData } from './report-utils.js';
import { initializeSocketConnection } from './socket-manager.js';
import { initializeGlobalAudioPlayer } from './audio-manager.js';
import { initializeMobileNavigation } from './mobile-nav.js';
import { activateReportTab } from './tab-manager.js';
import { loadTranscriptContent } from './transcript-manager.js';
import { initializeCopyMarkdown, initializeReportRegeneration, initializeLikeReport, initializePublishToGallery, triggerReportRegeneration, initializeWatchVideoReport } from './report-actions.js';
import { loadReportFromAPI } from './report-loader.js';
import { initializeMainClickHandler } from './main-click-handler.js';
import './debug-audio.js'; // Import debug utilities

// Main initialization
document.addEventListener('DOMContentLoaded', async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const reportIdFromUrl = urlParams.get('id');
    const interviewIdFromUrl = urlParams.get('interview');
    const publicReportIdFromUrl = urlParams.get('publicId');
    const shouldRegenerate = urlParams.get('regenerate') === 'true';

    console.log("[DOMContentLoaded] Page loaded. reportIdFromUrl:", reportIdFromUrl, "interviewIdFromUrl:", interviewIdFromUrl, "publicReportIdFromUrl:", publicReportIdFromUrl, "shouldRegenerate:", shouldRegenerate);

    // Initialize theme
    initializeTheme();

    // Verify initialization
    if (!verifyInitialization()) {
        console.error('[DOMContentLoaded] Initialization verification failed');
        return;
    }

    // Reset audio generation state on page load
    appState.resetReportAudioGeneration();

    // Ensure body overflow is reset on page load (fix mobile scrolling issues)
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.height = '';
    document.body.style.width = '';
    
    // Additional mobile scrolling fixes
    if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        console.log('Mobile device detected, applying mobile scrolling fixes');
        document.body.style.webkitOverflowScrolling = 'touch';
        document.documentElement.style.webkitOverflowScrolling = 'touch';
        
        // Prevent iOS zoom on input focus
        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
        }

        // Additional mobile touch fixes
        document.addEventListener('touchstart', function() {}, { passive: true });
        
        // Ensure clicks work on all interactive elements
        const interactiveElements = document.querySelectorAll('button, a, [role="button"], .report-nav-button, .primary-button');
        interactiveElements.forEach(element => {
            element.style.cursor = 'pointer';
            element.addEventListener('touchstart', function() {
                // This ensures touch events are properly handled
            }, { passive: true });
        });
    }

    // Get DOM elements
    const regenerateReportButton = document.getElementById('regenerateReportButton');

    // Initialize mobile navigation
    initializeMobileNavigation();

    // Initialize state from URL or localStorage
    const storedPersistentReportId = localStorage.getItem('currentPersistentReportId');

    if (reportIdFromUrl) {
        console.log("[DOMContentLoaded] Using reportId from URL:", reportIdFromUrl);
        reportState.setCurrentReportId(reportIdFromUrl);
    } else if (interviewIdFromUrl) {
        console.log("[DOMContentLoaded] Using interviewId from URL:", interviewIdFromUrl);
        reportState.setCurrentInterviewId(interviewIdFromUrl);
    } else if (storedPersistentReportId) {
        console.log("[DOMContentLoaded] Using reportId from localStorage:", storedPersistentReportId);
        reportState.setCurrentReportId(storedPersistentReportId);
    }

    if (reportState.currentReportId) {
        console.log("[DOMContentLoaded] currentReportId initialized to:", reportState.currentReportId);
    } else {
        console.log("[DOMContentLoaded] currentReportId is initially null.");
    }

    // Load report based on URL parameters
    if (publicReportIdFromUrl) {
        // Load public report from gallery
        await loadReportFromAPI(null, null, publicReportIdFromUrl);
    } else if (reportIdFromUrl || interviewIdFromUrl) {
        await loadReportFromAPI(reportIdFromUrl, interviewIdFromUrl);
    } else {
        // No reportId or interviewId in URL, proceed with original flow (interactive interview)
        console.log("No Report ID or Interview ID in URL, proceeding with interactive/socket flow.");
        
        // Check if we have a session ID in localStorage that indicates we're coming from an interview
        const sessionId = localStorage.getItem('archiveSessionId');
        console.log('[Report Main] No URL params but sessionId in localStorage:', sessionId);
        
        await initializeWithInterviewData(interviewIdFromUrl);
        initializeSocketConnection(reportState.reportLoadedViaApi, regenerateReportButton);
        activateReportTab('reportContent'); // Activate default tab for non-API loads too initially
    }
    
    // Always initialize socket connection for regeneration functionality, even if report was loaded via API
    if (reportState.reportLoadedViaApi && !window.reportSocket) {
        console.log("Report loaded via API, but initializing socket for regeneration functionality.");
        initializeSocketConnection(true, regenerateReportButton);
    }

    // Initialize report actions
    initializeCopyMarkdown();
    initializeReportRegeneration();
    initializeWatchVideoReport();
    initializeLikeReport();
    initializePublishToGallery();
    // initializeEllipsisMenu(); // No longer needed - buttons are in main bar

    // Initialize global audio player
    initializeGlobalAudioPlayer();

    // Initialize main click handler
    initializeMainClickHandler();

    // Check if we should regenerate the report after loading
    if (shouldRegenerate && reportState.currentReportId) {
        console.log('[Report Main] Regenerate parameter detected, triggering regeneration...');
        // Give a small delay to ensure socket is connected and everything is initialized
        setTimeout(() => {
            triggerReportRegeneration();
        }, 1000);
    }

    // Final verification that everything is working
    setTimeout(() => {
        console.log('[Final Verification] Checking page state...');
        console.log('[Final Verification] Report ID:', reportState.currentReportId);
        console.log('[Final Verification] Current active tab:', document.querySelector('.report-nav-button.active')?.getAttribute('data-target'));
        
        // Verify transcript content is loaded
        const transcriptContent = document.getElementById('transcriptContent');
        if (transcriptContent && reportState.currentReportId) {
            const hasContent = transcriptContent.innerHTML.trim() !== '' && 
                             !transcriptContent.innerHTML.includes('Loading transcript...');
            console.log('[Final Verification] Transcript content loaded:', hasContent);
            
            if (!hasContent) {
                console.log('[Final Verification] Transcript content missing, loading now...');
                loadTranscriptContent(reportState.currentReportId);
            }
        }
        
        // Ensure tab navigation is working
        const tabButtons = document.querySelectorAll('.report-nav-button');
        tabButtons.forEach(btn => {
            if (!btn.onclick && !btn.hasAttribute('data-click-attached')) {
                console.log('[Final Verification] Adding backup click handler to tab button');
                btn.setAttribute('data-click-attached', 'true');
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const targetId = btn.getAttribute('data-target');
                    console.log('[Backup Handler] Tab clicked:', targetId);
                    activateReportTab(targetId);
                });
            }
        });
        
        console.log('[Final Verification] Page initialization complete');
    }, 1000);
});