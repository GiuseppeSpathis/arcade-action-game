// Seek and destroy enemy
// This enemy ignores gravity and is killed by colliding with obstacles,
// uses seek and destroy behavior to chase the player.
//

export class CircleEnemy {
  constructor(constants, canvas) {
    this.constants = constants.ENEMIES.CIRCLE;
    this.globalConstants = constants.ENEMIES;
    this.width = this.constants.WIDTH;
    this.height = this.constants.HEIGHT;
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
    this.facing = 1;
    this.lastShotAt = 0;
    this.active = true;
    this.deathAnimation = {
      active: false,
      startedAt: 0,
      duration: this.globalConstants.DEATH_ANIMATION_DURATION_MS ?? 320,
      fragments: [],
    };
    this.deathSpinDirection = Math.random() > 0.5 ? 1 : -1;
  }

  getNow(externalTimestamp) {
    if (typeof externalTimestamp === "number") {
      return externalTimestamp;
    }
    if (typeof performance !== "undefined" && performance.now) {
      return performance.now();
    }
    return Date.now();
  }
  // Add velocity and direction for gradual adjustment
  update(deltaTime, playerBounds, timestamp, canvas) {
    if (!this.active) {
      return null;
    }

    if (this.deathAnimation.active) {
      const now = this.getNow(timestamp);
      if (now - this.deathAnimation.startedAt >= this.deathAnimation.duration) {
        this.active = false;
      }
      return null;
    }

    if (this.isSpawning) {
      this.position.y += this.globalConstants.SPAWN_DESCENT_SPEED * deltaTime;
      if (this.position.y >= this.targetY) {
        this.position.y = this.targetY;
        this.isSpawning = false;
      }
      // Reset velocity after spawning
      if (!this.velocity) {
        this.velocity = { x: 0, y: 0 };
      }
      return null;
    }

    // Initialize velocity if not present
    if (!this.velocity) {
      this.velocity = { x: 0, y: 0 };
    }

    const playerCenterX = playerBounds.x + playerBounds.width / 2;
    const playerCenterY = playerBounds.y + playerBounds.height / 2;
    const enemyCenterX = this.position.x + this.width / 2;
    const enemyCenterY = this.position.y + this.height / 2;

    // Seek and destroy: calculate desired direction
    const dx = playerCenterX - enemyCenterX;
    const dy = playerCenterY - enemyCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalize desired direction
    let desiredDir = { x: 0, y: 0 };
    if (distance > 0.01) {
      desiredDir.x = dx / distance;
      desiredDir.y = dy / distance;
    }

    // Current velocity
    const speed = this.constants.MOVE_SPEED;
    const verticalSpeed = this.constants.VERTICAL_ADJUST_SPEED;

    // Gradually adjust velocity towards desired direction
    // Use a turn rate to limit how much the direction can change per frame
    const TURN_RATE = this.constants.TURN_RATE; // radians per second, tweak as needed

    // Calculate current direction
    const currentSpeed = Math.sqrt(
      this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y,
    );
    let currentDir = { x: 0, y: 0 };
    if (currentSpeed > 0.01) {
      currentDir.x = this.velocity.x / currentSpeed;
      currentDir.y = this.velocity.y / currentSpeed;
    } else {
      // If stopped, just use desired direction
      currentDir.x = desiredDir.x;
      currentDir.y = desiredDir.y;
    }

    // Angle between current and desired direction
    const dot = currentDir.x * desiredDir.x + currentDir.y * desiredDir.y;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

    // Clamp turn amount
    const maxTurn = TURN_RATE * deltaTime;
    let newDir = { x: currentDir.x, y: currentDir.y };

    if (angle > 0.001) {
      // Compute axis of rotation (in 2D, just sign of cross product)
      const cross = currentDir.x * desiredDir.y - currentDir.y * desiredDir.x;
      const turnAngle = Math.min(angle, maxTurn);
      const sinTurn = Math.sin(turnAngle);
      const cosTurn = Math.cos(turnAngle);

      // Rotate currentDir towards desiredDir by turnAngle
      // 2D rotation: (x', y') = (x * cos - y * sin, x * sin + y * cos)
      if (cross > 0) {
        // Rotate left
        newDir.x = currentDir.x * cosTurn - currentDir.y * sinTurn;
        newDir.y = currentDir.x * sinTurn + currentDir.y * cosTurn;
      } else {
        // Rotate right
        newDir.x = currentDir.x * cosTurn + currentDir.y * sinTurn;
        newDir.y = -currentDir.x * sinTurn + currentDir.y * cosTurn;
      }
      // Normalize
      const ndLen = Math.sqrt(newDir.x * newDir.x + newDir.y * newDir.y);
      if (ndLen > 0.01) {
        newDir.x /= ndLen;
        newDir.y /= ndLen;
      }
    }

    // Set velocity based on new direction and speed
    // Use different speed for vertical and horizontal if needed
    // Here, we scale x by MOVE_SPEED and y by VERTICAL_ADJUST_SPEED
    this.velocity.x = newDir.x * speed;
    this.velocity.y = newDir.y * verticalSpeed;

    // Move position
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;

    // Clamp position to canvas
    this.position.x = Math.max(
      0,
      Math.min(canvas.width - this.width, this.position.x),
    );
    this.position.y = Math.max(
      0,
      Math.min(canvas.height - this.height, this.position.y),
    );

    return null;
  }

  draw(ctx) {
    if (!this.active) {
      return;
    }

    const now = this.getNow();
    const isDying = this.deathAnimation.active;
    const progress = isDying
      ? Math.min(
          1,
          Math.max(
            0,
            (now - this.deathAnimation.startedAt) /
              this.deathAnimation.duration,
          ),
        )
      : 0;
    const centerX = this.position.x + this.width / 2;
    const centerY = this.position.y + this.height / 2;

    ctx.save();
    if (isDying) {
      const scale = 1 + progress * 0.4;
      ctx.globalAlpha = Math.max(0.05, 1 - progress);
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.rotate(this.deathSpinDirection * progress * Math.PI * 0.35);
      ctx.translate(-centerX, -centerY);
      ctx.shadowColor = `rgba(255, 255, 255, ${0.55 * (1 - progress)})`;
      ctx.shadowBlur = 18 + 32 * (1 - progress);
    }

    ctx.fillStyle = this.constants.COLOR;
    ctx.beginPath();
    ctx.arc(
      this.position.x + this.width / 2,
      this.position.y + this.height / 2,
      Math.min(this.width, this.height) / 2,
      0,
      Math.PI * 2,
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (isDying) {
      ctx.save();
      const ringRadius =
        Math.max(this.width, this.height) * (0.45 + progress * 0.9);
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
        const cos = Math.cos(fragment.angle);
        const sin = Math.sin(fragment.angle);
        ctx.beginPath();
        ctx.moveTo(centerX + cos * startRadius, centerY + sin * startRadius);
        ctx.lineTo(centerX + cos * endRadius, centerY + sin * endRadius);
        ctx.stroke();
      });
      ctx.restore();
    }
  }

  getBounds() {
    return {
      x: this.position.x,
      y: this.position.y,
      width: this.width,
      height: this.height,
    };
  }

  takeHit() {
    if (this.deathAnimation.active) {
      return;
    }
    this.deathAnimation.active = true;
    this.deathAnimation.startedAt = this.getNow();
    this.deathAnimation.fragments = [];
  }

  isDying() {
    return this.deathAnimation.active;
  }
}
