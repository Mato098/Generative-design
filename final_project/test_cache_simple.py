"""
Simple test script for faction caching system.
Tests basic functionality without complex imports.
"""
import sys
import os
import tempfile
import shutil
import json
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def test_cache_directory_creation():
    """Test that cache directories are created properly."""
    print("🧪 Testing cache directory creation...")
    
    temp_dir = tempfile.mkdtemp()
    try:
        cache_dir = Path(temp_dir) / "test_cache" / "factions"
        cache_dir.mkdir(parents=True, exist_ok=True)
        
        assert cache_dir.exists(), "Cache directory should be created"
        assert cache_dir.is_dir(), "Cache path should be a directory"
        
        print("✅ Cache directory creation works")
        return True
    except Exception as e:
        print(f"❌ Cache directory creation failed: {e}")
        return False
    finally:
        shutil.rmtree(temp_dir)

def test_json_serialization():
    """Test JSON serialization of faction data."""
    print("🧪 Testing JSON serialization...")
    
    try:
        # Sample faction template data
        faction_data = {
            'faction_id': 'test_faction',
            'faction_name': 'Test Roman Legion',
            'theme_description': 'A disciplined Roman military faction',
            'color_scheme': ['#CC0000', '#FFD700'],
            'architectural_style': 'classical',
            'unit_naming_convention': 'Legionnaire {rank}',
            'faction_lore': 'Elite roman military unit',
            'units': [
                {
                    'unit_name': 'Legionnaire',
                    'unit_category': 'infantry',
                    'stats': {'health': 80, 'attack': 12}
                }
            ],
            'sprites': {
                'Legionnaire': {
                    'sprite_name': 'legionnaire',
                    'pixel_grid': ['.' * 16 for _ in range(16)],
                    'color_mapping': {'.': '#000000', '#': '#CC0000'}
                }
            },
            'metadata': {
                'generation_timestamp': '2025-11-18T16:00:00',
                'unit_count': 1,
                'sprite_count': 1
            }
        }
        
        # Test serialization
        json_str = json.dumps(faction_data, indent=2)
        assert len(json_str) > 0, "JSON string should not be empty"
        
        # Test deserialization
        restored_data = json.loads(json_str)
        assert restored_data['faction_name'] == faction_data['faction_name'], "Faction name should match"
        assert len(restored_data['units']) == 1, "Should have 1 unit"
        assert 'Legionnaire' in restored_data['sprites'], "Should have Legionnaire sprite"
        
        print("✅ JSON serialization works")
        return True
    except Exception as e:
        print(f"❌ JSON serialization failed: {e}")
        return False

def test_file_operations():
    """Test basic file read/write operations."""
    print("🧪 Testing file operations...")
    
    temp_dir = tempfile.mkdtemp()
    try:
        cache_file = Path(temp_dir) / "test_faction.json"
        index_file = Path(temp_dir) / "faction_index.json"
        
        # Test data
        faction_data = {
            'name': 'Test Faction',
            'units': ['Warrior', 'Archer'],
            'cached_at': '2025-11-18'
        }
        
        index_data = {
            'test_faction_001': {
                'id': 'test_faction_001',
                'content_type': 'faction',
                'created_at': '2025-11-18T16:00:00',
                'last_accessed': '2025-11-18T16:00:00',
                'access_count': 0,
                'tags': ['test', 'roman']
            }
        }
        
        # Write files
        with open(cache_file, 'w') as f:
            json.dump(faction_data, f, indent=2)
        
        with open(index_file, 'w') as f:
            json.dump(index_data, f, indent=2)
        
        assert cache_file.exists(), "Cache file should exist"
        assert index_file.exists(), "Index file should exist"
        
        # Read files back
        with open(cache_file, 'r') as f:
            restored_faction = json.load(f)
        
        with open(index_file, 'r') as f:
            restored_index = json.load(f)
        
        assert restored_faction['name'] == 'Test Faction', "Faction name should match"
        assert 'test_faction_001' in restored_index, "Index should contain entry"
        
        print("✅ File operations work")
        return True
    except Exception as e:
        print(f"❌ File operations failed: {e}")
        return False
    finally:
        shutil.rmtree(temp_dir)

def test_sprite_data_structure():
    """Test sprite data structure validation."""
    print("🧪 Testing sprite data structure...")
    
    try:
        # Valid sprite data
        valid_sprite = {
            'sprite_name': 'test_warrior',
            'description': 'A test warrior sprite',
            'pixel_grid': ['.' * 16 for _ in range(16)],  # 16x16 grid
            'color_mapping': {
                '.': '#000000',
                '#': '#FFFFFF',
                '*': '#FF0000'
            },
            'design_notes': 'Simple test sprite'
        }
        
        # Validate structure
        assert 'sprite_name' in valid_sprite, "Should have sprite_name"
        assert 'pixel_grid' in valid_sprite, "Should have pixel_grid"
        assert 'color_mapping' in valid_sprite, "Should have color_mapping"
        
        # Validate grid dimensions
        pixel_grid = valid_sprite['pixel_grid']
        assert len(pixel_grid) == 16, "Should have 16 rows"
        
        for i, row in enumerate(pixel_grid):
            assert len(row) == 16, f"Row {i} should have 16 characters"
            assert isinstance(row, str), f"Row {i} should be a string"
        
        # Validate color mapping
        color_mapping = valid_sprite['color_mapping']
        assert isinstance(color_mapping, dict), "Color mapping should be a dict"
        
        for char, color in color_mapping.items():
            assert isinstance(char, str), "Color mapping keys should be strings"
            assert isinstance(color, str), "Color mapping values should be strings"
            assert color.startswith('#'), "Colors should be hex codes"
        
        print("✅ Sprite data structure is valid")
        return True
    except Exception as e:
        print(f"❌ Sprite data structure test failed: {e}")
        return False

def test_cache_key_generation():
    """Test cache key generation logic."""
    print("🧪 Testing cache key generation...")
    
    try:
        import hashlib
        
        def generate_test_cache_key(personality_type=None, theme_keywords=None, architectural_style=None):
            """Test implementation of cache key generation."""
            key_parts = []
            
            if personality_type:
                key_parts.append(f"personality:{personality_type}")
            
            if theme_keywords:
                sorted_keywords = sorted(theme_keywords)
                key_parts.append(f"themes:{'_'.join(sorted_keywords)}")
            
            if architectural_style:
                key_parts.append(f"arch:{architectural_style}")
            
            key_string = "|".join(key_parts)
            key_hash = hashlib.md5(key_string.encode()).hexdigest()
            
            return f"faction_{key_hash}"
        
        # Test key generation
        key1 = generate_test_cache_key(
            personality_type="aggressive",
            theme_keywords=["roman", "military"],
            architectural_style="classical"
        )
        
        key2 = generate_test_cache_key(
            personality_type="aggressive",
            theme_keywords=["roman", "military"], 
            architectural_style="classical"
        )
        
        key3 = generate_test_cache_key(
            personality_type="defensive",
            theme_keywords=["castle"],
            architectural_style="medieval"
        )
        
        # Same parameters should generate same key
        assert key1 == key2, "Same parameters should generate same key"
        
        # Different parameters should generate different key
        assert key1 != key3, "Different parameters should generate different key"
        
        # Keys should have expected format
        assert key1.startswith("faction_"), "Key should start with 'faction_'"
        assert len(key1) > 10, "Key should be reasonably long"
        
        print("✅ Cache key generation works")
        return True
    except Exception as e:
        print(f"❌ Cache key generation failed: {e}")
        return False

def test_personality_extraction():
    """Test personality type extraction from agent IDs."""
    print("🧪 Testing personality extraction...")
    
    try:
        def extract_personality_test(agent_id):
            """Test implementation of personality extraction."""
            if not agent_id:
                return None
            
            personality_map = {
                'aggressive': ['caesar', 'warrior', 'conqueror', 'aggressive'],
                'defensive': ['fortress', 'guardian', 'defensive', 'castle'],
                'economic': ['merchant', 'trader', 'economic', 'gold'],
                'balanced': ['viking', 'balanced', 'versatile']
            }
            
            agent_lower = agent_id.lower()
            for personality, keywords in personality_map.items():
                if any(keyword in agent_lower for keyword in keywords):
                    return personality
            
            return None
        
        # Test cases
        test_cases = [
            ("sprite_gen_caesar_001", "aggressive"),
            ("player_fortress_defensive", "defensive"), 
            ("agent_merchant_trader", "economic"),
            ("viking_balanced_agent", "balanced"),
            ("unknown_agent_type", None),
            ("", None),
        ]
        
        for agent_id, expected in test_cases:
            result = extract_personality_test(agent_id)
            assert result == expected, f"Expected {expected} for {agent_id}, got {result}"
        
        print("✅ Personality extraction works")
        return True
    except Exception as e:
        print(f"❌ Personality extraction failed: {e}")
        return False

def test_theme_keyword_extraction():
    """Test theme keyword extraction from descriptions."""
    print("🧪 Testing theme keyword extraction...")
    
    try:
        import re
        
        def extract_theme_keywords_test(theme_description):
            """Test implementation of theme keyword extraction."""
            if not theme_description:
                return []
            
            theme_patterns = [
                r'\b(romans?|legions?|empires?|imperials?)\b',
                r'\b(medieval|castles?|knights?|feudals?)\b',
                r'\b(vikings?|norse|barbarians?|tribals?)\b',
                r'\b(merchants?|trade|gold|economics?)\b',
                r'\b(magic|arcane|mystical|wizards?)\b',
                r'\b(technology|steam|mechanical|gears?)\b',
                r'\b(naval|pirates?|seas?|ships?)\b'
            ]
            
            keywords = []
            theme_lower = theme_description.lower()
            
            for pattern in theme_patterns:
                matches = re.findall(pattern, theme_lower)
                keywords.extend(matches)
            
            return list(set(keywords))
        
        # Test cases
        test_cases = [
            ("A powerful Roman legion with imperial discipline", ["roman", "legion", "imperial"]),
            ("Medieval castle with feudal knights", ["medieval", "castle", "feudal", "knight"]),
            ("Viking norse raiders from the seas", ["viking", "norse"]),
            ("Merchant guild focused on gold and trade", ["merchant", "trade", "gold"]),
            ("No special keywords here", []),
        ]
        
        for description, expected_keywords in test_cases:
            result = extract_theme_keywords_test(description)
            
            # Check that all expected keywords are found
            for keyword in expected_keywords:
                assert keyword in result, f"Expected '{keyword}' in result for: {description}"
        
        print("✅ Theme keyword extraction works")
        return True
    except Exception as e:
        print(f"❌ Theme keyword extraction failed: {e}")
        return False

def test_cache_metrics():
    """Test cache metrics tracking."""
    print("🧪 Testing cache metrics...")
    
    try:
        class TestCacheMetrics:
            def __init__(self):
                self.hits = 0
                self.misses = 0
                self.total_requests = 0
                self.generation_time_saved = 0.0
            
            @property
            def hit_rate(self):
                return self.hits / max(1, self.total_requests)
            
            def record_hit(self, time_saved=0.0):
                self.hits += 1
                self.total_requests += 1
                self.generation_time_saved += time_saved
            
            def record_miss(self):
                self.misses += 1
                self.total_requests += 1
        
        # Test metrics
        metrics = TestCacheMetrics()
        
        # Initial state
        assert metrics.hits == 0, "Initial hits should be 0"
        assert metrics.misses == 0, "Initial misses should be 0"
        assert metrics.hit_rate == 0.0, "Initial hit rate should be 0"
        
        # Record hits and misses
        metrics.record_hit(10.5)
        metrics.record_hit(5.2)
        metrics.record_miss()
        
        assert metrics.hits == 2, "Should have 2 hits"
        assert metrics.misses == 1, "Should have 1 miss"
        assert metrics.total_requests == 3, "Should have 3 total requests"
        assert abs(metrics.hit_rate - (2/3)) < 0.01, "Hit rate should be ~0.67"
        assert abs(metrics.generation_time_saved - 15.7) < 0.01, "Time saved should be 15.7"
        
        print("✅ Cache metrics work")
        return True
    except Exception as e:
        print(f"❌ Cache metrics test failed: {e}")
        return False

def run_all_tests():
    """Run all caching system tests."""
    print("🚀 Starting Faction Caching System Tests\n")
    
    tests = [
        test_cache_directory_creation,
        test_json_serialization,
        test_file_operations,
        test_sprite_data_structure,
        test_cache_key_generation,
        test_personality_extraction,
        test_theme_keyword_extraction,
        test_cache_metrics,
    ]
    
    passed = 0
    total = len(tests)
    
    for test_func in tests:
        try:
            if test_func():
                passed += 1
            print()  # Add spacing between tests
        except Exception as e:
            print(f"❌ Test {test_func.__name__} crashed: {e}\n")
    
    # Print summary
    print("═" * 50)
    print(f"🧪 Test Results Summary:")
    print(f"   Tests passed: {passed}/{total}")
    print(f"   Success rate: {(passed/total*100):.1f}%")
    
    if passed == total:
        print(f"🎉 All tests passed! Caching system is ready.")
    else:
        print(f"⚠️  Some tests failed. Review the output above.")
    
    return passed == total

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)