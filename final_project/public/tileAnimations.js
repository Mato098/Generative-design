// Animation state
let animationStartTime = 0;
let currentAction = null;
let animationDuration = 0;

export function animateUniversal(actionData, duration, callback) {
  animationStartTime = Date.now();
  currentAction = {
    action: actionData.action,
    actionResult: actionData, // Store the full action result
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

function constructResolutionEffects(gameState, actionResult) {
  if (actionResult.success) {
    const tile = gameState.grid[actionResult.changes.tile.y][actionResult.changes.tile.x];
    tile.building = actionResult.changes.newBuilding;
  }
}

function convertResolutionEffects(gameState, actionResult) {
  if (actionResult.success) {
    const tile = gameState.grid[actionResult.changes.tile.y][actionResult.changes.tile.x];
    tile.owner = actionResult.changes.newOwner;
  }
}

function blessResolutionEffects(gameState, actionResult) {
  if (actionResult.success) {
    const tile = gameState.grid[actionResult.changes.tile.y][actionResult.changes.tile.x];
    tile.building = 'Shrine';
    if (tile.owner !== 'Neutral') gameState.factions[tile.owner].resources.F += 5;
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

export function drawTilesBless(gameState, cellSize) {
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

    blessResolutionEffects(gameState, currentAction.actionResult);

    currentAction = null;
    
    // Call completion callback
    if (callback) {
      callback();
    }
    return; // Don't draw anything, animation is done
  }    
    image(tileImage, X * (cellSize + window.LAYOUT.totalWidth * 0.05/16) + window.LAYOUT.totalWidth * 0.025/16, Y * cellSize + window.LAYOUT.totalHeight * 0.1/9);

    let lightDropDown = map(progress, 0, 0.1, 0, 1, true);

    let blessGradient = createLinearGradient(-PI/2, cellSize);
    blessGradient.colors(0, "#ffeb3791",  1, "#fff0680a");
    fillGradient(blessGradient);
    let tileLocation = window.tileRealLocations.get(tileKey);
    beginShape();
    vertex(lerp(tileLocation.x + cellSize * 1, tileLocation.x + cellSize * 0.05, lightDropDown), (tileLocation.y + cellSize * 0.15) * lightDropDown);
    vertex(lerp(tileLocation.x + cellSize * 1, tileLocation.x + cellSize * 0.05, lightDropDown), (tileLocation.y + cellSize * 0.85) * lightDropDown);
    vertex((tileLocation.x + cellSize * 0.95), (tileLocation.y + cellSize * 0.85) * lightDropDown);
    vertex(lerp(tileLocation.x + cellSize * 1, tileLocation.x + cellSize * 4, lightDropDown), -cellSize * 3);
    vertex(tileLocation.x + cellSize * 1, -cellSize * 3);
    endShape(CLOSE);
  
}

export function drawTilesConvert(gameState, cellSize) {
  if (!currentAction) return;
  const elapsed = Date.now() - animationStartTime;
  const progress = Math.min(elapsed / animationDuration, 1.0);// 0.0 to 1.0
  const params = currentAction.action.parameters;
  const X = params.x;
  const Y = params.y;
  console.log("DRAW CONVERT ANIMATION", X, Y, progress);
  console.log(currentAction.actionResult);

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
  }

  let tileLocation = window.tileRealLocations.get(tileKey);

  noStroke();

  let dropdownSpeed = 0.05;
  let lightDropDown = map(progress, 0, dropdownSpeed, 0, 1, true);
  if (progress > 1 - dropdownSpeed){
    lightDropDown = map(progress, 1 - dropdownSpeed, 1.0, 1, 0, true);
  }
  let playerName = currentAction.actionResult.beforeState.currentPlayer;
  let col = color(window.agents_color_map[playerName.slice(-1)])
  col.setAlpha(150);
  if (!currentAction.actionResult.changes.success) col = lerpColor(col, color("#616161a8"), progress);
  let colAlpha = col;
  colAlpha.setAlpha(1);

  //REDO rect 'towers' on borders of tile raise and fall. possibly w gradients
  
  let convertGradient = createLinearGradient(-PI/2, cellSize);
  convertGradient.colors(0, col, 1, colAlpha);
  fillGradient(convertGradient);
  push();
  translate(tileLocation.x + cellSize * 0.05, (tileLocation.y + cellSize * 0.85));

  beginShape();
  vertex(0, cellSize * -1);
  vertex(0, 0);
  vertex(cellSize * 0.8, 0);

  vertex(lerp(cellSize * 0.8, tileLocation.x + cellSize * 2.85, lightDropDown), lerp(0, cellSize * -2, lightDropDown));
  vertex(lerp(0, cellSize * 0.50, lightDropDown), lerp((cellSize * -1 ,tileLocation.y + cellSize * -2, lightDropDown))); 
  endShape(CLOSE);
  pop();
  
  
  
}

export function drawTilesConstruct(gameState, cellSize, font_size) {
  if (!currentAction) return;
  const elapsed = Date.now() - animationStartTime;
  const progress = Math.min(elapsed / animationDuration, 1.0);
  const params = currentAction.action.parameters;
  const X = params.x;
  const Y = params.y;
  let tileKey = `${X}-${Y}`;
  let tileImage = window.tileCache.get(tileKey);
  if (progress >= 1.0) {
    const callback = currentAction.callback;
    animationStartTime = 0;
    animationDuration = 0;
    constructResolutionEffects(gameState, currentAction.actionResult);
    currentAction = null;
    if (callback) {
      callback();
    }
    return;
  }
  image(tileImage, X * (cellSize + window.LAYOUT.totalWidth * 0.05/16) + window.LAYOUT.totalWidth * 0.025/16, Y * cellSize + window.LAYOUT.totalHeight * 0.1/9);
  //add letters of the building, new letter is always bigger and white

  let col = window.agents_color_map[gameState.grid[Y][X].owner.slice(-1)] || '#888888ff';
  let bleedCol = window.bleedLerpColor(color(col), 0.5);

  let buildingName = currentAction.action.parameters.building;
  textAlign(LEFT, CENTER);
  const screentextStartX = X * cellSize + LAYOUT.totalWidth * 0.125/16 + cellSize / 2 - (textWidth(buildingName) / 2);
  const screenStartY = Y * cellSize + LAYOUT.totalHeight * 0.1/9 + cellSize * 0.75;

  let newLetterIdx = floor(map(progress, 0, 0.8, 0, 1, true) * buildingName.length) - 1;
  let newLetter = buildingName.charAt(newLetterIdx);
  let lettersAlreadyDrawn = buildingName.substring(0, newLetterIdx);

  fill(col);
  stroke(bleedCol);
  strokeWeight(2);
  textSize(font_size);
  text(lettersAlreadyDrawn, screentextStartX, screenStartY);
  
  fill(255, 255, 255);
  let drawnWidth = textWidth(lettersAlreadyDrawn);
  textSize(font_size * 1.5);  
  text(newLetter, screentextStartX + drawnWidth + 2, screenStartY);
  textSize(font_size);
}