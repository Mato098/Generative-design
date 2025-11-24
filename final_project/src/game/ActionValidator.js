export class ActionValidator {
  validateAction(action, gameState, playerName, isPrimary) {
    const faction = gameState.factions.get(playerName);
    
    // Check if action type is allowed
    if (isPrimary && faction.hasUsedPrimaryAction()) {
      return { valid: false, error: 'Primary action already used this turn' };
    }
    
    if (!isPrimary && faction.hasUsedSecondaryAction()) {
      return { valid: false, error: 'Secondary action already used this turn' };
    }
    
    // Check action category conflicts
    if (!isPrimary && this.hasActionCategoryConflict(action.type, faction.actionsThisTurn.primary)) {
      return { valid: false, error: 'Secondary action conflicts with primary action category' };
    }
    
    // Validate specific action
    switch (action.type) {
      case 'Reinforce':
        return this.validateReinforce(action, gameState, playerName);
      case 'ProjectPressure':
        return this.validateProjectPressure(action, gameState, playerName);
      case 'Assault':
        return this.validateAssault(action, gameState, playerName);
      case 'Convert':
        return this.validateConvert(action, gameState, playerName);
      case 'Construct':
        return this.validateConstruct(action, gameState, playerName);
      case 'Redistribute':
        return this.validateRedistribute(action, gameState, playerName);
      case 'Repair':
        return this.validateRepair(action, gameState, playerName);
      case 'Scorch':
        return this.validateScorch(action, gameState, playerName);
      default:
        return { valid: false, error: `Unknown action type: ${action.type}` };
    }
  }

  hasActionCategoryConflict(secondaryType, primaryType) {
    // Cannot Reinforce + Repair in same turn (both affect stability/troops)
    if (secondaryType === 'Repair' && primaryType === 'Reinforce') {
      return true;
    }
    return false;
  }

  validateReinforce(action, gameState, playerName) {
    const { x, y, target } = action.parameters;
    const tile = gameState.getTile(x, y);
    const faction = gameState.factions.get(playerName);
    
    if (!tile) {
      return { valid: false, error: 'Invalid tile coordinates' };
    }
    
    if (tile.owner !== playerName) {
      return { valid: false, error: 'Can only reinforce owned tiles' };
    }
    
    if (target === 'troop_power') {
      if (!faction.canAfford({ R: 1 })) {
        return { valid: false, error: 'Insufficient resources (need 1 R)' };
      }
      if (tile.troop_power >= 50) {
        return { valid: false, error: 'Troop power already at maximum (50)' };
      }
    } else if (target === 'stability') {
      if (!faction.canAfford({ R: 2 })) {
        return { valid: false, error: 'Insufficient resources (need 2 R)' };
      }
      if (tile.stability >= 10) {
        return { valid: false, error: 'Stability already at maximum (10)' };
      }
    } else {
      return { valid: false, error: 'Invalid reinforce target (must be troop_power or stability)' };
    }
    
    return { valid: true };
  }

  validateProjectPressure(action, gameState, playerName) {
    const { fromX, fromY, targetX, targetY } = action.parameters;
    const fromTile = gameState.getTile(fromX, fromY);
    const targetTile = gameState.getTile(targetX, targetY);
    const faction = gameState.factions.get(playerName);
    
    if (!fromTile || !targetTile) {
      return { valid: false, error: 'Invalid tile coordinates' };
    }
    
    if (fromTile.owner !== playerName) {
      return { valid: false, error: 'Can only project pressure from owned tiles' };
    }
    
    if (!this.areAdjacent(fromX, fromY, targetX, targetY)) {
      return { valid: false, error: 'Tiles must be adjacent' };
    }
    
    if (!faction.canAfford({ R: 1 })) {
      return { valid: false, error: 'Insufficient resources (need 1 R)' };
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
    const { fromX, fromY, targetX, targetY, resource } = action.parameters;
    const fromTile = gameState.getTile(fromX, fromY);
    const targetTile = gameState.getTile(targetX, targetY);
    const faction = gameState.factions.get(playerName);
    
    if (!fromTile || !targetTile) {
      return { valid: false, error: 'Invalid tile coordinates' };
    }
    
    if (fromTile.owner !== playerName) {
      return { valid: false, error: 'Can only convert from owned tiles' };
    }
    
    if (targetTile.owner === playerName) {
      return { valid: false, error: 'Cannot convert own tiles' };
    }
    
    if (!this.areAdjacent(fromX, fromY, targetX, targetY)) {
      return { valid: false, error: 'Tiles must be adjacent' };
    }
    
    if (resource !== 'F' && resource !== 'I') {
      return { valid: false, error: 'Must spend Faith (F) or Influence (I)' };
    }
    
    const cost = {};
    cost[resource] = 2;
    if (!faction.canAfford(cost)) {
      return { valid: false, error: `Insufficient ${resource === 'F' ? 'Faith' : 'Influence'} (need 2)` };
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
    // Simple resource redistribution - just check if faction has the resources
    const faction = gameState.factions.get(playerName);
    const { amount, resource } = action.parameters;
    
    if (amount <= 0) {
      return { valid: false, error: 'Amount must be positive' };
    }
    
    if (!['R', 'F', 'I'].includes(resource)) {
      return { valid: false, error: 'Invalid resource type' };
    }
    
    if (faction.resources[resource] < amount) {
      return { valid: false, error: `Insufficient ${resource}` };
    }
    
    return { valid: true };
  }

  validateRepair(action, gameState, playerName) {
    const { x, y } = action.parameters;
    const tile = gameState.getTile(x, y);
    const faction = gameState.factions.get(playerName);
    
    if (!tile) {
      return { valid: false, error: 'Invalid tile coordinates' };
    }
    
    if (tile.owner !== playerName) {
      return { valid: false, error: 'Can only repair owned tiles' };
    }
    
    if (!faction.canAfford({ R: 2 })) {
      return { valid: false, error: 'Insufficient resources (need 2 R)' };
    }
    
    if (tile.stability >= 10) {
      return { valid: false, error: 'Stability already at maximum (10)' };
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
    
    if (!faction.canAfford({ R: 1 })) {
      return { valid: false, error: 'Insufficient resources (need 1 R)' };
    }
    
    if (tile.resource_value <= 0) {
      return { valid: false, error: 'Tile has no resource value to reduce' };
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