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

let agents_color_map = {'A':'#0051ffff', 'B': '#ff0004ff', 'C': '#00ff95ff', 'D': '#f50cfdff'};

// =============================================================================
// LAYOUT DIMENSIONS (16:9 format)
// =============================================================================
let total_width = 2000;
let total_height = 2000 * 9 / 16;
const LAYOUT = {
  totalWidth: total_width,
  totalHeight: total_height,
  
  // Left panel: Messages/Actions (3:9 ratio)
  messagesPanel: {
    x: 0,
    y: 0,
    width: total_width * 3 / 16,
    height: total_height
  },
  
  // Center: Game grid (9:9 ratio)
  gamePanel: {
    x: total_width * 3.25 / 16,
    y: total_height * 1 / 16,
    width: total_width * 9 / 16,
    height: total_height * 15 / 16
  },

  titlePanel:{
    x: total_width * 3 / 16,
    y: 0,
    width: total_width * 9 / 16,
    height: total_height * 1 / 16
  },
  
  // Right panel: Info & Controls (4:9 ratio)
  rightPanel: {
    x: total_width * 12 / 16,
    y: 0,
    width: total_width * 4 / 16,
    height: total_height,
    
    // Split into top (info) and bottom (observer controls)
    infoSection: {
      x: total_width * 12 / 16,
      y: 0,
      width: total_width * 4 / 16,
      height: total_height / 2
    },
    
    controlsSection: {
      x: total_width * 12 / 16,
      y: total_height / 2,
      width: total_width * 4 / 16,
      height: total_height / 2
    }
  }
};

let lines_font;
let text_font;
let font_size = total_height / 50;

function preload(){
    text_font = loadFont('Glass_TTY_VT220.ttf');
    lines_font = loadFont('inconsolata.regular.ttf');
}

// =============================================================================
// CORE SETUP
// =============================================================================
function setup() {
  createCanvas(LAYOUT.totalWidth, LAYOUT.totalHeight);
  connectToServer();
  //textFont(font);
  textSize(font_size);
  background('#533131ff');

  
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
  console.log('📨 Full message object:', message);
  
  switch (message.type) {
    case 'gameState':
      console.log('🎮 Game state updated');
      gameState = message.data;
      break;
      
    case 'actionsExecuted':
      console.log('🎬 Processing actionsExecuted:', message.data);
      
      // Add actions to animation queue
      if (message.data.actions && Array.isArray(message.data.actions)) {
        console.log(`📋 Found ${message.data.actions.length} actions to process`);
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
      console.log('🎮 Game started, initial state:', message.data);
      gameState = message.data;
      actionLog.push('Game started!');
      // Check if the game engine should start processing turns automatically
      console.log('🔄 Waiting for first turn actions...');
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
    'Move': 1200,
    'Convert': 1000,
    'Reinforce': 800,
    'Construct': 1000,
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

function draw_panel_bg(x, y, w, h){
  let horiz_slices_size = 30;
  let slices_count = h / horiz_slices_size;
  noStroke();
  for (let i = 0; i < slices_count; i++){
   if (i % 2 == 0){
       col = '#000000ff';
   } else {
       col = '#080c08ff';
   }
    fill(col);
    rect(x, y + i * horiz_slices_size, w, horiz_slices_size);
  }
}


function draw_border_ascii(x, y, w, h, style = '=I****', color = null, do_bg = true, size = font_size){
    let horiz = style[0];
    let vert = style[1];
    let tl = style[2];
    let tr = style[3];
    let bl = style[4];
    let br = style[5];

    textSize(size);

    push();
    if (do_bg){
      draw_panel_bg(x, y, w, h);
    }
    textFont();

    // Calculate character dimensions more precisely
    let charWidth = textWidth('═');
    let charHeight = textAscent() + textDescent();
    let charsHorizontal = Math.floor(w / charWidth);
    let charsVertical = Math.floor(h / charHeight);
    
    // Adjust spacing for better alignment
    let horizontalOffset = (w - (charsHorizontal * charWidth)) / 2;
    let verticalOffset = (h - (charsVertical * charHeight)) / 2;
    
    fill(color || framesCol);
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
    textFont(text_font); 
}

// =============================================================================
// MAIN DRAW LOOP
// =============================================================================
function draw() {
  background('#572929ff');
  
  if (!gameState) {
    drawLoadingScreen();
    return;
  }
  
  // Draw the three main sections
  drawMessagesPanel();
  drawInfoPanel();
  drawControlsPanel();
  drawTitlePanel();
  drawGamePanel();
  
  fill(255);
}

function drawTitlePanel() {

  draw_panel_bg(LAYOUT.titlePanel.x, LAYOUT.titlePanel.y, LAYOUT.titlePanel.width, LAYOUT.titlePanel.height);
  draw_border_ascii(LAYOUT.titlePanel.x, LAYOUT.titlePanel.y, LAYOUT.titlePanel.width, LAYOUT.titlePanel.height);
  fill(255);
  textAlign(CENTER, CENTER);
  text('God terminal   v1.04 (insider build)  (c) Heaven corp.', LAYOUT.titlePanel.x + LAYOUT.titlePanel.width / 2, LAYOUT.titlePanel.y + 30);
  textAlign(LEFT);
}

function drawMessagesPanel() {
  // Left panel: Messages and action log
  const panel = LAYOUT.messagesPanel;
  
  draw_border_ascii(panel.x, panel.y, panel.width, panel.height);
  
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
}

function drawGamePanel() {
  // Center: Main game grid (9:9)
  const panel = LAYOUT.gamePanel;
  
  push();
  translate(panel.x, panel.y);
  
  draw_border_ascii(-LAYOUT.totalWidth * 0.25/16, -9, panel.width, panel.height);
  
  if (gameState && gameState.grid) {
    drawGameGrid();
  }
  
  pop();
}

function drawGameGrid() {
  // This is where your main game visualization goes
  const gridSize = gameState.grid.length;
  const cellSize = (LAYOUT.gamePanel.height * 0.95) / gridSize;
  
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
  const screenX = x * cellSize + LAYOUT.totalWidth * 0.125/16;
  const screenY = y * cellSize + LAYOUT.totalHeight * 0.1/9;

  let agent_letter = tile.owner ? tile.owner[tile.owner.length -1] : null;
  let agent_color = agents_color_map[agent_letter] || '#b4b4b4ff';

  let bg_char = '';
  //fill bg with bg char tiled
  for (let yPos = screenY + textAscent(); yPos < screenY + cellSize - textAscent(); yPos += textAscent()) {
    for (let xPos = screenX + textWidth(bg_char); xPos < screenX + cellSize - textWidth(bg_char); xPos += textWidth(bg_char)) {
      fill('#2c231aff');
      text(bg_char, xPos, yPos);
    }
  }
  
  fill(agent_color);
  draw_border_ascii(screenX, screenY, cellSize, cellSize * 1.05, '~|****', agent_color, false, font_size * 0.75);
    
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

  draw_border_ascii(panel.x, panel.y, panel.width, panel.height);
  
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
  
  draw_border_ascii(panel.x, panel.y, panel.width, panel.height);

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
      
      // Send ready signal to start turn processing
      if (socket && socket.readyState === WebSocket.OPEN) {
        console.log('🎬 Sending animation complete to start game flow');
        socket.send(JSON.stringify({ type: 'animationComplete' }));
      }
    } else {
      console.error('❌ Error starting game:', data.message);
    }
  })
  .catch(error => {
    console.error('❌ Failed to start game:', error);
  });
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