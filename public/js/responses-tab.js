// Responses Tab Management

// Cache for special report details to prevent duplicate requests
const specialReportDetailsCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds

// Helper function to get special report details with caching
async function getSpecialReportDetails(interviewId) {
    const cacheKey = `report-details-${interviewId}`;
    const cached = specialReportDetailsCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('[getSpecialReportDetails] Using cached data for:', interviewId);
        return cached.data;
    }
    
    console.log('[getSpecialReportDetails] Fetching fresh data for:', interviewId);
    const response = await fetch(`/api/interview/${interviewId}/special-report-details`);
    if (!response.ok) {
        let errorText = `API Error: ${response.status}`; 
        try { 
            const errorData = await response.json(); 
            errorText += `: ${errorData.details || errorData.error || 'Unknown API error'}`;
        } catch (e) { /* Ignore JSON parse error */ }
        throw new Error(errorText);
    }
    
    const data = await response.json();
    
    // Cache the result
    specialReportDetailsCache.set(cacheKey, {
        data: data,
        timestamp: Date.now()
    });
    
    return data;
}

// Export for use in other modules
window.getSpecialReportDetails = getSpecialReportDetails;

// Function to clear the responses cache when needed
window.clearResponsesCache = function(interviewId) {
    const cacheKey = `report-details-${interviewId}`;
    specialReportDetailsCache.delete(cacheKey);
    console.log('[clearResponsesCache] Cleared cache for interview:', interviewId);
};

// Fetch and display responses/reports in the Responses tab
window.fetchAndDisplayResponses = async function(interviewId) {
    const responsesLoadingIndicator = document.getElementById('responsesLoadingIndicator');
    const responsesListContainer = document.getElementById('responsesListContainer');
    const noResponsesMessage = document.getElementById('noResponsesMessage');
    const responsesErrorMessage = document.getElementById('responsesErrorMessage');
    const responsesStatisticsSection = document.getElementById('responsesStatisticsSection');
    
    if (!responsesLoadingIndicator || !responsesListContainer || !noResponsesMessage || !responsesErrorMessage) return;

    responsesLoadingIndicator.classList.remove('hidden');
    responsesListContainer.innerHTML = '';
    responsesListContainer.classList.add('hidden');
    noResponsesMessage.classList.add('hidden');
    responsesErrorMessage.classList.add('hidden');
    if (responsesStatisticsSection) responsesStatisticsSection.classList.add('hidden');

    const renderedReportIds = new Set();

    try {
        const data = await getSpecialReportDetails(interviewId);
        
        console.log('[fetchAndDisplayResponses] Received data:', data);
        console.log('[fetchAndDisplayResponses] Report list:', data.reportList);

        responsesLoadingIndicator.classList.add('hidden');

        if (data.reportList && data.reportList.length > 0) {
            // Log each report's validation status
            data.reportList.forEach((report, idx) => {
                console.log(`[Report ${idx}] ID: ${report.id}, hasValidResponses: ${report.hasValidResponses}, testField: ${report.testField}`);
            });
            
            // Calculate and display statistics
            calculateAndDisplayStatistics(data.reportList, interviewId);
            
            // Show the carousel section and header stats
            const carouselSection = document.getElementById('interviewQACarouselSection');
            if (carouselSection) {
                carouselSection.classList.remove('hidden');
            }
            const headerStats = document.getElementById('headerStatisticsLine');
            const defaultSubheadline = document.getElementById('configPanelHeaderSubheadline');
            if (headerStats) {
                headerStats.classList.remove('hidden');
            }
            if (defaultSubheadline) {
                defaultSubheadline.classList.add('hidden');
            }
            
            // Load Q&A carousels for each report
            if (window.loadInterviewTabQACarousels) {
                window.loadInterviewTabQACarousels(interviewId, data.reportList);
            }

            // Show all reports, even if not completed
            const reportsToDisplay = data.reportList;
            
            console.log(`[fetchAndDisplayResponses] Showing all ${reportsToDisplay.length} reports`);

            if (reportsToDisplay.length === 0) {
                // No valid reports to display
                noResponsesMessage.classList.remove('hidden');
                if (responsesStatisticsSection) responsesStatisticsSection.classList.add('hidden');
                
                // Hide carousel section and header stats when no responses
                const carouselSection = document.getElementById('interviewQACarouselSection');
                if (carouselSection) {
                    carouselSection.classList.add('hidden');
                }
                const carouselContainer = document.getElementById('interviewQACarouselContainer');
                if (carouselContainer) {
                    carouselContainer.innerHTML = '';
                }
                const headerStats = document.getElementById('headerStatisticsLine');
                if (headerStats) {
                    headerStats.classList.add('hidden');
                }
                return;
            }

            reportsToDisplay.forEach((report, index) => {
                if (report.id && renderedReportIds.has(report.id)) {
                    console.warn(`[fetchAndDisplayResponses] Skipping duplicate report ID from API: ${report.id}`);
                    return;
                }
                if (report.id) {
                    renderedReportIds.add(report.id);
                } else {
                    console.warn(`[fetchAndDisplayResponses] Report item at index ${index} has no ID.`);
                }

                const reportItem = document.createElement('div');
                reportItem.className = 'responses-tab-item-card bg-gray-750 border border-gray-700 p-4 rounded-lg mb-4 shadow-md';
                if (report.id) {
                    reportItem.setAttribute('data-report-id', report.id);
                }

                let reportDate = 'Date N/A';
                const timestampSource = report.start_timestamp || report.timestamp;
                if (timestampSource) {
                    try {
                        const dateObj = typeof timestampSource.toDate === 'function'
                            ? timestampSource.toDate()
                            : new Date(timestampSource);
                        reportDate = dateObj.toLocaleString(undefined, {
                            year: 'numeric', month: 'long', day: 'numeric', 
                            hour: '2-digit', minute: '2-digit'
                        });
                    } catch (e) {
                        console.warn("Could not parse report timestamp:", timestampSource, e);
                    }
                }

                // Process report_content for display
                let processedFullContent = report.admin_report_content || report.report_content || '';
                processedFullContent = processedFullContent.replace(
                    /<audio_clip[^>]*>([\s\S]*?)<\/audio_clip>/gi,
                    (match, audioContent) => {
                        const contentStr = String(audioContent || "").trim();
                        if (!contentStr) return "";
                        return `<blockquote>${window.escapeXml(contentStr)}</blockquote>`;
                    }
                );
                const renderedFullContentHTML = marked.parse(processedFullContent);

                reportItem.innerHTML = `
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex-grow">
                            <h4 class="text-md font-semibold text-white mb-0.5">${report.userName || 'Anonymous'}</h4>
                            <p class="text-xs text-gray-400">${report.userEmail || 'No email provided'}</p>
                            <div class="text-xs text-gray-400">Taken: ${reportDate}</div>
                            <div class="responses-tab-audio-status text-xs text-gray-500 mt-1"></div>
                        </div>
                        <button class="play-responses-tab-audio-btn icon-button"
                                data-report-id="${report.id}"
                                data-audio-type="reportItem"
                                data-track-title="Response from: ${report.title || 'Interview'}"
                                data-user-name="${report.userName || 'Interviewee'}"
                                ${report.audio_gcs_url ? '' : 'disabled'}
                                title="${report.audio_gcs_url ? 'Play Full Response Audio' : 'Audio not yet available'}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 play-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" /></svg>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 pause-icon hidden" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" /></svg>
                        </button>
                    </div>
                    <div class="responses-tab-content-display markdown-body whitespace-pre-wrap text-sm mb-3">${renderedFullContentHTML}</div>
                    <div class="mt-3">
                         <button class="view-responses-tab-details-btn secondary-button text-xs py-1 px-3" data-report-id="${report.id}" title="View full details of this interview session">
                            View Details
                        </button>
                    </div>
                `;

                setupResponseItemEventListeners(reportItem);
                // Hide regular list - we're using carousels instead
                // responsesListContainer.appendChild(reportItem);
            });
            
            // Don't show the regular list container
            // if (responsesListContainer.children.length > 0) {
            //     responsesListContainer.classList.remove('hidden');
            // } else {
            //     noResponsesMessage.classList.remove('hidden');
            // }
        } else {
            // Show statistics even if no reports (will show zeros)
            calculateAndDisplayStatistics([], interviewId);
            noResponsesMessage.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Failed to load responses/reports for Responses tab:', error);
        responsesLoadingIndicator.classList.add('hidden');
        responsesErrorMessage.textContent = `Error loading data: ${error.message}`;
        responsesErrorMessage.classList.remove('hidden');
    }
}

// Calculate and display statistics for the responses
async function calculateAndDisplayStatistics(reportList, interviewId) {
    const responsesStatisticsSection = document.getElementById('responsesStatisticsSection');
    const totalInterviewsCount = document.getElementById('totalInterviewsCount');
    const uniqueUsersCount = document.getElementById('uniqueUsersCount');
    const avgResponsesPerInterview = document.getElementById('avgResponsesPerInterview');
    const lastInterviewDate = document.getElementById('lastInterviewDate');
    const avgInterviewDuration = document.getElementById('avgInterviewDuration');
    const mostActiveUser = document.getElementById('mostActiveUser');

    if (!responsesStatisticsSection) return;

    try {
        console.log('[calculateAndDisplayStatistics] Input report list:', reportList.length);
        
        // Include all reports in statistics
        const validReports = reportList;
        
        console.log(`[calculateAndDisplayStatistics] Including all ${validReports.length} reports in statistics`);

        // Basic statistics from valid report list
        const totalInterviews = validReports.length;
        const uniqueUsers = new Set(validReports.map(report => report.userEmail || report.user_id).filter(Boolean)).size;
        
        // Find most recent interview
        let mostRecentDate = null;
        if (validReports.length > 0) {
            const dates = validReports.map(report => {
                const timestampSource = report.start_timestamp || report.timestamp;
                if (timestampSource) {
                    try {
                        return typeof timestampSource.toDate === 'function'
                            ? timestampSource.toDate()
                            : new Date(timestampSource);
                    } catch (e) {
                        return null;
                    }
                }
                return null;
            }).filter(Boolean);
            
            if (dates.length > 0) {
                mostRecentDate = new Date(Math.max(...dates));
            }
        }

        // Calculate average questions per interview and additional statistics
        let totalQuestions = 0;
        let interviewsWithQuestions = 0;
        let totalDurationMinutes = 0;
        let interviewsWithDuration = 0;
        const userInterviewCounts = {};
        
        for (const report of validReports) {
            // Count interviews per user
            const userKey = report.userEmail || report.user_id || 'Unknown';
            userInterviewCounts[userKey] = (userInterviewCounts[userKey] || 0) + 1;
            
            // TEMPORARILY DISABLED: Fetching all responses causes 429 errors
            // TODO: Get question count from the report metadata instead
            /*
            if (report.id) {
                try {
                    // Include auth token if available
                    const headers = {};
                    if (window.auth && window.auth.currentUser) {
                        const token = await window.auth.currentUser.getIdToken();
                        headers['Authorization'] = `Bearer ${token}`;
                    }
                    
                    const responsesResponse = await fetch(`/api/reports/${report.id}/responses`, {
                        headers: headers
                    });
                    if (responsesResponse.ok) {
                        const responsesData = await responsesResponse.json();
                        const questionCount = responsesData.responses ? responsesData.responses.length : 0;
                        if (questionCount > 0) {
                            totalQuestions += questionCount;
                            interviewsWithQuestions++;
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to fetch responses for report ${report.id}:`, error);
                }
            }
            */
            
            // Calculate duration if timestamps are available
            const startTime = report.start_timestamp;
            const endTime = report.end_timestamp;
            if (startTime && endTime) {
                try {
                    const startDate = typeof startTime.toDate === 'function' ? startTime.toDate() : new Date(startTime);
                    const endDate = typeof endTime.toDate === 'function' ? endTime.toDate() : new Date(endTime);
                    const durationMs = endDate - startDate;
                    if (durationMs > 0) {
                        totalDurationMinutes += durationMs / (1000 * 60); // Convert to minutes
                        interviewsWithDuration++;
                    }
                } catch (e) {
                    console.warn(`Error calculating duration for report ${report.id}:`, e);
                }
            }
        }

        const avgQuestions = interviewsWithQuestions > 0 ? Math.round(totalQuestions / interviewsWithQuestions) : 0;
        const avgDuration = interviewsWithDuration > 0 ? totalDurationMinutes / interviewsWithDuration : 0;
        
        // Find most active user
        let mostActiveUserName = '--';
        let maxInterviews = 0;
        for (const [user, count] of Object.entries(userInterviewCounts)) {
            if (count > maxInterviews) {
                maxInterviews = count;
                mostActiveUserName = user;
            }
        }
        
        // Format most active user display
        if (mostActiveUserName !== '--' && mostActiveUserName !== 'Unknown') {
            // Extract name from email if it's an email
            if (mostActiveUserName.includes('@')) {
                const emailParts = mostActiveUserName.split('@');
                mostActiveUserName = emailParts[0];
            }
            // Truncate if too long
            if (mostActiveUserName.length > 12) {
                mostActiveUserName = mostActiveUserName.substring(0, 12) + '...';
            }
            mostActiveUserName += ` (${maxInterviews})`;
        }

        // Update the display
        if (totalInterviewsCount) totalInterviewsCount.textContent = totalInterviews;
        if (uniqueUsersCount) uniqueUsersCount.textContent = uniqueUsers;
        if (avgResponsesPerInterview) avgResponsesPerInterview.textContent = avgQuestions;
        
        if (avgInterviewDuration) {
            if (avgDuration > 0) {
                if (avgDuration < 60) {
                    avgInterviewDuration.textContent = `${Math.round(avgDuration)}m`;
                } else {
                    const hours = Math.floor(avgDuration / 60);
                    const minutes = Math.round(avgDuration % 60);
                    avgInterviewDuration.textContent = `${hours}h ${minutes}m`;
                }
            } else {
                avgInterviewDuration.textContent = '--';
            }
        }
        
        if (mostActiveUser) {
            mostActiveUser.textContent = mostActiveUserName;
            mostActiveUser.title = mostActiveUserName; // Full text on hover
        }
        
        if (lastInterviewDate) {
            if (mostRecentDate) {
                const now = new Date();
                const diffTime = Math.abs(now - mostRecentDate);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays === 0) {
                    lastInterviewDate.textContent = 'Today';
                } else if (diffDays === 1) {
                    lastInterviewDate.textContent = 'Yesterday';
                } else if (diffDays < 7) {
                    lastInterviewDate.textContent = `${diffDays} days ago`;
                } else {
                    lastInterviewDate.textContent = mostRecentDate.toLocaleDateString();
                }
            } else {
                lastInterviewDate.textContent = 'Never';
            }
        }

        // Update header statistics line with new format
        const headerInterviewStats = document.getElementById('headerInterviewStats');
        if (headerInterviewStats) {
            if (totalInterviews === 0) {
                headerInterviewStats.textContent = 'No interviews yet';
            } else {
                // Build the stats string
                let statsText = `${totalInterviews} interview${totalInterviews !== 1 ? 's' : ''} from ${uniqueUsers} user${uniqueUsers !== 1 ? 's' : ''}`;
                
                // Add last updated info
                if (lastInterviewDate && lastInterviewDate.textContent && lastInterviewDate.textContent !== 'Never') {
                    statsText += `, last updated ${lastInterviewDate.textContent.toLowerCase()}`;
                }
                
                headerInterviewStats.textContent = statsText;
            }
        }
        
        // Show the statistics section (keeping for compatibility but it's hidden)
        responsesStatisticsSection.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error calculating statistics:', error);
        // Still show the section with default values
        if (totalInterviewsCount) totalInterviewsCount.textContent = '0';
        if (uniqueUsersCount) uniqueUsersCount.textContent = '0';
        if (avgResponsesPerInterview) avgResponsesPerInterview.textContent = '0';
        if (lastInterviewDate) lastInterviewDate.textContent = 'Error';
        if (avgInterviewDuration) avgInterviewDuration.textContent = '--';
        if (mostActiveUser) mostActiveUser.textContent = '--';
        responsesStatisticsSection.classList.remove('hidden');
    }
}

// Setup event listeners for response item
function setupResponseItemEventListeners(reportItem) {
    const playButton = reportItem.querySelector('.play-responses-tab-audio-btn');
    const detailsButton = reportItem.querySelector('.view-responses-tab-details-btn');
    const audioStatus = reportItem.querySelector('.responses-tab-audio-status');

    if (playButton && audioStatus) {
        playButton.addEventListener('click', async (e) => {
            e.stopPropagation();
            const reportIdForAudio = playButton.dataset.reportId;
            const trackTitle = playButton.dataset.trackTitle;
            const userName = playButton.dataset.userName;

            if (!reportIdForAudio || reportIdForAudio === 'undefined') {
                console.error("[Play Responses Tab Audio Click] Error: reportId is undefined.");
                audioStatus.textContent = 'Error: Missing report ID.';
                return;
            }
            audioStatus.textContent = 'Loading audio...';
            const audioSrcForThisButton = `/api/reports/${reportIdForAudio}/audio-artifact`;

            const globalAudioPlayerElement = document.getElementById('globalAudioPlayerElement');
            if (globalAudioPlayerElement && globalAudioPlayerElement.src && globalAudioPlayerElement.src.endsWith(audioSrcForThisButton) && !globalAudioPlayerElement.paused && window.activeAudioTriggerButton === playButton) {
                globalAudioPlayerElement.pause();
                audioStatus.textContent = 'Paused.';
            } else {
                try {
                    const fetchResponse = await fetch(audioSrcForThisButton);
                    if (fetchResponse.ok) {
                        const audioBlob = await fetchResponse.blob();
                        const audioUrl = URL.createObjectURL(audioBlob);
                        if (window.playOnGlobalPlayer) {
                            window.playOnGlobalPlayer(audioUrl, trackTitle, userName, playButton);
                        }
                        audioStatus.textContent = 'Playing globally...';
                    } else {
                        audioStatus.textContent = `Error fetching audio: ${fetchResponse.status}`;
                        if (window.updateTriggerButtonIcon) {
                            window.updateTriggerButtonIcon(playButton, false);
                        }
                    }
                } catch (error) {
                    audioStatus.textContent = `Network error: ${error.message}`;
                    if (window.updateTriggerButtonIcon) {
                        window.updateTriggerButtonIcon(playButton, false);
                    }
                }
            }
        });
    }

    if (detailsButton) {
        detailsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            const reportIdForDetails = detailsButton.dataset.reportId;
            if (reportIdForDetails) {
                appState.setReportDetailPanelOpen(true, reportIdForDetails);
                appState.setReportDetailPanelTab('interviewContent');
                if (window.applyReportDetailPanelState) window.applyReportDetailPanelState();
                if (window.showReportDetailsGlobal) window.showReportDetailsGlobal(reportIdForDetails);
            }
        });
    }

    const readMoreBtn = reportItem.querySelector('.read-more-responses-tab');
    if (readMoreBtn) {
        const contentDisplay = reportItem.querySelector('.responses-tab-content-display');
        readMoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const fullContent = reportItem.querySelector('.responses-tab-content-display').getAttribute('data-full-content');
            const shortContent = reportItem.querySelector('.responses-tab-content-display').getAttribute('data-short-content');
            
            if (readMoreBtn.textContent === 'Read more') {
                contentDisplay.innerHTML = fullContent || contentDisplay.innerHTML;
                readMoreBtn.textContent = 'Read less';
            } else {
                contentDisplay.innerHTML = shortContent || contentDisplay.innerHTML;
                readMoreBtn.textContent = 'Read more';
            }
        });
    }
    
    // Add event listener to the card itself
    reportItem.addEventListener('click', (event) => {
        if (event.target.closest('button')) return;
        const reportIdForDetails = reportItem.getAttribute('data-report-id');
        if (reportIdForDetails) {
            appState.setReportDetailPanelOpen(true, reportIdForDetails);
            appState.setReportDetailPanelTab('interviewContent');
            if (window.applyReportDetailPanelState) window.applyReportDetailPanelState();
            if (window.showReportDetailsGlobal) window.showReportDetailsGlobal(reportIdForDetails);
        }
    });
}

// Helper to reset the state of the Responses tab
window.resetResponsesTab = function() {
    const responsesLoadingIndicator = document.getElementById('responsesLoadingIndicator');
    const responsesListContainer = document.getElementById('responsesListContainer');
    const noResponsesMessage = document.getElementById('noResponsesMessage');
    const responsesErrorMessage = document.getElementById('responsesErrorMessage');
    const responsesStatisticsSection = document.getElementById('responsesStatisticsSection');
    const headerStats = document.getElementById('headerStatisticsLine');
    const carouselContainer = document.getElementById('interviewQACarouselContainer');
    const carouselSection = document.getElementById('interviewQACarouselSection');
    
    if (!responsesLoadingIndicator || !responsesListContainer || !noResponsesMessage || !responsesErrorMessage) return;
    
    responsesListContainer.innerHTML = '';
    responsesListContainer.classList.add('hidden');
    responsesLoadingIndicator.classList.remove('hidden');
    noResponsesMessage.classList.add('hidden');
    responsesErrorMessage.classList.add('hidden');
    if (responsesStatisticsSection) responsesStatisticsSection.classList.add('hidden');
    if (headerStats) headerStats.classList.add('hidden');
    
    // Clear carousel content
    if (carouselContainer) {
        carouselContainer.innerHTML = '';
    }
    if (carouselSection) {
        carouselSection.classList.add('hidden');
    }
} 