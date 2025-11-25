export class Faction {
  constructor(name, personality = null) {
    this.name = name;
    this.personality = personality; // AI personality traits
    this.resources = {
      R: 15, // Resources (float) - increased for easier expansion
      F: 8,  // Faith (float) - increased for conversion options
      I: 5   // Influence (float) - increased for better conversion chances
    };
    this.isActive = false;
  }

  addResources(R = 0, F = 0, I = 0) {
    this.resources.R += R;
    this.resources.F += F;
    this.resources.I += I;
  }

  canAfford(cost) {
    for (const [resource, amount] of Object.entries(cost)) {
      if (this.resources[resource] < amount) {
        return false;
      }
    }
    return true;
  }

  spendResources(cost) {
    if (!this.canAfford(cost)) {
      throw new Error(`Insufficient resources: ${JSON.stringify(cost)}`);
    }
    
    for (const [resource, amount] of Object.entries(cost)) {
      this.resources[resource] -= amount;
    }
  }

  startTurn() {
    this.isActive = true;
  }

  endTurn() {
    this.isActive = false;
  }

  clone() {
    const newFaction = new Faction(this.name, this.personality);
    newFaction.resources = { ...this.resources };
    newFaction.isActive = this.isActive;
    return newFaction;
  }
}