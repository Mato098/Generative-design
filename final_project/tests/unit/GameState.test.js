// Test for GameState class - importing actual ES6 module
const path = require('path');
const fs = require('fs');

let GameState, Tile, Faction;

beforeAll(() => {
  // First load Tile class
  const tilePath = path.join(__dirname, '../../src/game/Tile.js');
  let tileCode = fs.readFileSync(tilePath, 'utf8');
  tileCode = tileCode
    .replace(/export\s+class\s+Tile/, 'class Tile')
    .replace(/export\s*{\s*Tile\s*}/, '');
  
  // Then load Faction class
  const factionPath = path.join(__dirname, '../../src/game/Faction.js');
  let factionCode = fs.readFileSync(factionPath, 'utf8');
  factionCode = factionCode
    .replace(/export\s+class\s+Faction/, 'class Faction')
    .replace(/export\s*{\s*Faction\s*}/, '');
  
  // Load GameState class
  const gameStatePath = path.join(__dirname, '../../src/game/GameState.js');
  let gameStateCode = fs.readFileSync(gameStatePath, 'utf8');
  gameStateCode = gameStateCode
    .replace(/import\s+.*?from\s+['"].*?['"];\s*/g, '') // Remove imports
    .replace(/export\s+class\s+GameState/, 'class GameState')
    .replace(/export\s*{\s*GameState\s*}/, '');
  
  // Combine all code
  const combinedCode = tileCode + '\n' + factionCode + '\n' + gameStateCode + '\nmodule.exports = { GameState, Tile, Faction };';
  
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
  
  GameState = context.module.exports.GameState;
  Tile = context.module.exports.Tile;
  Faction = context.module.exports.Faction;
});

describe('GameState', () => {
  let gameState;
  
  beforeEach(() => {
    gameState = new GameState();
  });
  
  test('should initialize correctly', () => {
    expect(gameState.grid).toHaveLength(10);
    expect(gameState.grid[0]).toHaveLength(10);
    expect(gameState.factions.size).toBe(0); // Start with no factions
    expect(gameState.currentPlayerIndex).toBe(0);
    expect(gameState.turnNumber).toBe(1);
    expect(gameState.gameStatus).toBe('setup');
    expect(gameState.playerOrder).toEqual([]);
  });
  
  describe('grid management', () => {
    test('should get tiles correctly', () => {
      const tile = gameState.getTile(5, 5);
      expect(tile).toBeDefined();
      expect(tile.x).toBe(5);
      expect(tile.y).toBe(5);
      expect(tile).toBeInstanceOf(Tile);
    });
    
    test('should return null for invalid coordinates', () => {
      expect(gameState.getTile(-1, 5)).toBeNull();
      expect(gameState.getTile(10, 5)).toBeNull();
      expect(gameState.getTile(5, -1)).toBeNull();
      expect(gameState.getTile(5, 10)).toBeNull();
    });
    
    test('should find adjacent tiles correctly', () => {
      const adjacent = gameState.getAdjacentTiles(5, 5);
      expect(adjacent).toHaveLength(4); // 4 cardinal directions
      
      // Corner case - fewer adjacent tiles
      const cornerAdjacent = gameState.getAdjacentTiles(0, 0);
      expect(cornerAdjacent.length).toBeLessThan(4);
    });
  });
  
  describe('faction management', () => {
    test('should add factions correctly', () => {
      const faction = gameState.addFaction('TestFaction', 'aggressive');
      
      expect(faction.name).toBe('TestFaction');
      expect(faction.personality).toBe('aggressive');
      expect(gameState.factions.has('TestFaction')).toBe(true);
      expect(gameState.playerOrder).toContain('TestFaction');
    });
    
    test('should add observer correctly', () => {
      gameState.addObserver();
      expect(gameState.playerOrder).toContain('Observer');
    });
    
    test('should track current player correctly', () => {
      gameState.addFaction('Player1', 'aggressive');
      gameState.addFaction('Player2', 'defensive');
      gameState.addObserver();
      
      expect(gameState.getCurrentPlayerName()).toBe('Player1');
      gameState.nextPlayer();
      expect(gameState.getCurrentPlayerName()).toBe('Player2');
      gameState.nextPlayer();
      expect(gameState.getCurrentPlayerName()).toBe('Observer');
      gameState.nextPlayer(); // Should wrap around and increment turn
      expect(gameState.getCurrentPlayerName()).toBe('Player1');
      expect(gameState.turnNumber).toBe(2);
    });
  });
  
  describe('game state queries', () => {
    beforeEach(() => {
      gameState.addFaction('TestFaction', 'aggressive');
      // Give faction some tiles
      gameState.getTile(0, 0).owner = 'TestFaction';
      gameState.getTile(0, 1).owner = 'TestFaction';
      gameState.getTile(1, 0).owner = 'TestFaction';
    });
    
    test('should count owned tiles correctly', () => {
      const ownedTiles = gameState.getOwnedTiles('TestFaction');
      expect(ownedTiles).toHaveLength(3);
      expect(ownedTiles[0].owner).toBe('TestFaction');
    });
    
    test('should provide JSON representation', () => {
      const jsonState = gameState.toJSON();
      
      expect(jsonState).toHaveProperty('grid');
      expect(jsonState).toHaveProperty('factions');
      expect(jsonState).toHaveProperty('currentPlayer');
      expect(jsonState).toHaveProperty('turnNumber');
      expect(jsonState).toHaveProperty('gameStatus');
    });
  });
  
  describe('observer actions', () => {
    test('should record observer actions', () => {
      const action = {
        type: 'bless',
        parameters: { x: 5, y: 5, reason: 'Test blessing' }
      };
      
      gameState.addObserverAction(action);
      
      expect(gameState.observerActions).toHaveLength(1);
      expect(gameState.observerActions[0].type).toBe('bless');
      expect(gameState.observerActions[0].parameters.x).toBe(5);
    });
  });
});