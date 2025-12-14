// Clean Game Client - Barebones skeleton for custom visualization
// Layout: [Messages 3:9] [Game 9:9] [Info/Controls 4:9]

// =============================================================================
// GLOBAL STATE
// =============================================================================
let socket = null;
let gameState = null;
let gameOver = false;
let particleManager = null;
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

let mouseVelocity = { x: 0, y: 0 };

let tileRealLocations = new Map(); // Map tile keys to real pixel locations

let hoveredTileKey = null;
let hoveredTileInfo = null;
let tooltipTileHoverStart = 0;

let personalityEvolving = false;
let personalityEvolvingLastRefresh = 0;

// Tile caching for performance
let tileCache = new Map(); // Cache rendered tiles
let gameStateSnapshot = null; // Snapshot of game state before animations
let isAnimationSequenceActive = false; // Track if we're in animation sequence
let cacheClearPending = false; // Flag to clear cache on next frame start
let textBoxContent = '';
let textBoxActive = false;

// Panel caching for performance
let messagesPanelCache = null;
let messagesPanelCacheInvalid = true;
let infoPanelCache = null;
let infoPanelCacheInvalid = true;
let titleCache = null;

let framesCol = '#2bff00ff';
let framesColBleed = '#315529ea';
let textCol = '#ffffffff';
let textColBleed = '#808080ea';

let agents_color_map = {'A':'#0051ffff', 'B': '#ff0004ff', 'C': '#00ff95ff', 'D': '#f50cfdff'};

import { drawMeteor, drawSmite, clearAnims, drawRulerMessage, drawTilesSanctuary, drawTilesConvert, drawTilesConstruct, drawMovingTiles as drawMovingTiles_Move, drawTilesBless, animateUniversal, drawTilesReinforce} from './tileAnimations.js';
import { ParticleManager } from './ParticleManager.js';
import { DragEffector, FireballEffector } from './ParticleBase.js';

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
let buttons = [
    { name: 'Smite', x: LAYOUT.rightPanel.controlsSection.width * 0.1, y: LAYOUT.rightPanel.controlsSection.height * 0.15, w: 80, h: 30 },
    { name: 'Bless', x: LAYOUT.rightPanel.controlsSection.width * 0.4, y: LAYOUT.rightPanel.controlsSection.height * 0.15, w: 80, h: 30 },
    { name: 'Meteor', x: LAYOUT.rightPanel.controlsSection.width * 0.7, y: LAYOUT.rightPanel.controlsSection.height * 0.15, w: 80, h: 30 }
  ];
let pauseButtonLayout = { x: LAYOUT.rightPanel.controlsSection.width * 0.1, y: LAYOUT.rightPanel.controlsSection.height * 0.25, w: 80, h: 30 };
let startButtonLayout = { x: LAYOUT.rightPanel.controlsSection.width * 0.4, y: LAYOUT.rightPanel.controlsSection.height * 0.25, w: LAYOUT.rightPanel.controlsSection.width * 0.515, h: 30 };
let textBoxLayout = { x: LAYOUT.rightPanel.controlsSection.width * 0.095, y: LAYOUT.rightPanel.controlsSection.height * 0.33, w: LAYOUT.rightPanel.controlsSection.width * 0.84, h: 50 };
let restartButtonLayout = { x: LAYOUT.rightPanel.controlsSection.width * 0.75, y: LAYOUT.rightPanel.controlsSection.height * 0.855, w: LAYOUT.rightPanel.controlsSection.width * 0.2, h: 30 };

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
  window.particleManager = particleManager;

  particleManager = new ParticleManager();

  cursor('./gauntletCursor/outlines/cursor_outline_white.png')
  //cursor('./gauntletCursor/cursor_final.png');
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
  
  switch (message.type) {
    case 'gameState':
      console.log('🎮 Game state updated');
      gameState = message.data;
      tileCache.clear(); // Clear cache for new state
      //console.log('🧹 Cleared tile cache for new game state');
      break;
      
    case 'actionsExecuted':
      console.log('🎬 Processing actionsExecuted:', message.data);
      
      // Add actions to animation queue
      if (message.data.actions && Array.isArray(message.data.actions)) {
        console.log(`📋 Found ${message.data.actions.length} actions to process`);
        for (const action of message.data.actions) {
          console.log('➕ Adding action to queue:', action);
          // Store player name with action for later logging
          action.playerName = message.data.player;
          animationQueue.push(action);
          
          if (message.data.player !== 'Observer') personalityEvolving = false;
          
          // Don't log action or message immediately - will be done when animation starts
        }
      } else {
        console.warn('⚠️ No actions array in actionsExecuted message');
      }
      
      // Store new game state and snapshot current state before animations
      if (message.data.newGameState) {
        if (!isAnimationSequenceActive) {
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
      personalityEvolving = false;
      actionLog.push(`Game ended! Winner: ${message.data.winner}`);
      gameOver = true;
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

  infoPanelCacheInvalid = true;
  
  // Execute animation based on type
  executeAnimation(action, function() {
    console.log(`✅ Animation complete for:`, action.action ? action.action.type : 'unknown');
    isAnimating = false;
    infoPanelCacheInvalid = true;
    processAnimationQueue(); // Process next action (will check pause state again)
  });
  
  const queueEnd = performance.now();
  if ((queueEnd - queueStart) > 1) {
    console.log(`⏱️ processAnimationQueue took ${(queueEnd - queueStart).toFixed(2)}ms`);
  }
}

function executeAnimation(action, callback) {
  // Log action and message when animation starts (not when received)
  if (action.action) {
    const params = action.action.parameters;
    const playerName = action.playerName || 'Unknown';
    let actionText = `${playerName}: ${action.action.type}`;
    if (params.x !== undefined) actionText += ` (${params.x},${params.y})`;
    actionLog.push(actionText);
    if (actionLog.length > MAX_LOG_ENTRIES) actionLog.shift();
    
    // Log messages separately
    if (action.action.type === 'Message' && params.text) {
      messageLog.push({ player: playerName, text: params.text });
      if (messageLog.length > MAX_LOG_ENTRIES) messageLog.shift();
    }
    
    // Invalidate message panel cache so new message shows up
    messagesPanelCacheInvalid = true;
  }
  
  // Simple timing-based animation system
  const actionType = action.action ? action.action.type : action.type;
  let duration;
  if (actionType === 'Message') {
    // Pass message text to getAnimationDuration
    let messageText = action.action && action.action.parameters && action.action.parameters.text;
    duration = getAnimationDuration(actionType, messageText);
  } else {
    duration = getAnimationDuration(actionType);
  }

  switch (actionType) {
    case 'Move':
      currentAnimation = 'Move';
      // Reserve tiles for animation
      const fromKey = `${action.action.parameters.fromX}-${action.action.parameters.fromY}`;
      const toKey = `${action.action.parameters.toX}-${action.action.parameters.toY}`;
      animationReservedTiles.add(fromKey);
      animationReservedTiles.add(toKey);

      animateUniversal(action, duration, () => {
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
      animateUniversal(action, duration, () => {
        animationReservedTiles.delete(key);
        if (action.changes.success) {
          for (const fleeingTile of action.changes.fleeing.tiles) {
            const fleeKey = `${fleeingTile.x}-${fleeingTile.y}`;
            tileCache.delete(fleeKey);
          }
        }
        callback();
      });
      break;

    case 'Construct':
      currentAnimation = 'Construct';
      const constructKey = `${action.action.parameters.x}-${action.action.parameters.y}`;
      animationReservedTiles.add(constructKey);
      animateUniversal(action, duration, () => {
        animationReservedTiles.delete(constructKey);
        callback();
      });
      break;
    case 'Reinforce':
      currentAnimation = 'Reinforce';
      const reinforceKey = `${action.action.parameters.x}-${action.action.parameters.y}`;
      animationReservedTiles.add(reinforceKey);
      animateUniversal(action, duration, () => {
        animationReservedTiles.delete(reinforceKey);
        callback();
      });
      break;
    case 'Sanctuary':
      currentAnimation = 'Sanctuary';
      const sanctuaryKey = `${action.action.parameters.x}-${action.action.parameters.y}`;
      animationReservedTiles.add(sanctuaryKey);
      animateUniversal(action, duration, () => {
        animationReservedTiles.delete(sanctuaryKey);
        tileCache.delete(sanctuaryKey);
        callback();
      });
      break;
      case 'Message':
        currentAnimation = 'Message';
        animateUniversal(action, duration, () => {
          callback();
        });
      break;
      case 'Bless':
        currentAnimation = 'Bless';
        const blessKey = `${action.action.parameters.x}-${action.action.parameters.y}`;
        animationReservedTiles.add(blessKey);
        animateUniversal(action, duration, () => {
          animationReservedTiles.delete(blessKey);
          callback();
        });
      break;
      case 'Smite':
        currentAnimation = 'Smite';
        animateUniversal(action, duration, () => {
          callback();
        });
      break;
      case 'Meteor':
        currentAnimation = 'Meteor';
        animateUniversal(action, duration, () => {
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

function getAnimationDuration(type, messageText='') {
  const durations = {
    'Move': 1200,
    'Convert': 2000,
    'Reinforce': 2000,
    'Construct': 2500,
    'Sanctuary': 1200,
    'Meteor': 2000,
    'Smite': 1500,
    'Bless': 2000,
    'default': 1000
  };

  // Variable duration for Message animation
  if (type === 'Message') {
    // 50ms per character, min 1500ms, max 8000ms
    const base = 1500;
    const perChar = 75;
    const max = 20000;
    if (typeof messageText === 'string') {
      return Math.max(base, Math.min(max, base + messageText.length * perChar));
    }
    return base;
  }
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

function draw_panel_bg(x, y, w, h, bg_alpha = 1){
  let horiz_slices_size = 30;
  let slices_count = h / horiz_slices_size;
  noStroke();
  let col;
  for (let i = 0; i < slices_count; i++){
   if (i % 2 == 0){
       col = color('#000000ff');
   } else {
       col = lerpColor(color('#000000ff'), color('#080c08ff'), bg_alpha);
   }
    fill(col);
    if (y + i * horiz_slices_size + horiz_slices_size > y + h){//out of bounds
      rect(x, y + i * horiz_slices_size, w, (y + h) - (y + i * horiz_slices_size));
    } else {
      rect(x, y + i * horiz_slices_size, w, horiz_slices_size);
    }
  }
}


function draw_border_ascii(x, y, w, h, style = '=I****', color = null, do_bg = true, size = font_size, dim_bg = 1){
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
      draw_panel_bg(x, y, w, h, dim_bg);
    }

    strokeWeight(2);
    stroke(framesColBleed);

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
  background('#000000ff');

  
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
  if (personalityEvolving) drawPersonalityEvolvingEffect();
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

  drawPowerTooltip();
  
  const panelsEnd = performance.now();

  particleManager.update(deltaTime / 1000);
  particleManager.draw();

  fill(textCol);
  
  const drawEnd = performance.now();
  const totalDrawTime = (drawEnd - drawStart).toFixed(2);
  const panelsTime = (panelsEnd - panelsStart).toFixed(2);
  const msgTime = (msgEnd - msgStart).toFixed(2);
  const infoTime = (infoEnd - infoStart).toFixed(2);
  const controlsTime = (controlsEnd - controlsStart).toFixed(2);
  const titleTime = (titleEnd - titleStart).toFixed(2);
  const gameTime = (gameEnd - gameStart).toFixed(2);
  
  let framerate = frameRate();
  //text(`FPS: ${framerate.toFixed(2)}`, 10, 10);
}

function drawPersonalityEvolvingEffect(){
  personalityEvolvingLastRefresh = millis();

  let chars = ['|', '/', '-', '\\'];
  let index = floor(frameCount / 10) % chars.length;
  let dashChar = chars[index];
  fill(textCol);
  strokeWeight(2);
  stroke(textColBleed);
  text(`${dashChar} Rulers are thinking...`, LAYOUT.rightPanel.infoSection.x + LAYOUT.rightPanel.infoSection.width * 0.42, LAYOUT.rightPanel.infoSection.y + LAYOUT.rightPanel.infoSection.height * 0.9);

}

function drawTitlePanel() {

  if (!titleCache){
    titleCache = createGraphics(LAYOUT.titlePanel.width, LAYOUT.titlePanel.height);
    render_ascii_to_buffer(titleCache, 0, 0, LAYOUT.titlePanel.width, LAYOUT.titlePanel.height, '=I****', null, true, font_size, 1);
    titleCache.textFont(text_font);
    titleCache.textSize(font_size);
    titleCache.textAlign(CENTER, CENTER);
    titleCache.strokeWeight(2);
    titleCache.stroke(textColBleed);
    titleCache.fill(textCol);
    titleCache.text('God terminal   v1.04 (insider build)  (c) Heaven corp.', LAYOUT.titlePanel.width / 2, 25);
  }

  image(titleCache, LAYOUT.titlePanel.x, LAYOUT.titlePanel.y);

}

function drawMessagesPanel() {
  // Left panel: Messages and action log  
  const panel = LAYOUT.messagesPanel;

  if (messagesPanelCacheInvalid) {
    messagesPanelCache = createGraphics(panel.width, panel.height);
    renderMessagesPanelToBuffer(messagesPanelCache, panel);
    
  if (hoveredTileInfo) {
    drawTileTooltip(messagesPanelCache, panel, hoveredTileKey, hoveredTileInfo);
  }
    messagesPanelCacheInvalid = false;
  }
  image(messagesPanelCache, panel.x, panel.y);
  // Draw tooltip at the bottom of the left panel

  
function drawTileTooltip(buffer, panelInfo, tileKey, tile) {
  const tooltipHeight = 190;
  const tooltipWidth = panelInfo.width - 20;
  const tooltipX = panelInfo.x + 10;
  const tooltipY = panelInfo.y + panelInfo.height - tooltipHeight - 20;
  // Draw border
  render_ascii_to_buffer(buffer, tooltipX, tooltipY, tooltipWidth, tooltipHeight, '=I****', framesCol, true, font_size, 0.7);
  // Info text
  let lines = [];
  lines.push(`Tile: ${tileKey}`);
  lines.push(`Owner: ${tile.owner || 'None'}`);
  lines.push(`Produces: R:${1 + (tile.building === 'Market' ? 1 : 0)}, F:${0 + ((tile.building === 'Shrine' || tile.building === 'Idol') ? 1 : 0)}`);
  lines.push(`Troops: ${tile.troop_power}`);
  lines.push(`Terrain: ${tile.type || 'normal'}`);
  if (tile.effects && tile.effects.sanctuary) {
    lines.push(`Sanctuary: ${tile.effects.sanctuary}`);
  }
  lines.push(`Building: ${tile.building || 'none'}`);
  // Render lines
  buffer.push();
  buffer.textFont(text_font);
  buffer.textSize(font_size * 0.9);
  buffer.fill(textCol);
  let y = tooltipY + 30;
  for (const line of lines) {
    if (line.substring(0, 6) === 'Owner:') {
      let ownerCol = tile.owner !== 'Neutral' ? color(agents_color_map[tile.owner.slice(-1)]) : color(textCol);
      buffer.fill(ownerCol);
      buffer.stroke(bleedLerpColor(ownerCol, 0.5));
    }else{
      buffer.fill(textCol);
      buffer.stroke(textColBleed);
    }
    buffer.text(line, tooltipX + 25, y);
    y += 22;
  }
  buffer.pop();
}
}

function render_ascii_to_buffer(buffer, x, y, w, h, style = '=I****', color = null, do_bg = true, size = font_size, dim_bg = 1){
    let horiz = style[0];
    let vert = style[1];
    let tl = style[2];
    let tr = style[3];
    let bl = style[4];
    let br = style[5];

    buffer.textSize(size);
    buffer.textFont(text_font); 
    buffer.push();
    if (do_bg){
      let horiz_slices_size = 30;
      let slices_count = h / horiz_slices_size;
      buffer.noStroke();
      let col;
      for (let i = 0; i < slices_count; i++){
      if (i % 2 == 0){
          col = buffer.color('#000000ff');
      } else {
          col = buffer.lerpColor(buffer.color('#000000ff'), buffer.color('#080c08ff'), dim_bg);
      }
        buffer.fill(col);
        if (y + i * horiz_slices_size + horiz_slices_size > y + h){//out of bounds
          buffer.rect(x, y + i * horiz_slices_size, w, (y + h) - (y + i * horiz_slices_size));
        } else {
          buffer.rect(x, y + i * horiz_slices_size, w, horiz_slices_size);
        }
      }
    }

    buffer.strokeWeight(2);
    buffer.stroke(framesColBleed);

    // Calculate character dimensions more precisely
    let charWidth = buffer.textWidth(horiz);
    let charHeight = buffer.textAscent() + buffer.textDescent();
    let charsHorizontal = Math.floor(w / charWidth);
    let charsVertical = Math.floor(h / charHeight);
    
    // Adjust spacing for better alignment
    let horizontalOffset = (w - (charsHorizontal * charWidth)) / 2;
    let verticalOffset = (h - (charsVertical * charHeight)) / 2;
    
    buffer.fill(color || framesCol);
    buffer.textAlign(LEFT, TOP);

    // Build horizontal border strings once
    let topBorder = tl + horiz.repeat(Math.max(0, charsHorizontal - 2)) + tr;
    let bottomBorder = bl + horiz.repeat(Math.max(0, charsHorizontal - 2)) + br;
    
    // Draw top and bottom borders with single text calls
    buffer.text(topBorder, x + horizontalOffset, y + verticalOffset);
    buffer.text(bottomBorder, x + horizontalOffset, y + h - charHeight - verticalOffset);

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
        buffer.push();
        buffer.translate(leftX, startY);
        for (let i = 0; i < verticalCount; i++) {
            buffer.text(vert, 0, i * (charHeight - 1));
        }
        buffer.pop();
        
        // Draw right border as one string  
        buffer.push();
        buffer.translate(rightX, startY);
        for (let i = 0; i < verticalCount; i++) {
            buffer.text(vert, 0, i * (charHeight - 1));
        }
        buffer.pop();
    }
    
    buffer.textAlign(LEFT, BASELINE);
    buffer.pop();
  }
function sanitizeAscii(str) {
  // Replace non-ASCII and newline characters with a space
  return str.replace(/[^\x00-\x7F]|\r?\n|\r/g, ' ');
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
  
  buffer.fill(framesCol);
  buffer.textAlign(LEFT, TOP);
  buffer.strokeWeight(2);
  buffer.stroke(framesColBleed);
  
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
  buffer.textAlign(LEFT, BASELINE);
  
  // White text first
  buffer.fill(textCol);
  buffer.strokeWeight(2);
  buffer.stroke(textColBleed);
  buffer.text('Action Log:', 20, 30);
  
  let y = 50;
  for (let i = Math.max(0, actionLog.length - 15); i < actionLog.length; i++) {
    //replace Observer with You
    if (actionLog[i].startsWith('Observer:')) {
      actionLog[i] = actionLog[i].replace('Observer:', 'You:');
    }
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
  buffer.fill(textCol);
  buffer.strokeWeight(2);
  buffer.stroke(textColBleed);
  for (const pos of messageYPositions) {
    if (pos.msg.player === 'Observer') pos.msg.player = 'You';
    buffer.text(`${pos.msg.player}:`, 20, pos.y);
  }
  
  // Draw all message text in white
  buffer.fill(255);
  for (const pos of messageYPositions) {
    buffer.text(sanitizeAscii(pos.msg.text), 20, pos.y + 15);
  }
}

function renderTitlePanelToBuffer(buffer, panel) {
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
}



function drawGamePanel() {
  // Center: Main game grid (9:9)
  const panel = LAYOUT.gamePanel;
  
  push();
  translate(panel.x, panel.y);
  
  draw_border_ascii(-LAYOUT.totalWidth * 0.25/16, -9, panel.width, panel.height, '=I****', null, true, font_size, 0.25);
  
  if (gameState && gameState.grid) {
    const gridSize = gameState.grid.length;
    const cellSize = (LAYOUT.gamePanel.height * 0.95) / gridSize;
    
    drawGameGrid();

    // Draw animated tiles on top
    if (currentAnimation === 'Move') {
      drawMovingTiles_Move(gameState, cellSize);
    } else if (currentAnimation === 'Convert') {
      drawTilesConvert(gameState, cellSize);
    }else if (currentAnimation === 'Bless'){
      drawTilesBless(gameState, cellSize);
    }else if (currentAnimation === 'Construct'){
      drawTilesConstruct(gameState, cellSize, font_size * 0.75);
    }else if (currentAnimation === 'Reinforce'){
      drawTilesReinforce(gameState, cellSize, font_size * 0.75);
    }else if (currentAnimation === 'Sanctuary'){
      drawTilesSanctuary(gameState, cellSize, font_size * 0.75);
    }
    
    // Always draw sanctuary overlays on top of everything (including animations)
    drawAllSanctuaryOverlays(gameState, cellSize);

    if (currentAnimation === 'Message'){
      drawRulerMessage(gameState, cellSize, font_size);
    }
    if (currentAnimation === 'Smite'){
      drawSmite(gameState, cellSize, particleManager);
    }
    if (currentAnimation === 'Meteor'){
      drawMeteor(gameState, cellSize, particleManager);
    }
    if (gameOver){
      drawGameOverOverlay(gameState, cellSize, font_size);
    }

  }
  
  pop();
}

function drawAllSanctuaryOverlays(gameState, cellSize) {
  // Draw sanctuary overlays for ALL tiles, including those being animated
  const currentTurn = (pendingGameState && pendingGameState.turnNumber) ? pendingGameState.turnNumber : (gameState.turnNumber || 0);
  const gridSize = gameState.grid.length;
  
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const tile = gameState.grid[y][x];
      const sanctuaryTurns = tile.effects && tile.effects.sanctuary ? Math.max(0, tile.effects.sanctuary - currentTurn) : 0;
      
      if (sanctuaryTurns > 0) {
        // Calculate screen position (same logic as drawGameGrid)
        let screenX = x * (cellSize + LAYOUT.totalWidth * 0.05/16) + LAYOUT.totalWidth * 0.025/16;
        let screenY = y * cellSize + LAYOUT.totalHeight * 0.1/9;
        
        // Apply same movement animation as in drawGameGrid
        screenX += Math.sin(frameCount * 0.005 + x + y);
        screenY += Math.cos(frameCount * 0.018 + x + y);
        
        // Draw sanctuary overlay on top of everything
        drawSanctuaryOverlay(screenX, screenY, cellSize, sanctuaryTurns, tile);
      }
    }
  }
}

function drawGameOverOverlay(gameState, cellSize, font_size) {
  push();
  textFont(text_font);
  textSize(font_size * 2);
  fill('#ff0000ff');
  strokeWeight(4);
  stroke(bleedLerpColor(color('#ff0000ff')));
  textAlign(CENTER, CENTER);
  let overlayW = 600;
  let overlayH = 200;
  let overlayX = LAYOUT.gamePanel.width / 2 - overlayW / 2;
  let overlayY = LAYOUT.gamePanel.height / 2 - overlayH / 2;
  
  draw_border_ascii(overlayX, overlayY, overlayW, overlayH, '=I****', framesCol, true, font_size * 1.5, 0.5);
  text('Scenario ended with 1 faction remaining', overlayX + overlayW / 2, overlayY + overlayH / 3 - 10);
  text('Press Restart to start over', overlayX + overlayW / 2, overlayY + overlayH / 3 + 40);
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
      
      // Create simple content hash for this tile - sanctuary effects handled separately
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

      tileRealLocations.set(tileKey, { x: screenX,  y: screenY, w: cellSize, h: cellSize });
      
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

function drawSanctuaryOverlay(x, y, cellSize, sanctuaryTurns, tile) {
  // Draw sanctuary protection overlay on top of cached tile
  let agent_letter = tile.owner ? tile.owner[tile.owner.length -1] : null;
  let agent_color = agents_color_map[agent_letter] || '#b4b4b4ff';
  
  push();
  textFont(text_font);
  textSize(font_size * 0.75);
  fill(agent_color);
  strokeWeight(2);
  stroke(bleedLerpColor(color(agent_color)));
  textAlign(LEFT, TOP);
  
  const charWidth = textWidth('#');
  const charHeight = textAscent() + textDescent();
  const charsHorizontal = Math.floor(cellSize / charWidth);
  const charsVertical = Math.ceil(cellSize / charHeight);
  
  // Sanctuary borders
  let horiz = String(sanctuaryTurns);
  let vert = '#';
  let tl = '#', tr = '#', bl = '#', br = '#';
  
  let topBorder = tl + horiz.repeat(Math.max(0, charsHorizontal - 2)) + tr;
  let bottomBorder = bl + horiz.repeat(Math.max(0, charsHorizontal - 2)) + br;
  
  // Draw sanctuary borders over the cached tile
  text(topBorder, x, y);
  text(bottomBorder, x, y + cellSize - charHeight);
  
  // Draw vertical borders
  for (let i = 1; i < charsVertical - 1; i++) {
    text(vert, x, y + i * charHeight);
    text(vert, x + cellSize - charWidth, y + i * charHeight);
  }
  
  pop();
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
  buffer.strokeWeight(2);
  buffer.stroke(bleedLerpColor(buffer.color('#2c231aff')));
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
  
  // Use normal borders - sanctuary will be overlaid separately
  let horiz = '~';
  let vert = '|';
  let tl = '*', tr = '*', bl = '*', br = '*';
  
  buffer.fill(agent_color);
  buffer.strokeWeight(2);
  buffer.stroke(bleedLerpColor(color(agent_color)));
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
    let powerString = Math.floor(tile.troop_power).toString();
    if (floor(tile.troop_power) < tile.troop_power) {
      powerString += '.';
    }
    buffer.text(powerString, cellSize/2, cellSize/2);
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
  if (infoPanelCacheInvalid) {
    infoPanelCache = createGraphics(panel.width, panel.height);
    renderInfoPanelToBuffer(infoPanelCache, panel);
    infoPanelCacheInvalid = false;
  }
  image(infoPanelCache, panel.x, panel.y);
}
function renderInfoPanelToBuffer(buffer, panel) {
  buffer.clear();

  render_ascii_to_buffer(buffer, 0, 0, panel.width, panel.height);
  
  buffer.fill(textCol);
  buffer.strokeWeight(2);
  buffer.stroke(textColBleed);
  buffer.text('Faction Info', 20, 30);
  buffer.text(`Turn: ${gameState ? gameState.turnNumber : 'N/A'}`, panel.width * 0.75, 30);
  
  if (gameState && gameState.factions) {
    let y = 60;
    for (const [name, faction] of Object.entries(gameState.factions)) {
      let playerCol = color(agents_color_map[name[name.length -1]] || '#b4b4b4ff');
      buffer.fill(playerCol);
      buffer.stroke(bleedLerpColor(playerCol));
      let printText = `${name} - ${faction.personality}: ${getTileCount(faction)} tiles`;
      if (name === gameState.currentPlayer) printText += ' <--';

      buffer.text(printText, 20, y);
      buffer.fill(textCol);
      buffer.stroke(textColBleed);
      buffer.text(`Resouces:${faction.resources.R.toFixed(0)} Faith:${faction.resources.F.toFixed(0)}`, 20, y + 20);
      y += 50;
    }
  }
}

function drawControlsPanel() {
  // Bottom-right: Observer powers and controls
  const panel = LAYOUT.rightPanel.controlsSection;
  
  draw_border_ascii(panel.x, panel.y, panel.width, panel.height);

  push();
  translate(panel.x, panel.y);
  
  fill(textCol);
  strokeWeight(2);
  stroke(textColBleed);
  textAlign(LEFT, CENTER);
  text('Your Powers', window.LAYOUT.rightPanel.width * 0.1, window.LAYOUT.rightPanel.height * 0.05);
  
  // Pause/Resume button
  const pauseButton = pauseButtonLayout;
  fill(animationPaused ? 100 : 60);
  noStroke();
  rect(pauseButton.x, pauseButton.y, pauseButton.w, pauseButton.h);
  fill(textCol);
  strokeWeight(2);
  stroke(textColBleed);
  textAlign(CENTER, CENTER);
  text(animationPaused ? 'Resume' : 'Pause', pauseButton.x + pauseButton.w/2, pauseButton.y + pauseButton.h/2);
  textAlign(LEFT);
  
  drawObserverButtons();
  drawTextBox();
  
  // Start Game button (if game not started)
  if (!gameState || gameState.gameStatus !== 'active') {
    const startButton = startButtonLayout;
    fill(gameState ? 60 : 100);
    rect(startButton.x, startButton.y, startButton.w, startButton.h);
    fill(textCol);
    strokeWeight(2);
    stroke(textColBleed);
    textAlign(CENTER, CENTER);
    text('Start Game', startButton.x + startButton.w/2, startButton.y + startButton.h/2);
    textAlign(LEFT);
  }

  //restart game button
  const restartButton = restartButtonLayout;
  fill(60);
  noStroke();
  rect(restartButton.x, restartButton.y, restartButton.w, restartButton.h);
  fill(textCol);
  strokeWeight(2);
  stroke(textColBleed);
  textAlign(CENTER, CENTER);
  text('Restart', restartButton.x + restartButton.w/2, restartButton.y + restartButton.h/2);
  textAlign(LEFT);
  
  pop();
}

// Text wrapping utilities - consistent across all functions
function getTextBoxMetrics() {
  const {x: boxX, y: boxY, w: boxW, h: boxH} = textBoxLayout;
  const padding = 15; // Consistent padding
  const usableWidth = boxW - (padding * 2);
  const charWidth = textWidth('W'); // Use consistent character for width calculation
  const lineHeight = font_size + 2;
  const charsPerLine = Math.floor(usableWidth / charWidth);
  const numLines = Math.max(1, Math.ceil(textBoxContent.length / charsPerLine));
  const calculatedHeight = boxH + (numLines - 1) * lineHeight;
  
  return {
    boxX, boxY, boxW, 
    boxH: calculatedHeight,
    padding,
    usableWidth,
    charWidth,
    lineHeight,
    charsPerLine,
    numLines
  };
}

function getSendButtonLayout() {
  const metrics = getTextBoxMetrics();
  return {
    x: metrics.boxX + metrics.boxW - 60,
    y: metrics.boxY + metrics.boxH + 10,
    w: 60,
    h: 40
  };
}

function drawTextBox() {
  const metrics = getTextBoxMetrics();

  if (textBoxActive) {
    draw_border_ascii(metrics.boxX, metrics.boxY, metrics.boxW, metrics.boxH, '=I****', framesCol, true, font_size, 0.5);
  } else {
    draw_border_ascii(metrics.boxX, metrics.boxY, metrics.boxW, metrics.boxH, '=I****', '#23b100ff', true, font_size, 0.5);
    fill(100);
    noStroke();
    textAlign(LEFT, TOP);
    text('Messages to mortals go here', metrics.boxX + metrics.padding, metrics.boxY + metrics.padding);
  }
  strokeWeight(2);
  
  // Text content - wrap consistently
  fill(255);
  textAlign(LEFT, TOP);
  
  for (let line = 0; line < metrics.numLines; line++) {
    const startChar = line * metrics.charsPerLine;
    const endChar = Math.min(startChar + metrics.charsPerLine, textBoxContent.length);
    const lineText = textBoxContent.substring(startChar, endChar);
    const textX = metrics.boxX + metrics.padding;
    const textY = metrics.boxY + metrics.padding + (line * metrics.lineHeight);
    text(lineText, textX, textY);
  }
  
  // Cursor when active - position consistently with text wrapping
  if (textBoxActive && frameCount % 60 < 30) {
    const cursorPos = textBoxContent.length;
    const cursorLine = Math.floor(cursorPos / metrics.charsPerLine);
    const cursorCol = cursorPos % metrics.charsPerLine;
    const cursorX = metrics.boxX + metrics.padding + (cursorCol * metrics.charWidth);
    const cursorY = metrics.boxY + metrics.padding + (cursorLine * metrics.lineHeight);
    
    fill(framesCol);
    stroke(framesColBleed);
    text('I', cursorX, cursorY);
  }
  
  // Send button
  const {x: buttonX, y: buttonY, w: buttonW, h: buttonH} = getSendButtonLayout();
  
  if (textBoxContent.trim().length > 0) {
    draw_border_ascii(buttonX, buttonY, buttonW, buttonH+10, '=I****', framesCol, true, font_size, 0.5);
  
    fill(textCol);
    strokeWeight(2);
    stroke(textColBleed);
    textAlign(CENTER, CENTER);
    text("Send", buttonX + buttonW/2, buttonY + buttonH/2);
  } 
  
  // Reset text alignment
  textAlign(LEFT);
  noStroke();
}

function drawObserverButtons() {
  
  for (const button of buttons) {
    // Button background
    noStroke();
    if (selectedObserverAction === button.name) {
      fill(100, 200, 100); // Green if selected
    } else {
      fill(60);
    }
    rect(button.x, button.y, button.w, button.h);
    
    // Button text
    fill(textCol);
    strokeWeight(2);
    stroke(textColBleed);
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

  let clickCol = color( 0, 255 - Math.random() * 100,0, 255);
  
  particleManager.spawnBurst({ x: mouseX, y: mouseY }, 30, clickCol, [new DragEffector(3)]);

  let particleCount = 20;
  let fireballcols = [];
  for (let i = 0; i < particleCount; i++){
    fireballcols.push(color(255, 0, Math.random() * 200, 255));
  }


 // particleManager.spawnBurst({ x: mouseX, y: mouseY }, particleCount, fireballcols,
  //   [new FireballEffector({x: mouseX, y: mouseY})], 3 + Math.random() * 2, 10, 1, ADD);
  

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
  // Check text box click
  const metrics = getTextBoxMetrics();

  if (x >= metrics.boxX && x <= metrics.boxX + metrics.boxW && 
      y >= metrics.boxY && y <= metrics.boxY + metrics.boxH) {
    textBoxActive = true;
    return;
  }
  
  // Check send button click
  const {x: sendButtonX, y: sendButtonY, w: sendButtonW, h: sendButtonH} = getSendButtonLayout();
  if (x >= sendButtonX && x <= sendButtonX + sendButtonW && 
      y >= sendButtonY && y <= sendButtonY + sendButtonH) {
    sendObserverMessage();
    return;
  }
  
  // Click elsewhere deactivates text box
  textBoxActive = false;
  
  // Check start game button first (if game not active)
  if (!gameState || gameState.gameStatus !== 'active') {
    const startButton = startButtonLayout;
    if (x >= startButton.x && x <= startButton.x + startButton.w && 
        y >= startButton.y && y <= startButton.y + startButton.h) {
      startGame();
      return;
    }
  }
  
  // Check pause/resume button
  const pauseButton = pauseButtonLayout;
  if (x >= pauseButton.x && x <= pauseButton.x + pauseButton.w && 
      y >= pauseButton.y && y <= pauseButton.y + pauseButton.h) {
    togglePause();
    return;
  }
  // Check restart button
  const restartButton = restartButtonLayout;
  if (x >= restartButton.x && x <= restartButton.x + restartButton.w && 
      y >= restartButton.y && y <= restartButton.y + restartButton.h) {
    startGame();
    console.log('🔄 Game restarted');
    return;
  }
  
  for (const button of buttons) {
    if (x >= button.x && x <= button.x + button.w && 
        y >= button.y && y <= button.y + button.h) {
          if (selectedObserverAction === button.name) {
            selectedObserverAction = null;
            console.log(`Deselected observer action: ${button.name}`);
          } else {
            selectedObserverAction = button.name;
            console.log(`Selected observer action: ${button.name}`);
          }
      break;
    }
  }
}

function gameClickToTile(x, y) {
  for (const [tileKey, pos] of tileRealLocations.entries()) {
    const w = pos.w;
    const h = pos.h;
    if (x >= pos.x && x <= pos.x + w &&
        y >= pos.y && y <= pos.y + h - 10) {
      const [tileX, tileY] = tileKey.split('-').map(Number);
      return { x: tileX, y: tileY };
    }
  }
  return null;
}
    

function handleGameClick(x, y) {

  if (!selectedObserverAction) return;
  
  const tilePos = gameClickToTile(x, y);
  if (!tilePos) return;
  
  if (tilePos.x >= 0 && tilePos.x < 10 && tilePos.y >= 0 && tilePos.y < 10) {
    executeObserverAction(selectedObserverAction, tilePos.x, tilePos.y);
    selectedObserverAction = null;
    personalityEvolving = true;
  }
}

function handleMessagesClick(x, y) {
  
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

function sendObserverMessage() {
  personalityEvolving = true;
  if (!textBoxContent.trim()) return;
  
  console.log('📝 Sending observer message:', textBoxContent);
  
  // Send message to server
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
      type: 'observerAction',
      action: {
        type: 'Message',
        parameters: {
          text: textBoxContent.trim()
        }
      }
    }));
  }
  
  // Clear text box and deactivate
  textBoxContent = '';
  textBoxActive = false;
}

function startGame() {
  console.log('🎮 Starting new game...');

  // Get all available personality keys
  const allPersonalities = ['zealot', 'skeptic', 'madman', 'aristocrat', 'peasant', 'scholar', 'barbarian']
  // Shuffle personalities for random assignment
  const shuffled = allPersonalities.sort(() => Math.random() - 0.5);
  // Assign to factions A-D
  const agentConfig = [
    { name: 'Faction A', personality: shuffled[0] },
    { name: 'Faction B', personality: shuffled[1] },
    { name: 'Faction C', personality: shuffled[2] },
    { name: 'Faction D', personality: shuffled[3] }
  ];

  clearAnims();
  //reset ALL global states
  gameState = null;
  pendingGameState = null;

  animationQueue = [];
  isAnimating = false;
  animationPaused = false;
  selectedObserverAction = null; // For targeting observer powers
  actionLog = [];
  messageLog = [];
  currentAnimation = null;
  animationReservedTiles.clear();
  tileRealLocations.clear();
  hoveredTileKey = null;
  hoveredTileInfo = null;
  personalityEvolving = false;
  particleManager = new ParticleManager();
  gameOver = false;

  // Tile caching for performance
  tileCache.clear();
  gameStateSnapshot = null;
  isAnimationSequenceActive = false;
  cacheClearPending = false;
  textBoxContent = '';
  textBoxActive = false;

// Panel caching for performance
  messagesPanelCache = null;
  messagesPanelCacheInvalid = true;
  infoPanelCache = null;
  infoPanelCacheInvalid = true;
  titleCache = null;
  
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

function keyPressed() {
  // Handle text input when text box is active
  if (textBoxActive) {
    if (key === 'Enter') {
      sendObserverMessage();
    } else if (key === 'Escape') {
      textBoxActive = false;
    } else if (key === 'Backspace') {
      textBoxContent = textBoxContent.slice(0, -1);
    } else if (key.length === 1 && textBoxContent.length < 200) {
      // Add character if it's printable and box isn't full
      textBoxContent += key;
    }
    return; // Don't process other keys when text box is active
  }
}

// Delayed tooltip update for hover
let tooltipDelayTimeout = null;
let tooltipDelayTileKey = null;

function delayedTooltipCheck(tileKey) {
  if (tooltipDelayTimeout) {
    clearTimeout(tooltipDelayTimeout);
    tooltipDelayTimeout = null;
  }
  tooltipDelayTileKey = tileKey;
  tooltipDelayTimeout = setTimeout(() => {
    // After 0.5s, compare the tile that was hovered at call time to the current hovered tile
    if (tooltipDelayTileKey && hoveredTileKey && tooltipDelayTileKey === hoveredTileKey) {
      messagesPanelCacheInvalid = true;
    }
    tooltipDelayTimeout = null;
    tooltipDelayTileKey = null;
  }, 300);
}

function bleedLerpColor(col, amount = 0.7) {
  return lerpColor(col,  color(0, 0, 0, 128), amount);
}

function drawPowerTooltip(){
  for (const button of buttons) {
    if (mouseX >= button.x + LAYOUT.rightPanel.controlsSection.x &&
        mouseX <= button.x + LAYOUT.rightPanel.controlsSection.x + button.w &&
        mouseY >= button.y + LAYOUT.rightPanel.controlsSection.y &&
        mouseY <= button.y + LAYOUT.rightPanel.controlsSection.y + button.h) {          
          let boxW = 285;
          let boxH = 104;
          let boxX = mouseX  - boxW - 5;
          let boxY = mouseY - boxH - 5;
          draw_border_ascii(boxX, boxY, boxW, boxH, '=I****', framesCol, true, font_size, 0.5);
          fill(textCol);
          strokeWeight(2);
          stroke(textColBleed);
          textAlign(LEFT, TOP);
          let description = '';
          switch (button.name) {
            case 'Smite':
              description = 'Destroy all troops on a tile.';
              break;
            case 'Bless':
              description = 'Construct a Shrine on a tile. Owner also gets Faith.';
              break;
            case 'Meteor':
              description = 'Destroy all troops and buildings in a radius.';
              break;
          }
          text(description, boxX + 20, boxY + 12, boxW - 40, 60);
          text('Rulers will think about this action.', boxX + 20, boxY + 52, boxW - 40, 40);
          break;
        }
      }
}

function mouseMoved() {
//update mouse velocity
  mouseVelocity.x = mouseX - (mouseMoved.lastX || mouseX);
  mouseVelocity.y = mouseY - (mouseMoved.lastY || mouseY);
  mouseMoved.lastX = mouseX;
  mouseMoved.lastY = mouseY;

   // Find which tile (if any) the mouse is over
  let hovered = false;
  for (const [tileKey, pos] of tileRealLocations.entries()) {
    const w = pos.w;
    const h = pos.h;
    if (mouseX >= pos.x + LAYOUT.gamePanel.x && mouseX <= pos.x + LAYOUT.gamePanel.x + w &&
        mouseY >= pos.y + LAYOUT.gamePanel.y && mouseY <= pos.y + LAYOUT.gamePanel.y + h - 10) {
      //if (hoveredTileKey !== tileKey) messagesPanelCacheInvalid = true;
      hoveredTileKey = tileKey;
      // Parse x/y from key
      const [x, y] = tileKey.split('-').map(Number);
      if (gameState && gameState.grid && gameState.grid[y] && gameState.grid[y][x]) {
        if (hoveredTileInfo !== gameState.grid[y][x]) delayedTooltipCheck(tileKey);
        hoveredTileInfo = gameState.grid[y][x];
      }
      hovered = true;
      break;
    }
  }
  if (!hovered) {
    if (hoveredTileKey !== null) messagesPanelCacheInvalid = true;
    hoveredTileKey = null;
    hoveredTileInfo = null;
  }
}

function mouseDragged() {
//update mouse velocity
  mouseVelocity.x = mouseX - (mouseDragged.lastX || mouseX);
  mouseVelocity.y = mouseY - (mouseDragged.lastY || mouseY);
  mouseDragged.lastX = mouseX;
  mouseDragged.lastY = mouseY;

  particleManager.moveFireball({ x: mouseX, y: mouseY });

  let dragAngle = Math.atan2(mouseVelocity.y, mouseVelocity.x);
  let dragSpeed = Math.min(30, Math.sqrt(mouseVelocity.x * mouseVelocity.x + mouseVelocity.y * mouseVelocity.y));

  let col = color( 0, 150 + Math.random() * 105,0, 200 + Math.random() * 55);
 // particleManager.spawnFountain({ x: mouseX, y: mouseY }, 5, col, 1.2,
    //dragAngle, { min: dragSpeed * 2, max: dragSpeed * 6 }, [new DragEffector(2)]);
}

function getTileCount(faction) {
  let count = 0;
  if (gameState && gameState.grid) {
    const gridSize = gameState.grid.length;
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const tile = gameState.grid[y][x];
        if (tile.owner === faction.name) {
          count++;
        }
      }
    }
  }
  return count;
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
window.mouseMoved = mouseMoved;
window.keyPressed = keyPressed;
window.mouseDragged = mouseDragged;
window.tileRealLocations = tileRealLocations;
window.agents_color_map = agents_color_map;
window.bleedLerpColor = bleedLerpColor;
window.render_ascii_to_buffer = render_ascii_to_buffer;