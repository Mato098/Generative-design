// Integration test for GameEngine - testing actual game flow
const path = require('path');
const fs = require('fs');

let GameEngine, GameState, Tile, Faction, ActionValidator;

beforeAll(() => {
  // Load all dependencies with MOCK AIAgent for testing
  // NOTE: AIAgent is mocked since we don't want to test actual OpenAI integration
  const mockAIAgent = `
    class AIAgent {
      constructor(name, personality, apiKey) {
        this.name = name;
        this.personality = personality;
        this.conversationHistory = [];
      }
      
      async getTurnActions(context) {
        // MOCK: Return a simple reinforcement action for testing
        return {
          actions: [{
            type: 'Reinforce',
            parameters: { x: 1, y: 1, target: 'troop_power' }
          }]
        };
      }
      
      updateConversationHistory(message) {
        this.conversationHistory.push(message);
      }
    }`;
  
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
    console: console
  };
  
  vm.createContext(context);
  vm.runInContext(combinedCode, context);
  
  GameEngine = context.module.exports.GameEngine;
  GameState = context.module.exports.GameState;
  Tile = context.module.exports.Tile;
  Faction = context.module.exports.Faction;
  ActionValidator = context.module.exports.ActionValidator;
});

describe('GameEngine Integration Tests (with MOCK AI agents)', () => {
  let gameEngine;
  
  beforeEach(() => {
    gameEngine = new GameEngine();
  });
  
  describe('Game Initialization (using MOCK AI agents)', () => {
    test('should start game with multiple factions (using mock AI agents)', async () => {
      const agentConfigs = [
        { name: 'Faction A', personality: 'aggressive', apiKey: 'test-key' },
        { name: 'Faction B', personality: 'defensive', apiKey: 'test-key' }
      ];
      
      await gameEngine.startGame(agentConfigs);
      
      expect(gameEngine.gameState.factions.size).toBe(2);
      expect(gameEngine.gameState.factions.has('Faction A')).toBe(true);
      expect(gameEngine.gameState.factions.has('Faction B')).toBe(true);
      expect(gameEngine.gameState.playerOrder).toContain('Observer');
      expect(gameEngine.gameState.gameStatus).toBe('active');
    });
    
    test('should initialize starting positions correctly', async () => {
      const agentConfigs = [
        { name: 'Faction A', personality: 'aggressive', apiKey: 'test-key' },
        { name: 'Faction B', personality: 'defensive', apiKey: 'test-key' }
      ];
      
      await gameEngine.startGame(agentConfigs);
      
      // Check starting positions
      const factionATile = gameEngine.gameState.getTile(1, 1);
      const factionBTile = gameEngine.gameState.getTile(8, 8);
      
      expect(factionATile.owner).toBe('Faction A');
      expect(factionATile.troop_power).toBeGreaterThan(0);
      expect(factionBTile.owner).toBe('Faction B');
      expect(factionBTile.troop_power).toBeGreaterThan(0);
    });
  });
  
  describe('Action Processing', () => {
    beforeEach(async () => {
      const agentConfigs = [
        { name: 'TestFaction', personality: 'aggressive', apiKey: 'test-key' }
      ];
      await gameEngine.startGame(agentConfigs);
    });
    
    test('should process reinforce action successfully', async () => {
      const action = {
        type: 'Reinforce',
        parameters: { x: 1, y: 1, target: 'troop_power' }
      };
      
      const initialTroops = gameEngine.gameState.getTile(1, 1).troop_power;
      const result = await gameEngine.executeAction(action, 'TestFaction', true);
      
      expect(result.success).toBe(true);
      expect(gameEngine.gameState.getTile(1, 1).troop_power).toBeGreaterThan(initialTroops);
    });
    
    test('should reject invalid actions', async () => {
      const invalidAction = {
        type: 'Reinforce',
        parameters: { x: 5, y: 5, target: 'troop_power' } // Not owned
      };
      
      const result = await gameEngine.executeAction(invalidAction, 'TestFaction', true);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    test('should track faction actions', async () => {
      const action = {
        type: 'Reinforce',
        parameters: { x: 1, y: 1, target: 'troop_power' }
      };
      
      const result = await gameEngine.executeAction(action, 'TestFaction', true);
      
      const faction = gameEngine.gameState.factions.get('TestFaction');
      expect(result.success).toBe(true);
      // In unlimited action system, verify action was executed by checking tile state
      const tile = gameEngine.gameState.getTile(1, 1);
      expect(tile.troop_power).toBeGreaterThan(5); // Should have increased from initial value of 5
    });
  });
  
  describe('Observer Actions', () => {
    beforeEach(async () => {
      const agentConfigs = [
        { name: 'TestFaction', personality: 'aggressive', apiKey: 'test-key' }
      ];
      await gameEngine.startGame(agentConfigs);
    });
    
    test('should execute observer bless action', async () => {
      const action = {
        type: 'Bless',
        parameters: { x: 1, y: 1, reason: 'Test blessing' }
      };
      
      // Mock processNextTurn to avoid async complications
      const originalProcessNextTurn = gameEngine.processNextTurn;
      gameEngine.processNextTurn = () => {}; // No-op
      
      const result = await gameEngine.executeObserverAction(action);
      
      expect(result.success).toBe(true);
      expect(result.action.type).toBe('Bless');
      // Tile should be blessed (stability = 10)
      expect(gameEngine.gameState.getTile(1, 1).stability).toBe(10);
      
      // Restore original method
      gameEngine.processNextTurn = originalProcessNextTurn;
    });
    
    test('should execute observer smite action', async () => {
      const action = {
        type: 'Smite',
        parameters: { x: 1, y: 1, reason: 'Divine punishment' }
      };
      
      const initialStability = gameEngine.gameState.getTile(1, 1).stability;
      const result = await gameEngine.executeObserverAction(action);
      
      expect(result.success).toBe(true);
      expect(gameEngine.gameState.getTile(1, 1).stability).toBeLessThan(initialStability);
    });
    
    test('should execute observer actions correctly', async () => {
      const blessAction = {
        type: 'Bless',
        parameters: { x: 1, y: 1, reason: 'Test blessing' }
      };
      
      // Mock processNextTurn to avoid async complications
      const originalProcessNextTurn = gameEngine.processNextTurn;
      gameEngine.processNextTurn = () => {}; // No-op
      
      const result = await gameEngine.executeObserverAction(blessAction);
      
      expect(result.success).toBe(true);
      expect(result.changes.type).toBe('bless');
      // Tile should be blessed (stability = 10)
      expect(gameEngine.gameState.getTile(1, 1).stability).toBe(10);
      
      // Restore original method
      gameEngine.processNextTurn = originalProcessNextTurn;
    });
  });
  
  describe('Victory Conditions', () => {
    beforeEach(async () => {
      const agentConfigs = [
        { name: 'TestFaction', personality: 'aggressive', apiKey: 'test-key' }
      ];
      await gameEngine.startGame(agentConfigs);
    });
    
    test('should detect domination victory with large territory', () => {
      // Give faction >50% tiles (51+ out of 100) for domination victory
      let count = 0;
      for (let y = 0; y < 10; y++) {
        for (let x = 0; x < 10; x++) {
          if (count < 80) { // 80% of tiles should definitely trigger domination
            gameEngine.gameState.grid[y][x].owner = 'TestFaction';
            count++;
          }
        }
      }
      
      const victory = gameEngine.gameState.checkVictoryConditions();
      expect(victory).toBeTruthy();
      expect(victory.type).toBe('domination');
      expect(victory.winner).toBe('TestFaction');
    });
    
    test('should detect domination victory', () => {
      // Give faction >50% tiles
      for (let i = 0; i < 55; i++) {
        const x = i % 10;
        const y = Math.floor(i / 10);
        gameEngine.gameState.grid[y][x].owner = 'TestFaction';
      }
      
      const victory = gameEngine.gameState.checkVictoryConditions();
      expect(victory).toBeTruthy();
      expect(victory.type).toBe('domination');
      expect(victory.winner).toBe('TestFaction');
    });
  });
  
  describe('Turn Management', () => {
    beforeEach(async () => {
      const agentConfigs = [
        { name: 'Faction A', personality: 'aggressive', apiKey: 'test-key' },
        { name: 'Faction B', personality: 'defensive', apiKey: 'test-key' }
      ];
      await gameEngine.startGame(agentConfigs);
    });
    
    test('should cycle through players correctly', () => {
      // Note: processNextTurn() was called during startGame(), so we may not start with Faction A
      const firstPlayer = gameEngine.gameState.getCurrentPlayerName();
      expect(['Faction A', 'Faction B', 'Observer']).toContain(firstPlayer);
      
      const secondPlayer = gameEngine.gameState.getCurrentPlayerName();
      gameEngine.gameState.nextPlayer();
      const thirdPlayer = gameEngine.gameState.getCurrentPlayerName();
      
      // Ensure we can cycle through different players
      expect(thirdPlayer).not.toBe(secondPlayer);
      
      // Check observer is in the rotation
      gameEngine.gameState.nextPlayer();
      const fourthPlayer = gameEngine.gameState.getCurrentPlayerName();
      expect(['Faction A', 'Faction B', 'Observer']).toContain(fourthPlayer);
    });
    
    test('should handle faction turn cycling correctly', () => {
      const faction = gameEngine.gameState.factions.get('Faction A');
      
      // Test that faction exists and can start turns 
      expect(faction).toBeDefined();
      expect(faction.name).toBe('Faction A');
      
      // Start new turn - this should work without errors in unlimited action system
      faction.startTurn();
      expect(faction.isActive).toBe(true);
    });
  });
  
  describe('Game State Serialization', () => {
    test('should provide JSON representation of game state', async () => {
      const agentConfigs = [
        { name: 'TestFaction', personality: 'aggressive', apiKey: 'test-key' }
      ];
      await gameEngine.startGame(agentConfigs);
      
      const jsonState = gameEngine.gameState.toJSON();
      
      expect(jsonState).toHaveProperty('grid');
      expect(jsonState).toHaveProperty('factions');
      expect(jsonState).toHaveProperty('currentPlayer');
      expect(jsonState).toHaveProperty('turnNumber');
      expect(jsonState).toHaveProperty('gameStatus');
      expect(jsonState.factions).toHaveProperty('TestFaction');
    });
  });
});