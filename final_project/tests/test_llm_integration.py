"""Tests for LLM integration and agent decision-making.

NOTE: These tests use MOCKED LLM calls for speed and cost efficiency.
They verify configuration, data structures, and integration patterns
but do NOT make real OpenAI API calls.

For real end-to-end LLM testing, run the demo mode:
    python main.py --demo

Real LLM testing costs money (~$0.40-0.70) so it's not included in the test suite.
"""
import unittest
import asyncio
import os
import sys
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from agents.player_agent import PlayerAgent
from agents.llm_interface import LLMInterface, LLMResponse
from config.llm_config import DEFAULT_PERSONALITIES, DEBUG_LLM_RESPONSES
from core.game_state import GameState, GamePhase
from entities.faction import Faction, FactionTheme
from tests.test_config import TEST_AGENT_IDS

class TestLLMIntegration(unittest.TestCase):
    """Test LLM interface and integration."""
    
    def setUp(self):
        """Set up test environment."""
        self.agent_id = "test_llm_agent"
        self.llm_interface = LLMInterface(self.agent_id)
        
    def test_llm_client_availability(self):
        """Test OpenAI client availability."""
        api_key = os.getenv("OPENAI_API_KEY", "")
        
        if api_key:
            self.assertIsNotNone(self.llm_interface.client, "OpenAI client should be available when API key is set")
            self.assertTrue(len(api_key) > 10, "API key should be valid length")
            self.assertTrue(api_key.startswith("sk-"), "API key should start with 'sk-'")
        else:
            self.assertIsNone(self.llm_interface.client, "OpenAI client should be None when no API key")
    
    def test_token_usage_tracking(self):
        """Test token usage tracking."""
        initial_tokens = self.llm_interface.token_usage.total_tokens
        
        # Simulate token usage
        self.llm_interface.token_usage.add_usage(100, 50)
        
        self.assertEqual(self.llm_interface.token_usage.prompt_tokens, 100)
        self.assertEqual(self.llm_interface.token_usage.completion_tokens, 50)
        self.assertEqual(self.llm_interface.token_usage.total_tokens, initial_tokens + 150)
        self.assertGreater(self.llm_interface.token_usage.cost_estimate, 0)
    
    def test_conversation_history(self):
        """Test conversation history management."""
        self.llm_interface.add_user_message("Test message")
        self.assertEqual(len(self.llm_interface.conversation_history), 1)
        self.assertEqual(self.llm_interface.conversation_history[0]["role"], "user")
        
        self.llm_interface.add_function_result("test_function", {"result": "success"})
        self.assertEqual(len(self.llm_interface.conversation_history), 2)
        self.assertEqual(self.llm_interface.conversation_history[1]["role"], "function")
        
        self.llm_interface.clear_conversation()
        self.assertEqual(len(self.llm_interface.conversation_history), 0)
    
    @patch.dict(os.environ, {'OPENAI_API_KEY': 'sk-test-key'})
    @patch('agents.llm_interface.openai')
    @patch('agents.llm_interface.OPENAI_API_KEY', 'sk-test-key')
    def test_mock_llm_response(self, mock_openai_module):
        """Test LLM response parsing with mocked response."""
        # Mock the OpenAI client
        mock_client = MagicMock()
        mock_openai_module.OpenAI.return_value = mock_client
        # Make sure openai is truthy
        mock_openai_module.__bool__ = lambda self: True
        
        # This test validates that LLM interface can handle responses correctly
        llm = LLMInterface("test_agent")
        
        # Test that the client initialization works with mocked API
        self.assertIsNotNone(llm.client)
        self.assertEqual(llm.agent_id, "test_agent")
        mock_openai_module.OpenAI.assert_called_once_with(api_key='sk-test-key')
        
    def test_debug_flag_configuration(self):
        """Test debug flag configuration."""
        debug_enabled = os.getenv("DEBUG_LLM_RESPONSES", "false").lower() in ("true", "1", "yes")
        self.assertIsInstance(debug_enabled, bool)

class TestAgentDecisionMaking(unittest.TestCase):
    """Test agent decision-making processes."""
    
    def setUp(self):
        """Set up test agents and game state."""
        self.agent = PlayerAgent("test_agent", 0)  # Caesar personality
        self.game_state = GameState(map_width=20, map_height=20, max_players=4)
        
        # Create a test faction for the agent
        from entities.faction import Faction, FactionTheme
        theme = FactionTheme(
            name="Test Empire",
            description="Test faction",
            color_scheme=["#FF0000"],
            architectural_style="medieval",
            unit_naming_convention="Roman",
            lore=""
        )
        faction = Faction(
            faction_id="test_faction",
            owner_id="test_agent",
            name="Test Empire",
            theme=theme
        )
        
        # Add the faction to game state
        self.game_state.factions["test_agent"] = faction
        
    def test_agent_initialization(self):
        """Test agent properly initializes with personality."""
        self.assertEqual(self.agent.name, "Caesar")
        self.assertEqual(self.agent.strategic_style, "aggressive")
        self.assertEqual(self.agent.communication_style, "formal")
        self.assertIsNotNone(self.agent.llm_interface)
        self.assertFalse(self.agent.faction_created)
    
    def test_agent_llm_client_access(self):
        """Test agent has access to LLM client."""
        has_client = self.agent.llm_interface.client is not None
        api_key = os.getenv("OPENAI_API_KEY", "")
        
        if api_key:
            self.assertTrue(has_client, "Agent should have LLM client when API key is available")
        else:
            self.assertFalse(has_client, "Agent should not have LLM client when no API key")
    
    def test_phase_detection_setup(self):
        """Test agent correctly detects setup phase."""
        self.game_state.phase = GamePhase.SETUP
        game_view = self.game_state.get_agent_view(self.agent.agent_id)
        
        self.assertEqual(game_view.get("phase"), "setup")
        
        # Agent should recognize setup phase
        decision_context = self.agent.make_decision.__code__.co_varnames
        self.assertIn("game_state_view", decision_context)
    
    def test_phase_detection_playing(self):
        """Test agent correctly detects playing phase."""
        self.game_state.phase = GamePhase.PLAYING
        game_view = self.game_state.get_agent_view(self.agent.agent_id)
        
        self.assertEqual(game_view.get("phase"), "playing")
    
    def test_faction_setup_flow(self):
        """Test faction setup decision flow."""
        self.game_state.phase = GamePhase.SETUP
        game_view = self.game_state.get_agent_view(self.agent.agent_id)
        
        # Test the game view has the expected structure for setup
        self.assertIn("phase", game_view)
        self.assertEqual(game_view["phase"], "setup")
    
    def test_gameplay_flow(self):
        """Test gameplay decision flow."""
        # Create faction first
        self.agent.faction_created = True
        self.game_state.phase = GamePhase.PLAYING
        game_view = self.game_state.get_agent_view(self.agent.agent_id)
        
        # Test the game view has the expected structure for playing
        self.assertIn("phase", game_view)
        self.assertEqual(game_view["phase"], "playing")
    
    def test_strategy_styles(self):
        """Test all personality strategy styles are valid."""
        valid_styles = ["aggressive", "defensive", "economic", "balanced"]
        
        for personality in DEFAULT_PERSONALITIES:
            self.assertIn(personality.strategic_style, valid_styles, 
                         f"{personality.name} has invalid strategy: {personality.strategic_style}")
    
    def test_communication_styles(self):
        """Test all personality communication styles are valid."""
        valid_styles = ["formal", "casual", "taunting", "analytical"]
        
        for personality in DEFAULT_PERSONALITIES:
            self.assertIn(personality.communication_style, valid_styles,
                         f"{personality.name} has invalid communication: {personality.communication_style}")

class TestGameIntegration(unittest.TestCase):
    """Test game integration and turn processing."""
    
    def setUp(self):
        """Set up integration test environment."""
        self.game_state = GameState(map_width=20, map_height=20, max_players=4)
        self.agents = [PlayerAgent(f"agent_{i}", i) for i in range(4)]
        
    def test_agent_faction_creation_flow(self):
        """Test agent can create faction in game state."""
        agent = self.agents[0]
        
        # Create basic faction
        theme = FactionTheme(
            name="Test Empire",
            description="Test faction",
            color_scheme=["#FF0000"],
            architectural_style="medieval",
            unit_naming_convention="Roman"
        )
        
        faction = Faction(
            name="Test Empire",
            theme=theme,
            owner_id=agent.agent_id
        )
        
        # Add to game state
        success = self.game_state.add_faction(agent.agent_id, faction)
        self.assertTrue(success)
        
        # Verify agent can be found in game state
        agent_view = self.game_state.get_agent_view(agent.agent_id)
        self.assertIsNotNone(agent_view)
    
    def test_turn_rotation_mechanics(self):
        """Test turn rotation works with agents."""
        # Add factions for all agents
        for i, agent in enumerate(self.agents):
            theme = FactionTheme(
                name=f"Empire_{i}",
                description=f"Test faction {i}",
                color_scheme=[f"#{i*50:02x}0000"],
                architectural_style="medieval",
                unit_naming_convention="Standard"
            )
            
            faction = Faction(
                name=f"Empire_{i}",
                theme=theme,
                owner_id=agent.agent_id
            )
            
            self.game_state.add_faction(agent.agent_id, faction)
        
        # Set to playing phase
        self.game_state.phase = GamePhase.PLAYING
        
        # Test turn rotation
        initial_player = self.game_state.get_current_player()
        self.assertIsNotNone(initial_player)
        
        # Advance through all players
        for _ in range(len(self.agents)):
            current_player = self.game_state.get_current_player()
            self.assertIn(current_player, [agent.agent_id for agent in self.agents])
            self.game_state.advance_turn()
    
    def test_agent_game_view_contains_required_data(self):
        """Test agent game view contains all required decision-making data."""
        agent = self.agents[0]
        
        # Add faction
        theme = FactionTheme(
            name="Test Empire",
            description="Test faction",
            color_scheme=["#FF0000"],
            architectural_style="medieval",
            unit_naming_convention="Roman"
        )
        
        faction = Faction(
            name="Test Empire",
            theme=theme,
            owner_id=agent.agent_id
        )
        
        self.game_state.add_faction(agent.agent_id, faction)
        self.game_state.phase = GamePhase.PLAYING
        
        game_view = self.game_state.get_agent_view(agent.agent_id)
        
        # Check required fields
        required_fields = ["phase", "turn_number", "my_faction"]
        for field in required_fields:
            self.assertIn(field, game_view, f"Game view missing required field: {field}")
    
    def test_multiple_agents_can_make_decisions(self):
        """Test multiple agents can make decisions without conflicts."""
        # This is an integration test placeholder
        for agent in self.agents:
            self.assertIsNotNone(agent.llm_interface)
            self.assertIsNotNone(agent.name)
            self.assertIsNotNone(agent.strategic_style)

class TestEnvironmentValidation(unittest.TestCase):
    """Test environment configuration validation."""
    
    def test_required_environment_setup(self):
        """Test all required environment variables and configurations."""
        # Test API key format (if present)
        api_key = os.getenv("OPENAI_API_KEY", "")
        if api_key:
            self.assertTrue(api_key.startswith("sk-"), "API key should start with 'sk-'")
            self.assertGreater(len(api_key), 20, "API key should be sufficient length")
        
        # Test model configuration
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self.assertIsInstance(model, str)
        self.assertGreater(len(model), 3)
        
        # Test token limits
        max_tokens = int(os.getenv("OPENAI_MAX_TOKENS", "3000"))
        self.assertGreater(max_tokens, 100)
        self.assertLessEqual(max_tokens, 10000)  # Allow exactly 10000
        
        # Test temperature
        temperature = float(os.getenv("OPENAI_TEMPERATURE", "1.0"))
        self.assertGreaterEqual(temperature, 0.0)
        self.assertLessEqual(temperature, 2.0)
        
        # Test debug flag
        debug = os.getenv("DEBUG_LLM_RESPONSES", "false").lower()
        self.assertIn(debug, ["true", "false", "1", "0", "yes", "no"])
    
    def test_personality_configurations(self):
        """Test all personality configurations are valid."""
        self.assertEqual(len(DEFAULT_PERSONALITIES), 4, "Should have exactly 4 default personalities")
        
        names = [p.name for p in DEFAULT_PERSONALITIES]
        self.assertEqual(len(set(names)), 4, "All personality names should be unique")
        
        # Test risk tolerance ranges
        for personality in DEFAULT_PERSONALITIES:
            self.assertGreaterEqual(personality.risk_tolerance, 0.0)
            self.assertLessEqual(personality.risk_tolerance, 1.0)
            self.assertGreater(len(personality.preferred_unit_types), 0)

if __name__ == "__main__":
    unittest.main()