// Tab Navigation Module
export function initializeTabNavigation() {
    // Handle header tab navigation
    const headerTabs = document.querySelectorAll('.header-tab');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    headerTabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all tabs
            headerTabs.forEach(t => t.classList.remove('active-tab'));
            
            // Add active class to clicked tab
            this.classList.add('active-tab');
            
            // Hide all tab panels
            tabPanels.forEach(panel => panel.classList.add('hidden'));
            
            // Show the corresponding panel
            const tabId = this.getAttribute('data-tab');
            if (tabId === 'standard') {
                document.getElementById('standardInterface').classList.remove('hidden');
            } else if (tabId === 'copilot') {
                document.getElementById('copilotInterface').classList.remove('hidden');
            }
        });
    });
    
    // Handle form tab navigation
    const formTabs = document.querySelectorAll('.tab-button');
    const formSections = document.querySelectorAll('.form-section');
    
    formTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            formTabs.forEach(t => {
                t.classList.remove('border-accent-primary', 'text-accent-primary');
                t.classList.add('border-transparent');
            });
            
            // Add active class to clicked tab
            this.classList.remove('border-transparent');
            this.classList.add('border-accent-primary', 'text-accent-primary');
            
            // Hide all form sections
            formSections.forEach(section => section.classList.add('hidden'));
            
            // Show the corresponding section
            const tabId = this.getAttribute('data-tab');
            document.getElementById(tabId).classList.remove('hidden');
            
            // Update progress bar
            updateProgressBar(tabId);
        });
    });
}

function updateProgressBar(tabId) {
    const progressPercentages = {
        'basic-info': 20,
        'initial-prompt': 40,
        'followup-prompt': 60,
        'report-prompt': 80,
        'page-headers': 100
    };
    
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        progressBar.style.width = `${progressPercentages[tabId]}%`;
    }
} 