"""Visualization interface and abstract renderer."""
from abc import ABC, abstractmethod
from typing import Dict, List, Tuple, Any, Optional
from dataclasses import dataclass

from entities.sprite import Sprite
from entities.unit import Unit
from entities.faction import Faction
from entities.tile import Tile

@dataclass
class RenderContext:
    """Context information for rendering."""
    viewport_width: int
    viewport_height: int
    map_width: int
    map_height: int
    view_center_x: float = 10.0
    view_center_y: float = 10.0
    zoom_level: float = 1.0
    show_debug_info: bool = False

@dataclass
class UIElement:
    """Base class for UI elements."""
    x: int
    y: int
    width: int
    height: int
    visible: bool = True
    element_type: str = "generic"

@dataclass
class InfoPanel(UIElement):
    """Information panel for displaying game data."""
    element_type: str = "info_panel"
    title: str = ""
    content: Optional[List[str]] = None
    
    def __post_init__(self):
        if self.content is None:
            self.content = []

@dataclass
class StatusBar(UIElement):
    """Status bar for current player/turn information."""
    element_type: str = "status_bar"
    current_player: str = ""
    turn_number: int = 0
    phase: str = ""

class RendererInterface(ABC):
    """Abstract base class for game renderers."""
    
    def __init__(self, context: RenderContext):
        """Initialize renderer with context."""
        self.context = context
        self.sprites: Dict[str, Sprite] = {}
        self.ui_elements: List[UIElement] = []
        self._setup_renderer()
    
    @abstractmethod
    def _setup_renderer(self) -> None:
        """Initialize renderer-specific setup."""
        pass
    
    @abstractmethod
    def render_map(self, tiles: List[List[Tile]]) -> None:
        """Render the game map."""
        pass
    
    @abstractmethod
    def render_unit(self, unit: Unit, x: int, y: int) -> None:
        """Render a single unit at specified position."""
        pass
    
    @abstractmethod
    def render_units(self, units: List[Unit]) -> None:
        """Render all visible units."""
        pass
    
    @abstractmethod
    def render_buildings(self, buildings: List[Any]) -> None:
        """Render buildings and structures."""
        pass
    
    @abstractmethod
    def render_ui(self) -> None:
        """Render user interface elements."""
        pass
    
    @abstractmethod
    def render_text(self, text: str, x: int, y: int, color: str = "white") -> None:
        """Render text at specified position."""
        pass
    
    @abstractmethod
    def clear_screen(self) -> None:
        """Clear the display."""
        pass
    
    @abstractmethod
    def present(self) -> None:
        """Present the rendered frame."""
        pass
    
    @abstractmethod
    def handle_input(self) -> Optional[Dict[str, Any]]:
        """Handle user input and return input events."""
        pass
    
    def register_sprite(self, sprite_id: str, sprite: Sprite) -> None:
        """Register a sprite for rendering."""
        self.sprites[sprite_id] = sprite
    
    def add_ui_element(self, element: UIElement) -> None:
        """Add a UI element to be rendered."""
        self.ui_elements.append(element)
    
    def remove_ui_element(self, element_type: str) -> None:
        """Remove UI elements of specified type."""
        self.ui_elements = [e for e in self.ui_elements if e.element_type != element_type]
    
    def update_context(self, **kwargs) -> None:
        """Update render context parameters."""
        for key, value in kwargs.items():
            if hasattr(self.context, key):
                setattr(self.context, key, value)
    
    def set_view_center(self, x: float, y: float) -> None:
        """Set the center point of the view."""
        self.context.view_center_x = max(0, min(x, self.context.map_width))
        self.context.view_center_y = max(0, min(y, self.context.map_height))
    
    def zoom(self, factor: float) -> None:
        """Adjust zoom level."""
        self.context.zoom_level = max(0.5, min(3.0, self.context.zoom_level * factor))
    
    def world_to_screen(self, world_x: float, world_y: float) -> Tuple[int, int]:
        """Convert world coordinates to screen coordinates."""
        # Calculate offset from view center
        offset_x = world_x - self.context.view_center_x
        offset_y = world_y - self.context.view_center_y
        
        # Apply zoom
        screen_x = int(self.context.viewport_width / 2 + offset_x * self.context.zoom_level)
        screen_y = int(self.context.viewport_height / 2 + offset_y * self.context.zoom_level)
        
        return screen_x, screen_y
    
    def screen_to_world(self, screen_x: int, screen_y: int) -> Tuple[float, float]:
        """Convert screen coordinates to world coordinates."""
        # Calculate offset from screen center
        offset_x = (screen_x - self.context.viewport_width / 2) / self.context.zoom_level
        offset_y = (screen_y - self.context.viewport_height / 2) / self.context.zoom_level
        
        # Add to view center
        world_x = self.context.view_center_x + offset_x
        world_y = self.context.view_center_y + offset_y
        
        return world_x, world_y
    
    def get_visible_bounds(self) -> Tuple[int, int, int, int]:
        """Get the bounds of the visible area in world coordinates."""
        # Calculate how much of the world is visible
        world_width_visible = self.context.viewport_width / self.context.zoom_level
        world_height_visible = self.context.viewport_height / self.context.zoom_level
        
        # Calculate bounds
        left = int(max(0, self.context.view_center_x - world_width_visible / 2))
        top = int(max(0, self.context.view_center_y - world_height_visible / 2))
        right = int(min(self.context.map_width, self.context.view_center_x + world_width_visible / 2))
        bottom = int(min(self.context.map_height, self.context.view_center_y + world_height_visible / 2))
        
        return left, top, right, bottom

class GameVisualization:
    """Main visualization coordinator."""
    
    def __init__(self, renderer: RendererInterface):
        """Initialize visualization with a specific renderer."""
        self.renderer = renderer
        self.current_state = None
        self.animation_queue = []
        self.paused = False
        
    def render_game_state(self, game_state: Any) -> None:
        """Render the complete game state."""
        if self.paused:
            return
            
        self.current_state = game_state
        
        # Clear previous frame
        self.renderer.clear_screen()
        
        # Render map
        if hasattr(game_state, 'map_grid') and game_state.map_grid:
            self.renderer.render_map(game_state.map_grid)
        
        # Render units
        if hasattr(game_state, 'get_all_units'):
            units = game_state.get_all_units()
            self.renderer.render_units(units)
        
        # Render buildings
        if hasattr(game_state, 'get_all_buildings'):
            buildings = game_state.get_all_buildings()
            self.renderer.render_buildings(buildings)
        
        # Render UI
        self._update_ui_elements(game_state)
        self.renderer.render_ui()
        
        # Present the frame
        self.renderer.present()
    
    def _update_ui_elements(self, game_state: Any) -> None:
        """Update UI elements based on game state."""
        # Clear existing dynamic UI elements
        self.renderer.remove_ui_element("status_bar")
        self.renderer.remove_ui_element("info_panel")
        
        # Add status bar
        status_bar = StatusBar(
            x=0, y=0, width=self.renderer.context.viewport_width, height=2,
            current_player=getattr(game_state, 'current_player_id', 'Unknown'),
            turn_number=getattr(game_state, 'turn_number', 0),
            phase=getattr(game_state, 'game_phase', 'unknown')
        )
        self.renderer.add_ui_element(status_bar)
        
        # Add info panel if debug mode is on
        if self.renderer.context.show_debug_info:
            info_content = [
                f"Factions: {len(getattr(game_state, 'factions', []))}",
                f"Units: {len(getattr(game_state, 'get_all_units', lambda: [])())}",
                f"View: ({self.renderer.context.view_center_x:.1f}, {self.renderer.context.view_center_y:.1f})",
                f"Zoom: {self.renderer.context.zoom_level:.1f}x"
            ]
            
            info_panel = InfoPanel(
                x=self.renderer.context.viewport_width - 30, y=2,
                width=28, height=len(info_content) + 2,
                title="Debug Info",
                content=info_content
            )
            self.renderer.add_ui_element(info_panel)
    
    def handle_input(self) -> Optional[Dict[str, Any]]:
        """Handle input and return processed events."""
        return self.renderer.handle_input()
    
    def add_animation(self, animation: Dict[str, Any]) -> None:
        """Add an animation to the queue."""
        self.animation_queue.append(animation)
    
    def process_animations(self) -> None:
        """Process pending animations."""
        # Simple animation processing - can be expanded later
        if self.animation_queue:
            animation = self.animation_queue.pop(0)
            # Process animation...
    
    def set_renderer(self, new_renderer: RendererInterface) -> None:
        """Switch to a different renderer."""
        self.renderer = new_renderer
    
    def toggle_pause(self) -> None:
        """Toggle pause state."""
        self.paused = not self.paused
    
    def toggle_debug_info(self) -> None:
        """Toggle debug information display."""
        self.renderer.context.show_debug_info = not self.renderer.context.show_debug_info
    
    def focus_on_position(self, x: float, y: float) -> None:
        """Focus the view on a specific world position."""
        self.renderer.set_view_center(x, y)
    
    def focus_on_unit(self, unit: Unit) -> None:
        """Focus the view on a specific unit."""
        # Units may have position attribute added later
        if hasattr(unit, 'position') and getattr(unit, 'position'):
            pos = getattr(unit, 'position')
            self.focus_on_position(pos.x, pos.y)
    
    def zoom_in(self) -> None:
        """Zoom in."""
        self.renderer.zoom(1.2)
    
    def zoom_out(self) -> None:
        """Zoom out."""
        self.renderer.zoom(0.8)
    
    def reset_view(self) -> None:
        """Reset view to default position and zoom."""
        self.renderer.update_context(
            view_center_x=self.renderer.context.map_width / 2,
            view_center_y=self.renderer.context.map_height / 2,
            zoom_level=1.0
        )