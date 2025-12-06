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

  async getTurnActions(context, abortSignal) {
    try {
      const systemPrompt = this.buildSystemPrompt();
      console.log('systemPrompt:', systemPrompt);
      const userMessage = this.buildContextMessage(context);
      
      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      const startTime = Date.now();
      const response = await this.openai.chat.completions.create({
        //model: 'gpt-5-nano-2025-08-07',
        model: 'gpt-5.1-2025-11-13',
        messages: [
          { role: 'system', content: systemPrompt },
          ...this.conversationHistory
        ],
        tools: GAME_FUNCTION_SCHEMAS,
        tool_choice: 'required', // Force at least one function call
        temperature: 1,
        max_completion_tokens: 4000
      }, {
        signal: abortSignal // Pass abort signal to OpenAI
      });

      const message = response.choices[0].message;
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`⏱️ ${this.name} LLM response: ${duration / 1000}s`);
      
      // Log token usage
      const tokenUsage = response.usage;
      console.log(`${this.name} tokens: ${tokenUsage.prompt_tokens} prompt + ${tokenUsage.completion_tokens} completion = ${tokenUsage.total_tokens} total`);
 
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
      //console.log(`Parsed actions for ${this.name}:`, result);
      
      // Trim conversation history intelligently to save tokens
      // Keep only complete user → assistant → tool sequences
      if (this.conversationHistory.length > 12) {
        // Find valid cutoff points (after tool messages or user messages)
        const cutoffIndex = this.conversationHistory.length - 10;
        
        // Make sure we don't cut in the middle of a tool sequence
        let safeIndex = cutoffIndex;
        for (let i = cutoffIndex; i >= 0; i--) {
          if (this.conversationHistory[i].role === 'user') {
            safeIndex = i;
            break;
          }
        }
        
        this.conversationHistory = this.conversationHistory.slice(safeIndex);
      }
      
      return result;
      
    } catch (error) {
      console.error(`AI Agent ${this.name} error:`, error);
      // Return empty actions if AI fails
      return { actions: [], message: null };
    }
  }

  buildSystemPrompt() {
    const personalityPrompt = this.personality ? this.getPersonalityPrompt() : 'Focus on aggressive expansion.';
    
    return `${this.name} - Strategy ruler seeking 50+ tiles.
USE execute_turn_plan() with actions: assault, recruit, convert, construct, redistribute, sanctuary, send_message.

RULES:
- Assault: Attack adjacent tiles (specify troop count, need at least equal troops to win, involves chance)
- Recruit: Add troops to YOUR tiles (costs R)
- Convert: Take neutral tiles with Faith (costs F)
- Construct: Build on YOUR tiles (costs R) - Shrine/Idol(+F), Market(+R), Tower/Fortress(defense)
- Redistribute: Move troops between YOUR adjacent tiles
- Sanctuary: Protect tile from assault for 2 turns (costs 4F)
- Send_message: Broadcast to all factions or pray to divine powers
- Income: Each tile gives R per turn, Shrine/sacred give +F (faith is scarce!)
- Only act on/from tiles you own (MINE: list)
- Adjacent = up/down/left/right only

${personalityPrompt}
Divine powers may intervene.`;
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
      defensive: "Defensive strategist. Fortify territory, recruit troops heavily.",
      diplomatic: "Diplomatic manipulator. Use Convert and negotiation tactics.",
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
    
    let message = `your resources: T(overall troops)${turnNumber} R(resources)${playerResources.R.toFixed(0)}F(faith)${playerResources.F.toFixed(0)}\n`;
    
    // OWNED TILES - essential for all actions
    if (ownedTiles.length > 0) {
      const tileDetails = ownedTiles.map(t => {
        let desc = `(${t.x},${t.y})`;
        if (t.troop_power > 0) desc += `:${t.troop_power.toFixed(1)}troops`;
        if (t.building !== 'none') desc += `+${t.building}`;
        return desc;
      }).join(' ');
      message += `MINE: ${tileDetails}\n`;
    } else {
      message += `MINE: None!\n`;
    }
    
    // TACTICAL SITUATION - visual grid overview
    const gridInfo = this.buildGridVisualization(gameState.grid);
    message += gridInfo;
    
    message += 'Use execute_turn_plan() with any number of actions.';

    // DEBUG: Print the final message being sent to AI
    console.log(`\n💬 === FINAL AI MESSAGE FOR ${this.name} ===`);
    console.log(message);
    console.log(`=== END FINAL AI MESSAGE ===\n`);
    
    return message;
  }

  buildGridVisualization(grid) {
    let visualization = 'MAP (each cell: owner+troops+building):\n';
    visualization += '   0123456789\n';
    visualization += 'your tiles marked with your faction letter ' + this.name.slice(-1) + '\n';
    
    for (let y = 0; y < 10; y++) {
      visualization += ` ${y} `;
      for (let x = 0; x < 10; x++) {
        const tile = grid[y][x];
        let symbol = '';
        
        // Owner: A/B=factions, N=neutral
        if (tile.owner === this.name) {
          symbol = this.name.slice(-1); // A or B
        } else if (tile.owner === 'Neutral') {
          symbol = 'N';
        } else {
          symbol = tile.owner.slice(-1); // Other faction letter
        }
        
        // Add troop count (0-9, or + for 10+)
        const troops = Math.floor(tile.troop_power);
        if (troops >= 10) {
          symbol += '+';
        } else {
          symbol += troops.toString();
        }
        
        // Add building indicator
        if (tile.building === 'Shrine') symbol += 'S';
        else if (tile.building === 'Fortress') symbol += 'F';
        else if (tile.building === 'Tower') symbol += 'T';
        else if (tile.building === 'Market') symbol += 'M';
        else if (tile.type === 'sacred') symbol += '☼';
        else symbol += '-';
        
        // Pad to 3 chars max, truncate if longer
        symbol = (symbol + '   ').substring(0, 4);
        visualization += symbol;
      }
      visualization += '\n';
    }
    
    visualization += 'Legend: A/B=factions, N=neutral, 0-9/+=troops, S/F/T/M=building, ☼=sacred\n\n';
    return visualization;
  }

  buildTacticalContext(grid, ownedTiles) {
    const attackOptions = [];
    const expansionTargets = [];
    const enemyThreats = [];
    
    // For each owned tile with troops, find adjacent options
    for (const tile of ownedTiles) {
      if (tile.troop_power > 0) {
        const adjacent = this.getAdjacentTiles(grid, tile.x, tile.y);
        
        for (const adj of adjacent) {
          if (adj.owner === 'Neutral' && adj.troop_power <= 3) {
            expansionTargets.push(`(${tile.x},${tile.y})→(${adj.x},${adj.y}):${adj.troop_power}t`);
          } else if (adj.owner !== this.name && adj.owner !== 'Neutral') {
            attackOptions.push(`(${tile.x},${tile.y})→(${adj.x},${adj.y}):${adj.troop_power}t${adj.owner}`);
          }
        }
      }
    }
    
    // Find enemy tiles that threaten us
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        const tile = grid[y][x];
        if (tile.owner !== this.name && tile.owner !== 'Neutral' && tile.troop_power > 0) {
          const adjacent = this.getAdjacentTiles(grid, x, y);
          const threateningMine = adjacent.some(adj => adj.owner === this.name);
          if (threateningMine) {
            enemyThreats.push(`(${x},${y}):${tile.troop_power}t${tile.owner}`);
          }
        }
      }
    }
    
    let context = '';
    if (expansionTargets.length > 0) {
      context += `NEARBY: ${expansionTargets.slice(0, 3).join(' ')}\n`;
    }
    if (attackOptions.length > 0) {
      context += `ENEMIES: ${attackOptions.slice(0, 2).join(' ')}\n`;
    }
    if (enemyThreats.length > 0) {
      context += `THREATS: ${enemyThreats.slice(0, 2).join(' ')}\n`;
    }
    
    return context;
  }

  findBorders(grid, myName, enemyName) {
    const borders = [];
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        if (grid[y][x].owner === myName && grid[y][x].troop_power > 0) {
          const adjacent = this.getAdjacentTiles(grid, x, y);
          for (const adj of adjacent) {
            if (adj.owner === enemyName) {
              borders.push({ my: `${x},${y}`, their: `${adj.x},${adj.y}` });
              if (borders.length >= 3) return borders;
            }
          }
        }
      }
    }
    return borders;
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
      'recruit': 'Reinforce',
      'assault': 'Assault',
      'convert': 'Convert',
      'construct': 'Construct',
      'redistribute': 'Redistribute',
      'sanctuary': 'Sanctuary',
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