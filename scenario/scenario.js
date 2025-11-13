import { setupAudioToggle } from "../helper/audioController.js";
import { generateMap, isSolidTile } from "./helper/map.js";
import { PlayerController } from "./helper/player.js";
import { Bullet } from "./helper/bullet.js";
import { TriangleEnemy } from "./enemies/triangle.js";
import { SquareEnemy } from "./enemies/square.js";
import {
  initFirebase,
  createGameSession,
  listenForRemoteInputs,
  setGameState, // NEW: Import setGameState
} from "../helper/firebaseRemoteController.js";

// --- Global Game State ---
let constants;
let players = [];
let pressedKeys = new Set();
let remoteInputsState = {};
let firebaseUnsubscribe;
let lastFrameTime = performance.now();
let isGameOver = false;
let enemies = [];
let playerBullets = [];
let enemyBullets = [];
let lastSpawnTimestamp = -Infinity;
let mapData;
let backgroundImage;
let roomCode; // NEW: Store roomCode globally
// --- End Global Game State ---

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const hudContainer = document.getElementById("hudContainer");
const playerHUDElements = [];

// --- NEW: Lobby Elements ---
const connectionOverlay = document.getElementById("connectionOverlay");
const connectionUrl = document.getElementById("connectionUrl");
const playerConnectionContainer = document.getElementById(
  "playerConnectionContainer"
);
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const roomCodeText = document.getElementById("roomCodeText");
// --- End Lobby Elements ---

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

function createPreventDefaultKeys(baseInput, playerData) {
  const keys = new Set(baseInput.PREVENT_DEFAULT_KEYS);
  playerData.forEach((playerDef) => {
    // Add all input keys from all players
    Object.values(playerDef.inputs)
      .flat()
      .forEach((key) => keys.add(key));
  });
  return keys;
}

function drawBackground(ctxInstance, bgImage) {
  ctxInstance.clearRect(0, 0, canvas.width, canvas.height);
  if (!bgImage || !bgImage.complete) {
    return;
  }

  const canvasAspectRatio = canvas.width / canvas.height;
  const imageAspectRatio = bgImage.width / bgImage.height;

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

  ctxInstance.drawImage(bgImage, offsetX, offsetY, drawWidth, drawHeight);
}

function drawTile(ctxInstance, x, y, tileSize, consts) {
  const soilHeight = consts.TILE.SOIL_HEIGHT;
  ctxInstance.fillStyle = consts.TILE.SOIL_COLOR;
  ctxInstance.fillRect(x, y + tileSize - soilHeight, tileSize, soilHeight);

  ctxInstance.fillStyle = consts.TILE.GRASS_COLOR;
  ctxInstance.fillRect(x, y, tileSize, tileSize - soilHeight);

  ctxInstance.fillStyle = consts.TILE.HIGHLIGHT_COLOR;
  ctxInstance.fillRect(x, y, tileSize, consts.TILE.TOP_LIGHT_HEIGHT);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load image: ${src}`));
    image.src = src;
  });
}

function drawTiles(map, consts) {
  const tileSize = consts.TILE_SIZE;
  const offsetY = map.verticalOffset;

  for (let row = 0; row < map.grid.length; row += 1) {
    for (let col = 0; col < map.grid[row].length; col += 1) {
      if (map.grid[row][col] === consts.MAP.SOLID_TILE_VALUE) {
        const tileX = col * tileSize;
        const tileY = offsetY + row * tileSize;
        drawTile(ctx, tileX, tileY, tileSize, consts);
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
  ctx.font = `normal ${Math.floor(
    fontSize * 0.4
  )}px 'Press Start 2P', 'Courier New', monospace`;
  ctx.fillText(
    "Press the button to return to the menu",
    canvas.width / 2,
    canvas.height / 2 + fontSize
  );
  ctx.restore();
}

/**
 * NEW: Processes remote inputs during gameplay.
 * This is called by the Firebase listener *after* the game has started.
 */
function processRemoteInputs(sessionData) {
  if (!players.length || !constants || !sessionData.players) return; // NEW: Check for sessionData.players

  const playerKeys = ["p2", "p3", "p4"];
  const remotePlayers = sessionData.players; // NEW: Get the nested players object

  playerKeys.forEach((key, index) => {
    const playerIndex = index + 1; // p2 is index 1, p3 is 2, etc.

    // Check if this player exists in the game and in the input data
    if (!remotePlayers[key] || !players[playerIndex]) {
      // NEW: Check remotePlayers
      return;
    }

    // NEW: Get inputs from the sub-object
    const pInputs = remotePlayers[key].inputs; // NEW: Check remotePlayers
    if (!pInputs) return;

    const pConfig = constants.PLAYER_DATA[playerIndex].inputs;
    const pState = remoteInputsState[key] || { j: false }; // Get old state

    // --- Map remote inputs to pressedKeys Set ---
    pInputs.l
      ? pressedKeys.add(pConfig.left[0])
      : pressedKeys.delete(pConfig.left[0]);
    pInputs.r
      ? pressedKeys.add(pConfig.right[0])
      : pressedKeys.delete(pConfig.right[0]);
    pInputs.s
      ? pressedKeys.add(pConfig.shoot[0])
      : pressedKeys.delete(pConfig.shoot[0]);
    if (pInputs.j && !pState.j) {
      players[playerIndex].queueJump();
    }
    remoteInputsState[key] = pInputs;
  });
}

/**
 * NEW: Sets up the multiplayer lobby screen.
 */
async function setupLobby(playerCount) {
  connectionOverlay.classList.remove("hidden");
  // The roomCodeDisplay element is INSIDE the overlay, so we don't need to hide/show it separately
  // It will show when the overlay shows.

  // Show connection URL
  const ip = window.location.hostname;
  const port = window.location.port;
  // Use a fallback for 127.0.0.1 which phones can't use
  const displayIp = ip === "127.0.0.1" ? "YOUR_LAPTOP_IP" : ip;
  connectionUrl.textContent = `http://${displayIp}:${port}/scenario/controller/phoneController.html`;
  if (displayIp === "YOUR_LAPTOP_IP") {
    connectionUrl.previousElementSibling.innerHTML =
      "Connect your phone to the same Wi-Fi and (after finding your IP) go to:";
  }

  // Create "waiting" list
  const requiredPlayers = [];
  for (let i = 2; i <= playerCount; i++) {
    const playerKey = `p${i}`;
    requiredPlayers.push(playerKey);
    const statusEl = document.createElement("div");
    statusEl.className = "player-status";
    statusEl.id = `status-${playerKey}`;
    statusEl.textContent = `P${i}: Waiting for connection...`;
    playerConnectionContainer.appendChild(statusEl);
  }

  // Init Firebase and create session
  try {
    const { error } = await initFirebase();
    if (error) throw new Error(error);

    roomCode = await createGameSession(playerCount); // NEW: Assign to global var
    if (!roomCode) throw new Error("Failed to create room.");

    roomCodeText.textContent = roomCode;

    // Start listening
    let gameStarted = false;
    firebaseUnsubscribe = listenForRemoteInputs(roomCode, (sessionData) => {
      if (!sessionData) return; // Doc doesn't exist yet

      if (gameStarted) {
        processRemoteInputs(sessionData); // Game is running, process inputs
        return;
      }

      // --- Lobby Logic ---
      let allConnected = true;
      const remotePlayers = sessionData.players || {}; // NEW: Get nested players
      for (const playerKey of requiredPlayers) {
        if (remotePlayers[playerKey] && remotePlayers[playerKey].connected) {
          // NEW: Check nested players
          const statusEl = document.getElementById(`status-${playerKey}`);
          if (statusEl) {
            statusEl.textContent = `P${playerKey.charAt(1)}: Connected!`;
            statusEl.classList.add("connected");
          }
        } else {
          allConnected = false; // Not everyone is here yet
        }
      }

      if (allConnected) {
        gameStarted = true;
        // Set initial input state
        for (const playerKey of requiredPlayers) {
          if (remotePlayers[playerKey] && remotePlayers[playerKey].inputs) {
            // NEW: Check nested players
            remoteInputsState[playerKey] = remotePlayers[playerKey].inputs; // NEW: Check nested players
          }
        }
        // Start the game!
        setGameState(roomCode, "running"); // NEW: Tell phones the game is running
        initializeGame(playerCount);
      }
      // --- End Lobby Logic ---
    });
  } catch (e) {
    console.error("Lobby setup failed:", e);
    roomCodeText.textContent = "ERROR";
    // roomCodeDisplay is inside the overlay, just update its text
    roomCodeDisplay.style.borderColor = "#E63946";
    roomCodeDisplay.querySelector(".room-code-label").textContent = "ERROR:";
  }
}

/**
 * Initializes and starts the actual game.
 * This is now called *after* the lobby is complete.
 */
async function initializeGame(playerCount) {
  try {
    // --- 1. Load Assets and Map (if not already loaded) ---
    // We move loading here so 1-player doesn't wait
    if (!constants) {
      constants = await loadConstants();
    }
    if (!backgroundImage) {
      backgroundImage = await loadImage(
        constants.BACKGROUND.BACKGROUND_IMAGE_SRC
      );
    }
    if (!mapData) {
      mapData = generateMap(canvas, constants);
    }

    // --- 2. Create Players ---
    for (let i = 0; i < playerCount; i++) {
      if (constants.PLAYER_DATA[i]) {
        const player = new PlayerController(
          constants,
          mapData,
          canvas,
          constants.PLAYER_DATA[i],
          i
        );
        players.push(player);
      }
    }

    // --- 3. Setup Input Handling ---
    const preventDefaultKeys = createPreventDefaultKeys(
      constants.INPUT,
      constants.PLAYER_DATA
    );
    const exitKey = constants.INPUT.EXIT_KEY;
    const exitDestination = constants.INPUT.EXIT_DESTINATION;

    document.addEventListener("keydown", (event) => {
      if (preventDefaultKeys.has(event.code)) {
        event.preventDefault();
      }
      pressedKeys.add(event.code);
      if (event.code === exitKey) {
        if (firebaseUnsubscribe) firebaseUnsubscribe();
        window.location.href = exitDestination;
        return;
      }
      if (!isGameOver) {
        players.forEach((player) => {
          if (player.playerData.inputs.jump.includes(event.code)) {
            player.queueJump();
          }
        });
      }
    });

    document.addEventListener("keyup", (event) => {
      pressedKeys.delete(event.code);
    });

    window.addEventListener("beforeunload", () => {
      if (firebaseUnsubscribe) firebaseUnsubscribe();
    });

    // --- 4. Initialize HUD ---
    initializeHUD(playerCount);

    // --- 5. Setup Return Button ---
    if (returnMenuButton) {
      returnMenuButton.hidden = true;
      returnMenuButton.addEventListener("click", () => {
        if (firebaseUnsubscribe) firebaseUnsubscribe();
        window.location.href = exitDestination;
      });
    }

    // --- 6. Hide Lobby and Start Game ---
    connectionOverlay.classList.add("hidden");
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
  } catch (error) {
    console.error("Failed to initialize the game:", error);
    // Show error on lobby screen if it's still visible
    if (!connectionOverlay.classList.contains("hidden")) {
      roomCodeText.textContent = "FATAL";
      roomCodeDisplay.querySelector(".room-code-label").textContent = "ERROR:";
    }
  }
}

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
    livesContainer.setAttribute(
      "aria-label",
      `P${i + 1} Vite: ${constants.PLAYER.MAX_LIVES}`
    );

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

// --- Game Logic Functions (Unchanged) ---

function updatePlayerLivesDisplay(playerIndex, lives) {
  const hud = playerHUDElements[playerIndex];
  if (!hud) return;

  hud.hearts.forEach((heart, index) => {
    heart.classList.toggle("lost", index >= lives);
  });
  hud.container.setAttribute(
    "aria-label",
    `P${playerIndex + 1} Vite rimaste: ${lives}`
  );
}

function damagePlayer(player, timestamp) {
  if (isGameOver || player.isDead) {
    return;
  }
  // Use player-specific lastDamageAt
  if (
    timestamp - player.lastDamageAt <
    constants.PLAYER.INVINCIBILITY_WINDOW_MS
  ) {
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

function checkAllPlayersDead() {
  const allDead = players.every((p) => p.isDead);
  if (allDead) {
    triggerGameOver();
  }
}

function triggerGameOver() {
  if (isGameOver) return;
  isGameOver = true;
  pressedKeys.clear();

  // NEW: Tell phones the game is over
  if (roomCode) {
    setGameState(roomCode, "gameover");
  }

  if (firebaseUnsubscribe) {
    firebaseUnsubscribe();
    firebaseUnsubscribe = null;
  }

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

function getShootingDirectionFromKeys(player, keys) {
  let directionX = 0;
  let directionY = 0;
  let hasInput = false;
  const shootKeys = player.playerData.inputs.shoot;

  // Assumes shootKeys is [Up, Down, Left, Right]
  const keyMap = {
    [shootKeys[0]]: { y: -1 }, // Up
    [shootKeys[1]]: { y: 1 }, // Down
    [shootKeys[2]]: { x: -1 }, // Left
    [shootKeys[3]]: { x: 1 }, // Right
  };

  for (const key in keyMap) {
    if (keys.has(key)) {
      hasInput = true;
      directionX += keyMap[key].x || 0;
      directionY += keyMap[key].y || 0;
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

function handlePlayerShooting(timestamp) {
  players.forEach((player) => {
    if (player.isDead) return;

    const direction = getShootingDirectionFromKeys(player, pressedKeys);
    if (!direction) {
      return;
    }
    // Use player-specific shot cooldown
    if (
      timestamp - player.lastPlayerShot <
      constants.PLAYER_BULLET.COOLDOWN_MS
    ) {
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
  const primaryTarget = allPlayers.find((p) => !p.isDead);
  // If all are dead, just use player 0's bounds
  const targetBounds = primaryTarget
    ? primaryTarget.getBounds()
    : allPlayers[0].getBounds();

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

/**
 * The Main Game Loop
 */
function gameLoop(timestamp) {
  const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
  lastFrameTime = timestamp;

  if (!isGameOver) {
    // Update all players
    players.forEach((player) => player.update(pressedKeys));

    handlePlayerShooting(timestamp);

    if (
      timestamp - lastSpawnTimestamp >=
      constants.ENEMIES.SPAWN_INTERVAL_MS
    ) {
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
  players.forEach((player) => player.draw(ctx));

  if (isGameOver) {
    drawGameOverOverlay();
  }

  requestAnimationFrame(gameLoop);
}

/**
 * NEW: Main entry point.
 * Decides whether to start a 1-player game or the multiplayer lobby.
 */
async function main() {
  const urlParams = new URLSearchParams(window.location.search);
  const playerCount = parseInt(urlParams.get("players") || "1", 10);

  if (playerCount === 1) {
    // Start 1-player game immediately
    // We can pre-load assets while the player is on the menu,
    // but for now we load them at game start.
    initializeGame(1).catch((error) => {
      console.error("Failed to initialize 1-player game:", error);
    });
  } else {
    // Start multiplayer lobby
    // Pre-load assets *while* lobby is active
    try {
      constants = await loadConstants();
      backgroundImage = await loadImage(
        constants.BACKGROUND.BACKGROUND_IMAGE_SRC
      );
      mapData = generateMap(canvas, constants);
      // Now set up the lobby, assets are loading/loaded
      await setupLobby(playerCount);
    } catch (error) {
      console.error("Failed to pre-load assets or set up lobby:", error);
      // Show a fatal error on the screen
      connectionOverlay.classList.remove("hidden");
      roomCodeText.textContent = "FATAL";
      roomCodeDisplay.style.borderColor = "#E63946";
      roomCodeDisplay.querySelector(".room-code-label").textContent = "ERROR:";
      connectionUrl.textContent = "Could not load game assets. Please refresh.";
    }
  }
}

// Start the application
main();