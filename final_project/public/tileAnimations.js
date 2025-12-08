// Animation state
let animationStartTime = 0;
let currentMoveAction = null;
let animationDuration = 0;

export function animateMove(action, duration, callback) {
  animationStartTime = Date.now();
  currentMoveAction = action;
  animationDuration = duration;
  
  // Store callback to be called when animation completes
  // P5.js draw loop will handle the animation timing via drawAnimatedTiles
  currentMoveAction.callback = callback;
}

export function drawAnimatedTiles(gameState, cellSize) {
  if (!currentMoveAction) return;
  
  const elapsed = Date.now() - animationStartTime;
  const progress = Math.min(elapsed / animationDuration, 1.0);
  
  // Check if animation is complete
  if (progress >= 1.0) {
    // Animation finished - trigger callback and clean up
    const callback = currentMoveAction.callback;
    currentMoveAction = null;
    animationStartTime = 0;
    animationDuration = 0;
    
    // Call completion callback
    if (callback) {
      callback();
    }
    return; // Don't draw anything, animation is done
  }
  
  const params = currentMoveAction.action.parameters;
  const fromX = params.fromX;
  const fromY = params.fromY;
  const toX = params.targetX;
  const toY = params.targetY;
  
  // Get tile data
  const fromTile = gameState.grid[fromY][fromX];
  
  // Calculate positions - using same logic as drawGameGrid
  const startScreenX = fromX * (cellSize + window.LAYOUT.totalWidth * 0.05/16) + window.LAYOUT.totalWidth * 0.025/16;
  const startScreenY = fromY * cellSize + window.LAYOUT.totalHeight * 0.1/9;
  const endScreenX = toX * (cellSize + window.LAYOUT.totalWidth * 0.05/16) + window.LAYOUT.totalWidth * 0.025/16;
  const endScreenY = toY * cellSize + window.LAYOUT.totalHeight * 0.1/9;
  
  // Calculate arc trajectory (upside down U shape)
  const currentX = startScreenX + (endScreenX - startScreenX) * progress;
  const currentY = startScreenY + (endScreenY - startScreenY) * progress;
  
  // Add arc height - peaks at progress = 0.5
  const arcHeight = cellSize * 0.8; // Height of the jump
  const arcY = -arcHeight * Math.sin(progress * Math.PI); // Sine curve for smooth arc
  
  // Final position with arc
  const animatedX = currentX;
  const animatedY = currentY + arcY;
  
  // Add the subtle animation offset like other tiles
  const offsetX = Math.sin(frameCount * 0.005 + fromX + fromY);
  const offsetY = Math.cos(frameCount * 0.018 + fromX + fromY);
  
  // Draw the moving tile - ensure it's visible by using direct drawing
  const tileKey = `${fromX}-${fromY}`;
  if (window.tileCache && window.tileCache.has(tileKey)) {
    // Draw cached tile at animated position
    image(window.tileCache.get(tileKey), animatedX + offsetX, animatedY + offsetY);
  } else {
    // Fallback: render tile directly at animated position
    push();
    translate(animatedX + offsetX, animatedY + offsetY);
    renderTileDirectlyForAnimation(fromTile, cellSize);
    pop();
  }
  
  // Optional: Draw destination tile (static, slightly dimmed)
  const destTileKey = `${toX}-${toY}`;
  if (window.tileCache && window.tileCache.has(destTileKey)) {
    push();
    tint(255, 150); // Semi-transparent
    const destX = endScreenX + Math.sin(frameCount * 0.005 + toX + toY);
    const destY = endScreenY + Math.cos(frameCount * 0.018 + toX + toY);
    image(window.tileCache.get(destTileKey), destX, destY);
    noTint();
    pop();
  }
}

export function getAnimationInfo() {
  if (!currentMoveAction) return null;
  const params = currentMoveAction.action.parameters;
  return {
    type: 'Move',
    fromX: params.fromX,
    fromY: params.fromY,
    toX: params.targetX,
    toY: params.targetY
  };
}

function renderTileDirectlyForAnimation(tile, cellSize) {
  // Fallback rendering if cache miss
  let agent_letter = tile.owner ? tile.owner[tile.owner.length -1] : null;
  let agent_color = window.agents_color_map[agent_letter] || '#b4b4b4ff';
  
  // Simple direct rendering
  fill(agent_color);
  stroke(255);
  strokeWeight(2);
  rect(0, 0, cellSize, cellSize);
  
  if (tile.troop_power > 0) {
    fill(255);
    noStroke();
    textAlign(CENTER, CENTER);
    text(Math.floor(tile.troop_power), cellSize/2, cellSize/2);
  }
}
