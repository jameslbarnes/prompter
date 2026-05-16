// Universal file upload endpoint that stores files in GCS and extracts content
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Helper function to extract text from various file types
async function extractTextFromFile(buffer, mimetype, filename) {
  const lowerFilename = filename.toLowerCase();
  
  // PDF files
  if (mimetype === 'application/pdf' || lowerFilename.endsWith('.pdf')) {
    try {
      const pdfData = await pdfParse(buffer);
      return pdfData.text;
    } catch (error) {
      console.error('PDF extraction error:', error);
      return null;
    }
  }
  
  // Word documents
  if (mimetype.includes('word') || lowerFilename.endsWith('.doc') || lowerFilename.endsWith('.docx')) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      console.error('Word extraction error:', error);
      return null;
    }
  }
  
  // Text-based files
  const textExtensions = ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.css', '.js', '.ts', '.py', '.java', '.c', '.cpp', '.sh'];
  if (mimetype.startsWith('text/') || textExtensions.some(ext => lowerFilename.endsWith(ext))) {
    try {
      return buffer.toString('utf-8');
    } catch (error) {
      console.error('Text extraction error:', error);
      return null;
    }
  }
  
  // Images - no text extraction
  if (mimetype.startsWith('image/')) {
    return null;
  }
  
  // Unknown type
  return null;
}

// Universal upload endpoint
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { storage, GCS_BUCKET_NAME } = req.app.locals;
    const file = req.file;
    const { interviewId } = req.body; // Optional interview ID
    
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    if (!storage || !GCS_BUCKET_NAME) {
      console.error('GCS not configured');
      return res.status(503).json({ error: 'Storage service unavailable' });
    }
    
    console.log(`[Universal Upload] File: ${file.originalname}, Type: ${file.mimetype}, Size: ${file.size}`);
    
    // Generate unique filename and path
    const uniqueFilename = `${uuidv4()}-${file.originalname}`;
    const basePath = interviewId ? `interviews/${interviewId}/files` : 'uploads';
    const filePath = `${basePath}/${uniqueFilename}`;
    
    // Upload to GCS
    const gcsBucket = storage.bucket(GCS_BUCKET_NAME);
    const fileUpload = gcsBucket.file(filePath);
    
    console.log(`[Universal Upload] Uploading to GCS: gs://${GCS_BUCKET_NAME}/${filePath}`);
    
    // Create write stream
    const blobStream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString()
        }
      }
    });
    
    // Handle upload completion
    const uploadPromise = new Promise((resolve, reject) => {
      blobStream.on('error', reject);
      blobStream.on('finish', async () => {
        try {
          // Make file publicly readable if it's an image
          if (file.mimetype.startsWith('image/')) {
            await fileUpload.makePublic();
          }
          
          // Get public URL
          const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${filePath}`;
          
          resolve({
            url: publicUrl,
            path: filePath
          });
        } catch (error) {
          reject(error);
        }
      });
    });
    
    // Start upload
    blobStream.end(file.buffer);
    
    // Wait for upload to complete
    const { url, path } = await uploadPromise;
    
    // Extract text content if applicable
    const extractedText = await extractTextFromFile(file.buffer, file.mimetype, file.originalname);
    
    // Prepare response
    const response = {
      success: true,
      file: {
        name: file.originalname,
        path: path,
        url: url,
        size: file.size,
        type: file.mimetype,
        isImage: file.mimetype.startsWith('image/')
      }
    };
    
    // Add extracted text if available
    if (extractedText) {
      response.extractedText = extractedText;
      response.textLength = extractedText.length;
    }
    
    console.log(`[Universal Upload] Success: ${file.originalname} -> ${url}`);
    res.json(response);
    
  } catch (error) {
    console.error('[Universal Upload] Error:', error);
    res.status(500).json({ 
      error: 'Upload failed', 
      message: error.message 
    });
  }
});

module.exports = router;