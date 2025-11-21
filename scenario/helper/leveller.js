export class Leveller {
  constructor(constants, initialLevel = 1) {
    this.currentLevel = initialLevel;
    this.timer = 0;
    this.LEVEL_UP_SECONDS = Number(constants.LEVELING.LEVEL_UP_SECONDS);
    this.TIME_MULTIPLIER = Number(constants.LEVELING.TIME_MULTIPLIER);
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
      newStats = this.levelUp();
    }

    return {
      currentLevel: this.currentLevel,
      timeToNextLevel: this.LEVEL_UP_SECONDS,
      newStats,
    };
  }

  // returns new numerical values for enemies to follow
  levelUp() {
    //TODO
    return null;
  }
}
