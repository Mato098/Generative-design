export const GAME_FUNCTION_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "execute_turn_plan",
      description: "Execute multiple coordinated actions in a single turn. This is the ONLY function you should call - never call individual actions directly.",
      parameters: {
        type: "object",
        properties: {
          plan: {
            type: "array",
            description: "Sequence of actions to execute in order",
            items: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: ["recruit", "move", "construct", "convert", "sanctuary", "send_message"],
                  description: "The action to perform"
                },
                args: {
                  type: "object",
                  description: "Arguments for the action",
                  properties: {
                    // Common coordinates
                    x: { type: "integer", minimum: 0, maximum: 9 },
                    y: { type: "integer", minimum: 0, maximum: 9 },
                    fromX: { type: "integer", minimum: 0, maximum: 9 },
                    fromY: { type: "integer", minimum: 0, maximum: 9 },
                    targetX: { type: "integer", minimum: 0, maximum: 9 },
                    targetY: { type: "integer", minimum: 0, maximum: 9 },
                    toX: { type: "integer", minimum: 0, maximum: 9 },
                    toY: { type: "integer", minimum: 0, maximum: 9 },
                    
                    // Action-specific parameters
                    amount: { type: "number", minimum: 0.1, description: "Amount for recruit/move actions" },
                    troops: { type: "number", minimum: 0.1, description: "Number of troops to send (clamped to available)" },
                    building: { type: "string", enum: ["Shrine", "Idol", "Training", "Market", "Tower", "Fortress"] },
                    message: { type: "string" },
                    recipient: { type: "string" },
                    blurb: { type: "string", description: "Required dramatic declaration for this action" }
                  },
                  required: ["blurb"]
                }
              },
              required: ["action", "args"]
            },
            minItems: 1
            // No maxItems - unlimited actions per turn
          }
        },
        required: ["plan"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "recruit",
      description: "Recruit troops on ANY owned tile! Costs 1R per troop for first 5 in turn, then 2R for next 5, then 3R. Training building doubles recruited troops.",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of the tile to recruit on"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of the tile to recruit on"
          },
          amount: {
            type: "number",
            minimum: 1,
            description: "Number of troops to recruit (costs 1R each for first 5, then 2R for next 5, then 3R. Doubled with Training building). Default: 1"
          },
          blurb: {
            type: "string",
            description: "A short command or declaration as ruler (e.g., 'Rally the troops!', 'Strengthen our defenses!')"
          }
        },
        required: ["x", "y", "blurb"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "move",
      description: "Move troops from owned tile to adjacent tile. If target is enemy/neutral, attack it. If target is yours, relocate troops.",
      parameters: {
        type: "object",
        properties: {
          fromX: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of source tile with troops"
          },
          fromY: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of source tile with troops"
          },
          targetX: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of target tile (must be adjacent)"
          },
          targetY: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of target tile (must be adjacent)"
          },
          troops: {
            type: "number",
            minimum: 0.1,
            description: "Number of troops to move (clamped to available)"
          },
          blurb: {
            type: "string",
            description: "A short command (e.g., 'Attack!', 'Move troops!', 'Charge!', 'Reposition!')"
          }
        },
        required: ["fromX", "fromY", "targetX", "targetY", "troops", "blurb"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "convert",
      description: "Attempt to convert adjacent tile using Faith",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of tile to convert"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of tile to convert"
          },
          blurb: {
            type: "string",
            description: "A short command or declaration as ruler (e.g., 'Spread our faith!', 'Convert the heathens!')"
          }
        },
        required: ["x", "y", "blurb"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "construct",
      description: "Construct a building on owned tile",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of owned tile"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of owned tile"
          },
          building: {
            type: "string",
            enum: ["Shrine", "Training", "Market", "Tower", "Fortress", "Idol"],
            description: "Type of building: Shrine(2R,1F), Training(3R), Market(2R), Tower(3R), Fortress(5R), Idol(1R,2F)"
          },
          blurb: {
            type: "string",
            description: "A short command or declaration as ruler (e.g., 'Build a fortress!', 'Construct a shrine!', 'Establish a market!')"
          }
        },
        required: ["x", "y", "building", "blurb"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "sanctuary",
      description: "Use Faith to protect tile from attack or conversion for 2 turns.",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of tile to protect"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of tile to protect"
          },
          blurb: {
            type: "string",
            description: "A short command or declaration as ruler (e.g., 'Divine protection!', 'Sacred sanctuary!')"
          }
        },
        required: ["x", "y", "blurb"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_message",
      description: "Send a diplomatic message or declaration to other rulers, or pray",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "Your message or declaration to other players, or a prayer, up to 100 words"
          },
          target: {
            type: "string",
            description: "they are always broadcasted to all factions",
          }
        },
        required: ["message"]
      }
    }
  }
];

export const OBSERVER_FUNCTION_SCHEMAS = [
  {
    type: "function",
    function: {
      name: "smite",
      description: "Divine power: destroy all troops on target tile",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of tile"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of tile"
          },
          reason: {
            type: "string",
            description: "Why this tile (optional)"
          }
        },
        required: ["x", "y"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "bless",
      description: "Divine power: add 5 troops to tile and give owner +2 Faith",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of tile"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of tile"
          },
          reason: {
            type: "string",
            description: "Why this tile (optional)"
          }
        },
        required: ["x", "y"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "meteor",
      description: "Divine cataclysm: destroys half the troops in 3x3 area",
      parameters: {
        type: "object",
        properties: {
          centerX: {
            type: "integer",
            minimum: 1,
            maximum: 8,
            description: "X coordinate of impact center (1-8 ensures 3x3 fits)"
          },
          centerY: {
            type: "integer",
            minimum: 1,
            maximum: 8,
            description: "Y coordinate of impact center (1-8 ensures 3x3 fits)"
          },
          reason: {
            type: "string",
            description: "Why here (optional)"
          }
        },
        required: ["centerX", "centerY"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "sanctify",
      description: "Divine power: convert tile to sacred terrain and add Shrine building",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of tile"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of tile"
          },
          reason: {
            type: "string",
            description: "Why this tile (optional)"
          }
        },
        required: ["x", "y"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "rend",
      description: "Divine power: destroy buildings and heavily damage troops",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of tile"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of tile"
          },
          reason: {
            type: "string",
            description: "Why this tile (optional)"
          }
        },
        required: ["x", "y"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "observe",
      description: "Watch without acting, optionally speak to the mortals",
      parameters: {
        type: "object",
        properties: {
          commentary: {
            type: "string",
            description: "Words for the mortals to hear (optional)"
          }
        },
        required: []
      }
    }
  }
];