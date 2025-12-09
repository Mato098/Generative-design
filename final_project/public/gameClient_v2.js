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
let currentAnimation = null;
let animationReservedTiles = new Set(); // Tiles currently being animated
let pendingGameState = null; // Game state to apply after animations complete
const MAX_LOG_ENTRIES = 10;

let tileRealLocations = new Map(); // Map tile keys to real pixel locations

// Tile caching for performance
let tileCache = new Map(); // Cache rendered tiles
let gameStateSnapshot = null; // Snapshot of game state before animations
let isAnimationSequenceActive = false; // Track if we're in animation sequence
let cacheClearPending = false; // Flag to clear cache on next frame start

// Panel caching for performance
let messagesPanelCache = null;
let messagesPanelCacheInvalid = true;

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

import { animateMove, animateConvert, drawTiles_Convert, drawMovingTiles as drawMovingTiles_Move, getAnimationInfo } from './tileAnimations.js';

// =============================================================================
// LAYOUT DIMENSIONS (16:9 format)
// =============================================================================
let total_width = 1500;
let total_height = total_width * 9 / 16;
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

  // Export globals for animation module after everything is initialized
  window.LAYOUT = LAYOUT;
  window.tileCache = tileCache;
  window.agents_color_map = agents_color_map;
  window.text_font = text_font;
  window.font_size = font_size;
  window.renderTileToBuffer = renderTileToBuffer;
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
  const msgStart = performance.now();
  console.log('📨 Received server message:', message.type, message.data);
  console.log('📨 Full message object:', message);
  
  switch (message.type) {
    case 'gameState':
      console.log('🎮 Game state updated');
      gameState = message.data;
      //tileCache.clear(); // Clear cache for new state
      //console.log('🧹 Cleared tile cache for new game state');
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
      
      // Store new game state and snapshot current state before animations
      if (message.data.newGameState) {
        if (!isAnimationSequenceActive) {
          // Skip expensive deep cloning - we don't actually need the snapshot
          // gameStateSnapshot = JSON.parse(JSON.stringify(gameState));
          isAnimationSequenceActive = true;
          console.log('📸 Started animation sequence (skipped expensive snapshot)');
        }
        pendingGameState = message.data.newGameState;
        console.log('📦 Stored pending game state for after animations');
      }
      messagesPanelCacheInvalid = true;
      processAnimationQueue();
      break;
      
    case 'gameStarted':
      console.log('🎮 Game started, initial state:', message.data);
      gameState = message.data;
      tileCache.clear(); // Clear cache for initial state
      console.log('🧹 Cleared tile cache for game start');
      actionLog.push('Game started!');
      
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
  
  const msgEnd = performance.now();
  console.log(`⏱️ Message handling took ${(msgEnd - msgStart).toFixed(2)}ms`);
}

// =============================================================================
// ANIMATION SYSTEM
// =============================================================================
// Global state tracking to reduce console spam
let lastProcessQueueLoggedState = '';

function processAnimationQueue() {
  const queueStart = performance.now();
  // Only log when actually changing state, not on every frame
  const currentState = `${isAnimating}-${animationQueue.length}-${animationPaused}`;
  
  if (currentState !== lastProcessQueueLoggedState) {
    console.log(`🎞️ processAnimationQueue: animating=${isAnimating}, queue=${animationQueue.length}, paused=${animationPaused}`);
    console.log(`📋 Queue contents:`, animationQueue.map(a => a.action ? a.action.type : 'unknown'));
    lastProcessQueueLoggedState = currentState;
  }
  
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
  
  const queueEnd = performance.now();
  if ((queueEnd - queueStart) > 1) {
    console.log(`⏱️ processAnimationQueue took ${(queueEnd - queueStart).toFixed(2)}ms`);
  }
}

function executeAnimation(action, callback) {
  // Simple timing-based animation system
  const actionType = action.action ? action.action.type : action.type;
  const duration = getAnimationDuration(actionType);

  switch (actionType) {
    case 'Move':
      currentAnimation = 'Move';
      // Reserve tiles for animation
      const fromKey = `${action.action.parameters.fromX}-${action.action.parameters.fromY}`;
      const toKey = `${action.action.parameters.toX}-${action.action.parameters.toY}`;
      animationReservedTiles.add(fromKey);
      animationReservedTiles.add(toKey);

      animateMove(action, duration, () => {
        // Clear reserved tiles when animation completes
        animationReservedTiles.delete(fromKey);
        animationReservedTiles.delete(toKey);
        callback();
      });
      break;
    case 'Convert':
      currentAnimation = 'Convert';
      const key = `${action.action.parameters.x}-${action.action.parameters.y}`;
      animationReservedTiles.add(key);
      animateConvert(action, duration, () => {
        animationReservedTiles.delete(key);
        callback();
      });
      break;
    default:
      console.log(`ACTION ANIM NOT IMPLEMENTED: ${actionType}, defaulting to wait`);
      currentAnimation = 'default';
      setTimeout(callback, duration);
      break;
  }
}

function getAnimationDuration(type) {
  const durations = {
    'Move': 1200,
    'Convert': 2000,
    'Reinforce': 800,
    'Construct': 1000,
    'Sanctuary': 1200,
    'Meteor': 1500,
    'Smite': 1000,
    'Bless': 2000,
    'default': 600
  };
  
  return durations[type] || durations.default;
}

function notifyServerAnimationComplete() {
  // Apply pending game state changes after animations are done
  if (pendingGameState) {
    console.log('🎬 Applying final game state after animations');
    gameState = pendingGameState;
    pendingGameState = null;
    
    // Don't clear cache - let tiles update individually as needed
    console.log('🔄 Game state updated - tiles will refresh as needed');
  }
  
  // Reset animation sequence state
  isAnimationSequenceActive = false;
  gameStateSnapshot = null;
  console.log('✅ Animation sequence complete');
  
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
  let col;
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
    textFont(text_font); 

    push();
    if (do_bg){
      draw_panel_bg(x, y, w, h);
    }

    // Calculate character dimensions more precisely
    let charWidth = textWidth(horiz);
    let charHeight = textAscent() + textDescent();
    let charsHorizontal = Math.floor(w / charWidth);
    let charsVertical = Math.floor(h / charHeight);
    
    // Adjust spacing for better alignment
    let horizontalOffset = (w - (charsHorizontal * charWidth)) / 2;
    let verticalOffset = (h - (charsVertical * charHeight)) / 2;
    
    fill(color || framesCol);
    textAlign(LEFT, TOP);

    // Build horizontal border strings once
    let topBorder = tl + horiz.repeat(Math.max(0, charsHorizontal - 2)) + tr;
    let bottomBorder = bl + horiz.repeat(Math.max(0, charsHorizontal - 2)) + br;
    
    // Draw top and bottom borders with single text calls
    text(topBorder, x + horizontalOffset, y + verticalOffset);
    text(bottomBorder, x + horizontalOffset, y + h - charHeight - verticalOffset);

    // Draw left and right vertical borders efficiently
    let leftX = x + horizontalOffset;
    let rightX = x + w - charWidth - horizontalOffset;
    let startY = y + verticalOffset + charHeight;
    let endY = y + h - charHeight - verticalOffset;
    
    // Batch vertical characters into fewer calls
    let verticalCount = Math.floor((endY - startY) / (charHeight - 1));
    if (verticalCount > 0) {
        let leftVertical = vert.repeat(verticalCount);
        let rightVertical = vert.repeat(verticalCount);
        
        // Draw left border as one string
        push();
        translate(leftX, startY);
        for (let i = 0; i < verticalCount; i++) {
            text(vert, 0, i * (charHeight - 1));
        }
        pop();
        
        // Draw right border as one string  
        push();
        translate(rightX, startY);
        for (let i = 0; i < verticalCount; i++) {
            text(vert, 0, i * (charHeight - 1));
        }
        pop();
    }
    
    textAlign(LEFT, BASELINE);
    pop();
}

// =============================================================================
// MAIN DRAW LOOP
// =============================================================================
function draw() {
  const drawStart = performance.now();
  background('#572929ff');
  
  if (!gameState) {
    drawLoadingScreen();
    return;
  }
  
  // Draw the three main sections
  const panelsStart = performance.now();
  
  const msgStart = performance.now();
  drawMessagesPanel();
  const msgEnd = performance.now();
  
  const infoStart = performance.now();
  drawInfoPanel();
  const infoEnd = performance.now();
  
  const controlsStart = performance.now();
  drawControlsPanel();
  const controlsEnd = performance.now();
  
  const titleStart = performance.now();
  drawTitlePanel();
  const titleEnd = performance.now();
  
  const gameStart = performance.now();
  drawGamePanel();
  const gameEnd = performance.now();
  
  const panelsEnd = performance.now();
  
  fill(255);

  if (isAnimating) {
    const animInfo = getAnimationInfo();
    const animText = animInfo ? 
      `Moving (${animInfo.fromX},${animInfo.fromY}) -> (${animInfo.toX},${animInfo.toY})` :
      'Unknown animation';
    text('Animating: ' + animText, LAYOUT.totalWidth * 0.1, LAYOUT.totalHeight * 0.95);
  }
  
  const drawEnd = performance.now();
  const totalDrawTime = (drawEnd - drawStart).toFixed(2);
  const panelsTime = (panelsEnd - panelsStart).toFixed(2);
  const msgTime = (msgEnd - msgStart).toFixed(2);
  const infoTime = (infoEnd - infoStart).toFixed(2);
  const controlsTime = (controlsEnd - controlsStart).toFixed(2);
  const titleTime = (titleEnd - titleStart).toFixed(2);
  const gameTime = (gameEnd - gameStart).toFixed(2);
  
  let framerate = frameRate();
  text(`FPS: ${framerate.toFixed(2)}`, 10, 10);
  text(`Draw: ${totalDrawTime}ms | Panels: ${panelsTime}ms`, 10, 530);
  text(`Msg:${msgTime} Info:${infoTime} Ctrl:${controlsTime} Title:${titleTime} Game:${gameTime}`, 10, 550);

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

  if (messagesPanelCacheInvalid) {
    messagesPanelCache = createGraphics(panel.width, panel.height);
    renderMessagesPanelToBuffer(messagesPanelCache, panel);
    messagesPanelCacheInvalid = false;
  }
  image(messagesPanelCache, panel.x, panel.y);
}

function renderMessagesPanelToBuffer(buffer, panel) {
  // Clear buffer with transparent background
  buffer.clear();
  
  // Draw background stripes
  let horiz_slices_size = 30;
  let slices_count = panel.height / horiz_slices_size;
  buffer.noStroke();
  for (let i = 0; i < slices_count; i++) {
    let col = i % 2 == 0 ? buffer.color(0, 0, 0) : buffer.color(8, 12, 8);
    buffer.fill(col);
    buffer.rect(0, i * horiz_slices_size, panel.width, horiz_slices_size);
  }
  
  // Draw border - adapted from draw_border_ascii for buffer
  let horiz = '=';
  let vert = 'I';
  let tl = '*', tr = '*', bl = '*', br = '*';
  
  buffer.textSize(font_size);
  buffer.textFont(text_font);
  
  // Calculate character dimensions
  let charWidth = buffer.textWidth(horiz);
  let charHeight = buffer.textAscent() + buffer.textDescent();
  let charsHorizontal = Math.floor(panel.width / charWidth);
  let charsVertical = Math.floor(panel.height / charHeight);
  
  // Adjust spacing for better alignment
  let horizontalOffset = (panel.width - (charsHorizontal * charWidth)) / 2;
  let verticalOffset = (panel.height - (charsVertical * charHeight)) / 2;
  
  buffer.fill('#2bff00ff');
  buffer.textAlign(LEFT, TOP);
  
  // Build and draw borders
  let topBorder = tl + horiz.repeat(Math.max(0, charsHorizontal - 2)) + tr;
  let bottomBorder = bl + horiz.repeat(Math.max(0, charsHorizontal - 2)) + br;
  
  buffer.text(topBorder, horizontalOffset, verticalOffset);
  buffer.text(bottomBorder, horizontalOffset, panel.height - charHeight - verticalOffset);
  
  // Draw vertical borders
  let leftX = horizontalOffset;
  let rightX = panel.width - charWidth - horizontalOffset;
  let startY = verticalOffset + charHeight;
  let endY = panel.height - charHeight - verticalOffset;
  
  let verticalCount = Math.floor((endY - startY) / (charHeight - 1));
  if (verticalCount > 0) {
    for (let i = 0; i < verticalCount; i++) {
      buffer.text(vert, leftX, startY + i * (charHeight - 1));
      buffer.text(vert, rightX, startY + i * (charHeight - 1));
    }
  }
  
  // Text content
  buffer.noStroke();
  buffer.textAlign(LEFT, BASELINE);
  
  // White text first
  buffer.fill(255);
  buffer.text('Action Log:', 20, 30);
  
  let y = 50;
  for (let i = Math.max(0, actionLog.length - 15); i < actionLog.length; i++) {
    buffer.text(actionLog[i], 20, y);
    y += 18;
  }
  
  // Messages section header
  y += 20;
  buffer.text('Messages:', 20, y);
  y += 20;
  
  // Collect message positions
  let messageYPositions = [];
  for (let i = Math.max(0, messageLog.length - 5); i < messageLog.length; i++) {
    messageYPositions.push({ msg: messageLog[i], y: y });
    y += 35;
  }
  
  // Draw all player names in blue
  buffer.fill(180, 180, 255);
  for (const pos of messageYPositions) {
    buffer.text(`${pos.msg.player}:`, 20, pos.y);
  }
  
  // Draw all message text in white
  buffer.fill(255);
  for (const pos of messageYPositions) {
    buffer.text(pos.msg.text, 20, pos.y + 15);
  }
}


function drawGamePanel() {
  // Center: Main game grid (9:9)
  const panel = LAYOUT.gamePanel;
  
  push();
  translate(panel.x, panel.y);
  
  draw_border_ascii(-LAYOUT.totalWidth * 0.25/16, -9, panel.width, panel.height);
  
  if (gameState && gameState.grid) {
    const gridSize = gameState.grid.length;
    const cellSize = (LAYOUT.gamePanel.height * 0.95) / gridSize;
    
    drawGameGrid();
    
    // Draw animated tiles on top
    if (currentAnimation === 'Move') {
      drawMovingTiles_Move(gameState, cellSize);
    } else if (currentAnimation === 'Convert') {
      drawTiles_Convert(gameState, cellSize);
    }
  }
  
  pop();
}

function drawGameGrid() {
  const gridSize = gameState.grid.length;
  const cellSize = (LAYOUT.gamePanel.height * 0.95) / gridSize;
  
  // Simple caching: if tile not cached OR tile content changed, create it
  let tilesCreatedThisFrame = 0;
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = gameState.grid[y][x];
      const tileKey = `${x}-${y}`;
      
      // Create simple content hash for this tile
      const tileHash = `${tile.owner}-${tile.troop_power}-${tile.building}`;
      const cachedTile = tileCache.get(tileKey);
      
      // Check if we need to regenerate this tile
      if (!cachedTile || cachedTile.hash !== tileHash) {
        tilesCreatedThisFrame++;
        // Create graphics buffer for this tile
        const tileGraphics = createGraphics(cellSize, cellSize);
        renderTileToBuffer(tileGraphics, tile, cellSize);
        // Store with hash for comparison
        tileGraphics.hash = tileHash;
        tileCache.set(tileKey, tileGraphics);
      }
      
      // Check if tile is reserved for animation
      if (animationReservedTiles.has(tileKey)) {
        continue;
      }
      
      // Draw cached tile
      let screenX = x *(cellSize + LAYOUT.totalWidth * 0.05/16) + LAYOUT.totalWidth * 0.025/16;
      let screenY = y * cellSize + LAYOUT.totalHeight * 0.1/9;

      tileRealLocations.set(tileKey, { x: screenX,  y: screenY });
      
      //default anim movement
      screenX += Math.sin(frameCount * 0.005 + x + y);
      screenY += Math.cos(frameCount * 0.018 + x + y);

      image(tileCache.get(tileKey), screenX, screenY);
    }
  }
  
  if (tilesCreatedThisFrame > 0) {
    console.log(`🎨 Created ${tilesCreatedThisFrame} new tile graphics (Total cached: ${tileCache.size})`);
  }
}

function renderTileToBuffer(buffer, tile, cellSize) {
  // Render tile to graphics buffer for caching - clone of draw_border_ascii version
  buffer.background(0, 0); // Transparent background
  
  let agent_letter = tile.owner ? tile.owner[tile.owner.length -1] : null;
  let agent_color = agents_color_map[agent_letter] || '#b4b4b4ff';

  
  buffer.textFont(text_font); 

  let bg_char = 'v';
  // Background characters - optimized batching like drawTile()
  buffer.fill('#2c231aff');
  const charWidth = buffer.textWidth(bg_char);
  const charHeight = buffer.textAscent();
  const charsPerRow = Math.floor((cellSize - charWidth) / charWidth);
  const rowCount = Math.floor((cellSize - charHeight) / charHeight);
  
  if (charsPerRow > 0 && rowCount > 0) {
    const bgRow = bg_char.repeat(charsPerRow);
    for (let row = 0; row < rowCount; row++) {
      const yPos = charHeight + (row * charHeight);
      buffer.text(bgRow, charWidth, yPos);
    }
  }
  
  // Use draw_border_ascii equivalent in buffer
  let horiz = '~';
  let vert = '|';
  let tl = '*', tr = '*', bl = '*', br = '*';
  
  buffer.fill(agent_color);
  buffer.textAlign(LEFT, TOP);
  buffer.textSize(font_size * 0.75);
  
  // Build and draw borders like draw_border_ascii
  let charsHorizontal = Math.floor(cellSize / charWidth);
  let charsVertical = Math.ceil(cellSize / charHeight);
  
  let topBorder = tl + horiz.repeat(Math.max(0, charsHorizontal - 2)) + tr;
  let bottomBorder = bl + horiz.repeat(Math.max(0, charsHorizontal - 2)) + br;
  
  // Draw top and bottom borders
  buffer.text(topBorder, 0, 0);
  buffer.text(bottomBorder, 0, cellSize - charHeight);
  
  // Draw vertical borders - batch into fewer calls
  for (let i = 1; i < charsVertical - 1; i++) {
    buffer.text(vert, 0, i * charHeight);
    buffer.text(vert, cellSize - charWidth, i * charHeight);
  }
    
  // Troop count
  if (tile.troop_power > 0) {
    buffer.fill(255);
    buffer.textAlign(CENTER, CENTER);
    buffer.text(Math.floor(tile.troop_power), cellSize/2, cellSize/2);
  }

  if (tile.building != 'none') {
    buffer.fill(agent_color);
    buffer.textAlign(CENTER, CENTER);
    buffer.text(tile.building, cellSize/2, cellSize * 0.75);
  }
}

function drawTile(x, y, tile, cellSize) {
  // Basic tile drawing - optimize background character batching
  const screenX = x * cellSize + LAYOUT.totalWidth * 0.125/16;
  const screenY = y * cellSize + LAYOUT.totalHeight * 0.1/9;

  let agent_letter = tile.owner ? tile.owner[tile.owner.length -1] : null;
  let agent_color = agents_color_map[agent_letter] || '#b4b4b4ff';

  let bg_char = 'v';
  // Batch background characters into strings instead of individual text() calls
  fill('#2c231aff');
  const charWidth = textWidth(bg_char);
  const charHeight = textAscent();
  const charsPerRow = Math.floor((cellSize - charWidth) / charWidth);
  const rowCount = Math.floor((cellSize - charHeight) / charHeight);
  let tilebg = ''
  if (charsPerRow > 0 && rowCount > 0) {
    const bgRow = bg_char.repeat(charsPerRow);
    for (let row = 0; row < rowCount; row++) {
      const yPos = screenY + textAscent() + (row * charHeight);
      tilebg += bgRow + '\n';
      text(bgRow, screenX + charWidth, yPos);
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

  if (tile.building != 'none') {
    fill(agent_color);
    textAlign(CENTER, CENTER);
    text(tile.building, screenX + cellSize/2, screenY + cellSize * 0.75);
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
  text('Your Powers', 20, 30);
  
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

function keyPressed() {
  if (key == 'a'){
    //fake a conversion animation for testing
    animationReservedTiles.add('4-5');
    const fakeAction = {
        action: {
          type: 'Convert',
          parameters: { x:4, y:5 }
        },
        changes:{
          success: true,
          fleeing: {
            per_tile_amount: 5,
            tiles: [ { x:5, y:5 } ]

          }
        } 
      };
    
    animationQueue.push(fakeAction);
    processAnimationQueue();

  }
}

// =============================================================================
// P5.js REQUIRED FUNCTIONS
// =============================================================================
// setup() and draw() are defined above
// mousePressed() is defined above

// Make globals available for P5.js
window.setup = setup;
window.draw = draw;
window.preload = preload;
window.mousePressed = mousePressed;
window.keyPressed = keyPressed;
window.tileRealLocations = tileRealLocations;
window.agents_color_map = agents_color_map;