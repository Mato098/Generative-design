#!/usr/bin/env python3
"""Test unit spawn locations."""
import asyncio
from core.game_engine import GameEngine
from core.game_state import GameState
from entities.faction import Faction, Building, BuildingType
from agents.base_agent import AgentAction

async def test_spawn_locations():
    gs = GameState()
    f = Faction(
        faction_id='test',
        owner_id='agent1',
        name='Test',
        resources={'gold': 500}
    )
    
    f.custom_unit_designs['worker'] = {
        'name': 'Worker',
        'unit_category': 'worker',
        'stats': {'health': 50, 'attack': 5, 'defense': 3, 'movement_speed': 2},
        'abilities': [],
        'creation_cost': {'gold': 50}
    }
    
    b = Building(
        name='Town',
        building_type=BuildingType.TOWN_CENTER,
        x=5,
        y=5,
        produces_units=['worker']
    )
    f.add_building(b)
    gs.factions['agent1'] = f
    gs.get_tile(5, 5).place_building(b.building_id)
    
    ge = GameEngine()
    action = AgentAction(
        agent_id='agent1',
        action_type='create_unit',
        parameters={'building_id': b.building_id, 'unit_type': 'worker', 'quantity': 3},
        reasoning='test',
        timestamp=0.0
    )
    
    result = await ge._process_create_unit(action, gs)
    
    print(f"\n=== Spawn Location Test ===")
    print(f"Building at: ({b.x}, {b.y})")
    print(f"Building tile - unit: {gs.get_tile(5, 5).unit_id}, building: {gs.get_tile(5, 5).building_id}")
    print(f"\nCreated {len(f.units)} units:")
    
    for i, u in enumerate(f.units):
        tile = gs.get_tile(u.x, u.y)
        print(f"  Unit {i+1}: ({u.x}, {u.y}) - Tile has unit_id: {tile.unit_id is not None}, building_id: {tile.building_id is not None}")
        
        # Check if unit is on building tile
        if u.x == b.x and u.y == b.y:
            print(f"    ⚠️  ERROR: Unit is on building tile!")
        
        # Check for overlaps with other units
        for j, other in enumerate(f.units):
            if i != j and u.x == other.x and u.y == other.y:
                print(f"    ⚠️  ERROR: Unit overlaps with unit {j+1}!")
    
    # Check tile consistency
    print(f"\n=== Tile Consistency Check ===")
    for u in f.units:
        tile = gs.get_tile(u.x, u.y)
        if tile.unit_id != u.unit_id:
            print(f"⚠️  ERROR: Unit {u.unit_id} at ({u.x},{u.y}) but tile.unit_id = {tile.unit_id}")
        if tile.building_id is not None:
            print(f"⚠️  ERROR: Unit at ({u.x},{u.y}) but tile also has building {tile.building_id}")

if __name__ == "__main__":
    asyncio.run(test_spawn_locations())
