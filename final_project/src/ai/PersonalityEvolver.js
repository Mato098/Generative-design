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

EVOLUTION TASK:
Evolve each AI personality in response to this divine intervention. All changes must preserve core identity while shifting worldview, behavior, and speech style based on the event.

CONSIDER:
1. DIRECT TARGET${Array.isArray(targetFaction) ? 'S' : ''} (${directTargetText}):
   How does being personally targeted or spared alter their confidence, tone, beliefs, or speech defects?

2. WITNESSES:
   How do factions adjust their mannerisms, reasoning style, or rhetorical tendencies when they watch others judged by divine power?

3. PERSONALITY CONSISTENCY:
   Core identity must remain intact, but growth should be meaningful—affecting worldview, decision logic, emotional tone, or linguistic quirks.

4. RELATIONSHIP DYNAMICS:
   How does their relationship to the divine entity shift?
   Fear? Reverence? Doubt? Opportunism? Pride? Humiliation?

EVOLUTION GUIDELINES:
- Modify personality_prompt (1–2 sentences per faction), focusing on:
  • evolution of speech patterns
  • intensification or weakening of quirks
  • shifts in certainty, confidence, or tone
  • new constraints or defects (e.g., hesitations, ritual phrases, clipped logic, manic spirals)
- Update core beliefs if worldview changes.
- Adjust decision style or authority relationship if their stance toward divine judgment shifts.
- Nonverbal markers (interjections, pauses, tics) may:
  • increase or decrease in frequency
  • shift meaning (confidence → doubt, reverence → fear)
  • become ritualized, obsessive, or suppressed
- Any evolution of nonverbal markers must remain persona-consistent
- Maintain the same JSON structure and original faction tags and names.
- Each faction reacts according to both:
  • its intrinsic nature
  • its relationship to the target(s)
- Evaluate perceived fairness, justice, favoritism, or randomness of the intervention.
The prompt is also a way to hold some long-term memory of big events. feel free to make them remember past events or have them accumlate relationship info
-do not make them remember coordinates (or 3x3), make it more general if nescessary
-it would be great if you kept in mind the dramatic arc of the entire game, and make personalities evolve in a way that makes sense for the overall story
STYLE MEMORY RULE:
Each personality retains memory of its own prior speech patterns.
If past messages were blunt, fragmented, hesitant, or grammatically rough, future speech must preserve or exaggerate those traits.
Do NOT allow personalities to become more articulate, eloquent, or rhetorically complex over time unless explicitly justified by a major worldview shift.

- All output must be valid JSON.`;
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