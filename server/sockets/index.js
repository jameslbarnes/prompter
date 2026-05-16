const socketHandlers = require('./handlers');

function initializeSocketIO(io, dependencies) {
  io.on('connection', (socket) => {
    console.log('New client connected');
    
    // Initialize handlers for this socket
    socketHandlers(socket, io, dependencies);
  });
}

module.exports = initializeSocketIO;