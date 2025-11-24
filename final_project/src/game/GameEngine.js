import { GameState } from './GameState.js';
import { ActionValidator } from './ActionValidator.js';
import { AIAgent } from '../ai/AIAgent.js';

export class GameEngine {
  constructor() {
    this.gameState = new GameState();
    this.validator = new ActionValidator();
    this.agents = new Map(); // Map of faction name to AIAgent
    this.broadcastFunction = null;
    this.isProcessingTurn = false;
  }

  setBroadcastFunction(broadcastFn) {
    this.broadcastFunction = broadcastFn;
  }

  async startGame(agentConfigs = []) {
    // Initialize factions and agents
    for (const config of agentConfigs) {
      const faction = this.gameState.addFaction(config.name, config.personality);
      const agent = new AIAgent(config.name, config.personality, config.apiKey);
      this.agents.set(config.name, agent);
    }
    
    // Add observer as last player
    this.gameState.addObserver();
    
    // Initialize starting positions and resources
    this.initializeStartingPositions();
    
    this.gameState.gameStatus = 'active';
    
    // Start first turn
    this.processNextTurn();
  }

  initializeStartingPositions() {
    const factionNames = Array.from(this.agents.keys());
    
    // Place starting units for each faction in corners
    const startingPositions = [
      [1, 1], // Faction A
      [8, 8], // Faction B
      [1, 8], // Faction C (if exists)
      [8, 1]  // Faction D (if exists)
    ];
    
    for (let i = 0; i < factionNames.length && i < startingPositions.length; i++) {
      const [x, y] = startingPositions[i];
      const tile = this.gameState.getTile(x, y);
      if (tile) {
        tile.owner = factionNames[i];
        tile.troop_power = 5;
        tile.stability = 8;
      }
    }
  }

  async processNextTurn() {
    if (this.isProcessingTurn) return;
    this.isProcessingTurn = true;
    
    try {
      const currentPlayerName = this.gameState.getCurrentPlayerName();
      
      // Check if it's observer turn
      if (this.gameState.isObserverTurn()) {
        // Wait for observer actions (human input)
        this.broadcastToClients({
          type: 'observerTurnStarted',
          data: {
            gameState: this.gameState.toJSON(),
            turnNumber: this.gameState.turnNumber
          }
        });
        return; // Observer turn is handled by human input
      }
      
      // Apply passive income at start of faction turn
      if (this.gameState.currentPlayerIndex === 0) {
        this.gameState.applyPassiveIncome();
      }
      
      const currentFaction = this.gameState.getCurrentPlayer();
      currentFaction.startTurn();
      
      // Get AI agent and process turn
      const agent = this.agents.get(currentPlayerName);
      if (!agent) {
        throw new Error(`No agent found for faction: ${currentPlayerName}`);
      }
      
      // Generate context for AI
      const context = this.generateAIContext();
      
      // Get actions from AI
      const actions = await agent.getTurnActions(context);
      
      // Execute actions and get action list for visualization
      const executedActions = await this.executePlayerActions(actions, currentPlayerName);
      
      // End current player's turn
      currentFaction.endTurn();
      
      // Broadcast executed actions for visualization
      this.broadcastToClients({
        type: 'actionsExecuted',
        data: {
          player: currentPlayerName,
          actions: executedActions,
          newGameState: this.gameState.toJSON()
        }
      });
      
      // Move to next player
      this.gameState.nextPlayer();
      
      // Check victory conditions
      const victory = this.gameState.checkVictoryConditions();
      if (victory) {
        this.gameState.gameStatus = 'finished';
        this.broadcastToClients({
          type: 'gameEnded',
          data: victory
        });
        return;
      }
      
      // Continue to next turn after a brief delay
      setTimeout(() => {
        this.isProcessingTurn = false;
        this.processNextTurn();
      }, 1000);
      
    } catch (error) {
      console.error('Error processing turn:', error);
      this.isProcessingTurn = false;
    }
  }

  generateAIContext() {
    const currentPlayerName = this.gameState.getCurrentPlayerName();
    const currentFaction = this.gameState.getCurrentPlayer();
    
    return {
      gameState: this.gameState.toJSON(),
      playerName: currentPlayerName,
      playerResources: currentFaction.resources,
      ownedTiles: this.gameState.getOwnedTiles(currentPlayerName),
      turnNumber: this.gameState.turnNumber,
      observerActionsLastTurn: this.gameState.getObserverActionsForTurn(),
      availableActions: this.getAvailableActions(currentPlayerName)
    };
  }

  getAvailableActions(playerName) {
    const faction = this.gameState.factions.get(playerName);
    const ownedTiles = this.gameState.getOwnedTiles(playerName);
    
    const available = {
      primary: [],
      secondary: []
    };
    
    // Primary actions (if not used)
    if (!faction.hasUsedPrimaryAction()) {
      available.primary = ['Reinforce', 'ProjectPressure', 'Assault', 'Convert', 'Construct'];
    }
    
    // Secondary actions (if not used and not same category as primary)
    if (!faction.hasUsedSecondaryAction()) {
      available.secondary = ['Redistribute', 'Repair', 'Scorch', 'Message'];
    }
    
    return available;
  }

  async executePlayerActions(actions, playerName) {
    const executedActions = [];
    
    // Execute primary action
    if (actions.primary) {
      const result = await this.executeAction(actions.primary, playerName, true);
      if (result.success) {
        executedActions.push(result);
      } else {
        console.log(`Primary action rejected for ${playerName}:`, result.error);
      }
    }
    
    // Execute secondary action
    if (actions.secondary) {
      const result = await this.executeAction(actions.secondary, playerName, false);
      if (result.success) {
        executedActions.push(result);
      } else {
        console.log(`Secondary action rejected for ${playerName}:`, result.error);
      }
    }
    
    return executedActions;
  }

  async executeAction(action, playerName, isPrimary) {
    try {
      // Validate action
      const validation = this.validator.validateAction(action, this.gameState, playerName, isPrimary);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          action: action
        };
      }
      
      // Execute action and get state changes
      const beforeState = this.gameState.clone();
      const changes = this.applyAction(action, playerName, isPrimary);
      
      // Record action
      this.gameState.actionHistory.push({
        player: playerName,
        action: action,
        turn: this.gameState.turnNumber,
        timestamp: Date.now()
      });
      
      return {
        success: true,
        action: action,
        changes: changes,
        beforeState: beforeState.toJSON(),
        afterState: this.gameState.toJSON()
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        action: action
      };
    }
  }

  applyAction(action, playerName, isPrimary) {
    const faction = this.gameState.factions.get(playerName);
    faction.recordAction(action.type, isPrimary);
    
    // Apply action based on type
    switch (action.type) {
      case 'Reinforce':
        return this.applyReinforceAction(action, playerName);
      case 'ProjectPressure':
        return this.applyProjectPressureAction(action, playerName);
      case 'Assault':
        return this.applyAssaultAction(action, playerName);
      case 'Convert':
        return this.applyConvertAction(action, playerName);
      case 'Construct':
        return this.applyConstructAction(action, playerName);
      case 'Redistribute':
        return this.applyRedistributeAction(action, playerName);
      case 'Repair':
        return this.applyRepairAction(action, playerName);
      case 'Scorch':
        return this.applyScorchAction(action, playerName);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  // Action implementation methods (to be implemented)
  applyReinforceAction(action, playerName) {
    const tile = this.gameState.getTile(action.parameters.x, action.parameters.y);
    const faction = this.gameState.factions.get(playerName);
    
    if (action.parameters.target === 'troop_power') {
      faction.spendResources({ R: 1 });
      const oldPower = tile.troop_power;
      tile.troop_power += (tile.building === 'Training' ? 2 : 1);
      tile.troop_power = Math.min(tile.troop_power, 50); // Cap at 50
      
      return {
        type: 'troop_power_change',
        tile: { x: tile.x, y: tile.y },
        oldValue: oldPower,
        newValue: tile.troop_power
      };
    } else if (action.parameters.target === 'stability') {
      faction.spendResources({ R: 2 });
      const oldStability = tile.stability;
      tile.stability = Math.min(tile.stability + 1, 10);
      
      return {
        type: 'stability_change',
        tile: { x: tile.x, y: tile.y },
        oldValue: oldStability,
        newValue: tile.stability
      };
    }
  }

  // ... other action implementations will be added

  broadcastToClients(message) {
    if (this.broadcastFunction) {
      this.broadcastFunction(message);
    }
  }

  getState() {
    return this.gameState.toJSON();
  }

  getActionHistory() {
    return this.gameState.actionHistory;
  }

  // Observer methods
  async executeObserverAction(action) {
    // Observer actions are executed immediately and added to next turn context
    this.gameState.addObserverAction(action);
    
    // Apply observer action to game state
    const changes = this.applyObserverAction(action);
    
    // Move to next turn (back to factions)
    this.gameState.nextPlayer();
    
    // Continue game
    this.isProcessingTurn = false;
    this.processNextTurn();
    
    return {
      success: true,
      action: action,
      changes: changes
    };
  }

  applyObserverAction(action) {
    // Implementation of observer/god powers
    switch (action.type) {
      case 'Smite':
        const tile = this.gameState.getTile(action.parameters.x, action.parameters.y);
        tile.troop_power = 0;
        tile.stability = Math.max(0, tile.stability - 3);
        return { type: 'smite', tile: { x: tile.x, y: tile.y } };
        
      case 'Bless':
        const blessedTile = this.gameState.getTile(action.parameters.x, action.parameters.y);
        blessedTile.stability = 10;
        if (blessedTile.owner !== 'Neutral') {
          const faction = this.gameState.factions.get(blessedTile.owner);
          faction.addResources(0, 2, 0);
        }
        return { type: 'bless', tile: { x: blessedTile.x, y: blessedTile.y } };
        
      // ... other observer actions
      
      default:
        throw new Error(`Unknown observer action: ${action.type}`);
    }
  }
}