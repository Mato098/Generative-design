# Sprite Generation Caching Guide

The game already has a built-in caching system that you can control through environment variables!

## 🎛️ Cache Control (Environment Variables)

Set these in your `.env` file or PowerShell session:

```bash
# Enable/disable sprite caching (default: true)
SPRITE_CACHE_ENABLED=true

# Cache mode: exact, similar, or random (default: similar)
SPRITE_CACHE_MODE=similar

# Save new generations to cache (default: true) 
CACHE_SAVE_ENABLED=true

# Faction caching (also available)
FACTION_CACHE_ENABLED=true
FACTION_CACHE_MODE=similar
```

## 💰 Common Scenarios

### Development (Save API Costs)
```bash
SPRITE_CACHE_ENABLED=true
SPRITE_CACHE_MODE=similar
CACHE_SAVE_ENABLED=true
```

### Testing (Don't Modify Cache)
```bash
SPRITE_CACHE_ENABLED=true
SPRITE_CACHE_MODE=exact
CACHE_SAVE_ENABLED=false
```

### Production (Fresh Content)
```bash
SPRITE_CACHE_ENABLED=false
SPRITE_CACHE_MODE=exact
CACHE_SAVE_ENABLED=true
```

## 🔧 PowerShell Quick Commands

```powershell
# Disable caching for this session (expensive!)
$env:SPRITE_CACHE_ENABLED="false"

# Enable aggressive caching (cheap!)
$env:SPRITE_CACHE_MODE="random"

# Disable saving to cache
$env:CACHE_SAVE_ENABLED="false"

# Run your script
python main.py
```

## 📋 Cache Modes Explained

- **exact**: Only use cache if personality + theme exactly match
- **similar**: Try exact first, then any faction with same personality
- **random**: Use any cached faction with matching personality

## 📁 Cache Location

Sprites are cached in `data/cache/factions.json`

## ✅ Current Status

The sprite generator now automatically respects these environment variables, so you don't need to change any code - just set the environment variables and go!