// Template Statistics Backfill Utility
// This script can be run to update usage statistics for existing templates

// Function to backfill template statistics
async function backfillTemplateStatistics() {
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    if (!db || !auth.currentUser) {
        console.error('Firebase not available or user not authenticated');
        return;
    }
    
    console.log('Starting template statistics backfill...');
    
    try {
        // Get all templates
        const templatesSnapshot = await db.collection('templates').get();
        
        if (templatesSnapshot.empty) {
            console.log('No templates found to backfill');
            return;
        }
        
        console.log(`Found ${templatesSnapshot.size} templates to process`);
        
        for (const templateDoc of templatesSnapshot.docs) {
            const templateData = templateDoc.data();
            const templateId = templateDoc.id;
            
            console.log(`Processing template: ${templateData.title || 'Untitled'} (${templateId})`);
            
            // Initialize stats if they don't exist
            if (!templateData.usageStats) {
                await db.collection('templates').doc(templateId).update({
                    usageStats: {
                        totalInterviewsCreated: 0,
                        totalInterviewsCompleted: 0,
                        lastUsedAt: null,
                        lastCompletedAt: null
                    }
                });
                console.log(`  - Initialized usage stats for template ${templateId}`);
            }
            
            // Count interviews created from this template
            const interviewsFromTemplate = await db.collection('interviews')
                .where('sourceTemplateId', '==', templateId)
                .get();
            
            const totalCreated = interviewsFromTemplate.size;
            console.log(`  - Found ${totalCreated} interviews created from this template`);
            
            // Count completed interviews from this template AND from the original interview
            let totalCompleted = 0;
            let lastCompletedAt = null;
            let lastUsedAt = null;
            
            // Track interviews created from template
            for (const interviewDoc of interviewsFromTemplate.docs) {
                const interviewData = interviewDoc.data();
                const interviewId = interviewDoc.id;
                
                // Update lastUsedAt based on interview creation time
                if (interviewData.createdAt) {
                    if (!lastUsedAt || interviewData.createdAt.toDate() > lastUsedAt.toDate()) {
                        lastUsedAt = interviewData.createdAt;
                    }
                }
                
                // Check for completed reports for this interview
                const reportsSnapshot = await db.collection('reports')
                    .where('interview_id', '==', interviewId)
                    .where('status', '==', 'completed')
                    .get();
                
                if (!reportsSnapshot.empty) {
                    totalCompleted += reportsSnapshot.size;
                    
                    // Find the most recent completion
                    reportsSnapshot.forEach(reportDoc => {
                        const reportData = reportDoc.data();
                        const completionTime = reportData.end_timestamp || reportData.start_timestamp;
                        
                        if (completionTime && (!lastCompletedAt || completionTime.toDate() > lastCompletedAt.toDate())) {
                            lastCompletedAt = completionTime;
                        }
                    });
                }
            }
            
            // Also count completed interviews from the original interview ID
            if (templateData.originalInterviewId) {
                console.log(`  - Checking completions for original interview: ${templateData.originalInterviewId}`);
                const originalReportsSnapshot = await db.collection('reports')
                    .where('interview_id', '==', templateData.originalInterviewId)
                    .where('status', '==', 'completed')
                    .get();
                
                if (!originalReportsSnapshot.empty) {
                    const originalCompletions = originalReportsSnapshot.size;
                    totalCompleted += originalCompletions;
                    console.log(`  - Found ${originalCompletions} completions from original interview`);
                    
                    // Find the most recent completion from original interview
                    originalReportsSnapshot.forEach(reportDoc => {
                        const reportData = reportDoc.data();
                        const completionTime = reportData.end_timestamp || reportData.start_timestamp;
                        
                        if (completionTime && (!lastCompletedAt || completionTime.toDate() > lastCompletedAt.toDate())) {
                            lastCompletedAt = completionTime;
                        }
                    });
                }
            }
            
            console.log(`  - Found ${totalCompleted} completed interviews`);
            
            // Update the template with calculated statistics
            const updateData = {
                'usageStats.totalInterviewsCreated': totalCreated,
                'usageStats.totalInterviewsCompleted': totalCompleted
            };
            
            if (lastUsedAt) {
                updateData['usageStats.lastUsedAt'] = lastUsedAt;
            }
            
            if (lastCompletedAt) {
                updateData['usageStats.lastCompletedAt'] = lastCompletedAt;
            }
            
            await db.collection('templates').doc(templateId).update(updateData);
            
            console.log(`  - Updated template ${templateId} with stats: ${totalCreated} created, ${totalCompleted} completed`);
        }
        
        console.log('Template statistics backfill completed successfully!');
        
    } catch (error) {
        console.error('Error during template statistics backfill:', error);
    }
}

// Function to backfill source template tracking for existing interviews
async function backfillInterviewTemplateTracking() {
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    if (!db || !auth.currentUser) {
        console.error('Firebase not available or user not authenticated');
        return;
    }
    
    console.log('Starting interview template tracking backfill...');
    
    try {
        // Get all templates to build a mapping
        const templatesSnapshot = await db.collection('templates').get();
        const templateMap = new Map();
        
        templatesSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.originalInterviewId) {
                templateMap.set(data.originalInterviewId, {
                    templateId: doc.id,
                    templateCreatedBy: data.templateCreatedBy
                });
            }
        });
        
        console.log(`Found ${templateMap.size} templates with original interview IDs`);
        
        // Get all interviews that might need template tracking
        const interviewsSnapshot = await db.collection('interviews')
            .where('createdBy', '==', auth.currentUser.uid)
            .get();
        
        let updatedCount = 0;
        
        for (const interviewDoc of interviewsSnapshot.docs) {
            const interviewData = interviewDoc.data();
            const interviewId = interviewDoc.id;
            
            // Skip if already has template tracking
            if (interviewData.sourceTemplateId) {
                continue;
            }
            
            // Try to match based on title patterns or other heuristics
            // This is a best-effort approach for existing data
            const title = interviewData.title || '';
            
            // Look for interviews that might have been created from templates
            // (This is heuristic-based and may not catch all cases)
            for (const [originalInterviewId, templateInfo] of templateMap.entries()) {
                // You could add more sophisticated matching logic here
                // For now, we'll be conservative and only update if we're confident
                
                // Example: if the interview was created by someone other than the template creator
                // and has a similar title structure, it might be from a template
                if (interviewData.createdBy !== templateInfo.templateCreatedBy) {
                    // This is a potential candidate, but we need more evidence
                    // For safety, we'll skip automatic backfilling of this data
                    // and only track going forward
                    continue;
                }
            }
        }
        
        console.log(`Updated ${updatedCount} interviews with template tracking`);
        console.log('Note: Existing interviews without clear template lineage were not modified for safety');
        
    } catch (error) {
        console.error('Error during interview template tracking backfill:', error);
    }
}

// Function to update existing template stats to include original interview completions
async function updateTemplateStatsWithOriginalCompletions() {
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    if (!db || !auth.currentUser) {
        console.error('Firebase not available or user not authenticated');
        return;
    }
    
    console.log('Updating template statistics to include original interview completions...');
    
    try {
        // Get all templates that have an originalInterviewId
        const templatesSnapshot = await db.collection('templates')
            .where('originalInterviewId', '!=', null)
            .get();
        
        if (templatesSnapshot.empty) {
            console.log('No templates with original interview IDs found');
            return;
        }
        
        console.log(`Found ${templatesSnapshot.size} templates with original interview IDs`);
        
        for (const templateDoc of templatesSnapshot.docs) {
            const templateData = templateDoc.data();
            const templateId = templateDoc.id;
            const originalInterviewId = templateData.originalInterviewId;
            
            console.log(`Processing template: ${templateData.title || 'Untitled'} (${templateId})`);
            console.log(`  - Original interview ID: ${originalInterviewId}`);
            
            // Get current stats
            const currentStats = templateData.usageStats || {};
            let currentCompleted = currentStats.totalInterviewsCompleted || 0;
            let lastCompletedAt = currentStats.lastCompletedAt;
            
            // Count completions from the original interview
            const originalReportsSnapshot = await db.collection('reports')
                .where('interview_id', '==', originalInterviewId)
                .where('status', '==', 'completed')
                .get();
            
            if (!originalReportsSnapshot.empty) {
                const originalCompletions = originalReportsSnapshot.size;
                console.log(`  - Found ${originalCompletions} completions from original interview`);
                
                // Find the most recent completion from original interview
                originalReportsSnapshot.forEach(reportDoc => {
                    const reportData = reportDoc.data();
                    const completionTime = reportData.end_timestamp || reportData.start_timestamp;
                    
                    if (completionTime && (!lastCompletedAt || completionTime.toDate() > lastCompletedAt.toDate())) {
                        lastCompletedAt = completionTime;
                    }
                });
                
                // Update the template with the new total (this will include both template-created and original completions)
                const updateData = {
                    'usageStats.totalInterviewsCompleted': currentCompleted + originalCompletions
                };
                
                if (lastCompletedAt) {
                    updateData['usageStats.lastCompletedAt'] = lastCompletedAt;
                }
                
                await db.collection('templates').doc(templateId).update(updateData);
                
                console.log(`  - Updated template ${templateId}: ${currentCompleted} -> ${currentCompleted + originalCompletions} total completions`);
            } else {
                console.log(`  - No completions found for original interview ${originalInterviewId}`);
            }
        }
        
        console.log('Template statistics update completed successfully!');
        
    } catch (error) {
        console.error('Error updating template statistics with original completions:', error);
    }
}

// Function to debug a specific template's statistics
async function debugTemplateStats(templateId) {
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    if (!db || !auth.currentUser) {
        console.error('Firebase not available or user not authenticated');
        return;
    }
    
    if (!templateId) {
        console.error('Please provide a template ID');
        return;
    }
    
    console.log(`🔍 Debugging template statistics for: ${templateId}`);
    
    try {
        // Get the template
        const templateDoc = await db.collection('templates').doc(templateId).get();
        
        if (!templateDoc.exists) {
            console.error('❌ Template not found');
            return;
        }
        
        const templateData = templateDoc.data();
        console.log('📋 Template data:', {
            title: templateData.title,
            originalInterviewId: templateData.originalInterviewId,
            currentStats: templateData.usageStats
        });
        
        // Check interviews created from this template
        const interviewsFromTemplate = await db.collection('interviews')
            .where('sourceTemplateId', '==', templateId)
            .get();
        
        console.log(`📊 Interviews created from template: ${interviewsFromTemplate.size}`);
        
        let templateCompletions = 0;
        for (const interviewDoc of interviewsFromTemplate.docs) {
            const interviewData = interviewDoc.data();
            const interviewId = interviewDoc.id;
            
            const reportsSnapshot = await db.collection('reports')
                .where('interview_id', '==', interviewId)
                .where('status', '==', 'completed')
                .get();
            
            if (!reportsSnapshot.empty) {
                templateCompletions += reportsSnapshot.size;
                console.log(`  ✅ Interview ${interviewId} (${interviewData.title}): ${reportsSnapshot.size} completions`);
            }
        }
        
        console.log(`📈 Total completions from template-created interviews: ${templateCompletions}`);
        
        // Check completions from original interview
        let originalCompletions = 0;
        if (templateData.originalInterviewId) {
            console.log(`🔍 Checking original interview: ${templateData.originalInterviewId}`);
            
            const originalReportsSnapshot = await db.collection('reports')
                .where('interview_id', '==', templateData.originalInterviewId)
                .where('status', '==', 'completed')
                .get();
            
            originalCompletions = originalReportsSnapshot.size;
            console.log(`📈 Completions from original interview: ${originalCompletions}`);
            
            if (originalCompletions > 0) {
                console.log('📝 Original interview reports:');
                originalReportsSnapshot.forEach(reportDoc => {
                    const reportData = reportDoc.data();
                    console.log(`  - Report ${reportDoc.id}: status=${reportData.status}, user=${reportData.user_email || reportData.userEmail || 'unknown'}`);
                });
            }
        } else {
            console.log('⚠️ No original interview ID found in template');
        }
        
        const totalExpectedCompletions = templateCompletions + originalCompletions;
        console.log(`🎯 Expected total completions: ${totalExpectedCompletions} (${templateCompletions} from template + ${originalCompletions} from original)`);
        
        // Check if template needs updating
        const currentCompleted = templateData.usageStats?.totalInterviewsCompleted || 0;
        if (currentCompleted !== totalExpectedCompletions) {
            console.log(`⚠️ Template stats need updating: current=${currentCompleted}, expected=${totalExpectedCompletions}`);
            console.log('💡 Run window.backfillTemplateStatistics() to fix this');
        } else {
            console.log('✅ Template stats are up to date');
        }
        
    } catch (error) {
        console.error('❌ Error debugging template stats:', error);
    }
}

// Function to list all templates with their current stats
async function listAllTemplateStats() {
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    if (!db || !auth.currentUser) {
        console.error('Firebase not available or user not authenticated');
        return;
    }
    
    console.log('📋 Listing all template statistics...');
    
    try {
        const templatesSnapshot = await db.collection('templates').get();
        
        if (templatesSnapshot.empty) {
            console.log('No templates found');
            return;
        }
        
        console.log(`Found ${templatesSnapshot.size} templates:`);
        
        templatesSnapshot.forEach(doc => {
            const data = doc.data();
            const stats = data.usageStats || {};
            console.log(`📄 ${data.title || 'Untitled'} (${doc.id}):`, {
                created: stats.totalInterviewsCreated || 0,
                completed: stats.totalInterviewsCompleted || 0,
                originalInterviewId: data.originalInterviewId || 'none'
            });
        });
        
        console.log('\n💡 To debug a specific template, run: window.debugTemplateStats("TEMPLATE_ID")');
        
    } catch (error) {
        console.error('Error listing template stats:', error);
    }
}

// Expose functions globally for manual execution
window.backfillTemplateStatistics = backfillTemplateStatistics;
window.backfillInterviewTemplateTracking = backfillInterviewTemplateTracking;
window.updateTemplateStatsWithOriginalCompletions = updateTemplateStatsWithOriginalCompletions;
window.debugTemplateStats = debugTemplateStats;
window.listAllTemplateStats = listAllTemplateStats;

// Instructions for use:
console.log('Template Statistics Backfill Utility loaded.');
console.log('📊 Available functions:');
console.log('  window.listAllTemplateStats() - List all templates and their stats');
console.log('  window.debugTemplateStats("TEMPLATE_ID") - Debug a specific template');
console.log('  window.backfillTemplateStatistics() - Update all template stats');
console.log('  window.updateTemplateStatsWithOriginalCompletions() - Add original completions to existing stats'); 