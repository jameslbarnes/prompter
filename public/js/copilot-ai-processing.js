// Copilot AI Processing Module

import { extractTagContent, escapeXml } from './xml-utils.js';

export function updateSpecificationUIFromAppState() {
    console.log('[admin.js] updateSpecificationUIFromAppState called. Current appState.interviewSpec:', JSON.parse(JSON.stringify(appState.interviewSpec)));
    const spec = appState.interviewSpec;
    
    // Add null checks for all DOM elements
    const specTitle = document.getElementById('specTitle');
    const specDescription = document.getElementById('specDescription');
    const specInitialQuestion = document.getElementById('specInitialQuestion');
    const specInitialPrompt = document.getElementById('specInitialPrompt');
    const specFollowupPrompt = document.getElementById('specFollowupPrompt');
    const specReportPrompt = document.getElementById('specReportPrompt');
    const specReportFrom = document.getElementById('specReportFrom');
    
    const specIndexHeader = document.getElementById('specIndexHeader');
    const specIndexSubheader = document.getElementById('specIndexSubheader');
    const specReportHeader = document.getElementById('specReportHeader');
    const specReportSubheader = document.getElementById('specReportSubheader');
    const specHasExternalDocument = document.getElementById('specHasExternalDocument');
    
    if (specTitle) specTitle.value = spec.title || '';
    if (specDescription) specDescription.value = spec.description || '';
    if (specInitialQuestion) specInitialQuestion.value = spec.initialPrompt || '';
    
    const specCategory = document.getElementById('specCategory');
    if (specCategory) specCategory.value = spec.category || '';
    
    // Update purpose field
    const specPurpose = document.getElementById('specPurpose');
    if (specPurpose) specPurpose.value = spec.purpose || '';
    
    // Update required information field
    const specRequiredInformation = document.getElementById('specRequiredInformation');
    if (specRequiredInformation) {
        // Convert array to newline-separated string for textarea
        specRequiredInformation.value = Array.isArray(spec.requiredInformation) 
            ? spec.requiredInformation.join('\n') 
            : (spec.requiredInformation || '');
    }
    
    if (specInitialPrompt) specInitialPrompt.value = spec.initialPrompt || '';
    if (specFollowupPrompt) specFollowupPrompt.value = spec.followupPrompt || '';
    if (specReportPrompt) specReportPrompt.value = spec.reportPrompt || '';
    if (specReportFrom) specReportFrom.value = spec.reportFrom || '';

    if (specIndexHeader) specIndexHeader.value = spec.pageHeaders?.intro || '';
    if (specIndexSubheader) specIndexSubheader.value = spec.pageHeaders?.interview || '';
    if (specReportHeader) specReportHeader.value = spec.pageHeaders?.report || '';
    if (specReportSubheader) specReportSubheader.value = spec.pageHeaders?.reportSub || '';
    if (specHasExternalDocument) specHasExternalDocument.checked = spec.hasExternalDocuments || false;

    // Update the "Enable Web Search" checkbox
    const enableWebSearchCheckbox = document.getElementById('specEnableWebSearch');
    if (enableWebSearchCheckbox) {
        enableWebSearchCheckbox.checked = spec.enableWebSearch || false;
    }

    // Update the "Enable Thinking" checkbox
    const enableThinkingCheckbox = document.getElementById('specEnableThinking');
    if (enableThinkingCheckbox) {
        const checkboxValue = spec.enableThinking !== undefined ? spec.enableThinking : true;
        console.log('[DEBUG] updateSpecificationUIFromAppState: setting thinking checkbox to:', checkboxValue, 'spec.enableThinking:', spec.enableThinking);
        enableThinkingCheckbox.checked = checkboxValue;
    }

    // Update the "Followup Model" select
    const followupModelSelect = document.getElementById('specFollowupModel');
    if (followupModelSelect) {
        followupModelSelect.value = spec.followupModel || 'claude-opus-4-5';
    }

    // Update memory service checkbox
    const enableMemoryCheckbox = document.getElementById('specEnableMemoryService');
    if (enableMemoryCheckbox) {
        enableMemoryCheckbox.checked = spec.enableMemoryService || false;
    }

    // Update video recording checkbox
    const enableVideoCheckbox = document.getElementById('specEnableVideoRecording');
    if (enableVideoCheckbox) {
        enableVideoCheckbox.checked = spec.enableVideoRecording || false;
    }

    // Apply feature gates if user features are loaded
    if (window.userFeatures) {
        applyFeatureGates();
    }

    // Update Preview Tab
    const previewInitialQuestion = document.getElementById('previewInitialQuestion');
    if (previewInitialQuestion) {
        previewInitialQuestion.textContent = spec.initialPrompt || 'No initial question loaded.';
    }
    
    const previewFollowupElement = document.getElementById('previewFollowupQuestion');
    if (previewFollowupElement) {
        previewFollowupElement.textContent = spec.exampleFollowupQuestion || 'Example followup question not available.';
    }
    
    const previewReportElement = document.getElementById('previewReport');
    if (previewReportElement) {
        let reportPreviewText = spec.exampleReportContent || '';
        const reportMatch = reportPreviewText.match(/<individual_summary_report>[\s\S]*?<\/individual_summary_report>/i);
        if (reportMatch && reportMatch[1]) reportPreviewText = reportMatch[1].trim();
        previewReportElement.innerHTML = reportPreviewText.replace(/\n/g, '<br>');
        if (!reportPreviewText) previewReportElement.textContent = 'Example individual summary not available.';
    }
    

    
}

export function addMessageToChat(sender, content) {
    const messageDiv = document.createElement('div');
    console.log('[Copilot System Msg in admin.js]', { sender: sender, content: content, timestamp: new Date().toISOString() });
    messageDiv.className = `message ${sender}-message animate-fade-in`;
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content text-white';
    if (sender === 'user') {
        messageContent.className += ' bg-gray-700 rounded-lg p-3 ml-auto max-w-[80%]';
        messageContent.textContent = content;
    } else { // AI or System message
        messageContent.className += ' bg-gray-600 rounded-lg p-3 max-w-[80%]';
        // Check if this is an AI response in editor mode which might be full XML
        if (sender === 'ai' && appState.copilotMode === 'editor' && typeof content === 'string' && content.trim().startsWith('<') && content.trim().endsWith('>')) {
            const extractedMessage = extractTagContent('message', content);
            if (extractedMessage) {
                messageContent.innerHTML = extractedMessage.replace(/\n/g, '<br>');
            } else {
                // Fallback if XML doesn't contain a <message> tag or if content is not the expected XML
                if (content.includes('<interview_title>') || content.includes('<initial_question>')) {
                    messageContent.innerHTML = "Specification update processed. Check the fields for details.";
                } else {
                    messageContent.innerHTML = content.replace(/\n/g, '<br>');
                }
            }
        } else {
            messageContent.innerHTML = content;
        }
    }
    messageDiv.appendChild(messageContent);
    const messagesContainer = document.getElementById('copilotMessages');
    if (messagesContainer) {
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Helper function to process editor mode response (both streamed and non-streamed)
export async function handleEditorModeResponse(aiResponse, successCb, errorCb) {
    console.log("[Editor Mode - handleEditorModeResponse] Received raw AI Response. Length:", aiResponse.length);
    console.log("[Editor Mode - handleEditorModeResponse] Raw AI Response (first 1000 chars on server):", aiResponse.substring(0, 1000));
    
    const isFirstCreationScenarioBeforeSave = !appState.currentEditingInterviewId;
    if (isFirstCreationScenarioBeforeSave) {
        appState.addInitialChatMessage({
            sender: 'ai', 
            content: aiResponse, 
            timestamp: new Date()
        });
    }

    const updatedSpecDataFromAI = {};
    updatedSpecDataFromAI.title = extractTagContent('interview_title', aiResponse, appState.interviewSpec.title);
    updatedSpecDataFromAI.description = extractTagContent('interview_description', aiResponse, appState.interviewSpec.description);
    updatedSpecDataFromAI.category = extractTagContent('interview_category', aiResponse, appState.interviewSpec.category);
    updatedSpecDataFromAI.initialPrompt = extractTagContent('initial_question', aiResponse, appState.interviewSpec.initialPrompt);
    
    // Extract new fields
    updatedSpecDataFromAI.purpose = extractTagContent('interview_purpose', aiResponse, appState.interviewSpec.purpose);
    
    // Extract required information as an array
    const requiredInfoText = extractTagContent('required_information', aiResponse, '');
    if (requiredInfoText) {
        // Split by newlines and filter out empty lines
        updatedSpecDataFromAI.requiredInformation = requiredInfoText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && line !== '-')
            .map(line => line.startsWith('- ') ? line.substring(2) : line);
    } else {
        updatedSpecDataFromAI.requiredInformation = appState.interviewSpec.requiredInformation || [];
    }
    
    const rawFollowupPrompt = extractTagContent('followup_prompt', aiResponse, appState.interviewSpec.followupPrompt);
    if (rawFollowupPrompt) updatedSpecDataFromAI.followupPrompt = rawFollowupPrompt;
    else updatedSpecDataFromAI.followupPrompt = appState.interviewSpec.followupPrompt;

    const rawReportPrompt = extractTagContent('report_prompt', aiResponse, appState.interviewSpec.reportPrompt);
    if (rawReportPrompt) updatedSpecDataFromAI.reportPrompt = rawReportPrompt;
    else updatedSpecDataFromAI.reportPrompt = appState.interviewSpec.reportPrompt;



    
    updatedSpecDataFromAI.pageHeaders = { ...(appState.interviewSpec.pageHeaders || {}) }; 
    updatedSpecDataFromAI.pageHeaders.intro = extractTagContent('page_intro_header', aiResponse, appState.interviewSpec.pageHeaders?.intro);
    updatedSpecDataFromAI.pageHeaders.interview = extractTagContent('page_interview_header', aiResponse, appState.interviewSpec.pageHeaders?.interview);
    updatedSpecDataFromAI.pageHeaders.report = extractTagContent('page_report_header', aiResponse, appState.interviewSpec.pageHeaders?.report);
    updatedSpecDataFromAI.pageHeaders.reportSub = extractTagContent('page_report_subheader', aiResponse, appState.interviewSpec.pageHeaders?.reportSub);

    updatedSpecDataFromAI.exampleFollowupQuestion = extractTagContent('example_followup_question', aiResponse, appState.interviewSpec.exampleFollowupQuestion || "");
    updatedSpecDataFromAI.exampleReportContent = extractTagContent('example_report', aiResponse, appState.interviewSpec.exampleReportContent || "");
    updatedSpecDataFromAI.reportFrom = extractTagContent('report_from', aiResponse, appState.interviewSpec.reportFrom || "");
    
    // Extract user note
    const extractedUserNote = extractTagContent('user_note', aiResponse, appState.interviewSpec.userNote || "");
    // Only update if it's not the placeholder
    if (extractedUserNote && extractedUserNote !== "INSERT_USER_PROVIDED_NOTE_HERE") {
        updatedSpecDataFromAI.userNote = extractedUserNote;
    } else {
        updatedSpecDataFromAI.userNote = appState.interviewSpec.userNote || "";
    }
    
    // Extract context statement
    const extractedContextStatement = extractTagContent('context_statement', aiResponse, appState.interviewSpec.contextStatement || "");
    if (extractedContextStatement) {
        updatedSpecDataFromAI.contextStatement = extractedContextStatement;
    } else {
        updatedSpecDataFromAI.contextStatement = appState.interviewSpec.contextStatement || "";
    }
    
    // Extract email intro fields

    
    updatedSpecDataFromAI.hasExternalDocuments = appState.interviewSpec.hasExternalDocuments;
    updatedSpecDataFromAI.contextFiles = appState.currentInterviewFiles; 
    updatedSpecDataFromAI.enableWebSearch = appState.interviewSpec.enableWebSearch;
    updatedSpecDataFromAI.enableThinking = appState.interviewSpec.enableThinking;
    updatedSpecDataFromAI.followupModel = appState.interviewSpec.followupModel; 

    appState.setInterviewSpec(updatedSpecDataFromAI);
    console.log("[Editor Mode] Updated appState.interviewSpec with AI response.");
    
    if (typeof updateSpecificationUIFromAppState === 'function') {
        updateSpecificationUIFromAppState(); 
    } else {
        console.warn("updateSpecificationUIFromAppState not found. Falling back to direct DOM updates in admin.js for spec inputs.");
        // Fallback DOM updates...
    }
    
    // Check if AI actually provided new specification content (not just kept existing values)
    const aiProvidedTitle = extractTagContent('interview_title', aiResponse, null);
    const aiProvidedInitialPrompt = extractTagContent('initial_question', aiResponse, null);
    const aiProvidedFollowupPrompt = extractTagContent('followup_prompt', aiResponse, null);
    
    // Only show specification details if AI actually provided new spec content
    if (window.showSpecificationDetails && 
        (aiProvidedTitle || aiProvidedInitialPrompt || aiProvidedFollowupPrompt)) {
        window.showSpecificationDetails();
    }
    
    const defaultMessageValue = "Default message: AI response processed.";
    let messageToUser = extractTagContent('message', aiResponse, defaultMessageValue);

    try {
        const isFirstCreationScenario = !appState.currentEditingInterviewId; 
        const spec = appState.interviewSpec;
        
        // Expand config panel only when AI actually provides new specification content
        if (appState.uiState.configPanelCollapsed && 
            (aiProvidedTitle || aiProvidedInitialPrompt || aiProvidedFollowupPrompt)) {
            appState.setConfigPanelCollapsed(false);
            // Set the Interview Guide tab as active when expanding
            appState.setActiveSpecTab('spec-interview-details');
            if (window.applyActiveSpecTabFromState) {
                window.applyActiveSpecTabFromState();
            }
        }
        const specHasMinimumContentForSave = spec.title && spec.title !== "Untitled Interview" && spec.initialPrompt && spec.followupPrompt;

        console.log('[Auto-save] Checking conditions:', {
            isFirstCreationScenario,
            currentEditingInterviewId: appState.currentEditingInterviewId,
            specTitle: spec.title,
            hasInitialPrompt: !!spec.initialPrompt,
            hasFollowupPrompt: !!spec.followupPrompt,
            specHasMinimumContentForSave,
            willAutoSave: isFirstCreationScenario || specHasMinimumContentForSave
        });

        if (isFirstCreationScenario || specHasMinimumContentForSave) { 
            const interviewIdForSave = appState.currentEditingInterviewId || generateUUID(); 
            console.log('[DEBUG] SAVE: spec.enableThinking value:', spec.enableThinking, typeof spec.enableThinking);
            const enableThinkingToSave = spec.enableThinking !== undefined ? spec.enableThinking : true;
            console.log('[DEBUG] SAVE: enableThinking value being saved:', enableThinkingToSave);
            
            const interviewDataToSave = {
                id: interviewIdForSave,
                title: spec.title,
                description: spec.description || '',
                category: spec.category || '',
                purpose: spec.purpose || '',
                requiredInformation: spec.requiredInformation || [],
                initialPrompt: spec.initialPrompt || '',
                followupPrompt: spec.followupPrompt || '',
                reportPrompt: spec.reportPrompt || '',
        
                indexHeader: spec.pageHeaders.intro,
                indexSubheader: spec.pageHeaders.interview,
                reportHeader: spec.pageHeaders.report,
                reportSubheader: spec.pageHeaders.reportSub,
                hasExternalDocuments: spec.hasExternalDocuments,
                enableWebSearch: spec.enableWebSearch, 
                enableThinking: enableThinkingToSave,
                followupModel: spec.followupModel || 'claude-opus-4-5',
                exampleFollowupQuestion: spec.exampleFollowupQuestion || '', 
                exampleReportContent: spec.exampleReportContent || '', 
                exampleAdminReport: spec.exampleAdminReport || '', 
                userNote: spec.userNote || '',
     
                contextFiles: appState.currentInterviewFiles 
            };
            
            console.log(`[Editor Mode - admin.js handleEditorModeResponse] Auto-save: interviewDataToSave being passed:`, JSON.parse(JSON.stringify(interviewDataToSave)));
            console.log(`[Editor Mode] Attempting auto-save. New interview: ${isFirstCreationScenario}. ID for save: ${interviewIdForSave}`);
            const saveSuccess = await window.saveInterviewToFirestore(interviewDataToSave, null);

            if (saveSuccess) {
                console.log('Interview specification auto-saved successfully after AI edit.');
                
                // After successful save, the currentEditingInterviewId should now be set for new interviews
                if (isFirstCreationScenario) {
                    // For new interviews, set up the URL and UI elements
                    const currentId = appState.currentEditingInterviewId;
                    if (currentId) {
                        const interviewUrl = `${window.location.origin}/i/?interview=${currentId}`;
                        const shareUrlBtn = document.getElementById('shareUrlBtn');
                        if(shareUrlBtn) { 
                            shareUrlBtn.setAttribute('data-share-url', interviewUrl);
                            shareUrlBtn.classList.remove('hidden');
                        }
                        
                        // Reload the interviews list to show the new interview
                        if (window.refreshInterviewsList) {
                            window.refreshInterviewsList();
                        } else if (window.loadInterviewsGlobal) {
                            window.loadInterviewsGlobal();
                        }
                        
                        // Handle any pending copilot files - store text content directly
                        if (appState.copilotContextFiles && appState.copilotContextFiles.length > 0) {
                            console.log('[Auto-save] Processing pending copilot files after interview creation');
                            const uploadedFiles = [];
                            
                            for (const copilotFile of appState.copilotContextFiles) {
                                console.log('[Auto-save] Uploading file to GCS:', {
                                    fileName: copilotFile.name,
                                    contentLength: copilotFile.content?.length || 0
                                });
                                
                                try {
                                    // Create a file name for the extracted text
                                    const fileName = copilotFile.name.endsWith('_extracted.txt') ? 
                                        copilotFile.name : 
                                        copilotFile.name.replace(/\.[^/.]+$/, '') + '_extracted.txt';
                                    
                                    // Create a blob from the text content
                                    const blob = new Blob([copilotFile.content], { type: 'text/plain' });
                                    
                                    // Create a File object from the blob
                                    const file = new File([blob], fileName, { type: 'text/plain' });
                                    
                                    // Upload to GCS using the file management module
                                    if (window.uploadFile) {
                                        const uploadResult = await window.uploadFile(currentId, file);
                                        console.log('[Auto-save] File uploaded successfully:', uploadResult);
                                        uploadedFiles.push(uploadResult);
                                    } else {
                                        console.error('[Auto-save] uploadFile function not available');
                                    }
                                } catch (uploadError) {
                                    console.error('[Auto-save] Error uploading file:', uploadError);
                                    // Continue with other files even if one fails
                                }
                            }
                            
                            if (uploadedFiles.length > 0) {
                                try {
                                    console.log('[Auto-save] Updating interview with uploaded files');
                                    
                                    // Update the interview with the uploaded file metadata
                                    const db = window.firebase.firestore();
                                    await db.collection('interviews').doc(currentId).update({
                                        contextFiles: uploadedFiles
                                    });
                                    
                                    // Update appState
                                    appState.setCurrentInterviewFiles(uploadedFiles);
                                    appState.copilotContextFiles = [];
                                    
                                    // Update UI
                                    if (window.displaySavedFiles) {
                                        window.displaySavedFiles(uploadedFiles);
                                    }
                                    
                                    // Don't clear the copilot file context in editor mode
                                    // The file should remain available for the entire conversation
                                    console.log('[Auto-save] Keeping copilot file context available for conversation');
                                    
                                    console.log('[Auto-save] Files successfully uploaded and saved to interview');
                                } catch (error) {
                                    console.error('[Auto-save] Error storing text files:', error);
                                }
                            }
                        }
                    }
                }
                
                // Enable save buttons for both new and existing interviews
                const saveBtn1 = document.getElementById('saveCopilotInterview');
                const saveBtn2 = document.getElementById('saveCopilotInterviewFromFilesTab');
                if (saveBtn1) saveBtn1.disabled = false;
                if (saveBtn2) saveBtn2.disabled = false;
            } else {
                 console.warn('Auto-save after AI edit did not return success or was not attempted.');
            }
        } else {
            console.log("[Editor Mode] Auto-save skipped: Not a new interview and spec lacks minimum content.");
        }
        successCb(aiResponse); 
    } catch (saveError) { 
        console.error('Auto-save operation failed after AI edit:', saveError);
        const displayMessageOnError = messageToUser === defaultMessageValue || !messageToUser 
            ? "An error occurred during processing, and auto-save failed." 
            : (typeof messageToUser === 'string' ? messageToUser.replace(/\n/g, '<br>') : JSON.stringify(messageToUser));
        successCb(displayMessageOnError + "\n\n(Auto-save failed: " + saveError.message + ")");
    }
}

// Helper function to get the complete followup prompt with internal instructions
export function getCompleteFollowupPrompt(basePrompt) {
    if (!basePrompt) return '';
    
    return basePrompt + `

IT IS EXTREMELY IMPORTANT THAT YOUR QUESTION FEELS LIKE A NATURAL FOLLOWUP TO THE PREVIOUS QUESTION AND DOES NOT FOLLOW THE SAME EXACT SYNTAX OR PATTERN.

Be concise. Less is more. Do not ask compound questions, where one clause is separated from another by a comma.

Do not ask abstract questions. Ask questions that elicit stories, facts, and details.

Use your thinking trace to keep track of what you know about the user and what you don't know, and what you believe will get them to talk for the longest, including planning phrasing that feels natural and conversational.

If you are unsure about what the user just said, or need more information, just ask.

Know when to follow up and when to move on.

Respond with only the question and nothing else. Do not include any tags, explanations, or additional text.`;
}

// Helper function to get the complete report prompt with internal instructions
export function getCompleteReportPrompt(basePrompt) {
    if (!basePrompt) return '';
    
    return basePrompt + `

Include direct quotes from the interviewee to support your analysis. Weave quotes into a coherent narrative - don't just list them, but integrate them naturally into the report.

Ensure you return your response in <individual_summary_report> tags.`;
}

// Generate UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
} 