// Combat utility functions - shared between client and server

/**
 * Evaluates the outcome of an attack between attacking power and a defending tile
 * @param {number} attackPower - The attacking power (troop count being sent)
 * @param {Object} defendTile - The defending tile object with troop_power, type, building
 * @param {Object} sourceTile - The source tile object with total troop_power
 * @returns {Object} - {victorystatus: 'victory'|'defeat', newSourceTroops, newTargetTroops}
 */
/**
 * Calculate effective defense power with diminishing returns after 10 troops
 * @param {number} troopPower - Raw troop count on tile
 * @returns {number} - Effective defense power
 */
export function calculateEffectiveDefense(troopPower) {
  if (troopPower <= 10) {
    return troopPower;
  } else {
    return 10 + (troopPower - 10) * 0.25;
  }
}

export function evalAttackOutcome(attackPower, defendTile, sourceTile) {
  const baseDefense = calculateEffectiveDefense(defendTile.troop_power);
  const hillBonus = defendTile.type === 'hill' ? 2 : 0;
  const sacredBonus = defendTile.type === 'sacred' ? 3 : 0;
  
  // Defense buildings provide multipliers now instead of flat bonuses
  let defenseMultiplier = 1.0;
  if (defendTile.building === 'Fortress') {
    defenseMultiplier = 1.8; // 80% defense bonus
  } else if (defendTile.building === 'Tower') {
    defenseMultiplier = 1.4; // 40% defense bonus
  }
  
  const defensePower = (baseDefense + hillBonus + sacredBonus) * defenseMultiplier;

  const attackRoll = Math.random() * 0.4 + 0.8; // 0.8 to 1.2 multiplier
  const defenseRoll = Math.random() * 0.4 + 0.8; // 0.8 to 1.2 multiplier
  const finalAttackPower = attackPower * attackRoll;
  const finalDefensePower = defensePower * defenseRoll;

  let victorystatus = null;
  let newSourceTroops = null;
  let newTargetTroops = null;
  
  if (finalAttackPower > finalDefensePower) {
    // Victory - attacker wins
    const excessPower = finalAttackPower - finalDefensePower;
    newSourceTroops = sourceTile.troop_power - attackPower; // Remaining troops stay on source
    newTargetTroops = Math.min(excessPower, 50); // Surviving attacking troops occupy target
    victorystatus = 'victory';
  } else {
    // Defeat - defender wins
    newSourceTroops = sourceTile.troop_power - attackPower; // Attacking troops lost, others remain
    // Defender casualties proportional to attacking force strength
    const casualtyRatio = Math.min(attackPower / (defendTile.troop_power + 5), 0.8); 
    newTargetTroops = defendTile.troop_power * (1 - casualtyRatio);
    victorystatus = 'defeat';
  }
  
  return {
    victorystatus,
    newSourceTroops,
    newTargetTroops
  };
}

/**
 * Determines if a move action is an attack or friendly troop movement
 * @param {Object} sourceTile - The source tile
 * @param {Object} targetTile - The target tile
 * @returns {boolean} - true if it's an attack, false if friendly movement
 */
export function isAttack(sourceTile, targetTile) {
  return sourceTile.owner !== targetTile.owner;
}