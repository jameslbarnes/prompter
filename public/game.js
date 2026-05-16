// Replace import statements with direct THREE usage
// const THREE is already available from the loaded scripts

// Main Game Class
class AnimalCrossingGame {
    constructor() {
        // Game state
        this.gameTime = new Date();
        this.gameTime.setHours(12, 0, 0, 0); // Start at noon
        this.bells = 0; // Currency
        this.inventory = [];
        
        // Game speed (1 game minute = X real seconds)
        this.timeScale = 1/60; // 1 game hour = 1 real minute
        
        // Movement and camera settings
        this.moveSpeed = 0.1;
        this.playerDirection = new THREE.Vector3(0, 0, 0);
        this.cameraMode = 'thirdPerson'; // Possible values: 'thirdPerson', 'topDown', 'firstPerson'
        this.cameraOffset = new THREE.Vector3(0, 3, 5); // Default third person offset
        this.cameraDistance = 5; // Distance for orbital adjustment
        this.cameraRotation = 0; // Current camera rotation around player
        
        // Initialize movement state variables
        this.inDialogue = false;
        this.nearbyNPC = null;
        this.islandRadius = 25; // Set a default island radius
        
        // Setup scene
        this.setupScene();
        this.setupLights();
        this.setupPlayer();
        this.createWorld();
        this.setupNPCs();
        this.setupCollectibles();
        
        // Setup controls
        this.setupControls();
        
        // Start game loop
        this.lastTime = Date.now();
        this.animate();
        
        // Update UI
        this.updateUI();
        
        this.islands = []; // Track additional islands
        this.bridges = []; // Initialize bridges array
        this.mainIslandPosition = new THREE.Vector3(0, 0, 0);
        
        // Add debug controls
        this.createDebugControls();
    }
    
    setupScene() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 10);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.body.appendChild(this.renderer.domElement);
        
        // Responsive design
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        // We're using our own camera controls, so we don't need OrbitControls
        // this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    }
    
    setupLights() {
        // Create ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        // Create directional light (sun)
        this.sunLight = new THREE.DirectionalLight(0xffffff, 1);
        this.sunLight.position.set(10, 20, 10);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 50;
        this.sunLight.shadow.camera.left = -20;
        this.sunLight.shadow.camera.right = 20;
        this.sunLight.shadow.camera.top = 20;
        this.sunLight.shadow.camera.bottom = -20;
        this.scene.add(this.sunLight);
    }
    
    setupPlayer() {
        // Create a more realistic player character
        const playerGroup = new THREE.Group();
        
        // Body
        const bodyGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.7, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xFF5733 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.35;
        body.castShadow = true;
        playerGroup.add(body);
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0xFFA07A });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.85;
        head.castShadow = true;
        playerGroup.add(head);
        
        // Arms
        const armGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8);
        const armMaterial = new THREE.MeshLambertMaterial({ color: 0xFF5733 });
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.35, 0.35, 0);
        leftArm.rotation.z = Math.PI / 6;
        leftArm.castShadow = true;
        playerGroup.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.35, 0.35, 0);
        rightArm.rotation.z = -Math.PI / 6;
        rightArm.castShadow = true;
        playerGroup.add(rightArm);
        
        // Legs
        const legGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8);
        const legMaterial = new THREE.MeshLambertMaterial({ color: 0x0000FF });
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.15, -0.15, 0);
        leftLeg.castShadow = true;
        playerGroup.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(0.15, -0.15, 0);
        rightLeg.castShadow = true;
        playerGroup.add(rightLeg);
        
        // Add to scene
        playerGroup.position.y = 0.5;
        this.player = playerGroup;
        this.scene.add(this.player);
        
        // Player movement properties
        this.playerVelocity = new THREE.Vector3();
        
        // Add key for camera switching
        this.isCameraRotating = false;
        
        // Dialogue state
        this.currentNPC = null;
    }
    
    createWorld() {
        // Create ocean (water) first as the base
        const oceanGeometry = new THREE.PlaneGeometry(200, 200);
        const oceanMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x0099FF, // Ocean blue
            side: THREE.DoubleSide 
        });
        const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
        ocean.rotation.x = -Math.PI / 2;
        ocean.position.y = -0.1; // Slightly below ground level
        this.scene.add(ocean);
        
        // Create island (circular ground)
        const islandRadius = 25;
        this.islandRadius = islandRadius - 1; // Set boundary slightly inside visual edge
        const islandGeometry = new THREE.CircleGeometry(islandRadius, 64);
        const islandMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x7CFC00, // Grass green
            side: THREE.DoubleSide 
        });
        const island = new THREE.Mesh(islandGeometry, islandMaterial);
        island.rotation.x = -Math.PI / 2;
        island.receiveShadow = true;
        this.scene.add(island);
        
        // Create beach (sand ring around the island)
        const beachOuterRadius = islandRadius + 3;
        const beachInnerRadius = islandRadius;
        const beachGeometry = new THREE.RingGeometry(beachInnerRadius, beachOuterRadius, 64);
        const beachMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xF0E68C, // Khaki/sand color
            side: THREE.DoubleSide 
        });
        const beach = new THREE.Mesh(beachGeometry, beachMaterial);
        beach.rotation.x = -Math.PI / 2;
        beach.position.y = -0.05; // Slightly below grass level
        beach.receiveShadow = true;
        this.scene.add(beach);
        
        // Add rocks at the beach edge
        for (let i = 0; i < 30; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = beachOuterRadius - 0.5 - Math.random() * 0.5;
            
            const rockGeometry = new THREE.SphereGeometry(0.2 + Math.random() * 0.3, 5, 5);
            const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            
            rock.position.set(
                Math.cos(angle) * radius,
                0.1,
                Math.sin(angle) * radius
            );
            
            rock.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.scene.add(rock);
        }
        
        // Create arrays to store collidable objects
        this.trees = [];
        this.buildings = [];
        
        // Add trees in the middle of the island
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (islandRadius - 8);
            
            this.createTree(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            );
        }
        
        // Add palm trees around the beach
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = beachInnerRadius - 2 + Math.random() * 3;
            
            this.createPalmTree(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            );
        }
        
        // Add simple houses
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 5 + Math.random() * 10;
            
            this.createHouse(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            );
        }
    }
    
    createTree(x, y, z) {
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1, 8);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(x, y + 0.5, z);
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        
        const leavesGeometry = new THREE.SphereGeometry(1, 8, 8);
        const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.set(x, y + 1.5, z);
        leaves.castShadow = true;
        
        this.scene.add(trunk);
        this.scene.add(leaves);
        
        // Add collision data
        this.trees.push({
            position: new THREE.Vector3(x, y, z),
            radius: 0.7 // Collision radius slightly smaller than visual size
        });
    }
    
    createHouse(x, y, z) {
        // House body
        const houseGeometry = new THREE.BoxGeometry(3, 2, 2);
        const houseMaterial = new THREE.MeshLambertMaterial({ color: 0xFFC0CB }); // Pink
        const house = new THREE.Mesh(houseGeometry, houseMaterial);
        house.position.set(x, y + 1, z);
        house.castShadow = true;
        house.receiveShadow = true;
        
        // Roof
        const roofGeometry = new THREE.ConeGeometry(2.5, 1, 4);
        const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x8B0000 }); // Dark red
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.set(x, y + 2.5, z);
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        
        this.scene.add(house);
        this.scene.add(roof);
        
        // Add house collision data (use a box-like collision)
        this.buildings.push({
            position: new THREE.Vector3(x, y, z),
            width: 3.2, // Slightly larger than visual size
            depth: 2.2
        });
    }
    
    createPalmTree(x, y, z) {
        // Trunk - taller and slightly curved
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2.5, 8);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0xA0522D });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(x, y + 1.25, z);
        trunk.rotation.set(
            Math.random() * 0.2 - 0.1,
            0,
            Math.random() * 0.2 - 0.1
        );
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        this.scene.add(trunk);
        
        // Palm leaves - create a group of leaf-like shapes
        const leavesGroup = new THREE.Group();
        leavesGroup.position.set(x, y + 2.5, z);
        
        // Create 6-8 palm leaves
        const leafCount = 6 + Math.floor(Math.random() * 3);
        for (let i = 0; i < leafCount; i++) {
            const angle = (i / leafCount) * Math.PI * 2;
            
            const leafGeometry = new THREE.BoxGeometry(0.1, 0.05, 1.2);
            const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x2E8B57 });
            const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
            
            // Position and rotate each leaf to create a palm crown
            leaf.position.set(0, 0, 0);
            leaf.rotation.set(
                Math.PI / 4 + Math.random() * 0.2,
                angle,
                0
            );
            
            // Move leaf outward from center
            leaf.translateZ(0.6);
            
            leaf.castShadow = true;
            leavesGroup.add(leaf);
        }
        
        this.scene.add(leavesGroup);
        
        // Add to trees array for collision detection
        this.trees.push({
            position: new THREE.Vector3(x, y, z),
            radius: 0.7 // Collision radius
        });
    }
    
    setupNPCs() {
        // Create just one NPC with Claude-powered dialogue
        this.npcs = [];
        
        // Create the NPC
        const npcGroup = new THREE.Group();
        
        // Body
        const bodyGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.7, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x9370DB }); // Purple body
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.35;
        body.castShadow = true;
        npcGroup.add(body);
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0xFFDAB9 }); // Peach head
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.85;
        head.castShadow = true;
        npcGroup.add(head);
        
        // Arms
        const armGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8);
        const armMaterial = new THREE.MeshLambertMaterial({ color: 0x9370DB });
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.35, 0.35, 0);
        leftArm.rotation.z = Math.PI / 6;
        leftArm.castShadow = true;
        npcGroup.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.35, 0.35, 0);
        rightArm.rotation.z = -Math.PI / 6;
        rightArm.castShadow = true;
        npcGroup.add(rightArm);
        
        // Legs
        const legGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8);
        const legMaterial = new THREE.MeshLambertMaterial({ color: 0x6A5ACD });
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.15, -0.15, 0);
        leftLeg.castShadow = true;
        npcGroup.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(0.15, -0.15, 0);
        rightLeg.castShadow = true;
        npcGroup.add(rightLeg);
        
        // Position NPC somewhere interesting on the island
        npcGroup.position.set(5, 0.5, 7);
        
        // Store NPC data
        npcGroup.userData = {
            type: 'npc',
            name: 'Claudia',
            moveDirection: new THREE.Vector3(0, 0, 0),
            moveTimer: 0,
            moveInterval: 3,
            chatHistory: [],
            isGeneratingResponse: false
        };
        
        this.scene.add(npcGroup);
        this.npcs.push(npcGroup);
        
        // Create dialogue UI elements
        this.createDialogueUI();
    }
    
    createDialogueUI() {
        // Create dialogue container
        const dialogueContainer = document.createElement('div');
        dialogueContainer.id = 'dialogue-container';
        dialogueContainer.style.position = 'absolute';
        dialogueContainer.style.bottom = '20px';
        dialogueContainer.style.left = '50%';
        dialogueContainer.style.transform = 'translateX(-50%)';
        dialogueContainer.style.width = '80%';
        dialogueContainer.style.maxWidth = '600px';
        dialogueContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
        dialogueContainer.style.borderRadius = '10px';
        dialogueContainer.style.padding = '15px';
        dialogueContainer.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.3)';
        dialogueContainer.style.fontFamily = 'Arial, sans-serif';
        dialogueContainer.style.display = 'none';
        
        // NPC name
        const npcName = document.createElement('div');
        npcName.id = 'npc-name';
        npcName.style.fontWeight = 'bold';
        npcName.style.fontSize = '18px';
        npcName.style.marginBottom = '10px';
        npcName.style.color = '#9370DB';
        dialogueContainer.appendChild(npcName);
        
        // Conversation history container (new)
        const conversationContainer = document.createElement('div');
        conversationContainer.id = 'conversation-container';
        conversationContainer.style.height = '200px';
        conversationContainer.style.overflowY = 'auto';
        conversationContainer.style.marginBottom = '15px';
        conversationContainer.style.padding = '10px';
        conversationContainer.style.border = '1px solid #ddd';
        conversationContainer.style.borderRadius = '5px';
        conversationContainer.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        dialogueContainer.appendChild(conversationContainer);
        
        // Player input for Claude
        const playerInput = document.createElement('input');
        playerInput.type = 'text';
        playerInput.id = 'player-input';
        playerInput.placeholder = 'Type your response...';
        playerInput.style.width = '100%';
        playerInput.style.padding = '8px';
        playerInput.style.marginBottom = '10px';
        playerInput.style.borderRadius = '5px';
        playerInput.style.border = '1px solid #ccc';
        dialogueContainer.appendChild(playerInput);
        
        // Row for buttons
        const buttonRow = document.createElement('div');
        buttonRow.style.display = 'flex';
        buttonRow.style.justifyContent = 'space-between';
        
        // Send button
        const sendButton = document.createElement('button');
        sendButton.id = 'send-button';
        sendButton.textContent = 'Send';
        sendButton.style.padding = '8px 15px';
        sendButton.style.backgroundColor = '#9370DB';
        sendButton.style.color = 'white';
        sendButton.style.border = 'none';
        sendButton.style.borderRadius = '5px';
        sendButton.style.cursor = 'pointer';
        sendButton.onclick = () => this.sendPlayerMessage();
        buttonRow.appendChild(sendButton);
        
        // Close button
        const closeButton = document.createElement('button');
        closeButton.id = 'close-button';
        closeButton.textContent = 'End Conversation';
        closeButton.style.padding = '8px 15px';
        closeButton.style.backgroundColor = '#FF6347';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '5px';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => this.endDialogue();
        buttonRow.appendChild(closeButton);
        
        dialogueContainer.appendChild(buttonRow);
        
        // Loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'loading-indicator';
        loadingIndicator.textContent = 'Claudia is thinking...';
        loadingIndicator.style.textAlign = 'center';
        loadingIndicator.style.marginTop = '10px';
        loadingIndicator.style.color = '#666';
        loadingIndicator.style.fontStyle = 'italic';
        loadingIndicator.style.display = 'none';
        dialogueContainer.appendChild(loadingIndicator);
        
        document.body.appendChild(dialogueContainer);
        
        // Interaction prompt
        const interactPrompt = document.createElement('div');
        interactPrompt.id = 'interact-prompt';
        interactPrompt.textContent = 'Press E to talk';
        interactPrompt.style.position = 'absolute';
        interactPrompt.style.top = '50%';
        interactPrompt.style.left = '50%';
        interactPrompt.style.transform = 'translate(-50%, -50%)';
        interactPrompt.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        interactPrompt.style.color = 'white';
        interactPrompt.style.padding = '10px';
        interactPrompt.style.borderRadius = '5px';
        interactPrompt.style.fontFamily = 'Arial, sans-serif';
        interactPrompt.style.display = 'none';
        document.body.appendChild(interactPrompt);
        
        // Event listener for Enter key in input field
        playerInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                this.sendPlayerMessage();
            }
        });
    }
    
    startDialogue(npc) {
        this.inDialogue = true;
        this.currentNPC = npc;
        
        // Show dialogue UI
        const dialogueContainer = document.getElementById('dialogue-container');
        const npcName = document.getElementById('npc-name');
        const conversationContainer = document.getElementById('conversation-container');
        const playerInput = document.getElementById('player-input');
        
        // Set NPC name
        npcName.textContent = npc.userData.name;
        
        // Clear previous conversation display
        conversationContainer.innerHTML = '';
        
        // Display existing chat history if any
        if (npc.userData.chatHistory.length > 0) {
            npc.userData.chatHistory.forEach(message => {
                this.addMessageToDisplay(message.role, message.content);
            });
        }
        
        // Check if this is the first conversation
        if (npc.userData.chatHistory.length === 0) {
            // Show loading indicator
            document.getElementById('loading-indicator').style.display = 'block';
            
            // Generate initial greeting using Claude API
            this.generateClaudeResponse("initial_greeting", npc)
                .then(response => {
                    // Add to chat history
                    npc.userData.chatHistory.push({
                        role: "assistant",
                        content: response
                    });
                    
                    // Add to display
                    this.addMessageToDisplay("assistant", response);
                    document.getElementById('loading-indicator').style.display = 'none';
                })
                .catch(error => {
                    console.error("Error generating response:", error);
                    const fallbackMessage = "Hello there! How are you today?";
                    
                    // Add to chat history
                    npc.userData.chatHistory.push({
                        role: "assistant",
                        content: fallbackMessage
                    });
                    
                    // Add to display
                    this.addMessageToDisplay("assistant", fallbackMessage);
                    document.getElementById('loading-indicator').style.display = 'none';
                });
        }
        
        // Show the dialogue UI
        dialogueContainer.style.display = 'block';
        playerInput.value = '';
        playerInput.focus();
        
        // Hide interaction prompt
        document.getElementById('interact-prompt').style.display = 'none';
        
        // Scroll to the bottom of the conversation
        this.scrollConversationToBottom();
    }
    
    // New method to add a message to the conversation display
    addMessageToDisplay(role, content) {
        const conversationContainer = document.getElementById('conversation-container');
        
        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = `message ${role}`;
        messageElement.style.padding = '8px 12px';
        messageElement.style.marginBottom = '8px';
        messageElement.style.borderRadius = '10px';
        messageElement.style.maxWidth = '80%';
        messageElement.style.wordBreak = 'break-word';
        
        // Style based on who's speaking
        if (role === 'assistant') {
            messageElement.style.backgroundColor = '#9370DB';
            messageElement.style.color = 'white';
            messageElement.style.alignSelf = 'flex-start';
            messageElement.style.marginRight = 'auto';
            messageElement.innerHTML = `<strong>${this.currentNPC.userData.name}:</strong> ${content}`;
        } else {
            messageElement.style.backgroundColor = '#E0E0E0';
            messageElement.style.color = '#333';
            messageElement.style.alignSelf = 'flex-end';
            messageElement.style.marginLeft = 'auto';
            messageElement.innerHTML = `<strong>You:</strong> ${content}`;
        }
        
        conversationContainer.appendChild(messageElement);
        
        // Scroll to the bottom
        this.scrollConversationToBottom();
    }
    
    // New method to scroll the conversation to the bottom
    scrollConversationToBottom() {
        const conversationContainer = document.getElementById('conversation-container');
        conversationContainer.scrollTop = conversationContainer.scrollHeight;
    }
    
    sendPlayerMessage() {
        if (!this.currentNPC || this.currentNPC.userData.isGeneratingResponse) return;
        
        const playerInput = document.getElementById('player-input');
        const message = playerInput.value.trim();
        
        if (message === '') return;
        
        // Add player message to chat history
        this.currentNPC.userData.chatHistory.push({
            role: "user",
            content: message
        });
        
        // Add to display
        this.addMessageToDisplay("user", message);
        
        // Clear input field
        playerInput.value = '';
        
        // Show loading indicator
        document.getElementById('loading-indicator').style.display = 'block';
        
        // Set flag to prevent multiple requests
        this.currentNPC.userData.isGeneratingResponse = true;
        
        // Generate response using Claude API
        this.generateClaudeResponse(message, this.currentNPC)
            .then(response => {
                // Add to chat history
                this.currentNPC.userData.chatHistory.push({
                    role: "assistant",
                    content: response
                });
                
                // Add to display
                this.addMessageToDisplay("assistant", response);
                
                // Hide loading indicator
                document.getElementById('loading-indicator').style.display = 'none';
                
                // Reset flag
                this.currentNPC.userData.isGeneratingResponse = false;
            })
            .catch(error => {
                console.error("Error generating response:", error);
                const fallbackMessage = "I'm not sure how to respond to that. Can you try something else?";
                
                // Add to chat history and display
                this.currentNPC.userData.chatHistory.push({
                    role: "assistant",
                    content: fallbackMessage
                });
                
                this.addMessageToDisplay("assistant", fallbackMessage);
                document.getElementById('loading-indicator').style.display = 'none';
                this.currentNPC.userData.isGeneratingResponse = false;
            });
    }
    
    async generateClaudeResponse(message, npc) {
        console.log("========== GENERATING CLAUDE RESPONSE ==========");
        console.log("Message:", message);
        console.log("NPC:", npc.userData.name);
        console.log("NPC data:", JSON.stringify(npc.userData, null, 2));
        
        // Get existing chat history
        let recentHistory = npc.userData.chatHistory.slice(-5); // Last 5 messages for context
        console.log("Recent chat history:", JSON.stringify(recentHistory, null, 2));
        
        // Load player memories
        let playerMemories = this.loadPlayerFacts();
        console.log("Loaded player memories:", JSON.stringify(playerMemories, null, 2));
        
        // Create a system prompt that explicitly lists places including Montana
        let systemPrompt;
        
        // Base character information for all NPCs
        const basePrompt = `You are ${npc.userData.name}, a character in an Animal Crossing-style game.
        
        Your personality is friendly and helpful.
        
        IMPORTANT FACTS ABOUT YOURSELF:
        - Your name is ${npc.userData.name}
        `;
        
        // Add player memories section to ALL NPCs (both island and non-island)
        let playerMemoriesPrompt = "";
        if (playerMemories && playerMemories.length > 0) {
            playerMemoriesPrompt = `\n\nIMPORTANT FACTS ABOUT THE PLAYER:`;
            
            // Sort memories by importance (if available)
            playerMemories.sort((a, b) => {
                const importanceA = a.importance || 3;
                const importanceB = b.importance || 3;
                return importanceB - importanceA; // Higher importance first
            });
            
            // Add each memory as a bullet point
            for (const memory of playerMemories) {
                if (typeof memory === 'string') {
                    playerMemoriesPrompt += `\n- ${memory}`;
                } else if (memory && typeof memory === 'object' && memory.text) {
                    playerMemoriesPrompt += `\n- ${memory.text}`;
                }
            }
            
            playerMemoriesPrompt += `\n\nREFER TO THESE FACTS NATURALLY in conversation when relevant. Acknowledge what you know about the player when appropriate. Use the remember_this function to remember new important details about the player.`;
        }
        
        if (npc.userData.islandNPC) {
            // Special prompt for island-specific NPCs - FOCUSED ON PERSONAL MEMORIES
            systemPrompt = `${basePrompt}
            
            You live on ${npc.userData.islandName}, which has a ${npc.userData.theme} theme.
            
            CONVERSATION GOAL: Gently encourage the player to share personal memories and stories through warm, thoughtful questions.
            
            GUIDELINES:
            - Your primary purpose is to ask questions that inspire the player to reflect on meaningful personal memories
            - Keep responses concise (3 sentences maximum)
            - Always include at least one question that connects your theme to potential memories
            - Show genuine interest in what the player shares
            - Refer to previously shared memories when relevant
            
            GREAT MEMORY-EVOKING QUESTIONS:
            - "What's a childhood memory that ${npc.userData.theme} places like this remind you of?"
            - "Do you have a favorite memory connected to ${npc.userData.theme} environments?"
            - "What emotions does this ${npc.userData.theme} setting bring up for you?"
            - "Is there someone special you'd want to bring to a place like this?"
            
            If this is your first message, warmly welcome them to ${npc.userData.islandName}, then ask about memories related to your theme.
            
            Core facts to remember:
            - You live on ${npc.userData.islandName} 
            - Your island has a ${npc.userData.theme} theme
            ${playerMemoriesPrompt}`;
        } else {
            // Modified system prompt for regular NPCs - FOCUSED ON DRAWING OUT STORIES
            systemPrompt = `${basePrompt}
            
            You live on a small island and love hearing people's stories and memories.
            
            CONVERSATION GOAL: Create a warm, safe space for the player to share personal stories and memories through thoughtful questions.
            
            GUIDELINES:
            - Ask questions that invite the player to share meaningful personal memories
            - Keep responses relatively brief (3 sentences maximum)
            - Be genuinely curious about the player's life experiences
            - Follow up thoughtfully on what they share
            - If they mention a place, ask about memories or people connected to that place
            
            GREAT MEMORY-ELICITING QUESTIONS:
            - "What's a place from your childhood that you remember fondly?"
            - "Who is someone who made a big impact on your life?"
            - "What's a moment in your life that you wish you could revisit?"
            - "Is there a tradition or activity that brings back special memories for you?"
            - "What's something you did recently that brought you joy?"
            
            When a player mentions a location or experience:
            1. Acknowledge it with warmth
            2. Ask a follow-up question about feelings, people, or memories
            3. Consider creating a themed island based on meaningful places they mention
            
            THEMES to choose for islands:
            - For beaches, islands: "tropical" theme
            - For forests, countryside: "autumn" theme
            - For mountains, cold regions (Montana): "winter" theme
            - For deserts, canyons: "desert" theme
            
            EXISTING ISLANDS:
            ${this.islands && this.islands.length > 0 ? 
            this.islands.map((island, index) => `- Island #${index}: ${island.name} (${island.theme})`).join('\n') : 
            "No additional islands yet"}
            
            ${playerMemoriesPrompt}`;
        }
        console.log("System prompt set:", systemPrompt.substring(0, 100) + "...");
        console.log("Player memories in prompt:", playerMemoriesPrompt);

        // Define the toolkit with the updated remember_this function
        const toolDefinitions = [{
            name: "create_island",
            description: "When the player mentions a place, create an island for them based on the place they mentioned",
            input_schema: {
                type: "object",
                properties: {
                    island_name: {
                        type: "string",
                        description: "Name of the island based on the place the player mentioned (e.g., 'Montana Island', 'Mountain Retreat', 'Beach Paradise')"
                    },
                    island_theme: {
                        type: "string",
                        enum: ["tropical", "autumn", "winter", "desert"],
                        description: "Theme that best represents the mentioned place: tropical (beaches, islands), autumn (forests, countryside), winter (snowy areas, mountains, Montana), desert (dry areas, canyons)"
                    },
                    reason: {
                        type: "string",
                        description: "Brief explanation of why this place is being created based on the conversation"
                    },
                    source_island_index: {
                        type: "integer",
                        description: "Index of the island to build from (-1 for main island, 0+ for other islands). Choose based on thematic connections."
                    }
                },
                required: ["island_name", "island_theme", "reason"]
            }
        }, {
            name: "remember_this",
            description: "Remember an important fact about the player for future conversations with any NPC",
            input_schema: {
                type: "object",
                properties: {
                    memory: {
                        type: "string",
                        description: "A complete sentence describing something to remember about the player (e.g., 'The player is from Montana.', 'The player has a dog named Max.', 'The player enjoys hiking.')"
                    },
                    importance: {
                        type: "integer",
                        minimum: 1,
                        maximum: 5,
                        description: "How important this memory is (1-5, with 5 being most important)"
                    }
                },
                required: ["memory"]
            }
        }];
        console.log("Tool definitions created:", JSON.stringify(toolDefinitions, null, 2));
        
        // Prepare the request payload
        let messages = [...recentHistory];
        
        // If this is the initial greeting
        if (message === "initial_greeting") {
            console.log("Generating initial greeting");
            messages = [{
                role: "user",
                content: "Hello! I'm new to this island. Could you greet me and introduce yourself?"
            }];
        } else {
            // Add the new message if it's not already in the history
            if (recentHistory.length === 0 || recentHistory[recentHistory.length - 1].content !== message) {
                messages.push({
                    role: "user",
                    content: message
                });
                console.log("Added new message to history");
            }
        }
        
        // Make the API request to our server
        try {
            console.log("Sending request to Claude API via server...");
            console.log("Request payload:", {
                system: systemPrompt.substring(0, 100) + "...", // Truncated for log
                messages: messages,
                model: "claude-opus-4-5",
                tools: "toolDefinitions included"
            });
            
            // Send request to our server endpoint with tool definitions
            const response = await fetch("/api/claude", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    system: systemPrompt,
                    messages: messages,
                    model: "claude-opus-4-5", // Use the newest model for better tool use
                    tools: toolDefinitions
                })
            });
            
            console.log("Response status:", response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error("API error response:", errorText);
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("API response received:", {
                responseText: data.response ? data.response.substring(0, 100) + "..." : "No response text",
                toolCalls: data.tool_calls ? JSON.stringify(data.tool_calls, null, 2) : "No tool calls"
            });
            
            // Check if the response contains tool calls
            if (data.tool_calls && data.tool_calls.length > 0) {
                console.log("Tool calls detected!", data.tool_calls.length);
                console.log("Tool call details:", JSON.stringify(data.tool_calls, null, 2));
                
                // Process tool calls
                let resultMessages = [];
                
                for (const toolCall of data.tool_calls) {
                    console.log("Processing tool call:", toolCall.name);
                    
                    if (toolCall.name === "create_island") {
                        console.log("Found create_island tool call!");
                        
                        // Parse tool call arguments
                        let args;
                        try {
                            args = JSON.parse(toolCall.args);
                            console.log("Successfully parsed args:", args);
                        } catch (error) {
                            console.error("Error parsing tool call args:", error);
                            console.error("Raw args:", toolCall.args);
                            continue;
                        }
                        
                        const islandName = args.island_name || "Mystery Island";
                        const islandTheme = args.island_theme || "winter"; // Default to winter for Montana
                        const reason = args.reason || "It sounds like a beautiful place!";
                        const sourceIslandIndex = args.source_island_index !== undefined ? args.source_island_index : -1;
                        
                        console.log("Creating island with parameters:", {
                            islandName,
                            islandTheme,
                            reason,
                            sourceIslandIndex
                        });
                        
                        // Call our method to create the island
                        try {
                            const resultMessage = this.createNewIsland(islandName, islandTheme, sourceIslandIndex);
                            console.log("Island creation successful:", resultMessage);
                            resultMessages.push(resultMessage);
                        } catch (error) {
                            console.error("Error creating island:", error);
                            throw error;
                        }
                    } else if (toolCall.name === "remember_this") {
                        console.log("Found remember_this tool call!");
                        
                        // Parse tool call arguments
                        let args;
                        try {
                            args = JSON.parse(toolCall.args);
                            console.log("Successfully parsed remember_this args:", args);
                        } catch (error) {
                            console.error("Error parsing remember_this args:", error);
                            console.error("Raw args:", toolCall.args);
                            continue;
                        }
                        
                        const memory = args.memory;
                        const importance = args.importance || 3; // Default medium importance
                        
                        console.log("Remembering player memory:", {
                            memory,
                            importance
                        });
                        
                        // Call our method to remember the fact
                        try {
                            this.rememberPlayerFact(memory, importance);
                            console.log("Successfully remembered player memory");
                            // No notification needed in conversation flow - toast will show
                        } catch (error) {
                            console.error("Error remembering player memory:", error);
                        }
                    }
                }
                
                // Combine Claude's response with all tool result messages
                if (resultMessages.length > 0) {
                    return data.response + " " + resultMessages.join(" ");
                }
            } else {
                console.log("No tool calls detected in response");
            }
            
            return data.response;
            
        } catch (error) {
            console.error("Error in Claude API or island creation process:", error);
            console.error("Error stack:", error.stack);
            throw error;
        } finally {
            console.log("========== END CLAUDE RESPONSE GENERATION ==========");
        }
    }
    
    endDialogue() {
        this.inDialogue = false;
        document.getElementById('dialogue-container').style.display = 'none';
        this.currentNPC = null;
    }
    
    updateTimeOfDay(deltaTime) {
        // Update in-game time
        const gameMinutesElapsed = deltaTime * this.timeScale;
        const gameMillisecondsElapsed = gameMinutesElapsed * 60 * 1000;
        this.gameTime.setTime(this.gameTime.getTime() + gameMillisecondsElapsed);
        
        // Update lighting based on time of day
        const hour = this.gameTime.getHours();
        const isNight = hour < 6 || hour >= 18;
        
        // Update sun position
        const dayCycle = (hour + this.gameTime.getMinutes() / 60) / 24;
        const sunAngle = Math.PI * 2 * (dayCycle - 0.25);
        this.sunLight.position.x = Math.cos(sunAngle) * 20;
        this.sunLight.position.y = Math.sin(sunAngle) * 20;
        
        // Update sky color
        if (isNight) {
            const nightBlue = 0x001133;
            this.scene.background.setHex(nightBlue);
            this.sunLight.intensity = 0.2;
        } else {
            const dayBlue = 0x87CEEB;
            this.scene.background.setHex(dayBlue);
            this.sunLight.intensity = 1;
        }
        
        this.updateUI();
    }
    
    updateUI() {
        // Update time display
        const timeElem = document.getElementById('time');
        const hours = this.gameTime.getHours().toString().padStart(2, '0');
        const minutes = this.gameTime.getMinutes().toString().padStart(2, '0');
        timeElem.textContent = `Time: ${hours}:${minutes}`;
        
        // Update bells display
        const bellsElem = document.getElementById('bells');
        bellsElem.textContent = `Bells: ${this.bells}`;
    }
    
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        const now = Date.now();
        const deltaTime = (now - this.lastTime) / 16.67; // Normalize to roughly 60fps
        this.lastTime = now;
        
        // Update game components
        this.updatePlayer(deltaTime);
        this.updateNPCs(deltaTime);
        this.updateTimeOfDay(deltaTime);
        
        // Render
        this.renderer.render(this.scene, this.camera);
    }

    setupCollectibles() {
        // Create collectibles that can be picked up
        this.collectibles = [];
        
        // Create apple-like collectibles that give bells when collected
        for (let i = 0; i < 10; i++) {
            const collectibleGeometry = new THREE.SphereGeometry(0.2, 8, 8);
            const collectibleMaterial = new THREE.MeshLambertMaterial({ color: 0xFF0000 }); // Red apples
            const collectible = new THREE.Mesh(collectibleGeometry, collectibleMaterial);
            
            // Position collectibles randomly on the island
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (this.islandRadius - 3);
            
            collectible.position.set(
                Math.cos(angle) * radius,
                0.2,
                Math.sin(angle) * radius
            );
            
            collectible.castShadow = true;
            collectible.receiveShadow = true;
            collectible.userData = {
                type: 'collectible',
                name: 'Apple',
                value: 100
            };
            
            this.scene.add(collectible);
            this.collectibles.push(collectible);
        }
    }

    checkCollectibleCollisions() {
        if (!this.collectibles || this.collectibles.length === 0) return;
        
        const playerPosition = this.player.position.clone();
        const collectionDistance = 0.7;
        
        // Check for collectibles
        for (let i = this.collectibles.length - 1; i >= 0; i--) {
            const collectible = this.collectibles[i];
            const distance = playerPosition.distanceTo(collectible.position);
            
            if (distance < collectionDistance) {
                // Collect item
                this.scene.remove(collectible);
                this.collectibles.splice(i, 1);
                
                // Add to inventory/bells
                const value = collectible.userData.value || 10;
                this.bells += value;
                
                // Show collection message
                const interactPrompt = document.getElementById('interact-prompt') || this.createInteractPrompt();
                interactPrompt.textContent = `Collected ${collectible.userData.name || 'Item'} (+${value} bells)`;
                interactPrompt.style.display = 'block';
                
                // Hide after a delay
                setTimeout(() => {
                    interactPrompt.style.display = 'none';
                }, 2000);
                
                // Update UI
                this.updateUI();
            }
        }
    }

    createInteractPrompt() {
        // Create prompt element if it doesn't exist
        const prompt = document.createElement('div');
        prompt.id = 'interact-prompt';
        prompt.style.position = 'absolute';
        prompt.style.top = '50%';
        prompt.style.left = '50%';
        prompt.style.transform = 'translate(-50%, -50%)';
        prompt.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        prompt.style.color = 'white';
        prompt.style.padding = '10px';
        prompt.style.borderRadius = '5px';
        prompt.style.fontFamily = 'Arial, sans-serif';
        prompt.style.display = 'none';
        prompt.style.zIndex = '1000';
        document.body.appendChild(prompt);
        return prompt;
    }

    setupControls() {
        // Keyboard controls
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            e: false,
            space: false,
            q: false,     // Camera mode toggle
            b: false,     // Debug key
            arrowleft: false,  // Rotate camera left
            arrowright: false  // Rotate camera right
        };
        
        document.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = true;
                
                // Handle E key press for NPC interaction
                if (key === 'e' && this.nearbyNPC && !this.inDialogue) {
                    this.startDialogue(this.nearbyNPC);
                }
                
                // Camera mode switching with Q key
                if (key === 'q' && !this.inDialogue) {
                    this.switchCameraMode();
                }
            }
        });
        
        document.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();
            if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = false;
            }
        });
    }

    switchCameraMode() {
        // Cycle through camera modes
        if (this.cameraMode === 'thirdPerson') {
            this.cameraMode = 'topDown';
            this.cameraOffset.set(0, 10, 0);
        } else if (this.cameraMode === 'topDown') {
            this.cameraMode = 'firstPerson';
            this.cameraOffset.set(0, 0.8, 0);
        } else {
            this.cameraMode = 'thirdPerson';
            this.cameraOffset.set(0, 3, 5);
        }
        
        // Reset camera rotation when switching modes
        this.cameraRotation = 0;
        
        // Show camera mode notification
        const interactPrompt = document.getElementById('interact-prompt') || this.createInteractPrompt();
        interactPrompt.textContent = `Camera Mode: ${this.cameraMode}`;
        interactPrompt.style.display = 'block';
        
        // Hide after a delay
        setTimeout(() => {
            interactPrompt.style.display = 'none';
        }, 2000);
    }

    updateCameraPosition() {
        // Calculate camera position based on player position and current camera rotation
        if (this.cameraMode === 'thirdPerson') {
            this.cameraOffset.x = Math.sin(this.cameraRotation) * this.cameraDistance;
            this.cameraOffset.z = Math.cos(this.cameraRotation) * this.cameraDistance;
        }
    }

    updatePlayer(deltaTime) {
        // Skip player movement if in dialogue
        if (this.inDialogue) return;
        
        // DEBUG: Log position on keypress 'b' 
        if (this.keys.b) {
            this.keys.b = false; // Reset to prevent continuous firing
            this.logPlayerPosition();
        }
        
        // Calculate player movement based on keys
        const speed = this.moveSpeed * deltaTime;
        this.playerDirection.set(0, 0, 0);
        
        // Get camera direction (ignoring y component)
        let cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        cameraDirection.y = 0; // Keep movement on the ground plane
        cameraDirection.normalize();
        
        // Get camera right vector (fixed calculation)
        const cameraRight = new THREE.Vector3(
            Math.sin(this.cameraRotation + Math.PI/2), 
            0, 
            Math.cos(this.cameraRotation + Math.PI/2)
        );
        
        // Calculate relative movement direction
        if (this.keys.w) {
            this.playerDirection.add(cameraDirection);
        }
        if (this.keys.s) {
            this.playerDirection.sub(cameraDirection);
        }
        if (this.keys.a) {
            this.playerDirection.sub(cameraRight);
        }
        if (this.keys.d) {
            this.playerDirection.add(cameraRight);
        }
        
        // Normalize if moving diagonally
        if (this.playerDirection.length() > 1) {
            this.playerDirection.normalize();
        }
        
        // Calculate new position
        const newPosition = new THREE.Vector3(
            this.player.position.x + this.playerDirection.x * speed,
            this.player.position.y,
            this.player.position.z + this.playerDirection.z * speed
        );
        
        // Check island boundary
        const distanceFromCenter = Math.sqrt(
            newPosition.x * newPosition.x + 
            newPosition.z * newPosition.z
        );
        
        // Check for collisions
        let canMove = true;
        if (this.playerDirection.length() > 0) {
            // Check NPC collisions
            if (this.checkNPCCollision(newPosition)) {
                canMove = false;
            }
            
            // Check tree collisions
            if (canMove && this.checkTreeCollision(newPosition)) {
                canMove = false;
            }
            
            // Check building collisions
            if (canMove && this.checkBuildingCollision(newPosition)) {
                canMove = false;
            }
        }
        
        // Apply movement if no collision and within island bounds or on bridge
        if (canMove) {
            let onBridge = this.isOnBridge(newPosition);
            let withinIslandBounds = this.isWithinAnyIsland(newPosition);
            
            if (onBridge) {
                console.log("Player can move onto bridge");
                this.player.position.copy(newPosition);
            } else if (withinIslandBounds) {
                console.log("Player can move within island");
                this.player.position.copy(newPosition);
            } else {
                console.log("Movement blocked: not on bridge or island");
                // Optional bridge location hint
                if (this.bridges && this.bridges.length > 0) {
                    const bridge = this.bridges[0]; // Just check the first bridge
                    console.log("Bridge start:", bridge.start.toArray());
                    console.log("Bridge end:", bridge.end.toArray());
                    console.log("Distance to bridge start:", this.player.position.distanceTo(bridge.start));
                }
            }
        }
        
        // Orient player toward movement direction
        if (this.playerDirection.length() > 0) {
            const angle = Math.atan2(this.playerDirection.x, this.playerDirection.z);
            this.player.rotation.y = angle;
        }
        
        // Handle camera rotation with arrow keys
        if (this.cameraMode === 'thirdPerson') {
            const rotationSpeed = 0.03;
            if (this.keys.arrowleft) {
                this.cameraRotation += rotationSpeed;
                this.updateCameraPosition();
            }
            if (this.keys.arrowright) {
                this.cameraRotation -= rotationSpeed;
                this.updateCameraPosition();
            }
        }
        
        // Update camera position based on current mode
        this.camera.position.copy(this.player.position).add(this.cameraOffset);
        
        // In first person mode, look in direction of movement
        // Otherwise look at player
        if (this.cameraMode === 'firstPerson') {
            if (this.playerDirection.length() > 0) {
                // Look in direction of movement
                const lookTarget = new THREE.Vector3(
                    this.player.position.x + this.playerDirection.x,
                    this.player.position.y + 0.8, // Eye level
                    this.player.position.z + this.playerDirection.z
                );
                this.camera.lookAt(lookTarget);
            }
        } else {
            this.camera.lookAt(this.player.position);
        }
        
        // Check for collectible interactions
        this.checkCollectibleCollisions();
        
        // Check for NPC proximity for interaction
        this.checkNPCProximity();
    }

    checkNPCCollision(position) {
        if (!this.npcs) return false;
        
        for (const npc of this.npcs) {
            const distance = position.distanceTo(npc.position);
            if (distance < 0.6) { // Collision distance
                return true;
            }
        }
        
        return false;
    }

    checkNPCProximity() {
        if (!this.npcs || this.inDialogue) return;
        
        let nearbyNPC = null;
        const interactionDistance = 1.5;
        const interactPrompt = document.getElementById('interact-prompt');
        
        for (const npc of this.npcs) {
            const distance = this.player.position.distanceTo(npc.position);
            if (distance < interactionDistance) {
                nearbyNPC = npc;
                break;
            }
        }
        
        // Update nearby NPC status
        this.nearbyNPC = nearbyNPC;
        
        // Show/hide interaction prompt
        if (interactPrompt) {
            if (nearbyNPC) {
                interactPrompt.textContent = "Press E to talk";
                interactPrompt.style.display = 'block';
            } else {
                interactPrompt.style.display = 'none';
            }
        }
    }

    updateNPCs(deltaTime) {
        if (!this.npcs) return;
        
        for (const npc of this.npcs) {
            // Skip NPCs in dialogue
            if (this.inDialogue && this.currentNPC === npc) continue;
            
            // Update NPC movement timer
            npc.userData.moveTimer += deltaTime;
            
            // Change direction occasionally
            if (npc.userData.moveTimer > npc.userData.moveInterval) {
                npc.userData.moveTimer = 0;
                
                // 30% chance to move in a random direction, 70% chance to stay still
                if (Math.random() < 0.3) {
                    const angle = Math.random() * Math.PI * 2;
                    npc.userData.moveDirection.set(
                        Math.sin(angle) * 0.02,
                        0,
                        Math.cos(angle) * 0.02
                    );
                    
                    // Face movement direction
                    npc.rotation.y = angle;
                } else {
                    npc.userData.moveDirection.set(0, 0, 0);
                }
            }
            
            // Apply movement
            if (npc.userData.moveDirection.length() > 0) {
                // Calculate new position
                const newPosition = new THREE.Vector3().copy(npc.position).add(
                    npc.userData.moveDirection.clone().multiplyScalar(deltaTime)
                );
                
                // Check boundaries
                const distanceFromCenter = Math.sqrt(
                    newPosition.x * newPosition.x + 
                    newPosition.z * newPosition.z
                );
                
                // Stay within island and avoid player
                if (distanceFromCenter < this.islandRadius - 1 && 
                    newPosition.distanceTo(this.player.position) > 0.8) {
                    npc.position.copy(newPosition);
                }
            }
        }
    }

    checkTreeCollision(position) {
        if (!this.trees) return false;
        
        for (const tree of this.trees) {
            const dx = position.x - tree.position.x;
            const dz = position.z - tree.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < tree.radius) {
                return true; // Collision detected
            }
        }
        
        return false;
    }

    checkBuildingCollision(position) {
        if (!this.buildings) return false;
        
        for (const building of this.buildings) {
            // Box collision check
            const halfWidth = building.width / 2;
            const halfDepth = building.depth / 2;
            
            // Check if player position is inside the building's bounding box
            if (position.x > building.position.x - halfWidth &&
                position.x < building.position.x + halfWidth &&
                position.z > building.position.z - halfDepth &&
                position.z < building.position.z + halfDepth) {
                return true; // Collision detected
            }
        }
        
        return false;
    }

    // Add method to check if player is on any island
    isWithinAnyIsland(position) {
        // First check main island
        const distanceFromCenter = Math.sqrt(
            position.x * position.x + 
            position.z * position.z
        );
        
        // Check if within main island
        if (distanceFromCenter < this.islandRadius) {
            return true;
        }
        
        // Check if on any bridge
        if (this.isOnBridge(position)) {
            console.log("Player is on a bridge in isWithinAnyIsland check");
            return true;
        }
        
        // Check if within any created island
        if (this.islands && this.islands.length > 0) {
            for (const island of this.islands) {
                const distanceFromIsland = position.distanceTo(island.position);
                if (distanceFromIsland < island.radius) {
                    return true;
                }
            }
        }
        
        return false;
    }

    // Improved bridge collision detection with start/end buffer zones
    isOnBridge(position) {
        // Check if bridges array exists
        if (!this.bridges || !this.bridges.length) {
            return false;
        }
        
        for (const bridge of this.bridges) {
            console.log("Checking bridge from", bridge.start.toArray(), "to", bridge.end.toArray());
            
            // Get bridge vector (direction)
            const bridgeVector = new THREE.Vector3().subVectors(bridge.end, bridge.start);
            const bridgeLength = bridgeVector.length();
            const bridgeDir = bridgeVector.clone().normalize();
            
            // Vector from bridge start to player
            const toPlayer = new THREE.Vector3().subVectors(position, bridge.start);
            
            // Project player vector onto bridge direction
            const projectionLength = toPlayer.dot(bridgeDir);
            console.log("Projection length:", projectionLength, "Bridge length:", bridgeLength);
            
            // Buffer zone at start and end of bridge
            const buffer = 1.5;
            
            // Check if projection is within bridge length with buffer zone
            if (projectionLength >= -buffer && projectionLength <= bridgeLength + buffer) {
                // Calculate closest point on bridge line
                const clampedProjection = Math.max(0, Math.min(bridgeLength, projectionLength));
                const closestPoint = new THREE.Vector3()
                    .copy(bridge.start)
                    .add(bridgeDir.clone().multiplyScalar(clampedProjection));
                
                // Calculate lateral distance from bridge centerline  
                const lateralDistance = new THREE.Vector3()
                    .subVectors(position, closestPoint)
                    .length();
                    
                console.log("Lateral distance:", lateralDistance, "Bridge width:", bridge.width);
                
                // Check if within bridge width (slightly wider at ends)
                const effectiveWidth = bridge.width / 2;
                
                // Add extra width near the endpoints
                if (projectionLength < 2 || projectionLength > bridgeLength - 2) {
                    // Wider tolerance at the ends
                    if (lateralDistance <= effectiveWidth + 1) {
                        console.log("BRIDGE COLLISION DETECTED at endpoint area!");
                        return true;
                    }
                } else if (lateralDistance <= effectiveWidth) {
                    console.log("BRIDGE COLLISION DETECTED along span!");
                    return true;
                }
            }
        }
        
        return false;
    }

    // Add this method to create a new island with a bridge
    createNewIsland(islandName, theme = 'tropical', sourceIslandIndex = -1) {
        console.log("========== CREATING NEW ISLAND ==========");
        console.log("Island name:", islandName);
        console.log("Island theme:", theme);
        console.log("Source island index:", sourceIslandIndex);
        
        // Enforce the "no more bridges from main island after first island" rule
        if (this.islands && this.islands.length > 0 && sourceIslandIndex < 0) {
            // Randomly select an existing island instead of the main island
            sourceIslandIndex = Math.floor(Math.random() * this.islands.length);
            console.log("Redirecting from main island to existing island #" + sourceIslandIndex);
        }
        
        // Determine source island position
        let sourcePosition;
        let sourceIslandName = "Main Island";
        
        if (sourceIslandIndex >= 0 && this.islands && this.islands[sourceIslandIndex]) {
            // Build from specified island
            sourcePosition = this.islands[sourceIslandIndex].position;
            sourceIslandName = this.islands[sourceIslandIndex].name;
            console.log(`Building from existing island: ${sourceIslandName}`);
        } else {
            // Default to main island (only for the first island)
            sourcePosition = this.mainIslandPosition;
            console.log("Building from main island");
        }
        
        // Generate position for new island with collision avoidance
        const islandRadius = 20;
        const minDistanceBetweenIslands = islandRadius * 2 + 20; // Minimum safe distance
        
        // Start with a bias toward expanding outward from the center
        // Calculate the center of the archipelago
        let centerX = this.mainIslandPosition.x;
        let centerZ = this.mainIslandPosition.z;
        if (this.islands && this.islands.length > 0) {
            // Include all islands in the center calculation
            let totalX = centerX;
            let totalZ = centerZ;
            for (const island of this.islands) {
                totalX += island.position.x;
                totalZ += island.position.z;
            }
            centerX = totalX / (this.islands.length + 1);
            centerZ = totalZ / (this.islands.length + 1);
        }
        
        // Calculate direction vector from archipelago center to source island
        const directionFromCenter = new THREE.Vector3(
            sourcePosition.x - centerX,
            0,
            sourcePosition.z - centerZ
        );
        
        // If the source island is close to center, use a random direction instead
        let preferredAngle;
        if (directionFromCenter.length() < 5) {
            preferredAngle = Math.random() * Math.PI * 2;
        } else {
            // Otherwise, use the direction from center with some randomness
            directionFromCenter.normalize();
            preferredAngle = Math.atan2(directionFromCenter.x, directionFromCenter.z);
            // Add some randomness to the angle but keep the general outward direction
            preferredAngle += (Math.random() - 0.5) * Math.PI / 2; // ±45 degrees
        }
        
        // Try multiple positions if needed to avoid collisions
        let validPositionFound = false;
        let newIslandPosition;
        let attempts = 0;
        const maxAttempts = 12;
        
        while (!validPositionFound && attempts < maxAttempts) {
            // Increase distance for each attempt
            const distanceFactor = 1 + (attempts * 0.1);
            const distanceBetweenIslands = minDistanceBetweenIslands * distanceFactor;
            
            // Calculate angle with increasing variation for each attempt
            const angleVariation = (attempts / maxAttempts) * Math.PI; // More variation with more attempts
            const currentAngle = preferredAngle + (Math.random() * 2 - 1) * angleVariation;
            
            newIslandPosition = new THREE.Vector3(
                sourcePosition.x + Math.cos(currentAngle) * distanceBetweenIslands,
                0,
                sourcePosition.z + Math.sin(currentAngle) * distanceBetweenIslands
            );
            
            // Check for collisions with existing islands
            validPositionFound = true;
            
            // Check distance from main island
            const distanceFromMain = newIslandPosition.distanceTo(this.mainIslandPosition);
            if (distanceFromMain < this.islandRadius + islandRadius) {
                validPositionFound = false;
            }
            
            // Check distance from other islands
            if (validPositionFound && this.islands) {
                for (const island of this.islands) {
                    const distanceFromIsland = newIslandPosition.distanceTo(island.position);
                    if (distanceFromIsland < islandRadius + island.radius + 10) {
                        validPositionFound = false;
                        break;
                    }
                }
            }
            
            attempts++;
        }
        
        if (!validPositionFound) {
            console.log("Could not find a collision-free position after " + maxAttempts + " attempts. Using last attempt.");
        }
        
        console.log("New island position:", newIslandPosition);
        
        // Create ocean extension
        const oceanExtension = new THREE.PlaneGeometry(200, 200);
        const oceanMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x0099FF,
            side: THREE.DoubleSide 
        });
        const oceanArea = new THREE.Mesh(oceanExtension, oceanMaterial);
        oceanArea.rotation.x = -Math.PI / 2;
        oceanArea.position.copy(newIslandPosition);
        oceanArea.position.y = -0.1;
        this.scene.add(oceanArea);
        console.log("Ocean area created");
        
        
        // Select terrain color based on theme
        let grassColor;
        switch(theme) {
            case 'winter':
                grassColor = 0xFFFFFF; // Snow white
                break;
            case 'desert':
                grassColor = 0xDEB887; // Sand color
                break;
            case 'autumn':
                grassColor = 0xD2691E; // Brown/orange autumn color
                break;
            case 'tropical':
            default:
                grassColor = 0x7CFC00; // Bright green
        }
        
        // Create island (circular ground)
        const islandGeometry = new THREE.CircleGeometry(islandRadius, 64);
        const islandMaterial = new THREE.MeshLambertMaterial({ 
            color: grassColor,
            side: THREE.DoubleSide 
        });
        const island = new THREE.Mesh(islandGeometry, islandMaterial);
        island.rotation.x = -Math.PI / 2;
        island.position.copy(newIslandPosition);
        island.receiveShadow = true;
        this.scene.add(island);
        
        // Create beach (sand ring around the island)
        const beachOuterRadius = islandRadius + 3;
        const beachInnerRadius = islandRadius;
        const beachGeometry = new THREE.RingGeometry(beachInnerRadius, beachOuterRadius, 64);
        const beachMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xF0E68C, // Khaki/sand color
            side: THREE.DoubleSide 
        });
        const beach = new THREE.Mesh(beachGeometry, beachMaterial);
        beach.rotation.x = -Math.PI / 2;
        beach.position.copy(newIslandPosition);
        beach.position.y = -0.05; // Slightly below grass level
        beach.receiveShadow = true;
        this.scene.add(beach);
        
        // Populate island with themed objects
        this.populateIsland(newIslandPosition, islandRadius, theme);
        
        // Create bridge from source island to new island
        console.log(`Creating bridge from ${sourceIslandName} to new island`);
        this.createBridge(sourcePosition, newIslandPosition);
        console.log("Bridge created successfully");
        
        // Add island to islands array
        if (!this.islands) this.islands = [];
        const newIslandIndex = this.islands.length;
        this.islands.push({
            position: newIslandPosition,
            radius: islandRadius - 1, // Slightly smaller for collision
            name: islandName,
            theme: theme
        });
        console.log("Island added to islands array");
        
        // Show notification
        const interactPrompt = document.getElementById('interact-prompt') || this.createInteractPrompt();
        interactPrompt.textContent = `${islandName} has been created! Look for a bridge connecting from ${sourceIslandName} to reach it. Feel free to explore it whenever you like.`;
        interactPrompt.style.display = 'block';
        
        // Hide after a delay
        setTimeout(() => {
            interactPrompt.style.display = 'none';
        }, 5000);
        
        console.log("Island creation complete!");
        
        // Create island-specific NPC (with correct index)
        this.createIslandNPC(newIslandPosition, theme, newIslandIndex);
        
        return `I've created ${islandName} for you to visit! Look for a bridge connecting from ${sourceIslandName} to reach it. Feel free to explore it whenever you like.`;
    }

    // Add this helper method to populate the island with themed objects
    populateIsland(islandPosition, islandRadius, theme) {
        // Create trees appropriate to the theme
        let treeCount = 12;
        let treeType = 'normal';
        
        switch(theme.toLowerCase()) {
            case 'autumn':
                treeType = 'autumn';
                break;
            case 'winter':
                treeType = 'winter';
                treeCount = 8; // Fewer trees in winter
                break;
            case 'desert':
                treeType = 'cactus';
                treeCount = 5; // Fewer trees in desert
                break;
            case 'tropical':
            default:
                treeType = 'palm';
                break;
        }
        
        // Create trees
        for (let i = 0; i < treeCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (islandRadius - 5);
            
            const treePosition = new THREE.Vector3(
                islandPosition.x + Math.cos(angle) * radius,
                0,
                islandPosition.z + Math.sin(angle) * radius
            );
            
            // Add tree based on theme
            if (treeType === 'autumn') {
                this.createTree(treePosition.x, treePosition.y, treePosition.z, 0xFFA500); // Orange leaves
            } else if (treeType === 'winter') {
                this.createTree(treePosition.x, treePosition.y, treePosition.z, 0xFFFFFF); // White/snowy leaves
            } else if (treeType === 'cactus') {
                this.createCactus(treePosition.x, treePosition.y, treePosition.z);
            } else {
                this.createPalmTree(treePosition.x, treePosition.y, treePosition.z);
            }
        }
        
        // Add a few collectibles
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (islandRadius - 3);
            
            const collectibleGeometry = new THREE.SphereGeometry(0.2, 8, 8);
            const collectibleMaterial = new THREE.MeshLambertMaterial({ color: 0xFFD700 }); // Gold color
            const collectible = new THREE.Mesh(collectibleGeometry, collectibleMaterial);
            
            collectible.position.set(
                islandPosition.x + Math.cos(angle) * radius,
                0.2,
                islandPosition.z + Math.sin(angle) * radius
            );
            
            collectible.castShadow = true;
            collectible.receiveShadow = true;
            collectible.userData = {
                type: 'collectible',
                name: 'Special Item',
                value: 200
            };
            
            this.scene.add(collectible);
            if (!this.collectibles) this.collectibles = [];
            this.collectibles.push(collectible);
        }
        
        // REMOVE THIS LINE - NPC now created in createNewIsland
        // this.createIslandNPC(islandPosition, theme, this.islands.length);
    }

    // Add this method to create cactus (for desert theme)
    createCactus(x, y, z) {
        // Main body
        const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8);
        const cactusMaterial = new THREE.MeshLambertMaterial({ color: 0x2E8B57 }); // Dark green
        const body = new THREE.Mesh(bodyGeometry, cactusMaterial);
        body.position.set(x, y + 0.75, z);
        body.castShadow = true;
        body.receiveShadow = true;
        this.scene.add(body);
        
        // Add a branch or two
        const branchCount = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < branchCount; i++) {
            const branchGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.7, 8);
            const branch = new THREE.Mesh(branchGeometry, cactusMaterial);
            
            // Position branch on side of main body at random height
            const branchHeight = 0.1 + Math.random() * 0.5;
            const angle = Math.random() * Math.PI * 2;
            
            branch.position.set(
                x + Math.cos(angle) * 0.3,
                y + 0.5 + branchHeight,
                z + Math.sin(angle) * 0.3
            );
            
            // Rotate branch outward
            branch.rotation.z = Math.PI / 2 - angle;
            
            branch.castShadow = true;
            this.scene.add(branch);
        }
        
        // Add to trees array for collision
        if (!this.trees) this.trees = [];
        this.trees.push({
            position: new THREE.Vector3(x, y, z),
            radius: 0.5
        });
    }

    createBridge(startPosition, endPosition) {
        // Calculate bridge direction and length
        const direction = new THREE.Vector3().subVectors(endPosition, startPosition).normalize();
        const distance = startPosition.distanceTo(endPosition);
        
        // Bridge parameters
        const bridgeWidth = 3;
        const segmentLength = 4;
        const railingHeight = 0.3;
        
        // Calculate bridge start and end points (starting from shore of each island)
        const mainIslandRadius = this.islandRadius || 25;
        const newIslandRadius = 20; // Standard radius for new islands
        
        const bridgeStart = new THREE.Vector3().copy(startPosition).add(
            direction.clone().multiplyScalar(mainIslandRadius + 0.5)
        );
        
        const bridgeEnd = new THREE.Vector3().copy(endPosition).sub(
            direction.clone().multiplyScalar(newIslandRadius + 0.5)
        );
        
        const bridgeLength = bridgeStart.distanceTo(bridgeEnd);
        const segmentCount = Math.ceil(bridgeLength / segmentLength);
        
        // Create bridge group
        const bridgeGroup = new THREE.Group();
        
        // Bridge deck material
        const deckMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown wood
        const railingMaterial = new THREE.MeshLambertMaterial({ color: 0x654321 }); // Darker brown
        
        // Calculate segment size to span the exact distance
        const actualSegmentLength = bridgeLength / segmentCount;
        
        // Create bridge segments
        for (let i = 0; i < segmentCount; i++) {
            // Calculate segment position (start position + percentage of the way to end)
            const segmentOffset = direction.clone().multiplyScalar(actualSegmentLength * (i + 0.5));
            const segmentPos = new THREE.Vector3().copy(bridgeStart).add(segmentOffset);
            
            // Create bridge deck
            const deckGeometry = new THREE.BoxGeometry(bridgeWidth, 0.2, actualSegmentLength * 1.1);
            const deck = new THREE.Mesh(deckGeometry, deckMaterial);
            deck.position.copy(segmentPos);
            deck.position.y = 0;
            
            // Rotate to align with bridge direction
            deck.rotation.y = Math.atan2(direction.x, direction.z);
            
            deck.castShadow = true;
            deck.receiveShadow = true;
            bridgeGroup.add(deck);
            
            // Create railings
            const leftRailingGeometry = new THREE.BoxGeometry(0.2, railingHeight, actualSegmentLength * 1.1);
            const rightRailingGeometry = new THREE.BoxGeometry(0.2, railingHeight, actualSegmentLength * 1.1);
            
            const leftRailing = new THREE.Mesh(leftRailingGeometry, railingMaterial);
            const rightRailing = new THREE.Mesh(rightRailingGeometry, railingMaterial);
            
            // Position railings at the edges of the bridge
            leftRailing.position.copy(segmentPos);
            rightRailing.position.copy(segmentPos);
            
            // Offset by half the bridge width
            const railingOffset = new THREE.Vector3(-direction.z, 0, direction.x).normalize().multiplyScalar(bridgeWidth / 2 - 0.1);
            leftRailing.position.add(railingOffset);
            rightRailing.position.sub(railingOffset);
            
            // Set height for railings
            leftRailing.position.y = railingHeight / 2;
            rightRailing.position.y = railingHeight / 2;
            
            // Rotate to align with bridge direction
            leftRailing.rotation.y = Math.atan2(direction.x, direction.z);
            rightRailing.rotation.y = Math.atan2(direction.x, direction.z);
            
            leftRailing.castShadow = true;
            rightRailing.castShadow = true;
            bridgeGroup.add(leftRailing);
            bridgeGroup.add(rightRailing);
        }
        
        // Store bridge data for collision detection
        if (!this.bridges) {
            this.bridges = [];
        }
        
        this.bridges.push({
            start: bridgeStart.clone(), // Make sure to clone these
            end: bridgeEnd.clone(),
            width: bridgeWidth
        });
        
        console.log("Bridge data added:", {
            start: bridgeStart.toArray(),
            end: bridgeEnd.toArray(),
            width: bridgeWidth
        });
        
        this.scene.add(bridgeGroup);
        return bridgeGroup;
    }

    // Add these debug methods
    logPlayerPosition() {
        console.log("Player position:", this.player.position.toArray());
        
        // Check if on any bridge
        if (this.bridges && this.bridges.length > 0) {
            console.log("Checking bridges:", this.bridges.length);
            this.isOnBridge(this.player.position); // Will trigger the debug logs inside
        } else {
            console.log("No bridges exist to check");
        }
        
        // Check if within any island
        console.log("Within any island:", this.isWithinAnyIsland(this.player.position));
    }

    // Add this method to create NPCs themed for specific islands
    createIslandNPC(islandPosition, theme, islandIndex) {
        // Create NPC group
        const npcGroup = new THREE.Group();
        
        // Body - color based on theme
        let bodyColor;
        switch(theme.toLowerCase()) {
            case 'winter':
                bodyColor = 0x6495ED; // Light blue
                break;
            case 'desert':
                bodyColor = 0xDEB887; // Sandy color
                break;
            case 'autumn':
                bodyColor = 0xA0522D; // Brown
                break;
            case 'tropical':
            default:
                bodyColor = 0xFF6347; // Coral/orange
                break;
        }
        
        const bodyGeometry = new THREE.CylinderGeometry(0.25, 0.25, 0.7, 8);
        const bodyMaterial = new THREE.MeshLambertMaterial({ color: bodyColor });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.35;
        body.castShadow = true;
        npcGroup.add(body);
        
        // Head
        const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
        const headMaterial = new THREE.MeshLambertMaterial({ color: 0xFFE4C4 }); // Light skin tone
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 0.85;
        head.castShadow = true;
        npcGroup.add(head);
        
        // Arms
        const armGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 8);
        const armMaterial = new THREE.MeshLambertMaterial({ color: bodyColor });
        
        const leftArm = new THREE.Mesh(armGeometry, armMaterial);
        leftArm.position.set(-0.35, 0.35, 0);
        leftArm.rotation.z = Math.PI / 6;
        leftArm.castShadow = true;
        npcGroup.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeometry, armMaterial);
        rightArm.position.set(0.35, 0.35, 0);
        rightArm.rotation.z = -Math.PI / 6;
        rightArm.castShadow = true;
        npcGroup.add(rightArm);
        
        // Legs
        const legGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 8);
        const legMaterial = new THREE.MeshLambertMaterial({ color: 0x4682B4 }); // Blue jeans
        
        const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
        leftLeg.position.set(-0.15, -0.15, 0);
        leftLeg.castShadow = true;
        npcGroup.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
        rightLeg.position.set(0.15, -0.15, 0);
        rightLeg.castShadow = true;
        npcGroup.add(rightLeg);
        
        // Position NPC on the island at a random location near the center
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * (8); // Keep somewhat close to center
        
        npcGroup.position.set(
            islandPosition.x + Math.cos(angle) * radius,
            0.5,
            islandPosition.z + Math.sin(angle) * radius
        );
        
        // Get island name if available
        let islandName = "this island";
        if (this.islands && this.islands.length > islandIndex) {
            islandName = this.islands[islandIndex].name || "this island";
        }
        
        // Get NPC name based on theme
        const npcName = this.getThemedNPCName(theme);
        
        // Store NPC data with island-specific info
        npcGroup.userData = {
            type: 'npc',
            name: npcName,
            islandName: islandName,
            theme: theme,
            moveDirection: new THREE.Vector3(0, 0, 0),
            moveTimer: 0,
            moveInterval: 3,
            chatHistory: [],
            islandNPC: true,
            isGeneratingResponse: false
        };
        
        console.log(`Created island NPC: ${npcName} for ${islandName} (${theme} theme)`);
        
        this.scene.add(npcGroup);
        if (!this.npcs) this.npcs = [];
        this.npcs.push(npcGroup);
    }

    // Helper to generate themed NPC names
    getThemedNPCName(theme) {
        const winterNames = ["Frost", "Snow", "Icy", "Glacier", "Blizzard"];
        const desertNames = ["Sandy", "Cactus", "Dusty", "Amber", "Mesa"];
        const autumnNames = ["Maple", "Amber", "Rusty", "Harvest", "Autumn"];
        const tropicalNames = ["Sunny", "Palm", "Coral", "Marina", "Kai"];
        
        let nameList;
        switch(theme.toLowerCase()) {
            case 'winter':
                nameList = winterNames;
                break;
            case 'desert':
                nameList = desertNames;
                break;
            case 'autumn':
                nameList = autumnNames;
                break;
            case 'tropical':
            default:
                nameList = tropicalNames;
                break;
        }
        
        return nameList[Math.floor(Math.random() * nameList.length)];
    }

    // Add these methods to handle player facts
    loadPlayerFacts() {
        try {
            console.log("Loading player memories from localStorage");
            // First check localStorage
            const memoriesString = localStorage.getItem('playerMemories');
            if (memoriesString) {
                const memories = JSON.parse(memoriesString);
                console.log("Successfully loaded player memories:", memories);
                return memories;
            }
            console.log("No player memories found in localStorage");
            return []; // Return empty array if no memories exist yet
        } catch (error) {
            console.error("Error loading player memories:", error);
            return [];
        }
    }

    rememberPlayerFact(memory, importance = 3) {
        try {
            console.log(`Saving memory: "${memory}" (importance: ${importance})`);
            
            // Load existing memories - ensure we have the most recent version
            const existingMemories = this.loadPlayerFacts() || [];
            
            // Check if this memory already exists (to avoid duplicates)
            const lowerCaseMemory = memory.toLowerCase();
            const isDuplicate = existingMemories.some(item => {
                if (typeof item === 'string') {
                    return item.toLowerCase() === lowerCaseMemory;
                } else if (item && typeof item === 'object' && item.text) {
                    return item.text.toLowerCase() === lowerCaseMemory;
                }
                return false;
            });
            
            if (!isDuplicate) {
                // Add the new memory with metadata
                existingMemories.push({
                    text: memory,
                    importance: importance,
                    timestamp: new Date().toISOString()
                });
                
                // Save to localStorage
                const memoriesString = JSON.stringify(existingMemories);
                localStorage.setItem('playerMemories', memoriesString);
                
                console.log("Player memories saved to localStorage:", memoriesString);
                
                // Show toast notification
                this.showToast(`I'll remember that ${memory}`);
            } else {
                console.log("Duplicate memory not saved:", memory);
            }
            
            return true;
        } catch (error) {
            console.error("Error saving player memory:", error);
            return false;
        }
    }

    showToast(message) {
        // Create toast if it doesn't exist
        let toast = document.getElementById('toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast-notification';
            toast.style.position = 'absolute';
            toast.style.bottom = '80px';
            toast.style.left = '50%';
            toast.style.transform = 'translateX(-50%)';
            toast.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            toast.style.color = 'white';
            toast.style.padding = '10px 20px';
            toast.style.borderRadius = '5px';
            toast.style.fontFamily = 'Arial, sans-serif';
            toast.style.fontSize = '14px';
            toast.style.zIndex = '2000';
            toast.style.display = 'none';
            document.body.appendChild(toast);
        }
        
        // Set message and show
        toast.textContent = message;
        toast.style.display = 'block';
        
        // Hide after delay
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    // Add a debug function to help troubleshoot memory issues
    debugPlayerMemory() {
        try {
            const memories = this.loadPlayerFacts();
            console.log("=== PLAYER MEMORY DEBUG ===");
            console.log("Raw localStorage entry:", localStorage.getItem('playerMemories'));
            console.log("Parsed memories:", memories);
            console.log("Number of memories:", memories.length);
            console.log("=== END MEMORY DEBUG ===");
            return memories;
        } catch (error) {
            console.error("Error debugging player memory:", error);
            return [];
        }
    }

    // Add a method to clear player facts (for testing)
    clearPlayerFacts() {
        localStorage.removeItem('playerMemories');
        console.log("Player memories cleared");
        this.showToast("Memory cleared");
    }

    // Add this method to the Game class

    createDebugControls() {
        const debugDiv = document.createElement('div');
        debugDiv.style.position = 'fixed';
        debugDiv.style.top = '10px';
        debugDiv.style.right = '10px';
        debugDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
        debugDiv.style.color = 'white';
        debugDiv.style.padding = '10px';
        debugDiv.style.borderRadius = '5px';
        debugDiv.style.zIndex = '1000';
        
        const showMemoryBtn = document.createElement('button');
        showMemoryBtn.textContent = 'Show Memory';
        showMemoryBtn.addEventListener('click', () => {
            const memories = this.debugPlayerMemory();
            
            if (!memories || memories.length === 0) {
                alert('No player memories stored');
                return;
            }
            
            const memoriesText = memories.map(memory => {
                if (typeof memory === 'string') {
                    return `• ${memory}`;
                } else if (memory && typeof memory === 'object' && memory.text) {
                    return `• ${memory.text} (Importance: ${memory.importance || 3})`;
                }
                return '• Unknown memory format';
            }).join('\n');
            
            alert(memoriesText || 'No player memories stored');
        });
        
        const clearMemoryBtn = document.createElement('button');
        clearMemoryBtn.textContent = 'Clear Memory';
        clearMemoryBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear player memory?')) {
                this.clearPlayerFacts();
            }
        });
        
        debugDiv.appendChild(showMemoryBtn);
        debugDiv.appendChild(document.createElement('br'));
        debugDiv.appendChild(clearMemoryBtn);
        
        document.body.appendChild(debugDiv);
    }

    // Add a call to this method in your init() or after loading the game
}

// Initialize game
window.onload = () => {
    const game = new AnimalCrossingGame();
}; 