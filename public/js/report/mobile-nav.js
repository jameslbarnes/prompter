// Mobile Navigation Management
export function initializeMobileNavigation() {
    const mobileNavToggle = document.getElementById('mobileNavToggle');
    const mobileNavOverlay = document.getElementById('mobileNavOverlay');
    const reportSidebar = document.getElementById('reportSidebar');

    function toggleMobileNav() {
        console.log('[toggleMobileNav] Function called. Current appState.uiState.mobileNavOpen: ', appState.uiState.mobileNavOpen);
        // Toggle the state using the mutator
        appState.setMobileNavOpen(!appState.uiState.mobileNavOpen);
    }

    if (mobileNavToggle) {
        mobileNavToggle.removeEventListener('click', toggleMobileNav); // Remove any existing listeners first
        mobileNavToggle.addEventListener('click', function(e) {
            e.preventDefault(); // Crucial for preventing default anchor/button behavior
            e.stopPropagation(); // Prevent event bubbling
            console.log('Mobile nav TOGGLE button actually clicked');
            toggleMobileNav();
        });
    } else {
        console.error('Mobile nav toggle button not found!');
    }

    if (mobileNavOverlay) {
        mobileNavOverlay.removeEventListener('click', toggleMobileNav); // Remove any existing listeners
        mobileNavOverlay.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Mobile nav OVERLAY actually clicked');
            toggleMobileNav();
        });
    } else {
        console.error('Mobile nav overlay element not found!');
    }

    // Close mobile nav on window resize if it becomes desktop size
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768 && appState.uiState.mobileNavOpen) {
            console.log('Resized to desktop, closing nav via appState');
            appState.setMobileNavOpen(false); // Explicitly close
        }
    });
}

// Legacy toggle function for backward compatibility
export function toggleMobileNavLegacy() {
    const reportSidebar = document.getElementById('reportSidebar');
    const mobileNavOverlay = document.getElementById('mobileNavOverlay');
    
    const isOpen = reportSidebar.classList.contains('show');
    
    if (isOpen) {
        // Close navigation
        reportSidebar.classList.remove('show');
        mobileNavOverlay.classList.remove('show');
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.height = '';
        document.body.style.width = '';
    } else {
        // Open navigation
        reportSidebar.classList.add('show');
        mobileNavOverlay.classList.add('show');
        // Prevent background scrolling more reliably
        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.height = '100vh';
        document.body.style.width = '100vw';
    }
}