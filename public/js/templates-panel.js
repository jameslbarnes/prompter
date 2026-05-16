// Templates Panel Module
// Handles templates panel state and UI updates

// Helper function to get category display names
function getCategoryDisplayNames() {
    return {
        'speaking-training': 'Speaking & Training',
        'personal-development': 'Personal Development',
        'market-research': 'Market Research',
        'recruiting': 'Recruiting',
        'storytelling': 'Storytelling',
        'customer-feedback': 'Customer Feedback',
        'academic-research': 'Academic Research',
        'healthcare-wellness': 'Healthcare & Wellness',
        'product-development': 'Product Development',
        'team-building': 'Team Building',
        'creative-media': 'Creative & Media',
        'compliance-audit': 'Compliance & Audit'
    };
}

// Helper function to get category color for icons
function getCategoryColor(category) {
    const categoryColors = {
        'speaking-training': '#3b82f6',      // blue
        'personal-development': '#10b981',   // green
        'market-research': '#8b5cf6',        // purple
        'recruiting': '#6366f1',             // indigo
        'storytelling': '#ec4899',           // pink
        'customer-feedback': '#f97316',      // orange
        'academic-research': '#14b8a6',      // teal
        'healthcare-wellness': '#ef4444',    // red
        'product-development': '#eab308',    // yellow
        'team-building': '#06b6d4',          // cyan
        'creative-media': '#8b5cf6',         // violet
        'compliance-audit': '#64748b'        // slate
    };
    return categoryColors[category] || '#6b7280'; // default gray
}

// Helper function to get category descriptions
function getCategoryDescription(category) {
    const descriptions = {
        'speaking-training': 'Templates designed to help improve public speaking skills, presentation abilities, and communication training.',
        'personal-development': 'Self-improvement focused templates for personal growth, goal setting, and life coaching conversations.',
        'market-research': 'Research-oriented templates for gathering market insights, customer preferences, and industry analysis.',
        'recruiting': 'Interview templates for hiring processes, candidate evaluation, and talent acquisition.',
        'storytelling': 'Creative templates focused on narrative development, story structure, and creative writing exercises.',
        'customer-feedback': 'Templates designed to collect customer opinions, satisfaction surveys, and product feedback.',
        'academic-research': 'Scholarly and educational templates for research interviews, academic studies, and educational assessments.',
        'healthcare-wellness': 'Health-focused templates for wellness coaching, medical interviews, and health assessments.',
        'product-development': 'Templates for product discovery, user research, feature validation, and development insights.',
        'team-building': 'Collaborative templates for team dynamics, workplace culture, and organizational development.',
        'creative-media': 'Templates for creative projects, media production, artistic endeavors, and creative collaboration.',
        'compliance-audit': 'Professional templates for compliance checks, auditing processes, and regulatory assessments.'
    };
    return descriptions[category] || 'Templates in this category provide specialized interview structures for specific use cases.';
}

// Helper function to get category-specific styling
function getCategoryStyling(category) {
    const categoryStyles = {
        'speaking-training': {
            bgColor: 'bg-blue-600',
            borderColor: 'border-blue-500',
            textColor: 'text-blue-100',
            accentColor: 'text-blue-300',
            icon: '🎤'
        },
        'personal-development': {
            bgColor: 'bg-green-600',
            borderColor: 'border-green-500',
            textColor: 'text-green-100',
            accentColor: 'text-green-300',
            icon: '🌱'
        },
        'market-research': {
            bgColor: 'bg-purple-600',
            borderColor: 'border-purple-500',
            textColor: 'text-purple-100',
            accentColor: 'text-purple-300',
            icon: '📊'
        },
        'recruiting': {
            bgColor: 'bg-indigo-600',
            borderColor: 'border-indigo-500',
            textColor: 'text-indigo-100',
            accentColor: 'text-indigo-300',
            icon: '👥'
        },
        'storytelling': {
            bgColor: 'bg-pink-600',
            borderColor: 'border-pink-500',
            textColor: 'text-pink-100',
            accentColor: 'text-pink-300',
            icon: '📖'
        },
        'customer-feedback': {
            bgColor: 'bg-orange-600',
            borderColor: 'border-orange-500',
            textColor: 'text-orange-100',
            accentColor: 'text-orange-300',
            icon: '💬'
        },
        'academic-research': {
            bgColor: 'bg-teal-600',
            borderColor: 'border-teal-500',
            textColor: 'text-teal-100',
            accentColor: 'text-teal-300',
            icon: '🎓'
        },
        'healthcare-wellness': {
            bgColor: 'bg-red-600',
            borderColor: 'border-red-500',
            textColor: 'text-red-100',
            accentColor: 'text-red-300',
            icon: '🏥'
        },
        'product-development': {
            bgColor: 'bg-yellow-600',
            borderColor: 'border-yellow-500',
            textColor: 'text-yellow-100',
            accentColor: 'text-yellow-300',
            icon: '🚀'
        },
        'team-building': {
            bgColor: 'bg-cyan-600',
            borderColor: 'border-cyan-500',
            textColor: 'text-cyan-100',
            accentColor: 'text-cyan-300',
            icon: '🤝'
        },
        'creative-media': {
            bgColor: 'bg-violet-600',
            borderColor: 'border-violet-500',
            textColor: 'text-violet-100',
            accentColor: 'text-violet-300',
            icon: '🎨'
        },
        'compliance-audit': {
            bgColor: 'bg-slate-600',
            borderColor: 'border-slate-500',
            textColor: 'text-slate-100',
            accentColor: 'text-slate-300',
            icon: '📋'
        }
    };
    
    // Default styling for uncategorized templates
    return categoryStyles[category] || {
        bgColor: 'bg-gray-600',
        borderColor: 'border-gray-500',
        textColor: 'text-gray-100',
        accentColor: 'text-gray-300',
        icon: '📄'
    };
}

// Apply templates panel state from appState
function applyTemplatesPanelState() {
    const panel = document.getElementById('templatesPanel'); 
    const overlay = document.getElementById('templatesOverlay'); 
    if (!panel || !overlay) {
        console.warn("Templates panel or overlay element not found.");
        return;
    }

    const isOpen = appState.uiState.templatesPanel.isOpen;

    if (isOpen) {
        // Close other slide-out panels if they are open
        if (appState.uiState.reportDetailPanel.isOpen) {
            appState.setReportDetailPanelOpen(false);
            if (window.applyReportDetailPanelState) window.applyReportDetailPanelState();
        }
        if (appState.uiState.interviewLivePreviewPanel.isOpen) {
            appState.setInterviewLivePreviewPanelOpen(false);
            if (window.applyInterviewLivePreviewPanelState) window.applyInterviewLivePreviewPanelState();
        }
        if (appState.uiState.userSettingsPanel.isOpen) {
            appState.setUserSettingsPanelOpen(false);
            if (window.applyUserSettingsPanelState) window.applyUserSettingsPanelState();
        }
        if (appState.uiState.pricingPanel.isOpen) {
            appState.setPricingPanelOpen(false);
            if (window.applyPricingPanelState) window.applyPricingPanelState();
        }
        
        // Reset category filter and load templates when opening
        const categoryFilter = document.getElementById('templateCategoryFilter');
        if (categoryFilter) {
            categoryFilter.value = '';
        }
        loadTemplates();
        
        panel.style.display = 'flex';
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
        void panel.offsetWidth; // Trigger reflow
        panel.style.transform = 'translateX(0)';
    } else {
        panel.style.transform = 'translateX(100%)';
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        
        // Clear hash if it's currently set to templates (preserve query params for UTM tracking)
        if (window.location.hash === '#templates') {
            window.history.replaceState(null, null, window.location.pathname + window.location.search);
        }
        
        setTimeout(() => {
            if (!appState.uiState.templatesPanel.isOpen) { // Check state again before hiding
                panel.style.display = 'none';
            }
        }, 300); // Match CSS transition duration
    }
}

// Load templates from Firestore
async function loadTemplates(categoryFilter = '') {
    const templatesContainer = document.getElementById('templatesContainer');
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    if (!templatesContainer || !db || !auth.currentUser) {
        console.error("Missing elements or Firebase services for loadTemplates");
        if (templatesContainer) {
            templatesContainer.innerHTML = '<div class="text-center text-red-400 py-8"><p>Error: Could not load templates</p></div>';
        }
        return;
    }
    
    templatesContainer.innerHTML = '<div class="text-center text-gray-400 py-8"><p>Loading templates...</p></div>';
    
    try {
        // Get templates created by the current user
        let query = db.collection('templates')
            .where('templateCreatedBy', '==', auth.currentUser.uid);
        
        // Add category filter if specified
        if (categoryFilter) {
            query = query.where('category', '==', categoryFilter);
        }
        
        const createdTemplatesSnapshot = await query.get();
        
        if (createdTemplatesSnapshot.empty) {
            const categoryDisplayNames = getCategoryDisplayNames();
            
            const emptyMessage = categoryFilter 
                ? `No templates found in "${categoryDisplayNames[categoryFilter] || categoryFilter}" category`
                : 'No templates found';
            
            const emptySubMessage = categoryFilter
                ? 'Try selecting a different category or create templates by using "Add to templates" from the interview menu'
                : 'Create templates by using "Add to templates" from the interview menu';
            
            templatesContainer.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <p class="mb-2">${emptyMessage}</p>
                    <p class="text-sm">${emptySubMessage}</p>
                </div>
            `;
            return;
        }

        // Get admin's organization from user collection
        let adminOrganization = 'Unknown Organization';
        try {
            const userDoc = await db.collection('users').doc(auth.currentUser.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                adminOrganization = userData.organization || 'No Organization';
            }
        } catch (error) {
            console.warn('Error fetching admin organization:', error);
        }

        // Sort templates by completion count (highest first), then by creation date
        const sortedTemplates = createdTemplatesSnapshot.docs.sort((a, b) => {
            const aStats = a.data().usageStats || {};
            const bStats = b.data().usageStats || {};
            const aCompleted = aStats.totalInterviewsCompleted || 0;
            const bCompleted = bStats.totalInterviewsCompleted || 0;
            
            // Sort by completion count first (descending)
            if (aCompleted !== bCompleted) {
                return bCompleted - aCompleted;
            }
            
            // If completion counts are equal, sort by creation date (newest first)
            const aCreated = a.data().templateCreatedAt;
            const bCreated = b.data().templateCreatedAt;
            if (aCreated && bCreated) {
                return bCreated.toDate() - aCreated.toDate();
            }
            return 0;
        });

        // Clear the container and populate with templates
        templatesContainer.innerHTML = '';
        
        // Add category introduction if filtering by category
        if (categoryFilter) {
            const categoryDisplayNames = getCategoryDisplayNames();
            const categoryDisplay = categoryDisplayNames[categoryFilter] || categoryFilter;
            const categoryStyling = getCategoryStyling(categoryFilter);
            
            const categoryIntro = document.createElement('div');
            categoryIntro.className = 'mb-6 p-4 bg-gray-700 rounded-lg';
            categoryIntro.innerHTML = `
                <div class="flex items-center gap-3 mb-2">
                    <span class="text-2xl" style="color: ${getCategoryColor(categoryFilter)}">${categoryStyling.icon}</span>
                    <h2 class="text-xl font-semibold text-white">${categoryDisplay}</h2>
                </div>
                <p class="text-gray-300 text-sm">${getCategoryDescription(categoryFilter)}</p>
            `;
            templatesContainer.appendChild(categoryIntro);
        }
        
        sortedTemplates.forEach((templateDoc) => {
            const template = templateDoc.data();
            const templateCard = document.createElement('div');
            
            // Format creation date
            let createdText = 'Date unknown';
            if (template.templateCreatedAt) {
                try {
                    const createdDate = new Date(template.templateCreatedAt.toDate());
                    const dateStr = createdDate.toLocaleDateString();
                    const timeStr = createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    createdText = `Created ${dateStr} ${timeStr}`;
                } catch (error) {
                    console.warn(`Error formatting creation date for template ${templateDoc.id}:`, error);
                    createdText = 'Created recently';
                }
            }
            
            // Format usage statistics
            const usageStats = template.usageStats || {};
            const totalCreated = usageStats.totalInterviewsCreated || 0;
            const totalCompleted = usageStats.totalInterviewsCompleted || 0;
            
            let usageText = 'No usage yet';
            if (totalCreated > 0 || totalCompleted > 0) {
                const parts = [];
                if (totalCreated > 0) {
                    parts.push(`${totalCreated} created`);
                }
                if (totalCompleted > 0) {
                    const completedText = totalCompleted === 1 ? '1 interview completed' : `${totalCompleted} interviews completed`;
                    parts.push(completedText);
                }
                usageText = parts.join(', ');
            }
            
            // Get category display name and styling
            const categoryDisplayNames = getCategoryDisplayNames();
            const categoryDisplay = template.category ? categoryDisplayNames[template.category] || template.category : 'Uncategorized';
            const categoryStyling = getCategoryStyling(template.category);
            
            templateCard.className = `bg-gray-600 rounded-lg p-4 hover:bg-gray-500 transition-colors duration-200 border-l-4 ${categoryStyling.borderColor}`;
            
            templateCard.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <div class="flex-grow">
                        <div class="flex items-center gap-2 mb-2">
                            ${!categoryFilter ? `<span class="text-lg" style="color: ${getCategoryColor(template.category)}">${categoryStyling.icon}</span>` : ''}
                            <h3 class="text-white font-medium text-lg">${(template.title || 'Untitled Template').replace(' (Template)', '')}</h3>
                            ${template.isFeatured ? '<span class="bg-yellow-500 text-gray-900 text-xs font-bold px-2 py-0.5 rounded ml-2">⭐ FEATURED</span>' : ''}
                        </div>
                        <p class="text-gray-300 text-sm">${createdText}</p>
                        <p class="text-gray-400 text-xs mt-1">From: ${adminOrganization}</p>
                        <div class="flex items-center gap-1 mt-2">
                            <span class="${categoryStyling.bgColor} text-white text-xs font-medium px-2 py-1 rounded">${categoryDisplay}</span>
                        </div>
                        <p class="text-blue-400 text-xs mt-1 font-medium">${usageText}</p>
                    </div>
                    <div class="flex flex-col space-y-2 ml-4">
                        <div class="flex space-x-2 items-center">
                            <button class="use-template-btn bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-sm font-medium transition-all duration-200" data-template-id="${templateDoc.id}">
                                Use Template
                            </button>
                            <!-- Ellipsis Menu -->
                            <div class="relative">
                                <button class="template-ellipsis-btn text-gray-400 hover:text-white p-1 rounded" data-template-id="${templateDoc.id}">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v.01M12 12v.01M12 19v.01" />
                                    </svg>
                                </button>
                                <div class="template-dropdown-menu absolute right-0 top-8 bg-gray-700 border border-gray-600 rounded-md shadow-lg py-1 z-10 hidden min-w-[160px]">
                                    <button class="set-featured-btn block w-full text-left px-3 py-1.5 text-sm text-blue-400 hover:bg-gray-600 hover:text-blue-300" data-template-id="${templateDoc.id}">
                                        ${template.isFeatured ? 'Remove as Featured' : 'Set as Featured'}
                                    </button>
                                    <button class="delete-template-btn block w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-gray-600 hover:text-red-300" data-template-id="${templateDoc.id}">Delete</button>
                                </div>
                            </div>
                        </div>
                        ${template.originalInterviewId ? `
                        <button class="begin-interview-btn bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-sm w-full font-medium transition-all duration-200" data-interview-id="${template.originalInterviewId}">
                            Begin Interview
                        </button>
                        ` : ''}
                    </div>
                </div>
                <div class="text-gray-300 text-sm">
                    <p class="mb-2">${template.description || 'No description available'}</p>
                    ${template.hasExternalDocuments ? `<div class="flex items-center gap-1 mt-2"><span class="bg-orange-600 text-white text-xs px-2 py-1 rounded">📎 External Docs Required</span></div>` : ''}
                </div>
            `;
            
            templatesContainer.appendChild(templateCard);
        });

    } catch (error) {
        console.error('Error loading templates:', error);
        templatesContainer.innerHTML = `<div class="text-center text-red-400 py-8"><p>Error loading templates: ${error.message}</p></div>`;
    }
}

// Use a template to create a new interview
async function useTemplate(templateId) {
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    if (!db || !auth.currentUser) {
        alert('Error: Firebase not available or user not authenticated.');
        return;
    }
    
    try {
        // Get the template data
        const templateDoc = await db.collection('templates').doc(templateId).get();
        
        if (!templateDoc.exists) {
            alert('Error: Template not found.');
            return;
        }
        
        const templateData = templateDoc.data();
        
        // Prepare the interview data (copy from template, removing template-specific fields)
        const interviewData = {
            ...templateData,
            // Update the title to remove "(Template)" suffix
            title: templateData.title ? templateData.title.replace(' (Template)', '') : 'Untitled Interview',
            // Ensure category is preserved
            category: templateData.category || '',
            // Set new interview metadata
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: auth.currentUser.uid,
            sharedWith: [], // Reset sharing for the new interview
            // Add template tracking to the new interview
            sourceTemplateId: templateId,
            sourceTemplateCreatedBy: templateData.templateCreatedBy,
            sourceOriginalInterviewId: templateData.originalInterviewId
        };
        
        // Remove template-specific metadata (delete instead of setting to undefined)
        delete interviewData.originalInterviewId;
        delete interviewData.templateCreatedAt;
        delete interviewData.templateCreatedBy;
        delete interviewData.templateCreatedByEmail;
        delete interviewData.usageStats;
        
        // Create new interview from template
        const interviewRef = await db.collection('interviews').add(interviewData);
        
        // Update template usage statistics
        await db.collection('templates').doc(templateId).update({
            'usageStats.totalInterviewsCreated': firebase.firestore.FieldValue.increment(1),
            'usageStats.lastUsedAt': firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`Template "${templateData.title}" used to create new interview with ID: ${interviewRef.id}`);
        
        // Close templates panel
        appState.setTemplatesPanelOpen(false);
        applyTemplatesPanelState();
        
        // Load the new interview for editing
        if (window.loadInterviewForEditing) {
            window.loadInterviewForEditing(interviewRef.id);
        }
        
        // Refresh the interviews list
        if (window.refreshInterviewsList) {
            window.refreshInterviewsList();
        } else if (window.loadInterviewsGlobal) {
            window.loadInterviewsGlobal();
        }
        
        alert(`New interview created from template "${templateData.title}"!`);
        
    } catch (error) {
        console.error('Error using template:', error);
        alert(`Error using template: ${error.message}`);
    }
}

// Toggle featured status on template
async function toggleFeaturedTemplate(templateId) {
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    if (!db || !auth.currentUser) {
        alert('Error: Firebase not available or user not authenticated.');
        return;
    }
    
    try {
        // Get the template to check current featured status
        const templateDoc = await db.collection('templates').doc(templateId).get();
        
        if (!templateDoc.exists) {
            alert('Error: Template not found.');
            return;
        }
        
        const template = templateDoc.data();
        const isFeatured = template.isFeatured || false;
        
        if (!isFeatured) {
            // If setting as featured, first unset any other featured templates
            const featuredTemplatesSnapshot = await db.collection('templates')
                .where('isFeatured', '==', true)
                .get();
            
            const batch = db.batch();
            
            // Unset all currently featured templates
            featuredTemplatesSnapshot.docs.forEach(doc => {
                batch.update(doc.ref, { isFeatured: false });
            });
            
            // Set this template as featured
            batch.update(db.collection('templates').doc(templateId), { 
                isFeatured: true,
                featuredAt: firebase.firestore.FieldValue.serverTimestamp(),
                featuredBy: auth.currentUser.uid
            });
            
            await batch.commit();
            console.log(`Template ${templateId} set as featured`);
            alert(`Template "${template.title}" is now the featured template for new users!`);
        } else {
            // Remove featured status
            await db.collection('templates').doc(templateId).update({ 
                isFeatured: false,
                featuredAt: firebase.firestore.FieldValue.delete(),
                featuredBy: firebase.firestore.FieldValue.delete()
            });
            console.log(`Template ${templateId} removed as featured`);
            alert(`Template "${template.title}" is no longer featured.`);
        }
        
        // Reload templates to reflect changes
        const categoryFilter = document.getElementById('templateCategoryFilter');
        loadTemplates(categoryFilter ? categoryFilter.value : '');
        
    } catch (error) {
        console.error('Error toggling featured template:', error);
        alert(`Error updating featured status: ${error.message}`);
    }
}

// Delete a template
async function deleteTemplate(templateId) {
    const db = firebase.firestore();
    const auth = firebase.auth();
    
    if (!db || !auth.currentUser) {
        alert('Error: Firebase not available or user not authenticated.');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
        return;
    }
    
    try {
        await db.collection('templates').doc(templateId).delete();
        console.log(`Template ${templateId} deleted successfully`);
        
        // Reload templates
        loadTemplates();
        
    } catch (error) {
        console.error('Error deleting template:', error);
        alert(`Error deleting template: ${error.message}`);
    }
}

// Begin interview from template
async function beginInterviewFromTemplate(interviewId) {
    if (!interviewId) {
        alert('Error: No interview ID provided.');
        return;
    }
    
    try {
        // Close templates panel
        appState.setTemplatesPanelOpen(false);
        applyTemplatesPanelState();
        
        // Open the interview in the live preview panel
        let interviewUrl = `${window.location.origin}/i/?interview=${interviewId}`;
        
        // Add admin parameters for preview
        const auth = firebase.auth();
        if (auth.currentUser) {
            if (auth.currentUser.email) {
                interviewUrl += `&adminEmail=${encodeURIComponent(auth.currentUser.email)}`;
            }
            const adminName = auth.currentUser.displayName || auth.currentUser.email?.split('@')[0];
            if (adminName) {
                interviewUrl += `&adminName=${encodeURIComponent(adminName)}`;
            }
        }
        
        // Close other panels if open
        if (appState.uiState.reportDetailPanel.isOpen) {
            appState.setReportDetailPanelOpen(false);
            if (window.applyReportDetailPanelState) window.applyReportDetailPanelState();
        }
        
        // Open the interview live preview panel
        appState.setInterviewLivePreviewPanelOpen(true, interviewUrl);
        if (window.applyInterviewLivePreviewPanelState) window.applyInterviewLivePreviewPanelState();
        
        console.log(`Opened interview ${interviewId} in live preview panel`);
        
    } catch (error) {
        console.error('Error beginning interview from template:', error);
        alert(`Error beginning interview: ${error.message}`);
    }
}

// Handle template actions
function handleTemplateActions(event) {
    const target = event.target;
    
    const useTemplateBtn = target.closest('.use-template-btn');
    if (useTemplateBtn) {
        const templateId = useTemplateBtn.getAttribute('data-template-id');
        useTemplate(templateId);
        return;
    }
    
    const deleteTemplateBtn = target.closest('.delete-template-btn');
    if (deleteTemplateBtn) {
        const templateId = deleteTemplateBtn.getAttribute('data-template-id');
        deleteTemplate(templateId);
        closeAllTemplateDropdowns();
        return;
    }
    
    const setFeaturedBtn = target.closest('.set-featured-btn');
    if (setFeaturedBtn) {
        const templateId = setFeaturedBtn.getAttribute('data-template-id');
        toggleFeaturedTemplate(templateId);
        closeAllTemplateDropdowns();
        return;
    }
    
    const beginInterviewBtn = target.closest('.begin-interview-btn');
    if (beginInterviewBtn) {
        const interviewId = beginInterviewBtn.getAttribute('data-interview-id');
        beginInterviewFromTemplate(interviewId);
        return;
    }
    
    const ellipsisBtn = target.closest('.template-ellipsis-btn');
    if (ellipsisBtn) {
        const dropdown = ellipsisBtn.nextElementSibling;
        const isHidden = dropdown.classList.contains('hidden');
        
        // Close all other dropdowns first
        closeAllTemplateDropdowns();
        
        // Toggle this dropdown
        if (isHidden) {
            dropdown.classList.remove('hidden');
        }
        return;
    }
    
    // Close dropdowns when clicking outside
    if (!target.closest('.template-dropdown-menu') && !target.closest('.template-ellipsis-btn')) {
        closeAllTemplateDropdowns();
    }
}

// Helper function to close all template dropdowns
function closeAllTemplateDropdowns() {
    const dropdowns = document.querySelectorAll('.template-dropdown-menu');
    dropdowns.forEach(dropdown => {
        dropdown.classList.add('hidden');
    });
}

// Refresh template statistics
async function refreshTemplateStats() {
    const refreshStatsBtn = document.getElementById('refreshStatsBtn');
    let originalText = '';
    
    if (refreshStatsBtn) {
        // Show loading state
        originalText = refreshStatsBtn.innerHTML;
        refreshStatsBtn.innerHTML = `
            <svg class="animate-spin h-4 w-4 inline-block mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Updating...
        `;
        refreshStatsBtn.disabled = true;
    }
    
    try {
        // Run the backfill function
        if (window.backfillTemplateStatistics) {
            await window.backfillTemplateStatistics();
            
            // Reload templates to show updated stats
            await loadTemplates();
            
            // Show success message
            console.log('✅ Template statistics updated successfully!');
            
            // Optional: Show a temporary success indicator
            if (refreshStatsBtn) {
                refreshStatsBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Updated!
                `;
                
                // Reset button after 2 seconds
                setTimeout(() => {
                    if (refreshStatsBtn && originalText) {
                        refreshStatsBtn.innerHTML = originalText;
                        refreshStatsBtn.disabled = false;
                    }
                }, 2000);
            }
        } else {
            throw new Error('Backfill function not available');
        }
    } catch (error) {
        console.error('❌ Error updating template statistics:', error);
        
        // Show error state
        if (refreshStatsBtn) {
            refreshStatsBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Error
            `;
            
            // Reset button after 3 seconds
            setTimeout(() => {
                if (refreshStatsBtn && originalText) {
                    refreshStatsBtn.innerHTML = originalText;
                    refreshStatsBtn.disabled = false;
                }
            }, 3000);
        }
    }
}

// Initialize templates panel
function initializeTemplatesPanel() {
    // Add close button event listener
    const closeBtn = document.getElementById('closeTemplatesPanelBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            appState.setTemplatesPanelOpen(false);
            applyTemplatesPanelState();
        });
    }
    
    // Add category filter event listener
    const categoryFilter = document.getElementById('templateCategoryFilter');
    if (categoryFilter) {
        categoryFilter.addEventListener('change', (e) => {
            const selectedCategory = e.target.value;
            loadTemplates(selectedCategory);
        });
    }
    
    // Add overlay click event listener
    const overlay = document.getElementById('templatesOverlay');
    if (overlay) {
        overlay.addEventListener('click', () => {
            appState.setTemplatesPanelOpen(false);
            applyTemplatesPanelState();
        });
    }
    
    // Add event delegation for template actions
    const templatesContainer = document.getElementById('templatesContainer');
    if (templatesContainer) {
        templatesContainer.addEventListener('click', handleTemplateActions);
    }
}

// Expose functions globally
window.applyTemplatesPanelState = applyTemplatesPanelState;
window.initializeTemplatesPanel = initializeTemplatesPanel;
window.loadTemplates = loadTemplates;
window.beginInterviewFromTemplate = beginInterviewFromTemplate; 