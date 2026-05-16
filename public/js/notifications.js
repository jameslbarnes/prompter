// Notifications Module for Admin Dashboard

let notificationsUnsubscribe = null;
let seenReportIds = new Set();
let notifications = [];

export function initializeNotifications() {
    console.log('[Notifications] Initializing notifications system');
    
    if (!window.db || !window.auth) {
        console.error('[Notifications] Firebase not initialized');
        return;
    }

    // Initialize UI event handlers
    const notificationsBtn = document.getElementById('notificationsBtn');
    const notificationsMenu = document.getElementById('notificationsMenu');
    
    if (notificationsBtn && notificationsMenu) {
        console.log('[Notifications] UI elements found, setting up handlers');
        
        // Toggle dropdown on button click
        notificationsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notificationsMenu.classList.toggle('hidden');
            
            // Mark notifications as read when menu is opened
            if (!notificationsMenu.classList.contains('hidden')) {
                markNotificationsAsRead();
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const notificationsContainer = document.getElementById('notificationsContainer');
            if (notificationsContainer && !notificationsContainer.contains(e.target)) {
                notificationsMenu.classList.add('hidden');
            }
        });
    } else {
        console.error('[Notifications] UI elements not found', { notificationsBtn, notificationsMenu });
    }

    // Start listening to Firestore when user is authenticated
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('[Notifications] User authenticated, starting listeners', user.uid);
            startListeningToReports(user.uid);
        } else {
            console.log('[Notifications] User not authenticated, stopping listeners');
            stopListeningToReports();
        }
    });
}

function startListeningToReports(userId) {
    console.log('[Notifications] Starting to listen for reports for user:', userId);
    
    if (notificationsUnsubscribe) {
        notificationsUnsubscribe();
    }

    // Load seen report IDs from localStorage
    const storedSeenIds = localStorage.getItem(`seenReports_${userId}`);
    if (storedSeenIds) {
        seenReportIds = new Set(JSON.parse(storedSeenIds));
        console.log('[Notifications] Loaded seen report IDs:', seenReportIds.size);
    }
    
    // Also track if this is the first time loading (to avoid showing all historical reports)
    const hasInitialized = localStorage.getItem(`notificationsInitialized_${userId}`);
    const isFirstLoad = !hasInitialized;

    // First, get all interviews where user is owner or shared with
    const interviewsRef = db.collection('interviews');
    
    // Create a compound query for interviews
    // We need to listen to interviews where user is creator OR shared with
    // Since Firestore doesn't support OR queries directly, we'll need to run two queries
    
    const ownedInterviews = interviewsRef.where('createdBy', '==', userId);
    const userEmail = auth.currentUser?.email;
    
    console.log('[Notifications] User email:', userEmail);
    
    // Keep track of interview IDs we have access to
    const accessibleInterviewIds = new Set();
    
    // Listen to owned interviews
    ownedInterviews.onSnapshot((snapshot) => {
        console.log('[Notifications] Owned interviews snapshot received, count:', snapshot.size);
        
        snapshot.forEach(doc => {
            accessibleInterviewIds.add(doc.id);
            console.log('[Notifications] Added owned interview:', doc.id);
        });
        
        // If user has an email, also check for shared interviews
        if (userEmail) {
            interviewsRef.where('sharedWith', 'array-contains', userEmail)
                .get()
                .then(sharedSnapshot => {
                    console.log('[Notifications] Shared interviews found:', sharedSnapshot.size);
                    sharedSnapshot.forEach(doc => {
                        accessibleInterviewIds.add(doc.id);
                    });
                    
                    console.log('[Notifications] Total accessible interviews:', accessibleInterviewIds.size);
                    // Now listen to reports for these interviews
                    listenToReportsForInterviews(userId, accessibleInterviewIds, isFirstLoad);
                });
        } else {
            console.log('[Notifications] No email, only listening to owned interviews:', accessibleInterviewIds.size);
            // Just listen to reports for owned interviews
            listenToReportsForInterviews(userId, accessibleInterviewIds, isFirstLoad);
        }
    }, (error) => {
        console.error('[Notifications] Error listening to owned interviews:', error);
    });
}

function listenToReportsForInterviews(userId, interviewIds, isFirstLoad) {
    // Clean up previous listener
    if (notificationsUnsubscribe) {
        notificationsUnsubscribe();
    }
    
    if (interviewIds.size === 0) {
        console.log('[Notifications] No accessible interviews found');
        return;
    }
    
    // If this is the first load, mark all existing reports as "seen" to avoid spam
    if (isFirstLoad) {
        console.log('[Notifications] First load - will mark existing reports as seen');
        localStorage.setItem(`notificationsInitialized_${userId}`, 'true');
    }
    
    // Convert Set to Array for query
    const interviewIdArray = Array.from(interviewIds);
    
    // Firestore has a limit of 10 items in 'in' queries, so we need to batch
    const batches = [];
    for (let i = 0; i < interviewIdArray.length; i += 10) {
        batches.push(interviewIdArray.slice(i, i + 10));
    }
    
    console.log('[Notifications] Created', batches.length, 'batches for querying reports');
    
    // Listen to reports for each batch
    const unsubscribers = [];
    
    batches.forEach((batch, index) => {
        console.log('[Notifications] Setting up listener for batch', index + 1, 'with', batch.length, 'interviews');
        
        // Try without orderBy first to see if that's causing the issue
        const query = db.collection('reports')
            .where('interview_id', 'in', batch);
            
        const unsubscribe = query.onSnapshot(async (snapshot) => {
                console.log('[Notifications] Reports snapshot received for batch', index + 1, '- Total docs:', snapshot.size, 'Changes:', snapshot.docChanges().length);
                
                // On initial load, if there are documents but no changes, process all documents
                const isInitialLoad = snapshot.docChanges().length === 0 && snapshot.size > 0;
                if (isInitialLoad) {
                    console.log('[Notifications] Initial load detected, processing all', snapshot.size, 'documents');
                }
                
                const newNotifications = [];
                
                // Process either changes or all documents on initial load
                const documentsToProcess = isInitialLoad ? 
                    snapshot.docs.map(doc => ({ type: 'added', doc })) : 
                    snapshot.docChanges();
                
                for (const change of documentsToProcess) {
                    console.log('[Notifications] Change type:', change.type, 'Report ID:', change.doc.id);
                    
                    if (change.type === 'added' || change.type === 'modified') {
                        const reportData = change.doc.data();
                        const reportId = change.doc.id;
                        
                        console.log('[Notifications] Report data:', { 
                            reportId, 
                            interview_id: reportData.interview_id,
                            status: reportData.status,
                            created_at: reportData.created_at
                        });
                        
                        // Skip if we've already seen this report
                        if (seenReportIds.has(reportId)) {
                            console.log('[Notifications] Skipping already seen report:', reportId);
                            continue;
                        }
                        
                        // If this is the first load and this is an existing report, mark it as seen
                        if (isFirstLoad && change.type === 'added') {
                            console.log('[Notifications] First load - marking existing report as seen:', reportId);
                            seenReportIds.add(reportId);
                            continue;
                        }
                        
                        // Get interview details
                        if (reportData.interview_id) {
                            try {
                                const interviewDoc = await db.collection('interviews').doc(reportData.interview_id).get();
                                
                                if (interviewDoc.exists) {
                                    const interviewData = interviewDoc.data();
                                    
                                    // Check if this is a new report or a completed report
                                    const isNew = change.type === 'added';
                                    const isCompleted = reportData.status === 'completed';
                                    
                                    console.log('[Notifications] Report status check:', { isNew, isCompleted, status: reportData.status });
                                    
                                    if (isNew || isCompleted) {
                                        // Get the email from the report data (user who submitted the report)
                                        const reportUserEmail = reportData.user_email || reportData.email || 'Unknown';
                                        
                                        // Only create notification if the report is from a different user
                                        const adminEmail = auth.currentUser?.email;
                                        if (reportUserEmail && adminEmail && reportUserEmail.toLowerCase() === adminEmail.toLowerCase()) {
                                            console.log('[Notifications] Skipping notification - report is from admin user');
                                            continue;
                                        }
                                        
                                        const notification = {
                                            id: reportId,
                                            type: isCompleted ? 'completed' : 'new',
                                            interviewId: reportData.interview_id,
                                            interviewTitle: interviewData.title || 'Untitled Interview',
                                            createdBy: reportUserEmail,
                                            timestamp: reportData.created_at || new Date(),
                                            status: reportData.status
                                        };
                                        console.log('[Notifications] Adding notification:', notification);
                                        newNotifications.push(notification);
                                    }
                                }
                            } catch (error) {
                                console.error('[Notifications] Error fetching interview details:', error);
                            }
                        }
                    }
                }
                
                if (newNotifications.length > 0) {
                    console.log('[Notifications] Adding', newNotifications.length, 'new notifications');
                    addNotifications(newNotifications);
                } else {
                    console.log('[Notifications] No new notifications to add');
                }
                
                // Save seen reports after processing first load
                if (isFirstLoad && seenReportIds.size > 0) {
                    saveSeenReportIds();
                }
            }, (error) => {
                console.error('[Notifications] Error listening to reports batch:', error);
            });
            
        unsubscribers.push(unsubscribe);
    });
    
    // Store all unsubscribers
    notificationsUnsubscribe = () => {
        unsubscribers.forEach(unsub => unsub());
    };
}

function stopListeningToReports() {
    if (notificationsUnsubscribe) {
        notificationsUnsubscribe();
        notificationsUnsubscribe = null;
    }
    notifications = [];
    updateNotificationUI();
}

function addNotifications(newNotifications) {
    // Add new notifications to the beginning of the array
    notifications.unshift(...newNotifications);
    
    // Limit total notifications to 20
    if (notifications.length > 20) {
        notifications = notifications.slice(0, 20);
    }
    
    updateNotificationUI();
}

function updateNotificationUI() {
    const badge = document.getElementById('notificationBadge');
    const notificationsList = document.getElementById('notificationsList');
    const noNotifications = document.getElementById('noNotifications');
    
    if (!badge || !notificationsList || !noNotifications) return;
    
    // Update badge
    const unreadCount = notifications.filter(n => !n.read).length;
    if (unreadCount > 0) {
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount.toString();
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
    
    // Update notifications list
    if (notifications.length === 0) {
        notificationsList.innerHTML = '';
        noNotifications.classList.remove('hidden');
    } else {
        noNotifications.classList.add('hidden');
        notificationsList.innerHTML = notifications.map(notification => `
            <div class="p-4 hover:bg-gray-700 cursor-pointer notification-item" data-interview-id="${notification.interviewId}" data-notification-id="${notification.id}">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        ${notification.type === 'completed' ? 
                            '<svg class="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' :
                            '<svg class="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>'
                        }
                    </div>
                    <div class="ml-3 flex-1">
                        <p class="text-sm font-medium text-white">
                            ${notification.type === 'completed' ? 'Report Completed' : 'Interview Started'}
                        </p>
                        <p class="text-sm text-gray-300 mt-1">
                            ${notification.interviewTitle}
                        </p>
                        <p class="text-xs text-gray-400 mt-1">
                            by ${notification.createdBy} • ${formatTimeAgo(notification.timestamp)}
                        </p>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Add click handlers to notification items
        document.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => {
                const interviewId = item.dataset.interviewId;
                const notificationId = item.dataset.notificationId;
                
                // Mark this notification as seen
                seenReportIds.add(notificationId);
                saveSeenReportIds();
                
                // Open the interview
                openInterview(interviewId);
                
                // Close the notifications menu
                document.getElementById('notificationsMenu').classList.add('hidden');
                
                // Remove this notification from the list
                notifications = notifications.filter(n => n.id !== notificationId);
                updateNotificationUI();
            });
        });
    }
}

function markNotificationsAsRead() {
    notifications.forEach(n => {
        n.read = true;
        seenReportIds.add(n.id);
    });
    saveSeenReportIds();
    updateNotificationUI();
}

function saveSeenReportIds() {
    if (auth.currentUser) {
        localStorage.setItem(`seenReports_${auth.currentUser.uid}`, JSON.stringify([...seenReportIds]));
    }
}

function openInterview(interviewId) {
    // Update the URL hash to load the interview
    window.location.hash = `interview=${interviewId}`;
    
    // Ensure sidebar is open
    if (window.appState && window.appState.uiState.sidebarCollapsed) {
        window.appState.setSidebarCollapsed(false);
        if (window.applySidebarState) {
            window.applySidebarState();
        }
    }
}

function formatTimeAgo(timestamp) {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
}

// Export initialization function
window.initializeNotifications = initializeNotifications;