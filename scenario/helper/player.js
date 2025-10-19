import { checkCollision } from "./map.js";

export class PlayerController {
    constructor(constants, mapData, canvas) {
        this.constants = constants;
        this.canvas = canvas;
        this.map = mapData.grid;
        this.tileSize = constants.TILE_SIZE;
        this.mapOffsetY = mapData.verticalOffset;

        const spawnCol = Math.floor(
            mapData.cols / constants.MAP.FALLBACK_PLATFORM_DIVISOR
        );
        const spawnRow = mapData.floorRow;
        const horizontalPadding =
            (this.tileSize - constants.PLAYER.WIDTH) /
            constants.PLAYER.SPAWN_HORIZONTAL_DIVISOR;

        this.state = {
            width: constants.PLAYER.WIDTH,
            height: constants.PLAYER.HEIGHT,
            x: spawnCol * this.tileSize + horizontalPadding,
            y:
                this.mapOffsetY +
                spawnRow * this.tileSize -
                constants.PLAYER.HEIGHT -
                constants.PLAYER.COLLISION_OFFSET,
            vx: 0,
            vy: 0,
            onGround: true,
            coyoteFrames: 0,
            jumpBufferFrames: 0,
        };
    }

    queueJump() {
        this.state.jumpBufferFrames = this.constants.JUMP_BUFFER_FRAMES;
    }

    executeJump(pressedKeys) {
        this.state.vy = this.constants.JUMP_FORCE;
        this.state.onGround = false;
        this.state.coyoteFrames = 0;
        this.state.jumpBufferFrames = 0;

        const impulse =
            this.constants.PLAYER.MAX_SPEED *
            this.constants.PLAYER.JUMP_IMPULSE_MULTIPLIER;
        if (this.isMovingLeft(pressedKeys)) {
            this.state.vx = Math.min(this.state.vx, 0);
            this.state.vx = Math.max(this.state.vx, -impulse);
        } else if (this.isMovingRight(pressedKeys)) {
            this.state.vx = Math.max(this.state.vx, 0);
            this.state.vx = Math.min(this.state.vx, impulse);
        }
    }

    isMovingLeft(pressedKeys) {
        return this.constants.INPUT.MOVE_LEFT_KEYS.some((code) =>
            pressedKeys.has(code)
        );
    }

    isMovingRight(pressedKeys) {
        return this.constants.INPUT.MOVE_RIGHT_KEYS.some((code) =>
            pressedKeys.has(code)
        );
    }

    update(pressedKeys) {
        if (
            (this.state.onGround || this.state.coyoteFrames > 0) &&
            this.state.jumpBufferFrames > 0
        ) {
            this.executeJump(pressedKeys);
        }

        const movingLeft = this.isMovingLeft(pressedKeys);
        const movingRight = this.isMovingRight(pressedKeys);

        if (movingLeft && !movingRight) {
            this.state.vx -= this.constants.PLAYER.SPEED;
        } else if (movingRight && !movingLeft) {
            this.state.vx += this.constants.PLAYER.SPEED;
        } else {
            this.state.vx *= this.constants.PLAYER.DECELERATION_FACTOR;
            if (
                Math.abs(this.state.vx) <
                this.constants.PLAYER.MIN_SPEED_THRESHOLD
            ) {
                this.state.vx = 0;
            }
        }

        const maxSpeed = this.constants.PLAYER.MAX_SPEED;
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
                    this.constants
                )
            ) {
                nextX =
                    Math.floor(
                        (this.state.x + this.state.width + this.state.vx) /
                            this.tileSize
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
                    this.constants
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
                    this.constants
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
                    this.constants
                )
            ) {
                nextY =
                    Math.floor(
                        (this.state.y - this.mapOffsetY) / this.tileSize
                    ) *
                        this.tileSize +
                    this.mapOffsetY +
                    this.constants.PLAYER.COLLISION_OFFSET;
                this.state.vy = 0;
            }
        }

        this.state.x = Math.max(
            this.constants.GENERAL.MIN_VERTICAL_OFFSET,
            Math.min(nextX, this.canvas.width - this.state.width)
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

        if (
            (this.state.onGround || this.state.coyoteFrames > 0) &&
            this.state.jumpBufferFrames > 0
        ) {
            this.executeJump(pressedKeys);
        }

        if (!this.state.onGround && this.state.coyoteFrames > 0) {
            this.state.coyoteFrames -= 1;
        }

        if (this.state.jumpBufferFrames > 0) {
            this.state.jumpBufferFrames -= 1;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.constants.PLAYER.BODY_COLOR;
        ctx.fillRect(
            this.state.x,
            this.state.y,
            this.state.width,
            this.state.height
        );

        ctx.fillStyle = this.constants.PLAYER.EYE_COLOR;
        ctx.fillRect(
            this.state.x +
                this.state.width -
                this.constants.PLAYER.EYE_OFFSET_X,
            this.state.y + this.constants.PLAYER.EYE_OFFSET_Y,
            this.constants.PLAYER.EYE_SIZE,
            this.constants.PLAYER.EYE_SIZE
        );
    }
}
