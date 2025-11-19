#!/usr/bin/env python3
"""Test dynamic ability description generation."""
import unittest
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from abilities import (
    get_ability_descriptions, get_ability_list, 
    get_ability_enum_description, get_ability_summary_table
)
from config.llm_config import get_player_agent_system_prompt
from agents.function_schemas import _UNIT_ABILITIES, _BUILDING_ABILITIES, _UNIT_DESC, _BUILDING_DESC

class TestDynamicAbilities(unittest.TestCase):
    """Test that ability descriptions are dynamically generated."""
    
    def test_get_ability_list_unit(self):
        """Test getting unit ability list."""
        abilities = get_ability_list("unit")
        self.assertIsInstance(abilities, list)
        self.assertGreater(len(abilities), 0)
        self.assertIn("stealth", abilities)
        self.assertIn("charge", abilities)
        self.assertIn("heal", abilities)
    
    def test_get_ability_list_building(self):
        """Test getting building ability list."""
        abilities = get_ability_list("building")
        self.assertIsInstance(abilities, list)
        self.assertGreater(len(abilities), 0)
        self.assertIn("auto_attack", abilities)
        self.assertIn("wall", abilities)
    
    def test_get_ability_descriptions(self):
        """Test getting formatted ability descriptions."""
        unit_desc = get_ability_descriptions("unit")
        building_desc = get_ability_descriptions("building")
        
        # Should be non-empty strings
        self.assertIsInstance(unit_desc, str)
        self.assertIsInstance(building_desc, str)
        self.assertGreater(len(unit_desc), 0)
        self.assertGreater(len(building_desc), 0)
        
        # Should contain ability names and descriptions
        self.assertIn("stealth", unit_desc.lower())
        self.assertIn("hidden", unit_desc.lower())
        self.assertIn("auto_attack", building_desc.lower())
    
    def test_get_ability_enum_description(self):
        """Test getting compact ability descriptions."""
        unit_desc = get_ability_enum_description("unit")
        building_desc = get_ability_enum_description("building")
        
        # Should be compact format
        self.assertIsInstance(unit_desc, str)
        self.assertIsInstance(building_desc, str)
        self.assertIn("=", unit_desc)  # Should have key=value format
        self.assertIn("=", building_desc)
    
    def test_get_ability_summary_table(self):
        """Test getting ability summary dictionary."""
        unit_summary = get_ability_summary_table("unit")
        building_summary = get_ability_summary_table("building")
        
        # Should be dictionaries
        self.assertIsInstance(unit_summary, dict)
        self.assertIsInstance(building_summary, dict)
        
        # Should have abilities as keys
        self.assertIn("stealth", unit_summary)
        self.assertIn("charge", unit_summary)
        self.assertIn("auto_attack", building_summary)
        
        # Values should be descriptions
        self.assertIsInstance(unit_summary["stealth"], str)
        self.assertGreater(len(unit_summary["stealth"]), 0)
    
    def test_system_prompt_generation(self):
        """Test that system prompt is generated with dynamic abilities."""
        prompt = get_player_agent_system_prompt(
            personality_name="TestAgent",
            strategic_style="aggressive",
            communication_style="formal"
        )
        
        # Should contain ability information
        self.assertIsInstance(prompt, str)
        self.assertIn("Unit Abilities", prompt)
        self.assertIn("Building Abilities", prompt)
        self.assertIn("stealth", prompt.lower())
        self.assertIn("charge", prompt.lower())
    
    def test_function_schema_abilities(self):
        """Test that function schemas have dynamic ability enums."""
        # Check unit abilities
        self.assertIsInstance(_UNIT_ABILITIES, list)
        self.assertGreater(len(_UNIT_ABILITIES), 0)
        self.assertIn("stealth", _UNIT_ABILITIES)
        self.assertIn("charge", _UNIT_ABILITIES)
        
        # Check building abilities
        self.assertIsInstance(_BUILDING_ABILITIES, list)
        self.assertGreater(len(_BUILDING_ABILITIES), 0)
        self.assertIn("auto_attack", _BUILDING_ABILITIES)
        self.assertIn("wall", _BUILDING_ABILITIES)
        
        # Check descriptions are strings
        self.assertIsInstance(_UNIT_DESC, str)
        self.assertIsInstance(_BUILDING_DESC, str)
        self.assertGreater(len(_UNIT_DESC), 0)
        self.assertGreater(len(_BUILDING_DESC), 0)
    
    def test_ability_count_consistency(self):
        """Test that all 14 abilities are registered."""
        unit_abilities = get_ability_list("unit")
        building_abilities = get_ability_list("building")
        
        # Should have 8 unit abilities
        self.assertEqual(len(unit_abilities), 8)
        
        # Should have 6 building abilities
        self.assertEqual(len(building_abilities), 6)
        
        # Total should be 14
        self.assertEqual(len(unit_abilities) + len(building_abilities), 14)
    
    def test_no_hardcoded_values(self):
        """Test that descriptions come from abilities, not hardcoded strings."""
        from abilities import ABILITY_REGISTRY
        
        # Get description from registry
        stealth_ability = ABILITY_REGISTRY.get("stealth")
        self.assertIsNotNone(stealth_ability)
        registry_desc = stealth_ability.description
        
        # Get description from utility function
        unit_desc = get_ability_descriptions("unit")
        
        # Should contain the same description
        self.assertIn(registry_desc, unit_desc)

if __name__ == '__main__':
    unittest.main()
