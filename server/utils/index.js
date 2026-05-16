// General utility functions

function countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
}

function escapeXml(unsafe) {
    const map = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        "'": '&apos;',
        '"': '&quot;'
    };
    return unsafe.replace(/[<>&'"]/g, function (c) {
        return map[c];
    });
}

function formatTimeForLog(totalSeconds) {
    if (totalSeconds == null || isNaN(totalSeconds)) {
        return "0s";
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
}

function levenshteinDistance(s1, s2) {
    if (s1.length > s2.length) {
        [s1, s2] = [s2, s1];
    }

    let distances = [];
    for (let i = 0; i <= s1.length; i++) {
        distances[i] = i;
    }

    let previous = [], current = [];
    for (let j = 1; j <= s2.length; j++) {
        previous = [...distances];
        distances[0] = j;
        for (let i = 1; i <= s1.length; i++) {
            if (s1[i - 1] === s2[j - 1]) {
                distances[i] = previous[i - 1];
            } else {
                distances[i] = Math.min(
                    previous[i] + 1,      // insertion
                    distances[i - 1] + 1, // deletion
                    previous[i - 1] + 1   // substitution
                );
            }
        }
    }
    return distances[s1.length];
}

module.exports = {
    countWords,
    escapeXml,
    formatTimeForLog,
    levenshteinDistance
};