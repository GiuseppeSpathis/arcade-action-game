// BaseEnemy superclass
export class BaseEnemy {
  constructor(coreConstants, enemyConstants, canvas) {
    this.core = coreConstants; // constants.ENEMIES
    this.constants = enemyConstants; // constants.ENEMIES.<TYPE>

    this.width = enemyConstants.WIDTH ?? enemyConstants.SIZE;
    this.height = enemyConstants.HEIGHT ?? enemyConstants.SIZE;

    this.health = enemyConstants.HEALTH;

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
  updateStats(newStats, newStatsType) {
    this.health = this.health + newStatsType.HEALTH - this.constants.HEALTH;

    this.core = newStats; // constants.ENEMIES
    this.constants = newStatsType; // constants.ENEMIES.<TYPE>
  }

  // ---- Shared hit logic ----
  takeHit(damage) {
    if (this.deathAnimation.active) return;
    this.health -= damage;
    if (this.health <= 0) {
      this.triggerDeath();
    }
  }

  triggerDeath() {
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
  // ---- Damage effect like player ----// ---- Damage effect on hit, with shape from subclass ----
  triggerDamageFeedback(timestamp, shapeDrawer) {
    const now = this.getNow(timestamp);
    this.damageEffect = {
      startAt: now,
      endAt: now + 220,
      shapeDrawer: shapeDrawer || this.drawDamageShape,
    };
  }

  isDamageEffectActive() {
    return (
      this.damageEffect &&
      this.getNow() < this.damageEffect.endAt &&
      typeof this.damageEffect.shapeDrawer === "function"
    );
  }

  // Override takeHit to trigger damage effect on each hit
  takeHit(damage, shapeDrawer) {
    if (this.deathAnimation.active) return;
    this.health -= damage;
    this.triggerDamageFeedback(undefined, shapeDrawer);
    if (this.health <= 0) {
      this.triggerDeath();
    }
  }

  // Default damage shape drawer (subclass should override)
  drawDamageShape(ctx, x, y, w, h, progress) {
    // Default: simple ellipse flash
    ctx.save();
    ctx.globalAlpha = 0.7 - progress * 0.5;
    ctx.fillStyle = "rgba(255, 241, 118, 0.85)";
    ctx.beginPath();
    ctx.ellipse(
      x + w / 2,
      y + h / 2,
      w * (0.45 + 0.2 * Math.sin(progress * Math.PI)),
      h * (0.45 + 0.2 * Math.cos(progress * Math.PI)),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  // Draw damage effect overlay using shapeDrawer
  drawEnemy(ctx, progress = 0) {
    // Subclasses should call super.drawEnemy(ctx, progress) if they override this
    if (typeof this._drawEnemyBase === "function") {
      this._drawEnemyBase(ctx, progress);
    }

    // Damage effect
    if (this.isDamageEffectActive()) {
      const now = this.getNow();
      const elapsed = now - this.damageEffect.startAt;
      const duration = this.core.DAMAGE_FLASH_DURATION_MS ?? 220;
      const clampedElapsed = Math.min(Math.max(elapsed, 0), duration);
      const effectProgress = clampedElapsed / duration;

      // Call the shapeDrawer function (from subclass or default)
      this.damageEffect.shapeDrawer(
        ctx,
        this.position.x,
        this.position.y,
        this.width,
        this.height,
        effectProgress,
      );
    }
  }
}
