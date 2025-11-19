"""Tests for unit production system."""
import unittest
import asyncio
from core.game_engine import GameEngine
from core.game_state import GameState
from entities.faction import Faction, Building, BuildingType
from agents.base_agent import AgentAction


class TestUnitProduction(unittest.TestCase):
    """Test instant unit production from buildings."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.game_state = GameState()
        self.faction = Faction(
            faction_id='test_faction',
            owner_id='agent1',
            name='Test Faction',
            resources={'gold': 500, 'wood': 300, 'food': 200}
        )
        
        # Add worker unit design
        self.faction.custom_unit_designs['worker'] = {
            'name': 'Worker',
            'unit_category': 'worker',
            'stats': {
                'health': 50,
                'attack': 5,
                'defense': 3,
                'movement_speed': 2
            },
            'abilities': ['gather'],
            'creation_cost': {'gold': 50}
        }
        
        # Add infantry unit design
        self.faction.custom_unit_designs['infantry'] = {
            'name': 'Infantry',
            'unit_category': 'infantry',
            'stats': {
                'health': 80,
                'attack': 15,
                'defense': 10,
                'movement_speed': 3
            },
            'abilities': [],
            'creation_cost': {'gold': 100, 'food': 25}
        }
        
        # Add town center building
        self.town_center = Building(
            name='Town Center',
            building_type=BuildingType.TOWN_CENTER,
            x=5,
            y=5,
            produces_units=['worker']
        )
        self.faction.add_building(self.town_center)
        self.game_state.factions['agent1'] = self.faction
        self.game_state.get_tile(5, 5).place_building(self.town_center.building_id)
        
        self.engine = GameEngine()
    
    def test_create_single_unit(self):
        """Test creating a single unit from building."""
        action = AgentAction(
            agent_id='agent1',
            action_type='create_unit',
            parameters={
                'building_id': self.town_center.building_id,
                'unit_type': 'worker',
                'quantity': 1
            },
            reasoning='Test single unit creation',
            timestamp=0.0
        )
        
        result = asyncio.run(self.engine._process_create_unit(action, self.game_state))
        
        self.assertTrue(result['success'])
        self.assertEqual(result['units_created'], 1)
        self.assertEqual(len(self.faction.units), 1)
        self.assertEqual(self.faction.resources['gold'], 450)  # 500 - 50
    
    def test_create_multiple_units(self):
        """Test creating multiple units at once."""
        action = AgentAction(
            agent_id='agent1',
            action_type='create_unit',
            parameters={
                'building_id': self.town_center.building_id,
                'unit_type': 'worker',
                'quantity': 3
            },
            reasoning='Test multiple unit creation',
            timestamp=0.0
        )
        
        result = asyncio.run(self.engine._process_create_unit(action, self.game_state))
        
        self.assertTrue(result['success'])
        self.assertEqual(result['units_created'], 3)
        self.assertEqual(len(self.faction.units), 3)
        self.assertEqual(self.faction.resources['gold'], 350)  # 500 - 150
    
    def test_insufficient_resources(self):
        """Test that production fails with insufficient resources."""
        action = AgentAction(
            agent_id='agent1',
            action_type='create_unit',
            parameters={
                'building_id': self.town_center.building_id,
                'unit_type': 'worker',
                'quantity': 20  # Need 1000 gold
            },
            reasoning='Test insufficient resources',
            timestamp=0.0
        )
        
        result = asyncio.run(self.engine._process_create_unit(action, self.game_state))
        
        self.assertFalse(result['success'])
        self.assertIn('Insufficient resources', result['error'])
        self.assertEqual(len(self.faction.units), 0)
        self.assertEqual(self.faction.resources['gold'], 500)  # No change
    
    def test_multiple_resource_cost(self):
        """Test unit with multiple resource costs."""
        # Add barracks
        barracks = Building(
            name='Barracks',
            building_type=BuildingType.BARRACKS,
            x=7,
            y=7,
            produces_units=['infantry']
        )
        self.faction.add_building(barracks)
        self.game_state.get_tile(7, 7).place_building(barracks.building_id)
        
        action = AgentAction(
            agent_id='agent1',
            action_type='create_unit',
            parameters={
                'building_id': barracks.building_id,
                'unit_type': 'infantry',
                'quantity': 2
            },
            reasoning='Test multiple resource cost',
            timestamp=0.0
        )
        
        result = asyncio.run(self.engine._process_create_unit(action, self.game_state))
        
        self.assertTrue(result['success'])
        self.assertEqual(result['units_created'], 2)
        self.assertEqual(self.faction.resources['gold'], 300)  # 500 - 200
        self.assertEqual(self.faction.resources['food'], 150)  # 200 - 50
    
    def test_unit_spawn_locations(self):
        """Test that units spawn in adjacent tiles, not on building."""
        action = AgentAction(
            agent_id='agent1',
            action_type='create_unit',
            parameters={
                'building_id': self.town_center.building_id,
                'unit_type': 'worker',
                'quantity': 3
            },
            reasoning='Test spawn locations',
            timestamp=0.0
        )
        
        result = asyncio.run(self.engine._process_create_unit(action, self.game_state))
        
        self.assertTrue(result['success'])
        
        # Check no unit is on the building tile
        for unit in self.faction.units:
            self.assertNotEqual((unit.x, unit.y), (self.town_center.x, self.town_center.y),
                              "Unit should not spawn on building tile")
        
        # Check no overlaps
        positions = [(u.x, u.y) for u in self.faction.units]
        self.assertEqual(len(positions), len(set(positions)), "Units should not overlap")
        
        # Check units are adjacent to building (within 1 tile)
        for unit in self.faction.units:
            dx = abs(unit.x - self.town_center.x)
            dy = abs(unit.y - self.town_center.y)
            self.assertTrue(dx <= 1 and dy <= 1, "Unit should be adjacent to building")
            self.assertFalse(dx == 0 and dy == 0, "Unit should not be on building")
    
    def test_tile_consistency(self):
        """Test that tiles correctly reference spawned units."""
        action = AgentAction(
            agent_id='agent1',
            action_type='create_unit',
            parameters={
                'building_id': self.town_center.building_id,
                'unit_type': 'worker',
                'quantity': 2
            },
            reasoning='Test tile consistency',
            timestamp=0.0
        )
        
        result = asyncio.run(self.engine._process_create_unit(action, self.game_state))
        
        self.assertTrue(result['success'])
        
        for unit in self.faction.units:
            tile = self.game_state.get_tile(unit.x, unit.y)
            self.assertEqual(tile.unit_id, unit.unit_id, "Tile should reference correct unit")
            self.assertIsNone(tile.building_id, "Unit should not be on building tile")
    
    def test_building_not_found(self):
        """Test that invalid building ID returns error."""
        action = AgentAction(
            agent_id='agent1',
            action_type='create_unit',
            parameters={
                'building_id': 'invalid_id',
                'unit_type': 'worker',
                'quantity': 1
            },
            reasoning='Test invalid building',
            timestamp=0.0
        )
        
        result = asyncio.run(self.engine._process_create_unit(action, self.game_state))
        
        self.assertFalse(result['success'])
        self.assertIn('Building not found', result['error'])
    
    def test_unit_type_not_producible(self):
        """Test that building cannot produce invalid unit type."""
        action = AgentAction(
            agent_id='agent1',
            action_type='create_unit',
            parameters={
                'building_id': self.town_center.building_id,
                'unit_type': 'cavalry',  # Town center only produces workers
                'quantity': 1
            },
            reasoning='Test invalid unit type',
            timestamp=0.0
        )
        
        result = asyncio.run(self.engine._process_create_unit(action, self.game_state))
        
        self.assertFalse(result['success'])
        self.assertIn('cannot produce', result['error'].lower())
    
    def test_unit_design_not_found(self):
        """Test that missing unit design returns error."""
        action = AgentAction(
            agent_id='agent1',
            action_type='create_unit',
            parameters={
                'building_id': self.town_center.building_id,
                'unit_type': 'dragon',  # Not in custom_unit_designs
                'quantity': 1
            },
            reasoning='Test missing unit design',
            timestamp=0.0
        )
        
        result = asyncio.run(self.engine._process_create_unit(action, self.game_state))
        
        self.assertFalse(result['success'])
        # Can fail for either "cannot produce" or "not found"
        self.assertTrue(
            'cannot produce' in result['error'].lower() or 'not found' in result['error'].lower()
        )


if __name__ == '__main__':
    unittest.main()
