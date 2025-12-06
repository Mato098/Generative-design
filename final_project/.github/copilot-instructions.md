# GitHub Copilot Instructions for LLM Strategy Game

## Project Overview
This is a turn-based strategy game designed for Large Language Model (LLM) agents using OpenAI function calling. The game features a dual-component architecture with a Node.js backend for game logic and P5.js frontend for real-time visualization. AI agents control factions while an Observer (god mode) can intervene with divine powers.

## Core Architecture Principles

### 1. Dual-Component Design
- **Backend (Node.js/Express)**: Game logic, AI integration, WebSocket communication
- **Frontend (P5.js)**: Visualization, animation queue, user interface
- **Separation of Concerns**: Game state managed server-side, visualization client-side
- **Real-time Communication**: WebSocket for live updates and action broadcasting

### 2. Module Structure
```
src/
├── game/          # Core game logic
│   ├── GameEngine.js      # Main game loop and turn management
│   ├── GameState.js       # State management and grid operations
│   ├── ActionValidator.js # Rule enforcement and action validation
│   ├── Tile.js           # Individual tile logic
│   └── Faction.js        # Faction/player management
├── ai/            # AI integration
│   ├── AIAgent.js         # OpenAI integration and conversation
│   └── FunctionSchemas.js # Function calling definitions
├── observer/      # Observer/god mode functionality
│   └── ObserverInterface.js
└── server/        # Server utilities
    └── WebSocketManager.js
```

## Development Conventions

### ES6 Modules
- **All source files use ES6 modules** (`import`/`export` syntax)
- **Package.json specifies `"type": "module"`**
- **Test files use CommonJS** for Jest compatibility (`.test.js` files only)
- Always use relative paths with `.js` extension for imports

### File Organization
- **Class-based architecture**: Each major component is a class in its own file
- **Single responsibility**: Each class handles one domain (GameEngine = game loop, GameState = state management)
- **Dependency injection**: Classes receive dependencies via constructor or setter methods

### Naming Conventions
```javascript
// Classes: PascalCase
class GameEngine {}
class ActionValidator {}

// Files: PascalCase matching class name
GameEngine.js
ActionValidator.js

// Constants: SCREAMING_SNAKE_CASE
const ANIMATION_TIMINGS = {};
const FACTION_COLORS = {};

// Variables/methods: camelCase
processNextTurn()
validateAction()
```

## Game Logic Patterns

### State Management
```javascript
// GameState is the single source of truth
// Always validate coordinates before accessing grid
getTile(x, y) {
  if (x < 0 || x >= 10 || y < 0 || y >= 10) return null;
  return this.grid[y][x];
}

// Resources use floating point for precision
faction.resources = { R: 10.0, F: 5.0, I: 3.0 };

// Turn management: Factions cycle continuously (no Observer in turn order)
const turnOrder = [...factionNames]; // Observer removed
```

### Action Validation
- **No retry mechanism**: Invalid actions are immediately rejected
- **Comprehensive validation**: Check coordinates, resources, faction ownership
- **Early returns**: Validate cheapest constraints first
```javascript
// Pattern for all action validators
validateAction(gameState, factionName, parameters) {
  // 1. Coordinate validation
  if (!this.isValidCoordinate(x, y)) return { valid: false, reason: "Invalid coordinates" };
  
  // 2. Resource validation
  if (faction.resources.R < cost) return { valid: false, reason: "Insufficient resources" };
  
  // 3. Game rule validation
  if (tile.owner !== factionName) return { valid: false, reason: "Not your tile" };
  
  return { valid: true };
}
```

### AI Integration Patterns
```javascript
// OpenAI conversation history is maintained per agent
// Function schemas define available actions
// Context includes full game state + recent observer actions
// AbortController allows canceling ongoing AI requests
const context = {
  gameState: this.gameState.getPublicState(),
  faction: faction,
  availableActions: ['Assault', 'Convert', ...],
  recentObserverActions: this.gameState.observerActions.slice(-3)
};

// AI requests support cancellation
const abortController = new AbortController();
const decisions = await aiAgent.getTurnActions(context, abortController.signal);

// Personality evolution runs asynchronously but is awaited before next AI turn
this.pendingPersonalityEvolution = this.evolvePersonalitiesAfterDivineEvent(action);
// ... animations play while evolution processes ...
await this.pendingPersonalityEvolution; // Before next AI turn
```

## Testing Architecture

### Jest Configuration
- **Environment**: Node.js testing environment
- **Module type**: Tests use CommonJS (`require`/`module.exports`)
- **Setup file**: `tests/setup.js` provides global utilities and mocks
- **Coverage**: Collects from all `src/**/*.js` files

### Test Organization
```
tests/
├── unit/          # Unit tests for individual classes
├── integration/   # Cross-component integration tests
└── setup.js       # Global test configuration and utilities
```

### Testing Patterns
```javascript
// Mock heavy dependencies (OpenAI, WebSocket)
jest.mock('openai');
jest.mock('ws');

// Use CommonJS in test files only
const { GameEngine } = require('../../src/game/GameEngine.js');

// Global test utilities in setup.js
global.createMockGameState = () => ({ /* mock structure */ });

// Async test patterns
test('should process turn correctly', async () => {
  const result = await gameEngine.processTurn();
  expect(result.success).toBe(true);
});
```

### WebSocket Communication Patterns

### Server-to-Client Messages
```javascript
// Standard message format
{
  type: 'messageType',
  data: payload
}

// Key message types:
// - 'gameState': Full state update
// - 'actionsExecuted': Action results with animation data
// - 'gameEnded': Victory condition reached
```

### Client-to-Server Messages
```javascript
// Observer action (can happen anytime)
{
  type: 'observerAction',
  action: { type: 'smite', parameters: { x: 5, y: 5 } }
}

// Animation complete notification
{
  type: 'animationComplete'
}
```

### Client Animation System
- **Animation queue**: Sequential processing of action animations
- **Predetermined timings**: Each action type has fixed animation duration
- **Non-blocking**: Animations don't affect game logic timing
- **Completion notification**: Client notifies server when animations finish
```javascript
const ANIMATION_TIMINGS = {
  'Assault': 1200,
  'Convert': 1000,
  'Meteor': 1500,
  'default': 600
};

// Notify server when queue is empty
function notifyAnimationComplete() {
  socket.send(JSON.stringify({ type: 'animationComplete' }));
}
```

## Observer/God Mode Integration

### Divine Powers
- **Asynchronous intervention**: Observer can act anytime, not limited to dedicated turn
- **AI interruption**: Can cancel ongoing AI generation with AbortController
- **Action queueing**: Actions queue during animations, execute when animations complete
- **Context sharing**: Observer actions broadcast to AI agents for next turn context
- **Power categories**: Morally neutral - can favor, punish, or test factions
- **Personality evolution**: Divine acts trigger AI personality evolution (awaited before next AI turn)

### Implementation Pattern
```javascript
// Observer can interrupt or queue actions
async executeObserverAction(action) {
  if (this.isWaitingForAnimation) {
    // Queue if animations playing
    this.observerActionQueue.push(action);
    return { success: true, queued: true };
  }
  
  if (this.currentAIAbortController) {
    // Interrupt AI if thinking
    this.currentAIAbortController.abort();
  }
  
  // Execute immediately
  const result = this.executeObserverActionImmediate(action);
  this.gameState.addObserverAction(action);
  
  // Start personality evolution (awaited before next AI turn)
  this.pendingPersonalityEvolution = this.evolvePersonalitiesAfterDivineEvent(action);
  
  // Restart interrupted AI turn if needed
  if (this.isProcessingTurn) {
    this.isProcessingTurn = false;
    this.processNextTurn();
  }
}
```

## Error Handling Guidelines

### Validation Strategy
- **Fail fast**: Validate inputs at method entry
- **Detailed error messages**: Include specific failure reasons
- **Graceful degradation**: Game continues even if one action fails

### Error Response Format
```javascript
{
  valid: false,
  reason: "Specific error description",
  code: "ERROR_TYPE" // Optional error categorization
}
```

## Performance Considerations

### State Management
- **Immutable updates**: Create new objects rather than mutating state
- **Efficient grid access**: Always validate coordinates before array access
- **Resource calculations**: Use floating point arithmetic consistently

### AI Integration
- **Rate limiting**: Respect OpenAI API limits
- **Conversation pruning**: Limit conversation history to prevent token overflow
- **Timeout handling**: All AI requests have configurable timeouts

## Development Workflow

### Adding New Actions
1. **Define function schema** in `FunctionSchemas.js`
2. **Add validation logic** in `ActionValidator.js`
3. **Implement execution** in `GameEngine.js`
4. **Add animation timing** in client `ANIMATION_TIMINGS`
5. **Write comprehensive tests** covering validation and execution

### Adding New Building Types
1. **Update building definitions** in game constants
2. **Add construction validation** rules
3. **Implement passive effects** in income calculation
4. **Add visual representation** in P5.js client
5. **Update function schemas** if buildings enable new actions

### Debugging Guidelines
- **Use WebSocket messages**: Log all communication between client/server
- **State snapshots**: Capture game state before/after actions
- **Animation debugging**: Client console logs show animation queue processing
- **Test coverage**: Run tests after any logic changes

## AI Agent Personality System

### Personality Implementation
```javascript
// Personalities affect AI decision-making through system prompts
const personalities = {
  'aggressive': 'Focus on combat and territorial expansion',
  'defensive': 'Prioritize fortification and stability',
  'economic': 'Maximize resource generation and efficiency',
  'diplomatic': 'Seek alliances and peaceful solutions',
  'religious': 'Build shrines and focus on conversion',
  'chaotic': 'Make unpredictable and bold moves'
};
```

### Context Generation
- **Full game state visibility**: AI agents see all tiles and factions
- **Recent history**: Last 3 observer actions included in context
- **Resource awareness**: Current faction resources and income
- **Victory condition awareness**: AI knows win conditions and current standings

Remember: This codebase prioritizes clarity, testability, and maintainability. When making changes, ensure backward compatibility with the existing WebSocket protocol and maintain the separation between game logic and visualization components.