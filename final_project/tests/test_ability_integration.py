"""Test ability system integration and detection."""
import unittest
from entities.unit import Unit, UnitStats, UnitType
from entities.faction import Faction, FactionTheme, Building, BuildingType
from core.game_state import GameState
from abilities import ABILITY_REGISTRY, AbilityContext

class TestAbilityIntegration(unittest.TestCase):
    """Test that abilities are properly detected and applied."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.game_state = GameState(map_width=20, map_height=20)
        
        # Create test faction
        self.faction = Faction(
            owner_id="test_player",
            name="Test Faction",
            theme=FactionTheme(
                name="Test",
                description="Test faction",
                color_scheme=["#FF0000"],
                architectural_style="medieval",
                unit_naming_convention="Test"
            )
        )
        self.game_state.add_faction("test_player", self.faction)
    
    def test_charge_ability_detected(self):
        """Test that charge ability is detected and applied in combat."""
        attacker = Unit(
            name="Cavalry",
            unit_type=UnitType.CAVALRY,
            stats=UnitStats(50, 50, 20, 5, 3),
            abilities={"charge"}  # String-based ability
        )
        attacker.x, attacker.y = 5, 5
        attacker.has_moved = True  # Moved this turn
        
        target = Unit(
            name="Infantry",
            unit_type=UnitType.INFANTRY,
            stats=UnitStats(50, 50, 10, 10, 2)
        )
        target.x, target.y = 6, 5
        
        result = attacker.attack(target, self.game_state)
        
        self.assertTrue(result["success"])
        # Base damage 20 - defense 10 = 10, with charge +25% = 12.5 -> 12
        # Should be more than base damage
        self.assertGreater(result["damage_dealt"], 10)
    
    def test_fortify_ability_detected(self):
        """Test that fortify ability increases defense."""
        unit = Unit(
            name="Pikeman",
            unit_type=UnitType.INFANTRY,
            stats=UnitStats(60, 60, 15, 10, 2),
            abilities={"fortify"}
        )
        unit.has_moved = False
        
        # Fortify the unit
        fortified = unit.fortify()
        self.assertTrue(fortified)
        self.assertTrue(unit.is_fortified)
        
        # Attack fortified unit
        attacker = Unit(
            name="Attacker",
            unit_type=UnitType.INFANTRY,
            stats=UnitStats(50, 50, 20, 5, 3)
        )
        attacker.x, attacker.y = 5, 5
        unit.x, unit.y = 6, 5
        
        result = attacker.attack(unit, self.game_state)
        
        # Fortified defense should be 10 * 1.5 = 15
        # Damage should be reduced: 20 - 15 = 5
        self.assertEqual(result["damage_dealt"], 5)
    
    def test_stealth_ability_in_game_state(self):
        """Test that stealth units are hidden from enemy vision."""
        # Create two factions
        enemy_faction = Faction(
            owner_id="enemy_player",
            name="Enemy Faction"
        )
        self.game_state.add_faction("enemy_player", enemy_faction)
        
        # Clear any default units
        self.faction.units.clear()
        enemy_faction.units.clear()
        
        # Create stealthed unit for test_player
        stealthy = Unit(
            name="Assassin",
            unit_type=UnitType.INFANTRY,
            stats=UnitStats(40, 40, 25, 5, 3, sight_range=4),
            abilities={"stealth"}
        )
        stealthy.x, stealthy.y = 10, 10
        self.faction.add_unit(stealthy)
        
        # Create enemy unit with sight
        scout = Unit(
            name="Scout",
            unit_type=UnitType.INFANTRY,
            stats=UnitStats(30, 30, 5, 3, 3, sight_range=5),
            abilities=set()
        )
        scout.x, scout.y = 12, 10  # Distance 2 from stealthy
        enemy_faction.add_unit(scout)
        
        # Update visibility
        self.game_state._update_visibility()
        
        # Get enemy view
        enemy_view = self.game_state.get_agent_view("enemy_player")
        
        # Stealthy unit should NOT be visible (distance 2, not adjacent)
        test_faction_units = enemy_view["visible_enemies"].get("test_player", [])
        self.assertEqual(len(test_faction_units), 0, 
                        "Stealthed unit should not be visible from distance 2")
    
    def test_stealth_visible_when_adjacent(self):
        """Test that stealth units are visible when adjacent."""
        enemy_faction = Faction(
            owner_id="enemy_player",
            name="Enemy Faction"
        )
        self.game_state.add_faction("enemy_player", enemy_faction)
        
        # Clear default units
        self.faction.units.clear()
        enemy_faction.units.clear()
        
        # Stealthed unit
        stealthy = Unit(
            name="Assassin",
            abilities={"stealth"}
        )
        stealthy.x, stealthy.y = 10, 10
        self.faction.add_unit(stealthy)
        
        # Adjacent enemy
        scout = Unit(
            name="Scout",
            stats=UnitStats(30, 30, 5, 3, 3, sight_range=5)
        )
        scout.x, scout.y = 11, 10  # Distance 1 (adjacent)
        enemy_faction.add_unit(scout)
        
        self.game_state._update_visibility()
        enemy_view = self.game_state.get_agent_view("enemy_player")
        
        # Should be visible when adjacent
        test_faction_units = enemy_view["visible_enemies"].get("test_player", [])
        self.assertEqual(len(test_faction_units), 1,
                        "Stealthed unit should be visible when adjacent")
    
    def test_heal_ability_execution(self):
        """Test that heal ability works via registry."""
        healer = Unit(
            name="Medic",
            abilities={"heal"}
        )
        
        wounded = Unit(
            name="Wounded Soldier",
            stats=UnitStats(100, 100, 10, 5, 2)
        )
        wounded.stats.health = 50  # Wounded
        
        # Execute heal ability
        context = AbilityContext(
            owner=healer,
            target=wounded,
            action_type="heal"
        )
        
        results = ABILITY_REGISTRY.execute_abilities(["heal"], context)
        
        self.assertIn("heal", results["applied"])
        self.assertGreater(wounded.stats.health, 50)
        self.assertLessEqual(wounded.stats.health, 65)  # 50 + 15 = 65
    
    def test_building_resource_bonus_ability(self):
        """Test that building resource bonus ability increases generation."""
        building = Building(
            name="Enhanced Farm",
            building_type=BuildingType.FARM,
            resource_generation={"food": 10},
            abilities={"resource_bonus"}
        )
        building.is_construction_complete = True
        
        # Generate resources with ability bonus
        resources = building.generate_resources()
        
        # Should get base 10 + 50% bonus = 15
        self.assertGreaterEqual(resources["food"], 10)
    
    def test_abilities_exposed_in_agent_view(self):
        """Test that abilities are visible in agent view."""
        # Create enemy with abilities
        enemy_faction = Faction(
            owner_id="enemy_player",
            name="Enemy Faction"
        )
        self.game_state.add_faction("enemy_player", enemy_faction)
        
        # Clear default units
        self.faction.units.clear()
        enemy_faction.units.clear()
        
        enemy_unit = Unit(
            name="Cavalry",
            stats=UnitStats(50, 50, 20, 5, 3, sight_range=3),
            abilities={"charge", "fortify"}
        )
        enemy_unit.x, enemy_unit.y = 10, 10
        enemy_faction.add_unit(enemy_unit)
        
        # Create friendly unit to see enemy
        friendly = Unit(
            name="Scout",
            stats=UnitStats(30, 30, 5, 3, 3, sight_range=5)
        )
        friendly.x, friendly.y = 11, 10  # Adjacent
        self.faction.add_unit(friendly)
        
        self.game_state._update_visibility()
        view = self.game_state.get_agent_view("test_player")
        
        # Check enemy units are visible with abilities
        enemy_units = view["visible_enemies"].get("enemy_player", [])
        self.assertEqual(len(enemy_units), 1)
        
        visible_enemy = enemy_units[0]
        self.assertIn("abilities", visible_enemy)
        self.assertIn("charge", visible_enemy["abilities"])
        self.assertIn("fortify", visible_enemy["abilities"])
    
    def test_ability_registry_completeness(self):
        """Test that all abilities are registered."""
        unit_abilities = ABILITY_REGISTRY.list_ability_ids("unit")
        building_abilities = ABILITY_REGISTRY.list_ability_ids("building")
        
        # Verify all 8 unit abilities
        expected_unit = ["stealth", "heal", "build", "gather", 
                        "fortify", "charge", "range_attack", "splash"]
        for ability in expected_unit:
            self.assertIn(ability, unit_abilities, 
                         f"Unit ability '{ability}' not registered")
        
        # Verify all 6 building abilities
        expected_building = ["auto_attack", "wall", "heal_aura", 
                           "resource_bonus", "research", "train_faster"]
        for ability in expected_building:
            self.assertIn(ability, building_abilities,
                         f"Building ability '{ability}' not registered")

if __name__ == '__main__':
    unittest.main()
