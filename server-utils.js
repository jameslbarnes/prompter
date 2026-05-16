// Utility functions extracted from server.js
// No modifications - just moved here for modularity

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

function countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
}

function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

function formatTimeForLog(totalSeconds) {
    if (typeof totalSeconds !== 'number' || isNaN(totalSeconds)) {
        return '0m 0s'; // Return a default if input is invalid
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
}

function levenshteinDistance(s1, s2) {
    if (!s1) return s2 ? s2.length : 0;
    if (!s2) return s1.length;

    const matrix = [];

    for (let i = 0; i <= s2.length; i++) {
        matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
        for (let j = 1; j <= s1.length; j++) {
            const cost = s1[j - 1] === s2[i - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // Deletion
                matrix[i][j - 1] + 1,      // Insertion
                matrix[i - 1][j - 1] + cost // Substitution
            );
        }
    }

    return matrix[s2.length][s1.length];
}

async function extractTextFromFileBuffer(buffer, fileType, fileName) {
    try {
        if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
            const pdfData = await pdfParse(buffer);
            return pdfData.text;
        } else if (fileType.includes('word') || fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc')) {
            const result = await mammoth.extractRawText({ buffer: buffer });
            return result.value;
        } else if (fileType === 'text/plain' || fileName.toLowerCase().endsWith('.txt')) {
            return buffer.toString('utf-8');
        } else {
            console.warn(`Unsupported file type for text extraction: ${fileType} (${fileName})`);
            return null;
        }
    } catch (error) {
        console.error(`Error extracting text from ${fileName}:`, error);
        throw error;
    }
}

module.exports = {
    countWords,
    escapeXml,
    formatTimeForLog,
    levenshteinDistance,
    extractTextFromFileBuffer
};