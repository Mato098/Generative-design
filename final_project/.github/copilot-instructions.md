# GitHub Copilot Instructions

## Overview
**Multi-Agent LLM Strategy Game** - 4 AI agents create custom factions, design units with unique abilities, and compete in turn-based combat. LLMs handle all creative decisions; game engine enforces rules.

## Critical Architecture

**3-Phase Game Flow** (`main.py` → `core/game_engine.py`):
1. **SETUP**: Agents call `create_faction()`/`design_unit()` functions → `GameEngine.process_faction_creation()`
2. **BALANCING**: AdminAgent reviews factions, suggests adjustments
3. **PLAYING**: Turn-based loop with `PlayerAgent.make_decision()` → actions → `GameEngine` processors

**Key Pattern**: Agents return `List[AgentAction]` (action_type, parameters, reasoning) → Engine processors update `GameState`

## Ability System (FULLY DYNAMIC)

**NO hardcoded ability lists!** All descriptions auto-generated from registry:

```python
# Adding ability (2 steps):
# 1. Create class in abilities/unit_abilities.py
class PoisonAbility(Ability):
    description = "Deals 5 damage/turn for 3 turns"  # Used everywhere!

# 2. Register in abilities/__init__.py
ABILITY_REGISTRY.register("poison", PoisonAbility(), "unit")
# Done! Auto-appears in agent prompts/schemas/docs

# Dynamic loading:
from abilities import get_ability_descriptions, get_ability_list
prompt = f"Abilities:\n{get_ability_descriptions('unit')}"  # Pulls from .description
enum = get_ability_list("unit")  # For function schemas
```

**Integration**: `config/llm_config.py::get_player_agent_system_prompt()`, `agents/function_schemas.py::_get_ability_info()`, `agents/player_agent.py::_create_unit_designs()` all call `abilities/utils.py` functions.

## Development Workflows

**Testing**:
```bash
python tests/run_tests.py              # Mocked (free)
python tests/test_dynamic_abilities.py # Verify ability autodiscovery
python tests/run_tests.py --real-llm  # Live API calls (costs $)
python main.py --demo                  # System demo
```

**Debugging LLM**:
- `.env`: `DEBUG_LLM_RESPONSES=true` → full prompt/response logging
- `LLMInterface.token_usage` tracks costs
- Agents only see `game_state.get_agent_view(agent_id)` (fog of war applied)

**Caching** (`.env` controlled):
```bash
FACTION_CACHE_ENABLED=true    # Dev mode: reuse factions
SPRITE_CACHE_ENABLED=false    # Fresh sprites
FACTION_CACHE_MODE=similar    # "exact"|"similar"|"random"
```

## Critical Patterns

**Agent Decisions**:
```python
# agents/player_agent.py
async def make_decision(game_state_view):
    phase = game_state_view["phase"]  # "setup"|"playing"
    if phase == "setup":
        return await _handle_faction_setup()  # LLM creates faction
    else:
        return await _handle_gameplay_turn()  # LLM chooses actions
```

**Function Schemas**: `agents/function_schemas.py::get_functions_for_phase()` returns phase-appropriate functions. Agents use structured function calling, not free text.

**Ability Execution**:
```python
from abilities import ABILITY_REGISTRY, AbilityContext
context = AbilityContext(owner=unit, target=enemy, action_type="attack")
results = ABILITY_REGISTRY.execute_abilities(unit.abilities, context)
# Abilities stored as Set[str], resolved at runtime
```

## Common Tasks

**Add Agent Action**:
1. Add schema to `agents/function_schemas.py` (e.g., `GAME_ACTION_FUNCTIONS`)
2. Add processor in `core/game_engine.py::_register_action_processors()`
3. Update `agents/player_agent.py` decision logic

**Modify Agent Behavior**: `config/llm_config.py::get_player_agent_system_prompt()` + `agents/player_agent.py::_create_unit_designs()` control prompts

**Change Game Rules**: `core/game_engine.py` action processors + `entities/unit.py::attack()`

## Key Files
- **Entry**: `main.py` (GameLauncher orchestrates everything)
- **Brain**: `agents/player_agent.py` (LLM decision-making)
- **Rules**: `core/game_engine.py` (action processors)
- **Abilities**: `abilities/*.py` (self-documenting via registry)
- **Prompts**: `config/llm_config.py` (dynamic generation)
- **Buildings**: `config/building_config.py` (templates with inherent capabilities)

## Important Notes
- **Building Templates**: Each building type has inherent capabilities (e.g., `town_center` always produces `worker`, `tower` has `auto_attack`)
- Stealth detection: hidden unless adjacent (≤1 tile distance)
- Fortify: only if unit hasn't moved this turn (`unit.has_moved`)
- Charge: only if unit moved before attacking
- All content (factions/units/buildings) is LLM-generated
- Abilities use strings (`Set[str]`), not enums, for extensibility
