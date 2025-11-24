// Test for Tile class - importing actual ES6 module
const path = require('path');
const fs = require('fs');

let Tile;

beforeAll(() => {
  // Read and convert ES6 Tile class to CommonJS
  const sourcePath = path.join(__dirname, '../../src/game/Tile.js');
  let sourceCode = fs.readFileSync(sourcePath, 'utf8');
  
  // Remove ES6 imports/exports and convert to CommonJS
  sourceCode = sourceCode
    .replace(/import\s+.*?from\s+['"].*?['"];\s*/g, '')
    .replace(/export\s*{\s*Tile\s*}/, '')
    .replace(/export\s+class\s+Tile/, 'class Tile');
  
  // Add CommonJS export
  sourceCode += '\nmodule.exports = { Tile };';
  
  // Execute the converted code
  const vm = require('vm');
  const context = { 
    module: { exports: {} }, 
    exports: {},
    require: require,
    console: console,
    Buffer: Buffer,
    process: process
  };
  
  vm.createContext(context);
  vm.runInContext(sourceCode, context);
  
  Tile = context.module.exports.Tile;
});

describe('Tile', () => {
  let tile;
  
  beforeEach(() => {
    tile = new Tile(3, 4);
  });
  
  test('should initialize with correct coordinates', () => {
    expect(tile.x).toBe(3);
    expect(tile.y).toBe(4);
    expect(tile.owner).toBe('Neutral');
    expect(tile.type).toBe('plains');
    expect(tile.troop_power).toBe(0);
    expect(tile.stability).toBe(5);
    expect(tile.building).toBe('none');
    expect(tile.resource_value).toBe(0);
  });
  
  test('should calculate defense bonus correctly', () => {
    // Base case - no bonuses
    expect(tile.getDefenseBonus()).toBe(0);
    
    // Test with fortress
    tile.building = 'Fortress';
    expect(tile.getDefenseBonus()).toBe(4);
    
    // Test with tower
    tile.building = 'Tower';
    expect(tile.getDefenseBonus()).toBe(2);
    
    // Test with hill terrain
    tile.building = 'none';
    tile.type = 'hill';
    expect(tile.getDefenseBonus()).toBe(1);
    
    // Test with sacred terrain
    tile.type = 'sacred';
    expect(tile.getDefenseBonus()).toBe(2);
  });
  
  test('should calculate income correctly', () => {
    // Neutral tiles give no income
    tile.owner = 'Neutral';
    const neutralIncome = tile.getTurnIncome();
    expect(neutralIncome).toEqual({ R: 0, F: 0 });
    
    // Owned tile with base income
    tile.owner = 'TestFaction';
    tile.resource_value = 0;
    const baseIncome = tile.getTurnIncome();
    expect(baseIncome).toEqual({ R: 1, F: 0 }); // base R income = 1
    
    // With Market building
    tile.building = 'Market';
    const marketIncome = tile.getTurnIncome();
    expect(marketIncome.R).toBe(2); // 1 base + 1 market
    
    // With Shrine building
    tile.building = 'Shrine';
    const shrineIncome = tile.getTurnIncome();
    expect(shrineIncome.F).toBe(1); // Shrine gives Faith
  });
});