// Website Scraping Module
// Handles website content extraction using the Exa API

const { Exa } = require('exa-js');
const fetch = require('node-fetch');
const { extractTextFromFileBuffer } = require('../utils/text-extraction');

// Initialize Exa client only when a key is explicitly configured.
const EXA_API_KEY = process.env.EXA_API_KEY;
const exa = EXA_API_KEY ? new Exa(EXA_API_KEY) : null;

/**
 * Scrape website content using Exa API
 * @param {string} url - The URL to scrape
 * @param {number} depth - Number of subpage levels to include (0-2)
 * @returns {Promise<Object>} - Object containing scraped content
 */
async function scrapeWebsite(url, depth = 1) {
    try {
        if (!exa) {
            throw new Error('EXA_API_KEY is required for website scraping');
        }

        console.log(`[WebScraper] Starting scrape for URL: ${url} with depth: ${depth}`);
        
        // Validate URL format
        const urlObj = new URL(url);
        if (!urlObj.protocol.startsWith('http')) {
            throw new Error('URL must use HTTP or HTTPS protocol');
        }
        
        // Check if this is an arXiv link or other PDF that should be downloaded directly
        const isArxivLink = urlObj.hostname.includes('arxiv.org');
        let finalUrl = url;
        
        if (isArxivLink) {
            // Convert arXiv URLs to PDF format if they match the pattern
            const arxivMatch = url.match(/arxiv\.org\/(?:abs|pdf)\/(\d+\.\d+)/);
            if (arxivMatch) {
                finalUrl = `https://arxiv.org/pdf/${arxivMatch[1]}`;
                console.log(`[WebScraper] Converted arXiv link to PDF: ${finalUrl}`);
            }
        }
        
        // Check if URL points to a PDF or document
        const isPdf = finalUrl.toLowerCase().includes('.pdf') || finalUrl.includes('arxiv.org/pdf/');
        const isDoc = /\.(pdf|doc|docx|txt)$/i.test(urlObj.pathname);
        
        if (isPdf || isDoc) {
            // Handle document files directly
            console.log(`[WebScraper] Detected document URL, downloading directly: ${finalUrl}`);
            
            try {
                // Download the file
                const fileResponse = await fetch(finalUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; Prompter Web Scraper/1.0)'
                    }
                });
                
                if (!fileResponse.ok) {
                    throw new Error(`Failed to download document: ${fileResponse.status} ${fileResponse.statusText}`);
                }
                
                const buffer = await fileResponse.buffer();
                const mimeType = fileResponse.headers.get('content-type') || 'application/pdf';
                const fileName = urlObj.pathname.split('/').pop() || 'document.pdf';
                
                // Extract text from the document
                const extractedText = await extractTextFromFileBuffer(buffer, mimeType, fileName);
                
                if (!extractedText) {
                    throw new Error('Failed to extract text from document');
                }
                
                console.log(`[WebScraper] Successfully extracted ${extractedText.length} characters from document`);
                
                // Format the response to match Exa's format
                const metadata = {
                    url: url,
                    title: fileName.replace(/\.(pdf|doc|docx|txt)$/i, ''),
                    summary: `Document extracted from ${finalUrl}`,
                    scrapedAt: new Date().toISOString(),
                    pageCount: 1,
                    documentType: mimeType
                };
                
                const formattedContent = `Document Content Extraction
========================
URL: ${metadata.url}
File: ${fileName}
Type: ${metadata.documentType}
Extracted: ${metadata.scrapedAt}

Content:
${extractedText}`;
                
                return {
                    content: formattedContent,
                    metadata: metadata
                };
                
            } catch (docError) {
                console.error('[WebScraper] Error downloading/extracting document:', docError);
                // Fall back to Exa API if document extraction fails
                console.log('[WebScraper] Falling back to Exa API for scraping');
            }
        }
        
        // Call Exa API with the specified parameters
        const result = await exa.getContents(
            [url],
            {
                text: true,
                summary: true,
                subpages: depth,
                context: true,
                livecrawl: "preferred"
            }
        );
        
        console.log(`[WebScraper] Exa API response received`);
        
        // Extract the content from the response
        if (!result || !result.results || result.results.length === 0) {
            throw new Error('No content found for the provided URL');
        }
        
        // Combine content from all pages
        let combinedContent = '';
        let metadata = {
            url: url,
            title: '',
            summary: '',
            scrapedAt: new Date().toISOString(),
            pageCount: result.results.length
        };
        
        // Process each result
        result.results.forEach((page, index) => {
            if (index === 0) {
                // Use first page for main metadata
                metadata.title = page.title || 'Untitled';
                metadata.summary = page.summary || '';
            }
            
            // Add page content with separator
            combinedContent += `\n\n--- Page ${index + 1}: ${page.url} ---\n\n`;
            if (page.title) {
                combinedContent += `Title: ${page.title}\n\n`;
            }
            if (page.text) {
                combinedContent += page.text;
            }
        });
        
        // Format the final content
        const formattedContent = `Website Scrape Report
========================
URL: ${metadata.url}
Title: ${metadata.title}
Scraped: ${metadata.scrapedAt}
Pages: ${metadata.pageCount}

Summary:
${metadata.summary}

Content:
${combinedContent}`;
        
        console.log(`[WebScraper] Successfully scraped ${metadata.pageCount} pages, total content length: ${formattedContent.length}`);
        
        return {
            content: formattedContent,
            metadata: metadata
        };
        
    } catch (error) {
        console.error('[WebScraper] Error during scraping:', error);
        
        // Provide more specific error messages
        if (error.message.includes('rate limit')) {
            throw new Error('Rate limit exceeded. Please try again later.');
        } else if (error.message.includes('timeout')) {
            throw new Error('Website took too long to respond. Please try again.');
        } else if (error.message.includes('unauthorized')) {
            throw new Error('Invalid API key. Please check your Exa API configuration.');
        }
        
        throw error;
    }
}

/**
 * Express route handler for website scraping
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

// Export the module functions
module.exports = {
    scrapeWebsite,
    handleWebsiteScrape
};
