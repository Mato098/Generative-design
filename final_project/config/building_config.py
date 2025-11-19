"""Building configuration and default templates."""
from typing import Dict, List, Set
from entities.faction import BuildingType

# Building templates with inherent capabilities based on type
BUILDING_TEMPLATES: Dict[str, Dict] = {
    "town_center": {
        "default_health": 200,
        "default_produces_units": ["worker"],  # Can always produce basic workers
        "default_resource_generation": {"gold": 10, "food": 5},
        "suggested_abilities": ["research"],  # Commonly has research capability
        "description": "Main building that produces workers and generates base resources",
    },
    "barracks": {
        "default_health": 150,
        "default_produces_units": ["infantry"],  # Can produce infantry-type units
        "default_resource_generation": {},
        "suggested_abilities": ["train_faster"],
        "description": "Military building for training infantry units",
    },
    "archery_range": {
        "default_health": 120,
        "default_produces_units": ["ranged"],  # Can produce ranged units
        "default_resource_generation": {},
        "suggested_abilities": [],
        "description": "Training facility for ranged combat units",
    },
    "stable": {
        "default_health": 140,
        "default_produces_units": ["cavalry"],  # Can produce cavalry units
        "default_resource_generation": {},
        "suggested_abilities": ["train_faster"],
        "description": "Training facility for mounted units",
    },
    "workshop": {
        "default_health": 130,
        "default_produces_units": ["artillery", "support"],  # Can produce special units
        "default_resource_generation": {},
        "suggested_abilities": ["research"],
        "description": "Advanced facility for specialized units and technologies",
    },
    "farm": {
        "default_health": 80,
        "default_produces_units": [],  # Farms don't produce units
        "default_resource_generation": {"food": 15},
        "suggested_abilities": ["resource_bonus"],
        "description": "Resource building that generates food",
    },
    "mine": {
        "default_health": 100,
        "default_produces_units": [],
        "default_resource_generation": {"gold": 10, "stone": 8},
        "suggested_abilities": ["resource_bonus"],
        "description": "Resource building that generates gold and stone",
    },
    "lumber_mill": {
        "default_health": 90,
        "default_produces_units": [],
        "default_resource_generation": {"wood": 12},
        "suggested_abilities": ["resource_bonus"],
        "description": "Resource building that generates wood",
    },
    "wall": {
        "default_health": 100,
        "default_produces_units": [],
        "default_resource_generation": {},
        "suggested_abilities": ["wall"],  # Inherently has wall ability
        "description": "Defensive structure that blocks movement",
        "inherent_abilities": ["wall"],  # Cannot be removed
    },
    "tower": {
        "default_health": 120,
        "default_produces_units": [],
        "default_resource_generation": {},
        "suggested_abilities": ["auto_attack"],  # Should have attack capability
        "description": "Defensive structure that attacks enemies",
        "inherent_abilities": ["auto_attack"],  # Cannot be removed
    },
}

# Default building costs by type
DEFAULT_BUILDING_COSTS: Dict[str, Dict[str, int]] = {
    "town_center": {"gold": 500, "wood": 300, "stone": 200},
    "barracks": {"gold": 150, "wood": 100},
    "archery_range": {"gold": 150, "wood": 120},
    "stable": {"gold": 200, "wood": 150},
    "workshop": {"gold": 250, "wood": 200},
    "farm": {"gold": 80, "wood": 50},
    "mine": {"gold": 100, "wood": 80, "stone": 50},
    "lumber_mill": {"gold": 80, "wood": 60},
    "wall": {"gold": 30, "wood": 20, "stone": 10},
    "tower": {"gold": 150, "wood": 80, "stone": 100},
}


def get_building_template(building_type: str) -> Dict:
    """Get default template for a building type.
    
    Args:
        building_type: Type of building (e.g., "town_center", "barracks")
    
    Returns:
        Dict with default values for health, production, resources, etc.
    """
    return BUILDING_TEMPLATES.get(building_type, {
        "default_health": 100,
        "default_produces_units": [],
        "default_resource_generation": {},
        "suggested_abilities": [],
        "description": "Custom building",
    })


def get_inherent_abilities(building_type: str) -> Set[str]:
    """Get abilities that are inherent to a building type and cannot be removed.
    
    Args:
        building_type: Type of building
    
    Returns:
        Set of ability IDs that must be present
    """
    template = BUILDING_TEMPLATES.get(building_type, {})
    return set(template.get("inherent_abilities", []))


def can_building_produce_unit_category(building_type: str, unit_category: str) -> bool:
    """Check if a building type can produce a given unit category.
    
    Args:
        building_type: Type of building (e.g., "barracks")
        unit_category: Category of unit (e.g., "infantry", "cavalry")
    
    Returns:
        bool: True if the building can produce that category
    """
    template = get_building_template(building_type)
    default_produces = template.get("default_produces_units", [])
    return unit_category in default_produces


def apply_building_template(building_data: Dict, building_type: str) -> Dict:
    """Apply building template defaults to building design.
    
    Merges agent-specified values with defaults from the template.
    Ensures inherent abilities and default production are always present.
    
    Args:
        building_data: Building data from agent
        building_type: Type of building
    
    Returns:
        Dict with template defaults applied
    """
    template = get_building_template(building_type)
    
    # Merge unit production: always include default production + agent's additions
    default_produces = set(template["default_produces_units"])
    agent_produces = set(building_data.get("produces_units", []))
    combined_produces = list(default_produces | agent_produces)
    
    # Start with template defaults
    result = {
        "health": building_data.get("health", template["default_health"]),
        "produces_units": combined_produces,
        "resource_generation": {
            **template["default_resource_generation"],
            **building_data.get("resource_generation", {})
        },
        "abilities": set(building_data.get("abilities", [])),
    }
    
    # Add inherent abilities (cannot be removed)
    inherent = get_inherent_abilities(building_type)
    result["abilities"].update(inherent)
    
    # Merge other fields
    for key, value in building_data.items():
        if key not in result:
            result[key] = value
    
    return result


def get_all_building_types() -> List[str]:
    """Get list of all available building types."""
    return list(BUILDING_TEMPLATES.keys())


def get_production_buildings() -> List[str]:
    """Get list of buildings that can produce units."""
    return [
        building_type 
        for building_type, template in BUILDING_TEMPLATES.items()
        if template["default_produces_units"]
    ]


def get_resource_buildings() -> List[str]:
    """Get list of buildings that generate resources."""
    return [
        building_type 
        for building_type, template in BUILDING_TEMPLATES.items()
        if template["default_resource_generation"]
    ]
