"""Base agent interface and common functionality."""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import logging
import time

from .llm_interface import LLMInterface, LLMResponse

@dataclass
class AgentAction:
    """Represents an action taken by an agent."""
    action_type: str
    parameters: Dict[str, Any]
    reasoning: str
    agent_id: str
    timestamp: float
    success: Optional[bool] = None
    result: Optional[Dict[str, Any]] = None

class BaseAgent(ABC):
    """Abstract base class for all game agents."""
    
    def __init__(self, agent_id: str, name: str):
        """Initialize agent with ID and name."""
        self.agent_id = agent_id
        self.name = name
        self.llm_interface = LLMInterface(agent_id)
        self.action_history: List[AgentAction] = []
        self.last_game_state: Optional[Dict[str, Any]] = None
        self.is_active = True
        
        # Performance tracking
        self.total_thinking_time = 0.0
        self.total_actions = 0
        self.successful_actions = 0
        self.failed_actions = 0
        
        self.logger = logging.getLogger(f"Agent.{agent_id}")
        self.logger.info(f"Initialized agent {name} ({agent_id})")
    
    @abstractmethod
    async def make_decision(self, game_state_view: Dict[str, Any]) -> List[AgentAction]:
        """Make decisions based on current game state."""
        pass
    
    @abstractmethod
    def get_system_prompt(self) -> str:
        """Get the system prompt for this agent type."""
        pass
    
    async def process_turn(self, game_state_view: Dict[str, Any]) -> List[AgentAction]:
        """Process a turn and return actions."""
        if not self.is_active:
            return []
        
        start_time = time.time()
        
        try:
            # Store current game state
            self.last_game_state = game_state_view
            
            # Make decision
            actions = await self.make_decision(game_state_view)
            
            # Track performance
            thinking_time = time.time() - start_time
            self.total_thinking_time += thinking_time
            self.total_actions += len(actions)
            
            # Log actions
            for action in actions:
                self.action_history.append(action)
                self.logger.info(f"Action: {action.action_type} - {action.reasoning}")
            
            return actions
            
        except Exception as e:
            self.logger.error(f"Error processing turn: {str(e)}")
            return []
    
    def record_action_result(self, action: AgentAction, success: bool, result: Dict[str, Any]) -> None:
        """Record the result of an action."""
        action.success = success
        action.result = result
        
        # Increment total actions counter
        self.total_actions += 1
        
        if success:
            self.successful_actions += 1
        else:
            self.failed_actions += 1
            self.logger.warning(f"Action failed: {action.action_type} - {result.get('error', 'Unknown error')}")
    
    def get_performance_stats(self) -> Dict[str, Any]:
        """Get performance statistics for this agent."""
        success_rate = (self.successful_actions / max(1, self.total_actions)) * 100
        avg_thinking_time = self.total_thinking_time / max(1, len(self.action_history))
        
        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "total_actions": self.total_actions,
            "successful_actions": self.successful_actions,
            "failed_actions": self.failed_actions,
            "success_rate": success_rate,
            "total_thinking_time": self.total_thinking_time,
            "average_thinking_time": avg_thinking_time,
            "token_usage": self.llm_interface.get_token_usage_summary(),
            "is_active": self.is_active
        }
    
    def deactivate(self, reason: str) -> None:
        """Deactivate agent (e.g., when eliminated)."""
        self.is_active = False
        self.logger.info(f"Agent deactivated: {reason}")
    
    def get_recent_actions(self, count: int = 5) -> List[AgentAction]:
        """Get recent actions taken by this agent."""
        return self.action_history[-count:] if self.action_history else []
    
    def clear_history(self) -> None:
        """Clear action history (for new games)."""
        self.action_history.clear()
        self.llm_interface.clear_conversation()
        self.total_thinking_time = 0.0
        self.total_actions = 0
        self.successful_actions = 0
        self.failed_actions = 0

class AgentPersonalityMixin:
    """Mixin for agent personality traits."""
    
    def __init__(self, personality_config: Dict[str, Any]):
        """Initialize personality traits."""
        self.strategic_style = personality_config.get("strategic_style", "balanced")
        self.risk_tolerance = personality_config.get("risk_tolerance", 0.5)
        self.communication_style = personality_config.get("communication_style", "neutral")
        self.preferred_unit_types = personality_config.get("preferred_unit_types", [])
        self.personality_description = personality_config.get("description", "")
    
    def get_personality_context(self) -> str:
        """Get personality context for LLM prompts."""
        return f"""
Your personality traits:
- Strategic style: {self.strategic_style}
- Risk tolerance: {self.risk_tolerance} (0.0 = very cautious, 1.0 = very aggressive)
- Communication style: {self.communication_style}
- Preferred units: {', '.join(self.preferred_unit_types)}
- Character: {self.personality_description}

Play according to these traits while being strategic and competitive.
"""

class AgentMemoryMixin:
    """Mixin for agent memory and learning."""
    
    def __init__(self):
        """Initialize memory systems."""
        self.strategic_memory: Dict[str, Any] = {
            "successful_strategies": [],
            "failed_strategies": [],
            "enemy_patterns": {},
            "map_knowledge": {},
            "resource_priorities": {}
        }
        self.short_term_memory: List[Dict[str, Any]] = []
    
    def remember_strategy(self, strategy: str, success: bool, context: Dict[str, Any]) -> None:
        """Remember a strategy and its outcome."""
        memory_entry = {
            "strategy": strategy,
            "context": context,
            "timestamp": time.time()
        }
        
        if success:
            self.strategic_memory["successful_strategies"].append(memory_entry)
        else:
            self.strategic_memory["failed_strategies"].append(memory_entry)
        
        # Limit memory size
        for category in ["successful_strategies", "failed_strategies"]:
            if len(self.strategic_memory[category]) > 20:
                self.strategic_memory[category] = self.strategic_memory[category][-20:]
    
    def remember_short_term(self, event: Dict[str, Any]) -> None:
        """Add event to short-term memory."""
        self.short_term_memory.append({
            **event,
            "timestamp": time.time()
        })
        
        # Keep only recent memories
        if len(self.short_term_memory) > 10:
            self.short_term_memory = self.short_term_memory[-10:]
    
    def get_relevant_memories(self, context: str) -> List[Dict[str, Any]]:
        """Retrieve memories relevant to current context."""
        relevant = []
        
        # Simple keyword matching for now
        context_lower = context.lower()
        
        for strategy in self.strategic_memory["successful_strategies"]:
            if any(keyword in context_lower for keyword in strategy["strategy"].lower().split()):
                relevant.append(strategy)
        
        # Add some failed strategies as negative examples
        for strategy in self.strategic_memory["failed_strategies"][-3:]:
            if any(keyword in context_lower for keyword in strategy["strategy"].lower().split()):
                relevant.append({**strategy, "negative_example": True})
        
        return relevant[-5:]  # Return most recent relevant memories

class AgentCommunicationMixin:
    """Mixin for agent communication and banter."""
    
    def __init__(self, communication_style: str):
        """Initialize communication system."""
        self.communication_style = communication_style
        self.recent_messages: List[Dict[str, Any]] = []
        self.message_targets: Dict[str, List[str]] = {
            "taunts": [],
            "diplomacy": [],
            "information": []
        }
    
    def should_send_message(self, game_context: Dict[str, Any]) -> bool:
        """Determine if agent should send a message this turn."""
        import random
        
        # Base probability based on communication style
        base_prob = {
            "taunting": 0.3,
            "diplomatic": 0.2,
            "analytical": 0.1,
            "casual": 0.25,
            "formal": 0.15
        }.get(self.communication_style, 0.2)
        
        # Increase probability in certain situations
        if game_context.get("combat_occurred", False):
            base_prob += 0.2
        
        if game_context.get("major_achievement", False):
            base_prob += 0.3
        
        if game_context.get("under_attack", False):
            base_prob += 0.25
        
        return random.random() < base_prob
    
    def generate_message_context(self, game_state: Dict[str, Any]) -> str:
        """Generate context for message generation."""
        context_parts = []
        
        # Current game situation
        turn = game_state.get("turn_number", 0)
        my_faction = game_state.get("my_faction", {})
        
        context_parts.append(f"Turn {turn}")
        context_parts.append(f"My faction: {my_faction.get('name', 'Unknown')}")
        
        # Recent events
        recent_actions = self.get_recent_actions(3)
        if recent_actions:
            context_parts.append("Recent actions: " + 
                               ", ".join(a.action_type for a in recent_actions))
        
        return " | ".join(context_parts)