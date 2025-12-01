"""Base classes for the ability system."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Dict, Any, Optional, TYPE_CHECKING
from enum import Enum

if TYPE_CHECKING:
    from entities.unit import Unit
    from entities.faction import Building

class AbilityType(Enum):
    """Types of ability applications."""
    PASSIVE = "passive"      # Always active
    ON_ATTACK = "on_attack"  # Triggers when attacking
    ON_DEFEND = "on_defend"  # Triggers when being attacked
    ON_MOVE = "on_move"      # Triggers when moving
    ON_TURN = "on_turn"      # Triggers each turn
    ACTIVE = "active"        # Must be manually activated

@dataclass
class AbilityContext:
    """Context information for ability execution."""
    owner: Any  # Unit or Building
    target: Optional[Any] = None
    game_state: Optional[Any] = None
    action_type: str = ""
    phase: str = "gameplay"  # "setup", "gameplay", "end_turn"
    
    # Combat specific
    base_damage: int = 0
    base_defense: int = 0
    
    # Movement specific
    target_x: int = 0
    target_y: int = 0
    distance: int = 0
    
    # Turn specific
    turn_number: int = 0
    
    # Resource specific
    resources: Optional[Dict[str, int]] = None
    
    def __post_init__(self):
        if self.resources is None:
            self.resources = {}

class Ability(ABC):
    """Base class for all abilities."""
    
    def __init__(self, name: str, description: str, ability_type: AbilityType):
        self.name = name
        self.description = description
        self.ability_type = ability_type
        self.is_active = True
    
    @abstractmethod
    def can_apply(self, context: AbilityContext) -> bool:
        """Check if ability can be applied in this context."""
        pass
    
    @abstractmethod
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Apply the ability effect. Returns result dictionary."""
        pass
    
    def get_info(self) -> Dict[str, Any]:
        """Get ability information for display."""
        return {
            "name": self.name,
            "description": self.description,
            "type": self.ability_type.value,
            "is_active": self.is_active
        }

class AbilityRegistry:
    """Registry for managing all available abilities."""
    
    def __init__(self):
        self._abilities: Dict[str, Ability] = {}
        self._unit_abilities: Dict[str, Ability] = {}
        self._building_abilities: Dict[str, Ability] = {}
    
    def register(self, ability_id: str, ability: Ability, category: str = "unit") -> None:
        """Register an ability in the registry."""
        self._abilities[ability_id] = ability
        
        if category == "unit":
            self._unit_abilities[ability_id] = ability
        elif category == "building":
            self._building_abilities[ability_id] = ability
    
    def get(self, ability_id: str) -> Optional[Ability]:
        """Get an ability by ID."""
        return self._abilities.get(ability_id)
    
    def get_all_unit_abilities(self) -> Dict[str, Ability]:
        """Get all registered unit abilities."""
        return self._unit_abilities.copy()
    
    def get_all_building_abilities(self) -> Dict[str, Ability]:
        """Get all registered building abilities."""
        return self._building_abilities.copy()
    
    def list_ability_ids(self, category: Optional[str] = None) -> list:
        """List all ability IDs, optionally filtered by category."""
        if category == "unit":
            return list(self._unit_abilities.keys())
        elif category == "building":
            return list(self._building_abilities.keys())
        else:
            return list(self._abilities.keys())
    
    def execute_abilities(self, ability_ids: list, context: AbilityContext) -> Dict[str, Any]:
        """Execute multiple abilities and aggregate results."""
        results = {
            "applied": [],
            "failed": [],
            "effects": {}
        }
        
        for ability_id in ability_ids:
            ability = self.get(ability_id)
            if ability and ability.can_apply(context):
                try:
                    effect = ability.apply(context)
                    results["applied"].append(ability_id)
                    results["effects"][ability_id] = effect
                except Exception as e:
                    results["failed"].append({
                        "ability": ability_id,
                        "error": str(e)
                    })
        
        return results
