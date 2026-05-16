// Wrapper for server.js to prevent it from starting automatically during tests
if (process.env.NODE_ENV === 'test') {
  // Prevent server from starting when required in tests
  const originalListen = process.binding('tcp_wrap').TCP.prototype.listen;
  process.binding('tcp_wrap').TCP.prototype.listen = function() {
    if (process.env.NODE_ENV === 'test') {
      // Don't actually listen during tests
      return 0;
    }
    return originalListen.apply(this, arguments);
  };
}

// Now require the server
const app = require('../server.js');

module.exports = app;