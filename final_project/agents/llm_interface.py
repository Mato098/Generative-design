"""OpenAI LLM interface with function calling support."""
import asyncio
import json
import time
import logging
from typing import Dict, List, Optional, Any, Callable, Tuple
from dataclasses import dataclass

try:
    import openai
except ImportError:
    print("Warning: OpenAI library not installed. Run: pip install openai")
    openai = None

from config.llm_config import (
    OPENAI_API_KEY, GPT_MODEL, MAX_TOKENS, TEMPERATURE, 
    REQUEST_TIMEOUT, TokenUsage, FUNCTION_SCHEMAS, DEBUG_LLM_RESPONSES
)

@dataclass
class LLMResponse:
    """Structured LLM response with function calls."""
    content: str
    function_calls: List[Dict[str, Any]]
    token_usage: TokenUsage
    success: bool = True
    error: Optional[str] = None
    response_time: float = 0.0

class LLMInterface:
    """Interface for OpenAI GPT models with function calling."""
    
    def __init__(self, agent_id: str, model: str = GPT_MODEL):
        """Initialize LLM interface for an agent."""
        self.agent_id = agent_id
        self.model = model
        self.client = None
        self.token_usage = TokenUsage(agent_id)
        self.conversation_history: List[Dict[str, Any]] = []
        
        if openai and OPENAI_API_KEY:
            self.client = openai.OpenAI(api_key=OPENAI_API_KEY)
        else:
            logging.warning(f"OpenAI client not available for agent {agent_id}")
    
    async def make_function_call(
        self,
        system_prompt: str,
        user_message: str,
        available_functions: List[Dict[str, Any]],
        context: Optional[Dict[str, Any]] = None
    ) -> LLMResponse:
        """Make a function call request to the LLM."""
        
        if not self.client:
            return LLMResponse(
                content="",
                function_calls=[],
                token_usage=self.token_usage,
                success=False,
                error="OpenAI client not available"
            )
        
        start_time = time.time()
        
        try:
            # Prepare messages
            messages = [
                {"role": "system", "content": system_prompt}
            ]
            
            # Add conversation history (last 5 exchanges to maintain context)
            if self.conversation_history:
                messages.extend(self.conversation_history[-10:])
            
            # Add current message
            if context:
                user_message += f"\n\nContext:\n{json.dumps(context, indent=2)}"
            
            messages.append({"role": "user", "content": user_message})
            
            # Prepare function definitions
            tools = [
                {
                    "type": "function",
                    "function": func_def
                } for func_def in available_functions
            ] if available_functions else None
            
            # Make API call
            response = await asyncio.to_thread(
                self._make_sync_call,
                messages,
                tools
            )
            
            response_time = time.time() - start_time
            
            # Parse response
            if response:
                return self._parse_response(response, response_time)
            else:
                return LLMResponse(
                    content="",
                    function_calls=[],
                    token_usage=self.token_usage,
                    success=False,
                    error="No response from API",
                    response_time=response_time
                )
                
        except Exception as e:
            response_time = time.time() - start_time
            logging.error(f"LLM call failed for agent {self.agent_id}: {str(e)}")
            
            return LLMResponse(
                content="",
                function_calls=[],
                token_usage=self.token_usage,
                success=False,
                error=str(e),
                response_time=response_time
            )
    
    def _make_sync_call(self, messages: List[Dict], tools: Optional[List] = None, response_format: Optional[Dict] = None) -> Any:
        """Make synchronous API call."""
        try:
            # Check prompt length and truncate if needed
            total_prompt_length = sum(len(msg.get("content", "")) for msg in messages)
            if total_prompt_length > 50000:  # Roughly 12-13K tokens
                self._truncate_prompt(messages)
                if DEBUG_LLM_RESPONSES:
                    print(f"   ⚠️  Warning: Prompt truncated due to length ({total_prompt_length:,} chars)")
            
            kwargs = {
                "model": self.model,
                "messages": messages,
                "max_completion_tokens": MAX_TOKENS,
                "temperature": TEMPERATURE,
                "timeout": REQUEST_TIMEOUT
            }
            
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"
            
            if response_format:
                kwargs["response_format"] = response_format
            
            response = self.client.chat.completions.create(**kwargs)
            return response
            
        except Exception as e:
            logging.error(f"Sync API call failed: {str(e)}")
            return None
    
    def _truncate_prompt(self, messages: List[Dict]) -> None:
        """Truncate prompt to fit within reasonable token limits."""
        # Keep system message and last user message, truncate middle content
        if len(messages) > 2:
            # Truncate content in user messages
            for msg in messages:
                if msg.get("role") == "user" and len(msg.get("content", "")) > 10000:
                    content = msg["content"]
                    # Keep first and last parts, truncate middle
                    msg["content"] = content[:3000] + f"\\n\\n[... {len(content) - 6000:,} characters omitted ...]\\n\\n" + content[-3000:]
    
    def _parse_response(self, response: Any, response_time: float) -> LLMResponse:
        """Parse OpenAI API response."""
        try:
            choice = response.choices[0]
            message = choice.message
            
            # Extract content
            content = message.content or ""
            
            # Extract function calls
            function_calls = []
            if hasattr(message, 'tool_calls') and message.tool_calls:
                for tool_call in message.tool_calls:
                    if tool_call.type == "function":
                        try:
                            function_call = {
                                "id": tool_call.id,
                                "name": tool_call.function.name,
                                "arguments": json.loads(tool_call.function.arguments)
                            }
                            function_calls.append(function_call)
                        except json.JSONDecodeError as e:
                            logging.error(f"Failed to parse function arguments: {e}")
            
            # Track token usage
            if hasattr(response, 'usage'):
                usage = response.usage
                self.token_usage.add_usage(
                    usage.prompt_tokens,
                    usage.completion_tokens
                )
            
            # Debug print if enabled
            if DEBUG_LLM_RESPONSES:
                print(f"\n🤖 [{self.agent_id}] LLM Response:")
                print(f"   Model: {self.model}")
                print(f"   Content: {content}")
                if function_calls:
                    print(f"   Function Calls: {len(function_calls)}")
                    for i, call in enumerate(function_calls):
                        print(f"     {i+1}. {call['name']}({call.get('arguments', {})})")
                if hasattr(response, 'usage'):
                    usage = response.usage
                    print(f"   Tokens: {usage.prompt_tokens} + {usage.completion_tokens} = {usage.total_tokens}")
                    if usage.completion_tokens >= MAX_TOKENS * 0.95:  # Near token limit
                        print(f"   ⚠️  Warning: Response may be truncated (near {MAX_TOKENS} token limit)")
                print(f"   Response Time: {response_time:.2f}s")
                print("-" * 50)
            
            # Update conversation history
            self.conversation_history.append({
                "role": "assistant",
                "content": content
            })
            
            # Limit conversation history size
            if len(self.conversation_history) > 20:
                self.conversation_history = self.conversation_history[-20:]
            
            return LLMResponse(
                content=content,
                function_calls=function_calls,
                token_usage=self.token_usage,
                success=True,
                response_time=response_time
            )
            
        except Exception as e:
            logging.error(f"Failed to parse response: {e}")
            return LLMResponse(
                content="",
                function_calls=[],
                token_usage=self.token_usage,
                success=False,
                error=f"Parse error: {str(e)}",
                response_time=response_time
            )
    
    def add_user_message(self, message: str) -> None:
        """Add user message to conversation history."""
        self.conversation_history.append({
            "role": "user",
            "content": message
        })
    
    def add_function_result(self, function_name: str, result: Dict[str, Any]) -> None:
        """Add function execution result to conversation."""
        self.conversation_history.append({
            "role": "function",
            "name": function_name,
            "content": json.dumps(result)
        })
    
    def clear_conversation(self) -> None:
        """Clear conversation history."""
        self.conversation_history.clear()
    
    def get_token_usage_summary(self) -> Dict[str, Any]:
        """Get token usage statistics."""
        return {
            "agent_id": self.agent_id,
            "total_tokens": self.token_usage.total_tokens,
            "prompt_tokens": self.token_usage.prompt_tokens,
            "completion_tokens": self.token_usage.completion_tokens,
            "estimated_cost": self.token_usage.cost_estimate,
            "conversation_length": len(self.conversation_history)
        }
    
    async def make_structured_sprite_call(
        self,
        system_prompt: str,
        user_message: str
    ) -> LLMResponse:
        """Make a structured sprite generation call with enforced JSON format."""
        
        if not self.client:
            return LLMResponse(
                content="",
                function_calls=[],
                token_usage=self.token_usage,
                success=False,
                error="OpenAI client not available"
            )
        
        start_time = time.time()
        
        # Define structured sprite schema
        sprite_schema = {
            "type": "json_schema",
            "json_schema": {
                "strict": False,
                "schema": {
                    "type": "object",
                    "properties": {
                        "sprite_name": {"type": "string"},
                        "description": {"type": "string"},
                        "pixel_grid": {
                            "type": "array",
                            "items": {"type": "string"}
                        },
                        "color_mapping": {
                            "type": "object",
                            "additionalProperties": {"type": "string"}
                        },
                        "design_notes": {"type": "string"}
                    },
                    "required": [
                        "sprite_name",
                        "description", 
                        "pixel_grid",
                        "color_mapping",
                        "design_notes"
                    ]
                }
            }
        }
        
        try:
            # Prepare messages
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ]
            
            # Make structured API call
            response = await asyncio.to_thread(
                self._make_sync_call,
                messages,
                None,  # No tools for structured output
                sprite_schema
            )
            
            response_time = time.time() - start_time
            
            # Parse structured response
            if response:
                return self._parse_structured_sprite_response(response, response_time)
            else:
                return LLMResponse(
                    content="",
                    function_calls=[],
                    token_usage=self.token_usage,
                    success=False,
                    error="No response from API",
                    response_time=response_time
                )
                
        except Exception as e:
            response_time = time.time() - start_time
            logging.error(f"Structured sprite call failed for agent {self.agent_id}: {str(e)}")
            
            return LLMResponse(
                content="",
                function_calls=[],
                token_usage=self.token_usage,
                success=False,
                error=str(e),
                response_time=response_time
            )
    
    def _parse_structured_sprite_response(self, response: Any, response_time: float) -> LLMResponse:
        """Parse structured sprite response into function call format."""
        try:
            choice = response.choices[0]
            message = choice.message
            
            # Parse the JSON content
            content = message.content or "{}"
            print(f"🔍 Structured response content: {content[:200]}...")
            
            sprite_data = json.loads(content)
            print(f"🔍 Parsed sprite data keys: {list(sprite_data.keys())}")
            
            # Validate and enforce constraints in code
            if 'pixel_grid' not in sprite_data:
                print("ERROR: No pixel grid provided in response")
                return LLMResponse(
                    content=content,
                    function_calls=[],
                    token_usage=self.token_usage,
                    success=False,
                    error="No pixel grid in response",
                    response_time=response_time
                )
            
            # Enforce 16x16 grid constraint
            pixel_grid = sprite_data['pixel_grid']
            if not isinstance(pixel_grid, list) or len(pixel_grid) != 16:
                print(f"WARNING: Invalid grid size {len(pixel_grid) if isinstance(pixel_grid, list) else 'not list'}, expected 16 rows")
                # Try to fix or pad the grid
                if isinstance(pixel_grid, list):
                    if len(pixel_grid) < 16:
                        pixel_grid.extend(['.' * 16 for _ in range(16 - len(pixel_grid))])
                    elif len(pixel_grid) > 16:
                        pixel_grid = pixel_grid[:16]
                    sprite_data['pixel_grid'] = pixel_grid
            
            # Ensure each row has exactly 16 characters
            for i, row in enumerate(sprite_data['pixel_grid']):
                if len(row) != 16:
                    if len(row) < 16:
                        sprite_data['pixel_grid'][i] = row + '.' * (16 - len(row))
                    elif len(row) > 16:
                        sprite_data['pixel_grid'][i] = row[:16]
            
            # Ensure color_mapping exists
            if 'color_mapping' not in sprite_data:
                sprite_data['color_mapping'] = {
                    '.': '#000000',
                    '#': '#FFFFFF', 
                    '*': '#FF0000',
                    'o': '#00FF00',
                    'O': '#0000FF',
                    'x': '#FFFF00',
                    'X': '#FF00FF',
                    '+': '#00FFFF',
                    '@': '#808080'
                }
            
            print(f"✅ Validated sprite grid: {len(sprite_data['pixel_grid'])}x{len(sprite_data['pixel_grid'][0]) if sprite_data['pixel_grid'] else 0}")
            
            # Convert to function call format for compatibility
            function_calls = [{
                "id": "structured_sprite",
                "name": "generate_sprite",
                "arguments": sprite_data
            }]
            
            # Track token usage
            if hasattr(response, 'usage'):
                usage = response.usage
                self.token_usage.add_usage(
                    usage.prompt_tokens,
                    usage.completion_tokens
                )
            
            return LLMResponse(
                content=content,
                function_calls=function_calls,
                token_usage=self.token_usage,
                success=True,
                response_time=response_time
            )
            
        except Exception as e:
            logging.error(f"Failed to parse structured sprite response: {e}")
            print(f"🔍 Parse error: {e}")
            if 'content' in locals():
                print(f"🔍 Content causing error: {content}")
            return LLMResponse(
                content="",
                function_calls=[],
                token_usage=self.token_usage,
                success=False,
                error=f"Parse error: {str(e)}",
                response_time=response_time
            )

class ResponseValidator:
    """Validates and sanitizes LLM responses."""
    
    @staticmethod
    def validate_function_call(function_call: Dict[str, Any], available_functions: List[Dict]) -> bool:
        """Validate a function call against available functions."""
        function_name = function_call.get("name")
        arguments = function_call.get("arguments", {})
        
        # Find function schema
        function_schema = None
        for func in available_functions:
            if func["name"] == function_name:
                function_schema = func
                break
        
        if not function_schema:
            return False
        
        # Validate required parameters
        required_params = function_schema.get("parameters", {}).get("required", [])
        for param in required_params:
            if param not in arguments:
                logging.warning(f"Missing required parameter: {param}")
                return False
        
        return True
    
    @staticmethod
    def sanitize_coordinates(x: Any, y: Any, max_x: int, max_y: int) -> Tuple[int, int]:
        """Sanitize and clamp coordinates."""
        try:
            x = max(0, min(int(x), max_x - 1))
            y = max(0, min(int(y), max_y - 1))
            return x, y
        except (ValueError, TypeError):
            return 0, 0
    
    @staticmethod
    def sanitize_string(text: Any, max_length: int = 100) -> str:
        """Sanitize string input."""
        if not isinstance(text, str):
            text = str(text)
        
        # Remove potentially harmful characters
        text = text.replace("\x00", "").strip()
        
        # Limit length
        if len(text) > max_length:
            text = text[:max_length] + "..."
        
        return text
    
    @staticmethod
    def validate_resource_costs(costs: Dict[str, Any]) -> Dict[str, int]:
        """Validate and sanitize resource costs."""
        from config.game_config import RESOURCE_TYPES
        
        valid_costs = {}
        for resource, amount in costs.items():
            if resource in RESOURCE_TYPES:
                try:
                    amount = max(0, int(amount))
                    valid_costs[resource] = amount
                except (ValueError, TypeError):
                    continue
        
        return valid_costs