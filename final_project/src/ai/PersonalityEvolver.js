import OpenAI from 'openai';

/**
 * PersonalityEvolver - Uses LLM to dynamically evolve AI personalities based on divine interventions
 * This creates organic character development rather than hardcoded responses
 */
export class PersonalityEvolver {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Evolve personalities based on a divine event
   * @param {Object} personalities - Current personality states for all AIs
   * @param {Object} divineEvent - The divine intervention that occurred
   * @param {string} targetFaction - Which faction was directly affected (if any)
   * @returns {Object} Updated personality states
   */
  async evolvePersonalities(personalities, divineEvent, targetFaction = null) {
    try {
      const evolutionPrompt = this.buildEvolutionPrompt(personalities, divineEvent, targetFaction);
      
      const startTime = Date.now();
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a personality evolution specialist. Given AI personalities and a divine event, make subtle but meaningful changes to how these personalities might evolve in response. Keep core traits but allow for growth, trauma, enlightenment, or rebellion as appropriate. Return ONLY valid JSON with the same structure as input."
          },
          {
            role: "user",
            content: evolutionPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      
      const evolvedPersonalities = JSON.parse(response.choices[0].message.content);
      console.log(`⏱️ Personality evolution completed: ${duration / 1000}s`);
      
      return evolvedPersonalities;
      
    } catch (error) {
      console.error('Personality evolution failed:', error);
      // Return unchanged personalities on error
      return personalities;
    }
  }

  buildEvolutionPrompt(personalities, divineEvent, targetFaction) {
    const eventDescription = this.describeDivineEvent(divineEvent, targetFaction);
    
    return `DIVINE EVENT: ${eventDescription}

CURRENT PERSONALITIES:
${JSON.stringify(personalities, null, 2)}

EVOLUTION TASK:
Based on this divine intervention, evolve each AI personality slightly. Consider:

1. DIRECT TARGET (${targetFaction || 'none - neutral territory affected'}): How does being personally targeted/spared change them?
2. WITNESSES: How do other factions react to seeing someone else targeted by divine power?
3. PERSONALITY CONSISTENCY: Keep core traits but allow meaningful growth based on their relationship to the target
4. RELATIONSHIP DYNAMICS: How might their view of the divine entity change based on who was targeted and why?

EVOLUTION GUIDELINES:
- Subtle changes to personality_prompt (1-2 sentence modifications)
- Possible additions to core_beliefs if worldview shifts based on targeting patterns
- Changes to authority_relationship based on divine favoritism or wrath
- Keep the same JSON structure
- Each faction should react according to their existing nature AND their relationship to the target
- Consider: Was this fair? Deserved? Random? What does this say about the divine entity's judgment?

Return the evolved personalities as valid JSON:`;
  }

  describeDivineEvent(divineEvent, targetFaction) {
    const { type, parameters } = divineEvent;
    
    const targetInfo = targetFaction ? ` targeting ${targetFaction}` : ' on neutral territory';
    
    switch (type.toLowerCase()) {
      case 'smite':
        return `Divine Wrath - The god smote (${parameters.x},${parameters.y})${targetInfo}, destroying troops and destabilizing the land. ${parameters.reason || 'No reason given'}.`;
        
      case 'bless':
        return `Divine Blessing - The god blessed (${parameters.x},${parameters.y})${targetInfo}, stabilizing the land and granting resources. ${parameters.reason || 'No reason given'}.`;
        
      case 'meteor':
        return `Divine Cataclysm - The god summoned a meteor at (${parameters.centerX || parameters.x},${parameters.centerY || parameters.y})${targetInfo}, affecting a 3x3 area with widespread destruction. ${parameters.reason || 'No reason given'}.`;
        
      case 'observe':
        return `Divine Observation - The god watched and commented: "${parameters.commentary || 'Silent observation'}"`;
        
      case 'sanctify':
        return `Divine Sanctification - The god sanctified (${parameters.x},${parameters.y})${targetInfo}, granting great blessings and stability. ${parameters.reason || 'No reason given'}.`;
        
      case 'rend':
        return `Divine Destruction - The god rent (${parameters.x},${parameters.y})${targetInfo}, tearing apart troops and buildings. ${parameters.reason || 'No reason given'}.`;
        
      default:
        return `Divine Intervention - The god performed ${type}${targetInfo} with parameters: ${JSON.stringify(parameters)}`;
    }
  }

  /**
   * Get which faction owns a specific tile coordinate
   * @param {Object} gameState - Current game state
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {string|null} Faction name or null
   */
  static getTargetFaction(gameState, x, y) {
    const tile = gameState.getTile(x, y);
    return tile && tile.owner !== 'Neutral' ? tile.owner : null;
  }

  /**
   * Extract just the essential personality data for evolution
   * @param {Object} fullPersonalities - Complete personality objects
   * @returns {Object} Simplified personality data for LLM processing
   */
  static extractPersonalityEssence(fullPersonalities) {
    const essence = {};
    
    for (const [faction, personality] of Object.entries(fullPersonalities)) {
      if (personality && personality.name) {
        essence[faction] = {
          name: personality.name,
          core_beliefs: personality.core_beliefs,
          behavioral_tendencies: personality.behavioral_tendencies,
          personality_prompt: personality.personality_prompt
        };
      }
    }
    
    return essence;
  }

  /**
   * Merge evolved personality changes back into full personality objects
   * @param {Object} currentPersonalities - Current full personality objects
   * @param {Object} evolvedEssence - Evolution results from LLM
   * @returns {Object} Updated full personality objects
   */
  static mergeEvolutionResults(currentPersonalities, evolvedEssence) {
    const merged = { ...currentPersonalities };
    
    for (const [faction, evolvedData] of Object.entries(evolvedEssence)) {
      if (merged[faction] && evolvedData) {
        // Merge evolved changes into existing personality structure
        merged[faction] = {
          ...merged[faction],
          core_beliefs: evolvedData.core_beliefs || merged[faction].core_beliefs,
          behavioral_tendencies: evolvedData.behavioral_tendencies || merged[faction].behavioral_tendencies,
          personality_prompt: evolvedData.personality_prompt || merged[faction].personality_prompt
        };
      }
    }
    
    return merged;
  }
}