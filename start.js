#!/usr/bin/env node

// Startup wrapper with better error handling
console.log('=== STARTUP WRAPPER ===');
console.log('Starting server with enhanced error logging...');

process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

try {
  require('./server.js');
} catch (error) {
  console.error('FAILED TO START SERVER:', error);
  console.error('Error type:', error.constructor.name);
  console.error('Error message:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}