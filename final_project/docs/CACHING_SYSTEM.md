# Faction Caching System Documentation

## Overview

The faction caching system stores complete LLM responses for faction creation, unit designs, and sprite generation. This allows the game to reuse previously generated content instead of calling expensive LLM APIs repeatedly.

## Architecture

The caching system consists of:
- **FactionCache**: Core cache storage and retrieval
- **PlayerAgent**: Cache integration for faction creation  
- **SpriteGenerator**: Cache integration for sprite generation
- **Configuration**: Environment-based cache settings

## Configuration

Set these environment variables in your shell or `.env` file:

```bash
# Enable/disable faction caching
FACTION_CACHE_ENABLED=true

# Cache retrieval mode: "exact", "similar", "random"
FACTION_CACHE_MODE=similar

# Enable/disable sprite caching
SPRITE_CACHE_ENABLED=true

# Sprite cache mode
SPRITE_CACHE_MODE=similar
```

### Cache Modes

- **exact**: Only use cache entries that exactly match personality + theme
- **similar**: Use entries with matching personality (fallback to any theme)
- **random**: Use any cached entry with matching personality

## Usage Examples

### Basic Cache Operations

```python
from data.cache.faction_cache import FactionCache

# Initialize cache
cache = FactionCache()

# Store a faction
faction_data = {
    'faction_name': 'Iron Legion',
    'faction_theme': 'steampunk empire',
    'faction_description': 'Mechanical warriors with steam technology',
    'units': [...]
}
cache.store_faction('aggressive', 'steampunk theme', faction_data)

# Retrieve a faction
result = cache.get_faction('aggressive', 'steampunk theme')
if result:
    print(f"Found cached faction: {result['faction_name']}")
```

### Complete Faction Caching

```python
# Store complete faction (faction + units + sprites)
faction_data = {...}  # LLM response for faction creation
units_data = [...]    # LLM responses for unit designs  
sprites_data = {...}  # Generated sprite data

cache.store_complete_faction('aggressive', faction_data, units_data, sprites_data)

# Retrieve complete faction
complete = cache.get_complete_faction('aggressive')
if complete:
    faction_name = complete['faction_name']
    units = complete['units']
```

### Integration with PlayerAgent

```python
from agents.player_agent import PlayerAgent

# Create agent with caching enabled
agent = PlayerAgent(
    agent_id="player_1",
    personality_index=0,
    use_faction_cache=True,
    faction_cache_mode="similar"
)

# Agent will automatically try cache before LLM calls
faction = await agent.handle_faction_setup()
```

### Integration with SpriteGenerator  

```python
from sprites.generator import SpriteGenerator

# Create generator with caching enabled
generator = SpriteGenerator(
    agent_id="sprite_gen_1",
    use_cache=True,
    cache_mode="similar",
    save_to_cache=True
)

# Generator will check cache before calling LLM
sprite = await generator.generate_unit_sprite(unit_data)
```

## Cache Storage Format

### Individual Faction Cache

```json
{
  "cache_key_hash": {
    "personality_type": "aggressive",
    "theme_description": "steampunk empire",
    "faction_data": {
      "faction_name": "Iron Legion",
      "faction_theme": "steampunk empire",
      // ... complete LLM response
    },
    "created_at": "2025-11-18T17:30:00",
    "cache_key": "abc123..."
  }
}
```

### Complete Faction Cache

```json
{
  "complete_faction_key": {
    "personality_type": "aggressive", 
    "faction_creation_data": {...},  // Original faction LLM response
    "unit_designs_data": [...],      // List of unit design LLM responses
    "sprites_data": {...},           // Generated sprites
    "theme_description": "...",
    "created_at": "2025-11-18T17:30:00"
  }
}
```

## Cache Files Location

- Faction cache: `data/cache/factions.json`
- Complete factions: `data/cache/complete_factions.json` 
- Sprite cache: `data/cache/sprites.json`

## Performance Benefits

### With Cache Disabled
```
Faction Creation: ~30-60 seconds (LLM calls)
Unit Design: ~20-40 seconds per unit (LLM calls) 
Sprite Generation: ~15-30 seconds per unit (LLM calls)
Total: ~2-5 minutes for complete faction
```

### With Cache Enabled
```
Faction Creation: ~0.1 seconds (cache lookup)
Unit Design: ~0.1 seconds (cache lookup)
Sprite Generation: ~0.1 seconds (cache lookup) 
Total: ~0.3 seconds for complete faction
```

## Cache Behavior

1. **First Run**: No cache entries exist, all content generated via LLM
2. **Subsequent Runs**: Cache entries used based on cache mode
3. **Cache Miss**: Falls back to LLM generation and stores result
4. **Cache Hit**: Returns stored content immediately

## Testing Cache

Run the test script to verify cache functionality:

```bash
python test_cache.py
```

Expected output:
```
✅ Stored test faction
✅ Cache retrieval working!
Faction name: Test Empire
Total cached factions: 1

--- Testing complete faction storage ---
✅ Stored complete faction data
✅ Complete faction retrieval working!
```

## Troubleshooting

### Cache Not Working
- Check `FACTION_CACHE_ENABLED=true` is set
- Verify cache directory exists: `data/cache/`
- Check file permissions on cache directory

### Cache Always Misses
- Verify personality types match exactly
- Check cache mode configuration
- Use `cache.list_cached_factions()` to see available entries

### Performance Issues
- Large cache files can slow lookups
- Consider clearing cache: `rm data/cache/*.json`
- Reduce cache retention (manually delete old entries)

## Extension Points

### Custom Cache Keys
Override `_generate_cache_key()` in FactionCache for custom matching logic.

### Custom Storage Backend  
Implement alternative storage (database, cloud) by overriding `_load_cache()` and `_save_cache()`.

### Cache Expiration
Add timestamp-based expiration by modifying retrieval methods.

## Best Practices

1. **Enable caching in development** to speed up testing
2. **Use "similar" mode** for best balance of variety and performance  
3. **Clear cache periodically** to ensure fresh content generation
4. **Monitor cache file sizes** - they can grow large over time
5. **Backup cache files** if you want to preserve generated content

## Integration Checklist

- [ ] Set environment variables for cache configuration
- [ ] Initialize PlayerAgent with cache parameters
- [ ] Initialize SpriteGenerator with cache parameters  
- [ ] Verify cache directory exists and is writable
- [ ] Test with `python test_cache.py`
- [ ] Run demo to confirm cache integration: `python main.py --demo`