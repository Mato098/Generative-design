#!/usr/bin/env python3
"""Quick test for instant unit production."""
import asyncio
from core.game_engine import GameEngine
from core.game_state import GameState
from entities.faction import Faction, Building, BuildingType
from agents.base_agent import AgentAction

async def test_unit_production():
    # Setup
    gs = GameState()
    f = Faction(
        faction_id='test',
        owner_id='agent1',
        name='Test Faction',
        resources={'gold': 500, 'wood': 300}
    )
    
    # Add unit design
    f.custom_unit_designs['worker'] = {
        'name': 'Worker',
        'unit_category': 'worker',
        'stats': {
            'health': 50,
            'attack': 5,
            'defense': 3,
            'movement_speed': 2
        },
        'abilities': ['gather'],
        'creation_cost': {'gold': 50}
    }
    
    # Add building
    b = Building(
        name='Town Center',
        building_type=BuildingType.TOWN_CENTER,
        x=5,
        y=5,
        produces_units=['worker']
    )
    f.add_building(b)
    gs.factions['agent1'] = f
    gs.get_tile(5, 5).place_building(b.building_id)
    
    # Test production
    ge = GameEngine()
    action = AgentAction(
        agent_id='agent1',
        action_type='create_unit',
        parameters={
            'building_id': b.building_id,
            'unit_type': 'worker',
            'quantity': 2
        },
        reasoning='Testing production',
        timestamp=0.0
    )
    
    print(f"Before: {len(f.units)} units, {f.resources['gold']} gold")
    result = await ge._process_create_unit(action, gs)
    print(f"After: {len(f.units)} units, {f.resources['gold']} gold")
    print(f"Result: {result}")
    
    # Test insufficient resources
    action2 = AgentAction(
        agent_id='agent1',
        action_type='create_unit',
        parameters={
            'building_id': b.building_id,
            'unit_type': 'worker',
            'quantity': 20  # Need 1000 gold
        },
        reasoning='Testing insufficient resources',
        timestamp=0.0
    )
    result2 = await ge._process_create_unit(action2, gs)
    print(f"Insufficient resources test: {result2}")

if __name__ == "__main__":
    asyncio.run(test_unit_production())
