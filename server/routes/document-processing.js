// Document Processing Module
// Handles text extraction from files and website scraping

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { scrapeWebsite } = require('./webscraper');

/**
 * Extract text from a file buffer
 * This function should be imported from the main server file or a utility module
 * For now, we'll require it to be passed in during initialization
 */
let extractTextFromFileBuffer;

/**
 * Initialize the module with dependencies
 * @param {Function} textExtractor - The text extraction function from server.js
 */
function initialize(textExtractor) {
    extractTextFromFileBuffer = textExtractor;
}

/**
 * Handle text extraction from uploaded files
 */
async function handleTextExtraction(req, res) {
    console.log('[/api/extract-text] Request received');
    
    if (!req.file) {
        console.log('[/api/extract-text] No file provided');
        return res.status(400).json({ message: 'No file provided' });
    }

    const file = req.file;
    console.log('[/api/extract-text] Processing file:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
    });

    try {
        // Extract text using the existing helper function
        const extractedText = await extractTextFromFileBuffer(
            file.buffer,
            file.mimetype,
            file.originalname
        );

        if (!extractedText) {
            console.log('[/api/extract-text] No text extracted from file');
            return res.status(422).json({ 
                message: 'Could not extract text from file',
                fileType: file.mimetype
            });
        }

        console.log('[/api/extract-text] Text extraction successful:', {
            fileName: file.originalname,
            textLength: extractedText.length,
            preview: extractedText.substring(0, 200) + '...'
        });

        // Return the extracted text
        res.json({
            text: extractedText,
            fileName: file.originalname,
            fileType: file.mimetype,
            textLength: extractedText.length
        });

    } catch (error) {
        console.error('[/api/extract-text] Error extracting text:', error);
        res.status(500).json({ 
            message: 'Failed to extract text from file',
            error: error.message 
        });
    }
}

/**
 * Handle website scraping requests
 */
async function handleWebsiteScrape(req, res) {
    try {
        const { url, depth = 1 } = req.body;
        
        // Validate input
        if (!url) {
            return res.status(400).json({ 
                error: 'URL is required',
                message: 'Please provide a URL to scrape' 
            });
        }
        
        // Validate depth
        const depthNum = parseInt(depth);
        if (isNaN(depthNum) || depthNum < 0 || depthNum > 2) {
            return res.status(400).json({ 
                error: 'Invalid depth',
                message: 'Depth must be between 0 and 2' 
            });
        }
        
        // Log the request
        console.log(`[WebScraper] Request from user ${req.userId || 'anonymous'} to scrape: ${url}`);
        
        // Perform the scraping
        const result = await scrapeWebsite(url, depthNum);
        
        // Return the scraped content
        res.json({
            success: true,
            content: result.content,
            metadata: result.metadata
        });
        
    } catch (error) {
        console.error('[WebScraper] Route handler error:', error);
        
        // Send appropriate error response
        const statusCode = error.message.includes('Rate limit') ? 429 : 500;
        res.status(statusCode).json({
            error: 'Scraping failed',
            message: error.message || 'An unexpected error occurred while scraping the website'
        });
    }
}

/**
 * Register routes on the Express app
 * @param {Express} app - The Express application
 */
function registerRoutes(app) {
    // Text extraction endpoint
    app.post('/api/extract-text', upload.single('file'), handleTextExtraction);
    
    // Website scraping endpoint
    app.post('/api/scrape-website', handleWebsiteScrape);
    
    console.log('[DocumentProcessing] Routes registered: /api/extract-text, /api/scrape-website');
}

module.exports = {
    initialize,
    registerRoutes,
    handleTextExtraction,
    handleWebsiteScrape
};