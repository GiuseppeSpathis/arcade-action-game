// Seek and destroy enemy
// This enemy ignores gravity and is killed by colliding with obstacles,
// uses seek and destroy behavior to chase the player.

import { checkCollision } from "../helper/map.js";

export class CircleEnemy {
  constructor(constants, canvas, mapData) {
    this.constants = constants.ENEMIES.CIRCLE;
    this.fullConstants = constants;
    this.map = mapData?.grid;
    this.tileSize = constants.TILE_SIZE;
    this.mapOffsetY = mapData?.verticalOffset;
    this.size = this.constants.SIZE;
    this.collisionOffset = constants.PLAYER.COLLISION_OFFSET;

    const platforms =
      mapData?.platforms.length > 0
        ? mapData?.platforms
        : [
            {
              row: mapData?.floorRow,
              colStart: 0,
              colEnd: mapData?.cols - 1,
            },
          ];
    const chosenPlatform =
      platforms[Math.floor(Math.random() * platforms.length)] || platforms[0];
    const minX = chosenPlatform.colStart * this.tileSize;
    const maxX =
      (chosenPlatform.colEnd + 1) * this.tileSize -
      this.size -
      this.collisionOffset;
    const spawnX = Math.min(
      Math.max(0, maxX),
      Math.max(
        Math.max(0, minX),
        minX + Math.random() * Math.max(1, maxX - minX),
      ),
    );
    const spawnY =
      this.mapOffsetY +
      chosenPlatform.row * this.tileSize -
      this.size -
      this.collisionOffset;

    this.state = {
      width: this.size,
      height: this.size,
      x: spawnX,
      y: spawnY,
      vx: 0,
      vy: 0,
    };

    this.active = true;
    this.isSpawning = false;
    this.deathAnimation = {
      active: false,
      startedAt: 0,
      duration: constants.ENEMIES.DEATH_ANIMATION_DURATION_MS ?? 320,
      fragments: [],
    };
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

  update(deltaTime, playerBounds, timestamp, canvas) {
    if (!this.active) {
      return;
    }

    if (this.deathAnimation.active) {
      const now = this.getNow(timestamp);
      if (now - this.deathAnimation.startedAt >= this.deathAnimation.duration) {
        this.active = false;
      }
      return;
    }

    // Seek and destroy logic
    const playerCenterX = playerBounds.x + playerBounds.width / 2;
    const playerCenterY = playerBounds.y + playerBounds.height / 2;
    const enemyCenterX = this.state.x + this.state.width / 2;
    const enemyCenterY = this.state.y + this.state.height / 2;

    // Calculate direction vector to player
    const dx = playerCenterX - enemyCenterX;
    const dy = playerCenterY - enemyCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;

    // Normalize direction
    const dirX = dx / distance;
    const dirY = dy / distance;

    // Accelerate towards player
    this.state.vx += dirX * this.constants.SEEK_ACCELERATION;
    this.state.vy += dirY * this.constants.SEEK_ACCELERATION;

    // Clamp speed
    const maxSpeed = this.constants.MAX_SPEED;
    const speed = Math.sqrt(
      this.state.vx * this.state.vx + this.state.vy * this.state.vy,
    );
    if (speed > maxSpeed) {
      this.state.vx = (this.state.vx / speed) * maxSpeed;
      this.state.vy = (this.state.vy / speed) * maxSpeed;
    }

    let nextX = this.state.x + this.state.vx;
    let nextY = this.state.y + this.state.vy;

    // Check collision with solid tiles (destroy self if collides)
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
      this.takeHit();
      return;
    }

    // Clamp to canvas bounds
    this.state.x = Math.max(
      0,
      Math.min(nextX, canvas.width - this.state.width),
    );
    this.state.y = Math.max(
      0,
      Math.min(nextY, canvas.height - this.state.height),
    );
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
    const centerX = this.state.x + this.state.width / 2;
    const centerY = this.state.y + this.state.height / 2;

    ctx.save();
    if (isDying) {
      const scale = 1 + progress * 0.35;
      ctx.globalAlpha = Math.max(0.05, 1 - progress);
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.translate(-centerX, -centerY);
      ctx.shadowColor = `rgba(255, 255, 255, ${0.5 * (1 - progress)})`;
      ctx.shadowBlur = 15 + 26 * (1 - progress);
    }
    ctx.fillStyle = this.constants.COLOR;
    ctx.beginPath();
    ctx.arc(centerX, centerY, this.state.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (isDying) {
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
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - progress)})`;
      ctx.lineWidth = 2 + progress * 4;
      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        this.state.width / 2 + 8 + progress * 16,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.65 * (1 - progress));
      ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * (1 - progress)})`;
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
        if (size <= 0) {
          return;
        }
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(fragment.angle * 0.5);
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      ctx.restore();
    }
  }

  getBounds() {
    return {
      x: this.state.x,
      y: this.state.y,
      width: this.state.width,
      height: this.state.height,
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
