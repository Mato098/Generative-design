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
    expect(faction.resources).toEqual({ R: 10, F: 5, I: 3 });
    expect(faction.actionsThisTurn).toEqual({ primary: null, secondary: null });
    expect(faction.isActive).toBe(false);
  });
  
  describe('resource management', () => {
    test('should add resources correctly', () => {
      faction.addResources(2, 3, 1);
      expect(faction.resources).toEqual({ R: 12, F: 8, I: 4 });
    });
    
    test('should check affordability correctly', () => {
      expect(faction.canAfford({ R: 5, F: 3 })).toBe(true);
      expect(faction.canAfford({ R: 15 })).toBe(false);
      expect(faction.canAfford({ I: 5 })).toBe(false);
    });
    
    test('should spend resources correctly', () => {
      faction.spendResources({ R: 3, F: 1 });
      expect(faction.resources).toEqual({ R: 7, F: 4, I: 3 });
    });
    
    test('should throw error when spending more than available', () => {
      expect(() => {
        faction.spendResources({ R: 15 });
      }).toThrow('Insufficient resources');
    });
  });
  
  describe('action tracking', () => {
    test('should track primary actions', () => {
      expect(faction.hasUsedPrimaryAction()).toBe(false);
      faction.recordAction('Reinforce', true);
      expect(faction.hasUsedPrimaryAction()).toBe(true);
      expect(faction.actionsThisTurn.primary).toBe('Reinforce');
    });
    
    test('should track secondary actions', () => {
      expect(faction.hasUsedSecondaryAction()).toBe(false);
      faction.recordAction('Convert', false);
      expect(faction.hasUsedSecondaryAction()).toBe(true);
      expect(faction.actionsThisTurn.secondary).toBe('Convert');
    });
    
    test('should reset actions on turn start', () => {
      faction.recordAction('Reinforce', true);
      faction.recordAction('Convert', false);
      
      faction.startTurn();
      
      expect(faction.hasUsedPrimaryAction()).toBe(false);
      expect(faction.hasUsedSecondaryAction()).toBe(false);
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
    faction.recordAction('Reinforce', true);
    
    const clone = faction.clone();
    
    expect(clone.name).toBe(faction.name);
    expect(clone.resources).toEqual(faction.resources);
    expect(clone.actionsThisTurn).toEqual(faction.actionsThisTurn);
    
    // Ensure it's a deep copy
    clone.resources.R = 999;
    expect(faction.resources.R).not.toBe(999);
  });
});