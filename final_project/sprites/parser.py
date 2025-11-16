"""Sprite parsing and ASCII-to-pixel conversion utilities."""
import re
from typing import Dict, List, Tuple, Optional
from entities.sprite import Sprite

class ASCIISpriteParser:
    """Parses ASCII art and text descriptions into sprite data."""
    
    def __init__(self):
        """Initialize ASCII sprite parser."""
        # Standard ASCII to sprite character mappings
        self.ascii_mappings = {
            ' ': '.',   # Space to transparent
            '.': '.',   # Already transparent
            '#': '#',   # Solid block
            '*': '*',   # Star/detail
            'o': 'o',   # Circle
            'O': 'O',   # Big circle
            'x': 'x',   # Cross
            'X': 'X',   # Big cross
            '+': '+',   # Plus
            '-': '-',   # Horizontal line
            '|': '|',   # Vertical line
            '/': '/',   # Diagonal
            '\\': '\\', # Reverse diagonal
            '^': '^',   # Up arrow
            'v': 'v',   # Down arrow
            '<': '<',   # Left arrow
            '>': '>',   # Right arrow
            '@': '@',   # At symbol
            '%': '%',   # Percent
            '&': '&',   # Ampersand
            '=': '=',   # Equals
            '~': '~',   # Tilde
            ':': ':',   # Colon
            ';': ';',   # Semicolon
            ',': ',',   # Comma
            "'": "'",   # Apostrophe
            '"': '"',   # Quote
        }
    
    def parse_multiline_ascii(self, ascii_text: str) -> List[List[str]]:
        """Parse multi-line ASCII text into a 16x16 grid."""
        lines = ascii_text.strip().split('\n')
        
        # Remove any leading/trailing empty lines
        while lines and not lines[0].strip():
            lines.pop(0)
        while lines and not lines[-1].strip():
            lines.pop()
        
        # Ensure we have exactly 16 lines
        if len(lines) < 16:
            # Pad with empty lines at the bottom
            lines.extend([''] * (16 - len(lines)))
        elif len(lines) > 16:
            # Truncate to first 16 lines
            lines = lines[:16]
        
        grid = []
        for line in lines:
            # Convert line to exactly 16 characters
            if len(line) < 16:
                line += ' ' * (16 - len(line))  # Pad with spaces
            elif len(line) > 16:
                line = line[:16]  # Truncate
            
            # Map ASCII characters
            row = []
            for char in line:
                mapped_char = self.ascii_mappings.get(char, '.')
                row.append(mapped_char)
            
            grid.append(row)
        
        return grid
    
    def extract_sprite_from_text(self, text: str) -> Optional[List[List[str]]]:
        """Extract sprite grid from mixed text content."""
        # Look for common sprite patterns
        patterns = [
            # Pattern 1: Lines starting with consistent characters
            r'^([#*oOxX+\-|/\\^v<>@%&=~:;,\'".\s]{16})$',
            # Pattern 2: Lines within code blocks
            r'```[\s\S]*?```',
            # Pattern 3: Lines with consistent spacing
            r'^(\s*[#*oOxX+\-|/\\^v<>@%&=~:;,\'".\s]{10,}\s*)$'
        ]
        
        # Try to find sprite data in text
        for pattern in patterns:
            matches = re.findall(pattern, text, re.MULTILINE)
            if len(matches) >= 10:  # At least 10 lines found
                sprite_text = '\n'.join(matches)
                grid = self.parse_multiline_ascii(sprite_text)
                if self._validate_grid(grid):
                    return grid
        
        # If no clear pattern, try to extract any lines that look like sprite rows
        lines = text.split('\n')
        sprite_lines = []
        
        for line in lines:
            # Check if line looks like a sprite row
            if self._looks_like_sprite_row(line):
                sprite_lines.append(line)
        
        if len(sprite_lines) >= 8:  # At least half a sprite
            sprite_text = '\n'.join(sprite_lines)
            grid = self.parse_multiline_ascii(sprite_text)
            if self._validate_grid(grid):
                return grid
        
        return None
    
    def _looks_like_sprite_row(self, line: str) -> bool:
        """Check if a line looks like it could be part of a sprite."""
        # Remove leading/trailing whitespace for checking
        stripped = line.strip()
        
        # Must have some content
        if len(stripped) < 4:
            return False
        
        # Count sprite-like characters
        sprite_chars = 0
        for char in stripped:
            if char in self.ascii_mappings or char.isspace():
                sprite_chars += 1
        
        # At least 70% sprite characters
        return (sprite_chars / len(stripped)) >= 0.7
    
    def _validate_grid(self, grid: List[List[str]]) -> bool:
        """Validate that grid is a proper 16x16 sprite."""
        if len(grid) != 16:
            return False
        
        for row in grid:
            if len(row) != 16:
                return False
        
        # Check that it's not completely empty
        non_empty = 0
        for row in grid:
            for cell in row:
                if cell != '.' and cell != ' ':
                    non_empty += 1
        
        return non_empty > 0
    
    def generate_color_palette_from_grid(self, grid: List[List[str]]) -> Dict[str, str]:
        """Generate a color palette from character usage in grid."""
        # Count character usage
        char_counts = {}
        for row in grid:
            for char in row:
                char_counts[char] = char_counts.get(char, 0) + 1
        
        # Sort by usage frequency
        sorted_chars = sorted(char_counts.items(), key=lambda x: x[1], reverse=True)
        
        # Default color mapping based on character types
        default_colors = {
            '.': None,  # Transparent
            ' ': None,  # Transparent
            '#': '#000000',  # Black
            '*': '#404040',  # Dark gray
            'o': '#808080',  # Gray
            'O': '#FFFFFF',  # White
            'x': '#8B4513',  # Brown
            'X': '#654321',  # Dark brown
            '+': '#C0C0C0',  # Silver
            '-': '#696969',  # Dim gray
            '|': '#696969',  # Dim gray
            '/': '#2F4F4F',  # Dark slate gray
            '\\': '#2F4F4F', # Dark slate gray
            '^': '#FF0000',  # Red
            'v': '#00FF00',  # Green
            '<': '#0000FF',  # Blue
            '>': '#FFFF00',  # Yellow
            '@': '#800080',  # Purple
            '%': '#FFA500',  # Orange
            '&': '#FFB6C1',  # Light pink
            '=': '#20B2AA',  # Light sea green
            '~': '#87CEEB',  # Sky blue
        }
        
        palette = {}
        color_count = 0
        max_colors = 8
        
        for char, count in sorted_chars:
            if char in ['.', ' ']:
                continue  # Skip transparent
            
            if color_count >= max_colors:
                break
            
            if char in default_colors:
                palette[char] = default_colors[char]
            else:
                # Generate a color for unmapped characters
                palette[char] = self._generate_color_for_char(char, color_count)
            
            color_count += 1
        
        return palette
    
    def _generate_color_for_char(self, char: str, index: int) -> str:
        """Generate a color for an unmapped character."""
        # Simple color generation based on character and index
        colors = [
            '#800000',  # Maroon
            '#008000',  # Green
            '#000080',  # Navy
            '#800080',  # Purple
            '#008080',  # Teal
            '#808000',  # Olive
            '#C0C0C0',  # Silver
            '#808080'   # Gray
        ]
        
        return colors[index % len(colors)]

def create_sprite_from_ascii(
    name: str,
    ascii_text: str,
    description: str = "",
    creator_agent_id: str = "parser"
) -> Optional[Sprite]:
    """Create a sprite object from ASCII text."""
    parser = ASCIISpriteParser()
    
    # Parse the ASCII into a grid
    grid = parser.extract_sprite_from_text(ascii_text)
    if grid is None:
        grid = parser.parse_multiline_ascii(ascii_text)
    
    if not parser._validate_grid(grid):
        return None
    
    # Generate color palette
    color_palette = parser.generate_color_palette_from_grid(grid)
    
    # Create sprite
    return Sprite(
        name=name,
        description=description,
        creator_agent_id=creator_agent_id,
        pixel_data=grid,
        color_palette=color_palette
    )

def ascii_art_examples() -> Dict[str, str]:
    """Get example ASCII art for different unit types."""
    return {
        "warrior": '''
    ......##........
    .....#**#.......
    ....#*oo*#......
    ...#*o##o*#.....
    ..#**####**#....
    .#************#.
    #**#******#**#..
    #*#********#*#..
    #*#**####**#*#..
    #*#**#..#**#*#..
    #*#**#..#**#*#..
    .#***#..#***#...
    ..###....###....
    ..#........#....
    ..#........#....
    ................
''',
        "archer": '''
    ................
    .......##.......
    ......#**#......
    .....#*oo*#.....
    ....#**##**#....
    ...#********#...
    ..#**#****#**#..
    .#*#******#*#...
    #*#***##***#*#..
    #*#**#..#**#*#..
    #*#*#....#*#*#..
    .#*#......#*#...
    ..##......##....
    ..#........#....
    ..............#.
    ...............#
''',
        "cavalry": '''
    ......##........
    .....#**#.......
    ....#*oo*#......
    ...#**##**#.....
    ..#********#....
    .#**#****#**#...
    #**#******#**#..
    #*#***##***#*#..
    ##***####***##..
    #***#*##*#***#..
    #**#******#**#..
    #*#**####**#*#..
    ##**######**##..
    .#**#****#**#...
    ..###....###....
    ................
'''
    }