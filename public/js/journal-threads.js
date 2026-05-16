// Journal Analyst Threads Management Module

// Load threads for a specific user filter
async function loadJournalThreads(userFilter) {
    if (!firebase.auth().currentUser) {
        console.error('[loadJournalThreads] No authenticated user');
        return [];
    }
    
    const adminUserId = firebase.auth().currentUser.uid;
    const db = firebase.firestore();
    
    try {
        const threadsSnapshot = await db
            .collection('journalAnalystThreads')
            .doc(adminUserId)
            .collection('threads')
            .where('userFilter', '==', userFilter)
            .orderBy('lastMessageAt', 'desc')
            .get();
        
        const threads = [];
        threadsSnapshot.forEach(doc => {
            threads.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        appState.setJournalThreads(threads);
        return threads;
    } catch (error) {
        console.error('[loadJournalThreads] Error loading threads:', error);
        return [];
    }
}

// Create a new thread
async function createJournalThread(userFilter, title = null) {
    if (!firebase.auth().currentUser) {
        console.error('[createJournalThread] No authenticated user');
        return null;
    }
    
    const adminUserId = firebase.auth().currentUser.uid;
    const db = firebase.firestore();
    
    try {
        const threadData = {
            userFilter: userFilter,
            threadTitle: title || `New Thread - ${new Date().toLocaleDateString()}`,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
            messageCount: 0
        };
        
        const threadRef = await db
            .collection('journalAnalystThreads')
            .doc(adminUserId)
            .collection('threads')
            .add(threadData);
        
        const newThread = {
            id: threadRef.id,
            ...threadData,
            createdAt: new Date(),
            lastMessageAt: new Date()
        };
        
        appState.addJournalThread(newThread);
        appState.setCurrentJournalThreadId(threadRef.id);
        
        return newThread;
    } catch (error) {
        console.error('[createJournalThread] Error creating thread:', error);
        return null;
    }
}

// Delete a thread
async function deleteJournalThread(threadId) {
    if (!firebase.auth().currentUser) {
        console.error('[deleteJournalThread] No authenticated user');
        return false;
    }
    
    const adminUserId = firebase.auth().currentUser.uid;
    const db = firebase.firestore();
    
    try {
        // Delete all messages in the thread first
        const messagesSnapshot = await db
            .collection('journalAnalystThreads')
            .doc(adminUserId)
            .collection('threads')
            .doc(threadId)
            .collection('messages')
            .get();
        
        const batch = db.batch();
        messagesSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // Delete the thread document
        const threadRef = db
            .collection('journalAnalystThreads')
            .doc(adminUserId)
            .collection('threads')
            .doc(threadId);
        
        batch.delete(threadRef);
        await batch.commit();
        
        appState.removeJournalThread(threadId);
        return true;
    } catch (error) {
        console.error('[deleteJournalThread] Error deleting thread:', error);
        return false;
    }
}

// Update thread metadata
async function updateJournalThread(threadId, updates) {
    if (!firebase.auth().currentUser) {
        console.error('[updateJournalThread] No authenticated user');
        return false;
    }
    
    const adminUserId = firebase.auth().currentUser.uid;
    const db = firebase.firestore();
    
    try {
        await db
            .collection('journalAnalystThreads')
            .doc(adminUserId)
            .collection('threads')
            .doc(threadId)
            .update({
                ...updates,
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        
        appState.updateJournalThread(threadId, updates);
        return true;
    } catch (error) {
        console.error('[updateJournalThread] Error updating thread:', error);
        return false;
    }
}

// Load messages for a specific thread
async function loadThreadMessages(threadId) {
    if (!firebase.auth().currentUser || !threadId) {
        console.error('[loadThreadMessages] No authenticated user or thread ID');
        return [];
    }
    
    const adminUserId = firebase.auth().currentUser.uid;
    const db = firebase.firestore();
    
    try {
        const messagesSnapshot = await db
            .collection('journalAnalystThreads')
            .doc(adminUserId)
            .collection('threads')
            .doc(threadId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .get();
        
        const messages = [];
        messagesSnapshot.forEach(doc => {
            messages.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        appState.setCurrentThreadMessages(messages);
        return messages;
    } catch (error) {
        console.error('[loadThreadMessages] Error loading messages:', error);
        return [];
    }
}

// Save a message to the current thread
async function saveThreadMessage(threadId, sender, content) {
    if (!firebase.auth().currentUser || !threadId) {
        console.error('[saveThreadMessage] No authenticated user or thread ID');
        return false;
    }
    
    const adminUserId = firebase.auth().currentUser.uid;
    const db = firebase.firestore();
    
    try {
        const messageData = {
            sender: sender,
            content: content,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db
            .collection('journalAnalystThreads')
            .doc(adminUserId)
            .collection('threads')
            .doc(threadId)
            .collection('messages')
            .add(messageData);
        
        // Update thread's last message timestamp and increment message count
        await db
            .collection('journalAnalystThreads')
            .doc(adminUserId)
            .collection('threads')
            .doc(threadId)
            .update({
                lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
                messageCount: firebase.firestore.FieldValue.increment(1)
            });
        
        // Add to local state
        appState.addThreadMessage({
            ...messageData,
            timestamp: new Date()
        });
        
        return true;
    } catch (error) {
        console.error('[saveThreadMessage] Error saving message:', error);
        return false;
    }
}

// Generate a title for the thread based on the first message
async function generateThreadTitle(threadId, firstMessage) {
    if (!firstMessage || firstMessage.length < 10) {
        return null;
    }
    
    // Simple title generation - take first 50 chars of the message
    let title = firstMessage.substring(0, 50);
    if (firstMessage.length > 50) {
        title += '...';
    }
    
    // Remove any newlines
    title = title.replace(/\n/g, ' ').trim();
    
    // Update the thread with the generated title
    await updateJournalThread(threadId, { threadTitle: title });
    
    return title;
} 

// Export functions to window object
window.loadJournalThreads = loadJournalThreads;
window.createJournalThread = createJournalThread;
window.deleteJournalThread = deleteJournalThread;
window.updateJournalThread = updateJournalThread;
window.loadThreadMessages = loadThreadMessages;
window.saveThreadMessage = saveThreadMessage;
window.generateThreadTitle = generateThreadTitle;
