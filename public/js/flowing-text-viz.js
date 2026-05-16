// Flowing Text Visualization - Simple 2D text flowing on a curved path
class FlowingTextViz {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.curve = null;
        this.characters = [];
        this.animationId = null;
        this.time = 1; // Start at 1 for reverse direction
        this.speed = 0.0003; // Slow, contemplative speed (was 0.001)
        
        // Text management
        this.fullText = "";
        this.textQueue = [];
        this.isProcessing = false;
        
        this.init();
    }
    
    init() {
        console.log('[FlowingTextViz] Initializing...');
        
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x3a3f4b);
        
        // Use full window dimensions
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Orthographic camera for 2D view
        this.camera = new THREE.OrthographicCamera(
            width / -2, width / 2,
            height / 2, height / -2,
            1, 1000
        );
        this.camera.position.z = 100;
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';
        this.container.appendChild(this.renderer.domElement);
        
        // Create the flowing curve
        this.createCurve(width, height);
        
        // Handle window resize
        this.handleResize = () => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            this.camera.left = width / -2;
            this.camera.right = width / 2;
            this.camera.top = height / 2;
            this.camera.bottom = height / -2;
            this.camera.updateProjectionMatrix();
            
            this.renderer.setSize(width, height);
            this.createCurve(width, height);
        };
        window.addEventListener('resize', this.handleResize);
        
        // Start animation
        this.animate();
        
        console.log('[FlowingTextViz] Initialization complete');
    }
    
    createCurve(width, height) {
        // Create a wavy path across the screen
        const points = [];
        const steps = 7;
        for (let i = 0; i <= steps; i++) {
            const x = (i / steps) * (width + 400) - width/2 - 200;
            const y = Math.sin(i * 0.8) * (height * 0.3);
            points.push(new THREE.Vector3(x, y, 0));
        }
        
        this.curve = new THREE.CatmullRomCurve3(points);
        
        // Calculate curve length for proper spacing
        this.curveLength = this.curve.getLength();
        this.pixelSpacing = 10; // Pixels between characters (matching homepage)
        this.charSpacing = this.pixelSpacing / this.curveLength; // Convert to curve parameter space
    }
    
    createCharacterSprite(char) {
        // Create canvas for character
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 64;
        canvas.height = 64;
        
        // Draw character
        context.fillStyle = 'white';
        context.font = '36px Georgia';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(char, 32, 32);
        
        // Create texture and sprite
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(25, 25, 1);
        
        return {
            mesh: sprite,
            char: char,
            baseOffset: 0 // Will be set when added
        };
    }
    
    streamText(text) {
        console.log('[FlowingTextViz] Streaming text:', text.substring(0, 30) + '...');
        
        // If this is the first text, reset time to ensure proper positioning
        if (this.characters.length === 0 && this.fullText.length === 0) {
            this.time = 1;
            console.log('[FlowingTextViz] Reset time for new stream');
        }
        
        // Add text to buffer
        this.fullText += text;
        
        // Split into characters and add to queue
        const chars = text.split('');
        this.textQueue.push(...chars);
        
        // Process queue
        if (!this.isProcessing) {
            this.processQueue();
        }
    }
    
    processQueue() {
        if (this.textQueue.length === 0) {
            this.isProcessing = false;
            return;
        }
        
        this.isProcessing = true;
        
        // Process all available characters immediately
        let processed = 0;
        while (this.textQueue.length > 0) {
            const char = this.textQueue.shift();
            if (char && char.trim()) { // Skip empty characters
                this.addCharacter(char);
                processed++;
            }
        }
        
        console.log(`[FlowingTextViz] Processed ${processed} characters, total in scene: ${this.characters.length}`);
        
        // Mark as done processing
        this.isProcessing = false;
    }
    
    addCharacter(char) {
        const charObj = this.createCharacterSprite(char);
        
        // Calculate base offset for this character
        if (this.characters.length > 0) {
            const lastChar = this.characters[this.characters.length - 1];
            // Add character spacing to maintain consistent gaps
            charObj.baseOffset = (lastChar.baseOffset + this.charSpacing) % 1;
        } else {
            // First character starts at position 0
            charObj.baseOffset = 0;
        }
        
        // Add character to array
        this.characters.push(charObj);
        this.scene.add(charObj.mesh);
        
        // Remove old characters to prevent memory issues
        if (this.characters.length > 200) {
            const oldChar = this.characters.shift();
            this.scene.remove(oldChar.mesh);
            oldChar.mesh.material.map.dispose();
            oldChar.mesh.material.dispose();
        }
        
        console.log(`[FlowingTextViz] Added character '${char}', total: ${this.characters.length}`);
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        this.time -= this.speed;
        if (this.time < 0) this.time = 1; // Loop back to 1 when reaching 0
        
        // Update character positions
        this.characters.forEach((charObj) => {
            // Calculate actual position with wrapping
            const t = (this.time + charObj.baseOffset) % 1;
            const position = this.curve.getPoint(t);
            charObj.mesh.position.copy(position);
            
            // Calculate rotation based on curve tangent
            const tangent = this.curve.getTangent(t);
            const angle = Math.atan2(tangent.y, tangent.x);
            charObj.mesh.material.rotation = angle;
            
            // Fade in/out at edges (matching index.html)
            const fadeDistance = 0.08;
            let opacity = 0.7; // Base opacity matching index.html
            if (t < fadeDistance) {
                opacity *= t / fadeDistance;
            } else if (t > 1 - fadeDistance) {
                opacity *= (1 - t) / fadeDistance;
            }
            charObj.mesh.material.opacity = opacity;
        });
        
        this.renderer.render(this.scene, this.camera);
    }
    
    clear() {
        console.log('[FlowingTextViz] Clearing visualization');
        
        // Remove all characters
        this.characters.forEach(charObj => {
            this.scene.remove(charObj.mesh);
            charObj.mesh.material.map.dispose();
            charObj.mesh.material.dispose();
        });
        this.characters = [];
        
        // Clear text data
        this.fullText = "";
        this.textQueue = [];
        this.isProcessing = false;
    }
    
    destroy() {
        console.log('[FlowingTextViz] Destroying visualization');
        
        // Stop animation
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Clear everything
        this.clear();
        
        // Remove event listener
        window.removeEventListener('resize', this.handleResize);
        
        // Remove renderer
        if (this.renderer && this.container) {
            this.container.removeChild(this.renderer.domElement);
            this.renderer.dispose();
        }
        
        // Clear references
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.curve = null;
    }
}

// Export for use
window.FlowingTextViz = FlowingTextViz;