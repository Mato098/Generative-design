"""Unit-specific abilities implementation."""
from typing import Dict, Any
from .base import Ability, AbilityContext, AbilityType

class StealthAbility(Ability):
    """Unit is hidden from enemy sight unless adjacent."""
    
    def __init__(self):
        super().__init__(
            name="Stealth",
            description="Hidden from enemies unless adjacent (sight_range reduced by 50%)",
            ability_type=AbilityType.PASSIVE
        )
    
    def can_apply(self, context: AbilityContext) -> bool:
        """Stealth is always active (passive)."""
        return True
    
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Reduce effective sight range for enemies detecting this unit."""
        return {
            "stealth_active": True,
            "detection_penalty": 0.5,
            "message": f"{context.owner.name} is stealthed"
        }

class HealAbility(Ability):
    """Can heal adjacent friendly units."""
    
    def __init__(self, heal_amount: int = 15):
        super().__init__(
            name="Heal",
            description=f"Heals adjacent friendly units for {heal_amount} HP",
            ability_type=AbilityType.ACTIVE
        )
        self.heal_amount = heal_amount
    
    def can_apply(self, context: AbilityContext) -> bool:
        """Can heal if target exists and is damaged."""
        if not context.target:
            return False
        if context.action_type != "heal":
            return False
        # Check if target is damaged
        return hasattr(context.target, 'stats') and context.target.stats.health < context.target.stats.max_health
    
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Heal the target unit."""
        if not context.target:
            return {"healed": False, "error": "No target specified"}
        
        if hasattr(context.target, 'heal'):
            context.target.heal(self.heal_amount)
            return {
                "healed": True,
                "amount": self.heal_amount,
                "target_health": context.target.stats.health,
                "message": f"{context.owner.name} healed {context.target.name} for {self.heal_amount} HP"
            }
        return {"healed": False, "error": "Target cannot be healed"}

class BuildAbility(Ability):
    """Can construct buildings."""
    
    def __init__(self, build_speed_multiplier: float = 1.0):
        super().__init__(
            name="Build",
            description=f"Can construct buildings (speed: {build_speed_multiplier}x)",
            ability_type=AbilityType.ACTIVE
        )
        self.build_speed_multiplier = build_speed_multiplier
    
    def can_apply(self, context: AbilityContext) -> bool:
        """Can build if action is build."""
        return context.action_type == "build"
    
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Apply build speed modifier."""
        return {
            "can_build": True,
            "build_speed_multiplier": self.build_speed_multiplier,
            "message": f"{context.owner.name} can construct buildings"
        }

class GatherAbility(Ability):
    """Increases resource gathering efficiency."""
    
    def __init__(self, gather_multiplier: float = 2.0):
        super().__init__(
            name="Gather",
            description=f"Gathers resources {gather_multiplier}x faster",
            ability_type=AbilityType.PASSIVE
        )
        self.gather_multiplier = gather_multiplier
    
    def can_apply(self, context: AbilityContext) -> bool:
        """Can apply when gathering resources."""
        return context.action_type == "gather" or context.phase == "end_turn"
    
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Apply gathering multiplier to resources."""
        multiplied_resources = {}
        if context.resources:
            for resource, amount in context.resources.items():
                multiplied_resources[resource] = int(amount * self.gather_multiplier)
        
        return {
            "gather_bonus": True,
            "multiplier": self.gather_multiplier,
            "resources": multiplied_resources,
            "message": f"{context.owner.name} gathers resources {self.gather_multiplier}x faster"
        }

class FortifyAbility(Ability):
    """Increases defense when stationary."""
    
    def __init__(self, defense_multiplier: float = 1.5):
        super().__init__(
            name="Fortify",
            description=f"Defense increased by {int((defense_multiplier - 1) * 100)}% when fortified",
            ability_type=AbilityType.ACTIVE
        )
        self.defense_multiplier = defense_multiplier
    
    def can_apply(self, context: AbilityContext) -> bool:
        """Can fortify if unit hasn't moved."""
        if context.action_type == "fortify":
            return not getattr(context.owner, 'has_moved', True)
        # Also apply during defense if fortified
        if context.action_type == "defend":
            return getattr(context.owner, 'is_fortified', False)
        return False
    
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Apply fortification defense bonus."""
        if context.action_type == "fortify":
            context.owner.is_fortified = True
            return {
                "fortified": True,
                "message": f"{context.owner.name} is fortified"
            }
        elif context.action_type == "defend":
            # Apply defense multiplier
            context.base_defense = int(context.base_defense * self.defense_multiplier)
            return {
                "defense_bonus": True,
                "multiplier": self.defense_multiplier,
                "new_defense": context.base_defense
            }
        return {}

class ChargeAbility(Ability):
    """Bonus attack damage after moving."""
    
    def __init__(self, damage_multiplier: float = 1.25):
        super().__init__(
            name="Charge",
            description=f"Attack increased by {int((damage_multiplier - 1) * 100)}% when attacking after moving",
            ability_type=AbilityType.ON_ATTACK
        )
        self.damage_multiplier = damage_multiplier
    
    def can_apply(self, context: AbilityContext) -> bool:
        """Can apply if attacking after moving."""
        return (context.action_type == "attack" and 
                getattr(context.owner, 'has_moved', False))
    
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Apply charge damage bonus."""
        context.base_damage = int(context.base_damage * self.damage_multiplier)
        return {
            "charge_bonus": True,
            "multiplier": self.damage_multiplier,
            "new_damage": context.base_damage,
            "message": f"{context.owner.name} charges with bonus damage!"
        }

class RangeAttackAbility(Ability):
    """Increases attack range."""
    
    def __init__(self, range_bonus: int = 2):
        super().__init__(
            name="Range Attack",
            description=f"Can attack from +{range_bonus} additional range",
            ability_type=AbilityType.PASSIVE
        )
        self.range_bonus = range_bonus
    
    def can_apply(self, context: AbilityContext) -> bool:
        """Always applicable for ranged units."""
        return True
    
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Increase attack range."""
        return {
            "range_bonus": self.range_bonus,
            "message": f"{context.owner.name} has extended range"
        }

class SplashDamageAbility(Ability):
    """Damages adjacent enemies in area of effect."""
    
    def __init__(self, splash_percentage: float = 0.5, splash_radius: int = 1):
        super().__init__(
            name="Splash Damage",
            description=f"Deals {int(splash_percentage * 100)}% damage to enemies within {splash_radius} tiles",
            ability_type=AbilityType.ON_ATTACK
        )
        self.splash_percentage = splash_percentage
        self.splash_radius = splash_radius
    
    def can_apply(self, context: AbilityContext) -> bool:
        """Can apply when attacking."""
        return context.action_type == "attack" and context.target is not None
    
    def apply(self, context: AbilityContext) -> Dict[str, Any]:
        """Apply splash damage to nearby enemies."""
        splash_damage = int(context.base_damage * self.splash_percentage)
        
        # Find nearby enemies (requires game_state)
        nearby_targets = []
        if context.game_state and hasattr(context.target, 'x'):
            # This would need to query game state for nearby units
            # For now, return the splash parameters
            pass
        
        return {
            "splash_active": True,
            "splash_damage": splash_damage,
            "splash_radius": self.splash_radius,
            "message": f"{context.owner.name} attacks with splash damage!",
            "nearby_targets": nearby_targets
        }
