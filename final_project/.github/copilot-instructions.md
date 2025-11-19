# GitHub Copilot Instructions

## Overview
This is a **Multi-Agent LLM Strategy Game** - a turn-based strategy game where AI agents use Large Language Models to create custom factions, design units, and compete strategically. Think Age of Empires III with AI agents as players.

## Project Structure & API Reference

### Folder Structure
```
├── agents/                    # AI agent framework
│   ├── base_agent.py         # BaseAgent(ABC): agent interface 
│   ├── player_agent.py       # PlayerAgent: main AI player logic
│   ├── admin_agent.py        # AdminAgent: game balance oversight  
│   ├── llm_interface.py      # LLMInterface: OpenAI integration
│   ├── function_schemas.py   # LLM function definitions
│   └── mixins.py            # Agent behavior mixins
├── core/                     # Game engine and state management
│   ├── game_engine.py        # GameEngine: central coordinator
│   ├── game_state.py         # GameState: world state container
│   └── turn_manager.py       # TurnManager: turn processing
├── entities/                 # Game objects and data structures  
│   ├── faction.py            # Faction, FactionTheme: player empires
│   ├── unit.py              # Unit, UnitStats: military units
│   ├── sprite.py            # Sprite: visual representations  
│   └── tile.py              # Tile: map terrain system
├── sprites/                  # Visual generation system
│   ├── generator.py          # SpriteGenerator: LLM sprite creation
│   └── cache.py             # SpriteCache: sprite caching
├── config/                   # Configuration and settings
│   ├── game_config.py        # Environment-based game settings
│   └── llm_config.py         # LLM personalities and prompts
├── cache/                    # Faction and sprite caching
│   └── faction_cache.py      # FactionCache: faction data persistence
├── tests/                    # Comprehensive test suite
│   ├── run_tests.py          # Test runner with mocked/real LLM modes
│   └── test_*.py            # Modular test files
└── main.py                   # Entry point and demo mode
```

### Core API Classes & Methods

#### Agent Framework
```python
# agents/base_agent.py
class BaseAgent(ABC):
    async def make_decision(game_state_view: Dict) -> List[AgentAction]
    def record_action_result(action: AgentAction, result: Dict)

# agents/player_agent.py  
class PlayerAgent(BaseAgent, AgentPersonalityMixin, AgentMemoryMixin):
    async def _handle_faction_setup(game_state_view: Dict) -> List[AgentAction]
    async def _handle_gameplay_turn(game_state_view: Dict) -> List[AgentAction]
    async def _try_load_cached_complete_faction() -> Optional[List[AgentAction]]

# agents/admin_agent.py
class AdminAgent(BaseAgent):
    async def _edit_faction_units(factions: Dict) -> List[AgentAction] 
    def record_balance_issue(issue: Dict)

# agents/llm_interface.py
class LLMInterface:
    async def make_function_call(system_prompt, user_message, functions) -> LLMResponse
```

#### Game Engine & State
```python
# core/game_engine.py
class GameEngine:
    async def process_faction_creation(agent_id: str, faction_data: List) -> bool
    async def _process_edit_faction_unit(action: AgentAction, game_state: GameState) -> Dict
    def _register_action_processors()

# core/game_state.py  
class GameState:
    def get_agent_view(agent_id: str) -> Dict[str, Any]
    def add_faction(faction: Faction)
    def advance_turn() -> str
```

#### Entities & Data
```python
# entities/faction.py
@dataclass
class Faction:
    name: str
    owner_id: str  
    theme: FactionTheme
    custom_unit_designs: Dict[str, Dict]
    resources: Dict[str, int]

@dataclass  
class FactionTheme:
    name: str
    description: str
    color_scheme: List[str]
    architectural_style: str
    unit_naming_convention: str

# entities/unit.py
@dataclass
class Unit:
    unit_type: str
    stats: UnitStats
    position: tuple
    faction_id: str

# sprites/generator.py
class SpriteGenerator:
    async def generate_faction_sprites(faction_data: Dict) -> Dict[str, Sprite]
```

#### Caching System
```python
# cache/faction_cache.py
class FactionCache:
    def get_similar_faction(personality: str, mode: str) -> Optional[CachedFaction]
    def store_faction(faction_data: CachedFaction)

# sprites/cache.py  
class SpriteCache:
    def get_sprite(cache_key: str) -> Optional[Sprite]
    def store_sprite(cache_key: str, sprite: Sprite)
```

## Architecture & Key Components

### Core Game Flow
1. **Setup Phase**: Agents create factions using `PlayerAgent._handle_faction_setup()` → LLM calls → `GameEngine.process_faction_creation()`
2. **Sprite Generation**: Custom units get visual sprites via `SpriteGenerator.generate_faction_sprites()`  
3. **Gameplay Phase**: Turn-based decisions through `PlayerAgent.make_decision()` → `TurnManager`
4. **State Management**: Centralized in `GameState` with agent-specific views via `get_agent_view()`

### Agent Architecture Pattern
All agents inherit from `BaseAgent` and use mixins:
```python
class PlayerAgent(BaseAgent, AgentPersonalityMixin, AgentMemoryMixin, AgentCommunicationMixin)
```
- **Function-based Actions**: Agents use structured LLM function calling via `LLMInterface.make_function_call()`
- **Personality System**: Each agent has predefined personality traits affecting strategy (see `config/llm_config.py`)
- **Action Pattern**: All agent decisions return `List[AgentAction]` with `action_type`, `parameters`, `reasoning`

### Caching Strategy (Critical for API Costs)
**Environment-controlled caching** via `.env` variables:
```bash
FACTION_CACHE_ENABLED=true     # Use cached faction data
SPRITE_CACHE_ENABLED=false     # Always generate fresh sprites  
CACHE_SAVE_ENABLED=true        # Save new generations to cache
FACTION_CACHE_MODE=similar     # "exact", "similar", "random"
```

**Cache Flow**: `PlayerAgent._try_load_cached_complete_faction()` → `FactionCache.get_similar_faction()` → Convert back to `AgentAction` objects

### LLM Integration Pattern
- **Structured Calls**: Use function schemas from `agents/function_schemas.py`
- **Response Handling**: All LLM calls return `LLMResponse` objects with `success`, `function_calls`, `error`
- **Cost Management**: Token usage tracked in `LLMInterface.token_usage`
- **Error Resilience**: Always check `response.success` before processing `function_calls`

## Development Workflows

### Running & Testing
```bash
# Main game
python main.py                                 # Full game
python main.py --demo                          # Demo mode

# Test suites  
python tests/run_tests.py                      # All mocked tests (free)
python tests/run_tests.py --real-llm          # Real LLM tests (costs $)
python tests/run_tests.py -m test_game_state  # Specific module
```

### Environment Setup
1. Copy `.env.example` → `.env` and add `OPENAI_API_KEY`
2. **Development**: Set `*_CACHE_ENABLED=true` to minimize costs
3. **Testing**: Set `CACHE_SAVE_ENABLED=false` to avoid polluting cache
4. **Production**: Set `*_CACHE_ENABLED=false` for fresh content

### Debugging LLM Issues
- Set `DEBUG_LLM_RESPONSES=true` in `.env` for full LLM call logging
- Check `LLMInterface.token_usage` for cost tracking
- Use mocked tests (`tests/test_llm_integration.py`) before expensive real tests

## Key Patterns & Conventions

### Agent Decision Making
```python
async def make_decision(self, game_state_view: Dict[str, Any]) -> List[AgentAction]:
    # 1. Analyze game phase
    phase = game_state_view.get("phase", "playing")
    
    # 2. Route to appropriate handler
    if phase == "setup":
        return await self._handle_faction_setup(game_state_view)
    else:
        return await self._handle_gameplay_turn(game_state_view)
```

### Function Schema Integration
- Function definitions in `agents/function_schemas.py` must match LLM capabilities
- Use `get_functions_for_phase()` to get appropriate functions per game phase
- Always validate function parameters in action processors

### Entity Relationship Pattern
```
GameState → Factions → Units/Buildings
         → Map (Tiles)
         → TurnManager
```
- **Factions** own units/buildings and have themes + custom unit designs
- **Units** have stats, positions, and can be custom-designed by agents
- **Game State** provides filtered views to agents (fog of war via `get_agent_view()`)

### Sprite Generation Integration
- Custom units automatically get sprites via `SpriteGenerator` in setup phase
- Sprites cached separately from faction data using `SPRITE_CACHE_*` settings
- ASCII art generation with 16x16 pixel grids and color palettes

## Data Flow Examples

**Faction Creation**: `PlayerAgent._create_faction()` → LLM call with `create_faction` function → `AgentAction` → `GameEngine._process_create_faction()` → `Faction` object in `GameState`

**Unit Design**: `PlayerAgent._create_unit_designs()` → LLM calls with `design_unit` function → `AgentAction` → `GameEngine._process_design_unit()` → `Faction.custom_unit_designs`

**Sprite Pipeline**: `SpriteGenerator.generate_faction_sprites()` → Extract custom unit data → LLM sprite generation → `Sprite` objects with pixel data

## Critical Files to Understand
- `agents/base_agent.py` - Agent interface and action pattern
- `agents/player_agent.py` - Main AI player logic and caching
- `core/game_engine.py` - Action processing and game state updates  
- `agents/function_schemas.py` - LLM function definitions
- `config/game_config.py` - Environment-based configuration
- `sprites/generator.py` - LLM-based sprite generation with caching

## Common Gotchas
- **LLM Costs**: Always use caching in development, disable for fresh content
- **Async Patterns**: Agent decisions are async, use proper `await` handling
- **Function Validation**: LLM responses may have invalid function parameters, always validate
- **Game State Views**: Agents only see filtered game state, not full state
- **Action Processing**: Actions must be processed through `GameEngine` to update state