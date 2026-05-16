// API routes extracted from server.js
// This module contains all REST API endpoints

const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

module.exports = function initializeAPI(app, dependencies) {
    const { 
        db, 
        storage, 
        openai,
        memoryService,
        pricingService,
        sgMail,
        stripe,
        sessionData,
        config,
        // Import utility functions we need
        extractTextFromFileBuffer,
        getResponsesWithSignedUrls,
        logResponseToFirebase,
        createReportEmailTemplate,
        sendReportEmail,
        generateAndStoreReportAudio,
        GCS_BUCKET_NAME
    } = dependencies;

    // Debug endpoints
    app.get('/api/test', (req, res) => {
        res.json({ message: "API endpoint is working" });
    });

    app.get('/status', (req, res) => {
        res.json({ status: 'Server is running' });
    });

    app.post('/api/notify-new-account', async (req, res) => {
        try {
            const { email, uid } = req.body;
            if (!email) {
                return res.status(400).json({ error: 'email is required' });
            }
            if (!sgMail) {
                return res.status(503).json({ error: 'Email service not available' });
            }
            await sgMail.send({
                from: process.env.SENDGRID_FROM_EMAIL || 'contact@example.com',
                to: 'contact@example.com',
                subject: 'New account created',
                text: `Email: ${email}\nUID: ${uid || ''}`
            });
            res.json({ success: true });
        } catch (err) {
            console.error('New account notification error:', err);
            res.status(500).json({ error: 'Failed to send notification' });
        }
    });

    // Claude API proxy endpoint
    app.post('/api/claude', async (req, res) => {
        // This is a complex endpoint - keeping a placeholder for now
        // The actual implementation is around line 3635 in server.js
        res.status(501).json({ error: 'Claude endpoint to be migrated' });
    });

    // File upload endpoint for resume parsing
    app.post('/api/upload-resume', upload.single('resume'), async (req, res) => {
        // Implementation from line 3937 in server.js
        // Keeping placeholder for now
        res.status(501).json({ error: 'Resume upload to be migrated' });
    });

    // Interview endpoints
    app.get('/api/interviews', async (req, res) => {
        // Implementation from line 4027
        res.status(501).json({ error: 'Interviews list to be migrated' });
    });

    app.get('/api/interviews/:id', async (req, res) => {
        // Implementation from line 4051
        req.params.id = req.params.id;
        req.url = `/api/interview/${req.params.id}`;
        app.handle(req, res);
    });

    app.get('/api/interview/:id', async (req, res) => {
        // Implementation from line 4058
        res.status(501).json({ error: 'Interview by ID to be migrated' });
    });

    app.post('/api/interviews/:id/share', async (req, res) => {
        // Implementation from line 4125
        res.status(501).json({ error: 'Interview share to be migrated' });
    });

    app.get('/api/interview/:interviewId/special-report-details', async (req, res) => {
        // Implementation from line 4556
        res.status(501).json({ error: 'Special report details to be migrated' });
    });

    app.post('/api/interviews/:interviewId/upload', upload.single('contextFile'), async (req, res) => {
        // Implementation from line 4677
        res.status(501).json({ error: 'Interview file upload to be migrated' });
    });

    // Response endpoints
    app.get('/api/responses', async (req, res) => {
        // Implementation from line 4190
        res.status(501).json({ error: 'Responses list to be migrated' });
    });

    app.get('/api/responses/:id', async (req, res) => {
        // Implementation from line 4255
        res.status(501).json({ error: 'Response by ID to be migrated' });
    });

    // Report endpoints
    app.get('/api/reports', async (req, res) => {
        // Implementation from line 4296
        res.status(501).json({ error: 'Reports list to be migrated' });
    });

    app.get('/api/reports/:id', async (req, res) => {
        // Implementation from line 4351
        res.status(501).json({ error: 'Report by ID to be migrated' });
    });

    app.get('/api/reports/:reportId', async (req, res) => {
        // Implementation from line 4386
        res.status(501).json({ error: 'Report by reportId to be migrated' });
    });

    app.get('/api/reports/latest', async (req, res) => {
        // Implementation from line 4427
        res.status(501).json({ error: 'Latest report to be migrated' });
    });

    app.get('/api/reports/:reportId/responses', async (req, res) => {
        // Implementation from line 4480
        res.status(501).json({ error: 'Report responses to be migrated' });
    });

    app.get('/api/reports/:reportId/audio-artifact', async (req, res) => {
        // Implementation from line 4772
        res.status(501).json({ error: 'Audio artifact to be migrated' });
    });

    app.post('/api/reports/:reportId/publish-to-gallery', async (req, res) => {
        // Implementation from line 4916
        res.status(501).json({ error: 'Publish to gallery to be migrated' });
    });

    // Gallery endpoints
    app.get('/api/gallery/templates', async (req, res) => {
        // Implementation from line 4998
        res.status(501).json({ error: 'Gallery templates to be migrated' });
    });

    app.get('/api/public-reports/:publicReportId', async (req, res) => {
        // Implementation from line 5038
        res.status(501).json({ error: 'Public reports to be migrated' });
    });

    app.get('/api/gallery/reports/:templateId', async (req, res) => {
        // Implementation from line 5088
        res.status(501).json({ error: 'Gallery reports to be migrated' });
    });

    // File management
    app.delete('/api/files', async (req, res) => {
        // Implementation from line 4734
        res.status(501).json({ error: 'File deletion to be migrated' });
    });

    // Memory endpoints
    app.get('/api/memories', async (req, res) => {
        // Implementation around line 7214
        res.status(501).json({ error: 'Memories to be migrated' });
    });

    app.delete('/api/memories', async (req, res) => {
        // Implementation around line 7214
        res.status(501).json({ error: 'Delete memories to be migrated' });
    });

    app.post('/api/memories/contextual', async (req, res) => {
        // Implementation exists in server.js
        res.status(501).json({ error: 'Contextual memories to be migrated' });
    });

    // Pricing/Stripe endpoints
    app.post('/api/webhooks/stripe', express.raw({type: 'application/json'}), async (req, res) => {
        // Stripe webhook handler
        res.status(501).json({ error: 'Stripe webhook to be migrated' });
    });

    app.get('/api/pricing-plans', (req, res) => {
        if (!pricingService) {
            return res.status(503).json({ error: 'Pricing service not available' });
        }

        const plans = pricingService.getPricingPlans();
        const freeTrialLimit = pricingService.getFreeTrialLimit();

        res.json({
            plans,
            freeTrialLimit
        });
    });

    app.post('/api/subscription/checkout', async (req, res) => {
        // Checkout session creation
        res.status(501).json({ error: 'Checkout to be migrated' });
    });

    app.get('/api/subscription', async (req, res) => {
        // Get user subscription
        res.status(501).json({ error: 'Subscription to be migrated' });
    });

    // Audio endpoints
    app.get('/api/audio-clip/:responseId', async (req, res) => {
        // Audio clip endpoint
        res.status(501).json({ error: 'Audio clip to be migrated' });
    });

    app.post('/api/create-audio-summary', async (req, res) => {
        // Create audio summary
        res.status(501).json({ error: 'Audio summary to be migrated' });
    });

    app.get('/api/syntheses/:synthesisId/audio-artifact', async (req, res) => {
        // Synthesis audio
        res.status(501).json({ error: 'Synthesis audio to be migrated' });
    });

    // Admin endpoints
    app.get('/api/admin/my-sessions', async (req, res) => {
        // Admin sessions
        res.status(501).json({ error: 'Admin sessions to be migrated' });
    });

    // Torus configuration
    app.get('/api/torus-configs', async (req, res) => {
        // Get torus configs
        res.status(501).json({ error: 'Torus configs to be migrated' });
    });

    app.post('/api/torus-configs', async (req, res) => {
        // Save torus config
        res.status(501).json({ error: 'Save torus config to be migrated' });
    });

    app.delete('/api/torus-configs/:configId', async (req, res) => {
        // Implementation from line 7403
        res.status(501).json({ error: 'Delete torus config to be migrated' });
    });

    // Shape configuration
    app.get('/api/shape-config/:mode', async (req, res) => {
        // Shape config endpoint
        res.status(501).json({ error: 'Shape config to be migrated' });
    });

    // Test endpoints (dev only)
    app.post('/api/test/increment-usage', async (req, res) => {
        // Test increment usage
        res.status(501).json({ error: 'Test increment to be migrated' });
    });

    app.post('/api/test/reset-usage', async (req, res) => {
        // Test reset usage
        res.status(501).json({ error: 'Test reset to be migrated' });
    });

    // Report regeneration endpoints
    app.post('/api/reports/:reportId/regenerate-user-report', async (req, res) => {
        // Regenerate user report
        res.status(501).json({ error: 'Regenerate user report to be migrated' });
    });

    app.post('/api/reports/:reportId/regenerate-admin-summary', async (req, res) => {
        // Regenerate admin summary
        res.status(501).json({ error: 'Regenerate admin summary to be migrated' });
    });
};