"""Building-specific abilities implementation."""
from typing import Dict, Any
from .base import Ability, AbilityContext, AbilityType

class AutoAttackAbility(Ability):
    """Building automatically attacks nearby enemies."""
    
    def __init__(self, attack_damage: int = 15, attack_range: int = 3):
        super().__init__(
            name="Auto Attack",
            description=f"Automatically attacks enemies within {attack_range} tiles for {attack_damage} damage",
            ability_type=AbilityType.ON_TURN
        )
        self.attack_damage = attack_damage
        self.attack_range = attack_range
    
    def can_apply(self, context: AbilityContext) -> bool:
        """Can attack if building is complete and it's the turn phase."""
        return (context.phase == "end_turn" and 
                getattr(context.owner, 'is_construction_complete', True))
    
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Find and attack nearby enemies."""
        return {
            "auto_attack": True,
            "damage": self.attack_damage,
            "range": self.attack_range,
            "message": f"{getattr(context.owner, 'name', 'Building')} attacks nearby enemies"
        }

class WallAbility(Ability):
    """Building blocks movement and provides cover."""
    
    def __init__(self, blocks_movement: bool = True, cover_bonus: float = 1.5):
        super().__init__(
            name="Wall",
            description=f"Blocks enemy movement and provides {int((cover_bonus - 1) * 100)}% defense bonus to adjacent allies",
            ability_type=AbilityType.PASSIVE
        )
        self.blocks_movement = blocks_movement
        self.cover_bonus = cover_bonus
    
    def can_apply(self, context: AbilityContext) -> bool:
        """Always active."""
        return True
    
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Apply wall effects."""
        return {
            "blocks_movement": self.blocks_movement,
            "cover_bonus": self.cover_bonus,
            "message": f"{getattr(context.owner, 'name', 'Wall')} blocks movement"
        }

class HealAuraAbility(Ability):
    """Building heals nearby friendly units each turn."""
    
    def __init__(self, heal_amount: int = 10, heal_radius: int = 2):
        super().__init__(
            name="Heal Aura",
            description=f"Heals friendly units within {heal_radius} tiles for {heal_amount} HP per turn",
            ability_type=AbilityType.ON_TURN
        )
        self.heal_amount = heal_amount
        self.heal_radius = heal_radius
    
    def can_apply(self, context: AbilityContext) -> bool:
        """Can heal during turn processing."""
        return (context.phase == "end_turn" and 
                getattr(context.owner, 'is_construction_complete', True))
    
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Apply healing to nearby units."""
        return {
            "heal_aura": True,
            "heal_amount": self.heal_amount,
            "radius": self.heal_radius,
            "message": f"{getattr(context.owner, 'name', 'Building')} emanates healing aura"
        }

class ResourceBonusAbility(Ability):
    """Building increases resource generation."""
    
    def __init__(self, bonus_multiplier: float = 1.5):
        super().__init__(
            name="Resource Bonus",
            description=f"Increases resource generation by {int((bonus_multiplier - 1) * 100)}%",
            ability_type=AbilityType.ON_TURN
        )
        self.bonus_multiplier = bonus_multiplier
    
    def can_apply(self, context: AbilityContext) -> bool:
        """Can apply during resource generation."""
        return (context.phase == "end_turn" and 
                getattr(context.owner, 'is_construction_complete', True))
    
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Apply resource generation bonus."""
        bonus_resources = {}
        if context.resources:
            for resource, amount in context.resources.items():
                bonus = int(amount * (self.bonus_multiplier - 1))
                bonus_resources[resource] = bonus
        
        return {
            "resource_bonus": True,
            "multiplier": self.bonus_multiplier,
            "bonus_resources": bonus_resources,
            "message": f"{getattr(context.owner, 'name', 'Building')} boosts resource generation"
        }

class ResearchAbility(Ability):
    """Building can research technologies."""
    
    def __init__(self, research_speed: float = 1.0):
        super().__init__(
            name="Research",
            description=f"Can research technologies (speed: {research_speed}x)",
            ability_type=AbilityType.ACTIVE
        )
        self.research_speed = research_speed
    
    def can_apply(self, context: AbilityContext) -> bool:
        """Can research if action is research."""
        return (context.action_type == "research" and 
                getattr(context.owner, 'is_construction_complete', True))
    
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Enable research."""
        return {
            "can_research": True,
            "research_speed": self.research_speed,
            "message": f"{getattr(context.owner, 'name', 'Building')} can research technologies"
        }

class TrainFasterAbility(Ability):
    """Building trains units faster."""
    
    def __init__(self, training_speed_multiplier: float = 1.5):
        super().__init__(
            name="Train Faster",
            description=f"Units train {int((training_speed_multiplier - 1) * 100)}% faster",
            ability_type=AbilityType.PASSIVE
        )
        self.training_speed_multiplier = training_speed_multiplier
    
    def can_apply(self, context: AbilityContext) -> bool:
        """Always active when producing units."""
        return context.action_type == "create_unit"
    
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Apply training speed bonus."""
        return {
            "training_bonus": True,
            "multiplier": self.training_speed_multiplier,
            "message": f"{getattr(context.owner, 'name', 'Building')} trains units faster"
        }
