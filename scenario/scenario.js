import { setupAudioToggle } from "../helper/audioController.js";
import { generateMap, isSolidTile } from "./helper/map.js";
import { PlayerController } from "./helper/player.js";
import { Bullet } from "./helper/bullet.js";
import { TriangleEnemy } from "./enemies/triangle.js";
import { CircleEnemy } from "./enemies/circle.js";
import { SquareEnemy } from "./enemies/square.js";
import { Leveller } from "./helper/leveller.js";
import * as GameLogic from "./utils/logic.js";
import {
  drawBackground,
  drawTiles,
  loadImage,
  drawGameOverOverlay,
} from "./utils/draw.js";
import {
  initFirebase,
  createGameSession,
  listenForRemoteInputs,
  setGameState,
  deleteGameSession,
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
let backgroundImages = [];
let currentBackgroundIndex = 0;
let roomCode;
let leveller;
let levelStats = {};
let GAME_PAUSED = false;
let playerUpgradeQueue = [];
let currentUpgradePlayerIndex = 0;

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const hudContainer = document.getElementById("hudContainer");
const playerHUDElements = [];

// --- Lobby Elements ---
const connectionOverlay = document.getElementById("connectionOverlay");
const connectionUrl = document.getElementById("connectionUrl");
const playerConnectionContainer = document.getElementById(
  "playerConnectionContainer",
);
const roomCodeDisplay = document.getElementById("roomCodeDisplay");
const roomCodeText = document.getElementById("roomCodeText");
const lobbyRoomCode = document.getElementById("lobbyRoomCode");
const lobbyBackButton = document.getElementById("lobbyBackButton");

// --- DOM Elements ---
const upgradeOverlay = document.getElementById("upgradeOverlay");
const currentPlayerPrompt = document.getElementById("currentPlayerPrompt");
const powerUpContainer = document.getElementById("powerUpContainer");

// --- Pause Elements ---
let pauseOverlay = document.getElementById("pauseOverlay");
let pauseToggle = document.getElementById("pauseToggle");
let resumeButton = document.getElementById("resumeButton");
let quitButton = document.getElementById("quitButton");

// --- Audio Elements ---
const musicAudioElement = document.getElementById("bg_music");
const musicToggleButton = document.getElementById("musicToggle");
const musicSliderContainer = document.getElementById(
  "musicVolumeSliderContainer",
);

const sfxToggleButton = document.getElementById("sfxToggle");
const sfxSliderContainer = document.getElementById("sfxVolumeSliderContainer");

const returnMenuButton = document.getElementById("returnMenuButton");

// Collect SFX elements
const sfxGameOver = document.getElementById("sfx_gameover");
if (sfxGameOver) sfxGameOver.volume = 0.9;
const sfxHit = document.getElementById("sfx_hit");
if (sfxHit) sfxHit.volume = 0.75;
const sfxShoot = document.getElementById("sfx_shoot");
if (sfxShoot) sfxShoot.volume = 0.6;
const sfxJump = document.getElementById("sfx_jump");
if (sfxJump) sfxJump.volume = 0.6;

const sfxElements = [sfxGameOver, sfxHit, sfxShoot, sfxJump].filter(Boolean);

// --- SETUP AUDIO CONTROLS ---
setupAudioToggle({
  audioElement: musicAudioElement,
  toggleButton: musicToggleButton,
  sliderContainer: musicSliderContainer,
  storageKeyMuted: "retro-arcade-music-muted",
  storageKeyVolume: "retro-arcade-music-volume",
  labelIcon: "🎵",
});

setupAudioToggle({
  audioElements: sfxElements,
  toggleButton: sfxToggleButton,
  sliderContainer: sfxSliderContainer,
  storageKeyMuted: "retro-arcade-sfx-muted",
  storageKeyVolume: "retro-arcade-sfx-volume",
  labelIcon: "💥",
});

// --- LOBBY BACK BUTTON LOGIC ---
if (lobbyBackButton) {
  lobbyBackButton.addEventListener("click", async () => {
    if (roomCode) {
      await deleteGameSession(roomCode);
    }
    if (firebaseUnsubscribe) firebaseUnsubscribe();
    window.location.href = "../menu/menu.html";
  });
}

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
    Object.values(playerDef.inputs)
      .flat()
      .forEach((key) => keys.add(key));
  });
  return keys;
}

function processRemoteInputs(sessionData) {
  if (!players.length || !constants || !sessionData.players) return;

  const playerKeys = ["p2", "p3", "p4"];
  const remotePlayers = sessionData.players;

  playerKeys.forEach((key, index) => {
    const playerIndex = index + 1;

    if (!remotePlayers[key] || !players[playerIndex]) {
      return;
    }

    const pInputs = remotePlayers[key].inputs;
    if (!pInputs) return;

    const pConfig = constants.PLAYER_DATA[playerIndex].inputs;
    const pState = remoteInputsState[key] || { j: false, mu: false };

    pInputs.ml
      ? pressedKeys.add(pConfig.left[0])
      : pressedKeys.delete(pConfig.left[0]);
    pInputs.mr
      ? pressedKeys.add(pConfig.right[0])
      : pressedKeys.delete(pConfig.right[0]);

    if ((pInputs.j && !pState.j) || (pInputs.mu && !pState.mu)) {
      players[playerIndex].queueJump();
    }

    pInputs.su
      ? pressedKeys.add(pConfig.shoot[0])
      : pressedKeys.delete(pConfig.shoot[0]);
    pInputs.sd
      ? pressedKeys.add(pConfig.shoot[1])
      : pressedKeys.delete(pConfig.shoot[1]);
    pInputs.sl
      ? pressedKeys.add(pConfig.shoot[2])
      : pressedKeys.delete(pConfig.shoot[2]);
    pInputs.sr
      ? pressedKeys.add(pConfig.shoot[3])
      : pressedKeys.delete(pConfig.shoot[3]);

    remoteInputsState[key] = pInputs;
  });
}

async function setupLobby(playerCount) {
  connectionOverlay.classList.remove("hidden");

  const ip = window.location.hostname;
  const port = window.location.port;
  const displayIp = ip === "127.0.0.1" ? "YOUR_LAPTOP_IP" : ip;
  connectionUrl.textContent = `http://${displayIp}:${port}/scenario/controller/phoneController.html`;
  if (displayIp === "YOUR_LAPTOP_IP") {
    connectionUrl.previousElementSibling.innerHTML =
      "Connect your phone to the same Wi-Fi and (after finding your IP) go to:";
  }

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

  try {
    const { error } = await initFirebase();
    if (error) throw new Error(error);

    roomCode = await createGameSession(playerCount);
    if (!roomCode) throw new Error("Failed to create room.");

    roomCodeText.textContent = roomCode;
    if (lobbyRoomCode) lobbyRoomCode.textContent = roomCode;

    let gameStarted = false;
    firebaseUnsubscribe = listenForRemoteInputs(roomCode, (sessionData) => {
      if (!sessionData) return;

      if (gameStarted) {
        processRemoteInputs(sessionData);
        return;
      }

      let allConnected = true;
      const remotePlayers = sessionData.players || {};
      for (const playerKey of requiredPlayers) {
        if (remotePlayers[playerKey] && remotePlayers[playerKey].connected) {
          const statusEl = document.getElementById(`status-${playerKey}`);
          if (statusEl) {
            statusEl.textContent = `P${playerKey.charAt(1)}: Connected!`;
            statusEl.classList.add("connected");
          }
        } else {
          allConnected = false;
        }
      }

      if (allConnected) {
        gameStarted = true;
        for (const playerKey of requiredPlayers) {
          if (remotePlayers[playerKey] && remotePlayers[playerKey].inputs) {
            remoteInputsState[playerKey] = remotePlayers[playerKey].inputs;
          }
        }
        setGameState(roomCode, "running");
        initializeGame(playerCount);
      }
    });
  } catch (e) {
    console.error("Lobby setup failed:", e);
    roomCodeText.textContent = "ERROR";
    if (lobbyRoomCode) lobbyRoomCode.textContent = "ERROR";
  }
}

function ensurePauseUI() {
  if (!pauseToggle) {
    pauseToggle = document.createElement("button");
    pauseToggle.id = "pauseToggle";
    pauseToggle.className = "audio-toggle-button pause-toggle-button";
    pauseToggle.type = "button";
    pauseToggle.ariaLabel = "Pause Game";

    const audioControls = document.querySelector(".audio-controls");
    if (audioControls) {
      audioControls.insertBefore(pauseToggle, audioControls.firstChild);
    } else {
      document.body.appendChild(pauseToggle);
      pauseToggle.style.position = "absolute";
      pauseToggle.style.top = "1rem";
    }
  }

  pauseToggle.textContent = GAME_PAUSED ? "▶" : "⏸";

  if (!pauseOverlay) {
    pauseOverlay = document.createElement("div");
    pauseOverlay.id = "pauseOverlay";
    pauseOverlay.className = "pause-overlay hidden";
    pauseOverlay.innerHTML = `
        <h1 class="pause-title">GAME PAUSED</h1>
        <button id="resumeButton" class="game-over-button resume-button" type="button">RESUME</button>
        <button id="quitButton" class="game-over-button quit-button" type="button">QUIT GAME</button>
    `;
    document.body.appendChild(pauseOverlay);
  }

  resumeButton = document.getElementById("resumeButton");
  quitButton = document.getElementById("quitButton");
}

async function initializeGame(playerCount) {
  try {
    if (!constants) {
      constants = await loadConstants();
    }

    if (backgroundImages.length === 0) {
      const bgSources = constants.BACKGROUND.BACKGROUND_IMAGES || 
          (constants.BACKGROUND.BACKGROUND_IMAGE_SRC ? [constants.BACKGROUND.BACKGROUND_IMAGE_SRC] : []);
      
      const validSources = bgSources.filter(src => src);

      if (validSources.length > 0) {
          backgroundImages = await Promise.all(
             validSources.map((src) => loadImage(src))
          );
      }
    }

    currentBackgroundIndex = 0;
    if (backgroundImages.length > 0) {
      backgroundImage = backgroundImages[currentBackgroundIndex];
    }

    if (!mapData) {
      mapData = generateMap(canvas, constants);
    }

    levelStats = constants;

    for (let i = 0; i < playerCount; i++) {
      if (constants.PLAYER_DATA[i]) {
        const player = new PlayerController(
          constants,
          mapData,
          canvas,
          constants.PLAYER_DATA[i],
          i,
          constants.STATS,
          () => {
            if (sfxJump) {
              sfxJump.currentTime = 0;
              sfxJump.play().catch(() => {});
            }
          },
        );
        players.push(player);
      }
    }

    const preventDefaultKeys = createPreventDefaultKeys(
      constants.INPUT,
      constants.PLAYER_DATA,
    );
    const exitKey = constants.INPUT.EXIT_KEY;
    const exitDestination = constants.INPUT.EXIT_DESTINATION;

    document.addEventListener("keydown", (event) => {
      if (preventDefaultKeys.has(event.code)) {
        event.preventDefault();
      }
      pressedKeys.add(event.code);
      if (event.code === exitKey) {
        handleQuit();
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

    initializeHUD(players);

    if (returnMenuButton) {
      returnMenuButton.classList.add("hidden");

      returnMenuButton.addEventListener("click", async () => {
        if (roomCode) {
          await deleteGameSession(roomCode);
        }
        if (firebaseUnsubscribe) firebaseUnsubscribe();
        window.location.href = exitDestination;
      });
    }

    ensurePauseUI();

    if (pauseToggle) {
      pauseToggle.addEventListener("click", () => {
        if (upgradeOverlay.classList.contains("hidden")) {
          toggleGamePause(!GAME_PAUSED);
        }
      });
    }
    if (resumeButton) {
      resumeButton.addEventListener("click", handleResume);
    }
    if (quitButton) {
      quitButton.addEventListener("click", handleQuit);
    }

    leveller = new Leveller(constants, constants.INITIAL_LEVEL || 1);

    connectionOverlay.classList.add("hidden");
    lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
  } catch (error) {
    console.error("Failed to initialize the game:", error);
    if (!connectionOverlay.classList.contains("hidden")) {
      roomCodeText.textContent = "FATAL";
      if (lobbyRoomCode) lobbyRoomCode.textContent = "FATAL";
    }
  }
}

function initializeHUD(players) {
  hudContainer.innerHTML = "";
  playerHUDElements.length = 0;

  let globalLevelContainer = document.createElement("div");
  globalLevelContainer.id = "global-level-counter";
  globalLevelContainer.className = "level-counter";

  const levelText = document.createElement("span");
  levelText.id = "level-text";
  levelText.className = "level-text";
  levelText.textContent = "Level: 1";
  globalLevelContainer.appendChild(levelText);

  let progressBar = document.createElement("div");
  progressBar.id = "level-progress-bar";
  progressBar.className = "level-progress-bar";

  let innerBar = document.createElement("div");
  innerBar.id = "level-progress-inner";
  innerBar.className = "level-progress-inner";
  progressBar.appendChild(innerBar);

  globalLevelContainer.appendChild(progressBar);
  hudContainer.appendChild(globalLevelContainer);

  players.forEach((player) => {
    const playerHud = document.createElement("div");
    playerHud.className = "player-hud";
    playerHud.id = `player-hud-${player.playerIndex}`;
    playerHud.style.borderColor =
      constants.PLAYER_DATA[player.playerIndex].color;

    const label = document.createElement("span");
    label.className = "player-label";
    label.textContent = `P${player.playerIndex + 1}`;
    playerHud.appendChild(label);

    const livesContainer = document.createElement("div");
    livesContainer.className = "lives";
    livesContainer.setAttribute(
      "aria-label",
      `P${player.playerIndex + 1} Lives: ${player.stats.MAX_LIVES}`,
    );

    const hearts = [];
    for (let j = 0; j < player.stats.MAX_LIVES; j++) {
      const heart = document.createElement("span");
      heart.className = "heart";
      heart.setAttribute("aria-hidden", "true");
      heart.textContent = "❤";
      livesContainer.appendChild(heart);
      hearts.push(heart);
    }

    playerHud.appendChild(livesContainer);
    hudContainer.appendChild(playerHud);

    playerHUDElements[player.playerIndex] = {
      container: livesContainer,
      hearts: hearts,
    };
  });
}

function updatePlayerLivesDisplay(playerIndex, lives) {
  const hud = playerHUDElements[playerIndex];
  if (!hud) return;

  hud.hearts.forEach((heart, index) => {
    heart.classList.toggle("lost", index >= lives);
  });
  hud.container.setAttribute(
    "aria-label",
    `P${playerIndex + 1} Lives left: ${lives}`,
  );
}

function damagePlayer(player, timestamp) {
  if (isGameOver || player.isDead) return;

  if (
    timestamp - player.lastDamageAt <
    constants.PLAYER.INVINCIBILITY_WINDOW_MS
  ) {
    return;
  }

  player.lastDamageAt = timestamp;
  player.triggerDamageFeedback(timestamp);
  player.lives = Math.max(0, player.lives - 1);

  updatePlayerLivesDisplay(player.playerIndex, player.lives);

  if (sfxHit) {
    try {
      sfxHit.currentTime = 0;
      sfxHit.play().catch(() => {});
    } catch {}
  }
  if (player.lives <= 0) {
    player.isDead = true;
    checkAllPlayersDead();
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

  if (roomCode) {
    setGameState(roomCode, "gameover");
  }

  if (firebaseUnsubscribe) {
    firebaseUnsubscribe();
    firebaseUnsubscribe = null;
  }

  if (musicAudioElement) {
    const startVol = musicAudioElement.volume ?? 0.35;
    const duration = 500;
    const step = 40;
    let elapsed = 0;
    const id = setInterval(() => {
      elapsed += step;
      const t = Math.min(1, elapsed / duration);
      musicAudioElement.volume = startVol * (1 - t);
      if (t >= 1) {
        clearInterval(id);
        musicAudioElement.pause();
        musicAudioElement.volume = startVol;
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
    returnMenuButton.classList.remove("hidden");
    returnMenuButton.hidden = false;
    returnMenuButton.style.display = "block";
    returnMenuButton.focus({ preventScroll: true });
  }
}

function handlePlayerShooting(timestamp) {
  players.forEach((player) => {
    if (player.isDead) return;

    const direction = GameLogic.getShootingDirectionFromKeys(
      player,
      pressedKeys,
    );
    if (!direction) return;

    const STATS = player.getStats();
    if (timestamp - player.lastPlayerShot < STATS.COOLDOWN_MS) return;

    if (sfxShoot) {
      sfxShoot.currentTime = 0;
      sfxShoot.play().catch(() => {});
    }

    player.lastPlayerShot = timestamp;
    const center = player.getCenter();
    playerBullets.push(
      new Bullet({
        x: center.x,
        y: center.y,
        direction,
        speed: constants.PLAYER_BULLET.SPEED,
        radius: STATS.RADIUS,
        color: constants.PLAYER_BULLET.COLOR,
        damage: STATS.DAMAGE,
      }),
    );
  });
}

function updateLevelProgressBar(levelInfo) {
  if (!leveller) return;

  const text_container = document.getElementById("level-text");
  if (text_container) {
    text_container.textContent = `Level: ${leveller.currentLevel}`;
  }

  const innerBar = document.getElementById("level-progress-inner");
  if (
    innerBar &&
    levelInfo &&
    typeof levelInfo.timeToNextLevel === "number" &&
    typeof leveller.timer === "number"
  ) {
    const percent = Math.max(
      0,
      Math.min(1, leveller.timer / levelInfo.timeToNextLevel),
    );
    innerBar.style.width = `${percent * 100}%`;
  }
}

function applyLevelChangesAndResume(newStats) {
  levelStats = newStats;

  const currentLevel = leveller ? leveller.currentLevel : 1;
  const redFactor = Math.min(1, (currentLevel - 1) * 0.1);

  if (backgroundImages.length > 1) {
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * backgroundImages.length);
    } while (newIndex === currentBackgroundIndex);

    currentBackgroundIndex = newIndex;
    backgroundImage = backgroundImages[currentBackgroundIndex];
  }

  if (constants && constants.TILE) {
    if (currentBackgroundIndex === 1 || currentBackgroundIndex === 3) {
      constants.TILE.GRASS_COLOR = "#8a2be2";
      constants.TILE.SOIL_COLOR = "#240046";
      constants.TILE.WALL_COLOR = "#240046";
      constants.TILE.HIGHLIGHT_COLOR = "rgba(180, 180, 255, 0.2)";
    } else {
      constants.TILE.GRASS_COLOR = GameLogic.blendColor(
        "#7ac74f",
        "#660000",
        redFactor,
      );
      constants.TILE.SOIL_COLOR = GameLogic.blendColor(
        "#5f3d24",
        "#2b0a0a",
        redFactor,
      );
      constants.TILE.WALL_COLOR = constants.TILE.SOIL_COLOR;
      constants.TILE.HIGHLIGHT_COLOR = `rgba(255, ${Math.floor(255 * (1 - redFactor))}, ${Math.floor(255 * (1 - redFactor))}, 0.15)`;
    }
  }

  mapData = generateMap(canvas, constants);

  players.forEach((player) => {
    player.respawn(mapData);
  });

  enemies = [];
  playerBullets = [];
  enemyBullets = [];
  lastSpawnTimestamp = -Infinity;

  enemies.forEach((enemy) => {
    if (typeof enemy.updateStats === "function") {
      enemy.updateStats(newStats);
    }
  });

  toggleGamePause(false);
}

function toggleGamePause(pauseState) {
  GAME_PAUSED = pauseState;
  if (pauseToggle) {
    pauseToggle.classList.toggle("paused", pauseState);
    pauseToggle.textContent = pauseState ? "▶" : "⏸";
  }
  if (pauseOverlay) {
    pauseOverlay.classList.toggle("hidden", !pauseState);
  }
}

function handlePause() {
  if (
    !isGameOver &&
    !GAME_PAUSED &&
    !upgradeOverlay.classList.contains("hidden")
  ) {
    toggleGamePause(true);
    upgradeOverlay.classList.add("hidden");
  }
}

function handleResume() {
  if (GAME_PAUSED) {
    toggleGamePause(false);
  }
}

async function handleQuit() {
  const exitDestination =
    constants?.INPUT?.EXIT_DESTINATION || "../menu/menu.html";

  if (roomCode) {
    await deleteGameSession(roomCode);
  }

  if (firebaseUnsubscribe) firebaseUnsubscribe();
  window.location.href = exitDestination;
}

function handleLevelUp(activePlayers, newStats) {
  console.log(
    `Level Up to ${leveller.currentLevel}! Starting upgrade process.`,
  );
  GAME_PAUSED = true;
  upgradeOverlay.classList.remove("hidden");
  pauseOverlay.classList.add("hidden");

  playerUpgradeQueue = activePlayers.filter((p) => !p.isDead);
  currentUpgradePlayerIndex = 0;

  if (playerUpgradeQueue.length > 0) {
    startUpgradeProcess(newStats);
  } else {
    applyLevelChangesAndResume(newStats);
  }
}

function startUpgradeProcess(newStats) {
  if (currentUpgradePlayerIndex < playerUpgradeQueue.length) {
    const player = playerUpgradeQueue[currentUpgradePlayerIndex];
    const powers = GameLogic.selectRandomPowers(
      Object.keys(constants.LEVELING.POWERS.PLAYER),
      constants.LEVELING.POWERS.CHOICES,
    );
    showUpgradeScreen(player, powers, newStats);
  } else {
    console.log(
      "All players upgraded. Applying global changes and resuming game.",
    );
    upgradeOverlay.classList.add("hidden");
    applyLevelChangesAndResume(newStats);
  }
}

function showUpgradeScreen(player, powers, newStats) {
  const playerConfig = constants.PLAYER_DATA.find((p) => p.id === player.id);
  const playerColor = playerConfig ? playerConfig.color : "#FFFFFF";

  currentPlayerPrompt.innerHTML = `Player ${player.playerIndex + 1} (${playerColor} color), choose your upgrade.`;
  currentPlayerPrompt.style.color = playerColor;

  powerUpContainer.innerHTML = "";

  powers.forEach((powerKey) => {
    const powerData = constants.LEVELING.POWERS.PLAYER[powerKey];
    if (!powerData) return;

    const button = document.createElement("button");
    button.className = "power-up-button";
    button.innerText = powerData.TEXT;
    button.setAttribute("data-power-key", powerKey);

    button.addEventListener("click", () => {
      powerUpContainer
        .querySelectorAll("button")
        .forEach((btn) => (btn.disabled = true));

      const result = GameLogic.applyPowerUp(
        player,
        powerKey,
        powerData,
        constants,
      );
      if (result && result.type === "LIVES") {
        initializeHUD(players);
        updatePlayerLivesDisplay(player.playerIndex, result.newValue);
      }

      currentUpgradePlayerIndex++;
      startUpgradeProcess(newStats);
    });

    powerUpContainer.appendChild(button);
  });
}

function gameLoop(timestamp) {
  const deltaTime = Math.min((timestamp - lastFrameTime) / 1000, 0.05);
  lastFrameTime = timestamp;

  if (!isGameOver) {
    if (!GAME_PAUSED) {
      players.forEach((player) => player.update(pressedKeys));
      handlePlayerShooting(timestamp);

      // --- SPAWN LOGIC ---
      if (
        timestamp - lastSpawnTimestamp >=
        levelStats.ENEMIES.SPAWN_INTERVAL_MS
      ) {
        const newEnemies = GameLogic.spawnEnemyGroup(
          levelStats,
          canvas,
          mapData,
          constants,
        );
        enemies.push(...newEnemies);
        lastSpawnTimestamp = timestamp;
      }

      // --- UPDATE LOGIC ---
      // Update Enemies
      enemies = GameLogic.updateEnemies(
        enemies,
        deltaTime,
        timestamp,
        players,
        canvas,
        enemyBullets,
      );

      // Update Player Bullets
      playerBullets = GameLogic.updatePlayerBullets(
        playerBullets,
        enemies,
        deltaTime,
        canvas,
        mapData,
        constants,
        {
          onHit: () => {
            if (sfxHit) {
              sfxHit.currentTime = 0;
              sfxHit.play().catch(() => {});
            }
          },
        },
      );

      // Update Enemy Bullets
      enemyBullets = GameLogic.updateEnemyBullets(
        enemyBullets,
        players,
        deltaTime,
        timestamp,
        canvas,
        mapData,
        constants,
        {
          onPlayerHit: (player, time) => damagePlayer(player, time),
        },
      );

      // Handle Body Collisions
      GameLogic.handleEnemyBodyCollisions(enemies, players, timestamp, {
        onPlayerHit: (player, time) => damagePlayer(player, time),
      });
    }

    if (leveller && !GAME_PAUSED) {
      let level_update_info = leveller.update(deltaTime);
      updateLevelProgressBar(level_update_info);
      if (level_update_info.newStats) {
        console.log("Level Up Detected. Triggering upgrade process.");
        handleLevelUp(players, level_update_info.newStats);
      }
    }
  }

  const currentLvl = leveller ? leveller.currentLevel : 1;
  drawBackground(ctx, backgroundImage, canvas, currentLvl);

  drawTiles(mapData, constants, ctx);
  enemies.forEach((enemy) => enemy.draw(ctx));
  enemyBullets.forEach((bullet) => bullet.draw(ctx));
  playerBullets.forEach((bullet) => bullet.draw(ctx));
  players.forEach((player) => player.draw(ctx));

  if (isGameOver) {
    drawGameOverOverlay(ctx, canvas);
  }

  requestAnimationFrame(gameLoop);
}

async function main() {
  const urlParams = new URLSearchParams(window.location.search);
  const playerCount = parseInt(urlParams.get("players") || "1", 10);

  if (playerCount === 1) {
    initializeGame(1).catch((error) => {
      console.error("Failed to initialize 1-player game:", error);
    });
  } else {
    try {
      constants = await loadConstants();
      
      // --- FIX: Handle array of images safely for Multiplayer too ---
      // The original code here tried to load constants.BACKGROUND.BACKGROUND_IMAGE_SRC
      // which is now undefined.
      const bgSources = constants.BACKGROUND.BACKGROUND_IMAGES || 
          (constants.BACKGROUND.BACKGROUND_IMAGE_SRC ? [constants.BACKGROUND.BACKGROUND_IMAGE_SRC] : []);
      
      if (bgSources.length > 0) {
          backgroundImage = await loadImage(bgSources[0]);
      }
      // -------------------------------------------------------------

      mapData = generateMap(canvas, constants);
      await setupLobby(playerCount);
    } catch (error) {
      console.error("Failed to pre-load assets or set up lobby:", error);
      connectionOverlay.classList.remove("hidden");
      roomCodeText.textContent = "FATAL";
      if (lobbyRoomCode) lobbyRoomCode.textContent = "FATAL";
      connectionUrl.textContent = "Could not load game assets. Please refresh.";
    }
  }
}

main();