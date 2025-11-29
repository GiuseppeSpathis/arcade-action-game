function drawBackground(ctxInstance, bgImage, canvas, level = 1) {
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

  // Apply red tint based on level
  if (level > 1) {
    ctxInstance.save();
    // Cap opacity at 0.4 so the background remains visible
    const opacity = Math.min(0.4, (level - 1) * 0.05);
    ctxInstance.fillStyle = `rgba(139, 0, 0, ${opacity})`;
    ctxInstance.globalCompositeOperation = 'multiply';
    ctxInstance.fillRect(0, 0, canvas.width, canvas.height);
    ctxInstance.restore();
  }
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

function drawTiles(map, consts, ctx) {
  const tileSize = consts.TILE_SIZE;
  const offsetY = map.verticalOffset;

  for (let row = 0; row < map.grid.length; row += 1) {
    for (let col = 0; col < map.grid[row].length; col += 1) {
      const tileValue = map.grid[row][col];
      const tileX = col * tileSize;
      const tileY = offsetY + row * tileSize;

      if (tileValue === consts.MAP.SOLID_TILE_VALUE) {
        drawTile(ctx, tileX, tileY, tileSize, consts);
      } else if (tileValue === consts.MAP.WALL_TILE_VALUE) {
        ctx.fillStyle = consts.TILE.WALL_COLOR;
        
        // Fill the top gap 
        if (row === 0) {
          // If this is the top row, draw from the very top of the canvas (y=0)
          // down to the bottom of this tile.
          const totalHeight = tileSize + offsetY;
          ctx.fillRect(tileX, 0, tileSize, totalHeight);
        } else {
          // Standard drawing for other rows
          ctx.fillRect(tileX, tileY, tileSize, tileSize);
        }
       
      }
    }
  }
}

function drawGameOverOverlay(ctx, canvas) {
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
    fontSize * 0.4,
  )}px 'Press Start 2P', 'Courier New', monospace`;
  ctx.fillText(
    "Press the button to return to the menu",
    canvas.width / 2,
    canvas.height / 2 + fontSize,
  );
  ctx.restore();
}

export { drawBackground, drawTiles, loadImage, drawGameOverOverlay };