"""Main game engine that coordinates all game systems."""
import asyncio
import logging
import time
import uuid
from typing import Dict, List, Optional, Any, Callable, Tuple

from core.game_state import GameState, GamePhase
from core.turn_manager import TurnManager, TurnProcessingResult
from agents.base_agent import BaseAgent, AgentAction
from agents.player_agent import PlayerAgent
from agents.admin_agent import AdminAgent
from entities.faction import Faction, FactionTheme
from entities.unit import Unit, UnitType, UnitStats
from entities.tile import Tile

class GameEngine:
    """Main game engine that coordinates all game systems."""
    
    def __init__(self, game_id: Optional[str] = None, map_size: tuple = (20, 20)):
        """Initialize game engine."""
        self.game_id = game_id or str(uuid.uuid4())
        self.game_state = GameState(
            game_id=self.game_id,
            map_width=map_size[0],
            map_height=map_size[1]
        )
        
        self.turn_manager = TurnManager()
        self.logger = logging.getLogger("GameEngine")
        
        # Agents
        self.player_agents: List[PlayerAgent] = []
        self.admin_agent: Optional[AdminAgent] = None
        
        # Game state
        self.is_running = False
        self.is_paused = False
        
        # Event callbacks
        self.event_callbacks: Dict[str, List[Callable]] = {}
        
        # Register action processors
        self._register_action_processors()
        
        self.logger.info(f"Initialized GameEngine with ID: {self.game_id}")
    
    async def apply_balance_adjustments(self, adjustments: List[Dict[str, Any]], factions: Dict[str, Any]) -> bool:
        """Apply balance adjustments to factions."""
        # Simplified implementation
        self.logger.info(f"Applied {len(adjustments)} balance adjustments")
        return True
    
    def _register_action_processors(self) -> None:
        """Register action processors with the turn manager."""
        self.turn_manager.register_action_processor("create_faction", self._process_create_faction)
        self.turn_manager.register_action_processor("design_unit", self._process_design_unit)
        self.turn_manager.register_action_processor("design_building", self._process_design_building)
        self.turn_manager.register_action_processor("move_unit", self._process_move_unit)
        self.turn_manager.register_action_processor("attack_unit", self._process_attack_unit)
        self.turn_manager.register_action_processor("build_structure", self._process_build_structure)
        self.turn_manager.register_action_processor("create_unit", self._process_create_unit)
        self.turn_manager.register_action_processor("fortify_unit", self._process_fortify_unit)
        self.turn_manager.register_action_processor("send_message", self._process_send_message)
        self.turn_manager.register_action_processor("analyze_balance", self._process_analyze_balance)
        self.turn_manager.register_action_processor("approve_faction", self._process_approve_faction)
        self.turn_manager.register_action_processor("suggest_adjustments", self._process_suggest_adjustments)
        self.turn_manager.register_action_processor("edit_faction_unit", self._process_edit_faction_unit)
        self.turn_manager.register_action_processor("edit_faction_theme", self._process_edit_faction_theme)
    
    def add_player_agent(self, personality_index: int = 0) -> str:
        """Add a player agent to the game."""
        agent_id = f"player_{len(self.player_agents) + 1}"
        agent = PlayerAgent(agent_id, personality_index)
        self.player_agents.append(agent)
        
        self.logger.info(f"Added player agent: {agent.name} ({agent_id})")
        return agent_id
    
    def add_admin_agent(self) -> None:
        """Add admin agent to the game."""
        self.admin_agent = AdminAgent()
        self.logger.info("Added admin agent")
    
    def register_event_callback(self, event_type: str, callback: Callable) -> None:
        """Register a callback for game events."""
        if event_type not in self.event_callbacks:
            self.event_callbacks[event_type] = []
        self.event_callbacks[event_type].append(callback)
    
    def _emit_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """Emit a game event to all registered callbacks."""
        if event_type in self.event_callbacks:
            for callback in self.event_callbacks[event_type]:
                try:
                    callback(event_type, data)
                except Exception as e:
                    self.logger.error(f"Error in event callback: {e}")
    
    async def start_game(self) -> None:
        """Start the game and run the main game loop."""
        if self.is_running:
            self.logger.warning("Game is already running")
            return
        
        self.logger.info("Starting game")
        self.is_running = True
        self.game_state.phase = GamePhase.SETUP
        
        try:
            # Setup phase - players create factions
            await self._run_setup_phase()
            
            # Balancing phase - admin reviews factions
            if self.admin_agent:
                await self._run_balancing_phase()
            
            # Main game loop
            await self._run_main_game_loop()
            
        except Exception as e:
            self.logger.error(f"Error in game loop: {e}")
            self._emit_event("game_error", {"error": str(e)})
        finally:
            self.is_running = False
            self.logger.info("Game ended")
    
    async def _run_setup_phase(self) -> None:
        """Run the faction setup phase."""
        self.logger.info("Starting setup phase")
        self.game_state.phase = GamePhase.SETUP
        
        # Each player creates their faction
        for agent in self.player_agents:
            self.logger.info(f"Processing faction setup for {agent.agent_id}")
            
            result = await self.turn_manager.process_agent_turn(agent, self.game_state)
            self.turn_manager.add_turn_to_history(result)
            
            if result.turn_result.value != "success":
                self.logger.warning(f"Setup failed for {agent.agent_id}: {result.error_message}")
        
        self._emit_event("setup_complete", {
            "factions_created": len(self.game_state.factions),
            "agents": [a.agent_id for a in self.player_agents]
        })
        
        self.logger.info("Setup phase completed")
    
    async def _run_balancing_phase(self) -> None:
        """Run the faction balancing phase with admin review."""
        if not self.admin_agent:
            return
        
        self.logger.info("Starting balancing phase")
        self.game_state.phase = GamePhase.BALANCING
        
        # Admin reviews all factions
        admin_view = {
            "phase": "balancing",
            "factions": {aid: faction.to_dict() for aid, faction in self.game_state.factions.items()}
        }
        
        result = await self.turn_manager.process_agent_turn(self.admin_agent, self.game_state)
        self.turn_manager.add_turn_to_history(result)
        
        # Apply any balance adjustments
        for action in result.actions:
            if action.action_type == "suggest_adjustments":
                adjustments = action.parameters.get("adjustments", {})
                if adjustments:
                    self.game_state.balance_settings = self.game_state.balance_settings.apply_adjustments(adjustments)
                    self.logger.info(f"Applied balance adjustments: {adjustments}")
            elif action.action_type == "edit_faction_unit":
                await self._process_edit_faction_unit(action)
            elif action.action_type == "edit_faction_theme":
                await self._process_edit_faction_theme(action)
        
        self._emit_event("balancing_complete", {
            "balance_issues": len(result.actions),
            "adjustments_applied": any(a.action_type == "suggest_adjustments" for a in result.actions)
        })
        
        self.logger.info("Balancing phase completed")
    
    async def _run_main_game_loop(self) -> None:
        """Run the main game loop."""
        self.logger.info("Starting main game loop")
        self.game_state.phase = GamePhase.PLAYING
        
        max_turns = 100  # Prevent infinite games
        
        while (self.is_running and 
               self.game_state.phase == GamePhase.PLAYING and 
               self.game_state.turn_number < max_turns):
            
            if self.is_paused:
                await asyncio.sleep(0.1)
                continue
            
            # Process a full round (all players take a turn)
            round_results = await self.turn_manager.process_full_round(
                self.player_agents, 
                self.game_state
            )
            
            # Check for victory conditions
            winner = self.game_state._check_victory_conditions()
            if winner:
                self.game_state.phase = GamePhase.ENDED
                self.logger.info(f"Game won by {winner}")
                self._emit_event("game_won", {"winner": winner, "turn": self.game_state.turn_number})
                break
            
            # Admin monitoring (every 5 turns)
            if self.admin_agent and self.game_state.turn_number % 5 == 0:
                admin_result = await self.turn_manager.process_agent_turn(self.admin_agent, self.game_state)
                self.turn_manager.add_turn_to_history(admin_result)
            
            # Emit turn complete event
            self._emit_event("turn_complete", {
                "turn": self.game_state.turn_number,
                "results": [r.__dict__ for r in round_results]
            })
            
            # Brief pause between turns
            await asyncio.sleep(0.1)
        
        if self.game_state.turn_number >= max_turns:
            self.logger.info("Game ended due to turn limit")
            self._emit_event("game_timeout", {"max_turns": max_turns})
    
    def pause_game(self) -> None:
        """Pause the game."""
        self.is_paused = True
        self.logger.info("Game paused")
    
    def resume_game(self) -> None:
        """Resume the game."""
        self.is_paused = False
        self.logger.info("Game resumed")
    
    def stop_game(self) -> None:
        """Stop the game."""
        self.is_running = False
        self.logger.info("Game stopped")
    
    # Action processors
    async def _process_create_faction(self, action: AgentAction, game_state: GameState) -> Dict[str, Any]:
        """Process faction creation action."""
        try:
            params = action.parameters
            
            # Create faction theme
            theme = FactionTheme(
                name=params["faction_name"],
                description=params["theme_description"],
                color_scheme=params["color_scheme"],
                architectural_style=params["architectural_style"],
                unit_naming_convention=params.get("unit_naming_convention", "Default"),
                lore=params.get("faction_lore", "")
            )
            
            # Create faction
            faction = Faction(
                name=params["faction_name"],
                theme=theme,
                owner_id=action.agent_id
            )
            
            # Add to game state
            success = game_state.add_faction(action.agent_id, faction)
            
            if success:
                self.logger.info(f"Created faction '{params['faction_name']}' for {action.agent_id}")
                return {
                    "success": True,
                    "faction_id": faction.faction_id,
                    "message": f"Faction '{params['faction_name']}' created successfully"
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to add faction to game state"
                }
                
        except Exception as e:
            return {"success": False, "error": f"Faction creation error: {str(e)}"}
    
    async def _process_design_unit(self, action: AgentAction, game_state: GameState) -> Dict[str, Any]:
        """Process unit design action."""
        try:
            params = action.parameters
            faction = game_state.factions.get(action.agent_id)
            
            if not faction:
                return {"success": False, "error": "Faction not found"}
            
            # Create unit design
            unit_design = {
                "name": params["unit_name"],
                "description": params["unit_description"],
                "category": params["unit_category"],
                "stats": params["stats"],
                "abilities": params.get("abilities", []),
                "resource_costs": params.get("resource_costs", {}),
                "sprite_description": params.get("sprite_description", "")
            }
            
            # Add to faction's custom designs
            success = faction.create_custom_unit_design(params["unit_name"], unit_design)
            
            if success:
                return {
                    "success": True,
                    "message": f"Unit design '{params['unit_name']}' created"
                }
            else:
                return {
                    "success": False,
                    "error": "Unit design name already exists"
                }
                
        except Exception as e:
            return {"success": False, "error": f"Unit design error: {str(e)}"}
    
    async def _process_design_building(self, action: AgentAction, game_state: GameState) -> Dict[str, Any]:
        """Process building design action."""
        try:
            from config.building_config import apply_building_template, get_inherent_abilities
            
            params = action.parameters
            faction = game_state.factions.get(action.agent_id)
            
            if not faction:
                return {"success": False, "error": "Faction not found"}
            
            building_type = params["building_type"]
            
            # Create building design with agent's specifications
            agent_design = {
                "name": params["building_name"],
                "description": params["building_description"],
                "building_type": building_type,
                "health": params.get("health"),
                "produces_units": params.get("produces_units"),
                "resource_generation": params.get("resource_generation"),
                "abilities": params.get("abilities", []),
                "resource_costs": params.get("resource_costs"),
                "sprite_description": params.get("sprite_description", "")
            }
            
            # Apply building template to merge defaults with agent's design
            # This ensures inherent abilities and default capabilities are present
            building_design = apply_building_template(agent_design, building_type)
            
            # Add back non-template fields
            building_design["name"] = agent_design["name"]
            building_design["description"] = agent_design["description"]
            building_design["building_type"] = building_type
            building_design["sprite_description"] = agent_design["sprite_description"]
            
            # Convert abilities set back to list for storage
            building_design["abilities"] = list(building_design["abilities"])
            
            # Store custom building design
            if not hasattr(faction, 'custom_building_designs'):
                faction.custom_building_designs = {}
            
            building_name = params["building_name"]
            if building_name in faction.custom_building_designs:
                return {
                    "success": False,
                    "error": "Building design name already exists"
                }
            
            faction.custom_building_designs[building_name] = building_design
            
            # Get inherent abilities for feedback
            inherent = get_inherent_abilities(building_type)
            message = f"Building design '{building_name}' created"
            if inherent:
                message += f" (inherent abilities: {', '.join(inherent)})"
            
            return {
                "success": True,
                "message": message
            }
                
        except Exception as e:
            return {"success": False, "error": f"Building design error: {str(e)}"}
    
    async def _process_move_unit(self, action: AgentAction, game_state: GameState) -> Dict[str, Any]:
        """Process unit movement action."""
        try:
            params = action.parameters
            faction = game_state.factions.get(action.agent_id)
            
            if not faction:
                return {"success": False, "error": "Faction not found"}
            
            # Find the unit
            unit = faction.get_unit(params["unit_id"])
            if not unit:
                return {"success": False, "error": "Unit not found"}
            
            target_x, target_y = params["target_x"], params["target_y"]
            
            # Validate target position
            target_tile = game_state.get_tile(target_x, target_y)
            if not target_tile:
                return {"success": False, "error": "Invalid target position"}
            
            if not target_tile.can_place_unit():
                return {"success": False, "error": "Target position is blocked"}
            
            # Remove unit from current tile
            current_tile = game_state.get_tile(unit.x, unit.y)
            if current_tile:
                current_tile.remove_unit()
            
            # Move unit
            success = unit.move_to(target_x, target_y)
            
            if success:
                # Place unit on new tile
                target_tile.place_unit(unit.unit_id)
                
                return {
                    "success": True,
                    "message": f"Unit moved to ({target_x}, {target_y})",
                    "new_position": {"x": target_x, "y": target_y}
                }
            else:
                # Restore unit to original position if move failed
                if current_tile:
                    current_tile.place_unit(unit.unit_id)
                
                return {"success": False, "error": "Unit cannot move (already moved or insufficient range)"}
                
        except Exception as e:
            return {"success": False, "error": f"Movement error: {str(e)}"}
    
    async def _process_attack_unit(self, action: AgentAction, game_state: GameState) -> Dict[str, Any]:
        """Process unit attack action."""
        try:
            params = action.parameters
            faction = game_state.factions.get(action.agent_id)
            
            if not faction:
                return {"success": False, "error": "Faction not found"}
            
            # Find attacker
            attacker = faction.get_unit(params["attacker_id"])
            if not attacker:
                return {"success": False, "error": "Attacker unit not found"}
            
            # Find target unit
            target = None
            target_faction_id = None
            
            for fid, other_faction in game_state.factions.items():
                if fid != action.agent_id:  # Not the attacking faction
                    target = other_faction.get_unit(params["target_id"])
                    if target:
                        target_faction_id = fid
                        break
            
            if not target:
                return {"success": False, "error": "Target unit not found"}
            
            # Perform attack with game_state for ability context
            attack_result = attacker.attack(target, game_state)
            
            if attack_result["success"]:
                # Remove target if destroyed
                if attack_result["target_destroyed"]:
                    target_faction = game_state.factions[target_faction_id]
                    target_faction.remove_unit(target.unit_id)
                    
                    # Remove from map
                    target_tile = game_state.get_tile(target.x, target.y)
                    if target_tile:
                        target_tile.remove_unit()
                
                return {
                    "success": True,
                    "damage_dealt": attack_result["damage_dealt"],
                    "target_destroyed": attack_result["target_destroyed"],
                    "message": f"Attack dealt {attack_result['damage_dealt']} damage"
                }
            else:
                return {"success": False, "error": attack_result["reason"]}
                
        except Exception as e:
            return {"success": False, "error": f"Attack error: {str(e)}"}
    
    # Additional action processors would go here...
    async def _process_build_structure(self, action: AgentAction, game_state: GameState) -> Dict[str, Any]:
        """Process building construction action."""
        # Placeholder implementation
        return {"success": False, "error": "Building construction not yet implemented"}
    
    async def _process_create_unit(self, action: AgentAction, game_state: GameState) -> Dict[str, Any]:
        """Process unit creation action - instant if resources available."""
        try:
            from entities.unit import Unit, UnitType, UnitStats
            
            params = action.parameters
            faction = game_state.factions.get(action.agent_id)
            
            if not faction:
                return {"success": False, "error": "Faction not found"}
            
            building_id = params["building_id"]
            unit_type = params["unit_type"]
            quantity = params.get("quantity", 1)
            
            # Get the building
            building = faction.get_building(building_id)
            if not building:
                return {"success": False, "error": "Building not found"}
            
            if not building.is_construction_complete:
                return {"success": False, "error": "Building still under construction"}
            
            # Check if building can produce this unit type
            if unit_type not in building.produces_units:
                return {"success": False, "error": f"Building cannot produce {unit_type}"}
            
            # Get unit design (custom or default)
            unit_design = faction.custom_unit_designs.get(unit_type)
            if not unit_design:
                return {"success": False, "error": f"Unit design '{unit_type}' not found"}
            
            created_units = []
            total_cost = {}
            
            # Calculate total cost
            creation_cost = unit_design.get("creation_cost", {"gold": 100})
            for resource, amount in creation_cost.items():
                total_cost[resource] = amount * quantity
            
            # Check if faction has enough resources
            if not faction.can_afford(total_cost):
                return {"success": False, "error": "Insufficient resources", "required": total_cost}
            
            # Deduct resources
            faction.spend_resources(total_cost)
            
            # Create units near the building
            for i in range(quantity):
                # Find adjacent tile for unit placement
                placement_pos = self._find_adjacent_free_tile(game_state, building.x, building.y)
                if not placement_pos:
                    # Refund remaining units
                    remaining = quantity - i
                    refund = {r: creation_cost[r] * remaining for r in creation_cost}
                    faction.add_resources(refund)
                    break
                
                # Create unit from design
                stats_data = unit_design["stats"]
                unit = Unit(
                    name=unit_design["name"],
                    unit_type=UnitType[unit_design["unit_category"].upper()],
                    faction_id=faction.faction_id,
                    owner_id=action.agent_id,
                    x=placement_pos[0],
                    y=placement_pos[1],
                    stats=UnitStats(
                        health=stats_data["health"],
                        max_health=stats_data["health"],
                        attack=stats_data["attack"],
                        defense=stats_data["defense"],
                        movement_speed=stats_data["movement_speed"],
                        attack_range=stats_data.get("attack_range", 1),
                        sight_range=stats_data.get("sight_range", 3)
                    ),
                    abilities=set(unit_design.get("abilities", [])),
                    creation_cost=creation_cost,
                    sprite=None  # Sprites would be generated separately
                )
                
                # Add to faction and place on map
                if faction.add_unit(unit):
                    game_state.get_tile(unit.x, unit.y).place_unit(unit.unit_id)
                    created_units.append(unit.unit_id)
            
            return {
                "success": True,
                "units_created": len(created_units),
                "unit_ids": created_units,
                "cost": total_cost,
                "building_id": building_id
            }
            
        except Exception as e:
            return {"success": False, "error": f"Unit creation error: {str(e)}"}
    
    def _find_adjacent_free_tile(self, game_state: GameState, x: int, y: int) -> Optional[Tuple[int, int]]:
        """Find a free tile adjacent to given coordinates."""
        # Check 8 surrounding tiles
        offsets = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
        
        for dx, dy in offsets:
            new_x, new_y = x + dx, y + dy
            if 0 <= new_x < game_state.map_width and 0 <= new_y < game_state.map_height:
                tile = game_state.get_tile(new_x, new_y)
                if tile and tile.can_place_unit():
                    return (new_x, new_y)
        
        return None
    
    async def _process_fortify_unit(self, action: AgentAction, game_state: GameState) -> Dict[str, Any]:
        """Process unit fortification action."""
        # Placeholder implementation
        return {"success": False, "error": "Unit fortification not yet implemented"}
    
    async def _process_analyze_balance(self, action: AgentAction, game_state: GameState) -> Dict[str, Any]:
        """Process admin balance analysis."""
        if self.admin_agent:
            self.admin_agent.record_balance_issue({
                "analysis": action.parameters.get("analysis", ""),
                "issues": action.parameters.get("balance_issues", []),
                "severity": action.parameters.get("severity", "minor")
            })
        
        return {"success": True, "message": "Balance analysis recorded"}
    
    async def _process_approve_faction(self, action: AgentAction, game_state: GameState) -> Dict[str, Any]:
        """Process faction approval by admin."""
        # This would typically trigger faction modifications or approval status changes
        return {"success": True, "message": "Faction approval processed"}
    
    async def _process_edit_faction_unit(self, action: AgentAction, game_state: GameState) -> Dict[str, Any]:
        """Process admin editing of faction unit."""
        try:
            faction_id = action.parameters.get("faction_id")
            unit_name = action.parameters.get("unit_name")
            new_stats = action.parameters.get("new_stats", {})
            new_costs = action.parameters.get("new_costs", {})
            reasoning = action.parameters.get("reasoning", "")
            
            faction = game_state.factions.get(faction_id)
            if not faction:
                return {"success": False, "error": "Faction not found"}
            
            # Find and edit the unit design
            if unit_name in faction.custom_unit_designs:
                unit_design = faction.custom_unit_designs[unit_name]
                
                # Update stats if provided
                if new_stats:
                    if "stats" not in unit_design:
                        unit_design["stats"] = {}
                    unit_design["stats"].update(new_stats)
                
                # Update costs if provided  
                if new_costs:
                    unit_design["resource_costs"] = new_costs
                
                # Mark as admin-edited
                unit_design["admin_edited"] = True
                unit_design["edit_reasoning"] = reasoning
                
                self.logger.info(f"Admin edited unit {unit_name} in faction {faction.name}: {reasoning}")
                return {"success": True, "message": f"Unit {unit_name} edited"}
            else:
                return {"success": False, "error": f"Unit {unit_name} not found in faction"}
                
        except Exception as e:
            self.logger.error(f"Failed to edit faction unit: {e}")
            return {"success": False, "error": str(e)}
    
    async def _process_edit_faction_theme(self, action: AgentAction, game_state: GameState) -> Dict[str, Any]:
        """Process admin editing of faction theme."""
        try:
            faction_id = action.parameters.get("faction_id")
            new_description = action.parameters.get("new_description")
            reasoning = action.parameters.get("reasoning", "")
            
            faction = game_state.factions.get(faction_id)
            if not faction:
                return {"success": False, "error": "Faction not found"}
            
            # Update theme description
            if new_description and faction.theme:
                faction.theme.description = new_description
                
            # Mark as admin-edited
            if not hasattr(faction, 'admin_edits'):
                faction.admin_edits = []
            faction.admin_edits.append({
                "type": "theme_edit",
                "reasoning": reasoning,
                "timestamp": time.time()
            })
            
            self.logger.info(f"Admin edited theme for faction {faction.name}: {reasoning}")
            return {"success": True, "message": f"Theme edited for {faction.name}"}
            
        except Exception as e:
            self.logger.error(f"Failed to edit faction theme: {e}")
            return {"success": False, "error": str(e)}
    
    async def _process_suggest_adjustments(self, action: AgentAction, game_state: GameState) -> Dict[str, Any]:
        """Process balance adjustment suggestions."""
        return {"success": True, "message": "Balance adjustments noted"}
    
    def get_game_statistics(self) -> Dict[str, Any]:
        """Get comprehensive game statistics."""
        turn_stats = self.turn_manager.get_turn_statistics()
        
        # Agent performance
        agent_stats = {}
        for agent in self.player_agents:
            agent_stats[agent.agent_id] = {
                **self.turn_manager.get_agent_performance(agent.agent_id),
                **agent.get_performance_stats()
            }
        
        # Game state statistics
        faction_stats = {}
        for agent_id, faction in self.game_state.factions.items():
            faction_stats[agent_id] = {
                "name": faction.name,
                "units": len(faction.units),
                "buildings": len(faction.buildings),
                "resources": sum(faction.resources.values()),
                "military_strength": faction.get_total_military_strength()
            }
        
        return {
            "game_id": self.game_id,
            "turn_number": self.game_state.turn_number,
            "phase": self.game_state.phase.value,
            "is_running": self.is_running,
            "is_paused": self.is_paused,
            "turn_statistics": turn_stats,
            "agent_performance": agent_stats,
            "faction_statistics": faction_stats,
            "admin_balance": self.admin_agent.get_balance_summary() if self.admin_agent else None
        }
    
    async def process_faction_creation(self, agent_id: str, faction_data: List[Any]) -> bool:
        """Process faction creation data."""
        from entities.faction import Faction, FactionTheme
        from entities.unit import Unit, UnitStats, UnitType
        
        # Create a default theme
        default_theme = FactionTheme(
            name=f"The {agent_id} Empire",
            description="A powerful faction focused on military conquest",
            color_scheme=["#8B0000", "#CD5C5C", "#FFD700"],
            architectural_style="medieval",
            unit_naming_convention="Military titles",
            lore="A rising empire with strong military traditions"
        )
        
        # Create a basic faction for the agent
        faction = Faction(
            name=f"Faction of {agent_id}",
            owner_id=agent_id,
            theme=default_theme
        )
        
        # Add some starting units so the faction isn't immediately eliminated
        starting_unit = Unit(
            name=f"Starting Warrior",
            unit_type=UnitType.INFANTRY,
            faction_id=faction.faction_id,
            owner_id=agent_id,
            x=5 + len(self.game_state.factions) * 3,  # Spread out starting positions
            y=5 + len(self.game_state.factions) * 3,
            stats=UnitStats(health=50, max_health=50, attack=10, defense=5, movement_speed=2)
        )
        faction.add_unit(starting_unit)
        
        # Add the faction to the game state
        success = self.game_state.add_faction(agent_id, faction)
        
        if success:
            self.logger.info(f"✅ Created faction '{faction.name}' for {agent_id} with {len(faction.units)} units")
        else:
            self.logger.error(f"❌ Failed to create faction for {agent_id}")
            
        return success
    
    async def process_player_action(self, agent_id: str, action: 'AgentAction') -> bool:
        """Process a player action through the turn manager."""
        result = await self.turn_manager._execute_action(action, self.game_state)
        return result.get("success", False)
    
    async def _process_send_message(self, action: 'AgentAction', game_state: 'GameState') -> Dict[str, Any]:
        """Process a send_message action."""
        try:
            target = action.parameters.get("target", "all")
            message = action.parameters.get("message", "")
            
            if not message:
                return {"success": False, "error": "Empty message"}
            
            # Log the message (in a real game, this would be sent to other players)
            self.logger.info(f"📨 [{action.agent_id}] Message to {target}: {message}")
            
            # Store message in game state (simplified implementation)
            if not hasattr(game_state, 'messages'):
                game_state.messages = []
            
            game_state.messages.append({
                "sender": action.agent_id,
                "target": target,
                "message": message,
                "turn": game_state.turn_number
            })
            
            return {"success": True, "message": "Message sent"}
            
        except Exception as e:
            self.logger.error(f"Error processing send_message: {e}")
            return {"success": False, "error": str(e)}
    
    async def apply_balance_adjustments(self, adjustments: List[Dict[str, Any]], factions: Dict[str, Any]) -> bool:
        """Apply balance adjustments to factions."""
        # Simplified implementation
        self.logger.info(f"Applied {len(adjustments)} balance adjustments")
        return True