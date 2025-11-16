"""Tests for game state management."""
import unittest
from unittest.mock import Mock, patch, MagicMock
import json
import random

from test_config import *

from core.game_state import GameState, GamePhase
from entities.faction import Faction, FactionTheme
from entities.unit import Unit, UnitType, UnitStats
from entities.tile import TerrainType

class TestGameState(unittest.TestCase):
    """Test GameState class functionality."""
    
    def setUp(self):
        """Set up test game state."""
        random.seed(42)  # For reproducible terrain generation
        self.game_state = GameState(
            game_id="test_game",
            map_width=10,
            map_height=10
        )
    
    def test_game_state_initialization(self):
        """Test game state initializes correctly."""
        self.assertEqual(self.game_state.game_id, "test_game")
        self.assertEqual(self.game_state.turn_number, 0)
        self.assertEqual(self.game_state.phase, GamePhase.SETUP)
        self.assertEqual(self.game_state.map_width, 10)
        self.assertEqual(self.game_state.map_height, 10)
        self.assertEqual(len(self.game_state.map_grid), 10)
        self.assertEqual(len(self.game_state.map_grid[0]), 10)
    
    def test_map_generation(self):
        """Test map generation creates valid terrain."""
        # Check all tiles are valid
        for row in self.game_state.map_grid:
            for tile in row:
                self.assertIsNotNone(tile.terrain_type)
                self.assertTrue(0 <= tile.x < 10)
                self.assertTrue(0 <= tile.y < 10)
    
    def test_tile_access(self):
        """Test tile access methods."""
        # Valid coordinates
        tile = self.game_state.get_tile(5, 5)
        self.assertIsNotNone(tile)
        self.assertEqual(tile.x, 5)
        self.assertEqual(tile.y, 5)
        
        # Invalid coordinates
        self.assertIsNone(self.game_state.get_tile(-1, -1))
        self.assertIsNone(self.game_state.get_tile(15, 15))
    
    def test_faction_management(self):
        """Test adding and managing factions."""
        theme = FactionTheme(
            name="Test Empire",
            description="A test faction",
            color_scheme=["#FF0000"],
            architectural_style="medieval",
            unit_naming_convention="Roman"
        )
        
        faction = Faction(
            name="Test Empire",
            theme=theme,
            owner_id="test_agent_1"
        )
        
        # Add faction
        self.assertTrue(self.game_state.add_faction("test_agent_1", faction))
        self.assertEqual(len(self.game_state.factions), 1)
        self.assertIn("test_agent_1", self.game_state.player_turn_order)
        
        # Faction should have starting units and buildings
        self.assertGreater(len(faction.units), 0)
        self.assertGreater(len(faction.buildings), 0)
        
        # Can't add same agent twice
        faction2 = Faction(name="Second Faction", owner_id="test_agent_1")
        self.assertFalse(self.game_state.add_faction("test_agent_1", faction2))
    
    def test_turn_management(self):
        """Test turn advancement and player rotation."""
        # Add some factions
        for i, agent_id in enumerate(TEST_AGENT_IDS[:3]):
            faction = Faction(name=f"Faction {i}", owner_id=agent_id)
            #add some units so they are not eliminated immediately
            unit = Unit(
                name=f"Unit {i}",
                unit_type=UnitType.WORKER,
                faction_id=faction.faction_id,
                owner_id=agent_id,
                x=0,
                y=0,
                stats=UnitStats(25, 25, 3, 2, 2)
            )
            faction.add_unit(unit)
            success = self.game_state.add_faction(agent_id, faction)
            self.assertTrue(success, f"Failed to add faction for {agent_id}")
        
        # Verify factions were added
        self.assertEqual(len(self.game_state.factions), 3)
        self.assertEqual(len(self.game_state.player_turn_order), 3)
        
        # Set to playing phase
        self.game_state.phase = GamePhase.PLAYING
        
        # Store result and test immediately - ONLY THIS FIRST
        current_player = self.game_state.get_current_player()
        self.assertIsNotNone(current_player, f"get_current_player returned None - phase: {self.game_state.phase}, index: {self.game_state.current_player_index}, order: {self.game_state.player_turn_order}")
        self.assertEqual(current_player, TEST_AGENT_IDS[0])
        
        # Test turn advancement
        print(f"Initial current player: {self.game_state.get_current_player()}")
        self.assertTrue(self.game_state.advance_turn())
        self.assertEqual(self.game_state.get_current_player(), TEST_AGENT_IDS[1])
        
        self.assertTrue(self.game_state.advance_turn())
        self.assertEqual(self.game_state.get_current_player(), TEST_AGENT_IDS[2])
        
        # Should cycle back to first player and advance turn number
        initial_turn = self.game_state.turn_number
        self.assertTrue(self.game_state.advance_turn())
        self.assertEqual(self.game_state.get_current_player(), TEST_AGENT_IDS[0])
        self.assertEqual(self.game_state.turn_number, initial_turn + 1)
    
    def test_agent_view(self):
        """Test agent-specific game state views with fog of war."""
        # Add faction
        faction = Faction(name="Test Faction", owner_id="test_agent_1")
        self.game_state.add_faction("test_agent_1", faction)
        
        # Get agent view
        view = self.game_state.get_agent_view("test_agent_1")
        
        self.assertEqual(view["game_id"], "test_game")
        self.assertIn("my_faction", view)
        self.assertIn("visible_map", view)
        self.assertIn("visible_enemies", view)
        self.assertEqual(view["my_faction"]["name"], "Test Faction")
    
    def test_visibility_system(self):
        """Test visibility and fog of war updates."""
        # Add faction with units
        faction = Faction(name="Test Faction", owner_id="test_agent_1")
        self.game_state.add_faction("test_agent_1", faction)
        
        # Get a unit from the faction
        if faction.units:
            unit = faction.units[0]
            
            # Update visibility
            self.game_state._update_visibility()
            
            # Check that tiles around unit are visible
            center_tile = self.game_state.get_tile(unit.x, unit.y)
            if center_tile:
                self.assertTrue(center_tile.is_visible_to("test_agent_1"))
    
    def test_victory_conditions(self):
        """Test victory condition checking."""
        # Add two factions with initial units to avoid elimination
        faction1 = Faction(name="Faction 1", owner_id="agent_1")
        faction2 = Faction(name="Faction 2", owner_id="agent_2")
        
        # Add initial units so factions are not immediately eliminated
        unit1 = Unit(unit_id="unit1", name="Warrior1", faction_id="agent_1", x=5, y=5)
        unit2 = Unit(unit_id="unit2", name="Warrior2", faction_id="agent_2", x=10, y=10)
        faction1.add_unit(unit1)
        faction2.add_unit(unit2)
        
        self.game_state.add_faction("agent_1", faction1)
        self.game_state.add_faction("agent_2", faction2)
        
        # No winner initially (both have units/buildings)
        winner = self.game_state._check_victory_conditions()
        self.assertIsNone(winner)
        
        # Eliminate one faction's units and buildings
        faction2.units.clear()
        faction2.buildings.clear()
        
        winner = self.game_state._check_victory_conditions()
        self.assertEqual(winner, "agent_1")
    
    def test_game_state_serialization(self):
        """Test game state serialization."""
        # Add some content
        faction = Faction(name="Test Faction", owner_id="test_agent")
        self.game_state.add_faction("test_agent", faction)
        
        # Serialize
        state_dict = self.game_state.to_dict()
        
        # Check essential data is present
        self.assertEqual(state_dict["game_id"], "test_game")
        self.assertEqual(state_dict["phase"], "setup")
        self.assertIn("factions", state_dict)
        self.assertIn("map_grid", state_dict)
        self.assertEqual(len(state_dict["map_grid"]), 10)
    
    def test_resource_node_generation(self):
        """Test that map generation includes resource nodes."""
        resource_count = 0
        for row in self.game_state.map_grid:
            for tile in row:
                if tile.resource_type:
                    resource_count += 1
        
        # Should have some resources on the map
        self.assertGreater(resource_count, 0)
    
    def test_faction_starting_positions(self):
        """Test that factions get valid starting positions."""
        faction = Faction(name="Test Faction", owner_id="test_agent")
        self.game_state.add_faction("test_agent", faction)
        
        # Should have starting units
        self.assertGreater(len(faction.units), 0)
        
        # Units should be on valid tiles
        for unit in faction.units:
            tile = self.game_state.get_tile(unit.x, unit.y)
            self.assertIsNotNone(tile)
            self.assertEqual(tile.unit_id, unit.unit_id)
        
        # Should have starting buildings
        self.assertGreater(len(faction.buildings), 0)
        
        # Buildings should be on valid tiles
        for building in faction.buildings:
            tile = self.game_state.get_tile(building.x, building.y)
            self.assertIsNotNone(tile)
            self.assertEqual(tile.building_id, building.building_id)

class TestGameStateIntegration(unittest.TestCase):
    """Integration tests for game state with multiple components."""
    
    def setUp(self):
        """Set up complex test scenario."""
        random.seed(123)
        self.game_state = GameState(game_id="integration_test", map_width=15, map_height=15)
        
        # Add multiple factions
        self.factions = {}
        for i, agent_id in enumerate(TEST_AGENT_IDS):
            faction = Faction(
                name=TEST_FACTION_NAMES[i],
                owner_id=agent_id
            )
            
            # Add initial units so factions aren't immediately eliminated
            unit = Unit(
                unit_id=f"initial_unit_{i}",
                name=f"Starting Warrior {i}",
                faction_id=agent_id,
                x=i*3, y=i*3  # Spread out starting positions
            )
            faction.add_unit(unit)
            
            self.game_state.add_faction(agent_id, faction)
            self.factions[agent_id] = faction
    
    def test_multiplayer_setup(self):
        """Test setup with multiple factions."""
        self.assertEqual(len(self.game_state.factions), 4)
        self.assertEqual(len(self.game_state.player_turn_order), 4)
        
        # Each faction should have starting units (we added them in setUp)
        for faction in self.factions.values():
            self.assertGreater(len(faction.units), 0)
    
    def test_turn_rotation_with_multiple_players(self):
        """Test turn rotation with multiple players."""
        self.game_state.phase = GamePhase.PLAYING
        
        # Ensure turn order is properly set up
        if not self.game_state.player_turn_order:
            self.game_state.player_turn_order = TEST_AGENT_IDS.copy()
            self.game_state.current_player_index = 0
        
        # Rotate through all players multiple times
        for round_num in range(3):
            for i, expected_agent in enumerate(TEST_AGENT_IDS):
                current_player = self.game_state.get_current_player()
                self.assertEqual(current_player, expected_agent)
                
                if i < len(TEST_AGENT_IDS) - 1:
                    # Not the last player in round
                    self.game_state.advance_turn()
                    self.assertEqual(self.game_state.turn_number, round_num)
                else:
                    # Last player - should advance turn number
                    initial_turn = self.game_state.turn_number
                    self.game_state.advance_turn()
                    self.assertEqual(self.game_state.turn_number, initial_turn + 1)
    
    def test_fog_of_war_between_factions(self):
        """Test fog of war isolation between factions."""
        agent1 = TEST_AGENT_IDS[0]
        agent2 = TEST_AGENT_IDS[1]
        
        # Get views for different agents
        view1 = self.game_state.get_agent_view(agent1)
        view2 = self.game_state.get_agent_view(agent2)
        
        # Should have different faction data
        self.assertNotEqual(view1["my_faction"]["name"], view2["my_faction"]["name"])
        
        # Should have visibility only around their own units
        # (This would be more testable with specific unit positioning)
        self.assertIn("visible_enemies", view1)
        self.assertIn("visible_enemies", view2)
    
    def test_game_progression_simulation(self):
        """Test a short game progression simulation."""
        self.game_state.phase = GamePhase.PLAYING
        
        # Simulate several turns
        for turn in range(5):
            initial_turn = self.game_state.turn_number
            
            # Each player takes a turn
            for player_index in range(len(TEST_AGENT_IDS)):
                current_player = self.game_state.get_current_player()
                self.assertIsNotNone(current_player)
                
                # Get player's view
                view = self.game_state.get_agent_view(current_player)
                self.assertTrue(view["is_my_turn"])
                
                # Advance turn
                self.game_state.advance_turn()
            
            # Turn number should have advanced
            self.assertEqual(self.game_state.turn_number, initial_turn + 1)
        
        # Game should still be in progress
        self.assertEqual(self.game_state.phase, GamePhase.PLAYING)
        winner = self.game_state._check_victory_conditions()
        self.assertIsNone(winner)  # No one should have won yet

if __name__ == "__main__":
    unittest.main()