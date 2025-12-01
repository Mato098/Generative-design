import OpenAI from 'openai';
import { GAME_FUNCTION_SCHEMAS } from './FunctionSchemas.js';
import { PERSONALITY_PROFILES, PersonalityEngine } from './PersonalityProfiles.js';

export class AIAgent {
  constructor(name, personality, apiKey) {
    this.name = name;
    this.personality = personality;
    this.personalityData = PersonalityEngine.getPersonality(personality); // Store full personality data
    this.openai = new OpenAI({ 
      apiKey: apiKey || process.env.OPENAI_API_KEY 
    });
    this.conversationHistory = [];
  }

  async getTurnActions(context) {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const userMessage = this.buildContextMessage(context);
      
      // DEBUG: Log prompt lengths to investigate token usage
      console.log(`\n📝 ${this.name} PROMPT DEBUG:`);
      console.log(`System prompt length: ${systemPrompt.length} chars`);
      console.log(`User message length: ${userMessage.length} chars`);
      console.log(`Conversation history length: ${this.conversationHistory.length} messages`);
      console.log(`Total history chars: ${JSON.stringify(this.conversationHistory).length} chars`);
      console.log(`📝 END PROMPT DEBUG\n`);
      
      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      const startTime = Date.now();
      const response = await this.openai.chat.completions.create({
        model: 'gpt-5-nano-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          ...this.conversationHistory
        ],
        tools: GAME_FUNCTION_SCHEMAS,
        tool_choice: 'required', // Force at least one function call
        temperature: 1,
        max_completion_tokens: 4000
      });

      const message = response.choices[0].message;
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`⏱️ ${this.name} LLM response: ${duration / 1000}s`);
      
      // Log token usage
      const tokenUsage = response.usage;
      console.log(`${this.name} tokens: ${tokenUsage.prompt_tokens} prompt + ${tokenUsage.completion_tokens} completion = ${tokenUsage.total_tokens} total`);
      
      // DEBUG: Show full response content to investigate high token usage
      console.log(`\n📊 FULL ${this.name} RESPONSE DEBUG:`);
      console.log(`Content: "${message.content}"`);
      console.log(`Tool calls count: ${message.tool_calls ? message.tool_calls.length : 0}`);
      if (message.tool_calls) {
        message.tool_calls.forEach((call, index) => {
          console.log(`  Tool ${index + 1}: ${call.function.name}`);
          console.log(`  Arguments length: ${call.function.arguments.length} chars`);
          console.log(`  Full arguments: ${call.function.arguments}`);
        });
      }
      console.log(`📊 END RESPONSE DEBUG\n`);
      
      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: message.content,
        tool_calls: message.tool_calls
      });

      // Parse actions from function calls
      const result = this.parseActionsFromResponse(message);
      
      // Add tool result messages for each tool call
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          this.conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({
              success: true,
              action_queued: true,
              function: toolCall.function.name,
              parameters: toolCall.function.arguments
            })
          });
        }
      }
      
      // Debug: Log parsed actions
      console.log(`Parsed actions for ${this.name}:`, result);
      
      // Trim conversation history to save tokens (keep last 4 exchanges)
      const maxHistoryLength = 8; // 4 user/assistant pairs
      if (this.conversationHistory.length > maxHistoryLength) {
        this.conversationHistory = this.conversationHistory.slice(-maxHistoryLength);
      }
      
      return result;
      
    } catch (error) {
      console.error(`AI Agent ${this.name} error:`, error);
      // Return empty actions if AI fails
      return { actions: [], message: null };
    }
  }

  buildSystemPrompt() {
    let prompt = this.name + ' - 10x10 strategy ruler. Goal: 50+ tiles.\n';
    prompt += 'ONLY use execute_turn_plan() with 2-4 actions + blurbs.\n';
    prompt += 'Actions: assault, reinforce, convert, construct, project_pressure, redistribute, repair, scorch, send_message\n';
    prompt += 'use send_message often to talk to other factions or to pray. expand aggresively to win as soon as possible'
    prompt += 'Gods may be real. Divine blessings/smites affect tiles. Acknowledge divine acts in messages.\n';
    prompt += this.personality ? this.getPersonalityPrompt() : 'Aggressive expansion.';
    return prompt;
  }

  getPersonalityPrompt() {
    if (!this.personality) return 'Focus on aggressive expansion.';

    // Use evolved personality data if available, otherwise fall back to static system
    if (this.personalityData && this.personalityData.personality_prompt) {
      return this.personalityData.personality_prompt;
    }

    // Fallback to static personality system
    const personalityData = PersonalityEngine.getPersonality(this.personality);
    if (personalityData) {
      return personalityData.personality_prompt;
    }

    // Final fallback for unknown personalities
    const basicPrompts = {
      aggressive: "Aggressive expansionist. Prioritize assault actions and territorial conquest.",
      defensive: "Defensive strategist. Fortify territory, use ProjectPressure on enemies.",
      diplomatic: "Diplomatic manipulator. Use Convert and influence tactics.",
      economic: "Economic focused. Secure resource tiles, build Markets after expansion.",
      religious: "Religious zealot. Build Shrines, use Convert, seek sacred sites.",
      chaotic: "Unpredictable opportunist. Exploit weaknesses, take calculated risks.",
      builder: "Infrastructure focused. Build diverse buildings after securing territory.",
      opportunist: "Adaptive tactician. Switch strategies based on opportunities."
    };

    return basicPrompts[this.personality] || basicPrompts.opportunist;
  }

  getPersonalitySpeechInstructions() {
    if (!this.personality) return 'Speak dramatically and decisively.';
    
    const personalityData = PersonalityEngine.getPersonality(this.personality);
    
    if (personalityData && personalityData.behavioral_tendencies) {
      const style = personalityData.behavioral_tendencies.communication_style;
      return 'Communication style: ' + style;
    }
    
    return 'Speak dramatically and decisively.';
  }

  buildContextMessage(context) {
    const { gameState, playerResources, ownedTiles, turnNumber, observerActionsLastTurn } = context;
    
    // DEBUG: Log observer actions
    console.log(`🌟 Observer actions for ${this.name}:`, observerActionsLastTurn);
    
    let message = `T${turnNumber} ${this.name} | Resources R:${playerResources.R.toFixed(0)} F:${playerResources.F.toFixed(0)} I:${playerResources.I.toFixed(0)} | Tiles:${ownedTiles.length}\n`;
    
    // DIVINE EVENTS - ONLY APPEAR WHEN GOD ACTS MEANINGFULLY
    if (observerActionsLastTurn && observerActionsLastTurn.length > 0) {
      // Filter for meaningful actions first
      const meaningfulActions = observerActionsLastTurn.filter(action => {
        if (action.type === 'observe') {
          const command = action.parameters.commentary || action.parameters.message || '';
          return command.trim() && command !== 'The gods watch in silence';
        }
        return true; // Other actions (bless, smite, meteor) are always meaningful
      });
      
      // Only show divine section if there are meaningful actions
      if (meaningfulActions.length > 0) {
        message += '\n✨ DIVINE: ';
        
        meaningfulActions.forEach(action => {
          if (action.type === 'observe') {
            const command = action.parameters.commentary || action.parameters.message;
            message += '"' + command.trim() + '" ';
          } else if (action.type === 'bless') {
            message += 'Blessed(' + action.parameters.x + ',' + action.parameters.y + ') ';
          } else if (action.type === 'smite') {
            message += 'Smote(' + action.parameters.x + ',' + action.parameters.y + ') ';
          } else if (action.type === 'meteor') {
            message += 'Meteor(' + action.parameters.x + ',' + action.parameters.y + ') ';
          }
        });
        
        message += '\n';
      }
    }
    
    // Count enemy tiles efficiently
    const enemyInfo = [];
    for (const [name, faction] of Object.entries(gameState.factions)) {
      if (name !== this.name) {
        const tiles = this.countTilesForFaction(gameState.grid, name);
        enemyInfo.push(`${name}:${tiles}tiles`);
      }
    }
    
    // Show only key owned tiles (border tiles with troops)
    const keyTiles = ownedTiles.filter(t => t.troop_power > 0).slice(0, 3);
    if (keyTiles.length > 0) {
      const tileList = keyTiles.map(t => '(' + t.x + ',' + t.y + '):' + t.troop_power.toFixed(0) + 't').join(' ');
      message += 'Key tiles: ' + tileList;
      if (ownedTiles.length > keyTiles.length) message += ' +' + (ownedTiles.length - keyTiles.length) + ' more';
      message += '\n';
    }
    
    message += 'Enemies: ' + enemyInfo.join(' ');
    message += this.analyzeStrategicSituation(gameState.grid, ownedTiles);
    message += '\nUse execute_turn_plan() with 2-4 actions.';
    
    return message;
  }

  countTilesForFaction(grid, factionName) {
    let count = 0;
    for (let row of grid) {
      for (let tile of row) {
        if (tile.owner === factionName) count++;
      }
    }
    return count;
  }

  analyzeStrategicSituation(grid, ownedTiles) {
    let analysis = '';
    let expansionOpportunities = 0;
    
    // Find expansion opportunities (only count, don't detail)
    for (const tile of ownedTiles) {
      const adjacent = this.getAdjacentTiles(grid, tile.x, tile.y);
      const easyTargets = adjacent.filter(t => t.owner === 'Neutral' && t.troop_power <= 2);
      expansionOpportunities += easyTargets.length;
    }
    
    if (expansionOpportunities > 0) {
      analysis = '\n' + expansionOpportunities + ' easy targets';
    } else {
      analysis = '\nNo easy expansion';
    }
    
    return analysis;
  }

  getAdjacentTiles(grid, x, y) {
    const adjacent = [];
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    
    for (const [dx, dy] of directions) {
      const newX = x + dx;
      const newY = y + dy;
      if (newX >= 0 && newX < 10 && newY >= 0 && newY < 10) {
        adjacent.push(grid[newY][newX]);
      }
    }
    
    return adjacent;
  }

  parseActionsFromResponse(message) {
    const actions = [];
    let gameMessage = null;
    
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return { actions, message: gameMessage };
    }
    
    for (const toolCall of message.tool_calls) {
      const functionName = toolCall.function.name;
      let parameters;
      
      try {
        parameters = JSON.parse(toolCall.function.arguments);
      } catch (error) {
        console.error('Failed to parse function arguments for ' + functionName + ':', error);
        continue;
      }

      if (functionName === 'execute_turn_plan') {
        // Handle meta-function with multiple actions
        if (parameters.plan && Array.isArray(parameters.plan)) {
          for (const step of parameters.plan) {
            if (step.action === 'send_message') {
              gameMessage = step.args.message;
            } else {
              const actionType = this.mapFunctionToActionType(step.action);
              const action = {
                type: actionType,
                blurb: step.args.blurb,
                parameters: { ...step.args }
              };
              delete action.parameters.blurb; // Remove blurb from parameters
              actions.push(action);
            }
          }
        }
      } else if (functionName === 'send_message') {
        // Legacy single message handling
        gameMessage = parameters.message;
      } else {
        // Legacy single action handling
        const actionType = this.mapFunctionToActionType(functionName);
        const action = {
          type: actionType,
          blurb: parameters.blurb,
          parameters: { ...parameters }
        };
        delete action.parameters.blurb; // Remove blurb from parameters
        actions.push(action);
      }
    }
    
    return { actions, message: gameMessage };
  }

  mapFunctionToActionType(functionName) {
    const mapping = {
      'reinforce': 'Reinforce',
      'project_pressure': 'ProjectPressure',
      'assault': 'Assault',
      'convert': 'Convert',
      'construct': 'Construct',
      'redistribute': 'Redistribute',
      'repair': 'Repair',
      'scorch': 'Scorch',
      'message': 'Message'
    };
    
    return mapping[functionName] || functionName;
  }

  // Personality-based decision making helpers
  shouldTakeRisks() {
    return ['aggressive', 'chaotic', 'opportunist'].includes(this.personality);
  }

  prefersBuildingOverConflict() {
    return ['defensive', 'economic', 'builder'].includes(this.personality);
  }

  prioritizesFaith() {
    return ['religious', 'diplomatic'].includes(this.personality);
  }

  /**
   * Update the agent's personality data after evolution
   * @param {Object} newPersonalityData - Evolved personality structure
   */
  updatePersonality(newPersonalityData) {
    this.personalityData = newPersonalityData;
    console.log('🧠 ' + this.name + ' personality data updated: ' + (newPersonalityData.name || this.personality));
  }

  /**
   * Get current personality data for evolution processing
   * @returns {Object} Current personality data
   */
  getPersonalityData() {
    return this.personalityData;
  }
}