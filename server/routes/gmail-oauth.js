// Gmail OAuth Routes
// Handles Gmail OAuth flow and email sending

const express = require('express');
const { google } = require('googleapis');
const router = express.Router();

// Check if Gmail OAuth is configured
if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
    console.warn('Gmail OAuth not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables.');
}

// Determine redirect URI based on environment
const getRedirectUri = (req) => {
    // If request is coming from localhost, use localhost redirect
    if (req && req.get('host') && req.get('host').includes('localhost')) {
        return `http://localhost:3001/api/gmail/callback`;
    }
    // Otherwise use BASE_URL
    return `${process.env.BASE_URL || 'http://localhost:3001'}/api/gmail/callback`;
};

// OAuth2 client configuration - initial setup with default
const defaultRedirectUri = `${process.env.BASE_URL || 'http://localhost:3001'}/api/gmail/callback`;
const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    defaultRedirectUri
);

// Scopes needed for Gmail API
const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/userinfo.email'
];

// Middleware to verify Firebase auth
const { requireAuth: verifyAuth } = require('../middleware/auth');

// Start OAuth flow
router.get('/auth', (req, res) => {
    try {
        // Check if Gmail OAuth is configured
        if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET) {
            return res.status(500).send(`
                <html>
                <head><title>Gmail OAuth Not Configured</title></head>
                <body style="font-family: Arial; padding: 20px;">
                    <h2>Gmail OAuth Not Configured</h2>
                    <p>Gmail OAuth credentials are not set up. Please configure the following environment variables:</p>
                    <ul>
                        <li><code>GMAIL_CLIENT_ID</code></li>
                        <li><code>GMAIL_CLIENT_SECRET</code></li>
                    </ul>
                    <p>See GMAIL_OAUTH_SETUP.md for instructions on how to obtain these credentials.</p>
                    <button onclick="window.close()">Close</button>
                </body>
                </html>
            `);
        }
        
        // Store user ID in session for callback
        req.session.userId = req.query.userId || req.headers['x-user-id'];
        
        // Get appropriate redirect URI
        const redirectUri = getRedirectUri(req);
        
        // Create a new OAuth client with the correct redirect URI
        const dynamicOAuth2Client = new google.auth.OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            redirectUri
        );
        
        // Log OAuth configuration for debugging
        console.log('[Gmail OAuth] Starting OAuth flow:', {
            clientId: process.env.GMAIL_CLIENT_ID,
            redirectUri: redirectUri,
            scopes: SCOPES,
            requestHost: req.get('host'),
            baseUrl: process.env.BASE_URL || 'http://localhost:3001'
        });
        
        const authUrl = dynamicOAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent' // Force consent to get refresh token
        });
        
        console.log('[Gmail OAuth] Generated auth URL:', authUrl);
        res.redirect(authUrl);
    } catch (error) {
        console.error('[Gmail OAuth] Error starting OAuth flow:', error);
        res.status(500).send(`Error starting authentication: ${error.message}`);
    }
});

// OAuth callback
router.get('/callback', async (req, res) => {
    const { code, error, error_description } = req.query;
    
    console.log('[Gmail OAuth] Callback received:', {
        hasCode: !!code,
        error: error,
        errorDescription: error_description,
        fullUrl: req.originalUrl
    });
    
    if (error) {
        console.error('[Gmail OAuth] OAuth error:', error, error_description);
        return res.send(`
            <script>
                window.opener.postMessage({
                    type: 'gmail-oauth-error',
                    error: '${error}',
                    description: '${error_description || ''}'
                }, '*');
                window.close();
            </script>
        `);
    }
    
    try {
        // Create OAuth client with the correct redirect URI for token exchange
        const redirectUri = getRedirectUri(req);
        const callbackOAuth2Client = new google.auth.OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            redirectUri
        );
        
        console.log('[Gmail OAuth] Exchanging code for tokens with redirect URI:', redirectUri);
        
        // Exchange code for tokens
        const { tokens } = await callbackOAuth2Client.getToken(code);
        callbackOAuth2Client.setCredentials(tokens);
        
        // Get user email
        const oauth2 = google.oauth2({ version: 'v2', auth: callbackOAuth2Client });
        const { data } = await oauth2.userinfo.get();
        const email = data.email;
        
        // Send success message to opener window
        res.send(`
            <script>
                window.opener.postMessage({
                    type: 'gmail-oauth-success',
                    tokens: ${JSON.stringify(tokens)},
                    email: '${email}'
                }, '*');
                window.close();
            </script>
        `);
        
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.send(`
            <script>
                window.opener.postMessage({
                    type: 'gmail-oauth-error',
                    error: 'Failed to complete authentication'
                }, '*');
                window.close();
            </script>
        `);
    }
});

// Disconnect Gmail (revoke tokens)
router.post('/disconnect', verifyAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        
        // Get user's tokens from database
        const admin = require('firebase-admin');
        const userDoc = await admin.firestore()
            .collection('users')
            .doc(userId)
            .get();
        
        const userData = userDoc.data();
        if (userData?.gmailTokens?.refresh_token) {
            // Create OAuth client for revocation
            const revokeOAuth2Client = new google.auth.OAuth2(
                process.env.GMAIL_CLIENT_ID,
                process.env.GMAIL_CLIENT_SECRET
            );
            revokeOAuth2Client.setCredentials(userData.gmailTokens);
            await revokeOAuth2Client.revokeToken(userData.gmailTokens.refresh_token);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error disconnecting Gmail:', error);
        res.status(500).json({ error: 'Failed to disconnect Gmail account' });
    }
});

// Send email via Gmail API
router.post('/send', verifyAuth, async (req, res) => {
    try {
        const { to, subject, html, text } = req.body;
        const userId = req.user.uid;
        
        // Get user's Gmail tokens
        const admin = require('firebase-admin');
        const userDoc = await admin.firestore()
            .collection('users')
            .doc(userId)
            .get();
        
        const userData = userDoc.data();
        if (!userData?.gmailConnected || !userData?.gmailTokens) {
            return res.status(400).json({ error: 'Gmail not connected' });
        }
        
        // Create OAuth client for sending
        const sendOAuth2Client = new google.auth.OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET
        );
        sendOAuth2Client.setCredentials(userData.gmailTokens);
        
        // Refresh token if needed
        const tokens = await sendOAuth2Client.getAccessToken();
        if (tokens.token !== userData.gmailTokens.access_token) {
            // Update stored tokens
            await admin.firestore()
                .collection('users')
                .doc(userId)
                .update({
                    'gmailTokens.access_token': tokens.token,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
        }
        
        // Create Gmail API instance
        const gmail = google.gmail({ version: 'v1', auth: sendOAuth2Client });
        
        // Create email
        const message = [
            `To: ${to}`,
            `Subject: ${subject}`,
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=utf-8',
            '',
            html || text
        ].join('\n');
        
        // Encode to base64
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        
        // Send email
        const result = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage
            }
        });
        
        res.json({
            success: true,
            messageId: result.data.id
        });
        
    } catch (error) {
        console.error('Error sending Gmail:', error);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

// Debug endpoint to check OAuth configuration
router.get('/debug', (req, res) => {
    const redirectUri = getRedirectUri(req);
    res.json({
        configured: !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET),
        clientId: process.env.GMAIL_CLIENT_ID || 'NOT_SET',
        hasClientSecret: !!process.env.GMAIL_CLIENT_SECRET,
        redirectUri: redirectUri,
        requestHost: req.get('host'),
        baseUrl: process.env.BASE_URL || 'http://localhost:3001',
        scopes: SCOPES
    });
});

module.exports = router;