import { setupAudioToggle } from "../helper/audioController.js";
import { generateMap, isSolidTile } from "./helper/map.js";
import { PlayerController } from "./helper/player.js";
import { Bullet } from "./helper/bullet.js";
import { TriangleEnemy } from "./enemies/triangle.js";
import { SquareEnemy } from "./enemies/square.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const heartsElements = Array.from(document.querySelectorAll(".heart"));

const audioElement = document.getElementById("bg_music");
const toggleButton = document.getElementById("musicToggle");
const returnMenuButton = document.getElementById("returnMenuButton");
setupAudioToggle({ audioElement, toggleButton });

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

async function loadConstants() {
    const response = await fetch("./constants.json");
    if (!response.ok) {
        throw new Error("Unable to load constants.json");
    }
    return response.json();
}

function createKeySet(values) {
    return new Set(values);
}

function drawBackground(ctxInstance, backgroundImage) {
    ctxInstance.clearRect(0, 0, canvas.width, canvas.height);
    if (!backgroundImage.complete) {
        return;
    }

    const canvasAspectRatio = canvas.width / canvas.height;
    const imageAspectRatio = backgroundImage.width / backgroundImage.height;

    let drawWidth;
    let drawHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (canvasAspectRatio > imageAspectRatio) {
        drawWidth = canvas.width;
        drawHeight = canvas.width / imageAspectRatio;
        offsetY = (canvas.height - drawHeight) / 2;
    } else {
        drawHeight = canvas.height;
        drawWidth = canvas.height * imageAspectRatio;
        offsetX = (canvas.width - drawWidth) / 2;
    }

    ctxInstance.drawImage(backgroundImage, offsetX, offsetY, drawWidth, drawHeight);
}

function drawTile(ctxInstance, x, y, tileSize, constants) {
    const soilHeight = constants.TILE.SOIL_HEIGHT;
    ctxInstance.fillStyle = constants.TILE.SOIL_COLOR;
    ctxInstance.fillRect(x, y + tileSize - soilHeight, tileSize, soilHeight);

    ctxInstance.fillStyle = constants.TILE.GRASS_COLOR;
    ctxInstance.fillRect(x, y, tileSize, tileSize - soilHeight);

    ctxInstance.fillStyle = constants.TILE.HIGHLIGHT_COLOR;
    ctxInstance.fillRect(x, y, tileSize, constants.TILE.TOP_LIGHT_HEIGHT);
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
        image.src = src;
    });
}

function drawTiles(mapData, constants) {
    const tileSize = constants.TILE_SIZE;
    const offsetY = mapData.verticalOffset;

    for (let row = 0; row < mapData.grid.length; row += 1) {
        for (let col = 0; col < mapData.grid[row].length; col += 1) {
            if (mapData.grid[row][col] === constants.MAP.SOLID_TILE_VALUE) {
                const tileX = col * tileSize;
                const tileY = offsetY + row * tileSize;
                drawTile(ctx, tileX, tileY, tileSize, constants);
            }
        }
    }
}

function rectanglesIntersect(a, b) {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}

function drawGameOverOverlay() {
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fontSize = Math.max(24, Math.min(canvas.width, canvas.height) * 0.06);
    ctx.font = `bold ${fontSize}px 'Press Start 2P', 'Courier New', monospace`;
    ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2);
    ctx.font = `normal ${Math.floor(fontSize * 0.4)}px 'Press Start 2P', 'Courier New', monospace`;
    ctx.fillText(
        "Premi il pulsante per tornare al menu",
        canvas.width / 2,
        canvas.height / 2 + fontSize
    );
    ctx.restore();
}

async function initializeGame() {
    const constants = await loadConstants();
    const backgroundImage = await loadImage(
        constants.BACKGROUND.BACKGROUND_IMAGE_SRC
    );

    const mapData = generateMap(canvas, constants);
    const playerController = new PlayerController(constants, mapData, canvas);

    const pressedKeys = new Set();
    const preventDefaultKeys = createKeySet(
        constants.INPUT.PREVENT_DEFAULT_KEYS
    );
    const jumpKeys = createKeySet(constants.INPUT.JUMP_KEYS);
    const exitKey = constants.INPUT.EXIT_KEY;
    const exitDestination = constants.INPUT.EXIT_DESTINATION;

    let lastFrameTime = performance.now();
    let lastSpawnTimestamp = lastFrameTime;
    let lastPlayerShot = 0;
    let lastDamageAt = -Infinity;
    let playerLives = constants.PLAYER.MAX_LIVES;
    let isGameOver = false;
    let enemies = [];
    let playerBullets = [];
    let enemyBullets = [];

    updateLivesDisplay(playerLives);

    function updateLivesDisplay(lives) {
        heartsElements.forEach((heart, index) => {
            heart.classList.toggle("lost", index >= lives);
        });
        const livesContainer = document.querySelector(".lives");
        if (livesContainer) {
            livesContainer.setAttribute("aria-label", `Vite rimaste: ${lives}`);
        }
    }

    function damagePlayer(timestamp) {
        if (isGameOver) {
            return;
        }
        if (timestamp - lastDamageAt < constants.PLAYER.INVINCIBILITY_WINDOW_MS) {
            return;
        }
        lastDamageAt = timestamp;
        playerLives = Math.max(0, playerLives - 1);
        updateLivesDisplay(playerLives);
        if (playerLives <= 0) {
            triggerGameOver();
        }
    }

    function triggerGameOver() {
        if (isGameOver) {
            return;
        }
        isGameOver = true;
        pressedKeys.clear();
        if (returnMenuButton) {
            returnMenuButton.hidden = false;
            returnMenuButton.focus({ preventScroll: true });
        }
    }

    function spawnEnemyGroup() {
        const { MIN, MAX } = constants.ENEMIES.GROUP_SIZE;
        const totalEnemies = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;
        const spawned = [];

        if (totalEnemies >= 1) {
            spawned.push(new TriangleEnemy(constants, canvas));
        }
        if (totalEnemies >= 2) {
            spawned.push(new SquareEnemy(constants, canvas, mapData));
        }
        while (spawned.length < totalEnemies) {
            const enemyClass = Math.random() > 0.5 ? TriangleEnemy : SquareEnemy;
            spawned.push(new enemyClass(constants, canvas));
        }

        enemies.push(...spawned);
    }

    function getShootingDirectionFromKeys() {
        let directionX = 0;
        let directionY = 0;
        let hasInput = false;

        constants.INPUT.SHOOT_KEYS.forEach((code) => {
            if (!pressedKeys.has(code)) {
                return;
            }
            hasInput = true;
            switch (code) {
                case "ArrowUp":
                    directionY -= 1;
                    break;
                case "ArrowDown":
                    directionY += 1;
                    break;
                case "ArrowLeft":
                    directionX -= 1;
                    break;
                case "ArrowRight":
                    directionX += 1;
                    break;
                default:
                    break;
            }
        });

        if (!hasInput) {
            return null;
        }

        if (directionX === 0 && directionY === 0) {
            return null;
        }

        return { x: directionX, y: directionY };
    }

    function handlePlayerShooting(timestamp) {
        const direction = getShootingDirectionFromKeys();
        if (!direction) {
            return;
        }
        if (timestamp - lastPlayerShot < constants.PLAYER_BULLET.COOLDOWN_MS) {
            return;
        }
        lastPlayerShot = timestamp;
        const center = playerController.getCenter();
        playerBullets.push(
            new Bullet({
                x: center.x,
                y: center.y,
                direction,
                speed: constants.PLAYER_BULLET.SPEED,
                radius: constants.PLAYER_BULLET.RADIUS,
                color: constants.PLAYER_BULLET.COLOR,
            })
        );
    }

    function updateEnemies(deltaTime, timestamp, playerBounds) {
        enemies.forEach((enemy) => {
            if (enemy instanceof TriangleEnemy) {
                const bullet = enemy.update(deltaTime, playerBounds, timestamp, canvas);
                if (bullet) {
                    enemyBullets.push(bullet);
                }
            } else {
                enemy.update(deltaTime, playerBounds, timestamp, canvas);
            }
        });
        enemies = enemies.filter((enemy) => enemy.active);
    }

    function bulletHitsTiles(bullet) {
        if (!bullet.active) {
            return false;
        }
        const samplePoints = [
            { x: bullet.position.x, y: bullet.position.y },
            { x: bullet.position.x + bullet.radius, y: bullet.position.y },
            { x: bullet.position.x - bullet.radius, y: bullet.position.y },
            { x: bullet.position.x, y: bullet.position.y + bullet.radius },
            { x: bullet.position.x, y: bullet.position.y - bullet.radius },
        ];

        return samplePoints.some(({ x, y }) => {
            const row = Math.floor((y - mapData.verticalOffset) / constants.TILE_SIZE);
            const col = Math.floor(x / constants.TILE_SIZE);
            return isSolidTile(mapData.grid, row, col, constants);
        });
    }

    function updatePlayerBullets(deltaTime) {
        playerBullets.forEach((bullet) => bullet.update(deltaTime, canvas));
        playerBullets.forEach((bullet) => {
            if (bulletHitsTiles(bullet)) {
                bullet.active = false;
            }
        });
        playerBullets.forEach((bullet) => {
            if (!bullet.active) {
                return;
            }
            for (const enemy of enemies) {
                if (!enemy.active) {
                    continue;
                }
                if (bullet.intersectsRect(enemy.getBounds())) {
                    bullet.active = false;
                    enemy.takeHit();
                    break;
                }
            }
        });
        enemies = enemies.filter((enemy) => enemy.active);
        playerBullets = playerBullets.filter((bullet) => bullet.active);
    }

    function updateEnemyBullets(deltaTime, timestamp, playerBounds) {
        enemyBullets.forEach((bullet) => bullet.update(deltaTime, canvas));
        enemyBullets.forEach((bullet) => {
            if (bulletHitsTiles(bullet)) {
                bullet.active = false;
            }
        });
        enemyBullets.forEach((bullet) => {
            if (!bullet.active) {
                return;
            }
            if (bullet.intersectsRect(playerBounds)) {
                bullet.active = false;
                damagePlayer(timestamp);
            }
        });
        enemyBullets = enemyBullets.filter((bullet) => bullet.active);
    }

    function handleEnemyCollisions(timestamp, playerBounds) {
        enemies.forEach((enemy) => {
            if (!(enemy instanceof SquareEnemy)) {
                return;
            }
            if (enemy.isSpawning) {
                return;
            }
            if (rectanglesIntersect(enemy.getBounds(), playerBounds)) {
                damagePlayer(timestamp);
            }
        });
    }

    function gameLoop(timestamp) {
        const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
        lastFrameTime = timestamp;

        if (!isGameOver) {
            playerController.update(pressedKeys);
            handlePlayerShooting(timestamp);

            if (timestamp - lastSpawnTimestamp >= constants.ENEMIES.SPAWN_INTERVAL_MS) {
                spawnEnemyGroup();
                lastSpawnTimestamp = timestamp;
            }

            const playerBounds = playerController.getBounds();
            updateEnemies(deltaTime, timestamp, playerBounds);
            updatePlayerBullets(deltaTime);
            updateEnemyBullets(deltaTime, timestamp, playerBounds);
            handleEnemyCollisions(timestamp, playerBounds);
        }

        drawBackground(ctx, backgroundImage);
        drawTiles(mapData, constants);

        enemies.forEach((enemy) => enemy.draw(ctx));
        enemyBullets.forEach((bullet) => bullet.draw(ctx));
        playerBullets.forEach((bullet) => bullet.draw(ctx));
        playerController.draw(ctx);

        if (isGameOver) {
            drawGameOverOverlay();
        }

        requestAnimationFrame(gameLoop);
    }

    document.addEventListener("keydown", (event) => {
        if (preventDefaultKeys.has(event.code)) {
            event.preventDefault();
        }

        pressedKeys.add(event.code);

        if (event.code === exitKey) {
            window.location.href = exitDestination;
            return;
        }

        if (!isGameOver && jumpKeys.has(event.code)) {
            playerController.queueJump();
        }
    });

    document.addEventListener("keyup", (event) => {
        pressedKeys.delete(event.code);
    });

    requestAnimationFrame((timestamp) => {
        lastFrameTime = timestamp;
        lastSpawnTimestamp = timestamp;
        gameLoop(timestamp);
    });

    if (returnMenuButton) {
        returnMenuButton.hidden = true;
        returnMenuButton.addEventListener("click", () => {
            window.location.href = exitDestination;
        });
    }
}

initializeGame().catch((error) => {
    console.error("Failed to initialize the game:", error);
});
