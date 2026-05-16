// Report Management Module

export async function showReportDetails(reportId) {
    if (!reportId) {
        console.error("[showReportDetails] Report ID missing.");
        return;
    }

    const globalAudioPlayerElement = document.getElementById('globalAudioPlayerElement');
    if (globalAudioPlayerElement) {
        globalAudioPlayerElement.pause();
    }

    const reportContentBody = document.getElementById('reportContentBody');
    const adminReportContentBody = document.getElementById('adminReportContentBody');
    const interviewContentBody = document.getElementById('interviewContentBody');

    try {
        // Get Firebase auth token for secure authentication
        let headers = {};
        if (auth.currentUser) {
            const token = await auth.currentUser.getIdToken();
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const reportResponse = await fetch(`/api/reports/${reportId}`, { headers });
        if (!reportResponse.ok) throw new Error(`Failed to fetch report: ${reportResponse.status}`);
        const reportData = await reportResponse.json();

        const responsesResponse = await fetch(`/api/reports/${reportId}/responses`, { headers });
        if (!responsesResponse.ok) throw new Error(`Failed to fetch responses: ${responsesResponse.status}`);
        const responsesData = await responsesResponse.json();

        if (reportData.report_content) {
            let reportTextForMarkdown = reportData.report_content;
            reportTextForMarkdown = reportTextForMarkdown.replace(
                /<audio_clip[^>]*>([\s\S]*?)<\/audio_clip>/gi,
                (match, audioContent) => {
                    const contentStr = String(audioContent || "").trim();
                    if (!contentStr) return "";
                    const parsedClipContent = marked.parse(contentStr);
                    return `<blockquote>${parsedClipContent}</blockquote>`;
                }
            );
            if (reportContentBody) {
                reportContentBody.innerHTML = marked.parse(reportTextForMarkdown);
            }
        } else {
            if (reportContentBody) reportContentBody.innerHTML = '<p class="text-gray-400 italic">No report content available.</p>';
        }

        if (reportData.admin_report_content) {
            let adminReportTextForMarkdown = reportData.admin_report_content;
            adminReportTextForMarkdown = adminReportTextForMarkdown.replace(
                /<audio_clip[^>]*>([\s\S]*?)<\/audio_clip>/gi,
                (match, audioContent) => {
                    const contentStr = String(audioContent || "").trim();
                    if (!contentStr) return "";
                    const parsedClipContent = marked.parse(contentStr);
                    return `<blockquote>${parsedClipContent}</blockquote>`;
                }
            );
            if (adminReportContentBody) {
                adminReportContentBody.innerHTML = marked.parse(adminReportTextForMarkdown);
            }
        } else {
            if (adminReportContentBody) adminReportContentBody.innerHTML = '<p class="text-gray-400 italic">No admin report content available.</p>';
        }

        if (interviewContentBody) {
            interviewContentBody.innerHTML = formatInterviewTranscript(responsesData.responses, reportId);
        }

    } catch (error) {
        console.error('[showReportDetails] Error loading report details:', error);
        if (interviewContentBody) interviewContentBody.innerHTML = `<p class="text-red-500">Error loading transcript: ${error.message}</p>`;
        if (reportContentBody) reportContentBody.innerHTML = `<p class="text-red-500">Error loading report: ${error.message}</p>`;
        if (adminReportContentBody) adminReportContentBody.innerHTML = `<p class="text-red-500">Error loading admin report: ${error.message}</p>`;
    }
}

export function formatInterviewTranscript(responses, reportId) {
    if (!responses || responses.length === 0) {
        return '<p class="text-gray-400 italic">No interview transcript available for this report.</p>';
    }
    let html = '';
    responses.forEach((res, index) => {
        html += `
            <div class="mb-4 pb-4 border-b border-gray-700">
                <p class="text-sm font-semibold text-gray-400 mb-1">Question ${index + 1}:</p>
                <p class="text-gray-200 mb-2">${res.question || '<em>Question not recorded</em>'}</p>
                <p class="text-sm font-semibold text-gray-400 mb-1">Answer:</p>
                <p class="text-gray-300 whitespace-pre-wrap mb-2">${res.answer || '<em>Answer not recorded</em>'}</p>
        `;
        if (res.audio_signed_url || res.video_signed_url) {
            html += `<div class="mt-2 flex gap-2">`;
            
            if (res.audio_signed_url) {
                html += `
                    <button class="play-transcript-item-audio-btn primary-button text-xs py-1 px-2" 
                            data-audio-url="${res.audio_signed_url}" 
                            data-audio-type="transcriptItem"
                            data-track-title="${res.question ? 'Q: ' + res.question.substring(0,30).replace(/\\n/g, ' ')+'...' : 'Transcript item'}"
                            data-track-artist="Transcript Segment for Report: ${reportId || 'N/A'}"
                            title="Play Transcript Segment">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block play-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" /></svg>
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block pause-icon hidden" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" /></svg>
                        Play Audio
                    </button>
                `;
            }
            
            if (res.video_signed_url) {
                html += `
                    <button class="play-transcript-video-btn secondary-button text-xs py-1 px-2" 
                            data-video-url="${res.video_signed_url}"
                            data-qa-index="${index}"
                            title="Play Response Video">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                        Play Video
                    </button>
                `;
            }
            
            html += `</div>`;
        }
        html += `</div>`;
    });
    return html;
}

export async function regenerateReportAdmin(reportId, buttonElement) {
    if (!reportId) {
        alert('Report ID is missing for regeneration.');
        return;
    }

    const originalButtonText = buttonElement.textContent;
    buttonElement.disabled = true;
    buttonElement.textContent = 'Regenerating...';

    const adminReportContentBody = document.getElementById('adminReportContentBody');
    if (adminReportContentBody) {
        adminReportContentBody.innerHTML = '<p class="text-gray-400 animate-pulse">Regenerating admin report...</p>';
    }

    try {
        const response = await fetch(`/api/reports/${reportId}/regenerate-admin-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        const result = await response.json();

        if (adminReportContentBody) {
            if (result.admin_report_content) {
                let adminReportTextForMarkdown = result.admin_report_content;
                adminReportTextForMarkdown = adminReportTextForMarkdown.replace(
                    /<audio_clip[^>]*>([\s\S]*?)<\/audio_clip>/gi,
                    (match, audioContent) => {
                        const contentStr = String(audioContent || "").trim();
                        if (!contentStr) return "";
                        const parsedClipContent = marked.parse(contentStr);
                        return `<blockquote>${parsedClipContent}</blockquote>`;
                    }
                );
                adminReportContentBody.innerHTML = marked.parse(adminReportTextForMarkdown);
            } else {
                adminReportContentBody.innerHTML = '<p class="text-gray-400 italic">Admin report regenerated, but no content was returned.</p>';
            }
        }
        alert('Admin report regenerated successfully.');

    } catch (error) {
        console.error('Error regenerating admin report:', error);
        alert(`Failed to regenerate admin report: ${error.message}`);
        if (adminReportContentBody) {
            adminReportContentBody.innerHTML = `<p class="text-red-500">Error regenerating: ${error.message}</p>`;
        }
    } finally {
        buttonElement.disabled = false;
        buttonElement.textContent = originalButtonText;
    }
}

export async function regenerateUserReport(reportId, buttonElement) {
    if (!reportId) {
        alert('Report ID is missing for regeneration.');
        return;
    }

    const originalButtonText = buttonElement.textContent;
    buttonElement.disabled = true;
    buttonElement.textContent = 'Regenerating...';

    const reportContentBody = document.getElementById('reportContentBody');
    if (reportContentBody) {
        reportContentBody.innerHTML = '<p class="text-gray-400 animate-pulse">Regenerating user-facing summary...</p>';
    }

    try {
        // Get Firebase auth token if available
        let headers = { 'Content-Type': 'application/json' };
        if (auth.currentUser) {
            const token = await auth.currentUser.getIdToken();
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/reports/${reportId}/regenerate-user-report`, {
            method: 'POST',
            headers: headers,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        const result = await response.json();

        if (reportContentBody) {
            if (result.report_content) {
                let reportTextForMarkdown = result.report_content;
                reportTextForMarkdown = reportTextForMarkdown.replace(
                    /<audio_clip[^>]*>([\s\S]*?)<\/audio_clip>/gi,
                    (match, audioContent) => {
                        const contentStr = String(audioContent || "").trim();
                        if (!contentStr) return "";
                        const parsedClipContent = marked.parse(contentStr);
                        return `<blockquote>${parsedClipContent}</blockquote>`;
                    }
                );
                reportContentBody.innerHTML = marked.parse(reportTextForMarkdown);
            } else {
                reportContentBody.innerHTML = '<p class="text-gray-400 italic">User-facing summary regenerated, but no content was returned.</p>';
            }
        }
        alert('User-facing summary regenerated successfully.');

    } catch (error) {
        console.error('Error regenerating user-facing summary:', error);
        alert(`Failed to regenerate user-facing summary: ${error.message}`);
        if (reportContentBody) {
            reportContentBody.innerHTML = `<p class="text-red-500">Error regenerating: ${error.message}</p>`;
        }
    } finally {
        buttonElement.disabled = false;
        buttonElement.textContent = originalButtonText;
    }
} 