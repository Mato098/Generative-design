"""Visualization configuration and settings."""
from enum import Enum
from dataclasses import dataclass
from typing import Dict, Tuple, Optional

# Console display settings
CONSOLE_MAP_WIDTH = 60
CONSOLE_MAP_HEIGHT = 30
CONSOLE_REFRESH_RATE = 1.0  # seconds

# ASCII characters for different elements
class ConsoleSymbols:
    """ASCII symbols for console rendering."""
    
    # Terrain symbols
    PLAINS = "."
    FOREST = "T" 
    WATER = "~"
    MOUNTAIN = "^"
    DESERT = ";"
    
    # Unit symbols (will be overridden by custom sprites)
    UNIT_PLAYER_1 = "1"
    UNIT_PLAYER_2 = "2" 
    UNIT_PLAYER_3 = "3"
    UNIT_PLAYER_4 = "4"
    
    # Building symbols
    BUILDING = "#"
    RESOURCE_NODE = "*"
    
    # UI symbols
    BORDER = "|"
    CORNER = "+"
    HORIZONTAL = "-"
    EMPTY = " "

# Color schemes for different players (console color codes)
PLAYER_COLORS = {
    1: "\033[91m",  # Red
    2: "\033[94m",  # Blue  
    3: "\033[92m",  # Green
    4: "\033[95m",  # Magenta
    "reset": "\033[0m",
    "neutral": "\033[97m",  # White
    "terrain": "\033[93m"   # Yellow
}

# Sprite display settings
SPRITE_SIZE = 16  # 16x16 pixels
SPRITE_ASCII_SCALE = 2  # Scale factor for ASCII display
MAX_SPRITE_COLORS = 8

# Animation settings (for future use)
ANIMATION_FRAME_DURATION = 0.5  # seconds
MAX_ANIMATION_FRAMES = 4

@dataclass
class ViewportSettings:
    """Settings for game viewport and camera."""
    width: int = CONSOLE_MAP_WIDTH
    height: int = CONSOLE_MAP_HEIGHT
    zoom_level: float = 1.0
    center_x: int = 10
    center_y: int = 10
    
    def move_viewport(self, dx: int, dy: int) -> None:
        """Move the viewport center."""
        self.center_x += dx
        self.center_y += dy
        
    def zoom(self, factor: float) -> None:
        """Adjust zoom level."""
        self.zoom_level = max(0.5, min(3.0, self.zoom_level * factor))

@dataclass  
class RenderSettings:
    """Settings for rendering game state."""
    show_grid: bool = True
    show_coordinates: bool = False
    show_health_bars: bool = True
    show_resource_counts: bool = True
    highlight_selected: bool = True
    animation_enabled: bool = False
    
    # Display filters
    show_player_units: Optional[Dict[int, bool]] = None
    show_buildings: bool = True
    show_terrain_details: bool = True
    
    def __post_init__(self):
        if self.show_player_units is None:
            self.show_player_units = {1: True, 2: True, 3: True, 4: True}

# UI Layout settings
class UILayout:
    """Console UI layout constants."""
    
    # Main game area
    GAME_AREA_X = 2
    GAME_AREA_Y = 2
    
    # Info panels
    INFO_PANEL_WIDTH = 20
    INFO_PANEL_X = CONSOLE_MAP_WIDTH + 5
    
    # Status indicators
    STATUS_LINE_Y = CONSOLE_MAP_HEIGHT + 5
    
    # Input area
    INPUT_AREA_Y = CONSOLE_MAP_HEIGHT + 7
    
    # Log area
    LOG_AREA_HEIGHT = 10
    LOG_AREA_Y = CONSOLE_MAP_HEIGHT + 10

# Message display settings
MAX_LOG_MESSAGES = 20
MESSAGE_DISPLAY_TIME = 3.0  # seconds
MESSAGE_FADE_TIME = 1.0     # seconds

# Visualization backends
class RenderBackend(Enum):
    """Available rendering backends."""
    CONSOLE = "console"
    TKINTER = "tkinter"
    P5JS = "p5js"
    
DEFAULT_BACKEND = RenderBackend.CONSOLE

# Performance settings
MAX_FPS = 30
FRAME_SKIP_THRESHOLD = 100  # milliseconds
RENDER_DISTANCE = 50        # tiles to render around viewport

# Export settings for sprites
SPRITE_EXPORT_FORMAT = "png"
SPRITE_EXPORT_SCALE = 4  # Upscale factor for export

# Main visualization configuration class
@dataclass
class VisualizationConfig:
    """Main visualization configuration container."""
    backend: RenderBackend = DEFAULT_BACKEND
    console_width: int = CONSOLE_MAP_WIDTH
    console_height: int = CONSOLE_MAP_HEIGHT
    refresh_rate: float = CONSOLE_REFRESH_RATE
    
    viewport: Optional[ViewportSettings] = None
    render_settings: Optional[RenderSettings] = None
    
    # Performance settings
    max_fps: int = MAX_FPS
    frame_skip_threshold: int = FRAME_SKIP_THRESHOLD
    render_distance: int = RENDER_DISTANCE
    
    # Sprite settings
    sprite_size: int = SPRITE_SIZE
    sprite_ascii_scale: int = SPRITE_ASCII_SCALE
    max_sprite_colors: int = MAX_SPRITE_COLORS
    
    def __post_init__(self):
        """Initialize default values."""
        if self.viewport is None:
            self.viewport = ViewportSettings()
        if self.render_settings is None:
            self.render_settings = RenderSettings()