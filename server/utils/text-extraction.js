// Text Extraction Utilities Module
// Handles extraction of text content from various file formats

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract text content from a file buffer based on file type
 * @param {Buffer} buffer - The file buffer
 * @param {string} fileType - MIME type of the file
 * @param {string} fileName - Original filename
 * @returns {Promise<string|null>} - Extracted text or null if extraction fails
 */
async function extractTextFromFileBuffer(buffer, fileType, fileName) {
    try {
        console.log(`[TextExtraction] Extracting text from ${fileName} (${fileType})`);
        
        // Handle PDF files
        if (fileType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
            console.log('[TextExtraction] Processing PDF file');
            try {
                const data = await pdfParse(buffer);
                const extractedText = data.text;
                console.log(`[TextExtraction] Extracted ${extractedText.length} characters from PDF`);
                return extractedText;
            } catch (pdfError) {
                console.error('[TextExtraction] PDF parsing error:', pdfError);
                return null;
            }
        }
        
        // Handle Word documents (.docx)
        if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
            fileName.toLowerCase().endsWith('.docx')) {
            console.log('[TextExtraction] Processing DOCX file');
            try {
                const result = await mammoth.extractRawText({ buffer: buffer });
                const extractedText = result.value;
                console.log(`[TextExtraction] Extracted ${extractedText.length} characters from DOCX`);
                return extractedText;
            } catch (docxError) {
                console.error('[TextExtraction] DOCX parsing error:', docxError);
                return null;
            }
        }
        
        // Handle old Word documents (.doc)
        if (fileType === 'application/msword' || fileName.toLowerCase().endsWith('.doc')) {
            console.log('[TextExtraction] Processing DOC file');
            try {
                // Try mammoth first (it might work for some .doc files)
                const result = await mammoth.extractRawText({ buffer: buffer });
                const extractedText = result.value;
                console.log(`[TextExtraction] Extracted ${extractedText.length} characters from DOC`);
                return extractedText;
            } catch (docError) {
                console.error('[TextExtraction] DOC parsing error:', docError);
                // If mammoth fails, we could try other libraries here
                return null;
            }
        }
        
        // Handle text files
        if (fileType.startsWith('text/') || 
            fileName.match(/\.(txt|md|csv|json|xml|log|js|py|java|cpp|c|h|css|html|htm)$/i)) {
            console.log('[TextExtraction] Processing text file');
            try {
                const extractedText = buffer.toString('utf-8');
                console.log(`[TextExtraction] Extracted ${extractedText.length} characters from text file`);
                return extractedText;
            } catch (textError) {
                console.error('[TextExtraction] Text decoding error:', textError);
                return null;
            }
        }
        
        // Handle CSV files specifically
        if (fileType === 'text/csv' || fileName.toLowerCase().endsWith('.csv')) {
            console.log('[TextExtraction] Processing CSV file');
            try {
                const extractedText = buffer.toString('utf-8');
                console.log(`[TextExtraction] Extracted ${extractedText.length} characters from CSV`);
                return extractedText;
            } catch (csvError) {
                console.error('[TextExtraction] CSV parsing error:', csvError);
                return null;
            }
        }
        
        // Handle JSON files
        if (fileType === 'application/json' || fileName.toLowerCase().endsWith('.json')) {
            console.log('[TextExtraction] Processing JSON file');
            try {
                const extractedText = buffer.toString('utf-8');
                // Optionally validate JSON
                JSON.parse(extractedText);
                console.log(`[TextExtraction] Extracted ${extractedText.length} characters from JSON`);
                return extractedText;
            } catch (jsonError) {
                console.error('[TextExtraction] JSON parsing error:', jsonError);
                // Still return the text even if JSON is invalid
                return buffer.toString('utf-8');
            }
        }
        
        console.log(`[TextExtraction] Unsupported file type: ${fileType} for file: ${fileName}`);
        return null;
        
    } catch (error) {
        console.error('[TextExtraction] Unexpected error:', error);
        return null;
    }
}

/**
 * Determine if a file type is supported for text extraction
 * @param {string} fileType - MIME type
 * @param {string} fileName - File name
 * @returns {boolean} - True if supported
 */
function isFileTypeSupported(fileType, fileName) {
    const supportedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
        'text/csv',
        'text/markdown',
        'application/json',
        'text/xml',
        'application/xml'
    ];
    
    const supportedExtensions = [
        '.pdf', '.doc', '.docx', '.txt', '.md', '.csv', '.json', '.xml',
        '.log', '.js', '.py', '.java', '.cpp', '.c', '.h', '.css', '.html', '.htm'
    ];
    
    if (supportedTypes.includes(fileType)) {
        return true;
    }
    
    if (fileType.startsWith('text/')) {
        return true;
    }
    
    const extension = fileName.toLowerCase().match(/\.[^.]+$/);
    if (extension && supportedExtensions.includes(extension[0])) {
        return true;
    }
    
    return false;
}

module.exports = {
    extractTextFromFileBuffer,
    isFileTypeSupported
};