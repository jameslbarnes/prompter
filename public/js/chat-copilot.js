// Chat Copilot Functions

import { processMessageWithAI } from './copilot-process-message.js';
import { escapeXml } from './xml-utils.js';

// Global store for citation data
window.citationDataStore = window.citationDataStore || {};

// Append user message to chat
window.appendUserMessage = function(message, saveToDb = true) { 
    const copilotMessagesEl = document.getElementById('copilotMessages');
    if (!copilotMessagesEl) return;
    
    // Remove the "No messages" placeholder if it exists
    const systemMessages = copilotMessagesEl.querySelectorAll('.system-message');
    systemMessages.forEach(msg => {
        const content = msg.querySelector('.message-content');
        if (content && content.textContent.includes('No messages in this thread yet')) {
            msg.remove();
        }
    });
    
    const messageElement = document.createElement('div');
    console.log('[Copilot UI - User]', { content: message, savedToDb: saveToDb, mode: window.copilotMode, timestamp: new Date().toISOString() });
    messageElement.className = 'message user-message animate-fade-in';
    messageElement.dataset.sender = 'user'; 
    messageElement.dataset.content = message; 
    messageElement.innerHTML = `
        <div class="message-content">
            ${marked.parse(message)}
        </div>
    `;
    copilotMessagesEl.appendChild(messageElement);
    copilotMessagesEl.scrollTop = copilotMessagesEl.scrollHeight;

    // Save to journal thread if in journal mode
    if (saveToDb && appState.isJournalAnalysisMode && window.saveJournalThreadMessage) {
        console.log('[appendUserMessage] Saving to journal thread');
        window.saveJournalThreadMessage('user', message);
    } else if (saveToDb && appState.copilotMode === 'analyst' && appState.currentAnalystThreadId && window.saveAnalystThreadMessage) {
        // Save to analyst thread if in analyst mode
        console.log('[appendUserMessage] Saving to analyst thread:', appState.currentAnalystThreadId);
        window.saveAnalystThreadMessage('user', message);
    } else if (saveToDb && appState.currentEditingInterviewId && db) {
        // Save to legacy copilot chat for editor mode
        const chatCollectionName = appState.copilotMode === 'analyst' ? 'analystChat' : 'copilotChat';
        db.collection('interviews').doc(appState.currentEditingInterviewId).collection(chatCollectionName).add({
            sender: 'user',
            content: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(error => {
            console.error("Error saving user message to Firestore:", error);
        });
    }
}

// Append AI message to chat
window.appendAIMessage = function(message, saveToDb = true, isSystemMessage = false) { 
    const copilotMessagesEl = document.getElementById('copilotMessages');
    if (!copilotMessagesEl) return;
    
    // If this is a real AI message (not system), remove the "No messages" placeholder
    if (!isSystemMessage || !message.includes('No messages in this thread yet')) {
        const systemMessages = copilotMessagesEl.querySelectorAll('.system-message');
        systemMessages.forEach(msg => {
            const content = msg.querySelector('.message-content');
            if (content && content.textContent.includes('No messages in this thread yet')) {
                msg.remove();
            }
        });
    }

    const messageElement = document.createElement('div');
    const messageTypeClass = isSystemMessage ? 'system-message' : 'ai-message';
    const consoleSender = isSystemMessage ? 'System' : 'AI';
    console.log(`[Copilot UI - ${consoleSender}]`, { rawContent: typeof message === 'string' ? message.substring(0,100) + '...' : message, savedToDb: saveToDb, mode: appState.copilotMode, isSystem: isSystemMessage, timestamp: new Date().toISOString() });

    messageElement.className = `message ${messageTypeClass} animate-fade-in`;
    messageElement.dataset.sender = isSystemMessage ? 'system' : 'ai';
    messageElement.dataset.content = (typeof message === 'string' && message.length > 1000) ? message.substring(0, 1000) + '...' : message;

    let contentForDisplay;

    if (!isSystemMessage && appState.copilotMode === 'editor' && typeof message === 'string') {
        if (window.extractTagContent) {
            const extracted = window.extractTagContent('message', message, null);
            if (extracted !== null) {
                contentForDisplay = extracted;
            } else if (message.includes('<interview_title>') || message.includes('<initial_question>') || (message.trim().startsWith('<') && message.trim().endsWith('>'))) {
                contentForDisplay = "Specification update processed. Check the fields for details.";
            } else {
                contentForDisplay = message;
            }
        } else {
            // extractTagContent not available yet, just display the message
            contentForDisplay = message;
        }
    } else {
        contentForDisplay = message;
    }
    
    // Process audio_clip tags and citations for analyst mode BEFORE markdown parsing
    let processedContent = contentForDisplay || '';
    let citationMap = {};
    
    if (appState.copilotMode === 'analyst' && !isSystemMessage) {
        // First, extract citation information for hovercards
        const citationMatches = processedContent.matchAll(/<citation\s+id="([^"]+)">(\[[0-9,\s]+\])<\/citation>/gi);
        for (const match of citationMatches) {
            const id = match[1];
            const citationNum = match[2];
            citationMap[citationNum] = id;
        }
        
        // Replace audio_clip tags with markdown blockquotes before parsing
        processedContent = processedContent.replace(
            /<audio_clip\s+id="([^"]+)">([\s\S]*?)<\/audio_clip>/gi,
            (match, id, content) => {
                // Create a temporary marker that will survive markdown parsing
                return `AUDIOCLIP[${id}]> ${content.trim()}\nAUDIOCLIPEND`;
            }
        );
        
        // Replace citation tags with temporary markers
        processedContent = processedContent.replace(
            /<citation\s+id="([^"]+)">(\[[0-9,\s]+\])<\/citation>/gi,
            (match, id, citationNum) => {
                return `CITATION[${id}]${citationNum}CITATIONEND`;
            }
        );
    }
    
    // Parse markdown
    const htmlOutput = marked.parse(processedContent);
    
    // Now replace our markers with proper HTML
    let processedHtml = htmlOutput;
    if (appState.copilotMode === 'analyst' && !isSystemMessage) {
        // Replace audio clip markers
        processedHtml = htmlOutput.replace(
            /AUDIOCLIP\[([^\]]+)\]&gt;\s*([\s\S]*?)AUDIOCLIPEND/gi,
            (match, id, content) => {
                // Clean up the content (remove the blockquote tags that markdown added)
                const cleanContent = content.replace(/<\/?blockquote>/g, '').trim();
                console.log('[Audio Clip Rendering] Creating audio quote with ID:', id);
                const html = `
                    <blockquote class="audio-quote" data-audio-id="${id}">
                        <div class="audio-quote-content">
                            ${cleanContent}
                        </div>
                        <button class="audio-quote-play-btn" type="button" title="Play audio clip">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        </button>
                    </blockquote>
                `;
                console.log('[Audio Clip Rendering] Generated HTML:', html);
                return html;
            }
        );
        
        // Replace citation markers with hoverable spans
        processedHtml = processedHtml.replace(
            /CITATION\[([^\]]+)\](\[[0-9,\s]+\])CITATIONEND/gi,
            (match, id, citationNum) => {
                console.log('[Citation Processing] Found citation:', { id, citationNum });
                
                // Get the response data for this citation
                const responseData = window.audioResponseDataStore && window.audioResponseDataStore[id];
                console.log('[Citation Processing] Looking up response data:', {
                    id,
                    storeExists: !!window.audioResponseDataStore,
                    storeSize: window.audioResponseDataStore ? Object.keys(window.audioResponseDataStore).length : 0,
                    dataFound: !!responseData
                });
                
                let hovercardHtml = '';
                
                if (responseData) {
                    console.log('[Citation Processing] Found response data for citation:', {
                        id,
                        answerLength: responseData.answer?.length,
                        responseData: responseData
                    });
                    
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
                            <div class="citation-hovercard-label">Citation ${citationNum}</div>
                            <div class="citation-hovercard-content">"${escapedAnswer}"</div>
                        </div>
                    `;
                } else {
                    console.log('[Citation Processing] No response data found for citation:', id);
                }
                
                const citationHtml = `<span class="audio-citation" data-audio-id="${id}" data-citation-num="${citationNum.replace(/[\[\]]/g, '')}">${citationNum}${hovercardHtml}</span>`;
                console.log('[Citation Processing] Generated citation HTML:', citationHtml);
                return citationHtml;
            }
        );
    }

    messageElement.innerHTML = `
        <div class="message-wrapper">
            <div class="message-content">
                ${processedHtml}
            </div>
            ${appState.copilotMode === 'analyst' && !isSystemMessage ? `
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
            ` : ''}
        </div>
    `;
    copilotMessagesEl.appendChild(messageElement);
    copilotMessagesEl.scrollTop = copilotMessagesEl.scrollHeight;
    
    // Log audio play buttons that were just added
    const audioButtons = messageElement.querySelectorAll('.audio-quote-play-btn');
    console.log('[appendAIMessage] Audio play buttons found in message:', audioButtons.length);
    audioButtons.forEach((btn, index) => {
        const blockquote = btn.closest('blockquote[data-audio-id]');
        const audioId = blockquote ? blockquote.getAttribute('data-audio-id') : null;
        console.log(`[appendAIMessage] Button ${index + 1} - Audio ID:`, audioId);
    });

    // Set up citation hover handlers
    const citations = messageElement.querySelectorAll('.audio-citation');
    console.log('[Citation Hover Setup] Found citations:', citations.length);
    
    citations.forEach((citation, index) => {
        const hovercard = citation.querySelector('.citation-hovercard');
        const audioId = citation.getAttribute('data-audio-id');
        const citationNum = citation.getAttribute('data-citation-num');
        
        console.log(`[Citation Hover Setup] Citation ${index + 1}:`, {
            audioId,
            citationNum,
            hasHovercard: !!hovercard,
            hovercardContent: hovercard?.textContent
        });
        
        if (!hovercard) {
            console.log(`[Citation Hover Setup] No hovercard found for citation ${index + 1}`);
            return;
        }

        citation.addEventListener('mouseenter', (e) => {
            console.log('[Citation Hover] Mouse enter on citation:', {
                audioId,
                citationNum,
                hovercardVisible: hovercard.style.visibility,
                hovercardOpacity: hovercard.style.opacity,
                computedStyles: window.getComputedStyle(hovercard),
                classList: hovercard.className,
                parentClasses: citation.className
            });
            
            const rect = citation.getBoundingClientRect();
            const hovercardRect = hovercard.getBoundingClientRect();
            
            console.log('[Citation Hover] Positioning:', {
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
            
            console.log('[Citation Hover] Final position:', {
                left: hovercard.style.left,
                top: hovercard.style.top
            });
            
            // Check if CSS is handling the hover
            setTimeout(() => {
                const computedStyle = window.getComputedStyle(hovercard);
                console.log('[Citation Hover] After hover - computed styles:', {
                    visibility: computedStyle.visibility,
                    opacity: computedStyle.opacity,
                    display: computedStyle.display,
                    position: computedStyle.position
                });
            }, 100);
        });
        
        citation.addEventListener('mouseleave', (e) => {
            console.log('[Citation Hover] Mouse leave on citation:', { audioId, citationNum });
        });
        
        // Test click on citation to check if hovercard exists
        citation.addEventListener('click', (e) => {
            console.log('[Citation Click] Testing hovercard visibility:', {
                hovercardElement: hovercard,
                innerHTML: hovercard.innerHTML,
                parentElement: hovercard.parentElement,
                isConnected: hovercard.isConnected
            });
        });
    });

    // Save to journal thread if in journal mode
    if (saveToDb && appState.isJournalAnalysisMode && !isSystemMessage && window.saveJournalThreadMessage) {
        // REMOVED - Already handled in saveThreadMessage to avoid duplication
        // appState.addThreadMessage({
        //     sender: 'assistant',
        //     content: message,
        //     timestamp: new Date()
        // });
        console.log('[appendAIMessage] Saving to journal thread');
        window.saveJournalThreadMessage('assistant', message);
    } else if (saveToDb && !isSystemMessage && appState.copilotMode === 'analyst' && appState.currentAnalystThreadId && window.saveAnalystThreadMessage) {
        // Save to analyst thread if in analyst mode
        console.log('[appendAIMessage] Saving to analyst thread:', appState.currentAnalystThreadId);
        window.saveAnalystThreadMessage('assistant', message);
    } else if (saveToDb && appState.currentEditingInterviewId && !isSystemMessage && db) {
        // Save to legacy copilot chat for editor mode
        const chatCollectionName = appState.copilotMode === 'analyst' ? 'analystChat' : 'copilotChat';
        db.collection('interviews').doc(appState.currentEditingInterviewId).collection(chatCollectionName).add({
            sender: 'ai',
            content: message,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(error => {
            console.error("Error saving AI message to Firestore:", error);
        });
    }
}

// Load chat history
window.loadChatHistory = function(interviewId, mode) {
    console.log('[loadChatHistory] Function called. Mode:', mode, 'Interview ID:', interviewId);
    const copilotMessagesEl = document.getElementById('copilotMessages');
    if (!copilotMessagesEl) {
        console.error("[loadChatHistory] copilotMessages element not found!");
        return;
    }
    copilotMessagesEl.innerHTML = ''; 
    
    if (!interviewId) {
        return;
    }

    // If analyst mode, initialize threads instead of loading legacy chat
    if (mode === 'analyst' && window.initializeAnalystThreads) {
        console.log(`[loadChatHistory] Initializing analyst threads for interview ${interviewId}`);
        console.log(`[loadChatHistory] Current state:`, {
            currentEditingInterviewId: appState.currentEditingInterviewId,
            copilotMode: appState.copilotMode,
            currentAnalystThreadId: appState.currentAnalystThreadId,
            analystThreadsLength: appState.analystThreads.length
        });
        window.initializeAnalystThreads(interviewId);
        return;
    }

    // Legacy chat loading for editor mode
    const chatCollectionName = mode === 'analyst' ? 'analystChat' : 'copilotChat';
    console.log(`[loadChatHistory] Loading for interview ${interviewId}, mode: ${mode}, collection: ${chatCollectionName}`);

    if (!db) {
        console.error("[loadChatHistory] Firestore db instance not found!");
        return;
    }

    db.collection('interviews').doc(interviewId).collection(chatCollectionName).orderBy('timestamp', 'asc').get()
        .then(chatSnapshot => {
            if (chatSnapshot.empty) {
                const emptyMessage = mode === 'analyst' 
                    ? "No analysis chat history for this interview yet. Start by asking a question about its responses."
                    : "No editor chat history for this interview yet. Start the conversation with the copilot.";
                window.appendAIMessage(emptyMessage, false, true); 
            } else {
                chatSnapshot.forEach(chatDoc => {
                    const chatData = chatDoc.data();
                    if (chatData.sender === 'user') {
                        window.appendUserMessage(chatData.content, false); 
                    } else if (chatData.sender === 'ai') {
                        window.appendAIMessage(chatData.content, false); 
                    } else if (chatData.sender === 'system') {
                        // Skip system messages - they contain context documents and shouldn't be displayed
                        console.log('[loadChatHistory] Skipping system message display');
                    }
                });
            }
        })
        .catch(error => {
            console.error(`Error loading ${chatCollectionName} history:`, error);
            window.appendAIMessage(`Error loading ${mode} chat history.`, false, true);
        });
}

// Set copilot mode
window.setCopilotMode = function(mode) {
    console.log('[setCopilotMode UI update] Attempting to set mode to:', mode, 'Current appState.isJournalAnalysisMode:', appState.isJournalAnalysisMode);
    
    // 1. Update AppState first (this will also handle forcing 'analyst' if in journal mode)
    if (mode === 'editor' && !appState.isJournalAnalysisMode) {
        appState.setCopilotMode('editor');
    } else if (mode === 'analyst') {
        appState.setCopilotMode('analyst');
    }

    const currentMode = appState.copilotMode;
    const inJournalMode = appState.isJournalAnalysisMode;

    // Fetch buttons and UI elements for update
    const editorBtn = document.getElementById('editorModeBtn');
    const analystBtn = document.getElementById('analystModeBtn');
    const copilotTitleEl = document.getElementById('copilotTitle');
    const copilotSubtitleEl = document.getElementById('copilotSubtitle');
    const copilotModeToggleEl = document.getElementById('copilotModeToggle');

    // 2. Update UI based on AppState
    if (inJournalMode) {
        if (copilotModeToggleEl) copilotModeToggleEl.style.display = 'none';
        if (editorBtn) editorBtn.disabled = true;
        if (analystBtn) analystBtn.disabled = false;
        // Ensure analystBtn is active visually if forced by journal mode
        if (analystBtn) analystBtn.classList.add('active');
        if (editorBtn) editorBtn.classList.remove('active');
    } else {
        if (copilotModeToggleEl) copilotModeToggleEl.style.display = 'flex';
        if (editorBtn) editorBtn.disabled = false;
        
        // Debug analyst button state
        const shouldDisableAnalyst = !appState.currentEditingInterviewId;
        console.log('[setCopilotMode] Analyst button state:', {
            currentEditingInterviewId: appState.currentEditingInterviewId,
            shouldDisableAnalyst: shouldDisableAnalyst
        });
        
        if (analystBtn) analystBtn.disabled = shouldDisableAnalyst;
        
        // Set active class based on currentMode from appState
        if (currentMode === 'editor') {
            if (editorBtn) editorBtn.classList.add('active');
            if (analystBtn) analystBtn.classList.remove('active');
        } else {
            if (analystBtn) analystBtn.classList.add('active');
            if (editorBtn) editorBtn.classList.remove('active');
        }
    }
    
    // Update title and subtitle based on currentMode from appState
    if (currentMode === 'editor') {
        if (copilotTitleEl) copilotTitleEl.textContent = 'Interview Builder';
        // Update subtitle based on whether we have an interview or not
        if (copilotSubtitleEl) {
            if (!appState.currentEditingInterviewId || appState.currentEditingInterviewId === '') {
                copilotSubtitleEl.textContent = 'Choose a template or describe your interview idea';
            } else {
                copilotSubtitleEl.textContent = 'Give feedback to refine your interview';
            }
        }
    } else if (currentMode === 'analyst') {
        if (copilotTitleEl) copilotTitleEl.textContent = 'Content Producer';
        if (inJournalMode) {
            const emailFilterDropdown = document.getElementById('emailFilterDropdown');
            const selectedEmail = emailFilterDropdown ? emailFilterDropdown.value : 'all';
            if (selectedEmail && selectedEmail !== 'all') {
                if (copilotSubtitleEl) copilotSubtitleEl.textContent = `Ask questions about ${selectedEmail}`;
            } else {
                if (copilotSubtitleEl) copilotSubtitleEl.textContent = 'Ask questions about your past activity.';
            }
        } else {
            if (copilotSubtitleEl) copilotSubtitleEl.textContent = 'Ask questions about interview responses.';
        }
    }
    console.log("Copilot mode UI updated to:", currentMode, "In Journal Mode:", inJournalMode);
    
    // Update analyst thread UI based on mode
    if (window.updateAnalystThreadUI) {
        window.updateAnalystThreadUI();
    }
    
    // Dispatch event for other components to react to mode changes
    document.dispatchEvent(new CustomEvent('copilotModeChanged', { detail: { mode: currentMode } }));
    
    // Also directly update file upload visibility
    if (window.updateFileUploadVisibility) {
        window.updateFileUploadVisibility();
    }

    // 3. Handle Chat History Loading / Clearing based on AppState
    const copilotMessagesEl = document.getElementById('copilotMessages');
    if (!copilotMessagesEl) return;

    if (appState.currentEditingInterviewId) {
        console.log('[setCopilotMode UI update] Calling loadChatHistory. ID:', appState.currentEditingInterviewId, 'Mode:', currentMode);
        window.loadChatHistory(appState.currentEditingInterviewId, currentMode); 
    } else if (inJournalMode) {
        copilotMessagesEl.innerHTML = '';
        window.appendAIMessage("You are now in 'Interview Feed Analysis Mode'. I can help you analyze trends and insights across your past interviews. Ask me anything about them!", false, true);
        console.log('[setCopilotMode UI update] Journal analysis mode active, chat cleared and system message added.');
    } else {
        copilotMessagesEl.innerHTML = ''; 
        if (currentMode === 'editor' && appState.initialChatMessages.length === 0) {
            // Show clickable prompt cards instead of text message
            showCopilotPromptCards();
        } else if (currentMode === 'editor') {
            appState.initialChatMessages.forEach(msg => {
                if (msg.sender === 'user') window.appendUserMessage(msg.content, false);
                else window.appendAIMessage(msg.content, false, msg.sender === 'system');
            });
        }
        console.log('[setCopilotMode UI update] No current interview ID, chat cleared or initial messages displayed.');
    }
    
    // Show/hide toggle based on interview existence
    const copilotModeToggle = document.getElementById('copilotModeToggle');
    if (copilotModeToggle) {
        if (appState.currentEditingInterviewId) {
            copilotModeToggle.classList.remove('hidden');
        } else {
            copilotModeToggle.classList.add('hidden');
        }
    }
}

// Initialize copilot chat functionality
function initCopilotChat() {
    const copilotInput = document.getElementById('copilotInput');
    const sendCopilotMessage = document.getElementById('sendCopilotMessage');
    const thinkingIndicator = document.getElementById('thinkingIndicator');
    const editorModeBtn = document.getElementById('editorModeBtn');
    const analystModeBtn = document.getElementById('analystModeBtn');

    // Send message when button is clicked
    sendCopilotMessage?.addEventListener('click', function() {
        sendCopilotMessageToAI();
    });

    // Also send message when Enter key is pressed (without Shift)
    copilotInput?.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendCopilotMessageToAI();
        }
    });

    // Add auto-resize functionality to copilotInput textarea
    copilotInput?.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // Function to send message to AI
    async function sendCopilotMessageToAI() {
        const message = copilotInput.value.trim();
        if (!message) return;

        // Check if there's a pending file upload
        if (window.pendingCopilotFileUpload) {
            console.log('[sendCopilotMessageToAI] Waiting for pending file upload to complete...');
            console.log('[sendCopilotMessageToAI] appendAIMessage exists:', typeof window.appendAIMessage);
            console.log('[sendCopilotMessageToAI] copilotMessages element exists:', !!document.getElementById('copilotMessages'));
            
            // Add the uploading message
            const uploadingMsg = '📎 Uploading file, please wait...';
            console.log('[sendCopilotMessageToAI] Adding uploading message:', uploadingMsg);
            appendAIMessage(uploadingMsg, false, true);
            
            // Check if message was added
            const messages = document.getElementById('copilotMessages');
            console.log('[sendCopilotMessageToAI] Messages element after append:', messages);
            console.log('[sendCopilotMessageToAI] Last message in chat:', messages?.lastElementChild?.textContent);
            
            try {
                await window.pendingCopilotFileUpload;
                console.log('[sendCopilotMessageToAI] File upload completed, proceeding with message');
                // Clear the "uploading" message
                const lastMessage = messages?.lastElementChild;
                if (lastMessage && lastMessage.textContent.includes('Uploading file')) {
                    console.log('[sendCopilotMessageToAI] Removing uploading message');
                    lastMessage.remove();
                }
            } catch (error) {
                console.error('[sendCopilotMessageToAI] File upload failed:', error);
                appendAIMessage('❌ File upload failed. Proceeding without file context.', false, true);
            }
        } else {
            console.log('[sendCopilotMessageToAI] No pending file upload');
        }

        // Check if there's an attached image (moved up to fix initialization error)
        let imageData = null;
        if (window.copilotUploadedFile && window.copilotFileContent && window.copilotFileContent.type === 'image') {
            console.log('[sendCopilotMessageToAI] Image attached, including in message');
            imageData = window.copilotFileContent;
        }

        const shouldSaveUserMessageToDb = !!appState.currentEditingInterviewId || appState.isJournalAnalysisMode || (appState.copilotMode === 'analyst' && appState.currentAnalystThreadId);
        
        // Clear chat window if in editor mode and starting a new interview
        if (appState.copilotMode === 'editor' && !appState.currentEditingInterviewId) {
            const copilotMessagesEl = document.getElementById('copilotMessages');
            if (copilotMessagesEl) {
                console.log('[sendCopilotMessageToAI] Clearing chat for new interview in editor mode');
                copilotMessagesEl.innerHTML = '';
            }
        }
        
        // Clear prompt cards in analyst mode if they exist
        if (appState.copilotMode === 'analyst') {
            const copilotMessagesEl = document.getElementById('copilotMessages');
            if (copilotMessagesEl) {
                const promptCards = copilotMessagesEl.querySelector('.copilot-prompt-cards');
                if (promptCards) {
                    console.log('[sendCopilotMessageToAI] Clearing prompt cards in analyst mode');
                    copilotMessagesEl.innerHTML = '';
                }
            }
        }
        
        // If there's an image, append it with the message
        let displayMessage = message;
        if (imageData) {
            displayMessage = message + `\n\n![Uploaded image](${imageData.dataUrl})`;
        }
        
        appendUserMessage(displayMessage, shouldSaveUserMessageToDb);
        copilotInput.value = '';
        copilotInput.style.height = 'auto'; // Reset height after sending
        
        // Clear the uploaded file after sending
        if (imageData && window.clearCopilotFile) {
            window.clearCopilotFile();
        }

        let specNullStateWasShowingThinkingAnimation = false;
        const specificationNullState = document.getElementById('specificationNullState');
        if (specificationNullState && specificationNullState.style.display !== 'none') {
            specNullStateWasShowingThinkingAnimation = true;
            specificationNullState.innerHTML = window.specThinkingHTML || '<p>Processing...</p>';
        }
        // Show thinking panel instead of overlay (only in editor mode)
        if (appState.copilotMode === 'editor') {
            showThinkingPanel();
        }

        const interviewIdBeforeAICall = appState.currentEditingInterviewId;
        const currentModeForAICall = appState.copilotMode;

        if (!appState.currentEditingInterviewId) {
            appState.addInitialChatMessage({ sender: 'user', content: message });
        }
        console.log('[admin.html sendCopilotMessageToAI] State before calling processMessageWithAI: currentEditingInterviewId =', appState.currentEditingInterviewId, 'initialChatMessages =', JSON.stringify(appState.initialChatMessages.map(m => ({...m, content: m.content.substring(0,50) + '...'}))) );

        // Pass message with optional image data
        const messageData = imageData ? { text: message, image: imageData } : message;
        
        processMessageWithAI(
            messageData, 
            (response) => {
                // Hide thinking panel (only in editor mode)
                if (currentModeForAICall === 'editor') {
                    hideThinkingPanel();
                }
                const shouldSaveAIMessageToDb = !!interviewIdBeforeAICall || appState.isJournalAnalysisMode || (currentModeForAICall === 'analyst' && appState.currentAnalystThreadId);
                
                console.log('[AI Response] Received response, shouldSave:', shouldSaveAIMessageToDb, 'mode:', currentModeForAICall, 'threadId:', appState.currentAnalystThreadId);
                
                if (!interviewIdBeforeAICall) {
                    appState.addInitialChatMessage({ sender: 'ai', content: response });
                }
                appendAIMessage(response, shouldSaveAIMessageToDb);
                
                if (appState.currentEditingInterviewId) {
                    const saveCopilotInterview = document.getElementById('saveCopilotInterview');
                    const saveCopilotInterviewFromFilesTab = document.getElementById('saveCopilotInterviewFromFilesTab');
                    if (saveCopilotInterview) saveCopilotInterview.disabled = false;
                    if (saveCopilotInterviewFromFilesTab) saveCopilotInterviewFromFilesTab.disabled = false;
                }
                
                if (!appState.isJournalAnalysisMode && window.showSpecificationDetails) {
                    window.showSpecificationDetails();
                }
                specNullStateWasShowingThinkingAnimation = false;
            },
            (error) => {
                // Hide thinking panel (only in editor mode)
                if (currentModeForAICall === 'editor') {
                    hideThinkingPanel();
                }
                const errorMessageText = `Sorry, I encountered an error: ${error.message}. Please try again.`;
                appendAIMessage(errorMessageText, false);
                if (specNullStateWasShowingThinkingAnimation && window.showSpecificationNullState) {
                    window.showSpecificationNullState();
                }
                specNullStateWasShowingThinkingAnimation = false;
            }
        );
    }

    // Add event listeners for mode toggle buttons
    editorModeBtn?.addEventListener('click', () => setCopilotMode('editor'));
    analystModeBtn?.addEventListener('click', () => setCopilotMode('analyst'));
    
    // Set initial copilot mode based on appState
    if (window.setCopilotMode) {
        window.setCopilotMode(appState.copilotMode || 'editor');
    }
    
    // Also ensure file upload visibility is set after a small delay
    setTimeout(() => {
        if (window.updateFileUploadVisibility) {
            window.updateFileUploadVisibility();
        }
    }, 100);
}

// Function to generate preview content based on prompt
window.generatePreviewContent = async function(type, promptText) {
    if (!promptText) {
        throw new Error('Prompt text is required');
    }

    try {
        // Get context from uploaded files
        let contextContent = '';
        if (appState.interviewSpec.contextFiles && appState.interviewSpec.contextFiles.length > 0) {
            // Fetch context files content if available
            contextContent = "Context files are uploaded but content not loaded in preview mode.";
        }

        // Prepare the message for AI based on type
        let aiPrompt = '';
        switch (type) {
            case 'initial':
                aiPrompt = `Generate a single initial interview question based on this prompt:\n\n${promptText}\n\n${contextContent ? 'Context: ' + contextContent : ''}\n\nReturn ONLY the question text, nothing else.`;
                break;
            case 'followup':
                aiPrompt = `Generate an example follow-up question that might be asked based on this prompt:\n\n${promptText}\n\nAssume the user has already answered an initial question. Return ONLY the follow-up question text, nothing else.`;
                break;
            case 'report':
                aiPrompt = `Generate a brief example of what a user-facing report might look like based on this prompt:\n\n${promptText}\n\nReturn a short markdown-formatted example report (2-3 paragraphs).`;
                break;
            case 'admin-report':
                aiPrompt = `Generate a brief example of what an admin-only report might look like based on this prompt:\n\n${promptText}\n\nReturn a short markdown-formatted example report with insights for the interview creator (2-3 paragraphs).`;
                break;
            default:
                throw new Error('Unknown preview type: ' + type);
        }

        // Call the AI to generate content
        const response = await processMessageWithAI(
            aiPrompt,
            (result) => result,
            (error) => { throw error; }
        );

        return { content: response };
    } catch (error) {
        console.error('Error generating preview content:', error);
        throw error;
    }
};

// Display analyst thread messages
window.displayAnalystThreadMessages = async function() {
    const copilotMessagesEl = document.getElementById('copilotMessages');
    if (!copilotMessagesEl) return;
    
    console.log('[displayAnalystThreadMessages] Displaying messages for thread:', appState.currentAnalystThreadId);
    console.log('[displayAnalystThreadMessages] Messages to display:', appState.currentAnalystThreadMessages.length);
    
    copilotMessagesEl.innerHTML = '';
    
    if (appState.currentAnalystThreadMessages.length === 0) {
        console.log('[displayAnalystThreadMessages] No messages, showing analyst prompt cards');
        window.showAnalystPromptCards();
        return;
    }
    
    // Ensure analyst data is loaded for hovercards
    if (window.ensureAnalystDataLoaded) {
        await window.ensureAnalystDataLoaded();
    }
    
    // Display all messages from the thread
    appState.currentAnalystThreadMessages.forEach((msg, index) => {
        console.log(`[displayAnalystThreadMessages] Displaying message ${index}:`, { sender: msg.sender, contentLength: msg.content?.length });
        if (msg.sender === 'user') {
            window.appendUserMessage(msg.content, false);
        } else if (msg.sender === 'assistant') {
            window.appendAIMessage(msg.content, false);
        }
    });
}

// Update analyst thread UI (dropdown/inbox)
window.updateAnalystThreadUI = function() {
    const analystDropdown = document.getElementById('analystThreadDropdown');
    const journalTabs = document.getElementById('journalThreadTabs');
    
    console.log('[updateAnalystThreadUI] Called. Mode:', appState.copilotMode, 'IsJournal:', appState.isJournalAnalysisMode);
    
    // Hide journal tabs if in analyst mode
    if (journalTabs) {
        journalTabs.classList.add('hidden');
    }
    
    // If not in analyst mode or in journal mode, hide the dropdown
    if (appState.copilotMode !== 'analyst' || appState.isJournalAnalysisMode) {
        if (analystDropdown) {
            analystDropdown.classList.add('hidden');
        }
        return;
    }
    
    // Show the analyst dropdown
    if (analystDropdown) {
        analystDropdown.classList.remove('hidden');
        
        // Update the dropdown options
        const select = document.getElementById('analystThreadSelect');
        const threads = appState.analystThreads || [];
        const currentThreadId = appState.currentAnalystThreadId;
        
        console.log('[updateAnalystThreadUI] Updating dropdown. Threads:', threads.length, 'Current:', currentThreadId);
        
        if (threads.length === 0) {
            select.innerHTML = '<option value="">No conversations yet</option>';
            select.disabled = true;
        } else {
            select.disabled = false;
            select.innerHTML = threads.map(thread => 
                `<option value="${thread.id}" ${thread.id === currentThreadId ? 'selected' : ''}>
                    ${escapeXml(thread.threadTitle || 'Untitled Thread')}
                </option>`
            ).join('');
        }
        
        // Attach event listeners if not already attached
        if (!select.hasAttribute('data-listeners-attached')) {
            select.addEventListener('change', (e) => {
                console.log('[updateAnalystThreadUI] Thread selected:', e.target.value);
                window.selectAnalystThread(e.target.value);
            });
            
            const newThreadBtn = document.getElementById('newAnalystThreadBtn');
            if (newThreadBtn) {
                newThreadBtn.addEventListener('click', () => {
                    console.log('[updateAnalystThreadUI] New thread button clicked');
                    window.createAnalystThread(appState.currentEditingInterviewId);
                });
            }
            
            const deleteThreadBtn = document.getElementById('deleteAnalystThreadBtn');
            if (deleteThreadBtn) {
                deleteThreadBtn.addEventListener('click', () => {
                    const threadId = select.value;
                    if (!threadId) return;
                    
                    const thread = appState.analystThreads.find(t => t.id === threadId);
                    const threadTitle = thread?.threadTitle || 'this thread';
                    
                    if (confirm(`Delete "${threadTitle}"? This cannot be undone.`)) {
                        console.log('[updateAnalystThreadUI] Deleting thread:', threadId);
                        window.deleteAnalystThread(threadId);
                    }
                });
            }
            
            select.setAttribute('data-listeners-attached', 'true');
        }
    }
};


// Clean up when switching modes
window.addEventListener('copilotModeChanged', (e) => {
    if (e.detail && e.detail.mode !== 'analyst') {
        // Hide analyst thread dropdown
        const analystDropdown = document.getElementById('analystThreadDropdown');
        if (analystDropdown) {
            analystDropdown.classList.add('hidden');
        }
        
        // Clean up state
        if (window.cleanupAnalystThreads) {
            window.cleanupAnalystThreads();
        }
    }
});

// Function to show clickable prompt cards
window.showCopilotPromptCards = function() {
    const copilotMessagesEl = document.getElementById('copilotMessages');
    if (!copilotMessagesEl) return;
    
    // All prompt cards - will be loaded in batches
    const allPromptCards = [
        // Batch 1 - Core content creation use cases (0-8, shows first 9)
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
            title: 'Interview about existing content',
            description: 'Create interviews from documents, articles, or text',
            prompt: 'Create an interview about this piece of content',
            requiresFile: true
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/><path d="M6 9a9 9 0 0 0 9 9"/></svg>',
            title: 'Fork an existing interview',
            description: 'Use responses from a previous interview as context',
            prompt: 'Create a personalized interview based on responses',
            requiresInterviewSelection: true
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
            title: 'Customer story interview',
            description: 'Real experiences with products or services',
            prompt: 'Create interviews that capture authentic customer experiences, transformations, and success stories.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
            title: 'Create a documentary interview',
            description: 'In-depth storytelling conversations',
            prompt: 'Design an interview that uncovers compelling personal stories and insights for documentary content.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
            title: 'Podcast guest interview',
            description: 'Engaging audio conversations',
            prompt: 'Create a podcast interview format that draws out interesting stories and keeps listeners engaged.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 8s-4 6-10 6S2 8 2 8s4-6 10-6 10 6 10 6z"/><circle cx="12" cy="8" r="3"/></svg>',
            title: 'Host a video interview show',
            description: 'Build your own interview series',
            prompt: 'Design an interview format for hosting your own video show, whether for YouTube, social media, or your website.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="9" x2="18" y2="15"/></svg>',
            title: 'Expert or thought leader interview',
            description: 'Extract wisdom and insights',
            prompt: 'Create an interview that showcases expertise while making complex topics accessible to your audience.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
            title: 'Personal story interview',
            description: 'Human interest and inspiration',
            prompt: 'Design an interview that brings out authentic personal experiences and emotional connections.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
            title: 'Journalistic investigation',
            description: 'Uncover truth and gather facts',
            prompt: 'Create an investigative interview that builds trust while uncovering important information and stories.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>',
            title: 'Build an interview series',
            description: 'Multi-episode content journey',
            prompt: 'Create a connected series of interviews that build upon each other to tell a larger story.',
            requiresInterviewSelection: true
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
            title: 'Author or book interview',
            description: 'Literary conversations and book promotion',
            prompt: 'Design an interview that explores the writing process, book themes, and author insights.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
            title: 'Social media content interview',
            description: 'Short-form engaging clips',
            prompt: 'Create interviews optimized for social media that capture attention and drive engagement.'
        },
        
        // Batch 2 - Additional content creation use cases (9-20)
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
            title: 'Success story interview',
            description: 'Inspiring transformation narratives',
            prompt: 'Design an interview that captures compelling before-and-after stories and personal triumphs.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6m3-3h-6"/></svg>',
            title: 'Character research interview',
            description: 'Deep dive for writers and creators',
            prompt: 'Create interviews to understand real people who inspire fictional characters or storylines.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>',
            title: 'Educational content interview',
            description: 'Teaching through conversation',
            prompt: 'Design interviews that educate your audience while keeping them engaged and entertained.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
            title: 'Audience research interview',
            description: 'Understand your viewers and listeners',
            prompt: 'Create interviews to discover what your audience wants and how to serve them better.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
            title: 'Panel discussion interview',
            description: 'Multiple perspectives on one topic',
            prompt: 'Design a group interview format that brings together diverse voices for rich discussion.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>',
            title: 'Behind-the-scenes interview',
            description: 'Process and production insights',
            prompt: 'Create interviews that reveal how things are made, from creative works to products.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
            title: 'True crime investigation',
            description: 'Uncover mysteries and cold cases',
            prompt: 'Design interviews that carefully explore sensitive topics while building compelling investigative narratives.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
            title: 'Health and wellness interview',
            description: 'Personal transformation stories',
            prompt: 'Create interviews about health journeys, wellness transformations, and lifestyle changes.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
            title: 'Travel and culture interview',
            description: 'Explore places and perspectives',
            prompt: 'Design interviews that capture local stories, cultural insights, and travel experiences.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>',
            title: 'Tech and innovation interview',
            description: 'Future-focused conversations',
            prompt: 'Create interviews exploring technology, startups, and innovation in accessible ways.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
            title: 'Historical narrative interview',
            description: 'Preserve stories from the past',
            prompt: 'Design interviews that capture historical events through personal experiences and memories.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
            title: 'Sports and athlete interview',
            description: 'Championship mindsets and training',
            prompt: 'Create interviews that explore athletic journeys, mental toughness, and competitive insights.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20v-6a6 6 0 0 1 6-6h3"/><path d="M3 20v-6a6 6 0 0 1 6-6h3"/><circle cx="12" cy="4" r="2"/></svg>',
            title: 'Family history interview',
            description: 'Preserve generational stories',
            prompt: 'Design interviews that capture family memories, traditions, and wisdom for future generations.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
            title: 'Crisis and resilience interview',
            description: 'Stories of overcoming adversity',
            prompt: 'Create sensitive interviews about facing challenges and finding strength in difficult times.'
        },
        
        // Batch 3 - More entertainment/content use cases (21+)
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
            title: 'Community voices interview',
            description: 'Local stories and perspectives',
            prompt: 'Design interviews that capture diverse community voices and grassroots stories.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
            title: 'Music and artist interview',
            description: 'Creative process and performance',
            prompt: 'Create interviews exploring musical journeys, songwriting, and artistic evolution.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>',
            title: 'Awards and recognition story',
            description: 'Celebrate excellence and achievement',
            prompt: 'Design interviews that highlight award winners and their paths to recognition.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
            title: 'Climate and environment interview',
            description: 'Sustainability and conservation stories',
            prompt: 'Create interviews about environmental challenges, solutions, and personal actions.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>',
            title: 'Mentor wisdom interview',
            description: 'Life lessons and guidance',
            prompt: 'Design interviews that extract valuable life lessons and mentorship insights.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>',
            title: 'Business story interview',
            description: 'Entrepreneurship and leadership',
            prompt: 'Create interviews about business journeys, startup stories, and leadership insights.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
            title: 'Event and conference interview',
            description: 'Capture insights from gatherings',
            prompt: 'Design interviews that extract key takeaways and stories from events and conferences.'
        }
    ];
    
    // Track loaded cards
    let loadedCount = 0;
    let isLoading = false; // Prevent multiple simultaneous loads
    const cardsPerBatch = 9; // Show 9 cards initially
    const cardsGrid = document.createElement('div');
    cardsGrid.className = 'prompt-cards-grid';
    
    // Function to load more cards
    const loadMoreCards = () => {
        if (isLoading) return;
        isLoading = true;
        
        const startIndex = loadedCount;
        const endIndex = Math.min(loadedCount + cardsPerBatch, allPromptCards.length);
        
        for (let i = startIndex; i < endIndex; i++) {
            const card = allPromptCards[i];
            const cardElement = document.createElement('div');
            cardElement.className = 'prompt-card';
            cardElement.setAttribute('data-prompt', card.prompt);
            if (card.requiresFile) {
                cardElement.setAttribute('data-requires-file', 'true');
            }
            if (card.requiresInterviewSelection) {
                cardElement.setAttribute('data-requires-interview-selection', 'true');
            }
            cardElement.innerHTML = `
                <div class="prompt-card-icon">${card.icon}</div>
                <h4 class="prompt-card-title">${card.title}</h4>
                <p class="prompt-card-description">${card.description}</p>
                ${card.requiresFile ? '<div class="prompt-card-badge">📎 Requires file</div>' : ''}
                ${card.requiresInterviewSelection ? '<div class="prompt-card-badge">📋 Select interview</div>' : ''}
            `;
            
            // Add click handler
            cardElement.setAttribute('tabindex', '0');
            cardElement.setAttribute('role', 'button');
            cardElement.addEventListener('click', handleCardClick);
            cardElement.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick.call(this);
                }
            });
            
            cardsGrid.appendChild(cardElement);
        }
        
        loadedCount = endIndex;
        isLoading = false; // Reset loading flag
        
        // Update remaining count and show/hide button
        const remaining = allPromptCards.length - loadedCount;
        if (remaining > 0) {
            scrollHint.style.display = 'block';
            const hintText = scrollHint.querySelector('.scroll-hint-text');
            if (hintText) {
                hintText.textContent = `↓ ${remaining} more interview types available`;
            }
        } else {
            scrollHint.style.display = 'none';
        }
    };
    
    // Scroll handler for lazy loading
    const scrollHandler = (e) => {
        const scrollPosition = copilotMessagesEl.scrollTop + copilotMessagesEl.clientHeight;
        const scrollHeight = copilotMessagesEl.scrollHeight;
        
        // Load more when user scrolls to 70% of current content
        if (scrollPosition > scrollHeight * 0.7 && loadedCount < allPromptCards.length && !isLoading) {
            loadMoreCards();
        }
    };
    
    // Card click handler (moved outside to avoid redefinition)
    const handleCardClick = function() {
        const requiresFile = this.getAttribute('data-requires-file') === 'true';
        const requiresInterviewSelection = this.getAttribute('data-requires-interview-selection') === 'true';
        const prompt = this.getAttribute('data-prompt');
        
        if (requiresInterviewSelection) {
            // Show interview selection panel
            if (window.openInterviewSelectionPanel) {
                window.openInterviewSelectionPanel(prompt);
            }
        } else if (requiresFile) {
            // Special handling for content-based interview card
            window._contentInterviewPendingPrompt = prompt;
            
            const attachButton = document.getElementById('attachCopilotFile');
            if (attachButton) {
                attachButton.click();
            }
            
            // Set up a mutation observer to watch for file upload completion
            const filePreview = document.getElementById('copilotFilePreview');
            if (filePreview) {
                const observer = new MutationObserver(async (mutations) => {
                    if (!filePreview.classList.contains('hidden') && window._contentInterviewPendingPrompt) {
                        observer.disconnect();
                        
                        // Wait for any pending file upload to complete
                        if (window.pendingCopilotFileUpload) {
                            try {
                                console.log('[Content Interview] Waiting for file upload to complete...');
                                await window.pendingCopilotFileUpload;
                                console.log('[Content Interview] File upload completed');
                            } catch (error) {
                                console.error('[Content Interview] File upload failed:', error);
                                alert('File upload failed. Please try again.');
                                window._contentInterviewPendingPrompt = null;
                                return;
                            }
                        }
                        
                        // Set the prompt
                        const copilotInput = document.getElementById('copilotInput');
                        if (copilotInput) {
                            copilotInput.value = window._contentInterviewPendingPrompt;
                            
                            // Clear prompt cards and send message
                            setTimeout(() => {
                                copilotMessagesEl.innerHTML = '';
                                const sendButton = document.getElementById('sendCopilotMessage');
                                if (sendButton) sendButton.click();
                                
                                // Clean up
                                window._contentInterviewPendingPrompt = null;
                            }, 200);
                        }
                    }
                });
                
                observer.observe(filePreview, { 
                    attributes: true, 
                    attributeFilter: ['class'] 
                });
                
                // Also set up a timeout to clean up if user cancels
                setTimeout(() => {
                    if (window._contentInterviewPendingPrompt) {
                        observer.disconnect();
                        window._contentInterviewPendingPrompt = null;
                    }
                }, 30000); // 30 second timeout
            }
        } else {
            // Normal card handling
            this.classList.add('loading');
            
            // Clear any leftover context files to prevent documentPath errors
            if (window.appState && window.appState.copilotContextFiles) {
                console.log('[Prompt Card] Clearing leftover context files');
                window.appState.copilotContextFiles = [];
            }
            
            // Also clear any uploaded file
            if (window.clearCopilotFile) {
                window.clearCopilotFile();
            }
            
            const copilotInput = document.getElementById('copilotInput');
            if (copilotInput && prompt) {
                copilotInput.value = prompt;
                
                // Small delay to show loading state
                setTimeout(() => {
                    // Clear the prompt cards
                    copilotMessagesEl.innerHTML = '';
                    // Trigger the send
                    const sendButton = document.getElementById('sendCopilotMessage');
                    if (sendButton) sendButton.click();
                }, 200);
            }
        }
    };
    
    // Create the container
    const containerHtml = `
        <div class="copilot-prompt-cards">
            <div class="prompt-cards-divider">
                <span>or</span>
            </div>
            <div class="prompt-cards-custom">
                <p>Have a different idea? Type your own interview concept below and I'll help you create it!</p>
            </div>
        </div>
    `;
    
    copilotMessagesEl.innerHTML = containerHtml;
    
    // Add a scroll hint / load more button after the grid
    const scrollHint = document.createElement('div');
    scrollHint.className = 'scroll-hint';
    let remainingCount = allPromptCards.length - cardsPerBatch;
    scrollHint.innerHTML = `
        <div class="scroll-hint-text">↓ ${remainingCount} more interview types available</div>
        <button class="load-more-btn" type="button">Show More Templates</button>
    `;
    scrollHint.style.display = 'none'; // Initially hidden
    
    // Get the container and insert the grid at the beginning
    const promptCardsContainer = copilotMessagesEl.querySelector('.copilot-prompt-cards');
    promptCardsContainer.insertBefore(cardsGrid, promptCardsContainer.firstChild);
    
    // Insert scroll hint after the grid
    cardsGrid.parentNode.insertBefore(scrollHint, cardsGrid.nextSibling);
    
    // Add click handler for load more button
    const loadMoreBtn = scrollHint.querySelector('.load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            console.log('[Lazy Loading] Load more button clicked');
            loadMoreCards();
        });
    }
    
    // Load initial batch
    loadMoreCards();
    
    // Remove automatic loading - only load via button click
    // This gives users control and prevents instant loading of everything
};

// Show thinking panel
window.showThinkingPanel = function() {
    const copilotMessagesEl = document.getElementById('copilotMessages');
    if (!copilotMessagesEl) return;
    
    // Remove any existing thinking panel
    const existingPanel = document.getElementById('copilotThinkingPanel');
    if (existingPanel) {
        existingPanel.remove();
    }
    
    // Create new thinking panel
    const thinkingPanel = document.createElement('div');
    thinkingPanel.id = 'copilotThinkingPanel';
    thinkingPanel.className = 'message ai-message thinking-panel animate-fade-in';
    thinkingPanel.innerHTML = `
        <div class="thinking-panel-container">
            <div class="thinking-panel-header" onclick="toggleThinkingPanel()">
                <div class="thinking-panel-title">
                    <div class="thinking-dots">
                        <span class="thinking-dot"></span>
                        <span class="thinking-dot"></span>
                        <span class="thinking-dot"></span>
                    </div>
                    <span class="thinking-label">Thinking...</span>
                </div>
                <svg class="thinking-toggle-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                </svg>
            </div>
            <div class="thinking-panel-content collapsed">
                <div class="thinking-trace-text"></div>
            </div>
        </div>
    `;
    
    // Always append as the last child (will be at bottom, above input)
    copilotMessagesEl.appendChild(thinkingPanel);
    
    // Scroll to bottom
    copilotMessagesEl.scrollTop = copilotMessagesEl.scrollHeight;
};

// Hide thinking panel
window.hideThinkingPanel = function() {
    const thinkingPanel = document.getElementById('copilotThinkingPanel');
    if (thinkingPanel) {
        thinkingPanel.style.display = 'none';
        // Clear thinking content
        const thinkingContent = thinkingPanel.querySelector('.thinking-trace-text');
        if (thinkingContent) {
            thinkingContent.textContent = '';
        }
    }
};

// Toggle thinking panel expand/collapse
window.toggleThinkingPanel = function() {
    const thinkingPanel = document.getElementById('copilotThinkingPanel');
    if (!thinkingPanel) return;
    
    const content = thinkingPanel.querySelector('.thinking-panel-content');
    const icon = thinkingPanel.querySelector('.thinking-toggle-icon');
    
    if (content.classList.contains('collapsed')) {
        content.classList.remove('collapsed');
        icon.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('collapsed');
        icon.style.transform = 'rotate(0deg)';
    }
};

// Handle streaming content from AI
window.addStreamingContent = function(content, type) {
    // Update thinking panel with all content (both thinking and content tokens)
    const thinkingPanel = document.getElementById('copilotThinkingPanel');
    if (thinkingPanel) {
        const thinkingContent = thinkingPanel.querySelector('.thinking-trace-text');
        if (thinkingContent) {
            if (type === 'thinking') {
                // Add thinking content in a different color/style
                const thinkingSpan = document.createElement('span');
                thinkingSpan.style.color = 'var(--text-tertiary)';
                thinkingSpan.style.fontStyle = 'italic';
                thinkingSpan.textContent = content;
                thinkingContent.appendChild(thinkingSpan);
            } else if (type === 'content') {
                // Add content tokens in normal style
                const contentSpan = document.createElement('span');
                contentSpan.style.color = 'var(--text-secondary)';
                contentSpan.textContent = content;
                thinkingContent.appendChild(contentSpan);
            }
            
            // Auto-scroll to bottom if panel is expanded
            const panelContent = thinkingPanel.querySelector('.thinking-panel-content');
            if (panelContent && !panelContent.classList.contains('collapsed')) {
                panelContent.scrollTop = panelContent.scrollHeight;
            }
        }
    }
};

// Clear streaming content
window.clearStreamingContent = function() {
    const thinkingPanel = document.getElementById('copilotThinkingPanel');
    if (thinkingPanel) {
        const thinkingContent = thinkingPanel.querySelector('.thinking-trace-text');
        if (thinkingContent) {
            thinkingContent.innerHTML = '';
        }
    }
};

// Show analyst prompt cards
window.showAnalystPromptCards = function() {
    const copilotMessagesEl = document.getElementById('copilotMessages');
    if (!copilotMessagesEl) return;
    
    // Analyst prompt cards for content production
    const analystPromptCards = [
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><polygon points="8 21 16 21 12 17 8 21"/></svg>',
            title: 'Create video script',
            description: 'Generate a 60-second video ad script',
            prompt: 'can you write a script for a 60 second video ad using the user\'s voice and an ai narrator? write nothing else except for the ai narration and the user\'s clips - not even \'Narrator:\' or \'User\''
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
            title: 'Analyze responses',
            description: 'Get insights from interview data',
            prompt: 'Analyze the responses in this interview. What are the key themes and insights?'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
            title: 'Create summary report',
            description: 'Generate a comprehensive summary',
            prompt: 'Create a detailed summary report of all the responses in this interview, highlighting the most important points.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
            title: 'Find key quotes',
            description: 'Extract impactful statements',
            prompt: 'Find the most impactful quotes from the interview responses that could be used for marketing or testimonials.'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
            title: 'Identify patterns',
            description: 'Discover trends in responses',
            prompt: 'What patterns or trends do you see across all the responses in this interview?'
        },
        {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
            title: 'Generate recommendations',
            description: 'Create actionable insights',
            prompt: 'Based on the interview responses, what recommendations would you make?'
        }
    ];
    
    // Create the cards grid
    const cardsGrid = document.createElement('div');
    cardsGrid.className = 'prompt-cards-grid';
    
    // Create card elements
    analystPromptCards.forEach(card => {
        const cardElement = document.createElement('div');
        cardElement.className = 'prompt-card';
        cardElement.setAttribute('data-prompt', card.prompt);
        cardElement.innerHTML = `
            <div class="prompt-card-icon">${card.icon}</div>
            <h4 class="prompt-card-title">${card.title}</h4>
            <p class="prompt-card-description">${card.description}</p>
        `;
        
        // Add click handler
        cardElement.setAttribute('tabindex', '0');
        cardElement.setAttribute('role', 'button');
        cardElement.addEventListener('click', function() {
            this.classList.add('loading');
            
            const copilotInput = document.getElementById('copilotInput');
            if (copilotInput && card.prompt) {
                copilotInput.value = card.prompt;
                
                // Small delay to show loading state
                setTimeout(() => {
                    // Clear the prompt cards
                    copilotMessagesEl.innerHTML = '';
                    // Trigger the send
                    const sendButton = document.getElementById('sendCopilotMessage');
                    if (sendButton) sendButton.click();
                }, 200);
            }
        });
        
        cardElement.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
        
        cardsGrid.appendChild(cardElement);
    });
    
    // Create the container
    const containerHtml = `
        <div class="copilot-prompt-cards">
            <div class="prompt-cards-divider">
                <span>or</span>
            </div>
            <div class="prompt-cards-custom">
                <p>Ask your own question about the interview responses below!</p>
            </div>
        </div>
    `;
    
    copilotMessagesEl.innerHTML = containerHtml;
    
    // Insert the grid at the beginning
    const promptCardsContainer = copilotMessagesEl.querySelector('.copilot-prompt-cards');
    promptCardsContainer.insertBefore(cardsGrid, promptCardsContainer.firstChild);
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initCopilotChat();
}); 