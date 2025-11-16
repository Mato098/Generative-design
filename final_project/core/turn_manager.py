"""Turn management system for coordinating agent actions."""
import asyncio
import time
import logging
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass
from enum import Enum

from agents.base_agent import BaseAgent, AgentAction
from core.game_state import GameState, GamePhase

class TurnResult(Enum):
    """Result of processing a turn."""
    SUCCESS = "success"
    TIMEOUT = "timeout"
    ERROR = "error"
    GAME_ENDED = "game_ended"

@dataclass
class TurnProcessingResult:
    """Result of processing an agent's turn."""
    agent_id: str
    actions: List[AgentAction]
    execution_results: List[Dict[str, Any]]
    turn_result: TurnResult
    processing_time: float
    error_message: Optional[str] = None

class TurnManager:
    """Manages turn-based gameplay and agent coordination."""
    
    def __init__(self, timeout_seconds: int = 30):
        """Initialize turn manager."""
        self.timeout_seconds = timeout_seconds
        self.logger = logging.getLogger("TurnManager")
        
        # Turn processing state
        self.current_turn_start: Optional[float] = None
        self.turn_history: List[TurnProcessingResult] = []
        
        # Action processors - functions that handle specific action types
        self.action_processors: Dict[str, Callable] = {}
        
        # Performance tracking
        self.total_turns_processed = 0
        self.total_processing_time = 0.0
        self.timeout_count = 0
        self.error_count = 0
    
    def register_action_processor(self, action_type: str, processor: Callable) -> None:
        """Register a function to process specific action types."""
        self.action_processors[action_type] = processor
        self.logger.info(f"Registered processor for action type: {action_type}")
    
    async def process_agent_turn(
        self, 
        agent: BaseAgent, 
        game_state: GameState,
        max_actions: int = 5
    ) -> TurnProcessingResult:
        """Process a single agent's turn."""
        start_time = time.time()
        self.current_turn_start = start_time
        
        self.logger.info(f"Processing turn for agent {agent.agent_id}")
        
        try:
            # Get agent's view of game state
            agent_view = game_state.get_agent_view(agent.agent_id)
            
            # Get agent's decisions with timeout
            actions = await asyncio.wait_for(
                agent.process_turn(agent_view),
                timeout=self.timeout_seconds
            )
            
            # Limit number of actions per turn
            if len(actions) > max_actions:
                self.logger.warning(
                    f"Agent {agent.agent_id} attempted {len(actions)} actions, "
                    f"limiting to {max_actions}"
                )
                actions = actions[:max_actions]
            
            # Execute actions sequentially
            execution_results = []
            for action in actions:
                result = await self._execute_action(action, game_state)
                execution_results.append(result)
                
                # Record result with agent
                agent.record_action_result(action, result["success"], result)
                
                # Stop processing if critical error
                if result.get("critical_error", False):
                    break
            
            processing_time = time.time() - start_time
            self.total_processing_time += processing_time
            
            result = TurnProcessingResult(
                agent_id=agent.agent_id,
                actions=actions,
                execution_results=execution_results,
                turn_result=TurnResult.SUCCESS,
                processing_time=processing_time
            )
            
            self.logger.info(
                f"Completed turn for {agent.agent_id}: "
                f"{len(actions)} actions in {processing_time:.2f}s"
            )
            
            return result
            
        except asyncio.TimeoutError:
            self.timeout_count += 1
            processing_time = time.time() - start_time
            
            self.logger.warning(f"Turn timeout for agent {agent.agent_id}")
            
            return TurnProcessingResult(
                agent_id=agent.agent_id,
                actions=[],
                execution_results=[],
                turn_result=TurnResult.TIMEOUT,
                processing_time=processing_time,
                error_message="Agent decision timeout"
            )
            
        except Exception as e:
            self.error_count += 1
            processing_time = time.time() - start_time
            
            self.logger.error(f"Error processing turn for {agent.agent_id}: {str(e)}")
            
            return TurnProcessingResult(
                agent_id=agent.agent_id,
                actions=[],
                execution_results=[],
                turn_result=TurnResult.ERROR,
                processing_time=processing_time,
                error_message=str(e)
            )
        finally:
            self.current_turn_start = None
            self.total_turns_processed += 1
    
    async def _execute_action(self, action: AgentAction, game_state: GameState) -> Dict[str, Any]:
        """Execute a single action and return the result."""
        self.logger.debug(f"Executing action: {action.action_type} by {action.agent_id}")
        
        # Check if we have a processor for this action type
        if action.action_type in self.action_processors:
            try:
                processor = self.action_processors[action.action_type]
                result = await processor(action, game_state)
                
                # Ensure result has required fields
                if not isinstance(result, dict):
                    result = {"success": False, "error": "Invalid processor result"}
                
                if "success" not in result:
                    result["success"] = False
                
                return result
                
            except Exception as e:
                self.logger.error(f"Error in action processor: {str(e)}")
                return {
                    "success": False,
                    "error": f"Processor error: {str(e)}",
                    "action_type": action.action_type
                }
        else:
            # No processor registered for this action type
            self.logger.warning(f"No processor for action type: {action.action_type}")
            return {
                "success": False,
                "error": f"Unknown action type: {action.action_type}",
                "action_type": action.action_type
            }
    
    async def process_full_round(
        self, 
        agents: List[BaseAgent], 
        game_state: GameState
    ) -> List[TurnProcessingResult]:
        """Process a full round where each agent takes a turn."""
        self.logger.info(f"Processing full round - Turn {game_state.turn_number}")
        
        round_results = []
        
        # Process each agent's turn in order
        for i, agent in enumerate(agents):
            if not agent.is_active:
                self.logger.info(f"Skipping inactive agent {agent.agent_id}")
                continue
            
            # Update current player in game state
            game_state.current_player_index = i
            
            # Process the agent's turn
            result = await self.process_agent_turn(agent, game_state)
            round_results.append(result)
            
            # Check if game ended
            if game_state.phase == GamePhase.ENDED:
                self.logger.info("Game ended during round processing")
                break
            
            # Advance turn in game state after each player
            if i < len(agents) - 1:  # Not the last player
                game_state.advance_turn()
        
        # If we completed the full round, advance to next turn number
        if game_state.phase != GamePhase.ENDED and game_state.current_player_index == len(agents) - 1:
            game_state.advance_turn()
        
        self.logger.info(f"Completed round {game_state.turn_number - 1}")
        return round_results
    
    def add_turn_to_history(self, result: TurnProcessingResult) -> None:
        """Add turn result to history."""
        self.turn_history.append(result)
        
        # Limit history size
        if len(self.turn_history) > 100:
            self.turn_history = self.turn_history[-100:]
    
    def get_turn_statistics(self) -> Dict[str, Any]:
        """Get turn processing statistics."""
        if self.total_turns_processed == 0:
            return {"no_data": True}
        
        avg_processing_time = self.total_processing_time / self.total_turns_processed
        timeout_rate = (self.timeout_count / self.total_turns_processed) * 100
        error_rate = (self.error_count / self.total_turns_processed) * 100
        
        return {
            "total_turns_processed": self.total_turns_processed,
            "total_processing_time": self.total_processing_time,
            "average_processing_time": avg_processing_time,
            "timeout_count": self.timeout_count,
            "timeout_rate": timeout_rate,
            "error_count": self.error_count,
            "error_rate": error_rate,
            "recent_turns": len(self.turn_history)
        }
    
    def get_agent_performance(self, agent_id: str) -> Dict[str, Any]:
        """Get performance statistics for a specific agent."""
        agent_turns = [t for t in self.turn_history if t.agent_id == agent_id]
        
        if not agent_turns:
            return {"agent_id": agent_id, "no_data": True}
        
        total_actions = sum(len(t.actions) for t in agent_turns)
        successful_turns = sum(1 for t in agent_turns if t.turn_result == TurnResult.SUCCESS)
        avg_processing_time = sum(t.processing_time for t in agent_turns) / len(agent_turns)
        
        return {
            "agent_id": agent_id,
            "turns_processed": len(agent_turns),
            "successful_turns": successful_turns,
            "success_rate": (successful_turns / len(agent_turns)) * 100,
            "total_actions": total_actions,
            "average_actions_per_turn": total_actions / len(agent_turns) if agent_turns else 0,
            "average_processing_time": avg_processing_time,
            "timeouts": sum(1 for t in agent_turns if t.turn_result == TurnResult.TIMEOUT),
            "errors": sum(1 for t in agent_turns if t.turn_result == TurnResult.ERROR)
        }
    
    def reset_statistics(self) -> None:
        """Reset all statistics and history."""
        self.turn_history.clear()
        self.total_turns_processed = 0
        self.total_processing_time = 0.0
        self.timeout_count = 0
        self.error_count = 0
        self.logger.info("Turn manager statistics reset")