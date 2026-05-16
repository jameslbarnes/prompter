// Interview Sharing Functionality

let currentSharingInterviewId = null;
let currentSharedEmails = [];

// Open sharing modal
window.openSharingModal = async function(interviewId) {
    currentSharingInterviewId = interviewId;
    
    // Load current sharing data
    await loadCurrentSharingData(interviewId);
    
    // Show modal
    const modal = document.getElementById('sharingModal');
    modal.classList.remove('hidden');
    
    // Clear input
    document.getElementById('shareEmailInput').value = '';
    
    // Focus on email input
    document.getElementById('shareEmailInput').focus();
};

// Close sharing modal
function closeSharingModal() {
    const modal = document.getElementById('sharingModal');
    modal.classList.add('hidden');
    currentSharingInterviewId = null;
    currentSharedEmails = [];
}

// Load current sharing data for an interview
async function loadCurrentSharingData(interviewId) {
    const db = firebase.firestore();
    
    try {
        const doc = await db.collection('interviews').doc(interviewId).get();
        if (doc.exists) {
            const data = doc.data();
            currentSharedEmails = data.sharedWith || [];
            updateSharedEmailsList();
        }
    } catch (error) {
        console.error('Error loading sharing data:', error);
        currentSharedEmails = [];
        updateSharedEmailsList();
    }
}

// Update the shared emails list in the UI
function updateSharedEmailsList() {
    const container = document.getElementById('sharedEmailsList');
    
    if (currentSharedEmails.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 italic">Not shared with anyone yet.</p>';
        return;
    }
    
    container.innerHTML = currentSharedEmails.map(email => `
        <div class="flex items-center justify-between bg-gray-700 px-3 py-2 rounded">
            <span class="text-sm text-gray-300">${email}</span>
            <button class="remove-share-btn text-red-400 hover:text-red-300" data-email="${email}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    `).join('');
    
    // Add event listeners for remove buttons
    container.querySelectorAll('.remove-share-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const email = this.getAttribute('data-email');
            removeSharedEmail(email);
        });
    });
}

// Add email to shared list
function addSharedEmail(email) {
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address.');
        return;
    }
    
    // Check if already shared
    if (currentSharedEmails.includes(email)) {
        alert('This email is already in the shared list.');
        return;
    }
    
    // Check if it's the current user's email
    const auth = firebase.auth();
    if (auth.currentUser && auth.currentUser.email === email) {
        alert('You cannot share with yourself.');
        return;
    }
    
    // Add to list
    currentSharedEmails.push(email);
    updateSharedEmailsList();
    
    // Clear input
    document.getElementById('shareEmailInput').value = '';
}

// Remove email from shared list
function removeSharedEmail(email) {
    currentSharedEmails = currentSharedEmails.filter(e => e !== email);
    updateSharedEmailsList();
}

// Save sharing changes
async function saveSharingChanges() {
    if (!currentSharingInterviewId) {
        console.error('No interview ID set for sharing');
        return;
    }
    
    const saveSharingBtn = document.getElementById('saveSharingBtn');
    
    try {
        // Disable button and show loading
        saveSharingBtn.disabled = true;
        saveSharingBtn.textContent = 'Saving...';
        
        // Use the API endpoint to update sharing
        const response = await fetch(`/api/interviews/${currentSharingInterviewId}/share`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sharedWith: currentSharedEmails
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Sharing updated successfully:', result);
        
        // Close modal
        closeSharingModal();
        
        // Optionally refresh the interviews list to show updated sharing status
        if (window.refreshInterviewsList) {
            window.refreshInterviewsList();
        } else if (window.loadInterviewsGlobal) {
            window.loadInterviewsGlobal();
        }
        
    } catch (error) {
        console.error('Error updating sharing:', error);
        alert('Failed to update sharing settings. Please try again.');
    } finally {
        // Re-enable button
        saveSharingBtn.disabled = false;
        saveSharingBtn.textContent = 'Save Changes';
    }
}

// Initialize sharing modal event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Close modal buttons
    document.getElementById('closeSharingModal')?.addEventListener('click', closeSharingModal);
    document.getElementById('cancelSharingBtn')?.addEventListener('click', closeSharingModal);
    
    // Add email button
    document.getElementById('addShareEmailBtn')?.addEventListener('click', function() {
        const email = document.getElementById('shareEmailInput').value.trim();
        if (email) {
            addSharedEmail(email);
        }
    });
    
    // Enter key in email input
    document.getElementById('shareEmailInput')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            const email = this.value.trim();
            if (email) {
                addSharedEmail(email);
            }
        }
    });
    
    // Save changes button
    document.getElementById('saveSharingBtn')?.addEventListener('click', saveSharingChanges);
    
    // Close modal when clicking outside
    document.getElementById('sharingModal')?.addEventListener('click', function(e) {
        if (e.target === this) {
            closeSharingModal();
        }
    });
});

// Export functions for global use
window.closeSharingModal = closeSharingModal;
window.addSharedEmail = addSharedEmail;
window.removeSharedEmail = removeSharedEmail;
window.saveSharingChanges = saveSharingChanges; 