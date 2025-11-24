// Test setup and global configurations

// Mock console.log during tests to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Global test utilities
global.createMockGameState = () => ({
  grid: Array(10).fill(null).map((_, y) => 
    Array(10).fill(null).map((_, x) => ({
      x, y, owner: 'Neutral', type: 'plains', 
      troop_power: 0, stability: 5, building: 'none', resource_value: 0
    }))
  ),
  factions: new Map(),
  currentPlayerIndex: 0,
  turnNumber: 1,
  gameStatus: 'active',
  observerActions: [],
  playerOrder: []
});

// Timeout for async tests
jest.setTimeout(10000);