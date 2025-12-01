"""Tests for game entities: Unit, Faction, Tile, Sprite."""
import unittest
from unittest.mock import Mock, patch
import json

from test_config import *

from entities.sprite import Sprite, SpriteTemplate
from entities.unit import Unit, UnitType, UnitStats, UnitAbility
from entities.faction import Faction, FactionTheme, Building, BuildingType
from entities.tile import Tile, TerrainType

class TestSprite(unittest.TestCase):
    """Test Sprite class functionality."""
    
    def setUp(self):
        """Set up test sprites."""
        self.test_sprite = Sprite(
            name="test_sprite",
            description="A test sprite",
            creator_agent_id="test_agent"
        )
    
    def test_sprite_initialization(self):
        """Test sprite initializes with correct dimensions."""
        self.assertEqual(len(self.test_sprite.pixel_data), 16)
        self.assertEqual(len(self.test_sprite.pixel_data[0]), 16)
        self.assertTrue(self.test_sprite.validation_hash)
    
    def test_sprite_pixel_operations(self):
        """Test pixel get/set operations."""
        # Test setting pixel
        self.test_sprite.set_pixel(5, 5, "#")
        self.assertEqual(self.test_sprite.get_pixel(5, 5), "#")
        
        # Test bounds checking
        self.assertEqual(self.test_sprite.get_pixel(-1, -1), ".")
        self.assertEqual(self.test_sprite.get_pixel(20, 20), ".")
    
    def test_sprite_to_ascii(self):
        """Test ASCII representation generation."""
        self.test_sprite.set_pixel(0, 0, "X")
        ascii_repr = self.test_sprite.to_ascii()
        self.assertIn("X", ascii_repr)
        self.assertEqual(ascii_repr.count("\n"), 15)  # 16 rows, 15 newlines
    
    def test_sprite_validation(self):
        """Test sprite integrity validation."""
        self.assertTrue(self.test_sprite.validate_integrity())
        
        # Corrupt the data and test
        original_hash = self.test_sprite.validation_hash
        self.test_sprite.pixel_data[0][0] = "X"
        self.assertNotEqual(self.test_sprite.validation_hash, original_hash)
    
    def test_sprite_serialization(self):
        """Test sprite to/from dictionary conversion."""
        sprite_dict = self.test_sprite.to_dict()
        restored_sprite = Sprite.from_dict(sprite_dict)
        
        self.assertEqual(self.test_sprite.name, restored_sprite.name)
        self.assertEqual(self.test_sprite.description, restored_sprite.description)
        self.assertEqual(self.test_sprite.pixel_data, restored_sprite.pixel_data)

class TestUnit(unittest.TestCase):
    """Test Unit class functionality."""
    
    def setUp(self):
        """Set up test units."""
        self.unit_stats = UnitStats(50, 50, 15, 10, 3)
        self.test_unit = Unit(
            unit_id="test_unit_1",
            name="Test Warrior",
            unit_type=UnitType.INFANTRY,
            faction_id="test_faction",
            stats=self.unit_stats,
            x=5,
            y=5
        )
    
    def test_unit_initialization(self):
        """Test unit initializes correctly."""
        self.assertEqual(self.test_unit.name, "Test Warrior")
        self.assertEqual(self.test_unit.unit_type, UnitType.INFANTRY)
        self.assertEqual(self.test_unit.x, 5)
        self.assertEqual(self.test_unit.y, 5)
        self.assertFalse(self.test_unit.has_moved)
        self.assertFalse(self.test_unit.has_attacked)
    
    def test_unit_movement(self):
        """Test unit movement mechanics."""
        # Valid movement
        self.assertTrue(self.test_unit.move_to(6, 7))
        self.assertEqual(self.test_unit.x, 6)
        self.assertEqual(self.test_unit.y, 7)
        self.assertTrue(self.test_unit.has_moved)
        
        # Can't move again this turn
        self.assertFalse(self.test_unit.move_to(8, 8))
        
        # Reset turn and try again
        self.test_unit.reset_turn()
        self.assertFalse(self.test_unit.has_moved)
        self.assertTrue(self.test_unit.move_to(8, 8))
    
    def test_unit_combat(self):
        """Test unit combat mechanics."""
        # Create enemy unit within range - test unit is at (5,5) with range 3
        enemy = Unit(
            unit_id="enemy_unit_1",
            name="Enemy Unit",
            stats=UnitStats(30, 30, 8, 5, 2),
            x=6, y=5  # Adjacent position
        )
        
        # Verify test unit can attack initially
        self.assertFalse(self.test_unit.has_attacked)
        self.assertTrue(self.test_unit.can_attack())
        
        # Attack enemy
        result = self.test_unit.attack(enemy)
        self.assertTrue(result["success"])
        self.assertGreater(result["damage_dealt"], 0)
        self.assertLess(enemy.stats.health, 30)
        self.assertTrue(self.test_unit.has_attacked)
        
        # Can't attack again this turn
        result2 = self.test_unit.attack(enemy)
        self.assertFalse(result2["success"])
    
    def test_unit_experience_system(self):
        """Test unit experience and leveling."""
        initial_health = self.test_unit.stats.max_health
        initial_attack = self.test_unit.stats.attack
        
        # Gain enough experience to level up
        self.test_unit.gain_experience(150)
        
        self.assertGreater(self.test_unit.veterancy_level, 0)
        self.assertGreater(self.test_unit.stats.max_health, initial_health)
        self.assertGreater(self.test_unit.stats.attack, initial_attack)
    
    def test_unit_serialization(self):
        """Test unit serialization."""
        unit_dict = self.test_unit.to_dict()
        
        self.assertEqual(unit_dict["name"], "Test Warrior")
        self.assertEqual(unit_dict["unit_type"], "infantry")
        self.assertEqual(unit_dict["x"], 5)
        self.assertEqual(unit_dict["y"], 5)

class TestFaction(unittest.TestCase):
    """Test Faction class functionality."""
    
    def setUp(self):
        """Set up test faction."""
        self.theme = FactionTheme(
            name="Test Empire",
            description="A test faction",
            color_scheme=["#FF0000", "#800000"],
            architectural_style="medieval",
            unit_naming_convention="Roman names"
        )
        
        self.faction = Faction(
            name="Test Empire",
            theme=self.theme,
            owner_id="test_agent"
        )
    
    def test_faction_initialization(self):
        """Test faction initializes correctly."""
        self.assertEqual(self.faction.name, "Test Empire")
        self.assertEqual(self.faction.owner_id, "test_agent")
        self.assertEqual(self.faction.resources["gold"], 500)
        self.assertEqual(len(self.faction.units), 0)
        self.assertEqual(len(self.faction.buildings), 0)
    
    def test_faction_resource_management(self):
        """Test resource spending and gaining."""
        initial_gold = self.faction.resources["gold"]
        
        # Test spending
        costs = {"gold": 100, "wood": 50}
        self.assertTrue(self.faction.can_afford(costs))
        self.assertTrue(self.faction.spend_resources(costs))
        self.assertEqual(self.faction.resources["gold"], initial_gold - 100)
        
        # Test insufficient resources
        big_costs = {"gold": 10000}
        self.assertFalse(self.faction.can_afford(big_costs))
        self.assertFalse(self.faction.spend_resources(big_costs))
        
        # Test gaining resources
        gained = {"gold": 200, "food": 100}
        self.faction.add_resources(gained)
        self.assertEqual(self.faction.resources["food"], 300)  # 200 initial + 100
    
    def test_faction_unit_management(self):
        """Test adding and removing units."""
        test_unit = Unit(name="Test Unit", faction_id=self.faction.faction_id)
        
        # Add unit
        self.assertTrue(self.faction.add_unit(test_unit))
        self.assertEqual(len(self.faction.units), 1)
        self.assertEqual(test_unit.faction_id, self.faction.faction_id)
        self.assertEqual(self.faction.units_created, 1)
        
        # Remove unit
        self.assertTrue(self.faction.remove_unit(test_unit.unit_id))
        self.assertEqual(len(self.faction.units), 0)
        self.assertEqual(self.faction.units_lost, 1)
    
    def test_faction_building_management(self):
        """Test building management."""
        from entities.faction import Building, BuildingType
        
        test_building = Building(
            name="Test Building",
            building_type=BuildingType.BARRACKS,
            resource_generation={"gold": 5}
        )
        
        # Add building
        self.assertTrue(self.faction.add_building(test_building))
        self.assertEqual(len(self.faction.buildings), 1)
        self.assertEqual(self.faction.buildings_constructed, 1)
    
    def test_faction_turn_processing(self):
        """Test end-of-turn processing."""
        from entities.faction import Building, BuildingType
        
        # Add resource-generating building
        building = Building(
            name="Mine",
            building_type=BuildingType.MINE,
            resource_generation={"gold": 10, "stone": 5}
        )
        self.faction.add_building(building)
        
        initial_gold = self.faction.resources["gold"]
        initial_stone = self.faction.resources["stone"]
        
        # Process turn
        self.faction.process_turn()
        
        # Check resources were generated
        self.assertEqual(self.faction.resources["gold"], initial_gold + 10)
        self.assertEqual(self.faction.resources["stone"], initial_stone + 5)

class TestTile(unittest.TestCase):
    """Test Tile class functionality."""
    
    def setUp(self):
        """Set up test tiles."""
        self.plains_tile = Tile(5, 5, TerrainType.PLAINS)
        self.water_tile = Tile(0, 0, TerrainType.WATER)
        self.mountain_tile = Tile(10, 10, TerrainType.MOUNTAIN)
    
    def test_tile_initialization(self):
        """Test tile initializes correctly."""
        self.assertEqual(self.plains_tile.x, 5)
        self.assertEqual(self.plains_tile.y, 5)
        self.assertEqual(self.plains_tile.terrain_type, TerrainType.PLAINS)
        self.assertTrue(self.plains_tile.is_passable)
        self.assertEqual(self.plains_tile.movement_cost, 1)
    
    def test_tile_terrain_properties(self):
        """Test terrain-specific properties."""
        # Water should be impassable
        self.assertFalse(self.water_tile.is_passable)
        
        # Mountain should have higher movement cost
        self.assertEqual(self.mountain_tile.movement_cost, 3)
        self.assertTrue(self.mountain_tile.is_passable)
    
    def test_tile_occupancy(self):
        """Test unit and building placement."""
        # Test unit placement
        self.assertTrue(self.plains_tile.can_place_unit())
        self.assertTrue(self.plains_tile.place_unit("unit_123"))
        self.assertEqual(self.plains_tile.unit_id, "unit_123")
        self.assertFalse(self.plains_tile.can_place_unit())  # Already occupied
        
        # Remove unit
        removed_id = self.plains_tile.remove_unit()
        self.assertEqual(removed_id, "unit_123")
        self.assertIsNone(self.plains_tile.unit_id)
        
        # Test building placement
        self.assertTrue(self.plains_tile.can_place_building())
        self.assertTrue(self.plains_tile.place_building("building_456"))
        self.assertEqual(self.plains_tile.building_id, "building_456")
    
    def test_tile_visibility(self):
        """Test fog of war mechanics."""
        agent_id = "test_agent"
        
        # Initially not explored or visible
        self.assertFalse(self.plains_tile.is_explored_by(agent_id))
        self.assertFalse(self.plains_tile.is_visible_to(agent_id))
        
        # Set visible (should also mark as explored)
        self.plains_tile.set_visible(agent_id, True)
        self.assertTrue(self.plains_tile.is_visible_to(agent_id))
        self.assertTrue(self.plains_tile.is_explored_by(agent_id))
        
        # Remove visibility but keep explored
        self.plains_tile.set_visible(agent_id, False)
        self.assertFalse(self.plains_tile.is_visible_to(agent_id))
        self.assertTrue(self.plains_tile.is_explored_by(agent_id))
    
    def test_tile_serialization(self):
        """Test tile serialization."""
        self.plains_tile.resource_type = "gold"
        self.plains_tile.resource_amount = 100
        self.plains_tile.set_explored("agent1", True)
        
        tile_dict = self.plains_tile.to_dict()
        restored_tile = Tile.from_dict(tile_dict)
        
        self.assertEqual(restored_tile.x, 5)
        self.assertEqual(restored_tile.y, 5)
        self.assertEqual(restored_tile.terrain_type, TerrainType.PLAINS)
        self.assertEqual(restored_tile.resource_type, "gold")
        self.assertEqual(restored_tile.resource_amount, 100)
        self.assertTrue(restored_tile.is_explored_by("agent1"))

if __name__ == "__main__":
    unittest.main()