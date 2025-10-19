import { generateMap } from './helper/map.js';
import { PlayerController } from './player.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

async function loadConstants() {
  const response = await fetch('./constants.json');
  if (!response.ok) {
    throw new Error('Unable to load constants.json');
  }
  return response.json();
}

function createKeySet(values) {
  return new Set(values);
}

function drawCloud(ctxInstance, cloud, shapes, constants) {
  ctxInstance.beginPath();
  shapes.forEach((shape) => {
    ctxInstance.ellipse(
      cloud.CENTER_X + shape.OFFSET_X,
      cloud.CENTER_Y + shape.OFFSET_Y,
      shape.RADIUS_X,
      shape.RADIUS_Y,
      0,
      0,
      Math.PI * constants.GENERAL.TWO_PI_MULTIPLIER
    );
  });
  ctxInstance.fill();
}

function drawBackground(ctxInstance, constants) {
  ctxInstance.fillStyle = constants.BACKGROUND.SKY_COLOR;
  ctxInstance.fillRect(0, 0, canvas.width, canvas.height);

  constants.BACKGROUND.MOUNTAINS.forEach((mountain) => {
    ctxInstance.beginPath();
    const baseY = canvas.height;
    mountain.POINTS.forEach((point, index) => {
      const pointY = baseY - point.Y_OFFSET;
      if (index === 0) {
        ctxInstance.moveTo(point.X, pointY);
      } else {
        ctxInstance.lineTo(point.X, pointY);
      }
    });
    ctxInstance.closePath();
    ctxInstance.fillStyle = mountain.COLOR;
    ctxInstance.fill();
  });

  ctxInstance.fillStyle = constants.BACKGROUND.CLOUD_COLOR;
  constants.BACKGROUND.CLOUDS.forEach((cloud) => {
    drawCloud(ctxInstance, cloud, constants.BACKGROUND.CLOUD_SHAPES, constants);
  });
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

async function initializeGame() {
  const constants = await loadConstants();
  const mapData = generateMap(canvas, constants);
  const playerController = new PlayerController(constants, mapData, canvas);

  const pressedKeys = new Set();
  const preventDefaultKeys = createKeySet(constants.INPUT.PREVENT_DEFAULT_KEYS);
  const jumpKeys = createKeySet(constants.INPUT.JUMP_KEYS);
  const exitKey = constants.INPUT.EXIT_KEY;
  const exitDestination = constants.INPUT.EXIT_DESTINATION;

  function gameLoop() {
    playerController.update(pressedKeys);
    drawBackground(ctx, constants);
    drawTiles(mapData, constants);
    playerController.draw(ctx);
    requestAnimationFrame(gameLoop);
  }

  document.addEventListener('keydown', (event) => {
    if (preventDefaultKeys.has(event.code)) {
      event.preventDefault();
    }

    pressedKeys.add(event.code);

    if (event.code === exitKey) {
      window.location.href = exitDestination;
      return;
    }

    if (jumpKeys.has(event.code)) {
      playerController.queueJump();
    }
  });

  document.addEventListener('keyup', (event) => {
    pressedKeys.delete(event.code);
  });

  requestAnimationFrame(gameLoop);
}

initializeGame().catch((error) => {
  console.error('Failed to initialize the game:', error);
});

