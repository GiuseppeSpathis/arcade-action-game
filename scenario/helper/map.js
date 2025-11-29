export function generateMap(canvas, constants) {
  const tileSize = constants.TILE_SIZE;
  const rows = Math.max(
    constants.GENERAL.MIN_GRID_DIMENSION,
    Math.floor(canvas.height / tileSize),
  );
  const cols = Math.max(
    constants.GENERAL.MIN_GRID_DIMENSION,
    Math.floor(canvas.width / tileSize),
  );
  const grid = Array.from({ length: rows }, () =>
    Array(cols).fill(constants.MAP.EMPTY_TILE_VALUE),
  );

  const verticalOffset = Math.max(
    constants.GENERAL.MIN_VERTICAL_OFFSET,
    canvas.height - rows * tileSize,
  );

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

  const desiredLayers =
    constants.MAP.MIN_LAYERS +
    Math.floor(Math.random() * constants.MAP.ADDITIONAL_LAYER_VARIATION);
  const maxLayersPossible = Math.max(
    constants.MAP.MIN_LAYER_COUNT,
    Math.floor((floorRow - constants.MAP.TOP_MARGIN) / minVerticalGap) + 1,
  );
  const targetLayers = Math.min(desiredLayers, maxLayersPossible);

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
    if (maxGap < minVerticalGap) {
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
    const segments = [];

    let col = Math.floor(
      Math.random() * constants.MAP.INITIAL_COLUMN_OFFSET_RANGE,
    );
    let hasLongSegment = false;

    while (col < cols) {
      col += Math.floor(Math.random() * constants.MAP.COLUMN_SKIP_RANGE);
      if (col >= cols) {
        break;
      }

      const maxSegmentLength = Math.max(
        constants.MAP.MIN_MAX_SEGMENT_LENGTH,
        Math.floor(cols / constants.MAP.MAX_SEGMENT_LENGTH_DIVISOR),
      );
      const segmentLength =
        constants.MAP.SEGMENT_LENGTH_BASE +
        Math.floor(
          Math.random() *
            Math.max(constants.MAP.SEGMENT_LENGTH_BASE, maxSegmentLength),
        );
      const colEnd = Math.min(
        cols - constants.MAP.COLUMN_END_LIMIT_ADJUSTMENT,
        col + segmentLength - constants.MAP.SEGMENT_END_OFFSET,
      );

      segments.push({ row, colStart: col, colEnd });
      hasLongSegment =
        hasLongSegment ||
        colEnd - col + constants.MAP.SEGMENT_END_OFFSET >=
          constants.MAP.LONG_SEGMENT_THRESHOLD;

      for (let currentCol = col; currentCol <= colEnd; currentCol += 1) {
        grid[row][currentCol] = constants.MAP.SOLID_TILE_VALUE;
      }

      col =
        colEnd +
        constants.MAP.POST_SEGMENT_SKIP_BASE +
        Math.floor(Math.random() * constants.MAP.POST_SEGMENT_SKIP_RANGE);
    }

    if (segments.length === 0) {
      const start = Math.max(
        constants.GENERAL.MIN_VERTICAL_OFFSET,
        Math.floor(cols / constants.MAP.FALLBACK_PLATFORM_DIVISOR) -
          constants.MAP.FALLBACK_PLATFORM_HALF_WIDTH,
      );
      const end = Math.min(
        cols - constants.MAP.COLUMN_END_LIMIT_ADJUSTMENT,
        start + constants.MAP.FALLBACK_PLATFORM_EXTRA_LENGTH,
      );
      for (let currentCol = start; currentCol <= end; currentCol += 1) {
        grid[row][currentCol] = constants.MAP.SOLID_TILE_VALUE;
      }
      segments.push({ row, colStart: start, colEnd: end });
      hasLongSegment = true;
    }

    if (!hasLongSegment) {
      const firstSegment = segments[0];
      const needed =
        constants.MAP.FIRST_SEGMENT_MIN_LENGTH -
        (firstSegment.colEnd -
          firstSegment.colStart +
          constants.MAP.SEGMENT_END_OFFSET);
      firstSegment.colEnd = Math.min(
        cols - constants.MAP.COLUMN_END_LIMIT_ADJUSTMENT,
        firstSegment.colEnd + needed,
      );
      for (
        let currentCol = firstSegment.colStart;
        currentCol <= firstSegment.colEnd;
        currentCol += 1
      ) {
        grid[row][currentCol] = constants.MAP.SOLID_TILE_VALUE;
      }
    }

    platforms.push(...segments);
  }

  return { grid, platforms, floorRow, cols, verticalOffset };
}

export function isSolidTile(map, row, col, constants) {
  if (row < 0 || row >= map.length) {
    return false;
  }
  if (col < 0 || col >= map[row].length) {
    return false;
  }
  return map[row][col] === constants.MAP.SOLID_TILE_VALUE;
}

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

  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      if (isSolidTile(map, row, col, constants)) {
        return true;
      }
    }
  }
  return false;
}
