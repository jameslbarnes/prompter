// Additional Utility Functions Module
// Extra utility functions not included in the main utils.js

// Test function to verify that the processMessageWithAI from admin.js is available
function testAdminJsIntegration() {
    try {
        // Just check if the function exists and is properly exposed
        if (typeof window.processMessageWithAI === 'function') {
            console.log("Integration with admin.js is working correctly!");
            return true;
        } else {
            console.error("processMessageWithAI function not found in window object!");
            return false;
        }
    } catch (error) {
        console.error("Error testing admin.js integration:", error);
        return false;
    }
}

// Toggle file upload section visibility
function toggleFileUploadSectionVisibility(isVisible) {
    const fileUploadSection = document.getElementById('fileUploadSection');
    if (fileUploadSection) {
        console.log(`Debug: toggleFileUploadSectionVisibility called. isVisible: ${isVisible}, fileUploadSection display was: ${fileUploadSection.style.display}`); // For debugging
        fileUploadSection.style.display = isVisible ? 'block' : 'none';
    } else {
        console.error("Debug: fileUploadSection element not found in toggleFileUploadSectionVisibility");
    }
}

// Handle interview list dropdown events
function handleInterviewListEvents(event) {
    const target = event.target;

    // Handle ellipsis button click
    const ellipsisButton = target.closest('.ellipsis-btn');
    if (ellipsisButton) {
        const menu = ellipsisButton.closest('.ellipsis-menu');
        const dropdown = menu.querySelector('.ellipsis-dropdown');
        // Close other open menus
        document.querySelectorAll('.ellipsis-dropdown.block').forEach(openDropdown => {
            if (openDropdown !== dropdown) {
                openDropdown.classList.add('hidden');
                openDropdown.classList.remove('block');
                const parentMenu = openDropdown.closest('.ellipsis-menu');
                if (parentMenu) {
                    parentMenu.classList.remove('open');
                }
            }
        });
        // Toggle current menu
        dropdown.classList.toggle('hidden');
        dropdown.classList.toggle('block');
        const parentMenu = dropdown.closest('.ellipsis-menu');
        if (parentMenu) {
            parentMenu.classList.toggle('open', dropdown.classList.contains('block'));
        }
        event.stopPropagation(); // Prevent closing immediately if clicking outside
        return; // Stop further processing
    }

    // Handle click on the card itself (for editing)
    const interviewCard = target.closest('.interview-card');
    if (interviewCard && !target.closest('.ellipsis-menu')) {
        const editButton = interviewCard.querySelector('.edit-btn'); // Find the edit button within the card
        if (editButton) {
            const id = editButton.getAttribute('data-id');
            if (window.loadInterviewForEditing) {
                window.loadInterviewForEditing(id); // Call the main loading function
            }
            closeAllDropdowns(); // Close any open menus
            // Optional: Add a visual indicator for the selected item
            document.querySelectorAll('#interviewsList .interview-card.selected').forEach(el => el.classList.remove('selected', 'bg-gray-700'));
            interviewCard.classList.add('selected', 'bg-gray-700'); // Example selection style
            return;
        }
    }

    // Handle actions within the dropdown
    const copyButton = target.closest('.copy-btn');
    if (copyButton) {
        const url = copyButton.getAttribute('data-url');
        if (window.copyToClipboard) {
            window.copyToClipboard(url)
                .then(() => {
                    copyButton.textContent = 'Copied!';
                    setTimeout(() => {
                        copyButton.textContent = 'Copy URL';
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy URL:', err);
                    copyButton.textContent = 'Failed';
                    setTimeout(() => {
                        copyButton.textContent = 'Copy URL';
                    }, 2000);
                });
        }
        closeAllDropdowns();
        return;
    }

    const shareButton = target.closest('.share-btn');
    if (shareButton) {
        const id = shareButton.getAttribute('data-id');
        if (window.openSharingModal) window.openSharingModal(id);
        closeAllDropdowns();
        return;
    }

    const deleteButton = target.closest('.delete-btn');
    if (deleteButton) {
        const id = deleteButton.getAttribute('data-id');
        if (confirm('Are you sure you want to delete this interview? This action cannot be undone.')) {
            if (window.deleteInterview) {
                window.deleteInterview(id);
            }
        }
        closeAllDropdowns();
        return;
    }

    const addToTemplatesButton = target.closest('.add-to-templates-btn');
    if (addToTemplatesButton) {
        const id = addToTemplatesButton.getAttribute('data-id');
        if (window.addInterviewToTemplates) window.addInterviewToTemplates(id);
        closeAllDropdowns();
        return;
    }
}

// Handle document clicks for closing dropdowns
function handleDocumentClickForDropdowns(event) {
    if (!event.target.closest('.ellipsis-menu')) {
        closeAllDropdowns();
    }
}

// Close all dropdowns
function closeAllDropdowns() {
    document.querySelectorAll('.ellipsis-dropdown.block').forEach(dropdown => {
        dropdown.classList.add('hidden');
        dropdown.classList.remove('block');
        const parentMenu = dropdown.closest('.ellipsis-menu');
        if (parentMenu) {
            parentMenu.classList.remove('open');
        }
    });
}

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Test admin.js integration after DOM content is loaded and scripts are executed
    setTimeout(testAdminJsIntegration, 1000);
    
    // Set up interview list event delegation
    const interviewsList = document.getElementById('interviewsList');
    if (interviewsList) {
        interviewsList.addEventListener('click', handleInterviewListEvents);
    }
    
    // Set up document click handler for closing dropdowns
    document.addEventListener('click', handleDocumentClickForDropdowns);
});

// Expose functions globally if needed
window.toggleFileUploadSectionVisibility = toggleFileUploadSectionVisibility; 