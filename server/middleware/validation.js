const { body, query, param, validationResult } = require('express-validator');

// Helper to check validation results
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

// Common validators
const validators = {
  // ID validators
  reportId: param('reportId')
    .isString()
    .trim()
    .notEmpty().withMessage('Report ID is required')
    .isLength({ min: 20, max: 50 }).withMessage('Invalid report ID format')
    .matches(/^[a-zA-Z0-9-_]+$/).withMessage('Report ID contains invalid characters'),
  
  interviewId: param('interviewId')
    .isString()
    .trim()
    .notEmpty().withMessage('Interview ID is required')
    .isLength({ min: 20, max: 50 }).withMessage('Invalid interview ID format')
    .matches(/^[a-zA-Z0-9-_]+$/).withMessage('Interview ID contains invalid characters'),
  
  // Query validators
  sessionId: query('session_id')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 10, max: 100 }).withMessage('Invalid session ID format'),
  
  limit: query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  
  // File upload validators
  validateFileUpload: (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Check file size (10MB max)
    if (req.file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB' });
    }
    
    // Check file type
    const allowedTypes = ['application/pdf', 'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain']; // Allow text files for extracted content
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed' 
      });
    }
    
    next();
  },
  
  // Interview data validators
  interviewData: [
    body('title')
      .isString()
      .trim()
      .notEmpty().withMessage('Title is required')
      .isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters')
      .escape(), // Prevent XSS
    
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 }).withMessage('Description too long')
      .escape(),
    
    body('initialPrompt')
      .optional()
      .isString()
      .isLength({ max: 10000 }).withMessage('Initial prompt too long'),
    
    body('followupPrompt')
      .optional()
      .isString()
      .isLength({ max: 10000 }).withMessage('Followup prompt too long'),
    
    body('enableWebSearch')
      .optional()
      .isBoolean().withMessage('enableWebSearch must be boolean'),
    
    body('enableThinking')
      .optional()
      .isBoolean().withMessage('enableThinking must be boolean'),
    
    body('enableMemoryService')
      .optional()
      .isBoolean().withMessage('enableMemoryService must be boolean'),
    
    body('allowPublicGallery')
      .optional()
      .isBoolean().withMessage('allowPublicGallery must be boolean'),
    
    body('sharedWith')
      .optional()
      .isArray().withMessage('sharedWith must be an array')
      .custom((emails) => {
        // Validate each email in the array
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emails.every(email => emailRegex.test(email));
      }).withMessage('Invalid email in sharedWith array')
  ],
  
  // Audio data validators
  audioData: [
    body('audioData')
      .notEmpty().withMessage('Audio data is required')
      .custom((value) => {
        // Check if it's base64 or binary data
        if (typeof value === 'string' && value.length > 50000000) { // 50MB base64
          throw new Error('Audio data too large');
        }
        return true;
      }),
    
    body('mimeType')
      .optional()
      .isString()
      .isIn(['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav'])
      .withMessage('Invalid audio format')
  ],
  
  // Text response validators
  textResponse: [
    body('response')
      .isString()
      .trim()
      .notEmpty().withMessage('Response text is required')
      .isLength({ min: 1, max: 50000 }).withMessage('Response too long'),
    
    body('question')
      .optional()
      .isString()
      .isLength({ max: 5000 }).withMessage('Question too long')
  ],
  
  // Email validators
  shareEmail: [
    body('email')
      .isEmail().withMessage('Valid email required')
      .normalizeEmail(),
    
    body('name')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 }).withMessage('Name too long')
      .escape()
  ],
  
  // Sanitize HTML content
  sanitizeHtml: (req, res, next) => {
    // List of fields that might contain HTML
    const htmlFields = ['reportContent', 'report_content', 'admin_report_content'];
    
    htmlFields.forEach(field => {
      if (req.body[field]) {
        // Basic HTML sanitization - in production, use a library like DOMPurify
        req.body[field] = req.body[field]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/on\w+\s*=\s*["'][^"']*["']/gi, ''); // Remove event handlers
      }
    });
    
    next();
  }
};

module.exports = {
  validators,
  handleValidationErrors
};