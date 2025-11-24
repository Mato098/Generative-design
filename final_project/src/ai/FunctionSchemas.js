export const GAME_FUNCTION_SCHEMAS = [
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
          }
        },
        required: ["x", "y", "target"]
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
          }
        },
        required: ["fromX", "fromY", "targetX", "targetY"]
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
            description: "X coordinate of attacking tile (must be owned)"
          },
          fromY: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of attacking tile (must be owned)"
          },
          targetX: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of target tile (must be adjacent enemy)"
          },
          targetY: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of target tile (must be adjacent enemy)"
          }
        },
        required: ["fromX", "fromY", "targetX", "targetY"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "convert",
      description: "Attempt to convert adjacent tile using Faith or Influence",
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
          resource: {
            type: "string",
            enum: ["F", "I"],
            description: "Resource to spend: F (Faith) or I (Influence)"
          }
        },
        required: ["fromX", "fromY", "targetX", "targetY", "resource"]
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
            description: "X coordinate of tile to build on (must be owned)"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of tile to build on (must be owned)"
          },
          building: {
            type: "string",
            enum: ["Shrine", "Idol", "Training", "Market", "Tower", "Fortress"],
            description: "Building type: Shrine(5R,+1F/turn), Idol(3R,+1 troop), Training(4R,+1 reinforce), Market(3R,+1R/turn), Tower(4R,+1 pressure), Fortress(6R,+4 defense)"
          }
        },
        required: ["x", "y", "building"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "redistribute",
      description: "Move resources between tiles or global pool (secondary action)",
      parameters: {
        type: "object",
        properties: {
          amount: {
            type: "number",
            minimum: 0.1,
            description: "Amount of resource to redistribute"
          },
          resource: {
            type: "string",
            enum: ["R", "F", "I"],
            description: "Resource type to redistribute"
          },
          note: {
            type: "string",
            description: "Optional note describing the redistribution"
          }
        },
        required: ["amount", "resource"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "repair",
      description: "Spend 2R to increase tile stability by +2 (secondary action)",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of tile to repair (must be owned)"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of tile to repair (must be owned)"
          }
        },
        required: ["x", "y"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "scorch",
      description: "Reduce resource value of adjacent enemy tile (secondary action)",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of enemy tile to scorch (must be adjacent to owned tile)"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of enemy tile to scorch (must be adjacent to owned tile)"
          }
        },
        required: ["x", "y"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "message",
      description: "Send a message (diplomatic or narrative) - no mechanical effect unless specified",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "Message content - diplomatic communication or narrative action"
          },
          target: {
            type: "string",
            description: "Target faction or 'all' for global message"
          },
          mechanical_effect: {
            type: "boolean",
            description: "Set to true if this message intends a concrete mechanical effect"
          }
        },
        required: ["content"]
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
      name: "sanctify",
      description: "Make tile sacred and add Shrine if no building exists",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of tile to sanctify"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of tile to sanctify"
          },
          reason: {
            type: "string",
            description: "Divine reason for sanctification"
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
      description: "Destroy building on tile and reduce stability by 2",
      parameters: {
        type: "object",
        properties: {
          x: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "X coordinate of tile with building to destroy"
          },
          y: {
            type: "integer",
            minimum: 0,
            maximum: 9,
            description: "Y coordinate of tile with building to destroy"
          },
          reason: {
            type: "string",
            description: "Divine reason for destruction"
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