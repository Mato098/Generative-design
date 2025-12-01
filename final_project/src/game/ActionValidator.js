export class ActionValidator {
  validateAction(action, gameState, playerName) {
    const faction = gameState.factions.get(playerName);
    
    // No action limits anymore - validate specific action
    switch (action.type) {
      case 'Reinforce':
        return this.validateReinforce(action, gameState, playerName);
      case 'Assault':
        return this.validateAssault(action, gameState, playerName);
      case 'Convert':
        return this.validateConvert(action, gameState, playerName);
      case 'Construct':
        return this.validateConstruct(action, gameState, playerName);
      case 'Redistribute':
        return this.validateRedistribute(action, gameState, playerName);
      case 'Scorch':
        return this.validateScorch(action, gameState, playerName);
      default:
        return { valid: false, error: `Unknown action type: ${action.type}` };
    }
  }

  validateReinforce(action, gameState, playerName) {
    const { x, y, amount = 1 } = action.parameters;
    const tile = gameState.getTile(x, y);
    const faction = gameState.factions.get(playerName);
    
    if (!tile) {
      return { valid: false, error: 'Invalid tile coordinates' };
    }
    
    if (tile.owner !== playerName) {
      return { valid: false, error: 'Can only recruit troops on owned tiles' };
    }
    
    if (amount < 1) {
      return { valid: false, error: 'Amount must be at least 1' };
    }
    
    const cost = amount; // 1R per troop
    if (!faction.canAfford({ R: cost })) {
      return { valid: false, error: `Insufficient resources (need ${cost} R)` };
    }
    
    if (tile.troop_power >= 50) {
      return { valid: false, error: 'Troop power already at maximum (50)' };
    }
    
    return { valid: true };
  }

  validateAssault(action, gameState, playerName) {
    const { fromX, fromY, targetX, targetY } = action.parameters;
    const fromTile = gameState.getTile(fromX, fromY);
    const targetTile = gameState.getTile(targetX, targetY);
    const faction = gameState.factions.get(playerName);
    
    if (!fromTile || !targetTile) {
      return { valid: false, error: 'Invalid tile coordinates' };
    }
    
    if (fromTile.owner !== playerName) {
      return { valid: false, error: 'Can only assault from owned tiles' };
    }
    
    if (targetTile.owner === playerName) {
      return { valid: false, error: 'Cannot assault own tiles' };
    }
    
    if (!this.areAdjacent(fromX, fromY, targetX, targetY)) {
      return { valid: false, error: 'Tiles must be adjacent' };
    }
    
    if (!faction.canAfford({ R: 1 })) {
      return { valid: false, error: 'Insufficient resources (need 1 R)' };
    }
    
    if (fromTile.troop_power <= 0) {
      return { valid: false, error: 'No troops available for assault' };
    }
    
    return { valid: true };
  }

  validateConvert(action, gameState, playerName) {
    const { x, y } = action.parameters;
    const targetTile = gameState.getTile(x, y);
    const faction = gameState.factions.get(playerName);
    
    if (!targetTile) {
      return { valid: false, error: 'Invalid tile coordinates' };
    }
    
    if (targetTile.owner === playerName) {
      return { valid: false, error: 'Cannot convert own tiles' };
    }
    
    // Check if player has an adjacent tile to convert from
    let hasAdjacentTile = false;
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    for (const [dx, dy] of directions) {
      const adjX = x + dx;
      const adjY = y + dy;
      if (adjX >= 0 && adjX < 10 && adjY >= 0 && adjY < 10) {
        const adjTile = gameState.getTile(adjX, adjY);
        if (adjTile && adjTile.owner === playerName) {
          hasAdjacentTile = true;
          break;
        }
      }
    }
    
    if (!hasAdjacentTile) {
      return { valid: false, error: 'Must have adjacent tile to convert from' };
    }
    
    // Use Faith by default for conversion (2F + 1I cost)
    if (!faction.canAfford({ F: 2, I: 1 })) {
      return { valid: false, error: 'Insufficient resources (need 2F + 1I)' };
    }
    
    return { valid: true };
  }

  validateConstruct(action, gameState, playerName) {
    const { x, y, building } = action.parameters;
    const tile = gameState.getTile(x, y);
    const faction = gameState.factions.get(playerName);
    
    if (!tile) {
      return { valid: false, error: 'Invalid tile coordinates' };
    }
    
    if (tile.owner !== playerName) {
      return { valid: false, error: 'Can only construct on owned tiles' };
    }
    
    if (tile.building !== 'none') {
      return { valid: false, error: 'Tile already has a building' };
    }
    
    const buildingCosts = {
      'Shrine': { R: 5 },
      'Idol': { R: 3 },
      'Training': { R: 4 },
      'Market': { R: 3 },
      'Tower': { R: 4 },
      'Fortress': { R: 6 }
    };
    
    const cost = buildingCosts[building];
    if (!cost) {
      return { valid: false, error: 'Invalid building type' };
    }
    
    if (!faction.canAfford(cost)) {
      return { valid: false, error: `Insufficient resources (need ${cost.R} R)` };
    }
    
    return { valid: true };
  }

  validateRedistribute(action, gameState, playerName) {
    // Troop redistribution between tiles
    const { fromX, fromY, toX, toY, amount } = action.parameters;
    
    // Validate coordinates
    if (!this.isValidCoordinate(fromX, fromY) || !this.isValidCoordinate(toX, toY)) {
      return { valid: false, error: 'Invalid coordinates' };
    }
    
    const fromTile = gameState.getTile(fromX, fromY);
    const toTile = gameState.getTile(toX, toY);
    
    // Check ownership
    if (fromTile.owner !== playerName || toTile.owner !== playerName) {
      return { valid: false, error: 'Can only redistribute between your own tiles' };
    }
    
    // Check amount
    if (amount <= 0) {
      return { valid: false, error: 'Amount must be positive' };
    }
    
    if (fromTile.troop_power < amount) {
      return { valid: false, error: 'Insufficient troops to transfer' };
    }
    
    return { valid: true };
  }

  validateScorch(action, gameState, playerName) {
    const { x, y } = action.parameters;
    const tile = gameState.getTile(x, y);
    const faction = gameState.factions.get(playerName);
    
    if (!tile) {
      return { valid: false, error: 'Invalid tile coordinates' };
    }
    
    if (tile.owner === playerName) {
      return { valid: false, error: 'Cannot scorch own tiles' };
    }
    
    if (tile.owner === 'Neutral') {
      return { valid: false, error: 'Cannot scorch neutral tiles' };
    }
    
    if (!faction.canAfford({ R: 2 })) {
      return { valid: false, error: 'Insufficient resources (need 2 R)' };
    }
    
    if (tile.troop_power <= 0) {
      return { valid: false, error: 'No troops to scorch' };
    }
    
    // Check if tile is adjacent to any owned tile
    const adjacent = gameState.getAdjacentTiles(x, y);
    const hasAdjacentOwned = adjacent.some(t => t.owner === playerName);
    
    if (!hasAdjacentOwned) {
      return { valid: false, error: 'Must target adjacent enemy tile' };
    }
    
    return { valid: true };
  }

  areAdjacent(x1, y1, x2, y2) {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  }
}