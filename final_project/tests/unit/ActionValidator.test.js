// Test for ActionValidator class - importing actual ES6 module
const path = require('path');
const fs = require('fs');

let ActionValidator, GameState, Tile, Faction;

beforeAll(() => {
  // Load all dependencies first
  const tilePath = path.join(__dirname, '../../src/game/Tile.js');
  let tileCode = fs.readFileSync(tilePath, 'utf8')
    .replace(/export\s+class\s+Tile/, 'class Tile')
    .replace(/export\s*{\s*Tile\s*}/, '');
  
  const factionPath = path.join(__dirname, '../../src/game/Faction.js');
  let factionCode = fs.readFileSync(factionPath, 'utf8')
    .replace(/export\s+class\s+Faction/, 'class Faction')
    .replace(/export\s*{\s*Faction\s*}/, '');
  
  const gameStatePath = path.join(__dirname, '../../src/game/GameState.js');
  let gameStateCode = fs.readFileSync(gameStatePath, 'utf8')
    .replace(/import\s+.*?from\s+['"].*?['"];\s*/g, '')
    .replace(/export\s+class\s+GameState/, 'class GameState')
    .replace(/export\s*{\s*GameState\s*}/, '');
  
  const validatorPath = path.join(__dirname, '../../src/game/ActionValidator.js');
  let validatorCode = fs.readFileSync(validatorPath, 'utf8')
    .replace(/import\s+.*?from\s+['"].*?['"];\s*/g, '')
    .replace(/export\s+class\s+ActionValidator/, 'class ActionValidator')
    .replace(/export\s*{\s*ActionValidator\s*}/, '');
  
  // Combine all code
  const combinedCode = tileCode + '\n' + factionCode + '\n' + gameStateCode + '\n' + validatorCode + '\nmodule.exports = { ActionValidator, GameState, Tile, Faction };';
  
  // Execute the converted code
  const vm = require('vm');
  const context = { 
    module: { exports: {} }, 
    exports: {},
    require: require,
    console: console
  };
  
  vm.createContext(context);
  vm.runInContext(combinedCode, context);
  
  ActionValidator = context.module.exports.ActionValidator;
  GameState = context.module.exports.GameState;
  Tile = context.module.exports.Tile;
  Faction = context.module.exports.Faction;
});

describe('ActionValidator', () => {
  let validator, gameState;
  
  beforeEach(() => {
    validator = new ActionValidator();
    gameState = new GameState();
    gameState.addFaction('TestPlayer', 'aggressive');
    
    // Set up test tiles
    gameState.getTile(0, 0).owner = 'TestPlayer';
    gameState.getTile(0, 0).troop_power = 5;
    gameState.getTile(0, 1).owner = 'Enemy';
    gameState.getTile(0, 1).troop_power = 3;
  });
  
  describe('validateReinforce', () => {
    test('should validate successful reinforce action', () => {
      const result = validator.validateReinforce({
        parameters: { x: 0, y: 0, target: 'troop_power' }
      }, gameState, 'TestPlayer');
      
      expect(result.valid).toBe(true);
    });
    
    test('should reject reinforcing enemy tiles', () => {
      const result = validator.validateReinforce({
        parameters: { x: 0, y: 1, target: 'troop_power' }
      }, gameState, 'TestPlayer');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('owned');
    });
    
    test('should reject when insufficient resources', () => {
      // Spend all resources
      const faction = gameState.factions.get('TestPlayer');
      faction.resources = { R: 0, F: 0, I: 0 };
      
      const result = validator.validateReinforce({
        parameters: { x: 0, y: 0, target: 'troop_power' }
      }, gameState, 'TestPlayer');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('resources');
    });
  });
  
  describe('validateConstruct', () => {
    test('should validate successful build action', () => {
      const result = validator.validateConstruct({
        parameters: { x: 0, y: 0, building: 'Market' }
      }, gameState, 'TestPlayer');
      
      expect(result.valid).toBe(true);
    });
    
    test('should reject building on tiles with existing buildings', () => {
      gameState.getTile(0, 0).building = 'Shrine';
      
      const result = validator.validateConstruct({
        parameters: { x: 0, y: 0, building: 'Market' }
      }, gameState, 'TestPlayer');
      
      expect(result.valid).toBe(false);
    });
  });
  
  describe('validateAssault', () => {
    test('should validate successful attack', () => {
      const result = validator.validateAssault({
        parameters: { fromX: 0, fromY: 0, targetX: 0, targetY: 1 }
      }, gameState, 'TestPlayer');
      
      expect(result.valid).toBe(true);
    });
    
    test('should reject attack with no troops', () => {
      gameState.getTile(0, 0).troop_power = 0;
      
      const result = validator.validateAssault({
        parameters: { fromX: 0, fromY: 0, targetX: 0, targetY: 1 }
      }, gameState, 'TestPlayer');
      
      expect(result.valid).toBe(false);
    });
    
    test('should reject non-adjacent attacks', () => {
      const result = validator.validateAssault({
        parameters: { fromX: 0, fromY: 0, targetX: 2, targetY: 2 }
      }, gameState, 'TestPlayer');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('adjacent');
    });
  });
  
  describe('helper methods', () => {
    test('areAdjacent should correctly identify adjacent tiles', () => {
      expect(validator.areAdjacent(0, 0, 0, 1)).toBe(true);
      expect(validator.areAdjacent(0, 0, 1, 0)).toBe(true);
      expect(validator.areAdjacent(5, 5, 4, 5)).toBe(true);
      expect(validator.areAdjacent(5, 5, 5, 6)).toBe(true);
    });
    
    test('areAdjacent should correctly identify non-adjacent tiles', () => {
      expect(validator.areAdjacent(0, 0, 0, 2)).toBe(false);
      expect(validator.areAdjacent(0, 0, 2, 2)).toBe(false);
      expect(validator.areAdjacent(5, 5, 7, 7)).toBe(false);
      expect(validator.areAdjacent(5, 5, 6, 6)).toBe(false); // Diagonal
    });
  });
});