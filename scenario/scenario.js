import { setupAudioToggle } from "../helper/audioController.js";
import { generateMap } from "./helper/map.js";
import { PlayerController } from "./helper/player.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const audioElement = document.getElementById("bg_music");
const toggleButton = document.getElementById("musicToggle");
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
    return;}
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

async function initializeGame() {
    const constants = await loadConstants();
    const backgroundImage = await loadImage(constants.BACKGROUND.BACKGROUND_IMAGE_SRC);

    const mapData = generateMap(canvas, constants);
    const playerController = new PlayerController(constants, mapData, canvas);

    const pressedKeys = new Set();
    const preventDefaultKeys = createKeySet(
        constants.INPUT.PREVENT_DEFAULT_KEYS
    );
    const jumpKeys = createKeySet(constants.INPUT.JUMP_KEYS);
    const exitKey = constants.INPUT.EXIT_KEY;
    const exitDestination = constants.INPUT.EXIT_DESTINATION;

    function gameLoop() {
        playerController.update(pressedKeys);
        drawBackground(ctx, backgroundImage);
        drawTiles(mapData, constants);
        playerController.draw(ctx);
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

        if (jumpKeys.has(event.code)) {
            playerController.queueJump();
        }
    });

    document.addEventListener("keyup", (event) => {
        pressedKeys.delete(event.code);
    });

    requestAnimationFrame(gameLoop);
}

initializeGame().catch((error) => {
    console.error("Failed to initialize the game:", error);
});
