export class Leveller {
  constructor(constants, initialLevel = 1) {
    this.currentLevel = initialLevel;
    this.timer = 0;
    this.LEVEL_UP_SECONDS = Number(constants.LEVELING.LEVEL_UP_SECONDS);
    this.TIME_MULTIPLIER = Number(constants.LEVELING.TIME_MULTIPLIER);
    this.SCALING = constants.LEVELING.SCALING || {};
    this.ENEMIES = constants.ENEMIES;
  }

  update(deltaTime) {
    // API
    return this.updateTimerAndLevel(deltaTime);
  }

  // Returns current level after update
  // and how much time is left for next level up
  updateTimerAndLevel(deltaTime) {
    this.timer += deltaTime;
    let newStats = null;
    if (this.timer >= this.LEVEL_UP_SECONDS) {
      this.timer -= this.LEVEL_UP_SECONDS;
      this.currentLevel += 1;
      // Increase the time required for the next level up incrementally
      this.LEVEL_UP_SECONDS = this.LEVEL_UP_SECONDS * this.TIME_MULTIPLIER;
      newStats = this.levelUp(this.currentLevel);
    }

    return {
      currentLevel: this.currentLevel,
      timeToNextLevel: this.LEVEL_UP_SECONDS,
      newStats,
    };
  }

  // Helper to scale a value based on level and scaling config
  scaleValue(base, level, config) {
    if (!config) return base;
    const { type, factor, step, interval } = config;
    switch (type) {
      case "linear":
        // Increase by (factor * (level - 1)) every interval levels
        if (interval && interval > 1) {
          const increments = Math.floor((level - 1) / interval);
          return base + increments * factor;
        }
        return base + (level - 1) * factor;
      case "exponential":
        // Multiply by factor^(level-1) every interval levels
        if (interval && interval > 1) {
          const increments = Math.floor((level - 1) / interval);
          return base * Math.pow(factor, increments);
        }
        return base * Math.pow(factor, level - 1);
      case "step":
        // Increase by step every interval levels
        if (interval && interval > 1) {
          const increments = Math.floor((level - 1) / interval);
          return base + increments * step;
        }
        return base + (level - 1) * step;
      default:
        return base;
    }
  }

  // returns new numerical values for enemies to follow
  levelUp(currentLevel) {
    const base = this.ENEMIES;

    // Helper function to recursively and dynamically scale all numerical properties
    const scaleAllProperties = (obj, path = []) => {
      if (typeof obj !== "object" || obj === null) return obj;

      // If it's an array, map over it
      if (Array.isArray(obj)) {
        return obj.map((item, idx) =>
          scaleAllProperties(item, path.concat(idx)),
        );
      }

      const result = {};
      for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        const value = obj[key];

        // If value is an object, recurse
        if (typeof value === "object" && value !== null) {
          result[key] = scaleAllProperties(value, path.concat(key));
        } else if (typeof value === "number") {
          // Try to find a scaling config for this property
          let scalingConfig = null;

          // --- LOGIC START ---
          // Because we fixed the initial path, path[0] will correctly be "ENEMIES"
          if (this.SCALING[path[0]]) {
            // Check 1: Direct child of path[0] (e.g., ENEMIES.SPAWN_INTERVAL_MS)
            if (
              this.SCALING[path[0]][key] &&
              typeof this.SCALING[path[0]][key] === "object" &&
              !Array.isArray(this.SCALING[path[0]][key]) &&
              (this.SCALING[path[0]][key].type ||
                this.SCALING[path[0]][key].factor ||
                this.SCALING[path[0]][key].step)
            ) {
              scalingConfig = this.SCALING[path[0]][key];
            }
            // Check 2: Nested child (e.g., ENEMIES.GROUP_SIZE.MIN)
            else if (
              path.length > 1 &&
              this.SCALING[path[0]][path[1]] &&
              typeof this.SCALING[path[0]][path[1]] === "object"
            ) {
              // Check if the config exists at the grandchild level (MIN/MAX)
              if (
                this.SCALING[path[0]][path[1]][key] &&
                typeof this.SCALING[path[0]][path[1]][key] === "object"
              ) {
                scalingConfig = this.SCALING[path[0]][path[1]][key];
              }
              // Check if the config exists at the child level (Fallback)
              else if (
                this.SCALING[path[0]][path[1]].type ||
                this.SCALING[path[0]][path[1]].step ||
                this.SCALING[path[0]][path[1]].factor
              ) {
                scalingConfig = this.SCALING[path[0]][path[1]];
              }
            }
          }
          // --- LOGIC END ---

          result[key] = this.scaleValue(value, currentLevel, scalingConfig);
        } else {
          // Non-numeric, just copy
          result[key] = value;
        }
      }
      return result;
    };

    const newStats = {
      // FIX: Initialize the recursion with the context path ["ENEMIES"]
      // This ensures path[0] is always "ENEMIES" during lookup.
      ENEMIES: scaleAllProperties(base, ["ENEMIES"]),
    };

    return newStats;
  }
}
