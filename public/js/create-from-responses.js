// Create Interview from Responses Module
// This module handles creating a new interview using Q&A responses from an existing interview as context

/**
 * Creates a new interview using responses from an existing interview as context
 * @param {string} interviewId - The ID of the interview to get responses from
 * @param {string} interviewTitle - The title of the source interview
 */
async function createInterviewFromResponses(interviewId, interviewTitle) {
    try {
        console.log('[CreateFromResponses] Starting creation from interview:', interviewId, interviewTitle);
        
        // Show loading indicator
        console.log('[CreateFromResponses] Fetching interview responses...');

        // Fetch all reports for this interview
        const response = await fetch(`/api/interview/${interviewId}/special-report-details`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch interview reports: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (!data.reports || data.reports.length === 0) {
            alert('No completed interviews found for this template.');
            return;
        }

        console.log(`[CreateFromResponses] Found ${data.reports.length} reports`);

        // Let user select which response to use if there are multiple
        let selectedReport;
        if (data.reports.length === 1) {
            selectedReport = data.reports[0];
        } else {
            // For now, use the most recent report
            // TODO: In the future, show a selection dialog
            selectedReport = data.reports.sort((a, b) => {
                const dateA = a.end_timestamp?.toDate?.() || new Date(a.end_timestamp);
                const dateB = b.end_timestamp?.toDate?.() || new Date(b.end_timestamp);
                return dateB - dateA;
            })[0];
        }

        // Fetch the Q&A pairs for the selected report
        const qaResponse = await fetch(`/api/reports/${selectedReport.id}/responses`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!qaResponse.ok) {
            throw new Error(`Failed to fetch Q&A responses: ${qaResponse.statusText}`);
        }

        const qaData = await qaResponse.json();
        
        if (!qaData.responses || qaData.responses.length === 0) {
            alert('No Q&A responses found for this interview.');
            return;
        }

        console.log(`[CreateFromResponses] Found ${qaData.responses.length} Q&A pairs`);

        // Format Q&A pairs as transcript
        const transcript = formatQATranscript(qaData.responses, selectedReport, interviewTitle);
        
        // Create a file-like object with the transcript
        const transcriptFile = {
            name: `${interviewTitle}_responses.txt`,
            size: transcript.length,
            type: 'text/plain',
            content: transcript,
            isText: true
        };

        // Reset the interview creation state
        if (window.appState) {
            // Clear any existing state
            window.appState.resetInterviewSpec();
            window.appState.setCurrentEditingInterviewId(null);
            window.appState.copilotContextFiles = [];
            
            // Add the transcript as context
            window.appState.copilotContextFiles = [transcriptFile];
        }

        // Set copilot to editor mode
        if (window.appState) {
            window.appState.setCopilotMode('editor');
            
            // Ensure copilot panel is visible
            if (window.appState.uiState.copilotPanelCollapsed) {
                window.appState.setCopilotPanelCollapsed(false);
                if (window.applyPanelLayout) {
                    window.applyPanelLayout();
                }
            }
        }

        // Show the specification null state
        if (window.showSpecificationNullState) {
            window.showSpecificationNullState();
        }

        // Update the copilot UI to show the loaded context
        if (window.updateCopilotContextIndicator) {
            window.updateCopilotContextIndicator();
        }

        // Show success message with context
        const contextMessage = `Interview responses from "${interviewTitle}" loaded as context. Use the AI Copilot to create your new interview based on these responses.`;
        
        // Add initial message to copilot chat
        if (window.addMessageToChat) {
            window.addMessageToChat('system', contextMessage);
        }

    } catch (error) {
        console.error('[CreateFromResponses] Error:', error);
        alert('Failed to load interview responses. Please try again.');
    }
}

/**
 * Formats Q&A responses into a readable transcript
 * @param {Array} responses - Array of Q&A response objects
 * @param {Object} report - The report object containing metadata
 * @param {string} interviewTitle - The title of the source interview
 * @returns {string} Formatted transcript
 */
function formatQATranscript(responses, report, interviewTitle) {
    let transcript = `Interview Transcript: ${interviewTitle}\n`;
    transcript += `Participant: ${report.user_name || 'Anonymous'}\n`;
    
    if (report.end_timestamp) {
        const date = report.end_timestamp.toDate ? report.end_timestamp.toDate() : new Date(report.end_timestamp);
        transcript += `Date: ${date.toLocaleDateString()}\n`;
    }
    
    transcript += `\n${'='.repeat(60)}\n\n`;
    
    // Sort responses by timestamp
    const sortedResponses = responses.sort((a, b) => {
        const timeA = a.timestamp?.toDate?.() || new Date(a.timestamp);
        const timeB = b.timestamp?.toDate?.() || new Date(b.timestamp);
        return timeA - timeB;
    });
    
    // Format each Q&A pair
    sortedResponses.forEach((response, index) => {
        transcript += `QUESTION ${index + 1}:\n${response.question}\n\n`;
        transcript += `ANSWER:\n${response.answer}\n\n`;
        transcript += `${'-'.repeat(40)}\n\n`;
    });
    
    return transcript;
}

/**
 * Creates a new interview using a single response/report as context
 * @param {string} reportId - The ID of the specific report to use as context
 * @param {string} userName - The name of the user who took the interview
 */
async function createInterviewFromSingleResponse(reportId, userName) {
    try {
        console.log('[CreateFromResponses] Starting creation from single response:', reportId, userName);

        // Fetch the Q&A pairs for this specific report
        const qaResponse = await fetch(`/api/reports/${reportId}/responses`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!qaResponse.ok) {
            throw new Error(`Failed to fetch Q&A responses: ${qaResponse.statusText}`);
        }

        const qaData = await qaResponse.json();
        
        if (!qaData.responses || qaData.responses.length === 0) {
            alert('No Q&A responses found for this interview.');
            return;
        }

        console.log(`[CreateFromResponses] Found ${qaData.responses.length} Q&A pairs for ${userName}`);

        // Fetch the report details to get interview title and other metadata
        const reportResponse = await fetch(`/api/reports/${reportId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (!reportResponse.ok) {
            throw new Error(`Failed to fetch report details: ${reportResponse.statusText}`);
        }

        const reportData = await reportResponse.json();
        const interviewTitle = reportData.report?.interview_title || 'Interview';

        // Create a report object with the necessary fields
        const report = {
            id: reportId,
            user_name: userName,
            user_email: reportData.report?.user_email || '',
            end_timestamp: reportData.report?.end_timestamp,
            interview_title: interviewTitle
        };

        // Format Q&A pairs as transcript
        const transcript = formatQATranscript(qaData.responses, report, interviewTitle);
        
        // Create a file-like object with the transcript
        const transcriptFile = {
            name: `${userName}_response.txt`,
            size: transcript.length,
            type: 'text/plain',
            content: transcript,
            isText: true
        };

        // Reset the interview creation state
        if (window.appState) {
            // Clear any existing state
            window.appState.resetInterviewSpec();
            window.appState.setCurrentEditingInterviewId(null);
            window.appState.copilotContextFiles = [];
            
            // Add the transcript as context
            window.appState.copilotContextFiles = [transcriptFile];
        }

        // Set copilot to editor mode
        if (window.appState) {
            window.appState.setCopilotMode('editor');
            
            // Ensure copilot panel is visible
            if (window.appState.uiState.copilotPanelCollapsed) {
                window.appState.setCopilotPanelCollapsed(false);
                if (window.applyPanelLayout) {
                    window.applyPanelLayout();
                }
            }
        }

        // Show the specification null state
        if (window.showSpecificationNullState) {
            window.showSpecificationNullState();
        }

        // Update the copilot UI to show the loaded context
        if (window.updateCopilotContextIndicator) {
            window.updateCopilotContextIndicator();
        }

        // Set the transcript as the copilot file content (matching the content interview flow)
        window.copilotUploadedFile = transcriptFile.name;
        window.copilotFileContent = {
            name: transcriptFile.name,
            content: transcript,
            type: 'text/plain',
            isText: true
        };

        // Show the file preview
        const filePreview = document.getElementById('copilotFilePreview');
        const fileName = document.getElementById('copilotFileName');
        const clearFileBtn = document.getElementById('clearCopilotFile');
        
        if (filePreview && fileName) {
            fileName.textContent = transcriptFile.name;
            filePreview.classList.remove('hidden');
            
            // Also trigger the context indicator update
            const copilotMessagesEl = document.getElementById('copilotMessages');
            if (copilotMessagesEl) {
                // Clear any existing prompt cards
                copilotMessagesEl.innerHTML = '';
            }
        }

        console.log('[CreateFromResponses] Context loaded successfully for', userName);

    } catch (error) {
        console.error('[CreateFromResponses] Error:', error);
        alert('Failed to load interview response. Please try again.');
    }
}

// Export to global scope
window.createInterviewFromResponses = createInterviewFromResponses;
window.createInterviewFromSingleResponse = createInterviewFromSingleResponse;

console.log('[CreateFromResponses] Module loaded');