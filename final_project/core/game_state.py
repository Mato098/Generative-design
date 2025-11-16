"""Core game state management."""
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Any
from enum import Enum
import json
import time
import random

from config.game_config import (
    MAP_WIDTH, MAP_HEIGHT, MAX_PLAYERS, TerrainType, 
    VictoryCondition, STARTING_RESOURCES, DEFAULT_BALANCE
)
from entities.faction import Faction
from entities.unit import Unit
from entities.tile import Tile

class GamePhase(Enum):
    """Current phase of the game."""
    SETUP = "setup"           # Agents creating factions
    BALANCING = "balancing"   # Admin reviewing balance
    PLAYING = "playing"       # Main game loop
    ENDED = "ended"           # Game finished

@dataclass
class GameState:
    """Complete game state including map, factions, and metadata."""
    
    # Game metadata
    game_id: str = ""
    turn_number: int = 0
    phase: GamePhase = GamePhase.SETUP
    current_player_index: int = 0
    max_players: int = MAX_PLAYERS
    
    # Map and world
    map_grid: List[List[Tile]] = field(default_factory=list)
    map_width: int = MAP_WIDTH
    map_height: int = MAP_HEIGHT
    
    # Players and factions
    factions: Dict[str, Faction] = field(default_factory=dict)  # agent_id -> faction
    player_turn_order: List[str] = field(default_factory=list)  # agent IDs in turn order
    
    # Game rules and balance
    balance_settings = DEFAULT_BALANCE
    victory_conditions: List[VictoryCondition] = field(
        default_factory=lambda: [VictoryCondition.ELIMINATION]
    )
    
    # Game events and history
    event_log: List[Dict[str, Any]] = field(default_factory=list)
    turn_history: List[Dict[str, Any]] = field(default_factory=list)
    
    # Timestamps
    game_started_at: float = 0.0
    last_update_at: float = 0.0
    
    def __post_init__(self):
        """Initialize game state if not loaded from save."""
        if not self.map_grid:
            self._initialize_map()
        if not self.game_started_at:
            self.game_started_at = time.time()
        self.last_update_at = time.time()
    
    def _initialize_map(self) -> None:
        """Create the initial map with terrain."""
        self.map_grid = []
        
        for y in range(self.map_height):
            row = []
            for x in range(self.map_width):
                # Generate random terrain with some logic
                terrain = self._generate_terrain(x, y)
                tile = Tile(x, y, terrain)
                
                # Add some resources randomly
                if random.random() < 0.1 and terrain != TerrainType.WATER:
                    tile.resource_type = random.choice(["gold", "wood", "stone"])
                    tile.resource_amount = random.randint(50, 200)
                
                row.append(tile)
            self.map_grid.append(row)
    
    def _generate_terrain(self, x: int, y: int) -> TerrainType:
        """Generate terrain type for a position."""
        # Simple terrain generation
        center_x, center_y = self.map_width // 2, self.map_height // 2
        distance_from_center = abs(x - center_x) + abs(y - center_y)
        
        # Water around edges
        if (x == 0 or x == self.map_width - 1 or 
            y == 0 or y == self.map_height - 1):
            if random.random() < 0.3:
                return TerrainType.WATER
        
        # Mountains in some areas
        if distance_from_center > 12 and random.random() < 0.2:
            return TerrainType.MOUNTAIN
            
        # Forests scattered around
        if random.random() < 0.15:
            return TerrainType.FOREST
            
        # Some desert patches
        if random.random() < 0.1:
            return TerrainType.DESERT
            
        # Default to plains
        return TerrainType.PLAINS
    
    def get_tile(self, x: int, y: int) -> Optional[Tile]:
        """Get tile at coordinates."""
        if 0 <= x < self.map_width and 0 <= y < self.map_height:
            return self.map_grid[y][x]
        return None
    
    def add_faction(self, agent_id: str, faction: Faction) -> bool:
        """Add a faction to the game."""
        if len(self.factions) >= MAX_PLAYERS:
            return False
            
        if agent_id in self.factions:
            return False
            
        faction.owner_id = agent_id
        self.factions[agent_id] = faction
        self.player_turn_order.append(agent_id)
        
        # Place starting units
        self._place_starting_units(faction)
        
        self._log_event("faction_added", {
            "agent_id": agent_id,
            "faction_name": faction.name,
            "turn": self.turn_number
        })
        
        return True
    
    def _place_starting_units(self, faction: Faction) -> None:
        """Place initial units for a faction."""
        # Find a good starting position
        attempts = 0
        while attempts < 100:
            start_x = random.randint(2, self.map_width - 3)
            start_y = random.randint(2, self.map_height - 3)
            
            # Check if area is suitable (plains, no other units)
            suitable = True
            for dx in range(-1, 2):
                for dy in range(-1, 2):
                    tile = self.get_tile(start_x + dx, start_y + dy)
                    if (not tile or 
                        tile.terrain_type != TerrainType.PLAINS or
                        tile.unit_id is not None or
                        tile.building_id is not None):
                        suitable = False
                        break
                if not suitable:
                    break
            
            if suitable:
                # Create starting units
                from entities.unit import UnitType, UnitStats
                
                # Town center
                from entities.faction import Building, BuildingType
                town_center = Building(
                    name=f"{faction.name} Town Center",
                    building_type=BuildingType.TOWN_CENTER,
                    x=start_x,
                    y=start_y,
                    resource_generation={"gold": 10, "food": 5}
                )
                faction.add_building(town_center)
                self.get_tile(start_x, start_y).place_building(town_center.building_id)
                
                # Explorer unit
                explorer = Unit(
                    name=f"{faction.name} Explorer",
                    unit_type=UnitType.SUPPORT,
                    faction_id=faction.faction_id,
                    owner_id=faction.owner_id,
                    x=start_x + 1,
                    y=start_y + 1,
                    stats=UnitStats(30, 30, 5, 3, 3, sight_range=5)
                )
                faction.add_unit(explorer)
                self.get_tile(start_x + 1, start_y + 1).place_unit(explorer.unit_id)
                
                # Worker unit
                worker = Unit(
                    name=f"{faction.name} Settler",
                    unit_type=UnitType.WORKER,
                    faction_id=faction.faction_id,
                    owner_id=faction.owner_id,
                    x=start_x - 1,
                    y=start_y + 1,
                    stats=UnitStats(25, 25, 3, 2, 2)
                )
                faction.add_unit(worker)
                self.get_tile(start_x - 1, start_y + 1).place_unit(worker.unit_id)
                
                break
            
            attempts += 1
    
    def get_current_player(self) -> Optional[str]:
        """Get the agent ID of the current player."""
        
        if (self.phase == GamePhase.PLAYING and 
            0 <= self.current_player_index < len(self.player_turn_order)):
            return self.player_turn_order[self.current_player_index]
        return None
    
    def advance_turn(self) -> bool:
        """Advance to next player's turn or next round."""
        if self.phase != GamePhase.PLAYING:
            return False
            
        self.current_player_index += 1
        
        # If all players have played, advance turn number
        if self.current_player_index >= len(self.player_turn_order):
            self.current_player_index = 0
            self.turn_number += 1
            self._process_end_of_round()
            
        self.last_update_at = time.time()
        return True
    
    def _process_end_of_round(self) -> None:
        """Process end-of-round effects."""
        # Process each faction
        for faction in self.factions.values():
            faction.process_turn()
            
        # Update visibility (simplified - would be more complex in full implementation)
        self._update_visibility()
    
    def get_all_factions(self) -> Dict[str, Faction]:
        """Get all factions in the game."""
        return self.factions.copy()
    
    def is_faction_alive(self, agent_id: str) -> bool:
        """Check if a faction is still alive."""
        faction = self.factions.get(agent_id)
        return faction is not None and (len(faction.units) > 0 or len(faction.buildings) > 0)
    
    def check_victory_conditions(self) -> bool:
        """Check if victory conditions are met."""
        alive_factions = [f for f in self.factions.values() if self.is_faction_alive(f.owner_id)]
        return len(alive_factions) <= 1
    
    def get_winner(self) -> Optional[str]:
        """Get the winning faction ID if game is over."""
        alive_factions = [f for f in self.factions.values() if self.is_faction_alive(f.owner_id)]
        return alive_factions[0].owner_id if len(alive_factions) == 1 else None
        
        # Check victory conditions
        winner = self._check_victory_conditions()
        if winner:
            self.phase = GamePhase.ENDED
            self._log_event("game_ended", {
                "winner": winner,
                "turn": self.turn_number,
                "victory_type": "elimination"  # Would determine actual type
            })
    
    def _update_visibility(self) -> None:
        """Update tile visibility for all factions."""
        # Reset visibility
        for row in self.map_grid:
            for tile in row:
                for agent_id in self.factions.keys():
                    tile.set_visible(agent_id, False)
        
        # Set visibility based on unit sight ranges
        for faction in self.factions.values():
            for unit in faction.units:
                if unit.stats.health > 0:
                    self._reveal_area(unit.x, unit.y, unit.stats.sight_range, faction.owner_id)
    
    def _reveal_area(self, center_x: int, center_y: int, radius: int, agent_id: str) -> None:
        """Reveal tiles around a position."""
        for dx in range(-radius, radius + 1):
            for dy in range(-radius, radius + 1):
                if abs(dx) + abs(dy) <= radius:  # Manhattan distance
                    tile = self.get_tile(center_x + dx, center_y + dy)
                    if tile:
                        tile.set_visible(agent_id, True)
    
    def _check_victory_conditions(self) -> Optional[str]:
        """Check if any player has won."""
        active_factions = []
        for agent_id, faction in self.factions.items():
            # Faction is alive if it has any units or buildings
            if faction.units or faction.buildings:
                active_factions.append(agent_id)
        
        # Elimination victory
        if len(active_factions) == 1:
            return active_factions[0]
            
        # Time limit victory (if enabled)
        from config.game_config import MAX_TURNS
        if VictoryCondition.TIME_LIMIT in self.victory_conditions and self.turn_number >= MAX_TURNS:
            # Return faction with highest score
            best_faction = max(self.factions.items(), 
                             key=lambda x: x[1].get_total_military_strength())
            return best_faction[0]
        
        return None
    
    def get_agent_view(self, agent_id: str) -> Dict[str, Any]:
        """Get game state view for a specific agent (fog of war)."""
        faction = self.factions.get(agent_id)
        if not faction:
            return {}
        
        # Visible tiles only
        visible_tiles = []
        for row in self.map_grid:
            visible_row = []
            for tile in row:
                if tile.is_visible_to(agent_id) or tile.is_explored_by(agent_id):
                    visible_row.append(tile.to_dict())
                else:
                    # Unknown tile
                    visible_row.append({
                        "x": tile.x,
                        "y": tile.y,
                        "terrain_type": "unknown",
                        "explored": False
                    })
            visible_tiles.append(visible_row)
        
        # Visible enemy units (only if in sight range)
        visible_enemy_units = {}
        for other_agent_id, other_faction in self.factions.items():
            if other_agent_id != agent_id:
                visible_units = []
                for unit in other_faction.units:
                    tile = self.get_tile(unit.x, unit.y)
                    if tile and tile.is_visible_to(agent_id):
                        visible_units.append({
                            "unit_id": unit.unit_id,
                            "name": unit.name,
                            "unit_type": unit.unit_type.value,
                            "x": unit.x,
                            "y": unit.y,
                            "health": unit.stats.health,
                            "max_health": unit.stats.max_health
                        })
                visible_enemy_units[other_agent_id] = visible_units
        
        return {
            "game_id": self.game_id,
            "turn_number": self.turn_number,
            "phase": self.phase.value,
            "current_player": self.get_current_player(),
            "is_my_turn": self.get_current_player() == agent_id,
            "my_faction": faction.to_dict(),
            "visible_map": visible_tiles,
            "visible_enemies": visible_enemy_units,
            "victory_conditions": [vc.value for vc in self.victory_conditions],
            "balance_settings": {
                "unit_cost_multiplier": self.balance_settings.unit_cost_multiplier,
                "building_cost_multiplier": self.balance_settings.building_cost_multiplier,
                "resource_generation_rate": self.balance_settings.resource_generation_rate
            }
        }
    
    def _log_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Log a game event."""
        event = {
            "type": event_type,
            "timestamp": time.time(),
            "turn": self.turn_number,
            "data": data
        }
        self.event_log.append(event)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert game state to dictionary for serialization."""
        return {
            "game_id": self.game_id,
            "turn_number": self.turn_number,
            "phase": self.phase.value,
            "current_player_index": self.current_player_index,
            "map_grid": [[tile.to_dict() for tile in row] for row in self.map_grid],
            "map_width": self.map_width,
            "map_height": self.map_height,
            "factions": {agent_id: faction.to_dict() for agent_id, faction in self.factions.items()},
            "player_turn_order": self.player_turn_order,
            "balance_settings": {
                "unit_cost_multiplier": self.balance_settings.unit_cost_multiplier,
                "building_cost_multiplier": self.balance_settings.building_cost_multiplier,
                "resource_generation_rate": self.balance_settings.resource_generation_rate,
                "combat_damage_multiplier": self.balance_settings.combat_damage_multiplier,
                "movement_speed_multiplier": self.balance_settings.movement_speed_multiplier
            },
            "victory_conditions": [vc.value for vc in self.victory_conditions],
            "event_log": self.event_log[-50:],  # Keep last 50 events
            "game_started_at": self.game_started_at,
            "last_update_at": self.last_update_at
        }