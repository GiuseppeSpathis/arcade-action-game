import { checkCollision, isSolidTile } from "../helper/map.js";

export class SquareEnemy {
    constructor(constants, canvas, mapData) {
        this.constants = constants.ENEMIES.SQUARE;
        this.fullConstants = constants;
        this.map = mapData?.grid;
        this.tileSize = constants.TILE_SIZE;
        this.mapOffsetY = mapData?.verticalOffset;
        this.size = this.constants.SIZE;
        this.collisionOffset = constants.PLAYER.COLLISION_OFFSET;

        const platforms = mapData?.platforms.length > 0 ? mapData?.platforms : [
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
        this.deathAnimation = {
            active: false,
            startedAt: 0,
            duration: constants.ENEMIES.DEATH_ANIMATION_DURATION_MS ?? 320,
            fragments: [],
        };

        this.mapRows = this.map?.length ?? 0;
        this.mapCols = this.mapRows > 0 ? this.map[0].length : 0;
        this.pathPoints = [];
        this.currentWaypointIndex = 0;
        this.lastPathUpdate = 0;
        this.lastTargetNodeKey = null;
        this.pathUpdateIntervalMs = 180;
        this.maxJumpTiles = Math.max(
            1,
            Math.ceil(
                (Math.abs(this.constants.JUMP_FORCE) **
                    (this.fullConstants.GENERAL?.SQUARE_EXPONENT ?? 2)) /
                    Math.max(
                        1,
                        (this.fullConstants.GENERAL?.GRAVITY_DIVISOR ?? 2) *
                            this.fullConstants.GRAVITY
                    ) /
                    this.tileSize
            )
        );
        this.maxJumpHorizontalTiles = Math.max(1, Math.ceil(this.maxJumpTiles / 2));
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

        const now = this.getNow(timestamp);

        const enemyCenterX = this.state.x + this.state.width / 2;
        let horizontalDirection = 0;

        const waypoint = this.getCurrentWaypoint(playerBounds, now);
        if (waypoint) {
            const targetCenterX = waypoint.x;
            const horizontalDelta = targetCenterX - enemyCenterX;
            if (Math.abs(horizontalDelta) > 2) {
                horizontalDirection = horizontalDelta > 0 ? 1 : -1;
            }
        } else {
            const playerCenterX = playerBounds.x + playerBounds.width / 2;
            const horizontalDelta = playerCenterX - enemyCenterX;
            if (Math.abs(horizontalDelta) > 4) {
                horizontalDirection = horizontalDelta > 0 ? 1 : -1;
            }
        }

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
            this.shouldAttemptJump(horizontalDirection, playerBounds, waypoint)
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
                this.chooseRandomHorizontalDirection();
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
                this.chooseRandomHorizontalDirection();
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

    shouldAttemptJump(direction, playerBounds, waypoint) {
        const playerHigher =
            playerBounds.y + playerBounds.height <
            this.state.y + this.state.height - this.tileSize * 0.5;
        const targetAbove =
            waypoint &&
            waypoint.y <
                this.state.y + this.state.height + this.collisionOffset -
                    this.tileSize * 0.5;

        if (direction === 0) {
            if (!playerHigher && !targetAbove) {
                return false;
            }
            const headX = this.state.x + this.state.width / 2;
            const headY = this.state.y - this.tileSize * 0.1;
            return !this.isSolidAt(headX, headY);
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

        return obstacleAhead || gapAhead || playerHigher || targetAbove;
    }

    chooseRandomHorizontalDirection() {
        const randomDirection = Math.random() < 0.5 ? -1 : 1;
        const horizontalSpeed =
            Math.max(
                this.constants.MAX_SPEED * 0.6,
                Math.abs(this.state.vx)
            ) || this.constants.MAX_SPEED * 0.6;
        this.state.vx = randomDirection * horizontalSpeed;
    }

    getCurrentWaypoint(playerBounds, timestamp) {
        if (!this.map || !this.mapRows || !this.mapCols) {
            return null;
        }

        const targetNode = this.getNodeForBounds(playerBounds);
        const targetKey = targetNode ? this.nodeKey(targetNode) : null;

        const needRecalc =
            !this.pathPoints.length ||
            this.currentWaypointIndex >= this.pathPoints.length ||
            !targetKey ||
            this.lastTargetNodeKey !== targetKey ||
            timestamp - this.lastPathUpdate > this.pathUpdateIntervalMs;

        if (needRecalc) {
            this.recalculatePath(targetNode, timestamp);
        }

        if (!this.pathPoints.length || this.currentWaypointIndex >= this.pathPoints.length) {
            return null;
        }

        const waypoint = this.pathPoints[this.currentWaypointIndex];
        const enemyCenterX = this.state.x + this.state.width / 2;
        const enemyFeetY = this.state.y + this.state.height + this.collisionOffset;

        if (
            Math.abs(enemyCenterX - waypoint.x) < Math.max(4, this.state.width * 0.35) &&
            Math.abs(enemyFeetY - waypoint.y) < this.tileSize * 1.1
        ) {
            this.currentWaypointIndex += 1;
            if (this.currentWaypointIndex >= this.pathPoints.length) {
                return null;
            }
            return this.pathPoints[this.currentWaypointIndex];
        }

        return waypoint;
    }

    recalculatePath(targetNode, timestamp) {
        this.lastPathUpdate = timestamp;
        if (!targetNode) {
            this.pathPoints = [];
            this.currentWaypointIndex = 0;
            this.lastTargetNodeKey = null;
            return;
        }

        const startNode = this.getNodeForEnemy();
        if (!startNode) {
            this.pathPoints = [];
            this.currentWaypointIndex = 0;
            this.lastTargetNodeKey = this.nodeKey(targetNode);
            return;
        }

        const pathNodes = this.findPath(startNode, targetNode);
        if (!pathNodes || pathNodes.length < 2) {
            this.pathPoints = [];
            this.currentWaypointIndex = 0;
            this.lastTargetNodeKey = this.nodeKey(targetNode);
            return;
        }

        this.pathPoints = pathNodes.slice(1).map((node) => this.nodeToWorld(node));
        this.currentWaypointIndex = 0;
        this.lastTargetNodeKey = this.nodeKey(targetNode);
    }

    getNodeForEnemy() {
        const centerX = this.state.x + this.state.width / 2;
        const feetY = this.state.y + this.state.height + this.collisionOffset;
        return this.getNodeAtWorldPosition(centerX, feetY);
    }

    getNodeForBounds(bounds) {
        if (!bounds) {
            return null;
        }
        const centerX = bounds.x + bounds.width / 2;
        const feetY = bounds.y + bounds.height;
        return this.getNodeAtWorldPosition(centerX, feetY);
    }

    getNodeAtWorldPosition(centerX, feetY) {
        if (!this.map || !this.mapRows || !this.mapCols) {
            return null;
        }

        const col = Math.floor(centerX / this.tileSize);
        let row = Math.floor((feetY - this.mapOffsetY) / this.tileSize) - 1;
        if (row < 0) {
            row = 0;
        }

        if (!this.isWithinBounds(row, col)) {
            return null;
        }

        const direct = this.findNearestWalkable(row, col, this.mapRows);
        if (!direct) {
            return null;
        }
        return direct;
    }

    nodeToWorld(node) {
        const centerX = node.col * this.tileSize + this.tileSize / 2;
        const feetY =
            this.mapOffsetY + (node.row + 1) * this.tileSize - this.collisionOffset;
        return { x: centerX, y: feetY };
    }

    nodeKey(node) {
        return `${node.row}:${node.col}`;
    }

    isWithinBounds(row, col) {
        if (col < 0 || col >= this.mapCols) {
            return false;
        }
        if (row < 0 || row >= this.mapRows - 1) {
            return false;
        }
        return true;
    }

    isSolidCell(row, col) {
        if (col < 0 || col >= this.mapCols) {
            return true;
        }
        if (row < 0) {
            return false;
        }
        if (row >= this.mapRows) {
            return true;
        }
        return this.map[row][col] === this.fullConstants.MAP.SOLID_TILE_VALUE;
    }

    isWalkable(row, col) {
        if (!this.isWithinBounds(row, col)) {
            return false;
        }
        if (this.isSolidCell(row, col)) {
            return false;
        }
        return this.isSolidCell(row + 1, col);
    }

    findNearestWalkable(startRow, col, maxSearch = 4) {
        let depth = 0;
        for (let row = startRow; row < this.mapRows - 1 && depth <= maxSearch; row += 1) {
            if (this.isWalkable(row, col)) {
                return { row, col };
            }
            if (this.isSolidCell(row, col)) {
                break;
            }
            depth += 1;
        }
        depth = 0;
        for (let row = startRow - 1; row >= 0 && depth <= maxSearch; row -= 1) {
            if (this.isWalkable(row, col)) {
                return { row, col };
            }
            if (this.isSolidCell(row, col)) {
                break;
            }
            depth += 1;
        }
        return null;
    }

    findPath(startNode, targetNode) {
        const startKey = this.nodeKey(startNode);
        const targetKey = this.nodeKey(targetNode);

        if (startKey === targetKey) {
            return [startNode];
        }

        const queue = [startNode];
        const visited = new Map();
        visited.set(startKey, null);

        while (queue.length > 0) {
            const current = queue.shift();
            const currentKey = this.nodeKey(current);
            if (currentKey === targetKey) {
                return this.reconstructPath(visited, currentKey, startKey, targetNode);
            }

            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                const neighborKey = this.nodeKey(neighbor);
                if (visited.has(neighborKey)) {
                    continue;
                }
                visited.set(neighborKey, currentKey);
                queue.push(neighbor);
            }
        }

        return null;
    }

    reconstructPath(visited, targetKey, startKey, targetNode) {
        const path = [targetNode];
        let currentKey = visited.get(targetKey);
        let safety = 0;
        while (currentKey && currentKey !== startKey && safety < this.mapRows * this.mapCols) {
            const [row, col] = currentKey.split(":").map((value) => Number(value));
            path.push({ row, col });
            currentKey = visited.get(currentKey);
            safety += 1;
        }
        if (startKey) {
            const [row, col] = startKey.split(":").map((value) => Number(value));
            path.push({ row, col });
        }
        return path.reverse();
    }

    getNeighbors(node) {
        const result = [];
        const horizontal = [-1, 1];
        for (const offset of horizontal) {
            const neighborCol = node.col + offset;
            if (this.isWalkable(node.row, neighborCol)) {
                result.push({ row: node.row, col: neighborCol });
            }
        }

        const dropTarget = this.getDropTarget(node);
        if (dropTarget) {
            result.push(dropTarget);
        }

        const jumpTargets = this.getJumpTargets(node);
        result.push(...jumpTargets);

        return result;
    }

    getDropTarget(node) {
        for (let row = node.row + 1; row < this.mapRows - 1; row += 1) {
            if (this.isSolidCell(row, node.col)) {
                return null;
            }
            if (this.isWalkable(row, node.col)) {
                return { row, col: node.col };
            }
        }
        return null;
    }

    getJumpTargets(node) {
        const targets = [];
        for (let vertical = 1; vertical <= this.maxJumpTiles; vertical += 1) {
            const targetRow = node.row - vertical;
            if (targetRow < 0) {
                break;
            }
            for (
                let horizontal = -this.maxJumpHorizontalTiles;
                horizontal <= this.maxJumpHorizontalTiles;
                horizontal += 1
            ) {
                const targetCol = node.col + horizontal;
                if (!this.isWalkable(targetRow, targetCol)) {
                    continue;
                }
                if (Math.abs(horizontal) > vertical + 1) {
                    continue;
                }
                if (!this.isJumpPathClear(node, { row: targetRow, col: targetCol })) {
                    continue;
                }
                targets.push({ row: targetRow, col: targetCol });
            }
        }
        return targets;
    }

    isJumpPathClear(from, to) {
        const rowMin = Math.min(from.row, to.row);
        const rowMax = Math.max(from.row, to.row);
        const colMin = Math.min(from.col, to.col);
        const colMax = Math.max(from.col, to.col);

        for (let row = rowMin; row <= rowMax; row += 1) {
            for (let col = colMin; col <= colMax; col += 1) {
                if (this.isSolidCell(row, col)) {
                    return false;
                }
            }
        }
        return true;
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
        ctx.fillRect(
            this.state.x,
            this.state.y,
            this.state.width,
            this.state.height
        );
        ctx.restore();

        if (isDying) {
            if (!this.deathAnimation.fragments.length) {
                this.deathAnimation.fragments = Array.from(
                    { length: 8 },
                    () => ({
                        offsetX: (Math.random() - 0.5) * this.state.width,
                        offsetY: (Math.random() - 0.5) * this.state.height,
                        size:
                            Math.max(4, this.state.width * (0.1 + Math.random() * 0.15)),
                        angle: Math.random() * Math.PI * 2,
                    })
                );
            }

            ctx.save();
            ctx.globalAlpha = Math.max(0, 0.55 * (1 - progress));
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.6 * (1 - progress)})`;
            ctx.lineWidth = 2 + progress * 4;
            ctx.strokeRect(
                this.state.x - 4 - progress * 8,
                this.state.y - 4 - progress * 8,
                this.state.width + 8 + progress * 16,
                this.state.height + 8 + progress * 16
            );
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
                ctx.fillRect(-size / 2, -size / 2, size, size);
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
