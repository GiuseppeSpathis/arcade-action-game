import { setupAudioToggle } from "../helper/audioController.js";
import { generateMap, isSolidTile } from "./helper/map.js";
import { PlayerController } from "./helper/player.js";
import { Bullet } from "./helper/bullet.js";
import { TriangleEnemy } from "./enemies/triangle.js";
import { SquareEnemy } from "./enemies/square.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Get HUD container
const hudContainer = document.getElementById("hudContainer"); 
const playerHUDElements = []; // Will store { container, hearts[] } for each player

const audioElement = document.getElementById("bg_music");
const toggleButton = document.getElementById("musicToggle");
const returnMenuButton = document.getElementById("returnMenuButton");
const sfxGameOver = document.getElementById("sfx_gameover");
if (sfxGameOver) sfxGameOver.volume = 0.9;
const sfxHit = document.getElementById("sfx_hit");
if (sfxHit) sfxHit.volume = 0.75;

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

// Dynamically creates the set of keys to prevent default browser action
function createPreventDefaultKeys(baseInput, playerData) {
    const keys = new Set(baseInput.PREVENT_DEFAULT_KEYS);
    playerData.forEach(playerDef => {
        // Add all input keys from all players
        Object.values(playerDef.inputs).flat().forEach(key => keys.add(key));
    });
    return keys;
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
        "Press the button to return to the menu",
        canvas.width / 2,
        canvas.height / 2 + fontSize
    );
    ctx.restore();
}

async function initializeGame() {
    // Get player count from URL
    const urlParams = new URLSearchParams(window.location.search);
    const playerCount = parseInt(urlParams.get('players') || '1', 10);

    const constants = await loadConstants();
    const backgroundImage = await loadImage(
        constants.BACKGROUND.BACKGROUND_IMAGE_SRC
    );

    const mapData = generateMap(canvas, constants);
    
    // Create all player controllers
    const players = [];
    for (let i = 0; i < playerCount; i++) {
        if (constants.PLAYER_DATA[i]) {
            const player = new PlayerController(constants, mapData, canvas, constants.PLAYER_DATA[i], i);
            players.push(player);
        }
    }
    
    const pressedKeys = new Set();
    const preventDefaultKeys = createPreventDefaultKeys(constants.INPUT, constants.PLAYER_DATA);
    
    const exitKey = constants.INPUT.EXIT_KEY;
    const exitDestination = constants.INPUT.EXIT_DESTINATION;

    let lastFrameTime = performance.now();
    let lastSpawnTimestamp = -Infinity;
    let isGameOver = false;
    let enemies = [];
    let playerBullets = [];
    let enemyBullets = [];

    // --- HUD Initialization ---
    function initializeHUD(playerCount) {
        for (let i = 0; i < playerCount; i++) {
            if (!constants.PLAYER_DATA[i]) continue;
            
            const playerHud = document.createElement("div");
            playerHud.className = "player-hud";
            playerHud.id = `player-hud-${i}`;
            // Style border with player's color
            playerHud.style.borderColor = constants.PLAYER_DATA[i].color; 

            const label = document.createElement("span");
            label.className = "player-label";
            label.textContent = `P${i + 1}`;
            playerHud.appendChild(label);
            
            const livesContainer = document.createElement("div");
            livesContainer.className = "lives";
            livesContainer.setAttribute("aria-label", `P${i+1} Vite: ${constants.PLAYER.MAX_LIVES}`);
            
            const hearts = [];
            for (let j = 0; j < constants.PLAYER.MAX_LIVES; j++) {
                const heart = document.createElement("span");
                heart.className = "heart";
                heart.setAttribute("aria-hidden", "true");
                heart.textContent = "❤";
                livesContainer.appendChild(heart);
                hearts.push(heart);
            }
            
            playerHud.appendChild(livesContainer);
            hudContainer.appendChild(playerHud);
            // Store references to the hearts for this player
            playerHUDElements.push({ container: livesContainer, hearts: hearts });
        }
    }
    
    initializeHUD(playerCount);
    // --- End HUD Initialization ---

    // Updates the hearts display for a specific player
    function updatePlayerLivesDisplay(playerIndex, lives) {
        const hud = playerHUDElements[playerIndex];
        if (!hud) return;

        hud.hearts.forEach((heart, index) => {
            heart.classList.toggle("lost", index >= lives);
        });
        hud.container.setAttribute("aria-label", `P${playerIndex + 1} Vite rimaste: ${lives}`);
    }

    // Damages a specific player
    function damagePlayer(player, timestamp) {
        if (isGameOver || player.isDead) {
            return;
        }
        // Use player-specific lastDamageAt
        if (timestamp - player.lastDamageAt < constants.PLAYER.INVINCIBILITY_WINDOW_MS) {
            return;
        }
        player.lastDamageAt = timestamp;
        player.triggerDamageFeedback(timestamp);
        player.lives = Math.max(0, player.lives - 1);
        
        // Update the correct player's HUD
        updatePlayerLivesDisplay(player.playerIndex, player.lives);
        
        if (sfxHit) {
            try {
                sfxHit.currentTime = 0;
                sfxHit.play().catch(() => {});
            } catch {}
        }
        if (player.lives <= 0) {
            player.isDead = true;
            checkAllPlayersDead(); // Check if game should end
        }
    }

    // Checks if all players are dead to trigger game over
    function checkAllPlayersDead() {
        const allDead = players.every(p => p.isDead);
        if (allDead) {
            triggerGameOver();
        }
    }

    function triggerGameOver() {
        if (isGameOver) return;
        isGameOver = true;
        pressedKeys.clear();

        if (audioElement) {
            const startVol = audioElement.volume ?? 0.35;
            const duration = 500; 
            const step = 40;
            let elapsed = 0;
            const id = setInterval(() => {
            elapsed += step;
            const t = Math.min(1, elapsed / duration);
            audioElement.volume = startVol * (1 - t);
            if (t >= 1) {
                clearInterval(id);
                audioElement.pause();
                audioElement.volume = startVol; 
            }
            }, step);
        }

        if (sfxGameOver) {
            try {
            sfxGameOver.currentTime = 0;
            sfxGameOver.play().catch(() => {});
            } catch {}
        }

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

    // Gets shooting direction based on player-specific keys
    function getShootingDirectionFromKeys(player, pressedKeys) {
        let directionX = 0;
        let directionY = 0;
        let hasInput = false;
        const shootKeys = player.playerData.inputs.shoot;

        // Assumes shootKeys is [Up, Down, Left, Right]
        const keyMap = {
            [shootKeys[0]]: { y: -1 }, // Up
            [shootKeys[1]]: { y: 1 },  // Down
            [shootKeys[2]]: { x: -1 }, // Left
            [shootKeys[3]]: { x: 1 }   // Right
        };

        for (const key in keyMap) {
            if (pressedKeys.has(key)) {
                hasInput = true;
                directionX += (keyMap[key].x || 0);
                directionY += (keyMap[key].y || 0);
            }
        }

        if (!hasInput) {
            return null;
        }

        if (directionX === 0 && directionY === 0) {
            return null;
        }

        return { x: directionX, y: directionY };
    }

    // Handles shooting for all active players
    function handlePlayerShooting(timestamp) {
        players.forEach(player => {
            if (player.isDead) return;

            const direction = getShootingDirectionFromKeys(player, pressedKeys);
            if (!direction) {
                return;
            }
            // Use player-specific shot cooldown
            if (timestamp - player.lastPlayerShot < constants.PLAYER_BULLET.COOLDOWN_MS) {
                return;
            }
            player.lastPlayerShot = timestamp;
            const center = player.getCenter();
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
        });
    }

    function updateEnemies(deltaTime, timestamp, allPlayers) {
        // Find the first alive player to target
        const primaryTarget = allPlayers.find(p => !p.isDead);
        // If all are dead, just use player 0's bounds
        const targetBounds = primaryTarget ? primaryTarget.getBounds() : allPlayers[0].getBounds();
        
        enemies.forEach((enemy) => {
            if (enemy instanceof TriangleEnemy) {
                const bullet = enemy.update(deltaTime, targetBounds, timestamp, canvas);
                if (bullet) {
                    enemyBullets.push(bullet);
                }
            } else {
                enemy.update(deltaTime, targetBounds, timestamp, canvas);
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
                if (typeof enemy.isDying === "function" && enemy.isDying()) {
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

    // Checks enemy bullets against all active players
    function updateEnemyBullets(deltaTime, timestamp) {
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
            
            for (const player of players) {
                if (player.isDead) continue; // Skip dead players

                if (bullet.intersectsRect(player.getBounds())) {
                    bullet.active = false;
                    damagePlayer(player, timestamp); // Damage the specific player
                    break; // Bullet hits one player and is destroyed
                }
            }
        });
        enemyBullets = enemyBullets.filter((bullet) => bullet.active);
    }

    // Checks enemy body collisions against all active players
    function handleEnemyCollisions(timestamp) {
        enemies.forEach((enemy) => {
            if (!(enemy instanceof SquareEnemy)) {
                return;
            }
            if (enemy.isSpawning) {
                return;
            }
            if (typeof enemy.isDying === "function" && enemy.isDying()) {
                return;
            }

            for (const player of players) {
                if (player.isDead) continue; // Skip dead players

                if (rectanglesIntersect(enemy.getBounds(), player.getBounds())) {
                    damagePlayer(player, timestamp); // Damage the specific player
                    // Note: No break, enemy can hit multiple players at once
                }
            }
        });
    }

    function gameLoop(timestamp) {
        const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
        lastFrameTime = timestamp;

        if (!isGameOver) {
            // Update all players
            players.forEach(player => player.update(pressedKeys));
            
            handlePlayerShooting(timestamp);

            if (timestamp - lastSpawnTimestamp >= constants.ENEMIES.SPAWN_INTERVAL_MS) {
                spawnEnemyGroup();
                lastSpawnTimestamp = timestamp;
            }

            updateEnemies(deltaTime, timestamp, players); // Pass all players
            updatePlayerBullets(deltaTime);
            updateEnemyBullets(deltaTime, timestamp); // No player bounds needed
            handleEnemyCollisions(timestamp); // No player bounds needed
        }

        drawBackground(ctx, backgroundImage);
        drawTiles(mapData, constants);

        enemies.forEach((enemy) => enemy.draw(ctx));
        enemyBullets.forEach((bullet) => bullet.draw(ctx));
        playerBullets.forEach((bullet) => bullet.draw(ctx));
        
        // Draw all players
        players.forEach(player => player.draw(ctx));

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

        // Check jump keys for all players
        if (!isGameOver) {
            players.forEach(player => {
                if (player.playerData.inputs.jump.includes(event.code)) {
                    player.queueJump();
                }
            });
        }
    });

    document.addEventListener("keyup", (event) => {
        pressedKeys.delete(event.code);
    });

    requestAnimationFrame((timestamp) => {
        lastFrameTime = timestamp;
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