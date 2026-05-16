#!/usr/bin/env node

/**
 * Simple Test Runner
 * 
 * Usage:
 *   node tests/run-tests.js                    # Run all tests against server.js
 *   node tests/run-tests.js staging            # Run all tests against server_staging.js
 *   node tests/run-tests.js basic              # Run only basic endpoint tests
 *   node tests/run-tests.js staging basic      # Run basic tests against staging
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const serverFile = process.argv.includes('staging') ? 'server_staging.js' : 'server.js';
const testPattern = process.argv[3] || process.argv[2];

// Update test factory to use the correct server file
const testFactoryPath = path.join(__dirname, 'test-factory.js');
const testFactoryContent = fs.readFileSync(testFactoryPath, 'utf8');
const originalContent = testFactoryContent;

try {
  // Update the server path in test factory
  const updatedContent = testFactoryContent.replace(
    /createTestApp\(serverPath = '.*?'\)/,
    `createTestApp(serverPath = '../${serverFile}')`
  );
  fs.writeFileSync(testFactoryPath, updatedContent);

  console.log(`\nRunning tests against ${serverFile}...\n`);

  // Build test command
  let testCommand = 'npm test';
  
  if (testPattern && !['staging', 'server.js', 'server_staging.js'].includes(testPattern)) {
    testCommand += ` -- --testNamePattern="${testPattern}"`;
  }

  // Run tests
  execSync(testCommand, {
    stdio: 'inherit'
  });

} catch (error) {
  console.error('\nTests failed or were interrupted');
  process.exit(1);
} finally {
  // Restore original test factory
  fs.writeFileSync(testFactoryPath, originalContent);
}