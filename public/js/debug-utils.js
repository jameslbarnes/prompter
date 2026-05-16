// Debug Utilities Module
// Enhanced error logging and debugging utilities for Chrome issues

// Enhanced error logging for debugging Chrome issues
window.addEventListener('error', function(e) {
    console.error('Global error caught:', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        error: e.error,
        stack: e.error?.stack
    });
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', {
        reason: e.reason,
        promise: e.promise
    });
});

// Log browser info
console.log('Browser Info:', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    vendor: navigator.vendor,
    language: navigator.language,
    cookieEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    doNotTrack: navigator.doNotTrack
});

// Check if key APIs are available
console.log('API Availability:', {
    localStorage: typeof(Storage) !== "undefined",
    firebase: typeof(firebase) !== "undefined",
    firestore: window.firebase?.firestore ? true : false,
    auth: window.firebase?.auth ? true : false,
    marked: typeof(marked) !== "undefined",
    appState: typeof(appState) !== "undefined"
});

// Check library versions if available
console.log('Library Versions:', {
    marked: window.marked?.VERSION || 'unknown',
    firebase: window.firebase?.SDK_VERSION || 'unknown'
});

// Check for modern JavaScript features
console.log('JavaScript Feature Support:', {
    promises: typeof Promise !== 'undefined',
    async: (async function() {})().constructor.name === 'AsyncFunction',
    optionalChaining: (() => { try { eval('null?.prop'); return true; } catch { return false; } })(),
    nullishCoalescing: (() => { try { eval('null ?? "default"'); return true; } catch { return false; } })(),
    modules: 'noModule' in HTMLScriptElement.prototype,
    fetch: typeof fetch !== 'undefined',
    serviceWorker: 'serviceWorker' in navigator
});

// Check for blocked features
try {
    eval('1+1');
    console.log('eval() is allowed');
} catch (e) {
    console.error('eval() is blocked - this might cause issues with some libraries');
}

// Log when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - admin.html');
    
    // Check if critical elements exist
    console.log('Critical Elements Check:', {
        authContainer: !!document.getElementById('authContainer'),
        pageWrapper: !!document.getElementById('pageWrapper'),
        mainContent: !!document.getElementById('mainContent'),
        copilotMessages: !!document.getElementById('copilotMessages'),
        loginBtn: !!document.getElementById('loginBtn')
    });
});

// Monitor Firebase initialization
if (window.firebase) {
    console.log('Firebase is available, checking initialization...');
} else {
    console.error('Firebase is NOT available!');
} 