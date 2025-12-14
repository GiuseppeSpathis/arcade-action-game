// Procedurally generates the tile map, including floor and floating platforms
export function generateMap(canvas, constants) {
  const tileSize = constants.TILE_SIZE;
  const rows = Math.max(
    constants.GENERAL.MIN_GRID_DIMENSION,
    Math.floor(canvas.height / tileSize),
  );
  const cols = Math.max(
    constants.GENERAL.MIN_GRID_DIMENSION,
    Math.ceil(canvas.width / tileSize), 
  );
  const grid = Array.from({ length: rows }, () =>
    Array(cols).fill(constants.MAP.EMPTY_TILE_VALUE),
  );

  const verticalOffset = Math.max(
    constants.GENERAL.MIN_VERTICAL_OFFSET,
    canvas.height - rows * tileSize,
  );
  // Fill the floor
  const floorRow = rows - constants.MAP.LAST_ROW_OFFSET;
  for (let col = 0; col < cols; col += 1) {
    grid[floorRow][col] = constants.MAP.SOLID_TILE_VALUE;
  }

  const platforms = [
    {
      row: floorRow,
      colStart: constants.GENERAL.MIN_VERTICAL_OFFSET,
      colEnd: cols - constants.MAP.COLUMN_END_LIMIT_ADJUSTMENT,
    },
  ];
  // Generate Platforms
  // Logic ensures platforms are reachable based on jump height physics
  const maxJumpPixels =
    Math.abs(constants.JUMP_FORCE * 0.9) ** constants.GENERAL.SQUARE_EXPONENT /
    (constants.GENERAL.GRAVITY_DIVISOR * constants.GRAVITY);
  const gapTiles = Math.max(
    constants.MAP.MIN_VERTICAL_GAP_TILES,
    Math.floor(maxJumpPixels / tileSize) - constants.MAP.GAP_REDUCTION_TILES,
  );
  const minVerticalGap = gapTiles;
  const maxVerticalGap = Math.max(
    gapTiles,
    constants.MAP.MAX_VERTICAL_GAP_TILES,
  );

  const targetLayers = constants.MAP.LAYER_COUNT + 1;
  const layerRows = [floorRow];
  let lastRow = floorRow;

  while (layerRows.length < targetLayers) {
    const remaining = targetLayers - layerRows.length;
    let maxGap =
      lastRow - (constants.MAP.TOP_MARGIN + (remaining - 1) * minVerticalGap);

    if (maxGap < minVerticalGap) {
      maxGap = minVerticalGap;
    }
    maxGap = Math.min(maxGap, maxVerticalGap);

    if (lastRow - minVerticalGap < constants.MAP.TOP_MARGIN) {
      break;
    }

    const gap =
      minVerticalGap +
      Math.floor(
        Math.random() *
          (maxGap - minVerticalGap + constants.MAP.GAP_RANDOM_ADDITION),
      );
    let nextRow = lastRow - gap;

    if (nextRow < constants.MAP.TOP_MARGIN) {
      nextRow = constants.MAP.TOP_MARGIN;
    }

    if (lastRow - nextRow < minVerticalGap) {
      nextRow = lastRow - minVerticalGap;
    }

    if (nextRow < constants.MAP.TOP_MARGIN) {
      break;
    }

    layerRows.push(nextRow);
    lastRow = nextRow;
  }

  for (let index = 1; index < layerRows.length; index += 1) {
    const row = layerRows[index];

    const presetIndex = Math.floor(
      Math.random() * constants.MAP.PRESETS.length,
    );
    const preset = constants.MAP.PRESETS[presetIndex];

    let currentSegmentStart = -1;

    for (let col = 0; col < cols; col += 1) {
      const scaledIndex = Math.floor((col / cols) * preset.length);
      const char = preset[scaledIndex];
      const isSolid = char === '_';

      if (isSolid) {
        grid[row][col] = constants.MAP.SOLID_TILE_VALUE;
        if (currentSegmentStart === -1) {
          currentSegmentStart = col;
        }
      } else {
        if (currentSegmentStart !== -1) {
          platforms.push({
            row,
            colStart: currentSegmentStart,
            colEnd: col - 1,
          });
          currentSegmentStart = -1;
        }
      }
    }

    if (currentSegmentStart !== -1) {
      platforms.push({
        row,
        colStart: currentSegmentStart,
        colEnd: cols - 1,
      });
    }
  }

  // Add Side Walls
  for (let r = 0; r < rows; r++) {
    grid[r][0] = constants.MAP.WALL_TILE_VALUE;
    grid[r][cols - 1] = constants.MAP.WALL_TILE_VALUE;
  }

  return { grid, platforms, floorRow, cols, verticalOffset };
}
// Checks if a specific tile coordinate is solid or a wall
export function isSolidTile(map, row, col, constants) {
  if (row < 0 || row >= map.length) {
    return false;
  }
  if (col < 0 || col >= map[row].length) {
    return false;
  }
  return (
    map[row][col] === constants.MAP.SOLID_TILE_VALUE ||
    map[row][col] === constants.MAP.WALL_TILE_VALUE
  );
}
// Checks if a rectangular area overlaps with any solid tiles
export function checkCollision(
  map,
  x,
  y,
  width,
  height,
  tileSize,
  offsetY,
  constants,
) {
  // Converts pixel coordinates to grid indices
  const left = Math.floor(x / tileSize);
  const right = Math.floor(
    (x + width - constants.MAP.SEGMENT_END_OFFSET) / tileSize,
  );
  const top = Math.floor((y - offsetY) / tileSize);
  const bottom = Math.floor(
    (y + height - constants.MAP.SEGMENT_END_OFFSET - offsetY) / tileSize,
  );

  if (bottom < top) {
    return false;
  }
  // Iterate through potentially overlapping tiles
  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      if (isSolidTile(map, row, col, constants)) {
        return true;
      }
    }
  }
  return false;
}