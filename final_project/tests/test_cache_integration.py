#!/usr/bin/env python3
"""
Integration tests for faction cache functionality.
These tests verify the cache integration works properly.
"""

import unittest
import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from data.cache.faction_cache import FactionCache


class TestFactionCacheIntegration(unittest.TestCase):
    """Test faction cache integration functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.cache = FactionCache()
        self.cache.clear_cache()  # Start with clean cache
        
        self.test_faction = {
            'faction_name': 'Test Empire',
            'faction_theme': 'medieval kingdom',
            'faction_description': 'A mighty kingdom with stone walls',
            'units': [{'name': 'Knight', 'type': 'melee', 'cost': 50}]
        }
    
    def test_basic_faction_storage_and_retrieval(self):
        """Test basic faction storage and retrieval."""
        # Store test faction
        self.cache.store_faction('aggressive', 'medieval theme', self.test_faction)
        
        # Try to retrieve
        result = self.cache.get_faction('aggressive', 'medieval theme')
        
        # Verify retrieval
        self.assertIsNotNone(result, "Should retrieve stored faction")
        self.assertEqual(result.get('faction_name'), 'Test Empire')
        self.assertEqual(result.get('faction_theme'), 'medieval kingdom')
        
        # Check listing
        factions = self.cache.list_cached_factions()
        self.assertEqual(len(factions), 1, "Should have one cached faction")
    
    def test_complete_faction_storage_and_retrieval(self):
        """Test complete faction storage (faction + units + sprites)."""
        faction_data = self.test_faction
        units_data = [
            {'name': 'Knight', 'cost': 50}, 
            {'name': 'Archer', 'cost': 30}
        ]
        sprites_data = {
            'knight_sprite': 'ascii_art_here', 
            'archer_sprite': 'bow_art_here'
        }
        
        # Store complete faction
        cache_key = self.cache.store_complete_faction(
            'aggressive', 
            faction_data, 
            units_data, 
            sprites_data
        )
        
        self.assertIsNotNone(cache_key, "Should return cache key")
        
        # Retrieve complete faction
        complete_result = self.cache.get_complete_faction('aggressive')
        
        # Verify retrieval
        self.assertIsNotNone(complete_result, "Should retrieve complete faction")
        if complete_result:  # Type guard for proper checking
            self.assertIsInstance(complete_result, dict, "Complete result should be a dictionary")
            
            self.assertIn('faction_creation', complete_result)
            self.assertIn('unit_designs', complete_result)
            self.assertIn('sprites', complete_result)
            
            # Verify data integrity
            self.assertEqual(
                complete_result['faction_creation']['faction_name'], 
                'Test Empire'
            )
            self.assertEqual(len(complete_result['unit_designs']), 2)
            self.assertIn('knight_sprite', complete_result['sprites'])
    
    def test_cache_persistence_across_instances(self):
        """Test that cache data persists across cache instances."""
        # Store data with first instance
        self.cache.store_faction('defensive', 'fortress theme', self.test_faction)
        
        # Create new cache instance
        new_cache = FactionCache()
        
        # Should be able to retrieve data
        result = new_cache.get_faction('defensive', 'fortress theme')
        self.assertIsNotNone(result, "Cache should persist across instances")
        if result:
            self.assertEqual(result.get('faction_name'), 'Test Empire')
    
    def test_cache_miss_scenarios(self):
        """Test cache miss scenarios return None."""
        # Try to retrieve non-existent faction
        result = self.cache.get_faction('nonexistent', 'nonexistent theme')
        self.assertIsNone(result, "Should return None for cache miss")
        
        # Try to retrieve non-existent complete faction
        complete_result = self.cache.get_complete_faction('nonexistent')
        self.assertIsNone(complete_result, "Should return None for complete faction miss")
    
    def test_similar_faction_retrieval(self):
        """Test similar faction retrieval by personality."""
        # Store multiple factions with same personality
        faction1 = dict(self.test_faction)
        faction1['faction_name'] = 'Empire One'
        
        faction2 = dict(self.test_faction)
        faction2['faction_name'] = 'Empire Two'
        
        self.cache.store_faction('aggressive', 'theme one', faction1)
        self.cache.store_faction('aggressive', 'theme two', faction2)
        
        # Should be able to get similar faction
        similar = self.cache.get_similar_faction('aggressive')
        self.assertIsNotNone(similar, "Should find similar faction")
        if similar:
            self.assertIn(similar['faction_name'], ['Empire One', 'Empire Two'])
    
    def test_cache_statistics(self):
        """Test cache statistics and metadata."""
        # Store some test data
        self.cache.store_faction('aggressive', 'theme1', self.test_faction)
        
        faction2 = dict(self.test_faction)
        faction2['faction_name'] = 'Empire Two'
        self.cache.store_faction('defensive', 'theme2', faction2)
        
        # Get statistics
        factions = self.cache.list_cached_factions()
        self.assertEqual(len(factions), 2, "Should have two cached factions")
        
        # Check metadata
        for faction in factions:
            self.assertIn('personality_type', faction)
            self.assertIn('theme_description', faction)
            self.assertIn('created_at', faction)
    
    def test_cache_clearing(self):
        """Test cache clearing functionality."""
        # Store some data
        self.cache.store_faction('aggressive', 'theme', self.test_faction)
        
        # Verify data exists
        result = self.cache.get_faction('aggressive', 'theme')
        self.assertIsNotNone(result, "Data should exist before clearing")
        
        # Clear cache
        self.cache.clear_cache()
        
        # Verify data is gone
        result = self.cache.get_faction('aggressive', 'theme')
        self.assertIsNone(result, "Data should be gone after clearing")
        
        # Verify listing is empty
        factions = self.cache.list_cached_factions()
        self.assertEqual(len(factions), 0, "Should have no cached factions after clearing")
    
    def tearDown(self):
        """Clean up after tests."""
        self.cache.clear_cache()


class TestFactionCachePerformance(unittest.TestCase):
    """Test faction cache performance characteristics."""
    
    def setUp(self):
        """Set up performance test environment."""
        self.cache = FactionCache()
        self.cache.clear_cache()
        
        self.large_faction = {
            'faction_name': 'Performance Test Empire',
            'faction_theme': 'large test data',
            'faction_description': 'A' * 1000,  # Large description
            'units': [{'name': f'Unit_{i}', 'cost': i*10} for i in range(100)]  # Many units
        }
    
    def test_large_faction_storage(self):
        """Test storing large faction data."""
        import time
        
        start_time = time.time()
        self.cache.store_faction('performance', 'large data', self.large_faction)
        store_time = time.time() - start_time
        
        # Should be fast even with large data
        self.assertLess(store_time, 1.0, "Large faction storage should be fast")
        
        # Verify retrieval
        start_time = time.time()
        result = self.cache.get_faction('performance', 'large data')
        retrieve_time = time.time() - start_time
        
        self.assertLess(retrieve_time, 0.1, "Large faction retrieval should be fast")
        self.assertIsNotNone(result, "Should retrieve large faction")
        if result:
            self.assertEqual(len(result['units']), 100, "Should have all units")
    
    def tearDown(self):
        """Clean up after performance tests."""
        self.cache.clear_cache()


if __name__ == '__main__':
    print("🧪 Testing Faction Cache Integration")
    print("=" * 40)
    unittest.main(verbosity=2)