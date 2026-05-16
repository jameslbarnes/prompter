// Campaign Management Routes
// Handles bulk interview outreach campaigns

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

// Helper to clean strings for JSON - removes invalid Unicode surrogate pairs
function cleanStringForJSON(str) {
    if (!str) return '';
    
    // Remove invalid surrogate pairs and other problematic characters
    return str
        .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '') // Remove high surrogates without low surrogates
        .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '') // Remove low surrogates without high surrogates
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
        .replace(/\uFFFD/g, '') // Remove replacement character
        .trim();
}

// Exponential backoff helper for Claude API rate limits
async function callClaudeWithRetry(requestBody, maxRetries = 5) {
    const claudeApiKey = process.env.CLAUDE_API_KEY;
    if (!claudeApiKey) {
        throw new Error('Claude API key not configured');
    }

    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': claudeApiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (response.ok) {
                return await response.json();
            }
            
            // Check for rate limit error
            if (response.status === 529) {
                const retryAfter = response.headers.get('retry-after');
                const waitTime = retryAfter 
                    ? parseInt(retryAfter) * 1000 
                    : Math.min(1000 * Math.pow(2, attempt), 60000); // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 60s
                
                console.log(`[Campaign] Rate limited (529). Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
                
                if (attempt < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                }
            }
            
            // For other errors, throw immediately
            const errorText = await response.text();
            throw new Error(`Claude API error: ${response.status} - ${errorText}`);
            
        } catch (error) {
            lastError = error;
            
            // If it's not a rate limit or network error, don't retry
            if (!error.message.includes('529') && !error.message.includes('ECONNRESET') && !error.message.includes('ETIMEDOUT')) {
                throw error;
            }
            
            // For network errors, also use exponential backoff
            if (attempt < maxRetries - 1) {
                const waitTime = Math.min(1000 * Math.pow(2, attempt), 60000);
                console.log(`[Campaign] Network error. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }
    
    throw lastError || new Error('Max retries exceeded');
}

// Validate CSV contacts
router.post('/validate', requireAuth, async (req, res) => {
    try {
        const { contacts } = req.body;
        
        if (!contacts || !Array.isArray(contacts)) {
            return res.status(400).json({ error: 'Contacts array is required' });
        }
        
        const validatedContacts = [];
        const errors = [];
        
        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            const validation = {
                index: i,
                valid: true,
                errors: []
            };
            
            // Validate required fields
            if (!contact.name) validation.errors.push('Name is required');
            if (!contact.email) validation.errors.push('Email is required');
            if (!contact.title) validation.errors.push('Title is required');
            if (!contact.link) validation.errors.push('Link is required');
            
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (contact.email && !emailRegex.test(contact.email)) {
                validation.errors.push('Invalid email format');
            }
            
            if (validation.errors.length > 0) {
                validation.valid = false;
                errors.push(validation);
            } else {
                validatedContacts.push({
                    ...contact,
                    id: uuidv4()
                });
            }
        }
        
        res.json({
            valid: validatedContacts.length,
            invalid: errors.length,
            validatedContacts,
            errors
        });
        
    } catch (error) {
        console.error('Contact validation error:', error);
        res.status(500).json({ error: 'Failed to validate contacts' });
    }
});

// Process contacts (scrape links, generate questions)
router.post('/process', requireAuth, async (req, res) => {
    try {
        const { contacts, interviewId, questionPrompt } = req.body;
        
        if (!contacts || !Array.isArray(contacts)) {
            return res.status(400).json({ error: 'Contacts array is required' });
        }
        
        if (!interviewId) {
            return res.status(400).json({ error: 'Interview ID is required' });
        }
        
        // Get interview template
        const db = admin.firestore();
        const interviewDoc = await db.collection('interviews').doc(interviewId).get();
        
        if (!interviewDoc.exists) {
            return res.status(404).json({ error: 'Interview template not found' });
        }
        
        const interviewData = interviewDoc.data();
        const processedContacts = [];
        
        // Process each contact with delay to avoid rate limits
        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            
            // Add small delay between requests (except for first one)
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay = max 5 requests per second
            }
            
            try {
                // Extract content from profile link (web page or document)
                let profileContext = '';
                
                // Check if contact has context (from CSV or Product Hunt)
                if (contact.context || contact.productHuntComment) {
                    const contextContent = contact.context || contact.productHuntComment;
                    
                    // Store the context as a context string
                    const contextStringResponse = await fetch(`http://localhost:${process.env.PORT || 3001}/api/context-strings/create`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': req.headers.authorization || ''
                        },
                        body: JSON.stringify({
                            content: contextContent,
                            metadata: {
                                source: contact.productHuntComment ? 'producthunt' : 'csv',
                                productId: contact.productHuntId,
                                contactName: contact.name,
                                company: contact.company
                            }
                        })
                    });
                    
                    if (contextStringResponse.ok) {
                        const { contextStringId } = await contextStringResponse.json();
                        contact.contextStringId = contextStringId;
                        profileContext = `Context: ${contextContent}\n\n`;
                    }
                }
                
                if (contact.link) {
                    try {
                        const linkUrl = new URL(contact.link);
                        
                        // Check if this is an arXiv link that should be a PDF
                        const isArxivLink = linkUrl.hostname.includes('arxiv.org');
                        let finalUrl = contact.link;
                        
                        if (isArxivLink) {
                            // Convert arXiv URLs to PDF format if they match the pattern
                            const arxivMatch = contact.link.match(/arxiv\.org\/(?:abs|pdf)\/(\d+\.\d+)/);
                            if (arxivMatch) {
                                finalUrl = `https://arxiv.org/pdf/${arxivMatch[1]}`;
                                console.log(`[Campaign] Converted arXiv link to PDF: ${finalUrl}`);
                            }
                        }
                        
                        // Update linkUrl if we modified it
                        if (finalUrl !== contact.link) {
                            linkUrl.href = finalUrl;
                        }
                        
                        const isPdf = linkUrl.pathname.toLowerCase().endsWith('.pdf') || finalUrl.includes('arxiv.org/pdf/');
                        const isDoc = /\.(pdf|doc|docx|txt)$/i.test(linkUrl.pathname);
                        
                        if (isPdf || isDoc) {
                            // Handle document files (PDF, DOC, etc.)
                            console.log(`[Campaign] Attempting to extract text from document: ${finalUrl}`);
                            
                            // First, download the file
                            const fileResponse = await fetch(finalUrl, {
                                headers: {
                                    'User-Agent': 'Mozilla/5.0 (compatible; Say Campaign Bot/1.0)'
                                }
                            });
                            if (!fileResponse.ok) throw new Error(`Failed to download: ${fileResponse.status}`);
                            
                            const buffer = await fileResponse.buffer();
                            const mimeType = fileResponse.headers.get('content-type') || 'application/pdf';
                            
                            // Use the text extraction functionality
                            const { extractTextFromFileBuffer } = require('../../utils/text-extraction');
                            profileContext = await extractTextFromFileBuffer(
                                buffer,
                                mimeType,
                                linkUrl.pathname.split('/').pop()
                            );
                            
                            console.log(`[Campaign] Extracted text from ${finalUrl}, length: ${profileContext.length}`);
                            // Combine with existing context if any
                            const extractedContent = profileContext;
                            profileContext = profileContext ? profileContext + extractedContent : extractedContent;
                        } else {
                            // Handle web pages
                            console.log(`[Campaign] Attempting to scrape web page: ${contact.link}`);
                            
                            // Make internal HTTP request to scrape endpoint
                            const baseUrl = 'http://localhost:' + (process.env.PORT || 3001);
                            const scrapeUrl = `${baseUrl}/api/scrape-website`;
                            console.log(`[Campaign] Calling scrape endpoint: ${scrapeUrl}`);
                            
                            const scrapeResponse = await fetch(scrapeUrl, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': req.headers.authorization || ''
                                },
                                body: JSON.stringify({
                                    url: contact.link,
                                    depth: 0
                                })
                            });
                            
                            console.log(`[Campaign] Scrape response status: ${scrapeResponse.status}`);
                            
                            if (scrapeResponse.ok) {
                                const scraped = await scrapeResponse.json();
                                console.log(`[Campaign] Scrape result keys:`, Object.keys(scraped));
                                const scrapedContent = scraped.content || '';
                                console.log(`[Campaign] Scraped ${contact.link}, content length: ${scrapedContent.length}`);
                                
                                // Combine with existing context if any
                                profileContext = profileContext ? profileContext + scrapedContent : scrapedContent;
                                
                                if (scrapedContent.length === 0) {
                                    console.warn(`[Campaign] Scraping returned empty content for ${contact.link}`);
                                    console.log(`[Campaign] Full scrape result:`, JSON.stringify(scraped, null, 2));
                                }
                            } else {
                                const errorText = await scrapeResponse.text();
                                console.error(`[Campaign] Scrape failed: ${errorText}`);
                            }
                        }
                        
                        // Limit profile context to first 3000 characters to avoid overwhelming Claude
                        if (profileContext && profileContext.length > 3000) {
                            profileContext = profileContext.substring(0, 3000) + '...\n[Content truncated for brevity]';
                        }
                        
                    } catch (error) {
                        console.warn(`Failed to extract content from ${contact.link}:`, error.message);
                        profileContext = `${contact.name}, ${contact.title}`;
                    }
                }
                
                // Don't generate questions here anymore - just prepare the contact data
                // Questions will be generated after user approves the preview
                
                // Create placeholder interview link (will be updated with actual question later)
                const interviewLink = createInterviewLink(interviewId, contact, '');
                
                processedContacts.push({
                    ...contact,
                    profileContext,
                    interviewLink,
                    processed: true
                });
                
                // Log progress for large batches
                if ((i + 1) % 10 === 0) {
                    console.log(`[Campaign] Processed ${i + 1}/${contacts.length} contacts`);
                }
                
            } catch (error) {
                console.error(`Error processing contact ${contact.email}:`, error);
                processedContacts.push({
                    ...contact,
                    processed: false,
                    error: error.message
                });
            }
        }
        
        res.json({ processedContacts });
        
    } catch (error) {
        console.error('Contact processing error:', error);
        res.status(500).json({ error: 'Failed to process contacts' });
    }
});

// Generate single question for preview
router.post('/generate-question', requireAuth, async (req, res) => {
    try {
        const { contact, interviewContext, questionPrompt } = req.body;
        
        if (!contact || !questionPrompt) {
            return res.status(400).json({ error: 'Contact and question prompt are required' });
        }
        
        // Generate a single question based on the prompt
        const question = await generatePersonalizedQuestion(
            contact,
            contact.profileContext || '',
            interviewContext,
            questionPrompt
        );
        
        res.json({ question });
        
    } catch (error) {
        console.error('Question generation error:', error);
        res.status(500).json({ error: 'Failed to generate question' });
    }
});

// Generate questions for all contacts
router.post('/generate-all-questions', requireAuth, async (req, res) => {
    try {
        const { contacts, interviewId, interviewTitle, questionPrompt } = req.body;
        
        if (!contacts || !Array.isArray(contacts)) {
            return res.status(400).json({ error: 'Contacts array is required' });
        }
        
        if (!questionPrompt) {
            console.warn('[Campaign] No question prompt provided, using default');
            // Don't fail, just use a default prompt
        }
        
        // Get interview context
        const db = admin.firestore();
        const interviewDoc = await db.collection('interviews').doc(interviewId).get();
        const interviewData = interviewDoc.exists ? interviewDoc.data() : {};
        
        const contactsWithQuestions = [];
        
        // Generate personalized questions for each contact
        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            
            // Add small delay between requests (except for first one)
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
            }
            
            try {
                const personalizedQuestion = await generatePersonalizedQuestion(
                    contact,
                    contact.profileContext || '',
                    interviewData.context || interviewTitle,
                    questionPrompt || `Ask about their experience and insights related to ${interviewTitle}`
                );
                
                // Update interview link with the actual question
                const interviewLink = createInterviewLink(interviewId, contact, personalizedQuestion);
                
                contactsWithQuestions.push({
                    ...contact,
                    personalizedQuestion,
                    interviewLink
                });
                
                // Log progress for large batches
                if ((i + 1) % 10 === 0) {
                    console.log(`[Campaign] Generated questions for ${i + 1}/${contacts.length} contacts`);
                }
                
            } catch (error) {
                console.error(`Error generating question for ${contact.email}:`, error);
                // Use fallback question
                const fallbackQuestion = `Hi ${contact.name.split(' ')[0]}, given your role as ${contact.title}, what's your perspective on ${interviewTitle}?`;
                contactsWithQuestions.push({
                    ...contact,
                    personalizedQuestion: fallbackQuestion,
                    interviewLink: createInterviewLink(interviewId, contact, fallbackQuestion)
                });
            }
        }
        
        res.json({ contactsWithQuestions });
        
    } catch (error) {
        console.error('Bulk question generation error:', error);
        res.status(500).json({ error: 'Failed to generate questions' });
    }
});

// Generate single email preview
router.post('/generate-email-preview', requireAuth, async (req, res) => {
    try {
        const { contact, interviewTitle, emailTemplate, personalizationInstructions } = req.body;
        
        if (!contact || !emailTemplate) {
            return res.status(400).json({ error: 'Contact and email template are required' });
        }
        
        // Generate a single email preview
        const email = await generatePersonalizedEmailFromTemplate(
            contact,
            interviewTitle,
            req.user,
            emailTemplate,
            personalizationInstructions,
            '' // questionPrompt not needed for preview
        );
        
        res.json({ email });
        
    } catch (error) {
        console.error('Email preview generation error:', error);
        res.status(500).json({ error: 'Failed to generate email preview' });
    }
});

// Generate personalized emails
router.post('/generate-emails', requireAuth, async (req, res) => {
    try {
        const { contacts, interviewId, interviewTitle, emailTemplate, personalizationInstructions, questionPrompt } = req.body;
        
        if (!contacts || !Array.isArray(contacts)) {
            return res.status(400).json({ error: 'Contacts array is required' });
        }
        
        if (!emailTemplate || !emailTemplate.subject || !emailTemplate.body) {
            return res.status(400).json({ error: 'Email template with subject and body is required' });
        }
        
        const emails = [];
        
        // Process emails with small delay between requests to avoid rate limits
        for (let i = 0; i < contacts.length; i++) {
            const contact = contacts[i];
            
            // Add small delay between requests (except for first one)
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay = max 5 requests per second
            }
            
            const email = await generatePersonalizedEmailFromTemplate(
                contact,
                interviewTitle,
                req.user,
                emailTemplate,
                personalizationInstructions,
                questionPrompt
            );
            emails.push(email);
            
            // Log progress for large batches
            if ((i + 1) % 10 === 0) {
                console.log(`[Campaign] Generated ${i + 1}/${contacts.length} emails`);
            }
        }
        
        res.json({ emails });
        
    } catch (error) {
        console.error('Email generation error:', error);
        res.status(500).json({ error: 'Failed to generate emails' });
    }
});

// Send campaign
router.post('/send', requireAuth, async (req, res) => {
    try {
        const { interviewId, contacts, emails, settings } = req.body;
        
        if (!interviewId || !contacts || !emails || !settings) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Create campaign record
        const db = admin.firestore();
        const campaignId = uuidv4();
        const campaign = {
            id: campaignId,
            interviewId,
            name: settings.name,
            createdBy: req.user.uid,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            totalContacts: contacts.length,
            settings,
            status: 'active'
        };
        
        await db.collection('campaigns').doc(campaignId).set(campaign);
        
        // Queue emails for sending
        const batch = db.batch();
        const emailQueue = [];
        
        for (let i = 0; i < emails.length; i++) {
            const emailRef = db.collection('campaign_emails').doc();
            const emailId = emailRef.id;
            
            // Update interview link with campaign email ID for tracking
            const trackedInterviewLink = createInterviewLink(
                interviewId, 
                contacts[i], 
                contacts[i].personalizedQuestion,
                emailId
            );
            
            const emailDoc = {
                campaignId,
                contactId: contacts[i].id,
                to: emails[i].to,
                subject: emails[i].subject,
                body: emails[i].body,
                interviewLink: trackedInterviewLink,
                status: 'queued',
                scheduledFor: calculateSendTime(i, settings),
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };
            
            batch.set(emailRef, emailDoc);
            emailQueue.push(emailDoc);
        }
        
        await batch.commit();
        
        // Start sending if immediate
        if (settings.schedule === 'now') {
            // Trigger email sending process
            // This could be a Cloud Function or background job
            startEmailSending(campaignId, settings);
        }
        
        res.json({
            success: true,
            campaignId,
            message: `Campaign created with ${emails.length} emails queued`
        });
        
    } catch (error) {
        console.error('Campaign send error:', error);
        res.status(500).json({ error: 'Failed to send campaign' });
    }
});

// Helper functions

function createInterviewLink(interviewId, contact, personalizedQuestion, campaignEmailId = null) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    const params = new URLSearchParams({
        interview: interviewId,
        email: contact.email,
        name: contact.name,
        firstQuestion: personalizedQuestion
    });
    
    // Add the profile link as external context URL
    if (contact.link) {
        params.append('externalUrl', contact.link);
    }
    
    // Add context string ID if available (e.g., for Product Hunt comments)
    if (contact.contextStringId) {
        params.append('contextStringId', contact.contextStringId);
    }
    
    // Add campaign tracking ID if provided
    if (campaignEmailId) {
        params.append('ceid', campaignEmailId);
    }
    
    return `${baseUrl}/i/?${params.toString()}`;
}

async function generatePersonalizedQuestion(contact, profileContext, interviewContext, questionPrompt) {
    try {
        console.log(`[Campaign] Generating personalized question for ${contact.name}, profile context length: ${profileContext ? profileContext.length : 0}`);
        
        // Clean all string inputs to prevent JSON encoding issues
        const cleanedContact = {
            name: cleanStringForJSON(contact.name),
            title: cleanStringForJSON(contact.title),
            company: cleanStringForJSON(contact.company || ''),
            email: cleanStringForJSON(contact.email)
        };
        const cleanedProfileContext = cleanStringForJSON(profileContext);
        const cleanedInterviewContext = cleanStringForJSON(interviewContext);
        const cleanedQuestionPrompt = cleanStringForJSON(questionPrompt);
        
        const prompt = `Based on the following information about a potential interviewee and a specific question prompt, generate a personalized interview question.

Contact Information:
- Name: ${cleanedContact.name}
- Title: ${cleanedContact.title}
- Company: ${cleanedContact.company || 'Not specified'}
- Email: ${cleanedContact.email}

Profile Context (from their LinkedIn/website):
${cleanedProfileContext || 'No additional profile information available'}

Interview Context:
${cleanedInterviewContext || 'General interview about their professional experience and perspectives'}

User's Question Prompt:
${cleanedQuestionPrompt}

CRITICAL: You MUST:
1. Follow the user's question prompt while personalizing it for this specific person
2. Use specific details from the Profile Context to make the question highly relevant
3. Reference their actual experience, companies, projects, or achievements when possible
4. Keep the tone conversational and engaging
5. Make the question feel naturally tailored to them, not generic

Generate a single question that fulfills the user's prompt while being specifically tailored to ${cleanedContact.name}'s background and experience. The question should be 1-2 sentences maximum.

Return only the question text, no additional formatting or explanation.`;

        const requestBody = {
            model: 'claude-opus-4-5',
            max_tokens: 1324, // 1024 thinking + 300 for response
            thinking: {
                type: 'enabled',
                budget_tokens: 1024
            },
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            system: `You are an expert at crafting highly personalized outreach messages. Your task is to carefully analyze the Profile Context provided and use specific details from it to create genuinely personalized content. The Profile Context contains scraped data from the person's LinkedIn or website - use this information to show you've done your research. Never generate generic questions or messages.`
        };

        const data = await callClaudeWithRetry(requestBody);
        console.log(`[Campaign] Claude response for question:`, JSON.stringify(data, null, 2));
        
        if (!data || !data.content || !Array.isArray(data.content) || data.content.length === 0) {
            throw new Error('Invalid response structure from Claude API');
        }
        
        // Find the text content (skip thinking blocks)
        const textContent = data.content.find(item => item.type === 'text');
        if (!textContent || !textContent.text) {
            throw new Error('No text content in Claude response');
        }
        
        return textContent.text.trim();
        
    } catch (error) {
        console.error('Error generating personalized question:', error);
        // Fallback to template
        const firstName = contact.name.split(' ')[0];
        return `Hi ${firstName}, given your role as ${contact.title}, I'm curious about your perspective on the biggest challenges and opportunities in your field right now. What's top of mind for you?`;
    }
}

async function generatePersonalizedEmailFromTemplate(contact, interviewTitle, user, emailTemplate, personalizationInstructions, questionPrompt) {
    try {
        // Clean all inputs
        const cleanedContact = {
            name: cleanStringForJSON(contact.name),
            title: cleanStringForJSON(contact.title),
            company: cleanStringForJSON(contact.company || ''),
            email: cleanStringForJSON(contact.email),
            profileContext: cleanStringForJSON(contact.profileContext),
            personalizedQuestion: cleanStringForJSON(contact.personalizedQuestion),
            interviewLink: contact.interviewLink // URL, don't clean
        };
        
        const firstName = cleanedContact.name.split(' ')[0];
        const senderName = cleanStringForJSON(user.displayName || user.email.split('@')[0]);
        
        console.log(`[Campaign] Personalizing email template for ${cleanedContact.name}`);
        
        const prompt = `You have an email template that needs to be personalized for a specific recipient. Your task is to adapt this template to feel naturally personalized while maintaining the original intent and structure.

Email Template:
Subject: ${cleanStringForJSON(emailTemplate.subject)}
Body:
${cleanStringForJSON(emailTemplate.body)}

Recipient Information:
- Name: ${cleanedContact.name}
- First Name: ${firstName}
- Title: ${cleanedContact.title}
- Company: ${cleanedContact.company || 'Not specified'}
- Profile Context: ${cleanedContact.profileContext || 'No additional context'}
- Personalized Question: ${cleanedContact.personalizedQuestion || 'No question yet'}

Interview Details:
- Interview Title: ${cleanStringForJSON(interviewTitle)}
- Interview Link: ${cleanedContact.interviewLink}

Sender:
- Name: ${senderName}
- Email: ${user.email}

${personalizationInstructions ? `Personalization Instructions:
${cleanStringForJSON(personalizationInstructions)}

` : ''}CRITICAL REQUIREMENTS:
1. Replace any placeholders (e.g., [Name], [topic]) with appropriate personalized content
2. Add specific references to their background, company, or achievements from the Profile Context
3. Naturally incorporate the personalized question into the email
4. Maintain the overall structure and intent of the template
5. Make it feel like a genuinely personalized email, not a mass email
6. Keep the tone consistent with the template while adding personal touches
7. Include the interview link naturally in the flow

DO NOT:
- Change the core message or structure dramatically
- Make it overly long or add unnecessary content
- Use generic phrases like "as a [title]" without specifics
- Forget to include the interview link

Return your response in this exact format with the delimiter lines:
---SUBJECT---
Your personalized subject line here
---BODY---
Your personalized email body here
---END---`;

        const requestBody = {
            model: 'claude-opus-4-5',
            max_tokens: 1624, // 1024 thinking + 600 for response
            thinking: {
                type: 'enabled',
                budget_tokens: 1024
            },
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            system: `You are an expert at personalizing email templates. Your task is to take a user-written email template and adapt it for each specific recipient using their profile information. Maintain the user's voice and intent while adding genuine personalization that shows you understand the recipient's background and work.`
        };

        const data = await callClaudeWithRetry(requestBody);
        
        // Find the text content (skip thinking blocks)
        const textContent = data.content.find(item => item.type === 'text');
        if (!textContent || !textContent.text) {
            throw new Error('No text content in Claude response');
        }
        
        // Parse the delimiter-based format
        const responseText = textContent.text;
        const subjectMatch = responseText.match(/---SUBJECT---\s*\n(.*?)\n---BODY---/s);
        const bodyMatch = responseText.match(/---BODY---\s*\n([\s\S]*?)\n---END---/);
        
        if (!subjectMatch || !bodyMatch) {
            console.error(`[Campaign] Failed to parse email response. Expected format not found.`);
            throw new Error('Email response not in expected format');
        }
        
        return {
            to: contact.email,
            subject: subjectMatch[1].trim(),
            body: bodyMatch[1].trim()
        };
        
    } catch (error) {
        console.error('Error generating personalized email:', error);
        // Fallback to simple template filling
        const firstName = contact.name.split(' ')[0];
        const senderName = user.displayName || user.email.split('@')[0];
        
        let subject = emailTemplate.subject
            .replace(/\[Name\]/gi, firstName)
            .replace(/\[topic\]/gi, interviewTitle);
            
        let body = emailTemplate.body
            .replace(/\[Name\]/gi, firstName)
            .replace(/\[topic\]/gi, interviewTitle)
            .replace(/\[Your name\]/gi, senderName);
            
        // Add the interview link if not already in template
        if (!body.includes(contact.interviewLink)) {
            body += `\n\n${contact.interviewLink}`;
        }
        
        return {
            to: contact.email,
            subject,
            body
        };
    }
}

async function generatePersonalizedEmail(contact, interviewTitle, user, emailInstructions) {
    try {
        const firstName = contact.name.split(' ')[0];
        const senderName = user.displayName || user.email.split('@')[0];
        
        console.log(`[Campaign] Generating personalized email for ${contact.name}, profile context available: ${!!contact.profileContext}, length: ${contact.profileContext ? contact.profileContext.length : 0}`);
        
        const prompt = `Generate a personalized email invitation for an AI-powered interview. Make it warm, professional, and engaging.

Contact Information:
- Name: ${contact.name}
- First Name: ${firstName}
- Title: ${contact.title}
- Profile Context: ${contact.profileContext || 'No additional context'}
- Personalized Question: ${contact.personalizedQuestion || 'No question yet'}

Interview Details:
- Interview Title: ${interviewTitle}
- Interview Link: ${contact.interviewLink}

Sender:
- Name: ${senderName}
- Email: ${user.email}

${emailInstructions ? `Writing Instructions:
${emailInstructions}

` : ''}CRITICAL: You MUST use specific details from the Profile Context to personalize this email. Look for:
- Companies they've worked at
- Specific projects or achievements
- Technologies they specialize in
- Recent career moves or milestones
- Published articles or thought leadership
- Industry focus areas

Requirements:
1. Subject line MUST reference something specific from their profile (not just their title)
2. Opening MUST mention a specific detail about their work, project, or achievement
3. Connect their specific experience to why their perspective would be valuable
4. Briefly explain the value of participating (insights, thought leadership, etc.)
5. Mention it's AI-powered and takes 10-15 minutes
6. Naturally incorporate the personalized question to show relevance
7. Include the interview link naturally
8. Keep it concise (under 150 words)
9. Professional but conversational tone
10. End with a soft call-to-action

Example of good personalization:
- Subject: "Your microservices journey at Acme Corp caught my attention"
- Opening: "Hi Sarah, I was impressed by your work leading the cloud migration at Acme Corp..."

DO NOT write generic emails like:
- Subject: "Quick question about your expertise"
- Opening: "Hi [Name], As a [title], I thought you'd have valuable insights..."

Return your response in this exact format with the delimiter lines:
---SUBJECT---
Your subject line here
---BODY---
Your email body here with multiple paragraphs
and line breaks as needed
---END---`;

        const requestBody = {
            model: 'claude-opus-4-5',
            max_tokens: 1624, // 1024 thinking + 600 for response
            thinking: {
                type: 'enabled',
                budget_tokens: 1024
            },
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            system: `You are an expert at crafting highly personalized outreach emails. Your task is to carefully analyze the Profile Context provided and use specific details from it to create genuinely personalized content. The Profile Context contains scraped data from the person's LinkedIn or website - use this information to show you've done your research. Never generate generic emails. The subject line and opening must reference specific details from their profile.`
        };

        const data = await callClaudeWithRetry(requestBody);
        console.log(`[Campaign] Claude response for email:`, JSON.stringify(data, null, 2));
        
        if (!data || !data.content || !Array.isArray(data.content) || data.content.length === 0) {
            throw new Error('Invalid response structure from Claude API');
        }
        
        // Find the text content (skip thinking blocks)
        const textContent = data.content.find(item => item.type === 'text');
        if (!textContent || !textContent.text) {
            throw new Error('No text content in Claude response');
        }
        
        // Parse the delimiter-based format
        const responseText = textContent.text;
        const subjectMatch = responseText.match(/---SUBJECT---\s*\n(.*?)\n---BODY---/s);
        const bodyMatch = responseText.match(/---BODY---\s*\n([\s\S]*?)\n---END---/);
        
        if (!subjectMatch || !bodyMatch) {
            console.error(`[Campaign] Failed to parse email response. Expected format not found.`);
            console.error(`Response text:`, responseText);
            throw new Error('Email response not in expected format');
        }
        
        const emailContent = {
            subject: subjectMatch[1].trim(),
            body: bodyMatch[1].trim()
        };
        
        return {
            to: contact.email,
            subject: emailContent.subject,
            body: emailContent.body
        };
        
    } catch (error) {
        console.error('Error generating personalized email:', error);
        // Fallback to template
        const firstName = contact.name.split(' ')[0];
        const senderName = user.displayName || user.email.split('@')[0];
        
        return {
            to: contact.email,
            subject: `${firstName}, quick question about ${contact.title.toLowerCase()} perspectives`,
            body: `Hi ${firstName},

I noticed your work as ${contact.title} and found your background particularly interesting.

I'm conducting research on "${interviewTitle}" and would value your unique perspective.

I've prepared a brief AI-powered interview that adapts to your responses - it typically takes 10-15 minutes and provides valuable insights for both of us.

${contact.interviewLink}

Would you be open to sharing your thoughts?

Best regards,
${senderName}`
        };
    }
}

function calculateSendTime(index, settings) {
    if (settings.sendingStrategy === 'all' || settings.schedule === 'now') {
        return new Date();
    }
    
    const delayMinutes = (index * 60) / (settings.emailsPerHour || 20);
    const sendTime = new Date();
    sendTime.setMinutes(sendTime.getMinutes() + delayMinutes);
    return sendTime;
}

async function startEmailSending(campaignId, settings) {
    // Trigger immediate processing if campaign sender is available
    try {
        const campaignSender = require('../utils/campaign-sender');
        console.log(`[Campaign] Triggering immediate send for campaign ${campaignId}`);
        
        // Process queue immediately
        setImmediate(() => {
            campaignSender.processQueue();
        });
    } catch (error) {
        console.error('[Campaign] Error triggering campaign sender:', error);
    }
}

// Get campaign analytics
router.get('/analytics/:campaignId', requireAuth, async (req, res) => {
    try {
        const { campaignId } = req.params;
        const db = admin.firestore();
        
        // Get campaign
        const campaignDoc = await db.collection('campaigns').doc(campaignId).get();
        if (!campaignDoc.exists) {
            return res.status(404).json({ error: 'Campaign not found' });
        }
        
        const campaign = campaignDoc.data();
        
        // Check authorization
        if (campaign.createdBy !== req.user.uid) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        // Get email statistics
        const emailStats = await db.collection('campaign_emails')
            .where('campaignId', '==', campaignId)
            .get();
        
        const stats = {
            total: emailStats.size,
            sent: 0,
            opened: 0,
            clicked: 0,
            interviewStarted: 0,
            interviewCompleted: 0,
            failed: 0,
            queued: 0
        };
        
        const emailDetails = [];
        
        emailStats.forEach(doc => {
            const email = doc.data();
            stats[email.status]++;
            
            if (email.openedAt) stats.opened++;
            if (email.clickedAt) stats.clicked++;
            if (email.interviewStartedAt) stats.interviewStarted++;
            if (email.interviewCompletedAt) stats.interviewCompleted++;
            
            emailDetails.push({
                id: doc.id,
                to: email.to,
                status: email.status,
                sentAt: email.sentAt,
                openedAt: email.openedAt,
                clickedAt: email.clickedAt,
                interviewStartedAt: email.interviewStartedAt,
                interviewCompletedAt: email.interviewCompletedAt,
                contactId: email.contactId
            });
        });
        
        // Calculate rates
        const rates = {
            openRate: stats.sent > 0 ? (stats.opened / stats.sent * 100).toFixed(1) : 0,
            clickRate: stats.sent > 0 ? (stats.clicked / stats.sent * 100).toFixed(1) : 0,
            startRate: stats.clicked > 0 ? (stats.interviewStarted / stats.clicked * 100).toFixed(1) : 0,
            completionRate: stats.interviewStarted > 0 ? (stats.interviewCompleted / stats.interviewStarted * 100).toFixed(1) : 0
        };
        
        res.json({
            campaign: {
                id: campaignId,
                name: campaign.name,
                interviewId: campaign.interviewId,
                createdAt: campaign.createdAt,
                totalContacts: campaign.totalContacts,
                settings: campaign.settings
            },
            stats,
            rates,
            emails: emailDetails
        });
        
    } catch (error) {
        console.error('Campaign analytics error:', error);
        res.status(500).json({ error: 'Failed to get campaign analytics' });
    }
});

// Track email opens (pixel tracking)
router.get('/track/open/:emailId', async (req, res) => {
    try {
        const { emailId } = req.params;
        const db = admin.firestore();
        
        // Update email record
        await db.collection('campaign_emails').doc(emailId).update({
            openedAt: admin.firestore.FieldValue.serverTimestamp(),
            opens: admin.firestore.FieldValue.increment(1)
        });
        
        // Return 1x1 transparent pixel
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.writeHead(200, {
            'Content-Type': 'image/gif',
            'Content-Length': pixel.length,
            'Cache-Control': 'no-store, no-cache, must-revalidate, private'
        });
        res.end(pixel);
        
    } catch (error) {
        console.error('Email tracking error:', error);
        res.status(200).end(); // Still return success to not break email display
    }
});

// Track link clicks
router.get('/track/click/:emailId', async (req, res) => {
    try {
        const { emailId } = req.params;
        const { url } = req.query;
        const db = admin.firestore();
        
        if (!url) {
            return res.status(400).send('Missing redirect URL');
        }
        
        // Update email record
        await db.collection('campaign_emails').doc(emailId).update({
            clickedAt: admin.firestore.FieldValue.serverTimestamp(),
            clicks: admin.firestore.FieldValue.increment(1)
        });
        
        // Redirect to actual interview link
        res.redirect(url);
        
    } catch (error) {
        console.error('Link tracking error:', error);
        // Still redirect even if tracking fails
        if (req.query.url) {
            res.redirect(req.query.url);
        } else {
            res.status(500).send('Tracking error');
        }
    }
});

// Get all campaigns for a user
router.get('/list', requireAuth, async (req, res) => {
    try {
        const db = admin.firestore();
        const campaignsSnapshot = await db.collection('campaigns')
            .where('createdBy', '==', req.user.uid)
            .orderBy('createdAt', 'desc')
            .limit(50)
            .get();
        
        const campaigns = [];
        
        for (const doc of campaignsSnapshot.docs) {
            const campaign = doc.data();
            
            // Get basic stats
            const emailStats = await db.collection('campaign_emails')
                .where('campaignId', '==', doc.id)
                .get();
            
            const stats = {
                total: emailStats.size,
                sent: 0,
                opened: 0,
                clicked: 0
            };
            
            emailStats.forEach(emailDoc => {
                const email = emailDoc.data();
                if (email.status === 'sent') stats.sent++;
                if (email.openedAt) stats.opened++;
                if (email.clickedAt) stats.clicked++;
            });
            
            campaigns.push({
                id: doc.id,
                name: campaign.name,
                interviewId: campaign.interviewId,
                createdAt: campaign.createdAt,
                totalContacts: campaign.totalContacts,
                status: campaign.status,
                stats
            });
        }
        
        res.json({ campaigns });
        
    } catch (error) {
        console.error('List campaigns error:', error);
        res.status(500).json({ error: 'Failed to list campaigns' });
    }
});

// Simple in-memory cache for Product Hunt searches (expires after 15 minutes)
const productHuntCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// Search Product Hunt for products and their makers
router.post('/search-producthunt', requireAuth, async (req, res) => {
    try {
        const { fromDate, toDate, minVotes, maxVotes } = req.body;
        
        if (!fromDate || !toDate) {
            return res.status(400).json({ error: 'Date range is required' });
        }
        
        const productHuntToken = process.env.PRODUCT_HUNT_DEVELOPER_TOKEN;
        if (!productHuntToken) {
            console.error('[Campaign] Product Hunt developer token not configured');
            return res.status(500).json({ 
                error: 'Product Hunt API not configured',
                message: 'Please add PRODUCT_HUNT_DEVELOPER_TOKEN to your .env file. See docs/PRODUCT_HUNT_SETUP.md for instructions.'
            });
        }
        
        // Calculate days in range
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        const days = [];
        
        // Create array of individual days
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            days.push(new Date(d).toISOString().split('T')[0]);
        }
        
        console.log(`[Campaign] Searching Product Hunt for ${days.length} days: ${fromDate} to ${toDate}`);
        
        const query = `
            query($postedAfter: DateTime!, $postedBefore: DateTime!, $first: Int!, $after: String, $order: PostsOrder!) {
                posts(postedAfter: $postedAfter, postedBefore: $postedBefore, first: $first, after: $after, order: $order) {
                    edges {
                        node {
                            id
                            name
                            tagline
                            votesCount
                            website
                            url
                            makers {
                                id
                                name
                                username
                                websiteUrl
                                headline
                            }
                            comments(first: 10) {
                                edges {
                                    node {
                                        body
                                        user {
                                            id
                                            username
                                        }
                                    }
                                }
                            }
                        }
                    }
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                }
            }
        `;
        
        const allProducts = [];
        const productsPerDay = 50; // Take top 50 from each day
        
        // Process each day individually
        for (const day of days) {
            console.log(`[Campaign] Fetching products for ${day}...`);
            
            // Check cache for this specific day
            const cacheKey = `day-${day}`;
            const cached = productHuntCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
                console.log(`[Campaign] Using cached data for ${day}`);
                allProducts.push(...cached.products);
                continue;
            }
            const response = await fetch('https://api.producthunt.com/v2/api/graphql', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${productHuntToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query,
                    variables: {
                        postedAfter: day + 'T00:00:00Z',
                        postedBefore: day + 'T23:59:59Z',
                        first: productsPerDay,
                        after: null,
                        order: 'VOTES' // Always sort by votes to get top products
                    }
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Campaign] Product Hunt API error:', response.status, errorText);
                
                // Check for rate limit
                if (response.status === 429) {
                    throw new Error('Product Hunt API rate limit reached. Please try again in a few minutes.');
                }
                
                throw new Error(`Product Hunt API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.errors) {
                console.error('[Campaign] Product Hunt GraphQL errors:', data.errors);
                throw new Error('Product Hunt API query failed');
            }
            
            const dayProducts = data.data.posts.edges;
            console.log(`[Campaign] Found ${dayProducts.length} products for ${day}`);
            
            if (dayProducts.length > 0) {
                const firstVoteCount = dayProducts[0].node.votesCount;
                const lastVoteCount = dayProducts[dayProducts.length - 1].node.votesCount;
                console.log(`[Campaign] Vote range for ${day}: ${firstVoteCount} → ${lastVoteCount}`);
            }
            
            const productsForDay = [];
            
            // Process each product for this day
            for (const edge of dayProducts) {
                const post = edge.node;
                
                // Find the primary maker (first one)
                const primaryMaker = post.makers[0];
                if (!primaryMaker) continue;
                
                // Find the maker's first comment on the post
                let makerComment = '';
                if (post.comments.edges.length > 0) {
                    // Check if the comment is from one of the makers
                    for (const commentEdge of post.comments.edges) {
                        const comment = commentEdge.node;
                        const isMakerComment = post.makers.some(maker => 
                            maker.username === comment.user.username
                        );
                        if (isMakerComment) {
                            makerComment = comment.body;
                            break;
                        }
                    }
                }
                
                // If no maker comment found, try to get the tagline as fallback
                if (!makerComment) {
                    makerComment = post.tagline || '';
                }
                
                const productData = {
                    id: post.id,
                    name: post.name,
                    votesCount: post.votesCount,
                    website: post.website || post.url,
                    hunter: {
                        name: primaryMaker.name,
                        username: primaryMaker.username,
                        websiteUrl: primaryMaker.websiteUrl || post.website || post.url,
                        comment: makerComment
                    }
                };
                
                // Add to day's products
                productsForDay.push(productData);
            }
            
            // Cache this day's products
            productHuntCache.set(cacheKey, {
                products: productsForDay,
                timestamp: Date.now()
            });
            
            // Add to overall products
            allProducts.push(...productsForDay);
        }
        
        // Sort all products by votes (highest first) and filter by vote range
        allProducts.sort((a, b) => b.votesCount - a.votesCount);
        
        const products = allProducts.filter(p => {
            if (p.votesCount < (minVotes || 0)) return false;
            if (maxVotes && p.votesCount > maxVotes) return false;
            return true;
        });
        
        // Add warnings or suggestions
        let searchHint = null;
        if (products.length === 0 && allProducts.length > 0) {
            searchHint = `Few products found with <${maxVotes} votes. Try a more recent date range when products have fewer votes.`;
        } else if (products.length === 0 && maxVotes && maxVotes <= 100) {
            searchHint = `No products found with <${maxVotes} votes in this date range. Try searching the last 3 days or today only.`;
        }
        
        console.log(`[Campaign] Product Hunt search complete:`, {
            dateRange: `${fromDate} to ${toDate}`,
            voteRange: `${minVotes || 0} to ${maxVotes || 'unlimited'}`,
            daysSearched: days.length,
            totalProducts: allProducts.length,
            productsMatched: products.length
        });
        
        res.json({ 
            products,
            total: products.length,
            searchHint
        });
        
    } catch (error) {
        console.error('Product Hunt search error:', error);
        res.status(500).json({ error: 'Failed to search Product Hunt' });
    }
});

module.exports = router;