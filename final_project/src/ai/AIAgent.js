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
    
    return `${this.name} - Conquest ruler seeking TOTAL DOMINATION!
VICTORY: Eliminate all other factions by conquering their territories!

USE execute_turn_plan() with actions: move, recruit, convert, construct, sanctuary, send_message.

RULES:
- Move: Send troops to adjacent tile (attack enemies/neutrals, relocate on your tiles)
- Recruit: Add troops to ANY owned tile (costs 1R per troop) - BUILD YOUR ARMY!
- Convert: Take neutral tiles with Faith (costs 3F)
- Construct: Build on YOUR tiles (costs R) - Shrine/Idol(+F), Market(+R), Tower/Fortress(defense)
- Sanctuary: Protect tile from attack for 2 turns (costs 4F)
- Send_message: Broadcast to all factions or pray to divine powers
- Income: Each tile gives 1R per turn, Shrine/sacred give +F (faith is scarce!)
- Only act on/from tiles you own (marked with your letter on map)
- Adjacent = up/down/left/right only

Your strategy and decisions should be heavily influenced by your personality.

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
      aggressive: "Aggressive expansionist. Prioritize move/attack actions and territorial conquest.",
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
    
    let message = `TURN ${turnNumber} - Your Turn as ${this.name}

YOUR CURRENT RESOURCES:
- Resources: ${playerResources.R.toFixed(0)}R (for troops, buildings) 
- Faith: ${playerResources.F.toFixed(0)}F (for conversions, sanctuary)

ACTION COSTS REMINDER:
- Recruit: 1R per troop (can recruit on ANY owned tile!)
- Move: FREE (attack or relocate troops)
- Convert: 3F
- Construct: 3-6R (Shrine 5R, Market 3R, etc)
- Sanctuary: 4F (protection for 2 turns)
- send_message: FREE

ELIMINATION VICTORY: Destroy all enemy factions to win! Be aggressive!

`;
    
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
      'move': 'Move',
      'convert': 'Convert',
      'construct': 'Construct',
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