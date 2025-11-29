// TriangleEnemy.js
import { BaseEnemy } from "./baseEnemy.js";
import { Bullet } from "../helper/bullet.js";

export class TriangleEnemy extends BaseEnemy {
  constructor(constants, canvas) {
    super(constants.ENEMIES, constants.ENEMIES.TRIANGLE, canvas);

    this.facing = 1;
    this.lastShotAt = 0;
  }

  updateEnemy(deltaTime, playerBounds, timestamp, canvas, globalBulletsArray) {
    const playerCenterX = playerBounds.x + playerBounds.width / 2;
    const playerCenterY = playerBounds.y + playerBounds.height / 2;

    const enemyCenterX = this.position.x + this.width / 2;
    const enemyCenterY = this.position.y + this.height / 2;

    // Horizontal movement
    if (playerCenterX > enemyCenterX + 4) {
      this.position.x += this.constants.MOVE_SPEED * deltaTime;
      this.facing = 1;
    } else if (playerCenterX < enemyCenterX - 4) {
      this.position.x -= this.constants.MOVE_SPEED * deltaTime;
      this.facing = -1;
    }

    // Vertical tracking
    if (playerCenterY > enemyCenterY + 6) {
      this.position.y += this.constants.VERTICAL_ADJUST_SPEED * deltaTime;
    } else if (playerCenterY < enemyCenterY - 6) {
      this.position.y -= this.constants.VERTICAL_ADJUST_SPEED * deltaTime;
    }

    // Clamp inside screen
    this.position.x = Math.max(
      0,
      Math.min(canvas.width - this.width, this.position.x),
    );
    this.position.y = Math.max(
      0,
      Math.min(canvas.height - this.height, this.position.y),
    );

    const sameLayer =
      Math.abs(playerCenterY - (this.position.y + this.height / 2)) <
      this.height / 2;

    // Fire bullet
    if (
      sameLayer &&
      timestamp - this.lastShotAt >= this.constants.FIRE_COOLDOWN_MS
    ) {
      this.lastShotAt = timestamp;
      this.fireBullet(globalBulletsArray);
    }
  }

  updateStats(newStats) {
    super.updateStats(newStats.ENEMIES, newStats.ENEMIES.TRIANGLE);
  }

  fireBullet(bulletsArray) {
    const originX =
      this.position.x +
      (this.facing > 0
        ? this.width + this.constants.BULLET_RADIUS
        : -this.constants.BULLET_RADIUS);
    const originY = this.position.y + this.height / 2;

    const bullet = new Bullet({
      x: originX,
      y: originY,
      direction: { x: this.facing, y: 0 },
      speed: this.constants.BULLET_SPEED,
      radius: this.constants.BULLET_RADIUS,
      color: this.constants.BULLET_COLOR,
      fromEnemy: true,
    });

    bulletsArray.push(bullet);
  }
  // Custom damage effect for TriangleEnemy
  drawDamageShape(ctx, x, y, w, h, progress) {
    // Flashing triangle overlay
    ctx.save();
    ctx.globalAlpha = 0.7 - progress * 0.5;
    ctx.fillStyle = "rgba(255, 241, 118, 0.85)";
    ctx.beginPath();

    if (this.facing >= 0) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w, y + h / 2);
    } else {
      ctx.moveTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h / 2);
    }

    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Override drawEnemy to include damage effect
  drawEnemy(ctx, progress = 0) {
    // Draw base triangle
    const centerX = this.position.x + this.width / 2;
    const centerY = this.position.y + this.height / 2;

    ctx.save();

    if (this.deathAnimation.active) {
      const scale = 1 + progress * 0.4;
      ctx.globalAlpha = Math.max(0.05, 1 - progress);
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.rotate(this.deathSpinDirection * progress * Math.PI * 0.35);
      ctx.translate(-centerX, -centerY);
    }

    ctx.fillStyle = this.constants.COLOR;
    ctx.beginPath();

    if (this.facing >= 0) {
      ctx.moveTo(this.position.x, this.position.y);
      ctx.lineTo(this.position.x, this.position.y + this.height);
      ctx.lineTo(
        this.position.x + this.width,
        this.position.y + this.height / 2,
      );
    } else {
      ctx.moveTo(this.position.x + this.width, this.position.y);
      ctx.lineTo(this.position.x + this.width, this.position.y + this.height);
      ctx.lineTo(this.position.x, this.position.y + this.height / 2);
    }

    ctx.fill();
    ctx.restore();

    // Damage effect overlay
    if (
      this.isDamageEffectActive &&
      typeof this.isDamageEffectActive === "function" &&
      this.isDamageEffectActive()
    ) {
      const now = this.getNow();
      const elapsed = now - this.damageEffect.startAt;
      const duration = this.core.DAMAGE_FLASH_DURATION_MS ?? 220;
      const clampedElapsed = Math.min(Math.max(elapsed, 0), duration);
      const effectProgress = clampedElapsed / duration;

      this.drawDamageShape(
        ctx,
        this.position.x,
        this.position.y,
        this.width,
        this.height,
        effectProgress,
      );
    }

    if (this.deathAnimation.active) {
      this.drawDeathEffects(ctx, centerX, centerY, progress);
    }
  }

  drawDeathEffects(ctx, centerX, centerY, progress) {
    const ringRadius =
      Math.max(this.width, this.height) * (0.45 + progress * 0.9);

    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.6 * (1 - progress));
    ctx.lineWidth = 2 + progress * 6;
    ctx.strokeStyle = `rgba(255, 220, 120, ${0.7 * (1 - progress)})`;

    ctx.beginPath();
    ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    if (!this.deathAnimation.fragments.length) {
      this.deathAnimation.fragments = Array.from({ length: 6 }, () => ({
        angle: Math.random() * Math.PI * 2,
        speed: 14 + Math.random() * 18,
      }));
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.65 * (1 - progress));
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - progress)})`;
    ctx.lineWidth = 1.2 + (1 - progress) * 1.8;

    this.deathAnimation.fragments.forEach((fragment) => {
      const startRadius =
        Math.max(this.width, this.height) * 0.28 +
        progress * fragment.speed * 0.4;
      const endRadius = startRadius + fragment.speed * progress * 1.6;

      ctx.beginPath();
      ctx.moveTo(
        centerX + Math.cos(fragment.angle) * startRadius,
        centerY + Math.sin(fragment.angle) * startRadius,
      );
      ctx.lineTo(
        centerX + Math.cos(fragment.angle) * endRadius,
        centerY + Math.sin(fragment.angle) * endRadius,
      );
      ctx.stroke();
    });

    ctx.restore();
  }
}
