// Question generation utility module
const admin = require('firebase-admin');

/**
 * Check if a user has completed previous interviews for a given template
 * @param {Object} params - Parameters for checking previous interviews
 * @param {string} params.userEmail - User's email address
 * @param {string} params.interviewId - Interview template ID
 * @param {Object} params.db - Firestore database instance
 * @param {string} params.sessionId - Current session ID for logging
 * @returns {Promise<Object|null>} Previous interview data or null if none found
 */
async function checkForPreviousInterviews({ userEmail, interviewId, db, sessionId }) {
    try {
        console.log(`[${sessionId}] Checking for previous interview responses for user: ${userEmail}`);
        
        // Since interview_id might be null in report documents, we need a different approach
        // First, get all reports for this user (including incomplete ones for debugging)
        const previousReportsQuery = await db.collection('reports')
            .where('user_email', '==', userEmail)
            .orderBy('start_timestamp', 'desc')
            .limit(20) // Get more reports to filter through
            .get();
        
        if (previousReportsQuery.empty) {
            return null;
        }
        
        console.log(`[${sessionId}] Found ${previousReportsQuery.size} completed report(s) for this user`);
        
        // Collect Q&A pairs from previous interviews that match the interview ID
        const previousQAPairs = [];
        let matchingReports = 0;
        let lastMatchingReportDate = null;
        
        for (const reportDoc of previousReportsQuery.docs) {
            const reportId = reportDoc.id;
            const reportData = reportDoc.data();
            
            // Get the first response to check the interview_id
            const firstResponseQuery = await db.collection('reports').doc(reportId).collection('responses')
                .orderBy('timestamp', 'asc')
                .limit(1)
                .get();
            
            if (!firstResponseQuery.empty) {
                const firstResponse = firstResponseQuery.docs[0].data();
                
                // Check if this report is for the same interview template
                if (firstResponse.interview_id === interviewId) {
                    matchingReports++;
                    
                    // This is a matching interview, get all responses
                    const responsesSnapshot = await db.collection('reports').doc(reportId).collection('responses')
                        .orderBy('timestamp', 'asc')
                        .get();
                    
                    responsesSnapshot.forEach(responseDoc => {
                        const response = responseDoc.data();
                        previousQAPairs.push({
                            question: response.question,
                            answer: response.answer,
                            timestamp: response.timestamp
                        });
                    });
                    
                    // Track the date of the most recent matching report
                    if (!lastMatchingReportDate && reportData.start_timestamp) {
                        lastMatchingReportDate = reportData.start_timestamp.toDate();
                    }
                    
                    // Limit to 5 matching interviews
                    if (matchingReports >= 5) {
                        break;
                    }
                }
            }
        }
        
        if (previousQAPairs.length > 0) {
            console.log(`[${sessionId}] Found ${matchingReports} matching interview(s) with ${previousQAPairs.length} total Q&A pairs`);
            return {
                qaPairs: previousQAPairs,
                interviewCount: matchingReports,
                lastInterviewDate: lastMatchingReportDate
            };
        }
        
        return null;
    } catch (error) {
        console.error(`[${sessionId}] Error checking for previous interviews:`, error);
        return null;
    }
}

/**
 * Build memory context string for inclusion in prompts
 * @param {Object} params - Parameters for building memory context
 * @param {Object} params.memoryContext - Memory context from memory service
 * @param {Object} params.previousInterviewData - Previous interview data from Firestore
 * @param {boolean} params.shouldGenerateContinuationQuestion - Whether to generate continuation question
 * @returns {string} Formatted memory context string
 */
function buildMemoryContextString({ memoryContext, previousInterviewData, shouldGenerateContinuationQuestion }) {
    let memoryContextString = '';
    
    // Add memory service context if available
    if (memoryContext && memoryContext.hasHistory) {
        if (memoryContext.graphContext?.previousSessions > 0) {
            memoryContextString += `This user has completed ${memoryContext.graphContext.previousSessions} previous session(s) with this interview.\n\n`;
        }
        
        if (memoryContext.memories.length > 0) {
            memoryContextString += 'Relevant memories from past interactions:\n';
            memoryContext.memories.forEach((memory, idx) => {
                memoryContextString += `${idx + 1}. ${memory.memory}\n`;
            });
        }
    }
    
    // Add previous interview data for continuation questions
    if (shouldGenerateContinuationQuestion && previousInterviewData) {
        memoryContextString += '\n\n<previous_interview_responses>\n';
        memoryContextString += `User has completed ${previousInterviewData.interviewCount} previous interview(s) for this template.\n`;
        if (previousInterviewData.lastInterviewDate) {
            memoryContextString += `Last interview was on ${previousInterviewData.lastInterviewDate.toLocaleDateString()}.\n\n`;
        }
        memoryContextString += 'Previous Q&A pairs:\n';
        previousInterviewData.qaPairs.forEach((qa, idx) => {
            memoryContextString += `\nQ${idx + 1}: ${qa.question}\n`;
            memoryContextString += `A${idx + 1}: ${qa.answer}\n`;
        });
        memoryContextString += '\n</previous_interview_responses>\n';
        memoryContextString += '\nIMPORTANT: Since this user has already completed this interview before, generate a NEW first question that:';
        memoryContextString += '\n1. Acknowledges their previous responses';
        memoryContextString += '\n2. Explores new angles or goes deeper into areas they mentioned';
        memoryContextString += '\n3. Avoids repeating the exact same questions they already answered';
        memoryContextString += '\n4. Builds upon their previous insights to create a richer conversation\n';
    }
    
    return memoryContextString;
}

/**
 * Handle static first question generation
 * @param {Object} params - Parameters for static question
 * @param {string} params.firstQuestionText - The static first question text
 * @param {Object} params.sessionInfo - Session information
 * @param {Object} params.socket - Socket instance
 * @param {string} params.sessionId - Session ID
 * @param {Function} params.generateSpeechFromText - Function to generate speech
 * @returns {boolean} Whether static question was successfully handled
 */
async function handleStaticFirstQuestion({ firstQuestionText, sessionInfo, socket, sessionId, generateSpeechFromText }) {
    console.log("\n==== STATIC FIRST QUESTION (FROM CUSTOM PROMPT) ====");
    console.log("Using customPrompt directly as the first question:", firstQuestionText);
    console.log("Custom prompt type:", typeof firstQuestionText, "Length:", firstQuestionText ? firstQuestionText.length : 0);
    console.log("===================================================\n");

    // Validate that customPrompt is a non-empty string
    if (typeof firstQuestionText !== 'string' || firstQuestionText.trim() === '') {
        console.error('Custom prompt is invalid or empty. Falling back to dynamic generation.');
        return false;
    }
    
    socket.emit('thinkingStarted'); // Emit for UI consistency
    
    const assistantQuestionObject = {
        text: firstQuestionText,
        thinkingBlock: null // No Claude thinking block for a static question
    };
    sessionInfo.assistantQuestions.push(assistantQuestionObject);

    socket.emit('thinkingComplete'); // Thinking is "done"
    
    // Verbalize the static first question by streaming
    if (firstQuestionText && firstQuestionText.trim() !== '') {
        console.log(`[${sessionId}] Attempting to stream speech for static first question: "${firstQuestionText.substring(0, 50)}..."`);
        // No await here, let it stream in background. Error handling is inside generateSpeechFromText.
        generateSpeechFromText(firstQuestionText, socket).catch(ttsStreamError => {
             // Catch errors from the promise itself if generateSpeechFromText was async and threw before starting stream
            console.error(`[${sessionId}] Error initiating speech stream for static question:`, ttsStreamError);
        });
    }

    socket.emit('responseComplete', firstQuestionText);

    // Don't log the first question here - it will be logged when the user answers it
    // This prevents duplicate entries with null answers
    
    sessionInfo.firstQuestionThinking = null; 
    sessionInfo.lastFullPrompt = "Static question from custom prompt: " + firstQuestionText; // For logging history

    return true;
}

/**
 * Build conversation history messages for Claude API
 * @param {Object} params - Parameters
 * @param {Array} params.assistantQuestions - Array of assistant questions
 * @param {Array} params.interviewResponses - Array of user responses
 * @param {boolean} params.isFollowUp - Whether this is a follow-up question
 * @returns {Array} Messages array for Claude API
 */
function buildConversationHistory({ assistantQuestions, interviewResponses, isFollowUp }) {
    const messages = [];
    const historyLength = Math.min(assistantQuestions.length, interviewResponses.length);
    
    // Add conversation history if this is a follow-up question
    if (isFollowUp && historyLength > 0) {
        for (let i = 0; i < historyLength; i++) {
            // Add assistant message with thinking block if available
            const assistantQuestion = assistantQuestions[i];
            let assistantMessage = {
                role: "assistant"
            };

            // Format content appropriately based on what we have
            // IMPORTANT: Per Claude docs, thinking blocks must be passed back UNMODIFIED
            // "Include the complete unmodified block back to the API to maintain reasoning continuity"
            if (assistantQuestion.thinkingBlock && assistantQuestion.text) {
                // We have both thinking block and text - use array format
                // Pass thinking block completely unchanged (no modifications)
                assistantMessage.content = [
                    assistantQuestion.thinkingBlock,  // Pass unmodified
                    { type: "text", text: assistantQuestion.text }
                ];
            } else if (assistantQuestion.text) {
                // Just text, no thinking block
                assistantMessage.content = assistantQuestion.text;
            } else if (typeof assistantQuestion === 'string') {
                // Handle legacy format where question is just a string
                assistantMessage.content = assistantQuestion;
            } else {
                console.warn("Unexpected assistant question format:", assistantQuestion);
                // Fallback to empty string
                assistantMessage.content = "";
            }
            
            messages.push(assistantMessage);

            // User Response - add cache control for the last response
            if (i === historyLength - 1) {
                // Last user response - add cache control
                messages.push({
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: interviewResponses[i],
                            cache_control: {"type": "ephemeral"}
                        }
                    ]
                });
            } else {
                messages.push({
                    role: "user",
                    content: interviewResponses[i]
                });
            }
        }
    }
    
    return messages;
}

module.exports = {
    checkForPreviousInterviews,
    buildMemoryContextString,
    handleStaticFirstQuestion,
    buildConversationHistory
};