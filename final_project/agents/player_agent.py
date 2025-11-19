"""Player agent implementation with strategic decision making."""
import asyncio
import json
import random
from typing import Dict, List, Optional, Any

from .base_agent import (
    BaseAgent, AgentAction, AgentPersonalityMixin, 
    AgentMemoryMixin, AgentCommunicationMixin
)
from .function_schemas import get_functions_for_phase, FACTION_SETUP_FUNCTIONS, GAME_ACTION_FUNCTIONS
from config.llm_config import (
    DEFAULT_PERSONALITIES, PLAYER_AGENT_SYSTEM_PROMPT, DEBUG_LLM_RESPONSES,
    get_player_agent_system_prompt
)
import time

# Import faction cache
try:
    from data.cache.faction_cache import FactionCache
    FACTION_CACHING_ENABLED = True
except ImportError:
    FACTION_CACHING_ENABLED = False

class PlayerAgent(BaseAgent, AgentPersonalityMixin, AgentMemoryMixin, AgentCommunicationMixin):
    """AI player agent that controls a faction in the game."""
    
    def __init__(self, agent_id: str, personality_index: int = 0,
                 use_faction_cache: bool = True,
                 faction_cache_mode: str = "similar"):  # "exact", "similar", "random"
        """Initialize player agent with personality."""
        # Get personality from config
        personality = DEFAULT_PERSONALITIES[personality_index % len(DEFAULT_PERSONALITIES)]
        
        BaseAgent.__init__(self, agent_id, personality.name)
        AgentPersonalityMixin.__init__(self, {
            "strategic_style": personality.strategic_style,
            "risk_tolerance": personality.risk_tolerance,
            "communication_style": personality.communication_style,
            "preferred_unit_types": personality.preferred_unit_types,
            "description": f"{personality.name} - {personality.strategic_style} strategist"
        })
        AgentMemoryMixin.__init__(self)
        AgentCommunicationMixin.__init__(self, personality.communication_style)
        
        # Faction caching configuration
        self.use_faction_cache = use_faction_cache and FACTION_CACHING_ENABLED
        self.faction_cache_mode = faction_cache_mode
        self.faction_cache = FactionCache() if self.use_faction_cache else None
        
        self.faction_id: Optional[str] = None
        self.faction_created = False
        self.current_strategy = "early_game"
        self.priority_targets: List[str] = []
        
        self.logger.info(f"Created player agent {personality.name} with {personality.strategic_style} style")
    
    async def create_faction(self) -> Dict[str, Any]:
        """Create faction through game engine."""
        actions = await self._handle_faction_setup({})
        return {"success": True, "actions": actions}
    
    async def take_turn(self, game_state: 'GameState') -> List[AgentAction]:
        """Take a turn in the game."""
        game_state_view = game_state.get_agent_view(self.agent_id)
        return await self.make_decision(game_state_view)
    
    def get_system_prompt(self) -> str:
        """Get system prompt for player agent with dynamic ability descriptions."""
        return get_player_agent_system_prompt(
            personality_name=self.name,
            strategic_style=self.strategic_style,
            communication_style=self.communication_style
        ) + self.get_personality_context()
    
    async def make_decision(self, game_state_view: Dict[str, Any]) -> List[AgentAction]:
        """Make strategic decisions based on game state."""
        game_phase = game_state_view.get("phase", "setup")
        
        # Debug logging
        if DEBUG_LLM_RESPONSES:
            print(f"🎯 [{self.agent_id}] Making decision - Phase: {game_phase}, Faction created: {self.faction_created}")
        
        if game_phase == "setup" and not self.faction_created:
            return await self._handle_faction_setup(game_state_view)
        elif game_phase == "playing":
            return await self._handle_gameplay_turn(game_state_view)
        else:
            if DEBUG_LLM_RESPONSES:
                print(f"⚠️ [{self.agent_id}] No action taken - Phase: {game_phase}, Faction: {self.faction_created}")
            return []
    
    async def _handle_faction_setup(self, game_state_view: Dict[str, Any]) -> List[AgentAction]:
        """Handle faction creation phase with caching support."""
        try:
            # Try to load complete faction from cache first
            if self.use_faction_cache and self.faction_cache:
                cached_faction = await self._try_load_cached_complete_faction()
                if cached_faction:
                    return cached_faction
            
            # Generate new faction if no cache hit
            faction_action = await self._create_faction()
            actions = [faction_action] if faction_action else []
            
            # Then create some custom unit designs
            unit_designs = await self._create_unit_designs()
            actions.extend(unit_designs)
            
            # Cache the complete faction for future use
            if self.use_faction_cache and self.faction_cache and faction_action:
                await self._cache_complete_faction(faction_action, unit_designs)
            
            self.faction_created = True
            return actions
            
        except Exception as e:
            self.logger.error(f"Error in faction setup: {e}")
            return []
    
    async def _create_faction(self) -> Optional[AgentAction]:
        """Create faction with theme and identity."""
        prompt = f"""
Create your faction for this strategy game. Consider your personality as {self.name} with {self.strategic_style} style.

Make your faction unique and interesting, with a clear theme that matches your personality.
Preferred unit types: {', '.join(self.preferred_unit_types)}

Use the create_faction function to define your faction.
"""
        
        functions = FACTION_SETUP_FUNCTIONS
        response = await self.llm_interface.make_function_call(
            system_prompt=self.get_system_prompt(),
            user_message=prompt,
            available_functions=functions
        )
        
        if response.success and response.function_calls:
            func_call = response.function_calls[0]
            if func_call["name"] == "create_faction":
                return AgentAction(
                    action_type="create_faction",
                    parameters=func_call["arguments"],
                    reasoning="Creating faction identity and theme",
                    agent_id=self.agent_id,
                    timestamp=time.time()
                )
        
        return None
    
    async def _create_unit_designs(self) -> List[AgentAction]:
        """Create custom unit designs for faction."""
        actions = []
        
        # Get dynamic ability descriptions
        try:
            from abilities import get_ability_descriptions
            ability_list = get_ability_descriptions("unit")
        except ImportError:
            ability_list = "Abilities loading..."
        
        # Create 2-3 unit designs based on preferred types and strategy
        design_count = random.randint(2, 3)
        
        for i in range(design_count):
            if self.preferred_unit_types:
                unit_category = random.choice(self.preferred_unit_types)
            else:
                unit_category = random.choice(["infantry", "cavalry", "ranged", "support"])
            
            prompt = f"""
Design a custom {unit_category} unit for your faction that fits your {self.strategic_style} strategy.

Consider:
- Your faction's theme and style
- Combat role and tactical purpose
- Balanced but interesting stats (health: 10-100, attack: 1-50, defense: 0-30, movement: 1-10)
- Unique abilities that support your strategy (max 3)

AVAILABLE ABILITIES:
{ability_list}

This is design #{i+1} of {design_count}. Make each unit design distinct and useful.

Use the design_unit function.
"""
            
            functions = [func for func in FACTION_SETUP_FUNCTIONS if func["name"] == "design_unit"]
            response = await self.llm_interface.make_function_call(
                system_prompt=self.get_system_prompt(),
                user_message=prompt,
                available_functions=functions
            )
            
            if response.success and response.function_calls:
                func_call = response.function_calls[0]
                if func_call["name"] == "design_unit":
                    action = AgentAction(
                        action_type="design_unit",
                        parameters=func_call["arguments"],
                        reasoning=f"Creating custom {unit_category} unit design",
                        agent_id=self.agent_id,
                        timestamp=time.time()
                    )
                    actions.append(action)
        
        return actions
    
    async def _handle_gameplay_turn(self, game_state_view: Dict[str, Any]) -> List[AgentAction]:
        """Handle main gameplay decisions."""
        # Always process gameplay turns when called
        
        try:
            # Analyze current situation
            situation = self._analyze_situation(game_state_view)
            
            # Update strategy based on game state
            self._update_strategy(game_state_view, situation)
            
            # Generate context for decision making
            context = self._build_decision_context(game_state_view, situation)
            
            # Make LLM decision
            actions = await self._make_strategic_decisions(context, game_state_view)
            
            # Add communication if appropriate
            if self.should_send_message(situation):
                message_action = await self._generate_message(game_state_view, situation)
                if message_action:
                    actions.append(message_action)
            
            # Remember this turn's strategy
            self.remember_short_term({
                "turn": game_state_view.get("turn_number"),
                "strategy": self.current_strategy,
                "actions": [a.action_type for a in actions],
                "situation": situation
            })
            
            return actions
            
        except Exception as e:
            self.logger.error(f"Error in gameplay turn: {e}")
            return []
    
    def _analyze_situation(self, game_state_view: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze current game situation."""
        my_faction = game_state_view.get("my_faction", {})
        visible_enemies = game_state_view.get("visible_enemies", {})
        turn_number = game_state_view.get("turn_number", 0)
        
        # Calculate military strength
        my_units = len(my_faction.get("units", []))
        my_buildings = len(my_faction.get("buildings", []))
        my_resources = my_faction.get("resources", {})
        
        # Count visible enemies
        enemy_units = sum(len(units) for units in visible_enemies.values())
        
        # Determine game phase
        if turn_number < 20:
            game_phase = "early"
        elif turn_number < 80:
            game_phase = "mid"
        else:
            game_phase = "late"
        
        # Assess threats
        under_attack = any(
            any(unit.get("x") is not None for unit in units)  # Simplified threat detection
            for units in visible_enemies.values()
        )
        
        return {
            "game_phase": game_phase,
            "my_military_strength": my_units,
            "enemy_military_strength": enemy_units,
            "economic_strength": sum(my_resources.values()),
            "under_attack": under_attack,
            "resource_situation": self._assess_resources(my_resources),
            "expansion_opportunities": self._find_expansion_opportunities(game_state_view),
            "combat_opportunities": self._find_combat_opportunities(game_state_view)
        }
    
    def _assess_resources(self, resources: Dict[str, int]) -> str:
        """Assess resource situation."""
        total_resources = sum(resources.values())
        if total_resources > 1000:
            return "abundant"
        elif total_resources > 500:
            return "adequate"
        elif total_resources > 200:
            return "limited"
        else:
            return "scarce"
    
    def _find_expansion_opportunities(self, game_state_view: Dict[str, Any]) -> List[str]:
        """Find expansion opportunities."""
        # Simplified - would analyze visible map for good expansion spots
        opportunities = []
        
        my_faction = game_state_view.get("my_faction", {})
        buildings = my_faction.get("buildings", [])
        
        if len(buildings) < 3:
            opportunities.append("need_more_buildings")
        
        resources = my_faction.get("resources", {})
        if resources.get("gold", 0) > 500:
            opportunities.append("can_afford_expansion")
        
        return opportunities
    
    def _find_combat_opportunities(self, game_state_view: Dict[str, Any]) -> List[str]:
        """Find combat opportunities."""
        opportunities = []
        
        visible_enemies = game_state_view.get("visible_enemies", {})
        my_faction = game_state_view.get("my_faction", {})
        my_units = my_faction.get("units", [])
        
        if visible_enemies and my_units:
            # Simplified combat opportunity analysis
            my_military = len(my_units)
            enemy_military = sum(len(units) for units in visible_enemies.values())
            
            if my_military > enemy_military * 1.2:
                opportunities.append("military_advantage")
            elif my_military > enemy_military * 0.8:
                opportunities.append("balanced_forces")
        
        return opportunities
    
    def _update_strategy(self, game_state_view: Dict[str, Any], situation: Dict[str, Any]) -> None:
        """Update current strategy based on situation."""
        game_phase = situation["game_phase"]
        resource_situation = situation["resource_situation"]
        
        # Strategy selection based on personality and situation
        if game_phase == "early":
            if self.strategic_style == "aggressive" and situation["my_military_strength"] > 2:
                self.current_strategy = "early_aggression"
            elif self.strategic_style == "economic":
                self.current_strategy = "economic_boom"
            else:
                self.current_strategy = "balanced_development"
        
        elif game_phase == "mid":
            if situation["under_attack"]:
                self.current_strategy = "defensive"
            elif situation["combat_opportunities"]:
                self.current_strategy = "offensive"
            elif resource_situation == "abundant":
                self.current_strategy = "expansion"
            else:
                self.current_strategy = "consolidation"
        
        else:  # late game
            if situation["my_military_strength"] > situation["enemy_military_strength"]:
                self.current_strategy = "victory_push"
            else:
                self.current_strategy = "survival"
    
    def _build_decision_context(self, game_state_view: Dict[str, Any], situation: Dict[str, Any]) -> str:
        """Build optimized context string for LLM decision making."""
        my_faction = game_state_view.get("my_faction", {})
        
        # Core game state (always needed)
        context_parts = [
            f"Turn {game_state_view.get('turn_number', 0)} - {situation['game_phase']} game",
            f"Strategy: {self.current_strategy} | Style: {self.strategic_style}"
        ]
        
        # Military summary (condensed)
        my_units = my_faction.get('units', [])
        context_parts.append(f"My forces: {len(my_units)} units ({self._summarize_units(my_units)})")
        
        # Resource situation (essential for decisions)
        resources = my_faction.get('resources', {})
        context_parts.append(f"Resources: G{resources.get('gold', 0)} W{resources.get('wood', 0)} F{resources.get('food', 0)} S{resources.get('stone', 0)}")
        
        # Buildings (count + key types)
        buildings = my_faction.get('buildings', [])
        building_summary = self._summarize_buildings(buildings)
        context_parts.append(f"Buildings: {len(buildings)} ({building_summary})")
        
        # Tactical situation
        if situation["under_attack"]:
            context_parts.append("🚨 UNDER ATTACK!")
        
        # Nearby threats and opportunities (only relevant ones)
        nearby_info = self._get_nearby_tactical_info(game_state_view)
        if nearby_info:
            context_parts.extend(nearby_info)
        
        # Strategic memories (only most relevant)
        relevant_memories = self.get_relevant_memories(self.current_strategy)
        if relevant_memories:
            context_parts.append("Key lessons:")
            for memory in relevant_memories[-1:]:  # Only most recent
                if memory.get("negative_example"):
                    context_parts.append(f"- Avoid: {memory['strategy'][:50]}")
                else:
                    context_parts.append(f"- Success: {memory['strategy'][:50]}")
        
        return "\n".join(context_parts)
    
    async def _make_strategic_decisions(self, context: str, game_state_view: Dict[str, Any]) -> List[AgentAction]:
        """Make strategic decisions using LLM with optimized context."""
        
        # Build optimized faction summary for understanding
        faction_summary = self._build_faction_summary(game_state_view.get('my_faction', {}))
        map_summary = self._build_tactical_map_summary(game_state_view)
        
        # BUT also provide tactical data needed for precise actions
        tactical_data = self._build_tactical_action_data(game_state_view)
        
        prompt = f"""Situation Report:
{context}

My Forces & Assets:
{faction_summary}

Tactical Environment:
{map_summary}

Available Tactical Options:
{tactical_data}

Decision Framework:
- Strategy: {self.current_strategy}
- Style: {self.strategic_style} (risk tolerance: {self.risk_tolerance})
- Priority: {self._get_current_priority(game_state_view)}

Make strategic decisions for this turn. Use the tactical options above for precise unit IDs and coordinates when taking actions."""
        
        functions = get_functions_for_phase("playing")
        response = await self.llm_interface.make_function_call(
            system_prompt=self.get_system_prompt(),
            user_message=prompt,
            available_functions=functions
        )
        
        actions = []
        if response.success and response.function_calls:
            for func_call in response.function_calls:
                action = AgentAction(
                    action_type=func_call["name"],
                    parameters=func_call["arguments"],
                    reasoning=func_call["arguments"].get("reasoning", "Strategic decision"),
                    agent_id=self.agent_id,
                    timestamp=time.time()
                )
                actions.append(action)
        
        return actions
    
    def _summarize_units(self, units: List[Dict[str, Any]]) -> str:
        """Create a concise military summary."""
        if not units:
            return "none"
        
        # Group by type for efficient summary
        unit_types = {}
        wounded = 0
        
        for unit in units:
            unit_type = unit.get('unit_type', 'unknown')
            health = unit.get('stats', {}).get('health', 0)
            max_health = unit.get('stats', {}).get('max_health', 1)
            
            if unit_type not in unit_types:
                unit_types[unit_type] = 0
            unit_types[unit_type] += 1
            
            if health < max_health * 0.7:
                wounded += 1
        
        # Create readable summary
        type_summary = []
        for unit_type, count in unit_types.items():
            if count > 1:
                type_summary.append(f"{count} {unit_type}")
            else:
                type_summary.append(unit_type)
        
        result = ", ".join(type_summary)
        if wounded > 0:
            result += f", {wounded} wounded"
        return result

    def _summarize_buildings(self, buildings: List[Dict[str, Any]]) -> str:
        """Create a concise building summary."""
        if not buildings:
            return "none"
        
        building_types = {}
        for building in buildings:
            building_type = building.get('building_type', 'unknown')
            if building_type not in building_types:
                building_types[building_type] = 0
            building_types[building_type] += 1
        
        return ", ".join([f"{count} {btype}" if count > 1 else btype.replace('_', ' ') 
                         for btype, count in building_types.items()])

    def _get_nearby_tactical_info(self, game_state_view: Dict[str, Any]) -> List[str]:
        """Get only tactically relevant nearby information."""
        info = []
        visible_enemies = game_state_view.get('visible_enemies', {})
        
        # Count nearby threats
        total_enemy_units = sum(len(units) for units in visible_enemies.values())
        if total_enemy_units > 0:
            info.append(f"Spotted {total_enemy_units} enemy units")
        
        return info

    def _build_faction_summary(self, faction_data: Dict[str, Any]) -> str:
        """Build a concise faction summary instead of full JSON dump."""
        if not faction_data:
            return "No faction data available"
        
        units = faction_data.get('units', [])
        buildings = faction_data.get('buildings', [])
        resources = faction_data.get('resources', {})
        
        summary_parts = [
            f"Units: {self._summarize_units(units)}",
            f"Buildings: {self._summarize_buildings(buildings)}",
            f"Resources: G{resources.get('gold', 0)} W{resources.get('wood', 0)} F{resources.get('food', 0)} S{resources.get('stone', 0)}"
        ]
        
        return "\\n".join(summary_parts)

    def _build_tactical_map_summary(self, game_state_view: Dict[str, Any]) -> str:
        """Build a tactical map summary focusing on movement and combat."""
        visible_enemies = game_state_view.get('visible_enemies', {})
        
        enemy_count = sum(len(units) for units in visible_enemies.values())
        if enemy_count > 0:
            return f"Enemy presence: {enemy_count} units visible in area"
        else:
            return "Clear tactical situation"

    def _get_current_priority(self, game_state_view: Dict[str, Any]) -> str:
        """Determine current strategic priority based on game state."""
        my_faction = game_state_view.get('my_faction', {})
        resources = my_faction.get('resources', {})
        units = my_faction.get('units', [])
        visible_enemies = game_state_view.get('visible_enemies', {})
        
        gold = resources.get('gold', 0)
        enemy_count = sum(len(enemy_units) for enemy_units in visible_enemies.values())
        
        if enemy_count > len(units):
            return "Military expansion"
        elif gold < 100:
            return "Economic development" 
        else:
            return "Exploration and growth"
    
    def _build_tactical_action_data(self, game_state_view: Dict[str, Any]) -> str:
        """Build concise but actionable tactical data with specific IDs and coordinates."""
        my_faction = game_state_view.get('my_faction', {})
        my_units = my_faction.get('units', [])
        visible_enemies = game_state_view.get('visible_enemies', {})
        
        tactical_parts = []
        
        # My units (only essential info for actions)
        if my_units:
            unit_lines = []
            for unit in my_units:
                unit_id = unit.get('unit_id', 'unknown')
                unit_type = unit.get('unit_type', 'unknown')
                x, y = unit.get('x', 0), unit.get('y', 0)
                health = unit.get('stats', {}).get('health', 0)
                max_health = unit.get('stats', {}).get('max_health', 1)
                has_moved = unit.get('has_moved', False)
                has_attacked = unit.get('has_attacked', False)
                
                # Compact unit info: ID, type, position, status
                status_flags = []
                if has_moved: status_flags.append("moved")
                if has_attacked: status_flags.append("attacked") 
                if health < max_health * 0.5: status_flags.append("wounded")
                
                status_str = f" ({', '.join(status_flags)})" if status_flags else ""
                unit_lines.append(f"  {unit_id}: {unit_type} @({x},{y}){status_str}")
            
            tactical_parts.append("MY UNITS:")
            tactical_parts.extend(unit_lines[:10])  # Limit to prevent bloat
        
        # Enemy units (only those in combat/move range)
        nearby_enemies = []
        for agent_id, enemy_units in visible_enemies.items():
            for enemy in enemy_units:
                enemy_id = enemy.get('unit_id', 'unknown')
                enemy_type = enemy.get('unit_type', 'unknown')
                ex, ey = enemy.get('x', 0), enemy.get('y', 0)
                enemy_health = enemy.get('health', 0)
                
                # Check if any of my units can reach this enemy
                in_range = False
                for my_unit in my_units:
                    mx, my = my_unit.get('x', 0), my_unit.get('y', 0)
                    distance = abs(mx - ex) + abs(my - ey)
                    if distance <= 5:  # Within reasonable action range
                        in_range = True
                        break
                
                if in_range:
                    nearby_enemies.append(f"  {enemy_id}: {enemy_type} @({ex},{ey}) HP{enemy_health}")
        
        if nearby_enemies:
            tactical_parts.append("\\nTARGETS IN RANGE:")
            tactical_parts.extend(nearby_enemies[:8])  # Limit to prevent bloat
        
        # Good building positions (only a few strategic spots)
        my_buildings = my_faction.get('buildings', [])
        if my_buildings:
            # Find safe positions near existing buildings for expansion
            safe_positions = []
            for building in my_buildings[:2]:  # Only check first 2 buildings
                bx, by = building.get('x', 0), building.get('y', 0)
                # Suggest positions adjacent to existing buildings
                for dx, dy in [(2, 0), (-2, 0), (0, 2), (0, -2)]:
                    new_x, new_y = bx + dx, by + dy
                    if 0 <= new_x <= 19 and 0 <= new_y <= 19:  # Within map bounds
                        safe_positions.append(f"({new_x},{new_y})")
                
            if safe_positions:
                tactical_parts.append(f"\\nSAFE BUILD SPOTS: {', '.join(safe_positions[:6])}")
        
        return "\\n".join(tactical_parts) if tactical_parts else "No immediate tactical options"
    
    async def _generate_message(self, game_state_view: Dict[str, Any], situation: Dict[str, Any]) -> Optional[AgentAction]:
        """Generate a message to other players."""
        context = self.generate_message_context(game_state_view)
        
        prompt = f"""
Generate a message to other players based on the current situation.

Context: {context}
Your communication style: {self.communication_style}
Current situation: {json.dumps(situation, indent=2)}

Choose appropriate message type:
- taunt: Trash talk or intimidation
- diplomacy: Alliance proposals or negotiations  
- information: Sharing intelligence or warnings
- celebration: Celebrating achievements

Make the message fit your personality and the game situation.
"""
        
        functions = [func for func in get_functions_for_phase("playing") 
                    if func["name"] == "send_message"]
        
        response = await self.llm_interface.make_function_call(
            system_prompt=self.get_system_prompt(),
            user_message=prompt,
            available_functions=functions
        )
        
        if response.success and response.function_calls:
            func_call = response.function_calls[0]
            return AgentAction(
                action_type="send_message",
                parameters=func_call["arguments"],
                reasoning="Player communication",
                agent_id=self.agent_id,
                timestamp=time.time()
            )
        
        return None
        
    # Faction caching methods
    async def _try_load_cached_complete_faction(self) -> Optional[List[AgentAction]]:
        """Try to load a complete cached faction (faction + units + sprites)."""
        if not self.faction_cache:
            return None
            
        try:
            personality = self._extract_personality_type()
            
            cached_data = None
            if self.faction_cache_mode == "exact":
                # For exact mode, we'd need a specific theme hint - skip for now
                cached_data = self.faction_cache.get_similar_faction(personality)
            elif self.faction_cache_mode == "similar":
                cached_data = self.faction_cache.get_similar_faction(personality)
            elif self.faction_cache_mode == "random":
                cached_data = self.faction_cache.get_similar_faction(personality)
                
            if cached_data and "faction_creation" in cached_data and "unit_designs" in cached_data:
                self.logger.info(f"Using cached complete faction (mode: {self.faction_cache_mode})")
                return self._convert_cached_faction_to_actions(cached_data)
                
        except Exception as e:
            self.logger.warning(f"Failed to load cached faction: {e}")
            
        return None
    
    def _convert_cached_faction_to_actions(self, cached_data: Dict[str, Any]) -> List[AgentAction]:
        """Convert cached faction data back to AgentActions."""
        actions = []
        
        try:
            # Convert faction creation data
            faction_data = cached_data["faction_creation"]
            faction_action = AgentAction(
                action_type="create_faction",
                parameters=faction_data,
                reasoning="Using cached faction creation data",
                agent_id=self.agent_id,
                timestamp=time.time()
            )
            actions.append(faction_action)
            
            # Convert unit design data
            unit_designs = cached_data["unit_designs"]
            for unit_data in unit_designs:
                unit_action = AgentAction(
                    action_type="design_unit",
                    parameters=unit_data,
                    reasoning="Using cached unit design data",
                    agent_id=self.agent_id,
                    timestamp=time.time()
                )
                actions.append(unit_action)
                
        except Exception as e:
            self.logger.error(f"Failed to convert cached faction to actions: {e}")
            return []
            
        return actions
    
    async def _cache_complete_faction(self, faction_action: AgentAction, unit_designs: List[AgentAction]):
        """Cache the complete faction creation data."""
        try:
            personality = self._extract_personality_type()
            
            # Extract unit design parameters
            unit_designs_data = []
            for action in unit_designs:
                if action and hasattr(action, 'parameters'):
                    unit_designs_data.append(action.parameters)
            
            # For sprites, we'll leave it empty for now since sprites are generated separately
            # The sprite generator will handle sprite caching
            sprites_data = {}
            
            self.faction_cache.store_complete_faction(
                personality,
                faction_action.parameters,
                unit_designs_data,
                sprites_data
            )
            
            self.logger.info(f"Cached complete faction data for personality: {personality}")
            
        except Exception as e:
            self.logger.warning(f"Failed to cache complete faction: {e}")
    
    def _extract_personality_type(self) -> str:
        """Extract personality type from agent configuration."""
        # Map strategic style to personality type
        strategic_style = getattr(self, 'strategic_style', '').lower()
        
        if 'aggressive' in strategic_style or 'offensive' in strategic_style:
            return 'aggressive'
        elif 'defensive' in strategic_style or 'turtle' in strategic_style:
            return 'defensive'
        elif 'diplomatic' in strategic_style or 'peaceful' in strategic_style:
            return 'peaceful'
        elif 'balanced' in strategic_style or 'adaptive' in strategic_style:
            return 'balanced'
        
        # Fallback to agent name analysis
        agent_name = getattr(self, 'name', '').lower()
        if any(word in agent_name for word in ['caesar', 'warrior', 'conqueror']):
            return 'aggressive'
        elif any(word in agent_name for word in ['guardian', 'defender']):
            return 'defensive'
        elif any(word in agent_name for word in ['diplomat', 'merchant']):
            return 'peaceful'
        
        return 'balanced'  # Default fallback