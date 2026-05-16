// Report Generation Module
// Simple version that works exactly like the previous implementation

const escapeXml = (text) => {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
};

/**
 * Builds a report prompt using simple template replacement
 * This matches the exact behavior from before the complex system was added
 * @param {Object} options - Report generation options
 * @returns {string} - The complete report prompt
 */
function buildPersonalizedReportPrompt(options) {
    const {
        customReportPrompt,
        contextData,
        qaXml,
        firstName
    } = options;

    // If there's a custom prompt, use it with simple replacements
    if (customReportPrompt) {
        return customReportPrompt
            .replace('{{CONTEXT}}', contextData || '')
            .replace('{{QA_CONTENT}}', qaXml)
            .replace('{{RESUME}}', contextData || '')
            .replace('{{FIRSTNAME}}', firstName || 'the interviewee');
    }
    
    // Otherwise use the default PAIRR prompt
    return `You are an AI career coach specializing in preparing professionals for the "intelligence age" - an era dominated by artificial intelligence and rapid technological advancements. Your task is to create a personalized, engaging "Personal AI Readiness Report" (PAIRR) that assesses how prepared an individual is to thrive in an AI-transformed workplace.

First, carefully review the following information:
<context>
${contextData || 'Context not provided'}
</context>
<qa_content>
${qaXml} 
</qa_content>

Within the <qa_content>, each interviewee answer is in an <answer> tag containing their response.

Your generated report should be structured as a narrative. When you incorporate direct quotes from the interviewee (from the <answer> tags in <qa_content>), integrate them naturally into your analysis.

THEORY OF CHANGE:
To thrive in the AI age, people need to invest in three critical areas:
`;
}

/**
 * Prepares Q&A pairs in XML format for the prompt
 */
function prepareQAXml(qaPairs) {
    let qaXml = '';
    qaPairs.forEach(pair => {
        qaXml += `<qa_pair>\n`;
        qaXml += `  <question>${escapeXml(pair.question)}</question>\n`;
        if (pair.audio_signed_url) {
            qaXml += `  <answer audio_response_id="${escapeXml(pair.id)}">${escapeXml(pair.answer)}</answer>\n`;
        } else {
            qaXml += `  <answer>${escapeXml(pair.answer)}</answer>\n`;
        }
        qaXml += `</qa_pair>\n\n`;
    });
    return qaXml;
}

module.exports = {
    buildPersonalizedReportPrompt,
    prepareQAXml,
    escapeXml
};