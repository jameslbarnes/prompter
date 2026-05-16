/**
 * Test template for utility functions
 * Copy this template when creating tests for utility modules
 */

const { 
  countWords, 
  escapeXml, 
  formatTimeForLog,
  levenshteinDistance 
} = require('../../utils');

describe('Utility Functions', () => {
  
  describe('countWords', () => {
    test('should count words in normal text', () => {
      expect(countWords('Hello world')).toBe(2);
      expect(countWords('This is a test')).toBe(4);
    });

    test('should handle empty or null input', () => {
      expect(countWords('')).toBe(0);
      expect(countWords(null)).toBe(0);
      expect(countWords(undefined)).toBe(0);
    });

    test('should handle multiple spaces', () => {
      expect(countWords('Hello    world')).toBe(2);
      expect(countWords('  Hello world  ')).toBe(2);
    });

    test('should handle special characters', () => {
      expect(countWords('Hello, world!')).toBe(2);
      expect(countWords('Test-driven development')).toBe(2);
    });
  });

  describe('escapeXml', () => {
    test('should escape XML special characters', () => {
      expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
      expect(escapeXml('&amp;')).toBe('&amp;amp;');
      expect(escapeXml('"quotes"')).toBe('&quot;quotes&quot;');
      expect(escapeXml("'apostrophe'")).toBe('&apos;apostrophe&apos;');
    });

    test('should handle text without special characters', () => {
      expect(escapeXml('Normal text')).toBe('Normal text');
    });

    test('should handle empty string', () => {
      expect(escapeXml('')).toBe('');
    });
  });

  describe('formatTimeForLog', () => {
    test('should format seconds correctly', () => {
      expect(formatTimeForLog(45)).toBe('45s');
      expect(formatTimeForLog(0)).toBe('0s');
    });

    test('should format minutes correctly', () => {
      expect(formatTimeForLog(60)).toBe('1m');
      expect(formatTimeForLog(125)).toBe('2m 5s');
    });

    test('should format hours correctly', () => {
      expect(formatTimeForLog(3600)).toBe('1h');
      expect(formatTimeForLog(3665)).toBe('1h 1m 5s');
      expect(formatTimeForLog(7325)).toBe('2h 2m 5s');
    });

    test('should handle null or invalid input', () => {
      expect(formatTimeForLog(null)).toBe('0s');
      expect(formatTimeForLog(undefined)).toBe('0s');
      expect(formatTimeForLog(NaN)).toBe('0s');
    });
  });

  describe('levenshteinDistance', () => {
    test('should calculate distance between similar strings', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinDistance('saturday', 'sunday')).toBe(3);
    });

    test('should handle identical strings', () => {
      expect(levenshteinDistance('test', 'test')).toBe(0);
    });

    test('should handle empty strings', () => {
      expect(levenshteinDistance('', '')).toBe(0);
      expect(levenshteinDistance('test', '')).toBe(4);
      expect(levenshteinDistance('', 'test')).toBe(4);
    });

    test('should be case sensitive', () => {
      expect(levenshteinDistance('Test', 'test')).toBe(1);
    });
  });
});