"""Test configuration for the test suite."""
import os
import sys

# Add project root to path for imports
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Test data constants
TEST_AGENT_IDS = ["test_agent_1", "test_agent_2", "test_agent_3", "test_agent_4"]
TEST_FACTION_NAMES = ["Test Empire", "Mock Kingdom", "Demo Republic", "Sample Federation"]

# Mock OpenAI responses for testing
MOCK_LLM_RESPONSES = {
    "create_faction": {
        "faction_name": "Test Empire",
        "theme_description": "A militaristic empire focused on conquest",
        "color_scheme": ["#FF0000", "#800000", "#400000"],
        "architectural_style": "medieval",
        "unit_naming_convention": "Roman-style names",
        "faction_lore": "An ancient empire rising again"
    },
    "design_unit": {
        "unit_name": "Test Warrior",
        "unit_description": "Basic infantry unit for testing",
        "unit_category": "infantry",
        "stats": {
            "health": 50,
            "attack": 15,
            "defense": 10,
            "movement_speed": 2
        },
        "abilities": ["fortify"],
        "resource_costs": {"gold": 100, "wood": 50},
        "sprite_description": "Armored soldier with sword and shield"
    },
    "move_unit": {
        "unit_id": "test_unit_123",
        "target_x": 5,
        "target_y": 5,
        "reasoning": "Moving to strategic position"
    }
}

# Test game state data
TEST_GAME_STATE_DATA = {
    "game_id": "test_game_123",
    "turn_number": 5,
    "phase": "playing",
    "current_player_index": 0,
    "map_width": 10,
    "map_height": 10
}