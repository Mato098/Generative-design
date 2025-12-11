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
    this.agentMessages = []; // { sender, turn, text }
  }
  /**
   * Log a message sent by an agent (for inter-agent communication)
   * @param {string} sender - Faction name
   * @param {number} turn - Turn number
   * @param {string} text - Message text
   */
  addAgentMessage(sender, turn, text) {
    this.agentMessages.push({ sender, turn, text });
  }

  /**
   * Get the last message from each other agent (excluding the requesting agent)
   * @param {string} excludeSender - Faction name to exclude
   * @returns {Array<{sender, turn, text}>}
   */
  getLastMessagesFromOtherAgents(excludeSender) {
    const lastMessages = {};
    // Traverse in reverse to get most recent first
    for (let i = this.agentMessages.length - 1; i >= 0; i--) {
      const msg = this.agentMessages[i];
      if (msg.sender !== excludeSender && !lastMessages[msg.sender]) {
        lastMessages[msg.sender] = msg;
      }
    }
    return Object.values(lastMessages);
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

  // Observer is no longer in turn order - can act anytime

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
      if (x + dx < 0 || x + dx >= this.grid[0].length || y + dy < 0 || y + dy >= this.grid.length) {
        continue;
      }
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
    return this.factions.get(currentPlayerName);
  }

  getCurrentPlayerName() {
    return this.playerOrder[this.currentPlayerIndex];
  }

  nextPlayer() {
    console.log(`🔄 Before nextPlayer: Turn ${this.turnNumber}, Player ${this.currentPlayerIndex} (${this.playerOrder[this.currentPlayerIndex]})`);
    
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerOrder.length;
    
    // If we've cycled back to first player, increment turn
    if (this.currentPlayerIndex === 0) {
      this.turnNumber++;
      console.log(`📈 Turn incremented to ${this.turnNumber}`);
      // DON'T clear observer actions yet - AI agents need to see them
      // They'll be cleared after all AI agents have processed them
    }
    
    console.log(`🔄 After nextPlayer: Turn ${this.turnNumber}, Player ${this.currentPlayerIndex} (${this.playerOrder[this.currentPlayerIndex]})`);
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
    const factionNames = Array.from(this.factions.keys());
    const activeFactions = [];
    
    // Check which factions still have tiles
    for (const name of factionNames) {
      const ownedTiles = this.getOwnedTiles(name).length;
      if (ownedTiles > 0) {
        activeFactions.push(name);
      }
    }
    
    // Victory by elimination - only one faction remains
    if (activeFactions.length === 1) {
      return { type: 'elimination', winner: activeFactions[0] };
    }
    
    // Fallback: Domination after turn 50 (very long games)
    if (this.turnNumber >= 50) {
      let mostTiles = -1;
      let winner = null;
      
      for (const name of factionNames) {
        const ownedTiles = this.getOwnedTiles(name).length;
        if (ownedTiles > mostTiles) {
          mostTiles = ownedTiles;
          winner = name;
        }
      }
      
      if (winner && mostTiles > 0) {
        return { type: 'domination', winner };
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
      playerOrder: this.playerOrder,
      agentMessages: this.agentMessages
    };
  }
}