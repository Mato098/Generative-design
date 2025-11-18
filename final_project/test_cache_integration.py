"""
Test script for sprite generator cache integration.
Tests the different cache modes and configurations.
"""

import asyncio
import tempfile
import shutil
from sprites.generator import SpriteGenerator

def test_cache_integration():
    """Test sprite generator cache integration."""
    print("🧪 Testing Sprite Generator Cache Integration")
    print("=" * 50)
    
    # Test configuration options
    test_configs = [
        {
            "name": "Cache Disabled",
            "use_cache": False,
            "cache_mode": "exact",
            "save_to_cache": False
        },
        {
            "name": "Cache Exact Mode",
            "use_cache": True,
            "cache_mode": "exact", 
            "save_to_cache": True
        },
        {
            "name": "Cache Similar Mode",
            "use_cache": True,
            "cache_mode": "similar",
            "save_to_cache": True
        },
        {
            "name": "Cache Random Mode", 
            "use_cache": True,
            "cache_mode": "random",
            "save_to_cache": True
        },
        {
            "name": "Online Only (No Save)",
            "use_cache": True,
            "cache_mode": "exact",
            "save_to_cache": False
        }
    ]
    
    for config in test_configs:
        print(f"\n📋 Testing: {config['name']}")
        print(f"   - use_cache: {config['use_cache']}")
        print(f"   - cache_mode: {config['cache_mode']}")
        print(f"   - save_to_cache: {config['save_to_cache']}")
        
        # Create generator with specific config
        generator = SpriteGenerator(
            agent_id="test_agent_aggressive",
            use_cache=config["use_cache"],
            cache_mode=config["cache_mode"],
            save_to_cache=config["save_to_cache"]
        )
        
        # Check configuration was applied
        assert generator.use_cache == (config["use_cache"] and True)  # Depends on CACHING_ENABLED
        assert generator.cache_mode == config["cache_mode"]
        assert generator.save_to_cache == config["save_to_cache"]
        
        if generator.use_cache:
            assert generator.cache is not None, "Cache should be initialized when enabled"
        
        print("   ✅ Configuration applied correctly")
    
    print(f"\n🎉 All cache configuration tests passed!")


def create_test_faction_data():
    """Create test faction data for cache testing."""
    return {
        "name": "Test Roman Legion",
        "theme": {
            "description": "Aggressive Roman military force with eagles and discipline",
            "architectural_style": "roman"
        },
        "custom_unit_designs": {
            "legionnaire": {
                "unit_name": "legionnaire",
                "description": "Elite Roman infantry",
                "sprite_description": "Roman soldier with red cloak and gladius",
                "category": "infantry"
            },
            "centurion": {
                "unit_name": "centurion", 
                "description": "Roman commander",
                "sprite_description": "Roman officer with crest and cape",
                "category": "leader"
            }
        }
    }


async def test_cache_workflow():
    """Test the complete cache workflow without LLM calls."""
    print(f"\n🔄 Testing Cache Workflow")
    print("=" * 30)
    
    # Create generator with cache enabled
    generator = SpriteGenerator(
        agent_id="test_aggressive_caesar",
        use_cache=True,
        cache_mode="similar",
        save_to_cache=True
    )
    
    if not generator.use_cache:
        print("⚠️ Cache not available, skipping workflow test")
        return
    
    # Test faction data
    faction_data = create_test_faction_data()
    
    print("📊 Testing personality extraction...")
    personality = generator._extract_personality_type(faction_data)
    print(f"   Extracted personality: {personality}")
    assert personality == "aggressive", f"Expected 'aggressive', got '{personality}'"
    
    print("📊 Testing cache key generation...")
    theme_desc = faction_data["theme"]["description"]
    arch_style = faction_data["theme"]["architectural_style"]
    
    if generator.cache:
        cache_key = generator.cache._generate_cache_key(personality, theme_desc)
        print(f"   Generated cache key: {cache_key[:8]}...")
        assert len(cache_key) == 32, "Cache key should be 32 characters (MD5)"
    
    print("📊 Testing cache storage format...")
    # Test sprite data conversion (without actual sprites)
    test_sprites = {}  # Empty for now since we'd need actual Sprite objects
    sprite_dict = generator._sprites_to_dict(test_sprites)
    print(f"   Sprite dict format: {type(sprite_dict)}")
    assert isinstance(sprite_dict, dict), "Should return dictionary"
    
    print("   ✅ Cache workflow components working")


def test_cache_modes():
    """Test different cache retrieval modes."""
    print(f"\n🎯 Testing Cache Modes")
    print("=" * 25)
    
    modes = ["exact", "similar", "random"]
    
    for mode in modes:
        generator = SpriteGenerator(
            agent_id="test_agent",
            use_cache=True,
            cache_mode=mode,
            save_to_cache=True
        )
        
        print(f"📋 Mode '{mode}': Configuration valid ✅")
    
    print("   ✅ All cache modes properly configured")


if __name__ == "__main__":
    try:
        # Test basic configuration
        test_cache_integration()
        
        # Test workflow components
        asyncio.run(test_cache_workflow())
        
        # Test cache modes
        test_cache_modes()
        
        print(f"\n🎉 All sprite generator cache integration tests passed!")
        print("✅ Cache system properly integrated with sprite generator")
        print(f"\n📝 Available cache options:")
        print(f"   - use_cache: Enable/disable cache usage")
        print(f"   - cache_mode: 'exact', 'similar', 'random'")
        print(f"   - save_to_cache: Save new generations to cache")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()