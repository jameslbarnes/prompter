// Context Handler Module
// Handles processing and storage of user-provided context including images

const fetch = require('node-fetch');

/**
 * Process context data from user upload
 * Handles text, images, and other file types
 * @param {Object} sessionInfo - Session information
 * @param {Object} data - Data from startInterview event
 * @returns {Object} Processed context data
 */
async function processUserContext(sessionInfo, data) {
    const context = {
        text: '',
        images: [],
        files: [],
        raw: data.resume || ''
    };
    
    // Add user name and email to context
    const namePrefix = data.userName ? `Name: ${data.userName}\n` : '';
    const emailPrefix = data.userEmail ? `Email: ${data.userEmail}\n` : '';
    const headerContext = namePrefix + emailPrefix + (namePrefix || emailPrefix ? '\n' : '');
    
    // Handle uploaded file
    if (data.uploadedFile) {
        console.log(`[ContextHandler] Processing uploaded file:`, data.uploadedFile);
        
        if (data.uploadedFile.isImage && data.uploadedFile.url) {
            // Fetch and convert image to base64
            try {
                const imageData = await fetchImageAsBase64(data.uploadedFile.url);
                if (imageData) {
                    context.images.push({
                        name: data.uploadedFile.name,
                        mimeType: data.uploadedFile.type,
                        base64: imageData.base64,
                        url: data.uploadedFile.url
                    });
                    console.log(`[ContextHandler] Added image: ${data.uploadedFile.name}`);
                }
            } catch (error) {
                console.error(`[ContextHandler] Error fetching image:`, error);
            }
        } else {
            // Non-image file
            context.files.push({
                name: data.uploadedFile.name,
                type: data.uploadedFile.type,
                url: data.uploadedFile.url,
                size: data.uploadedFile.size
            });
        }
    }
    
    // Set text context
    context.text = headerContext + (data.resume || '');
    
    return context;
}

/**
 * Fetch image from URL and convert to base64
 * @param {string} url - Image URL
 * @returns {Object} Base64 encoded image data
 */
async function fetchImageAsBase64(url) {
    try {
        console.log(`[ContextHandler] Fetching image from: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        
        const buffer = await response.buffer();
        const base64 = buffer.toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/jpeg';
        
        console.log(`[ContextHandler] Image fetched successfully, size: ${buffer.length} bytes`);
        
        return {
            base64,
            mimeType,
            size: buffer.length
        };
    } catch (error) {
        console.error(`[ContextHandler] Error fetching image:`, error);
        return null;
    }
}

/**
 * Build context for Claude API including images
 * @param {Object} contextData - Processed context data
 * @returns {Array} Array of content blocks for Claude
 */
function buildClaudeContext(contextData) {
    const content = [];
    
    // Add text context if available
    if (contextData.text) {
        content.push({
            type: "text",
            text: `User Context:\n${contextData.text}`
        });
    }
    
    // Add images if available
    if (contextData.images && contextData.images.length > 0) {
        contextData.images.forEach((image, index) => {
            content.push({
                type: "image",
                source: {
                    type: "base64",
                    media_type: image.mimeType,
                    data: image.base64
                }
            });
            
            // Add caption for the image
            content.push({
                type: "text",
                text: `[Image ${index + 1}: ${image.name}]`
            });
        });
        
        console.log(`[ContextHandler] Added ${contextData.images.length} images to Claude context`);
    }
    
    return content;
}

/**
 * Prepare context data for storage in Firestore
 * @param {Object} contextData - Processed context data
 * @returns {Object} Context data for Firestore storage
 */
function prepareContextForStorage(contextData) {
    // For Firestore, we don't store the base64 data (too large)
    // Instead, we store references and metadata
    return {
        text: contextData.text,
        images: contextData.images.map(img => ({
            name: img.name,
            mimeType: img.mimeType,
            url: img.url,
            size: img.size || 0
        })),
        files: contextData.files,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    processUserContext,
    fetchImageAsBase64,
    buildClaudeContext,
    prepareContextForStorage
};