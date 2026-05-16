// Video B-Roll Prompts Module
// Handles the generation and editing of b-roll prompts for analyst video summaries

async function showBrollPromptReview(messageContent, messageElement, button, originalButtonText) {
    console.log('[showBrollPromptReview] Parsing message content for all segments');
    
    // Parse all segments including video clips
    const allSegments = parseAllSegments(messageContent);
    const ttsSegments = getTTSSegments(allSegments);
    
    if (ttsSegments.length === 0) {
        console.log('[showBrollPromptReview] No TTS segments found');
        return [];
    }
    
    // Show panel immediately with style input
    return new Promise((resolve) => {
        // Store resolve function globally for panel to use
        window._brollPromptsResolve = resolve;
        window._brollPromptsSegments = ttsSegments;
        window._brollPromptsAllSegments = allSegments; // Store all segments for timestamp calculation
        window._brollPromptsButton = button;
        window._brollPromptsOriginalText = originalButtonText;
        
        // Open the b-roll prompts panel
        if (window.appState) {
            window.appState.setBrollPromptsPanelOpen(true);
            if (window.applyBrollPromptsPanelState) {
                window.applyBrollPromptsPanelState();
            }
        }
        
        // Show style input form
        showBrollStyleInput(ttsSegments.length);
    });
}

// Parse message content to extract all segments including video clips
function parseAllSegments(htmlContent) {
    const segments = [];
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    let currentSegment = '';
    
    function processNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) {
                currentSegment += text + ' ';
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === 'BLOCKQUOTE') {
                // End current segment if it has content
                if (currentSegment.trim()) {
                    segments.push({
                        type: 'tts',
                        text: currentSegment.trim()
                    });
                    currentSegment = '';
                }
                
                // Extract video clip duration from attributes
                const startTime = parseFloat(node.getAttribute('data-start-time') || '0');
                const endTime = parseFloat(node.getAttribute('data-end-time') || '0');
                const duration = endTime > startTime ? endTime - startTime : 0;
                
                // Add video clip with duration
                segments.push({
                    type: 'video',
                    element: node,
                    duration: duration || 8, // Default to 8 seconds if no duration found
                    startTime: startTime,
                    endTime: endTime
                });
            } else {
                // Process children
                for (const child of node.childNodes) {
                    processNode(child);
                }
            }
        }
    }
    
    // Process all nodes
    for (const child of tempDiv.childNodes) {
        processNode(child);
    }
    
    // Add final segment if exists
    if (currentSegment.trim()) {
        segments.push({
            type: 'tts',
            text: currentSegment.trim()
        });
    }
    
    return segments;
}

// Helper to get only TTS segments
function getTTSSegments(allSegments) {
    return allSegments.filter(s => s.type === 'tts');
}

// Show style input form
function showBrollStyleInput(segmentCount) {
    const panelContent = document.getElementById('brollPromptsContent');
    if (!panelContent) return;
    
    // Calculate total prompts needed - based on 8-second b-roll segments
    const segments = window._brollPromptsSegments || [];
    let totalPromptsNeeded = 0;
    segments.forEach(segment => {
        const wordCount = segment.text.trim().split(/\s+/).length;
        const duration = Math.ceil(wordCount / 2.5); // ~2.5 words per second
        const brollSegments = Math.ceil(duration / 8); // Each b-roll is 8 seconds
        totalPromptsNeeded += brollSegments;
    });
    
    panelContent.innerHTML = `
        <div class="mb-6">
            <h3 class="text-lg font-semibold text-white mb-3">Video Style Direction</h3>
            <p class="text-gray-400 text-sm mb-4">
                Describe the visual style you want for the b-roll clips (e.g., "minimalist geometric animations", 
                "nature-inspired flowing visuals", "futuristic tech aesthetics", etc.)
            </p>
            <textarea 
                id="brollStyleInput"
                class="w-full p-3 bg-gray-600 text-white rounded border border-gray-500 focus:border-blue-500 focus:outline-none"
                rows="3"
                placeholder="Enter your preferred visual style..."
            >Abstract, modern visualization with flowing shapes and subtle color gradients</textarea>
        </div>
        <div class="text-center py-4">
            <button 
                id="generateBrollPromptsBtn"
                onclick="window.handleGenerateBrollPrompts()"
                class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
                Generate B-Roll Prompts
            </button>
        </div>
        <div class="text-gray-400 text-sm mt-4">
            Will generate ${totalPromptsNeeded} b-roll prompt${totalPromptsNeeded > 1 ? 's' : ''} for ${segmentCount} narration segment${segmentCount > 1 ? 's' : ''} (8-second visuals).
        </div>
    `;
}

// Calculate number of 8-second segments needed for text
function calculateSegmentsNeeded(text) {
    // Estimate: average speaking rate is ~150 words per minute = 2.5 words per second
    // So 8 seconds = ~20 words
    const wordsPerEightSeconds = 20;
    const wordCount = text.trim().split(/\s+/).length;
    const segmentsNeeded = Math.ceil(wordCount / wordsPerEightSeconds);
    
    console.log(`[calculateSegmentsNeeded] Text has ${wordCount} words, needs ${segmentsNeeded} 8-second segments`);
    return segmentsNeeded;
}

// Generate b-roll prompts for TTS segments using AI with style
async function generateBrollPrompts(ttsSegments, style) {
    try {
        // Calculate prompts needed based on 8-second b-roll segments
        const segmentInfo = ttsSegments.map((segment, index) => {
            const wordCount = segment.text.trim().split(/\s+/).length;
            const duration = Math.ceil(wordCount / 2.5); // ~2.5 words per second
            const brollCount = Math.ceil(duration / 8); // Each b-roll is 8 seconds
            
            return {
                text: segment.text,
                promptsNeeded: brollCount,
                segmentIndex: index,
                duration: duration
            };
        });
        
        console.log('[generateBrollPrompts] Segment info:', segmentInfo);
        
        const response = await fetch('/api/generate-broll-prompts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                segments: segmentInfo,
                style: style
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate prompts');
        }
        
        const result = await response.json();
        return result.prompts || segmentInfo.map(info => 
            Array(info.promptsNeeded).fill('Abstract flowing shapes representing ideas')
        );
    } catch (error) {
        console.error('[generateBrollPrompts] Error:', error);
        // Return default prompts based on 8-second segments
        return ttsSegments.map(segment => {
            const wordCount = segment.text.trim().split(/\s+/).length;
            const duration = Math.ceil(wordCount / 2.5);
            const brollCount = Math.ceil(duration / 8);
            return Array(brollCount).fill('Abstract flowing shapes representing ideas');
        });
    }
}

// Show loading state in the b-roll prompts panel
function showBrollPromptsLoading(segmentCount) {
    const panelContent = document.getElementById('brollPromptsContent');
    if (!panelContent) return;
    
    panelContent.innerHTML = `
        <div class="text-center py-8">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p class="text-gray-400 mt-4">Generating AI prompts for ${segmentCount} narration segments...</p>
        </div>
    `;
}

// Show prompts in the panel
function showBrollPromptsInPanel(segments, prompts) {
    const panelContent = document.getElementById('brollPromptsContent');
    if (!panelContent) return;
    
    // Get all segments for absolute timestamp calculation
    const allSegments = window._brollPromptsAllSegments || [];
    
    // Calculate absolute timestamps for each segment
    let currentTime = 0;
    const segmentTimings = [];
    
    // Map TTS segments to their positions in the full timeline
    const ttsSegmentIndices = [];
    let ttsIndex = 0;
    
    allSegments.forEach((segment, index) => {
        if (segment.type === 'tts') {
            ttsSegmentIndices[ttsIndex] = {
                startTime: currentTime,
                segment: segment,
                index: ttsIndex
            };
            
            const wordCount = segment.text.trim().split(/\s+/).length;
            const duration = Math.ceil(wordCount / 2.5);
            currentTime += duration;
            
            ttsSegmentIndices[ttsIndex].endTime = currentTime;
            ttsSegmentIndices[ttsIndex].duration = duration;
            ttsIndex++;
        } else if (segment.type === 'video') {
            currentTime += segment.duration;
        }
    });
    
    // Calculate total prompts
    let totalPrompts = 0;
    prompts.forEach(segmentPrompts => {
        totalPrompts += segmentPrompts.length;
    });
    
    const totalDuration = currentTime;
    const totalMinutes = Math.floor(totalDuration / 60);
    const totalSeconds = totalDuration % 60;
    
    panelContent.innerHTML = `
        <div class="mb-4">
            <h3 class="text-lg font-semibold text-white mb-2">Generated B-Roll Prompts</h3>
            <p class="text-gray-400 text-sm">Review and edit the ${totalPrompts} prompts below. Each prompt is an 8-second visual.</p>
        </div>
        ${segments.map((segment, segmentIndex) => {
            const segmentPrompts = prompts[segmentIndex] || [];
            const wordCount = segment.text.trim().split(/\s+/).length;
            const duration = Math.ceil(wordCount / 2.5);
            const brollCount = Math.ceil(duration / 8);
            
            return `
            <div class="border border-gray-700 rounded p-4 mb-4">
                <div class="text-sm text-gray-400 mb-2">
                    Narration ${segmentIndex + 1} (${duration}s duration, needs ${brollCount} b-roll${brollCount > 1 ? 's' : ''})
                </div>
                <div class="text-gray-300 mb-3 text-sm italic">"${segment.text.substring(0, 100)}${segment.text.length > 100 ? '...' : ''}"</div>
                
                <div class="space-y-2">
                    ${segmentPrompts.map((prompt, promptIndex) => {
                        return `
                        <div>
                            <label class="text-sm text-gray-400">B-Roll ${promptIndex + 1} (8-second visual):</label>
                            <textarea 
                                class="w-full mt-1 p-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none broll-prompt-textarea"
                                rows="2"
                                data-segment="${segmentIndex}"
                                data-prompt="${promptIndex}"
                                placeholder="Describe the 8-second visual..."
                            >${prompt}</textarea>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
            `;
        }).join('')}
        <div class="mt-6 flex gap-3">
            <button 
                id="brollPromptsGenerateBtn"
                onclick="window.handleBrollPromptsGenerate()"
                class="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
                Confirm & Create Video
            </button>
            <button 
                onclick="window.handleBrollPromptsCancel()"
                class="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
                Cancel
            </button>
        </div>
    `;
}

// Handle generate prompts button click
window.handleGenerateBrollPrompts = function() {
    const styleInput = document.getElementById('brollStyleInput');
    const generateBtn = document.getElementById('generateBrollPromptsBtn');
    
    if (!styleInput || !generateBtn) return;
    
    const style = styleInput.value.trim() || 'Abstract, modern visualization with flowing shapes';
    const segments = window._brollPromptsSegments || [];
    
    // Show loading state
    generateBtn.innerHTML = '<span class="loading-spinner"></span> Generating...';
    generateBtn.disabled = true;
    
    showBrollPromptsLoading(segments.length);
    
    // Also update the main button
    if (window._brollPromptsButton) {
        window._brollPromptsButton.innerHTML = '<span class="loading-spinner"></span> Generating prompts...';
        window._brollPromptsButton.disabled = true;
    }
    
    generateBrollPrompts(segments, style).then(prompts => {
        // Update panel with generated prompts
        showBrollPromptsInPanel(segments, prompts);
        
        // Reset main button
        if (window._brollPromptsButton && window._brollPromptsOriginalText) {
            window._brollPromptsButton.innerHTML = window._brollPromptsOriginalText;
            window._brollPromptsButton.disabled = false;
        }
    }).catch(error => {
        console.error('[handleGenerateBrollPrompts] Error:', error);
        // Use default prompts on error
        const defaultPrompts = segments.map(() => [
            'Abstract flowing shapes representing ideas',
            'Geometric patterns morphing and evolving'
        ]);
        showBrollPromptsInPanel(segments, defaultPrompts);
        
        // Reset main button
        if (window._brollPromptsButton && window._brollPromptsOriginalText) {
            window._brollPromptsButton.innerHTML = window._brollPromptsOriginalText;
            window._brollPromptsButton.disabled = false;
        }
    });
}

// Handle final video generation
window.handleBrollPromptsGenerate = function() {
    if (!window._brollPromptsResolve) return;
    
    const segments = window._brollPromptsSegments || [];
    const allPrompts = [];
    
    // Collect all prompts for each segment
    for (let i = 0; i < segments.length; i++) {
        const segmentPrompts = [];
        const textareas = document.querySelectorAll(`textarea[data-segment="${i}"]`);
        
        textareas.forEach(textarea => {
            const promptText = textarea.value.trim();
            segmentPrompts.push(promptText || 'Abstract flowing shapes representing ideas');
        });
        
        // If no prompts for this segment, add a default
        if (segmentPrompts.length === 0) {
            segmentPrompts.push('Abstract flowing shapes representing ideas');
        }
        
        allPrompts.push(segmentPrompts);
    }
    
    // Calculate total prompts
    let totalPrompts = 0;
    allPrompts.forEach(segmentPrompts => {
        totalPrompts += segmentPrompts.length;
    });
    
    // Create downloadable text file with prompts
    const promptsText = segments.map((segment, index) => {
        const narrationPreview = segment ? segment.text.substring(0, 150) + (segment.text.length > 150 ? '...' : '') : '';
        const segmentPrompts = allPrompts[index] || [];
        const wordCount = segment.text.trim().split(/\s+/).length;
        const duration = Math.ceil(wordCount / 2.5);
        
        // Build prompt list
        const promptsList = segmentPrompts.map((prompt, promptIndex) => {
            return `  B-Roll ${promptIndex + 1}: ${prompt}`;
        }).join('\n');
        
        return `Narration Segment ${index + 1} (${duration} seconds, ${segmentPrompts.length} b-roll${segmentPrompts.length !== 1 ? 's' : ''}):\n"${narrationPreview}"\n\nB-Roll Visuals (8 seconds each):\n${promptsList}`;
    }).join('\n\n' + '='.repeat(50) + '\n\n');
    
    const fullText = `B-Roll Prompts for Video Generation
Total B-Roll Prompts: ${totalPrompts}
Generated: ${new Date().toLocaleString()}

Note: Each b-roll visual is exactly 8 seconds long.

${'='.repeat(70)}

${promptsText}`;
    
    // Create and trigger download
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `broll-prompts-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Close panel
    if (window.appState) {
        window.appState.setBrollPromptsPanelOpen(false);
        if (window.applyBrollPromptsPanelState) {
            window.applyBrollPromptsPanelState();
        }
    }
    
    // Return all prompts for video generation
    window._brollPromptsResolve(allPrompts);
    window._brollPromptsResolve = null;
    window._brollPromptsSegments = null;
    window._brollPromptsAllSegments = null;
    window._brollPromptsButton = null;
    window._brollPromptsOriginalText = null;
}

window.handleBrollPromptsCancel = function() {
    if (!window._brollPromptsResolve) return;
    
    // Close panel
    if (window.appState) {
        window.appState.setBrollPromptsPanelOpen(false);
        if (window.applyBrollPromptsPanelState) {
            window.applyBrollPromptsPanelState();
        }
    }
    
    // Resolve with null
    window._brollPromptsResolve(null);
    window._brollPromptsResolve = null;
    window._brollPromptsSegments = null;
    window._brollPromptsAllSegments = null;
    window._brollPromptsButton = null;
    window._brollPromptsOriginalText = null;
}

// Apply b-roll prompts panel state from appState
window.applyBrollPromptsPanelState = function() {
    const panel = document.getElementById('brollPromptsPanel'); 
    const overlay = document.getElementById('brollPromptsOverlay'); 
    if (!panel || !overlay) {
        console.warn("B-roll prompts panel or overlay element not found.");
        return;
    }

    const isOpen = window.appState?.uiState?.brollPromptsPanel?.isOpen || false;

    if (isOpen) {
        // Close other slide-out panels if they are open
        if (window.appState?.uiState?.reportDetailPanel?.isOpen) {
            window.appState.setReportDetailPanelOpen(false);
            if (window.applyReportDetailPanelState) window.applyReportDetailPanelState();
        }
        if (window.appState?.uiState?.pricingPanel?.isOpen) {
            window.appState.setPricingPanelOpen(false);
            if (window.applyPricingPanelState) window.applyPricingPanelState();
        }
        
        panel.style.display = 'flex';
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
        void panel.offsetWidth; // Trigger reflow
        panel.style.transform = 'translateX(0)';
    } else {
        panel.style.transform = 'translateX(100%)';
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        setTimeout(() => {
            if (!window.appState?.uiState?.brollPromptsPanel?.isOpen) { // Check state again before hiding
                panel.style.display = 'none';
            }
        }, 300); // Match CSS transition duration
    }
}

// Initialize b-roll prompts panel event listeners
window.initializeBrollPromptsPanel = function() {
    const closeBrollPromptsPanelBtn = document.getElementById('closeBrollPromptsPanelBtn');
    const brollPromptsOverlay = document.getElementById('brollPromptsOverlay');

    // Close b-roll prompts panel via close button
    closeBrollPromptsPanelBtn?.addEventListener('click', () => {
        if (window.appState) {
            window.appState.setBrollPromptsPanelOpen(false);
            window.applyBrollPromptsPanelState();
        }
        // Also cancel the prompt generation
        if (window.handleBrollPromptsCancel) {
            window.handleBrollPromptsCancel();
        }
    });

    // Close b-roll prompts panel via overlay click
    brollPromptsOverlay?.addEventListener('click', () => {
        if (window.appState) {
            window.appState.setBrollPromptsPanelOpen(false);
            window.applyBrollPromptsPanelState();
        }
        // Also cancel the prompt generation
        if (window.handleBrollPromptsCancel) {
            window.handleBrollPromptsCancel();
        }
    });

    // Handle escape key to close panel
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && window.appState?.uiState?.brollPromptsPanel?.isOpen) {
            if (window.appState) {
                window.appState.setBrollPromptsPanelOpen(false);
                window.applyBrollPromptsPanelState();
            }
            // Also cancel the prompt generation
            if (window.handleBrollPromptsCancel) {
                window.handleBrollPromptsCancel();
            }
        }
    });
}

// Export to window for use in admin.js
window.showBrollPromptReview = showBrollPromptReview;