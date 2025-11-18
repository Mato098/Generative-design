#!/usr/bin/env python3
"""
Multi-Agent LLM Strategy Game
============================

A 4-player strategy game where LLM agents create custom factions, design units,
and compete in turn-based combat with human observer interaction.

Features:
- Custom faction and unit design with LLM creativity  
- Sprite generation for visual units
- Admin agent for game balance
- Modular visualization (console, future p5.js)
- Comprehensive test coverage

Usage:
    python main.py              # Start full game
    python main.py --demo        # Run demonstration
    python main.py --test        # Run test suite
"""

import asyncio
import argparse
import logging
from typing import Dict, List, Optional
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.game_config import GameConfig, FACTION_CACHE_ENABLED, FACTION_CACHE_MODE, SPRITE_CACHE_ENABLED, SPRITE_CACHE_MODE
from config.llm_config import DEFAULT_PERSONALITIES
from config.visualization_config import VisualizationConfig

from core.game_engine import GameEngine
from core.game_state import GameState
from core.turn_manager import TurnManager

from agents.player_agent import PlayerAgent
from agents.admin_agent import AdminAgent

from visualization.interface import GameVisualization, RenderContext
from visualization.console_renderer import create_console_renderer

from sprites.generator import SpriteGenerator
from sprites.cache import get_sprite_cache

from utils.logging_config import setup_logging

class GameLauncher:
    """Main game launcher and coordinator."""
    
    def __init__(self, args):
        """Initialize game launcher."""
        self.args = args
        self.game_config = GameConfig()
        self.viz_config = VisualizationConfig()
        
        # Initialize logging
        setup_logging(
            level=logging.DEBUG if args.verbose else logging.INFO,
            log_file="game.log" if args.log_file else None
        )
        self.logger = logging.getLogger("GameLauncher")
        
        # Core game components
        self.game_state: Optional[GameState] = None
        self.game_engine: Optional[GameEngine] = None
        self.visualization: Optional[GameVisualization] = None
        
        # Agents
        self.player_agents: List[PlayerAgent] = []
        self.admin_agent: Optional[AdminAgent] = None
        
        # Game statistics
        self.game_stats = {
            "start_time": None,
            "total_turns": 0,
            "total_actions": 0,
            "sprites_generated": 0
        }
    
    async def run_game(self):
        """Run the complete game."""
        try:
            self.logger.info("🎮 Starting Multi-Agent LLM Strategy Game")
            
            # Setup game
            await self.setup_game()
            
            # Setup phase
            self.logger.info("⚙️  Starting setup phase...")
            await self.run_setup_phase()
            
            # Balance phase
            self.logger.info("⚖️  Starting balance phase...")
            await self.run_balance_phase()
            
            # Main game loop
            self.logger.info("🚀 Starting main game...")
            await self.run_main_game()
            
            # Game end
            self.logger.info("🏁 Game completed!")
            await self.show_final_results()
            
        except KeyboardInterrupt:
            self.logger.info("Game interrupted by user")
        except Exception as e:
            self.logger.error(f"Game error: {e}", exc_info=True)
    
    async def setup_game(self):
        """Initialize all game components."""
        self.logger.info("Setting up game components...")
        
        # Initialize game state
        self.game_state = GameState(
            map_width=self.game_config.map_width,
            map_height=self.game_config.map_height,
            max_players=self.game_config.max_players
        )
        
        # Initialize visualization
        renderer = create_console_renderer(
            width=self.viz_config.console_width,
            height=self.viz_config.console_height,
            map_size=self.game_config.map_width
        )
        self.visualization = GameVisualization(renderer)
        
        # Create player agents
        for i, personality in enumerate(DEFAULT_PERSONALITIES):
            agent = PlayerAgent(
                agent_id=f"player_{i+1}",
                personality_index=i,
                use_faction_cache=FACTION_CACHE_ENABLED,
                faction_cache_mode=FACTION_CACHE_MODE
            )
            self.player_agents.append(agent)
            self.logger.info(f"Created {personality.name} ({personality.strategic_style})")
        
        # Create admin agent
        self.admin_agent = AdminAgent()
        
        # Initialize turn manager
        turn_manager = TurnManager(
            timeout_seconds=self.game_config.turn_timeout_seconds
        )
        
        # Initialize game engine  
        self.game_engine = GameEngine(
            game_id=self.game_state.game_id,
            map_size=(self.game_config.map_width, self.game_config.map_height)
        )
        
        # Set up the game engine with our components
        self.game_engine.game_state = self.game_state
        self.game_engine.turn_manager = turn_manager
        self.game_engine.admin_agent = self.admin_agent
        self.game_engine.player_agents = self.player_agents
        
        self.logger.info("✅ Game setup complete")
    
    async def run_setup_phase(self):
        """Run faction creation and unit design phase."""
        self.logger.info("Players creating factions...")
        
        # Each player creates their faction
        for i, agent in enumerate(self.player_agents):
            self.logger.info(f"🏛️  {agent.name} creating faction...")
            
            faction_result = await agent.create_faction()
            if faction_result and faction_result.get("success"):
                await self.game_engine.process_faction_creation(agent.agent_id, faction_result.get("actions", []))
                
                # Generate sprites for custom units
                sprite_generator = SpriteGenerator(
                    f"sprite_gen_{agent.agent_id}",
                    use_cache=SPRITE_CACHE_ENABLED,
                    cache_mode=SPRITE_CACHE_MODE,
                    save_to_cache=True
                )
                if faction_result.get("actions"):
                    # Get faction data from game state
                    faction = self.game_state.factions.get(agent.agent_id)
                    from dataclasses import asdict
                    faction_data = {
                        "name": faction.name if faction else f"{agent.name} Faction",
                        "theme": asdict(faction.theme) if faction and faction.theme else {},
                        "custom_unit_designs": faction_result.get("actions", [])
                    }
                    sprites = await sprite_generator.generate_faction_sprites(faction_data)
                    
                    # Cache generated sprites
                    sprite_cache = get_sprite_cache()
                    for unit_name, sprite in sprites.items():
                        sprite_id = sprite_cache.store_sprite(sprite)
                        self.logger.info(f"Generated sprite for {unit_name}: {sprite_id}")
                        self.game_stats["sprites_generated"] += 1
            else:
                self.logger.warning(f"Failed to create faction for {agent.name}")
        
        self.logger.info("✅ Setup phase complete")
        self.logger.info(f"📊 Created {len(self.game_state.factions)} factions total")
        for agent_id, faction in self.game_state.factions.items():
            self.logger.info(f"  - {faction.name}: {len(faction.units)} units, {len(faction.buildings)} buildings")
    
    async def run_balance_phase(self):
        """Run admin balance review phase."""
        self.logger.info("Admin reviewing game balance...")
        
        # Get all faction data
        factions_objects = self.game_state.get_all_factions()
        # Convert Faction objects to dictionaries for admin agent
        factions = {agent_id: faction.to_dict() for agent_id, faction in factions_objects.items()}
        
        if len(factions) > 1:
            self.logger.info("🔍 Starting balance analysis...")
            # Admin analyzes balance
            balance_result = await self.admin_agent.analyze_game_balance(factions)
            self.logger.info(f"📊 Balance score: {balance_result.get('balance_score', 'unknown')}")
            
            if balance_result and balance_result.get("balance_score", 1.0) < 0.7:
                issues = balance_result.get("issues", [])
                
                self.logger.info(f"⚠️  Balance analysis: {len(issues)} issues detected")
                self.logger.info(f"Issues: {issues}")
                
                if len(issues) > 0:
                    self.logger.info("🔧 Requesting balance adjustments...")
                    # Admin suggests adjustments
                    adjustment_result = await self.admin_agent.suggest_balance_adjustments(factions)
                    if adjustment_result and adjustment_result.get("adjustments"):
                        await self.game_engine.apply_balance_adjustments(
                            adjustment_result["adjustments"], factions_objects
                        )
                        self.logger.info("⚖️  Balance adjustments applied")
            else:
                self.logger.info("✅ Game balance is acceptable")
        
        self.logger.info("✅ Balance phase complete")
    
    async def run_main_game(self):
        """Run the main turn-based game loop."""
        self.logger.info("🎮 Starting main game...")
        
        # Set game phase to playing
        from core.game_state import GamePhase
        self.game_state.phase = GamePhase.PLAYING
        self.logger.info("📊 Game phase set to PLAYING")
        
        max_turns = self.game_config.max_turns_per_game
        self.logger.info(f"📅 Game will run for maximum {max_turns} turns")
        
        for turn in range(max_turns):
            self.game_stats["total_turns"] = turn + 1
            
            self.logger.info(f"🎲 Starting turn {turn + 1} of {max_turns}")
            
            # Skip visualization during full game to avoid console conflicts
            # if self.visualization:
            #     self.visualization.render_game_state(self.game_state)
            
            # Process turn for each player
            for agent in self.player_agents:
                if not self.game_state.is_faction_alive(agent.agent_id):
                    continue
                
                self.logger.info(f"▶️  {agent.name}'s turn")
                
                # Agent takes turn
                actions = await agent.take_turn(self.game_state)
                
                if actions:
                    # Process actions through game engine
                    for action in actions:
                        result = await self.game_engine.process_player_action(agent.agent_id, action)
                        if result:
                            self.game_stats["total_actions"] += 1
                
                # Check for victory conditions
                if self.game_state.check_victory_conditions():
                    winner = self.game_state.get_winner()
                    if winner:
                        self.logger.info(f"🏆 {winner} wins!")
                        return
            
            # Turn summary
            alive_factions = len([f for f in self.game_state.factions.values() if self.game_state.is_faction_alive(f.owner_id)])
            self.logger.info(f"📊 Turn {turn + 1} complete. Factions remaining: {alive_factions}")
            
            # Admin commentary/interference (every 10 turns to reduce noise)
            if turn % 10 == 0 and self.admin_agent:
                commentary = await self.admin_agent.provide_turn_commentary(self.game_state, turn)
                if commentary:
                    self.logger.info(f"🎤 Admin: {commentary}")
            
            # Brief pause between turns
            await asyncio.sleep(0.5)
        
        # Game ended due to turn limit
        self.logger.info("Game ended - turn limit reached")
    
    async def show_final_results(self):
        """Display final game results and statistics."""
        print("\n" + "="*60)
        print("🏁 GAME RESULTS")
        print("="*60)
        
        # Final scores
        factions = self.game_state.get_all_factions()
        scores = []
        
        for agent_id, faction in factions.items():
            score = (
                len(faction.units) * 10 +
                len(faction.buildings) * 25 +
                faction.resources.get("gold", 0)
            )
            scores.append((faction.name, score, faction.faction_id))
        
        scores.sort(key=lambda x: x[1], reverse=True)
        
        print("\nFinal Rankings:")
        for i, (name, score, faction_id) in enumerate(scores, 1):
            print(f"{i}. {name}: {score} points")
        
        # Game statistics
        print(f"\nGame Statistics:")
        print(f"Total turns: {self.game_stats['total_turns']}")
        print(f"Total actions: {self.game_stats['total_actions']}")
        print(f"Sprites generated: {self.game_stats['sprites_generated']}")
        
        # Sprite cache statistics
        sprite_cache = get_sprite_cache()
        cache_stats = sprite_cache.get_cache_statistics()
        print(f"Cached sprites: {cache_stats['total_sprites']}")
        
        print("\n" + "="*60)
    
    async def run_demo(self):
        """Run a quick demonstration of the game systems."""
        self.logger.info("🎭 Running game demonstration...")
        
        print("\n" + "="*50)
        print("🎮 MULTI-AGENT LLM STRATEGY GAME DEMO")
        print("="*50)
        
        # Setup minimal game
        await self.setup_game()
        
        # Demo faction creation
        print("\n1. FACTION CREATION DEMO")
        print("-"*30)
        
        agent = self.player_agents[0]
        print(f"Agent: {agent.name} ({agent.strategic_style})")
        
        # Create faction (simulated)
        demo_faction = {
            "faction_name": "Iron Legion",
            "theme_description": "Industrial steampunk empire with mechanical units",
            "color_scheme": ["#8B4513", "#C0C0C0", "#FFD700"],
            "architectural_style": "industrial"
        }
        
        print(f"Created faction: {demo_faction['faction_name']}")
        print(f"Theme: {demo_faction['theme_description']}")
        
        # Demo sprite generation
        print("\n2. SPRITE GENERATION DEMO")
        print("-"*30)
        
        sprite_generator = SpriteGenerator(
            "demo_generator",
            use_cache=SPRITE_CACHE_ENABLED,
            cache_mode=SPRITE_CACHE_MODE,
            save_to_cache=True
        )
        
        # Generate a simple sprite (mock)
        print("Generating unit sprite...")
        demo_sprite = await sprite_generator.generate_unit_sprite(
            "Mechanical Warrior",
            "A steampunk warrior with gear armor and steam-powered weapons",
            "industrial",
            "infantry"
        )
        
        if demo_sprite:
            print(f"✅ Generated sprite: {demo_sprite.name}")
            print("Pixel preview:")
            for row in demo_sprite.pixel_data[:8]:  # Show first 8 rows
                print("".join(row[:16]))  # Show first 16 chars
        else:
            print("❌ Sprite generation failed (no API key)")
        
        # Demo game state
        print("\n3. GAME STATE DEMO")
        print("-"*30)
        
        print(f"Map size: {self.game_state.map_width}x{self.game_state.map_height}")
        print(f"Players: {len(self.player_agents)}")
        print(f"Max turns: {self.game_config.max_turns_per_game}")
        
        # Demo visualization
        print("\n4. VISUALIZATION DEMO")
        print("-"*30)
        
        if self.visualization:
            print("Console renderer initialized")
            print(f"Viewport: {self.visualization.renderer.context.viewport_width}x{self.visualization.renderer.context.viewport_height}")
            
            # Render empty map
            self.visualization.render_game_state(self.game_state)
            print("✅ Rendered game state")
        
        print("\n5. SYSTEM INTEGRATION")
        print("-"*30)
        
        # Show component integration
        print("✅ Game Engine: Ready")
        print("✅ Turn Manager: Ready") 
        print("✅ LLM Agents: Ready")
        print("✅ Sprite System: Ready")
        print("✅ Visualization: Ready")
        print("✅ Admin Agent: Ready")
        
        print("\n🎉 Demo complete! All systems operational.")
        print("\nTo play a full game, run: python main.py")
        
    def run_tests(self):
        """Run the test suite."""
        print("🧪 Running test suite...")
        
        try:
            import subprocess
            result = subprocess.run([
                sys.executable, 
                os.path.join(os.path.dirname(__file__), "tests", "run_tests.py")
            ], capture_output=True, text=True)
            
            print(result.stdout)
            if result.stderr:
                print("Errors:", result.stderr)
            
            return result.returncode == 0
            
        except Exception as e:
            print(f"Failed to run tests: {e}")
            return False

def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Multi-Agent LLM Strategy Game")
    
    parser.add_argument("--demo", action="store_true", 
                       help="Run demonstration instead of full game")
    parser.add_argument("--test", action="store_true",
                       help="Run test suite")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Enable verbose logging")
    parser.add_argument("--log-file", action="store_true",
                       help="Log to file")
    parser.add_argument("--no-visual", action="store_true",
                       help="Run without visualization")
    
    args = parser.parse_args()
    
    if args.test:
        launcher = GameLauncher(args)
        success = launcher.run_tests()
        sys.exit(0 if success else 1)
    
    launcher = GameLauncher(args)
    
    if args.demo:
        asyncio.run(launcher.run_demo())
    else:
        asyncio.run(launcher.run_game())

if __name__ == "__main__":
    main()
