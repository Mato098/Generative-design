// Clean Game Client - Barebones skeleton for custom visualization
// Layout: [Messages 3:9] [Game 9:9] [Info/Controls 4:9]

// =============================================================================
// GLOBAL STATE
// =============================================================================
let socket = null;
let gameState = null;
let animationQueue = [];
let isAnimating = false;
let animationPaused = false;
let selectedObserverAction = null; // For targeting observer powers
let actionLog = []; // Recent actions
let messageLog = []; // Agent messages
const MAX_LOG_ENTRIES = 10;

// =============================================================================
// LAYOUT DIMENSIONS (16:9 format)
// =============================================================================
const LAYOUT = {
  totalWidth: 1600,
  totalHeight: 900,
  
  // Left panel: Messages/Actions (3:9 ratio)
  messagesPanel: {
    x: 0,
    y: 0,
    width: 300,
    height: 900
  },
  
  // Center: Game grid (9:9 ratio)
  gamePanel: {
    x: 300,
    y: 0,
    width: 900,
    height: 900
  },
  
  // Right panel: Info & Controls (4:9 ratio)
  rightPanel: {
    x: 1200,
    y: 0,
    width: 400,
    height: 900,
    
    // Split into top (info) and bottom (observer controls)
    infoSection: {
      x: 1200,
      y: 0,
      width: 400,
      height: 450
    },
    
    controlsSection: {
      x: 1200,
      y: 450,
      width: 400,
      height: 450
    }
  }
};

let font;
let fontSize = 14;

function preload(){
    font = loadFont('Glass_TTY_VT220.ttf');
    //font = loadFont('inconsolata.regular.ttf');
}

// =============================================================================
// CORE SETUP
// =============================================================================
function setup() {
  createCanvas(LAYOUT.totalWidth, LAYOUT.totalHeight);
  connectToServer();
  //textFont(font);

  
}

function connectToServer() {
  socket = new WebSocket('ws://localhost:3000');
  
  socket.onopen = function() {
    console.log('Connected to game server');
  };
  
  socket.onmessage = function(event) {
    const message = JSON.parse(event.data);
    handleServerMessage(message);
  };
  
  socket.onclose = function() {
    console.log('Disconnected from server');
  };
}

// =============================================================================
// SERVER MESSAGE HANDLING
// =============================================================================
function handleServerMessage(message) {
  console.log('📨 Received server message:', message.type, message.data);
  
  switch (message.type) {
    case 'gameState':
      gameState = message.data;
      break;
      
    case 'actionsExecuted':
      console.log('🎬 Processing actionsExecuted:', message.data);
      
      // Add actions to animation queue
      if (message.data.actions && Array.isArray(message.data.actions)) {
        for (const action of message.data.actions) {
          console.log('➕ Adding action to queue:', action);
          animationQueue.push(action);
          
          // Log action
          if (action.action) {
            const params = action.action.parameters;
            let actionText = `${message.data.player}: ${action.action.type}`;
            if (params.x !== undefined) actionText += ` (${params.x},${params.y})`;
            actionLog.push(actionText);
            if (actionLog.length > MAX_LOG_ENTRIES) actionLog.shift();
            
            // Log messages separately
            if (action.action.type === 'Message' && params.text) {
              messageLog.push({ player: message.data.player, text: params.text });
              if (messageLog.length > MAX_LOG_ENTRIES) messageLog.shift();
            }
          }
        }
      } else {
        console.warn('⚠️ No actions array in actionsExecuted message');
      }
      
      // Update game state if provided
      if (message.data.newGameState) {
        gameState = message.data.newGameState;
      }
      
      processAnimationQueue();
      break;
      
    case 'gameStarted':
      gameState = message.data;
      actionLog.push('Game started!');
      break;
      
    case 'gameEnded':
      actionLog.push(`Game ended! Winner: ${message.data.winner} (${message.data.type} victory)`);
      handleGameEnd(message.data);
      break;
      
    case 'error':
      console.error('Server error:', message.data);
      break;
  }
}

// =============================================================================
// ANIMATION SYSTEM
// =============================================================================
function processAnimationQueue() {
  console.log(`🎞️ processAnimationQueue: animating=${isAnimating}, queue=${animationQueue.length}, paused=${animationPaused}`);
  console.log(`📋 Queue contents:`, animationQueue.map(a => a.action ? a.action.type : 'unknown'));
  
  // If paused, don't process anything
  if (animationPaused) {
    console.log('⏸ Paused - queue processing halted');
    return;
  }
  
  // If already animating or queue empty, check if we should notify
  if (isAnimating || animationQueue.length === 0) {
    // If queue is empty and not animating and not paused, notify server
    if (!isAnimating && animationQueue.length === 0) {
      console.log('✅ Animation queue empty, notifying server');
      notifyServerAnimationComplete();
    }
    return;
  }
  
  isAnimating = true;
  const action = animationQueue.shift();
  console.log(`🎬 Starting animation for:`, action);
  
  // Execute animation based on type
  executeAnimation(action, function() {
    console.log(`✅ Animation complete for:`, action.action ? action.action.type : 'unknown');
    isAnimating = false;
    processAnimationQueue(); // Process next action (will check pause state again)
  });
}

function executeAnimation(action, callback) {
  // Simple timing-based animation system
  const actionType = action.action ? action.action.type : action.type;
  const duration = getAnimationDuration(actionType);
  
  // TODO: Replace with your visual animations
  console.log(`Animating: ${actionType}`, action);
  
  // For now, just wait for the duration
  setTimeout(callback, duration);
}

function getAnimationDuration(type) {
  const durations = {
    'Assault': 1200,
    'Convert': 1000,
    'Reinforce': 800,
    'Construct': 1000,
    'Redistribute': 600,
    'Sanctuary': 1200,
    'Meteor': 1500,
    'Smite': 1000,
    'Bless': 800,
    'default': 600
  };
  
  return durations[type] || durations.default;
}

function notifyServerAnimationComplete() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    console.log('🎬 Notifying server: animations complete');
    socket.send(JSON.stringify({ type: 'animationComplete' }));
  } else {
    console.warn('⚠️ Cannot notify animation complete: socket not ready');
  }
}

let framesCol = '#2bff00ff';
let edgesStyle1 = '═║╔╗╚╝';
let edgesStyle2 = '─│┌┐└┘';
let edgesStyle3 = '━┃┏┓┗┛';
let edgesStyle4 = '▀▌▛▜▄▟';
let edgesStyle5 = '─│╭╮╰╯';
let edgesStyle6 = '═║✧◆◆✧';
let edgesStyle7 = '━┃✹✹✹✹';
let edgesStyle72 = '═║✹✹✹✹';
let edgesStyle8 = '─│☼☼☼☼';


function draw_border_ascii(x, y, w, h, background_fill){
    let style = edgesStyle1;
    let horiz = style[0];
    let vert = style[1];
    let tl = style[2];
    let tr = style[3];
    let bl = style[4];
    let br = style[5];

    push();
    fill(background_fill);
    rect(x, y, w, h);
    
    // Calculate character dimensions more precisely
    let charWidth = textWidth('═');
    let charHeight = textAscent() + textDescent();
    let charsHorizontal = Math.floor(w / charWidth);
    let charsVertical = Math.floor(h / charHeight);
    
    // Adjust spacing for better alignment
    let horizontalOffset = (w - (charsHorizontal * charWidth)) / 2;
    let verticalOffset = (h - (charsVertical * charHeight)) / 2;
    
    fill(framesCol);
    textAlign(LEFT, TOP);

    // Draw horizontal borders with proper spacing
    for (let i = 1; i < charsHorizontal - 1; i++){
        let xPos = x + horizontalOffset + i * charWidth ;
        text(horiz, xPos, y + verticalOffset);
        text(horiz, xPos, y + h - charHeight - verticalOffset);
    }

    // Draw continuous vertical borders
    let leftX = x + horizontalOffset;
    let rightX = x + w - charWidth - horizontalOffset;
    let startY = y + verticalOffset + charHeight;
    let endY = y + h - charHeight - verticalOffset;
    
    for (let yPos = startY; yPos < endY - 2; yPos += charHeight-1){
        text(vert, leftX, yPos);
        text(vert, rightX, yPos);
    }
    
    // Draw corners with precise positioning
    text(tl, x + horizontalOffset, y + verticalOffset);
    text(tr, x + w - charWidth - horizontalOffset, y + verticalOffset);
    text(bl, x + horizontalOffset, y + h - charHeight - verticalOffset);
    text(br, x + w - charWidth - horizontalOffset, y + h - charHeight - verticalOffset);
    
    textAlign(LEFT, BASELINE);
    pop();
}

// =============================================================================
// MAIN DRAW LOOP
// =============================================================================
function draw() {
  background(40);
  
  if (!gameState) {
    drawLoadingScreen();
    return;
  }
  
  // Draw the three main sections
  drawMessagesPanel();
  drawGamePanel();
  drawInfoPanel();
  drawControlsPanel();
  
  fill(255);
}

// =============================================================================
// PANEL DRAWING FUNCTIONS (Your customization points)
// =============================================================================
function drawMessagesPanel() {
  // Left panel: Messages and action log
  const panel = LAYOUT.messagesPanel;
  
  draw_border_ascii(panel.x, panel.y, panel.width, panel.height, 'red');
  console.log('dims:', panel.x, panel.y, panel.width, panel.height);
  
  push();
  translate(panel.x, panel.y);
  
  // Action log
  fill(255);
  text('Action Log:', 20, 30);
  
  let y = 50;
  for (let i = Math.max(0, actionLog.length - 15); i < actionLog.length; i++) {
    text(actionLog[i], 20, y);
    y += 18;
  }
  
  // Messages section
  y += 20;
  text('Messages:', 20, y);
  y += 20;
  
  for (let i = Math.max(0, messageLog.length - 5); i < messageLog.length; i++) {
    const msg = messageLog[i];
    fill(180, 180, 255); // Light blue for player name
    text(`${msg.player}:`, 20, y);
    fill(255);
    text(msg.text, 20, y + 15);
    y += 35;
  }
  
  pop();
  draw_border_ascii(panel.x, panel.y, panel.width, panel.height, 30);
}

function drawGamePanel() {
  // Center: Main game grid (9:9)
  const panel = LAYOUT.gamePanel;
  
  push();
  translate(panel.x, panel.y);
  
  // Background
  fill(20);
  rect(0, 0, panel.width, panel.height);
  
  if (gameState && gameState.grid) {
    drawGameGrid();
  }
  
  pop();
}

function drawGameGrid() {
  // This is where your main game visualization goes
  const gridSize = 10;
  const cellSize = LAYOUT.gamePanel.width / gridSize;
  
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = gameState.grid[y][x];
      
      // TODO: Replace with your tile visualization
      drawTile(x, y, tile, cellSize);
    }
  }
}

function drawTile(x, y, tile, cellSize) {
  // Basic tile drawing - customize this!
  const screenX = x * cellSize;
  const screenY = y * cellSize;
  
  // Background color based on owner
  if (tile.owner === 'A') {
    fill(100, 150, 255); // Blue
  } else if (tile.owner === 'B') {
    fill(255, 100, 100); // Red
  } else {
    fill(80, 80, 80); // Neutral gray
  }
  
  rect(screenX, screenY, cellSize, cellSize);
  
  // Border
  stroke(255);
  noFill();
  rect(screenX, screenY, cellSize, cellSize);
  
  // Troop count
  if (tile.troop_power > 0) {
    fill(255);
    textAlign(CENTER, CENTER);
    text(Math.floor(tile.troop_power), screenX + cellSize/2, screenY + cellSize/2);
  }
  
  noStroke();
  textAlign(LEFT);
}

function drawInfoPanel() {
  // Top-right: Faction info
  const panel = LAYOUT.rightPanel.infoSection;

  draw_border_ascii(panel.x, panel.y, panel.width, panel.height, 30);
  
  push();
  translate(panel.x, panel.y);
  
  // TODO: Draw faction stats, resources, turn info
  fill(255);
  text('Faction Info', 20, 30);
  
  if (gameState && gameState.factions) {
    let y = 60;
    for (const [name, faction] of Object.entries(gameState.factions)) {
      text(`${name}: ${faction.tiles} tiles`, 20, y);
      text(`R:${faction.resources.R.toFixed(0)} F:${faction.resources.F.toFixed(0)}`, 20, y + 20);
      y += 50;
    }
  }
  
  pop();
}

function drawControlsPanel() {
  // Bottom-right: Observer powers and controls
  const panel = LAYOUT.rightPanel.controlsSection;
  
  draw_border_ascii(panel.x, panel.y, panel.width, panel.height, 30);

  push();
  translate(panel.x, panel.y);
  
  // TODO: Draw observer power buttons
  fill(255);
  text('Observer Powers', 20, 30);
  
  // Pause/Resume button
  const pauseButton = { x: 20, y: 160, w: 100, h: 30 };
  fill(animationPaused ? 100 : 60);
  rect(pauseButton.x, pauseButton.y, pauseButton.w, pauseButton.h);
  fill(255);
  textAlign(CENTER, CENTER);
  text(animationPaused ? 'Resume' : 'Pause', pauseButton.x + pauseButton.w/2, pauseButton.y + pauseButton.h/2);
  textAlign(LEFT);
  
  // Example observer buttons
  drawObserverButtons();
  
  // Start Game button (if game not started)
  if (!gameState || gameState.gameStatus !== 'active') {
    const startButton = { x: 20, y: 200, w: 120, h: 40 };
    fill(gameState ? 60 : 100);
    rect(startButton.x, startButton.y, startButton.w, startButton.h);
    fill(255);
    textAlign(CENTER, CENTER);
    text('Start Game', startButton.x + startButton.w/2, startButton.y + startButton.h/2);
    textAlign(LEFT);
  }
  
  pop();
}

function drawObserverButtons() {
  const buttons = [
    { name: 'Smite', x: 20, y: 60, w: 80, h: 30 },
    { name: 'Bless', x: 120, y: 60, w: 80, h: 30 },
    { name: 'Meteor', x: 220, y: 60, w: 80, h: 30 },
    { name: 'Observe', x: 20, y: 110, w: 80, h: 30 },
    { name: 'Sanctify', x: 120, y: 110, w: 80, h: 30 },
    { name: 'Rend', x: 220, y: 110, w: 80, h: 30 }
  ];
  
  for (const button of buttons) {
    // Button background
    if (selectedObserverAction === button.name) {
      fill(100, 200, 100); // Green if selected
    } else {
      fill(60);
    }
    rect(button.x, button.y, button.w, button.h);
    
    // Button text
    fill(255);
    textAlign(CENTER, CENTER);
    text(button.name, button.x + button.w/2, button.y + button.h/2);
  }
  
  textAlign(LEFT);
}

// =============================================================================
// INPUT HANDLING
// =============================================================================
function mousePressed() {
  // Convert screen coordinates to panel coordinates
  const panelClick = getPanelClick(mouseX, mouseY);
  
  switch (panelClick.panel) {
    case 'controls':
      handleControlsClick(panelClick.x, panelClick.y);
      break;
      
    case 'game':
      handleGameClick(panelClick.x, panelClick.y);
      break;
      
    case 'messages':
      handleMessagesClick(panelClick.x, panelClick.y);
      break;
  }
}

function getPanelClick(screenX, screenY) {
  if (screenX >= LAYOUT.rightPanel.controlsSection.x) {
    return {
      panel: 'controls',
      x: screenX - LAYOUT.rightPanel.controlsSection.x,
      y: screenY - LAYOUT.rightPanel.controlsSection.y
    };
  } else if (screenX >= LAYOUT.gamePanel.x && screenX < LAYOUT.gamePanel.x + LAYOUT.gamePanel.width) {
    return {
      panel: 'game',
      x: screenX - LAYOUT.gamePanel.x,
      y: screenY - LAYOUT.gamePanel.y
    };
  } else {
    return {
      panel: 'messages',
      x: screenX - LAYOUT.messagesPanel.x,
      y: screenY - LAYOUT.messagesPanel.y
    };
  }
}

function handleControlsClick(x, y) {
  // Check start game button first (if game not active)
  if (!gameState || gameState.gameStatus !== 'active') {
    const startButton = { x: 20, y: 200, w: 120, h: 40 };
    if (x >= startButton.x && x <= startButton.x + startButton.w && 
        y >= startButton.y && y <= startButton.y + startButton.h) {
      startGame();
      return;
    }
  }
  
  // Check pause/resume button
  const pauseButton = { x: 20, y: 160, w: 100, h: 30 };
  if (x >= pauseButton.x && x <= pauseButton.x + pauseButton.w && 
      y >= pauseButton.y && y <= pauseButton.y + pauseButton.h) {
    togglePause();
    return;
  }
  
  // Check observer button clicks
  const buttons = [
    { name: 'Smite', x: 20, y: 60, w: 80, h: 30 },
    { name: 'Bless', x: 120, y: 60, w: 80, h: 30 },
    { name: 'Meteor', x: 220, y: 60, w: 80, h: 30 },
    { name: 'Observe', x: 20, y: 110, w: 80, h: 30 },
    { name: 'Sanctify', x: 120, y: 110, w: 80, h: 30 },
    { name: 'Rend', x: 220, y: 110, w: 80, h: 30 }
  ];
  
  for (const button of buttons) {
    if (x >= button.x && x <= button.x + button.w && 
        y >= button.y && y <= button.y + button.h) {
      selectedObserverAction = button.name;
      console.log(`Selected observer action: ${button.name}`);
      break;
    }
  }
}

function handleGameClick(x, y) {
  if (!selectedObserverAction) return;
  
  // Convert game panel coordinates to grid coordinates
  const cellSize = LAYOUT.gamePanel.width / 10;
  const gridX = Math.floor(x / cellSize);
  const gridY = Math.floor(y / cellSize);
  
  if (gridX >= 0 && gridX < 10 && gridY >= 0 && gridY < 10) {
    executeObserverAction(selectedObserverAction, gridX, gridY);
    selectedObserverAction = null; // Clear selection after use
  }
}

function handleMessagesClick(x, y) {
  // TODO: Handle message panel interactions
  console.log('Messages panel clicked', x, y);
}

// =============================================================================
// OBSERVER ACTIONS
// =============================================================================
function executeObserverAction(action, x, y) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.log('Cannot execute action: not connected');
    return;
  }
  
  const message = {
    type: 'observerAction',
    action: {
      type: action,
      parameters: { x: x, y: y }
    }
  };
  
  socket.send(JSON.stringify(message));
  console.log(`Executed ${action} at (${x}, ${y})`);
}

// =============================================================================
// PAUSE/RESUME FUNCTIONALITY
// =============================================================================
function togglePause() {
  animationPaused = !animationPaused;
  console.log(animationPaused ? '⏸ Game paused' : '▶ Game resumed');
  
  // Send pause action to server - this will cancel any ongoing AI generation
  // and treat pause like an observer action
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'observerAction',
      action: {
        type: animationPaused ? 'Pause' : 'Resume',
        parameters: {}
      }
    }));
  }
  
  if (!animationPaused) {
    // Resume - process animation queue and notify server if queue is empty
    processAnimationQueue();
    
    // If queue was already empty when we resumed, notify server
    if (animationQueue.length === 0 && !isAnimating) {
      notifyServerAnimationComplete();
    }
  }
}

function keyPressed() {
  // Spacebar to toggle pause
  if (key === ' ') {
    togglePause();
  }
}

function startGame() {
  console.log('🎮 Starting new game...');
  
  // Default agent configuration with new personality system
  const agentConfig = [
    { name: 'Faction A', personality: 'zealot' },
    { name: 'Faction B', personality: 'skeptic' }
  ];
  
  fetch('/api/game/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ agents: agentConfig })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('✅ Game started successfully:', data);
      // Reset animation state
      isAnimating = false;
      animationPaused = false;
      animationQueue = [];
      actionLog = [];
      messageLog = [];
    } else {
      console.error('❌ Error starting game:', data.message);
    }
  })
  .catch(error => {
    console.error('❌ Failed to start game:', error);
  });
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================
function drawLayoutBorders() {
  // Debug: Draw panel borders
  stroke('green');
  strokeWeight(2);
  noFill();
  
  // Messages panel
  rect(LAYOUT.messagesPanel.x, LAYOUT.messagesPanel.y, 
       LAYOUT.messagesPanel.width, LAYOUT.messagesPanel.height);
  
  // Game panel
  rect(LAYOUT.gamePanel.x, LAYOUT.gamePanel.y,
       LAYOUT.gamePanel.width, LAYOUT.gamePanel.height);
  
  // Right panel sections
  rect(LAYOUT.rightPanel.infoSection.x, LAYOUT.rightPanel.infoSection.y,
       LAYOUT.rightPanel.infoSection.width, LAYOUT.rightPanel.infoSection.height);
  
  rect(LAYOUT.rightPanel.controlsSection.x, LAYOUT.rightPanel.controlsSection.y,
       LAYOUT.rightPanel.controlsSection.width, LAYOUT.rightPanel.controlsSection.height);
  
  noStroke();
}

function drawLoadingScreen() {
  fill(255);
  textAlign(CENTER, CENTER);
  text('Connecting to game...', width/2, height/2);
  textAlign(LEFT);
}

function handleGameEnd(data) {
  console.log('Game ended:', data);
  // TODO: Show victory screen
}

// =============================================================================
// P5.js REQUIRED FUNCTIONS
// =============================================================================
// setup() and draw() are defined above
// mousePressed() is defined above