// Report-related functions extracted from server.js
// This module contains report generation and email functionality

const fs = require('fs');
const path = require('path');

// Check if SendGrid is initialized (would be passed as dependency)
let sendGridInitialized = false;
let sgMail = null;

// Function to get responses with signed URLs
async function getResponsesWithSignedUrls(reportId, db, storageInstance, gcsBucketName) {
    if (!db) {
        console.error(`[getResponsesWithSignedUrls] Firebase DB not available for report ${reportId}`);
        throw new Error('Firebase service unavailable');
    }
    if (!storageInstance) {
        console.error(`[getResponsesWithSignedUrls] GCS Storage not available for report ${reportId}`);
        throw new Error('Storage service unavailable');
    }
    if (!reportId) {
        console.error(`[getResponsesWithSignedUrls] Missing report ID`);
        throw new Error('Missing report ID');
    }

    const responses = [];
    try {
        const responsesQuery = db.collection('reports').doc(reportId).collection('responses').orderBy('timestamp', 'asc');
        const snapshot = await responsesQuery.get();

        // Use Promise.all to handle async signed URL generation
        await Promise.all(snapshot.docs.map(async (doc) => {
            const data = doc.data();
            let signedAudioUrl = null;
            let signedVideoUrl = null;

            // Helper function to generate signed URL from GCS URI
            const generateSignedUrl = async (gcsUri, type) => {
                try {
                    const match = gcsUri.match(/^gs:\/\/([^\/]+)\/(.+)$/);
                    if (match) {
                        const bucketName = match[1];
                        const filePath = match[2];
                        
                        const options = {
                            version: 'v4',
                            action: 'read',
                            expires: Date.now() + 60 * 60 * 1000, // 1 hour
                        };
                        const bucketToUse = bucketName === gcsBucketName ? storageInstance.bucket(gcsBucketName) : storageInstance.bucket(bucketName);
                        const [url] = await bucketToUse.file(filePath).getSignedUrl(options);
                        return url;
                    } else {
                        console.warn(`[getResponsesWithSignedUrls] Invalid GCS URI format for ${type} in report ${reportId}: ${gcsUri}`);
                        return null;
                    }
                } catch (urlError) {
                    console.error(`[getResponsesWithSignedUrls] Error generating signed URL for ${type} ${gcsUri} in report ${reportId}:`, urlError);
                    return null;
                }
            };

            // Generate audio signed URL
            if (data.audio_gcs_url) {
                signedAudioUrl = await generateSignedUrl(data.audio_gcs_url, 'audio');
            }

            // Generate video signed URL
            if (data.video_gcs_url) {
                signedVideoUrl = await generateSignedUrl(data.video_gcs_url, 'video');
            }

            responses.push({
                id: doc.id,
                question: data.question || '',
                answer: data.answer || '',
                timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : null,
                audio_signed_url: signedAudioUrl,
                video_signed_url: signedVideoUrl,
                word_timestamps: data.word_timestamps || null
            });
        }));
        console.log(`[getResponsesWithSignedUrls] Fetched ${responses.length} responses for report ${reportId}`);
        return responses;
    } catch (error) {
        console.error(`[getResponsesWithSignedUrls] Error fetching responses for report ${reportId}:`, error);
        throw error;
    }
}

// Create HTML email template for report
function createReportEmailTemplate(reportContent, reportTitle, reportPermalink, userName) {
    // Convert report content to HTML-friendly format
    let htmlContent = reportContent
        // First, escape HTML entities but preserve our markdown syntax
        .replace(/&/g, '&amp;')
        // Convert audio_clip tags to temporary markers before escaping
        .replace(/<audio_clip\s+id="([^"]*)">(.*?)<\/audio_clip>/gi, '§§AUDIO_CLIP_START§§$1§§AUDIO_CLIP_MIDDLE§§$2§§AUDIO_CLIP_END§§')
        // Now escape angle brackets
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Convert markdown to HTML
        // Convert ### headers to h3
        .replace(/###\s*(.*?)(?=\n|$)/g, '<h3 style="color: #2c5aa0; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">$1</h3>')
        // Convert ## headers to h2
        .replace(/##\s*(.*?)(?=\n|$)/g, '<h2 style="color: #2c5aa0; margin-top: 35px; margin-bottom: 20px; font-size: 24px;">$1</h2>')
        // Convert # headers to h1
        .replace(/#\s*(.*?)(?=\n|$)/g, '<h1 style="color: #2c5aa0; margin-top: 40px; margin-bottom: 25px; font-size: 28px;">$1</h1>')
        // Convert **bold** to <strong>
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Convert *italic* to <em>
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Convert audio_clip markers back to HTML
        .replace(/§§AUDIO_CLIP_START§§([^§]*)§§AUDIO_CLIP_MIDDLE§§([^§]*)§§AUDIO_CLIP_END§§/g, '<div class="quote-block">"$2"</div>')
        // Convert newlines to <br> tags
        .replace(/\n/g, '<br>')
        // Clean up excessive line breaks
        .replace(/(<br>\s*){3,}/g, '<br><br>');

    const emailTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${reportTitle}</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            background-color: #f8f9fa;
            padding: 20px;
        }
        .email-container {
            background-color: white;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 20px;
        }
        .logo {
            max-width: 150px;
            height: auto;
            margin-bottom: 15px;
        }
        .title {
            color: #2c5aa0;
            font-size: 26px;
            margin: 0;
            font-weight: bold;
        }
        .subtitle {
            color: #6c757d;
            font-size: 16px;
            margin-top: 5px;
        }
        .content {
            margin: 25px 0;
            font-size: 15px;
            line-height: 1.7;
        }
        /* Quote block styling for interview quotes */
        .quote-block {
            margin: 20px 0 !important;
            padding: 15px 20px !important;
            background-color: #f8f9fa !important;
            border-left: 4px solid #2c5aa0 !important;
            font-style: italic !important;
            color: #495057 !important;
            line-height: 1.6 !important;
            border-radius: 0 5px 5px 0 !important;
        }
        .cta-section {
            background: linear-gradient(135deg, #2c5aa0 0%, #4a7bc8 100%);
            color: white;
            padding: 25px;
            border-radius: 8px;
            text-align: center;
            margin: 30px 0;
        }
        .cta-button {
            display: inline-block;
            background-color: white;
            color: #2c5aa0;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 25px;
            font-weight: bold;
            font-size: 16px;
            margin-top: 15px;
            transition: all 0.3s ease;
        }
        .cta-button:hover {
            background-color: #f8f9fa;
            transform: translateY(-2px);
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #6c757d;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
        }
        .audio-clip {
            background-color: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 10px 15px;
            margin: 15px 0;
            border-radius: 0 5px 5px 0;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <img src="cid:logo" alt="Say AI Logo" class="logo">
            <h1 class="title">${reportTitle || 'Your Report'}</h1>
            <p class="subtitle">Hello ${userName || 'there'}, your interview analysis is ready!</p>
        </div>
        
        <div class="content">
            ${htmlContent}
        </div>
        
        <div class="cta-section">
            <h3 style="margin-top: 0; color: white;">📊 View Your Full Report</h3>
            <p style="margin-bottom: 20px; opacity: 0.9;">Read your complete report, share insights with colleagues, and access all interview responses.</p>
            <a href="${reportPermalink}" class="cta-button">View Full Report & Share</a>
        </div>
        
        <div class="footer">
            <p>This interview was generated by Say - AI agents that tell human stories.</p>
            <p>If you have any questions about your report, feel free to reach out to our team.</p>
        </div>
    </div>
</body>
</html>`;

    return emailTemplate;
}

// Send report email via SendGrid
async function sendReportEmail(userEmail, userName, reportContent, reportTitle, reportId, interviewId) {
    if (!sendGridInitialized || !sgMail) {
        console.warn('SendGrid client not initialized. Skipping email send.');
        return false;
    }

    if (!userEmail || !reportContent) {
        console.warn('Missing required email parameters (userEmail or reportContent). Skipping email send.');
        return false;
    }

    try {
        // Construct the permalink to the report
        const baseUrl = process.env.BASE_URL || 'http://prompter.example.com';
        const reportPermalink = `${baseUrl}/report.html?id=${reportId}`;

        console.log(`[sendReportEmail] Preparing to send email to ${userEmail} for report ${reportId}`);
        console.log(`[sendReportEmail] Report permalink: ${reportPermalink}`);

        // Read the logo file
        let logoAttachment = null;
        const logoPath = path.join(__dirname, 'public', 'saylogo.png');
        
        if (fs.existsSync(logoPath)) {
            const logoContent = fs.readFileSync(logoPath);
            logoAttachment = {
                filename: 'logo',
                content: logoContent.toString('base64'),
                type: 'image/png',
                disposition: 'inline',
                content_id: 'logo'
            };
        } else {
            console.warn('Logo file not found at:', logoPath);
        }

        // Create the email template
        const htmlBody = createReportEmailTemplate(reportContent, reportTitle, reportPermalink, userName);

        // Prepare email data
        const emailData = {
            from: process.env.SENDGRID_FROM_EMAIL || 'contact@example.com',
            to: userEmail,
            subject: `${reportTitle || 'Your Report'} is Ready! 🎯`,
            html: htmlBody,
            text: `Hello ${userName || 'there'},

Your ${reportTitle || 'report'} is now ready!

View your complete report with audio features here: ${reportPermalink}

=== YOUR REPORT ===

${reportContent
    // Convert audio_clip tags to quoted text
    .replace(/<audio_clip\s+id="[^"]*">(.*?)<\/audio_clip>/gi, '"$1"')
    // Convert HTML tags back to plain text format
    .replace(/<br>/g, '\n')
    .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
    .replace(/<em>(.*?)<\/em>/g, '*$1*')
    .replace(/<h3[^>]*>(.*?)<\/h3>/g, '\n\n### $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/g, '\n\n## $1\n')
    .replace(/<h1[^>]*>(.*?)<\/h1>/g, '\n\n# $1\n')
    .replace(/<[^>]*>/g, '')}

===================

Best regards,
The Say Research Team

This report was generated by Say AI - AI-powered research interviews.`,
            attachments: logoAttachment ? [logoAttachment] : []
        };

        // Send the email
        const result = await sgMail.send(emailData);
        console.log(`[sendReportEmail] Email sent successfully to ${userEmail}. MessageId: ${result[0].headers['x-message-id']}`);
        
        // Log email event to Firebase if available
        const eventData = {
            eventType: 'report_email_sent',
            reportId: reportId,
            interviewId: interviewId,
            userEmail: userEmail,
            timestamp: new Date().toISOString(),
            success: true,
            messageId: result[0].headers['x-message-id']
        };
        
        console.log('[sendReportEmail] Email event:', eventData);
        
        return true;
    } catch (error) {
        console.error('[sendReportEmail] Error sending email:', error);
        if (error.response) {
            console.error('[sendReportEmail] SendGrid error response:', error.response.body);
        }
        
        // Log failure event
        const failureData = {
            eventType: 'report_email_failed',
            reportId: reportId,
            interviewId: interviewId,
            userEmail: userEmail,
            timestamp: new Date().toISOString(),
            success: false,
            error: error.message
        };
        
        console.log('[sendReportEmail] Email failure event:', failureData);
        
        return false;
    }
}

// Initialize module with dependencies
function initialize(dependencies) {
    if (dependencies.sgMail) {
        sgMail = dependencies.sgMail;
        sendGridInitialized = true;
    } else {
        sgMail = null;
        sendGridInitialized = false;
    }
}

// Note: The generateReport and generateAdminReport functions are defined inside
// socket handler scope and would need to be refactored to be extracted here.
// For now, we'll leave them as placeholders.

module.exports = {
    getResponsesWithSignedUrls,
    createReportEmailTemplate,
    sendReportEmail,
    initialize
};