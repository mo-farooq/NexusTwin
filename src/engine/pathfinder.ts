/**
 * NexusTwin Pathfinding Engine
 * 
 * High-performance 8-directional A* grid pathfinder with corner-cutting prevention,
 * dynamic cell reservation, and congestion cost weighting for autonomous BotUnits.
 */

export type GridCell = [col: number, row: number];
export type WorldCoord2D = [x: number, z: number];

export interface GridDimensions {
  cols: number;
  rows: number;
  cellSize: number; // in meters (default: 1.0m)
  widthM: number;
  depthM: number;
}

export interface NavGrid {
  cols: number;
  rows: number;
  cellSize: number;
  /**
   * Cell types:
   * 0 = Free / Walkable
   * 1 = Static Obstacle (Rack, Wall, Pillar, Barrier)
   * 2 = Restricted Lane / High-friction Walkway
   */
  cells: Uint8Array;
}

export interface PathfinderOptions {
  blockedCells?: Set<string>;
  congestionCostMap?: Float32Array;
  maxExpansions?: number;
}

const SQRT_2 = Math.SQRT2;

/**
 * 8-directional neighbor offsets [dCol, dRow, baseDistance]
 */
const NEIGHBOR_DIRECTIONS: Array<[number, number, number]> = [
  // Orthogonal
  [1, 0, 1.0],
  [-1, 0, 1.0],
  [0, 1, 1.0],
  [0, -1, 1.0],
  // Diagonal
  [1, 1, SQRT_2],
  [1, -1, SQRT_2],
  [-1, 1, SQRT_2],
  [-1, -1, SQRT_2],
];

/**
 * Compact binary min-heap for A* frontier
 */
class BinaryMinHeap {
  private items: Array<{ cost: number; index: number }> = [];

  get size(): number {
    return this.items.length;
  }

  push(cost: number, index: number): void {
    const list = this.items;
    list.push({ cost, index });
    let curr = list.length - 1;

    while (curr > 0) {
      const parent = (curr - 1) >> 1;
      if (list[parent].cost <= list[curr].cost) break;
      const tmp = list[parent];
      list[parent] = list[curr];
      list[curr] = tmp;
      curr = parent;
    }
  }

  pop(): number {
    const list = this.items;
    const topValue = list[0].index;
    const lastItem = list.pop()!;

    if (list.length > 0) {
      list[0] = lastItem;
      let curr = 0;
      const len = list.length;

      while (true) {
        const left = 2 * curr + 1;
        const right = left + 1;
        let smallest = curr;

        if (left < len && list[left].cost < list[smallest].cost) {
          smallest = left;
        }
        if (right < len && list[right].cost < list[smallest].cost) {
          smallest = right;
        }
        if (smallest === curr) break;

        const tmp = list[curr];
        list[curr] = list[smallest];
        list[smallest] = tmp;
        curr = smallest;
      }
    }

    return topValue;
  }
}

/**
 * Unique string hash for a grid coordinate: "col,row"
 */
export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

/**
 * Convert continuous world coordinates (meters) to discrete grid cell
 */
export function worldToCell(x: number, z: number, cellSize = 1.0): GridCell {
  return [Math.floor(x / cellSize), Math.floor(z / cellSize)];
}

/**
 * Convert discrete grid cell to continuous world coordinates (meters) at cell center
 */
export function cellToWorld(col: number, row: number, cellSize = 1.0): WorldCoord2D {
  return [(col + 0.5) * cellSize, (row + 0.5) * cellSize];
}

/**
 * Check if cell coordinates are within grid boundaries
 */
export function isWithinBounds(grid: NavGrid, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < grid.cols && row < grid.rows;
}

/**
 * Check if a cell is free of static obstacles and dynamic reservations
 */
export function isCellTraversable(
  grid: NavGrid,
  col: number,
  row: number,
  blockedCells?: Set<string>
): boolean {
  if (!isWithinBounds(grid, col, row)) return false;
  const cellType = grid.cells[row * grid.cols + col];
  if (cellType === 1) return false;
  if (blockedCells && blockedCells.has(cellKey(col, row))) return false;
  return true;
}

/**
 * Search outwards to locate the nearest valid traversable cell
 * Useful if an access point or target destination is blocked
 */
export function findNearestTraversableCell(
  grid: NavGrid,
  col: number,
  row: number,
  blockedCells?: Set<string>,
  maxRadius = 8
): GridCell | null {
  if (isCellTraversable(grid, col, row, blockedCells)) {
    return [col, row];
  }

  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let dRow = -radius; dRow <= radius; dRow++) {
      for (let dCol = -radius; dCol <= radius; dCol++) {
        if (Math.max(Math.abs(dRow), Math.abs(dCol)) !== radius) continue;
        const candidateCol = col + dCol;
        const candidateRow = row + dRow;
        if (isCellTraversable(grid, candidateCol, candidateRow, blockedCells)) {
          return [candidateCol, candidateRow];
        }
      }
    }
  }

  return null;
}

/**
 * Calculate Octile distance heuristic for 8-directional movement
 */
function octileHeuristic(colA: number, rowA: number, colB: number, rowB: number): number {
  const dCol = Math.abs(colA - colB);
  const dRow = Math.abs(rowA - rowB);
  return (dCol + dRow) + (SQRT_2 - 2.0) * Math.min(dCol, dRow);
}

/**
 * Deterministic 8-directional A* pathfinding algorithm
 * 
 * Returns sequence of cells from start to goal (excluding start).
 * Returns null if no valid path exists.
 */
export function findPathAStar(
  grid: NavGrid,
  start: GridCell,
  goal: GridCell,
  options: PathfinderOptions = {}
): GridCell[] | null {
  const { cols, rows, cells } = grid;
  const { blockedCells, congestionCostMap, maxExpansions = 50000 } = options;

  const toIndex = (c: number, r: number) => r * cols + c;

  // Verify goal is inside map and not a static wall
  if (!isWithinBounds(grid, goal[0], goal[1])) return null;
  if (cells[toIndex(goal[0], goal[1])] === 1) return null;

  const startIndex = toIndex(start[0], start[1]);
  const goalIndex = toIndex(goal[0], goal[1]);

  if (startIndex === goalIndex) return [];

  const totalCells = cols * rows;
  const gCosts = new Float64Array(totalCells).fill(Infinity);
  const parentIndices = new Int32Array(totalCells).fill(-1);
  const closedSet = new Uint8Array(totalCells);

  const frontier = new BinaryMinHeap();
  gCosts[startIndex] = 0;
  frontier.push(octileHeuristic(start[0], start[1], goal[0], goal[1]), startIndex);

  let expansions = 0;

  while (frontier.size > 0) {
    const currentIndex = frontier.pop();

    if (currentIndex === goalIndex) break;
    if (closedSet[currentIndex]) continue;
    closedSet[currentIndex] = 1;

    expansions++;
    if (expansions > maxExpansions) {
      return null;
    }

    const currCol = currentIndex % cols;
    const currRow = Math.floor(currentIndex / cols);

    for (const [dCol, dRow, baseDist] of NEIGHBOR_DIRECTIONS) {
      const nextCol = currCol + dCol;
      const nextRow = currRow + dRow;

      if (!isWithinBounds(grid, nextCol, nextRow)) continue;

      const neighborIndex = toIndex(nextCol, nextRow);
      if (closedSet[neighborIndex]) continue;

      const cellType = cells[neighborIndex];
      if (cellType === 1) continue;

      // Check dynamic obstacles (allow target cell itself if it's the destination)
      if (blockedCells && neighborIndex !== goalIndex && blockedCells.has(cellKey(nextCol, nextRow))) {
        continue;
      }

      // Corner-cutting check: for diagonal moves, both orthogonal adjacent cells must be traversable
      if (dCol !== 0 && dRow !== 0) {
        if (!isCellTraversable(grid, currCol + dCol, currRow, blockedCells) ||
            !isCellTraversable(grid, currCol, currRow + dRow, blockedCells)) {
          continue;
        }
      }

      // Cost calculation:
      // Base distance (1.0 or 1.414) * friction modifier (lane: 1.5x) + dynamic congestion penalty
      let traversalCost = baseDist * (cellType === 2 ? 1.5 : 1.0);
      if (congestionCostMap) {
        traversalCost += congestionCostMap[neighborIndex];
      }

      const tentativeG = gCosts[currentIndex] + traversalCost;

      if (tentativeG < gCosts[neighborIndex]) {
        gCosts[neighborIndex] = tentativeG;
        parentIndices[neighborIndex] = currentIndex;
        const fCost = tentativeG + octileHeuristic(nextCol, nextRow, goal[0], goal[1]);
        frontier.push(fCost, neighborIndex);
      }
    }
  }

  // If goal was never reached
  if (parentIndices[goalIndex] === -1) {
    return null;
  }

  // Reconstruct path
  const path: GridCell[] = [];
  let curr = goalIndex;
  while (curr !== startIndex) {
    const col = curr % cols;
    const row = Math.floor(curr / cols);
    path.push([col, row]);
    curr = parentIndices[curr];
  }

  path.reverse();
  return path;
}

/**
 * Helper to build an empty navigation grid
 */
export function createEmptyNavGrid(cols: number, rows: number, cellSize = 1.0): NavGrid {
  return {
    cols,
    rows,
    cellSize,
    cells: new Uint8Array(cols * rows),
  };
}

/**
 * Mark a rectangular region in the navigation grid
 */
export function setGridRect(
  grid: NavGrid,
  colStart: number,
  rowStart: number,
  colEnd: number,
  rowEnd: number,
  cellValue: number
): void {
  const c0 = Math.max(0, Math.min(colStart, colEnd));
  const c1 = Math.min(grid.cols - 1, Math.max(colStart, colEnd));
  const r0 = Math.max(0, Math.min(rowStart, rowEnd));
  const r1 = Math.min(grid.rows - 1, Math.max(rowStart, rowEnd));

  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      grid.cells[r * grid.cols + c] = cellValue;
    }
  }
}
