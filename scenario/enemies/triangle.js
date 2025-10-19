import { Bullet } from "../helper/bullet.js";

export class TriangleEnemy {
    constructor(constants, canvas) {
        this.constants = constants.ENEMIES.TRIANGLE;
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
            minTarget + this.height * 2.5
        );
        const availableRange = Math.max(this.height * 0.5, maxTarget - minTarget);
        this.targetY = Math.min(
            canvas.height - this.height,
            minTarget + Math.random() * availableRange
        );
        this.isSpawning = true;
        this.facing = 1;
        this.lastShotAt = 0;
        this.active = true;
    }

    update(deltaTime, playerBounds, timestamp, canvas) {
        if (!this.active) {
            return null;
        }

        if (this.isSpawning) {
            this.position.y += this.globalConstants.SPAWN_DESCENT_SPEED * deltaTime;
            if (this.position.y >= this.targetY) {
                this.position.y = this.targetY;
                this.isSpawning = false;
            }
            return null;
        }

        const playerCenterX = playerBounds.x + playerBounds.width / 2;
        const playerCenterY = playerBounds.y + playerBounds.height / 2;
        const enemyCenterX = this.position.x + this.width / 2;
        const enemyCenterY = this.position.y + this.height / 2;

        if (playerCenterX > enemyCenterX + 4) {
            this.position.x += this.constants.MOVE_SPEED * deltaTime;
            this.facing = 1;
        } else if (playerCenterX < enemyCenterX - 4) {
            this.position.x -= this.constants.MOVE_SPEED * deltaTime;
            this.facing = -1;
        }

        if (playerCenterY > enemyCenterY + 6) {
            this.position.y += this.constants.VERTICAL_ADJUST_SPEED * deltaTime;
        } else if (playerCenterY < enemyCenterY - 6) {
            this.position.y -= this.constants.VERTICAL_ADJUST_SPEED * deltaTime;
        }

        this.position.x = Math.max(
            0,
            Math.min(canvas.width - this.width, this.position.x)
        );
        this.position.y = Math.max(
            0,
            Math.min(canvas.height - this.height, this.position.y)
        );

        const sameLayer = Math.abs(playerCenterY - (this.position.y + this.height / 2)) < this.height / 2;
        if (
            sameLayer &&
            timestamp - this.lastShotAt >= this.constants.FIRE_COOLDOWN_MS
        ) {
            this.lastShotAt = timestamp;
            return this.fireBullet();
        }

        return null;
    }

    fireBullet() {
        const originX =
            this.position.x +
            (this.facing > 0
                ? this.width + this.constants.BULLET_RADIUS
                : -this.constants.BULLET_RADIUS);
        const originY = this.position.y + this.height / 2;

        return new Bullet({
            x: originX,
            y: originY,
            direction: { x: this.facing, y: 0 },
            speed: this.constants.BULLET_SPEED,
            radius: this.constants.BULLET_RADIUS,
            color: this.constants.BULLET_COLOR,
            fromEnemy: true,
        });
    }

    draw(ctx) {
        if (!this.active) {
            return;
        }

        ctx.fillStyle = this.constants.COLOR;
        ctx.beginPath();
        if (this.facing >= 0) {
            ctx.moveTo(this.position.x, this.position.y);
            ctx.lineTo(this.position.x, this.position.y + this.height);
            ctx.lineTo(
                this.position.x + this.width,
                this.position.y + this.height / 2
            );
        } else {
            ctx.moveTo(this.position.x + this.width, this.position.y);
            ctx.lineTo(
                this.position.x + this.width,
                this.position.y + this.height
            );
            ctx.lineTo(this.position.x, this.position.y + this.height / 2);
        }
        ctx.closePath();
        ctx.fill();
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
        this.active = false;
    }
}
