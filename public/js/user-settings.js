// User Settings Module
// Handles user profile and settings management

// Apply user settings panel state from appState
function applyUserSettingsPanelState() {
    const panel = document.getElementById('userSettingsPanel'); 
    const overlay = document.getElementById('userSettingsOverlay'); 
    if (!panel || !overlay) {
        console.warn("User settings panel or overlay element not found.");
        return;
    }

    const isOpen = appState.uiState.userSettingsPanel.isOpen;

    if (isOpen) {
        // Close other slide-out panels if they are open
        if (appState.uiState.reportDetailPanel.isOpen) {
            appState.setReportDetailPanelOpen(false);
            if (window.applyReportDetailPanelState) window.applyReportDetailPanelState();
        }
        if (appState.uiState.interviewLivePreviewPanel.isOpen) {
            appState.setInterviewLivePreviewPanelOpen(false);
            if (window.applyInterviewLivePreviewPanelState) window.applyInterviewLivePreviewPanelState();
        }
        if (appState.uiState.pricingPanel.isOpen) {
            appState.setPricingPanelOpen(false);
            if (window.applyPricingPanelState) window.applyPricingPanelState();
        }
        
        // Populate inputs from appState when opening
        const userDisplayNameInput = document.getElementById('userDisplayNameInput');
        const userOrganizationInput = document.getElementById('userOrganizationInput');
        const saveUserSettingsBtn = document.getElementById('saveUserSettingsBtn');
        
        if (userDisplayNameInput) userDisplayNameInput.value = appState.userProfile.displayName || '';
        if (userOrganizationInput) userOrganizationInput.value = appState.userProfile.organization || '';
        if (saveUserSettingsBtn) saveUserSettingsBtn.disabled = true; // Initially disabled until changes are made
        
        // Update Gmail connection status
        updateGmailConnectionStatus();

        panel.style.display = 'flex';
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
        void panel.offsetWidth; // Trigger reflow
        panel.style.transform = 'translateX(0)';
    } else {
        panel.style.transform = 'translateX(100%)';
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        setTimeout(() => {
            if (!appState.uiState.userSettingsPanel.isOpen) { // Check state again
                panel.style.display = 'none';
            }
        }, 300); // Match CSS transition duration
    }
}

// Load user profile from Firebase
async function loadUserProfile() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        appState.setUserProfile({ displayName: '', organization: '' });
        return;
    }

    try {
        const userDocRef = db.collection('users').doc(currentUser.uid);
        const userDoc = await userDocRef.get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            appState.setUserProfile({
                displayName: userData.displayName || currentUser.displayName || '',
                organization: userData.organization || '',
                torusConfig: userData.torusConfig || null,
                torusConfigs: userData.torusConfigs || [],
                gmailConnected: userData.gmailConnected || false,
                gmailEmail: userData.gmailEmail || null
            });
        } else {
            // Document doesn't exist, create it
            // For Google users, use their Google profile information as defaults
            const defaultDisplayName = currentUser.displayName || 
                                     currentUser.email.split('@')[0] || 
                                     'New User';
            
            const initialProfile = {
                displayName: defaultDisplayName,
                organization: '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                email: currentUser.email, // Store email for reference
                photoURL: currentUser.photoURL || null, // Store Google photo if available
                providerId: currentUser.providerData.length > 0 ? currentUser.providerData[0].providerId : 'email' // Track login method
            };
            await userDocRef.set(initialProfile);
            appState.setUserProfile({
                displayName: initialProfile.displayName,
                organization: initialProfile.organization,
                torusConfig: null,
                torusConfigs: [],
                gmailConnected: false,
                gmailEmail: null
            });
            console.log('User profile document created in Firestore for UID:', currentUser.uid, 'Provider:', initialProfile.providerId);
            
            // Create interview from featured template for new users
            await createInterviewFromFeaturedTemplate(currentUser.uid);
        }
    } catch (error) {
        console.error("Error loading/creating user profile:", error);
        // Fallback to auth user data
        const fallbackDisplayName = currentUser.displayName || 
                                  currentUser.email.split('@')[0] || 
                                  'New User';
        appState.setUserProfile({
            displayName: fallbackDisplayName,
            organization: '',
            torusConfig: null,
            torusConfigs: []
        });
    }
    
    // Update UI if settings panel is open
    if (appState.uiState.userSettingsPanel.isOpen) {
        const userDisplayNameInput = document.getElementById('userDisplayNameInput');
        const userOrganizationInput = document.getElementById('userOrganizationInput');
        const saveUserSettingsBtn = document.getElementById('saveUserSettingsBtn');
        
        if (userDisplayNameInput) userDisplayNameInput.value = appState.userProfile.displayName || '';
        if (userOrganizationInput) userOrganizationInput.value = appState.userProfile.organization || '';
        if (saveUserSettingsBtn) saveUserSettingsBtn.disabled = true;
    }
}

// Create interview from featured template for new users
async function createInterviewFromFeaturedTemplate(userId) {
    try {
        // Find the featured template
        const featuredTemplateSnapshot = await db.collection('templates')
            .where('isFeatured', '==', true)
            .limit(1)
            .get();
        
        if (featuredTemplateSnapshot.empty) {
            console.log('No featured template found for new user onboarding');
            return;
        }
        
        const featuredTemplateDoc = featuredTemplateSnapshot.docs[0];
        const featuredTemplate = featuredTemplateDoc.data();
        
        console.log(`Creating interview from featured template "${featuredTemplate.title}" for new user ${userId}`);
        
        // Prepare the interview data (copy from template, removing template-specific fields)
        const interviewData = {
            ...featuredTemplate,
            // Update the title to indicate it's a sample/demo
            title: `Sample: ${featuredTemplate.title ? featuredTemplate.title.replace(' (Template)', '') : 'Welcome Interview'}`,
            // Ensure category is preserved
            category: featuredTemplate.category || '',
            // Set new interview metadata
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: userId,
            sharedWith: [], // New interview not shared with anyone
            // Add template tracking
            sourceTemplateId: featuredTemplateDoc.id,
            sourceTemplateCreatedBy: featuredTemplate.templateCreatedBy,
            sourceOriginalInterviewId: featuredTemplate.originalInterviewId,
            isOnboardingSample: true // Flag to identify this as the onboarding sample
        };
        
        // Remove template-specific metadata
        delete interviewData.originalInterviewId;
        delete interviewData.templateCreatedAt;
        delete interviewData.templateCreatedBy;
        delete interviewData.templateCreatedByEmail;
        delete interviewData.usageStats;
        delete interviewData.isFeatured;
        delete interviewData.featuredAt;
        delete interviewData.featuredBy;
        
        // Create the interview
        const interviewRef = await db.collection('interviews').add(interviewData);
        
        console.log(`Created onboarding interview ${interviewRef.id} from featured template for user ${userId}`);
        
        // Update template usage statistics
        await db.collection('templates').doc(featuredTemplateDoc.id).update({
            'usageStats.totalInterviewsCreated': firebase.firestore.FieldValue.increment(1),
            'usageStats.lastUsedAt': firebase.firestore.FieldValue.serverTimestamp(),
            'usageStats.onboardingUsageCount': firebase.firestore.FieldValue.increment(1)
        });
        
        // Refresh the interviews list if the function is available
        if (window.refreshInterviewsList) {
            setTimeout(() => {
                window.refreshInterviewsList();
            }, 1000); // Small delay to ensure the interview is fully created
        } else if (window.loadInterviewsGlobal) {
            setTimeout(() => {
                window.loadInterviewsGlobal();
            }, 1000);
        }
        
    } catch (error) {
        console.error('Error creating interview from featured template:', error);
        // Don't throw the error - we don't want to block user creation if this fails
    }
}

// Save user settings to Firebase
async function saveUserSettings() {
    const currentUser = auth.currentUser;
    const userDisplayNameInput = document.getElementById('userDisplayNameInput');
    const userOrganizationInput = document.getElementById('userOrganizationInput');
    const saveUserSettingsBtn = document.getElementById('saveUserSettingsBtn');
    
    if (!currentUser || !userDisplayNameInput || !userOrganizationInput || !saveUserSettingsBtn) {
        alert('Not logged in or panel elements missing.');
        return;
    }

    const newDisplayName = userDisplayNameInput.value.trim();
    const newOrganization = userOrganizationInput.value.trim();

    if (!newDisplayName) {
        alert('Display Name cannot be empty.');
        return;
    }
    
    saveUserSettingsBtn.disabled = true;
    saveUserSettingsBtn.textContent = 'Saving...';

    try {
        if (currentUser.displayName !== newDisplayName) {
            await currentUser.updateProfile({ displayName: newDisplayName });
            console.log('Firebase Auth displayName updated.');
        }

        const userDocRef = db.collection('users').doc(currentUser.uid);
        await userDocRef.set({
            displayName: newDisplayName,
            organization: newOrganization,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('Firestore user profile updated.');

        appState.setUserProfile({
            displayName: newDisplayName,
            organization: newOrganization
        });
        
        window.updateHeaderInterviewTitle(); // If header shows user-specific info, it might need refresh

        alert('Settings saved successfully!');
        saveUserSettingsBtn.textContent = 'Save Settings'; 
        // Button remains disabled as there are no new changes after save
    } catch (error) {
        console.error("Error saving user settings:", error);
        alert('Error saving settings: ' + error.message);
        saveUserSettingsBtn.disabled = false; 
        saveUserSettingsBtn.textContent = 'Save Settings';
    }
}

// Update Gmail connection status in the UI
function updateGmailConnectionStatus() {
    const gmailNotConnected = document.getElementById('gmailNotConnected');
    const gmailConnected = document.getElementById('gmailConnected');
    const gmailAccountEmail = document.getElementById('gmailAccountEmail');
    
    if (appState.userProfile.gmailConnected) {
        if (gmailNotConnected) gmailNotConnected.classList.add('hidden');
        if (gmailConnected) gmailConnected.classList.remove('hidden');
        if (gmailAccountEmail && appState.userProfile.gmailEmail) {
            gmailAccountEmail.textContent = appState.userProfile.gmailEmail;
        }
    } else {
        if (gmailNotConnected) gmailNotConnected.classList.remove('hidden');
        if (gmailConnected) gmailConnected.classList.add('hidden');
    }
}

// Connect Gmail account
async function connectGmail() {
    try {
        // Open OAuth popup
        const width = 500;
        const height = 600;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        
        const authWindow = window.open(
            '/api/gmail/auth',
            'gmailAuth',
            `width=${width},height=${height},left=${left},top=${top}`
        );
        
        // Listen for OAuth completion
        window.addEventListener('message', async function handleOAuthMessage(event) {
            if (event.origin !== window.location.origin) return;
            
            if (event.data.type === 'gmail-oauth-success') {
                window.removeEventListener('message', handleOAuthMessage);
                authWindow.close();
                
                // Update user profile
                const currentUser = auth.currentUser;
                if (currentUser) {
                    await db.collection('users').doc(currentUser.uid).update({
                        gmailConnected: true,
                        gmailEmail: event.data.email,
                        gmailTokens: event.data.tokens,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    
                    appState.setUserProfile({
                        ...appState.userProfile,
                        gmailConnected: true,
                        gmailEmail: event.data.email
                    });
                    
                    updateGmailConnectionStatus();
                    alert('Gmail account connected successfully!');
                }
            } else if (event.data.type === 'gmail-oauth-error') {
                window.removeEventListener('message', handleOAuthMessage);
                authWindow.close();
                alert('Failed to connect Gmail account: ' + event.data.error);
            }
        });
        
    } catch (error) {
        console.error('Error connecting Gmail:', error);
        alert('Error connecting Gmail account: ' + error.message);
    }
}

// Disconnect Gmail account
async function disconnectGmail() {
    if (!confirm('Are you sure you want to disconnect your Gmail account? Emails will be sent using the default service.')) {
        return;
    }
    
    try {
        const currentUser = auth.currentUser;
        if (currentUser) {
            // Revoke tokens on server
            await fetch('/api/gmail/disconnect', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${await currentUser.getIdToken()}`,
                    'Content-Type': 'application/json'
                }
            });
            
            // Update Firestore
            await db.collection('users').doc(currentUser.uid).update({
                gmailConnected: false,
                gmailEmail: null,
                gmailTokens: firebase.firestore.FieldValue.delete(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            appState.setUserProfile({
                ...appState.userProfile,
                gmailConnected: false,
                gmailEmail: null
            });
            
            updateGmailConnectionStatus();
            alert('Gmail account disconnected successfully.');
        }
    } catch (error) {
        console.error('Error disconnecting Gmail:', error);
        alert('Error disconnecting Gmail account: ' + error.message);
    }
}

// Initialize user settings event listeners
function initializeUserSettings() {
    const userSettingsBtn = document.getElementById('userSettingsBtn');
    const closeUserSettingsPanelBtn = document.getElementById('closeUserSettingsPanelBtn');
    const userSettingsOverlay = document.getElementById('userSettingsOverlay');
    const saveUserSettingsBtn = document.getElementById('saveUserSettingsBtn');
    const userDisplayNameInput = document.getElementById('userDisplayNameInput');
    const userOrganizationInput = document.getElementById('userOrganizationInput');
    const connectGmailBtn = document.getElementById('connectGmailBtn');
    const disconnectGmailBtn = document.getElementById('disconnectGmailBtn');
    
    userSettingsBtn?.addEventListener('click', () => {
        appState.setUserSettingsPanelOpen(true);
        applyUserSettingsPanelState(); 
    });
    
    closeUserSettingsPanelBtn?.addEventListener('click', () => {
        appState.setUserSettingsPanelOpen(false);
        applyUserSettingsPanelState();
    });
    
    userSettingsOverlay?.addEventListener('click', () => {
        appState.setUserSettingsPanelOpen(false);
        applyUserSettingsPanelState();
    });
    
    saveUserSettingsBtn?.addEventListener('click', saveUserSettings);

    userDisplayNameInput?.addEventListener('input', () => {
        if (userDisplayNameInput.value.trim() !== appState.userProfile.displayName) {
            if (saveUserSettingsBtn) saveUserSettingsBtn.disabled = false;
        } else if (userOrganizationInput && userOrganizationInput.value.trim() === appState.userProfile.organization) {
            if (saveUserSettingsBtn) saveUserSettingsBtn.disabled = true;
        }
    });
    
    userOrganizationInput?.addEventListener('input', () => {
        if (userOrganizationInput.value.trim() !== appState.userProfile.organization) {
            if (saveUserSettingsBtn) saveUserSettingsBtn.disabled = false;
        } else if (userDisplayNameInput && userDisplayNameInput.value.trim() === appState.userProfile.displayName) {
            if (saveUserSettingsBtn) saveUserSettingsBtn.disabled = true;
        }
    });
    
    // Gmail OAuth event listeners
    connectGmailBtn?.addEventListener('click', connectGmail);
    disconnectGmailBtn?.addEventListener('click', disconnectGmail);
}

// Expose functions globally
window.applyUserSettingsPanelState = applyUserSettingsPanelState;
window.loadUserProfile = loadUserProfile;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeUserSettings); 