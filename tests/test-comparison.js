#!/usr/bin/env node

/**
 * Test Comparison Script
 * 
 * This script runs the test suite against both server.js and server_staging.js
 * and compares the results to help identify what needs to be fixed in the refactored version.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runTests(serverFile) {
  log(`\n${'='.repeat(50)}`, colors.bright);
  log(`Testing ${serverFile}`, colors.cyan);
  log(`${'='.repeat(50)}\n`, colors.bright);

  // Update test factory to use the correct server file
  const testFactoryPath = path.join(__dirname, 'test-factory.js');
  const testFactoryContent = fs.readFileSync(testFactoryPath, 'utf8');
  const updatedContent = testFactoryContent.replace(
    /createTestApp\(serverPath = '.*?'\)/,
    `createTestApp(serverPath = '../${serverFile}')`
  );
  fs.writeFileSync(testFactoryPath, updatedContent);

  try {
    // Run tests with JSON output for parsing
    const output = execSync('npm test -- --json --outputFile=test-results.json', {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    // Read and parse results
    const results = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
    
    // Clean up
    fs.unlinkSync('test-results.json');
    
    return results;
  } catch (error) {
    // Tests failed, but we still want to parse the results
    if (fs.existsSync('test-results.json')) {
      const results = JSON.parse(fs.readFileSync('test-results.json', 'utf8'));
      fs.unlinkSync('test-results.json');
      return results;
    }
    
    log(`Error running tests: ${error.message}`, colors.red);
    return null;
  } finally {
    // Restore original test factory
    fs.writeFileSync(testFactoryPath, testFactoryContent);
  }
}

function compareResults(originalResults, refactoredResults) {
  log(`\n${'='.repeat(50)}`, colors.bright);
  log(`TEST COMPARISON SUMMARY`, colors.magenta);
  log(`${'='.repeat(50)}\n`, colors.bright);

  if (!originalResults || !refactoredResults) {
    log('Unable to compare results - one or both test runs failed', colors.red);
    return;
  }

  // Extract test results
  const originalTests = originalResults.testResults || [];
  const refactoredTests = refactoredResults.testResults || [];

  // Summary statistics
  const originalStats = {
    passed: originalResults.numPassedTests || 0,
    failed: originalResults.numFailedTests || 0,
    total: originalResults.numTotalTests || 0
  };

  const refactoredStats = {
    passed: refactoredResults.numPassedTests || 0,
    failed: refactoredResults.numFailedTests || 0,
    total: refactoredResults.numTotalTests || 0
  };

  log(`Original server.js:`, colors.yellow);
  log(`  Passed: ${originalStats.passed}/${originalStats.total}`, 
    originalStats.passed === originalStats.total ? colors.green : colors.yellow);
  log(`  Failed: ${originalStats.failed}`, 
    originalStats.failed > 0 ? colors.red : colors.green);

  log(`\nRefactored server_staging.js:`, colors.yellow);
  log(`  Passed: ${refactoredStats.passed}/${refactoredStats.total}`, 
    refactoredStats.passed === refactoredStats.total ? colors.green : colors.yellow);
  log(`  Failed: ${refactoredStats.failed}`, 
    refactoredStats.failed > 0 ? colors.red : colors.green);

  // Find tests that pass in original but fail in refactored
  log(`\n${'='.repeat(50)}`, colors.bright);
  log(`REGRESSION ANALYSIS`, colors.red);
  log(`${'='.repeat(50)}\n`, colors.bright);

  const regressions = [];
  
  // Create a map of test results for easier comparison
  const originalTestMap = new Map();
  const refactoredTestMap = new Map();

  originalTests.forEach(testFile => {
    testFile.assertionResults?.forEach(test => {
      originalTestMap.set(test.fullName, test);
    });
  });

  refactoredTests.forEach(testFile => {
    testFile.assertionResults?.forEach(test => {
      refactoredTestMap.set(test.fullName, test);
    });
  });

  // Find regressions
  originalTestMap.forEach((originalTest, testName) => {
    const refactoredTest = refactoredTestMap.get(testName);
    
    if (originalTest.status === 'passed' && refactoredTest?.status === 'failed') {
      regressions.push({
        name: testName,
        error: refactoredTest.failureMessages?.[0] || 'Unknown error'
      });
    }
  });

  if (regressions.length === 0) {
    log('No regressions found! ✅', colors.green);
  } else {
    log(`Found ${regressions.length} regressions:`, colors.red);
    regressions.forEach((regression, index) => {
      log(`\n${index + 1}. ${regression.name}`, colors.yellow);
      log(`   Error: ${regression.error.split('\n')[0]}`, colors.red);
    });
  }

  // Generate fix recommendations
  log(`\n${'='.repeat(50)}`, colors.bright);
  log(`RECOMMENDATIONS`, colors.blue);
  log(`${'='.repeat(50)}\n`, colors.bright);

  if (regressions.length > 0) {
    log('1. Check that all routes are properly imported in server_staging.js', colors.cyan);
    log('2. Verify middleware is applied in the correct order', colors.cyan);
    log('3. Ensure all services are properly initialized', colors.cyan);
    log('4. Check that environment variables are loaded correctly', colors.cyan);
    log('5. Verify socket.io handlers are properly registered', colors.cyan);
  } else if (refactoredStats.failed > 0) {
    log('Some tests are failing in both versions. Focus on:', colors.cyan);
    log('1. Fixing shared test failures first', colors.cyan);
    log('2. Ensuring test mocks are properly configured', colors.cyan);
  } else {
    log('All tests are passing! The refactoring appears successful. 🎉', colors.green);
  }
}

// Main execution
async function main() {
  log('Starting test comparison...', colors.bright);
  
  // First install dependencies if needed
  log('\nInstalling test dependencies...', colors.blue);
  try {
    execSync('npm install --save-dev jest supertest @types/jest socket.io-client', {
      stdio: 'inherit'
    });
  } catch (error) {
    log('Failed to install dependencies', colors.red);
    process.exit(1);
  }

  // Run tests on both servers
  const originalResults = runTests('server.js');
  const refactoredResults = runTests('server_staging.js');

  // Compare results
  compareResults(originalResults, refactoredResults);
}

// Run the comparison
main().catch(error => {
  log(`\nUnexpected error: ${error.message}`, colors.red);
  process.exit(1);
});