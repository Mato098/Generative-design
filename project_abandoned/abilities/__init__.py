"""Modular ability system for units and buildings."""
from .base import Ability, AbilityContext, AbilityRegistry
from .unit_abilities import (
    StealthAbility, HealAbility, BuildAbility, GatherAbility,
    FortifyAbility, ChargeAbility, RangeAttackAbility, SplashDamageAbility
)
from .building_abilities import (
    AutoAttackAbility, WallAbility, HealAuraAbility, ResourceBonusAbility,
    ResearchAbility, TrainFasterAbility
)
from . import utils as _utils

# Global ability registry
ABILITY_REGISTRY = AbilityRegistry()

# Register all unit abilities
ABILITY_REGISTRY.register("stealth", StealthAbility(), "unit")
ABILITY_REGISTRY.register("heal", HealAbility(), "unit")
ABILITY_REGISTRY.register("build", BuildAbility(), "unit")
ABILITY_REGISTRY.register("gather", GatherAbility(), "unit")
ABILITY_REGISTRY.register("fortify", FortifyAbility(), "unit")
ABILITY_REGISTRY.register("charge", ChargeAbility(), "unit")
ABILITY_REGISTRY.register("range_attack", RangeAttackAbility(), "unit")
ABILITY_REGISTRY.register("splash", SplashDamageAbility(), "unit")

# Register all building abilities
ABILITY_REGISTRY.register("auto_attack", AutoAttackAbility(), "building")
ABILITY_REGISTRY.register("wall", WallAbility(), "building")
ABILITY_REGISTRY.register("heal_aura", HealAuraAbility(), "building")
ABILITY_REGISTRY.register("resource_bonus", ResourceBonusAbility(), "building")
ABILITY_REGISTRY.register("research", ResearchAbility(), "building")
ABILITY_REGISTRY.register("train_faster", TrainFasterAbility(), "building")

# Wrapper functions that inject the global registry
def get_ability_descriptions(category: str = "unit") -> str:
    """Generate formatted ability descriptions from registry."""
    return _utils.get_ability_descriptions(ABILITY_REGISTRY, category)

def get_ability_list(category: str = "unit") -> list:
    """Get list of ability IDs for a category."""
    return _utils.get_ability_list(ABILITY_REGISTRY, category)

def get_ability_enum_description(category: str = "unit") -> str:
    """Generate compact ability descriptions for function schema."""
    return _utils.get_ability_enum_description(ABILITY_REGISTRY, category)

def get_ability_summary_table(category: str = "unit") -> dict:
    """Get ability summary as dictionary."""
    return _utils.get_ability_summary_table(ABILITY_REGISTRY, category)

__all__ = [
    'Ability', 'AbilityContext', 'AbilityRegistry', 'ABILITY_REGISTRY',
    'StealthAbility', 'HealAbility', 'BuildAbility', 'GatherAbility',
    'FortifyAbility', 'ChargeAbility', 'RangeAttackAbility', 'SplashDamageAbility',
    'AutoAttackAbility', 'WallAbility', 'HealAuraAbility', 'ResourceBonusAbility',
    'ResearchAbility', 'TrainFasterAbility',
    'get_ability_descriptions', 'get_ability_list', 
    'get_ability_enum_description', 'get_ability_summary_table'
]
