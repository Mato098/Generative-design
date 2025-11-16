"""Admin agent for game balance and oversight."""
import asyncio
import json
from typing import Dict, List, Optional, Any, TYPE_CHECKING

from .base_agent import BaseAgent, AgentAction
from .function_schemas import get_admin_functions
from config.llm_config import ADMIN_AGENT_SYSTEM_PROMPT
import time

if TYPE_CHECKING:
    from core.game_state import GameState

class AdminAgent(BaseAgent):
    """Admin agent that monitors game balance and provides oversight."""
    
    def __init__(self):
        """Initialize admin agent."""
        super().__init__("admin", "Game Admin")
        self.balance_issues: List[Dict[str, Any]] = []
        self.interventions: List[Dict[str, Any]] = []
        self.faction_reviews: Dict[str, Dict[str, Any]] = {}
        self.game_narrative: List[str] = []
        
        self.logger.info("Initialized Admin Agent")
    
    async def analyze_game_balance(self, factions: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze overall game balance using LLM."""
        try:
            # Create analysis prompt
            factions_summary = []
            for agent_id, faction in factions.items():
                summary = {
                    "owner": agent_id,
                    "name": faction.get("name", "Unknown"),
                    "units": len(faction.get("units", [])),
                    "buildings": len(faction.get("buildings", [])),
                    "resources": faction.get("resources", {}),
                    "theme": faction.get("theme", {}).get("architectural_style", "unknown")
                }
                factions_summary.append(summary)
            
            system_prompt = """You are an expert game balance analyst. Analyze faction balance and provide a numerical score and specific issues."""
            
            user_prompt = f"""Analyze the balance of these {len(factions_summary)} factions:
{factions_summary}

Provide a JSON response with:
- balance_score: float from 0.0 (completely unbalanced) to 1.0 (perfectly balanced)
- issues: list of specific balance problems
- recommendations: list of suggested improvements

Consider: unit counts, resource distribution, building types, and overall power levels."""

            # Use LLM to analyze balance
            response = await self.llm_interface.make_function_call(
                system_prompt,
                user_prompt,
                []
            )
            
            if response.success and response.content:
                try:
                    import json
                    result = json.loads(response.content)
                    self.logger.info(f"📊 Balance analysis: score={result.get('balance_score', 0.5)}, issues={len(result.get('issues', []))}")
                    return result
                except json.JSONDecodeError:
                    self.logger.warning("Failed to parse balance analysis JSON")
            
        except Exception as e:
            self.logger.error(f"Balance analysis failed: {e}")
        
        # Fallback analysis
        return {"balance_score": 0.8, "issues": [], "recommendations": []}

    async def suggest_balance_adjustments(self, factions: Dict[str, Any]) -> Dict[str, Any]:
        """Suggest balance adjustments using LLM."""
        try:
            # Call the proper LLM-based adjustment method
            adjustment_action = await self._suggest_balance_adjustments(factions)
            
            if adjustment_action and adjustment_action.result:
                return {
                    "adjustments": adjustment_action.result,
                    "reasoning": adjustment_action.reasoning
                }
            else:
                self.logger.info("No balance adjustments needed")
                return {"adjustments": [], "reasoning": "No major issues detected"}
                
        except Exception as e:
            self.logger.error(f"Balance adjustment suggestion failed: {e}")
            return {"adjustments": [], "reasoning": "Analysis failed"}
    
    async def provide_turn_commentary(self, game_state: 'GameState', turn: int) -> str:
        """Provide commentary on the current game state."""
        return f"Turn {turn}: The game continues with strategic maneuvering."
    
    def get_system_prompt(self) -> str:
        """Get system prompt for admin agent."""
        return ADMIN_AGENT_SYSTEM_PROMPT
    
    async def make_decision(self, game_state_view: Dict[str, Any]) -> List[AgentAction]:
        """Make administrative decisions based on game state."""
        game_phase = game_state_view.get("phase", "setup")
        
        if game_phase == "balancing":
            return await self._review_faction_balance(game_state_view)
        elif game_phase == "playing":
            return await self._monitor_gameplay(game_state_view)
        else:
            return []
    
    async def _review_faction_balance(self, game_state_view: Dict[str, Any]) -> List[AgentAction]:
        """Review faction designs for balance."""
        actions = []
        factions = game_state_view.get("factions", {})
        
        # Analyze overall balance
        balance_analysis = await self._analyze_faction_balance(factions)
        if balance_analysis:
            actions.append(balance_analysis)
        
        # Review individual factions
        for agent_id, faction_data in factions.items():
            if agent_id not in self.faction_reviews:
                review_action = await self._review_single_faction(agent_id, faction_data)
                if review_action:
                    actions.append(review_action)
        
        # Suggest adjustments if needed
        if any(action.action_type == "analyze_balance" for action in actions):
            adjustment_action = await self._suggest_balance_adjustments(factions)
            if adjustment_action:
                actions.append(adjustment_action)
        
        return actions
    
    async def _analyze_faction_balance(self, factions: Dict[str, Any]) -> Optional[AgentAction]:
        """Analyze overall faction balance."""
        if len(factions) < 2:
            return None
        
        # Prepare faction analysis data
        faction_summary = {}
        for agent_id, faction in factions.items():
            units = faction.get("custom_unit_designs", {})
            faction_summary[agent_id] = {
                "faction_name": faction.get("name", "Unknown"),
                "unit_count": len(units),
                "unit_designs": units,
                "theme": faction.get("theme", {})
            }
        
        prompt = f"""
Analyze the balance between all factions that have been created.

Factions to analyze:
{json.dumps(faction_summary, indent=2)}

Evaluate:
1. Unit design balance (stats, costs, abilities)
2. Faction theme coherence
3. Overall power levels
4. Potential exploits or overpowered combinations
5. Faction uniqueness and interesting differences

Identify any significant balance issues and their severity.
Use the analyze_balance function.
"""
        
        functions = [func for func in get_admin_functions() if func["name"] == "analyze_balance"]
        response = await self.llm_interface.make_function_call(
            system_prompt=self.get_system_prompt(),
            user_message=prompt,
            available_functions=functions
        )
        
        if response.success and response.function_calls:
            func_call = response.function_calls[0]
            return AgentAction(
                action_type="analyze_balance",
                parameters=func_call["arguments"],
                reasoning="Overall faction balance analysis",
                agent_id=self.agent_id,
                timestamp=time.time()
            )
        
        return None
    
    async def _review_single_faction(self, agent_id: str, faction_data: Dict[str, Any]) -> Optional[AgentAction]:
        """Review a single faction for approval."""
        faction_name = faction_data.get("name", "Unknown")
        
        prompt = f"""
Review this faction design for approval:

Faction: {faction_name} (Agent: {agent_id})
{json.dumps(faction_data, indent=2)}

Evaluate:
1. Unit designs are balanced and fair
2. Theme is coherent and interesting
3. No obviously overpowered abilities or stats
4. Resource costs are reasonable
5. Faction adds unique gameplay value

Decide whether to approve this faction or request changes.
Use the approve_faction function.
"""
        
        functions = [func for func in get_admin_functions() if func["name"] == "approve_faction"]
        response = await self.llm_interface.make_function_call(
            system_prompt=self.get_system_prompt(),
            user_message=prompt,
            available_functions=functions
        )
        
        if response.success and response.function_calls:
            func_call = response.function_calls[0]
            
            # Store review result
            self.faction_reviews[agent_id] = {
                "approved": func_call["arguments"].get("approved", False),
                "feedback": func_call["arguments"].get("feedback", ""),
                "timestamp": time.time()
            }
            
            return AgentAction(
                action_type="approve_faction",
                parameters=func_call["arguments"],
                reasoning=f"Faction review for {faction_name}",
                agent_id=self.agent_id,
                timestamp=time.time()
            )
        
        return None
    
    async def _suggest_balance_adjustments(self, factions: Dict[str, Any]) -> Optional[AgentAction]:
        """Suggest balance adjustments if needed."""
        # Only suggest if we found issues
        if not any(issue.get("severity") in ["major", "critical"] for issue in self.balance_issues):
            return None
        
        prompt = f"""
Based on the balance analysis, suggest specific game parameter adjustments to improve balance.

Current balance issues identified:
{json.dumps(self.balance_issues, indent=2)}

Faction data:
{json.dumps({aid: f.get("name", "Unknown") for aid, f in factions.items()}, indent=2)}

Suggest adjustments to:
- Unit cost multipliers
- Building cost multipliers  
- Resource generation rates
- Combat damage multipliers

Focus on subtle adjustments that maintain game fun while addressing major imbalances.
Use the suggest_adjustments function.
"""
        
        functions = [func for func in get_admin_functions() if func["name"] == "suggest_adjustments"]
        response = await self.llm_interface.make_function_call(
            system_prompt=self.get_system_prompt(),
            user_message=prompt,
            available_functions=functions
        )
        
        if response.success and response.function_calls:
            func_call = response.function_calls[0]
            
            # Store intervention
            self.interventions.append({
                "type": "balance_adjustment",
                "adjustments": func_call["arguments"].get("adjustments", {}),
                "reasoning": func_call["arguments"].get("reasoning", ""),
                "timestamp": time.time()
            })
            
            return AgentAction(
                action_type="suggest_adjustments",
                parameters=func_call["arguments"],
                reasoning="Balance adjustment recommendation",
                agent_id=self.agent_id,
                timestamp=time.time()
            )
        
        return None
    
    async def _monitor_gameplay(self, game_state_view: Dict[str, Any]) -> List[AgentAction]:
        """Monitor ongoing gameplay for issues."""
        actions = []
        
        # Check for potential issues every few turns
        turn_number = game_state_view.get("turn_number", 0)
        if turn_number % 10 == 0:  # Check every 10 turns
            monitoring_action = await self._check_game_health(game_state_view)
            if monitoring_action:
                actions.append(monitoring_action)
        
        # Generate narrative commentary occasionally
        if turn_number % 5 == 0 and len(self.game_narrative) < 50:  # Limit narrative length
            narrative_action = await self._generate_narrative(game_state_view)
            if narrative_action:
                actions.append(narrative_action)
        
        return actions
    
    async def _check_game_health(self, game_state_view: Dict[str, Any]) -> Optional[AgentAction]:
        """Check for game health issues during play."""
        factions = game_state_view.get("factions", {})
        turn_number = game_state_view.get("turn_number", 0)
        
        # Analyze current game state
        game_analysis = {
            "turn": turn_number,
            "active_factions": len(factions),
            "faction_strengths": {},
            "resource_levels": {},
            "unit_counts": {}
        }
        
        for agent_id, faction in factions.items():
            units = faction.get("units", [])
            resources = faction.get("resources", {})
            
            game_analysis["faction_strengths"][agent_id] = len(units)
            game_analysis["resource_levels"][agent_id] = sum(resources.values())
            game_analysis["unit_counts"][agent_id] = len(units)
        
        # Check for concerning patterns
        unit_counts = list(game_analysis["unit_counts"].values())
        if unit_counts and max(unit_counts) > min(unit_counts) * 3:
            # Major military imbalance detected
            prompt = f"""
Game health check - Turn {turn_number}

Detected potential issue: Military imbalance
{json.dumps(game_analysis, indent=2)}

Analyze if this represents a serious balance problem requiring intervention.
Consider:
1. Is this a natural result of good strategy or game imbalance?
2. Are losing players still able to make meaningful decisions?
3. Is the game still fun and competitive?

Use analyze_balance function if intervention might be needed.
"""
            
            functions = [func for func in get_admin_functions() if func["name"] == "analyze_balance"]
            response = await self.llm_interface.make_function_call(
                system_prompt=self.get_system_prompt(),
                user_message=prompt,
                available_functions=functions
            )
            
            if response.success and response.function_calls:
                func_call = response.function_calls[0]
                return AgentAction(
                    action_type="analyze_balance",
                    parameters=func_call["arguments"],
                    reasoning="Game health monitoring",
                    agent_id=self.agent_id,
                    timestamp=time.time()
                )
        
        return None
    
    async def _generate_narrative(self, game_state_view: Dict[str, Any]) -> Optional[AgentAction]:
        """Generate narrative commentary about the game."""
        factions = game_state_view.get("factions", {})
        turn_number = game_state_view.get("turn_number", 0)
        
        # Simple narrative generation (could be much more sophisticated)
        prompt = f"""
Generate engaging narrative commentary about the current state of the game.

Turn {turn_number}
{json.dumps({aid: {"name": f.get("name", "Unknown"), 
                   "units": len(f.get("units", [])), 
                   "buildings": len(f.get("buildings", []))}
             for aid, f in factions.items()}, indent=2)}

Create a short, engaging description of the current situation that players will enjoy reading.
Focus on:
- Major developments this turn
- Rising tensions or alliances
- Strategic positions
- Dramatic moments

Keep it entertaining and immersive. Write 2-3 sentences maximum.
"""
        
        # Use simple message sending for narrative
        functions = [func for func in get_admin_functions() if "send" in func.get("name", "").lower()]
        if not functions:
            # Fallback: create narrative as info query
            narrative_text = f"Turn {turn_number}: The great powers continue their struggle for dominance..."
            self.game_narrative.append(narrative_text)
        
        return None
    
    def get_balance_summary(self) -> Dict[str, Any]:
        """Get summary of balance decisions made."""
        return {
            "balance_issues": self.balance_issues,
            "interventions": self.interventions,
            "faction_reviews": self.faction_reviews,
            "total_reviews": len(self.faction_reviews),
            "approved_factions": len([r for r in self.faction_reviews.values() if r.get("approved", False)]),
            "rejected_factions": len([r for r in self.faction_reviews.values() if not r.get("approved", False)])
        }
    
    def record_balance_issue(self, issue: Dict[str, Any]) -> None:
        """Record a balance issue for tracking."""
        issue["timestamp"] = time.time()
        self.balance_issues.append(issue)
        
        # Limit stored issues
        if len(self.balance_issues) > 20:
            self.balance_issues = self.balance_issues[-20:]