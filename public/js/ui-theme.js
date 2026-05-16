// UI Theme Management

function initializeTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const sunIcon = themeToggle?.querySelector('.sun-icon');
    const moonIcon = themeToggle?.querySelector('.moon-icon');
    
    // Function to update theme icon based on current theme
    function updateThemeIcon(theme) {
        if (!sunIcon || !moonIcon) return;
        
        if (theme === 'dark') {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        } else {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        }
    }

    // Function to apply theme state from appState to DOM
    function applyThemeState() {
        const currentTheme = appState.uiState.theme;
        document.documentElement.setAttribute('data-theme', currentTheme);
        updateThemeIcon(currentTheme);
    }

    // Initialize theme from appState
    applyThemeState();
    
    themeToggle?.addEventListener('click', () => {
        const currentTheme = appState.uiState.theme;
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        appState.setTheme(newTheme);
        updateThemeIcon(newTheme);
    });

    // Export function for global use
    window.applyThemeState = applyThemeState;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    initializeTheme();
}); 