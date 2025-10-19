export class SquareEnemy {
    constructor(constants, canvas) {
        this.constants = constants.ENEMIES.SQUARE;
        this.globalConstants = constants.ENEMIES;
        this.size = this.constants.SIZE;
        this.position = {
            x: Math.random() * Math.max(1, canvas.width - this.size),
            y: -this.size,
        };
        const minTarget = this.size * 1.1;
        const maxTarget = Math.min(canvas.height * 0.45, minTarget + this.size * 2.5);
        const availableRange = Math.max(this.size * 0.5, maxTarget - minTarget);
        this.targetY = Math.min(
            canvas.height - this.size,
            minTarget + Math.random() * availableRange
        );
        this.isSpawning = true;
        this.active = true;
    }

    update(deltaTime, playerBounds, canvas) {
        if (!this.active) {
            return;
        }

        if (this.isSpawning) {
            this.position.y += this.globalConstants.SPAWN_DESCENT_SPEED * deltaTime;
            if (this.position.y >= this.targetY) {
                this.position.y = this.targetY;
                this.isSpawning = false;
            }
            return;
        }

        const playerCenterX = playerBounds.x + playerBounds.width / 2;
        const playerCenterY = playerBounds.y + playerBounds.height / 2;
        const enemyCenterX = this.position.x + this.size / 2;
        const enemyCenterY = this.position.y + this.size / 2;

        const dx = playerCenterX - enemyCenterX;
        const dy = playerCenterY - enemyCenterY;
        const distance = Math.hypot(dx, dy) || 1;
        const velocityX = (dx / distance) * this.constants.SPEED * deltaTime;
        const velocityY = (dy / distance) * this.constants.SPEED * deltaTime;

        this.position.x += velocityX;
        this.position.y += velocityY;

        this.position.x = Math.max(0, Math.min(canvas.width - this.size, this.position.x));
        this.position.y = Math.max(0, Math.min(canvas.height - this.size, this.position.y));
    }

    draw(ctx) {
        if (!this.active) {
            return;
        }
        ctx.fillStyle = this.constants.COLOR;
        ctx.fillRect(this.position.x, this.position.y, this.size, this.size);
    }

    getBounds() {
        return {
            x: this.position.x,
            y: this.position.y,
            width: this.size,
            height: this.size,
        };
    }

    takeHit() {
        this.active = false;
    }
}
