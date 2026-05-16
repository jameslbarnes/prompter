const { config } = require('../config');

function createReportEmailTemplate(reportContent, reportTitle, reportPermalink, userName) {
    // Create a clean text version for the email
    let cleanText = reportContent
        .replace(/^#+\s+/gm, '') // Remove markdown headers
        .replace(/\*\*/g, '') // Remove bold markdown
        .replace(/\*/g, '') // Remove italic markdown
        .replace(/`/g, '') // Remove code markdown
        .replace(/\n{3,}/g, '\n\n'); // Reduce multiple newlines

    // Truncate content for email (keeping it reasonable)
    const maxLength = 3000;
    if (cleanText.length > maxLength) {
        cleanText = cleanText.substring(0, maxLength) + '...';
    }

    // Get first name only
    const firstName = userName ? userName.split(' ')[0] : 'there';

    return {
        subject: `Your interview is ready: ${reportTitle}`,
        text: `Hi ${firstName},\n\nThank you for sharing your story with Say.\n\nYour interview transcripts and videos are now available to view and share.\n\n${cleanText}\n\nAccess your interview: ${reportPermalink}\n\nBest,\nThe Say Team`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${reportTitle}</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f5f5f5;
                    }
                    .email-container {
                        background-color: white;
                        border-radius: 10px;
                        padding: 30px;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    }
                    h1 {
                        color: #2c5aa0;
                        font-size: 24px;
                        margin-bottom: 20px;
                        font-weight: bold;
                    }
                    .greeting {
                        font-size: 18px;
                        margin-bottom: 20px;
                        color: #555;
                    }
                    .content {
                        background-color: #f8f9fa;
                        border-left: 4px solid #007bff;
                        padding: 20px;
                        margin: 20px 0;
                        border-radius: 4px;
                    }
                    .content h2 {
                        color: #2c3e50;
                        font-size: 18px;
                        margin-top: 0;
                        margin-bottom: 10px;
                    }
                    .content h3 {
                        color: #495057;
                        font-size: 16px;
                        margin-top: 15px;
                        margin-bottom: 8px;
                    }
                    .content p {
                        margin: 10px 0;
                        color: #666;
                    }
                    .cta-button {
                        display: inline-block;
                        background-color: #007bff;
                        color: white !important;
                        padding: 12px 30px;
                        text-decoration: none;
                        border-radius: 5px;
                        font-weight: 600;
                        margin: 20px 0;
                        transition: background-color 0.3s ease;
                    }
                    .cta-button:hover {
                        background-color: #0056b3;
                    }
                    .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #e9ecef;
                        color: #6c757d;
                        font-size: 14px;
                    }
                    .footer a {
                        color: #007bff;
                        text-decoration: none;
                    }
                    @media only screen and (max-width: 600px) {
                        body {
                            padding: 10px;
                        }
                        .email-container {
                            padding: 20px;
                        }
                        h1 {
                            font-size: 20px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <h1>Your interview is ready</h1>
                    <p class="greeting">Hi ${firstName},</p>
                    <p>Thank you for sharing your story with Say. Your interview transcripts and videos are now available to view and share.</p>
                    <div class="content">
                        ${cleanText.split('\n\n').map(paragraph => {
                            if (paragraph.trim()) {
                                // Check if it's a header-like line (short and no punctuation)
                                if (paragraph.length < 50 && !paragraph.includes('.') && !paragraph.includes('?')) {
                                    return `<h3>${paragraph}</h3>`;
                                } else {
                                    return `<p>${paragraph}</p>`;
                                }
                            }
                            return '';
                        }).join('')}
                    </div>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${reportPermalink}" class="cta-button">Access Your Interview</a>
                    </div>
                    <div class="footer">
                        <p>Best,<br>The Say Team</p>
                        <p style="margin-top: 20px; font-size: 12px; color: #999;">
                            You received this because you completed an interview with Say. 
                            Your data is private and secure.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `
    };
}

function createSharingNotificationTemplate(sharedByEmail, interviewTitle, interviewDescription, shareLink) {
    return {
        subject: `${sharedByEmail} shared an interview with you: ${interviewTitle}`,
        text: `Hi,

${sharedByEmail} has shared an interview with you on Say.

Interview: ${interviewTitle}
${interviewDescription ? `Description: ${interviewDescription}` : ''}

You can view and manage this interview here: ${shareLink}

Best regards,
The Say Team`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Interview Shared With You</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f5f5f5;
                    }
                    .email-container {
                        background-color: white;
                        border-radius: 10px;
                        padding: 30px;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    }
                    h1 {
                        color: #2c5aa0;
                        font-size: 24px;
                        margin-bottom: 20px;
                        font-weight: bold;
                    }
                    .share-info {
                        background-color: #f8f9fa;
                        border-left: 4px solid #2c5aa0;
                        padding: 20px;
                        margin: 20px 0;
                        border-radius: 4px;
                    }
                    .share-info h2 {
                        color: #2c5aa0;
                        font-size: 18px;
                        margin-top: 0;
                        margin-bottom: 10px;
                    }
                    .share-info p {
                        margin: 5px 0;
                        color: #666;
                    }
                    .sharer {
                        font-weight: 600;
                        color: #2c5aa0;
                    }
                    .cta-button {
                        display: inline-block;
                        background-color: #2c5aa0;
                        color: white !important;
                        padding: 12px 30px;
                        text-decoration: none;
                        border-radius: 25px;
                        font-weight: bold;
                        margin: 20px 0;
                        transition: background-color 0.3s ease;
                    }
                    .cta-button:hover {
                        background-color: #1e417a;
                    }
                    .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #e9ecef;
                        color: #6c757d;
                        font-size: 14px;
                    }
                    .footer a {
                        color: #007bff;
                        text-decoration: none;
                    }
                    @media only screen and (max-width: 600px) {
                        body {
                            padding: 10px;
                        }
                        .email-container {
                            padding: 20px;
                        }
                        h1 {
                            font-size: 20px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="email-container">
                    <h1>Interview Shared With You</h1>
                    <p>Hi,</p>
                    <p><span class="sharer">${sharedByEmail}</span> has shared an interview with you on Say.</p>
                    <div class="share-info">
                        <h2>${interviewTitle}</h2>
                        ${interviewDescription ? `<p>${interviewDescription}</p>` : ''}
                    </div>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${shareLink}" class="cta-button">View Interview</a>
                    </div>
                    <div class="footer">
                        <p>Best regards,<br>The Say Team</p>
                        <p style="margin-top: 20px; font-size: 12px; color: #999;">
                            You received this email because someone shared an interview with you on Say.
                            If you believe this was sent in error, please ignore this email.
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `
    };
}

module.exports = {
    createReportEmailTemplate,
    createSharingNotificationTemplate
};