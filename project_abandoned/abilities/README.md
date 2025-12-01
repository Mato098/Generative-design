# Ability System - Developer Guide

## Overview

The ability system is a modular, extensible framework for defining special behaviors for units and buildings. Abilities are stored as string identifiers and resolved at runtime through a registry pattern, making it easy to add new abilities without modifying core game logic.

## Architecture

### Core Components

1. **`abilities/base.py`** - Base classes and registry
   - `Ability`: Abstract base class for all abilities
   - `AbilityContext`: Context data passed to abilities
   - `AbilityRegistry`: Central registry for managing abilities
   - `AbilityType`: Enum defining when abilities trigger

2. **`abilities/unit_abilities.py`** - 8 unit abilities
   - StealthAbility, HealAbility, BuildAbility, GatherAbility
   - FortifyAbility, ChargeAbility, RangeAttackAbility, SplashDamageAbility

3. **`abilities/building_abilities.py`** - 6 building abilities
   - AutoAttackAbility, WallAbility, HealAuraAbility
   - ResourceBonusAbility, ResearchAbility, TrainFasterAbility

4. **`abilities/__init__.py`** - Global registry
   - Imports and registers all abilities
   - Exports `ABILITY_REGISTRY` for use throughout the game

### Integration Points

- **`entities/unit.py`**: Units store abilities as `Set[str]`, execute via registry
- **`entities/faction.py`**: Buildings store abilities as `Set[str]`, execute via registry
- **`core/game_engine.py`**: Processes ability-related actions
- **`agents/function_schemas.py`**: Defines which abilities agents can select

## How to Add a New Ability

### Step 1: Create the Ability Class

Add to `abilities/unit_abilities.py` or `abilities/building_abilities.py`:

```python
class PoisonAbility(Ability):
    """Unit applies poison damage over time."""
    
    def __init__(self, poison_damage: int = 5, poison_duration: int = 3):
        super().__init__(
            name="Poison",
            description=f"Deals {poison_damage} damage per turn for {poison_duration} turns",
            ability_type=AbilityType.ON_ATTACK
        )
        self.poison_damage = poison_damage
        self.poison_duration = poison_duration
    
    def can_apply(self, context: AbilityContext) -> bool:
        """Can apply when attacking."""
        return context.action_type == "attack" and context.target is not None
    
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Apply poison status effect to target."""
        if hasattr(context.target, 'status_effects'):
            context.target.status_effects['poison'] = self.poison_duration
        
        return {
            "poison_applied": True,
            "damage_per_turn": self.poison_damage,
            "duration": self.poison_duration,
            "message": f"{context.owner.name} poisons {context.target.name}!"
        }
```

### Step 2: Register the Ability

Add to `abilities/__init__.py`:

```python
from .unit_abilities import (
    StealthAbility, HealAbility, ..., PoisonAbility  # Add import
)

# Register in ABILITY_REGISTRY
ABILITY_REGISTRY.register("poison", PoisonAbility(), "unit")
```

### Step 3: Add to Function Schema

Add to `agents/function_schemas.py` in the `design_unit` function:

```python
"abilities": {
    "type": "array",
    "items": {
        "type": "string",
        "enum": ["stealth", "heal", "build", "gather", "fortify", 
                 "charge", "range_attack", "splash", "poison"]  # Add here
    },
    "description": "Special abilities for this unit (can select multiple)",
    "maxItems": 3
},
```

### Step 4: (Optional) Add Game Logic

If your ability needs special handling (e.g., poison damage each turn), update:
- `entities/unit.py` → `reset_turn()` method to process status effects
- `core/turn_manager.py` → Add turn-based processing if needed

## Ability Types

Abilities trigger at different times:

- **PASSIVE**: Always active (e.g., Stealth, Range Attack)
- **ON_ATTACK**: Triggers when unit attacks (e.g., Charge, Splash Damage)
- **ON_DEFEND**: Triggers when unit is attacked (e.g., Fortify when defending)
- **ON_MOVE**: Triggers when unit moves
- **ON_TURN**: Triggers each turn (e.g., Auto Attack, Heal Aura)
- **ACTIVE**: Must be manually activated (e.g., Heal, Build)

## AbilityContext

The context object passed to abilities contains:

```python
@dataclass
class AbilityContext:
    owner: Any              # Unit or Building
    target: Optional[Any]   # Target unit/building
    game_state: Optional[Any]  # Full game state
    action_type: str        # "attack", "defend", "move", etc.
    phase: str              # "setup", "gameplay", "end_turn"
    
    # Combat specific
    base_damage: int
    base_defense: int
    
    # Movement specific
    target_x: int
    target_y: int
    distance: int
    
    # Turn specific
    turn_number: int
    
    # Resource specific
    resources: Optional[Dict[str, int]]
```

## Unit Abilities Reference

| Ability | Type | Effect | Modifiable Parameters |
|---------|------|--------|----------------------|
| **stealth** | PASSIVE | Hidden from enemy sight (50% detection penalty) | `detection_penalty` |
| **heal** | ACTIVE | Heals adjacent friendly units | `heal_amount` (default 15) |
| **build** | ACTIVE | Can construct buildings | `build_speed_multiplier` (default 1.0) |
| **gather** | PASSIVE | Gathers resources faster | `gather_multiplier` (default 2.0) |
| **fortify** | ACTIVE | Increased defense when stationary | `defense_multiplier` (default 1.5) |
| **charge** | ON_ATTACK | Bonus damage after moving | `damage_multiplier` (default 1.25) |
| **range_attack** | PASSIVE | Extended attack range | `range_bonus` (default +2) |
| **splash** | ON_ATTACK | Area damage to nearby enemies | `splash_percentage` (0.5), `splash_radius` (1) |

## Building Abilities Reference

| Ability | Type | Effect | Modifiable Parameters |
|---------|------|--------|----------------------|
| **auto_attack** | ON_TURN | Automatically attacks nearby enemies | `attack_damage` (15), `attack_range` (3) |
| **wall** | PASSIVE | Blocks movement, provides cover | `blocks_movement` (true), `cover_bonus` (1.5) |
| **heal_aura** | ON_TURN | Heals nearby friendly units | `heal_amount` (10), `heal_radius` (2) |
| **resource_bonus** | ON_TURN | Increases resource generation | `bonus_multiplier` (1.5) |
| **research** | ACTIVE | Can research technologies | `research_speed` (1.0) |
| **train_faster** | PASSIVE | Units train faster | `training_speed_multiplier` (1.5) |

## Usage in Game Code

### Executing Unit Abilities

```python
from abilities import ABILITY_REGISTRY, AbilityContext

# In Unit.attack() method
context = AbilityContext(
    owner=self,
    target=target,
    game_state=game_state,
    action_type="attack",
    base_damage=base_damage,
    base_defense=defense
)

results = ABILITY_REGISTRY.execute_abilities(list(self.abilities), context)

# Process results
for ability_id, effect in results["effects"].items():
    if "new_damage" in effect:
        base_damage = effect["new_damage"]
```

### Executing Building Abilities

```python
# In Building.execute_turn_abilities() method
context = AbilityContext(
    owner=self,
    game_state=game_state,
    phase="end_turn"
)

results = ABILITY_REGISTRY.execute_abilities(list(self.abilities), context)
```

## Modifying Ability Parameters

Agents can customize abilities by modifying the registered instances:

```python
# Example: Make healing stronger
heal_ability = ABILITY_REGISTRY.get("heal")
if isinstance(heal_ability, HealAbility):
    heal_ability.heal_amount = 25  # Increase from default 15

# Example: Make charge bonus larger
charge_ability = ABILITY_REGISTRY.get("charge")
if isinstance(charge_ability, ChargeAbility):
    charge_ability.damage_multiplier = 1.5  # Increase from 1.25
```

## Backward Compatibility

The old `UnitAbility` enum still exists for backward compatibility. Units now store abilities as strings (`Set[str]`) instead of enum values (`Set[UnitAbility]`).

When loading old saves or working with cached data:
- Enum values automatically convert to strings via `.value`
- String IDs work seamlessly with the new registry system

## Testing Abilities

```python
# Test a specific ability
from abilities import ABILITY_REGISTRY, AbilityContext
from entities.unit import Unit, UnitStats

unit = Unit(name="Test Warrior", abilities={"charge"})
target = Unit(name="Enemy")

context = AbilityContext(
    owner=unit,
    target=target,
    action_type="attack",
    base_damage=10
)

results = ABILITY_REGISTRY.execute_abilities(["charge"], context)
assert "charge" in results["applied"]
assert results["effects"]["charge"]["new_damage"] > 10
```

## Best Practices

1. **Keep abilities focused**: One clear effect per ability
2. **Use appropriate types**: Match `AbilityType` to when ability triggers
3. **Provide good defaults**: Make parameters optional with sensible defaults
4. **Handle errors gracefully**: Use try-except when accessing context properties
5. **Document parameters**: Clear docstrings for each modifiable parameter
6. **Test thoroughly**: Verify abilities work in isolation and combination
7. **Consider balance**: Default values should be balanced for gameplay

## Future Enhancements

Potential extensions to the system:

- **Ability prerequisites**: Require certain technologies or buildings
- **Ability upgrades**: Level up abilities with experience
- **Ability combos**: Special effects when abilities combine
- **Cooldowns**: Limit how often abilities can be used
- **Resource costs**: Abilities that consume resources
- **Conditional effects**: Abilities that depend on game state
- **Aura stacking**: Multiple buildings affecting the same unit
