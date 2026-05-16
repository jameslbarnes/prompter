// Utility Functions

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function copyToClipboard(text) {
    return navigator.clipboard.writeText(text)
        .then(() => {
            console.log('Text copied to clipboard successfully');
            return true;
        })
        .catch(err => {
            console.error('Could not copy text: ', err);
            
            // Fallback for older browsers
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                const successful = document.execCommand('copy');
                document.body.removeChild(textarea);
                
                if (successful) {
                    console.log('Text copied to clipboard using fallback method');
                    return true;
                } else {
                    throw new Error('Fallback copy method failed');
                }
            } catch (fallbackErr) {
                console.error('Fallback copy failed: ', fallbackErr);
                throw fallbackErr;
            }
        });
}

function escapeXml(unsafe) {
    return unsafe ? unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    }) : '';
}

// Format time (e.g., 0:15)
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// Show error message
function showError(message) {
    console.error("Displaying Error:", message);
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.innerHTML = message; // Using innerHTML to support HTML content
        errorMessage.classList.remove('hidden');
    }
}

// Clear error message
function clearError() {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.textContent = '';
        errorMessage.classList.add('hidden');
    }
}

// Show info message
function showInfo(message) {
    let infoElement = document.getElementById('infoMessage');
    if (!infoElement) {
        infoElement = document.createElement('div');
        infoElement.id = 'infoMessage';
        infoElement.className = 'text-center p-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg mb-2 text-sm animate-fade-in';
        const recordingControls = document.getElementById('recordingControls');
        if (recordingControls) {
            recordingControls.parentNode.insertBefore(infoElement, recordingControls);
        }
    }
    
    infoElement.textContent = message;
    
    // Auto-hide after 8 seconds
    if (window.infoMessageTimeout) {
        clearTimeout(window.infoMessageTimeout);
    }
    window.infoMessageTimeout = setTimeout(() => {
        if (infoElement.parentNode) {
            infoElement.style.opacity = '0';
            infoElement.style.transition = 'opacity 0.5s ease';
            setTimeout(() => {
                if (infoElement.parentNode) {
                    infoElement.parentNode.removeChild(infoElement);
                }
            }, 500);
        }
    }, 8000);
}

// Scroll to bottom of element
function scrollToBottom(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        // Use requestAnimationFrame for smoother scrolling after render
        requestAnimationFrame(() => {
            element.scrollTop = element.scrollHeight;
        });
    }
}

// Get supported MIME type for MediaRecorder
function getMimeType() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    
    if (isIOS || isSafari) {
        console.log('[getMimeType] Safari/iOS device detected, prioritizing compatible formats');
        
        // Safari on macOS supports audio/mp4
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
            console.log('[getMimeType] Using audio/mp4 for Safari/iOS');
            return 'audio/mp4';
        }
        
        // Try audio/wav which Safari sometimes supports
        if (MediaRecorder.isTypeSupported('audio/wav')) {
            console.log('[getMimeType] Using audio/wav for Safari/iOS');
            return 'audio/wav';
        }
        
        // Show iOS/Safari warning once
        if (!window.safariWarningShown) {
            window.safariWarningShown = true;
            if (isIOS) {
                showIOSWarning();
            } else {
                showSafariWarning();
            }
        }
        
        // Let Safari choose its default format
        console.log('[getMimeType] Letting Safari choose default format');
        return '';
    }
    
    // Audio MIME types to check for other browsers
    const audioMimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
        'audio/wav',
        'audio/mpeg'
    ];
    
    // Try preferred types for specific browsers
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('chrome') || userAgent.includes('edge')) {
        const webmType = audioMimeTypes.find(type => type.includes('webm') && MediaRecorder.isTypeSupported(type));
        if (webmType) {
            console.log(`[getMimeType] Using ${webmType} for Chrome/Edge`);
            return webmType;
        }
    }
    
    if (userAgent.includes('firefox')) {
        const oggType = audioMimeTypes.find(type => type.includes('ogg') && MediaRecorder.isTypeSupported(type));
        if (oggType) {
            console.log(`[getMimeType] Using ${oggType} for Firefox`);
            return oggType;
        }
    }
    
    // Fallback to first supported type
    for (const mimeType of audioMimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
            console.log(`[getMimeType] Using ${mimeType}`);
            return mimeType;
        }
    }
    
    console.warn('[getMimeType] No supported audio MIME type found, using default');
    return ''; // Let the browser choose
}

// Show iOS warning message
function showIOSWarning() {
    const warning = document.createElement('div');
    warning.className = 'ios-recording-warning';
    warning.innerHTML = `
        <div class="warning-content">
            <strong>iOS Recording Note:</strong><br>
            For best results on iOS devices:
            <ul>
                <li>Use Safari browser</li>
                <li>Allow microphone permissions</li>
                <li>Keep the browser tab active while recording</li>
            </ul>
        </div>
    `;
    
    const container = document.querySelector('.interview-container') || document.body;
    container.insertBefore(warning, container.firstChild);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        warning.style.opacity = '0';
        warning.style.transition = 'opacity 0.5s ease';
        setTimeout(() => warning.remove(), 500);
    }, 10000);
}

// Show Safari warning message
function showSafariWarning() {
    const warning = document.createElement('div');
    warning.className = 'safari-recording-warning';
    warning.innerHTML = `
        <div class="warning-content">
            <strong>Safari Recording Note:</strong><br>
            If transcription isn't working properly:
            <ul>
                <li>Ensure microphone permissions are granted</li>
                <li>Try speaking clearly and at a moderate pace</li>
                <li>Consider using Chrome or Firefox for better compatibility</li>
            </ul>
        </div>
    `;
    
    const container = document.querySelector('.interview-container') || document.body;
    container.insertBefore(warning, container.firstChild);
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        warning.style.opacity = '0';
        warning.style.transition = 'opacity 0.5s ease';
        setTimeout(() => warning.remove(), 500);
    }, 10000);
}

// Sanitize filename
function sanitizeFilename(filename) {
    return filename
        .replace(/[^a-z0-9]/gi, '_')
        .replace(/_+/g, '_')
        .toLowerCase()
        .substring(0, 100);
}

// Parse duration string (e.g., "1m 30s" -> 90)
function parseDuration(durationStr) {
    if (!durationStr) return 0;
    
    const parts = durationStr.split(' ');
    let totalSeconds = 0;
    
    for (const part of parts) {
        if (part.endsWith('m')) {
            totalSeconds += parseInt(part) * 60;
        } else if (part.endsWith('s')) {
            totalSeconds += parseInt(part);
        }
    }
    
    return totalSeconds;
}

// Format duration for display
function formatDuration(seconds) {
    if (seconds < 60) {
        return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (remainingSeconds === 0) {
        return `${minutes}m`;
    }
    
    return `${minutes}m ${remainingSeconds}s`;
}

// Export functions for global use
window.generateUUID = generateUUID;
window.copyToClipboard = copyToClipboard;
window.escapeXml = escapeXml;
window.formatTime = formatTime;
window.showError = showError;
window.clearError = clearError;
window.showInfo = showInfo;
window.scrollToBottom = scrollToBottom;
window.getMimeType = getMimeType;
window.showIOSWarning = showIOSWarning;
window.sanitizeFilename = sanitizeFilename;
window.parseDuration = parseDuration;
window.formatDuration = formatDuration;