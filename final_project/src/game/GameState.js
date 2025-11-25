import { Tile } from './Tile.js';
import { Faction } from './Faction.js';

export class GameState {
  constructor() {
    this.grid = this.initializeGrid();
    this.factions = new Map();
    this.currentPlayerIndex = 0;
    this.turnNumber = 1;
    this.gameStatus = 'setup'; // 'setup', 'active', 'finished'
    this.observerActions = [];
    this.actionHistory = [];
    this.playerOrder = []; // Will include observer as last player
  }

  initializeGrid() {
    const grid = [];
    for (let y = 0; y < 10; y++) {
      const row = [];
      for (let x = 0; x < 10; x++) {
        row.push(new Tile(x, y));
      }
      grid.push(row);
    }
    return grid;
  }

  addFaction(name, personality = null) {
    const faction = new Faction(name, personality);
    this.factions.set(name, faction);
    this.playerOrder.push(name);
    return faction;
  }

  addObserver() {
    this.playerOrder.push('Observer');
  }

  getTile(x, y) {
    if (x < 0 || x >= 10 || y < 0 || y >= 10) {
      return null;
    }
    return this.grid[y][x];
  }

  getAdjacentTiles(x, y) {
    const adjacent = [];
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    
    for (const [dx, dy] of directions) {
      const tile = this.getTile(x + dx, y + dy);
      if (tile) {
        adjacent.push(tile);
      }
    }
    
    return adjacent;
  }

  getCurrentPlayer() {
    if (this.playerOrder.length === 0) return null;
    const currentPlayerName = this.playerOrder[this.currentPlayerIndex];
    return currentPlayerName === 'Observer' ? 'Observer' : this.factions.get(currentPlayerName);
  }

  getCurrentPlayerName() {
    return this.playerOrder[this.currentPlayerIndex];
  }

  isObserverTurn() {
    return this.getCurrentPlayerName() === 'Observer';
  }

  nextPlayer() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerOrder.length;
    
    // If we've cycled back to first player, increment turn
    if (this.currentPlayerIndex === 0) {
      this.turnNumber++;
      // DON'T clear observer actions yet - AI agents need to see them
      // They'll be cleared after all AI agents have processed them
    }
  }

  clearObserverActions() {
    // Called after all AI agents have processed the observer actions
    this.observerActions = [];
  }

  applyPassiveIncome() {
    for (const [name, faction] of this.factions) {
      let totalIncome = { R: 0, F: 0 };
      
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const tile = this.grid[y][x];
          if (tile.owner === name) {
            const income = tile.getTurnIncome();
            totalIncome.R += income.R;
            totalIncome.F += income.F;
          }
        }
      }
      
      faction.addResources(totalIncome.R, totalIncome.F, 0);
    }
  }

  getOwnedTiles(factionName) {
    const tiles = [];
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const tile = this.grid[y][x];
        if (tile.owner === factionName) {
          tiles.push(tile);
        }
      }
    }
    return tiles;
  }

  checkVictoryConditions() {
    const totalTiles = 100;
    const factionNames = Array.from(this.factions.keys());
    
    // Domination: >50% tiles for 2 continuous turns
    for (const name of factionNames) {
      const ownedTiles = this.getOwnedTiles(name).length;
      if (ownedTiles > totalTiles / 2) {
        return { type: 'domination', winner: name };
      }
    }
    
    // Devotion: highest Faith at turn 40
    if (this.turnNumber >= 40) {
      let highestFaith = -1;
      let winner = null;
      
      for (const [name, faction] of this.factions) {
        if (faction.resources.F > highestFaith) {
          highestFaith = faction.resources.F;
          winner = name;
        }
      }
      
      return { type: 'devotion', winner };
    }
    
    // Prestige: most buildings at turn 30
    if (this.turnNumber >= 30) {
      const buildingCounts = new Map();
      
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          const tile = this.grid[y][x];
          if (tile.building !== 'none' && tile.owner !== 'Neutral') {
            buildingCounts.set(tile.owner, (buildingCounts.get(tile.owner) || 0) + 1);
          }
        }
      }
      
      let maxBuildings = -1;
      let winner = null;
      
      for (const [name, count] of buildingCounts) {
        if (count > maxBuildings) {
          maxBuildings = count;
          winner = name;
        }
      }
      
      if (winner) {
        return { type: 'prestige', winner };
      }
    }
    
    return null;
  }

  addObserverAction(action) {
    this.observerActions.push(action);
  }

  getObserverActionsForTurn() {
    return [...this.observerActions];
  }

  clone() {
    const newState = new GameState();
    
    // Clone grid
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        newState.grid[y][x] = this.grid[y][x].clone();
      }
    }
    
    // Clone factions
    for (const [name, faction] of this.factions) {
      newState.factions.set(name, faction.clone());
    }
    
    newState.currentPlayerIndex = this.currentPlayerIndex;
    newState.turnNumber = this.turnNumber;
    newState.gameStatus = this.gameStatus;
    newState.observerActions = [...this.observerActions];
    newState.actionHistory = [...this.actionHistory];
    newState.playerOrder = [...this.playerOrder];
    
    return newState;
  }

  toJSON() {
    return {
      grid: this.grid,
      factions: Object.fromEntries(this.factions),
      currentPlayer: this.getCurrentPlayerName(),
      turnNumber: this.turnNumber,
      gameStatus: this.gameStatus,
      observerActions: this.observerActions,
      playerOrder: this.playerOrder
    };
  }
}