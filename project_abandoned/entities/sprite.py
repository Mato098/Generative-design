"""Sprite data structure and management."""
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Any
import hashlib
import json

@dataclass
class Sprite:
    """Represents a 16x16 pixel sprite with metadata."""
    
    name: str
    description: str
    creator_agent_id: str
    pixel_data: List[List[str]] = field(default_factory=list)  # 16x16 grid of color codes
    color_palette: Dict[str, str] = field(default_factory=dict)  # symbol -> hex color mapping
    created_at: float = 0.0
    _validation_hash: str = field(default="", init=False)
    
    @property
    def validation_hash(self) -> str:
        """Get current validation hash (recalculated each time)."""
        return self._generate_hash()
    
    @validation_hash.setter  
    def validation_hash(self, value: str) -> None:
        """Set validation hash (for backward compatibility)."""
        self._validation_hash = value
    
    def __post_init__(self):
        """Validate sprite dimensions and generate hash."""
        if not self.pixel_data:
            self.pixel_data = [["." for _ in range(16)] for _ in range(16)]
        
        if len(self.pixel_data) != 16 or any(len(row) != 16 for row in self.pixel_data):
            raise ValueError("Sprite must be exactly 16x16 pixels")
            
        if len(self.color_palette) > 8:
            raise ValueError("Sprite cannot have more than 8 colors")
            
        self._validation_hash = self._generate_hash()
    
    def _generate_hash(self) -> str:
        """Generate validation hash for sprite integrity."""
        sprite_data = {
            "name": self.name,
            "pixel_data": self.pixel_data,
            "color_palette": self.color_palette
        }
        return hashlib.md5(json.dumps(sprite_data, sort_keys=True).encode()).hexdigest()
    
    def to_ascii(self, scale: int = 1) -> str:
        """Convert sprite to ASCII representation."""
        result = []
        for row in self.pixel_data:
            ascii_row = ""
            for pixel in row:
                ascii_row += pixel * scale
            for _ in range(scale):
                result.append(ascii_row)
        return "\n".join(result)
    
    def get_pixel(self, x: int, y: int) -> str:
        """Get pixel at coordinates (0-15)."""
        if 0 <= x < 16 and 0 <= y < 16:
            return self.pixel_data[y][x]
        return "."
    
    def set_pixel(self, x: int, y: int, color: str) -> None:
        """Set pixel at coordinates."""
        if 0 <= x < 16 and 0 <= y < 16:
            self.pixel_data[y][x] = color
            self.validation_hash = self._generate_hash()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert sprite to dictionary."""
        return {
            "name": self.name,
            "description": self.description,
            "creator_agent_id": self.creator_agent_id,
            "pixel_data": self.pixel_data,
            "color_palette": self.color_palette,
            "created_at": self.created_at
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Sprite':
        """Create sprite from dictionary."""
        return cls(**data)
    
    def validate_integrity(self) -> bool:
        """Check if sprite data hasn't been corrupted."""
        return self.validation_hash == self._generate_hash()

@dataclass
class SpriteTemplate:
    """Template for generating new sprites."""
    
    base_shape: str  # Description of basic shape
    size_category: str  # "small", "medium", "large"
    primary_colors: List[str]  # Preferred color scheme
    style_hints: List[str]  # ["medieval", "futuristic", "organic", etc.]
    constraints: Dict[str, Any] = field(default_factory=dict)
    
    def to_generation_prompt(self) -> str:
        """Convert template to LLM generation prompt."""
        prompt = f"Create a 16x16 pixel sprite with the following specifications:\n"
        prompt += f"- Base shape: {self.base_shape}\n"
        prompt += f"- Size category: {self.size_category}\n"
        prompt += f"- Primary colors: {', '.join(self.primary_colors)}\n"
        prompt += f"- Style: {', '.join(self.style_hints)}\n"
        
        if self.constraints:
            prompt += f"- Additional constraints: {self.constraints}\n"
            
        prompt += "\nProvide the sprite as a 16x16 grid using ASCII characters."
        return prompt