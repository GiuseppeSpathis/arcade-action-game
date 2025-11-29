import { checkCollision } from "./map.js";

export class PlayerController {
  constructor(constants, mapData, canvas, playerData, playerIndex, stats) {
    this.constants = constants;
    this.canvas = canvas;
    this.map = mapData.grid;
    this.tileSize = constants.TILE_SIZE;
    this.mapOffsetY = mapData.verticalOffset;

    // Assign player-specific data
    this.playerData = playerData;
    this.playerIndex = playerIndex;
    this.lives = stats.MAX_LIVES;
    this.lastDamageAt = -Infinity;
    this.isDead = false;
    this.lastPlayerShot = 0;
    this.stats = stats;

    const baseSpawnCol = Math.floor(
      mapData.cols / constants.MAP.FALLBACK_PLATFORM_DIVISOR,
    );
    // Offset spawn position based on player index
    const spawnCol = baseSpawnCol + playerIndex * 2;
    const spawnRow = mapData.floorRow;
    const horizontalPadding =
      (this.tileSize - constants.STATS.SIZE) /
      constants.PLAYER.SPAWN_HORIZONTAL_DIVISOR;

    this.state = {
      width: stats.SIZE,
      height: stats.SIZE,
      x: spawnCol * this.tileSize + horizontalPadding,
      y:
        this.mapOffsetY +
        spawnRow * this.tileSize -
        stats.SIZE -
        constants.PLAYER.COLLISION_OFFSET,
      vx: 0,
      vy: 0,
      onGround: true,
      coyoteFrames: 0,
      jumpBufferFrames: 0,
      rotation: 0,
      rotationVelocity: 0,
      wallJumpCooldown: 0 // Initialize cooldown
    };

    this.damageEffect = {
      startAt: -Infinity,
      endAt: -Infinity,
      splats: [],
    };
    this.damageEffectDuration =
      this.constants.PLAYER.DAMAGE_FLASH_DURATION_MS ?? 450;
  }

  getStats() {
    return this.stats;
  }

  updateStats(newStats) {
    this.state.width = newStats.SIZE;
    this.state.height = newStats.SIZE;

    this.lives = this.lives + newStats.MAX_LIVES - this.stats.MAX_LIVES;
    this.stats = newStats;
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

  queueJump() {
    this.state.jumpBufferFrames = this.constants.JUMP_BUFFER_FRAMES;
  }

  executeJump(pressedKeys, touchingLeft, touchingRight) {
    // Normal Jump
    if (this.state.onGround || this.state.coyoteFrames > 0) {
      this.state.vy = this.constants.JUMP_FORCE;
      this.state.onGround = false;
      this.state.coyoteFrames = 0;
      this.state.jumpBufferFrames = 0;

      const impulse =
        this.stats.MAX_SPEED * this.constants.PLAYER.JUMP_IMPULSE_MULTIPLIER;
      if (this.isMovingLeft(pressedKeys)) {
        this.state.vx = Math.min(this.state.vx, 0);
        this.state.vx = Math.max(this.state.vx, -impulse);
      } else if (this.isMovingRight(pressedKeys)) {
        this.state.vx = Math.max(this.state.vx, 0);
        this.state.vx = Math.min(this.state.vx, impulse);
      }
    } 
    // Wall Jump with Cooldown Check
    else if ((touchingLeft || touchingRight) && this.state.wallJumpCooldown <= 0) {
      this.state.vy = this.constants.JUMP_FORCE;
      this.state.jumpBufferFrames = 0;
      
      // Set the cooldown (countdown)
      this.state.wallJumpCooldown = this.constants.PLAYER.WALL_JUMP_COOLDOWN_FRAMES || 25;
      
      const wallImpulse = this.constants.PLAYER.WALL_JUMP_IMPULSE_X || 8;
      
      if (touchingLeft) {
        this.state.vx = wallImpulse; // Jump Right
        this.state.rotationVelocity = this.constants.PLAYER.ROTATION_SPEED || 0.2;
      } else {
        this.state.vx = -wallImpulse; // Jump Left
        this.state.rotationVelocity = -(this.constants.PLAYER.ROTATION_SPEED || 0.2);
      }
    }
  }

  // Use player-specific input keys
  isMovingLeft(pressedKeys) {
    return this.playerData.inputs.left.some((code) => pressedKeys.has(code));
  }

  // Use player-specific input keys
  isMovingRight(pressedKeys) {
    return this.playerData.inputs.right.some((code) => pressedKeys.has(code));
  }

  update(pressedKeys) {
    if (this.isDead) {
      this.state.vx = 0;
      this.state.vy = 0;
      return;
    }

    // Decrement Wall Jump Cooldown
    if (this.state.wallJumpCooldown > 0) {
      this.state.wallJumpCooldown -= 1;
    }

    // Check for wall contacts (slightly padded check)
    const checkOffset = 2;
    const wallCheckHeight = this.state.height - 4; 
    const wallCheckY = this.state.y + 2;

    const touchingLeft = checkCollision(
      this.map,
      this.state.x - checkOffset,
      wallCheckY,
      this.state.width,
      wallCheckHeight,
      this.tileSize,
      this.mapOffsetY,
      this.constants
    );

    const touchingRight = checkCollision(
      this.map,
      this.state.x + checkOffset,
      wallCheckY,
      this.state.width,
      wallCheckHeight,
      this.tileSize,
      this.mapOffsetY,
      this.constants
    );

    if (this.state.jumpBufferFrames > 0) {
      this.executeJump(pressedKeys, touchingLeft, touchingRight);
    }

    const movingLeft = this.isMovingLeft(pressedKeys);
    const movingRight = this.isMovingRight(pressedKeys);

    if (movingLeft && !movingRight) {
      this.state.vx -= this.constants.PLAYER.SPEED;
    } else if (movingRight && !movingLeft) {
      this.state.vx += this.constants.PLAYER.SPEED;
    } else {
      this.state.vx *= this.constants.PLAYER.DECELERATION_FACTOR;
      if (Math.abs(this.state.vx) < this.constants.PLAYER.MIN_SPEED_THRESHOLD) {
        this.state.vx = 0;
      }
    }

    const maxSpeed = this.stats.MAX_SPEED;
    this.state.vx = Math.max(Math.min(this.state.vx, maxSpeed), -maxSpeed);

    this.state.vy += this.constants.GRAVITY;
    if (this.state.vy > this.constants.PLAYER.MAX_FALL_SPEED) {
      this.state.vy = this.constants.PLAYER.MAX_FALL_SPEED;
    }

    let nextX = this.state.x + this.state.vx;
    let nextY = this.state.y + this.state.vy;

    this.state.onGround = false;

    if (this.state.vx > 0) {
      if (
        checkCollision(
          this.map,
          nextX,
          this.state.y,
          this.state.width,
          this.state.height,
          this.tileSize,
          this.mapOffsetY,
          this.constants,
        )
      ) {
        nextX =
          Math.floor(
            (this.state.x + this.state.width + this.state.vx) / this.tileSize,
          ) *
            this.tileSize -
          this.state.width -
          this.constants.PLAYER.COLLISION_OFFSET;
        this.state.vx = 0;
      }
    } else if (this.state.vx < 0) {
      if (
        checkCollision(
          this.map,
          nextX,
          this.state.y,
          this.state.width,
          this.state.height,
          this.tileSize,
          this.mapOffsetY,
          this.constants,
        )
      ) {
        nextX =
          Math.floor(this.state.x / this.tileSize) * this.tileSize +
          this.constants.PLAYER.COLLISION_OFFSET;
        this.state.vx = 0;
      }
    }

    if (this.state.vy > 0) {
      if (
        checkCollision(
          this.map,
          nextX,
          nextY,
          this.state.width,
          this.state.height,
          this.tileSize,
          this.mapOffsetY,
          this.constants,
        )
      ) {
        nextY =
          Math.floor(
            (this.state.y +
              this.state.height +
              this.state.vy -
              this.mapOffsetY) /
              this.tileSize,
          ) *
            this.tileSize +
          this.mapOffsetY -
          this.state.height -
          this.constants.PLAYER.COLLISION_OFFSET;
        this.state.vy = 0;
        this.state.onGround = true;
        this.state.coyoteFrames = this.constants.COYOTE_FRAMES;
      }
    } else if (this.state.vy < 0) {
      if (
        checkCollision(
          this.map,
          nextX,
          nextY,
          this.state.width,
          this.state.height,
          this.tileSize,
          this.mapOffsetY,
          this.constants,
        )
      ) {
        nextY =
          Math.floor((this.state.y - this.mapOffsetY) / this.tileSize) *
            this.tileSize +
          this.mapOffsetY +
          this.constants.PLAYER.COLLISION_OFFSET;
        this.state.vy = 0;
      }
    }

    this.state.x = Math.max(
      this.constants.GENERAL.MIN_VERTICAL_OFFSET,
      Math.min(nextX, this.canvas.width - this.state.width),
    );
    this.state.y = Math.min(nextY, this.canvas.height - this.state.height);

    if (
      this.state.y >=
      this.canvas.height -
        this.state.height -
        this.constants.PLAYER.COLLISION_OFFSET
    ) {
      this.state.onGround = true;
      this.state.vy = 0;
      this.state.coyoteFrames = this.constants.COYOTE_FRAMES;
    }

    if (this.state.onGround) {
        this.state.rotation = 0;
        this.state.rotationVelocity = 0;
    } else {
        this.state.rotation += this.state.rotationVelocity;
    }

    if (!this.state.onGround && this.state.coyoteFrames > 0) {
      this.state.coyoteFrames -= 1;
    }

    if (this.state.jumpBufferFrames > 0) {
      this.state.jumpBufferFrames -= 1;
    }
  }

  triggerDamageFeedback(timestamp) {
    const now = this.getNow(timestamp);
    this.damageEffect.startAt = now;
    this.damageEffect.endAt = now + this.damageEffectDuration;
    this.damageEffect.splats = Array.from({ length: 6 }, () => ({
      offsetX:
        (Math.random() - 0.5) * this.state.width * (0.6 + Math.random() * 0.6),
      offsetY:
        (Math.random() - 0.5) * this.state.height * (0.3 + Math.random() * 0.7),
      radius: 2.5 + Math.random() * 6.5,
    }));
  }

  isDamageEffectActive() {
    return this.getNow() < this.damageEffect.endAt;
  }

  draw(ctx) {
    if (this.isDead) return;

    ctx.save();
    
    const centerX = this.state.x + this.state.width / 2;
    const centerY = this.state.y + this.state.height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate(this.state.rotation);
    ctx.translate(-centerX, -centerY);

    ctx.fillStyle = this.playerData.color;
    ctx.fillRect(
      this.state.x,
      this.state.y,
      this.state.width,
      this.state.height,
    );

    ctx.fillStyle = this.playerData.eyeColor;
    ctx.fillRect(
      this.state.x + this.state.width - this.constants.PLAYER.EYE_OFFSET_X,
      this.state.y + this.constants.PLAYER.EYE_OFFSET_Y,
      this.constants.PLAYER.EYE_SIZE,
      this.constants.PLAYER.EYE_SIZE,
    );
    
    ctx.restore();

    const now = this.getNow();
    const effectActive = now < this.damageEffect.endAt;
    if (!effectActive) {
      return;
    }

    const elapsed = now - this.damageEffect.startAt;
    const clampedElapsed = Math.min(
      Math.max(elapsed, 0),
      this.damageEffectDuration,
    );
    const progress = clampedElapsed / this.damageEffectDuration;
    const pulse = 0.4 + Math.sin(progress * Math.PI * 3) * 0.35;

    ctx.save();
    
    ctx.translate(centerX, centerY);
    ctx.rotate(this.state.rotation);
    ctx.translate(-centerX, -centerY);

    ctx.globalAlpha = 0.6 + pulse * 0.35;
    ctx.fillStyle =
      this.constants.PLAYER.DAMAGE_FLASH_COLOR || "rgba(255, 241, 118, 0.75)";
    ctx.fillRect(
      this.state.x - 2,
      this.state.y - 2,
      this.state.width + 4,
      this.state.height + 4,
    );
    
    ctx.lineWidth = 2.5 + (1 - progress) * 3.5;
    ctx.strokeStyle =
      this.constants.PLAYER.DAMAGE_OUTLINE_COLOR || "rgba(255, 82, 82, 0.9)";
    ctx.shadowColor = "rgba(255, 72, 72, 0.7)";
    ctx.shadowBlur = 14 + 18 * (1 - progress);
    ctx.strokeRect(
      this.state.x - 3,
      this.state.y - 3,
      this.state.width + 6,
      this.state.height + 6,
    );
    ctx.restore();

    const splatColor =
      this.constants.PLAYER.DAMAGE_SPLAT_COLOR || "rgba(255, 94, 94, 0.8)";
    const baseX = this.state.x + this.state.width / 2;
    const baseY = this.state.y + this.state.height / 2;
    const splatAlpha = Math.max(0, 1 - progress * 1.15);
    
    this.damageEffect.splats.forEach((splat, index) => {
      const wobble = Math.sin(progress * Math.PI * (2 + index)) * 3;
      const radius = Math.max(
        0,
        splat.radius * (1 - progress * 0.7) + wobble * 0.05,
      );
      if (radius <= 0) {
        return;
      }
      ctx.save();
      ctx.globalAlpha = splatAlpha;
      ctx.fillStyle = splatColor;
      ctx.beginPath();
      ctx.arc(
        baseX + splat.offsetX * (1 - progress * 0.35),
        baseY + splat.offsetY * (1 - progress * 0.45),
        radius,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    });
  }

  getBounds() {
    return {
      x: this.state.x,
      y: this.state.y,
      width: this.state.width,
      height: this.state.height,
    };
  }

  getCenter() {
    return {
      x: this.state.x + this.state.width / 2,
      y: this.state.y + this.state.height / 2,
    };
  }
}