// Theme module - handles dark/light theme switching
import { elements } from '../dom.js';

// Initialize theme handling - Force dark mode for interviews
export function initializeTheme() {
    // Always set to dark theme for interviews
    document.documentElement.setAttribute('data-theme', 'dark');
    
    // Hide theme toggle if it exists
    if (elements.themeToggle) {
        elements.themeToggle.style.display = 'none';
    }
}

// Toggle between light and dark themes - Disabled for interviews
function toggleTheme() {
    // Theme toggling is disabled for interviews
    return;
}

// Update theme icon based on current theme
function updateThemeIcon(theme) {
    if (!elements.sunIcon || !elements.moonIcon) return;
    
    if (theme === 'dark') {
        elements.sunIcon.classList.remove('hidden');
        elements.moonIcon.classList.add('hidden');
    } else {
        elements.sunIcon.classList.add('hidden');
        elements.moonIcon.classList.remove('hidden');
    }
}

// Get current theme - Always returns dark for interviews
export function getCurrentTheme() {
    return 'dark';
}

// Set theme programmatically - Always sets to dark for interviews
export function setTheme(theme) {
    // Always force dark theme for interviews
    document.documentElement.setAttribute('data-theme', 'dark');
} 