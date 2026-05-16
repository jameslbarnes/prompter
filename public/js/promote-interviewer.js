// Promote Interviewer Wizard Module

class PromoteInterviewerWizard {
    constructor() {
        this.currentStep = 2; // Skip audience selection, start at import list
        this.wizardData = {
            audienceType: 'import', // Default to import list
            contacts: [],
            processedContacts: [],
            emails: [],
            additionalContext: '', // For uploaded files/pasted text
            campaign: {
                name: '',
                sendingStrategy: 'throttled',
                emailsPerHour: 20,
                schedule: 'now'
            }
        };
        this.productHuntCursor = null; // Store cursor for pagination
        this.productHuntSearchParams = null; // Store search params for "load more"
    }

    open(interviewId, interviewTitle) {
        console.log('[PromoteWizard] Opening wizard for:', interviewId, interviewTitle);
        this.interviewId = interviewId;
        this.interviewTitle = interviewTitle;
        this.createWizardPanel();
        this.showStep(1);
    }

    createWizardPanel() {
        console.log('[PromoteWizard] Creating wizard panel');
        
        // Remove existing panel and overlay if any
        const existingPanel = document.getElementById('promoteInterviewerPanel');
        const existingOverlay = document.getElementById('promoteInterviewerOverlay');
        if (existingPanel) existingPanel.remove();
        if (existingOverlay) existingOverlay.remove();

        // Create overlay
        const overlay = document.createElement('div');
        overlay.id = 'promoteInterviewerOverlay';
        overlay.className = 'fixed inset-0 bg-black';
        overlay.style.cssText = 'background-color: rgba(0, 0, 0, 0.7); opacity: 0; pointer-events: none; transition: opacity 0.3s ease-in-out; z-index: 65;';
        document.body.appendChild(overlay);

        // Create panel
        const panel = document.createElement('div');
        panel.id = 'promoteInterviewerPanel';
        panel.className = 'fixed bg-gray-800 flex shadow-xl';
        panel.style.cssText = 'top: 5px; right: 0; width: 50%; height: calc(100vh - 10px); transform: translateX(100%); transition: transform 0.3s ease-in-out; display: none; z-index: 70;';
        panel.innerHTML = `
            <button id="closePromoteWizard" class="absolute top-1/2 left-0 transform -translate-x-1/2 -translate-y-1/2 bg-gray-700 border border-gray-600 text-text-primary p-2 rounded-full shadow-md z-75" title="Close Campaign Wizard">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                </svg>
            </button>
            <div class="flex-grow flex flex-col bg-gray-700 rounded-l-md relative">
                <!-- Header -->
                <div class="px-6 py-4 border-b border-gray-600">
                    <h2 class="text-xl font-semibold text-white">Promote Interviewer</h2>
                    <p class="text-sm text-gray-400 mt-1">${this.interviewTitle}</p>
                </div>

                <!-- Progress Bar -->
                <div class="px-6 py-3 border-b border-gray-600">
                    <div class="flex items-center justify-between">
                        <div class="flex space-x-2">
                            <div class="step-indicator w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-medium transition-all" data-step="2">1</div>
                            <div class="step-indicator w-7 h-7 rounded-full bg-gray-600 text-gray-400 flex items-center justify-center text-sm font-medium transition-all" data-step="3">2</div>
                            <div class="step-indicator w-7 h-7 rounded-full bg-gray-600 text-gray-400 flex items-center justify-center text-sm font-medium transition-all" data-step="4">3</div>
                            <div class="step-indicator w-7 h-7 rounded-full bg-gray-600 text-gray-400 flex items-center justify-center text-sm font-medium transition-all" data-step="5">4</div>
                            <div class="step-indicator w-7 h-7 rounded-full bg-gray-600 text-gray-400 flex items-center justify-center text-sm font-medium transition-all" data-step="6">5</div>
                            <div class="step-indicator w-7 h-7 rounded-full bg-gray-600 text-gray-400 flex items-center justify-center text-sm font-medium transition-all" data-step="7">6</div>
                        </div>
                        <span class="text-sm text-gray-400" id="stepLabel">Import List</span>
                    </div>
                </div>

                <!-- Content Area -->
                <div class="flex-1 overflow-y-auto overflow-x-hidden px-8 py-6" id="wizardContent" style="max-width: 100%;">
                    <!-- Dynamic content goes here -->
                </div>

                <!-- Footer -->
                <div class="px-6 py-4 border-t border-gray-600">
                    <div class="flex justify-between">
                        <button id="wizardBack" class="px-4 py-2 text-gray-400 hover:text-white" style="display: none;">
                            ← Back
                        </button>
                        <button id="wizardNext" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ml-auto">
                            Next →
                        </button>
                    </div>
                </div>
            </div>

        `;

        document.body.appendChild(panel);

        // Show panel and overlay
        panel.style.display = 'flex';
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
        void panel.offsetWidth; // Trigger reflow
        panel.style.transform = 'translateX(0)';

        // Setup event handlers
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        const closeBtn = document.getElementById('closePromoteWizard');
        const backBtn = document.getElementById('wizardBack');
        const nextBtn = document.getElementById('wizardNext');
        const overlay = document.getElementById('promoteInterviewerOverlay');

        closeBtn.addEventListener('click', () => this.close());
        backBtn.addEventListener('click', () => this.previousStep());
        nextBtn.addEventListener('click', () => this.nextStep());
        
        // Click outside to close
        overlay.addEventListener('click', () => this.close());
    }

    showStep(step) {
        this.currentStep = step;
        this.updateProgress();
        
        const content = document.getElementById('wizardContent');
        const backBtn = document.getElementById('wizardBack');
        const nextBtn = document.getElementById('wizardNext');

        // Show/hide back button
        backBtn.style.display = step > 2 ? 'block' : 'none'; // Hide on step 2 since we skip step 1

        switch(step) {
            case 1:
                this.showAudienceSelection(content);
                break;
            case 2:
                this.showImportList(content);
                break;
            case 3:
                this.showProcessing(content);
                break;
            case 4:
                this.showQuestionRefinement(content);
                break;
            case 5:
                this.showEmailTemplate(content);
                break;
            case 6:
                this.showEmailReview(content);
                break;
            case 7:
                this.showSendConfiguration(content);
                break;
        }
    }


    showAudienceSelection(container) {
        container.innerHTML = `
            <div class="space-y-4">
                <h3 class="text-lg font-medium text-white mb-4">Select Your Audience</h3>
                
                <p class="text-gray-400 mb-6">Choose how you want to import your contacts for this interview campaign.</p>
                
                <div class="space-y-4">
                
                <label class="block p-4 border-2 border-gray-700 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                    <input type="radio" name="audienceType" value="import" class="sr-only" />
                    <div class="flex items-start">
                        <div class="flex-shrink-0 mr-3">
                            <svg class="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                            </svg>
                        </div>
                        <div>
                            <h4 class="text-white font-medium">Import Existing List</h4>
                            <p class="text-sm text-gray-400 mt-1">Upload a CSV with your contacts</p>
                        </div>
                    </div>
                </label>

                <label class="block p-4 border-2 border-gray-700 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                    <input type="radio" name="audienceType" value="producthunt" class="sr-only" />
                    <div class="flex items-start">
                        <div class="flex-shrink-0 mr-3">
                            <svg class="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                            </svg>
                        </div>
                        <div>
                            <h4 class="text-white font-medium">Search Product Hunt</h4>
                            <p class="text-sm text-gray-400 mt-1">Find founders who launched products</p>
                        </div>
                    </div>
                </label>
            </div>
        `;

        // Handle selection
        const radios = container.querySelectorAll('input[name="audienceType"]');
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.wizardData.audienceType = e.target.value;
                // Update visual selection
                container.querySelectorAll('label').forEach(label => {
                    label.classList.toggle('border-blue-500', label.querySelector('input').checked);
                });
            });
        });
    }

    showImportList(container) {
        // Skip Product Hunt branch since we're going straight to contact upload
        // Keep Product Hunt code in codebase for future use
        
        container.innerHTML = `
            <div class="space-y-4">
                <h3 class="text-lg font-medium text-white mb-4">Upload Your Contact List</h3>
                
                <div class="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
                    <input type="file" id="csvFileInput" accept=".csv" class="hidden" />
                    <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                    </svg>
                    <p class="text-gray-400 mb-2">Drag & drop your CSV file here, or</p>
                    <button onclick="document.getElementById('csvFileInput').click()" class="text-blue-500 hover:text-blue-400">browse to upload</button>
                </div>

                <div class="bg-gray-800 rounded-lg p-4">
                    <h4 class="text-sm font-medium text-white mb-2">Required columns:</h4>
                    <ul class="text-sm text-gray-400 space-y-1">
                        <li>✓ name - Full name of the contact</li>
                        <li>✓ email - Email address</li>
                        <li>✓ title - Job title or role</li>
                        <li>✓ company - Company name (optional)</li>
                        <li>✓ link - LinkedIn profile, website URL, or document link (PDF, DOC, etc.)</li>
                        <li>✓ context - Additional context like Product Hunt comments, notes, etc. (optional)</li>
                    </ul>
                    <button onclick="window.promoteWizard.downloadCSVTemplate()" class="text-blue-500 text-sm mt-3 hover:text-blue-400">Download template CSV</button>
                </div>
                
                <div class="bg-blue-900 bg-opacity-20 border border-blue-800 rounded-lg p-4">
                    <h4 class="text-sm font-medium text-blue-400 mb-2">Supported profile formats:</h4>
                    <p class="text-sm text-gray-300">• Web pages (LinkedIn, personal websites, etc.)</p>
                    <p class="text-sm text-gray-300">• PDF documents (resumes, bios, etc.)</p>
                    <p class="text-sm text-gray-300">• Word documents (.doc, .docx)</p>
                    <p class="text-sm text-gray-300">• Text files (.txt, .md)</p>
                    <p class="text-xs text-gray-400 mt-2">Content from these links will be used to personalize questions and emails.</p>
                </div>

                <div id="csvPreview" class="hidden">
                    <h4 class="text-sm font-medium text-white mb-2">Preview:</h4>
                    <div class="bg-gray-800 rounded-lg p-4 overflow-x-auto">
                        <table class="w-full text-sm text-gray-400" id="csvPreviewTable">
                            <!-- Preview content -->
                        </table>
                    </div>
                </div>
            </div>
        `;

        this.setupFileUpload();
    }

    setupFileUpload() {
        const fileInput = document.getElementById('csvFileInput');
        const dropZone = fileInput.parentElement;

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleCSVFile(e.target.files[0]);
            }
        });

        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-blue-500');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('border-blue-500');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-blue-500');
            if (e.dataTransfer.files.length > 0) {
                this.handleCSVFile(e.dataTransfer.files[0]);
            }
        });
    }

    async handleCSVFile(file) {
        if (!file.name.endsWith('.csv')) {
            alert('Please upload a CSV file');
            return;
        }

        const text = await file.text();
        const contacts = this.parseCSV(text);
        
        if (contacts.length === 0) {
            alert('No valid contacts found in CSV');
            return;
        }

        this.wizardData.contacts = contacts;
        this.showCSVPreview(contacts);
    }

    parseCSV(text) {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) return [];

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const requiredHeaders = ['name', 'email', 'title', 'link'];
        
        // Check for required headers
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
            alert(`Missing required columns: ${missingHeaders.join(', ')}`);
            return [];
        }

        // Parse contacts
        const contacts = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const contact = {};
            headers.forEach((header, index) => {
                contact[header] = values[index] || '';
            });
            
            // Validate required fields
            if (contact.name && contact.email && contact.title && contact.link) {
                contacts.push(contact);
            }
        }

        return contacts;
    }

    showCSVPreview(contacts) {
        const previewDiv = document.getElementById('csvPreview');
        const table = document.getElementById('csvPreviewTable');
        
        // Show first 5 contacts
        const preview = contacts.slice(0, 5);
        table.innerHTML = `
            <thead>
                <tr class="border-b border-gray-700">
                    <th class="text-left pr-4">Name</th>
                    <th class="text-left pr-4">Email</th>
                    <th class="text-left pr-4">Title</th>
                    <th class="text-left pr-4">Company</th>
                    <th class="text-left pr-4">Link</th>
                    <th class="text-left">Context</th>
                </tr>
            </thead>
            <tbody>
                ${preview.map(c => `
                    <tr>
                        <td class="pr-4 py-1">${c.name}</td>
                        <td class="pr-4 py-1">${c.email}</td>
                        <td class="pr-4 py-1">${c.title}</td>
                        <td class="pr-4 py-1">${c.company || ''}</td>
                        <td class="pr-4 py-1 truncate max-w-xs">${c.link}</td>
                        <td class="py-1 truncate max-w-xs">${c.context || ''}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        
        if (contacts.length > 5) {
            table.innerHTML += `
                <tfoot>
                    <tr>
                        <td colspan="4" class="text-center pt-2 text-gray-500">
                            ... and ${contacts.length - 5} more contacts
                        </td>
                    </tr>
                </tfoot>
            `;
        }
        
        previewDiv.classList.remove('hidden');
    }

    showProductHuntSearch(container) {
        container.innerHTML = `
            <div class="space-y-4">
                <h3 class="text-lg font-medium text-white mb-4">Search Product Hunt</h3>
                
                <div class="bg-gray-800 rounded-lg p-4 space-y-4">
                    <div class="bg-blue-900/20 border border-blue-700 rounded p-3 mb-4 text-sm">
                        <p class="text-blue-400 font-medium mb-1">📊 How it works:</p>
                        <p class="text-blue-300">We'll fetch the top 50 products for each day in your date range, sorted by votes.</p>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Date Range</label>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs text-gray-400 mb-1">From</label>
                                <input type="date" id="phDateFrom" class="w-full py-2 px-3 bg-gray-700 rounded text-white border border-gray-600 focus:border-orange-500" />
                            </div>
                            <div>
                                <label class="block text-xs text-gray-400 mb-1">To</label>
                                <input type="date" id="phDateTo" class="w-full py-2 px-3 bg-gray-700 rounded text-white border border-gray-600 focus:border-orange-500" />
                            </div>
                        </div>
                        <div class="mt-2 space-x-2">
                            <button onclick="window.promoteWizard.setDateRange(7)" class="text-xs text-blue-400 hover:text-blue-300">Last 7 days</button>
                            <button onclick="window.promoteWizard.setDateRange(3)" class="text-xs text-blue-400 hover:text-blue-300">Last 3 days</button>
                            <button onclick="window.promoteWizard.setDateRange(1)" class="text-xs text-blue-400 hover:text-blue-300">Today</button>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-2">Vote Filter (Optional)</label>
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs text-gray-400 mb-1">Minimum</label>
                                <input type="number" id="phMinVotes" min="0" value="0" placeholder="0" class="w-full py-2 px-3 bg-gray-700 rounded text-white border border-gray-600 focus:border-orange-500" />
                            </div>
                            <div>
                                <label class="block text-xs text-gray-400 mb-1">Maximum</label>
                                <input type="number" id="phMaxVotes" min="0" value="" placeholder="No limit" class="w-full py-2 px-3 bg-gray-700 rounded text-white border border-gray-600 focus:border-orange-500" />
                            </div>
                        </div>
                        <p class="text-xs text-gray-400 mt-1">After fetching top 50/day, filter by vote count</p>
                    </div>
                    
                    <button id="searchProductHunt" class="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors">
                        Search Products
                    </button>
                </div>
                
                <div id="phSearchResults" class="hidden">
                    <h4 class="text-sm font-medium text-white mb-2">Search Results</h4>
                    <div id="phResultsList" class="space-y-2 max-h-64 overflow-y-auto">
                        <!-- Results will be populated here -->
                    </div>
                </div>
                
                <div id="phSelectedContacts" class="hidden">
                    <h4 class="text-sm font-medium text-white mb-2">Selected Founders (<span id="phSelectedCount">0</span>)</h4>
                    <div id="phSelectedList" class="space-y-1 text-sm text-gray-400">
                        <!-- Selected contacts will be listed here -->
                    </div>
                </div>
            </div>
        `;
        
        // Set default dates (last 30 days)
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 30);
        
        document.getElementById('phDateFrom').value = fromDate.toISOString().split('T')[0];
        document.getElementById('phDateTo').value = toDate.toISOString().split('T')[0];
        
        // Handle search button
        document.getElementById('searchProductHunt').addEventListener('click', () => {
            this.searchProductHunt();
        });
    }

    setDateRange(days) {
        const toDate = new Date();
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days + 1);
        
        document.getElementById('phDateFrom').value = fromDate.toISOString().split('T')[0];
        document.getElementById('phDateTo').value = toDate.toISOString().split('T')[0];
        
        // For shorter ranges, no need to filter votes
        if (days <= 3) {
            document.getElementById('phMinVotes').value = 0;
            document.getElementById('phMaxVotes').value = "";
        }
    }

    async searchProductHunt() {
        const fromDate = document.getElementById('phDateFrom').value;
        const toDate = document.getElementById('phDateTo').value;
        const minVotes = parseInt(document.getElementById('phMinVotes').value) || 0;
        const maxVotes = document.getElementById('phMaxVotes').value ? parseInt(document.getElementById('phMaxVotes').value) : null;
        
        if (!fromDate || !toDate) {
            alert('Please select both start and end dates');
            return;
        }
        
        const searchBtn = document.getElementById('searchProductHunt');
        searchBtn.disabled = true;
        searchBtn.innerHTML = '<span class="spinner inline-block w-4 h-4 mr-2"></span>Searching...';
        
        try {
            const response = await fetch('/api/campaigns/search-producthunt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
                },
                body: JSON.stringify({
                    fromDate,
                    toDate,
                    minVotes,
                    maxVotes
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                if (errorData.message) {
                    throw new Error(errorData.message);
                } else {
                    throw new Error('Failed to search Product Hunt');
                }
            }
            
            const data = await response.json();
            this.displayProductHuntResults(data.products || [], data.searchHint);
            
        } catch (error) {
            console.error('Error searching Product Hunt:', error);
            
            // Show the actual error message
            alert(error.message || 'Failed to search Product Hunt. Please try again.');
        } finally {
            searchBtn.disabled = false;
            searchBtn.innerHTML = 'Search Products';
        }
    }

    displayProductHuntResults(products, searchHint) {
        const resultsDiv = document.getElementById('phSearchResults');
        const resultsList = document.getElementById('phResultsList');
        
        if (products.length === 0) {
            resultsList.innerHTML = '<p class="text-gray-400 text-center py-4">No products found matching your criteria</p>';
            resultsDiv.classList.remove('hidden');
            return;
        }
        
        // Show search hint if provided
        if (searchHint) {
            resultsList.innerHTML = `<div class="bg-yellow-900/20 border border-yellow-700 rounded p-3 mb-3 text-sm text-yellow-400">${searchHint}</div>`;
        } else {
            resultsList.innerHTML = '';
        }
        
        resultsList.innerHTML += products.map(product => `
            <label class="block p-3 border border-gray-700 rounded cursor-pointer hover:border-orange-500 transition-colors">
                <input type="checkbox" class="mr-2" value="${product.id}" data-product='${JSON.stringify(product)}' />
                <span class="text-white font-medium">${product.name}</span>
                <span class="text-gray-400 text-sm ml-2">by ${product.hunter.name}</span>
                <span class="text-orange-400 text-sm ml-2">${product.votesCount} votes</span>
            </label>
        `).join('');
        
        resultsDiv.classList.remove('hidden');
        
        // Handle checkbox changes
        resultsList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateSelectedContacts();
            });
        });
    }

    updateSelectedContacts() {
        const selectedCheckboxes = document.querySelectorAll('#phResultsList input[type="checkbox"]:checked');
        const selectedDiv = document.getElementById('phSelectedContacts');
        const selectedList = document.getElementById('phSelectedList');
        const selectedCount = document.getElementById('phSelectedCount');
        
        if (selectedCheckboxes.length === 0) {
            selectedDiv.classList.add('hidden');
            this.wizardData.contacts = [];
            return;
        }
        
        // Convert selected products to contacts
        const contacts = [];
        selectedCheckboxes.forEach(checkbox => {
            const product = JSON.parse(checkbox.dataset.product);
            contacts.push({
                name: product.hunter.name,
                email: product.hunter.email || `${product.hunter.username}@producthunt.com`, // Placeholder if no email
                title: 'Founder',
                company: product.name, // Using product name as company for now
                link: product.hunter.websiteUrl || product.website || `https://www.producthunt.com/@${product.hunter.username}`,
                productHuntComment: product.hunter.comment || '',
                productHuntId: product.id
            });
        });
        
        this.wizardData.contacts = contacts;
        selectedCount.textContent = contacts.length;
        selectedList.innerHTML = contacts.map(c => `${c.name} - ${c.company}`).join('<br>');
        selectedDiv.classList.remove('hidden');
    }

    showProcessing(container) {
        container.innerHTML = `
            <div class="space-y-6">
                <h3 class="text-lg font-medium text-white mb-4">Processing ${this.wizardData.contacts.length} contacts...</h3>
                
                <div class="space-y-4" id="processingSteps">
                    <div class="flex items-center space-x-3" data-step="validate">
                        <div class="spinner w-5 h-5"></div>
                        <span class="text-gray-400">Validating emails</span>
                    </div>
                    <div class="flex items-center space-x-3" data-step="scrape">
                        <div class="spinner w-5 h-5"></div>
                        <span class="text-gray-400">Extracting content from profile links & documents</span>
                    </div>
                    <div class="flex items-center space-x-3" data-step="generate">
                        <div class="spinner w-5 h-5"></div>
                        <span class="text-gray-400">Generating personalized questions</span>
                    </div>
                    <div class="flex items-center space-x-3" data-step="links">
                        <div class="spinner w-5 h-5"></div>
                        <span class="text-gray-400">Creating interview links</span>
                    </div>
                </div>

                <div class="bg-gray-800 rounded-lg p-4 hidden" id="processingProgress">
                    <div class="flex justify-between text-sm mb-2">
                        <span class="text-gray-400">Progress</span>
                        <span class="text-white"><span id="processedCount">0</span> / ${this.wizardData.contacts.length}</span>
                    </div>
                    <div class="w-full bg-gray-700 rounded-full h-2">
                        <div class="bg-blue-500 h-2 rounded-full transition-all duration-300" id="progressBar" style="width: 0%"></div>
                    </div>
                </div>

                <style>
                    .spinner {
                        border: 2px solid #374151;
                        border-top-color: #3B82F6;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                    .step-complete {
                        color: #10B981;
                    }
                    .line-clamp-3 {
                        overflow: hidden;
                        display: -webkit-box;
                        -webkit-line-clamp: 3;
                        -webkit-box-orient: vertical;
                    }
                </style>
            </div>
        `;

        // Start processing
        this.processContacts();
    }

    async processContacts() {
        const steps = ['validate', 'scrape', 'generate', 'links'];
        const progressBar = document.getElementById('progressBar');
        const processedCount = document.getElementById('processedCount');
        const processingProgress = document.getElementById('processingProgress');

        processingProgress.classList.remove('hidden');

        for (let i = 0; i < steps.length; i++) {
            const stepEl = document.querySelector(`[data-step="${steps[i]}"]`);
            
            // Simulate processing with actual API calls
            await this.performProcessingStep(steps[i]);
            
            // Update UI
            stepEl.innerHTML = `
                <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
                <span class="text-gray-400 step-complete">${stepEl.querySelector('span').textContent}</span>
            `;

            // Update progress
            const progress = ((i + 1) / steps.length) * 100;
            progressBar.style.width = `${progress}%`;
            processedCount.textContent = Math.floor((progress / 100) * this.wizardData.contacts.length);
        }

        // Auto-advance after processing
        setTimeout(() => this.nextStep(), 1000);
    }

    async performProcessingStep(step) {
        try {
            switch(step) {
                case 'validate':
                    // Validate email addresses
                    const validateResponse = await fetch('/api/campaigns/validate', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
                        },
                        body: JSON.stringify({ contacts: this.wizardData.contacts })
                    });
                    
                    if (!validateResponse.ok) throw new Error('Validation failed');
                    const validation = await validateResponse.json();
                    this.wizardData.contacts = validation.validatedContacts;
                    break;
                    
                case 'scrape':
                case 'generate':
                case 'links':
                    // Process contacts (scraping, question generation, link creation)
                    if (step === 'scrape') {
                        const processResponse = await fetch('/api/campaigns/process', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
                            },
                            body: JSON.stringify({
                                contacts: this.wizardData.contacts,
                                interviewId: this.interviewId,
                                questionPrompt: this.wizardData.questionPrompt || this.wizardData.questionInstructions || ''
                            })
                        });
                        
                        if (!processResponse.ok) throw new Error('Processing failed');
                        const processed = await processResponse.json();
                        this.wizardData.processedContacts = processed.processedContacts;
                        console.log('[Campaign] Processed contacts:', this.wizardData.processedContacts);
                    }
                    break;
            }
        } catch (error) {
            console.error(`Error in step ${step}:`, error);
            throw error;
        }
    }

    async showQuestionRefinement(container) {
        // Get the first contact to use as example
        const firstContact = this.wizardData.processedContacts?.[0] || this.wizardData.contacts[0];
        
        if (!firstContact) {
            container.innerHTML = '<div class="text-center py-8"><p class="text-red-400">No contacts available</p></div>';
            return;
        }

        container.innerHTML = `
            <div class="space-y-4">
                <h3 class="text-lg font-medium text-white mb-4">Craft Your Interview Question</h3>
                
                <div class="bg-gray-800 rounded-lg p-4 mb-6">
                    <h4 class="text-sm font-medium text-gray-300 mb-2">First contact:</h4>
                    <p class="text-white">${firstContact.name} - ${firstContact.title}</p>
                    ${firstContact.profileContext ? 
                        `<p class="text-sm text-gray-400 mt-2 line-clamp-3">${firstContact.profileContext.substring(0, 200)}...</p>` : 
                        '<p class="text-sm text-gray-500 mt-2">No profile context available</p>'
                    }
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Question Instructions</label>
                    <textarea 
                        id="questionPrompt"
                        class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none resize-y"
                        rows="4"
                        placeholder="Describe the type of question you want. E.g., 'Ask about their biggest challenge in scaling their team' or 'Inquire about their experience with remote work culture'">${this.wizardData.questionPrompt || ''}</textarea>
                    <p class="text-xs text-gray-500 mt-1">The system will use this to generate a personalized question for each contact.</p>
                </div>

                <div class="mt-6">
                    <div class="flex justify-between items-center mb-3">
                        <h4 class="text-sm font-medium text-gray-300">Generated Question Preview</h4>
                        <button id="regenerateQuestion" class="text-blue-500 hover:text-blue-400 text-sm">
                            <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                            </svg>
                            Regenerate
                        </button>
                    </div>
                    
                    <div id="questionPreview" class="bg-gray-900 rounded-lg p-4 min-h-[80px]">
                        <div class="text-gray-400 text-sm">Click "Generate Question" to see a preview...</div>
                    </div>
                </div>

                <div class="flex justify-end space-x-3 mt-6">
                    <button id="generateQuestionBtn" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">
                        Generate Question
                    </button>
                </div>
            </div>
        `;

        // Setup event handlers
        const generateBtn = document.getElementById('generateQuestionBtn');
        const regenerateBtn = document.getElementById('regenerateQuestion');
        const promptTextarea = document.getElementById('questionPrompt');
        
        const generateQuestion = async () => {
            const prompt = promptTextarea.value.trim();
            if (!prompt) {
                alert('Please provide instructions for the question');
                return;
            }

            this.wizardData.questionPrompt = prompt;
            
            // Show loading state
            const previewDiv = document.getElementById('questionPreview');
            previewDiv.innerHTML = '<div class="flex items-center"><div class="spinner w-4 h-4 mr-2"></div><span class="text-gray-400">Generating question...</span></div>';
            
            try {
                // Generate a single question for preview
                const response = await fetch('/api/campaigns/generate-question', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
                    },
                    body: JSON.stringify({
                        contact: firstContact,
                        interviewContext: this.interviewTitle,
                        questionPrompt: prompt
                    })
                });
                
                if (!response.ok) throw new Error('Failed to generate question');
                const { question } = await response.json();
                
                this.wizardData.sampleQuestion = question;
                previewDiv.innerHTML = `<p class="text-white">${question}</p>`;
                
                // Enable next button
                document.getElementById('wizardNext').disabled = false;
                
            } catch (error) {
                console.error('Error generating question:', error);
                previewDiv.innerHTML = '<p class="text-red-400">Failed to generate question. Please try again.</p>';
            }
        };
        
        generateBtn.addEventListener('click', generateQuestion);
        regenerateBtn.addEventListener('click', generateQuestion);
        
        // Disable next button until question is generated
        document.getElementById('wizardNext').disabled = true;
    }

    async showEmailTemplate(container) {
        container.innerHTML = `
            <div class="space-y-4">
                <h3 class="text-lg font-medium text-white mb-4">Write Your Email Template</h3>
                
                <div class="bg-blue-900 bg-opacity-20 border border-blue-800 rounded-lg p-4 mb-6">
                    <p class="text-sm text-blue-300">Write your email as you normally would. The system will personalize it for each recipient by:</p>
                    <ul class="text-sm text-blue-300 mt-2 space-y-1">
                        <li>• Referencing their specific background and achievements</li>
                        <li>• Adjusting the tone to match their profile</li>
                        <li>• Including the personalized question naturally</li>
                    </ul>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Email Subject</label>
                    <input type="text" 
                           id="emailSubject"
                           class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none"
                           placeholder="Quick question about your experience with [topic]"
                           value="${this.wizardData.emailSubject || ''}">
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-2">Email Body</label>
                    <textarea 
                        id="emailBody"
                        class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none resize-y"
                        rows="12"
                        placeholder="Hi [Name],

I came across your profile and was impressed by your work...

I'm conducting research on [topic] and would love to hear your perspective.

I've prepared a brief AI-powered interview that adapts to your responses - it typically takes 10-15 minutes.

Would you be open to sharing your thoughts?

Best regards,
[Your name]">${this.wizardData.emailBody || ''}</textarea>
                    <p class="text-xs text-gray-500 mt-1">Use placeholders like [Name], [topic] etc. They'll be replaced with personalized content.</p>
                </div>

                <div class="mt-6">
                    <h4 class="text-sm font-medium text-gray-300 mb-2">Personalization Instructions (optional)</h4>
                    <textarea 
                        id="personalizationInstructions"
                        class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:border-blue-500 focus:outline-none resize-y"
                        rows="3"
                        placeholder="E.g., 'Keep the tone professional but friendly', 'Emphasize the value of their specific expertise', 'Mention it takes 10-15 minutes'">${this.wizardData.personalizationInstructions || ''}</textarea>
                </div>
            </div>
        `;

        // Add preview section
        const previewHtml = `
            <div class="mt-8 border-t border-gray-600 pt-6">
                <div class="flex justify-between items-center mb-3">
                    <h4 class="text-sm font-medium text-gray-300">Email Preview (for ${this.wizardData.processedContacts?.[0]?.name || 'first contact'})</h4>
                    <button id="generateEmailPreview" class="text-blue-500 hover:text-blue-400 text-sm">
                        <svg class="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                        </svg>
                        Generate Preview
                    </button>
                </div>
                
                <div id="emailPreview" class="bg-gray-900 rounded-lg p-4 min-h-[120px]">
                    <div class="text-gray-400 text-sm">Click "Generate Preview" to see how your email will look personalized...</div>
                </div>
            </div>
        `;
        
        container.querySelector('.space-y-4').insertAdjacentHTML('beforeend', previewHtml);

        // Setup event handlers
        const generatePreviewBtn = document.getElementById('generateEmailPreview');
        const nextBtn = document.getElementById('wizardNext');
        
        const generateEmailPreview = async () => {
            const subject = document.getElementById('emailSubject').value.trim();
            const body = document.getElementById('emailBody').value.trim();
            const instructions = document.getElementById('personalizationInstructions').value.trim();
            
            if (!subject || !body) {
                alert('Please write both subject and body for your email template');
                return;
            }
            
            // Save current values
            this.wizardData.emailSubject = subject;
            this.wizardData.emailBody = body;
            this.wizardData.personalizationInstructions = instructions;
            
            // Show loading state
            const previewDiv = document.getElementById('emailPreview');
            previewDiv.innerHTML = '<div class="flex items-center"><div class="spinner w-4 h-4 mr-2"></div><span class="text-gray-400">Generating preview...</span></div>';
            
            try {
                // Generate preview for first contact only
                const firstContact = this.wizardData.processedContacts[0];
                if (!firstContact.personalizedQuestion) {
                    firstContact.personalizedQuestion = this.wizardData.sampleQuestion;
                }
                
                const response = await fetch('/api/campaigns/generate-email-preview', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
                    },
                    body: JSON.stringify({
                        contact: firstContact,
                        interviewTitle: this.interviewTitle,
                        emailTemplate: {
                            subject: subject,
                            body: body
                        },
                        personalizationInstructions: instructions
                    })
                });
                
                if (!response.ok) throw new Error('Failed to generate preview');
                const { email } = await response.json();
                
                this.wizardData.sampleEmail = email;
                previewDiv.innerHTML = `
                    <div class="space-y-3">
                        <div>
                            <p class="text-xs text-gray-500 mb-1">Subject:</p>
                            <p class="text-white font-medium">${email.subject}</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500 mb-1">Body:</p>
                            <div class="text-gray-300 whitespace-pre-wrap text-sm">${email.body}</div>
                        </div>
                    </div>
                `;
                
                // Enable next button
                nextBtn.disabled = false;
                
            } catch (error) {
                console.error('Error generating email preview:', error);
                previewDiv.innerHTML = '<p class="text-red-400">Failed to generate preview. Please try again.</p>';
            }
        };
        
        generatePreviewBtn.addEventListener('click', generateEmailPreview);
        
        // Disable next button until preview is generated
        nextBtn.disabled = true;
    }

    async showEmailReview(container) {
        // Show loading state
        container.innerHTML = '<div class="text-center py-8"><div class="spinner w-8 h-8 mx-auto mb-4"></div><p class="text-gray-400">Generating personalized content for all contacts...</p></div>';
        
        console.log('[Campaign] Starting email review with wizardData:', {
            questionPrompt: this.wizardData.questionPrompt,
            emailSubject: this.wizardData.emailSubject,
            emailBody: this.wizardData.emailBody,
            contactsCount: this.wizardData.processedContacts?.length
        });
        
        try {
            // First, generate personalized questions for all contacts
            const questionResponse = await fetch('/api/campaigns/generate-all-questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
                },
                body: JSON.stringify({
                    contacts: this.wizardData.processedContacts,
                    interviewId: this.interviewId,
                    interviewTitle: this.interviewTitle,
                    questionPrompt: this.wizardData.questionPrompt || ''
                })
            });
            
            if (!questionResponse.ok) {
                const errorData = await questionResponse.json();
                throw new Error(errorData.error || 'Failed to generate questions');
            }
            const { contactsWithQuestions } = await questionResponse.json();
            
            // Update processed contacts with questions
            this.wizardData.processedContacts = contactsWithQuestions;
            
            // Update loading message
            container.querySelector('p').textContent = 'Generating personalized emails...';
            
            // Now generate emails using the user's template
            const response = await fetch('/api/campaigns/generate-emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
                },
                body: JSON.stringify({
                    contacts: contactsWithQuestions,
                    interviewId: this.interviewId,
                    interviewTitle: this.interviewTitle,
                    emailTemplate: {
                        subject: this.wizardData.emailSubject,
                        body: this.wizardData.emailBody
                    },
                    personalizationInstructions: this.wizardData.personalizationInstructions || '',
                    questionPrompt: this.wizardData.questionPrompt
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate emails');
            }
            const { emails } = await response.json();
            this.wizardData.emails = emails;
            
            // Show first 5 emails for review
            const emailsToShow = emails.slice(0, 5);

            container.innerHTML = `
                <div class="space-y-4">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium text-white">Review Personalized Invites</h3>
                        <span class="text-sm text-gray-400">Showing ${emailsToShow.length} of ${emails.length} emails</span>
                    </div>
                    
                    <div class="space-y-6" id="emailList">
                        ${emailsToShow.map((email, index) => `
                        <div class="bg-gray-800 rounded-lg p-6 space-y-4" data-email-index="${index}">
                            <div class="flex justify-between items-start">
                                <div class="flex-1 max-w-3xl">
                                    <p class="text-sm text-gray-400 mb-1">To: ${email.to}</p>
                                    <p class="text-lg text-white font-medium">${email.subject}</p>
                                </div>
                                <div class="flex space-x-3">
                                    <button class="px-3 py-1 text-blue-500 hover:text-blue-400 hover:bg-gray-700 rounded transition-colors">Edit</button>
                                    <button class="px-3 py-1 text-red-500 hover:text-red-400 hover:bg-gray-700 rounded transition-colors">Exclude</button>
                                </div>
                            </div>
                            <div class="bg-gray-900 rounded-lg p-4">
                                <div class="text-sm text-gray-300 whitespace-pre-wrap break-words leading-relaxed" style="word-break: break-word; overflow-wrap: anywhere;">${email.body}</div>
                            </div>
                            <div class="flex justify-between items-center pt-2">
                                <span class="text-xs text-gray-500">Interview link will be personalized for each recipient</span>
                                <button class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors">Approve</button>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <div class="flex justify-center space-x-4 pt-4">
                    <button class="text-gray-400 hover:text-white">← Previous</button>
                    <span class="text-gray-500">1 / ${Math.ceil(this.wizardData.contacts.length / 10)}</span>
                    <button class="text-gray-400 hover:text-white">Next →</button>
                </div>
            </div>
        `;
        } catch (error) {
            console.error('Error generating emails:', error);
            const errorMsg = error.message || 'Failed to generate emails';
            container.innerHTML = `
                <div class="text-center py-8">
                    <p class="text-red-400 mb-4">${errorMsg}</p>
                    <button onclick="window.promoteWizard.showStep(${this.currentStep})" class="text-blue-500 hover:text-blue-400">
                        Try Again
                    </button>
                </div>
            `;
        }
    }

    showSendConfiguration(container) {
        container.innerHTML = `
            <div class="space-y-6">
                <h3 class="text-lg font-medium text-white mb-4">Campaign Settings</h3>
                
                <div>
                    <label class="block text-sm font-medium text-gray-400 mb-2">Campaign Name</label>
                    <input type="text" 
                           id="campaignName"
                           value="${this.interviewTitle} Outreach"
                           class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:border-blue-500 focus:outline-none">
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-400 mb-2">Sending Strategy</label>
                    <div class="space-y-2">
                        <label class="flex items-center">
                            <input type="radio" name="sendingStrategy" value="all" class="mr-2">
                            <span class="text-gray-300">Send all at once</span>
                        </label>
                        <label class="flex items-center">
                            <input type="radio" name="sendingStrategy" value="throttled" checked class="mr-2">
                            <div>
                                <span class="text-gray-300">Throttled sending (recommended)</span>
                                <div class="flex items-center mt-1 ml-6">
                                    <input type="number" id="emailsPerHour" value="20" min="1" max="50" 
                                           class="w-16 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm">
                                    <span class="text-gray-400 text-sm ml-2">emails per hour</span>
                                </div>
                            </div>
                        </label>
                    </div>
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-400 mb-2">Schedule</label>
                    <div class="space-y-2">
                        <label class="flex items-center">
                            <input type="radio" name="schedule" value="now" checked class="mr-2">
                            <span class="text-gray-300">Send now</span>
                        </label>
                        <label class="flex items-center">
                            <input type="radio" name="schedule" value="later" class="mr-2">
                            <span class="text-gray-300">Schedule for later</span>
                        </label>
                    </div>
                </div>

                <div class="bg-blue-900 bg-opacity-20 border border-blue-800 rounded-lg p-4">
                    <h4 class="text-blue-400 font-medium mb-2">Ready to send</h4>
                    <p class="text-gray-300 text-sm">
                        ${this.wizardData.contacts.length} personalized interview invitations will be sent
                        ${document.querySelector('input[name="sendingStrategy"]:checked')?.value === 'throttled' ? 
                          'at 20 emails per hour' : 'immediately'}.
                    </p>
                </div>
            </div>
        `;

        // Update next button to "Send Campaign"
        const nextBtn = document.getElementById('wizardNext');
        nextBtn.textContent = 'Send Campaign';
        nextBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        nextBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    }

    updateProgress() {
        const steps = ['Choose Audience', 'Import List', 'Process', 'Craft Question', 'Write Email', 'Review', 'Send'];
        const stepLabel = document.getElementById('stepLabel');
        stepLabel.textContent = steps[this.currentStep - 1];

        // Update step indicators
        document.querySelectorAll('.step-indicator').forEach((indicator, index) => {
            // Since we skip step 1, adjust the step number
            const step = index + 2; // Start from step 2
            
            // Remove all state classes
            indicator.classList.remove('bg-gray-600', 'bg-blue-600', 'bg-green-600', 'text-gray-400', 'text-white');
            
            if (step === this.currentStep) {
                // Active step
                indicator.classList.add('bg-blue-600', 'text-white');
            } else if (step < this.currentStep) {
                // Completed step
                indicator.classList.add('bg-green-600', 'text-white');
            } else {
                // Future step
                indicator.classList.add('bg-gray-600', 'text-gray-400');
            }
        });
    }

    async nextStep() {
        // Validate current step
        if (!this.validateCurrentStep()) return;

        if (this.currentStep < 7) {
            this.showStep(this.currentStep + 1);
        } else {
            // Send campaign
            await this.sendCampaign();
        }
    }

    previousStep() {
        if (this.currentStep > 2) { // Can't go back before step 2
            this.showStep(this.currentStep - 1);
        }
    }

    validateCurrentStep() {
        switch(this.currentStep) {
            case 1:
                if (!this.wizardData.audienceType) {
                    alert('Please select an audience type');
                    return false;
                }
                break;
            case 2:
                if (this.wizardData.contacts.length === 0) {
                    alert('Please upload a CSV file with contacts');
                    return false;
                }
                break;
        }
        return true;
    }

    async sendCampaign() {
        // Collect final settings
        this.wizardData.campaign.name = document.getElementById('campaignName').value;
        
        // Show sending state
        const content = document.getElementById('wizardContent');
        content.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full">
                <div class="spinner w-12 h-12 mb-4"></div>
                <h3 class="text-lg font-medium text-white mb-2">Sending Campaign...</h3>
                <p class="text-gray-400">This may take a few moments</p>
            </div>
        `;

        try {
            // Get final settings from form
            const sendingStrategy = document.querySelector('input[name="sendingStrategy"]:checked')?.value || 'throttled';
            const emailsPerHour = document.getElementById('emailsPerHour')?.value || 20;
            const schedule = document.querySelector('input[name="schedule"]:checked')?.value || 'now';
            
            this.wizardData.campaign.sendingStrategy = sendingStrategy;
            this.wizardData.campaign.emailsPerHour = parseInt(emailsPerHour);
            this.wizardData.campaign.schedule = schedule;
            
            // API call to send campaign
            const response = await fetch('/api/campaigns/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`
                },
                body: JSON.stringify({
                    interviewId: this.interviewId,
                    contacts: this.wizardData.processedContacts || this.wizardData.contacts,
                    emails: this.wizardData.emails,
                    settings: this.wizardData.campaign
                })
            });

            if (response.ok) {
                this.showSuccess();
            } else {
                throw new Error('Failed to send campaign');
            }
        } catch (error) {
            console.error('Campaign send error:', error);
            this.showError(error.message);
        }
    }

    showSuccess() {
        const content = document.getElementById('wizardContent');
        content.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full">
                <svg class="w-16 h-16 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3 class="text-lg font-medium text-white mb-2">Campaign Sent Successfully!</h3>
                <p class="text-gray-400 text-center mb-4">
                    ${this.wizardData.contacts.length} interview invitations are being sent.
                </p>
                <button onclick="promoteWizard.close()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Done
                </button>
            </div>
        `;

        // Hide footer buttons
        document.getElementById('wizardBack').style.display = 'none';
        document.getElementById('wizardNext').style.display = 'none';
    }

    showError(message) {
        const content = document.getElementById('wizardContent');
        content.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full">
                <svg class="w-16 h-16 text-red-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <h3 class="text-lg font-medium text-white mb-2">Failed to Send Campaign</h3>
                <p class="text-gray-400 text-center mb-4">${message}</p>
                <button onclick="promoteWizard.previousStep()" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Go Back
                </button>
            </div>
        `;
    }

    close() {
        const panel = document.getElementById('promoteInterviewerPanel');
        const overlay = document.getElementById('promoteInterviewerOverlay');
        
        if (panel) {
            panel.style.transform = 'translateX(100%)';
            if (overlay) {
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
            }
            
            setTimeout(() => {
                if (panel) panel.remove();
                if (overlay) overlay.remove();
            }, 300);
        }
    }
    
    downloadCSVTemplate() {
        const csvContent = `name,email,title,company,link,context
"John Doe","john@example.com","Senior Product Manager","Acme Corp","https://linkedin.com/in/johndoe","John launched ProductX on Product Hunt last week. His comment: 'We built this to solve remote team collaboration issues we faced ourselves.'"
"Jane Smith","jane@example.com","VP of Engineering","TechCo","https://linkedin.com/in/janesmith","Previously CTO at StartupY. Recent blog post about scaling engineering teams. Interested in AI/ML applications."
"Bob Johnson","bob@example.com","Head of Sales","SalesForce Inc","https://linkedin.com/in/bobjohnson","20 years in enterprise sales. Speaking at SaaStr next month about PLG strategies."`;
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'interview-campaign-template.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
}

// Create global instance
try {
    window.promoteWizard = new PromoteInterviewerWizard();
    console.log('[PromoteWizard] Global instance created successfully');
    
    // Add a test function
    window.testPromoteWizard = function() {
        console.log('[PromoteWizard] Test function called');
        if (window.promoteWizard) {
            window.promoteWizard.open('test-id', 'Test Interview');
        } else {
            console.error('[PromoteWizard] Wizard not available');
        }
    };
} catch (error) {
    console.error('[PromoteWizard] Error creating instance:', error);
}