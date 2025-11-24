export class Faction {
  constructor(name, personality = null) {
    this.name = name;
    this.personality = personality; // AI personality traits
    this.resources = {
      R: 10, // Resources (float)
      F: 5,  // Faith (float)
      I: 3   // Influence (float)
    };
    this.actionsThisTurn = {
      primary: null,
      secondary: null
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
    this.actionsThisTurn = {
      primary: null,
      secondary: null
    };
    this.isActive = true;
  }

  endTurn() {
    this.isActive = false;
  }

  hasUsedPrimaryAction() {
    return this.actionsThisTurn.primary !== null;
  }

  hasUsedSecondaryAction() {
    return this.actionsThisTurn.secondary !== null;
  }

  recordAction(actionType, isPrimary) {
    if (isPrimary) {
      this.actionsThisTurn.primary = actionType;
    } else {
      this.actionsThisTurn.secondary = actionType;
    }
  }

  clone() {
    const newFaction = new Faction(this.name, this.personality);
    newFaction.resources = { ...this.resources };
    newFaction.actionsThisTurn = { ...this.actionsThisTurn };
    newFaction.isActive = this.isActive;
    return newFaction;
  }
}