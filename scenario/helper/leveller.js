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
    return this.updateTimerAndLevel(deltaTime);
  }
  // Tracks survival time and triggers a level up when the threshold is reached
  updateTimerAndLevel(deltaTime) {
    this.timer += deltaTime;
    let newStats = null;
    if (this.timer >= this.LEVEL_UP_SECONDS) {
      this.timer -= this.LEVEL_UP_SECONDS;
      this.currentLevel += 1;
      // Increase the time required to reach the next level
      this.LEVEL_UP_SECONDS = this.LEVEL_UP_SECONDS * this.TIME_MULTIPLIER;
      // Calculate new enemy stats for this level
      newStats = this.levelUp(this.currentLevel);
    }

    return {
      currentLevel: this.currentLevel,
      timeToNextLevel: this.LEVEL_UP_SECONDS,
      newStats,
    };
  }
  // Applies math formulas (linear, exponential, step) to base values based on level
  scaleValue(base, level, config) {
    if (!config) return base;
    const { type, factor, step, interval } = config;
    switch (type) {
      case "linear":
        // Increases by 'factor' every level (or every 'interval' levels)
        if (interval && interval > 1) {
          const increments = Math.floor((level - 1) / interval);
          return base + increments * factor;
        }
        return base + (level - 1) * factor;
      case "exponential":
        if (interval && interval > 1) {
          const increments = Math.floor((level - 1) / interval);
          return base * Math.pow(factor, increments);
        }
        return base * Math.pow(factor, level - 1);
      case "step":
        if (interval && interval > 1) {
          const increments = Math.floor((level - 1) / interval);
          return base + increments * step;
        }
        return base + (level - 1) * step;
      default:
        return base;
    }
  }
  // Recursively traverses the stats object to apply scaling to numerical values
  levelUp(currentLevel) {
    const base = this.ENEMIES;

    const scaleAllProperties = (obj, path = []) => {
      if (typeof obj !== "object" || obj === null) return obj;

      if (Array.isArray(obj)) {
        return obj.map((item, idx) =>
          scaleAllProperties(item, path.concat(idx)),
        );
      }

      const result = {};
      for (const key in obj) {
        if (!obj.hasOwnProperty(key)) continue;
        const value = obj[key];

        if (typeof value === "object" && value !== null) {
          // Recurse deeper into the object tree
          result[key] = scaleAllProperties(value, path.concat(key));
        } else if (typeof value === "number") {
          let scalingConfig = null;

          // Attempt to find a matching scaling configuration in constants.json
          // Structure example: SCALING["ENEMIES"]["SQUARE"]["HP"]
          if (this.SCALING[path[0]]) {
            // Check for direct property scaling
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
            // Check for nested property scaling (e.g. within an enemy type)
            else if (
              path.length > 1 &&
              this.SCALING[path[0]][path[1]] &&
              typeof this.SCALING[path[0]][path[1]] === "object"
            ) {
              if (
                this.SCALING[path[0]][path[1]][key] &&
                typeof this.SCALING[path[0]][path[1]][key] === "object"
              ) {
                scalingConfig = this.SCALING[path[0]][path[1]][key];
              }
              else if (
                this.SCALING[path[0]][path[1]].type ||
                this.SCALING[path[0]][path[1]].step ||
                this.SCALING[path[0]][path[1]].factor
              ) {
                scalingConfig = this.SCALING[path[0]][path[1]];
              }
            }
          }

          result[key] = this.scaleValue(value, currentLevel, scalingConfig);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    const newStats = {
      ENEMIES: scaleAllProperties(base, ["ENEMIES"]),
    };

    return newStats;
  }
}
