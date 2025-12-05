import { GameState } from './GameState.js';
import { ActionValidator } from './ActionValidator.js';
import { AIAgent } from '../ai/AIAgent.js';
import { PersonalityEvolver } from '../ai/PersonalityEvolver.js';

export class GameEngine {
  constructor() {
    this.gameState = new GameState();
    this.validator = new ActionValidator();
    this.agents = new Map(); // Map of faction name to AIAgent
    this.broadcastFunction = null;
    this.isProcessingTurn = false;
    this.personalityEvolver = new PersonalityEvolver();
    this.currentAIAbortController = null; // For canceling AI requests
    this.observerActionQueue = []; // Queue for observer actions during turns/animations
    this.isWaitingForAnimation = false;
    this.pendingPersonalityEvolution = null; // Track ongoing personality evolution
  }

  setBroadcastFunction(broadcastFn) {
    this.broadcastFunction = broadcastFn;
  }

  async startGame(agentConfigs = []) {
    // Clear existing agents
    this.agents.clear();
    this.gameState = new GameState();
    
    // Initialize factions and agents
    for (const config of agentConfigs) {
      console.log('Creating agent with config:', config);
      const faction = this.gameState.addFaction(config.name, config.personality);
      const agent = new AIAgent(config.name, config.personality, config.apiKey || undefined);
      this.agents.set(config.name, agent);
    }
    
    // Observer is not in turn order - can act anytime
    
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
        tile.troop_power = 10; // Starting troops
      }
    }
  }

  async processNextTurn() {
    if (this.isProcessingTurn) return;
    this.isProcessingTurn = true;
    
    try {
      const currentPlayerName = this.gameState.getCurrentPlayerName();
      
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
      
      // Create abort controller for this AI request
      this.currentAIAbortController = new AbortController();
      
      // Get actions from AI (can be interrupted)
      const executedActions = await this.processFactionTurn(currentPlayerName, this.currentAIAbortController.signal);
      
      // Clear abort controller
      this.currentAIAbortController = null;
      
      // If turn was aborted, don't continue
      if (!executedActions) {
        this.isProcessingTurn = false;
        return;
      }
      
      // End current player's turn
      currentFaction.endTurn();
      
      // Broadcast executed actions for visualization
      this.isWaitingForAnimation = true;
      this.broadcastToClients({
        type: 'actionsExecuted',
        data: {
          player: currentPlayerName,
          actions: executedActions,
          newGameState: this.gameState.toJSON()
        }
      });
      
      // If there are no actual actions to animate, continue immediately
      if (executedActions.length === 0) {
        console.log('⏭️ No actions to animate, continuing immediately');
        this.isWaitingForAnimation = false;
        setTimeout(() => {
          this.isProcessingTurn = false;
          this.processNextTurn();
        }, 500);
        return;
      }
      
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
      
      // Wait for animations to complete before next turn
      // Client will call continueAfterAnimation() when done
      
    } catch (error) {
      console.error('Error processing turn:', error);
      this.isProcessingTurn = false;
      this.currentAIAbortController = null;
    }
  }

  async processFactionTurn(factionName, abortSignal) {
    const faction = this.gameState.factions.get(factionName);
    if (!faction || !faction.isActive) return [];
    
    // Faction turn start
    const ownedTiles = this.gameState.getOwnedTiles(factionName);
    console.log(`\n🏛️ ${factionName} T${this.gameState.turnNumber} | ${ownedTiles.length} tiles | R:${faction.resources.R.toFixed(0)} F:${faction.resources.F.toFixed(0)} I:${faction.resources.I.toFixed(0)}`);
    
    // Wait for any pending personality evolution to complete
    if (this.pendingPersonalityEvolution) {
      console.log(`⏳ Waiting for personality evolution to complete before ${factionName}'s turn...`);
      await this.pendingPersonalityEvolution;
      this.pendingPersonalityEvolution = null;
      console.log(`✅ Personality evolution complete, ${factionName} proceeding with updated traits`);
    }
    
    const aiAgent = this.agents.get(factionName);
    const context = this.buildAIContext(factionName);
    
    try {
      const decisions = await aiAgent.getTurnActions(context, abortSignal);
      
      const executedActions = [];
      
      // Process all actions
      if (decisions.actions && Array.isArray(decisions.actions)) {
        console.log(`📋 ${decisions.actions.length} actions:`);
        for (const action of decisions.actions) {
          const result = await this.executeAction(action, factionName);
          if (result.success) {
            executedActions.push(result);
            console.log(`✅ ${action.type}: ${action.blurb}`);
          } else {
            console.log(`❌ ${action.type}: ${result.error}`);
          }
        }
      }
      
      // Handle ruler's message
      if (decisions.message) {
        console.log(`💬 "${decisions.message}"`);
        executedActions.push({
          success: true,
          action: { type: 'Message', parameters: { text: decisions.message } },
          changes: { type: 'ruler_declaration', message: decisions.message }
        });
      }
      
      return executedActions;
    } catch (error) {
      // If aborted, return null to signal interruption
      if (error.name === 'AbortError') {
        console.log(`⚡ ${factionName}'s turn interrupted by divine intervention`);
        return null;
      }
      throw error;
    }
  }

  // Called when client finishes animating actions
  continueAfterAnimation() {
    this.isWaitingForAnimation = false;
    
    // Process any queued observer actions first
    if (this.observerActionQueue.length > 0) {
      const queuedActions = [...this.observerActionQueue];
      this.observerActionQueue = [];
      
      console.log(`⚡ Processing ${queuedActions.length} queued divine actions`);
      
      for (const action of queuedActions) {
        this.executeObserverActionImmediate(action);
      }
      
      // Broadcast queued actions
      this.broadcastToClients({
        type: 'actionsExecuted',
        data: {
          player: 'Observer',
          actions: queuedActions.map(a => ({
            success: true,
            action: a,
            changes: { type: a.type }
          })),
          newGameState: this.gameState.toJSON()
        }
      });
    }
    
    // Continue game loop after brief delay
    setTimeout(() => {
      this.isProcessingTurn = false;
      this.processNextTurn();
    }, 500);
  }

  // Process queued observer actions between turns
  processObserverQueue() {
    if (this.observerActionQueue.length === 0) return;
    
    const queuedActions = [...this.observerActionQueue];
    this.observerActionQueue = [];
    
    console.log(`⚡ Processing ${queuedActions.length} queued divine actions`);
    
    const executedActions = [];
    for (const action of queuedActions) {
      const result = this.executeObserverActionImmediate(action);
      executedActions.push(result);
    }
    
    this.broadcastToClients({
      type: 'actionsExecuted',
      data: {
        player: 'Observer',
        actions: executedActions,
        newGameState: this.gameState.toJSON()
      }
    });
  }

  buildAIContext(currentPlayerName) {
    const currentFaction = this.gameState.getCurrentPlayer();
    
    return {
      gameState: this.gameState.toJSON(),
      playerName: currentPlayerName,
      playerResources: currentFaction.resources,
      ownedTiles: this.gameState.getOwnedTiles(currentPlayerName),
      turnNumber: this.gameState.turnNumber,
      observerActionsLastTurn: this.gameState.getObserverActionsForTurn()
    };
  }

  getAvailableActions() {
    // All actions are always available - no limitations
    return {
      actions: ['Reinforce', 'Assault', 'Convert', 'Construct', 'Redistribute', 'Scorch'],
      messaging: ['send_message']
    };
  }

  async executeAction(action, playerName) {
    try {
      // Validate action
      const validation = this.validator.validateAction(action, this.gameState, playerName);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          action: action
        };
      }
      
      // Execute action and get state changes
      const beforeState = this.gameState.clone();
      const changes = this.applyAction(action, playerName);
      
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

  applyAction(action, playerName) {
    const faction = this.gameState.factions.get(playerName);
    // No action tracking needed since we allow unlimited actions
    
    // Apply action based on type
    switch (action.type) {
      case 'Reinforce':
        return this.applyReinforceAction(action, playerName);
      case 'Assault':
        return this.applyAssaultAction(action, playerName);
      case 'Convert':
        return this.applyConvertAction(action, playerName);
      case 'Construct':
        return this.applyConstructAction(action, playerName);
      case 'Redistribute':
        return this.applyRedistributeAction(action, playerName);
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
    const amount = action.parameters.amount || 1;
    
    // DEBUG: Before state
    console.log(`   🛡️ RECRUIT (${action.parameters.x},${action.parameters.y}) amount: ${amount}`);
    console.log(`   📍 Tile state: troops=${tile.troop_power.toFixed(1)}, owner=${tile.owner}, building=${tile.building || 'none'}`);
    console.log(`   💰 ${playerName} resources: R=${faction.resources.R.toFixed(1)}, F=${faction.resources.F.toFixed(1)}, I=${faction.resources.I.toFixed(1)}`);
    
    const cost = amount; // 1R per troop
    faction.spendResources({ R: cost });
    const oldPower = tile.troop_power;
    const trainingBonus = tile.building === 'Training' ? amount : 0; // Bonus equal to amount if Training
    const totalGain = amount + trainingBonus;
    tile.troop_power += totalGain;
    tile.troop_power = Math.min(tile.troop_power, 50); // Cap at 50
    
    console.log(`   ⚡ Troop recruitment: +${totalGain} (${amount} base${trainingBonus > 0 ? ` + ${trainingBonus} Training bonus` : ''})`);
    console.log(`   📈 Troops: ${oldPower.toFixed(1)}→${tile.troop_power.toFixed(1)} (cost: ${cost}R)`);
    console.log(`   💰 ${playerName} resources after: R=${faction.resources.R.toFixed(1)}, F=${faction.resources.F.toFixed(1)}, I=${faction.resources.I.toFixed(1)}`);
    
    return {
      type: 'troop_power_change',
      tile: { x: tile.x, y: tile.y },
      oldValue: oldPower,
      newValue: tile.troop_power
    };
  }

  applyAssaultAction(action, playerName) {
    const fromTile = this.gameState.getTile(action.parameters.fromX, action.parameters.fromY);
    const targetTile = this.gameState.getTile(action.parameters.targetX, action.parameters.targetY);
    const faction = this.gameState.factions.get(playerName);
    
    // DEBUG: Initial state
    console.log(`   ⚔️  ASSAULT from (${action.parameters.fromX},${action.parameters.fromY}) → (${action.parameters.targetX},${action.parameters.targetY})`);
    console.log(`   📍 Attacker: troops=${fromTile.troop_power.toFixed(1)}, strength=${action.parameters.strength}`);
    console.log(`   🎯 Target: owner=${targetTile.owner}, troops=${targetTile.troop_power.toFixed(1)}, type=${targetTile.type}`);
    
    const attackPower = fromTile.troop_power * action.parameters.strength;
    
    // Defense calculation: troops + terrain/building bonuses
    const baseDefense = targetTile.troop_power;
    const hillBonus = targetTile.type === 'hill' ? 2 : 0;
    const sacredBonus = targetTile.type === 'sacred' ? 3 : 0;
    const fortressBonus = targetTile.building === 'Fortress' ? 5 : 0;
    const towerBonus = targetTile.building === 'Tower' ? 2 : 0;
    const defensePower = baseDefense + hillBonus + sacredBonus + fortressBonus + towerBonus;
    
    console.log(`   💪 Attack power: ${attackPower.toFixed(2)} vs Defense: ${defensePower.toFixed(2)}`);
    
    const oldAttackerTroops = fromTile.troop_power;
    const oldTargetTroops = targetTile.troop_power;
    const oldTargetOwner = targetTile.owner;
    
    if (attackPower > defensePower) {
      // Victory
      const excessPower = attackPower - defensePower;
      fromTile.troop_power *= (1 - action.parameters.strength);
      targetTile.owner = playerName;
      targetTile.troop_power = Math.min(excessPower, 50);
      
      console.log(`   🎉 CONQUEST SUCCESSFUL!`);
      console.log(`   📉 Attacker remaining: ${oldAttackerTroops.toFixed(1)}→${fromTile.troop_power.toFixed(1)} (-${(oldAttackerTroops - fromTile.troop_power).toFixed(1)})`);
      console.log(`   🚩 Target captured: ${oldTargetOwner}→${playerName}, troops=${targetTile.troop_power.toFixed(1)}`);
      
      return {
        type: 'conquest',
        from: { x: fromTile.x, y: fromTile.y },
        target: { x: targetTile.x, y: targetTile.y },
        newOwner: playerName,
        success: true
      };
    } else {
      // Defeat
      fromTile.troop_power *= (1 - action.parameters.strength * 0.75);
      targetTile.troop_power *= 0.75;
      
      console.log(`   💥 ATTACK REPELLED!`);
      console.log(`   📉 Attacker damage: troops ${oldAttackerTroops.toFixed(1)}→${fromTile.troop_power.toFixed(1)} (-${(oldAttackerTroops - fromTile.troop_power).toFixed(1)})`);
      console.log(`   📉 Target damage: troops ${oldTargetTroops.toFixed(1)}→${targetTile.troop_power.toFixed(1)} (-${(oldTargetTroops - targetTile.troop_power).toFixed(1)})`);
      
      return {
        type: 'assault_failed',
        from: { x: fromTile.x, y: fromTile.y },
        target: { x: targetTile.x, y: targetTile.y },
        success: false
      };
    }
  }

  applyConvertAction(action, playerName) {
    const tile = this.gameState.getTile(action.parameters.x, action.parameters.y);
    const faction = this.gameState.factions.get(playerName);
    
    const faithCost = 2;
    const influenceCost = 1;
    faction.spendResources({ F: faithCost, I: influenceCost });
    
    const conversionChance = Math.min(0.8, faction.resources.I * 0.1);
    const success = Math.random() < conversionChance;
    
    if (success && tile.owner !== playerName) {
      tile.owner = playerName;
      tile.troop_power = 3; // Converted tiles have minimal troops
      
      return {
        type: 'conversion_success',
        tile: { x: tile.x, y: tile.y },
        newOwner: playerName,
        success: true
      };
    }
    
    return {
      type: 'conversion_failed',
      tile: { x: tile.x, y: tile.y },
      success: false
    };
  }

  applyConstructAction(action, playerName) {
    const tile = this.gameState.getTile(action.parameters.x, action.parameters.y);
    const faction = this.gameState.factions.get(playerName);
    
    const buildingCosts = {
      'Shrine': 5,
      'Idol': 3,
      'Training': 4,
      'Market': 3,
      'Tower': 4,
      'Fortress': 6
    };
    
    const cost = buildingCosts[action.parameters.building];
    faction.spendResources({ R: cost });
    
    const oldBuilding = tile.building;
    tile.building = action.parameters.building;
    
    return {
      type: 'construction',
      tile: { x: tile.x, y: tile.y },
      oldBuilding: oldBuilding,
      newBuilding: action.parameters.building
    };
  }

  applyRedistributeAction(action, playerName) {
    const fromTile = this.gameState.getTile(action.parameters.fromX, action.parameters.fromY);
    const toTile = this.gameState.getTile(action.parameters.toX, action.parameters.toY);
    
    // DEBUG: Before state
    console.log(`   🚛 REDISTRIBUTE from (${action.parameters.fromX},${action.parameters.fromY}) to (${action.parameters.toX},${action.parameters.toY})`);
    console.log(`   📦 Source tile: troops=${fromTile.troop_power.toFixed(1)}, owner=${fromTile.owner}`);
    console.log(`   📍 Target tile: troops=${toTile.troop_power.toFixed(1)}, owner=${toTile.owner}`);
    console.log(`   🎯 Requested transfer: ${action.parameters.amount} troops`);
    
    const transferAmount = Math.min(action.parameters.amount, fromTile.troop_power);
    const oldFromTroops = fromTile.troop_power;
    const oldToTroops = toTile.troop_power;
    
    fromTile.troop_power -= transferAmount;
    toTile.troop_power += transferAmount;
    
    console.log(`   ✅ Transferred ${transferAmount.toFixed(1)} troops`);
    console.log(`   📉 Source: ${oldFromTroops.toFixed(1)}→${fromTile.troop_power.toFixed(1)} (-${transferAmount.toFixed(1)})`);
    console.log(`   📈 Target: ${oldToTroops.toFixed(1)}→${toTile.troop_power.toFixed(1)} (+${transferAmount.toFixed(1)})`);
    
    return {
      type: 'troop_redistribution',
      from: { x: fromTile.x, y: fromTile.y },
      to: { x: toTile.x, y: toTile.y },
      amount: transferAmount
    };
  }

  applyScorchAction(action, playerName) {
    const tile = this.gameState.getTile(action.parameters.x, action.parameters.y);
    const faction = this.gameState.factions.get(playerName);
    
    faction.spendResources({ R: 2 });
    const oldTroops = tile.troop_power;
    tile.troop_power = Math.max(0, tile.troop_power - 5); // Scorch removes 5 troops
    
    return {
      type: 'scorch',
      tile: { x: tile.x, y: tile.y },
      oldTroops: oldTroops,
      newTroops: tile.troop_power
    };
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
    console.log(`⚡ Divine intervention: ${action.type} at (${action.parameters.x || 'N/A'},${action.parameters.y || 'N/A'})`);
    
    // Check current game state
    if (this.isWaitingForAnimation) {
      // Queue action if animations are playing
      console.log(`📦 Queuing divine action (animations in progress)`);
      this.observerActionQueue.push(action);
      return { success: true, queued: true };
    }
    
    if (this.currentAIAbortController) {
      // Interrupt AI if it's thinking
      console.log(`🛑 Interrupting AI generation for divine intervention`);
      this.currentAIAbortController.abort();
      this.currentAIAbortController = null;
    }
    
    // Execute action immediately
    const result = this.executeObserverActionImmediate(action);
    
    // Add to context for AI agents
    this.gameState.addObserverAction(action);
    
    // Start personality evolution in background (will be awaited before next AI turn)
    console.log(`🧠 Starting personality evolution in background...`);
    this.pendingPersonalityEvolution = this.evolvePersonalitiesAfterDivineEvent(action).catch(err => {
      console.error('Error evolving personalities:', err);
      this.pendingPersonalityEvolution = null;
    });
    
    // Broadcast to clients
    this.broadcastToClients({
      type: 'actionsExecuted',
      data: {
        player: 'Observer',
        actions: [result],
        newGameState: this.gameState.toJSON()
      }
    });
    
    // If AI was interrupted, restart its turn
    if (this.isProcessingTurn) {
      console.log(`🔄 Restarting interrupted AI turn with new context`);
      this.isProcessingTurn = false;
      this.processNextTurn();
    }
    
    return result;
  }

  executeObserverActionImmediate(action) {
    // Actually apply the observer action to game state
    const changes = this.applyObserverAction(action);
    
    return {
      success: true,
      action: action,
      changes: changes
    };
  }

  applyObserverAction(action) {
    // Implementation of observer/god powers
    // Normalize action type to handle case insensitivity
    const actionType = action.type.charAt(0).toUpperCase() + action.type.slice(1).toLowerCase();
    
    switch (actionType) {
      case 'Smite':
        const tile = this.gameState.getTile(action.parameters.x, action.parameters.y);
        if (!tile) return { type: 'error', message: 'Invalid coordinates' };
        tile.troop_power = 0;
        return { type: 'smite', tile: { x: action.parameters.x, y: action.parameters.y } };
        
      case 'Bless':
        const blessedTile = this.gameState.getTile(action.parameters.x, action.parameters.y);
        if (!blessedTile) return { type: 'error', message: 'Invalid coordinates' };
        blessedTile.troop_power += 5;
        if (blessedTile.owner !== 'Neutral') {
          const faction = this.gameState.factions.get(blessedTile.owner);
          if (faction) faction.addResources(0, 2, 0);
        }
        return { type: 'bless', tile: { x: action.parameters.x, y: action.parameters.y } };
        
      case 'Observe':
        // Observer watching - no game state changes, just for context
        return { type: 'observe', commentary: action.parameters.commentary };
        
      case 'Meteor':
        // Meteor strike affecting 3x3 area
        const centerX = action.parameters.centerX || action.parameters.x;
        const centerY = action.parameters.centerY || action.parameters.y;
        const affected = [];
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const x = centerX + dx;
            const y = centerY + dy;
            if (x >= 0 && x < 10 && y >= 0 && y < 10) {
              const meteorTile = this.gameState.getTile(x, y);
              if (meteorTile) {
                meteorTile.troop_power = Math.max(0, meteorTile.troop_power * 0.5);
                affected.push({ x, y });
              }
            }
          }
        }
        return { type: 'meteor', center: { x: centerX, y: centerY }, affected };
        
      // ... other observer actions
      
      default:
        throw new Error(`Unknown observer action: ${action.type}`);
    }
  }

  async evolvePersonalitiesAfterDivineEvent(divineAction) {
    try {
      // Get target faction if action affects a specific tile
      let targetFaction = null;
      if (divineAction.parameters && 
          (divineAction.parameters.x !== undefined && divineAction.parameters.y !== undefined)) {
        targetFaction = PersonalityEvolver.getTargetFaction(this.gameState, 
                                                          divineAction.parameters.x, 
                                                          divineAction.parameters.y);
      }

      // Extract current personalities from all agents
      const currentPersonalities = {};
      for (const [factionName, agent] of this.agents) {
        if (agent.personalityData) {
          currentPersonalities[factionName] = agent.personalityData;
        }
      }

      // Skip evolution if no personalities to evolve
      if (Object.keys(currentPersonalities).length === 0) {
        console.log('🧠 No personalities to evolve');
        return;
      }

      // Get simplified personality essence for LLM processing
      const personalityEssence = PersonalityEvolver.extractPersonalityEssence(currentPersonalities);

      console.log(`🧠 Evolving ${Object.keys(personalityEssence).length} personalities after divine ${divineAction.type}...`);
      
      // Evolve personalities using LLM
      const evolvedEssence = await this.personalityEvolver.evolvePersonalities(
        personalityEssence, 
        divineAction, 
        targetFaction
      );

      // Merge evolved changes back into full personality objects
      const evolvedPersonalities = PersonalityEvolver.mergeEvolutionResults(
        currentPersonalities, 
        evolvedEssence
      );

      // Update each agent's personality
      let evolutionCount = 0;
      for (const [factionName, evolvedPersonality] of Object.entries(evolvedPersonalities)) {
        const agent = this.agents.get(factionName);
        if (agent) {
          agent.updatePersonality(evolvedPersonality);
          evolutionCount++;
        }
      }
      
      console.log(`✅ Personality evolution completed: ${evolutionCount} factions evolved after divine ${divineAction.type}`);

    } catch (error) {
      console.error('❌ Personality evolution failed:', error.message);
      // Game continues even if personality evolution fails
    }
  }
}