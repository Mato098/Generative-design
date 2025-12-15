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
      console.log('⏳⏳⏳⏳⏳⏳⏳⏳⏳⏳⏳ Evolving personalities...');
      
      const startTime = Date.now();
      const response = await this.openai.chat.completions.create({
        model: "gpt-5.1-2025-11-13",
        messages: [
          {
            role: "system",
            content: "You are a personality evolution specialist. Given AI personalities of rulers/monarchs and a divine event, make subtle(or dramatic) but meaningful changes to how these personalities might evolve in response. Keep core traits but allow for growth, trauma, enlightenment, or rebellion as appropriate. Return ONLY valid JSON with the same structure as input."
          },
          {
            role: "user",
            content: evolutionPrompt
          }
        ],
        temperature: 0.7,
        max_completion_tokens: 2000
      });

      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(response.choices[0].message.content);
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
    console.log(eventDescription);

    // Support multiple direct targets (array or string)
    let directTargetText = 'none';
    if (Array.isArray(targetFaction)) {
      if (targetFaction.length === 1) directTargetText = targetFaction[0];
      else if (targetFaction.length > 1) directTargetText = targetFaction.join(', ');
    } else if (targetFaction) {
      directTargetText = targetFaction;
    }

    return `DIVINE EVENT: ${eventDescription}

CURRENT PERSONALITIES:
${JSON.stringify(personalities, null, 2)}

TASK:
Evolve each AI personality in response to this divine intervention.
Preserve core identity. Changes must be meaningful but concise.
This prompt also serves as long-term memory of major events.

CONSIDER:

1. DIRECT TARGET${Array.isArray(targetFaction) ? 'S' : ''} (${directTargetText}):
   How does being targeted or spared affect confidence, tone, beliefs, emotional state, or speech defects?
   Reactions should be strong but compact.

2. WITNESSES:
   How do others adjust tone, reasoning style, or caution after observing divine judgment?

3. CONSISTENCY:
   Do not replace the core persona.
   Intensify or constrain existing traits only.

4. RELATIONSHIPS (MEMORY):
   Update remembered impressions of others’ words, actions, or silences during this event.
   Also update how this faction remembers the divine’s past behavior toward them.

   ALLOWED:
   • remembered support, abandonment, fear, admiration, debt, mistrust
   • recent events outweigh older ones
   • compress repeated patterns into brief judgments

   FORBIDDEN:
   • permanent allies/enemies
   • fixed trust tables
   • strategy or future commitments
   • stable relationship labels

GUIDELINES:
- Modify personality_prompt only.
- Keep additions SHORT.
- Prefer intensifying existing quirks over adding new ones.
- Nonverbal markers may increase, fade, or shift meaning.

RELATIONSHIP MEMORY FORMAT:
- If added, include ONE short section inside personality_prompt:
  • "Relational Impressions:"
  • "Lingering Judgments:"
  • or "Remembered Slights and Debts:"
- Max 3 bullets total.
- Bullets must be brief (≤12 words each).
- Naming factions is allowed only for specific remembered events.
- Divine relationship may be mentioned here.

STYLE MEMORY RULE:
Preserve prior speech style.
Do NOT increase eloquence or complexity unless justified by major worldview change.

HARD OUTPUT LIMITS (IMPORTANT):
- Each personality_prompt must be ≤ 120 words total.
- Relationship memory section is optional but, if present, ≤ 3 bullets.
- Do not expand background lore.

CONSTRAINTS:
- No spatial details.
- Memories must be narrative, not mechanical.
- Favor developments that support the long-term dramatic arc.

OUTPUT:
- Maintain the same JSON structure, tags, and names.
- Output MUST be valid JSON.
- Do not include explanations or extra text.

`;
  }

  describeDivineEvent(divineEvent, targetFaction) {
    const { type, parameters } = divineEvent;
    console.log('Divine Event:', divineEvent);
    
    const targetInfo = targetFaction ? ` targeting ${targetFaction}` : ' on neutral territory';
    
    switch (type.toLowerCase()) {
      case 'smite':
        return `Divine Power Manifested - A force struck (${parameters.x},${parameters.y})${targetInfo}, annihilating all troops.`;
        
      case 'bless':
        return `Divine Power Manifested - Energy surged at (${parameters.x},${parameters.y})${targetInfo}, spreading faith and estabilishing a Shrine.`;
        
      case 'meteor':
        return `Celestial Event - A meteor fell at (${parameters.centerX || parameters.x},${parameters.centerY || parameters.y})${targetInfo}, devastating a 3x3 area.`;
        
      case 'message':
        return `Divine Voice - The powers spoke: "${parameters.text || 'nothing'}"`;
      
      default:
        return `Divine Event - The powers acted at${targetInfo}: ${divineEvent.parameters}`;
    }
  }

  /**
   * Get which faction owns a specific tile coordinate
   * @param {Object} gameState - Current game state
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {string|null} Faction name or null
   */
  static getTargetFactions(gameState, x, y, type) {
    const tile = gameState.getTile(x, y);
    if (typeof type === 'string' && type.toLowerCase() === 'meteor') { // do 3x3 area check
      let result = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const areaTile = gameState.getTile(x + dx, y + dy);
          if (areaTile && areaTile.owner !== 'Neutral' && !result.includes(areaTile.owner)) {
            result.push(areaTile.owner);
          }
        }
      }
      return result;
    }
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