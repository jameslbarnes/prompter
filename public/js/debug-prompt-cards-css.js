// Debug script for prompt cards CSS
(function() {
    console.log('=== Prompt Cards CSS Debug ===');
    
    // Check if CSS file is loaded
    const styleSheets = Array.from(document.styleSheets);
    const promptCardsCss = styleSheets.find(sheet => {
        try {
            return sheet.href && sheet.href.includes('copilot-prompt-cards.css');
        } catch (e) {
            return false;
        }
    });
    
    if (promptCardsCss) {
        console.log('✓ copilot-prompt-cards.css is loaded:', promptCardsCss.href);
    } else {
        console.log('✗ copilot-prompt-cards.css is NOT loaded');
        
        // Check if main.css is loaded
        const mainCss = styleSheets.find(sheet => {
            try {
                return sheet.href && sheet.href.includes('main.css');
            } catch (e) {
                return false;
            }
        });
        
        if (mainCss) {
            console.log('✓ main.css is loaded:', mainCss.href);
            
            // Check if the import exists in main.css
            try {
                const rules = Array.from(mainCss.cssRules || mainCss.rules || []);
                const hasImport = rules.some(rule => 
                    rule.cssText && rule.cssText.includes('copilot-prompt-cards.css')
                );
                console.log(hasImport ? '✓ Import found in main.css' : '✗ Import NOT found in main.css');
            } catch (e) {
                console.log('Could not check main.css rules (CORS)');
            }
        } else {
            console.log('✗ main.css is NOT loaded');
        }
    }
    
    // Check if CSS variables are defined
    const root = document.documentElement;
    const computedStyle = window.getComputedStyle(root);
    const bgPrimary = computedStyle.getPropertyValue('--bg-primary');
    console.log('CSS variable --bg-primary:', bgPrimary || 'NOT DEFINED');
    
    // Wait for DOM and check for prompt cards
    setTimeout(() => {
        const promptCards = document.querySelectorAll('.prompt-card');
        console.log('Found prompt cards:', promptCards.length);
        
        if (promptCards.length > 0) {
            const firstCard = promptCards[0];
            const styles = window.getComputedStyle(firstCard);
            console.log('First card styles:', {
                background: styles.backgroundColor,
                border: styles.border,
                padding: styles.padding,
                display: styles.display,
                minHeight: styles.minHeight
            });
            
            // Check if styles are being applied
            const hasStyles = styles.padding !== '0px' && styles.minHeight !== 'auto';
            console.log(hasStyles ? '✓ Styles are applied' : '✗ Styles are NOT applied');
        }
        
        // Check for copilot-prompt-cards container
        const container = document.querySelector('.copilot-prompt-cards');
        if (container) {
            const containerStyles = window.getComputedStyle(container);
            console.log('Container styles:', {
                padding: containerStyles.padding,
                background: containerStyles.backgroundColor,
                overflow: containerStyles.overflowY
            });
        }
    }, 1000);
})();