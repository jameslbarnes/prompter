// Transcript Manager
import { escapeXml } from './report-utils.js';

// Load transcript content independently
export async function loadTranscriptContent(reportId, isPublicReport = false, publicReportId = null) {
    const transcriptDisplayArea = document.getElementById('transcriptContent');
    if (!transcriptDisplayArea || (!reportId && !publicReportId)) return;

    console.log('[loadTranscriptContent] Loading transcript for report:', reportId, 'isPublic:', isPublicReport, 'publicId:', publicReportId);
    transcriptDisplayArea.innerHTML = '<p class="text-gray-400">Loading transcript...</p>';

    try {
        let responsesResponse;
        if (isPublicReport && publicReportId) {
            // Fetch from public report endpoint
            responsesResponse = await fetch(`/api/public-reports/${publicReportId}/responses`);
        } else {
            // Fetch from regular report endpoint
            responsesResponse = await fetch(`/api/reports/${reportId}/responses`);
        }
        console.log('[loadTranscriptContent] Responses API response status:', responsesResponse.status);
        
        if (responsesResponse.ok) {
            const responsesData = await responsesResponse.json();
            console.log('[loadTranscriptContent] Responses data received, count:', responsesData.responses ? responsesData.responses.length : 0);
            
            const formattedTranscript = formatInterviewTranscript(responsesData.responses || [], reportId);
            transcriptDisplayArea.innerHTML = formattedTranscript;
            
            const playButtons = transcriptDisplayArea.querySelectorAll('.play-transcript-audio-btn');
            console.log('[loadTranscriptContent] Transcript loaded successfully, play buttons:', playButtons.length);
        } else {
            console.error('[loadTranscriptContent] Failed to load responses:', responsesResponse.status);
            transcriptDisplayArea.innerHTML = '<p class="text-red-400">Error loading transcript</p>';
        }
    } catch (error) {
        console.error('[loadTranscriptContent] Error:', error);
        transcriptDisplayArea.innerHTML = '<p class="text-red-400">Error loading transcript data</p>';
    }
}

// Format interview transcript
export function formatInterviewTranscript(responses, reportId) {
    if (!responses || responses.length === 0) {
        return '<p class="text-gray-400">No transcript available</p>';
    }

    console.log('[formatInterviewTranscript] Processing', responses.length, 'responses');

    // Filter out responses that don't have actual answers
    const validResponses = responses.filter(qa => {
        const hasAnswer = qa.answer !== null && 
            qa.answer !== undefined &&
            qa.answer !== 'null' &&  // Check for string "null"
            qa.answer.trim() !== '' && 
            qa.answer.trim() !== 'Answer not recorded';
        return hasAnswer;
    });

    if (validResponses.length === 0) {
        return '<p class="text-gray-400">No answered questions available</p>';
    }

    return validResponses.map((qa, index) => {
        const questionText = (qa.question || 'Question not recorded').replace(/<\/?question>/gi, '');
        const answerText = qa.answer || 'Answer not recorded';
        const hasAudio = qa.audio_signed_url;
        const hasVideo = qa.video_signed_url;
        
        console.log(`[formatInterviewTranscript] Q${index + 1}: hasAudio=${!!hasAudio}, hasVideo=${!!hasVideo}`);
        
        const escapedQuestion = escapeXml(questionText);
        const escapedAnswer = escapeXml(answerText);

        return `
            <div class="qa-pair">
                <div class="flex justify-between items-start mb-2">
                    <div class="qa-question">${escapedQuestion}</div>
                    <div class="flex gap-2 items-center">
                        ${hasVideo ? `
                            <button class="play-transcript-video-btn p-2 rounded-full hover:bg-opacity-20 hover:bg-white transition-colors" 
                                    data-video-url="${qa.video_signed_url}"
                                    data-qa-index="${index}"
                                    title="Play Response Video">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-accent-primary" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                </svg>
                            </button>
                        ` : ''}
                        ${hasAudio ? `
                            <button class="play-transcript-audio-btn p-2 rounded-full hover:bg-opacity-20 hover:bg-white transition-colors" 
                                    data-audio-url="${qa.audio_signed_url}"
                                    data-track-title="${escapedQuestion}"
                                    data-track-artist="Interview Response"
                                    title="Play Response Audio"
                                    onclick="console.log('Button clicked directly:', this.dataset.audioUrl);">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 play-icon text-accent-primary" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
                                </svg>
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 pause-icon hidden text-accent-primary" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" />
                                </svg>
                            </button>
                        ` : ''}
                        ${!hasAudio && !hasVideo ? `
                            <div class="text-xs text-gray-500 italic p-2">No media available</div>
                        ` : ''}
                    </div>
                </div>
                <div class="qa-answer">${escapedAnswer}</div>
            </div>
        `;
    }).join('');
}