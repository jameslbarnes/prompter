// Simple in-memory rate limiter for socket connections
class SocketRateLimiter {
  constructor() {
    this.clients = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }

  cleanup() {
    const now = Date.now();
    for (const [clientId, data] of this.clients.entries()) {
      // Remove entries older than 5 minutes
      if (now - data.lastReset > 300000) {
        this.clients.delete(clientId);
      }
    }
  }

  checkLimit(clientId, eventName, limit = 10, windowMs = 60000) {
    const now = Date.now();
    const key = `${clientId}:${eventName}`;
    
    if (!this.clients.has(key)) {
      this.clients.set(key, {
        count: 1,
        lastReset: now
      });
      return true; // Allow first request
    }

    const clientData = this.clients.get(key);
    
    // Reset if window has passed
    if (now - clientData.lastReset > windowMs) {
      clientData.count = 1;
      clientData.lastReset = now;
      return true;
    }

    // Check if limit exceeded
    if (clientData.count >= limit) {
      return false; // Rate limit exceeded
    }

    clientData.count++;
    return true;
  }

  reset(clientId) {
    // Remove all entries for this client
    for (const key of this.clients.keys()) {
      if (key.startsWith(`${clientId}:`)) {
        this.clients.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
    this.clients.clear();
  }
}

// Rate limits for different socket events
const socketLimits = {
  processAudio: { limit: 30, windowMs: 60000 }, // 30 per minute
  generateNextQuestion: { limit: 10, windowMs: 60000 }, // 10 per minute
  generateReport: { limit: 3, windowMs: 300000 }, // 3 per 5 minutes
  regenerateReport: { limit: 2, windowMs: 300000 }, // 2 per 5 minutes
  fileUpload: { limit: 10, windowMs: 600000 }, // 10 per 10 minutes
};

module.exports = {
  SocketRateLimiter,
  socketLimits
};