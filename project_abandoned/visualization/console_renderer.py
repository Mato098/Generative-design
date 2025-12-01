"""Console-based text renderer for game visualization."""
import os
import sys
from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass

from visualization.interface import RendererInterface, RenderContext, UIElement, InfoPanel, StatusBar
from entities.sprite import Sprite
from entities.unit import Unit
from entities.tile import Tile

class ConsoleRenderer(RendererInterface):
    """Text-based console renderer for the game."""
    
    def __init__(self, context: RenderContext):
        """Initialize console renderer."""
        super().__init__(context)
        self.screen_buffer: List[List[str]] = []
        self.color_buffer: List[List[str]] = []
        self.ascii_sprites: Dict[str, List[str]] = {}
        
        # Console color codes (ANSI)
        self.colors = {
            'black': '\033[30m',
            'red': '\033[31m',
            'green': '\033[32m',
            'yellow': '\033[33m',
            'blue': '\033[34m',
            'magenta': '\033[35m',
            'cyan': '\033[36m',
            'white': '\033[37m',
            'bright_black': '\033[90m',
            'bright_red': '\033[91m',
            'bright_green': '\033[92m',
            'bright_yellow': '\033[93m',
            'bright_blue': '\033[94m',
            'bright_magenta': '\033[95m',
            'bright_cyan': '\033[96m',
            'bright_white': '\033[97m',
            'reset': '\033[0m'
        }
        
        # Terrain symbols
        self.terrain_symbols = {
            'grass': '.',
            'forest': '♠',
            'mountain': '^',
            'water': '~',
            'desert': '°',
            'hill': '∩',
            'swamp': '≋',
            'rock': '◊'
        }
    
    def _setup_renderer(self) -> None:
        """Initialize console-specific setup."""
        # Try to set up console for better Unicode support
        if sys.platform == 'win32':
            try:
                os.system('chcp 65001 > nul')  # UTF-8 support on Windows
            except:
                pass
        
        self._init_screen_buffer()
    
    def _init_screen_buffer(self) -> None:
        """Initialize screen buffer with empty space."""
        self.screen_buffer = []
        self.color_buffer = []
        
        for y in range(self.context.viewport_height):
            row = [' '] * self.context.viewport_width
            color_row = ['white'] * self.context.viewport_width
            self.screen_buffer.append(row)
            self.color_buffer.append(color_row)
    
    def clear_screen(self) -> None:
        """Clear the screen buffer."""
        self._init_screen_buffer()
    
    def render_map(self, tiles: List[List[Tile]]) -> None:
        """Render the game map using ASCII characters."""
        if not tiles:
            return
        
        # Get visible area
        left, top, right, bottom = self.get_visible_bounds()
        
        # Render visible tiles
        for world_y in range(top, bottom):
            for world_x in range(left, right):
                if world_y < len(tiles) and world_x < len(tiles[world_y]):
                    tile = tiles[world_y][world_x]
                    screen_x, screen_y = self.world_to_screen(world_x, world_y)
                    
                    if 0 <= screen_x < self.context.viewport_width and 0 <= screen_y < self.context.viewport_height:
                        symbol = self.terrain_symbols.get(tile.terrain_type, '?')
                        color = self._get_terrain_color(tile.terrain_type)
                        
                        self._set_screen_char(screen_x, screen_y, symbol, color)
    
    def render_unit(self, unit: Unit, x: int, y: int) -> None:
        """Render a single unit at specified position."""
        screen_x, screen_y = self.world_to_screen(x, y)
        
        if 0 <= screen_x < self.context.viewport_width and 0 <= screen_y < self.context.viewport_height:
            # Get unit symbol
            symbol = self._get_unit_symbol(unit)
            color = self._get_faction_color(unit.faction_id)
            
            self._set_screen_char(screen_x, screen_y, symbol, color)
    
    def render_units(self, units: List[Unit]) -> None:
        """Render all visible units."""
        for unit in units:
            if unit.position:
                self.render_unit(unit, unit.position.x, unit.position.y)
    
    def render_buildings(self, buildings: List[Any]) -> None:
        """Render buildings and structures."""
        for building in buildings:
            if hasattr(building, 'position') and building.position:
                screen_x, screen_y = self.world_to_screen(building.position.x, building.position.y)
                
                if 0 <= screen_x < self.context.viewport_width and 0 <= screen_y < self.context.viewport_height:
                    symbol = self._get_building_symbol(building)
                    color = self._get_faction_color(getattr(building, 'faction_id', 'neutral'))
                    
                    self._set_screen_char(screen_x, screen_y, symbol, color)
    
    def render_ui(self) -> None:
        """Render user interface elements."""
        for element in self.ui_elements:
            if not element.visible:
                continue
                
            if isinstance(element, StatusBar):
                self._render_status_bar(element)
            elif isinstance(element, InfoPanel):
                self._render_info_panel(element)
    
    def render_text(self, text: str, x: int, y: int, color: str = "white") -> None:
        """Render text at specified position."""
        for i, char in enumerate(text):
            if x + i < self.context.viewport_width and 0 <= y < self.context.viewport_height:
                self._set_screen_char(x + i, y, char, color)
    
    def present(self) -> None:
        """Present the rendered frame to console."""
        # Move cursor to top-left
        print('\033[H', end='')
        
        # Render each line
        for y, (char_row, color_row) in enumerate(zip(self.screen_buffer, self.color_buffer)):
            line = ''
            current_color = None
            
            for x, (char, color) in enumerate(zip(char_row, color_row)):
                # Change color if needed
                if color != current_color:
                    if current_color is not None:
                        line += self.colors.get('reset', '')
                    line += self.colors.get(color, '')
                    current_color = color
                
                line += char
            
            # Reset color at end of line
            if current_color is not None:
                line += self.colors.get('reset', '')
            
            print(line)
        
        # Flush output
        sys.stdout.flush()
    
    def handle_input(self) -> Optional[Dict[str, Any]]:
        """Handle user input from console."""
        # Simple non-blocking input handling (would need proper implementation)
        # For now, return None to indicate no input
        return None
    
    def _set_screen_char(self, x: int, y: int, char: str, color: str) -> None:
        """Set a character in the screen buffer."""
        if 0 <= x < self.context.viewport_width and 0 <= y < self.context.viewport_height:
            self.screen_buffer[y][x] = char
            self.color_buffer[y][x] = color
    
    def _get_unit_symbol(self, unit: Unit) -> str:
        """Get ASCII symbol for a unit."""
        # Check if we have a sprite for this unit
        sprite_key = f"{unit.faction_id}_{unit.unit_name}"
        if sprite_key in self.ascii_sprites:
            # Use center character of sprite (simplified)
            sprite_lines = self.ascii_sprites[sprite_key]
            if len(sprite_lines) >= 8:
                center_line = sprite_lines[8]
                if len(center_line) >= 8:
                    return center_line[8]
        
        # Default symbols based on unit category
        category_symbols = {
            'infantry': '♦',
            'cavalry': '♘',
            'ranged': '♠',
            'artillery': '♣',
            'naval': '⚓',
            'support': '♥',
            'worker': '☼',
            'explorer': '◊'
        }
        
        return category_symbols.get(getattr(unit, 'category', 'infantry'), '●')
    
    def _get_building_symbol(self, building: Any) -> str:
        """Get ASCII symbol for a building."""
        building_type = getattr(building, 'building_type', 'unknown')
        
        building_symbols = {
            'town_center': '⌂',
            'barracks': '▣',
            'archery_range': '⟆',
            'stable': '⌘',
            'workshop': '⚒',
            'farm': '⚮',
            'mine': '⛭',
            'lumber_mill': '⚹',
            'wall': '█',
            'tower': '♜'
        }
        
        return building_symbols.get(building_type, '■')
    
    def _get_terrain_color(self, terrain_type: str) -> str:
        """Get color for terrain type."""
        terrain_colors = {
            'grass': 'green',
            'forest': 'bright_green',
            'mountain': 'bright_black',
            'water': 'blue',
            'desert': 'yellow',
            'hill': 'bright_yellow',
            'swamp': 'cyan',
            'rock': 'white'
        }
        
        return terrain_colors.get(terrain_type, 'white')
    
    def _get_faction_color(self, faction_id: str) -> str:
        """Get color for faction."""
        faction_colors = {
            'player_1': 'bright_red',
            'player_2': 'bright_blue', 
            'player_3': 'bright_green',
            'player_4': 'bright_yellow',
            'neutral': 'white',
            'gaia': 'bright_black'
        }
        
        return faction_colors.get(faction_id, 'white')
    
    def _render_status_bar(self, status_bar: StatusBar) -> None:
        """Render status bar UI element."""
        # Top line - current game info
        info_text = f"Player: {status_bar.current_player} | Turn: {status_bar.turn_number} | Phase: {status_bar.phase}"
        self.render_text(info_text, 0, 0, 'bright_white')
        
        # Second line - separator
        separator = '─' * min(len(info_text), self.context.viewport_width)
        self.render_text(separator, 0, 1, 'white')
    
    def _render_info_panel(self, info_panel: InfoPanel) -> None:
        """Render info panel UI element."""
        start_y = info_panel.y
        
        # Render title
        title_text = f"┌─ {info_panel.title} ─"
        title_text += '─' * max(0, info_panel.width - len(title_text) - 1) + '┐'
        self.render_text(title_text, info_panel.x, start_y, 'bright_white')
        
        # Render content lines
        for i, line in enumerate(info_panel.content):
            if start_y + i + 1 < self.context.viewport_height:
                padded_line = f"│ {line:<{info_panel.width-3}} │"
                self.render_text(padded_line, info_panel.x, start_y + i + 1, 'white')
        
        # Render bottom border
        bottom_y = start_y + len(info_panel.content) + 1
        if bottom_y < self.context.viewport_height:
            bottom_text = '└' + '─' * (info_panel.width - 2) + '┘'
            self.render_text(bottom_text, info_panel.x, bottom_y, 'bright_white')
    
    def add_sprite_art(self, sprite_id: str, ascii_art: List[str]) -> None:
        """Add ASCII art representation of a sprite."""
        self.ascii_sprites[sprite_id] = ascii_art
    
    def render_sprite_preview(self, sprite: Sprite, x: int, y: int) -> None:
        """Render a sprite preview at specific coordinates."""
        if sprite.pixel_data:
            for row_idx, row in enumerate(sprite.pixel_data):
                for col_idx, char in enumerate(row):
                    if char != '.' and char != ' ':  # Skip transparent pixels
                        screen_x = x + col_idx
                        screen_y = y + row_idx
                        
                        if (0 <= screen_x < self.context.viewport_width and 
                            0 <= screen_y < self.context.viewport_height):
                            
                            color = self._char_to_color(char, sprite.color_palette)
                            self._set_screen_char(screen_x, screen_y, char, color)
    
    def _char_to_color(self, char: str, color_palette: Dict[str, str]) -> str:
        """Convert sprite character to console color."""
        if char in color_palette:
            hex_color = color_palette[char]
            # Simple hex to console color mapping
            color_map = {
                '#000000': 'black',
                '#FFFFFF': 'white',
                '#FF0000': 'red',
                '#00FF00': 'green',
                '#0000FF': 'blue',
                '#FFFF00': 'yellow',
                '#FF00FF': 'magenta',
                '#00FFFF': 'cyan',
                '#808080': 'bright_black',
                '#C0C0C0': 'bright_white'
            }
            return color_map.get(hex_color, 'white')
        
        return 'white'

def create_console_renderer(width: int = 80, height: int = 40, map_size: int = 20) -> ConsoleRenderer:
    """Create a console renderer with specified dimensions."""
    context = RenderContext(
        viewport_width=width,
        viewport_height=height,
        map_width=map_size,
        map_height=map_size
    )
    
    return ConsoleRenderer(context)