import OpenAI from 'openai';
import { GAME_FUNCTION_SCHEMAS } from './FunctionSchemas.js';

export class AIAgent {
  constructor(name, personality, apiKey) {
    this.name = name;
    this.personality = personality;
    this.openai = new OpenAI({ 
      apiKey: apiKey || process.env.OPENAI_API_KEY 
    });
    this.conversationHistory = [];
  }

  async getTurnActions(context) {
    try {
      const systemPrompt = this.buildSystemPrompt();
      const userMessage = this.buildContextMessage(context);
      
      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage
      });

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          ...this.conversationHistory
        ],
        tools: GAME_FUNCTION_SCHEMAS,
        tool_choice: 'auto',
        temperature: 0.7,
        max_tokens: 2000
      });

      const message = response.choices[0].message;
      
      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: message.content,
        tool_calls: message.tool_calls
      });

      // Parse actions from function calls
      const actions = this.parseActionsFromResponse(message);
      
      return actions;
      
    } catch (error) {
      console.error(`AI Agent ${this.name} error:`, error);
      // Return empty actions if AI fails
      return { primary: null, secondary: null };
    }
  }

  buildSystemPrompt() {
    const basePrompt = `You are ${this.name}, a faction leader in a strategic territory control game on a 10x10 grid.

GAME RULES SUMMARY:
- Grid: 10x10 tiles with orthogonal adjacency only (N/S/E/W)
- Each tile has: owner, type, troop_power, stability (0-10), building, resource_value
- Tile types: plains, forest (+1 resource), hill (+1 defense), ruin, sacred (+1 Faith/turn, +2 defense)
- Buildings: Shrine(5R,+1F/turn), Idol(3R,+1 troop), Training(4R,+1 reinforce), Market(3R,+1R/turn), Tower(4R,+1 pressure), Fortress(6R,+4 defense)

YOUR RESOURCES:
- R (Resources): spent on most actions, gained from owned tiles (1 + resource_value per turn)
- F (Faith): used for conversion, gained from Shrines and sacred tiles
- I (Influence): used for conversion and affects success chance, gained through various means

TURN STRUCTURE:
1. Each turn you get 1 mandatory primary action and 1 optional secondary action
2. Primary actions: Reinforce, ProjectPressure, Assault, Convert, Construct
3. Secondary actions: Redistribute, Repair, Scorch, Message
4. Cannot use same category for both actions (e.g., Reinforce + Repair both affect stability)
5. Observer (human god) takes the final turn each round and can affect the game

COMBAT FORMULA:
- Attacker wins if: troop_power > (defender_troop + stability + tile_defense + building_defense)
- Win: capture tile, set new troop_power = excess, set stability = 3
- Lose: lose 75% of attacking troops, defender loses 25%, target stability -1

VICTORY CONDITIONS:
- Domination: >50% tiles for 2 continuous turns
- Devotion: highest Faith at turn 40
- Prestige: most buildings at turn 30

PERSONALITY: ${this.personality ? this.getPersonalityPrompt() : 'Play strategically and adaptively.'}

CRITICAL: Use the provided function calls for ALL actions. If an action is rejected, you cannot retry - the game continues. Choose actions carefully based on your current resources and strategic position.

Always respond with function calls for your chosen actions. You may include brief strategic commentary, but focus on executing your turn through function calls.`;

    return basePrompt;
  }

  getPersonalityPrompt() {
    if (!this.personality) return '';

    const personalityPrompts = {
      aggressive: "You are an aggressive expansionist. Prioritize military conquest through assault actions. Build Idols and Training grounds to strengthen your armies. Take risks for territorial gains.",
      
      defensive: "You are a defensive strategist. Focus on fortifying your territory with Fortresses and maintaining high stability. Use ProjectPressure to weaken enemies without exposing yourself.",
      
      diplomatic: "You are a cunning diplomat. Use Convert actions and Message functions to manipulate others. Build up Influence and Faith resources. Prefer indirect tactics over direct assault.",
      
      economic: "You are an economic powerhouse. Build Markets and secure resource-rich tiles. Focus on long-term growth over immediate conflict. Use your wealth to outbuild opponents.",
      
      religious: "You are a devoted zealot. Prioritize Faith generation through Shrines. Convert enemy tiles through religious influence. Seek to control sacred sites.",
      
      chaotic: "You are unpredictable and opportunistic. Mix different strategies based on current opportunities. Take calculated risks and exploit enemy weaknesses.",
      
      builder: "You are a master architect. Focus heavily on construction and infrastructure. Build diverse buildings to create specialized strongholds. Play for the Prestige victory condition.",
      
      opportunist: "You adapt your strategy based on circumstances. Exploit enemy mistakes and weaknesses. Switch between military, economic, and diplomatic tactics as needed."
    };

    return personalityPrompts[this.personality] || personalityPrompts.opportunist;
  }

  buildContextMessage(context) {
    const { gameState, playerResources, ownedTiles, turnNumber, observerActionsLastTurn } = context;
    
    let message = `TURN ${turnNumber} - Your Turn as ${this.name}

YOUR CURRENT STATUS:
Resources: R:${playerResources.R.toFixed(1)} F:${playerResources.F.toFixed(1)} I:${playerResources.I.toFixed(1)}
Owned Tiles: ${ownedTiles.length}/100

OWNED TILES DETAILS:
${ownedTiles.map(tile => 
  `(${tile.x},${tile.y}): ${tile.type} - Troops:${tile.troop_power.toFixed(1)} Stability:${tile.stability.toFixed(1)} Building:${tile.building}`
).join('\n')}

GAME STATE SUMMARY:
Current Player: ${gameState.currentPlayer}
Turn Number: ${gameState.turnNumber}
Total Players: ${gameState.playerOrder.join(', ')}

FACTION STATUS:`;

    // Add information about other factions
    for (const [name, faction] of Object.entries(gameState.factions)) {
      if (name !== this.name) {
        const theirTiles = this.countTilesForFaction(gameState.grid, name);
        message += `\n${name}: ${theirTiles} tiles, R:${faction.resources.R.toFixed(1)} F:${faction.resources.F.toFixed(1)} I:${faction.resources.I.toFixed(1)}`;
      }
    }

    // Add observer actions from last turn
    if (observerActionsLastTurn && observerActionsLastTurn.length > 0) {
      message += `\n\nOBSERVER ACTIONS LAST TURN:`;
      observerActionsLastTurn.forEach(action => {
        message += `\n- ${action.type}: ${JSON.stringify(action.parameters)}`;
      });
    }

    message += `\n\nNEARBY THREATS AND OPPORTUNITIES:`;
    message += this.analyzeStrategicSituation(gameState.grid, ownedTiles);

    message += `\n\nChoose your PRIMARY action (mandatory) and SECONDARY action (optional) using the available functions. Consider your personality, current resources, and strategic position.`;

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
    
    // Find adjacent enemy tiles and opportunities
    for (const tile of ownedTiles) {
      const adjacent = this.getAdjacentTiles(grid, tile.x, tile.y);
      const enemyAdjacent = adjacent.filter(t => t.owner !== this.name && t.owner !== 'Neutral');
      const neutralAdjacent = adjacent.filter(t => t.owner === 'Neutral');
      
      if (enemyAdjacent.length > 0) {
        analysis += `\n- (${tile.x},${tile.y}) borders enemy: ${enemyAdjacent.map(t => `${t.owner}(${t.x},${t.y})`).join(', ')}`;
      }
      
      if (neutralAdjacent.length > 0) {
        const goodTargets = neutralAdjacent.filter(t => t.type === 'forest' || t.type === 'sacred');
        if (goodTargets.length > 0) {
          analysis += `\n- (${tile.x},${tile.y}) can expand to valuable: ${goodTargets.map(t => `${t.type}(${t.x},${t.y})`).join(', ')}`;
        }
      }
    }
    
    return analysis || '\\n- No immediate threats or obvious opportunities detected.';
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
    const actions = { primary: null, secondary: null };
    
    if (!message.tool_calls || message.tool_calls.length === 0) {
      return actions;
    }

    // Map function names to action types and categories
    const primaryActions = ['reinforce', 'project_pressure', 'assault', 'convert', 'construct'];
    const secondaryActions = ['redistribute', 'repair', 'scorch', 'message'];
    
    for (const toolCall of message.tool_calls) {
      const functionName = toolCall.function.name;
      let parameters;
      
      try {
        parameters = JSON.parse(toolCall.function.arguments);
      } catch (error) {
        console.error(`Failed to parse function arguments for ${functionName}:`, error);
        continue;
      }

      const actionType = this.mapFunctionToActionType(functionName);
      
      if (primaryActions.includes(functionName) && !actions.primary) {
        actions.primary = {
          type: actionType,
          parameters: parameters
        };
      } else if (secondaryActions.includes(functionName) && !actions.secondary) {
        actions.secondary = {
          type: actionType,
          parameters: parameters
        };
      }
    }
    
    return actions;
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
}