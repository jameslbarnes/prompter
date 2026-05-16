// Interview backup utilities for periodic state persistence

const BACKUP_INTERVAL = 60000; // 60 seconds
const BACKUP_KEY = 'interviewPeriodicBackup';
const MAX_BACKUP_AGE = 24 * 60 * 60 * 1000; // 24 hours

class InterviewBackupManager {
    constructor() {
        this.backupInterval = null;
        this.lastBackupTime = 0;
        this.backupInProgress = false;
    }

    // Start periodic backups
    startPeriodicBackup(state, socket) {
        console.log('[InterviewBackup] Starting periodic backup service');
        
        // Clear any existing interval
        this.stopPeriodicBackup();
        
        // Perform initial backup
        this.performBackup(state, socket);
        
        // Set up periodic backup
        this.backupInterval = setInterval(() => {
            if (state.interview.inProgress && !this.backupInProgress) {
                this.performBackup(state, socket);
            }
        }, BACKUP_INTERVAL);
    }

    // Stop periodic backups
    stopPeriodicBackup() {
        if (this.backupInterval) {
            console.log('[InterviewBackup] Stopping periodic backup service');
            clearInterval(this.backupInterval);
            this.backupInterval = null;
        }
    }

    // Perform a single backup
    async performBackup(state, socket) {
        if (this.backupInProgress) {
            console.log('[InterviewBackup] Backup already in progress, skipping');
            return;
        }

        this.backupInProgress = true;
        const startTime = Date.now();

        try {
            // Prepare backup data
            const backupData = {
                id: state.interview.id,
                sessionId: socket.id,
                inProgress: state.interview.inProgress,
                responses: state.responses || [],
                questionCount: state.ui.questionCount || 0,
                currentQuestion: state.ui.currentQuestion || '',
                recordingTime: state.ui.recordingTime || 0,
                accumulatedTime: state.recording.accumulatedTime || 0,
                startTime: state.interview.startTime,
                timestamp: Date.now(),
                
                // Additional metadata
                userName: state.interview.userName,
                userEmail: state.interview.userEmail,
                customData: state.interview.customData,
                
                // Recording state
                isRecording: state.recording.isRecording,
                isPaused: state.recording.isPaused,
                targetDurationSeconds: state.recording.targetDurationSeconds,
                
                // UI state
                thinking: state.ui.thinking,
                currentThinkingTrace: state.ui.currentThinkingTrace
            };

            // Save to localStorage
            localStorage.setItem(BACKUP_KEY, JSON.stringify(backupData));
            
            // Also save to server if we have a valid interview ID
            if (state.interview.id && socket.connected) {
                socket.emit('saveInterviewBackup', {
                    interviewId: state.interview.id,
                    backupData: backupData
                }, (response) => {
                    if (response && response.success) {
                        console.log('[InterviewBackup] Server backup successful');
                    } else {
                        console.warn('[InterviewBackup] Server backup failed:', response?.error);
                    }
                });
            }

            const duration = Date.now() - startTime;
            console.log(`[InterviewBackup] Backup completed in ${duration}ms`);
            this.lastBackupTime = Date.now();

        } catch (error) {
            console.error('[InterviewBackup] Backup failed:', error);
        } finally {
            this.backupInProgress = false;
        }
    }

    // Restore from backup
    async restoreFromBackup(socket) {
        try {
            const backupStr = localStorage.getItem(BACKUP_KEY);
            if (!backupStr) {
                console.log('[InterviewBackup] No local backup found');
                return null;
            }

            const backup = JSON.parse(backupStr);
            
            // Check if backup is too old
            if (Date.now() - backup.timestamp > MAX_BACKUP_AGE) {
                console.log('[InterviewBackup] Backup is too old, ignoring');
                localStorage.removeItem(BACKUP_KEY);
                return null;
            }

            console.log('[InterviewBackup] Found valid backup:', {
                id: backup.id,
                age: Math.round((Date.now() - backup.timestamp) / 1000) + 's',
                questionCount: backup.questionCount
            });

            // Try to restore from server first if we have an interview ID
            if (backup.id && socket.connected) {
                return new Promise((resolve) => {
                    socket.emit('getInterviewBackup', { 
                        interviewId: backup.id 
                    }, (response) => {
                        if (response && response.success && response.backup) {
                            console.log('[InterviewBackup] Server backup found, using server version');
                            resolve(response.backup);
                        } else {
                            console.log('[InterviewBackup] No server backup, using local version');
                            resolve(backup);
                        }
                    });
                });
            }

            return backup;

        } catch (error) {
            console.error('[InterviewBackup] Failed to restore backup:', error);
            return null;
        }
    }

    // Clear backup
    clearBackup() {
        console.log('[InterviewBackup] Clearing backup data');
        localStorage.removeItem(BACKUP_KEY);
        this.stopPeriodicBackup();
    }

    // Get backup info
    getBackupInfo() {
        try {
            const backupStr = localStorage.getItem(BACKUP_KEY);
            if (!backupStr) return null;

            const backup = JSON.parse(backupStr);
            return {
                exists: true,
                age: Date.now() - backup.timestamp,
                questionCount: backup.questionCount,
                id: backup.id
            };
        } catch (error) {
            return null;
        }
    }
}

// Export singleton instance
window.interviewBackupManager = new InterviewBackupManager();