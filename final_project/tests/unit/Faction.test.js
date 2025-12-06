// Test for Faction class - importing actual ES6 module
const path = require('path');
const fs = require('fs');

let Faction;

beforeAll(() => {
  // Read and convert ES6 Faction class to CommonJS
  const sourcePath = path.join(__dirname, '../../src/game/Faction.js');
  let sourceCode = fs.readFileSync(sourcePath, 'utf8');
  
  // Remove ES6 imports/exports and convert to CommonJS
  sourceCode = sourceCode
    .replace(/import\s+.*?from\s+['"].*?['"];\s*/g, '')
    .replace(/export\s*{\s*Faction\s*}/, '')
    .replace(/export\s+class\s+Faction/, 'class Faction');
  
  // Add CommonJS export
  sourceCode += '\nmodule.exports = { Faction };';
  
  // Execute the converted code
  const vm = require('vm');
  const context = { 
    module: { exports: {} }, 
    exports: {},
    require: require,
    console: console
  };
  
  vm.createContext(context);
  vm.runInContext(sourceCode, context);
  
  Faction = context.module.exports.Faction;
});

describe('Faction', () => {
  let faction;
  
  beforeEach(() => {
    faction = new Faction('TestFaction', 'aggressive');
  });
  
  test('should initialize with correct properties', () => {
    expect(faction.name).toBe('TestFaction');
    expect(faction.personality).toBe('aggressive');
    expect(faction.resources).toEqual({ R: 15, F: 8, I: 5 });
    expect(faction.isActive).toBe(false);
  });
  
  describe('resource management', () => {
    test('should add resources correctly', () => {
      faction.addResources(2, 3, 1);
      expect(faction.resources).toEqual({ R: 17, F: 11, I: 6 });
    });
    
    test('should check affordability correctly', () => {
      expect(faction.canAfford({ R: 5, F: 3 })).toBe(true);
      expect(faction.canAfford({ R: 20 })).toBe(false);
      expect(faction.canAfford({ I: 10 })).toBe(false);
    });
    
    test('should spend resources correctly', () => {
      faction.spendResources({ R: 3, F: 1 });
      expect(faction.resources).toEqual({ R: 12, F: 7, I: 5 });
    });
    
    test('should throw error when spending more than available', () => {
      expect(() => {
        faction.spendResources({ R: 20 });
      }).toThrow('Insufficient resources');
    });
  });
  
  describe('turn management', () => {
    test('should start turn correctly', () => {
      faction.startTurn();
      expect(faction.isActive).toBe(true);
    });
    
    test('should end turn correctly', () => {
      faction.startTurn();
      faction.endTurn();
      expect(faction.isActive).toBe(false);
    });
  });
  
  test('should clone correctly', () => {
    faction.addResources(5, 2, 1);
    faction.startTurn();
    
    const clone = faction.clone();
    
    expect(clone.name).toBe(faction.name);
    expect(clone.resources).toEqual(faction.resources);
    expect(clone.isActive).toBe(faction.isActive);
    
    // Ensure it's a deep copy
    clone.resources.R = 999;
    expect(faction.resources.R).not.toBe(999);
  });
});