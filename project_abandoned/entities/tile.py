"""Map tiles and terrain system."""
from dataclasses import dataclass, field
from typing import Optional, Dict, Any
from enum import Enum

from config.game_config import TerrainType, TERRAIN_MOVEMENT_COST

@dataclass 
class Tile:
    """Represents a single map tile."""
    
    x: int
    y: int
    terrain_type: TerrainType = TerrainType.PLAINS
    
    # Occupancy
    unit_id: Optional[str] = None
    building_id: Optional[str] = None
    
    # Resources
    resource_type: Optional[str] = None
    resource_amount: int = 0
    
    # Visual
    is_explored: Dict[str, bool] = field(default_factory=dict)  # agent_id -> explored
    is_visible: Dict[str, bool] = field(default_factory=dict)   # agent_id -> currently visible
    
    # Special properties
    is_passable: bool = True
    movement_cost: int = field(init=False)
    
    def __post_init__(self):
        """Set movement cost based on terrain."""
        self.movement_cost = TERRAIN_MOVEMENT_COST.get(self.terrain_type, 1)
        
        # Water tiles are not passable for land units
        if self.terrain_type == TerrainType.WATER:
            self.is_passable = False
    
    def can_place_unit(self) -> bool:
        """Check if a unit can be placed on this tile."""
        return (self.is_passable and 
                self.unit_id is None and 
                self.building_id is None)
    
    def can_place_building(self) -> bool:
        """Check if a building can be placed on this tile."""
        return (self.terrain_type in [TerrainType.PLAINS, TerrainType.DESERT] and
                self.unit_id is None and
                self.building_id is None)
    
    def place_unit(self, unit_id: str) -> bool:
        """Place a unit on this tile."""
        if self.can_place_unit():
            self.unit_id = unit_id
            return True
        return False
    
    def remove_unit(self) -> Optional[str]:
        """Remove unit from tile and return its ID."""
        unit_id = self.unit_id
        self.unit_id = None
        return unit_id
    
    def place_building(self, building_id: str) -> bool:
        """Place a building on this tile."""
        if self.can_place_building():
            self.building_id = building_id
            return True
        return False
    
    def set_explored(self, agent_id: str, explored: bool = True) -> None:
        """Set exploration status for an agent."""
        self.is_explored[agent_id] = explored
    
    def set_visible(self, agent_id: str, visible: bool = True) -> None:
        """Set visibility status for an agent."""
        self.is_visible[agent_id] = visible
        if visible:
            self.set_explored(agent_id, True)
    
    def is_visible_to(self, agent_id: str) -> bool:
        """Check if tile is visible to agent."""
        return self.is_visible.get(agent_id, False)
    
    def is_explored_by(self, agent_id: str) -> bool:
        """Check if tile has been explored by agent."""
        return self.is_explored.get(agent_id, False)
    
    def get_display_char(self) -> str:
        """Get character for console display."""
        # Building takes priority
        if self.building_id:
            return "#"
        
        # Then units
        if self.unit_id:
            return "U"  # Will be overridden by actual unit display
        
        # Then resources
        if self.resource_type:
            return "*"
            
        # Finally terrain
        terrain_chars = {
            TerrainType.PLAINS: ".",
            TerrainType.FOREST: "T",
            TerrainType.WATER: "~",
            TerrainType.MOUNTAIN: "^",
            TerrainType.DESERT: ";"
        }
        return terrain_chars.get(self.terrain_type, ".")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert tile to dictionary for serialization."""
        return {
            "x": self.x,
            "y": self.y,
            "terrain_type": self.terrain_type.value,
            "unit_id": self.unit_id,
            "building_id": self.building_id,
            "resource_type": self.resource_type,
            "resource_amount": self.resource_amount,
            "is_explored": self.is_explored,
            "is_visible": self.is_visible,
            "is_passable": self.is_passable,
            "movement_cost": self.movement_cost
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Tile':
        """Create tile from dictionary."""
        terrain_type = TerrainType(data["terrain_type"])
        tile = cls(
            x=data["x"],
            y=data["y"],
            terrain_type=terrain_type,
            unit_id=data.get("unit_id"),
            building_id=data.get("building_id"),
            resource_type=data.get("resource_type"),
            resource_amount=data.get("resource_amount", 0)
        )
        tile.is_explored = data.get("is_explored", {})
        tile.is_visible = data.get("is_visible", {})
        tile.is_passable = data.get("is_passable", True)
        return tile