// Sidebar Management

function initializeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');

    // Function to apply sidebar state from appState to DOM
    function applySidebarState() {
        const isCollapsed = appState.uiState.sidebarCollapsed;
        const closeIcon = sidebarToggle?.querySelector('.close');
        const menuIcon = sidebarToggle?.querySelector('.menu');
        
        if (isCollapsed) {
            sidebar?.classList.add('collapsed');
            closeIcon?.classList.add('hidden');
            menuIcon?.classList.remove('hidden');
        } else {
            sidebar?.classList.remove('collapsed');
            closeIcon?.classList.remove('hidden');
            menuIcon?.classList.add('hidden');
        }
        
        // Update header title visibility when sidebar state changes
        if (window.updateHeaderInterviewTitle) {
            window.updateHeaderInterviewTitle();
        }
    }

    // Initialize sidebar state from appState
    applySidebarState();

    // Toggle sidebar when button is clicked
    sidebarToggle?.addEventListener('click', function() {
        const newCollapsedState = !appState.uiState.sidebarCollapsed;
        appState.setSidebarCollapsed(newCollapsedState);
        applySidebarState();
    });

    // Export function for global use
    window.applySidebarState = applySidebarState;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeSidebar();
}); 