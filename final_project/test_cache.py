#!/usr/bin/env python3
"""Test cache functionality."""

from data.cache.faction_cache import FactionCache

def test_cache():
    # Create test cache
    cache = FactionCache()
    
    # Store test faction
    test_faction = {
        'faction_name': 'Test Empire',
        'faction_theme': 'medieval kingdom',
        'faction_description': 'A mighty kingdom with stone walls',
        'units': [{'name': 'Knight', 'type': 'melee', 'cost': 50}]
    }
    
    cache.store_faction('aggressive', 'medieval theme', test_faction)
    print('✅ Stored test faction')
    
    # Try to retrieve
    result = cache.get_faction('aggressive', 'medieval theme')
    if result:
        print('✅ Cache retrieval working!')
        print(f'Faction name: {result.get("faction_name", "unknown")}')
    else:
        print('❌ Cache retrieval failed')
        
    # List all cached factions
    factions = cache.list_cached_factions()
    print(f'Total cached factions: {len(factions)}')
    
    # Test complete faction storage
    print('\n--- Testing complete faction storage ---')
    faction_data = test_faction
    units_data = [{'name': 'Knight', 'cost': 50}, {'name': 'Archer', 'cost': 30}]
    sprites_data = {'knight_sprite': 'ascii_art_here', 'archer_sprite': 'bow_art_here'}
    
    cache.store_complete_faction('aggressive', faction_data, units_data, sprites_data)
    print('✅ Stored complete faction data')
    
    complete_result = cache.get_complete_faction('aggressive')
    if complete_result:
        print('✅ Complete faction retrieval working!')
        print(f'Complete result keys: {list(complete_result.keys())}')
        for key, value in complete_result.items():
            print(f'  {key}: {type(value)}')
    else:
        print('❌ Complete faction retrieval failed')

if __name__ == '__main__':
    test_cache()