// Unit tests for GameEngine action implementations
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

describe('GameEngine Action Implementations', () => {
  let gameEngine, gameState;
  
  beforeEach(() => {
    gameEngine = new GameEngine();
    gameState = gameEngine.gameState;
    
    // Add test factions
    gameState.addFaction('TestPlayer', 'aggressive');
    gameState.addFaction('Enemy', 'defensive');
    
    // Set up test tiles
    const playerTile = gameState.getTile(1, 1);
    playerTile.owner = 'TestPlayer';
    playerTile.troop_power = 10;
    playerTile.stability = 8;
    
    const enemyTile = gameState.getTile(3, 3);
    enemyTile.owner = 'Enemy';
    enemyTile.troop_power = 3;
    enemyTile.stability = 5;
    
    const neutralTile = gameState.getTile(2, 1);
    neutralTile.owner = 'Neutral';
    neutralTile.troop_power = 2;
    neutralTile.stability = 3;
  });

  describe('applyReinforceAction', () => {
    test('should increase troop power correctly', () => {
      const action = {
        type: 'Reinforce',
        parameters: { x: 1, y: 1, target: 'troop_power' }
      };
      
      const tile = gameState.getTile(1, 1);
      const oldPower = tile.troop_power;
      
      const result = gameEngine.applyReinforceAction(action, 'TestPlayer');
      
      expect(tile.troop_power).toBe(oldPower + 1);
      expect(result.type).toBe('troop_power_change');
      expect(result.newValue).toBe(tile.troop_power);
    });
    
    test('should increase stability correctly', () => {
      const action = {
        type: 'Reinforce',
        parameters: { x: 1, y: 1, target: 'stability' }
      };
      
      const tile = gameState.getTile(1, 1);
      const oldStability = tile.stability;
      
      const result = gameEngine.applyReinforceAction(action, 'TestPlayer');
      
      expect(tile.stability).toBe(Math.min(oldStability + 1, 10));
      expect(result.type).toBe('stability_change');
    });
    
    test('should cap troop power at 50', () => {
      const tile = gameState.getTile(1, 1);
      tile.troop_power = 49;
      
      const action = {
        type: 'Reinforce',
        parameters: { x: 1, y: 1, target: 'troop_power' }
      };
      
      gameEngine.applyReinforceAction(action, 'TestPlayer');
      
      expect(tile.troop_power).toBe(50);
    });
  });

  describe('applyProjectPressureAction', () => {
    test('should reduce target tile stability', () => {
      const action = {
        type: 'ProjectPressure',
        parameters: { x: 3, y: 3 }
      };
      
      const tile = gameState.getTile(3, 3);
      const oldStability = tile.stability;
      
      const result = gameEngine.applyProjectPressureAction(action, 'TestPlayer');
      
      expect(tile.stability).toBe(Math.max(0, oldStability - 1));
      expect(result.type).toBe('stability_change');
    });
    
    test('should not reduce stability below 0', () => {
      const tile = gameState.getTile(3, 3);
      tile.stability = 0;
      
      const action = {
        type: 'ProjectPressure',
        parameters: { x: 3, y: 3 }
      };
      
      gameEngine.applyProjectPressureAction(action, 'TestPlayer');
      
      expect(tile.stability).toBe(0);
    });
  });

  describe('applyMoveAction', () => {
    test('should capture weak enemy tile on successful attack', () => {
      const action = {
        type: 'Move',
        parameters: { 
          fromX: 1, fromY: 1, 
          targetX: 2, targetY: 1, 
          strength: 0.8 
        }
      };
      
      const fromTile = gameState.getTile(1, 1);
      const targetTile = gameState.getTile(2, 1);
      
      fromTile.troop_power = 10;
      targetTile.troop_power = 1;
      targetTile.stability = 1;
      
      const result = gameEngine.applyMoveAction(action, 'TestPlayer');
      
      expect(result.type).toBe('conquest');
      expect(result.success).toBe(true);
      expect(targetTile.owner).toBe('TestPlayer');
      expect(targetTile.stability).toBe(3);
    });
    
    test('should fail attack against strong enemy', () => {
      const action = {
        type: 'Move',
        parameters: { 
          fromX: 1, fromY: 1, 
          targetX: 3, targetY: 3, 
          strength: 0.5 
        }
      };
      
      const fromTile = gameState.getTile(1, 1);
      const targetTile = gameState.getTile(3, 3);
      
      fromTile.troop_power = 5;
      targetTile.troop_power = 8;
      targetTile.stability = 8;
      
      const result = gameEngine.applyAssaultAction(action, 'TestPlayer');
      
      expect(result.type).toBe('assault_failed');
      expect(result.success).toBe(false);
      expect(targetTile.owner).toBe('Enemy'); // Should remain unchanged
    });
  });

  describe('applyConvertAction', () => {
    test('should attempt conversion and spend resources', () => {
      const action = {
        type: 'Convert',
        parameters: { x: 2, y: 1 }
      };
      
      const faction = gameState.factions.get('TestPlayer');
      const originalFaith = faction.resources.F;
      const originalInfluence = faction.resources.I;
      
      const result = gameEngine.applyConvertAction(action, 'TestPlayer');
      
      expect(faction.resources.F).toBe(originalFaith - 2);
      expect(faction.resources.I).toBe(originalInfluence - 1);
      expect(['conversion_success', 'conversion_failed']).toContain(result.type);
    });
    
    test('should convert tile on success', () => {
      const action = {
        type: 'Convert',
        parameters: { x: 2, y: 1 }
      };
      
      const targetTile = gameState.getTile(2, 1);
      const faction = gameState.factions.get('TestPlayer');
      
      // Set high influence for guaranteed success
      faction.resources.I = 10;
      
      // Mock Math.random to guarantee success
      const originalRandom = Math.random;
      Math.random = () => 0.1; // Force success
      
      const result = gameEngine.applyConvertAction(action, 'TestPlayer');
      
      Math.random = originalRandom; // Restore
      
      if (result.success) {
        expect(targetTile.owner).toBe('TestPlayer');
        expect(targetTile.stability).toBe(5);
      }
    });
  });

  describe('applyConstructAction', () => {
    test('should build shrine correctly', () => {
      const action = {
        type: 'Construct',
        parameters: { x: 1, y: 1, building: 'Shrine' }
      };
      
      const tile = gameState.getTile(1, 1);
      const faction = gameState.factions.get('TestPlayer');
      const originalResources = faction.resources.R;
      
      const result = gameEngine.applyConstructAction(action, 'TestPlayer');
      
      expect(tile.building).toBe('Shrine');
      expect(faction.resources.R).toBe(originalResources - 5);
      expect(result.type).toBe('construction');
      expect(result.newBuilding).toBe('Shrine');
    });
    
    test('should build different building types with correct costs', () => {
      const buildings = [
        { name: 'Market', cost: 3 },
        { name: 'Idol', cost: 3 },
        { name: 'Training', cost: 4 },
        { name: 'Tower', cost: 4 },
        { name: 'Fortress', cost: 6 }
      ];
      
      buildings.forEach(building => {
        // Reset for each test
        gameEngine = new GameEngine();
        gameState = gameEngine.gameState;
        gameState.addFaction('TestPlayer', 'aggressive');
        const tile = gameState.getTile(1, 1);
        tile.owner = 'TestPlayer';
        
        const faction = gameState.factions.get('TestPlayer');
        const originalResources = faction.resources.R;
        
        const action = {
          type: 'Construct',
          parameters: { x: 1, y: 1, building: building.name }
        };
        
        gameEngine.applyConstructAction(action, 'TestPlayer');
        
        expect(tile.building).toBe(building.name);
        expect(faction.resources.R).toBe(originalResources - building.cost);
      });
    });
  });

  describe('applyRedistributeAction', () => {
    test('should transfer troops between tiles', () => {
      const action = {
        type: 'Redistribute',
        parameters: { 
          fromX: 1, fromY: 1, 
          toX: 2, toY: 1, 
          amount: 3 
        }
      };
      
      const fromTile = gameState.getTile(1, 1);
      const toTile = gameState.getTile(2, 1);
      
      fromTile.troop_power = 10;
      toTile.troop_power = 2;
      toTile.owner = 'TestPlayer'; // Must be owned to transfer to
      
      const result = gameEngine.applyMoveAction(action, 'TestPlayer');
      
      expect(fromTile.troop_power).toBe(7);
      expect(toTile.troop_power).toBe(5);
      expect(result.success).toBe(true);
    });
    
    test('should not transfer more troops than available', () => {
      const action = {
        type: 'Redistribute',
        parameters: { 
          fromX: 1, fromY: 1, 
          toX: 2, toY: 1, 
          amount: 15 
        }
      };
      
      const fromTile = gameState.getTile(1, 1);
      const toTile = gameState.getTile(2, 1);
      
      fromTile.troop_power = 8;
      toTile.owner = 'TestPlayer';
      
      const result = gameEngine.applyMoveAction(action, 'TestPlayer');
      
      expect(fromTile.troop_power).toBe(0); // All troops moved
      expect(toTile.troop_power).toBe(8); // Received troops
    });
  });

  describe('applyRepairAction', () => {
    test('should increase tile stability', () => {
      const action = {
        type: 'Repair',
        parameters: { x: 1, y: 1 }
      };
      
      const tile = gameState.getTile(1, 1);
      tile.stability = 6;
      
      const faction = gameState.factions.get('TestPlayer');
      const originalResources = faction.resources.R;
      
      const result = gameEngine.applyRepairAction(action, 'TestPlayer');
      
      expect(tile.stability).toBe(8);
      expect(faction.resources.R).toBe(originalResources - 1);
      expect(result.type).toBe('stability_change');
    });
    
    test('should cap stability at 10', () => {
      const action = {
        type: 'Repair',
        parameters: { x: 1, y: 1 }
      };
      
      const tile = gameState.getTile(1, 1);
      tile.stability = 9;
      
      gameEngine.applyRepairAction(action, 'TestPlayer');
      
      expect(tile.stability).toBe(10);
    });
  });

  describe('applyScorchAction', () => {
    test('should damage enemy tile', () => {
      const action = {
        type: 'Scorch',
        parameters: { x: 3, y: 3 }
      };
      
      const tile = gameState.getTile(3, 3);
      const originalStability = tile.stability;
      const originalTroops = tile.troop_power;
      
      const faction = gameState.factions.get('TestPlayer');
      const originalResources = faction.resources.R;
      
      const result = gameEngine.applyScorchAction(action, 'TestPlayer');
      
      expect(tile.stability).toBe(Math.max(0, originalStability - 3));
      expect(tile.troop_power).toBe(Math.max(0, originalTroops - 2));
      expect(faction.resources.R).toBe(originalResources - 2);
      expect(result.type).toBe('scorch');
    });
    
    test('should not reduce stability or troops below 0', () => {
      const action = {
        type: 'Scorch',
        parameters: { x: 3, y: 3 }
      };
      
      const tile = gameState.getTile(3, 3);
      tile.stability = 1;
      tile.troop_power = 1;
      
      gameEngine.applyScorchAction(action, 'TestPlayer');
      
      expect(tile.stability).toBe(0);
      expect(tile.troop_power).toBe(0);
    });
  });

  describe('Resource Management in Actions', () => {
    test('should properly spend resources for each action type', () => {
      const faction = gameState.factions.get('TestPlayer');
      
      // Test different resource costs
      const actionTests = [
        { action: 'Reinforce', params: { x: 1, y: 1, target: 'troop_power' }, cost: { R: 1 } },
        { action: 'Reinforce', params: { x: 1, y: 1, target: 'stability' }, cost: { R: 2 } },
        { action: 'ProjectPressure', params: { x: 3, y: 3 }, cost: { R: 1 } },
        { action: 'Convert', params: { x: 2, y: 1 }, cost: { F: 2, I: 1 } },
        { action: 'Repair', params: { x: 1, y: 1 }, cost: { R: 1 } },
        { action: 'Scorch', params: { x: 3, y: 3 }, cost: { R: 2 } }
      ];
      
      actionTests.forEach(test => {
        // Reset faction resources
        faction.resources = { R: 20, F: 10, I: 10 };
        const originalResources = { ...faction.resources };
        
        const action = { type: test.action, parameters: test.params };
        const methodName = `apply${test.action}Action`;
        
        gameEngine[methodName](action, 'TestPlayer');
        
        // Check resource spending
        Object.entries(test.cost).forEach(([resource, cost]) => {
          expect(faction.resources[resource]).toBe(originalResources[resource] - cost);
        });
      });
    });
  });
});