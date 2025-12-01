export class Tile {
  constructor(x, y, type = 'plains') {
    this.x = x;
    this.y = y;
    this.owner = 'Neutral'; // 'Faction A', 'Faction B', 'Neutral'
    this.type = type; // 'plains', 'forest', 'hill', 'ruin', 'sacred'
    this.troop_power = 1.0; // Neutral tiles start with 1 troop
    this.building = 'none'; // 'none', 'Shrine', 'Idol', 'Training', 'Market', 'Tower', 'Fortress'
    this.resource_value = this.getBaseResourceValue();
  }

  getBaseResourceValue() {
    switch (this.type) {
      case 'forest': return 1;
      case 'hill': return 0;
      case 'ruin': return 0;
      case 'sacred': return 0;
      case 'plains': return 0;
      default: return 0;
    }
  }

  getDefenseBonus() {
    let bonus = 0;
    
    // Tile type bonuses
    if (this.type === 'hill') bonus += 1;
    if (this.type === 'sacred') bonus += 2;
    
    // Building bonuses
    if (this.building === 'Fortress') bonus += 4;
    if (this.building === 'Tower') bonus += 2;
    
    return bonus;
  }

  getTurnIncome() {
    let income = { R: 0, F: 0 };
    
    if (this.owner !== 'Neutral') {
      // Base resource income
      income.R = 1 + this.resource_value;
      
      // Building bonuses
      if (this.building === 'Market') income.R += 1;
      if (this.building === 'Shrine') income.F += 1;
      if (this.type === 'sacred') income.F += 1;
    }
    
    return income;
  }

  clone() {
    const newTile = new Tile(this.x, this.y, this.type);
    newTile.owner = this.owner;
    newTile.troop_power = this.troop_power;
    newTile.building = this.building;
    newTile.resource_value = this.resource_value;
    return newTile;
  }
}