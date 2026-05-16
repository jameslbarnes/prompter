// Simple Shape Overlay - Canvas-only version for interview thinking visualization
// This is a lightweight alternative to DynamicShapeOverlay that doesn't cause socket issues

class SimpleShapeOverlay {
    constructor(config = {}) {
        this.config = {
            shapeType: 'torusKnot',
            shapeParams: { radius: 4, tubeRadius: 1.2, p: 3, q: 5 },
            textSize: 0.5,
            textSpeed: 50,
            bgColor: '#000000',
            textOrientation: 'vertical',
            ...config
        };
        
        this.canvas = null;
        this.viz = null;
        this.isVisible = false;
    }
    
    show(options = {}) {
        if (this.isVisible) return;
        
        console.log('[SimpleShapeOverlay] Showing overlay with options:', options);
        
        // Create or get canvas
        this.canvas = document.getElementById('thinkingCanvas');
        if (!this.canvas) {
            console.log('[SimpleShapeOverlay] Creating new canvas');
            this.canvas = document.createElement('div');
            this.canvas.id = 'thinkingCanvas';
            this.canvas.style.position = 'fixed';
            this.canvas.style.top = '0';
            this.canvas.style.left = '0';
            this.canvas.style.width = '100vw';
            this.canvas.style.height = '100vh';
            this.canvas.style.zIndex = '41';
            this.canvas.style.backgroundColor = this.config.bgColor;
            // Override any CSS that might make it transparent
            this.canvas.style.setProperty('background-color', this.config.bgColor, 'important');
            document.body.appendChild(this.canvas);
        } else {
            console.log('[SimpleShapeOverlay] Using existing canvas');
            // Ensure background color is set even for existing canvas
            this.canvas.style.setProperty('background-color', this.config.bgColor, 'important');
        }
        
        // Show canvas
        this.canvas.style.display = 'block';
        this.isVisible = true;
        
        // Initialize visualization - use FlowingTextViz
        if (!this.viz) {
            if (typeof FlowingTextViz !== 'undefined') {
                console.log('[SimpleShapeOverlay] Creating FlowingTextViz');
                this.viz = new FlowingTextViz(this.canvas);
            } else {
                console.error('[SimpleShapeOverlay] FlowingTextViz not available!');
                console.log('[SimpleShapeOverlay] Available globals:', Object.keys(window).filter(k => k.includes('Viz')));
            }
        } else {
            console.log('[SimpleShapeOverlay] Clearing existing viz');
            this.viz.clear();
        }
        
        // Add initial message if provided
        if (options.message && this.viz && this.viz.streamText) {
            console.log('[SimpleShapeOverlay] Adding initial message:', options.message);
            this.viz.streamText(options.message + '\n\n');
            if (options.subtitle) {
                this.viz.streamText(options.subtitle + '\n\n');
            }
            // Add a note about streaming limitation
            this.viz.streamText('(Processing your interview responses...)\n\n');
        }
        
        return this;
    }
    
    hide() {
        if (!this.isVisible) return;
        
        if (this.canvas) {
            this.canvas.style.display = 'none';
        }
        
        this.isVisible = false;
        return this;
    }
    
    updateStreamingText(text) {
        console.log('[SimpleShapeOverlay] updateStreamingText called with:', text.substring(0, 30) + '...');
        if (this.viz && this.viz.streamText) {
            console.log('[SimpleShapeOverlay] Calling viz.streamText');
            this.viz.streamText(text);
        } else {
            console.log('[SimpleShapeOverlay] No viz or streamText method available', {
                viz: !!this.viz,
                streamText: !!(this.viz && this.viz.streamText)
            });
        }
        return this;
    }
    
    startTextStreaming() {
        // For compatibility with original API
        return this;
    }
    
    // Static method to load user config (for compatibility)
    static async loadUserConfig(mode) {
        // This would load from Firebase in the full implementation
        // For now, return default config
        return {
            shapeType: 'torusKnot',
            shapeParams: { radius: 4, tubeRadius: 1.2, p: 3, q: 5 },
            textSize: 0.5,
            textSpeed: 50,
            bgColor: '#000000',
            textOrientation: 'vertical'
        };
    }
}

// Make it globally available
window.SimpleShapeOverlay = SimpleShapeOverlay;
// Also create alias for compatibility with report generation code
window.DynamicShapeOverlay = SimpleShapeOverlay;