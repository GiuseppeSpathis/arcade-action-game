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
          // Priority: SCALING[path[0]][key] > SCALING[path[0]][path[1]][key] > SCALING[path[0]][path[1]] > SCALING[path[0]] > null
          // Example: SCALING["ENEMIES"]["HEALTH"], SCALING["TRIANGLE"]["HEALTH"], etc.
          let scalingConfig = null;
          // path[0] is the top-level key (e.g. "ENEMIES", "TRIANGLE", etc.)
          // path[1] is the sub-key if present (e.g. "GROUP_SIZE", etc.)
          if (this.SCALING[path[0]]) {
            // If nested object (e.g. GROUP_SIZE.MIN)
            if (
              typeof this.SCALING[path[0]][key] === "object" &&
              this.SCALING[path[0]][key] !== null &&
              !Array.isArray(this.SCALING[path[0]][key]) &&
              (Object.prototype.hasOwnProperty.call(
                this.SCALING[path[0]][key],
                "type",
              ) ||
                Object.prototype.hasOwnProperty.call(
                  this.SCALING[path[0]][key],
                  "step",
                ) ||
                Object.prototype.hasOwnProperty.call(
                  this.SCALING[path[0]][key],
                  "factor",
                ))
            ) {
              scalingConfig = this.SCALING[path[0]][key];
            } else if (
              path.length > 1 &&
              this.SCALING[path[0]][path[1]] &&
              typeof this.SCALING[path[0]][path[1]] === "object"
            ) {
              // For nested objects like GROUP_SIZE.MIN
              if (
                this.SCALING[path[0]][path[1]][key] &&
                typeof this.SCALING[path[0]][path[1]][key] === "object"
              ) {
                scalingConfig = this.SCALING[path[0]][path[1]][key];
              } else if (
                Object.prototype.hasOwnProperty.call(
                  this.SCALING[path[0]][path[1]],
                  "type",
                ) ||
                Object.prototype.hasOwnProperty.call(
                  this.SCALING[path[0]][path[1]],
                  "step",
                ) ||
                Object.prototype.hasOwnProperty.call(
                  this.SCALING[path[0]][path[1]],
                  "factor",
                )
              ) {
                scalingConfig = this.SCALING[path[0]][path[1]];
              }
            }
          }
          result[key] = this.scaleValue(value, currentLevel, scalingConfig);
        } else {
          // Non-numeric, just copy
          result[key] = value;
        }
      }
      return result;
    };

    const newStats = {
      ENEMIES: scaleAllProperties(base),
    };

    return newStats;
  }
}
