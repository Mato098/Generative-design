"""Sprite caching and storage system."""
import json
import os
import hashlib
import time
from typing import Dict, List, Optional, Any
from dataclasses import asdict

from entities.sprite import Sprite

class SpriteCache:
    """Cache and storage system for generated sprites."""
    
    def __init__(self, cache_dir: str = "sprite_cache"):
        """Initialize sprite cache."""
        self.cache_dir = cache_dir
        self.memory_cache: Dict[str, Sprite] = {}
        self.cache_metadata: Dict[str, Dict[str, Any]] = {}
        
        # Create cache directory if it doesn't exist
        os.makedirs(cache_dir, exist_ok=True)
        
        # Load existing cache metadata
        self._load_cache_metadata()
    
    def _get_cache_path(self, sprite_id: str) -> str:
        """Get file path for cached sprite."""
        return os.path.join(self.cache_dir, f"{sprite_id}.json")
    
    def _get_metadata_path(self) -> str:
        """Get path for cache metadata."""
        return os.path.join(self.cache_dir, "cache_metadata.json")
    
    def _load_cache_metadata(self) -> None:
        """Load cache metadata from disk."""
        metadata_path = self._get_metadata_path()
        
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    self.cache_metadata = json.load(f)
            except Exception as e:
                print(f"Warning: Could not load cache metadata: {e}")
                self.cache_metadata = {}
    
    def _save_cache_metadata(self) -> None:
        """Save cache metadata to disk."""
        try:
            with open(self._get_metadata_path(), 'w', encoding='utf-8') as f:
                json.dump(self.cache_metadata, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not save cache metadata: {e}")
    
    def _generate_sprite_id(self, sprite: Sprite) -> str:
        """Generate unique ID for sprite based on its content."""
        content = f"{sprite.name}_{sprite.creator_agent_id}_{sprite.validation_hash}"
        return hashlib.md5(content.encode()).hexdigest()[:16]
    
    def store_sprite(self, sprite: Sprite) -> str:
        """Store sprite in cache and return its ID."""
        sprite_id = self._generate_sprite_id(sprite)
        
        # Store in memory cache
        self.memory_cache[sprite_id] = sprite
        
        # Store metadata
        self.cache_metadata[sprite_id] = {
            "name": sprite.name,
            "creator_agent_id": sprite.creator_agent_id,
            "created_at": sprite.created_at,
            "cached_at": time.time(),
            "validation_hash": sprite.validation_hash
        }
        
        # Store to disk
        try:
            sprite_data = sprite.to_dict()
            with open(self._get_cache_path(sprite_id), 'w', encoding='utf-8') as f:
                json.dump(sprite_data, f, indent=2)
            
            # Update metadata file
            self._save_cache_metadata()
            
        except Exception as e:
            print(f"Warning: Could not save sprite to disk: {e}")
        
        return sprite_id
    
    def get_sprite(self, sprite_id: str) -> Optional[Sprite]:
        """Retrieve sprite from cache."""
        # Check memory cache first
        if sprite_id in self.memory_cache:
            return self.memory_cache[sprite_id]
        
        # Load from disk
        cache_path = self._get_cache_path(sprite_id)
        
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    sprite_data = json.load(f)
                
                sprite = Sprite.from_dict(sprite_data)
                
                # Store in memory cache for faster future access
                self.memory_cache[sprite_id] = sprite
                
                return sprite
                
            except Exception as e:
                print(f"Warning: Could not load sprite from cache: {e}")
        
        return None
    
    def find_sprites_by_agent(self, agent_id: str) -> List[str]:
        """Find all sprites created by a specific agent."""
        sprite_ids = []
        
        for sprite_id, metadata in self.cache_metadata.items():
            if metadata.get("creator_agent_id") == agent_id:
                sprite_ids.append(sprite_id)
        
        return sprite_ids
    
    def find_sprites_by_name(self, name_pattern: str) -> List[str]:
        """Find sprites matching a name pattern."""
        sprite_ids = []
        name_pattern_lower = name_pattern.lower()
        
        for sprite_id, metadata in self.cache_metadata.items():
            sprite_name = metadata.get("name", "").lower()
            if name_pattern_lower in sprite_name:
                sprite_ids.append(sprite_id)
        
        return sprite_ids
    
    def list_all_sprites(self) -> Dict[str, Dict[str, Any]]:
        """List all cached sprites with their metadata."""
        return self.cache_metadata.copy()
    
    def clear_cache(self) -> None:
        """Clear all cached sprites."""
        # Clear memory cache
        self.memory_cache.clear()
        
        # Clear disk cache
        for sprite_id in list(self.cache_metadata.keys()):
            cache_path = self._get_cache_path(sprite_id)
            if os.path.exists(cache_path):
                try:
                    os.remove(cache_path)
                except Exception as e:
                    print(f"Warning: Could not delete cached sprite file: {e}")
        
        # Clear metadata
        self.cache_metadata.clear()
        self._save_cache_metadata()
    
    def remove_sprite(self, sprite_id: str) -> bool:
        """Remove a specific sprite from cache."""
        # Remove from memory
        if sprite_id in self.memory_cache:
            del self.memory_cache[sprite_id]
        
        # Remove from disk
        cache_path = self._get_cache_path(sprite_id)
        if os.path.exists(cache_path):
            try:
                os.remove(cache_path)
            except Exception as e:
                print(f"Warning: Could not delete sprite file: {e}")
                return False
        
        # Remove from metadata
        if sprite_id in self.cache_metadata:
            del self.cache_metadata[sprite_id]
            self._save_cache_metadata()
        
        return True
    
    def get_cache_statistics(self) -> Dict[str, Any]:
        """Get cache usage statistics."""
        total_sprites = len(self.cache_metadata)
        memory_sprites = len(self.memory_cache)
        
        # Calculate disk usage
        total_size = 0
        for sprite_id in self.cache_metadata:
            cache_path = self._get_cache_path(sprite_id)
            if os.path.exists(cache_path):
                total_size += os.path.getsize(cache_path)
        
        # Agent statistics
        agents = {}
        for metadata in self.cache_metadata.values():
            agent_id = metadata.get("creator_agent_id", "unknown")
            agents[agent_id] = agents.get(agent_id, 0) + 1
        
        return {
            "total_sprites": total_sprites,
            "memory_cached": memory_sprites,
            "disk_size_bytes": total_size,
            "disk_size_mb": round(total_size / (1024 * 1024), 2),
            "sprites_by_agent": agents,
            "cache_directory": self.cache_dir
        }
    
    def export_sprites(self, export_path: str, sprite_ids: Optional[List[str]] = None) -> bool:
        """Export sprites to a single file."""
        try:
            if sprite_ids is None:
                sprite_ids = list(self.cache_metadata.keys())
            
            export_data = {
                "export_timestamp": time.time(),
                "sprite_count": len(sprite_ids),
                "sprites": {}
            }
            
            for sprite_id in sprite_ids:
                sprite = self.get_sprite(sprite_id)
                if sprite:
                    export_data["sprites"][sprite_id] = sprite.to_dict()
            
            with open(export_path, 'w', encoding='utf-8') as f:
                json.dump(export_data, f, indent=2)
            
            return True
            
        except Exception as e:
            print(f"Error exporting sprites: {e}")
            return False
    
    def import_sprites(self, import_path: str) -> int:
        """Import sprites from an export file."""
        try:
            with open(import_path, 'r', encoding='utf-8') as f:
                import_data = json.load(f)
            
            imported_count = 0
            sprites_data = import_data.get("sprites", {})
            
            for sprite_data in sprites_data.values():
                try:
                    sprite = Sprite.from_dict(sprite_data)
                    self.store_sprite(sprite)
                    imported_count += 1
                except Exception as e:
                    print(f"Warning: Could not import sprite: {e}")
            
            return imported_count
            
        except Exception as e:
            print(f"Error importing sprites: {e}")
            return 0

# Global sprite cache instance
_sprite_cache = None

def get_sprite_cache() -> SpriteCache:
    """Get the global sprite cache instance."""
    global _sprite_cache
    if _sprite_cache is None:
        _sprite_cache = SpriteCache()
    return _sprite_cache