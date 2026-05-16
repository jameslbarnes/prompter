// Firebase configuration and initialization
const firebaseConfig = window.PROMPTER_FIREBASE_CONFIG || {
    apiKey: "YOUR_FIREBASE_WEB_API_KEY",
    authDomain: "YOUR_FIREBASE_PROJECT.firebaseapp.com",
    projectId: "YOUR_FIREBASE_PROJECT_ID",
    messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
    appId: "YOUR_FIREBASE_APP_ID",
    measurementId: "YOUR_FIREBASE_MEASUREMENT_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore
const db = firebase.firestore();

// Initialize Firebase Auth
const auth = firebase.auth();

// Make auth and db available globally for other scripts
window.auth = auth;
window.db = db;



// Debug Firebase initialization
console.log('Firebase Initialization Debug:', {
    app: firebase.app().name,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    currentURL: window.location.href,
    protocol: window.location.protocol,
    isSecure: window.location.protocol === 'https:',
    authReady: !!auth,
    dbReady: !!db
});

// Check for mixed content
if (window.location.protocol === 'https:') {
    console.log('Running on HTTPS - checking for mixed content issues...');
    const scripts = document.getElementsByTagName('script');
    for (let script of scripts) {
        if (script.src && !script.src.startsWith('https:') && !script.src.startsWith('//')) {
            console.warn('Potential mixed content issue with script:', script.src);
        }
    }
}

// Test Firebase connectivity with error handling
auth.onAuthStateChanged(function(user) {
    console.log('Firebase Auth State Changed:', user ? 'User logged in' : 'User not logged in');
}, function(error) {
    console.error('Firebase Auth Error:', error);
});

// Test Firestore connectivity with a collection that exists
setTimeout(() => {
    if (db && firebase.auth().currentUser) {
        // Test with interviews collection which allows reads
        db.collection('interviews').limit(1).get()
            .then(() => console.log('Firestore connectivity test: SUCCESS'))
            .catch(err => console.error('Firestore connectivity test FAILED:', err));
    } else if (!firebase.auth().currentUser) {
        console.log('Firestore connectivity test skipped - no authenticated user');
    } else {
        console.error('Firestore db object not available for connectivity test');
    }
}, 2000); 
