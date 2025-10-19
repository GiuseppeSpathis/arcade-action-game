export class Bullet {
    constructor({ x, y, direction, speed, radius, color, fromEnemy = false }) {
        const magnitude = Math.hypot(direction.x, direction.y) || 1;
        this.position = { x, y };
        this.velocity = {
            x: (direction.x / magnitude) * speed,
            y: (direction.y / magnitude) * speed,
        };
        this.radius = radius;
        this.color = color;
        this.fromEnemy = fromEnemy;
        this.active = true;
    }

    update(deltaTime, canvas) {
        const dt = deltaTime || 0;
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        if (this.isOffscreen(canvas)) {
            this.active = false;
        }
    }

    draw(ctx) {
        if (!this.active) {
            return;
        }
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    isOffscreen(canvas) {
        return (
            this.position.x < -this.radius ||
            this.position.x > canvas.width + this.radius ||
            this.position.y < -this.radius ||
            this.position.y > canvas.height + this.radius
        );
    }

    intersectsRect({ x, y, width, height }) {
        const closestX = Math.max(x, Math.min(this.position.x, x + width));
        const closestY = Math.max(y, Math.min(this.position.y, y + height));
        const dx = this.position.x - closestX;
        const dy = this.position.y - closestY;
        return dx * dx + dy * dy <= this.radius * this.radius;
    }
}
