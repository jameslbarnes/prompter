// XML Utility Functions Module

export function extractTagContent(tag, text, defaultValue = null) {
    const openingTag = `<${tag}>`;
    const closingTag = `</${tag}>`;
    
    let aiValue = null;
    let matchFoundBy = "none";

    // 1. Try Regex
    try {
        const regex = new RegExp(`${openingTag}([\\s\\S]*?)${closingTag}`, 'i');
        const match = text.match(regex);
        if (match && match[1]) {
            aiValue = match[1].trim();
            matchFoundBy = "regex";
        }
    } catch (e) {
        console.error(`[extractTagContent] Regex error for tag '${tag}':`, e);
    }

    // 2. If regex failed, try direct string manipulation (indexOf)
    if (aiValue === null) {
        // Ensure text is a string before calling toLowerCase and indexOf
        const strText = String(text);
        const startIndex = strText.toLowerCase().indexOf(openingTag.toLowerCase());
        if (startIndex !== -1) {
            const endIndex = strText.toLowerCase().indexOf(closingTag.toLowerCase(), startIndex + openingTag.length);
            if (endIndex !== -1) {
                aiValue = strText.substring(startIndex + openingTag.length, endIndex).trim();
                matchFoundBy = "indexOf";
            }
        }
    }
    
    const result = aiValue !== null && aiValue !== '' ? aiValue : defaultValue;
    return result;
}

export function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
        return c; 
    });
}

// Also make them available globally
window.escapeXml = escapeXml;
window.extractTagContent = extractTagContent; 