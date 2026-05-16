// Report Content Formatting
export function formatMagazineContent(content, reportTitle = null, reportMetadata = {}) {
    // Extract content from specific tags if they exist
    const finalReportMatch = content.match(/<final_report>([\s\S]*?)<\/final_report>/i);
    const magazineProfileMatch = content.match(/<magazine_profile>([\s\S]*?)<\/magazine_profile>/i);
    const reportDraftMatch = content.match(/<report_draft>([\s\S]*?)<\/report_draft>/i);
    
    // Check for content in various possible tag formats
    let contentToRender = content;
    
    if (finalReportMatch && finalReportMatch[1]) {
        contentToRender = finalReportMatch[1];
        console.log('Found and extracted content from <final_report> tags');
    } else if (magazineProfileMatch && magazineProfileMatch[1]) {
        contentToRender = magazineProfileMatch[1];
        console.log('Found and extracted content from <magazine_profile> tags');
    } else if (reportDraftMatch && reportDraftMatch[1]) {
        contentToRender = reportDraftMatch[1];
        console.log('Found and extracted content from <report_draft> tags');
    } else {
        console.log('No specific tags found, using full content');
    }
    
    // Extract adoption category and anxiety level if present
    const adoptionCategoryMatch = contentToRender.match(/<adoption_category>(.*?)<\/adoption_category>/i);
    const anxietyLevelMatch = contentToRender.match(/<anxiety_level>(.*?)<\/anxiety_level>/i);
    
    let adoptionCategory = adoptionCategoryMatch ? adoptionCategoryMatch[1].trim() : null;
    let anxietyLevel = anxietyLevelMatch ? anxietyLevelMatch[1].trim() : null;
    
    // Remove the tags from the content
    contentToRender = contentToRender
        .replace(/<adoption_category>.*?<\/adoption_category>/i, '')
        .replace(/<anxiety_level>.*?<\/anxiety_level>/i, '')
        .trim();
    
    // Process <audio_clip> tags into blockquotes, parsing inner content as markdown
    contentToRender = contentToRender.replace(
        /<audio_clip[^>]*>([\s\S]*?)<\/audio_clip>/gi,
        (match, audioContent) => {
            const contentStr = String(audioContent || "").trim();
            if (!contentStr) return "";
            // Parse the inner content of the audio_clip as Markdown
            const parsedClipContent = marked.parse(contentStr);
            // Return as an HTML blockquote
            return `<blockquote>${parsedClipContent.trim()}</blockquote>`;
        }
    );
    
    // Clean up the content - handle any non-markdown text and common issues
    contentToRender = contentToRender.trim();
    
    // If content starts with a markdown heading, we assume it's already in markdown format
    if (!contentToRender.trim().startsWith('#') && 
        !contentToRender.trim().startsWith('<h1') && 
        !contentToRender.trim().startsWith('<h2')) {
        
        // Look for potential titles and add heading if found
        const potentialTitle = contentToRender.split('\n')[0];
        if (potentialTitle && potentialTitle.length < 100) {
            // Extract the first line as title, add markdown heading
            const remainingContent = contentToRender.substring(potentialTitle.length).trim();
            contentToRender = `# ${potentialTitle}\n\n${remainingContent}`;
            console.log('Added heading to content');
        } else {
            // Wrap plain text in markdown formatting with report title or default
            const titleToUse = reportTitle || 'Individual Summary';
            contentToRender = `# ${titleToUse}\n\n${contentToRender}`;
            console.log(`Added title to content: ${titleToUse}`);
        }
    }
    
    // Configure marked for better output
    marked.use({
        breaks: true,
        gfm: true,
        headerIds: false,
        headerPrefix: false
    });
    
    // Process the content with marked
    console.log('Parsing markdown, content length:', contentToRender.length);
    const html = marked.parse(contentToRender);
    console.log('Markdown parsed successfully, HTML length:', html.length);
    
    // Enhance the HTML with additional classes for better styling
    let enhancedHtml = html
        // Add custom classes to headings
        .replace(/<h1>(.*?)<\/h1>/g, '<h1 class="text-3xl font-bold mb-8">$1</h1>')
        .replace(/<h2>(.*?)<\/h2>/g, '<h2 class="text-2xl font-semibold my-6">$1</h2>')
        .replace(/<h3>(.*?)<\/h3>/g, '<h3 class="text-xl font-semibold my-4">$1</h3>')
        // Enhance lists
        .replace(/<ul>/g, '<ul class="my-4 ml-6">')
        .replace(/<li>/g, '<li class="mb-2">')
        // Add classes to paragraphs
        .replace(/<p>(.*?)<\/p>/g, '<p class="mb-4">$1</p>');
    
    // Create profile header with adoption and anxiety information if available
    let profileHeader = '';
    if (adoptionCategory || anxietyLevel) {
        profileHeader = `<div class="profile-header">`;
        
        if (adoptionCategory) {
            // Add icon based on adoption category
            let adoptionIcon = '📈'; // Default icon
            switch(adoptionCategory) {
                case 'Innovator':
                    adoptionIcon = '🚀';
                    break;
                case 'Early Adopter':
                    adoptionIcon = '🔍';
                    break;
                case 'Early Majority':
                    adoptionIcon = '🌱';
                    break;
                case 'Late Majority':
                    adoptionIcon = '⏱️';
                    break;
                case 'Laggard':
                    adoptionIcon = '🏛️';
                    break;
            }
            
            profileHeader += `<span class="profile-tag adoption-tag"><span class="profile-tag-icon">${adoptionIcon}</span>Adoption Group: ${adoptionCategory}</span>`;
        }
        
        if (anxietyLevel) {
            // Add icon based on anxiety level
            let anxietyIcon = '🧠'; // Default icon
            switch(anxietyLevel) {
                case 'High':
                    anxietyIcon = '😟';
                    break;
                case 'Moderate':
                    anxietyIcon = '😐';
                    break;
                case 'Low':
                    anxietyIcon = '😊';
                    break;
            }
            
            profileHeader += `<span class="profile-tag anxiety-tag"><span class="profile-tag-icon">${anxietyIcon}</span> AI Anxiety: ${anxietyLevel}</span>`;
        }
        
        profileHeader += `</div>`;
    }
    
    // Add metadata (creator and timestamp) after the title
    let metadataHtml = '';
    if (reportMetadata.user_name || reportMetadata.start_timestamp) {
        metadataHtml = '<div class="report-metadata" style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border-color);">';
        
        if (reportMetadata.user_name) {
            metadataHtml += `<div class="metadata-item">Created by: <span style="color: var(--text-primary);">${reportMetadata.user_name}</span></div>`;
        }
        
        if (reportMetadata.start_timestamp) {
            const date = new Date(reportMetadata.start_timestamp);
            const formattedDate = date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            metadataHtml += `<div class="metadata-item">Created on: <span style="color: var(--text-primary);">${formattedDate}</span></div>`;
        }
        
        metadataHtml += '</div>';
    }
    
    // Insert metadata after the first H1
    if (metadataHtml) {
        const h1Match = enhancedHtml.match(/<h1[^>]*>.*?<\/h1>/i);
        if (h1Match) {
            const h1Index = enhancedHtml.indexOf(h1Match[0]);
            const afterH1Index = h1Index + h1Match[0].length;
            enhancedHtml = enhancedHtml.slice(0, afterH1Index) + metadataHtml + enhancedHtml.slice(afterH1Index);
            console.log('Inserted metadata after H1');
        }
    }
    
    // Add user note (admin's personal thank you) at the beginning if present
    let userNoteHtml = '';
    if (reportMetadata.user_note) {
        userNoteHtml = `
            <div class="user-note-section" style="
                margin-bottom: 2rem;
                padding: 1.5rem;
                background: rgba(255, 255, 255, 0.05);
                border-left: 3px solid #8B5CF6;
                border-radius: 8px;
            ">
                <div style="
                    font-size: 0.9rem;
                    line-height: 1.6;
                    color: var(--text-secondary);
                    white-space: pre-wrap;
                ">${reportMetadata.user_note}</div>
                <div style="
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                    font-size: 0.85rem;
                    color: var(--text-secondary);
                    font-style: italic;
                ">- ${reportMetadata.user_name || 'The Team'}</div>
            </div>
            <div style="
                margin-bottom: 2rem;
                text-align: center;
                color: var(--text-secondary);
                font-size: 0.85rem;
            ">
                <div style="display: inline-flex; align-items: center; gap: 1rem;">
                    <span style="height: 1px; width: 30px; background: var(--border-color);"></span>
                    <span>Forwarded Report</span>
                    <span style="height: 1px; width: 30px; background: var(--border-color);"></span>
                </div>
            </div>
        `;
        console.log('Prepared user note for beginning of report');
    }
    
    // Add profile header to the enhanced HTML
    if (profileHeader) {
        // Prepend profileHeader if it exists
        enhancedHtml = profileHeader + enhancedHtml;
        console.log('Prepended profile header to content');
    } else {
        console.log('No profile header to prepend');
    }
    
    // Add user note at the beginning
    if (userNoteHtml) {
        enhancedHtml = userNoteHtml + enhancedHtml;
        console.log('Added user note to beginning of report');
    }
    
    return `<div class="report-wrapper">${enhancedHtml}</div>`;
}

export function convertSimpleHtmlToMarkdown(html) {
    let markdown = html
        // Replace headings
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
        // Replace paragraphs
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        // Replace lists
        .replace(/<ul[^>]*>(.*?)<\/ul>/gi, '$1\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '* $1\n')
        // Replace bold and italic
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '* $1 *')
        // Replace links
        .replace(/<a[^>]*href="(.*?)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
        // Replace breaks
        .replace(/<br\s*\/?>/gi, '\n')
        // Strip remaining tags
        .replace(/<[^>]*>/g, '')
        // Fix spacing
        .replace(/\n\s*\n/g, '\n\n');
    
    return markdown;
}