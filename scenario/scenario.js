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
  const rows = Math.max(1, Math.floor(canvas.height / tileSize));
  const cols = Math.max(1, Math.floor(canvas.width / tileSize));
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));

  const verticalOffset = Math.max(0, canvas.height - rows * tileSize);

  const FLOOR_ROW = rows - 1;
  for (let c = 0; c < cols; c += 1) grid[FLOOR_ROW][c] = 1;

  const platforms = [{ row: FLOOR_ROW, colStart: 0, colEnd: cols - 1 }];

  const MIN_VERTICAL_GAP = 2;
  const MAX_VERTICAL_GAP = 3;
  const TOP_MARGIN = 2;

  const desiredLayers = 3 + Math.floor(Math.random() * 3);
  const maxLayersPossible = Math.max(
    1,
    Math.floor((FLOOR_ROW - TOP_MARGIN) / MIN_VERTICAL_GAP) + 1
  );
  const targetLayers = Math.min(desiredLayers, maxLayersPossible);

  const layerRows = [FLOOR_ROW];
  let lastRow = FLOOR_ROW;

  while (layerRows.length < targetLayers) {
    const remaining = targetLayers - layerRows.length;
    let maxGap = lastRow - (TOP_MARGIN + (remaining - 1) * MIN_VERTICAL_GAP);
    if (maxGap < MIN_VERTICAL_GAP) {
      maxGap = MIN_VERTICAL_GAP;
    }
    maxGap = Math.min(maxGap, MAX_VERTICAL_GAP);

    if (maxGap < MIN_VERTICAL_GAP) {
      break;
    }

    const gap = MIN_VERTICAL_GAP + Math.floor(Math.random() * (maxGap - MIN_VERTICAL_GAP + 1));
    let nextRow = lastRow - gap;

    if (nextRow < TOP_MARGIN) {
      nextRow = TOP_MARGIN;
    }

    if (lastRow - nextRow < MIN_VERTICAL_GAP) {
      nextRow = lastRow - MIN_VERTICAL_GAP;
    }

    if (nextRow < TOP_MARGIN) {
      break;
    }

    layerRows.push(nextRow);
    lastRow = nextRow;
  }

  for (let i = 1; i < layerRows.length; i += 1) {
    const row = layerRows[i];
    const segments = [];

    let col = Math.floor(Math.random() * 2);
    let hasLongSegment = false;

    while (col < cols) {
      col += Math.floor(Math.random() * 3);
      if (col >= cols) break;

      const maxSegmentLength = Math.max(3, Math.floor(cols / 3));
      const segmentLength =
        1 + Math.floor(Math.random() * Math.max(1, maxSegmentLength));
      const colEnd = Math.min(cols - 1, col + segmentLength - 1);

      segments.push({ row, colStart: col, colEnd });
      hasLongSegment = hasLongSegment || colEnd - col + 1 >= 3;

      for (let c = col; c <= colEnd; c += 1) {
        grid[row][c] = 1;
      }

      col = colEnd + 1 + Math.floor(Math.random() * 3);
    }

    if (segments.length === 0) {
      const start = Math.max(0, Math.floor(cols / 2) - 1);
      const end = Math.min(cols - 1, start + 2);
      for (let c = start; c <= end; c += 1) {
        grid[row][c] = 1;
      }
      segments.push({ row, colStart: start, colEnd: end });
      hasLongSegment = true;
    }

    if (!hasLongSegment) {
      const firstSegment = segments[0];
      const needed = 3 - (firstSegment.colEnd - firstSegment.colStart + 1);
      firstSegment.colEnd = Math.min(cols - 1, firstSegment.colEnd + needed);
      for (let c = firstSegment.colStart; c <= firstSegment.colEnd; c += 1) {
        grid[row][c] = 1;
      }
    }

    platforms.push(...segments);
  }

  return { grid, platforms, floorRow: FLOOR_ROW, cols, verticalOffset };
}

const mapData = generateMap();
const map = mapData.grid;
const spawnCol = Math.floor(mapData.cols / 2);
const spawnRow = mapData.floorRow;
const mapOffsetY = mapData.verticalOffset;

const COYOTE_FRAMES = 7;
const JUMP_BUFFER_FRAMES = 4;

const player = {
  width: 34,
  height: 48,
  x: spawnCol * tileSize + (tileSize - 34) / 2,
  y: mapOffsetY + spawnRow * tileSize - 48 - 0.01,
  vx: 0,
  vy: 0,
  speed: 0.75,
  maxSpeed: 4.2,
  jumpForce: -18,
  onGround: true,
  coyoteFrames: 0,
  jumpBufferFrames: 0,
};

const pressedKeys = new Set();

const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW']);

function queueJump() {
  player.jumpBufferFrames = JUMP_BUFFER_FRAMES;
}

function executeJump() {
  player.vy = player.jumpForce;
  player.onGround = false;
  player.coyoteFrames = 0;
  player.jumpBufferFrames = 0;

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
  const top = Math.floor((y - mapOffsetY) / tileSize);
  const bottom = Math.floor((y + height - 1 - mapOffsetY) / tileSize);

  if (bottom < top) return false;

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
  if ((player.onGround || player.coyoteFrames > 0) && player.jumpBufferFrames > 0) {
    executeJump();
  }

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

  player.onGround = false;

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
  if (player.vy > 0) {
    if (checkCollision(nextX, nextY, player.width, player.height)) {
      nextY =
        Math.floor((player.y + player.height + player.vy - mapOffsetY) / tileSize) *
          tileSize +
        mapOffsetY -
        player.height -
        0.01;
      player.vy = 0;
      player.onGround = true;
      player.coyoteFrames = COYOTE_FRAMES;
    }
  } else if (player.vy < 0) {
    if (checkCollision(nextX, nextY, player.width, player.height)) {
      nextY = Math.floor((player.y - mapOffsetY) / tileSize) * tileSize + mapOffsetY + 0.01;
      player.vy = 0;
    }
  }

  player.x = Math.max(0, Math.min(nextX, canvas.width - player.width));
  player.y = Math.min(nextY, canvas.height - player.height);

  if (player.y >= canvas.height - player.height - 0.01) {
    player.onGround = true;
    player.vy = 0;
    player.coyoteFrames = COYOTE_FRAMES;
  }

  if ((player.onGround || player.coyoteFrames > 0) && player.jumpBufferFrames > 0) {
    executeJump();
  }

  if (!player.onGround && player.coyoteFrames > 0) {
    player.coyoteFrames -= 1;
  }

  if (player.jumpBufferFrames > 0) {
    player.jumpBufferFrames -= 1;
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
        const y = mapOffsetY + row * tileSize;
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
    queueJump();
  }
});

document.addEventListener('keyup', (event) => {
  pressedKeys.delete(event.code);
});

requestAnimationFrame(gameLoop);

