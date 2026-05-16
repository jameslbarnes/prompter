const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function extractTextFromFileBuffer(buffer, fileType, fileName) {
    try {
        if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
            console.log('[File Processing] Processing PDF file');
            const data = await pdfParse(buffer);
            return data.text;
        } else if (
            fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            fileType === 'application/msword' ||
            fileName.toLowerCase().endsWith('.docx') ||
            fileName.toLowerCase().endsWith('.doc')
        ) {
            console.log('[File Processing] Processing Word document');
            const result = await mammoth.extractRawText({ buffer });
            return result.value;
        } else if (
            fileType === 'text/plain' ||
            fileName.toLowerCase().endsWith('.txt')
        ) {
            console.log('[File Processing] Processing text file');
            return buffer.toString('utf-8');
        } else {
            throw new Error(`Unsupported file type: ${fileType}`);
        }
    } catch (error) {
        console.error('[File Processing] Error extracting text:', error);
        throw error;
    }
}

module.exports = {
    extractTextFromFileBuffer
};