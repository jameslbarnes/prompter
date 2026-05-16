// Campaign Email Sender
// Background job processor for sending campaign emails with throttling

const admin = require('firebase-admin');
const EmailService = require('../services/email-service');

class CampaignSender {
    constructor() {
        this.isRunning = false;
        this.intervalId = null;
    }

    async start() {
        if (this.isRunning) {
            console.log('[CampaignSender] Already running');
            return;
        }

        console.log('[CampaignSender] Starting campaign email processor');
        this.isRunning = true;

        // Check for emails to send every minute
        this.intervalId = setInterval(() => {
            this.processQueue();
        }, 60000); // 1 minute

        // Process immediately on start
        this.processQueue();
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('[CampaignSender] Stopped campaign email processor');
    }

    async processQueue() {
        try {
            const db = admin.firestore();
            const now = new Date();

            // Get emails that are queued and scheduled for now or earlier
            const emailsSnapshot = await db.collection('campaign_emails')
                .where('status', '==', 'queued')
                .where('scheduledFor', '<=', now)
                .limit(20) // Process batch of 20
                .get();

            if (emailsSnapshot.empty) {
                return;
            }

            console.log(`[CampaignSender] Processing ${emailsSnapshot.size} emails`);

            // Process each email
            const promises = emailsSnapshot.docs.map(doc => this.sendEmail(doc));
            await Promise.allSettled(promises);

        } catch (error) {
            console.error('[CampaignSender] Error processing queue:', error);
        }
    }

    async sendEmail(emailDoc) {
        const emailData = emailDoc.data();
        const db = admin.firestore();

        try {
            // Get campaign data for user context
            const campaignDoc = await db.collection('campaigns')
                .doc(emailData.campaignId)
                .get();

            if (!campaignDoc.exists) {
                throw new Error('Campaign not found');
            }

            const campaign = campaignDoc.data();

            // Get user data for Gmail integration
            let userData = null;
            if (campaign.createdBy) {
                const userDoc = await db.collection('users')
                    .doc(campaign.createdBy)
                    .get();
                if (userDoc.exists) {
                    userData = userDoc.data();
                    userData.uid = campaign.createdBy;
                }
            }

            // Send the email
            console.log(`[CampaignSender] Sending email to ${emailData.to}`);
            
            const result = await EmailService.send({
                to: emailData.to,
                subject: emailData.subject,
                html: this.formatEmailHtml(emailData.body, emailData.interviewLink, emailDoc.id),
                text: emailData.body,
                user: userData
            });

            // Update email status
            await emailDoc.ref.update({
                status: 'sent',
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                sentVia: result.service,
                messageId: result.messageId
            });

            // Update campaign stats
            await this.updateCampaignStats(emailData.campaignId, 'sent');

            console.log(`[CampaignSender] ✅ Email sent to ${emailData.to} via ${result.service}`);

        } catch (error) {
            console.error(`[CampaignSender] ❌ Failed to send email to ${emailData.to}:`, error);

            // Update email status with error
            await emailDoc.ref.update({
                status: 'failed',
                error: error.message,
                failedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Update campaign stats
            await this.updateCampaignStats(emailData.campaignId, 'failed');
        }
    }

    formatEmailHtml(body, interviewLink, emailId) {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
        
        // Create tracked interview link
        const trackedLink = `${baseUrl}/api/campaigns/track/click/${emailId}?url=${encodeURIComponent(interviewLink)}`;
        
        // Convert plain text to HTML with proper formatting
        const htmlBody = body
            .split('\n')
            .map(line => {
                // Convert interview link to button with tracking
                if (line.includes(interviewLink)) {
                    return `<p style="margin: 20px 0;">
                        <a href="${trackedLink}" style="display: inline-block; padding: 12px 24px; background-color: #2563EB; color: white; text-decoration: none; border-radius: 6px; font-weight: 500;">
                            Start Interview →
                        </a>
                    </p>`;
                }
                return `<p style="margin: 10px 0;">${line}</p>`;
            })
            .join('');

        // Add tracking pixel at the end
        const trackingPixel = `<img src="${baseUrl}/api/campaigns/track/open/${emailId}" width="1" height="1" style="display: block;" />`;

        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                ${htmlBody}
                ${trackingPixel}
            </div>
        `;
    }

    async updateCampaignStats(campaignId, status) {
        try {
            const db = admin.firestore();
            const campaignRef = db.collection('campaigns').doc(campaignId);

            // Use transaction to safely update counters
            await db.runTransaction(async (transaction) => {
                const campaignDoc = await transaction.get(campaignRef);
                if (!campaignDoc.exists) return;

                const stats = campaignDoc.data().stats || {};
                const field = status === 'sent' ? 'sent' : 'failed';
                
                transaction.update(campaignRef, {
                    [`stats.${field}`]: (stats[field] || 0) + 1,
                    lastActivity: admin.firestore.FieldValue.serverTimestamp()
                });
            });
        } catch (error) {
            console.error('[CampaignSender] Error updating campaign stats:', error);
        }
    }

    // Get campaign statistics
    async getCampaignStats(campaignId) {
        try {
            const db = admin.firestore();
            
            // Get campaign
            const campaignDoc = await db.collection('campaigns').doc(campaignId).get();
            if (!campaignDoc.exists) {
                throw new Error('Campaign not found');
            }

            const campaign = campaignDoc.data();

            // Count emails by status
            const statuses = ['queued', 'sent', 'failed'];
            const counts = {};

            for (const status of statuses) {
                const snapshot = await db.collection('campaign_emails')
                    .where('campaignId', '==', campaignId)
                    .where('status', '==', status)
                    .count()
                    .get();
                counts[status] = snapshot.data().count;
            }

            return {
                campaign: {
                    id: campaignId,
                    name: campaign.name,
                    createdAt: campaign.createdAt,
                    totalContacts: campaign.totalContacts
                },
                emails: counts,
                stats: campaign.stats || {}
            };
        } catch (error) {
            console.error('[CampaignSender] Error getting campaign stats:', error);
            throw error;
        }
    }
}

// Create singleton instance
const campaignSender = new CampaignSender();

module.exports = campaignSender;