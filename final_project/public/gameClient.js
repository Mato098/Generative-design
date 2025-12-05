// Game visualization and client logic - Updated API Key Fix
let gameState = null;
let animationQueue = [];
let ws = null;
let isAnimating = false;
let animationPaused = false;
let actionLog = []; // Recent actions
let messageLog = []; // Agent messages
const MAX_LOG_ENTRIES = 10;

// Animation timing constants (milliseconds)
const ANIMATION_TIMINGS = {
  'Reinforce': 800,
  'ProjectPressure': 600,
  'Assault': 1200,
  'Convert': 1000,
  'Construct': 900,
  'Redistribute': 400,
  'Repair': 700,
  'Scorch': 800,
  'Smite': 1000,
  'Bless': 800,
  'Sanctify': 1200,
  'Rend': 900,
  'Meteor': 1500,
  'default': 600
};

// Faction colors
const FACTION_COLORS = {
  'Neutral': [100, 100, 100],
  'Faction A': [220, 50, 50],
  'Faction B': [50, 50, 220],
  'Faction C': [50, 220, 50],
  'Faction D': [220, 220, 50]
};

// Tile size and spacing
const TILE_SIZE = 45;
const GRID_OFFSET_X = 50;
const GRID_OFFSET_Y = 50;

// P5.js sketch
function setup() {
  const canvas = createCanvas(1200, 600);
  canvas.parent('game-canvas');
  
  // Connect to WebSocket
  connectWebSocket();
  
  // Request initial game state
  fetchGameState();
}

function draw() {
  background(30);
  
  // Clear buttons at start of frame
  buttons = [];
  
  if (gameState) {
    drawGrid();
    drawUI();
  } else {
    // Loading state
    textAlign(CENTER, CENTER);
    fill(255);
    textSize(24);
    text('Loading game state...', width/2, height/2);
  }
}

function drawGrid() {
  stroke(80);
  strokeWeight(1);
  
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      const tile = gameState.grid[y][x];
      const screenX = GRID_OFFSET_X + x * TILE_SIZE;
      const screenY = GRID_OFFSET_Y + y * TILE_SIZE;
      
      // Tile background color based on owner
      const ownerColor = FACTION_COLORS[tile.owner] || FACTION_COLORS['Neutral'];
      fill(ownerColor[0], ownerColor[1], ownerColor[2]);
      rect(screenX, screenY, TILE_SIZE, TILE_SIZE);
      
      // Tile type indicator
      drawTileType(tile, screenX, screenY);
      
      // Building indicator
      if (tile.building !== 'none') {
        drawBuilding(tile.building, screenX, screenY);
      }
      
      // Troop power indicator
      if (tile.troop_power > 0) {
        drawTroopPower(tile.troop_power, screenX, screenY);
      }
      
      // Coordinates
      fill(200);
      textAlign(LEFT, TOP);
      textSize(8);
      text(`${x},${y}`, screenX + 2, screenY + 2);
    }
  }
}

function drawTileType(tile, x, y) {
  const typeColors = {
    'plains': [139, 121, 94],
    'forest': [34, 139, 34],
    'hill': [160, 82, 45],
    'ruin': [128, 128, 128],
    'sacred': [255, 215, 0]
  };
  
  const color = typeColors[tile.type] || typeColors['plains'];
  fill(color[0], color[1], color[2], 100);
  noStroke();
  rect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
}

function drawBuilding(building, x, y) {
  const buildingSymbols = {
    'Shrine': '⛩',
    'Idol': '🗿',
    'Training': '🏛',
    'Market': '🏪',
    'Tower': '🗼',
    'Fortress': '🏰'
  };
  
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(16);
  text(buildingSymbols[building] || '■', x + TILE_SIZE/2, y + TILE_SIZE/2);
}

function drawTroopPower(troopPower, x, y) {
  fill(255, 100, 100);
  textAlign(RIGHT, BOTTOM);
  textSize(10);
  text(troopPower.toFixed(0), x + TILE_SIZE - 2, y + TILE_SIZE - 2);
}

function drawUI() {
  const panelX = 520;
  const panelWidth = 680;
  
  // Panel background
  fill(20, 20, 30);
  noStroke();
  rect(panelX, 0, panelWidth, height);
  
  let yPos = 20;
  
  // Title
  fill(200, 200, 255);
  textAlign(LEFT, TOP);
  textSize(18);
  text('Game Status', panelX + 10, yPos);
  yPos += 30;
  
  // Turn info
  if (gameState) {
    fill(255);
    textSize(14);
    text(`Turn: ${gameState.turnNumber}`, panelX + 10, yPos);
    yPos += 25;
    
    // Resources for each faction
    fill(220, 220, 255);
    textSize(16);
    text('Faction Resources:', panelX + 10, yPos);
    yPos += 25;
    
    for (const [name, faction] of Object.entries(gameState.factions)) {
      const color = FACTION_COLORS[name] || [200, 200, 200];
      fill(color[0], color[1], color[2]);
      textSize(12);
      const tiles = gameState.grid.flat().filter(t => t.owner === name).length;
      text(`${name}: ${tiles} tiles`, panelX + 10, yPos);
      
      fill(255);
      text(`R:${faction.resources.R.toFixed(0)} F:${faction.resources.F.toFixed(0)} I:${faction.resources.I.toFixed(0)}`,
           panelX + 150, yPos);
      yPos += 20;
    }
    
    yPos += 10;
  }
  
  // Animation status
  fill(255, 255, 100);
  textSize(12);
  if (isAnimating && animationQueue.length > 0) {
    text(`▶ Animating: ${animationQueue[0].action?.type || 'action'}`, panelX + 10, yPos);
  } else if (animationPaused) {
    text('⏸ PAUSED', panelX + 10, yPos);
  } else {
    text('✓ Ready', panelX + 10, yPos);
  }
  text(`Queue: ${animationQueue.length}`, panelX + 200, yPos);
  yPos += 25;
  
  // Pause button
  drawButton(animationPaused ? 'Resume' : 'Pause', panelX + 10, yPos, 120, 30, () => {
    togglePause();
  });
  yPos += 45;
  
  // Recent Messages
  fill(200, 255, 200);
  textSize(14);
  text('Agent Messages:', panelX + 10, yPos);
  yPos += 20;
  
  fill(200);
  textSize(10);
  for (let i = Math.max(0, messageLog.length - 5); i < messageLog.length; i++) {
    const msg = messageLog[i];
    fill(150, 255, 150);
    text(`${msg.player}:`, panelX + 10, yPos);
    yPos += 12;
    fill(220);
    const wrapped = wrapText(msg.text, 60);
    for (const line of wrapped) {
      text(line, panelX + 20, yPos);
      yPos += 12;
    }
    yPos += 5;
  }
  
  yPos += 10;
  
  // Recent Actions
  fill(255, 200, 200);
  textSize(14);
  text('Recent Actions:', panelX + 10, yPos);
  yPos += 20;
  
  fill(200);
  textSize(10);
  for (let i = Math.max(0, actionLog.length - 8); i < actionLog.length; i++) {
    text(actionLog[i], panelX + 10, yPos);
    yPos += 12;
  }
}

function wrapText(txt, maxLen) {
  const words = txt.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if ((current + word).length > maxLen) {
      if (current) lines.push(current.trim());
      current = word + ' ';
    } else {
      current += word + ' ';
    }
  }
  if (current) lines.push(current.trim());
  return lines;
}

let buttons = [];
function drawButton(label, x, y, w, h, callback) {
  // Check hover
  const isHover = mouseX >= x && mouseX <= x + w && mouseY >= y && mouseY <= y + h;
  
  // Draw button
  fill(isHover ? 80 : 50);
  stroke(150);
  strokeWeight(2);
  rect(x, y, w, h, 5);
  
  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(12);
  text(label, x + w/2, y + h/2);
  
  // Store for click handling
  buttons.push({ x, y, w, h, callback });
}

function mousePressed() {
  // First check if we clicked a button
  for (const btn of buttons) {
    if (mouseX >= btn.x && mouseX <= btn.x + btn.w && 
        mouseY >= btn.y && mouseY <= btn.y + btn.h) {
      btn.callback();
      return; // Don't process tile click if we clicked a button
    }
  }
  
  // Then check tile inspection (only if no button was clicked)
  if (!gameState) return;
  
  const gridX = Math.floor((mouseX - GRID_OFFSET_X) / TILE_SIZE);
  const gridY = Math.floor((mouseY - GRID_OFFSET_Y) / TILE_SIZE);
  
  if (gridX >= 0 && gridX < 10 && gridY >= 0 && gridY < 10) {
    const tile = gameState.grid[gridY][gridX];
    const info = `Tile (${gridX},${gridY}):
Owner: ${tile.owner}
Type: ${tile.type}
Troops: ${tile.troop_power.toFixed(1)}
Building: ${tile.building}
Resource Value: ${tile.resource_value}`;
    
    // Could show this in a tooltip or info panel
    console.log(info);
  }
}

// WebSocket connection
function connectWebSocket() {
  ws = new WebSocket('ws://localhost:3000');
  
  ws.onopen = function() {
    updateConnectionStatus('Connected');
  };
  
  ws.onmessage = function(event) {
    const message = JSON.parse(event.data);
    handleServerMessage(message);
  };
  
  ws.onclose = function() {
    updateConnectionStatus('Disconnected');
    // Attempt to reconnect after 3 seconds
    setTimeout(connectWebSocket, 3000);
  };
  
  ws.onerror = function(error) {
    updateConnectionStatus('Error');
  };
}

function handleServerMessage(message) {
  switch (message.type) {
    case 'gameState':
      gameState = message.data;
      updateUI();
      break;
      
    case 'actionsExecuted':
      // Add actions to animation queue
      for (const action of message.data.actions) {
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
      gameState = message.data.newGameState;
      processAnimationQueue();
      break;
      
    case 'observerTurnStarted':
      gameState = message.data.gameState;
      showObserverTurn();
      updateUI();
      break;
      
    case 'gameStarted':
      gameState = message.data;
      updateUI();
      logAction('Game started!');
      break;
      
    case 'gameEnded':
      logAction(`Game ended! Winner: ${message.data.winner} (${message.data.type} victory)`);
      alert(`Game Over! ${message.data.winner} wins by ${message.data.type}!`);
      break;
      
    case 'error':
      // Error logged on server, just show user-friendly message
      break;
  }
}

// Animation processing
function processAnimationQueue() {
  console.log(`🎞️ processAnimationQueue: animating=${isAnimating}, queue=${animationQueue.length}, paused=${animationPaused}`);
  
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
      notifyAnimationComplete();
    }
    return;
  }
  
  isAnimating = true;
  const action = animationQueue.shift();
  
  // Animate the action
  animateAction(action);
  
  // Schedule next animation
  const duration = ANIMATION_TIMINGS[action.action?.type] || ANIMATION_TIMINGS['default'];
  setTimeout(() => {
    isAnimating = false;
    processAnimationQueue(); // Process next action (will check pause state again)
  }, duration);
}

function notifyAnimationComplete() {
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log('🎬 Notifying server: animations complete');
    ws.send(JSON.stringify({
      type: 'animationComplete'
    }));
  } else {
    console.warn('⚠️ Cannot notify animation complete: socket not ready');
  }
}

function animateAction(action) {
  logAction(`Animating ${action.action.type}: ${JSON.stringify(action.action.parameters)}`);
  
  // Visual effects based on action type
  switch (action.action.type) {
    case 'Assault':
      animateAssault(action);
      break;
    case 'Convert':
      animateConvert(action);
      break;
    case 'Construct':
      animateBuild(action);
      break;
    case 'Smite':
      animateSmite(action);
      break;
    case 'Meteor':
      animateMeteor(action);
      break;
    // Add more animation types as needed
  }
}

function animateAssault(action) {
  // Flash effect for combat
  const fromX = GRID_OFFSET_X + action.action.parameters.fromX * TILE_SIZE;
  const fromY = GRID_OFFSET_Y + action.action.parameters.fromY * TILE_SIZE;
  const toX = GRID_OFFSET_X + action.action.parameters.targetX * TILE_SIZE;
  const toY = GRID_OFFSET_Y + action.action.parameters.targetY * TILE_SIZE;
  
  // Visual attack line (simplified - in a full implementation you'd use proper animation)
}

function animateConvert(action) {
  // Conversion attempt animation
}

function animateBuild(action) {
  // Building construction animation
}

function animateSmite(action) {
  // Divine smite animation
}

function animateMeteor(action) {
  // Meteor strike animation
}

// UI Functions
function updateUI() {
  if (!gameState) return;
  
  // Update status display
  document.getElementById('turn-info').textContent = `Turn: ${gameState.turnNumber}`;
  document.getElementById('current-player').textContent = `Current: ${gameState.currentPlayer}`;
  document.getElementById('game-status').textContent = `Status: ${gameState.gameStatus}`;
  
  // Update faction display
  updateFactionDisplay();
  
  // Show/hide observer controls
  const observerIndicator = document.getElementById('observer-turn-indicator');
  if (gameState.currentPlayer === 'Observer') {
    observerIndicator.style.display = 'block';
  } else {
    observerIndicator.style.display = 'none';
  }
}

function updateFactionDisplay() {
  const display = document.getElementById('faction-display');
  let html = '<h3>Factions</h3>';
  
  for (const [name, faction] of Object.entries(gameState.factions || {})) {
    const color = FACTION_COLORS[name] || FACTION_COLORS['Neutral'];
    html += `<div style="border-left-color: rgb(${color[0]}, ${color[1]}, ${color[2]})">`;
    html += `<strong>${name}</strong><br>`;
    html += `R: ${faction.resources.R.toFixed(1)} `;
    html += `F: ${faction.resources.F.toFixed(1)} `;
    html += `I: ${faction.resources.I.toFixed(1)}<br>`;
    if (faction.personality) {
      html += `<em>${faction.personality}</em>`;
    }
    html += '</div>';
  }
  
  display.innerHTML = html;
}

function updateConnectionStatus(status) {
  // Could add a connection indicator to the UI
}

function logAction(message) {
  const logContent = document.getElementById('log-content');
  const timestamp = new Date().toLocaleTimeString();
  logContent.innerHTML += `<div>[${timestamp}] ${message}</div>`;
  logContent.scrollTop = logContent.scrollHeight;
}

// Control functions
function startGame() {
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
      logAction('Game start requested');
    } else {
      logAction('Failed to start game: ' + data.error);
    }
  });
}

function togglePause() {
  animationPaused = !animationPaused;
  console.log(animationPaused ? '⏸ Game paused' : '▶ Game resumed');
  
  if (!animationPaused) {
    // Resume - process queue and notify server if animations are done
    processAnimationQueue();
    
    // If queue was already empty when we resumed, notify server
    if (animationQueue.length === 0 && !isAnimating) {
      notifyAnimationComplete();
    }
  }
}

function executeGodPower(power) {
  const x = parseInt(document.getElementById('god-x').value);
  const y = parseInt(document.getElementById('god-y').value);
  const reason = document.getElementById('god-reason').value || 'Divine will';
  
  if (isNaN(x) || isNaN(y) || x < 0 || x > 9 || y < 0 || y > 9) {
    alert('Please enter valid coordinates (0-9)');
    return;
  }
  
  const action = {
    type: power,
    parameters: { x, y, reason }
  };
  
  sendObserverAction(action);
}

function executeMeteor() {
  const x = parseInt(document.getElementById('meteor-x').value);
  const y = parseInt(document.getElementById('meteor-y').value);
  const reason = document.getElementById('god-reason').value || 'Divine wrath';
  
  if (isNaN(x) || isNaN(y) || x < 1 || x > 8 || y < 1 || y > 8) {
    alert('Please enter valid meteor coordinates (1-8)');
    return;
  }
  
  const action = {
    type: 'meteor',
    parameters: { centerX: x, centerY: y, reason }
  };
  
  sendObserverAction(action);
}

function executeObserve() {
  const commentary = document.getElementById('observe-comment').value.trim();
  
  // Don't send empty observe actions
  if (!commentary) {
    logAction('Empty observe command - no divine intervention sent');
    return;
  }
  
  const action = {
    type: 'observe',
    parameters: { commentary }
  };
  
  sendObserverAction(action);
}

function sendObserverAction(action) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'observerAction',
      action: action
    }));
    
    // Clear inputs
    document.getElementById('god-x').value = '';
    document.getElementById('god-y').value = '';
    document.getElementById('god-reason').value = '';
    document.getElementById('meteor-x').value = '';
    document.getElementById('meteor-y').value = '';
    document.getElementById('observe-comment').value = '';
  } else {
    alert('Not connected to server');
  }
}

function showObserverTurn() {
  logAction('Observer turn started - Divine intervention awaited!');
}

// Initial game state fetch
function fetchGameState() {
  fetch('/api/game/state')
    .then(response => response.json())
    .then(data => {
      gameState = data;
      updateUI();
    })
    .catch(error => {
      logAction('Failed to fetch game state');
    });
}