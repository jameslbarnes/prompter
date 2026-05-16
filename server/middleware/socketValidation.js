// Socket.io event validation

const validateSocketData = (schema) => {
  return (data) => {
    const errors = [];
    
    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!data || data[field] === undefined || data[field] === null) {
          errors.push(`${field} is required`);
        }
      }
    }
    
    // Type validation
    if (data && schema.types) {
      for (const [field, type] of Object.entries(schema.types)) {
        if (data[field] !== undefined && typeof data[field] !== type) {
          errors.push(`${field} must be of type ${type}`);
        }
      }
    }
    
    // Length validation
    if (data && schema.maxLength) {
      for (const [field, maxLen] of Object.entries(schema.maxLength)) {
        if (data[field] && data[field].length > maxLen) {
          errors.push(`${field} exceeds maximum length of ${maxLen}`);
        }
      }
    }
    
    // Custom validation
    if (data && schema.custom) {
      for (const [field, validator] of Object.entries(schema.custom)) {
        if (data[field] !== undefined && !validator(data[field])) {
          errors.push(`${field} is invalid`);
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };
};

// Socket event schemas
const socketSchemas = {
  startInterview: {
    required: ['interviewId'],
    types: {
      interviewId: 'string',
      contextData: 'string',
      customPrompt: 'string',
      firstName: 'string'
    },
    maxLength: {
      contextData: 100000, // 100KB max for context
      customPrompt: 10000,
      firstName: 100
    }
  },
  
  processAudio: {
    types: {
      audioData: 'string',
      question: 'string',
      thinkingTrace: 'string'
    },
    maxLength: {
      audioData: 100000000, // 100MB base64
      question: 5000,
      thinkingTrace: 50000
    }
  },
  
  textResponse: {
    required: ['response'],
    types: {
      response: 'string',
      question: 'string'
    },
    maxLength: {
      response: 50000,
      question: 5000
    }
  },
  
  generateReport: {
    types: {
      sessionId: 'string'
    }
  },
  
  regenerateReportWithStreaming: {
    required: ['reportId'],
    types: {
      reportId: 'string',
      interviewId: 'string'
    },
    custom: {
      reportId: (id) => /^[a-zA-Z0-9-_]{20,50}$/.test(id)
    }
  }
};

// Helper to validate and sanitize socket data
const validateAndSanitizeSocketEvent = (eventName, data, socket) => {
  const schema = socketSchemas[eventName];
  if (!schema) {
    return { isValid: true, data }; // No schema defined, allow
  }
  
  const validation = validateSocketData(schema)(data);
  if (!validation.isValid) {
    socket.emit('error', `Validation error: ${validation.errors.join(', ')}`);
    return { isValid: false };
  }
  
  // Basic sanitization
  const sanitized = {};
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // Remove any script tags or event handlers
        sanitized[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
      } else {
        sanitized[key] = value;
      }
    }
  }
  
  return { isValid: true, data: sanitized };
};

module.exports = {
  validateSocketData,
  validateAndSanitizeSocketEvent,
  socketSchemas
};