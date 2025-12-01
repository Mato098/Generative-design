"""Game units with stats, abilities, and sprites."""
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Set, Any
from enum import Enum
from .sprite import Sprite
import uuid

class UnitType(Enum):
    """Base unit categories."""
    INFANTRY = "infantry"
    CAVALRY = "cavalry"
    RANGED = "ranged"
    ARTILLERY = "artillery"
    NAVAL = "naval"
    SUPPORT = "support"
    WORKER = "worker"

class UnitAbility(Enum):
    """Special abilities units can have."""
    STEALTH = "stealth"           # Hidden from enemies
    HEAL = "heal"                 # Can heal other units
    BUILD = "build"               # Can construct buildings  
    GATHER = "gather"             # Can gather resources
    FORTIFY = "fortify"           # Increased defense when stationary
    CHARGE = "charge"             # Bonus attack when moving
    RANGE_ATTACK = "range_attack" # Can attack from distance
    SPLASH_DAMAGE = "splash"      # Area of effect damage

@dataclass
class UnitStats:
    """Unit statistics and capabilities."""
    health: int
    max_health: int
    attack: int
    defense: int
    movement_speed: int
    attack_range: int = 1
    sight_range: int = 3
    
    def __post_init__(self):
        """Validate stats are within limits."""
        from config.game_config import MAX_UNIT_HEALTH, MAX_UNIT_ATTACK, MAX_UNIT_DEFENSE, MAX_UNIT_SPEED
        
        if self.max_health > MAX_UNIT_HEALTH:
            raise ValueError(f"Unit health cannot exceed {MAX_UNIT_HEALTH}")
        if self.attack > MAX_UNIT_ATTACK:
            raise ValueError(f"Unit attack cannot exceed {MAX_UNIT_ATTACK}")
        if self.defense > MAX_UNIT_DEFENSE:
            raise ValueError(f"Unit defense cannot exceed {MAX_UNIT_DEFENSE}")
        if self.movement_speed > MAX_UNIT_SPEED:
            raise ValueError(f"Unit speed cannot exceed {MAX_UNIT_SPEED}")
            
        self.health = min(self.health, self.max_health)

@dataclass
class Unit:
    """A game unit with position, stats, and abilities."""
    
    unit_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "Unit"
    unit_type: UnitType = UnitType.INFANTRY
    faction_id: str = ""
    owner_id: str = ""  # Agent ID
    
    # Position
    x: int = 0
    y: int = 0
    
    # Stats
    stats: UnitStats = field(default_factory=lambda: UnitStats(50, 50, 10, 5, 2))
    
    # Abilities and traits (stored as string IDs for flexibility)
    abilities: Set[str] = field(default_factory=set)  # Changed from Set[UnitAbility] to Set[str]
    
    # Visual representation
    sprite: Optional[Sprite] = None
    
    # State
    has_moved: bool = False
    has_attacked: bool = False
    is_fortified: bool = False
    status_effects: Dict[str, int] = field(default_factory=dict)  # effect -> remaining turns
    
    # Resource costs
    creation_cost: Dict[str, int] = field(default_factory=lambda: {"gold": 100})
    upkeep_cost: Dict[str, int] = field(default_factory=dict)
    
    # Experience and veterancy
    experience: int = 0
    veterancy_level: int = 0
    
    def can_move(self) -> bool:
        """Check if unit can move this turn."""
        return not self.has_moved and self.stats.health > 0
    
    def can_attack(self) -> bool:
        """Check if unit can attack this turn."""
        return not self.has_attacked and self.stats.health > 0
    
    def move_to(self, x: int, y: int) -> bool:
        """Move unit to new position."""
        if not self.can_move():
            return False
            
        # Calculate distance
        distance = abs(self.x - x) + abs(self.y - y)  # Manhattan distance
        
        if distance <= self.stats.movement_speed:
            self.x = x
            self.y = y
            self.has_moved = True
            self.is_fortified = False  # Moving breaks fortification
            return True
        return False
    
    def attack(self, target: 'Unit', game_state=None) -> Dict[str, Any]:
        """Attack another unit with ability system integration."""
        if not self.can_attack():
            return {"success": False, "reason": "Cannot attack this turn"}
            
        # Calculate distance
        distance = abs(self.x - target.x) + abs(self.y - target.y)
        
        if distance > self.stats.attack_range:
            return {"success": False, "reason": "Target out of range"}
        
        # Calculate base damage
        base_damage = self.stats.attack
        defense = target.stats.defense
        
        # Apply defender abilities (fortify, etc.)
        if target.is_fortified and "fortify" in target.abilities:
            defense = int(defense * 1.5)
        
        # Apply attacker abilities using new system
        try:
            from abilities import ABILITY_REGISTRY, AbilityContext
            
            context = AbilityContext(
                owner=self,
                target=target,
                game_state=game_state,
                action_type="attack",
                base_damage=base_damage,
                base_defense=defense,
                distance=distance
            )
            
            # Execute all attack-related abilities
            ability_results = ABILITY_REGISTRY.execute_abilities(list(self.abilities), context)
            
            # Update damage from ability modifications
            if ability_results["effects"]:
                for ability_id, effect in ability_results["effects"].items():
                    if "new_damage" in effect:
                        base_damage = effect["new_damage"]
                    if "splash_active" in effect:
                        # Handle splash damage later
                        pass
        except ImportError:
            # Fallback to old system if abilities module not available
            if "charge" in self.abilities and self.has_moved:
                base_damage = int(base_damage * 1.25)
            
        final_damage = max(1, base_damage - defense)
        
        # Apply damage
        target.take_damage(final_damage)
        
        self.has_attacked = True
        self.gain_experience(10)
        
        return {
            "success": True,
            "damage_dealt": final_damage,
            "target_remaining_health": target.stats.health,
            "target_destroyed": target.stats.health <= 0
        }
    
    def take_damage(self, damage: int) -> None:
        """Receive damage."""
        self.stats.health = max(0, self.stats.health - damage)
        
        if self.stats.health <= 0:
            self.on_death()
    
    def heal(self, amount: int) -> None:
        """Restore health."""
        self.stats.health = min(self.stats.max_health, self.stats.health + amount)
    
    def fortify(self) -> bool:
        """Fortify unit for increased defense."""
        if not self.has_moved and "fortify" in self.abilities:
            # Use ability system if available
            try:
                from abilities import ABILITY_REGISTRY, AbilityContext
                
                context = AbilityContext(
                    owner=self,
                    action_type="fortify"
                )
                
                results = ABILITY_REGISTRY.execute_abilities(["fortify"], context)
                if results["applied"]:
                    self.is_fortified = True
                    return True
            except ImportError:
                # Fallback
                self.is_fortified = True
                return True
        return False
    
    def gain_experience(self, exp: int) -> None:
        """Gain experience points."""
        self.experience += exp
        
        # Check for veterancy level up
        required_exp = (self.veterancy_level + 1) * 100
        if self.experience >= required_exp:
            self.level_up()
    
    def level_up(self) -> None:
        """Increase veterancy level and improve stats."""
        self.veterancy_level += 1
        
        # Improve stats slightly
        self.stats.max_health += 5
        self.stats.health = min(self.stats.max_health, self.stats.health + 5)
        self.stats.attack += 2
        self.stats.defense += 1
    
    def on_death(self) -> None:
        """Handle unit death."""
        # Can be overridden for special death effects
        pass
    
    def reset_turn(self) -> None:
        """Reset turn-based flags."""
        self.has_moved = False
        self.has_attacked = False
        
        # Update status effects
        expired_effects = []
        for effect, remaining in self.status_effects.items():
            remaining -= 1
            if remaining <= 0:
                expired_effects.append(effect)
            else:
                self.status_effects[effect] = remaining
                
        for effect in expired_effects:
            del self.status_effects[effect]
    
    def get_display_char(self) -> str:
        """Get character for console display."""
        if self.sprite:
            # Use center pixel of sprite as representative character
            return self.sprite.get_pixel(8, 8)
        
        # Fallback to type-based character
        type_chars = {
            UnitType.INFANTRY: "I",
            UnitType.CAVALRY: "C", 
            UnitType.RANGED: "R",
            UnitType.ARTILLERY: "A",
            UnitType.NAVAL: "N",
            UnitType.SUPPORT: "S",
            UnitType.WORKER: "W"
        }
        return type_chars.get(self.unit_type, "U")
    
    def to_dict(self) -> Dict:
        """Convert unit to dictionary for serialization."""
        return {
            "unit_id": self.unit_id,
            "name": self.name,
            "unit_type": self.unit_type.value,
            "faction_id": self.faction_id,
            "owner_id": self.owner_id,
            "x": self.x,
            "y": self.y,
            "stats": {
                "health": self.stats.health,
                "max_health": self.stats.max_health,
                "attack": self.stats.attack,
                "defense": self.stats.defense,
                "movement_speed": self.stats.movement_speed,
                "attack_range": self.stats.attack_range,
                "sight_range": self.stats.sight_range
            },
            "abilities": list(self.abilities),  # Now just a list of strings
            "sprite": self.sprite.to_dict() if self.sprite else None,
            "has_moved": self.has_moved,
            "has_attacked": self.has_attacked,
            "is_fortified": self.is_fortified,
            "status_effects": self.status_effects,
            "creation_cost": self.creation_cost,
            "upkeep_cost": self.upkeep_cost,
            "experience": self.experience,
            "veterancy_level": self.veterancy_level
        }