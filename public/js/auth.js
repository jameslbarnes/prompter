// Authentication Management

// DOM Elements
let authContainer, pageWrapper, googleSignInBtn, signOutBtn;

// Initialize DOM elements after document loads
function initAuthElements() {
    authContainer = document.getElementById('authContainer');
    pageWrapper = document.getElementById('pageWrapper');
    googleSignInBtn = document.getElementById('googleSignInBtn');
    signOutBtn = document.getElementById('signOutBtn');
}

// Google Sign-In functionality
function setupGoogleSignIn() {
    googleSignInBtn?.addEventListener('click', function() {
        // Disable button while signing in
        googleSignInBtn.disabled = true;
        googleSignInBtn.textContent = 'Signing in...';

        // Create Google Auth provider
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');

        // Sign in with popup
        auth.signInWithPopup(provider)
            .then((result) => {
                // Login successful
                console.log('Google sign-in successful:', result.user.email);
                authContainer.classList.add('hidden');
                pageWrapper.classList.remove('hidden');
                if (window.refreshInterviewsList) {
                    window.refreshInterviewsList();
                } else if (window.loadInterviewsGlobal) {
                    window.loadInterviewsGlobal();
                }
                if (window.showSpecificationNullState) window.showSpecificationNullState();
                if (globalAudioPlayerContainer) globalAudioPlayerContainer.classList.remove('visible');
                
                // Process initial hash after login and DOM ready
                if (window.handleHashChange) {
                    window.handleHashChange().then(() => {
                        if (window.applyActiveSpecTabFromState) window.applyActiveSpecTabFromState();
                        if (window.applyReportDetailPanelState) window.applyReportDetailPanelState();
                    });
                }
            })
            .catch((error) => {
                console.error('Google sign-in error:', error);
                let errorMessage = 'Google sign-in failed: ';
                
                switch(error.code) {
                    case 'auth/popup-closed-by-user':
                        errorMessage += 'Sign-in was cancelled.';
                        break;
                    case 'auth/popup-blocked':
                        errorMessage += 'Popup was blocked by browser. Please allow popups for this site.';
                        break;
                    case 'auth/cancelled-popup-request':
                        errorMessage += 'Another sign-in popup is already open.';
                        break;
                    default:
                        errorMessage += error.message;
                }
                
                alert(errorMessage);
                googleSignInBtn.disabled = false;
                googleSignInBtn.innerHTML = `
                    <svg class="w-5 h-5 mr-2" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Sign in with Google
                `;
            });
    });
}


// Sign Out functionality
function setupSignOut() {
    signOutBtn?.addEventListener('click', () => {
        if (confirm('Are you sure you want to sign out?')) {
            auth.signOut()
                .then(() => {
                    console.log('User signed out successfully');
                    // The auth state change listener will handle UI updates
                })
                .catch((error) => {
                    console.error('Error signing out:', error);
                    alert('Error signing out: ' + error.message);
                });
        }
    });
}

// Auth State Change Handler
function setupAuthStateHandler() {
    auth.onAuthStateChanged(function(user) {
        if (user) {
            // Store user ID globally for easy access
            window.currentUserId = user.uid;
            
            // User is signed in
            authContainer?.classList.add('hidden');
            pageWrapper?.classList.remove('hidden');
            if (globalAudioPlayerContainer) globalAudioPlayerContainer.classList.remove('visible');
            
            // Load user profile if available
            if (window.loadUserProfile) window.loadUserProfile();
            
            // Load user features for pricing/permissions
            if (window.loadUserFeatures) window.loadUserFeatures();
            
            // Process initial hash after login and DOM ready
            if (window.handleHashChange) {
                window.handleHashChange().then(() => {
                    if (window.applyActiveSpecTabFromState) window.applyActiveSpecTabFromState();
                    if (window.applyReportDetailPanelState) window.applyReportDetailPanelState();
                    if (window.applyUserSettingsPanelState) window.applyUserSettingsPanelState();
                });
            }

            if (window.refreshInterviewsList) {
                window.refreshInterviewsList();
            } else if (window.loadInterviewsGlobal) {
                window.loadInterviewsGlobal();
            }

        } else {
            // User is signed out
            window.currentUserId = null;
            
            authContainer?.classList.remove('hidden');
            pageWrapper?.classList.add('hidden');
            if (globalAudioPlayerContainer) globalAudioPlayerContainer.classList.remove('visible');
            if (appState) appState.setUserProfile({ displayName: '', organization: '' });
            if (window.applyUserSettingsPanelState) window.applyUserSettingsPanelState();
        }
    });
}

// Initialize authentication when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initAuthElements();
    setupGoogleSignIn();
    setupSignOut();
    setupAuthStateHandler();
});

// Email/Password Authentication for auth.html
function initializeAuth() {
    // Get form elements
    const emailSignInForm = document.getElementById('emailSignInForm');
    const emailSignUpForm = document.getElementById('emailSignUpForm');
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    const googleSignUpBtn = document.getElementById('googleSignUpBtn');
    const successMessage = document.getElementById('successMessage');

    // Helper function to show error
    function showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    // Helper function to clear errors
    function clearErrors() {
        document.querySelectorAll('.error-message').forEach(el => {
            el.style.display = 'none';
            el.textContent = '';
        });
    }

    // Helper function to show loading state
    function setLoadingState(buttonId, spinnerId, textId, loading, text) {
        const button = document.getElementById(buttonId);
        const spinner = document.getElementById(spinnerId);
        const textElement = document.getElementById(textId);
        
        if (button) button.disabled = loading;
        if (spinner) spinner.style.display = loading ? 'block' : 'none';
        if (textElement) {
            textElement.style.display = loading ? 'none' : 'inline';
            if (!loading && text) textElement.textContent = text;
        }
    }

    // Handle successful authentication
    function handleAuthSuccess(user) {
        successMessage.textContent = 'Successfully signed in! Redirecting...';
        successMessage.style.display = 'block';
        
        // Check if user has a redirect URL stored
        const redirectUrl = sessionStorage.getItem('authRedirect') || '/admin.html';
        sessionStorage.removeItem('authRedirect');
        
        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 1000);
    }

    // Email Sign In
    if (emailSignInForm) {
        emailSignInForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();
            
            const email = document.getElementById('signInEmail').value;
            const password = document.getElementById('signInPassword').value;
            
            setLoadingState('signInButton', 'signInSpinner', 'signInButtonText', true);
            
            try {
                const result = await firebase.auth().signInWithEmailAndPassword(email, password);
                handleAuthSuccess(result.user);
            } catch (error) {
                console.error('Sign in error:', error);
                
                switch(error.code) {
                    case 'auth/user-not-found':
                        showError('signInEmailError', 'No account found with this email');
                        break;
                    case 'auth/wrong-password':
                        showError('signInPasswordError', 'Incorrect password');
                        break;
                    case 'auth/invalid-email':
                        showError('signInEmailError', 'Invalid email address');
                        break;
                    case 'auth/too-many-requests':
                        showError('signInPasswordError', 'Too many failed attempts. Please try again later.');
                        break;
                    default:
                        showError('signInPasswordError', error.message);
                }
            } finally {
                setLoadingState('signInButton', 'signInSpinner', 'signInButtonText', false, 'Sign In');
            }
        });
    }

    // Email Sign Up
    if (emailSignUpForm) {
        emailSignUpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();
            
            const email = document.getElementById('signUpEmail').value;
            const password = document.getElementById('signUpPassword').value;
            const confirmPassword = document.getElementById('signUpConfirmPassword').value;
            
            // Validate passwords match
            if (password !== confirmPassword) {
                showError('signUpConfirmError', 'Passwords do not match');
                return;
            }
            
            // Validate password length
            if (password.length < 6) {
                showError('signUpPasswordError', 'Password must be at least 6 characters');
                return;
            }
            
            setLoadingState('signUpButton', 'signUpSpinner', 'signUpButtonText', true);
            
            try {
                const result = await firebase.auth().createUserWithEmailAndPassword(email, password);

                // Notify backend of new account
                try {
                    const token = await result.user.getIdToken();
                    await fetch('/api/notify-new-account', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ email: result.user.email, uid: result.user.uid })
                    });
                } catch (notifyErr) {
                    console.error('New account notification failed:', notifyErr);
                }

                // Send verification email
                await result.user.sendEmailVerification();
                
                successMessage.textContent = 'Account created! Check your email for verification. Redirecting...';
                successMessage.style.display = 'block';
                
                setTimeout(() => {
                    handleAuthSuccess(result.user);
                }, 2000);
            } catch (error) {
                console.error('Sign up error:', error);
                
                switch(error.code) {
                    case 'auth/email-already-in-use':
                        showError('signUpEmailError', 'An account already exists with this email');
                        break;
                    case 'auth/invalid-email':
                        showError('signUpEmailError', 'Invalid email address');
                        break;
                    case 'auth/weak-password':
                        showError('signUpPasswordError', 'Password is too weak. Use at least 6 characters.');
                        break;
                    default:
                        showError('signUpEmailError', error.message);
                }
            } finally {
                setLoadingState('signUpButton', 'signUpSpinner', 'signUpButtonText', false, 'Create Account');
            }
        });
    }

    // Google Sign In/Up
    const setupGoogleAuth = (button) => {
        if (!button) return;
        
        button.addEventListener('click', async () => {
            button.disabled = true;
            const originalText = button.innerHTML;
            button.textContent = 'Signing in...';
            
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
            provider.addScope('profile');
            
            try {
                const result = await firebase.auth().signInWithPopup(provider);
                handleAuthSuccess(result.user);
            } catch (error) {
                console.error('Google auth error:', error);
                
                let errorMessage = 'Authentication failed: ';
                switch(error.code) {
                    case 'auth/popup-closed-by-user':
                        errorMessage = 'Sign-in was cancelled';
                        break;
                    case 'auth/popup-blocked':
                        errorMessage = 'Please allow popups for this site';
                        break;
                    default:
                        errorMessage += error.message;
                }
                
                alert(errorMessage);
                button.disabled = false;
                button.innerHTML = originalText;
            }
        });
    };
    
    setupGoogleAuth(googleSignInBtn);
    setupGoogleAuth(googleSignUpBtn);
    
    // Check if user is already signed in
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // Don't auto-redirect if user explicitly wants to sign out or switch accounts
            const urlParams = new URLSearchParams(window.location.search);
            if (!urlParams.has('force')) {
                // User is already signed in, redirect
                handleAuthSuccess(user);
            }
        }
    });
}

// Export functions for global use
window.setupAuthStateHandler = setupAuthStateHandler;
window.initializeAuth = initializeAuth; 