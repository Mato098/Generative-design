"""Game configuration and constants."""
import os
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from enum import Enum

# Map settings
MAP_WIDTH = 20
MAP_HEIGHT = 20
DEFAULT_RESOURCES = 1000

# Game rules
MAX_PLAYERS = 4
MAX_TURNS = 10
TURN_TIMEOUT_SECONDS = 30

# Unit constraints
MAX_UNIT_HEALTH = 100
MAX_UNIT_ATTACK = 50
MAX_UNIT_DEFENSE = 30
MAX_UNIT_SPEED = 10
MAX_UNITS_PER_PLAYER = 20

# Building constraints
MAX_BUILDING_HEALTH = 200
MAX_BUILDINGS_PER_PLAYER = 10

# Resource types
RESOURCE_TYPES = ["gold", "wood", "food", "stone"]
STARTING_RESOURCES = {
    "gold": 500,
    "wood": 300,
    "food": 200,
    "stone": 100
}

# Victory conditions
class VictoryCondition(Enum):
    ELIMINATION = "elimination"  # Destroy all enemy units
    RESOURCE = "resource"        # Accumulate X resources
    TERRITORY = "territory"      # Control X% of map
    TIME_LIMIT = "time_limit"    # Most points when time runs out

VICTORY_CONDITIONS = [VictoryCondition.ELIMINATION, VictoryCondition.TIME_LIMIT]

# Age of Empires III inspired unit types for reference
REFERENCE_UNIT_TYPES = [
    "musketeer", "pikeman", "crossbowman", "cavalry", "artillery",
    "explorer", "settler", "fishing_boat", "caravel", "galleon"
]

# Terrain types
class TerrainType(Enum):
    PLAINS = "plains"
    FOREST = "forest" 
    WATER = "water"
    MOUNTAIN = "mountain"
    DESERT = "desert"

TERRAIN_MOVEMENT_COST = {
    TerrainType.PLAINS: 1,
    TerrainType.FOREST: 2,
    TerrainType.WATER: 999,  # Impassable for land units
    TerrainType.MOUNTAIN: 3,
    TerrainType.DESERT: 2
}

@dataclass
class GameBalance:
    """Game balance settings that can be adjusted by admin agent."""
    unit_cost_multiplier: float = 1.0
    building_cost_multiplier: float = 1.0
    resource_generation_rate: float = 1.0
    combat_damage_multiplier: float = 1.0
    movement_speed_multiplier: float = 1.0
    
    def apply_adjustments(self, adjustments: Dict[str, float]) -> 'GameBalance':
        """Apply balance adjustments from admin agent."""
        for key, value in adjustments.items():
            if hasattr(self, key):
                setattr(self, key, value)
        return self

# Default game balance
DEFAULT_BALANCE = GameBalance()

# Main configuration class
@dataclass
class GameConfig:
    """Main game configuration container."""
    map_width: int = MAP_WIDTH
    map_height: int = MAP_HEIGHT
    max_players: int = MAX_PLAYERS
    max_turns_per_game: int = MAX_TURNS
    turn_timeout_seconds: int = TURN_TIMEOUT_SECONDS
    
    max_unit_health: int = MAX_UNIT_HEALTH
    max_unit_attack: int = MAX_UNIT_ATTACK
    max_unit_defense: int = MAX_UNIT_DEFENSE
    max_unit_speed: int = MAX_UNIT_SPEED
    max_units_per_player: int = MAX_UNITS_PER_PLAYER
    
    max_building_health: int = MAX_BUILDING_HEALTH
    max_buildings_per_player: int = MAX_BUILDINGS_PER_PLAYER
    
    starting_resources: Optional[Dict[str, int]] = None
    victory_conditions: Optional[List[VictoryCondition]] = None
    game_balance: Optional[GameBalance] = None
    
    def __post_init__(self):
        """Initialize default values."""
        if self.starting_resources is None:
            self.starting_resources = STARTING_RESOURCES.copy()
        if self.victory_conditions is None:
            self.victory_conditions = VICTORY_CONDITIONS.copy()
        if self.game_balance is None:
            self.game_balance = DEFAULT_BALANCE