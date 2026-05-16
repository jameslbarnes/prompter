const admin = require('firebase-admin');

// Middleware to check if user is authenticated
const requireAuth = async (req, res, next) => {
  try {
    // Check session first
    if (req.session?.userId) {
      req.user = {
        uid: req.session.userId,
        email: req.session.email
      };
      return next();
    }

    // Check Authorization header for Firebase token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email
    };
    
    // Store in session for subsequent requests
    req.session.userId = decodedToken.uid;
    req.session.email = decodedToken.email;
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
};

// Middleware to optionally check authentication (doesn't fail if not authenticated)
const optionalAuth = async (req, res, next) => {
  try {
    // Check session first
    if (req.session?.userId) {
      req.user = {
        uid: req.session.userId,
        email: req.session.email
      };
      return next();
    }

    // Check Authorization header for Firebase token
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email
      };
      
      // Store in session for subsequent requests
      req.session.userId = decodedToken.uid;
      req.session.email = decodedToken.email;
    }
    
    next();
  } catch (error) {
    // Don't fail on auth errors for optional auth
    console.warn('Optional auth check failed:', error.message);
    next();
  }
};

module.exports = {
  requireAuth,
  optionalAuth,
  verifyFirebaseAuth: requireAuth // Alias for consistency with Gmail routes
};