import { TriangleEnemy } from "../enemies/triangle.js";
import { CircleEnemy } from "../enemies/circle.js";
import { SquareEnemy } from "../enemies/square.js";
import { Bullet } from "../helper/bullet.js";
import { isSolidTile } from "../helper/map.js";

// --- Math & Helper Utils ---
export function rectanglesIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function blendColor(hexColor1, hexColor2, factor) {
  const r1 = parseInt(hexColor1.substring(1, 3), 16);
  const g1 = parseInt(hexColor1.substring(3, 5), 16);
  const b1 = parseInt(hexColor1.substring(5, 7), 16);

  const r2 = parseInt(hexColor2.substring(1, 3), 16);
  const g2 = parseInt(hexColor2.substring(3, 5), 16);
  const b2 = parseInt(hexColor2.substring(5, 7), 16);

  const r = Math.round(r1 + (r2 - r1) * factor);
  const g = Math.round(g1 + (g2 - g1) * factor);
  const b = Math.round(b1 + (b2 - b1) * factor);

  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function selectRandomPowers(allPowersKeys, count) {
  const selectedPowers = new Set();
  if (count >= allPowersKeys.length) return allPowersKeys;

  while (selectedPowers.size < count) {
    const randomIndex = Math.floor(Math.random() * allPowersKeys.length);
    selectedPowers.add(allPowersKeys[randomIndex]);
  }
  return Array.from(selectedPowers);
}

// --- Player Logic ---

export function applyPowerUp(player, powerKey, powerData, constants) {
  if (!player || !powerData) return null;

  let statKey = null;
  const playerStats = player.getStats();

  switch (powerKey) {
    case "SIZE":
      statKey = "SIZE";
      break;
    case "SPEED":
      statKey = "MAX_SPEED";
      break;
    case "MAX_LIVES":
      statKey = "MAX_LIVES";
      break;
    case "RADIUS":
      statKey = "RADIUS";
      break;
    case "COOLDOWN_MS":
      statKey = "COOLDOWN_MS";
      break;
    case "DAMAGE":
      statKey = "DAMAGE";
      break;
    default:
      return null;
  }

  if (statKey === "MAX_LIVES") {
    playerStats.MAX_LIVES += powerData.MULTIPLIER;
    player.lives = Math.min(
      playerStats.MAX_LIVES,
      player.lives + powerData.MULTIPLIER,
    );
    return { type: "LIVES", newValue: player.lives };
  } else {
    const currentValue = playerStats[statKey];
    let newValue = currentValue * powerData.MULTIPLIER;

    if (powerData.CAP && newValue > powerData.CAP) {
      newValue = powerData.CAP;
    } else if (powerData.MIN_CAP && newValue < powerData.MIN_CAP) {
      newValue = powerData.MIN_CAP;
    }

    playerStats[statKey] = newValue;

    if (statKey === "SIZE") {
      player.state.width = newValue;
      player.state.height = newValue;
    } else if (statKey === "MAX_SPEED") {
      player.maxSpeed = newValue;
    }
    return { type: "STAT", stat: statKey, newValue };
  }
}

export function getShootingDirectionFromKeys(player, keys) {
  let directionX = 0;
  let directionY = 0;
  let hasInput = false;
  const shootKeys = player.playerData.inputs.shoot;

  // shootKeys: [Up, Down, Left, Right]
  const keyMap = {
    [shootKeys[0]]: { y: -1 },
    [shootKeys[1]]: { y: 1 },
    [shootKeys[2]]: { x: -1 },
    [shootKeys[3]]: { x: 1 },
  };

  for (const key in keyMap) {
    if (keys.has(key)) {
      hasInput = true;
      directionX += keyMap[key].x || 0;
      directionY += keyMap[key].y || 0;
    }
  }

  if (!hasInput || (directionX === 0 && directionY === 0)) {
    return null;
  }

  return { x: directionX, y: directionY };
}

// --- Enemy Logic ---

export function spawnEnemyGroup(levelStats, canvas, mapData, constants) {
  const { MIN, MAX } = levelStats.ENEMIES.GROUP_SIZE;
  const totalEnemies = Math.floor(Math.random() * (MAX - MIN + 1)) + MIN;
  const newEnemies = [];

  while (newEnemies.length < totalEnemies) {
    const enemyTypes = [TriangleEnemy, CircleEnemy, SquareEnemy];
    const enemyClass =
      enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

    if (enemyClass === SquareEnemy) {
      newEnemies.push(new SquareEnemy(levelStats, canvas, mapData, constants));
    } else {
      newEnemies.push(new enemyClass(levelStats, canvas));
    }
  }
  return newEnemies;
}

export function updateEnemies(
  enemies,
  deltaTime,
  timestamp,
  players,
  canvas,
  enemyBullets,
) {
  const activePlayers = players.filter((p) => !p.isDead);
  if (activePlayers.length === 0 && players.length > 0) return enemies; // Game over usually, but strictly safe check

  const primaryTarget =
    activePlayers.length > 0 ? activePlayers[0] : players[0];
  const targetBounds = primaryTarget.getBounds();

  enemies.forEach((enemy) => {
    if (enemy instanceof TriangleEnemy) {
      enemy.update(deltaTime, targetBounds, timestamp, canvas, enemyBullets);
    } else {
      enemy.update(deltaTime, targetBounds, timestamp, canvas);
    }
  });

  return enemies.filter((enemy) => enemy.active);
}

// --- Collision & Bullet Logic ---

function bulletHitsTiles(bullet, mapData, constants) {
  if (!bullet.active) return false;

  const samplePoints = [
    { x: bullet.position.x, y: bullet.position.y },
    { x: bullet.position.x + bullet.radius / 4, y: bullet.position.y },
    { x: bullet.position.x - bullet.radius / 4, y: bullet.position.y },
    { x: bullet.position.x, y: bullet.position.y + bullet.radius / 4 },
    { x: bullet.position.x, y: bullet.position.y - bullet.radius / 4 },
  ];

  return samplePoints.some(({ x, y }) => {
    const row = Math.floor((y - mapData.verticalOffset) / constants.TILE_SIZE);
    const col = Math.floor(x / constants.TILE_SIZE);
    return isSolidTile(mapData.grid, row, col, constants);
  });
}

export function updatePlayerBullets(
  playerBullets,
  enemies,
  deltaTime,
  canvas,
  mapData,
  constants,
  callbacks,
) {
  // Update position
  playerBullets.forEach((bullet) => bullet.update(deltaTime, canvas));

  // Check Wall Collisions
  playerBullets.forEach((bullet) => {
    if (bulletHitsTiles(bullet, mapData, constants)) {
      bullet.active = false;
    }
  });

  // Check Enemy Collisions
  playerBullets.forEach((bullet) => {
    if (!bullet.active) return;

    for (const enemy of enemies) {
      if (!enemy.active) continue;
      if (typeof enemy.isDying === "function" && enemy.isDying()) continue;

      if (bullet.intersectsRect(enemy.getBounds())) {
        bullet.active = false;
        enemy.takeHit(bullet.damage);

        if (callbacks.onHit) callbacks.onHit();
        break;
      }
    }
  });

  return playerBullets.filter((bullet) => bullet.active);
}

export function updateEnemyBullets(
  enemyBullets,
  players,
  deltaTime,
  timestamp,
  canvas,
  mapData,
  constants,
  callbacks,
) {
  // Update position
  enemyBullets.forEach((bullet) => bullet.update(deltaTime, canvas));

  // Check Wall Collisions
  enemyBullets.forEach((bullet) => {
    if (bulletHitsTiles(bullet, mapData, constants)) {
      bullet.active = false;
    }
  });

  // Check Player Collisions
  enemyBullets.forEach((bullet) => {
    if (!bullet.active) return;

    for (const player of players) {
      if (player.isDead) continue;

      if (bullet.intersectsRect(player.getBounds())) {
        bullet.active = false;
        if (callbacks.onPlayerHit) callbacks.onPlayerHit(player, timestamp);
        break;
      }
    }
  });

  return enemyBullets.filter((bullet) => bullet.active);
}

export function handleEnemyBodyCollisions(
  enemies,
  players,
  timestamp,
  callbacks,
) {
  enemies.forEach((enemy) => {
    // Only Contact damage enemies
    if (!(enemy instanceof CircleEnemy) && !(enemy instanceof SquareEnemy))
      return;
    if (enemy.isSpawning) return;
    if (typeof enemy.isDying === "function" && enemy.isDying()) return;

    for (const player of players) {
      if (player.isDead) continue;

      if (rectanglesIntersect(enemy.getBounds(), player.getBounds())) {
        if (callbacks.onPlayerHit) callbacks.onPlayerHit(player, timestamp);
      }
    }
  });
}
