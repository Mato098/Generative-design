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
    this.isWaitingForAnimation = false;
    this.pendingPersonalityEvolution = null; // Track ongoing personality evolution
    this.needsRestartAfterObserver = false; // Flag to restart turn after observer action
    this.isPaused = false; // Game pause state
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
    if (this.isProcessingTurn || this.isPaused) return;
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
    console.log(`\n🏛️ ${factionName} T${this.gameState.turnNumber} | ${ownedTiles.length} tiles | R:${faction.resources.R.toFixed(0)} F:${faction.resources.F.toFixed(0)}`);
    
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
      if (error.name === 'AbortError' || error.name === 'APIUserAbortError') {
        console.log(`⚡ ${factionName}'s turn interrupted by divine intervention`);
        return null;
      }
      console.error(`AI Agent ${factionName} error:`, error);
      // Return empty actions on other errors to continue game
      return [];
    }
  }

  // Called when client finishes animating actions
  async continueAfterAnimation() {
    this.isWaitingForAnimation = false;
    
    // Continue game loop after brief delay (personality evolution may still be running)
    setTimeout(() => {
      // Check if we need to restart a turn that was interrupted by observer action
      if (this.needsRestartAfterObserver) {
        console.log(`🔄 Restarting interrupted turn after observer intervention`);
        this.needsRestartAfterObserver = false;
        this.isProcessingTurn = false;
        this.processNextTurn();
      } else {
        this.isProcessingTurn = false;
        this.processNextTurn();
      }
    }, 500);
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
        return this.applyRecruitAction(action, playerName);
      case 'Move':
        return this.applyMoveAction(action, playerName);
      case 'Convert':
        return this.applyConvertAction(action, playerName);
      case 'Construct':
        return this.applyConstructAction(action, playerName);
      case 'Sanctuary':
        return this.applySanctuaryAction(action, playerName);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  // Action implementation methods (to be implemented)
  applyRecruitAction(action, playerName) {
    const tile = this.gameState.getTile(action.parameters.x, action.parameters.y);
    const faction = this.gameState.factions.get(playerName);
    const amount = action.parameters.amount || 1;
    
    // DEBUG: Before state
    console.log(`   🛡️ RECRUIT (${action.parameters.x},${action.parameters.y}) amount: ${amount}`);
    console.log(`    Tile state: troops=${tile.troop_power.toFixed(1)}, owner=${tile.owner}, building=${tile.building || 'none'}`);
    console.log(`    ${playerName} resources: R=${faction.resources.R.toFixed(1)}, F=${faction.resources.F.toFixed(1)}`);
    
    const cost = amount; // 1R per troop
    faction.spendResources({ R: cost });
    const oldPower = tile.troop_power;
    const trainingBonus = tile.building === 'Training' ? amount : 0; // Bonus equal to amount if Training
    const totalGain = amount + trainingBonus;
    tile.troop_power += totalGain;
    tile.troop_power = Math.min(tile.troop_power, 50); // Cap at 50
    
    console.log(`    Troop recruitment: +${totalGain} (${amount} base${trainingBonus > 0 ? ` + ${trainingBonus} Training bonus` : ''})`);
    console.log(`    Troops: ${oldPower.toFixed(1)}→${tile.troop_power.toFixed(1)} (cost: ${cost}R)`);
    console.log(`    ${playerName} resources after: R=${faction.resources.R.toFixed(1)}, F=${faction.resources.F.toFixed(1)}`);
    
    return {
      type: 'troop_power_change',
      tile: { x: tile.x, y: tile.y },
      oldValue: oldPower,
      newValue: tile.troop_power
    };
  }

  applyMoveAction(action, playerName) {
    const { fromX, fromY, targetX, targetY, troops } = action.parameters;
    const sourceTile = this.gameState.getTile(fromX, fromY);
    const targetTile = this.gameState.getTile(targetX, targetY);
    const troopsToMove = Math.min(troops, sourceTile.troop_power);
    
    // Determine if this is an attack or troop movement
    if (targetTile.owner === playerName) {
      // Troop movement between own tiles
      console.log(`   🚛 MOVE TROOPS from (${fromX},${fromY}) to (${targetX},${targetY}): ${troopsToMove} troops`);
      
      sourceTile.troop_power -= troopsToMove;
      targetTile.troop_power += troopsToMove;
      
      return {
        success: true,
        type: 'move_troops',
        from: { x: fromX, y: fromY },
        target: { x: targetX, y: targetY },
        troopsMoved: troopsToMove,
        blurb: action.parameters.blurb || 'Troops moved!'
      };
    } else {
      // Attack on enemy/neutral tile
      console.log(`   ⚔️  ATTACK from (${fromX},${fromY}) → (${targetX},${targetY}): ${troopsToMove} troops`);
      
      const attackPower = troopsToMove;
      
      // Defense calculation: troops + terrain/building bonuses
      const baseDefense = targetTile.troop_power;
      const hillBonus = targetTile.type === 'hill' ? 2 : 0;
      const sacredBonus = targetTile.type === 'sacred' ? 3 : 0;
      const fortressBonus = targetTile.building === 'Fortress' ? 5 : 0;
      const towerBonus = targetTile.building === 'Tower' ? 2 : 0;
      const defensePower = baseDefense + hillBonus + sacredBonus + fortressBonus + towerBonus;
      
      console.log(`   💪 Attack power: ${attackPower.toFixed(2)} vs Defense: ${defensePower.toFixed(2)}`);
      
      // Add combat randomness - roll dice for both sides
      const attackRoll = Math.random() * 0.4 + 0.8; // 0.8 to 1.2 multiplier
      const defenseRoll = Math.random() * 0.4 + 0.8; // 0.8 to 1.2 multiplier
      
      const finalAttackPower = attackPower * attackRoll;
      const finalDefensePower = defensePower * defenseRoll;
      
      console.log(`   🎲 Combat rolls: Attack ${attackRoll.toFixed(2)} Defense ${defenseRoll.toFixed(2)}`);
      console.log(`   ⚡ Final: ${finalAttackPower.toFixed(2)} vs ${finalDefensePower.toFixed(2)}`);
      
      // Remove attacking troops from source
      const strengthRatio = troopsToMove / sourceTile.troop_power;
      
      if (finalAttackPower > finalDefensePower) {
        // Victory
        const excessPower = finalAttackPower - finalDefensePower;
        sourceTile.troop_power *= (1 - strengthRatio);
        targetTile.owner = playerName;
        targetTile.troop_power = Math.min(excessPower, 50);
        
        console.log(`   🎉 ATTACK SUCCESSFUL!`);
        
        return {
          success: true,
          type: 'conquest',
          from: { x: fromX, y: fromY },
          target: { x: targetX, y: targetY },
          newOwner: playerName,
          blurb: action.parameters.blurb || 'Territory conquered!'
        };
      } else {
        // Defeat
        sourceTile.troop_power *= (1 - strengthRatio * 0.75);
        targetTile.troop_power *= 0.75;
        
        console.log(`   💥 ATTACK REPELLED!`);

        return {
          success: false,
          type: 'assault_failed',
          from: { x: fromX, y: fromY },
          target: { x: targetX, y: targetY },
          blurb: action.parameters.blurb || 'Attack repelled!'
        };
      }
    }
  }

  applyConvertAction(action, playerName) {
    const tile = this.gameState.getTile(action.parameters.x, action.parameters.y);
    const faction = this.gameState.factions.get(playerName);
    
    const faithCost = 3; // Increased since no Influence cost
    faction.spendResources({ F: faithCost });
    
    // Faith-based conversion is more reliable
    const conversionChance = Math.min(0.9, 0.6 + (faction.resources.F * 0.05));
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

  applySanctuaryAction(action, playerName) {
    const tile = this.gameState.getTile(action.parameters.x, action.parameters.y);
    const faction = this.gameState.factions.get(playerName);
    
    console.log(`   ⛪ SANCTUARY at (${action.parameters.x},${action.parameters.y})`);
    
    const faithCost = 4;
    faction.spendResources({ F: faithCost });
    
    // Make tile immune to attack for 3 turns
    if (!tile.effects) tile.effects = {};
    tile.effects.sanctuary = this.gameState.turnNumber + 2;
    
    console.log(`   ✅ Tile protected from attack until turn ${tile.effects.sanctuary}`);
    
    return {
      type: 'sanctuary',
      tile: { x: tile.x, y: tile.y },
      protectedUntil: tile.effects.sanctuary
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
    
    // Interrupt AI if it's thinking
    if (this.currentAIAbortController) {
      console.log(`🛑 Interrupting AI generation for divine intervention`);
      this.currentAIAbortController.abort();
      this.currentAIAbortController = null;
    }
    
    // Execute the action immediately and start personality evolution
    const result = await this.processObserverActionWithEvolution(action);
    
    // Broadcast to clients (this adds to animation queue)
    this.broadcastToClients({
      type: 'actionsExecuted',
      data: {
        player: 'Observer',
        actions: [result],
        newGameState: this.gameState.toJSON()
      }
    });
    
    // If AI was interrupted, mark that we need to restart after animations complete
    if (this.isProcessingTurn) {
      console.log(`🔄 Marking turn for restart after divine intervention`);
      this.needsRestartAfterObserver = true;
      // Don't restart immediately - let the aborted AI request complete and animations finish
    }
    
    return result;
  }

  // Shared method to process observer actions with personality evolution
  async processObserverActionWithEvolution(action) {
    // Execute the action
    const changes = this.applyObserverAction(action);
    const result = {
      success: true,
      action: action,
      changes: changes
    };
    
    // Add to context for AI agents
    this.gameState.addObserverAction(action);
    
    // Only trigger personality evolution for divine interventions, not game state changes
    const evolutionTriggeringActions = ['Smite', 'Bless', 'Meteor', 'Sanctify', 'Rend', 'Observe'];
    if (evolutionTriggeringActions.includes(action.type)) {
      // Store the evolution promise so AI turns can wait for it
      this.pendingPersonalityEvolution = this.evolvePersonalitiesAfterDivineEvent(action).catch(err => {
        console.error('❌ Error evolving personalities:', err);
        this.pendingPersonalityEvolution = null;
      });
    }
    
    return result;
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
        
      case 'Sanctify':
        const sanctifyTile = this.gameState.getTile(action.parameters.x, action.parameters.y);
        if (!sanctifyTile) return { type: 'error', message: 'Invalid coordinates' };
        sanctifyTile.type = 'sacred'; // Convert to sacred terrain
        sanctifyTile.building = 'Shrine'; // Add shrine building
        sanctifyTile.troop_power += 3; // Divine empowerment
        if (sanctifyTile.owner !== 'Neutral') {
          const faction = this.gameState.factions.get(sanctifyTile.owner);
          if (faction) faction.addResources(0, 3); // +3 Faith
        }
        return { type: 'sanctify', tile: { x: action.parameters.x, y: action.parameters.y } };
        
      case 'Rend':
        const rendTile = this.gameState.getTile(action.parameters.x, action.parameters.y);
        if (!rendTile) return { type: 'error', message: 'Invalid coordinates' };
        rendTile.building = 'none'; // Destroy any building
        rendTile.troop_power = Math.max(0, rendTile.troop_power - 7); // Heavy damage
        return { type: 'rend', tile: { x: action.parameters.x, y: action.parameters.y } };
        
      case 'Pause':
        this.isPaused = true;
        console.log('⏸ Game paused by observer');
        return { type: 'pause', message: 'Game paused' };
        
      case 'Resume':
        this.isPaused = false;
        console.log('▶ Game resumed by observer');
        // Restart current turn processing
        if (!this.isProcessingTurn) {
          this.processNextTurn();
        }
        return { type: 'resume', message: 'Game resumed' };
      
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
        console.log('🧠 No personalities to evolve - no agents have personalityData');
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