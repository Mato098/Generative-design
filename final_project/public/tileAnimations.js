// Animation state
let animationStartTime = 0;
let currentAction = null;
let animationDuration = 0;

export function animateMove(actionData, duration, callback) {
  animationStartTime = Date.now();
  currentAction = {
    action: actionData.action,
    actionResult: actionData, // Store the full action result for battle effects
    callback: callback
  };
  animationDuration = duration;
}

function moveResolutionEffects(gameState, actionResult) {
  
  // Use actual server results instead of recalculating
  if (actionResult.changes && actionResult.changes.battleResults) {
    // This was an attack with server-calculated results
    const fromTile = gameState.grid[actionResult.changes.from.y][actionResult.changes.from.x];
    const toTile = gameState.grid[actionResult.changes.target.y][actionResult.changes.target.x];
    
    // Apply the exact battle results from server (SET, don't modify)
    fromTile.troop_power = actionResult.changes.battleResults.sourceAfter;
    toTile.troop_power = actionResult.changes.battleResults.targetAfter;
    
    // Handle ownership change for victory
    if (actionResult.changes.battleResults.victorystatus === 'victory') {
      toTile.owner = actionResult.changes.newOwner;
    }
  } else if (actionResult.changes && actionResult.changes.type === 'move_troops') {
    // Friendly troop movement - use exact server calculation
    const fromTile = gameState.grid[actionResult.changes.from.y][actionResult.changes.from.x];
    const toTile = gameState.grid[actionResult.changes.target.y][actionResult.changes.target.x];
    const troopsMoved = actionResult.changes.troopsMoved;
    fromTile.troop_power -= troopsMoved;
    toTile.troop_power += troopsMoved;
  }
  regenerateTileCache(actionResult);
}

function convertResolutionEffects(gameState, actionResult) {
  if (actionResult.success) {
    const tile = gameState.grid[actionResult.changes.tile.y][actionResult.changes.tile.x];
    tile.owner = actionResult.changes.newOwner;
  }
}

function updateTileCacheForAnimation(gameState, fromX, fromY, toX, toY) {
  if (!window.tileCache || !currentAction) return;
  
  const actionResult = currentAction.actionResult;
  const originalFromTile = gameState.grid[fromY][fromX];
  const originalToTile = gameState.grid[toY][toX];
  
  // Create temporary tiles with animation-appropriate troop counts
  const tempFromTile = { ...originalFromTile };
  const tempToTile = { ...originalToTile };
  
  if (actionResult.changes && actionResult.changes.battleResults) {
    // For attacks: show source tile with troops that will remain after battle
    tempFromTile.troop_power = actionResult.changes.battleResults.sourceAfter;
  } else if (actionResult.changes && actionResult.changes.type === 'move_troops') {
    // For friendly moves: show source tile with remaining troops
    tempFromTile.troop_power = originalFromTile.troop_power - actionResult.changes.troopsMoved;
  }
  
  // Update cache for both tiles with temporary troop counts
  const fromKey = `${fromX}-${fromY}`;
  const toKey = `${toX}-${toY}`;
  
  if (window.generateTileCache) {
    window.tileCache.set(fromKey, window.generateTileCache(tempFromTile));
    // Don't update target tile cache during animation - let it show original state
  }
}

function regenerateTileCache(actionResult) {
  if (!window.tileCache || !window.generateTileCache) return;
  
  // Regenerate cache for affected tiles after animation completes
  const fromKey = `${actionResult.changes.from.x}-${actionResult.changes.from.y}`;
  const toKey = `${actionResult.changes.target.x}-${actionResult.changes.target.y}`;
  
  // Force cache regeneration by deleting entries
  window.tileCache.delete(fromKey);
  window.tileCache.delete(toKey);
}


export function drawMovingTiles(gameState, cellSize) {
  if (!currentAction) return;
  
  const elapsed = Date.now() - animationStartTime;
  const progress = Math.min(elapsed / animationDuration, 1.0);

  const params = currentAction.action.parameters;
  const fromX = params.fromX;
  const fromY = params.fromY;
  const toX = params.targetX;
  const toY = params.targetY;

  // Update tile cache with animation-appropriate troop numbers
  updateTileCacheForAnimation(gameState, fromX, fromY, toX, toY);

  // Check if animation is complete
  if (progress >= 1.0) {
    // Animation finished - trigger callback and clean up
    const callback = currentAction.callback;
    animationStartTime = 0;
    animationDuration = 0;

    moveResolutionEffects(gameState, currentAction.actionResult);

    currentAction = null;
    
    // Call completion callback
    if (callback) {
      callback();
    }
    return; // Don't draw anything, animation is done
  }
  
  
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
  
  // Draw the moving troops - create a tile showing the attacking force
  const actionResult = currentAction.actionResult;
  const actionParams = currentAction.action.parameters;
  
  // Get attacking troops from action parameters
  const attackingTroops = actionParams.troops;
  
  // Create a temporary tile object representing the moving troops
  const movingTroopTile = {
    ...fromTile,
    troop_power: attackingTroops
  };
  
  // Generate and draw the moving tile
  const movingTileKey = `moving-${fromX}-${fromY}-${attackingTroops}`;
  
  // Check if we have a cached version of this moving tile
  if (!window.tileCache.has(movingTileKey)) {
    // Generate new cache entry for the moving tile using the same method as main grid
    const tileGraphics = createGraphics(cellSize, cellSize);
    // Use the globally exposed renderTileToBuffer function
    window.renderTileToBuffer(tileGraphics, movingTroopTile, cellSize);
    window.tileCache.set(movingTileKey, tileGraphics);
  }
  
  // Draw the moving tile at animated position
  if (window.tileCache.has(movingTileKey)) {
    image(window.tileCache.get(movingTileKey), animatedX + offsetX, animatedY + offsetY);
  }
  //draw remaining forces on source tile
  const remainingTroops = Math.max(Math.floor(fromTile.troop_power - attackingTroops), 0);
  textSize(cellSize * 0.17);
  text(remainingTroops, startScreenX + offsetX + cellSize * 0.5 - 2, startScreenY + offsetY + cellSize * 0.5);

  
  // Optional: Draw destination tile (static, slightly dimmed)
  const destTileKey = `${toX}-${toY}`;
  if (window.tileCache && window.tileCache.has(destTileKey)) {
    push();
    const destX = endScreenX + Math.sin(frameCount * 0.005 + toX + toY);
    const destY = endScreenY + Math.cos(frameCount * 0.018 + toX + toY);
    //image(window.tileCache.get(destTileKey), destX, destY);
    noTint();
    pop();
  }
}

export function getAnimationInfo() {
  if (!currentAction) return null;
  const params = currentAction.action.parameters;
  return {
    type: 'Move',
    fromX: params.fromX,
    fromY: params.fromY,
    toX: params.targetX,
    toY: params.targetY
  };
}

export function animateConvert(actionData, duration, callback) {
  animationStartTime = Date.now();
  currentAction = {
    action: actionData.action,
    actionResult: actionData, // Store the full action result
    callback: callback
  };
  animationDuration = duration;
  
  console.log("CONVERT ANIMATION DRAWING");
  console.log(currentAction);
}

export function drawTiles_Convert(gameState, cellSize) {
  if (!currentAction) return;
  const elapsed = Date.now() - animationStartTime;
  const progress = Math.min(elapsed / animationDuration, 1.0);// 0.0 to 1.0
  const params = currentAction.action.parameters;
  const X = params.x;
  const Y = params.y;

  let tileKey = `${X}-${Y}`;
  let tileImage = window.tileCache.get(tileKey);
  
  if (progress >= 1.0) {
    // Animation finished - trigger callback and clean up
    const callback = currentAction.callback;
    animationStartTime = 0;
    animationDuration = 0;

    convertResolutionEffects(gameState, currentAction.actionResult);

    currentAction = null;
    
    // Call completion callback
    if (callback) {
      callback();
    }
    return; // Don't draw anything, animation is done
  }

  if (currentAction.actionResult.changes.success){
    //fleeing units

    let fleeing_amount_per_tile = round(currentAction.actionResult.changes.fleeing.per_tile_amount, 1);
    let fleeToTiles = currentAction.actionResult.changes.fleeing.tiles;//{ x, y }[]

    
    image(tileImage, X * (cellSize + window.LAYOUT.totalWidth * 0.05/16) + window.LAYOUT.totalWidth * 0.025/16, Y * cellSize + window.LAYOUT.totalHeight * 0.1/9);

    // Draw fleeing troops
    for (let i = 0; i < fleeToTiles.length; i++) {
      const fleeTile = fleeToTiles[i];
      const fleeX = fleeTile.x;
      const fleeY = fleeTile.y;
      const startX = X * (cellSize + window.LAYOUT.totalWidth * 0.05/16) + window.LAYOUT.totalWidth * 0.025/16;
      const startY = Y * cellSize + window.LAYOUT.totalHeight * 0.1/9;
      const endX = fleeX * (cellSize + window.LAYOUT.totalWidth * 0.05/16) + window.LAYOUT.totalWidth * 0.025/16;
      const endY = fleeY * cellSize + window.LAYOUT.totalHeight * 0.1/9;
      const currentX = startX + (endX - startX) * progress;
      const currentY = startY + (endY - startY) * progress;

      text(fleeing_amount_per_tile, currentX + cellSize * 0.5 - 2, currentY + cellSize * 0.5);
    }
    let lightDropDown = map(progress, 0, 0.1, 0, 1, true);

    let conversionGradient_success = createLinearGradient(-PI/2, cellSize);//BLESS really
    conversionGradient_success.colors(0, "#ffeb3791",  1, "#fff0680a");
    fillGradient(conversionGradient_success);
    let tileLocation = window.tileRealLocations.get(tileKey);
    beginShape();
    vertex(lerp(tileLocation.x + cellSize * 1, tileLocation.x + cellSize * 0.05, lightDropDown), (tileLocation.y + cellSize * 0.15) * lightDropDown);
    vertex(lerp(tileLocation.x + cellSize * 1, tileLocation.x + cellSize * 0.05, lightDropDown), (tileLocation.y + cellSize * 0.85) * lightDropDown);
    vertex((tileLocation.x + cellSize * 0.95), (tileLocation.y + cellSize * 0.85) * lightDropDown);
    vertex(lerp(tileLocation.x + cellSize * 1, tileLocation.x + cellSize * 4, lightDropDown), -cellSize * 3);
    vertex(tileLocation.x + cellSize * 1, -cellSize * 3);
    endShape(CLOSE);
    
  }else{
    // Failed conversion - maybe a red X or shake effect
    fill(255, 0, 0, 150 * (1.0 - progress)); // Red color fading out
    textSize(cellSize * 0.5);
    text('X', X * cellSize + cellSize / 2 - 10, Y * cellSize + cellSize / 2 + 10);
  }
}
