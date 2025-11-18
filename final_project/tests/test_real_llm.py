#!/usr/bin/env python3
"""
Real LLM Integration Tests
=========================

These tests make ACTUAL OpenAI API calls to verify end-to-end LLM integration.

WARNING: These tests cost money (~$0.40-0.70) and are NOT run by default.
Use the --real-llm flag with run_tests.py to enable them.

Usage:
    python tests/run_tests.py --real-llm    # Include real LLM tests
    python tests/run_tests.py               # Skip expensive tests (default)
"""

import unittest
import asyncio
import os
import sys
import time
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from agents.player_agent import PlayerAgent
from sprites.generator import SpriteGenerator
from core.game_state import GameState
from config.llm_config import DEFAULT_PERSONALITIES
from data.cache.faction_cache import FactionCache


class TestRealLLMIntegration(unittest.TestCase):
    """Test actual LLM integration with real API calls."""
    
    def setUp(self):
        """Set up test environment."""
        # Check API key
        self.api_key = os.getenv("OPENAI_API_KEY", "")
        if not self.api_key:
            self.skipTest("No OPENAI_API_KEY found - skipping real LLM tests")
        
        # Set up game state
        self.game_state = GameState(map_width=20, map_height=20, max_players=4)
        
        # Clear cache to force LLM calls
        self.cache = FactionCache()
        self.cache.clear_cache()
        
        print(f"\n💰 WARNING: This test will cost money (~$0.20-0.40)")
        print(f"🔑 Using API key: {self.api_key[:10]}...")
    
    def test_real_faction_creation(self):
        """Test real faction creation via LLM API calls."""
        print("\n🏛️ Testing real faction creation...")
        start_time = time.time()
        
        # Create agent without cache to force LLM call
        agent = PlayerAgent(
            agent_id="real_test_player", 
            personality_index=0,  # Caesar
            use_faction_cache=False
        )
        
        # Get game view for agent
        game_view = self.game_state.get_agent_view(agent.agent_id)
        
        # This should make a REAL LLM call
        async def run_test():
            result = await agent.make_decision(game_view)
            return result
        
        result = asyncio.run(run_test())
        faction_time = time.time() - start_time
        
        print(f"⏱️  Faction creation took: {faction_time:.1f} seconds")
        
        # Verify result
        self.assertIsNotNone(result, "Should return a result")
        self.assertIsInstance(result, list, "Result should be a list of AgentActions")
        self.assertGreater(len(result), 0, "Should return at least one action")
        
        # Check token usage (real LLM calls should use significant tokens)
        tokens_used = agent.llm_interface.token_usage.total_tokens
        print(f"🪙 Tokens used: {tokens_used}")
        self.assertGreater(tokens_used, 100, "Real LLM call should use significant tokens")
        
        # Check timing (real LLM calls should take reasonable time)
        self.assertGreater(faction_time, 2, "Real LLM call should take at least 2 seconds")
        self.assertLess(faction_time, 120, "LLM call shouldn't take more than 2 minutes")
    
    def test_real_sprite_generation(self):
        """Test real sprite generation via LLM API calls."""
        print("\n🎨 Testing real sprite generation...")
        start_time = time.time()
        
        # Create sprite generator without cache
        sprite_gen = SpriteGenerator(
            agent_id="real_test_sprite",
            use_cache=False
        )
        
        test_unit = {
            'name': 'Test Warrior',
            'type': 'melee', 
            'description': 'A brave knight in shining armor',
            'cost': 50,
            'health': 100
        }
        
        # This should make a REAL LLM call
        async def run_test():
            result = await sprite_gen.generate_unit_sprite(
                unit_name=test_unit['name'],
                unit_description=test_unit['description'],
                faction_theme="medieval knights",
                unit_type=test_unit['type']
            )
            return result
        
        result = asyncio.run(run_test())
        sprite_time = time.time() - start_time
        
        print(f"⏱️  Sprite generation took: {sprite_time:.1f} seconds")
        
        # Verify result
        self.assertIsNotNone(result, "Should return a result")
        self.assertIsInstance(result, dict, "Sprite result should be a dictionary")
        
        # Check token usage
        tokens_used = sprite_gen.llm_interface.token_usage.total_tokens
        print(f"🪙 Tokens used: {tokens_used}")
        self.assertGreater(tokens_used, 50, "Real sprite LLM call should use tokens")
        
        # Check timing
        self.assertGreater(sprite_time, 1, "Real LLM call should take at least 1 second")
        self.assertLess(sprite_time, 60, "Sprite generation shouldn't take more than 1 minute")
    
    def test_cache_performance_improvement(self):
        """Test that cache provides performance improvement at the cache level."""
        print("\n🏎️ Testing cache performance...")
        
        # Test 1: Direct cache storage and retrieval speed
        print("📦 Testing direct cache operations...")
        cache = FactionCache()
        cache.clear_cache()
        
        # Store a test faction
        test_faction = {
            'faction_name': 'Speed Test Empire',
            'faction_theme': 'test theme',
            'faction_description': 'A faction for testing cache speed',
            'units': [{'name': 'Test Unit', 'cost': 50}]
        }
        
        # Test storage speed
        start_time = time.time()
        cache.store_faction('economic', 'test theme', test_faction)
        store_time = time.time() - start_time
        print(f"💾 Cache store time: {store_time:.3f} seconds")
        
        # Test retrieval speed
        start_time = time.time()
        retrieved = cache.get_faction('economic', 'test theme')
        retrieve_time = time.time() - start_time
        print(f"⚡ Cache retrieve time: {retrieve_time:.3f} seconds")
        
        # Verify cache operations are fast
        self.assertLess(store_time, 0.1, "Cache storage should be very fast")
        self.assertLess(retrieve_time, 0.1, "Cache retrieval should be very fast")
        self.assertIsNotNone(retrieved, "Should retrieve stored faction")
        if retrieved:
            self.assertEqual(retrieved['faction_name'], 'Speed Test Empire')
        
        print("✅ Cache operations are fast!")
        
        # Test 2: Real LLM call vs cache comparison (single call each)
        print("\n📞 Comparing single LLM call vs single cache lookup...")
        
        # Time a real LLM call
        print("🤖 Making one real LLM call...")
        start_time = time.time()
        
        agent = PlayerAgent(
            agent_id="speed_test_agent", 
            personality_index=0,  # Caesar
            use_faction_cache=False  # Force LLM call
        )
        
        game_view = self.game_state.get_agent_view(agent.agent_id)
        
        async def single_llm_call():
            return await agent.make_decision(game_view)
        
        llm_result = asyncio.run(single_llm_call())
        llm_time = time.time() - start_time
        
        # Time a cache lookup (using direct cache, not agent)
        start_time = time.time()
        cached_result = cache.get_faction('economic', 'test theme')
        cache_lookup_time = time.time() - start_time
        
        print(f"⏱️  LLM call time: {llm_time:.1f} seconds")
        print(f"⚡ Cache lookup time: {cache_lookup_time:.4f} seconds")
        
        speedup = llm_time / cache_lookup_time if cache_lookup_time > 0 else float('inf')
        print(f"🚀 Theoretical speedup: {speedup:.0f}x faster")
        
        # Cache should be dramatically faster than LLM calls
        self.assertGreater(speedup, 100, f"Cache should be much faster than LLM, got {speedup:.0f}x")
        self.assertLess(cache_lookup_time, 0.01, "Cache lookup should be under 10ms")
        self.assertGreater(llm_time, 5, "LLM call should take several seconds")
        
        # Verify both return valid data
        self.assertIsNotNone(llm_result, "LLM call should return result")
        self.assertIsInstance(llm_result, list, "LLM result should be list of actions")
        self.assertIsNotNone(cached_result, "Cache should return result")
        self.assertIsInstance(cached_result, dict, "Cache result should be faction dict")
        
        print("✅ Cache provides dramatic speedup over LLM calls!")
    
    def tearDown(self):
        """Clean up after tests."""
        # Calculate total cost
        total_cost = 0
        if hasattr(self, 'cache'):
            # Estimate cost based on typical token usage
            # This is just an estimate for user information
            estimated_cost = 0.10  # Conservative estimate per test
            print(f"\n💰 Estimated cost for this test: ~${estimated_cost:.2f}")


class TestRealLLMEnvironment(unittest.TestCase):
    """Test that the environment is properly set up for real LLM testing."""
    
    def test_api_key_present(self):
        """Test that OpenAI API key is available."""
        api_key = os.getenv("OPENAI_API_KEY", "")
        self.assertTrue(len(api_key) > 0, "OPENAI_API_KEY must be set for real LLM tests")
        self.assertTrue(api_key.startswith("sk-"), "API key should start with 'sk-'")
        self.assertGreater(len(api_key), 20, "API key should be valid length")
    
    def test_llm_interfaces_initialize(self):
        """Test that LLM interfaces can be initialized."""
        from agents.llm_interface import LLMInterface
        
        interface = LLMInterface("test_agent")
        self.assertIsNotNone(interface.client, "OpenAI client should be initialized")
        self.assertEqual(interface.agent_id, "test_agent", "Agent ID should be set correctly")


if __name__ == '__main__':
    print("🤖 Real LLM Integration Tests")
    print("=" * 40)
    print("⚠️  WARNING: These tests make actual OpenAI API calls!")
    print("💰 Estimated cost: ~$0.40-0.70 per full test run")
    print("")
    
    # Check if user wants to proceed
    response = input("Do you want to proceed with real API calls? (y/N): ")
    if response.lower() not in ['y', 'yes']:
        print("❌ Tests cancelled by user")
        sys.exit(0)
    
    unittest.main(verbosity=2)