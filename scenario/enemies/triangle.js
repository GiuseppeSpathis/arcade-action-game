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

        const now = this.getNow();
        const isDying = this.deathAnimation.active;
        const progress = isDying
            ? Math.min(
                  1,
                  Math.max(
                      0,
                      (now - this.deathAnimation.startedAt) /
                          this.deathAnimation.duration
                  )
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
                this.deathAnimation.fragments = Array.from(
                    { length: 6 },
                    () => ({
                        angle: Math.random() * Math.PI * 2,
                        speed: 14 + Math.random() * 18,
                    })
                );
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
