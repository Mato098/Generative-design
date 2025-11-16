"""Player factions with units, buildings, and resources."""
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Set
from enum import Enum
import uuid

from .unit import Unit
from .sprite import Sprite

@dataclass
class FactionTheme:
    """Visual and narrative theme for a faction."""
    name: str
    description: str
    color_scheme: List[str]  # Primary colors for this faction
    architectural_style: str  # "medieval", "futuristic", "organic", etc.
    unit_naming_convention: str  # How units should be named
    lore: str = ""  # Background story
    
class BuildingType(Enum):
    """Types of buildings that can be constructed."""
    TOWN_CENTER = "town_center"
    BARRACKS = "barracks"
    ARCHERY_RANGE = "archery_range" 
    STABLE = "stable"
    WORKSHOP = "workshop"
    FARM = "farm"
    MINE = "mine"
    LUMBER_MILL = "lumber_mill"
    WALL = "wall"
    TOWER = "tower"

@dataclass
class Building:
    """A faction building."""
    building_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "Building"
    building_type: BuildingType = BuildingType.TOWN_CENTER
    x: int = 0
    y: int = 0
    health: int = 100
    max_health: int = 100
    is_construction_complete: bool = True
    construction_progress: float = 1.0  # 0.0 to 1.0
    
    # Production capabilities
    produces_units: List[str] = field(default_factory=list)  # Unit types this building can create
    resource_generation: Dict[str, int] = field(default_factory=dict)  # Resources per turn
    
    # Costs
    creation_cost: Dict[str, int] = field(default_factory=lambda: {"gold": 200, "wood": 100})
    
    # Visual
    sprite: Optional[Sprite] = None
    
    def can_produce_unit(self, unit_type: str) -> bool:
        """Check if building can produce this unit type."""
        return unit_type in self.produces_units and self.is_construction_complete
    
    def generate_resources(self) -> Dict[str, int]:
        """Generate resources for this turn."""
        if self.is_construction_complete:
            return self.resource_generation.copy()
        return {}
    
    def take_damage(self, damage: int) -> None:
        """Receive damage."""
        self.health = max(0, self.health - damage)
    
    def is_destroyed(self) -> bool:
        """Check if building is destroyed."""
        return self.health <= 0

@dataclass
class Faction:
    """A player's faction with theme, units, buildings, and resources."""
    
    faction_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str = ""  # Agent ID that controls this faction
    name: str = "Unknown Faction"
    
    # Theme and visual identity
    theme: Optional[FactionTheme] = None
    
    # Resources
    resources: Dict[str, int] = field(default_factory=lambda: {
        "gold": 500, "wood": 300, "food": 200, "stone": 100
    })
    
    # Military and infrastructure
    units: List[Unit] = field(default_factory=list)
    buildings: List[Building] = field(default_factory=list)
    
    # Custom unit designs created by this faction
    custom_unit_designs: Dict[str, Dict] = field(default_factory=dict)
    
    # Research and technologies (future expansion)
    technologies: Set[str] = field(default_factory=set)
    
    # Diplomacy (future expansion) 
    allies: Set[str] = field(default_factory=set)
    enemies: Set[str] = field(default_factory=set)
    
    # Statistics
    units_created: int = 0
    units_lost: int = 0
    buildings_constructed: int = 0
    resources_gathered: Dict[str, int] = field(default_factory=lambda: {
        "gold": 0, "wood": 0, "food": 0, "stone": 0
    })
    
    def can_afford(self, costs: Dict[str, int]) -> bool:
        """Check if faction can afford the given costs."""
        for resource, cost in costs.items():
            if self.resources.get(resource, 0) < cost:
                return False
        return True
    
    def spend_resources(self, costs: Dict[str, int]) -> bool:
        """Spend resources if available."""
        if not self.can_afford(costs):
            return False
            
        for resource, cost in costs.items():
            self.resources[resource] -= cost
        return True
    
    def add_resources(self, resources: Dict[str, int]) -> None:
        """Add resources to faction."""
        for resource, amount in resources.items():
            self.resources[resource] = self.resources.get(resource, 0) + amount
            self.resources_gathered[resource] += amount
    
    def add_unit(self, unit: Unit) -> bool:
        """Add a unit to this faction."""
        from config.game_config import MAX_UNITS_PER_PLAYER
        
        if len(self.units) >= MAX_UNITS_PER_PLAYER:
            return False
            
        unit.faction_id = self.faction_id
        unit.owner_id = self.owner_id
        self.units.append(unit)
        self.units_created += 1
        return True
    
    def remove_unit(self, unit_id: str) -> bool:
        """Remove a unit from this faction."""
        for i, unit in enumerate(self.units):
            if unit.unit_id == unit_id:
                del self.units[i]
                self.units_lost += 1
                return True
        return False
    
    def get_unit(self, unit_id: str) -> Optional[Unit]:
        """Get unit by ID."""
        for unit in self.units:
            if unit.unit_id == unit_id:
                return unit
        return None
    
    def add_building(self, building: Building) -> bool:
        """Add a building to this faction."""
        from config.game_config import MAX_BUILDINGS_PER_PLAYER
        
        if len(self.buildings) >= MAX_BUILDINGS_PER_PLAYER:
            return False
            
        self.buildings.append(building)
        self.buildings_constructed += 1
        return True
    
    def get_building(self, building_id: str) -> Optional[Building]:
        """Get building by ID."""
        for building in self.buildings:
            if building.building_id == building_id:
                return building
        return None
    
    def create_custom_unit_design(self, design_name: str, unit_data: Dict) -> bool:
        """Add a custom unit design."""
        if design_name in self.custom_unit_designs:
            return False  # Design name already exists
            
        self.custom_unit_designs[design_name] = unit_data
        return True
    
    def process_turn(self) -> None:
        """Process end-of-turn effects."""
        # Generate resources from buildings
        for building in self.buildings:
            if not building.is_destroyed():
                generated = building.generate_resources()
                self.add_resources(generated)
        
        # Reset unit turn flags
        for unit in self.units:
            unit.reset_turn()
        
        # Remove destroyed units
        self.units = [unit for unit in self.units if unit.stats.health > 0]
        
        # Remove destroyed buildings
        self.buildings = [building for building in self.buildings if not building.is_destroyed()]
    
    def get_total_military_strength(self) -> int:
        """Calculate total military power."""
        strength = 0
        for unit in self.units:
            if unit.stats.health > 0:
                strength += unit.stats.attack + unit.stats.defense
        return strength
    
    def get_resource_income(self) -> Dict[str, int]:
        """Calculate resource income per turn."""
        income = {}
        for building in self.buildings:
            if building.is_construction_complete and not building.is_destroyed():
                for resource, amount in building.resource_generation.items():
                    income[resource] = income.get(resource, 0) + amount
        return income
    
    def to_dict(self) -> Dict:
        """Convert faction to dictionary for serialization."""
        return {
            "faction_id": self.faction_id,
            "owner_id": self.owner_id,
            "name": self.name,
            "theme": {
                "name": self.theme.name,
                "description": self.theme.description,
                "color_scheme": self.theme.color_scheme,
                "architectural_style": self.theme.architectural_style,
                "unit_naming_convention": self.theme.unit_naming_convention,
                "lore": self.theme.lore
            } if self.theme else None,
            "resources": self.resources,
            "units": [unit.to_dict() for unit in self.units],
            "buildings": [
                {
                    "building_id": b.building_id,
                    "name": b.name,
                    "building_type": b.building_type.value,
                    "x": b.x,
                    "y": b.y,
                    "health": b.health,
                    "max_health": b.max_health,
                    "is_construction_complete": b.is_construction_complete,
                    "construction_progress": b.construction_progress,
                    "produces_units": b.produces_units,
                    "resource_generation": b.resource_generation,
                    "creation_cost": b.creation_cost,
                    "sprite": b.sprite.to_dict() if b.sprite else None
                } for b in self.buildings
            ],
            "custom_unit_designs": self.custom_unit_designs,
            "technologies": list(self.technologies),
            "allies": list(self.allies),
            "enemies": list(self.enemies),
            "stats": {
                "units_created": self.units_created,
                "units_lost": self.units_lost,
                "buildings_constructed": self.buildings_constructed,
                "resources_gathered": self.resources_gathered
            }
        }