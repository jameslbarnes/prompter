// Dynamic Visualization Module - Loads either TorusKnotViz or ShapesViz based on user config
class DynamicViz {
    constructor(container, userProfile = null) {
        this.container = container;
        this.userProfile = userProfile;
        this.viz = null;
        this.initializeVisualization();
    }
    
    async initializeVisualization() {
        // Check if user has a custom shape configuration
        if (this.userProfile && this.userProfile.activeShapeConfig) {
            // Load ShapesViz if available
            if (typeof ShapesViz !== 'undefined') {
                const config = this.userProfile.activeShapeConfig;
                
                // Create ShapesViz instance
                this.viz = new ShapesViz(this.container, {
                    shapeType: config.shapeType,
                    textSize: config.textSize || 0.5,
                    bgColor: config.bgColor
                });
                
                // Apply shape-specific parameters
                if (config.shapeParams) {
                    this.viz.setShape(config.shapeType, config.shapeParams);
                }
                
                console.log('Loaded custom shape:', config.shapeType);
            } else {
                // Fall back to TorusKnotViz if ShapesViz not available
                console.warn('ShapesViz not available, falling back to TorusKnotViz');
                this.loadTorusKnotViz();
            }
        } else {
            // No custom shape config, use TorusKnotViz with any saved torus config
            this.loadTorusKnotViz();
        }
    }
    
    loadTorusKnotViz() {
        const torusConfig = this.userProfile?.torusConfig || {};
        
        // Create TorusKnotViz instance
        this.viz = new TorusKnotViz(this.container, {
            radius: torusConfig.radius || 4,
            tubeRadius: torusConfig.tubeRadius || 1.2,
            p: torusConfig.p || 3,
            q: torusConfig.q || 5,
            textSize: torusConfig.textSize || 0.5,
            bgColor: torusConfig.bgColor
        });
        
        console.log('Loaded torus knot visualization');
    }
    
    // Proxy methods to the underlying visualization
    streamText(text) {
        if (this.viz && this.viz.streamText) {
            this.viz.streamText(text);
        }
    }
    
    clear() {
        if (this.viz && this.viz.clear) {
            this.viz.clear();
        }
    }
    
    destroy() {
        if (this.viz && this.viz.destroy) {
            this.viz.destroy();
        }
    }
    
    // Update configuration dynamically
    updateConfig(newProfile) {
        // If shape type changed, recreate visualization
        const oldShapeType = this.userProfile?.activeShapeConfig?.shapeType || 'torusKnot';
        const newShapeType = newProfile?.activeShapeConfig?.shapeType || 'torusKnot';
        
        if (oldShapeType !== newShapeType || !this.viz) {
            // Destroy old viz
            if (this.viz) {
                this.viz.destroy();
            }
            
            // Update profile and reinitialize
            this.userProfile = newProfile;
            this.initializeVisualization();
        } else {
            // Just update the profile
            this.userProfile = newProfile;
        }
    }
}

// Export for use in other scripts
window.DynamicViz = DynamicViz;