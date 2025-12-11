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
      
      // Store tool calls for later feedback
      this.pendingToolCalls = message.tool_calls || [];
      
      // Don't add tool results here - will be added after action execution
      
      return result;
      
    } catch (error) {
      console.error(`AI Agent ${this.name} error:`, error);
      // Return empty actions if AI fails
      return { actions: [], message: null };
    }
  }

  // Provide feedback on action results to the AI
  addActionFeedback(actionResults) {
    if (this.pendingToolCalls && actionResults) {
      // Ensure we have the assistant message with tool_calls in our history
      const lastMessage = this.conversationHistory[this.conversationHistory.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant' || !lastMessage.tool_calls) {
        console.warn(`⚠️ Missing assistant message with tool_calls for ${this.name}, skipping feedback`);
        this.pendingToolCalls = null;
        return;
      }
      
      for (let i = 0; i < this.pendingToolCalls.length && i < actionResults.length; i++) {
        const toolCall = this.pendingToolCalls[i];
        const result = actionResults[i];
        
        this.conversationHistory.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            action: toolCall.function.name,
            success: result.success,
            reason: result.error || "Action completed successfully"
          })
        });
      }
      this.pendingToolCalls = null;
      
      // Trim conversation history after adding tool results
      // But keep at least the last user + assistant + tool sequence intact
      if (this.conversationHistory.length > 8) {
        // Find the start of the last complete turn (user message)
        let keepFromIndex = Math.max(0, this.conversationHistory.length - 6);
        for (let i = keepFromIndex; i >= 0; i--) {
          if (this.conversationHistory[i].role === 'user') {
            keepFromIndex = i;
            break;
          }
        }
        this.conversationHistory = this.conversationHistory.slice(keepFromIndex);
        console.log(`🔪 Trimmed ${this.name} conversation history to ${this.conversationHistory.length} messages`);
      }
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
- Convert: Take adjacent tile with Faith (costs 3F). enemy troops flee to adjacent tiles, eliminated if no space
- Construct: Build on YOUR tiles (costs R) - see building details below
- Sanctuary: Protect tile from attacks for 2 turns (costs 4F)
- Send_message: Broadcast to all factions or pray to divine powers
- Income: Each tile gives 1R per turn, Shrine/sacred give +F (faith is scarce!)
- Only act on/from tiles you own (marked with your letter on map)
- Adjacent = up/down/left/right only

BUILDINGS (construct costs and effects):
- Shrine: 5R → +1 Faith per turn (essential for conversions & sanctuary)
- Idol: 1R, 2F → +1 Faith per turn (cheaper faith generation)
- Market: 3R → +1 Resources per turn (economic boost)
- Tower: 4R → +40% defense multiplier (moderate protection)
- Fortress: 6R → +80% defense multiplier (strong protection) 
- Training: 4R → enables recruitment efficiency (building benefit varies)

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

  buildContextMessage(context) {
    const { gameState, playerResources, ownedTiles, turnNumber, observerActionsLastTurn } = context;
    
    // DEBUG: Log observer actions
    console.log(`🌟 Observer actions for ${this.name}:`, observerActionsLastTurn);
    
    let message = `TURN ${turnNumber} - Your Turn as ${this.name}

YOUR CURRENT RESOURCES:
- Resources: ${playerResources.R.toFixed(0)}R (for troops, buildings) 
- Faith: ${playerResources.F.toFixed(0)}F (for conversions, sanctuary)

ACTION COSTS REMINDER:
- Recruit: 1R for first 5 troops/turn, 2R for next 5, then 3R each (diminishing returns!)
- Move: FREE (attack or relocate troops)
- Convert: 3F
- Construct Buildings:
  • Shrine: 5R (produces +1F/turn)
  • Market: 4R (produces +1R/turn) 
  • Tower: 5R (defense x1.4 multiplier)
  • Fortress: 10R (defense x1.8 multiplier)
  • Idol: 3R + 2F (produces +1F/turn)
  • Training: 5R (doubles recruitment - gives bonus troops equal to amount recruited)
- Sanctuary: 4F (protection for 2 turns)
- send_message: FREE

BALANCE NOTES:
• Max 20 troops per tile (hard cap)
• Defense has diminishing returns: full power up to 10 troops, then 25% effectiveness above

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
    let visualization = 'MAP (each cell: owner,troops,building):\n';
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
        
        // Add exact troop count for better AI decision making
        const troops = Math.floor(tile.troop_power);
        if (troops >= 100) {
          symbol += '99+'; // Cap display at 99+
        } else if (troops >= 10) {
          symbol += troops.toString();
        } else {
          symbol += troops.toString();
        }
        
        // Add building indicator
        if (tile.building === 'Shrine') symbol += 'S';
        else if (tile.building === 'Fortress') symbol += 'F';
        else if (tile.building === 'Tower') symbol += 'T';
        else if (tile.building === 'Market') symbol += 'M';
        else if (tile.building === 'Training') symbol += 'R'; // R for Recruitment
        else if (tile.building === 'Idol') symbol += 'I';
        else if (tile.type === 'sacred') symbol += '☼';
        else symbol += '-';
        
        // Pad to 4 chars max, truncate if longer
        symbol = (symbol + '    ').substring(0, 4);
        visualization += symbol;
      }
      visualization += '\n';
    }
    
    visualization += 'Legend: A/B=factions, N=neutral, numbers=troops, S(shrine)/F(fortress)/T(tower)/M(market)/R(recruitment)/I(idol)=buildings\n';
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