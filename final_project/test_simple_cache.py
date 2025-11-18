"""
Simple test for the new faction cache system.
"""

import json
import os
import tempfile
from data.cache.faction_cache import FactionCache


def test_basic_caching():
    """Test basic cache store and retrieve functionality."""
    print("🧪 Testing basic cache functionality...")
    
    # Create cache with temporary directory
    with tempfile.TemporaryDirectory() as temp_dir:
        cache = FactionCache(temp_dir)
        
        # Test data
        personality = "aggressive"
        theme = "Roman legion with imperial eagles"
        faction_data = {
            "name": "Imperial Legion",
            "units": {
                "legionnaire": {"name": "Legionnaire", "type": "infantry"},
                "centurion": {"name": "Centurion", "type": "leader"}
            },
            "description": "Elite Roman military force"
        }
        
        # Store faction
        cache_key = cache.store_faction(personality, theme, faction_data)
        print(f"   ✅ Stored faction with key: {cache_key}")
        
        # Retrieve exact match
        retrieved = cache.get_faction(personality, theme)
        assert retrieved is not None, "Should retrieve exact match"
        assert retrieved["name"] == "Imperial Legion", "Retrieved data should match"
        print("   ✅ Exact match retrieval works")
        
        # Try similar faction
        similar = cache.get_similar_faction(personality)
        assert similar is not None, "Should find similar faction"
        assert similar["name"] == "Imperial Legion", "Similar faction should match"
        print("   ✅ Similar faction retrieval works")
        
        # Test no match
        no_match = cache.get_faction("peaceful", "Elven forest")
        assert no_match is None, "Should not match different parameters"
        print("   ✅ No false matches")
        
        # Test cache stats
        stats = cache.get_cache_stats()
        assert stats["total_factions"] == 1, "Should have 1 faction"
        assert "aggressive" in stats["personalities"], "Should track personality"
        print("   ✅ Cache statistics work")
        
        # Test listing
        factions = cache.list_cached_factions()
        assert len(factions) == 1, "Should list 1 faction"
        assert factions[0]["personality_type"] == "aggressive", "Should list correct personality"
        print("   ✅ Faction listing works")


def test_multiple_factions():
    """Test caching multiple factions."""
    print("🧪 Testing multiple faction caching...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        cache = FactionCache(temp_dir)
        
        factions = [
            ("aggressive", "Roman empire", {"name": "Roman Empire"}),
            ("aggressive", "Viking raiders", {"name": "Viking Clan"}),
            ("defensive", "Medieval castle", {"name": "Castle Guard"}),
            ("peaceful", "Merchant guild", {"name": "Trade Guild"})
        ]
        
        # Store all factions
        for personality, theme, data in factions:
            cache.store_faction(personality, theme, data)
        
        # Test retrieval
        roman = cache.get_faction("aggressive", "Roman empire")
        assert roman["name"] == "Roman Empire", "Should retrieve Roman faction"
        
        viking = cache.get_faction("aggressive", "Viking raiders")
        assert viking["name"] == "Viking Clan", "Should retrieve Viking faction"
        
        # Test similar faction (should get any aggressive faction)
        similar = cache.get_similar_faction("aggressive")
        assert similar is not None, "Should find aggressive faction"
        assert similar["name"] in ["Roman Empire", "Viking Clan"], "Should be one of the aggressive factions"
        
        # Test stats
        stats = cache.get_cache_stats()
        assert stats["total_factions"] == 4, "Should have 4 factions"
        assert stats["personalities"]["aggressive"] == 2, "Should have 2 aggressive factions"
        assert stats["personalities"]["defensive"] == 1, "Should have 1 defensive faction"
        assert stats["personalities"]["peaceful"] == 1, "Should have 1 peaceful faction"
        
        print("   ✅ Multiple faction caching works")


def test_cache_persistence():
    """Test that cache persists across instances."""
    print("🧪 Testing cache persistence...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create cache and store data
        cache1 = FactionCache(temp_dir)
        cache1.store_faction("warrior", "Battle-hardened veterans", {"name": "Veterans"})
        
        # Create new cache instance with same directory
        cache2 = FactionCache(temp_dir)
        
        # Should be able to retrieve from new instance
        retrieved = cache2.get_faction("warrior", "Battle-hardened veterans")
        assert retrieved is not None, "Should persist across instances"
        assert retrieved["name"] == "Veterans", "Should retrieve correct data"
        
        print("   ✅ Cache persistence works")


def run_all_tests():
    """Run all cache tests."""
    print("🚀 Starting Simple Cache Tests\n")
    
    try:
        test_basic_caching()
        test_multiple_factions()
        test_cache_persistence()
        
        print("\n" + "="*50)
        print("🎉 All tests passed!")
        print("✅ Cache system is working correctly")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        raise


if __name__ == "__main__":
    run_all_tests()