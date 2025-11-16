"""Function schemas for OpenAI function calling."""
from typing import Dict, List, Any

# Game action function schemas
GAME_ACTION_FUNCTIONS = [
    {
        "name": "move_unit",
        "description": "Move a unit to a new position on the map",
        "parameters": {
            "type": "object",
            "properties": {
                "unit_id": {
                    "type": "string",
                    "description": "Unique ID of the unit to move"
                },
                "target_x": {
                    "type": "integer",
                    "description": "Target X coordinate (0-19)",
                    "minimum": 0,
                    "maximum": 19
                },
                "target_y": {
                    "type": "integer", 
                    "description": "Target Y coordinate (0-19)",
                    "minimum": 0,
                    "maximum": 19
                },
                "reasoning": {
                    "type": "string",
                    "description": "Strategic reasoning for this move"
                }
            },
            "required": ["unit_id", "target_x", "target_y", "reasoning"]
        }
    },
    {
        "name": "attack_unit",
        "description": "Attack an enemy unit",
        "parameters": {
            "type": "object",
            "properties": {
                "attacker_id": {
                    "type": "string",
                    "description": "ID of your unit that will attack"
                },
                "target_id": {
                    "type": "string",
                    "description": "ID of enemy unit to attack"
                },
                "reasoning": {
                    "type": "string",
                    "description": "Strategic reasoning for this attack"
                }
            },
            "required": ["attacker_id", "target_id", "reasoning"]
        }
    },
    {
        "name": "build_structure",
        "description": "Construct a building",
        "parameters": {
            "type": "object",
            "properties": {
                "structure_type": {
                    "type": "string",
                    "enum": ["barracks", "archery_range", "stable", "workshop", "farm", "mine", "lumber_mill", "wall", "tower"],
                    "description": "Type of building to construct"
                },
                "x": {
                    "type": "integer",
                    "description": "X coordinate for building placement",
                    "minimum": 0,
                    "maximum": 19
                },
                "y": {
                    "type": "integer",
                    "description": "Y coordinate for building placement", 
                    "minimum": 0,
                    "maximum": 19
                },
                "reasoning": {
                    "type": "string",
                    "description": "Strategic purpose of this building"
                }
            },
            "required": ["structure_type", "x", "y", "reasoning"]
        }
    },
    {
        "name": "create_unit",
        "description": "Train/produce a new unit from a building",
        "parameters": {
            "type": "object",
            "properties": {
                "unit_type": {
                    "type": "string",
                    "description": "Type of unit to create (can be custom design name)"
                },
                "building_id": {
                    "type": "string",
                    "description": "ID of building that will produce the unit"
                },
                "quantity": {
                    "type": "integer",
                    "description": "Number of units to create",
                    "minimum": 1,
                    "maximum": 5
                },
                "reasoning": {
                    "type": "string",
                    "description": "Strategic reasoning for creating these units"
                }
            },
            "required": ["unit_type", "building_id", "quantity", "reasoning"]
        }
    },
    {
        "name": "fortify_unit",
        "description": "Fortify a unit for increased defense",
        "parameters": {
            "type": "object",
            "properties": {
                "unit_id": {
                    "type": "string",
                    "description": "ID of unit to fortify"
                },
                "reasoning": {
                    "type": "string",
                    "description": "Strategic reasoning for fortifying"
                }
            },
            "required": ["unit_id", "reasoning"]
        }
    }
]

# Faction setup functions
FACTION_SETUP_FUNCTIONS = [
    {
        "name": "create_faction",
        "description": "Create your faction with theme and identity",
        "parameters": {
            "type": "object",
            "properties": {
                "faction_name": {
                    "type": "string",
                    "description": "Name of your faction"
                },
                "theme_description": {
                    "type": "string", 
                    "description": "Description of faction's visual and cultural theme"
                },
                "color_scheme": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Primary colors for your faction (3-5 hex colors)",
                    "maxItems": 5
                },
                "architectural_style": {
                    "type": "string",
                    "enum": ["medieval", "futuristic", "organic", "industrial", "mystical", "tribal"],
                    "description": "Architectural style for buildings"
                },
                "unit_naming_convention": {
                    "type": "string",
                    "description": "How your units should be named"
                },
                "faction_lore": {
                    "type": "string",
                    "description": "Background story and culture of your faction"
                }
            },
            "required": ["faction_name", "theme_description", "color_scheme", "architectural_style"]
        }
    },
    {
        "name": "design_unit",
        "description": "Design a custom unit type for your faction",
        "parameters": {
            "type": "object",
            "properties": {
                "unit_name": {
                    "type": "string",
                    "description": "Name of the unit type"
                },
                "unit_description": {
                    "type": "string",
                    "description": "Description of the unit's appearance and role"
                },
                "unit_category": {
                    "type": "string",
                    "enum": ["infantry", "cavalry", "ranged", "artillery", "naval", "support", "worker"],
                    "description": "Basic unit category"
                },
                "stats": {
                    "type": "object",
                    "properties": {
                        "health": {"type": "integer", "minimum": 10, "maximum": 100},
                        "attack": {"type": "integer", "minimum": 1, "maximum": 50},
                        "defense": {"type": "integer", "minimum": 0, "maximum": 30},
                        "movement_speed": {"type": "integer", "minimum": 1, "maximum": 10},
                        "attack_range": {"type": "integer", "minimum": 1, "maximum": 5},
                        "sight_range": {"type": "integer", "minimum": 2, "maximum": 8}
                    },
                    "required": ["health", "attack", "defense", "movement_speed"]
                },
                "abilities": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["stealth", "heal", "build", "gather", "fortify", "charge", "range_attack", "splash"]
                    },
                    "description": "Special abilities for this unit"
                },
                "resource_costs": {
                    "type": "object",
                    "properties": {
                        "gold": {"type": "integer", "minimum": 0},
                        "wood": {"type": "integer", "minimum": 0},
                        "food": {"type": "integer", "minimum": 0},
                        "stone": {"type": "integer", "minimum": 0}
                    }
                },
                "sprite_description": {
                    "type": "string",
                    "description": "Detailed description of unit appearance for sprite generation"
                }
            },
            "required": ["unit_name", "unit_description", "unit_category", "stats", "sprite_description"]
        }
    }
]

# Sprite generation functions
SPRITE_GENERATION_FUNCTIONS = [
    {
        "name": "generate_sprite",
        "description": "Generate a 16x16 pixel sprite",
        "parameters": {
            "type": "object",
            "properties": {
                "sprite_name": {
                    "type": "string",
                    "description": "Name/identifier for the sprite"
                },
                "description": {
                    "type": "string",
                    "description": "Detailed description of what the sprite should depict"
                },
                "pixel_grid": {
                    "type": "string",
                    "description": "16x16 sprite as text grid using ASCII characters. Each line represents one row of pixels."
                },
                "color_mapping": {
                    "type": "object",
                    "description": "Map ASCII characters to hex colors",
                    "patternProperties": {
                        "^.$": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"}
                    }
                },
                "design_notes": {
                    "type": "string",
                    "description": "Notes about design choices and rationale"
                }
            },
            "required": ["sprite_name", "description", "pixel_grid", "color_mapping"]
        }
    }
]

# Admin agent functions
ADMIN_FUNCTIONS = [
    {
        "name": "analyze_balance",
        "description": "Analyze game balance after faction creation",
        "parameters": {
            "type": "object",
            "properties": {
                "analysis": {
                    "type": "string",
                    "description": "Detailed analysis of faction balance"
                },
                "balance_issues": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of identified balance problems"
                },
                "severity": {
                    "type": "string",
                    "enum": ["minor", "moderate", "major", "critical"],
                    "description": "Severity of balance issues"
                }
            },
            "required": ["analysis", "balance_issues", "severity"]
        }
    },
    {
        "name": "suggest_adjustments", 
        "description": "Suggest balance adjustments to game parameters",
        "parameters": {
            "type": "object",
            "properties": {
                "adjustments": {
                    "type": "object",
                    "properties": {
                        "unit_cost_multiplier": {"type": "number", "minimum": 0.5, "maximum": 2.0},
                        "building_cost_multiplier": {"type": "number", "minimum": 0.5, "maximum": 2.0},
                        "resource_generation_rate": {"type": "number", "minimum": 0.5, "maximum": 2.0},
                        "combat_damage_multiplier": {"type": "number", "minimum": 0.5, "maximum": 2.0}
                    }
                },
                "reasoning": {
                    "type": "string",
                    "description": "Explanation for suggested adjustments"
                },
                "affected_factions": {
                    "type": "array", 
                    "items": {"type": "string"},
                    "description": "Which factions will be affected by these changes"
                }
            },
            "required": ["adjustments", "reasoning"]
        }
    },
    {
        "name": "approve_faction",
        "description": "Approve or reject a faction design",
        "parameters": {
            "type": "object",
            "properties": {
                "faction_id": {
                    "type": "string",
                    "description": "ID of faction being reviewed"
                },
                "approved": {
                    "type": "boolean",
                    "description": "Whether faction is approved"
                },
                "feedback": {
                    "type": "string",
                    "description": "Feedback on faction design"
                },
                "required_changes": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "List of required changes if not approved"
                }
            },
            "required": ["faction_id", "approved", "feedback"]
        }
    }
]

# Information query functions
INFO_FUNCTIONS = [
    {
        "name": "get_map_info",
        "description": "Get information about map tiles and terrain",
        "parameters": {
            "type": "object",
            "properties": {
                "area_x": {"type": "integer", "description": "Center X coordinate"},
                "area_y": {"type": "integer", "description": "Center Y coordinate"}, 
                "radius": {"type": "integer", "description": "Radius to query", "minimum": 1, "maximum": 10},
                "info_type": {
                    "type": "string",
                    "enum": ["terrain", "resources", "units", "buildings", "all"],
                    "description": "Type of information to retrieve"
                }
            },
            "required": ["area_x", "area_y", "radius", "info_type"]
        }
    },
    {
        "name": "analyze_enemy",
        "description": "Analyze visible enemy forces",
        "parameters": {
            "type": "object",
            "properties": {
                "enemy_faction_id": {
                    "type": "string",
                    "description": "ID of faction to analyze"
                },
                "analysis_focus": {
                    "type": "string",
                    "enum": ["military_strength", "economy", "positioning", "technology", "overall"],
                    "description": "Focus of the analysis"
                }
            },
            "required": ["enemy_faction_id", "analysis_focus"]
        }
    }
]

# Communication functions
COMMUNICATION_FUNCTIONS = [
    {
        "name": "send_message",
        "description": "Send a message to other players (trash talk, diplomacy, etc.)",
        "parameters": {
            "type": "object", 
            "properties": {
                "message": {
                    "type": "string",
                    "description": "Message content"
                },
                "target": {
                    "type": "string",
                    "enum": ["all", "allies", "enemies"],
                    "description": "Who to send the message to"
                },
                "message_type": {
                    "type": "string",
                    "enum": ["taunt", "diplomacy", "information", "celebration"],
                    "description": "Type of message"
                }
            },
            "required": ["message", "target", "message_type"]
        }
    }
]

def get_functions_for_phase(game_phase: str) -> List[Dict[str, Any]]:
    """Get appropriate function schemas for current game phase."""
    if game_phase == "setup":
        return FACTION_SETUP_FUNCTIONS + SPRITE_GENERATION_FUNCTIONS + INFO_FUNCTIONS
    elif game_phase == "balancing":
        return ADMIN_FUNCTIONS
    elif game_phase == "playing":
        return (GAME_ACTION_FUNCTIONS + INFO_FUNCTIONS + 
                COMMUNICATION_FUNCTIONS + SPRITE_GENERATION_FUNCTIONS)
    else:
        return INFO_FUNCTIONS

def get_admin_functions() -> List[Dict[str, Any]]:
    """Get admin-specific functions."""
    return ADMIN_FUNCTIONS + INFO_FUNCTIONS

def validate_function_schema(function_name: str, arguments: Dict[str, Any]) -> bool:
    """Validate function arguments against schema."""
    all_functions = (GAME_ACTION_FUNCTIONS + FACTION_SETUP_FUNCTIONS + 
                    SPRITE_GENERATION_FUNCTIONS + ADMIN_FUNCTIONS + 
                    INFO_FUNCTIONS + COMMUNICATION_FUNCTIONS)
    
    for func_schema in all_functions:
        if func_schema["name"] == function_name:
            # Basic validation - would need more sophisticated schema validation
            required_params = func_schema.get("parameters", {}).get("required", [])
            for param in required_params:
                if param not in arguments:
                    return False
            return True
    
    return False