// Campaigns Tab Module
// Handles display and management of email campaigns

(function() {
    'use strict';
    
    let currentInterviewId = null;
    let campaignsData = [];
    
    // Initialize campaigns tab
    function initializeCampaignsTab() {
        console.log('[CampaignsTab] Initializing...');
        
        // Add event listener for the new campaign button
        const promoteBtn = document.getElementById('promoteInterviewerBtn');
        if (promoteBtn) {
            console.log('[CampaignsTab] Found promote button, adding listener');
            // Remove any existing listeners
            promoteBtn.removeEventListener('click', handleNewCampaign);
            // Add the event listener with capture to ensure it runs first
            promoteBtn.addEventListener('click', handleNewCampaign, true);
            // Also set onclick directly
            promoteBtn.onclick = function(e) {
                console.log('[CampaignsTab] Direct onclick triggered');
                handleNewCampaign(e);
            };
        } else {
            console.warn('[CampaignsTab] Promote button not found');
        }
        
        // Add event listener for tab switching
        const campaignsTabButton = document.querySelector('[data-tab="spec-campaigns"]');
        if (campaignsTabButton) {
            campaignsTabButton.addEventListener('click', () => {
                console.log('[CampaignsTab] Tab clicked, currentInterviewId:', currentInterviewId);
                if (currentInterviewId) {
                    loadCampaigns();
                } else {
                    // Try to get from appState
                    if (window.appState && window.appState.currentEditingInterviewId) {
                        currentInterviewId = window.appState.currentEditingInterviewId;
                        loadCampaigns();
                    }
                }
            });
        }
        
        // Also initialize promote wizard if not already done
        if (!window.promoteWizard && window.PromoteInterviewerWizard) {
            window.promoteWizard = new window.PromoteInterviewerWizard();
            console.log('[CampaignsTab] Initialized promote wizard');
        }
    }
    
    // Handle new campaign button click
    function handleNewCampaign(e) {
        e.preventDefault();
        console.log('[CampaignsTab] New campaign button clicked');
        console.log('[CampaignsTab] Current interview ID:', currentInterviewId);
        console.log('[CampaignsTab] Promote wizard available:', !!window.promoteWizard);
        
        // Try to get current interview ID from various sources
        if (!currentInterviewId) {
            if (window.appState && window.appState.currentEditingInterviewId) {
                currentInterviewId = window.appState.currentEditingInterviewId;
            } else {
                alert('Please select an interview first');
                return;
            }
        }
        
        const interviewTitle = window.appState?.interviewSpec?.title || 'Interview';
        
        // Use the promote interviewer wizard
        if (window.promoteWizard) {
            console.log('[CampaignsTab] Opening wizard for interview:', currentInterviewId, interviewTitle);
            window.promoteWizard.open(currentInterviewId, interviewTitle);
            
            // Listen for wizard close to refresh campaigns
            const checkWizardClosed = setInterval(() => {
                const wizardPanel = document.getElementById('promoteInterviewerPanel');
                if (!wizardPanel || wizardPanel.style.display === 'none') {
                    clearInterval(checkWizardClosed);
                    // Refresh campaigns list after wizard closes
                    setTimeout(() => loadCampaigns(), 1000);
                }
            }, 500);
        } else {
            console.error('[CampaignsTab] Promote wizard not loaded');
            alert('Campaign wizard is not loaded. Please refresh the page and try again.');
        }
    }
    
    // Load campaigns for current interview
    async function loadCampaigns() {
        const loadingIndicator = document.getElementById('campaignsLoadingIndicator');
        const campaignsList = document.getElementById('campaignsList');
        const noCampaignsMessage = document.getElementById('noCampaignsMessage');
        
        // Always get the latest interview ID from appState before loading
        if (window.appState && window.appState.currentEditingInterviewId) {
            currentInterviewId = window.appState.currentEditingInterviewId;
        }
        
        // If no interview is selected, show a message
        if (!currentInterviewId) {
            console.log('[CampaignsTab] No interview selected');
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            if (campaignsList) campaignsList.classList.add('hidden');
            if (noCampaignsMessage) {
                noCampaignsMessage.classList.remove('hidden');
                noCampaignsMessage.innerHTML = '<p class="text-gray-400">Please select an interview to view its campaigns.</p>';
            }
            return;
        }
        
        // Show loading
        if (loadingIndicator) loadingIndicator.classList.remove('hidden');
        if (campaignsList) campaignsList.classList.add('hidden');
        if (noCampaignsMessage) noCampaignsMessage.classList.add('hidden');
        
        try {
            const response = await fetch('/api/campaigns/list', {
                headers: {
                    'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load campaigns');
            }
            
            const data = await response.json();
            campaignsData = data.campaigns || [];
            
            // Filter campaigns for current interview
            // Always filter by interviewId - don't show campaigns from other interviews
            console.log('[CampaignsTab] Total campaigns:', campaignsData.length);
            console.log('[CampaignsTab] Current interview ID:', currentInterviewId);
            
            // Filter campaigns for current interview - ONLY show campaigns for this interview
            const interviewCampaigns = campaignsData.filter(c => {
                console.log('[CampaignsTab] Campaign', c.id, 'interviewId:', c.interviewId, 'matches?', c.interviewId === currentInterviewId);
                return c.interviewId === currentInterviewId;
            });
            
            console.log('[CampaignsTab] Filtered campaigns:', interviewCampaigns.length);
            console.log('[CampaignsTab] Campaigns without interviewId (excluded):', campaignsData.filter(c => !c.interviewId).length);
            
            // Only display campaigns for the current interview
            displayCampaigns(interviewCampaigns);
            
        } catch (error) {
            console.error('Error loading campaigns:', error);
            if (loadingIndicator) loadingIndicator.classList.add('hidden');
            if (noCampaignsMessage) {
                noCampaignsMessage.classList.remove('hidden');
                noCampaignsMessage.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mx-auto mb-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p class="text-sm text-red-500">Error loading campaigns</p>
                `;
            }
        }
    }
    
    // Display campaigns in the UI
    function displayCampaigns(campaigns) {
        const loadingIndicator = document.getElementById('campaignsLoadingIndicator');
        const campaignsList = document.getElementById('campaignsList');
        const noCampaignsMessage = document.getElementById('noCampaignsMessage');
        
        // Hide loading
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        
        if (campaigns.length === 0) {
            if (noCampaignsMessage) noCampaignsMessage.classList.remove('hidden');
            if (campaignsList) campaignsList.classList.add('hidden');
            return;
        }
        
        // Show campaigns list
        if (campaignsList) {
            campaignsList.classList.remove('hidden');
            campaignsList.innerHTML = campaigns.map(campaign => createCampaignCard(campaign)).join('');
        }
        if (noCampaignsMessage) noCampaignsMessage.classList.add('hidden');
    }
    
    // Create campaign card HTML
    function createCampaignCard(campaign) {
        const stats = campaign.stats || {};
        const openRate = stats.sent > 0 ? ((stats.opened || 0) / stats.sent * 100).toFixed(1) : 0;
        const clickRate = stats.sent > 0 ? ((stats.clicked || 0) / stats.sent * 100).toFixed(1) : 0;
        
        // Format date
        const createdDate = campaign.createdAt ? new Date(campaign.createdAt._seconds * 1000) : new Date();
        const dateStr = createdDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
        
        return `
            <div class="campaign-card bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer" data-campaign-id="${campaign.id}">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="text-white font-medium">${campaign.name}</h4>
                        <p class="text-xs text-gray-400 mt-1">${dateStr}</p>
                    </div>
                    <span class="px-2 py-1 text-xs rounded-full ${campaign.status === 'active' ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}">
                        ${campaign.status}
                    </span>
                </div>
                
                <div class="grid grid-cols-4 gap-3 text-center">
                    <div>
                        <p class="text-lg font-semibold text-white">${stats.total || 0}</p>
                        <p class="text-xs text-gray-400">Total</p>
                    </div>
                    <div>
                        <p class="text-lg font-semibold text-green-400">${stats.sent || 0}</p>
                        <p class="text-xs text-gray-400">Sent</p>
                    </div>
                    <div>
                        <p class="text-lg font-semibold text-blue-400">${openRate}%</p>
                        <p class="text-xs text-gray-400">Opens</p>
                    </div>
                    <div>
                        <p class="text-lg font-semibold text-purple-400">${clickRate}%</p>
                        <p class="text-xs text-gray-400">Clicks</p>
                    </div>
                </div>
                
                <button class="w-full mt-3 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded transition-colors" onclick="viewCampaignDetails('${campaign.id}')">
                    View Details
                </button>
            </div>
        `;
    }
    
    // View campaign details
    window.viewCampaignDetails = async function(campaignId) {
        try {
            const response = await fetch(`/api/campaigns/analytics/${campaignId}`, {
                headers: {
                    'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load campaign details');
            }
            
            const data = await response.json();
            showCampaignDetailsModal(data);
            
        } catch (error) {
            console.error('Error loading campaign details:', error);
            alert('Failed to load campaign details');
        }
    };
    
    // Show campaign details modal
    function showCampaignDetailsModal(data) {
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                <div class="p-6 border-b border-gray-700">
                    <div class="flex justify-between items-start">
                        <div>
                            <h2 class="text-xl font-semibold text-white">${data.campaign.name}</h2>
                            <p class="text-sm text-gray-400 mt-1">Created ${new Date(data.campaign.createdAt._seconds * 1000).toLocaleDateString()}</p>
                        </div>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div class="p-6 overflow-y-auto">
                    <!-- Stats Overview -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div class="bg-gray-700 rounded-lg p-4">
                            <p class="text-2xl font-bold text-white">${data.stats.total}</p>
                            <p class="text-sm text-gray-400">Total Emails</p>
                        </div>
                        <div class="bg-gray-700 rounded-lg p-4">
                            <p class="text-2xl font-bold text-green-400">${data.stats.sent}</p>
                            <p class="text-sm text-gray-400">Sent</p>
                        </div>
                        <div class="bg-gray-700 rounded-lg p-4">
                            <p class="text-2xl font-bold text-blue-400">${data.stats.opened}</p>
                            <p class="text-sm text-gray-400">Opened (${data.rates.openRate}%)</p>
                        </div>
                        <div class="bg-gray-700 rounded-lg p-4">
                            <p class="text-2xl font-bold text-purple-400">${data.stats.clicked}</p>
                            <p class="text-sm text-gray-400">Clicked (${data.rates.clickRate}%)</p>
                        </div>
                    </div>
                    
                    <!-- Interview Engagement -->
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="bg-gray-700 rounded-lg p-4">
                            <p class="text-2xl font-bold text-yellow-400">${data.stats.interviewStarted}</p>
                            <p class="text-sm text-gray-400">Interviews Started (${data.rates.startRate}%)</p>
                        </div>
                        <div class="bg-gray-700 rounded-lg p-4">
                            <p class="text-2xl font-bold text-indigo-400">${data.stats.interviewCompleted}</p>
                            <p class="text-sm text-gray-400">Completed (${data.rates.completionRate}%)</p>
                        </div>
                    </div>
                    
                    <!-- Email Details Table -->
                    <h3 class="text-lg font-medium text-white mb-3">Email Recipients</h3>
                    <div class="bg-gray-700 rounded-lg overflow-hidden">
                        <table class="w-full text-sm">
                            <thead class="bg-gray-800">
                                <tr>
                                    <th class="px-4 py-2 text-left text-gray-300">Email</th>
                                    <th class="px-4 py-2 text-left text-gray-300">Status</th>
                                    <th class="px-4 py-2 text-left text-gray-300">Sent</th>
                                    <th class="px-4 py-2 text-left text-gray-300">Opened</th>
                                    <th class="px-4 py-2 text-left text-gray-300">Started</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-600">
                                ${data.emails.map(email => `
                                    <tr class="hover:bg-gray-600">
                                        <td class="px-4 py-2 text-gray-300">${email.to}</td>
                                        <td class="px-4 py-2">
                                            <span class="px-2 py-1 text-xs rounded-full ${
                                                email.status === 'sent' ? 'bg-green-900 text-green-300' :
                                                email.status === 'failed' ? 'bg-red-900 text-red-300' :
                                                'bg-gray-600 text-gray-300'
                                            }">
                                                ${email.status}
                                            </span>
                                        </td>
                                        <td class="px-4 py-2 text-gray-400 text-xs">
                                            ${email.sentAt ? new Date(email.sentAt._seconds * 1000).toLocaleString() : '-'}
                                        </td>
                                        <td class="px-4 py-2 text-gray-400 text-xs">
                                            ${email.openedAt ? new Date(email.openedAt._seconds * 1000).toLocaleString() : '-'}
                                        </td>
                                        <td class="px-4 py-2 text-gray-400 text-xs">
                                            ${email.interviewStartedAt ? new Date(email.interviewStartedAt._seconds * 1000).toLocaleString() : '-'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    // Update current interview ID when interview is loaded
    window.addEventListener('interviewLoaded', (event) => {
        currentInterviewId = event.detail.interviewId;
        
        // Clear campaigns list when switching interviews
        const campaignsList = document.getElementById('campaignsList');
        if (campaignsList) campaignsList.innerHTML = '';
    });
    
    // Also check appState for current interview
    if (window.appState && window.appState.currentEditingInterviewId) {
        currentInterviewId = window.appState.currentEditingInterviewId;
    }
    
    // Listen for interview selection changes
    const originalLoadInterview = window.loadInterview;
    if (originalLoadInterview) {
        window.loadInterview = async function(interviewId) {
            const result = await originalLoadInterview.apply(this, arguments);
            currentInterviewId = interviewId;
            // Reload campaigns if on campaigns tab
            const campaignsTab = document.querySelector('[data-tab="spec-campaigns"]');
            if (campaignsTab && campaignsTab.classList.contains('bg-gray-800')) {
                loadCampaigns();
            }
            return result;
        };
    }
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeCampaignsTab);
    } else {
        initializeCampaignsTab();
    }
    
    // Also try to initialize after a short delay to ensure everything is loaded
    setTimeout(() => {
        if (!window.promoteWizard && window.PromoteInterviewerWizard) {
            window.promoteWizard = new window.PromoteInterviewerWizard();
            console.log('[CampaignsTab] Late initialization of promote wizard');
        }
        
        // Re-attach event listener if button exists but wasn't found initially
        const promoteBtn = document.getElementById('promoteInterviewerBtn');
        if (promoteBtn && !promoteBtn.hasAttribute('data-initialized')) {
            promoteBtn.addEventListener('click', handleNewCampaign);
            promoteBtn.setAttribute('data-initialized', 'true');
            console.log('[CampaignsTab] Late initialization of promote button');
            
            // Also add onclick as a fallback
            promoteBtn.onclick = handleNewCampaign;
        }
    }, 1000);
    
    // Function to check if promotion tab is active
    function isPromotionTabActive() {
        const promotionTab = document.querySelector('[data-tab="promotion"]');
        return promotionTab && promotionTab.classList.contains('active');
    }
    
    // Function to refresh campaigns if tab is active
    function refreshCampaignsIfActive() {
        if (isPromotionTabActive()) {
            console.log('[CampaignsTab] Refreshing campaigns due to interview change');
            loadCampaigns();
        }
    }
    
    // Export the handler globally for direct onclick use
    window.handleNewCampaign = handleNewCampaign;
    
    // Export functions for external use
    window.campaignsTab = {
        loadCampaigns,
        refresh: loadCampaigns,
        refreshIfActive: refreshCampaignsIfActive
    };
})();