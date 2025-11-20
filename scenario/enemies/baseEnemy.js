// BaseEnemy superclass
export class BaseEnemy {
  constructor(coreConstants, enemyConstants, canvas) {
    this.core = coreConstants; // constants.ENEMIES
    this.constants = enemyConstants; // constants.ENEMIES.<TYPE>

    this.width = enemyConstants.WIDTH ?? enemyConstants.SIZE;
    this.height = enemyConstants.HEIGHT ?? enemyConstants.SIZE;

    this.position = {
      x: Math.random() * Math.max(1, canvas.width - this.width),
      y: -this.height,
    };

    const minTarget = this.height * 1.2;
    const maxTarget = Math.min(
      canvas.height * 0.35,
      minTarget + this.height * 2.5,
    );
    const availableRange = Math.max(this.height * 0.5, maxTarget - minTarget);

    this.targetY = Math.min(
      canvas.height - this.height,
      minTarget + Math.random() * availableRange,
    );

    this.isSpawning = true;
    this.active = true;

    this.deathAnimation = {
      active: false,
      startedAt: 0,
      duration: coreConstants.DEATH_ANIMATION_DURATION_MS ?? 320,
      fragments: [],
    };

    this.deathSpinDirection = Math.random() > 0.5 ? 1 : -1;
  }

  // ---- Utility ----
  getNow(externalTimestamp) {
    if (typeof externalTimestamp === "number") return externalTimestamp;
    if (typeof performance !== "undefined" && performance.now)
      return performance.now();
    return Date.now();
  }

  // ---- Shared spawn descent ----
  handleSpawning(deltaTime) {
    this.position.y += this.core.SPAWN_DESCENT_SPEED * deltaTime;

    if (this.position.y >= this.targetY) {
      this.position.y = this.targetY;
      this.isSpawning = false;
    }
  }

  // ---- Shared death update ----
  handleDeath(timestamp) {
    const now = this.getNow(timestamp);
    if (now - this.deathAnimation.startedAt >= this.deathAnimation.duration) {
      this.active = false;
    }
  }

  // ---- API ----
  update(
    deltaTime,
    playerBounds,
    timestamp,
    canvas,
    globalBulletsArray = null,
  ) {
    if (!this.active) return;

    if (this.deathAnimation.active) {
      this.handleDeath(timestamp);
      return;
    }

    if (this.isSpawning) {
      this.handleSpawning(deltaTime);
      return;
    }

    // Subclasses implement real behavior
    this.updateEnemy(
      deltaTime,
      playerBounds,
      timestamp,
      canvas,
      globalBulletsArray,
    );
  }

  draw(ctx) {
    if (!this.active) return;

    const now = this.getNow();
    const progress = this.deathAnimation.active
      ? Math.min(
          1,
          (now - this.deathAnimation.startedAt) / this.deathAnimation.duration,
        )
      : 0;

    this.drawEnemy(ctx, progress);
  }

  // ---- Overridden by subclasses ----
  updateEnemy() {}
  drawEnemy() {}

  // ---- Shared hit logic ----
  takeHit() {
    if (this.deathAnimation.active) return;
    this.deathAnimation.active = true;
    this.deathAnimation.startedAt = this.getNow();
    this.deathAnimation.fragments = [];
  }

  isDying() {
    return this.deathAnimation.active;
  }

  getBounds() {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.width,
      height: this.height,
    };
  }
}
