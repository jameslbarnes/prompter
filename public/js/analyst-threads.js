// Analyst Threads Management
// Similar to journal-threads.js but for analyst view per interview

// Load analyst threads for a specific interview
window.loadAnalystThreads = async function(interviewId) {
    console.log('[loadAnalystThreads] Called with interview ID:', interviewId, 'Auth user:', !!auth.currentUser);
    if (!interviewId || !auth.currentUser) {
        console.log('[loadAnalystThreads] Missing interview ID or user not authenticated');
        return;
    }

    try {
        const adminUserId = auth.currentUser.uid;
        const threadsRef = db.collection('analystThreads')
            .doc(adminUserId)
            .collection('interviews')
            .doc(interviewId)
            .collection('threads')
            .orderBy('lastMessageAt', 'desc');

        const snapshot = await threadsRef.get();
        const threads = [];
        
        snapshot.forEach(doc => {
            threads.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Update state with loaded threads
        appState.setAnalystThreads(threads);
        
        console.log('[loadAnalystThreads] Found threads:', threads.map(t => ({ id: t.id, title: t.threadTitle, messageCount: t.messageCount })));
        
        // If no threads exist, create a default one
        if (threads.length === 0) {
            console.log('[loadAnalystThreads] No threads found, creating new one');
            await createAnalystThread(interviewId, 'General Discussion');
        } else {
            // Restore last used thread or select first one
            const lastUsedThreadId = appState.getLastUsedAnalystThreadForInterview(interviewId);
            const threadToSelect = threads.find(t => t.id === lastUsedThreadId) || threads[0];
            console.log('[loadAnalystThreads] Selecting thread:', { 
                lastUsedThreadId, 
                selectedThreadId: threadToSelect?.id, 
                selectedThreadTitle: threadToSelect?.threadTitle,
                selectedMessageCount: threadToSelect?.messageCount 
            });
            if (threadToSelect) {
                await selectAnalystThread(threadToSelect.id);
            }
        }

        return threads;
    } catch (error) {
        console.error('[loadAnalystThreads] Error loading threads:', error);
        throw error;
    }
}

// Create a new analyst thread
window.createAnalystThread = async function(interviewId, title = null) {
    console.log('[createAnalystThread] Creating new thread for interview:', interviewId, 'with title:', title);
    if (!interviewId || !auth.currentUser) {
        console.error('[createAnalystThread] Missing interview ID or user not authenticated');
        return null;
    }

    try {
        const adminUserId = auth.currentUser.uid;
        const threadData = {
            threadTitle: title || `Thread ${new Date().toLocaleString()}`,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            messageCount: 0,
            interviewId: interviewId
        };

        console.log('[createAnalystThread] Saving thread data to Firestore...');
        const threadRef = await db.collection('analystThreads')
            .doc(adminUserId)
            .collection('interviews')
            .doc(interviewId)
            .collection('threads')
            .add(threadData);

        console.log('[createAnalystThread] Thread created with ID:', threadRef.id);

        const newThread = {
            id: threadRef.id,
            ...threadData,
            createdAt: new Date(),
            lastMessageAt: new Date()
        };

        // Add to state
        appState.addAnalystThread(newThread);
        console.log('[createAnalystThread] Added to state, total threads:', appState.analystThreads.length);
        
        // Select the new thread
        console.log('[createAnalystThread] Selecting new thread...');
        await selectAnalystThread(threadRef.id);

        // Update UI to reflect the new thread
        if (window.updateAnalystThreadUI) {
            console.log('[createAnalystThread] Updating UI...');
            window.updateAnalystThreadUI();
        }

        return threadRef.id;
    } catch (error) {
        console.error('[createAnalystThread] Error creating thread:', error);
        throw error;
    }
}

// Delete an analyst thread
window.deleteAnalystThread = async function(threadId) {
    if (!threadId || !auth.currentUser || !appState.currentEditingInterviewId) {
        console.error('[deleteAnalystThread] Missing required parameters');
        return;
    }

    try {
        const adminUserId = auth.currentUser.uid;
        const interviewId = appState.currentEditingInterviewId;
        
        // Delete all messages in the thread
        const messagesRef = db.collection('analystThreads')
            .doc(adminUserId)
            .collection('interviews')
            .doc(interviewId)
            .collection('threads')
            .doc(threadId)
            .collection('messages');

        const messagesSnapshot = await messagesRef.get();
        const batch = db.batch();
        
        messagesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Delete the thread document
        const threadRef = db.collection('analystThreads')
            .doc(adminUserId)
            .collection('interviews')
            .doc(interviewId)
            .collection('threads')
            .doc(threadId);
            
        batch.delete(threadRef);
        await batch.commit();

        // Remove from state
        appState.removeAnalystThread(threadId);

        // If this was the current thread, select another or create new
        if (appState.currentAnalystThreadId === threadId) {
            const remainingThreads = appState.analystThreads;
            if (remainingThreads.length === 0) {
                await createAnalystThread(interviewId, 'General Discussion');
            } else {
                await selectAnalystThread(remainingThreads[0].id);
            }
        }

    } catch (error) {
        console.error('[deleteAnalystThread] Error deleting thread:', error);
        throw error;
    }
}

// Update analyst thread metadata
window.updateAnalystThread = async function(threadId, updates) {
    if (!threadId || !auth.currentUser || !appState.currentEditingInterviewId) {
        console.error('[updateAnalystThread] Missing required parameters');
        return;
    }

    try {
        const adminUserId = auth.currentUser.uid;
        const interviewId = appState.currentEditingInterviewId;
        
        const threadRef = db.collection('analystThreads')
            .doc(adminUserId)
            .collection('interviews')
            .doc(interviewId)
            .collection('threads')
            .doc(threadId);

        await threadRef.update(updates);

        // Update state
        appState.updateAnalystThread(threadId, updates);

    } catch (error) {
        console.error('[updateAnalystThread] Error updating thread:', error);
        throw error;
    }
}

// Load messages for a specific analyst thread
window.loadAnalystThreadMessages = async function(threadId) {
    if (!threadId || !auth.currentUser || !appState.currentEditingInterviewId) {
        console.log('[loadAnalystThreadMessages] Missing required parameters');
        return [];
    }

    try {
        const adminUserId = auth.currentUser.uid;
        const interviewId = appState.currentEditingInterviewId;
        
        const messagesRef = db.collection('analystThreads')
            .doc(adminUserId)
            .collection('interviews')
            .doc(interviewId)
            .collection('threads')
            .doc(threadId)
            .collection('messages')
            .orderBy('timestamp', 'asc');

        const snapshot = await messagesRef.get();
        const messages = [];
        
        console.log('[loadAnalystThreadMessages] Raw Firestore snapshot size:', snapshot.size);
        
        snapshot.forEach(doc => {
            const messageData = {
                id: doc.id,
                ...doc.data()
            };
            console.log('[loadAnalystThreadMessages] Loading message:', { 
                id: messageData.id, 
                sender: messageData.sender, 
                contentLength: messageData.content?.length,
                timestamp: messageData.timestamp
            });
            messages.push(messageData);
        });

        console.log('[loadAnalystThreadMessages] Total messages loaded:', messages.length);

        // Update state
        // Update state
        appState.setCurrentAnalystThreadMessages(messages);

        return messages;
    } catch (error) {
        console.error('[loadAnalystThreadMessages] Error loading messages:', error);
        return [];
    }
}

// Save a message to the current analyst thread
window.saveAnalystThreadMessage = async function(sender, content) {
    const threadId = appState.currentAnalystThreadId;
    const interviewId = appState.currentEditingInterviewId;
    
    console.log('[saveAnalystThreadMessage] Called with:', { sender, contentLength: content?.length, threadId, interviewId });
    
    if (!threadId || !auth.currentUser || !interviewId) {
        console.error('[saveAnalystThreadMessage] Missing required parameters:', { threadId, hasAuth: !!auth.currentUser, interviewId });
        return;
    }

    try {
        const adminUserId = auth.currentUser.uid;
        
        const messageData = {
            sender: sender, // 'user' or 'assistant'
            content: content,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };

        console.log('[saveAnalystThreadMessage] Saving to Firestore:', {
            path: `analystThreads/${adminUserId}/interviews/${interviewId}/threads/${threadId}/messages`,
            messageData: { ...messageData, content: content.substring(0, 100) + '...' }
        });

        const messageRef = await db.collection('analystThreads')
            .doc(adminUserId)
            .collection('interviews')
            .doc(interviewId)
            .collection('threads')
            .doc(threadId)
            .collection('messages')
            .add(messageData);

        console.log('[saveAnalystThreadMessage] Message saved with ID:', messageRef.id);

        // Update thread metadata
        await updateAnalystThread(threadId, {
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            messageCount: firebase.firestore.FieldValue.increment(1)
        });

        // Add to state
        appState.addAnalystThreadMessage({
            id: messageRef.id,
            ...messageData,
            timestamp: new Date()
        });

        console.log('[saveAnalystThreadMessage] Updated state, current message count:', appState.currentAnalystThreadMessages.length);

        // Generate title from first user message if needed
        if (sender === 'user' && appState.currentAnalystThreadMessages.length === 1) {
            console.log('[saveAnalystThreadMessage] Generating thread title...');
            await generateAnalystThreadTitle(threadId, content);
        }

        return messageRef.id;
    } catch (error) {
        console.error('[saveAnalystThreadMessage] Error saving message:', error);
        throw error;
    }
}

// Generate thread title from first message
async function generateAnalystThreadTitle(threadId, firstMessage) {
    if (!firstMessage || firstMessage.length < 5) return;

    try {
        // Extract first sentence or first 50 characters
        let title = firstMessage;
        
        // If there's a period, question mark, or exclamation, use up to that
        const sentenceEnd = firstMessage.search(/[.!?]/);
        if (sentenceEnd > 0 && sentenceEnd < 50) {
            title = firstMessage.substring(0, sentenceEnd + 1);
        } else {
            // Otherwise, take first 50 characters and add ellipsis if needed
            title = firstMessage.substring(0, 50);
            if (firstMessage.length > 50) {
                title += '...';
            }
        }

        // Clean up the title
        title = title.trim();
        
        // Update the thread with the generated title
        await updateAnalystThread(threadId, {
            threadTitle: title
        });

    } catch (error) {
        console.error('[generateAnalystThreadTitle] Error generating title:', error);
    }
}

// Select an analyst thread
window.selectAnalystThread = async function(threadId) {
    console.log('[selectAnalystThread] Selecting thread:', threadId);
    if (!threadId) return;

    // Update state
    appState.setCurrentAnalystThreadId(threadId);
    console.log('[selectAnalystThread] Updated state, current thread ID:', appState.currentAnalystThreadId);
    
    // Load messages for this thread
    console.log('[selectAnalystThread] Loading messages...');
    await loadAnalystThreadMessages(threadId);
    
    // Update UI to show messages
    if (window.displayAnalystThreadMessages) {
        console.log('[selectAnalystThread] Displaying messages...');
        window.displayAnalystThreadMessages();
    }
}

// Initialize analyst thread system
window.initializeAnalystThreads = async function(interviewId) {
    console.log('[initializeAnalystThreads] Starting initialization for interview:', interviewId);
    if (!interviewId) {
        console.log('[initializeAnalystThreads] No interview ID provided');
        return;
    }

    try {
        // Load threads for this interview
        console.log('[initializeAnalystThreads] Loading threads...');
        await loadAnalystThreads(interviewId);
        
        console.log('[initializeAnalystThreads] Loaded threads:', appState.analystThreads.length, 'Current thread:', appState.currentAnalystThreadId);
        
        // Update UI
        if (window.updateAnalystThreadUI) {
            console.log('[initializeAnalystThreads] Updating UI...');
            window.updateAnalystThreadUI();
        }
    } catch (error) {
        console.error('[initializeAnalystThreads] Error initializing threads:', error);
    }
}

// Clean up analyst threads when leaving analyst mode
window.cleanupAnalystThreads = function() {
    appState.setAnalystThreads([]);
    appState.setCurrentAnalystThreadId(null);
    appState.setCurrentAnalystThreadMessages([]);
}