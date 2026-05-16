// Header Title Management

window.updateHeaderInterviewTitle = function(specificTitle = null) {
    console.log('[updateHeaderInterviewTitle] Called. Mode:', appState.isJournalAnalysisMode, 'ID:', appState.currentEditingInterviewId, 'GlobalTitle:', appState.currentInterviewTitleForHeader, 'ParamTitle:', specificTitle);
    
    const header = document.querySelector('.header');
    const titleElement = document.getElementById('activeInterviewHeaderTitle');
    const delimiterElement = document.getElementById('headerDelimiter');

    if (!header || !titleElement) return;

    // Use specificTitle if provided, otherwise use the global title, fallback to empty string
    const titleToShow = specificTitle || appState.currentInterviewTitleForHeader || "";
    
    titleElement.textContent = titleToShow;
    
    // Only show the interview title and delimiter if we have a specific title
    if (titleToShow) {
        header.classList.add('show-interview-title');
        titleElement.classList.remove('hidden');
        if (delimiterElement) {
            delimiterElement.classList.remove('hidden');
        }
    } else {
        header.classList.remove('show-interview-title');
        titleElement.classList.add('hidden');
        if (delimiterElement) {
            delimiterElement.classList.add('hidden');
        }
    }
}; 