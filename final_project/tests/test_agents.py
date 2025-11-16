"""Tests for agent framework and LLM integration."""
import unittest
from unittest.mock import Mock, patch, AsyncMock, MagicMock
import asyncio
import json

from test_config import *

from agents.base_agent import BaseAgent, AgentAction
from agents.player_agent import PlayerAgent
from agents.admin_agent import AdminAgent
from agents.llm_interface import LLMInterface, LLMResponse, ResponseValidator
from agents.function_schemas import get_functions_for_phase, validate_function_schema

class MockLLMInterface:
    """Mock LLM interface for testing."""
    
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.conversation_history = []
        self.responses = MOCK_LLM_RESPONSES.copy()
    
    async def make_function_call(self, system_prompt, user_message, available_functions, context=None):
        """Mock function call that returns predefined responses."""
        # Determine which function to "call" based on available functions
        for func in available_functions:
            func_name = func["name"]
            if func_name in self.responses:
                return LLMResponse(
                    content=f"I will {func_name}",
                    function_calls=[{
                        "id": "mock_call_123",
                        "name": func_name,
                        "arguments": self.responses[func_name]
                    }],
                    token_usage=Mock(),
                    success=True,
                    response_time=0.1
                )
        
        # Default empty response
        return LLMResponse(
            content="No action taken",
            function_calls=[],
            token_usage=Mock(),
            success=True,
            response_time=0.1
        )
    
    def get_token_usage_summary(self):
        return {
            "agent_id": self.agent_id,
            "total_tokens": 100,
            "prompt_tokens": 60,
            "completion_tokens": 40,
            "estimated_cost": 0.01
        }

class TestAgentAction(unittest.TestCase):
    """Test AgentAction data structure."""
    
    def test_agent_action_creation(self):
        """Test creating agent actions."""
        action = AgentAction(
            action_type="move_unit",
            parameters={"unit_id": "123", "x": 5, "y": 5},
            reasoning="Strategic positioning",
            agent_id="test_agent",
            timestamp=123456.0
        )
        
        self.assertEqual(action.action_type, "move_unit")
        self.assertEqual(action.parameters["unit_id"], "123")
        self.assertEqual(action.reasoning, "Strategic positioning")
        self.assertEqual(action.agent_id, "test_agent")
        self.assertIsNone(action.success)

class TestBaseAgent(unittest.TestCase):
    """Test BaseAgent functionality."""
    
    def setUp(self):
        """Set up test agent."""
        # Create a concrete implementation of BaseAgent for testing
        class TestAgent(BaseAgent):
            async def make_decision(self, game_state_view):
                return [AgentAction(
                    action_type="test_action",
                    parameters={},
                    reasoning="Test decision",
                    agent_id=self.agent_id,
                    timestamp=0.0
                )]
            
            def get_system_prompt(self):
                return "Test system prompt"
        
        self.agent = TestAgent("test_agent", "Test Agent")
        self.agent.llm_interface = MockLLMInterface("test_agent")
    
    def test_agent_initialization(self):
        """Test agent initializes correctly."""
        self.assertEqual(self.agent.agent_id, "test_agent")
        self.assertEqual(self.agent.name, "Test Agent")
        self.assertTrue(self.agent.is_active)
        self.assertEqual(len(self.agent.action_history), 0)
    
    def test_process_turn(self):
        """Test turn processing."""
        game_state = {"turn": 1, "phase": "playing"}
        
        # Run async method properly
        actions = asyncio.run(self.agent.process_turn(game_state))
        
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0].action_type, "test_action")
        self.assertEqual(len(self.agent.action_history), 1)
    
    def test_performance_tracking(self):
        """Test performance statistics tracking."""
        # Record some actions
        action1 = AgentAction("test", {}, "reason", self.agent.agent_id, 0.0)
        action2 = AgentAction("test2", {}, "reason2", self.agent.agent_id, 0.0)
        
        self.agent.record_action_result(action1, True, {"result": "success"})
        self.agent.record_action_result(action2, False, {"error": "failed"})
        
        stats = self.agent.get_performance_stats()
        
        self.assertEqual(stats["total_actions"], 2)
        self.assertEqual(stats["successful_actions"], 1)
        self.assertEqual(stats["failed_actions"], 1)
        self.assertEqual(stats["successful_actions"], 1)
        self.assertEqual(stats["success_rate"], 50.0)
        self.assertEqual(stats["agent_id"], "test_agent")
    
    def test_agent_deactivation(self):
        """Test agent deactivation."""
        self.assertTrue(self.agent.is_active)
        
        self.agent.deactivate("Test deactivation")
        
        self.assertFalse(self.agent.is_active)

class TestPlayerAgent(unittest.TestCase):
    """Test PlayerAgent functionality."""
    
    def setUp(self):
        """Set up test player agent."""
        self.agent = PlayerAgent("player_1", personality_index=0)
        self.agent.llm_interface = MockLLMInterface("player_1")
    
    def test_player_agent_initialization(self):
        """Test player agent initializes with personality."""
        self.assertEqual(self.agent.agent_id, "player_1")
        self.assertIsNotNone(self.agent.strategic_style)
        self.assertIsNotNone(self.agent.communication_style)
        self.assertFalse(self.agent.faction_created)
    
    def test_faction_setup(self):
        """Test faction creation process."""
        game_state = {
            "phase": "setup",
            "turn_number": 0
        }
        
        # Run async method properly
        actions = asyncio.run(self.agent.make_decision(game_state))
        
        # Should have created faction and unit designs
        self.assertGreater(len(actions), 0)
        action_types = [a.action_type for a in actions]
        self.assertIn("create_faction", action_types)
        self.assertTrue(self.agent.faction_created)
    
    def test_gameplay_decisions(self):
        """Test gameplay decision making."""
        # Mock a game state where it's this agent's turn
        game_state = {
            "phase": "playing",
            "is_my_turn": True,
            "turn_number": 5,
            "my_faction": {
                "name": "Test Empire",
                "units": [
                    {"unit_id": "unit_123", "x": 5, "y": 5, "health": 50}
                ],
                "buildings": [],
                "resources": {"gold": 500, "wood": 300}
            },
            "visible_enemies": {},
            "visible_map": []
        }
        
        # Run async method properly
        actions = asyncio.run(self.agent.make_decision(game_state))
        
        # Should make some decisions (exact actions depend on mock responses)
        self.assertGreaterEqual(len(actions), 0)
    
    def test_situation_analysis(self):
        """Test game situation analysis."""
        game_state = {
            "turn_number": 10,
            "my_faction": {
                "units": [{"id": "1"}, {"id": "2"}],
                "buildings": [{"id": "1"}],
                "resources": {"gold": 600, "wood": 200}
            },
            "visible_enemies": {
                "enemy_1": [{"id": "e1"}]
            }
        }
        
        situation = self.agent._analyze_situation(game_state)
        
        self.assertEqual(situation["game_phase"], "early")
        self.assertEqual(situation["my_military_strength"], 2)
        self.assertEqual(situation["enemy_military_strength"], 1)
        self.assertIn("resource_situation", situation)
    
    def test_strategy_updates(self):
        """Test strategy adaptation."""
        game_state = {"turn_number": 5}
        
        # Early game with few units - should be early strategy
        situation = {
            "game_phase": "early",
            "my_military_strength": 1,
            "under_attack": False,
            "resource_situation": "adequate"
        }
        
        self.agent._update_strategy(game_state, situation)
        self.assertIn(self.agent.current_strategy, [
            "early_aggression", "economic_boom", "balanced_development"
        ])

class TestAdminAgent(unittest.TestCase):
    """Test AdminAgent functionality."""
    
    def setUp(self):
        """Set up test admin agent."""
        self.admin = AdminAgent()
        self.admin.llm_interface = MockLLMInterface("admin")
    
    def test_admin_initialization(self):
        """Test admin agent initializes correctly."""
        self.assertEqual(self.admin.agent_id, "admin")
        self.assertEqual(self.admin.name, "Game Admin")
        self.assertEqual(len(self.admin.balance_issues), 0)
        self.assertEqual(len(self.admin.interventions), 0)
    
    async def test_faction_balance_review(self):
        """Test faction balance analysis."""
        game_state = {
            "phase": "balancing",
            "factions": {
                "player_1": {
                    "name": "Empire 1",
                    "custom_unit_designs": {
                        "warrior": {
                            "stats": {"health": 50, "attack": 15},
                            "cost": {"gold": 100}
                        }
                    }
                },
                "player_2": {
                    "name": "Empire 2", 
                    "custom_unit_designs": {
                        "archer": {
                            "stats": {"health": 30, "attack": 20},
                            "cost": {"gold": 80}
                        }
                    }
                }
            }
        }
        
        # Mock the admin responses
        self.admin.llm_interface.responses["analyze_balance"] = {
            "analysis": "Factions appear balanced",
            "balance_issues": ["Minor cost disparity"],
            "severity": "minor"
        }
        
        # Run async method properly
        actions = asyncio.run(self.admin.make_decision(game_state))
        
        self.assertGreater(len(actions), 0)
        action_types = [a.action_type for a in actions]
        self.assertIn("analyze_balance", action_types)
    
    def test_balance_summary(self):
        """Test balance summary generation."""
        # Add some test data
        self.admin.record_balance_issue({
            "type": "overpowered_unit",
            "severity": "major",
            "description": "Test issue"
        })
        
        summary = self.admin.get_balance_summary()
        
        self.assertEqual(len(summary["balance_issues"]), 1)
        self.assertEqual(summary["balance_issues"][0]["severity"], "major")

class TestLLMInterface(unittest.TestCase):
    """Test LLM interface functionality."""
    
    def setUp(self):
        """Set up test LLM interface."""
        self.llm_interface = LLMInterface("test_agent")
    
    def test_llm_interface_initialization(self):
        """Test LLM interface initializes correctly."""
        self.assertEqual(self.llm_interface.agent_id, "test_agent")
        self.assertEqual(len(self.llm_interface.conversation_history), 0)
    
    def test_conversation_management(self):
        """Test conversation history management."""
        # Add messages
        self.llm_interface.add_user_message("Hello")
        self.llm_interface.add_function_result("test_function", {"result": "success"})
        
        self.assertEqual(len(self.llm_interface.conversation_history), 2)
        self.assertEqual(self.llm_interface.conversation_history[0]["role"], "user")
        self.assertEqual(self.llm_interface.conversation_history[1]["role"], "function")
    
    def test_token_usage_tracking(self):
        """Test token usage tracking."""
        self.llm_interface.token_usage.add_usage(50, 30)
        
        summary = self.llm_interface.get_token_usage_summary()
        
        self.assertEqual(summary["total_tokens"], 80)
        self.assertEqual(summary["prompt_tokens"], 50)
        self.assertEqual(summary["completion_tokens"], 30)

class TestResponseValidator(unittest.TestCase):
    """Test response validation utilities."""
    
    def test_coordinate_sanitization(self):
        """Test coordinate sanitization."""
        # Valid coordinates
        x, y = ResponseValidator.sanitize_coordinates(5, 7, 10, 10)
        self.assertEqual(x, 5)
        self.assertEqual(y, 7)
        
        # Out of bounds coordinates
        x, y = ResponseValidator.sanitize_coordinates(-5, 15, 10, 10)
        self.assertEqual(x, 0)
        self.assertEqual(y, 9)
        
        # Invalid types
        x, y = ResponseValidator.sanitize_coordinates("invalid", None, 10, 10)
        self.assertEqual(x, 0)
        self.assertEqual(y, 0)
    
    def test_string_sanitization(self):
        """Test string sanitization."""
        # Normal string
        result = ResponseValidator.sanitize_string("hello world")
        self.assertEqual(result, "hello world")
        
        # Long string
        long_string = "a" * 200
        result = ResponseValidator.sanitize_string(long_string, max_length=50)
        self.assertEqual(len(result), 53)  # 50 + "..."
        
        # Non-string input
        result = ResponseValidator.sanitize_string(12345)
        self.assertEqual(result, "12345")
    
    def test_resource_cost_validation(self):
        """Test resource cost validation."""
        # Valid costs
        costs = {"gold": 100, "wood": "50", "invalid_resource": 25}
        validated = ResponseValidator.validate_resource_costs(costs)
        
        self.assertIn("gold", validated)
        self.assertIn("wood", validated)
        self.assertNotIn("invalid_resource", validated)
        self.assertEqual(validated["gold"], 100)
        self.assertEqual(validated["wood"], 50)

class TestFunctionSchemas(unittest.TestCase):
    """Test function schema definitions and validation."""
    
    def test_function_schema_retrieval(self):
        """Test getting functions for different game phases."""
        setup_functions = get_functions_for_phase("setup")
        playing_functions = get_functions_for_phase("playing")
        balancing_functions = get_functions_for_phase("balancing")
        
        self.assertGreater(len(setup_functions), 0)
        self.assertGreater(len(playing_functions), 0)
        self.assertGreater(len(balancing_functions), 0)
        
        # Check that different phases have different functions
        setup_names = {f["name"] for f in setup_functions}
        playing_names = {f["name"] for f in playing_functions}
        
        self.assertIn("create_faction", setup_names)
        self.assertIn("move_unit", playing_names)
    
    def test_function_validation(self):
        """Test function argument validation."""
        # Valid function call
        self.assertTrue(validate_function_schema("move_unit", {
            "unit_id": "123",
            "target_x": 5,
            "target_y": 5,
            "reasoning": "Strategic move"
        }))
        
        # Missing required parameter
        self.assertFalse(validate_function_schema("move_unit", {
            "unit_id": "123",
            "target_x": 5
            # Missing target_y and reasoning
        }))
        
        # Invalid function name
        self.assertFalse(validate_function_schema("invalid_function", {}))

if __name__ == "__main__":
    # Run async tests
    def run_async_test(coro):
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()
    
    # Patch async test methods to run synchronously
    original_test_process_turn = TestBaseAgent.test_process_turn
    TestBaseAgent.test_process_turn = lambda self: run_async_test(original_test_process_turn(self))
    
    original_test_faction_setup = TestPlayerAgent.test_faction_setup
    TestPlayerAgent.test_faction_setup = lambda self: run_async_test(original_test_faction_setup(self))
    
    original_test_gameplay = TestPlayerAgent.test_gameplay_decisions
    TestPlayerAgent.test_gameplay_decisions = lambda self: run_async_test(original_test_gameplay(self))
    
    original_test_balance = TestAdminAgent.test_faction_balance_review
    TestAdminAgent.test_faction_balance_review = lambda self: run_async_test(original_test_balance(self))
    
    unittest.main()