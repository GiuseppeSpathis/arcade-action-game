const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); 

const tileSize = 60;

function generateMap() {
  const rows = Math.floor(canvas.height / tileSize);
  const cols = Math.floor(canvas.width / tileSize);
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));

  const FLOOR_ROW = rows - 1;
  for (let c = 0; c < cols; c += 1) grid[FLOOR_ROW][c] = 1;

  const platforms = [{ row: FLOOR_ROW, colStart: 0, colEnd: cols - 1 }];

  const maxVerticalGap = 2;    
  const maxHorizontalGap = 3;   
  const totalSegments = Math.min(10, Math.max(5, Math.floor(cols / 6)));

  let attempts = 0;
  const maxAttempts = 800;

  function segmentIsReachable(r, cStart, cEnd) {
    for (const seg of platforms) {
      const vDist = Math.abs(seg.row - r);
      if (vDist > maxVerticalGap) continue;

      const overlap =
        !(cEnd < seg.colStart - maxHorizontalGap ||
          cStart > seg.colEnd + maxHorizontalGap);
      if (overlap) return true;
    }
    return false;
  }

  while (platforms.length < totalSegments && attempts < maxAttempts) {
    attempts += 1;

    const r =
      FLOOR_ROW - (2 + Math.floor(Math.random() * Math.min(6, FLOOR_ROW - 1)));

    const segLen = Math.max(3, Math.min(12, Math.floor(cols / 8) + Math.floor(Math.random() * 6)));

    let cStart = Math.floor(Math.random() * (cols - segLen));
    let cEnd = cStart + segLen - 1;

    if (!segmentIsReachable(r, cStart, cEnd)) continue;

    const clash = platforms.some(
      (s) => s.row === r && !(cEnd < s.colStart - 1 || cStart > s.colEnd + 1)
    );
    if (clash) continue;

    for (let c = cStart; c <= cEnd; c += 1) grid[r][c] = 1;
    platforms.push({ row: r, colStart: cStart, colEnd: cEnd });
  }

  return { grid, platforms, floorRow: FLOOR_ROW, cols };
}

const mapData = generateMap();
const map = mapData.grid;
const spawnCol = Math.floor(mapData.cols / 2);
const spawnRow = mapData.floorRow;

const player = {
  width: 34,
  height: 48,
  x: spawnCol * tileSize + (tileSize - 34) / 2,
  y: spawnRow * tileSize - 48 - 0.01,
  vx: 0,
  vy: 0,
  speed: 0.75,
  maxSpeed: 4.2,
  jumpForce: -14,
  onGround: true,
};

const pressedKeys = new Set();

const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);

function tryJump() {
  if (!player.onGround) return;
  player.vy = player.jumpForce;
  player.onGround = false;

  const impulse = player.maxSpeed * 0.6; 
  if (pressedKeys.has('ArrowLeft') || pressedKeys.has('KeyA')) {
    player.vx = Math.min(player.vx, 0);   
    player.vx = Math.max(player.vx, -impulse);
  } else if (pressedKeys.has('ArrowRight') || pressedKeys.has('KeyD')) {
    player.vx = Math.max(player.vx, 0);
    player.vx = Math.min(player.vx, impulse);
  }
}


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
  if (['ArrowLeft','ArrowRight','ArrowUp','Space','KeyA','KeyD','KeyW'].includes(event.code)) {
    event.preventDefault();
  }

  pressedKeys.add(event.code);

  if (event.code === 'Escape') {
    window.location.href = '../menu/menu.html';
    return;
  }

  if (JUMP_KEYS.has(event.code)) {
    tryJump(); 
  }
});

document.addEventListener('keyup', (event) => {
  pressedKeys.delete(event.code);
});

requestAnimationFrame(gameLoop);

