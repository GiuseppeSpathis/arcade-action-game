const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const tileSize = 60;
const map = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

// add floating platforms
map[6][10] = 1;
map[6][11] = 1;
map[6][12] = 1;
map[3][4] = 1;
map[3][5] = 1;
map[3][6] = 1;

const player = {
  width: 34,
  height: 48,
  x: tileSize * 1.5,
  y: canvas.height - tileSize * 2 - 48,
  vx: 0,
  vy: 0,
  speed: 0.75,
  maxSpeed: 4.2,
  jumpForce: -12,
  onGround: false
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
  if ((event.code === 'Space' || event.code === 'ArrowUp') && player.onGround) {
    player.vy = player.jumpForce;
    player.onGround = false;
  }
});

document.addEventListener('keyup', (event) => {
  pressedKeys.delete(event.code);
});

requestAnimationFrame(gameLoop);

