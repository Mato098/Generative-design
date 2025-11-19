"""Helper utilities for generating ability documentation from registry."""
from typing import Dict, List, TYPE_CHECKING

if TYPE_CHECKING:
    from .base import AbilityRegistry

def get_ability_descriptions(registry: 'AbilityRegistry', category: str = "unit") -> str:
    """Generate formatted ability descriptions from registry.
    
    Args:
        registry: The ability registry instance
        category: "unit" or "building"
    
    Returns:
        Formatted string with all ability descriptions
    """
    abilities = registry.list_ability_ids(category)
    descriptions = []
    
    for ability_id in abilities:
        ability = registry.get(ability_id)
        if ability:
            descriptions.append(f"- {ability_id}: {ability.description}")
    
    return "\n".join(descriptions)

def get_ability_list(registry: 'AbilityRegistry', category: str = "unit") -> List[str]:
    """Get list of ability IDs for a category.
    
    Args:
        registry: The ability registry instance
        category: "unit" or "building"
    
    Returns:
        List of ability ID strings
    """
    return registry.list_ability_ids(category)

def get_ability_enum_description(registry: 'AbilityRegistry', category: str = "unit") -> str:
    """Generate compact ability descriptions for function schema.
    
    Args:
        registry: The ability registry instance
        category: "unit" or "building"
    
    Returns:
        Compact description string for schema
    """
    abilities = registry.list_ability_ids(category)
    parts = []
    
    for ability_id in abilities:
        ability = registry.get(ability_id)
        if ability:
            # Extract key info from description
            desc = ability.description
            # Simplify for schema (first part before parenthesis or comma)
            simplified = desc.split('(')[0].split(',')[0].strip()
            parts.append(f"{ability_id}={simplified}")
    
    return ", ".join(parts)

def get_ability_summary_table(registry: 'AbilityRegistry', category: str = "unit") -> Dict[str, str]:
    """Get ability summary as dictionary.
    
    Args:
        registry: The ability registry instance
        category: "unit" or "building"
    
    Returns:
        Dict mapping ability_id to description
    """
    abilities = registry.list_ability_ids(category)
    summary = {}
    
    for ability_id in abilities:
        ability = registry.get(ability_id)
        if ability:
            summary[ability_id] = ability.description
    
    return summary
