# LLM Strategy Game

A turn-based strategy game where multiple AI agents (powered by OpenAI's ChatGPT) compete on a 10x10 grid, with a human observer who can intervene with divine powers.

## Features

- **Multi-Agent AI**: Support for multiple LLM agents with distinct personalities
- **OpenAI Function Calling**: AI agents use structured function calls for all actions
- **Real-time Visualization**: P5.js-powered grid visualization with action animations
- **Observer/God Mode**: Human can intervene with divine powers between turns
- **Personality System**: Each agent has unique traits (aggressive, defensive, diplomatic, etc.)
- **Complex Ruleset**: Full implementation of the 11-section game rules

## Game Rules Summary

### World
- 10×10 grid with orthogonal adjacency (N/S/E/W only)
- Tile properties: owner, type, troop_power, stability (0-10), building, resource_value
- Tile types: plains, forest (+1 resource), hill (+1 defense), ruin, sacred (+1 Faith, +2 defense)

### Resources
Each faction tracks:
- **R (Resources)**: Used for most actions, gained from tiles (1 + resource_value per turn)
- **F (Faith)**: Used for conversion, gained from Shrines and sacred tiles  
- **F (Faith)**: Used for conversion and special abilities

### Turn Structure
1. **Faction A** → **Faction B** → **Observer** → repeat
2. Each faction gets 1 mandatory primary action + 1 optional secondary action
3. Observer takes final turn and interventions are broadcast to AI agents next cycle

### Actions
**Primary Actions:** Reinforce, ProjectPressure, Assault, Convert, Construct
**Secondary Actions:** Redistribute, Repair, Sanctuary, Message
**Observer Powers:** Smite, Bless, Sanctify, Rend, Meteor, Observe

### Victory Conditions
- **Domination**: >50% tiles for 2 continuous turns
- **Devotion**: Highest Faith at turn 40
- **Prestige**: Most buildings at turn 30

## Setup

### Prerequisites
- Node.js 18+ 
- OpenAI API key

### Installation

1. **Clone and install dependencies:**
```bash
cd final_project
npm install
```

2. **Set up environment variables:**
```bash
# Create .env file
echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
```

3. **Start the server:**
```bash
npm start
# or for development with auto-reload:
npm run dev
```

4. **Open the game:**
Navigate to `http://localhost:3000` in your browser

## Usage

### Starting a Game

1. **Configure Agents**: Modify the `startGame()` function in `public/gameClient.js` to set up your AI agents:

```javascript
const agentConfig = [
  { name: 'Faction A', personality: 'aggressive', apiKey: 'your-api-key' },
  { name: 'Faction B', personality: 'defensive', apiKey: 'your-api-key' },
  { name: 'Faction C', personality: 'religious', apiKey: 'your-api-key' }
];
```

2. **Available Personalities**:
   - `aggressive`: Military expansionist, prioritizes assault actions
   - `defensive`: Fortress builder, focuses on stability and defense
   - `diplomatic`: Uses conversion and negotiation tactics
   - `economic`: Resource-focused, builds markets and infrastructure
   - `religious`: Faith-based strategy, seeks sacred sites
   - `chaotic`: Unpredictable and opportunistic
   - `builder`: Construction-focused, aims for prestige victory
   - `opportunist`: Adaptive strategy based on circumstances

3. **Click "Start Game"** to begin the simulation

### Observer Controls

When it's your divine turn, you can:

- **Smite**: Destroy troops and reduce stability
- **Bless**: Maximize stability and grant Faith
- **Sanctify**: Convert tile to sacred type, add Shrine
- **Rend**: Destroy buildings and damage stability
- **Meteor**: 3×3 area damage to troops and stability
- **Observe**: Take no action, just provide commentary

### Game Interface

- **Grid Visualization**: Color-coded tiles showing ownership, troops, buildings, stability
- **Faction Status**: Real-time resource tracking for all players
- **Action Log**: Sequential display of all actions and events
- **Animation System**: Visual representation of actions with predetermined timing

## Architecture

### Backend Components

- **GameEngine** (`src/game/GameEngine.js`): Core game loop and turn management
- **GameState** (`src/game/GameState.js`): Immutable game state with 10×10 grid
- **AIAgent** (`src/ai/AIAgent.js`): OpenAI integration with personality system
- **ActionValidator** (`src/game/ActionValidator.js`): Rule enforcement and validation
- **ObserverInterface** (`src/observer/ObserverInterface.js`): Human intervention system

### Frontend Components

- **P5.js Visualization** (`public/gameClient.js`): Real-time grid rendering
- **WebSocket Client**: Live updates and observer interaction
- **Animation Queue**: Sequential action playback with timing

### Key Features

1. **No Retry Mechanism**: Rejected AI actions are immediately discarded
2. **Parallel Processing**: Next AI processes while previous actions animate
3. **Turn Broadcasting**: Observer actions are included in next turn's AI context
4. **Personality-Driven**: Each AI agent has distinct behavioral patterns
5. **Function Calling**: All AI actions use structured OpenAI function schemas

## Development

### Project Structure
```
src/
├── game/           # Core game logic
├── ai/             # LLM integration
└── observer/       # Human interface

public/             # P5.js visualization
├── index.html      # Main interface
└── gameClient.js   # Client-side logic
```

### Adding New Actions

1. **Define function schema** in `src/ai/FunctionSchemas.js`
2. **Add validation logic** in `src/game/ActionValidator.js`
3. **Implement action logic** in `src/game/GameEngine.js`
4. **Add animation** in `public/gameClient.js`

### Testing

```bash
npm test  # Run unit tests (when implemented)
```

## API Reference

### WebSocket Messages

**Client → Server:**
- `{ type: 'observerAction', action: {...} }` - Execute observer power

**Server → Client:**
- `{ type: 'gameState', data: {...} }` - Current game state
- `{ type: 'actionsExecuted', data: {...} }` - Action results for animation
- `{ type: 'observerTurnStarted', data: {...} }` - Observer turn notification

### REST Endpoints

- `GET /api/game/state` - Get current game state
- `POST /api/game/start` - Start new game with agent configuration  
- `GET /api/game/actions` - Get action history

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Common Issues

1. **AI agents not responding**: Check OpenAI API key configuration
2. **WebSocket connection failed**: Ensure server is running on port 3000
3. **Actions rejected**: Check faction resources and game rules
4. **Animations not playing**: Verify P5.js library loaded correctly

### Debug Mode

Set `DEBUG=true` in environment variables for detailed logging:
```bash
DEBUG=true npm start
```