// Context Strings Routes
// Handles storage and retrieval of arbitrary text context

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');

// Create a new context string
router.post('/create', requireAuth, async (req, res) => {
    try {
        const { content, metadata = {} } = req.body;
        const userId = req.user.uid;
        
        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }
        
        const db = admin.firestore();
        const contextStringId = uuidv4();
        
        const contextString = {
            id: contextStringId,
            userId,
            content,
            metadata, // Can include source, type, etc.
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromDate(
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
            )
        };
        
        await db.collection('contextStrings').doc(contextStringId).set(contextString);
        
        res.json({ 
            contextStringId,
            message: 'Context string created successfully' 
        });
        
    } catch (error) {
        console.error('Create context string error:', error);
        res.status(500).json({ error: 'Failed to create context string' });
    }
});

// Get a context string by ID
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = admin.firestore();
        
        const doc = await db.collection('contextStrings').doc(id).get();
        
        if (!doc.exists) {
            return res.status(404).json({ error: 'Context string not found' });
        }
        
        const data = doc.data();
        
        // Check if expired
        if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
            // Clean up expired context
            await doc.ref.delete();
            return res.status(404).json({ error: 'Context string has expired' });
        }
        
        res.json({
            id: doc.id,
            content: data.content,
            metadata: data.metadata
        });
        
    } catch (error) {
        console.error('Get context string error:', error);
        res.status(500).json({ error: 'Failed to retrieve context string' });
    }
});

// Delete a context string
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.uid;
        const db = admin.firestore();
        
        const doc = await db.collection('contextStrings').doc(id).get();
        
        if (!doc.exists) {
            return res.status(404).json({ error: 'Context string not found' });
        }
        
        const data = doc.data();
        
        // Only owner can delete
        if (data.userId !== userId) {
            return res.status(403).json({ error: 'Unauthorized to delete this context string' });
        }
        
        await doc.ref.delete();
        
        res.json({ message: 'Context string deleted successfully' });
        
    } catch (error) {
        console.error('Delete context string error:', error);
        res.status(500).json({ error: 'Failed to delete context string' });
    }
});

module.exports = router;