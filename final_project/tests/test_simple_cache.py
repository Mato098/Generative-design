"""
Comprehensive test suite for the simple faction cache system.
Tests all aspects of cache functionality, edge cases, and integration scenarios.
"""

import unittest
import json
import os
import sys
import tempfile
import shutil
from unittest.mock import patch, mock_open

from data.cache.faction_cache import FactionCache, CachedFaction


class TestFactionCacheBasics(unittest.TestCase):
    """Test basic cache functionality."""
    
    def setUp(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.cache = FactionCache(self.temp_dir)
        
    def tearDown(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
        
    def test_cache_initialization(self):
        """Test cache initialization creates necessary directories."""
        self.assertTrue(os.path.exists(self.temp_dir))
        self.assertIsInstance(self.cache, FactionCache)
        self.assertEqual(self.cache.cache_dir, self.temp_dir)
        
    def test_cache_key_generation(self):
        """Test cache key generation from parameters."""
        key1 = self.cache._generate_cache_key("aggressive", "Roman empire")
        key2 = self.cache._generate_cache_key("aggressive", "Roman empire")
        key3 = self.cache._generate_cache_key("peaceful", "Roman empire")
        
        # Same parameters should generate same key
        self.assertEqual(key1, key2)
        # Different parameters should generate different key
        self.assertNotEqual(key1, key3)
        # Keys should be valid MD5 hashes
        self.assertEqual(len(key1), 32)
        self.assertTrue(all(c in '0123456789abcdef' for c in key1))
        
    def test_store_and_retrieve_faction(self):
        """Test basic store and retrieve operations."""
        personality = "aggressive"
        theme = "Roman legion with eagles"
        faction_data = {
            "name": "Imperial Legion",
            "units": {"legionnaire": {"type": "infantry"}},
            "theme": {"style": "roman"}
        }
        
        # Store faction
        cache_key = self.cache.store_faction(personality, theme, faction_data)
        self.assertIsInstance(cache_key, str)
        self.assertEqual(len(cache_key), 32)
        
        # Retrieve faction
        retrieved = self.cache.get_faction(personality, theme)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved["name"], "Imperial Legion")
        self.assertEqual(retrieved["units"]["legionnaire"]["type"], "infantry")
        
    def test_no_match_returns_none(self):
        """Test that non-existent factions return None."""
        result = self.cache.get_faction("nonexistent", "theme")
        self.assertIsNone(result)
        
    def test_case_insensitive_cache_keys(self):
        """Test that cache keys are case insensitive."""
        faction_data = {"name": "Test Faction"}
        
        key1 = self.cache.store_faction("Aggressive", "Roman Empire", faction_data)
        key2 = self.cache._generate_cache_key("aggressive", "roman empire")
        
        self.assertEqual(key1, key2)
        
        # Should be able to retrieve with different case
        retrieved = self.cache.get_faction("aggressive", "roman empire")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved["name"], "Test Faction")


class TestFactionCacheMultiple(unittest.TestCase):
    """Test cache with multiple factions."""
    
    def setUp(self):
        """Set up test environment with multiple factions."""
        self.temp_dir = tempfile.mkdtemp()
        self.cache = FactionCache(self.temp_dir)
        
        # Sample faction data
        self.factions = [
            ("aggressive", "Roman empire", {"name": "Roman Empire", "style": "classical"}),
            ("aggressive", "Viking raiders", {"name": "Viking Clan", "style": "norse"}),
            ("defensive", "Medieval castle", {"name": "Castle Guard", "style": "medieval"}),
            ("peaceful", "Merchant guild", {"name": "Trade Guild", "style": "commercial"}),
            ("aggressive", "Barbarian tribes", {"name": "Wild Tribes", "style": "primitive"})
        ]
        
        # Store all test factions
        for personality, theme, data in self.factions:
            self.cache.store_faction(personality, theme, data)
            
    def tearDown(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
        
    def test_multiple_faction_storage(self):
        """Test storing multiple factions."""
        stats = self.cache.get_cache_stats()
        self.assertEqual(stats["total_factions"], 5)
        self.assertEqual(stats["personalities"]["aggressive"], 3)
        self.assertEqual(stats["personalities"]["defensive"], 1)
        self.assertEqual(stats["personalities"]["peaceful"], 1)
        
    def test_specific_faction_retrieval(self):
        """Test retrieving specific factions."""
        roman = self.cache.get_faction("aggressive", "Roman empire")
        self.assertIsNotNone(roman)
        self.assertEqual(roman["name"], "Roman Empire")
        
        viking = self.cache.get_faction("aggressive", "Viking raiders")
        self.assertIsNotNone(viking)
        self.assertEqual(viking["name"], "Viking Clan")
        
        castle = self.cache.get_faction("defensive", "Medieval castle")
        self.assertIsNotNone(castle)
        self.assertEqual(castle["name"], "Castle Guard")
        
    def test_similar_faction_retrieval(self):
        """Test retrieving similar factions by personality."""
        aggressive = self.cache.get_similar_faction("aggressive")
        self.assertIsNotNone(aggressive)
        self.assertIn(aggressive["name"], ["Roman Empire", "Viking Clan", "Wild Tribes"])
        
        defensive = self.cache.get_similar_faction("defensive")
        self.assertIsNotNone(defensive)
        self.assertEqual(defensive["name"], "Castle Guard")
        
        peaceful = self.cache.get_similar_faction("peaceful")
        self.assertIsNotNone(peaceful)
        self.assertEqual(peaceful["name"], "Trade Guild")
        
        nonexistent = self.cache.get_similar_faction("nonexistent")
        self.assertIsNone(nonexistent)
        
    def test_faction_listing(self):
        """Test listing all cached factions."""
        factions = self.cache.list_cached_factions()
        self.assertEqual(len(factions), 5)
        
        # Check that all required fields are present
        for faction in factions:
            self.assertIn("cache_key", faction)
            self.assertIn("personality_type", faction)
            self.assertIn("theme_description", faction)
            self.assertIn("created_at", faction)
            
        # Check that we have the expected personality types
        personalities = [f["personality_type"] for f in factions]
        self.assertEqual(personalities.count("aggressive"), 3)
        self.assertEqual(personalities.count("defensive"), 1)
        self.assertEqual(personalities.count("peaceful"), 1)


class TestFactionCachePersistence(unittest.TestCase):
    """Test cache persistence and file operations."""
    
    def setUp(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        
    def tearDown(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
        
    def test_cache_persistence_across_instances(self):
        """Test that cache data persists across cache instances."""
        # Create first cache instance and store data
        cache1 = FactionCache(self.temp_dir)
        faction_data = {"name": "Persistent Faction", "type": "test"}
        cache1.store_faction("warrior", "Persistent theme", faction_data)
        
        # Create second cache instance
        cache2 = FactionCache(self.temp_dir)
        
        # Should be able to retrieve data from second instance
        retrieved = cache2.get_faction("warrior", "Persistent theme")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved["name"], "Persistent Faction")
        
        # Both instances should report same stats
        stats1 = cache1.get_cache_stats()
        stats2 = cache2.get_cache_stats()
        self.assertEqual(stats1["total_factions"], stats2["total_factions"])
        
    def test_cache_file_creation(self):
        """Test that cache file is created correctly."""
        cache = FactionCache(self.temp_dir)
        cache_file = cache.cache_file
        
        # File should not exist initially
        self.assertFalse(os.path.exists(cache_file))
        
        # Store a faction
        cache.store_faction("test", "test theme", {"name": "Test"})
        
        # File should now exist
        self.assertTrue(os.path.exists(cache_file))
        
        # File should contain valid JSON
        with open(cache_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            self.assertIsInstance(data, dict)
            self.assertEqual(len(data), 1)
            
    def test_corrupted_cache_file_handling(self):
        """Test handling of corrupted cache files."""
        cache = FactionCache(self.temp_dir)
        cache_file = cache.cache_file
        
        # Create corrupted cache file
        os.makedirs(os.path.dirname(cache_file), exist_ok=True)
        with open(cache_file, 'w') as f:
            f.write("invalid json content {{{")
            
        # Cache should handle corrupted file gracefully
        result = cache.get_faction("test", "test")
        self.assertIsNone(result)
        
        stats = cache.get_cache_stats()
        self.assertEqual(stats["total_factions"], 0)
        
    def test_missing_cache_directory(self):
        """Test cache creation when directory doesn't exist."""
        missing_dir = os.path.join(self.temp_dir, "missing", "nested", "dir")
        cache = FactionCache(missing_dir)
        
        # Directory should be created
        self.assertTrue(os.path.exists(missing_dir))
        
        # Cache should work normally
        cache.store_faction("test", "test", {"name": "Test"})
        retrieved = cache.get_faction("test", "test")
        self.assertIsNotNone(retrieved)


class TestFactionCacheEdgeCases(unittest.TestCase):
    """Test edge cases and error conditions."""
    
    def setUp(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.cache = FactionCache(self.temp_dir)
        
    def tearDown(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
        
    def test_empty_parameters(self):
        """Test caching with empty or None parameters."""
        # Store with empty strings
        cache_key = self.cache.store_faction("", "", {"name": "Empty"})
        self.assertIsInstance(cache_key, str)
        
        retrieved = self.cache.get_faction("", "")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved["name"], "Empty")
        
    def test_unicode_parameters(self):
        """Test caching with unicode characters."""
        personality = "агрессивный"  # Russian for "aggressive"
        theme = "Замок с рыцарями"  # Russian for "Castle with knights"
        faction_data = {"name": "Русская фракция", "style": "medieval"}
        
        cache_key = self.cache.store_faction(personality, theme, faction_data)
        self.assertIsInstance(cache_key, str)
        
        retrieved = self.cache.get_faction(personality, theme)
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved["name"], "Русская фракция")
        
    def test_large_faction_data(self):
        """Test caching large faction data."""
        large_data = {
            "name": "Large Faction",
            "units": {f"unit_{i}": {"name": f"Unit {i}", "description": "x" * 1000} 
                      for i in range(100)},
            "description": "y" * 10000
        }
        
        cache_key = self.cache.store_faction("large", "Large theme", large_data)
        self.assertIsInstance(cache_key, str)
        
        retrieved = self.cache.get_faction("large", "Large theme")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved["name"], "Large Faction")
        self.assertEqual(len(retrieved["units"]), 100)
        
    def test_special_characters_in_parameters(self):
        """Test parameters with special characters."""
        personality = "test/\\:*?\"<>|"
        theme = "theme with\nnewlines\tand\rtabs"
        faction_data = {"name": "Special Chars"}
        
        cache_key = self.cache.store_faction(personality, theme, faction_data)
        self.assertIsInstance(cache_key, str)
        
        retrieved = self.cache.get_faction(personality, theme)
        self.assertIsNotNone(retrieved)
        
    def test_clear_cache(self):
        """Test cache clearing functionality."""
        # Store some data
        self.cache.store_faction("test1", "theme1", {"name": "Faction1"})
        self.cache.store_faction("test2", "theme2", {"name": "Faction2"})
        
        stats = self.cache.get_cache_stats()
        self.assertEqual(stats["total_factions"], 2)
        
        # Clear cache
        self.cache.clear_cache()
        
        # Cache should be empty
        stats = self.cache.get_cache_stats()
        self.assertEqual(stats["total_factions"], 0)
        
        # Should not be able to retrieve old data
        self.assertIsNone(self.cache.get_faction("test1", "theme1"))
        self.assertIsNone(self.cache.get_faction("test2", "theme2"))


class TestFactionCacheStatistics(unittest.TestCase):
    """Test cache statistics and metadata."""
    
    def setUp(self):
        """Set up test environment."""
        self.temp_dir = tempfile.mkdtemp()
        self.cache = FactionCache(self.temp_dir)
        
    def tearDown(self):
        """Clean up test environment."""
        shutil.rmtree(self.temp_dir, ignore_errors=True)
        
    def test_empty_cache_stats(self):
        """Test statistics for empty cache."""
        stats = self.cache.get_cache_stats()
        self.assertEqual(stats["total_factions"], 0)
        self.assertEqual(stats["personalities"], {})
        self.assertFalse(stats["cache_file_exists"])
        
    def test_cache_stats_with_data(self):
        """Test statistics with cached data."""
        # Store factions with different personalities
        self.cache.store_faction("aggressive", "theme1", {"name": "Faction1"})
        self.cache.store_faction("aggressive", "theme2", {"name": "Faction2"})
        self.cache.store_faction("defensive", "theme3", {"name": "Faction3"})
        
        stats = self.cache.get_cache_stats()
        self.assertEqual(stats["total_factions"], 3)
        self.assertEqual(stats["personalities"]["aggressive"], 2)
        self.assertEqual(stats["personalities"]["defensive"], 1)
        self.assertTrue(stats["cache_file_exists"])
        
    def test_faction_metadata(self):
        """Test faction metadata in listings."""
        import datetime
        
        self.cache.store_faction("warrior", "Battle theme", {"name": "Warriors"})
        
        factions = self.cache.list_cached_factions()
        self.assertEqual(len(factions), 1)
        
        faction = factions[0]
        self.assertEqual(faction["personality_type"], "warrior")
        self.assertEqual(faction["theme_description"], "Battle theme")
        self.assertIn("created_at", faction)
        self.assertIn("cache_key", faction)
        
        # created_at should be a valid ISO datetime string
        created_at = faction["created_at"]
        try:
            datetime.datetime.fromisoformat(created_at)
        except ValueError:
            self.fail(f"created_at '{created_at}' is not a valid ISO datetime")


class TestCachedFactionDataclass(unittest.TestCase):
    """Test the CachedFaction dataclass."""
    
    def test_cached_faction_creation(self):
        """Test creating CachedFaction instances."""
        from dataclasses import asdict
        
        faction = CachedFaction(
            personality_type="test",
            theme_description="test theme",
            faction_data={"name": "Test Faction"},
            created_at="2025-01-01T12:00:00",
            cache_key="test123"
        )
        
        self.assertEqual(faction.personality_type, "test")
        self.assertEqual(faction.theme_description, "test theme")
        self.assertEqual(faction.faction_data["name"], "Test Faction")
        self.assertEqual(faction.created_at, "2025-01-01T12:00:00")
        self.assertEqual(faction.cache_key, "test123")
        
        # Test conversion to dict
        faction_dict = asdict(faction)
        self.assertIsInstance(faction_dict, dict)
        self.assertEqual(faction_dict["personality_type"], "test")


if __name__ == '__main__':
    # Create test suite
    suite = unittest.TestLoader().loadTestsFromModule(__import__(__name__))
    
    # Run tests with detailed output
    runner = unittest.TextTestRunner(verbosity=2, buffer=True)
    result = runner.run(suite)
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"Test Summary:")
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success rate: {((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100):.1f}%")
    
    if result.failures:
        print(f"\nFailures:")
        for test, failure in result.failures:
            print(f"  {test}: {failure}")
            
    if result.errors:
        print(f"\nErrors:")
        for test, error in result.errors:
            print(f"  {test}: {error}")