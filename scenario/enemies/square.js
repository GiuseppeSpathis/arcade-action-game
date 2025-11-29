// SquareEnemy.js
import { BaseEnemy } from "./baseEnemy.js";
import { checkCollision, isSolidTile } from "../helper/map.js";

export class SquareEnemy extends BaseEnemy {
  constructor(constants, canvas, mapData, fullConstants) {
    super(constants.ENEMIES, constants.ENEMIES.SQUARE, canvas);

    this.fullConstants = fullConstants;
    this.map = mapData.grid;
    this.tileSize = fullConstants.TILE_SIZE;
    this.mapOffsetY = mapData.verticalOffset;
    this.collisionOffset = fullConstants.ENEMIES.SQUARE.COLLISION_OFFSET;

    this.size = this.constants.SIZE;

    const platforms = mapData.platforms.length
      ? mapData.platforms
      : [{ row: mapData.floorRow, colStart: 0, colEnd: mapData.cols - 1 }];

    const chosen = platforms[Math.floor(Math.random() * platforms.length)];

    const minX = chosen.colStart * this.tileSize;
    const maxX =
      (chosen.colEnd + 1) * this.tileSize - this.size - this.collisionOffset;
    const spawnX = Math.min(
      Math.max(minX, minX + Math.random() * Math.max(1, maxX - minX)),
      maxX,
    );

    const spawnY =
      this.mapOffsetY +
      chosen.row * this.tileSize -
      this.size -
      this.collisionOffset;

    this.state = {
      x: spawnX,
      y: spawnY,
      width: this.size,
      height: this.size,
      vx: 0,
      vy: 0,
      onGround: true,
    };

    // Initialize BaseEnemy position to match spawn
    this.position.x = spawnX;
    this.position.y = spawnY;

    this.lastJumpAt = -Infinity;
    this.isSpawning = false; // Square enemies spawn directly onto terrain
  }

  updateEnemy(deltaTime, playerBounds, timestamp, canvas) {
    const now = this.getNow(timestamp);

    const playerCenterX = playerBounds.x + playerBounds.width / 2;
    const enemyCenterX = this.state.x + this.state.width / 2;

    const horizontalDirection =
      playerCenterX > enemyCenterX + 4
        ? 1
        : playerCenterX < enemyCenterX - 4
          ? -1
          : 0;

    // Horizontal acceleration
    if (horizontalDirection !== 0) {
      this.state.vx += horizontalDirection * this.constants.MOVE_ACCELERATION;
    } else {
      this.state.vx *= this.constants.DECELERATION_FACTOR;
      if (Math.abs(this.state.vx) < this.constants.MIN_SPEED_THRESHOLD)
        this.state.vx = 0;
    }

    // Clamp max speed
    this.state.vx = Math.max(
      -this.constants.MAX_SPEED,
      Math.min(this.state.vx, this.constants.MAX_SPEED),
    );

    // Jump logic
    if (
      this.state.onGround &&
      now - this.lastJumpAt >= this.constants.JUMP_COOLDOWN_MS &&
      this.shouldAttemptJump(horizontalDirection, playerBounds)
    ) {
      this.performJump(now);
    }

    // Gravity
    this.state.vy += this.fullConstants.GRAVITY;
    if (this.state.vy > this.constants.MAX_FALL_SPEED) {
      this.state.vy = this.constants.MAX_FALL_SPEED;
    }

    let nextX = this.state.x + this.state.vx;
    let nextY = this.state.y + this.state.vy;

    this.state.onGround = false;

    // Collide X
    if (
      checkCollision(
        this.map,
        nextX,
        this.state.y,
        this.state.width,
        this.state.height,
        this.tileSize,
        this.mapOffsetY,
        this.fullConstants,
      )
    ) {
      if (this.state.vx > 0) {
        nextX =
          Math.floor(
            (this.state.x + this.state.width + this.state.vx) / this.tileSize,
          ) *
            this.tileSize -
          this.state.width -
          this.collisionOffset;
      } else {
        nextX =
          Math.floor(this.state.x / this.tileSize) * this.tileSize +
          this.collisionOffset;
      }
      this.state.vx = 0;
    }

    // Collide Y
    if (
      checkCollision(
        this.map,
        nextX,
        nextY,
        this.state.width,
        this.state.height,
        this.tileSize,
        this.mapOffsetY,
        this.fullConstants,
      )
    ) {
      if (this.state.vy > 0) {
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
          this.collisionOffset;
        this.state.onGround = true;
      } else {
        nextY =
          Math.floor((this.state.y - this.mapOffsetY) / this.tileSize) *
            this.tileSize +
          this.mapOffsetY +
          this.collisionOffset;
      }
      this.state.vy = 0;
    }

    this.state.x = Math.max(
      0,
      Math.min(nextX, canvas.width - this.state.width),
    );
    this.state.y = Math.min(nextY, canvas.height - this.state.height);

    if (
      this.state.y + this.state.height + this.collisionOffset >=
      canvas.height
    ) {
      this.state.onGround = true;
      this.state.vy = 0;
      this.state.y = canvas.height - this.state.height - this.collisionOffset;
    }

    // Sync BaseEnemy position so shared effects (health bar, hit flash) follow the square ---
    this.position.x = this.state.x;
    this.position.y = this.state.y;
  }

  updateStats(newStats) {
    super.updateStats(newStats.ENEMIES, newStats.ENEMIES.SQUARE);
  }

  shouldAttemptJump(direction, playerBounds) {
    if (direction === 0) return false;

    const frontX =
      direction > 0
        ? this.state.x + this.state.width + this.collisionOffset
        : this.state.x - this.collisionOffset;

    const midY = this.state.y + this.state.height / 2;
    const footY = this.state.y + this.state.height + this.collisionOffset;
    const gapCheckY = footY + this.tileSize * 0.25;

    const obstacleAhead =
      this.isSolidAt(frontX, midY) || this.isSolidAt(frontX, footY - 1);
    const gapAhead = !this.isSolidAt(frontX, gapCheckY);

    const playerHigher =
      playerBounds.y + playerBounds.height <
      this.state.y + this.state.height - this.tileSize * 0.5;

    return obstacleAhead || gapAhead || playerHigher;
  }

  isSolidAt(x, y) {
    const col = Math.floor(x / this.tileSize);
    const row = Math.floor((y - this.mapOffsetY) / this.tileSize);
    return isSolidTile(this.map, row, col, this.fullConstants);
  }

  performJump(timestamp) {
    this.state.vy = this.constants.JUMP_FORCE;
    this.state.onGround = false;
    this.lastJumpAt = timestamp;
  }

  drawEnemy(ctx, progress) {
    const x = this.state.x;
    const y = this.state.y;
    const w = this.state.width;
    const h = this.state.height;

    const centerX = x + w / 2;
    const centerY = y + h / 2;

    ctx.save();
    if (this.deathAnimation.active) {
      const scale = 1 + progress * 0.35;
      ctx.globalAlpha = Math.max(0.05, 1 - progress);
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.translate(-centerX, -centerY);
    }

    ctx.fillStyle = this.constants.COLOR;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    
    // Call super to draw hit flash and health bar
    super.drawEnemy(ctx, progress);

    if (this.deathAnimation.active) {
      this.drawDeathEffects(ctx, centerX, centerY, progress);
    }
  }

  drawDeathEffects(ctx, centerX, centerY, progress) {
    if (!this.deathAnimation.fragments.length) {
      this.deathAnimation.fragments = Array.from({ length: 8 }, () => ({
        offsetX: (Math.random() - 0.5) * this.state.width,
        offsetY: (Math.random() - 0.5) * this.state.height,
        size: Math.max(4, this.state.width * (0.1 + Math.random() * 0.15)),
        angle: Math.random() * Math.PI * 2,
      }));
    }

    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.55 * (1 - progress));
    ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - progress)})`;
    ctx.lineWidth = 2 + progress * 4;

    ctx.strokeRect(
      this.state.x - 4 - progress * 8,
      this.state.y - 4 - progress * 8,
      this.state.width + 8 + progress * 16,
      this.state.height + 8 + progress * 16,
    );

    ctx.restore();

    ctx.save();
    ctx.globalAlpha = Math.max(0, 0.65 * (1 - progress));
    ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - progress)})`;

    this.deathAnimation.fragments.forEach((fragment) => {
      const travel = progress * 24;
      const x =
        centerX +
        fragment.offsetX * (1 + progress * 0.3) +
        Math.cos(fragment.angle) * travel;
      const y =
        centerY +
        fragment.offsetY * (1 + progress * 0.3) +
        Math.sin(fragment.angle) * travel;

      const size = fragment.size * (1 - progress * 0.6);
      if (size <= 0) return;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(fragment.angle * 0.5);
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.restore();
    });

    ctx.restore();
    super.drawEnemy(ctx, progress);
  }

  getBounds() {
    return {
      x: this.state.x,
      y: this.state.y,
      width: this.state.width,
      height: this.state.height,
    };
  }
}