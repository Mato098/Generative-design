// Unit tests for GameEngine observer action implementations
const path = require('path');
const fs = require('fs');

let GameEngine, GameState, Tile, Faction, ActionValidator;

beforeAll(() => {
  // Load and prepare all source files using the same pattern as existing tests
  
  // Mock AIAgent to avoid OpenAI dependency
  const mockAIAgent = `
    class AIAgent {
      constructor(name, personality, apiKey) {
        this.name = name;
        this.personality = personality;
        this.conversationHistory = [];
      }
      
      async getTurnActions(context) {
        return { primary: null, secondary: null };
      }
    }
  `;
  
  // Load source files and clean imports/exports
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
  
  const enginePath = path.join(__dirname, '../../src/game/GameEngine.js');
  let engineCode = fs.readFileSync(enginePath, 'utf8')
    .replace(/import\s+.*?from\s+['"].*?['"];\s*/g, '')
    .replace(/export\s+class\s+GameEngine/, 'class GameEngine')
    .replace(/export\s*{\s*GameEngine\s*}/, '');
  
  // Combine all code with MOCK AIAgent
  const combinedCode = mockAIAgent + '\n' + tileCode + '\n' + factionCode + '\n' + gameStateCode + '\n' + validatorCode + '\n' + engineCode + '\nmodule.exports = { GameEngine, GameState, Tile, Faction, ActionValidator };';
  
  // Execute the converted code
  const vm = require('vm');
  const context = { 
    module: { exports: {} }, 
    exports: {},
    require: require,
    console: console,
    Math: Math,
    setTimeout: setTimeout,
    process: process
  };
  
  vm.createContext(context);
  vm.runInContext(combinedCode, context);
  
  // Extract classes
  ({ GameEngine, GameState, Tile, Faction, ActionValidator } = context.module.exports);
});

describe('GameEngine Observer Actions', () => {
  let gameEngine, gameState;
  
  beforeEach(() => {
    gameEngine = new GameEngine();
    gameState = gameEngine.gameState;
    
    // Add test factions
    gameState.addFaction('TestPlayer', 'aggressive');
    
    // Set up test tiles
    const playerTile = gameState.getTile(5, 5);
    playerTile.owner = 'TestPlayer';
    playerTile.troop_power = 8;
    playerTile.stability = 7;
    
    const neutralTile = gameState.getTile(3, 3);
    neutralTile.owner = 'Neutral';
    neutralTile.troop_power = 4;
    neutralTile.stability = 6;
  });

  describe('applyObserverAction - Smite', () => {
    test('should destroy troops and reduce stability on smite', () => {
      const action = {
        type: 'Smite',
        parameters: { x: 5, y: 5, reason: 'Divine punishment' }
      };
      
      const tile = gameState.getTile(5, 5);
      const originalStability = tile.stability;
      
      const result = gameEngine.applyObserverAction(action);
      
      expect(tile.troop_power).toBe(0);
      expect(tile.stability).toBe(Math.max(0, originalStability - 3));
      expect(result.type).toBe('smite');
      expect(result.tile).toEqual({ x: 5, y: 5 });
    });
    
    test('should not reduce stability below 0 on smite', () => {
      const action = {
        type: 'Smite',
        parameters: { x: 3, y: 3, reason: 'Divine wrath' }
      };
      
      const tile = gameState.getTile(3, 3);
      tile.stability = 2; // Will go below 0
      
      gameEngine.applyObserverAction(action);
      
      expect(tile.stability).toBe(0);
    });
  });

  describe('applyObserverAction - Bless', () => {
    test('should maximize stability and give resources on bless', () => {
      const action = {
        type: 'Bless',
        parameters: { x: 5, y: 5, reason: 'Divine favor' }
      };
      
      const tile = gameState.getTile(5, 5);
      const faction = gameState.factions.get('TestPlayer');
      const originalFaith = faction.resources.F;
      
      const result = gameEngine.applyObserverAction(action);
      
      expect(tile.stability).toBe(10);
      expect(faction.resources.F).toBe(originalFaith + 2);
      expect(result.type).toBe('bless');
      expect(result.tile).toEqual({ x: 5, y: 5 });
    });
    
    test('should not give resources if tile is neutral on bless', () => {
      const action = {
        type: 'Bless',
        parameters: { x: 3, y: 3, reason: 'Divine grace' }
      };
      
      const tile = gameState.getTile(3, 3);
      
      const result = gameEngine.applyObserverAction(action);
      
      expect(tile.stability).toBe(10);
      expect(result.type).toBe('bless');
      // No faction resources should change since tile is neutral
    });
  });

  describe('applyObserverAction - Observe', () => {
    test('should record observation without changing game state', () => {
      const action = {
        type: 'observe',
        parameters: { commentary: 'The gods watch silently' }
      };
      
      const tile = gameState.getTile(5, 5);
      const originalTroopPower = tile.troop_power;
      const originalStability = tile.stability;
      
      const result = gameEngine.applyObserverAction(action);
      
      // Game state should be unchanged
      expect(tile.troop_power).toBe(originalTroopPower);
      expect(tile.stability).toBe(originalStability);
      
      // But action should be recorded
      expect(result.type).toBe('observe');
      expect(result.commentary).toBe('The gods watch silently');
    });
  });

  describe('applyObserverAction - Meteor', () => {
    test('should damage 3x3 area centered on target', () => {
      const action = {
        type: 'meteor',
        parameters: { centerX: 5, centerY: 5, reason: 'Celestial bombardment' }
      };
      
      // Set up tiles in the impact area
      const centerTile = gameState.getTile(5, 5);
      const adjacentTile = gameState.getTile(4, 4);
      const cornerTile = gameState.getTile(6, 6);
      
      centerTile.troop_power = 10;
      centerTile.stability = 8;
      adjacentTile.troop_power = 5;
      adjacentTile.stability = 6;
      cornerTile.troop_power = 3;
      cornerTile.stability = 4;
      
      const result = gameEngine.applyObserverAction(action);
      
      // Check damage to all affected tiles
      expect(centerTile.troop_power).toBe(7); // 10 - 3
      expect(centerTile.stability).toBe(6);   // 8 - 2
      expect(adjacentTile.troop_power).toBe(2); // 5 - 3
      expect(adjacentTile.stability).toBe(4);   // 6 - 2
      expect(cornerTile.troop_power).toBe(0);   // 3 - 3
      expect(cornerTile.stability).toBe(2);     // 4 - 2
      
      expect(result.type).toBe('meteor');
      expect(result.center).toEqual({ x: 5, y: 5 });
      expect(result.affected).toHaveLength(9); // 3x3 area
    });
    
    test('should handle meteor at edge of map correctly', () => {
      const action = {
        type: 'meteor',
        parameters: { centerX: 0, centerY: 0, reason: 'Edge strike' }
      };
      
      const edgeTile = gameState.getTile(0, 0);
      const adjacentTile = gameState.getTile(1, 1);
      
      edgeTile.troop_power = 5;
      adjacentTile.troop_power = 5;
      
      const result = gameEngine.applyObserverAction(action);
      
      expect(edgeTile.troop_power).toBe(2); // 5 - 3
      expect(adjacentTile.troop_power).toBe(2); // 5 - 3
      
      // Should only affect valid tiles (not out of bounds)
      expect(result.affected.length).toBeLessThan(9);
      result.affected.forEach(pos => {
        expect(pos.x).toBeGreaterThanOrEqual(0);
        expect(pos.y).toBeGreaterThanOrEqual(0);
        expect(pos.x).toBeLessThan(10);
        expect(pos.y).toBeLessThan(10);
      });
    });
    
    test('should not reduce troops or stability below 0 with meteor', () => {
      const action = {
        type: 'meteor',
        parameters: { centerX: 3, centerY: 3, reason: 'Devastating impact' }
      };
      
      const tile = gameState.getTile(3, 3);
      tile.troop_power = 1; // Will go below 0
      tile.stability = 1;   // Will go below 0
      
      gameEngine.applyObserverAction(action);
      
      expect(tile.troop_power).toBe(0);
      expect(tile.stability).toBe(0);
    });
  });

  describe('Observer Action Error Handling', () => {
    test('should throw error for unknown observer action', () => {
      const action = {
        type: 'unknownAction',
        parameters: { x: 5, y: 5 }
      };
      
      expect(() => {
        gameEngine.applyObserverAction(action);
      }).toThrow('Unknown observer action: unknownAction');
    });
  });

  describe('Observer Action Integration', () => {
    test('should properly execute observer action through executeObserverAction', async () => {
      const action = {
        type: 'Smite',
        parameters: { x: 5, y: 5, reason: 'Test smite' }
      };
      
      // Mock the game state methods needed
      gameState.addObserverAction = jest.fn();
      gameState.nextPlayer = jest.fn();
      gameEngine.processNextTurn = jest.fn();
      
      const tile = gameState.getTile(5, 5);
      const originalTroopPower = tile.troop_power;
      
      const result = await gameEngine.executeObserverAction(action);
      
      expect(result.success).toBe(true);
      expect(result.action).toEqual(action);
      expect(tile.troop_power).toBe(0); // Smite effect applied
      expect(gameState.addObserverAction).toHaveBeenCalledWith(action);
    });
  });
});