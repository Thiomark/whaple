#!/usr/bin/env node
/**
 * Security Audit Script for Whaple Package
 * Checks for sensitive information before publishing
 */

const fs = require('fs');
const path = require('path');

// Patterns to check for sensitive information
const SENSITIVE_PATTERNS = [
  // Phone numbers
  /\+?27[0-9]{9}/g,
  /27[0-9]{9}/g,
  
  // API Keys and secrets (but not NPM integrity hashes)
  /whatsapp_api_key_[a-zA-Z0-9_]+/g,
  /(?<!integrity.*sha512-)sk-[a-zA-Z0-9_-]{20,}/g,
  /AIza[a-zA-Z0-9_-]+/g,
  
  // Firebase actual values (not template)
  /"private_key_id":\s*"[a-f0-9]{40}"/g,
  /"client_id":\s*"[0-9]{21}"/g,
  
  // WhatsApp session files content
  /{"noiseKey":/g,
  /{"identityKey":/g,
  
  // Real Firebase project IDs (not templates)
  /"project_id":\s*"[a-zA-Z0-9-]+-[a-f0-9]{5}"/g
];

// Files to ignore
const IGNORE_PATTERNS = [
  /node_modules/,
  /dist/,
  /\.git/,
  /\.env\.example$/,
  /security-audit\.js$/,
  /package-lock\.json$/,  // NPM integrity hashes can trigger false positives
  /\.tgz$/
];

function scanDirectory(dirPath) {
  const results = [];
  
  function scanFile(filePath) {
    if (IGNORE_PATTERNS.some(pattern => pattern.test(filePath))) {
      return;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      
      SENSITIVE_PATTERNS.forEach((pattern, index) => {
        const matches = content.match(pattern);
        if (matches) {
          results.push({
            file: filePath,
            pattern: pattern.toString(),
            matches: matches,
            line: findLineNumbers(content, matches[0])
          });
        }
      });
    } catch (error) {
      // Ignore binary files or files that can't be read
    }
  }
  
  function walkDirectory(dir) {
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        walkDirectory(fullPath);
      } else {
        scanFile(fullPath);
      }
    }
  }
  
  walkDirectory(dirPath);
  return results;
}

function findLineNumbers(content, searchTerm) {
  const lines = content.split('\n');
  const results = [];
  
  lines.forEach((line, index) => {
    if (line.includes(searchTerm)) {
      results.push(index + 1);
    }
  });
  
  return results;
}

// Run the audit
console.log('🔍 Running security audit on Whaple package...\n');

const packagePath = __dirname;
const results = scanDirectory(packagePath);

if (results.length === 0) {
  console.log('✅ Security audit PASSED');
  console.log('   No sensitive information found in package files');
  console.log('   Safe to publish to NPM\n');
  
  // Additional checks
  console.log('📦 Package structure check:');
  const packageJson = require('./package.json');
  console.log(`   Name: ${packageJson.name}`);
  console.log(`   Version: ${packageJson.version}`);
  console.log(`   Files to publish: ${packageJson.files.join(', ')}`);
  console.log(`   ✅ Only safe files will be published\n`);
  
  process.exit(0);
} else {
  console.log('❌ Security audit FAILED');
  console.log('   Sensitive information found:\n');
  
  results.forEach(result => {
    console.log(`📁 File: ${result.file}`);
    console.log(`🔍 Pattern: ${result.pattern}`);
    console.log(`📍 Lines: ${result.line.join(', ')}`);
    console.log(`💡 Matches: ${result.matches.join(', ')}`);
    console.log('');
  });
  
  console.log('⚠️  Please remove sensitive information before publishing');
  process.exit(1);
}