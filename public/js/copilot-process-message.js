// Copilot Process Message Module

import { escapeXml } from './xml-utils.js';
import { handleEditorModeResponse } from './copilot-ai-processing.js';

export async function processMessageWithAI(userMessage, successCallback, errorCallback) {
    // Handle both string messages and message objects with images
    let messageText = userMessage;
    let imageData = null;
    
    if (typeof userMessage === 'object' && userMessage.text) {
        messageText = userMessage.text;
        imageData = userMessage.image;
        console.log('[processMessageWithAI] Received message with image:', {
            hasImage: !!imageData,
            imageType: imageData?.mimeType,
            imageSize: imageData?.base64?.length
        });
    }
    
    console.log('[processMessageWithAI] Called. Mode from appState:', window.appState.copilotMode, 'userMessage:', messageText.substring(0,100) + '...', 'CurrentEditingID from appState:', window.appState.currentEditingInterviewId);
    let callbackCalled = false;
    const invokeSuccessCallbackOnce = (response) => {
        if (!callbackCalled) {
            callbackCalled = true;
            successCallback(response);
        }
    };

    const specificationNullState = document.getElementById('specificationNullState'); 
    const originalSpecificationNullStateHTML = specificationNullState ? specificationNullState.innerHTML : ''; 
    let thinkingIndicator = document.getElementById('thinkingIndicator'); 

    try {
        let chatHistory = [];
        const db = window.firebase.firestore();
        
        const currentId = window.appState.currentEditingInterviewId;
        const currentCopilotMode = window.appState.copilotMode;
        const currentIsJournalAnalysisMode = window.appState.isJournalAnalysisMode;
        const initialMessagesFromAppState = window.appState.initialChatMessages;

        console.log(`[processMessageWithAI] Using appState: currentId=${currentId}, mode=${currentCopilotMode}, journalMode=${currentIsJournalAnalysisMode}, initialMsgCount=${initialMessagesFromAppState.length}`);

        if (currentId) {
            try {
                const chatCollectionName = currentCopilotMode === 'analyst' ? 'analystChat' : 'copilotChat';
                console.log(`[processMessageWithAI] Fetching chat history from: interviews/${currentId}/${chatCollectionName}`);
                
                const chatSnapshot = await db.collection('interviews').doc(currentId).collection(chatCollectionName).orderBy('timestamp', 'asc').get();
                console.log(`[processMessageWithAI] Found ${chatSnapshot.size} messages in Firestore`);
                
                chatSnapshot.forEach(doc => {
                    const data = doc.data();
                    
                    // Skip system messages - they should not be in the chat history
                    if (data.sender === 'system') {
                        console.log(`[processMessageWithAI] Skipping system message:`, {
                            docId: doc.id,
                            contentLength: data.content ? data.content.length : 0,
                            contentPreview: data.content ? data.content.substring(0, 50) + '...' : 'null'
                        });
                        return;
                    }
                    
                    let role = 'user';
                    if (data.sender === 'ai') {
                        role = 'assistant';
                    }
                    
                    console.log(`[processMessageWithAI] Adding message to history:`, {
                        docId: doc.id,
                        sender: data.sender,
                        role: role,
                        contentLength: data.content ? data.content.length : 0,
                        contentPreview: data.content ? data.content.substring(0, 50) + '...' : 'null'
                    });
                    chatHistory.push({
                        role: role,
                        content: data.content
                    });
                });
                
                console.log(`[processMessageWithAI] Total chat history length: ${chatHistory.length}`);
            } catch (err) {
                console.error("Error fetching chat history from Firestore:", err);
            }
        } else {
             initialMessagesFromAppState.forEach(msg => {
                 // Skip system messages for initial messages too
                 if (msg.sender === 'system') {
                     console.log('[processMessageWithAI] Skipping system message in initial messages');
                     return;
                 }
                 chatHistory.push({
                     role: msg.sender === 'ai' ? 'assistant' : 'user',
                     content: msg.content
                 });
             });
        }

        let apiMessages = [...chatHistory];
        console.log(`[processMessageWithAI] Initial apiMessages length: ${apiMessages.length}`);

        // Only add to apiMessages if not in journal mode
        if (!currentIsJournalAnalysisMode) {
            // Remove duplicate messages
            while (apiMessages.length >= 2 &&
                   apiMessages[apiMessages.length - 1].role === 'user' &&
                   apiMessages[apiMessages.length - 1].content === messageText &&
                   apiMessages[apiMessages.length - 1].content === apiMessages[apiMessages.length - 2].content) {
                console.log('[processMessageWithAI] Removing duplicate user message');
                apiMessages.pop(); 
            }
            
            const lastApiMessage = apiMessages[apiMessages.length - 1];
            const shouldAddCurrentUserMessage = !lastApiMessage || lastApiMessage.role !== 'user' || lastApiMessage.content !== messageText;
            
            console.log('[processMessageWithAI] Should add current user message?', shouldAddCurrentUserMessage, {
                hasLastMessage: !!lastApiMessage,
                lastMessageRole: lastApiMessage?.role,
                lastMessageMatches: lastApiMessage?.content === messageText
            });

            if (shouldAddCurrentUserMessage) {
                // If we have an image, create a message with both text and image content
                if (imageData) {
                    apiMessages.push({ 
                        role: 'user', 
                        content: [
                            { type: 'text', text: messageText },
                            { 
                                type: 'image', 
                                source: {
                                    type: 'base64',
                                    media_type: imageData.mimeType,
                                    data: imageData.base64
                                }
                            }
                        ]
                    });
                    console.log('[processMessageWithAI] Added user message with image to apiMessages');
                } else {
                    apiMessages.push({ role: 'user', content: messageText });
                    console.log('[processMessageWithAI] Added current user message to apiMessages');
                }
            }
        }
        
        console.log(`[processMessageWithAI] Final apiMessages being sent to AI:`, {
            count: apiMessages.length,
            messages: apiMessages.map(m => ({
                role: m.role,
                contentLength: m.content?.length || 0,
                contentPreview: m.content ? m.content.substring(0, 50) + '...' : 'null'
            }))
        });

        if (currentIsJournalAnalysisMode && currentCopilotMode === 'analyst') {
            const emailFilterDropdown = document.getElementById('emailFilterDropdown');
            const targetEmail = emailFilterDropdown ? emailFilterDropdown.value : 'all';
            if (targetEmail !== 'all' && !targetEmail) {
                invokeSuccessCallbackOnce("Could not determine the target user for journal analysis. Please select a user or 'All Users' from the filter.");
                if(thinkingIndicator) thinkingIndicator.classList.add('hidden');
                return;
            }
            try {
                let allJournalQaContent = '';
                let reportsQuery = db.collection('reports');
                if (targetEmail === 'all') {
                    reportsQuery = reportsQuery.orderBy('start_timestamp', 'desc');
                } else {
                    reportsQuery = reportsQuery.where('user_email', '==', targetEmail).orderBy('start_timestamp', 'desc');
                }
                const journalReportsSnapshot = await reportsQuery.get();
                if (journalReportsSnapshot.empty) {
                    invokeSuccessCallbackOnce(targetEmail === 'all' ? "No journal entries (past interviews) found across all users to analyze." : `No journal entries (past interviews) found for ${targetEmail} to analyze.`);
                     if(thinkingIndicator) thinkingIndicator.classList.add('hidden');
                    return;
                }
                let journalEntryCount = 0;
                for (const reportDoc of journalReportsSnapshot.docs) {
                    journalEntryCount++;
                    const reportData = reportDoc.data();
                    const interviewTitle = reportData.interview_title || 'Untitled Interview Session';
                    let entryDate = 'Date N/A';
                    if (reportData.start_timestamp?.toDate) {
                        entryDate = reportData.start_timestamp.toDate().toLocaleDateString();
                    } else if (reportData.start_timestamp) {
                        entryDate = new Date(reportData.start_timestamp).toLocaleDateString();
                    }
                    allJournalQaContent += `--- Journal Entry ${journalEntryCount} (Title: ${escapeXml(interviewTitle)}, Date: ${entryDate}) ---\n`;
                    const responsesSnapshot = await db.collection('reports').doc(reportDoc.id).collection('responses').orderBy('timestamp', 'asc').get();
                    if (responsesSnapshot.empty) {
                        allJournalQaContent += "No Q&A pairs recorded for this journal entry.\n\n";
                        continue;
                    }
                    responsesSnapshot.forEach(doc => {
                        const qa = doc.data();
                        allJournalQaContent += `Q: ${escapeXml(qa.question)}\nA: ${escapeXml(qa.answer)}\n\n`;
                    });
                }
                if (!allJournalQaContent.trim()) {
                    invokeSuccessCallbackOnce("Found journal entries, but could not extract Q&A content for analysis.");
                    if(thinkingIndicator) thinkingIndicator.classList.add('hidden');
                    return;
                }
                let journalAnalystSystemPrompt = targetEmail === 'all' ? 
                    `You are an AI Analyst analyzing past interview responses across all users. You are the "Interview Feed Analyst" who helps admins understand trends and insights from their interview templates.\n\n<all_interview_reports_data>${allJournalQaContent}</all_interview_reports_data>\n\nBased on the interview data provided above, please help the admin understand patterns, insights, and trends. Be specific and reference actual responses when relevant.` :
                    `You are an AI Analyst analyzing past interview responses for ${targetEmail}. You are the "Interview Feed Analyst" who helps admins understand this specific user's responses across different interview sessions.\n\n<user_interview_reports_data user_email="${targetEmail}">${allJournalQaContent}</user_interview_reports_data>\n\nBased on the interview data provided above for ${targetEmail}, please help the admin understand this user's patterns, insights, and progression. Be specific and reference actual responses when relevant.`;
                
                // Build messages array from thread history
                const threadMessages = window.appState.currentThreadMessages || [];
                console.log('[processMessageWithAI] Thread messages for Claude:', threadMessages.length, 'messages');
                const journalClaudeMessages = threadMessages.map(msg => ({
                    role: msg.sender === 'assistant' ? 'assistant' : 'user',
                    content: msg.content
                }));
                
                // Add the current user message
                // Handle image for journal mode too
                if (imageData) {
                    journalClaudeMessages.push({
                        role: "user",
                        content: [
                            { type: 'text', text: messageText },
                            { 
                                type: 'image', 
                                source: {
                                    type: 'base64',
                                    media_type: imageData.mimeType,
                                    data: imageData.base64
                                }
                            }
                        ]
                    });
                } else {
                    journalClaudeMessages.push({role: "user", content: messageText});
                }

                // Enable streaming for real-time token delivery in journal mode
                let fullStreamedResponse = '';
                let isFirstToken = true;
                
                const response = await fetch('/api/claude', {
                    method: 'POST', headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ system: journalAnalystSystemPrompt, messages: journalClaudeMessages, model: "claude-opus-4-5", max_tokens: 4000, streamClient: true})
                });
                
                if (!response.ok) throw new Error(`API error in Journal Analyst Mode: ${response.status} - ${await response.text()}`);
                
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                
                function readChunk() {
                    return reader.read().then(({ done, value }) => {
                        if (done) {
                            console.log("[Journal Analyst Stream] Stream complete.");
                            // Stream is complete, message already saved in message_stop handler
                            return;
                        }
                        
                        const chunkText = decoder.decode(value, { stream: true });
                        const lines = chunkText.split('\n');
                        
                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                try {
                                    const jsonData = JSON.parse(line.substring(6));
                                    
                                    if (jsonData.type === 'content_delta' && jsonData.text) {
                                        fullStreamedResponse += jsonData.text;
                                        
                                        // For the first token, create a new AI message element
                                        if (isFirstToken) {
                                            // Create a new AI message in the chat that we can update
                                            const copilotMessagesEl = document.getElementById('copilotMessages');
                                            if (copilotMessagesEl) {
                                                const messageElement = document.createElement('div');
                                                messageElement.className = 'message ai-message animate-fade-in';
                                                messageElement.dataset.sender = 'ai';
                                                messageElement.id = 'streaming-journal-analyst-message';
                                                messageElement.innerHTML = `
                                                    <div class="message-content">
                                                        <div id="streaming-journal-content"></div>
                                                    </div>
                                                `;
                                                copilotMessagesEl.appendChild(messageElement);
                                                copilotMessagesEl.scrollTop = copilotMessagesEl.scrollHeight;
                                            }
                                            isFirstToken = false;
                                        }
                                        
                                        // Update the streaming content in real-time
                                        const streamingContentEl = document.getElementById('streaming-journal-content');
                                        if (streamingContentEl) {
                                            streamingContentEl.innerHTML = marked.parse(fullStreamedResponse.replace("[", "").replace("]", ""));
                                            // Auto-scroll to bottom
                                            const copilotMessagesEl = document.getElementById('copilotMessages');
                                            if (copilotMessagesEl) {
                                                copilotMessagesEl.scrollTop = copilotMessagesEl.scrollHeight;
                                            }
                                        }
                                    } else if (jsonData.type === 'message_stop') {
                                        console.log("[Journal Analyst Stream] Stream finished by server.");
                                        // Clean up the streaming element and finalize
                                        const streamingElement = document.getElementById('streaming-journal-analyst-message');
                                        if (streamingElement) {
                                            streamingElement.removeAttribute('id');
                                            const streamingContentEl = streamingElement.querySelector('#streaming-journal-content');
                                            if (streamingContentEl) {
                                                streamingContentEl.removeAttribute('id');
                                            }
                                        }
                                        
                                        // Note: Message saving is handled by appendAIMessage call, not here
                                        // to avoid duplication
                                        return;
                                    } else if (jsonData.type === 'error') {
                                        console.error("[Journal Analyst Stream] Error from server:", jsonData.message);
                                        throw new Error(jsonData.message || 'Unknown error during streaming.');
                                    }
                                } catch (e) {
                                    // Ignore JSON parsing errors for non-data lines
                                }
                            }
                        }
                        return readChunk();
                    });
                }
                
                await readChunk();
            } catch (journalAnalystError) {
                console.error('[Journal Analyst Mode] Error during journal analysis process:', journalAnalystError);
                invokeSuccessCallbackOnce(`Sorry, I encountered an error during journal analysis: ${journalAnalystError.message}`);
            }
            if(thinkingIndicator) thinkingIndicator.classList.add('hidden');
            return; 
        }

        if (currentCopilotMode === 'editor') {
            await processEditorMode(apiMessages, invokeSuccessCallbackOnce, errorCallback, thinkingIndicator, specificationNullState, originalSpecificationNullStateHTML);
        } else if (currentCopilotMode === 'analyst' && !currentIsJournalAnalysisMode) {
            // For analyst mode, build messages from the current analyst thread instead of chat history
            const analystThreadMessages = window.appState.currentAnalystThreadMessages || [];
            console.log('[processMessageWithAI] Building analyst messages from thread:', analystThreadMessages.length, 'messages');
            
            const analystApiMessages = analystThreadMessages.map(msg => ({
                role: msg.sender === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            }));
            
            // Add the current user message
            // Handle image for analyst mode too
            if (imageData) {
                analystApiMessages.push({ 
                    role: 'user', 
                    content: [
                        { type: 'text', text: messageText },
                        { 
                            type: 'image', 
                            source: {
                                type: 'base64',
                                media_type: imageData.mimeType,
                                data: imageData.base64
                            }
                        }
                    ]
                });
            } else {
                analystApiMessages.push({ role: 'user', content: messageText });
            }
            
            await processAnalystMode(analystApiMessages, invokeSuccessCallbackOnce, thinkingIndicator);
        } else {
            console.error("Unknown copilot mode or state combination in processMessageWithAI:", currentCopilotMode, "Journal Mode:", currentIsJournalAnalysisMode);
            invokeSuccessCallbackOnce("Error: Unknown copilot mode or invalid state.");
        }
    } catch (error) {
        console.error('Error processing with AI:', error);
        if(thinkingIndicator) thinkingIndicator.classList.add('hidden');
        const isFirstSpecGenerationError = !window.appState.currentEditingInterviewId && window.appState.copilotMode === 'editor'; 
        if (specificationNullState && isFirstSpecGenerationError && originalSpecificationNullStateHTML) {
            specificationNullState.innerHTML = originalSpecificationNullStateHTML; 
            specificationNullState.style.position = ''; // Reset position
        }
        errorCallback(error);
    }
}

async function processEditorMode(apiMessages, invokeSuccessCallbackOnce, errorCallback, thinkingIndicator, specificationNullState, originalSpecificationNullStateHTML) {
    let systemPromptForClaude = '';

    // Load context files from Firestore if available
    let contextContent = '';
    const currentInterviewId = window.appState.currentEditingInterviewId;
    
    // FIRST: Check for context files in appState (for new interviews)
    if (!currentInterviewId && window.appState.copilotContextFiles && window.appState.copilotContextFiles.length > 0) {
        console.log('[processEditorMode] Found context files for new interview:', window.appState.copilotContextFiles.length);
        contextContent = '\n\n<context_documents>\n';
        
        for (const fileInfo of window.appState.copilotContextFiles) {
            contextContent += `--- Document: ${fileInfo.name} ---\n${fileInfo.content}\n\n`;
        }
        
        contextContent += '</context_documents>\n\n';
        console.log('[processEditorMode] Prepared context from copilotContextFiles, length:', contextContent.length);
    }
    
    if (currentInterviewId) {
        try {
            const db = window.firebase.firestore();
            const interviewDoc = await db.collection('interviews').doc(currentInterviewId).get();
            
            if (interviewDoc.exists) {
                const interviewData = interviewDoc.data();
                if (interviewData.contextFiles && interviewData.contextFiles.length > 0) {
                    console.log('[processEditorMode] Found context files in Firestore:', interviewData.contextFiles.length);
                    
                    // We no longer cache context in apiMessages since system messages are not included
                    let cachedContext = null;
                    
                    if (!cachedContext || window.forceContextReload) {
                        if (window.forceContextReload) {
                            console.log('[processEditorMode] Force reloading context due to recent upload');
                            window.forceContextReload = false;
                        }
                        // Load context files content from server
                        console.log('[processEditorMode] Loading context files from server...');
                        console.log('[processEditorMode] Context files to load:', interviewData.contextFiles);
                        try {
                            // Get auth token
                            let headers = {};
                            if (window.firebase && window.firebase.auth().currentUser) {
                                const idToken = await window.firebase.auth().currentUser.getIdToken();
                                headers['Authorization'] = `Bearer ${idToken}`;
                                console.log('[processEditorMode] Added auth token to headers');
                            } else {
                                console.warn('[processEditorMode] No auth token available');
                            }
                            
                            const contextUrl = `/api/interviews/${currentInterviewId}/context`;
                            console.log('[processEditorMode] Fetching context from:', contextUrl);
                            
                            const response = await fetch(contextUrl, { headers });
                            console.log('[processEditorMode] Context response status:', response.status);
                            
                            if (response.ok) {
                                const contextData = await response.json();
                                console.log('[processEditorMode] Context data received:', {
                                    hasContext: !!contextData.context,
                                    contextLength: contextData.context ? contextData.context.length : 0,
                                    contextPreview: contextData.context ? contextData.context.substring(0, 100) + '...' : 'null'
                                });
                                
                                if (contextData.context) {
                                    contextContent = `\n\n<context_documents>\n${contextData.context}\n</context_documents>\n\n`;
                                    console.log('[processEditorMode] Context content prepared, length:', contextContent.length);
                                    
                                    // Don't save context as a system message anymore - it's included in the system prompt
                                    console.log('[processEditorMode] Context loaded and will be included in system prompt');
                                } else {
                                    console.log('[processEditorMode] No context content in response');
                                }
                            } else {
                                const errorText = await response.text();
                                console.error('[processEditorMode] Context fetch failed:', response.status, errorText);
                            }
                        } catch (error) {
                            console.error('[processEditorMode] Error loading context from server:', error);
                        }
                    } else {
                        contextContent = cachedContext;
                    }
                }
            }
        } catch (error) {
            console.error('[processEditorMode] Error loading context files:', error);
        }
    }
    
    
    if (contextContent) {
        systemPromptForClaude = contextContent + systemPromptForClaude;
        systemPromptForClaude += '\n\nIMPORTANT: The user has uploaded document(s) as context for this interview. Consider how these documents relate to the interview specification you are creating or updating. Reference specific information from the context when relevant.';
    }

    // Check if this is truly a first generation or if the spec is essentially empty
    const currentSpec = window.appState.interviewSpec;
    const hasMinimumSpecContent = currentSpec.title && 
                                  currentSpec.title !== "Untitled Interview" && 
                                  currentSpec.initialPrompt && 
                                  currentSpec.followupPrompt;
    
    const isFirstSpecGeneration = !window.appState.currentEditingInterviewId || !hasMinimumSpecContent;

    if (!isFirstSpecGeneration) {
        systemPromptForClaude = buildUpdatePrompt(systemPromptForClaude);
    } else {
        systemPromptForClaude = buildFirstGenerationPrompt(systemPromptForClaude);
    }

    console.log("[Editor Mode] System Prompt for Claude (first 300 chars):", systemPromptForClaude.substring(0,300));
    console.log("[Editor Mode] isFirstSpecGeneration:", isFirstSpecGeneration, "hasMinimumSpecContent:", hasMinimumSpecContent);
    
    if (isFirstSpecGeneration) {
        await processFirstGenerationWithStreaming(systemPromptForClaude, apiMessages, invokeSuccessCallbackOnce, errorCallback, thinkingIndicator, specificationNullState, originalSpecificationNullStateHTML);
    } else {
        // Use streaming for updates too - same as first generation
        await processUpdateWithStreaming(systemPromptForClaude, apiMessages, invokeSuccessCallbackOnce, errorCallback, thinkingIndicator);
    }
}

async function processAnalystMode(apiMessages, invokeSuccessCallbackOnce, thinkingIndicator) {
    const db = window.firebase.firestore();
    
    // Check if we have cached data for this interview
    const cacheKey = `analyst_data_${window.appState.currentEditingInterviewId}`;
    const cachedData = window.appState[cacheKey];
    const cacheExpiry = window.appState[`${cacheKey}_expiry`];
    const now = Date.now();
    
    // Use cache if it exists and hasn't expired (5 minutes)
    if (cachedData && cacheExpiry && now < cacheExpiry) {
        console.log('[Analyst Mode] Using cached data, avoiding Firestore queries');
        
        // Restore the audio response data store from cache
        window.audioResponseDataStore = cachedData.audioResponseDataStore || {};
        
        // Process with cached data
        await processAnalystWithData(
            cachedData.analystSystemPrompt, 
            apiMessages, 
            invokeSuccessCallbackOnce, 
            thinkingIndicator
        );
        return;
    }
    
    // Clear previous response data store if not using cache
    window.audioResponseDataStore = {};
    
    if (!window.appState.currentEditingInterviewId) {
        invokeSuccessCallbackOnce("Please select an interview template from the list on the left to analyze its responses.");
        if(thinkingIndicator) thinkingIndicator.classList.add('hidden'); 
        return;
    }
    try {
        const interviewDoc = await db.collection('interviews').doc(window.appState.currentEditingInterviewId).get();
        if (!interviewDoc.exists) {
            invokeSuccessCallbackOnce("Error: Could not find the selected interview template details.");
            if(thinkingIndicator) thinkingIndicator.classList.add('hidden');
            return;
        }
        const interviewTemplateData = interviewDoc.data();
        const contextFileNames = interviewTemplateData.contextFiles?.map(f => f.name).join(', ') || 'None';

        let allQaContentForAnalyst = '';
        // Limit to most recent 50 reports to avoid rate limiting
        const reportsSnapshot = await db.collection('reports')
                                    .where('interview_id', '==', window.appState.currentEditingInterviewId)
                                    .orderBy('start_timestamp', 'desc')
                                    .limit(50)
                                    .get();
        
        if (reportsSnapshot.size === 50) {
            console.log('[Analyst Mode] Limited to 50 most recent reports to avoid rate limiting');
        }
        if (reportsSnapshot.empty) {
            invokeSuccessCallbackOnce("No responses found for this interview template to analyze.");
             if(thinkingIndicator) thinkingIndicator.classList.add('hidden');
            return;
        }
        let reportCount = 0;
        for (const reportDoc of reportsSnapshot.docs) {
            reportCount++;
            const reportData = reportDoc.data();
            const userName = reportData.user_name || reportData.userName || reportData.user_id || 'Anonymous User';
            const interviewTitleForReport = reportData.interview_title || 'Interview Session'; 
            allQaContentForAnalyst += `--- Interview Response ${reportCount} (User: ${userName}, Interview Title: ${escapeXml(interviewTitleForReport)}) ---\n`;
            const responsesSnapshot = await db.collection('reports').doc(reportDoc.id).collection('responses').orderBy('timestamp', 'asc').get();
            if (responsesSnapshot.empty) {
                allQaContentForAnalyst += "No Q&A pairs recorded for this response.\n\n";
                continue;
            }
            
            // Format responses with audio_response_id when available
            allQaContentForAnalyst += '<interview_responses>\n';
            responsesSnapshot.forEach(doc => {
                const qa = doc.data();
                allQaContentForAnalyst += `<qa_pair>\n`;
                
                // Add timestamp if available
                if (qa.timestamp) {
                    const timestampDate = qa.timestamp.toDate ? qa.timestamp.toDate() : new Date(qa.timestamp);
                    const formattedTimestamp = timestampDate.toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        timeZoneName: 'short'
                    });
                    allQaContentForAnalyst += `  <timestamp>${escapeXml(formattedTimestamp)}</timestamp>\n`;
                }
                
                // Add is_video flag
                const isVideo = !!qa.video_gcs_url;
                allQaContentForAnalyst += `  <is_video>${isVideo}</is_video>\n`;
                
                allQaContentForAnalyst += `  <question>${escapeXml(qa.question)}</question>\n`;
                
                // Check if this response has an audio ID
                const responseId = doc.id;
                console.log('[Analyst Data Prep] Response doc ID:', responseId, 'qa data:', {
                    has_audio: qa.has_audio,
                    audio_url: qa.audio_url,
                    audio_gcs_url: qa.audio_gcs_url,
                    video_gcs_url: qa.video_gcs_url,
                    is_video: isVideo,
                    hasAnyAudio: qa.has_audio || qa.audio_url || qa.audio_gcs_url
                });
                // Always store the response data for citation hovercards
                window.audioResponseDataStore[responseId] = {
                    question: qa.question,
                    answer: qa.answer,
                    timestamp: qa.timestamp,
                    isVideo: isVideo,
                    userName: userName,
                    interviewTitle: interviewTitleForReport,
                    hasAudio: qa.has_audio || qa.audio_url || qa.audio_gcs_url
                };
                
                if (qa.has_audio || qa.audio_url || qa.audio_gcs_url) {
                    allQaContentForAnalyst += `  <answer audio_response_id="${escapeXml(responseId)}">${escapeXml(qa.answer)}</answer>\n`;
                } else {
                    allQaContentForAnalyst += `  <answer audio_response_id="${escapeXml(responseId)}">${escapeXml(qa.answer)}</answer>\n`;
                }
                allQaContentForAnalyst += `</qa_pair>\n`;
            });
            allQaContentForAnalyst += '</interview_responses>\n\n';
        }
        if (!allQaContentForAnalyst.trim()) {
            invokeSuccessCallbackOnce("Found responses, but could not extract Q&A content for analysis.");
             if(thinkingIndicator) thinkingIndicator.classList.add('hidden');
            return;
        }
        // Extract the user's message from apiMessages to check for quote requests
        const lastUserMessage = apiMessages.length > 0 ? apiMessages[apiMessages.length - 1].content : '';
        
        // Check if the user is explicitly asking for quotes or if this is for video/audio generation
        const isRequestingQuotes = lastUserMessage && (
            lastUserMessage.toLowerCase().includes('quote') ||
            lastUserMessage.toLowerCase().includes('exact words') ||
            lastUserMessage.toLowerCase().includes('verbatim') ||
            lastUserMessage.toLowerCase().includes('script') ||
            lastUserMessage.toLowerCase().includes('video') ||
            lastUserMessage.toLowerCase().includes('audio summary')
        );

        let analystSystemPrompt = `You are an AI Analyst. Your task is to analyze interview responses collected from this specific interview template.

Template Details:
- Title: ${escapeXml(interviewTemplateData.title) || 'N/A'}
- Description: ${escapeXml(interviewTemplateData.description) || 'N/A'}
- Context Files: ${contextFileNames}

<all_interview_data>
${allQaContentForAnalyst}
</all_interview_data>

${isRequestingQuotes ? `CRITICAL INSTRUCTIONS FOR AUDIO CLIPS:
When you see an answer with an audio_response_id attribute like this:
<answer audio_response_id="x3K9mNp2Qr7B">I think AI will transform how we work</answer>

You MUST quote it like this:
<audio_clip id="x3K9mNp2Qr7B">I think AI will transform how we work</audio_clip>

IMPORTANT RULES FOR QUOTES:
- COPY THE EXACT ID from the audio_response_id attribute - do not modify it
- The IDs are Firestore document IDs that look like random strings
- NEVER create your own IDs like "response_1_qa_12_answer" or "qa_1_answer" 
- If an answer has audio_response_id="x3K9mNp2Qr7B", use <audio_clip id="x3K9mNp2Qr7B">
- Only use audio_clip tags for complete sentences from answers that have audio_response_id
- If an answer doesn't have audio_response_id, just quote it normally without audio_clip tags
- Do not ever attribute quotes to the interviewee that were not directly quoted in the response.` : `CRITICAL INSTRUCTIONS FOR CITATIONS:
When referencing interview responses, use inline citations instead of direct quotes. For example:
- "Participants expressed concern about AI's impact on employment [1]"
- "The majority believe remote work will continue to be prevalent [2,3]"

When you see an answer with an audio_response_id attribute like this:
<answer audio_response_id="x3K9mNp2Qr7B">I think AI will transform how we work</answer>

Create a citation reference like this:
<citation id="x3K9mNp2Qr7B">[1]</citation>

IMPORTANT RULES FOR CITATIONS:
- Use inline citations [1], [2], etc. when referencing interview content
- COPY THE EXACT ID from the audio_response_id attribute - do not modify it
- Paraphrase and synthesize responses rather than quoting directly
- Include the citation immediately after the paraphrased content
- Only create citations for answers that have audio_response_id
- Number citations sequentially as they appear in your analysis`}

UNDERSTANDING THE RESPONSE FORMAT:
- Each <qa_pair> includes an <is_video> tag that indicates if the response was recorded as video (true) or audio-only (false)
- Video responses contain both audio and visual elements from the interviewee
- When <is_video>true</is_video>, consider that the response includes non-verbal communication
- When <is_video>false</is_video>, the response is audio-only

Based on all the information provided above, please analyze the interview responses and provide insights about:
1. Common themes and patterns across responses${isRequestingQuotes ? ' - include specific quotes using <audio_clip> tags where audio is available' : ' - use inline citations to reference specific responses'}
2. Notable differences or unique perspectives${isRequestingQuotes ? ' - support with direct quotes' : ' - reference with citations'}
3. Key insights that emerge from the collective data${isRequestingQuotes ? ' - use quotes to illustrate points' : ' - support with citations'}
4. Actionable recommendations based on the findings
5. Any surprising or unexpected findings${isRequestingQuotes ? ' - include relevant quotes' : ' - cite specific responses'}

${isRequestingQuotes ? 
'Be specific and reference actual responses when making your points. Use direct quotes with <audio_clip> tags whenever audio is available to bring the voices of the interviewees into your analysis.' : 
'Be specific and reference actual responses when making your points. Use inline citations to connect your analysis to specific interview responses. Citations will be hoverable for readers to see the full response.'} Your analysis should help the interview creator understand what they've learned from conducting these interviews.`;
        
        console.log('[Analyst Mode] Sample of data being sent to LLM (first 2000 chars):', allQaContentForAnalyst.substring(0, 2000));
        
        // Also log a specific example of an answer with audio_response_id
        const audioAnswerMatch = allQaContentForAnalyst.match(/<answer audio_response_id="([^"]+)">([^<]+)<\/answer>/);
        if (audioAnswerMatch) {
            console.log('[Analyst Mode] Example answer with audio:', {
                fullMatch: audioAnswerMatch[0],
                id: audioAnswerMatch[1],
                answer: audioAnswerMatch[2].substring(0, 100) + '...'
            });
        } else {
            console.log('[Analyst Mode] WARNING: No answers with audio_response_id found in the data!');
        }
        
        // Cache the data for future requests (5 minute expiry)
        const cacheKey = `analyst_data_${window.appState.currentEditingInterviewId}`;
        window.appState[cacheKey] = {
            analystSystemPrompt: analystSystemPrompt,
            audioResponseDataStore: { ...window.audioResponseDataStore }
        };
        window.appState[`${cacheKey}_expiry`] = Date.now() + (5 * 60 * 1000); // 5 minutes
        console.log('[Analyst Mode] Cached data for future requests');
        
        // Process with the prepared data
        await processAnalystWithData(analystSystemPrompt, apiMessages, invokeSuccessCallbackOnce, thinkingIndicator);
        
    } catch (error) {
        console.error('[Analyst Mode] Error during analysis process:', error);
        invokeSuccessCallbackOnce(`Error analyzing responses: ${error.message}`);
        if(thinkingIndicator) thinkingIndicator.classList.add('hidden');
    }
}

// Process analyst mode with prepared data (either from cache or freshly loaded)
async function processAnalystWithData(analystSystemPrompt, apiMessages, invokeSuccessCallbackOnce, thinkingIndicator) {
    try {
        // Enable streaming for real-time token delivery
        let fullStreamedResponse = '';
        let isFirstToken = true;
        
        // Get auth token if user is logged in
        let headers = {'Content-Type': 'application/json'};
        if (window.firebase && window.firebase.auth().currentUser) {
            const idToken = await window.firebase.auth().currentUser.getIdToken();
            headers['Authorization'] = `Bearer ${idToken}`;
        }
        
        const response = await fetch('/api/claude', {
            method: 'POST', 
            headers: headers,
            body: JSON.stringify({ system: analystSystemPrompt, messages: apiMessages, model: "claude-opus-4-5", max_tokens: 10000, streamClient: true })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.code === 'ANALYST_LIMIT_REACHED') {
                    // Show paywall modal
                    showAnalystPaywallModal(errorData);
                    throw new Error('Free tier message limit reached');
                }
            } catch (parseError) {
                // If not JSON or not our specific error, continue with generic error
            }
            throw new Error(`API error in Analyst Mode: ${response.status} - ${errorText}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        function readChunk() {
            return reader.read().then(({ done, value }) => {
                if (done) {
                    console.log("[Analyst Stream] Stream complete.");
                    // Stream is complete, message already saved in message_stop handler
                    return;
                }
                
                const chunkText = decoder.decode(value, { stream: true });
                const lines = chunkText.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonData = JSON.parse(line.substring(6));
                            
                            if (jsonData.type === 'content_delta' && jsonData.text) {
                                fullStreamedResponse += jsonData.text;
                                
                                // For the first token, create a new AI message element
                                if (isFirstToken) {
                                    // Create a new AI message in the chat that we can update
                                    const copilotMessagesEl = document.getElementById('copilotMessages');
                                    if (copilotMessagesEl) {
                                        const messageElement = document.createElement('div');
                                        messageElement.className = 'message ai-message animate-fade-in';
                                        messageElement.dataset.sender = 'ai';
                                        messageElement.id = 'streaming-analyst-message';
                                        messageElement.innerHTML = `
                                            <div class="message-wrapper">
                                                <div class="message-content">
                                                    <div id="streaming-content"></div>
                                                </div>
                                            </div>
                                        `;
                                        copilotMessagesEl.appendChild(messageElement);
                                        copilotMessagesEl.scrollTop = copilotMessagesEl.scrollHeight;
                                    }
                                    isFirstToken = false;
                                }
                                
                                // Update the streaming content in real-time
                                const streamingContentEl = document.getElementById('streaming-content');
                                if (streamingContentEl) {
                                    // Process audio_clip tags into blockquotes before markdown parsing
                                    let processedResponse = fullStreamedResponse.replace("[", "").replace("]", "");
                                    
                                    // Check if we have citations or audio clips
                                    const hasCitations = processedResponse.includes('<citation');
                                    const hasAudioClips = processedResponse.includes('<audio_clip');
                                    
                                    if (hasAudioClips) {
                                        // Original behavior for audio clips (quotes)
                                        processedResponse = processedResponse.replace(
                                            /<audio_clip\s+id="([^"]+)">([\s\S]*?)<\/audio_clip>/gi,
                                            (match, id, content) => {
                                                // Store the audio clip ID as a data attribute and format as blockquote
                                                return `> ${content.trim()}\n`;
                                            }
                                        );
                                    } else if (hasCitations) {
                                        // New behavior for citations - just remove the tags for streaming
                                        processedResponse = processedResponse.replace(
                                            /<citation\s+id="([^"]+)">(\[[0-9,\s]+\])<\/citation>/gi,
                                            (match, id, citationNum) => {
                                                return citationNum;
                                            }
                                        );
                                    }
                                    
                                    streamingContentEl.innerHTML = marked.parse(processedResponse);
                                    // Auto-scroll to bottom
                                    const copilotMessagesEl = document.getElementById('copilotMessages');
                                    if (copilotMessagesEl) {
                                        copilotMessagesEl.scrollTop = copilotMessagesEl.scrollHeight;
                                    }
                                }
                            } else if (jsonData.type === 'message_stop') {
                                console.log("[Analyst Stream] Stream finished by server.");
                                // Clean up the streaming element and finalize
                                const streamingElement = document.getElementById('streaming-analyst-message');
                                if (streamingElement) {
                                    streamingElement.removeAttribute('id');
                                    const streamingContentEl = streamingElement.querySelector('#streaming-content');
                                    if (streamingContentEl) {
                                        streamingContentEl.removeAttribute('id');
                                    }
                                    
                                    // Process audio clips or citations before adding message actions
                                    const messageContent = streamingElement.querySelector('.message-content');
                                    if (messageContent) {
                                        let htmlContent = messageContent.innerHTML;
                                        
                                        // Check if we have audio clips (quotes)
                                        const audioClipMatches = fullStreamedResponse.matchAll(/<audio_clip\s+id="([^"]+)">([\s\S]*?)<\/audio_clip>/gi);
                                        const audioClipsArray = Array.from(audioClipMatches);
                                        
                                        if (audioClipsArray.length > 0) {
                                            // Original behavior for audio clips
                                            for (const match of audioClipsArray) {
                                                const id = match[1];
                                                const content = match[2].trim();
                                                // Find the corresponding blockquote and add the data-audio-id attribute
                                                const blockquoteRegex = new RegExp(`<blockquote>\\s*<p>${content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</p>\\s*</blockquote>`, 'i');
                                                htmlContent = htmlContent.replace(blockquoteRegex, (blockquoteMatch) => {
                                                    return `<blockquote class="audio-quote" data-audio-id="${id}">
                                                        <div class="audio-quote-content">
                                                            <p>${content}</p>
                                                        </div>
                                                        <button class="audio-quote-play-btn" type="button" title="Play audio clip">
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                                            </svg>
                                                        </button>
                                                    </blockquote>`;
                                                });
                                            }
                                        } else {
                                            // New behavior for citations
                                            const citationMatches = fullStreamedResponse.matchAll(/<citation\s+id="([^"]+)">(\[[0-9,\s]+\])<\/citation>/gi);
                                            const citationsArray = Array.from(citationMatches);
                                            
                                            console.log('[Streaming Citations] Found citation tags:', citationsArray.length);
                                            
                                            if (citationsArray.length > 0) {
                                                // Create a map of citation numbers to IDs
                                                const citationMap = {};
                                                for (const match of citationsArray) {
                                                    const id = match[1];
                                                    const citationNum = match[2];
                                                    citationMap[citationNum] = id;
                                                    console.log('[Streaming Citations] Mapping:', { citationNum, id });
                                                }
                                                
                                                // Replace plain citation numbers with hoverable spans
                                                for (const [citationNum, id] of Object.entries(citationMap)) {
                                                    const escapedNum = citationNum.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                                    const citationRegex = new RegExp(`(?<!<[^>]*)${escapedNum}(?![^<]*>)`, 'g');
                                                    htmlContent = htmlContent.replace(citationRegex, (match) => {
                                                        console.log('[Streaming Citations] Processing citation:', { match, id });
                                                        
                                                        // Get the response data for this citation
                                                        const responseData = window.audioResponseDataStore && window.audioResponseDataStore[id];
                                                        console.log('[Streaming Citations] Response data lookup:', {
                                                            id,
                                                            hasStore: !!window.audioResponseDataStore,
                                                            hasData: !!responseData,
                                                            storeKeys: window.audioResponseDataStore ? Object.keys(window.audioResponseDataStore) : []
                                                        });
                                                        
                                                        let hovercardHtml = '';
                                                        
                                                        if (responseData) {
                                                            const truncatedAnswer = responseData.answer.length > 400 
                                                                ? responseData.answer.substring(0, 400) + '...' 
                                                                : responseData.answer;
                                                            
                                                            // Escape HTML in the answer text
                                                            const escapedAnswer = truncatedAnswer
                                                                .replace(/&/g, '&amp;')
                                                                .replace(/</g, '&lt;')
                                                                .replace(/>/g, '&gt;')
                                                                .replace(/"/g, '&quot;')
                                                                .replace(/'/g, '&#39;');
                                                            
                                                            hovercardHtml = `
                                                                <div class="citation-hovercard">
                                                                    <div class="citation-hovercard-label">Citation ${match}</div>
                                                                    <div class="citation-hovercard-content">"${escapedAnswer}"</div>
                                                                </div>
                                                            `;
                                                        }
                                                        
                                                        return `<span class="audio-citation" data-audio-id="${id}" title="Click to play audio">${match}${hovercardHtml}</span>`;
                                                    });
                                                }
                                            }
                                        }
                                        
                                        messageContent.innerHTML = htmlContent;
                                        
                                        // Set up citation hover handlers for streaming messages
                                        const citations = messageContent.querySelectorAll('.audio-citation');
                                        console.log('[Streaming Citation Setup] Found citations:', citations.length);
                                        
                                        citations.forEach((citation, index) => {
                                            const hovercard = citation.querySelector('.citation-hovercard');
                                            const audioId = citation.getAttribute('data-audio-id');
                                            const citationNum = citation.getAttribute('data-citation-num');
                                            
                                            console.log(`[Streaming Citation Setup] Citation ${index + 1}:`, {
                                                audioId,
                                                citationNum,
                                                hasHovercard: !!hovercard,
                                                hovercardContent: hovercard?.textContent
                                            });
                                            
                                            if (!hovercard) {
                                                console.log(`[Streaming Citation Setup] No hovercard found for citation ${index + 1}`);
                                                return;
                                            }

                                            citation.addEventListener('mouseenter', (e) => {
                                                console.log('[Streaming Citation Hover] Mouse enter:', {
                                                    audioId,
                                                    citationNum,
                                                    hovercardVisible: hovercard.style.visibility,
                                                    hovercardOpacity: hovercard.style.opacity
                                                });
                                                
                                                const rect = citation.getBoundingClientRect();
                                                const hovercardRect = hovercard.getBoundingClientRect();
                                                
                                                console.log('[Streaming Citation Hover] Positioning:', {
                                                    citationRect: rect,
                                                    hovercardRect: hovercardRect
                                                });
                                                
                                                // Position hovercard above the citation
                                                hovercard.style.left = `${rect.left + rect.width / 2 - hovercardRect.width / 2}px`;
                                                hovercard.style.top = `${rect.top - hovercardRect.height - 10}px`;
                                                
                                                // Check if hovercard goes off screen and adjust
                                                const adjustedLeft = parseFloat(hovercard.style.left);
                                                const adjustedTop = parseFloat(hovercard.style.top);
                                                
                                                // Adjust horizontal position if needed
                                                if (adjustedLeft < 10) {
                                                    hovercard.style.left = '10px';
                                                } else if (adjustedLeft + hovercardRect.width > window.innerWidth - 10) {
                                                    hovercard.style.left = `${window.innerWidth - hovercardRect.width - 10}px`;
                                                }
                                                
                                                // If hovercard would go above viewport, show it below instead
                                                if (adjustedTop < 10) {
                                                    hovercard.style.top = `${rect.bottom + 10}px`;
                                                }
                                                
                                                console.log('[Streaming Citation Hover] Final position:', {
                                                    left: hovercard.style.left,
                                                    top: hovercard.style.top
                                                });
                                            });
                                            
                                            citation.addEventListener('mouseleave', (e) => {
                                                console.log('[Streaming Citation Hover] Mouse leave:', { audioId, citationNum });
                                            });
                                        });
                                    }
                                    
                                    // Add the message actions after streaming completes
                                    const messageWrapper = streamingElement.querySelector('.message-wrapper');
                                    if (messageWrapper) {
                                        const actionsHtml = `
                                            <div class="message-actions">
                                                <button class="action-btn create-video-summary" title="Create storyboard">
                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                        <rect x="3" y="3" width="7" height="7"></rect>
                                                        <rect x="14" y="3" width="7" height="7"></rect>
                                                        <rect x="3" y="14" width="7" height="7"></rect>
                                                        <rect x="14" y="14" width="7" height="7"></rect>
                                                    </svg>
                                                    Create storyboard
                                                </button>
                                            </div>
                                        `;
                                        messageWrapper.insertAdjacentHTML('beforeend', actionsHtml);
                                    }
                                }
                                
                                // Save the message to the thread directly (without creating UI element)
                                console.log("[Analyst Stream] Saving streamed response to thread");
                                if (appState.copilotMode === 'analyst' && appState.currentAnalystThreadId && window.saveAnalystThreadMessage) {
                                    window.saveAnalystThreadMessage('assistant', fullStreamedResponse);
                                }
                                
                                // Don't call the success callback as the UI element is already created by streaming
                                return;
                            } else if (jsonData.type === 'error') {
                                console.error("[Analyst Stream] Error from server:", jsonData.message);
                                throw new Error(jsonData.message || 'Unknown error during streaming.');
                            }
                        } catch (e) {
                            // Ignore JSON parsing errors for non-data lines
                        }
                    }
                }
                return readChunk();
            });
        }
        
        await readChunk();
    } catch (analystError) {
        console.error('[Analyst Mode] Error during analysis process:', analystError);
        invokeSuccessCallbackOnce(`Sorry, I encountered an error during analysis: ${analystError.message}`);
         if(thinkingIndicator) thinkingIndicator.classList.add('hidden');
    }
}

function buildUpdatePrompt(systemPromptForClaude) {
    let specString = "\n\n<current_interview_specification>\n";
    const currentSpecFromState = window.appState.interviewSpec; 
    specString += `    <title>${escapeXml(currentSpecFromState.title || 'Not set')}</title>\n`;
    specString += `    <description>${escapeXml(currentSpecFromState.description || 'Not set')}</description>\n`;
    specString += `    <initial_prompt>${escapeXml(currentSpecFromState.initialPrompt || 'Not set')}</initial_prompt>\n`;
    specString += `    <followup_prompt>${escapeXml(currentSpecFromState.followupPrompt || 'Not set')}</followup_prompt>\n`;
    specString += `    <report_prompt>${escapeXml(currentSpecFromState.reportPrompt || 'Not set')}</report_prompt>\n`;
    specString += `    <user_note>${escapeXml(currentSpecFromState.userNote || 'Not set')}</user_note>\n`;
    specString += `    <context_statement>${escapeXml(currentSpecFromState.contextStatement || 'Not set')}</context_statement>\n`;

    specString += `    <page_headers>\n`;
    specString += `        <intro>${escapeXml(currentSpecFromState.pageHeaders?.intro || 'Not set')}</intro>\n`;
    specString += `        <interview>${escapeXml(currentSpecFromState.pageHeaders?.interview || 'Not set')}</interview>\n`;
    specString += `        <report>${escapeXml(currentSpecFromState.pageHeaders?.report || 'Not set')}</report>\n`;
    specString += `        <report_sub>${escapeXml(currentSpecFromState.pageHeaders?.reportSub || 'Not set')}</report_sub>\n`;
    specString += `    </page_headers>\n`;
    specString += "</current_interview_specification>\n\n";
    
    return specString + systemPromptForClaude + 
        "\n\nBased on the user's request and the current specification context:\n" +
        "- If the request is clear and you intend to update the specification, provide the relevant XML tags. You only need to include tags for the fields you are changing. Make sure to update examples when you update their corresponding prompts. Unchanged fields will automatically retain their current values from the specification provided above.\n" +
        "- If the request is ambiguous, incomplete, or if you need more information to make the best update, please ask 1-2 focused clarifying questions as a conversational message in <message> tags. Explain why the information is needed to make the best possible update.\n" +
        "- Prioritize asking clarifying questions over making assumptions. It's better to gather the right information than to guess at the user's intent.\n" +
        "Your goal is to be as helpful as possible. Strive to provide accurate XML updates when the path is clear, but do not hesitate to ask for clarification to ensure the changes align with the user's intent.\n" +
        "IMPORTANT: When the user provides their personal thank you note in response to your request, you MUST respond with the <user_note> XML tag containing their exact message. For example, if they say 'Thanks for sharing your story!', respond with: <user_note>Thanks for sharing your story!</user_note>\n" +
        "If they haven't provided a thank you note yet, ask them for it. Respond only with the XML tags or a conversational message in <message> tags.";
}

function buildFirstGenerationPrompt(systemPromptForClaude) {
    // New clarifying questions approach for first spec generation
    systemPromptForClaude += 'You are an AI assistant helping to create interview prompts for other AI assistants. Your goal is to design interview prompts that help users conduct effective structured interviews.\n\n' +
    'IMPORTANT: For initial prompt generation, you should ask clarifying questions to gather enough information before producing the full XML structure. Do NOT immediately generate the complete specification unless you have sufficient detail about:\n' +
    '1. The interview topic/purpose\n' +
    '2. The target audience (who will be interviewed)\n' +
    '3. The desired outcomes or insights to gather\n' +
    '4. The context or background information available\n' +
    '5. Any specific requirements or constraints\n' +
    '6. What specific information MUST be collected from each interviewee\n\n' +
    'PROCESS:\n' +
    '- If the user\'s request lacks sufficient detail in any of these areas, ask 2-3 focused clarifying questions to gather the missing information\n' +
    '- Pay special attention to understanding what information is REQUIRED vs. nice-to-have\n' +
    '- Only generate the full XML specification when you feel confident you have enough context to create a high-quality, targeted interview template\n' +
    '- When asking questions, be conversational and helpful, explaining why the information is needed\n' +
    '- IMPORTANT: For the <user_note> field, you must ask the user to provide their own personal thank you note. Do NOT generate one yourself. Leave it as INSERT_USER_PROVIDED_NOTE_HERE until they provide it.\n' +
    '- When the user provides their thank you note after you ask for it, respond ONLY with: <user_note>[their exact message]</user_note>\n' +
    '- Do not include any other XML tags or conversational messages when they provide their note - ONLY the user_note tag.\n\n' +
    'WHEN YOU DO GENERATE THE FULL SPECIFICATION, use this XML structure:\n\n' +
    '<interview_title>The title of the interview</interview_title>\n' +
    '<interview_description>A brief description of the interview\'s purpose</interview_description>\n' +
    '<interview_purpose>The specific goals and intended outcomes of this interview</interview_purpose>\n' +
    '<required_information>A list of specific information that MUST be gathered from each interviewee, one item per line. Be specific and actionable. For example:\n' +
    '- Current role and years of experience\n' +
    '- Primary tools used for the task\n' +
    '- Biggest challenge faced in the last month\n' +
    '- Budget range for solutions\n' +
    '</required_information>\n' +
    '<initial_question>The *exact text of the first question* the AI interviewer should ask. Return one single, provocative question, not a compound question.</initial_question>\n' +
    '<followup_prompt>Any SPECIFIC guidance for this interview beyond the core interviewing techniques. Do NOT include general interviewing advice (mirroring, validation, etc.) as those are handled by the system. Only include what makes THIS interview unique.</followup_prompt>\n' +
    '<example_followup_question>A hypothetical but realistic example of a question the AI might ask as a follow-up, based on a plausible user response to the initial_question.</example_followup_question>\n' +
    '<report_prompt>The complete prompt for generating the **concise individual post-interview summary report**, including both {{CONTEXT}} and {{QA_CONTENT}} placeholders as needed.</report_prompt>\n' +
    '<example_report>A hypothetical but realistic example of a concise **individual summary report** generated using the report_prompt logic, designed to be easily listened to.</example_report>\n' +
    '<page_intro_header>Header text for the main interview page (e.g., displayed at the top of index.html)</page_intro_header>\n' +
    '<page_interview_header>Sub-headline or introductory text for the main interview page (e.g., displayed below the main header on index.html)</page_interview_header>\n' +
    '<page_report_header>Header text for the report page</page_report_header>\n' +
    '<page_report_subheader>Sub-headline for the report page</page_report_subheader>\n' +
    '<user_note>INSERT_USER_PROVIDED_NOTE_HERE</user_note>\n' +
    '<context_statement>A helpful message guiding users on what type of context/documents to upload during interview setup. For example, for job interviews: "Add your resume or portfolio to help tailor questions to your experience." For photography: "Upload sample photos to discuss your technique." Be specific to this interview type.</context_statement>\n' +
    '<message>Your conversational message to the user explaining your choices. At the end, ask them to provide their personal thank you note that will appear at the beginning of each participant\'s report. Tell them it should be a warm message as if they\'re forwarding the report, like: "Thanks so much for sharing your insights! I found your perspective on X particularly valuable. Here\'s your interview summary for your records."</message>\n\n' +
    'CRITICAL: After you generate the initial specification with INSERT_USER_PROVIDED_NOTE_HERE and the user provides their thank you note, you MUST respond with ONLY the <user_note> tag containing their message. Do not include a <message> tag or any other content - just the <user_note> tag.\n\n' +
    'Here are examples of well-structured prompts that you can use as inspiration:\n\n' +
    'EXAMPLE INITIAL QUESTIONS (this is the content the AI should place inside the <initial_question> tag):\n' +
    '<initial_question>Tell me about a moment where you felt like a new technology helped you do something you couldn\'t do before.</initial_question>\n' +
    '<initial_question>How would you describe your mother to a stranger?</initial_question>\n' +
    '<initial_question>Tell me about your greatest adventure.</initial_question>\n\n' +
    'Be concise. Less is more. Do not ask compound questions, where one clause is separated from another by a comma.\n\n' +
    'IMPORTANT NOTE ABOUT FOLLOWUP PROMPTS:\n' +
    'The system now includes comprehensive interviewing techniques (mirroring, validation, open-ended questions, etc.) automatically.\n' +
    'Your followup_prompt should ONLY include guidance that is SPECIFIC to this particular interview.\n' +
    'DO NOT include general interviewing techniques - focus on what makes THIS interview unique.\n\n' +
    'EXAMPLE FOLLOWUP PROMPT (showing interview-specific guidance only):\n' +
    '\`\`\`\n' + 
    'Focus on exploring the user\'s \"Personal AI Readiness Plan\" through these specific lenses:\n' +
    '- Practical skills they\'re developing or need to develop\n' +
    '- Emotional responses to AI integration in their field\n' +
    '- Concrete steps they\'re taking or planning to take\n' +
    '- Their vision for their role in 5 years\n\n' +
    'Pay special attention to any mentions of:\n' +
    '- Specific AI tools they\'ve tried or avoided\n' +
    '- Moments of resistance or excitement about AI\n' +
    '- Skills they believe will remain uniquely human\n' +
    '- How their personal interests might intersect with AI capabilities\n\n' +
    'When they mention challenges, explore both the practical and emotional dimensions.\n' +
    'When they mention successes, dig into what enabled those wins.\n' +
    '\`\`\`\n\n' +
    'ANOTHER EXAMPLE (for a user research interview):\n' +
    '\`\`\`\n' +
    'This interview aims to understand pain points in the current workflow.\n' +
    'Key areas to explore:\n' +
    '- Specific moments of frustration in their daily tasks\n' +
    '- Workarounds they\'ve created\n' +
    '- Time lost to inefficient processes\n' +
    '- Their ideal solution (even if unrealistic)\n\n' +
    'Listen for emotional cues around:\n' +
    '- Tasks they dread or procrastinate on\n' +
    '- Moments of satisfaction despite the challenges\n' +
    '- How issues impact their team or customers\n' +
    '\`\`\`\n\n' + 
    'INDIVIDUAL SUMMARY REPORT PROMPT GUIDELINES:\n' +
    'The report_prompt should instruct the AI to create a personalized follow-up message from the interviewer:\n\n' +
    'SUMMARY (wrapped in <individual_summary_report> tags):\n' +
    '   - MUST be written in third person perspective (referring to the interviewee by name)\n' +
    '   - References the interviewee by name throughout (e.g., "Sarah explained...", "John mentioned...")\n' +
    '   - Maintains an analytical yet positive tone\n' +
    '   - Uses {{CONTEXT}} for interview background and {{QA_CONTENT}} for their responses\n' +
    '   - MUST incorporate direct quotes from the interviewee frequently throughout the narrative\n' +
    '   - Weaves quotes into a coherent narrative with interpretation and synthesis\n' +
    '   - Identifies key themes, insights, and implications\n' +
    '   - Provides objective analysis that would be valuable to share with others\n' +
    '   - Ends with forward-looking observations about the interviewee\'s approach\n\n' +
    'EXAMPLE OUTPUT (what the report_prompt should instruct the AI to generate):\n\n' +
    '<individual_summary_report>\n' +
    'Sarah Chen brings a thoughtful and strategic approach to navigating the evolving landscape of artificial intelligence in her professional life. When discussing her strategy for staying relevant in an AI-driven world, Sarah shared a profound insight: \"I believe the key is to focus on what makes us uniquely human - creativity, empathy, and complex problem-solving. These aren\'t just buzzwords for me. Every morning, I spend thirty minutes doing creative exercises - sometimes it\'s writing, sometimes it\'s sketching solutions to problems. I\'m literally training the parts of my brain that AI can\'t replicate.\"\n\n' +
    'Sarah\'s journey hasn\'t been without its challenges. She recounted a pivotal moment three months ago when an AI tool automated a task she had spent years perfecting. Rather than letting this development discourage her, Sarah chose to adapt. \"I realized I had two choices: I could either fight against this technology, or I could learn to dance with it. So I signed up for a prompt engineering course that very night. Now I use AI as my creative partner,\" she explained. Sarah went on to describe a recent success: \"Last week, I completed a project that would have taken me two weeks in just three days. But here\'s the thing - the quality was better because I could focus on the strategic thinking while the AI handled the execution.\"\n\n' +
    'Sarah\'s resilience in the face of technological change appears to be rooted in her upbringing. She described watching her immigrant parents constantly reinvent themselves as they adapted to new environments and challenges. This background has become what she calls her \"superpower\" in the AI age. \"My parents taught me that change isn\'t something that happens to you - it\'s something you participate in,\" Sarah reflected. \"When I see AI advancing, I don\'t see a threat. I see an invitation to evolve. And honestly? I\'m excited about who I\'m becoming through this process.\"\n\n' +
    'Looking ahead, Sarah envisions a future where human creativity and AI capability combine to create something entirely new - not replacement, but amplification. Her perspective on this collaborative future is both optimistic and actionable: \"I think we\'re at the beginning of the most creative period in human history. When you combine human intuition with AI\'s processing power, magic happens. I\'m not just preparing for the future anymore - I\'m actively building it.\" Sarah\'s approach demonstrates how professionals can transform potential disruption into opportunity through continuous learning and strategic adaptation.\n' +

    '</individual_summary_report>\n\n' + 
 
    'ADAPTING FOR DIFFERENT INTERVIEW TYPES:\n' +
    'Adjust the tone and focus of the report_prompt based on the interview type:\n\n' +
    '- **Sales/Customer Discovery**: Write as a founder/salesperson following up after a great conversation. Focus on their needs, how your solution helps, and clear next steps.\n' +
    '- **Team Standup/Check-in**: Write as a supportive manager acknowledging contributions and offering help with blockers.\n' +
    '- **User Research**: Write as a product person who genuinely values their feedback and will act on it.\n' +
    '- **Career/Personal Development**: Write as a coach or mentor providing personalized guidance and encouragement.\n\n' +
    'The key is that the report should feel like a personal message from a real person who cares, not a generic AI-generated summary.\n\n' +
    'Carefully adapt these examples based on the specific type of interview the user wants to create. Make sure each field serves its intended purpose:\n' +
    '- **interview_purpose**: Clear goals help the AI interviewer maintain focus\n' +
    '- **required_information**: Specific data points that MUST be gathered (the AI will naturally work these into conversation)\n' +
    '- **initial_question**: The exact first question to ask (should be engaging and open-ended)\n' +
    '- **followup_prompt**: Interview-SPECIFIC guidance only (NOT general techniques which are built into the system)\n' +
    '- **report_prompt**: Instructions for creating a personalized follow-up message, using {{QA_CONTENT}} and {{CONTEXT}}\n' +
    '- **example_followup_question**: Shows how the AI might naturally follow up\n' +
    '- **example_report**: Shows the expected personalized message format\n\n' +
    'IMPORTANT: How to write effective report prompts:\n' +
    '- Do NOT put {{CONTEXT}} and {{QA_CONTENT}} on the same line or in the same sentence\n' +
    '- These placeholders will be replaced with large blocks of text\n' +
    '- Structure your prompt to reference them separately\n\n' +
    'EXCELLENT report_prompt example (copy this structure):\n' +
    '```xml\n' +
    '<report_generation_instructions>\n' +
    '  <context_data>\n' +
    '    {{CONTEXT}}\n' +
    '  </context_data>\n' +
    '  \n' +
    '  <interview_transcript>\n' +
    '    {{QA_CONTENT}}\n' +
    '  </interview_transcript>\n' +
    '  \n' +
    '  <generation_requirements>\n' +
    '    <format>third-person narrative report</format>\n' +
    '    <style>professional yet engaging</style>\n' +
    '    <length>3-5 paragraphs</length>\n' +
    '    \n' +
    '    <content_structure>\n' +
    '      <opening>Start with a powerful direct quote from the interviewee that captures their essence</opening>\n' +
    '      <body>\n' +
    '        - Weave together insights from their responses with background from the context\n' +
    '        - Include 3-4 direct quotes that support key themes\n' +
    '        - Identify patterns and unique perspectives\n' +
    '        - Connect their past experiences to current challenges\n' +
    '      </body>\n' +
    '      <conclusion>End with their forward-looking vision or aspirations</conclusion>\n' +
    '    </content_structure>\n' +
    '    \n' +
    '    <tone_guidelines>\n' +
    '      - Refer to the interviewee by name throughout (e.g., "Sarah explained...", "John\'s approach...")\n' +
    '      - Maintain analytical objectivity while highlighting their strengths\n' +
    '      - Use direct quotes to let their voice shine through\n' +
    '      - Create a narrative arc that shows growth or transformation\n' +
    '    </tone_guidelines>\n' +
    '  </generation_requirements>\n' +
    '  \n' +
    '  <output_format>\n' +
    '    Wrap your report in <individual_summary_report> tags.\n' +
    '  </output_format>\n' +
    '</report_generation_instructions>\n' +
    '```\n\n' +
    'Alternative structure for user research interviews:\n' +
    '```xml\n' +
    '<user_research_report>\n' +
    '  <background_information>\n' +
    '    {{CONTEXT}}\n' +
    '  </background_information>\n' +
    '  \n' +
    '  <interview_responses>\n' +
    '    {{QA_CONTENT}}\n' +
    '  </interview_responses>\n' +
    '  \n' +
    '  <analysis_framework>\n' +
    '    <focus_areas>\n' +
    '      - Pain points and frustrations\n' +
    '      - Current workarounds\n' +
    '      - Desired outcomes\n' +
    '      - Feature requests\n' +
    '    </focus_areas>\n' +
    '    \n' +
    '    <report_sections>\n' +
    '      1. User Profile: Brief overview using context data\n' +
    '      2. Key Findings: 3-5 bullet points with supporting quotes\n' +
    '      3. Opportunities: Actionable insights for product improvement\n' +
    '      4. User Journey: Their current process and pain points\n' +
    '    </report_sections>\n' +
    '  </analysis_framework>\n' +
    '</user_research_report>\n' +
    '```\n\n' +
    'BAD report_prompt example (don\'t do this):\n' +
    '"Generate a compelling summary of {{CONTEXT}} based on {{QA_CONTENT}} that captures..."\n' +
    '(This puts both placeholders in the same sentence, making it confusing)\n\n' +
    'Remember:\n' +
    '- The system handles all conversational techniques automatically\n' +
    '- Focus on what makes THIS interview unique\n' +
    '- Required information will be gathered naturally, not as a checklist\n' +
    '- {{CONTEXT}} contains background information (resume, company info, etc.)\n' +
    '- {{QA_CONTENT}} contains the full interview transcript\n' +
    '- User reports should use direct quotes naturally without audio_clip tags';
    
    return systemPromptForClaude;
}

async function processFirstGenerationWithStreaming(systemPromptForClaude, apiMessages, invokeSuccessCallbackOnce, errorCallback, thinkingIndicator, specificationNullState, originalSpecificationNullStateHTML) {
    // Show the thinking panel
    if (window.showThinkingPanel) window.showThinkingPanel();
    
    // Clear any previous streaming content
    if (window.clearStreamingContent) window.clearStreamingContent();

    let fullStreamedContentResponse = ''; 

    // Get auth token if user is logged in
    const getAuthHeaders = async () => {
        let headers = {'Content-Type': 'application/json'};
        if (window.firebase && window.firebase.auth().currentUser) {
            const idToken = await window.firebase.auth().currentUser.getIdToken();
            headers['Authorization'] = `Bearer ${idToken}`;
        }
        return headers;
    };
    
    getAuthHeaders().then(headers => {
        return fetch('/api/claude', {
            method: 'POST', 
            headers: headers,
            body: JSON.stringify({ system: systemPromptForClaude, messages: apiMessages, model: "claude-opus-4-5", thinking: {type: "enabled", budget_tokens: 10000}, streamClient: true })
        });
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                try {
                    const errorData = JSON.parse(text);
                    if (errorData.code === 'ANALYST_LIMIT_REACHED') {
                        // Show paywall modal
                        showAnalystPaywallModal(errorData);
                        throw new Error('Free tier message limit reached');
                    }
                } catch (parseError) {
                    // If not JSON or not our specific error, continue with generic error
                }
                throw new Error(`API error: ${response.status} - ${response.statusText}. Body: ${text}`);
            });
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        function readChunk() {
            reader.read().then(({ done, value }) => {
                if (done) {
                    console.log("[Fetch Stream] Stream complete.");
                    if (window.hideThinkingPanel) window.hideThinkingPanel(); 
                    processFullResponseAfterStream(fullStreamedContentResponse); 
                    return;
                }
                const chunkText = decoder.decode(value, { stream: true });
                const lines = chunkText.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonData = JSON.parse(line.substring(6));
                            
                            if (jsonData.type === 'thinking_delta' && jsonData.thinking) {
                                if (window.addStreamingContent) {
                                    window.addStreamingContent(jsonData.thinking, 'thinking');
                                }
                            } else if (jsonData.type === 'content_delta' && jsonData.text) {
                                fullStreamedContentResponse += jsonData.text; 
                                if (window.addStreamingContent) {
                                    window.addStreamingContent(jsonData.text, 'content');
                                }
                            } else if (jsonData.type === 'message_stop') {
                                console.log("[Fetch Stream] Stream finished by server-sent message_stop.");
                            } else if (jsonData.type === 'error') {
                                console.error("[Fetch Stream] Error from server stream:", jsonData.message);
                                errorCallback(new Error(jsonData.message || 'Unknown error during streaming.'));
                                reader.cancel(); 
                                if (window.hideThinkingPanel) window.hideThinkingPanel();
                                return; 
                            }
                        } catch (e) {
                            // console.warn("[Fetch Stream] Error parsing JSON from chunk line (non-fatal, continuing):", e, "Line:", line);
                        }
                    }
                }
                readChunk(); 
            }).catch(streamError => {
                console.error("[Fetch Stream] Error reading stream:", streamError);
                if (window.hideThinkingPanel) window.hideThinkingPanel();
                errorCallback(streamError);
            });
        }
        readChunk(); 
    })
    .catch(fetchError => {
        console.error("[Fetch Stream] Initial fetch error:", fetchError);
        if (window.hideThinkingPanel) window.hideThinkingPanel();
        errorCallback(fetchError);
    });

    function processFullResponseAfterStream(aiResponse) {
        if (window.hideThinkingPanel) window.hideThinkingPanel();
        handleEditorModeResponse(aiResponse, invokeSuccessCallbackOnce, errorCallback);
    }
}

async function processUpdateWithStreaming(systemPromptForClaude, apiMessages, invokeSuccessCallbackOnce, errorCallback, thinkingIndicator) {
    // Show the thinking panel
    if (window.showThinkingPanel) window.showThinkingPanel();
    
    // Clear any previous streaming content
    if (window.clearStreamingContent) window.clearStreamingContent();

    let fullStreamedContentResponse = ''; 

    // Get auth token if user is logged in
    const getAuthHeaders = async () => {
        let headers = {'Content-Type': 'application/json'};
        if (window.firebase && window.firebase.auth().currentUser) {
            const idToken = await window.firebase.auth().currentUser.getIdToken();
            headers['Authorization'] = `Bearer ${idToken}`;
        }
        return headers;
    };
    
    getAuthHeaders().then(headers => {
        return fetch('/api/claude', {
            method: 'POST', 
            headers: headers,
            body: JSON.stringify({ system: systemPromptForClaude, messages: apiMessages, model: "claude-opus-4-5", thinking: {type: "enabled", budget_tokens: 10000}, streamClient: true })
        });
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                try {
                    const errorData = JSON.parse(text);
                    if (errorData.code === 'ANALYST_LIMIT_REACHED') {
                        // Show paywall modal
                        showAnalystPaywallModal(errorData);
                        throw new Error('Free tier message limit reached');
                    }
                } catch (parseError) {
                    // If not JSON or not our specific error, continue with generic error
                }
                throw new Error(`API error: ${response.status} - ${response.statusText}. Body: ${text}`);
            });
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        function readChunk() {
            reader.read().then(({ done, value }) => {
                if (done) {
                    console.log("[Fetch Stream] Stream complete.");
                    if (thinkingIndicator) thinkingIndicator.classList.add('hidden'); 
                    processFullResponseAfterUpdateStream(fullStreamedContentResponse); 
                    return;
                }
                const chunkText = decoder.decode(value, { stream: true });
                const lines = chunkText.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonData = JSON.parse(line.substring(6));
                            
                            if (jsonData.type === 'thinking_delta' && jsonData.thinking) {
                                if (window.addStreamingContent) {
                                    window.addStreamingContent(jsonData.thinking, 'thinking');
                                }
                            } else if (jsonData.type === 'content_delta' && jsonData.text) {
                                fullStreamedContentResponse += jsonData.text; 
                                if (window.addStreamingContent) {
                                    window.addStreamingContent(jsonData.text, 'content');
                                }
                            } else if (jsonData.type === 'message_stop') {
                                console.log("[Fetch Stream] Stream finished by server-sent message_stop.");
                            } else if (jsonData.type === 'error') {
                                console.error("[Fetch Stream] Error from server stream:", jsonData.message);
                                errorCallback(new Error(jsonData.message || 'Unknown error during streaming.'));
                                reader.cancel(); 
                                if (window.hideThinkingPanel) window.hideThinkingPanel();
                                return; 
                            }
                        } catch (e) {
                            // console.warn("[Fetch Stream] Error parsing JSON from chunk line (non-fatal, continuing):", e, "Line:", line);
                        }
                    }
                }
                readChunk(); 
            }).catch(streamError => {
                console.error("[Fetch Stream] Error reading stream:", streamError);
                if (window.hideThinkingPanel) window.hideThinkingPanel();
                errorCallback(streamError);
            });
        }
        readChunk(); 
    })
    .catch(fetchError => {
        console.error("[Fetch Stream] Initial fetch error:", fetchError);
        if (window.hideThinkingPanel) window.hideThinkingPanel();
        errorCallback(fetchError);
    });

    function processFullResponseAfterUpdateStream(aiResponse) {
        if (thinkingIndicator) thinkingIndicator.classList.add('hidden');
        window.appState.setStreamingPanelOpen(false);
        if (window.applyStreamingPanelState) window.applyStreamingPanelState();
        
        // Use a small delay to ensure DOM is fully updated before processing the response
        setTimeout(() => {
            handleEditorModeResponse(aiResponse, invokeSuccessCallbackOnce, errorCallback);
        }, 10);
    }
}

// Function to show paywall modal when free tier limit is reached
function showAnalystPaywallModal(errorData) {
    // Create modal HTML
    const modalHTML = `
        <div id="analystPaywallModal" class="modal-overlay" style="display: flex;">
            <div class="modal-content" style="max-width: 500px;">
                <h2>Upgrade to Continue</h2>
                <p>You've used ${errorData.currentCount} of your ${errorData.limit} free analyst/copilot messages.</p>
                <p>Upgrade to a paid plan to continue using the analyst and copilot features with unlimited messages.</p>
                
                <div class="pricing-options" style="margin: 20px 0;">
                    <div class="plan-option" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px;">
                        <h3>Starter Plan - $24.99/month</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li>✓ 25 interviews per month</li>
                            <li>✓ Unlimited analyst/copilot messages</li>
                            <li>✓ All core features</li>
                        </ul>
                    </div>
                    <div class="plan-option" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px;">
                        <h3>Growth Plan - $59.99/month</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li>✓ 50 interviews per month</li>
                            <li>✓ Unlimited analyst/copilot messages</li>
                            <li>✓ Memory service</li>
                            <li>✓ Web search</li>
                            <li>✓ Custom branding</li>
                        </ul>
                    </div>
                </div>
                
                <div class="modal-buttons">
                    <button onclick="window.showPricingPanel()" class="button-primary">View Pricing</button>
                    <button onclick="document.getElementById('analystPaywallModal').remove()" class="button-secondary">Close</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove any existing modal
    const existingModal = document.getElementById('analystPaywallModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Function to ensure analyst data is loaded (for hovercards)
window.ensureAnalystDataLoaded = async function() {
    console.log('[ensureAnalystDataLoaded] Checking if analyst data needs to be loaded');
    
    // Check if we already have data in the store
    if (window.audioResponseDataStore && Object.keys(window.audioResponseDataStore).length > 0) {
        console.log('[ensureAnalystDataLoaded] Data already loaded, skipping');
        return;
    }
    
    // Check if we're in analyst mode and have an interview selected
    if (appState.copilotMode !== 'analyst' || !appState.currentEditingInterviewId) {
        console.log('[ensureAnalystDataLoaded] Not in analyst mode or no interview selected');
        return;
    }
    
    console.log('[ensureAnalystDataLoaded] Loading analyst data for hovercards');
    
    try {
        const db = firebase.firestore();
        const interviewId = appState.currentEditingInterviewId;
        
        // Initialize the store
        window.audioResponseDataStore = {};
        
        // Get all reports for this interview
        const reportsSnapshot = await db.collection('reports')
            .where('interview_id', '==', interviewId)
            .limit(50) // Limit to prevent too many requests
            .get();
            
        console.log('[ensureAnalystDataLoaded] Found reports:', reportsSnapshot.size);
        
        // For each report, get its responses
        for (const reportDoc of reportsSnapshot.docs) {
            const reportData = reportDoc.data();
            const userName = reportData.user_name || reportData.userName || 'Anonymous';
            
            const responsesSnapshot = await db.collection('reports')
                .doc(reportDoc.id)
                .collection('responses')
                .get();
                
            responsesSnapshot.forEach(responseDoc => {
                const qa = responseDoc.data();
                const responseId = responseDoc.id;
                
                // Store all responses for citation hovercards
                window.audioResponseDataStore[responseId] = {
                    question: qa.question,
                    answer: qa.answer,
                    timestamp: qa.timestamp,
                    userName: userName,
                    hasAudio: qa.has_audio || qa.audio_url || qa.audio_gcs_url
                };
            });
        }
        
        console.log('[ensureAnalystDataLoaded] Loaded response data:', Object.keys(window.audioResponseDataStore).length);
        
    } catch (error) {
        console.error('[ensureAnalystDataLoaded] Error loading analyst data:', error);
    }
}; 