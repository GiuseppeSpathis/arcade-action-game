import { checkCollision, isSolidTile } from "../helper/map.js";

export class SquareEnemy {
    constructor(constants, canvas, mapData) {
        this.constants = constants.ENEMIES.SQUARE;
        this.fullConstants = constants;
        this.map = mapData.grid;
        this.tileSize = constants.TILE_SIZE;
        this.mapOffsetY = mapData.verticalOffset;
        this.size = this.constants.SIZE;
        this.collisionOffset = constants.PLAYER.COLLISION_OFFSET;

        const platforms = mapData.platforms.length > 0 ? mapData.platforms : [
            {
                row: mapData.floorRow,
                colStart: 0,
                colEnd: mapData.cols - 1,
            },
        ];
        const chosenPlatform =
            platforms[Math.floor(Math.random() * platforms.length)] || platforms[0];
        const minX = chosenPlatform.colStart * this.tileSize;
        const maxX =
            (chosenPlatform.colEnd + 1) * this.tileSize - this.size - this.collisionOffset;
        const spawnX = Math.min(
            Math.max(0, maxX),
            Math.max(
                Math.max(0, minX),
                minX + Math.random() * Math.max(1, maxX - minX)
            )
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
            onGround: true,
        };

        this.active = true;
        this.isSpawning = false;
        this.lastJumpAt = -Infinity;
    }

    update(deltaTime, playerBounds, timestamp, canvas) {
        if (!this.active) {
            return;
        }

        const now = typeof timestamp === "number" ? timestamp : performance.now();

        const playerCenterX = playerBounds.x + playerBounds.width / 2;
        const enemyCenterX = this.state.x + this.state.width / 2;
        const horizontalDirection =
            playerCenterX > enemyCenterX + 4
                ? 1
                : playerCenterX < enemyCenterX - 4
                ? -1
                : 0;

        if (horizontalDirection !== 0) {
            this.state.vx +=
                horizontalDirection * this.constants.MOVE_ACCELERATION;
        } else {
            this.state.vx *= this.constants.DECELERATION_FACTOR;
            if (Math.abs(this.state.vx) < this.constants.MIN_SPEED_THRESHOLD) {
                this.state.vx = 0;
            }
        }

        const maxSpeed = this.constants.MAX_SPEED;
        this.state.vx = Math.max(Math.min(this.state.vx, maxSpeed), -maxSpeed);

        if (
            this.state.onGround &&
            now - this.lastJumpAt >= this.constants.JUMP_COOLDOWN_MS &&
            this.shouldAttemptJump(horizontalDirection, playerBounds)
        ) {
            this.performJump(now);
        }

        this.state.vy += this.fullConstants.GRAVITY;
        if (this.state.vy > this.constants.MAX_FALL_SPEED) {
            this.state.vy = this.constants.MAX_FALL_SPEED;
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
                    this.fullConstants
                )
            ) {
                nextX =
                    Math.floor(
                        (this.state.x + this.state.width + this.state.vx) / this.tileSize
                    ) *
                        this.tileSize -
                    this.state.width -
                    this.collisionOffset;
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
                    this.fullConstants
                )
            ) {
                nextX =
                    Math.floor(this.state.x / this.tileSize) * this.tileSize +
                    this.collisionOffset;
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
                    this.fullConstants
                )
            ) {
                nextY =
                    Math.floor(
                        (this.state.y +
                            this.state.height +
                            this.state.vy -
                            this.mapOffsetY) /
                            this.tileSize
                    ) *
                        this.tileSize +
                    this.mapOffsetY -
                    this.state.height -
                    this.collisionOffset;
                this.state.vy = 0;
                this.state.onGround = true;
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
                    this.fullConstants
                )
            ) {
                nextY =
                    Math.floor(
                        (this.state.y - this.mapOffsetY) / this.tileSize
                    ) *
                        this.tileSize +
                    this.mapOffsetY +
                    this.collisionOffset;
                this.state.vy = 0;
            }
        }

        this.state.x = Math.max(0, Math.min(nextX, canvas.width - this.state.width));
        this.state.y = Math.min(nextY, canvas.height - this.state.height);

        if (
            this.state.y >=
            canvas.height - this.state.height - this.collisionOffset
        ) {
            this.state.onGround = true;
            this.state.vy = 0;
        }

        if (this.state.y + this.state.height + this.collisionOffset >= canvas.height) {
            const groundCheck = this.state.y + this.state.height + this.collisionOffset;
            if (groundCheck >= canvas.height) {
                this.state.y =
                    canvas.height - this.state.height - this.collisionOffset;
            }
        }
    }

    performJump(timestamp) {
        this.state.vy = this.constants.JUMP_FORCE;
        this.state.onGround = false;
        this.lastJumpAt = timestamp;
    }

    shouldAttemptJump(direction, playerBounds) {
        if (direction === 0) {
            return false;
        }

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

    draw(ctx) {
        if (!this.active) {
            return;
        }
        ctx.fillStyle = this.constants.COLOR;
        ctx.fillRect(
            this.state.x,
            this.state.y,
            this.state.width,
            this.state.height
        );
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
        this.active = false;
    }
}
