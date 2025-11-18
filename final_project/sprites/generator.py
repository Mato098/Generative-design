"""LLM-based sprite generation and text-to-pixel conversion."""
import asyncio
import re
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass

from agents.llm_interface import LLMInterface
from entities.sprite import Sprite, SpriteTemplate
from agents.function_schemas import SPRITE_GENERATION_FUNCTIONS
from config.llm_config import SPRITE_GENERATION_SYSTEM_PROMPT

# Import caching system
try:
    from data.cache.faction_cache import FactionCache
    CACHING_ENABLED = True
except ImportError:
    CACHING_ENABLED = False
    logging.warning("Faction caching not available")

@dataclass
class SpriteGenerationRequest:
    """Request for sprite generation."""
    name: str
    description: str
    unit_type: str
    faction_theme: str
    color_scheme: List[str]
    size_constraints: Optional[Dict[str, int]] = None
    style_hints: Optional[List[str]] = None
    
    def __post_init__(self):
        if self.size_constraints is None:
            self.size_constraints = {"width": 16, "height": 16}
        if self.style_hints is None:
            self.style_hints = []

class SpriteParser:
    """Parses LLM-generated sprite descriptions into pixel data."""
    
    def __init__(self):
        self.logger = logging.getLogger("SpriteParser")
        
        # Common character mappings for ASCII art to sprite conversion
        self.char_mappings = {
            '.': 'transparent',
            ' ': 'transparent',
            '#': 'black',
            '*': 'dark_gray',
            'o': 'light_gray',
            'O': 'white',
            'x': 'brown',
            'X': 'dark_brown',
            '@': 'very_dark',
            '+': 'cross_pattern',
            '-': 'horizontal_line',
            '|': 'vertical_line',
            '/': 'diagonal1',
            '\\': 'diagonal2',
            '^': 'point_up',
            'v': 'point_down',
            '<': 'point_left',
            '>': 'point_right'
        }
        
        # Color name to hex mappings
        self.color_mappings = {
            'transparent': None,  # Special case
            'black': '#000000',
            'white': '#FFFFFF',
            'dark_gray': '#404040',
            'light_gray': '#808080',
            'brown': '#8B4513',
            'dark_brown': '#654321',
            'very_dark': '#1A1A1A',
            'red': '#FF0000',
            'green': '#00FF00',
            'blue': '#0000FF',
            'yellow': '#FFFF00',
            'orange': '#FFA500',
            'purple': '#800080',
            'pink': '#FFC0CB',
            'cyan': '#00FFFF'
        }
    
    def parse_sprite_grid(self, grid_text: str) -> List[List[str]]:
        """Parse a text grid into a 2D pixel array."""
        lines = grid_text.strip().split('\n')
        
        # Ensure we have exactly 16 lines
        if len(lines) < 16:
            lines.extend(['.'] * (16 - len(lines)))
        elif len(lines) > 16:
            lines = lines[:16]
        
        pixel_grid = []
        for line in lines:
            # Ensure each line is exactly 16 characters
            if len(line) < 16:
                line += '.' * (16 - len(line))
            elif len(line) > 16:
                line = line[:16]
            
            # Convert characters to symbols
            row = list(line)
            pixel_grid.append(row)
        
        return pixel_grid
    
    def apply_color_mapping(self, pixel_grid: List[List[str]], color_map: Dict[str, str]) -> Tuple[List[List[str]], Dict[str, str]]:
        """Apply color mapping to pixel grid and create color palette."""
        color_palette = {}
        
        # First pass: identify all unique characters
        unique_chars = set()
        for row in pixel_grid:
            for char in row:
                unique_chars.add(char)
        
        # Create color mappings for characters
        for char in unique_chars:
            if char in color_map:
                # Use provided mapping
                color_palette[char] = color_map[char]
            elif char in self.char_mappings:
                # Use default mapping
                color_name = self.char_mappings[char]
                if color_name in self.color_mappings and self.color_mappings[color_name]:
                    color_palette[char] = self.color_mappings[color_name]
            else:
                # Default color for unmapped characters
                color_palette[char] = self.color_mappings.get('dark_gray', '#404040')
        
        return pixel_grid, color_palette
    
    def validate_sprite_constraints(self, pixel_grid: List[List[str]], color_palette: Dict[str, str]) -> List[str]:
        """Validate sprite meets constraints and return list of issues."""
        issues = []
        
        # Check dimensions
        if len(pixel_grid) != 16:
            issues.append(f"Height is {len(pixel_grid)}, should be 16")
        
        for i, row in enumerate(pixel_grid):
            if len(row) != 16:
                issues.append(f"Row {i} width is {len(row)}, should be 16")
        
        # Check color count
        if len(color_palette) > 8:
            issues.append(f"Uses {len(color_palette)} colors, max is 8")
        
        # Check for completely empty sprite
        non_transparent = 0
        for row in pixel_grid:
            for char in row:
                if char != '.' and char != ' ':
                    non_transparent += 1
        
        if non_transparent == 0:
            issues.append("Sprite appears to be completely empty")
        
        return issues

class SpriteGenerator:
    """Generates sprites using LLM and converts them to pixel format."""
    
    def __init__(self, agent_id: str = "sprite_generator", 
                 use_cache: bool = True,
                 cache_mode: str = "similar",  # "exact", "similar", "random"
                 save_to_cache: bool = True):
        self.agent_id = agent_id
        self.llm_interface = LLMInterface(agent_id)
        self.parser = SpriteParser()
        self.logger = logging.getLogger("SpriteGenerator")
        
        # Cache configuration
        self.use_cache = use_cache and CACHING_ENABLED
        self.cache_mode = cache_mode  # "exact", "similar", "random"
        self.save_to_cache = save_to_cache
        self.cache = FactionCache() if self.use_cache else None
        
        # Generation statistics
        self.sprites_generated = 0
        self.successful_generations = 0
        self.generation_errors = []
    
    async def generate_sprite(self, request: SpriteGenerationRequest) -> Optional[Sprite]:
        """Generate a sprite from a request."""
        try:
            self.logger.info(f"🎨 Generating sprite via LLM: {request.name}")
            
            # Create generation prompt
            prompt = self._build_generation_prompt(request)
            
            # Get LLM response using structured output
            self.logger.info(f"🤖 Calling LLM for sprite: {request.name}")
            response = await self.llm_interface.make_structured_sprite_call(
                system_prompt=SPRITE_GENERATION_SYSTEM_PROMPT,
                user_message=prompt
            )
            
            self.sprites_generated += 1
            
            # Debug logging
            self.logger.info(f"🔍 Sprite response - Success: {response.success}, Function calls: {len(response.function_calls) if response.function_calls else 0}")
            if not response.success:
                self.logger.error(f"🔍 Response error: {response.error}")
            if response.function_calls:
                self.logger.info(f"🔍 Function call names: {[call.get('name', 'unknown') for call in response.function_calls]}")
            
            if response.success and response.function_calls:
                func_call = response.function_calls[0]
                if func_call["name"] == "generate_sprite":
                    sprite = self._process_sprite_response(func_call["arguments"], request)
                    
                    if sprite:
                        self.successful_generations += 1
                        self.logger.info(f"Successfully generated sprite: {request.name}")
                        
                        # Debug print the sprite
                        self._debug_print_sprite(sprite)
                        
                        return sprite
                    else:
                        self.logger.error(f"Failed to process sprite response for {request.name}")
            else:
                error_msg = f"LLM generation failed: {response.error or 'No function call'}"
                self.generation_errors.append(error_msg)
                self.logger.error(error_msg)
            
            return None
            
        except Exception as e:
            error_msg = f"Sprite generation error: {str(e)}"
            self.generation_errors.append(error_msg)
            self.logger.error(error_msg)
            return None
    
    def _build_generation_prompt(self, request: SpriteGenerationRequest) -> str:
        """Build the LLM prompt for sprite generation."""
        prompt = f"""Create sprite for: {request.name}

Unit: {request.unit_type} ({request.faction_theme} theme)
Description: {request.description}

Return JSON with 16x16 ASCII grid and color mapping.
Use characters: . # * o O x X + @
Max 10 words for design_notes."""
        return prompt
    
    def _process_sprite_response(self, response_args: Dict[str, Any], request: SpriteGenerationRequest) -> Optional[Sprite]:
        """Process LLM response and create sprite object."""
        try:
            # Extract response components
            sprite_name = response_args.get("sprite_name", request.name)
            description = response_args.get("description", request.description)
            pixel_grid_data = response_args.get("pixel_grid", [])
            color_mapping = response_args.get("color_mapping", {})
            design_notes = response_args.get("design_notes", "")
            
            if not pixel_grid_data:
                self.logger.error("No pixel grid provided in response")
                return None
            
            # Handle both array and string formats
            if isinstance(pixel_grid_data, list):
                # Already in array format (from structured output)
                pixel_grid = [list(row) for row in pixel_grid_data]
            else:
                # String format (legacy)
                pixel_grid = self.parser.parse_sprite_grid(pixel_grid_data)
            
            # Apply color mapping
            pixel_grid, color_palette = self.parser.apply_color_mapping(pixel_grid, color_mapping)
            
            # Validate constraints
            issues = self.parser.validate_sprite_constraints(pixel_grid, color_palette)
            if issues:
                self.logger.warning(f"Sprite validation issues: {', '.join(issues)}")
                # Continue anyway - we can still use imperfect sprites
            
            # Create sprite object
            sprite = Sprite(
                name=sprite_name,
                description=f"{description}\nDesign notes: {design_notes}",
                creator_agent_id=self.agent_id,
                pixel_data=pixel_grid,
                color_palette=color_palette,
                created_at=self.llm_interface.token_usage.total_tokens  # Use as timestamp proxy
            )
            
            return sprite
            
        except Exception as e:
            self.logger.error(f"Error processing sprite response: {str(e)}")
            return None
    
    async def generate_unit_sprite(self, unit_name: str, unit_description: str, faction_theme: str, unit_type: str) -> Optional[Sprite]:
        """Generate a sprite for a specific unit."""
        # Extract style hints from description
        style_hints = self._extract_style_hints(unit_description, faction_theme)
        
        # Create generation request
        request = SpriteGenerationRequest(
            name=unit_name,
            description=unit_description,
            unit_type=unit_type,
            faction_theme=faction_theme,
            color_scheme=["#8B4513", "#654321", "#D2691E"],  # Default browns
            size_constraints={"width": 16, "height": 16},
            style_hints=style_hints
        )
        
        return await self.generate_sprite(request)
    
    async def generate_faction_sprites(self, faction_data: Dict[str, Any]) -> Dict[str, Sprite]:
        """Generate sprites for all custom units in a faction with caching support."""
        
        # Extract faction info for caching
        faction_name = faction_data.get("name", "Unknown Faction")
        faction_theme = faction_data.get("theme", {})
        theme_description = faction_theme.get("description", "")
        architectural_style = faction_theme.get("architectural_style", "medieval")
        
        # Try to extract personality type for better cache matching
        personality_type = self._extract_personality_type(faction_data)
        
        # Try to load from cache if enabled
        cached_sprites = None
        if self.use_cache and self.cache and personality_type:
            cached_sprites = await self._try_load_cached_faction(
                personality_type, theme_description, architectural_style
            )
        
        if cached_sprites:
            self.logger.info(f"Using cached sprites for faction: {faction_name}")
            return cached_sprites
        
        # Generate new sprites if no cache hit
        sprites = {}
        custom_units = faction_data.get("custom_unit_designs", {})
        
        self.logger.info(f"Generating {len(custom_units)} sprites for faction: {faction_name}")
        
        # Handle both dict and list formats for custom units
        if isinstance(custom_units, list):
            # Convert list of actions to dictionary format
            unit_dict = {}
            for action in custom_units:
                # Handle AgentAction objects
                if hasattr(action, 'action_type') and action.action_type == 'design_unit':
                    params = action.parameters
                    unit_name = params.get('unit_name', f'Unit_{len(unit_dict)}')
                    unit_dict[unit_name] = params
                # Handle dict format for backwards compatibility
                elif isinstance(action, dict) and action.get('action_type') == 'design_unit':
                    params = action.get('parameters', {})
                    unit_name = params.get('unit_name', f'Unit_{len(unit_dict)}')
                    unit_dict[unit_name] = params
            custom_units = unit_dict
        
        if not isinstance(custom_units, dict):
            self.logger.warning(f"Invalid custom_units format: {type(custom_units)}")
            custom_units = {}
        
        for unit_name, unit_data in custom_units.items():
            sprite_description = unit_data.get("sprite_description", unit_data.get("description", ""))
            unit_category = unit_data.get("category", "infantry")
            
            sprite = await self.generate_unit_sprite(
                unit_name,
                sprite_description,
                faction_theme,
                unit_category
            )
            
            
            if sprite:
                sprites[unit_name] = sprite
            else:
                self.logger.warning(f"Failed to generate sprite for {unit_name}")
        
        # Cache the generated sprites for future use
        if sprites and self.save_to_cache and self.cache and personality_type:
            await self._cache_faction_data(
                personality_type, theme_description, architectural_style, 
                faction_data, sprites
            )
        
        return sprites
    
    def _extract_style_hints(self, description: str, faction_theme: str) -> List[str]:
        """Extract style hints from unit description and faction theme."""
        hints = [faction_theme]
        
        # Look for style keywords in description
        style_keywords = {
            "armor": ["armored", "heavy", "protected"],
            "weapon": ["sword", "spear", "bow", "gun", "axe"],
            "mounted": ["horse", "cavalry", "mounted"],
            "ranged": ["archer", "crossbow", "rifle", "cannon"],
            "magic": ["magic", "spell", "enchanted", "mystical"],
            "mechanical": ["machine", "gear", "steam", "clockwork"]
        }
        
        description_lower = description.lower()
        for category, keywords in style_keywords.items():
            if any(keyword in description_lower for keyword in keywords):
                hints.append(category)
        
        return hints
    
    def create_sprite_template(self, base_unit_type: str, faction_style: str) -> SpriteTemplate:
        """Create a sprite template for consistent generation."""
        templates = {
            "infantry": {
                "base_shape": "humanoid figure with weapon",
                "size_category": "medium",
                "primary_colors": ["#8B4513", "#654321", "#C0C0C0"],  # Brown and silver
            },
            "cavalry": {
                "base_shape": "mounted warrior",
                "size_category": "large",
                "primary_colors": ["#8B4513", "#4B0000", "#FFD700"],  # Brown, dark red, gold
            },
            "ranged": {
                "base_shape": "figure with ranged weapon",
                "size_category": "medium",
                "primary_colors": ["#228B22", "#8B4513", "#800000"],  # Green, brown, dark red
            },
            "artillery": {
                "base_shape": "large weapon or siege engine",
                "size_category": "large",
                "primary_colors": ["#2F4F4F", "#696969", "#8B4513"],  # Dark gray, gray, brown
            }
        }
        
        template_data = templates.get(base_unit_type, templates["infantry"])
        
        return SpriteTemplate(
            base_shape=template_data["base_shape"],
            size_category=template_data["size_category"],
            primary_colors=template_data["primary_colors"],
            style_hints=[faction_style, base_unit_type],
            constraints={"max_colors": 8, "size": "16x16"}
        )
    
    def get_generation_statistics(self) -> Dict[str, Any]:
        """Get sprite generation statistics."""
        success_rate = (self.successful_generations / max(1, self.sprites_generated)) * 100
        
        return {
            "total_sprites_requested": self.sprites_generated,
            "successful_generations": self.successful_generations,
            "success_rate": success_rate,
            "recent_errors": self.generation_errors[-5:] if self.generation_errors else [],
            "token_usage": self.llm_interface.get_token_usage_summary()
        }
    
    def _debug_print_sprite(self, sprite: Sprite) -> None:
        """Debug print sprite to terminal with color information."""
        print(f"\n🎨 ═══ GENERATED SPRITE: {sprite.name} ═══")
        print(f"📝 Description: {sprite.description}")
        print(f"🎨 Colors ({len(sprite.color_palette)}):")
        
        # Print color palette
        for char, color in sprite.color_palette.items():
            if color and color != 'transparent':
                print(f"  '{char}' → {color}")
            else:
                print(f"  '{char}' → transparent")
        
        print("\n🖼️  Sprite Grid (16x16):")
        print("   " + "".join([str(i % 10) for i in range(16)]))
        
        # Print the sprite grid with row numbers
        for i, row in enumerate(sprite.pixel_data):
            row_str = "".join(row)
            print(f"{i:2d} {row_str}")
        
        print("═══" + "═" * len(f" SPRITE: {sprite.name} ") + "═══\n")
    
    def _extract_personality_type(self) -> Optional[str]:
        """Extract personality type from agent_id if possible."""
        if not self.agent_id:
            return None
        
        # Common personality mappings based on agent naming patterns
        personality_map = {
            'aggressive': ['caesar', 'warrior', 'conquerer', 'aggressive'],
            'defensive': ['fortress', 'guardian', 'defensive', 'castle'],
            'economic': ['merchant', 'trader', 'economic', 'gold'],
            'balanced': ['viking', 'balanced', 'versatile']
        }
        
        agent_lower = self.agent_id.lower()
        for personality, keywords in personality_map.items():
            if any(keyword in agent_lower for keyword in keywords):
                return personality
        
        return None
    
    def _convert_cached_faction_to_sprites(self, faction_template: 'FactionTemplate') -> Dict[str, Sprite]:
        """Convert a cached faction template back to Sprite objects."""
        sprites = {}
        
        for unit_name, sprite_data in faction_template.sprites.items():
            try:
                # Create Sprite object from cached data
                sprite = Sprite(
                    name=sprite_data.get('sprite_name', unit_name),
                    description=sprite_data.get('description', f"Sprite for {unit_name}"),
                    creator_agent_id=f"cache_{self.agent_id}"
                )
                
                # Initialize pixel data array
                sprite.pixel_data = []
                pixel_grid = sprite_data.get('pixel_grid', [])
                
                # Set pixel data from cached grid
                for y in range(16):
                    row = []
                    if y < len(pixel_grid):
                        source_row = pixel_grid[y]
                        for x in range(16):
                            if x < len(source_row):
                                row.append(source_row[x])
                            else:
                                row.append('.')
                    else:
                        row = ['.'] * 16
                    sprite.pixel_data.append(row)
                
                # Set color palette from cached mapping
                color_mapping = sprite_data.get('color_mapping', {})
                sprite.color_palette = color_mapping.copy()
                
                sprites[unit_name] = sprite
                
            except Exception as e:
                self.logger.warning(f"Failed to convert cached sprite {unit_name}: {e}")
        
        return sprites
    
    def _cache_faction_template(self, 
                               faction_data: Dict[str, Any], 
                               sprites: Dict[str, Sprite], 
                               personality_type: Optional[str] = None):
        """Cache a complete faction template for future use."""
        if not CACHING_ENABLED or not self.cache:
            return
        
        try:
            # Convert sprites to cacheable format
            sprite_cache_data = {}
            for unit_name, sprite in sprites.items():
                sprite_cache_data[unit_name] = {
                    'sprite_name': sprite.name,
                    'description': f"Sprite for {unit_name}",
                    'pixel_grid': [''.join(row) for row in sprite.pixel_data],
                    'color_mapping': sprite.color_palette.copy(),
                    'design_notes': f"Generated sprite for {faction_data.get('name', 'faction')}"
                }
            
            # Prepare units data
            units_data = []
            custom_units = faction_data.get("custom_unit_designs", {})
            
            # Handle both dict and list formats
            if isinstance(custom_units, list):
                for action in custom_units:
                    if hasattr(action, 'parameters'):
                        units_data.append(action.parameters)
                    elif isinstance(action, dict) and 'parameters' in action:
                        units_data.append(action['parameters'])
            elif isinstance(custom_units, dict):
                for unit_name, unit_data in custom_units.items():
                    unit_entry = unit_data.copy()
                    unit_entry['unit_name'] = unit_name
                    units_data.append(unit_entry)
            
            # Extract theme keywords for better categorization
            theme_description = faction_data.get('theme', {}).get('description', '')
            theme_keywords = self._extract_theme_keywords(theme_description)
            
            # Store in cache
            cache_key = self.cache.store_faction_template(
                faction_data=faction_data,
                units_data=units_data,
                sprites_data=sprite_cache_data,
                personality_type=personality_type,
                theme_keywords=theme_keywords
            )
            
            if cache_key:
                self.logger.info(f"Cached faction template with key: {cache_key}")
            
        except Exception as e:
            self.logger.error(f"Failed to cache faction template: {e}")
    
    def _extract_theme_keywords(self, theme_description: str) -> List[str]:
        """Extract relevant keywords from theme description for tagging."""
        if not theme_description:
            return []
        
        # Common theme keywords to extract
        theme_patterns = [
            r'\b(roman|legion|empire|imperial)\b',
            r'\b(medieval|castle|knight|feudal)\b', 
            r'\b(viking|norse|barbarian|tribal)\b',
            r'\b(merchant|trade|gold|economic)\b',
            r'\b(magic|arcane|mystical|wizard)\b',
            r'\b(technology|steam|mechanical|gear)\b',
            r'\b(naval|pirate|sea|ship)\b',
            r'\b(desert|sand|nomad)\b',
            r'\b(forest|elf|nature|green)\b'
        ]
        
        keywords = []
        theme_lower = theme_description.lower()
        
        for pattern in theme_patterns:
            matches = re.findall(pattern, theme_lower)
            keywords.extend(matches)
        
        return list(set(keywords))  # Remove duplicates
    
    async def try_load_cached_faction(self, personality_type: Optional[str] = None) -> Optional[Dict[str, Sprite]]:
        """Try to load a cached faction that matches the given criteria."""
        if not CACHING_ENABLED or not self.cache:
            return None
        
        try:
            # Extract personality from agent if not provided
            if not personality_type:
                personality_type = self._extract_personality_type()
            
            # Get a random compatible faction
            cached_faction = self.cache.get_random_faction(personality_type=personality_type)
            
            if cached_faction:
                self.logger.info(f"Loading cached faction: {cached_faction.faction_name}")
                sprites = self._convert_cached_faction_to_sprites(cached_faction)
                
                # Update cache metrics
                if hasattr(self.cache, 'metrics'):
                    # Estimate time saved (approximate LLM generation time)
                    time_saved = len(sprites) * 60  # ~1 minute per sprite
                    self.cache.metrics.record_hit(time_saved)
                
                return sprites
            
        except Exception as e:
            self.logger.error(f"Failed to load cached faction: {e}")
        
        return None
    
    # New simple cache methods
    async def _try_load_cached_faction(self, personality_type: str, theme_description: str, 
                                       architectural_style: str) -> Optional[Dict[str, Sprite]]:
        """Try to load cached faction sprites based on cache mode."""
        if not self.cache:
            return None
            
        try:
            cached_data = None
            
            if self.cache_mode == "exact":
                # Try exact match first
                cached_data = self.cache.get_faction(personality_type, theme_description)
            elif self.cache_mode == "similar":
                # Try exact match first, then similar
                cached_data = self.cache.get_faction(personality_type, theme_description)
                if not cached_data:
                    cached_data = self.cache.get_similar_faction(personality_type)
            elif self.cache_mode == "random":
                # Get any faction with same personality
                cached_data = self.cache.get_similar_faction(personality_type)
            
            if cached_data:
                self.logger.info(f"Found cached faction data (mode: {self.cache_mode})")
                return self._convert_cached_data_to_sprites(cached_data)
                
        except Exception as e:
            self.logger.warning(f"Cache retrieval failed: {e}")
            
        return None
    
    def _convert_cached_data_to_sprites(self, cached_data: Dict[str, Any]) -> Dict[str, Sprite]:
        """Convert cached faction data back to Sprite objects."""
        sprites = {}
        
        try:
            sprite_data = cached_data.get("sprites", {})
            
            for unit_name, sprite_info in sprite_data.items():
                sprite = Sprite(
                    width=sprite_info.get("width", 16),
                    height=sprite_info.get("height", 16),
                    name=sprite_info.get("name", unit_name),
                    description=sprite_info.get("description", ""),
                    creator_agent_id=self.agent_id
                )
                
                # Restore pixel data
                pixel_grid = sprite_info.get("pixel_grid", [])
                if pixel_grid:
                    for y, row in enumerate(pixel_grid):
                        for x, pixel in enumerate(row):
                            if x < sprite.width and y < sprite.height:
                                sprite.set_pixel(x, y, pixel)
                
                # Restore color palette
                color_palette = sprite_info.get("color_palette", {})
                if color_palette:
                    for char, color in color_palette.items():
                        sprite.add_color(char, color)
                
                sprites[unit_name] = sprite
                
        except Exception as e:
            self.logger.error(f"Failed to convert cached data to sprites: {e}")
            return {}
            
        return sprites
    
    def _sprites_to_dict(self, sprites: Dict[str, Sprite]) -> Dict[str, Dict[str, Any]]:
        """Convert sprites to dictionary format for caching."""
        sprite_data = {}
        
        for unit_name, sprite in sprites.items():
            sprite_data[unit_name] = {
                "width": sprite.width,
                "height": sprite.height,
                "name": sprite.name,
                "description": sprite.description,
                "pixel_grid": [[sprite.get_pixel(x, y) for x in range(sprite.width)] 
                              for y in range(sprite.height)],
                "color_palette": dict(sprite.colors)
            }
            
        return sprite_data
    
    async def _cache_faction_data(self, personality_type: str, theme_description: str,
                                 architectural_style: str, faction_data: Dict[str, Any],
                                 sprites: Dict[str, Sprite]):
        """Cache the generated faction data and sprites."""
        try:
            cache_data = {
                "faction_data": faction_data,
                "sprites": self._sprites_to_dict(sprites),
                "architectural_style": architectural_style,
                "generation_metadata": {
                    "agent_id": self.agent_id,
                    "personality_type": personality_type,
                    "unit_count": len(sprites)
                }
            }
            
            cache_key = self.cache.store_faction(
                personality_type or "unknown", 
                theme_description or architectural_style,
                cache_data
            )
            
            self.logger.info(f"Cached faction data with key: {cache_key[:8]}...")
            
        except Exception as e:
            self.logger.warning(f"Failed to cache faction data: {e}")
            
    def _extract_personality_type(self, faction_data: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """Extract personality type from faction data or agent_id."""
        # Try to extract from faction data first
        if faction_data:
            theme = faction_data.get("theme", {})
            description = theme.get("description", "").lower()
            
            # Simple keyword matching for personality
            if any(word in description for word in ["aggressive", "warrior", "conquerer", "caesar"]):
                return "aggressive"
            elif any(word in description for word in ["defensive", "guardian", "castle", "fortress"]):
                return "defensive"
            elif any(word in description for word in ["peaceful", "merchant", "trade", "diplomatic"]):
                return "peaceful"
            elif any(word in description for word in ["balanced", "adaptable", "flexible"]):
                return "balanced"
        
        # Fall back to agent_id analysis
        if not self.agent_id:
            return "balanced"  # Default fallback
        
        # Common personality mappings based on agent naming patterns
        personality_map = {
            'aggressive': ['caesar', 'warrior', 'conquerer', 'aggressive'],
            'defensive': ['turtle', 'guardian', 'defender', 'defensive'], 
            'peaceful': ['diplomat', 'merchant', 'peaceful', 'trader'],
            'balanced': ['balanced', 'adaptive', 'flexible']
        }
        
        agent_lower = self.agent_id.lower()
        for personality, keywords in personality_map.items():
            if any(keyword in agent_lower for keyword in keywords):
                return personality
        
        return "balanced"  # Default fallback