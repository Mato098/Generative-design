export class ActionValidator {
  validateAction(action, gameState, playerName) {
    const faction = gameState.factions.get(playerName);
    
    // No action limits anymore - validate specific action
    switch (action.type) {
      case 'Reinforce':
        return this.validateReinforce(action, gameState, playerName);
      case 'Move':
        return this.validateMove(action, gameState, playerName);
      case 'Convert':
        return this.validateConvert(action, gameState, playerName);
      case 'Construct':
        return this.validateConstruct(action, gameState, playerName);
      case 'Sanctuary':
        return this.validateSanctuary(action, gameState, playerName);
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
    
    // Calculate dynamic cost
    let totalCost = 0;
    let currentRecruitCount = (faction.turnData && faction.turnData.troopsRecruitedThisTurn) || 0;
    
    for (let i = 0; i < amount; i++) {
      let costPerTroop;
      if (currentRecruitCount < 5) {
        costPerTroop = 1;
      } else if (currentRecruitCount < 10) {
        costPerTroop = 2;
      } else {
        costPerTroop = 3;
      }
      totalCost += costPerTroop;
      currentRecruitCount++;
    }
    
    if (!faction.canAfford({ R: totalCost })) {
      return { valid: false, error: `Insufficient resources (need ${totalCost} R)` };
    }
    
    if (tile.troop_power >= 20) {
      return { valid: false, error: 'Troop power already at maximum (20)' };
    }
    
    return { valid: true };
  }

  validateMove(action, gameState, playerName) {
    const { fromX, fromY, targetX, targetY, troops } = action.parameters;
    
    const sourceTile = gameState.getTile(fromX, fromY);
    const targetTile = gameState.getTile(targetX, targetY);
    
    // Validate coordinates
    if (!sourceTile || !targetTile) {
      return { valid: false, error: "Invalid coordinates provided" };
    }
    
    // Validate source tile ownership
    if (sourceTile.owner !== playerName) {
      return { valid: false, error: "You don't own the source tile" };
    }
    
    // Validate adjacency
    if (!this.areAdjacent(fromX, fromY, targetX, targetY)) {
      return { valid: false, error: "Target tile must be adjacent to source" };
    }
    
    // Validate troop availability
    if (sourceTile.troop_power <= 0) {
      return { valid: false, error: "Source tile has no troops to move" };
    }
    
    if (troops <= 0) {
      return { valid: false, error: "Must move at least some troops" };
    }
    
    // Check if target is owned by player (movement) or not (attack)
    if (targetTile.owner === playerName) {
      // This is a troop movement between own tiles - check capacity
      const targetCapacity = 20 - targetTile.troop_power;
      if (targetCapacity <= 0) {
        return { valid: false, error: "Target tile at maximum capacity (20 troops)" };
      }
      return { 
        valid: true, 
        moveType: 'redistribute',
        willMovePartial: troops > targetCapacity,
        maxCanMove: Math.min(troops, targetCapacity, sourceTile.troop_power)
      };
    } else {
      // This is an attack on enemy/neutral tile
      if (targetTile.effects && targetTile.effects.sanctuary && targetTile.effects.sanctuary >= gameState.turnNumber) {
        return { valid: false, error: "Cannot attack tile under divine protection" };
      }
      return { valid: true, moveType: 'assault' };
    }
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
    
    // Use Faith for conversion (3F cost)
    if (!faction.canAfford({ F: 3 })) {
      return { valid: false, error: 'Insufficient resources (need 3F)' };
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
      'Idol': { R: 3, F: 2 },
      'Training': { R: 5 },
      'Market': { R: 4 },
      'Tower': { R: 5 },
      'Fortress': { R: 10 }
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

  validateSanctuary(action, gameState, playerName) {
    const { x, y } = action.parameters;
    const tile = gameState.getTile(x, y);
    const faction = gameState.factions.get(playerName);
    
    if (!tile) {
      return { valid: false, error: 'Invalid tile coordinates' };
    }
    
    if (tile.owner !== playerName) {
      return { valid: false, error: 'Can only protect owned tiles' };
    }
    
    if (!faction.canAfford({ F: 4 })) {
      return { valid: false, error: 'Insufficient Faith (need 4 F)' };
    }
    
    // Check if tile already has sanctuary
    if (tile.effects && tile.effects.sanctuary && tile.effects.sanctuary >= gameState.turnNumber) {
      return { valid: false, error: 'Tile already protected' };
    }
    
    return { valid: true };
  }

  areAdjacent(x1, y1, x2, y2) {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  }
}