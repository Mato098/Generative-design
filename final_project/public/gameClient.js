// Game visualization and client logic - Updated API Key Fix
let gameState = null;
let animationQueue = [];
let ws = null;
let isAnimating = false;
let animationPaused = false;

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
  const canvas = createCanvas(600, 600);
  canvas.parent('game-canvas');
  
  // Connect to WebSocket
  connectWebSocket();
  
  // Request initial game state
  fetchGameState();
}

function draw() {
  background(30);
  
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
      
      // Stability indicator
      drawStability(tile.stability, screenX, screenY);
      
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

function drawStability(stability, x, y) {
  // Stability bar
  const barWidth = TILE_SIZE - 6;
  const barHeight = 3;
  const stabilityRatio = stability / 10;
  
  // Background
  fill(50);
  rect(x + 3, y + TILE_SIZE - 8, barWidth, barHeight);
  
  // Stability level
  fill(255 * (1 - stabilityRatio), 255 * stabilityRatio, 0);
  rect(x + 3, y + TILE_SIZE - 8, barWidth * stabilityRatio, barHeight);
}

function drawUI() {
  // Current action animation indicator
  if (isAnimating && animationQueue.length > 0) {
    fill(255, 255, 0);
    textAlign(LEFT, TOP);
    textSize(14);
    text(`Animating: ${animationQueue[0].type}`, 10, height - 30);
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
      }
      gameState = message.data.newGameState;
      processAnimationQueue();
      logAction(`${message.data.player} executed ${message.data.actions.length} action(s)`);
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
  if (isAnimating || animationQueue.length === 0 || animationPaused) {
    return;
  }
  
  isAnimating = true;
  const action = animationQueue.shift();
  
  // Animate the action
  animateAction(action);
  
  // Schedule next animation
  const duration = ANIMATION_TIMINGS[action.type] || ANIMATION_TIMINGS['default'];
  setTimeout(() => {
    isAnimating = false;
    processAnimationQueue(); // Process next action
  }, duration);
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

function pauseAnimations() {
  animationPaused = !animationPaused;
  if (!animationPaused) {
    processAnimationQueue();
  }
  logAction(animationPaused ? 'Animations paused' : 'Animations resumed');
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

// Handle mouse clicks for tile inspection
function mousePressed() {
  if (!gameState) return;
  
  const gridX = Math.floor((mouseX - GRID_OFFSET_X) / TILE_SIZE);
  const gridY = Math.floor((mouseY - GRID_OFFSET_Y) / TILE_SIZE);
  
  if (gridX >= 0 && gridX < 10 && gridY >= 0 && gridY < 10) {
    const tile = gameState.grid[gridY][gridX];
    const info = `Tile (${gridX},${gridY}):
Owner: ${tile.owner}
Type: ${tile.type}
Troops: ${tile.troop_power.toFixed(1)}
Stability: ${tile.stability.toFixed(1)}
Building: ${tile.building}
Resource Value: ${tile.resource_value}`;
    
    // Could show this in a tooltip or info panel
    logAction(`Tile inspection: ${info.replace(/\n/g, ' | ')}`);
  }
}