// CircleEnemy
// Follows seek and destroy behavior with smooth turning
import { BaseEnemy } from "./baseEnemy.js";

export class CircleEnemy extends BaseEnemy {
  constructor(constants, canvas) {
    super(constants.ENEMIES, constants.ENEMIES.CIRCLE, canvas);

    this.velocity = { x: 0, y: 0 };
  }

  updateEnemy(deltaTime, playerBounds, timestamp, canvas) {
    const speed = this.constants.MOVE_SPEED;
    const verticalSpeed = this.constants.VERTICAL_ADJUST_SPEED;
    const TURN_RATE = this.constants.TURN_RATE;

    const playerCenterX = playerBounds.x + playerBounds.width / 2;
    const playerCenterY = playerBounds.y + playerBounds.height / 2;
    const enemyCenterX = this.position.x + this.width / 2;
    const enemyCenterY = this.position.y + this.height / 2;

    const dx = playerCenterX - enemyCenterX;
    const dy = playerCenterY - enemyCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    const desiredDir =
      distance > 0.01 ? { x: dx / distance, y: dy / distance } : { x: 0, y: 0 };

    const currentSpeed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
    const currentDir =
      currentSpeed > 0.01
        ? {
            x: this.velocity.x / currentSpeed,
            y: this.velocity.y / currentSpeed,
          }
        : desiredDir;

    const dot = currentDir.x * desiredDir.x + currentDir.y * desiredDir.y;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
    const maxTurn = TURN_RATE * deltaTime;

    let newDir = { ...currentDir };

    if (angle > 0.001) {
      const cross = currentDir.x * desiredDir.y - currentDir.y * desiredDir.x;
      const turnAngle = Math.min(angle, maxTurn);
      const sinTurn = Math.sin(turnAngle);
      const cosTurn = Math.cos(turnAngle);

      newDir =
        cross > 0
          ? {
              x: currentDir.x * cosTurn - currentDir.y * sinTurn,
              y: currentDir.x * sinTurn + currentDir.y * cosTurn,
            }
          : {
              x: currentDir.x * cosTurn + currentDir.y * sinTurn,
              y: -currentDir.x * sinTurn + currentDir.y * cosTurn,
            };
    }

    // Normalize newDir
    const ndLen = Math.sqrt(newDir.x * newDir.x + newDir.y * newDir.y);
    if (ndLen > 0.01) {
      newDir.x /= ndLen;
      newDir.y /= ndLen;
    }

    this.velocity.x = newDir.x * speed;
    this.velocity.y = newDir.y * verticalSpeed;

    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;

    this.position.x = Math.max(
      0,
      Math.min(canvas.width - this.width, this.position.x),
    );
    this.position.y = Math.max(
      0,
      Math.min(canvas.height - this.height, this.position.y),
    );
  }

  drawEnemy(ctx, progress) {
    const centerX = this.position.x + this.width / 2;
    const centerY = this.position.y + this.height / 2;

    ctx.save();
    if (this.deathAnimation.active) {
      const scale = 1 + progress * 0.4;
      ctx.globalAlpha = Math.max(0.05, 1 - progress);
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.rotate(this.deathSpinDirection * progress * Math.PI * 0.35);
      ctx.translate(-centerX, -centerY);
    }

    ctx.fillStyle = this.constants.COLOR;
    ctx.beginPath();
    ctx.arc(
      centerX,
      centerY,
      Math.min(this.width, this.height) / 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    ctx.restore();

    // Death fragments (unchanged)
    if (this.deathAnimation.active) {
      this.drawDeathEffects(ctx, centerX, centerY, progress);
    }
  }

  drawDeathEffects(ctx, centerX, centerY, progress) {
    const ringRadius =
      Math.max(this.width, this.height) * (0.45 + progress * 0.9);

    ctx.save();
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

      ctx.beginPath();
      ctx.moveTo(
        centerX + Math.cos(fragment.angle) * startRadius,
        centerY + Math.sin(fragment.angle) * startRadius,
      );
      ctx.lineTo(
        centerX + Math.cos(fragment.angle) * endRadius,
        centerY + Math.sin(fragment.angle) * endRadius,
      );
      ctx.stroke();
    });

    ctx.restore();
  }
}
