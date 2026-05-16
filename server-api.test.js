// Simple tests for server-api.js
// Just verify routes are registered and respond

const express = require('express');
const request = require('supertest');

// Mock dependencies
const mockDependencies = {
    db: null,
    storage: null,
    openai: null,
    memoryService: null,
    pricingService: null,
    sgMail: null,
    stripe: null,
    sessionData: new Map(),
    config: {},
    extractTextFromFileBuffer: jest.fn(),
    getResponsesWithSignedUrls: jest.fn(),
    logResponseToFirebase: jest.fn(),
    createReportEmailTemplate: jest.fn(),
    sendReportEmail: jest.fn(),
    generateAndStoreReportAudio: jest.fn(),
    GCS_BUCKET_NAME: 'test-bucket'
};

// Create test app
const app = express();
app.use(express.json());

// Initialize API routes
const initializeAPI = require('./server-api');
initializeAPI(app, mockDependencies);

describe('server-api routes', () => {
    test('GET /api/test returns success', async () => {
        const res = await request(app).get('/api/test');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('API endpoint is working');
    });

    test('GET /status returns server status', async () => {
        const res = await request(app).get('/status');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('Server is running');
    });

    // Test that routes are registered (they'll return 501 for now)
    const routesToTest = [
        { method: 'post', path: '/api/claude' },
        { method: 'post', path: '/api/upload-resume' },
        { method: 'get', path: '/api/interviews' },
        { method: 'get', path: '/api/interviews/123' },
        { method: 'get', path: '/api/interview/123' },
        { method: 'post', path: '/api/interviews/123/share' },
        { method: 'get', path: '/api/responses' },
        { method: 'get', path: '/api/reports' },
        { method: 'get', path: '/api/gallery/templates' },
        { method: 'delete', path: '/api/files' },
        { method: 'get', path: '/api/memories' },
        { method: 'delete', path: '/api/torus-configs/123' }
    ];

    routesToTest.forEach(({ method, path }) => {
        test(`${method.toUpperCase()} ${path} is registered`, async () => {
            const res = await request(app)[method](path);
            // Should return 501 (not implemented) not 404 (not found)
            expect(res.status).toBe(501);
        });
    });
});