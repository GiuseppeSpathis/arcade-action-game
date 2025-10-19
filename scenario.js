const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const tileSize = 60;

function generateMap() {
  const rows = Math.floor(canvas.height / tileSize);
  const cols = Math.floor(canvas.width / tileSize);
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));
  const platforms = [];

  const totalPlatforms = Math.floor(Math.random() * 3) + 4; // 4-6 platforms
  const minVerticalGap = 2;
  const maxVerticalGap = 2;
  const maxHorizontalGap = 3;

  const startRow = Math.max(1, rows - 2);
  const startCol = Math.floor(Math.random() * cols);
  grid[startRow][startCol] = 1;
  platforms.push({ row: startRow, col: startCol });

  let attempts = 0;
  const maxAttempts = 600;

  const canPlace = (candidateRow, candidateCol) => {
    if (grid[candidateRow][candidateCol] === 1) return false;

    const verticalSpacingOk = platforms.every((platform) => {
      if (platform.col !== candidateCol) return true;
      return Math.abs(platform.row - candidateRow) >= minVerticalGap;
    });

    if (!verticalSpacingOk) {
      return false;
    }

    const reachable = platforms.some((platform) => {
      const verticalDistance = Math.abs(platform.row - candidateRow);
      const horizontalDistance = Math.abs(platform.col - candidateCol);
      if (verticalDistance === 0 && horizontalDistance === 0) return false;
      if (verticalDistance > maxVerticalGap || horizontalDistance > maxHorizontalGap) return false;
      if (verticalDistance === maxVerticalGap && horizontalDistance > 2) return false;
      return true;
    });

    return reachable;
  };

  while (platforms.length < totalPlatforms && attempts < maxAttempts) {
    attempts += 1;

    const base = platforms[Math.floor(Math.random() * platforms.length)];
    const verticalChoice = Math.random();

    let candidateRow = base.row;
    if (verticalChoice < 0.65) {
      const gap = minVerticalGap + Math.floor(Math.random() * (maxVerticalGap - minVerticalGap + 1));
      candidateRow = Math.max(1, base.row - gap);
    } else if (verticalChoice > 0.9 && base.row + minVerticalGap < rows - 1) {
      const gap = minVerticalGap + Math.floor(Math.random() * (maxVerticalGap - minVerticalGap + 1));
      candidateRow = Math.min(rows - 2, base.row + gap);
    }

    const horizontalOffset = Math.floor(Math.random() * (maxHorizontalGap * 2 + 1)) - maxHorizontalGap;
    let candidateCol = base.col + horizontalOffset;
    candidateCol = Math.max(0, Math.min(cols - 1, candidateCol));

    if ((candidateRow === base.row && candidateCol === base.col) || !canPlace(candidateRow, candidateCol)) {
      continue;
    }

    grid[candidateRow][candidateCol] = 1;
    platforms.push({ row: candidateRow, col: candidateCol });
  }

  if (platforms.length < totalPlatforms) {
    for (let row = 1; row < rows - 1 && platforms.length < totalPlatforms; row += 1) {
      for (let col = 0; col < cols && platforms.length < totalPlatforms; col += 1) {
        if (!canPlace(row, col)) continue;
        grid[row][col] = 1;
        platforms.push({ row, col });
      }
    }
  }

  return { grid, platforms };
}

const mapData = generateMap();
const map = mapData.grid;
const spawnPlatformIndex = Math.floor(Math.random() * mapData.platforms.length);
const spawnPlatform = mapData.platforms[spawnPlatformIndex] || mapData.platforms[0];

const player = {
  width: 34,
  height: 48,
  x: spawnPlatform.col * tileSize + (tileSize - 34) / 2,
  y: spawnPlatform.row * tileSize - 48 - 0.01,
  vx: 0,
  vy: 0,
  speed: 0.75,
  maxSpeed: 4.2,
  jumpForce: -14,
  onGround: true
};

const pressedKeys = new Set();

function isSolidTile(row, col) {
  if (row < 0 || row >= map.length) return false;
  if (col < 0 || col >= map[row].length) return false;
  return map[row][col] === 1;
}

function checkCollision(x, y, width, height) {
  const left = Math.floor(x / tileSize);
  const right = Math.floor((x + width - 1) / tileSize);
  const top = Math.floor(y / tileSize);
  const bottom = Math.floor((y + height - 1) / tileSize);

  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      if (isSolidTile(row, col)) {
        return true;
      }
    }
  }
  return false;
}

function updatePlayer() {
  const movingLeft = pressedKeys.has('ArrowLeft') || pressedKeys.has('KeyA');
  const movingRight = pressedKeys.has('ArrowRight') || pressedKeys.has('KeyD');

  if (movingLeft && !movingRight) {
    player.vx -= player.speed;
  } else if (movingRight && !movingLeft) {
    player.vx += player.speed;
  } else {
    player.vx *= 0.82;
    if (Math.abs(player.vx) < 0.05) player.vx = 0;
  }

  player.vx = Math.max(Math.min(player.vx, player.maxSpeed), -player.maxSpeed);

  player.vy += 0.65; // gravity
  if (player.vy > 14) player.vy = 14;

  let nextX = player.x + player.vx;
  let nextY = player.y + player.vy;

  if (player.vx > 0) {
    if (checkCollision(nextX, player.y, player.width, player.height)) {
      nextX = Math.floor((player.x + player.width + player.vx) / tileSize) * tileSize - player.width - 0.01;
      player.vx = 0;
    }
  } else if (player.vx < 0) {
    if (checkCollision(nextX, player.y, player.width, player.height)) {
      nextX = Math.floor(player.x / tileSize) * tileSize + 0.01;
      player.vx = 0;
    }
  }

  player.onGround = false;
  if (player.vy > 0) {
    if (checkCollision(nextX, nextY, player.width, player.height)) {
      nextY = Math.floor((player.y + player.height + player.vy) / tileSize) * tileSize - player.height - 0.01;
      player.vy = 0;
      player.onGround = true;
    }
  } else if (player.vy < 0) {
    if (checkCollision(nextX, nextY, player.width, player.height)) {
      nextY = Math.floor(player.y / tileSize) * tileSize + 0.01;
      player.vy = 0;
    }
  }

  player.x = Math.max(0, Math.min(nextX, canvas.width - player.width));
  player.y = Math.min(nextY, canvas.height - player.height);

  if (player.y >= canvas.height - player.height - 0.01) {
    player.onGround = true;
    player.vy = 0;
  }
}

function drawBackground() {
  ctx.fillStyle = '#9ce5ff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // simple mountains
  ctx.fillStyle = '#5ca1c4';
  ctx.beginPath();
  ctx.moveTo(-100, canvas.height);
  ctx.lineTo(200, canvas.height - 180);
  ctx.lineTo(500, canvas.height);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(300, canvas.height);
  ctx.lineTo(650, canvas.height - 140);
  ctx.lineTo(980, canvas.height);
  ctx.closePath();
  ctx.fillStyle = '#4a8fb8';
  ctx.fill();

  // clouds
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  drawCloud(140, 120);
  drawCloud(520, 80);
}

function drawCloud(x, y) {
  ctx.beginPath();
  ctx.ellipse(x, y, 55, 24, 0, 0, Math.PI * 2);
  ctx.ellipse(x + 40, y + 5, 45, 20, 0, 0, Math.PI * 2);
  ctx.ellipse(x - 40, y + 5, 45, 20, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawTiles() {
  for (let row = 0; row < map.length; row += 1) {
    for (let col = 0; col < map[row].length; col += 1) {
      if (map[row][col] === 1) {
        const x = col * tileSize;
        const y = row * tileSize;
        drawTile(x, y);
      }
    }
  }
}

function drawTile(x, y) {
  ctx.fillStyle = '#5f3d24';
  ctx.fillRect(x, y + tileSize - 18, tileSize, 18);
  ctx.fillStyle = '#7ac74f';
  ctx.fillRect(x, y, tileSize, tileSize - 18);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fillRect(x, y, tileSize, 6);
}

function drawPlayer() {
  ctx.fillStyle = '#111';
  ctx.fillRect(player.x, player.y, player.width, player.height);

  ctx.fillStyle = '#fff';
  ctx.fillRect(player.x + player.width - 10, player.y + 12, 6, 6);
}

function gameLoop() {
  updatePlayer();
  drawBackground();
  drawTiles();
  drawPlayer();
  requestAnimationFrame(gameLoop);
}

document.addEventListener('keydown', (event) => {
  pressedKeys.add(event.code);
  if (event.code === 'Escape') {
    window.location.href = 'menu.html';
    return;
  }
  if ((event.code === 'Space' || event.code === 'ArrowUp') && player.onGround) {
    player.vy = player.jumpForce;
    player.onGround = false;
  }
});

document.addEventListener('keyup', (event) => {
  pressedKeys.delete(event.code);
});

requestAnimationFrame(gameLoop);

