// Simple tests for server-utils.js
// Just verify the functions work as expected

const {
    countWords,
    escapeXml,
    formatTimeForLog,
    levenshteinDistance,
    extractTextFromFileBuffer
} = require('./server-utils');

describe('server-utils', () => {
    describe('countWords', () => {
        test('counts words correctly', () => {
            expect(countWords('hello world')).toBe(2);
            expect(countWords('this is a test')).toBe(4);
            expect(countWords('   multiple   spaces   ')).toBe(2);
        });

        test('handles empty/null input', () => {
            expect(countWords('')).toBe(0);
            expect(countWords(null)).toBe(0);
            expect(countWords(undefined)).toBe(0);
            expect(countWords(123)).toBe(0); // not a string
        });
    });

    describe('escapeXml', () => {
        test('escapes XML characters', () => {
            expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
            expect(escapeXml('&amp;')).toBe('&amp;amp;');
            expect(escapeXml('"quotes"')).toBe('&quot;quotes&quot;');
            expect(escapeXml("'apostrophe'")).toBe('&apos;apostrophe&apos;');
        });

        test('handles non-string input', () => {
            expect(escapeXml(null)).toBe(null);
            expect(escapeXml(123)).toBe(123);
            expect(escapeXml(undefined)).toBe(undefined);
        });

        test('leaves normal text unchanged', () => {
            expect(escapeXml('normal text')).toBe('normal text');
        });
    });

    describe('formatTimeForLog', () => {
        test('formats time correctly', () => {
            expect(formatTimeForLog(0)).toBe('0m 0s');
            expect(formatTimeForLog(45)).toBe('0m 45s');
            expect(formatTimeForLog(60)).toBe('1m 0s');
            expect(formatTimeForLog(125)).toBe('2m 5s');
            expect(formatTimeForLog(3665)).toBe('61m 5s');
        });

        test('handles invalid input', () => {
            expect(formatTimeForLog(null)).toBe('0m 0s');
            expect(formatTimeForLog('not a number')).toBe('0m 0s');
            expect(formatTimeForLog(NaN)).toBe('0m 0s');
        });
    });

    describe('levenshteinDistance', () => {
        test('calculates distance correctly', () => {
            expect(levenshteinDistance('', '')).toBe(0);
            expect(levenshteinDistance('abc', 'abc')).toBe(0);
            expect(levenshteinDistance('abc', 'abcd')).toBe(1);
            expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
        });

        test('handles empty strings', () => {
            expect(levenshteinDistance('', 'abc')).toBe(3);
            expect(levenshteinDistance('abc', '')).toBe(3);
            expect(levenshteinDistance(null, 'abc')).toBe(3);
            expect(levenshteinDistance('abc', null)).toBe(3);
        });
    });

    describe('extractTextFromFileBuffer', () => {
        test('handles text files', async () => {
            const buffer = Buffer.from('Hello world');
            const result = await extractTextFromFileBuffer(buffer, 'text/plain', 'test.txt');
            expect(result).toBe('Hello world');
        });

        test('handles unsupported file types', async () => {
            const buffer = Buffer.from('data');
            const result = await extractTextFromFileBuffer(buffer, 'image/png', 'image.png');
            expect(result).toBe(null);
        });

        // Note: We're not testing PDF/Word extraction as that would require mocking pdf-parse and mammoth
        // Those are tested by their respective libraries
    });
});