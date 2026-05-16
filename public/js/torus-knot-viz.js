// Torus Knot Text Visualization for thinking tokens
class TorusKnotViz {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.knotMesh = null;
        this.textGroup = null;
        this.curve = null;
        this.activeMeshes = [];
        this.animationId = null;
        
        // Get config from window (since this isn't a module)
        const vizConfig = window.config?.torusKnotViz || {};
        
        // Configuration from config.js or defaults
        this.knotP = vizConfig.knotP || 3;
        this.knotQ = vizConfig.knotQ || 2;
        this.knotRadius = vizConfig.knotRadius || 2;
        this.baseKnotRadius = this.knotRadius;
        this.responsiveScale = 1;
        this.letterSpacing = vizConfig.letterSpacing || 0.4;
        this.maxVisibleChars = vizConfig.maxVisibleChars || 150;
        this.globalOffset = 0;
        
        // Streaming configuration
        this.sourceText = "";
        this.streamPosition = 0;
        this.isStreaming = false;
        this.lastCharTime = Date.now();
        this.charsPerSecond = vizConfig.charsPerSecond || 20;
        
        // Visual configuration
        this.knotOpacity = vizConfig.knotOpacity || 0.15;
        this.textColorRange = vizConfig.textColorRange || { min: 20, max: 160 };
        this.maxTextOpacity = vizConfig.maxTextOpacity || 0.9;
        this.rotationSpeedY = vizConfig.rotationSpeedY || 0.001;
        this.rotationAmplitudeX = vizConfig.rotationAmplitudeX || 0.05;
        this.textFlowSpeed = vizConfig.textFlowSpeed || 0.02;
        this.ambientLightIntensity = vizConfig.ambientLightIntensity || 0.8;
        this.directionalLightIntensity = vizConfig.directionalLightIntensity || 0.6;
        
        // Character texture cache
        this.charCanvases = new Map();
        
        this.init();
    }
    
    init() {
        console.log('[TorusKnotViz] Initializing...');
        
        // Scene setup
        this.scene = new THREE.Scene();
        // No background color - transparent
        
        // Calculate responsive scale
        this.responsiveScale = this.getResponsiveScale();
        
        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        const targetZ = 6 * this.knotRadius * this.responsiveScale;
        this.camera.position.set(0, 0, targetZ);
        
        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true // Enable transparency
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setClearColor(0x000000, 0); // Fully transparent background
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        // Lighting - adjusted for background visibility
        const ambientLight = new THREE.AmbientLight(0xffffff, this.ambientLightIntensity);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, this.directionalLightIntensity);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = false; // Disable shadows for performance
        this.scene.add(directionalLight);
        
        // Create the torus knot
        this.createTorusKnot();
        
        // Create text group
        this.textGroup = new THREE.Group();
        this.scene.add(this.textGroup);
        
        // Handle window resize
        this.handleResize = () => {
            this.responsiveScale = this.getResponsiveScale();
            
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            const targetZ = 6 * this.knotRadius * this.responsiveScale;
            this.camera.position.z = targetZ;
            
            this.renderer.setSize(width, height);
            
            // Recreate torus knot with new scale
            this.createTorusKnot();
            
            // Update all text meshes
            this.activeMeshes.forEach(mesh => {
                mesh.geometry.dispose();
                mesh.geometry = new THREE.PlaneGeometry(0.5 * this.responsiveScale, 0.5 * this.responsiveScale);
            });
            
            this.updateTextPositions();
        };
        window.addEventListener('resize', this.handleResize);
        
        // Start animation
        this.animate();
        
        console.log('[TorusKnotViz] Initialization complete');
    }
    
    getResponsiveScale() {
        const baseWidth = 1920;
        const baseHeight = 1080;
        const currentWidth = window.innerWidth;
        const currentHeight = window.innerHeight;
        
        const widthScale = currentWidth / baseWidth;
        const heightScale = currentHeight / baseHeight;
        const scale = Math.min(widthScale, heightScale);
        
        return Math.max(0.5, Math.min(2, scale));
    }
    
    createTorusKnot() {
        // Remove old knot if exists
        if (this.knotMesh) {
            this.scene.remove(this.knotMesh);
            this.knotMesh.geometry.dispose();
        }
        
        // Create custom torus knot curve
        this.curve = new TorusKnotCurve(this.knotRadius * this.responsiveScale, this.knotP, this.knotQ);
        this.curveLength = this.curve.getLength();
        
        // Create visual torus knot mesh
        const knotGeometry = new THREE.TorusKnotGeometry(
            this.knotRadius * this.responsiveScale * 2, 
            0.05 * this.responsiveScale, 
            200, 
            32, 
            this.knotP, 
            this.knotQ
        );
        
        const knotMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xaaaaaa,
            emissive: 0x888888,
            shininess: 100,
            opacity: this.knotOpacity,
            transparent: true
        });
        
        this.knotMesh = new THREE.Mesh(knotGeometry, knotMaterial);
        this.scene.add(this.knotMesh);
    }
    
    createCharTexture(char, color) {
        const key = char === ' ' ? 'space' : char;
        const colorKey = `${key}_${color}`;
        if (this.charCanvases.has(colorKey)) {
            return this.charCanvases.get(colorKey);
        }
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 128;
        
        ctx.fillStyle = 'transparent';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.font = 'bold 80px Arial';
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        this.charCanvases.set(colorKey, texture);
        
        return texture;
    }
    
    createCharMesh(char) {
        const geometry = new THREE.PlaneGeometry(0.5 * this.responsiveScale, 0.5 * this.responsiveScale);
        const material = new THREE.MeshPhongMaterial({
            map: this.createCharTexture(char, '#444444'), // Darker for better visibility
            transparent: true,
            emissive: 0x444444,
            emissiveIntensity: 0.5, // Brighter
            side: THREE.DoubleSide,
            opacity: 0
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.char = char;
        mesh.userData.birthTime = Date.now();
        
        return mesh;
    }
    
    streamText(text) {
        console.log('[TorusKnotViz] Streaming text:', text.substring(0, 30) + '...');
        
        this.sourceText = text;
        this.streamPosition = 0;
        this.isStreaming = true;
        this.lastCharTime = Date.now();
    }
    
    addCharacterToStream(char) {
        const mesh = this.createCharMesh(char);
        this.activeMeshes.push(mesh);
        this.textGroup.add(mesh);
        
        // Fade in animation
        const fadeInDuration = 200;
        const startTime = Date.now();
        
        const fadeIn = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / fadeInDuration, 1);
            mesh.material.opacity = progress * this.maxTextOpacity;
            
            if (progress < 1) {
                requestAnimationFrame(fadeIn);
            }
        };
        fadeIn();
        
        // Remove old characters if we exceed the limit
        while (this.activeMeshes.length > this.maxVisibleChars) {
            const oldMesh = this.activeMeshes.shift();
            this.textGroup.remove(oldMesh);
            oldMesh.geometry.dispose();
            oldMesh.material.dispose();
        }
    }
    
    updateTextPositions() {
        this.activeMeshes.forEach((mesh, index) => {
            // Position from newest (right) to oldest (left)
            const positionIndex = this.activeMeshes.length - 1 - index;
            const charOffset = positionIndex * this.letterSpacing + this.globalOffset;
            const t = (charOffset / this.curveLength) % 1;
            
            if (t >= 0 && t <= 1) {
                mesh.visible = true;
                
                // Get position on curve
                const point = this.curve.getPoint(t);
                mesh.position.copy(point);
                
                // Keep text facing camera
                mesh.lookAt(this.camera.position);
                mesh.rotation.z = 0;
                
                // Update color based on position using config range
                const range = this.textColorRange.max - this.textColorRange.min;
                let greyValue;
                if (t < 0.5) {
                    greyValue = Math.floor(range * (1 - t * 2)) + this.textColorRange.min;
                } else {
                    greyValue = Math.floor(range * (t - 0.5) * 2) + this.textColorRange.min;
                }
                
                const color = `rgb(${greyValue}, ${greyValue}, ${greyValue})`;
                mesh.material.map = this.createCharTexture(mesh.userData.char, color);
                mesh.material.emissive = new THREE.Color(color);
                mesh.material.emissiveIntensity = 0.05 * (1 - Math.abs(t - 0.5) * 2) + 0.01;
                mesh.material.needsUpdate = true;
                
                // Scale
                mesh.scale.set(1, 1, 1);
            } else {
                mesh.visible = false;
            }
        });
    }
    
    clear() {
        console.log('[TorusKnotViz] Clearing visualization');
        
        this.activeMeshes.forEach(mesh => {
            this.textGroup.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        this.activeMeshes = [];
        this.streamPosition = 0;
        this.globalOffset = 0;
        this.sourceText = "";
        this.isStreaming = false;
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        // Rotate scene based on time for subtle movement
        this.scene.rotation.y += this.rotationSpeedY;
        this.scene.rotation.x = Math.sin(Date.now() * 0.0001) * this.rotationAmplitudeX;
        
        // Stream characters
        if (this.isStreaming && this.streamPosition < this.sourceText.length) {
            const now = Date.now();
            const timeSinceLastChar = now - this.lastCharTime;
            const msPerChar = 1000 / this.charsPerSecond;
            
            if (timeSinceLastChar >= msPerChar) {
                const char = this.sourceText[this.streamPosition];
                if (char && char.trim()) { // Skip empty characters
                    this.addCharacterToStream(char);
                }
                this.streamPosition++;
                this.lastCharTime = now;
                
                if (this.streamPosition >= this.sourceText.length) {
                    this.isStreaming = false;
                }
            }
        }
        
        // Continuously move text along the curve
        this.globalOffset += this.textFlowSpeed;
        this.updateTextPositions();
        
        // Subtle rotation of the guide knot
        if (this.knotMesh) {
            this.knotMesh.rotation.x += 0.001;
            this.knotMesh.rotation.y += 0.002;
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    destroy() {
        console.log('[TorusKnotViz] Destroying visualization');
        
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
        this.knotMesh = null;
        this.textGroup = null;
    }
}

// Custom torus knot curve class
class TorusKnotCurve extends THREE.Curve {
    constructor(scale = 1, p = 3, q = 2) {
        super();
        this.scale = scale;
        this.p = p;
        this.q = q;
    }

    getPoint(t, optionalTarget = new THREE.Vector3()) {
        const angle = t * Math.PI * 2;
        
        const r = Math.cos(this.q * angle) + 2;
        const x = r * Math.cos(this.p * angle);
        const y = r * Math.sin(this.p * angle);
        const z = -Math.sin(this.q * angle);
        
        return optionalTarget.set(x, y, z).multiplyScalar(this.scale);
    }
}

// Export for use
window.TorusKnotViz = TorusKnotViz;