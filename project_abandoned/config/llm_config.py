"""LLM and OpenAI API configuration."""
import os
from dataclasses import dataclass
from typing import List, Dict, Any

# Try to load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # dotenv not installed, will use system environment variables
    pass

# OpenAI API settings
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Only show warning if running as main module or if explicitly needed
def check_api_key():
    """Check if API key is configured and show warning if not."""
    if not OPENAI_API_KEY:
        print("Warning: OPENAI_API_KEY not found. Set it in your .env file or environment variables.")
        print("   Create a .env file with: OPENAI_API_KEY=your_api_key_here")
        return False
    return True

# Show status when config is loaded (but only if key is missing)
if not OPENAI_API_KEY:
    check_api_key()

GPT_MODEL = os.getenv("OPENAI_MODEL", "gpt-5-nano-2025-08-07")  # Using 4o-mini as placeholder for GPT-5 nano
MAX_TOKENS = int(os.getenv("OPENAI_MAX_TOKENS", "3000"))  # Reduced to prevent excessive token usage
TEMPERATURE = float(os.getenv("OPENAI_TEMPERATURE", "1"))
REQUEST_TIMEOUT = int(os.getenv("OPENAI_TIMEOUT", "60"))  # Increased timeout for complex requests

# Debug options
DEBUG_LLM_RESPONSES = os.getenv("DEBUG_LLM_RESPONSES", "false").lower() in ("true", "1", "yes")

# Rate limiting
MAX_REQUESTS_PER_MINUTE = 50
MAX_TOKENS_PER_MINUTE = 20000

def _get_ability_descriptions_cached():
    """Lazy-load ability descriptions to avoid circular imports."""
    try:
        from abilities import get_ability_descriptions
        unit_abilities = get_ability_descriptions("unit")
        building_abilities = get_ability_descriptions("building")
        return unit_abilities, building_abilities
    except ImportError:
        # Fallback if abilities module not available
        return "Abilities system loading...", "Abilities system loading..."

def get_player_agent_system_prompt(personality_name: str, strategic_style: str, communication_style: str) -> str:
    """Generate player agent system prompt with dynamic ability descriptions."""
    unit_abilities, building_abilities = _get_ability_descriptions_cached()
    
    return f"""
You are a strategic AI player in a turn-based strategy game inspired by Age of Empires III.
Your personality is {personality_name} with a {strategic_style} playstyle.

Your goals:
1. Build and manage your faction with custom units and buildings
2. Gather resources efficiently  
3. Engage in strategic combat
4. Work towards victory conditions
5. Engage in light banter with other players

ABILITY SYSTEM:
Units and buildings can have special abilities that modify their behavior:

Unit Abilities:
{unit_abilities}

Building Abilities:
{building_abilities}

You must use the provided function tools to take actions. Be creative but strategic.
Your responses should reflect your {communication_style} communication style.
"""

# Agent personalities and behavior
@dataclass
class AgentPersonality:
    """Defines an agent's personality and strategic preferences."""
    name: str
    strategic_style: str  # "aggressive", "defensive", "economic", "balanced"
    risk_tolerance: float  # 0.0 to 1.0
    preferred_unit_types: List[str]
    communication_style: str  # "formal", "casual", "taunting", "analytical"
    
DEFAULT_PERSONALITIES = [
    AgentPersonality(
        name="Caesar",
        strategic_style="aggressive", 
        risk_tolerance=0.8,
        preferred_unit_types=["cavalry", "musketeer"],
        communication_style="formal"
    ),
    AgentPersonality(
        name="Merchant",
        strategic_style="economic",
        risk_tolerance=0.3,
        preferred_unit_types=["settler", "crossbowman"],
        communication_style="analytical"
    ),
    AgentPersonality(
        name="Fortress",
        strategic_style="defensive",
        risk_tolerance=0.2,
        preferred_unit_types=["pikeman", "artillery"],
        communication_style="casual"
    ),
    AgentPersonality(
        name="Viking",
        strategic_style="balanced",
        risk_tolerance=0.6,
        preferred_unit_types=["explorer", "caravel"],
        communication_style="taunting"
    )
]

# Legacy system prompt kept for backwards compatibility
# Use get_player_agent_system_prompt() for dynamic ability descriptions
PLAYER_AGENT_SYSTEM_PROMPT = """
You are a strategic AI player in a turn-based strategy game inspired by Age of Empires III.
Your personality is {personality_name} with a {strategic_style} playstyle.

Your goals:
1. Build and manage your faction with custom units and buildings
2. Gather resources efficiently  
3. Engage in strategic combat
4. Work towards victory conditions
5. Engage in light banter with other players

ABILITY SYSTEM:
Units and buildings can have special abilities that modify their behavior.
Ability descriptions are loaded dynamically from the ability registry.

You must use the provided function tools to take actions. Be creative but strategic.
Your responses should reflect your {communication_style} communication style.
"""

ADMIN_AGENT_SYSTEM_PROMPT = """
You are the Admin Agent overseeing a 4-player strategy game.

Your responsibilities:
1. Monitor game balance after faction/unit creation
2. Suggest adjustments if any faction is overpowered
3. Resolve conflicts and clarify rule interpretations  
4. Provide narrative context and flavor
5. Ensure fair and engaging gameplay

Be impartial but engaging. You have the authority to modify game parameters if needed.
"""

SPRITE_GENERATION_SYSTEM_PROMPT = """Create 16x16 ASCII sprites for strategy game units.

You must respond with valid JSON containing:
- sprite_name: unit name
- description: brief unit description  
- pixel_grid: array of exactly 16 strings, each exactly 16 characters
- color_mapping: object mapping each character to hex color (#RRGGBB format)
- design_notes: max 50 characters

Only use characters: . # * o O x X + @
Each grid row must be exactly 16 characters from allowed set.
Colors must be valid hex (#FF0000, #00FF00, etc).

Example: {"sprite_name": "Knight", "description": "Armored warrior", "pixel_grid": ["................", "..####....####..", "...*...*..*....."], "color_mapping": {".": "#000000", "#": "#8B4513", "*": "#C0C0C0"}, "design_notes": "Brown armor silver highlights"}"""

# Function calling schemas for OpenAI
FUNCTION_SCHEMAS = {
    "game_actions": {
        "move_unit": {
            "name": "move_unit",
            "description": "Move a unit to a new position",
            "parameters": {
                "type": "object",
                "properties": {
                    "unit_id": {"type": "string", "description": "ID of unit to move"},
                    "target_x": {"type": "integer", "description": "Target X coordinate"},
                    "target_y": {"type": "integer", "description": "Target Y coordinate"},
                    "reasoning": {"type": "string", "description": "Explanation for this move"}
                },
                "required": ["unit_id", "target_x", "target_y", "reasoning"]
            }
        },
        "attack_unit": {
            "name": "attack_unit", 
            "description": "Attack an enemy unit",
            "parameters": {
                "type": "object",
                "properties": {
                    "attacker_id": {"type": "string", "description": "ID of attacking unit"},
                    "target_id": {"type": "string", "description": "ID of target unit"},
                    "reasoning": {"type": "string", "description": "Strategic reasoning"}
                },
                "required": ["attacker_id", "target_id", "reasoning"]
            }
        },
        "build_structure": {
            "name": "build_structure",
            "description": "Construct a building",
            "parameters": {
                "type": "object", 
                "properties": {
                    "structure_type": {"type": "string", "description": "Type of building to construct"},
                    "x": {"type": "integer", "description": "X coordinate"},
                    "y": {"type": "integer", "description": "Y coordinate"},
                    "reasoning": {"type": "string", "description": "Strategic purpose"}
                },
                "required": ["structure_type", "x", "y", "reasoning"]
            }
        },
        "create_unit": {
            "name": "create_unit",
            "description": "Train/produce a new unit",
            "parameters": {
                "type": "object",
                "properties": {
                    "unit_type": {"type": "string", "description": "Type of unit to create"},
                    "quantity": {"type": "integer", "description": "Number of units", "minimum": 1, "maximum": 5},
                    "reasoning": {"type": "string", "description": "Strategic reasoning"}
                },
                "required": ["unit_type", "quantity", "reasoning"]
            }
        }
    }
}

# Token usage tracking
@dataclass  
class TokenUsage:
    """Track token consumption across agents."""
    agent_id: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_estimate: float = 0.0
    
    def add_usage(self, prompt: int, completion: int) -> None:
        """Add token usage from a request."""
        self.prompt_tokens += prompt
        self.completion_tokens += completion  
        self.total_tokens += (prompt + completion)
        # Rough cost estimate (adjust based on actual pricing)
        self.cost_estimate += (prompt * 0.00003 + completion * 0.00006)