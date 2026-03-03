# Playing God: LLM Strategy Game

An autonomous turn-based strategy game where Large Language Model (LLM) agents compete for territorial dominance on a grid-based world. The player assumes the role of an omnipotent observer who can intervene with divine powers to influence the outcome of AI-driven conflicts.

## Overview

This project explores emergent gameplay and strategic behavior by pitting AI agents with distinct personalities against each other in a competitive environment. Each agent makes independent decisions about resource management, military expansion, diplomacy, and religious conversion without predefined strategies—their behavior emerges entirely from their personality profile and the LLM's reasoning capabilities.

The game features real-time visualization using P5.js, WebSocket communication for live updates, and a comprehensive test suite ensuring system reliability.

## Key Features

### 🤖 **AI-Driven Agents**
- **Autonomous Decision Making**: Each faction is controlled by an LLM (GPT-4/GPT-3.5) that independently analyzes the game state and plans actions
- **Personality System**: Seven distinct personality archetypes that shape agent behavior, communication style, and strategic preferences:
  - **Religious Zealot**: Fervent, absolute declarations with sacred imagery
  - **Rational Skeptic**: Precise, analytical with explicit uncertainty markers
  - **Chaotic Visionary**: Fractured speech, surreal imagery, unpredictable loyalty
  - **Noble Aristocrat**: Ornate, formal rhetoric bound by honor
  - **Humble Peasant**: Simple, cautious language focused on survival
  - **Warrior Chieftain**: Blunt, forceful bursts prioritizing strength
  - **Pragmatic Broker**: Neutral, calculated exchanges with reversible commitments
- **Dynamic Personality Evolution**: Agent personalities can shift over time based on significant game events (victories, defeats, betrayals)
- **Inter-Agent Messaging**: Agents can communicate with each other, forming alliances or declaring rivalries

### 🎮 **Strategic Gameplay**
- **Resource Management**: Agents manage Faith (F) and Resources (R) to expand their influence
- **Multiple Action Types**:
  - **Recruit**: Train troops on owned territories
  - **Move/Attack**: Relocate forces or engage in combat
  - **Construct**: Build structures (Shrines, Idols, Training Grounds, Markets, Towers, Fortresses)
  - **Convert**: Use Faith to peacefully claim adjacent tiles
  - **Sanctuary**: Fortify positions against attacks
  - **Diplomacy**: Send messages to negotiate or deceive
- **Combat System**: Deterministic outcomes based on troop numbers and terrain modifiers
- **Victory Conditions**: Last faction standing or dominant territorial control

### ⚡ **Observer Powers** (Player Intervention)
The player can intervene at any time with divine abilities:
- **Smite**: Instantly destroy all troops on a tile
- **Bless**: Convert a tile to a shrine, granting Faith bonuses
- **Sanctify**: Fortify a tile against attacks for 2 turns
- **Rend**: Remove all defensive structures from a tile
- **Meteor**: Devastate a 3x3 area, clearing all troops and buildings
- **Observe**: Pause the game to analyze the current state

### 🎨 **Visualization**
- **P5.js Canvas**: Retro terminal-style aesthetic with custom fonts
- **Real-Time Updates**: WebSocket-based live state synchronization
- **Particle Effects**: Dynamic visual feedback for combat, divine interventions, and resource generation
- **Three-Panel Interface**:
  - **Message Log**: Displays agent communications and personality narratives
  - **Game Board**: 10x10 grid showing territorial control, troops, and buildings
  - **Info Panel**: Faction statistics, resources, and observer controls

## Architecture

```
┌─────────────────────────────────────────────────┐
│             Client (Browser)                    │
│  ┌──────────────────────────────────────────┐  │
│  │     P5.js Visualization Layer            │  │
│  │  - Game Board Rendering                  │  │
│  │  - Particle Effects                      │  │
│  │  - UI Panels (Messages/Info/Controls)    │  │
│  └──────────────┬───────────────────────────┘  │
│                 │ WebSocket                     │
└─────────────────┼─────────────────────────────┘
                  │
┌─────────────────┼─────────────────────────────┐
│                 ▼                               │
│         Express + WebSocket Server             │
│  ┌──────────────────────────────────────────┐  │
│  │         GameEngine (Core Logic)           │  │
│  │  ┌────────────────────────────────────┐  │  │
│  │  │      GameState Management          │  │  │
│  │  │  - Tile ownership & resources      │  │  │
│  │  │  - Faction management              │  │  │
│  │  │  - Turn processing                 │  │  │
│  │  └────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────┐  │  │
│  │  │      Action Validation             │  │  │
│  │  │  - Move legality checks            │  │  │
│  │  │  - Resource availability           │  │  │
│  │  │  - Combat resolution               │  │  │
│  │  └────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────┐  │  │
│  │  │      Observer Interface            │  │  │
│  │  │  - Divine intervention system      │  │  │
│  │  │  - Real-time action queue          │  │  │
│  │  └────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────────────────────────────┐  │
│  │         AI Agent System                   │  │
│  │  ┌────────────────────────────────────┐  │  │
│  │  │      AIAgent (per faction)         │  │  │
│  │  │  - OpenAI API integration          │  │  │
│  │  │  - Conversation history            │  │  │
│  │  │  - Action parsing                  │  │  │
│  │  └────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────┐  │  │
│  │  │      Personality Engine            │  │  │
│  │  │  - Personality profiles            │  │  │
│  │  │  - Dynamic evolution logic         │  │  │
│  │  │  - Narrative generation            │  │  │
│  │  └────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────┐  │  │
│  │  │      Function Schemas              │  │  │
│  │  │  - LLM tool definitions            │  │  │
│  │  │  - Action parameter validation     │  │  │
│  │  └────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Installation

### Prerequisites
- **Node.js** (v18 or higher)
- **OpenAI API Key** (for LLM agents)

### Setup

1. **Clone or navigate to the project directory**:
   ```bash
   cd final_project
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the project root:
   ```env
   OPENAI_API_KEY=your_api_key_here
   ```

4. **Run tests** (optional but recommended):
   ```bash
   npm test
   npm run test:coverage  # View code coverage
   ```

## Running the Game

1. **Start the server**:
   ```bash
   npm start
   ```

2. **Open your browser**:
   Navigate to `http://localhost:3000`

3. **Initialize the game**:
   - The web interface provides controls to start a new game
   - Configure the number of AI agents (2-4 recommended)
   - Select personality types for each faction
   - Click "Start Game" to begin

4. **Observe and intervene**:
   - Watch as AI agents autonomously make decisions each turn
   - Use observer powers from the control panel to influence the game
   - Monitor agent communications in the message log

## Game Mechanics

### Resources
- **Resources (R)**: Used for recruiting troops and constructing buildings
  - Generated by Markets (2R/turn) and controlling tiles (1R/turn)
- **Faith (F)**: Used for peaceful expansion via conversion
  - Generated by Shrines and Idols

### Buildings
- **Shrine** (Cost: 3R): Generates 2 Faith per turn
- **Idol** (Cost: 2R): Generates 1 Faith per turn
- **Training Ground** (Cost: 4R): Doubles troop recruitment on that tile
- **Market** (Cost: 3R): Generates 2 Resources per turn
- **Tower** (Cost: 5R): Adds +3 defensive bonus
- **Fortress** (Cost: 8R): Adds +5 defensive bonus

### Combat
- Combat is deterministic: `AttackerStrength vs DefenderStrength`
- Attacker loses ~60-80% of original forces
- Defender losing results in tile capture
- Buildings provide defensive bonuses
- Sanctuary action grants immunity for 2 turns

### Turn Structure
1. **Resource generation** for all factions
2. **AI agent receives game state** (visible tiles, faction stats, message history)
3. **Agent plans actions** via LLM reasoning
4. **Actions validated** and executed by GameEngine
5. **Results broadcast** to all clients with animations
6. **Personality evolution check** (on significant events)
7. **Next turn begins**

## Technologies Used

### Backend
- **Node.js** + **Express**: Web server and REST API
- **WebSocket (ws)**: Real-time bidirectional communication
- **OpenAI API**: LLM integration for autonomous agents
- **dotenv**: Environment variable management

### Frontend
- **P5.js**: Canvas-based game visualization
- **JavaScript (ES6 modules)**: Client-side logic
- **WebSocket Client**: Live state synchronization

### Testing
- **Jest**: Unit and integration testing
- **Supertest**: HTTP endpoint testing

## Project Structure

```
final_project/
├── index.js                 # Server entry point
├── package.json             # Dependencies and scripts
├── jest.config.json         # Test configuration
│
├── src/
│   ├── game/
│   │   ├── GameEngine.js         # Core game loop and logic
│   │   ├── GameState.js          # State management (tiles, factions)
│   │   ├── ActionValidator.js    # Action legality checks
│   │   ├── Faction.js            # Faction data structure
│   │   └── Tile.js               # Tile data structure
│   │
│   ├── ai/
│   │   ├── AIAgent.js            # LLM agent wrapper
│   │   ├── PersonalityProfiles.js # Personality definitions
│   │   ├── PersonalityEvolver.js  # Dynamic personality shifting
│   │   └── FunctionSchemas.js     # OpenAI function calling schemas
│   │
│   └── observer/
│       └── ObserverInterface.js   # Divine intervention system
│
├── public/
│   ├── index.html            # Main client page
│   ├── gameClient_v2.js      # P5.js visualization
│   ├── ParticleManager.js    # Particle effects
│   ├── ParticleBase.js       # Base particle classes
│   ├── CombatUtils.js        # Combat calculations
│   └── tileAnimations.js     # Animation definitions
│
└── tests/
    ├── unit/                 # Unit tests for core logic
    └── integration/          # End-to-end tests
```

## Development

### Running in Development Mode
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Running Tests
```bash
npm test                # Run all tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only
npm run test:watch      # Watch mode
npm run test:coverage   # Generate coverage report
```

### Code Coverage
Test coverage reports are generated in the `coverage/` directory. Open `coverage/lcov-report/index.html` in a browser to view detailed coverage metrics.

## Design Philosophy

This project explores several key concepts:

1. **Emergent Behavior**: No hardcoded strategies—all agent behavior emerges from personality traits and LLM reasoning
2. **Narrative Generation**: Agents generate contextual messages that reflect their personality and current situation
3. **Dynamic Systems**: Personality evolution allows agents to adapt based on game events, creating unpredictable narratives
4. **God-Game Mechanics**: The observer role provides a meta-layer of interaction, allowing intervention without direct control
5. **Retro Aesthetics**: Terminal-style visuals create an immersive, focused experience

## Future Enhancements

Potential areas for expansion:
- **Larger maps** with varied terrain types
- **More complex diplomacy** (alliances, trade agreements)
- **Asymmetric starting conditions** (different faction bonuses)
- **Replay system** for reviewing past games
- **Tournament mode** for personality matchups
- **Spectator mode** for observing without intervention

---

**Built as a generative design project exploring autonomous AI behavior and emergent gameplay.**
