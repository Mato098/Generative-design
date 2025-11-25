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
                  enum: ["reinforce", "project_pressure", "assault", "construct", "convert", "redistribute", "repair", "scorch", "send_message"],
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
                    target: { type: "string", enum: ["troop_power", "stability"] },
                    strength: { type: "number", minimum: 0.1, maximum: 1.0 },
                    building: { type: "string", enum: ["Fort", "Market", "Shrine", "Training"] },
                    amount: { type: "number", minimum: 0.1 },
                    message: { type: "string" },
                    recipient: { type: "string" },
                    blurb: { type: "string", description: "Required dramatic declaration for this action" }
                  },
                  required: ["blurb"]
                }
              },
              required: ["action", "args"]
            },
            minItems: 1,
            maxItems: 4
          }
        },
        required: ["plan"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reinforce",
      description: "Reinforce a tile by spending resources to increase troop power or stability",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of the tile to reinforce"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of the tile to reinforce"
          },
          target: {
            type: "string",
            enum: ["troop_power", "stability"],
            description: "What to reinforce: troop_power (1R, +1 or +2 if Training) or stability (2R, +1)"
          },
          blurb: {
            type: "string",
            description: "A short command or declaration as ruler (e.g., 'Rally the troops!', 'Strengthen our defenses!')"
          }
        },
        required: ["x", "y", "target", "blurb"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "project_pressure",
      description: "Project pressure from owned tile to adjacent target, reducing target stability",
      parameters: {
        type: "object",
        properties: {
          fromX: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of source tile (must be owned)"
          },
          fromY: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of source tile (must be owned)"
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
          blurb: {
            type: "string",
            description: "A short command or declaration as ruler (e.g., 'Intimidate our enemies!', 'Show them our strength!')"
          }
        },
        required: ["fromX", "fromY", "targetX", "targetY", "blurb"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "assault",
      description: "Launch military assault from owned tile to adjacent enemy tile",
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
          strength: {
            type: "number",
            minimum: 0.1,
            maximum: 1.0,
            description: "Fraction of troops to commit (0.1=10%, 1.0=100%)"
          },
          blurb: {
            type: "string",
            description: "A short command or declaration as ruler (e.g., 'Attack!', 'Claim that territory!', 'Charge!')"
          }
        },
        required: ["fromX", "fromY", "targetX", "targetY", "strength", "blurb"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "convert",
      description: "Attempt to convert adjacent tile using Faith and Influence",
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
      name: "redistribute",
      description: "Move troops between your tiles",
      parameters: {
        type: "object",
        properties: {
          fromX: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Source tile X coordinate"
          },
          fromY: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Source tile Y coordinate"
          },
          toX: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Destination tile X coordinate"
          },
          toY: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Destination tile Y coordinate"
          },
          amount: {
            type: "number",
            minimum: 0.1,
            description: "Amount of troops to transfer"
          },
          blurb: {
            type: "string",
            description: "A short command or declaration as ruler (e.g., 'Reinforce the frontline!', 'Move troops north!')"
          }
        },
        required: ["fromX", "fromY", "toX", "toY", "troops", "blurb"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "repair",
      description: "Repair damaged tile stability using resources",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of tile to repair"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of tile to repair"
          },
          blurb: {
            type: "string",
            description: "A short command or declaration as ruler (e.g., 'Rebuild our lands!', 'Restore order!')"
          }
        },
        required: ["x", "y", "blurb"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "scorch",
      description: "Damage adjacent enemy tile with destructive magic",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of target tile to scorch"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of target tile to scorch"
          },
          blurb: {
            type: "string",
            description: "A short command or declaration as ruler (e.g., 'Burn their fields!', 'Unleash destruction!')"
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
      description: "Send a diplomatic message or declaration to other rulers",
      parameters: {
        type: "object",
        properties: {
          message: {
            type: "string",
            description: "Your message or declaration to other players"
          },
          target: {
            type: "string",
            description: "Target faction name or 'all' for global message",
            enum: ["all", "Faction A", "Faction B", "Observer"]
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
      description: "Divine punishment: set troop_power to 0 and reduce stability by 3",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of tile to smite"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of tile to smite"
          },
          reason: {
            type: "string",
            description: "Divine reason for the smiting"
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
      description: "Divine blessing: set stability to 10 and give owner +2 Faith",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of tile to bless"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of tile to bless"
          },
          reason: {
            type: "string",
            description: "Divine reason for the blessing"
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
      description: "Meteor strike in 3x3 area: -50% troop power, -3 stability",
      parameters: {
        type: "object",
        properties: {
          centerX: {
            type: "integer",
            minimum: 1,
            maximum: 8,
            description: "X coordinate of meteor center (1-8 to ensure 3x3 area fits)"
          },
          centerY: {
            type: "integer",
            minimum: 1,
            maximum: 8,
            description: "Y coordinate of meteor center (1-8 to ensure 3x3 area fits)"
          },
          reason: {
            type: "string",
            description: "Divine reason for meteor strike"
          }
        },
        required: ["centerX", "centerY"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "observe",
      description: "Take no action this turn, just observe the unfolding drama",
      parameters: {
        type: "object",
        properties: {
          commentary: {
            type: "string",
            description: "Divine commentary on the current state of the game"
          }
        },
        required: ["commentary"]
      }
    }
  }
];