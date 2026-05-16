// Report Loader - handles loading reports from API
import { reportState } from './report-state.js';
import { formatMagazineContent } from './report-content-formatter.js';
import { checkAndUpdateVideoButtonState } from './audio-manager.js';
import { updateHeaderWithUserName, initializeWithInterviewData } from './report-utils.js';
import { activateReportTab } from './tab-manager.js';
import { loadTranscriptContent } from './transcript-manager.js';
import { initializeSocketConnection } from './socket-manager.js';

// Check if interview allows gallery publishing
async function checkGalleryPermission(interviewId) {
    const publishButton = document.getElementById('publishToGalleryButton');
    console.log('[checkGalleryPermission] Starting check for interview:', interviewId);
    console.log('[checkGalleryPermission] Publish button found:', !!publishButton);
    
    if (!publishButton) return;
    
    try {
        // Query the interview document to check allowPublicGallery setting
        const db = firebase.firestore();
        const interviewDoc = await db.collection('interviews').doc(interviewId).get();
        
        console.log('[checkGalleryPermission] Interview doc exists:', interviewDoc.exists);
        
        if (interviewDoc.exists) {
            const interviewData = interviewDoc.data();
            console.log('[checkGalleryPermission] allowPublicGallery value:', interviewData.allowPublicGallery);
            
            if (interviewData.allowPublicGallery === true) {
                // Show the publish button
                console.log('[checkGalleryPermission] Showing publish button');
                publishButton.style.display = '';
                publishButton.disabled = false;
                
                try {
                    // Check if already published
                    const publicReportDoc = await db.collection('publicReports')
                        .where('originalReportId', '==', reportState.currentReportId)
                        .limit(1)
                        .get();
                    
                    if (!publicReportDoc.empty) {
                        // Already published
                        console.log('[checkGalleryPermission] Report already published');
                        const publicReport = publicReportDoc.docs[0].data();
                        const span = publishButton.querySelector('span');
                        
                        // Store the public report ID for unpublishing
                        publishButton.dataset.publicReportId = publicReportDoc.docs[0].id;
                        publishButton.dataset.isPublished = 'true';
                        
                        if (span) {
                            if (publicReport.status === 'pending') {
                                span.textContent = 'Pending Review';
                                publishButton.title = 'Your report is pending review';
                            } else if (publicReport.status === 'approved') {
                                span.textContent = 'Published';
                                publishButton.title = 'Click to unpublish from gallery';
                            }
                            span.classList.remove('sr-only'); // Make text visible
                        }
                        
                        publishButton.classList.add('published');
                        publishButton.disabled = false; // Keep enabled for unpublishing
                    }
                } catch (queryError) {
                    // If we can't check publicReports (permissions issue), just show the button enabled
                    console.log('[checkGalleryPermission] Could not check if already published:', queryError.message);
                    // Button remains enabled - server will handle duplicate check
                }
            }
        }
    } catch (error) {
        console.error('Error checking gallery permission:', error);
    }
}

export async function loadReportFromAPI(reportIdFromUrl, interviewIdFromUrl, publicReportIdFromUrl) {
    const reportContentEl = document.getElementById('reportContent');
    const copyMarkdownButton = document.getElementById('copyMarkdownButton');
    const regenerateReportButton = document.getElementById('regenerateReportButton');
    const watchVideoReportButton = document.getElementById('watchVideoReportButton');
    
    let apiUrl;
    let logMessage;
    let isPublicReport = false;

    if (publicReportIdFromUrl) {
        apiUrl = `/api/public-reports/${publicReportIdFromUrl}`;
        logMessage = `Public Report ID found in URL: ${publicReportIdFromUrl}`;
        isPublicReport = true;
    } else if (reportIdFromUrl) {
        // Check if session_id is provided in URL for forwarded reports
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        
        if (sessionId) {
            apiUrl = `/api/reports/${reportIdFromUrl}?session_id=${sessionId}`;
            logMessage = `Report ID found in URL with session: ${reportIdFromUrl}`;
        } else {
            apiUrl = `/api/reports/${reportIdFromUrl}`;
            logMessage = `Report ID found in URL: ${reportIdFromUrl}`;
        }
    } else {
        apiUrl = `/api/reports/latest?interview_id=${interviewIdFromUrl}`;
        logMessage = `Interview ID found in URL: ${interviewIdFromUrl}`;
    }
    
    console.log(logMessage + ", Fetching directly via API.");
    reportState.setReportLoaded(true, true);
    
    try {
        // Show simple loading indicator (no overlay for loading existing reports)
        const actionButtons = reportContentEl.querySelector('#reportActionButtons');
        reportContentEl.innerHTML = '';
        if (actionButtons) {
            reportContentEl.appendChild(actionButtons);
        }
        const loadingDiv = document.createElement('div');
        loadingDiv.innerHTML = '<div class="text-center p-8"><p class="text-lg">Loading report...</p><div class="mt-4 thinking-indicator justify-center"><div class="thinking-dot"></div><div class="thinking-dot"></div><div class="thinking-dot"></div></div></div>';
        reportContentEl.appendChild(loadingDiv);
        
        copyMarkdownButton.disabled = true;

        const response = await fetch(apiUrl);
        if (!response.ok) {
            let errorText = 'Failed to load report.';
            try {
                const errorData = await response.json();
                errorText = `Failed to load report: ${response.status} - ${errorData.error || errorData.details || response.statusText}`;
            } catch (e) { /* Ignore if error response isn't JSON */ }
            throw new Error(errorText);
        }
        const reportData = await response.json();
        
        console.log('[Report Loader] Report data received:', {
            hasContent: !!reportData.report_content,
            contentLength: reportData.report_content ? reportData.report_content.length : 0,
            status: reportData.status,
            id: reportData.id
        });
        
        // Check if report is still being generated
        // Only show generation overlay if report_content is truly empty/null AND status indicates it's in progress
        if (reportData && !reportData.report_content && reportData.status === 'started') {
            console.log('[Report Loader] Report is still being generated, initializing socket for updates');
            
            // Store the report ID for socket connection
            reportState.setCurrentReportId(reportData.reportId || reportData.id);
            reportState.setCurrentInterviewId(reportData.interview_id || interviewIdFromUrl);
            
            // Don't mark as loaded - let socket connection handle it
            reportState.setReportLoaded(false, false);
            
            // Initialize socket connection to wait for generation
            if (!window.reportSocket) {
                await initializeWithInterviewData(interviewIdFromUrl);
                initializeSocketConnection(false, null, regenerateReportButton);
            }
            
            // Request to join the report generation stream
            // Wait a bit for socket to connect
            setTimeout(() => {
                console.log('[Report Loader] Checking socket before requestReport...');
                console.log('[Report Loader] window.reportSocket exists:', !!window.reportSocket);
                console.log('[Report Loader] Socket connected:', window.reportSocket?.connected);
                console.log('[Report Loader] Socket id:', window.reportSocket?.id);
                
                if (window.reportSocket && window.reportSocket.connected) {
                    // For reports loaded by ID, we need to request by report ID, not session ID
                    console.log('[Report Loader] Requesting to join report generation stream with reportId:', reportData.id);
                    console.log('[Report Loader] Also sending interviewId:', reportData.interview_id);
                    
                    try {
                        // Send both report ID and interview ID to help server find the correct session
                        window.reportSocket.emit('requestReportByIds', {
                            reportId: reportData.id,
                            interviewId: reportData.interview_id
                        });
                        console.log('[Report Loader] requestReportByIds emitted successfully');
                    } catch (error) {
                        console.error('[Report Loader] Error emitting requestReportByIds:', error);
                    }
                } else {
                    console.error('[Report Loader] Socket not connected after 500ms wait');
                }
            }, 500);
            
            // Show generation in progress visualization
            if (typeof FlowingTextViz !== 'undefined') {
                // Create a fullscreen container for the visualization
                const vizContainer = document.createElement('div');
                vizContainer.id = 'reportGenerationViz';
                vizContainer.style.position = 'fixed';
                vizContainer.style.top = '0';
                vizContainer.style.left = '0';
                vizContainer.style.width = '100vw';
                vizContainer.style.height = '100vh';
                vizContainer.style.zIndex = '9999';
                vizContainer.style.backgroundColor = '#000000';
                document.body.appendChild(vizContainer);
                
                // Create the visualization
                const viz = new FlowingTextViz(vizContainer);
                
                // Store reference for cleanup
                window.reportGenerationViz = viz;
                window.reportGenerationContainer = vizContainer;
            }
            
            return; // Exit early - socket will handle the rest
        }
        
        if (reportData && reportData.report_content) {
            // Clean up any visualization that might be showing
            if (window.reportGenerationViz) {
                console.log('[Report Loader] Cleaning up generation visualization');
                window.reportGenerationViz.destroy();
                window.reportGenerationViz = null;
            }
            if (window.reportGenerationContainer) {
                window.reportGenerationContainer.remove();
                window.reportGenerationContainer = null;
            }
            
            // Store the IDs for regeneration
            // For public reports, use reportId (original report ID) for audio playback
            reportState.setCurrentReportId(reportData.reportId || reportData.id);
            reportState.setCurrentInterviewId(reportData.interview_id || interviewIdFromUrl);
            
            if (reportState.currentReportId) {
                localStorage.setItem('currentPersistentReportId', reportState.currentReportId);
                // Check video status and set button state accordingly
                const videoButton = document.getElementById('playFullReportVideoBtn');
                if (videoButton) {
                    checkAndUpdateVideoButtonState(reportState.currentReportId, videoButton);
                }
                // Also check for the watch video button
                if (watchVideoReportButton) {
                    checkAndUpdateVideoButtonState(reportState.currentReportId, watchVideoReportButton);
                }
            }
            
            reportState.reportMarkdown = reportData.report_content;
            const formattedContent = formatMagazineContent(reportData.report_content, reportData.report_title, {
                user_name: reportData.user_name,
                start_timestamp: reportData.start_timestamp,
                user_note: reportData.user_note
            });
            
            // Clear the content first
            const actionButtons = reportContentEl.querySelector('#reportActionButtons');
            reportContentEl.innerHTML = '';
            
            // Create content container and add formatted content
            const contentDiv = document.createElement('div');
            contentDiv.innerHTML = formattedContent;
            
            // Find the first H1 element and insert action buttons after it
            const firstH1 = contentDiv.querySelector('h1');
            if (firstH1 && actionButtons) {
                // Insert action buttons after the H1
                firstH1.insertAdjacentElement('afterend', actionButtons);
            } else if (actionButtons) {
                // Fallback: prepend if no H1 found
                contentDiv.insertBefore(actionButtons, contentDiv.firstChild);
            }
            
            reportContentEl.appendChild(contentDiv);
            
            copyMarkdownButton.disabled = false;
            
            // For public reports, hide certain buttons but show transcript
            if (isPublicReport) {
                // Hide regeneration button (if it exists)
                if (regenerateReportButton) {
                    regenerateReportButton.classList.add('hidden');
                    regenerateReportButton.classList.remove('flex');
                }
                
                // Hide publish button
                const publishButton = document.getElementById('publishToGalleryButton');
                if (publishButton) {
                    publishButton.style.display = 'none';
                }
                
                // Update header to indicate public report
                const headerTitle = document.getElementById('headerTitleText');
                if (headerTitle) {
                    headerTitle.textContent = 'Gallery Report';
                }
                
                // Show transcript tab for public reports (removed the hiding logic)
                const transcriptTab = document.querySelector('[data-target="transcriptContentArea"]');
                if (transcriptTab) {
                    transcriptTab.style.display = ''; // Ensure it's visible
                }
                
                // Load transcript for public report
                await loadTranscriptContent(reportState.currentReportId, true, publicReportIdFromUrl);
            } else {
                // Show regeneration button for regular reports (if it exists)
                if (regenerateReportButton) {
                    regenerateReportButton.classList.remove('hidden');
                    regenerateReportButton.classList.add('flex');
                }

                // Check if interview allows gallery publishing
                if (reportState.currentInterviewId) {
                    checkGalleryPermission(reportState.currentInterviewId);
                }
            }

            // Load the detailed view for API-loaded reports
            // For public reports, transcript is loaded above
            if (!isPublicReport) {
                await loadReportDetails(reportState.currentReportId);
            }
            
            // Ensure both tabs are properly set up after loading
            setTimeout(() => {
                activateReportTab('reportContent');
                console.log('[Tab Setup] Default tab activated after report load');
                
                // Ensure transcript tab content is ready for when user clicks it
                const transcriptArea = document.getElementById('transcriptContentArea');
                if (transcriptArea) {
                    console.log('[Tab Setup] Transcript content area found and ready');
                } else {
                    console.warn('[Tab Setup] Transcript content area not found');
                }
            }, 100);

            // Update header with user's name
            updateHeaderWithUserName(reportState.currentReportId, reportState.currentInterviewId, reportData.report_title);

            document.title = reportData.report_title || "Personal AI Readiness Report";

            // Call onReportLoaded callback if it exists
            if (reportState.onReportLoaded) {
                reportState.onReportLoaded();
            }

        } else {
            // Handle empty report content
            const actionButtons = reportContentEl.querySelector('#reportActionButtons');
            reportContentEl.innerHTML = '';
            if (actionButtons) {
                reportContentEl.appendChild(actionButtons);
            }
            const errorDiv = document.createElement('div');
            errorDiv.innerHTML = '<p class="text-center p-8 text-red-500">Report content not found or is empty.</p>';
            reportContentEl.appendChild(errorDiv);
            activateReportTab('reportContent');
        }
    } catch (error) {
        console.error('Error fetching report directly via API:', error);
        
        // Handle error
        const actionButtons = reportContentEl.querySelector('#reportActionButtons');
        reportContentEl.innerHTML = '';
        if (actionButtons) {
            reportContentEl.appendChild(actionButtons);
        }
        const errorDiv = document.createElement('div');
        errorDiv.innerHTML = `<p class="text-center p-8 text-red-500">Error loading report: ${error.message}</p>`;
        reportContentEl.appendChild(errorDiv);
        activateReportTab('reportContent');
    }
}

// Load report details
export async function loadReportDetails(reportId) {
    const transcriptDisplayArea = document.getElementById('transcriptContent'); 
    const generatedReportDisplayArea = document.getElementById('reportContent');
    console.log('[loadReportDetails] Transcript Display Area:', transcriptDisplayArea, 'Generated Report Area:', generatedReportDisplayArea);

    if (!reportId) return;

    // Update header with user's name
    updateHeaderWithUserName(reportId, null);

    try {
        // Load transcript into its dedicated area
        if (transcriptDisplayArea) {
            await loadTranscriptContent(reportId);
        } else {
            console.error('Transcript display area (transcriptContent) not found.');
        }

        // Load and format the main report content into the #reportContent div
        if (generatedReportDisplayArea) {
            const reportResponse = await fetch(`/api/reports/${reportId}`);
            if (reportResponse.ok) {
                const reportData = await reportResponse.json();
                reportState.reportMarkdown = reportData.report_content || '';
                
                // Clear the content first
                const actionButtons = generatedReportDisplayArea.querySelector('#reportActionButtons');
                generatedReportDisplayArea.innerHTML = '';
                
                // Create content container and add formatted content
                const contentDiv = document.createElement('div');
                contentDiv.innerHTML = formatMagazineContent(reportData.report_content || '', reportData.report_title, {
                    user_name: reportData.user_name,
                    start_timestamp: reportData.start_timestamp,
                    user_note: reportData.user_note
                });
                
                // Find the first H1 element and insert action buttons after it
                const firstH1 = contentDiv.querySelector('h1');
                if (firstH1 && actionButtons) {
                    // Insert action buttons after the H1
                    firstH1.insertAdjacentElement('afterend', actionButtons);
                } else if (actionButtons) {
                    // Fallback: prepend if no H1 found
                    contentDiv.insertBefore(actionButtons, contentDiv.firstChild);
                }
                
                generatedReportDisplayArea.appendChild(contentDiv);
            } else {
                // Handle error
                const actionButtons = generatedReportDisplayArea.querySelector('#reportActionButtons');
                generatedReportDisplayArea.innerHTML = '';
                if (actionButtons) {
                    generatedReportDisplayArea.appendChild(actionButtons);
                }
                const errorDiv = document.createElement('div');
                errorDiv.innerHTML = '<p class="text-red-400">Error loading report content</p>';
                generatedReportDisplayArea.appendChild(errorDiv);
            }
        } else {
            console.error('Generated report display area (reportContent) not found.');
        }
    } catch (error) {
        console.error('Error loading report details:', error);
        
        if(transcriptDisplayArea) transcriptDisplayArea.innerHTML = '<p class="text-red-400">Error loading transcript data</p>';
        if(generatedReportDisplayArea) {
            const actionButtons = generatedReportDisplayArea.querySelector('#reportActionButtons');
            generatedReportDisplayArea.innerHTML = '';
            if (actionButtons) {
                generatedReportDisplayArea.appendChild(actionButtons);
            }
            const errorDiv = document.createElement('div');
            errorDiv.innerHTML = '<p class="text-red-400">Error loading generated report data</p>';
            generatedReportDisplayArea.appendChild(errorDiv);
        }
    }
}