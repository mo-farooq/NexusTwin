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
  flowDirectionMap?: Uint8Array; // 0=ANY, 1=NORTH(-row), 2=SOUTH(+row), 3=EAST(+col), 4=WEST(-col)
  allowDiagonal?: boolean;
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
  const { blockedCells, congestionCostMap, flowDirectionMap, allowDiagonal = true, maxExpansions = 50000 } = options;

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
  const neighborLimit = allowDiagonal ? NEIGHBOR_DIRECTIONS.length : 4; // First 4 are orthogonal (no diagonal corner-cutting)

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

    for (let d = 0; d < neighborLimit; d++) {
      const [dCol, dRow, baseDist] = NEIGHBOR_DIRECTIONS[d];
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

      // Aisle traffic flow directional penalty (prevents head-on deadlock in narrow aisles)
      if (flowDirectionMap && neighborIndex !== goalIndex) {
        const flow = flowDirectionMap[neighborIndex];
        if (flow === 1 && dRow > 0) traversalCost += 8.0;       // North-bound aisle, penalized going South (+dRow)
        else if (flow === 2 && dRow < 0) traversalCost += 8.0;  // South-bound aisle, penalized going North (-dRow)
        else if (flow === 3 && dCol < 0) traversalCost += 8.0;  // East-bound aisle, penalized going West (-dCol)
        else if (flow === 4 && dCol > 0) traversalCost += 8.0;  // West-bound aisle, penalized going East (+dCol)
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

/**
 * Fast ray-marching line-of-sight check across navigation grid
 */
export function checkLineOfSight(
  grid: NavGrid,
  x0: number,
  z0: number,
  x1: number,
  z1: number
): boolean {
  const d = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.ceil(d / 0.5));
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const [c, r] = worldToCell(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, grid.cellSize);
    if (!isCellTraversable(grid, c, r)) return false;
  }
  return true;
}

/**
 * 2D Oriented Bounding Box (OBB) intersection test using Separating Axis Theorem (SAT).
 * ax, az: center of box A
 * ah: heading angle of box A in radians
 * bx, bz: center of box B
 * bh: heading angle of box B in radians
 * margin: safety buffer in meters (default: 0.05)
 * halfLen: chassis half-length in meters (default: 0.48)
 * halfWidth: chassis half-width in meters (default: 0.35)
 */
export function obbOverlap(
  ax: number,
  az: number,
  ah: number,
  bx: number,
  bz: number,
  bh: number,
  margin = 0.05,
  halfLen = 0.48,
  halfWidth = 0.35
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  // Test the 4 normal axes of the two oriented bounding boxes
  for (const angle of [ah, ah + Math.PI / 2, bh, bh + Math.PI / 2]) {
    const ux = Math.cos(angle);
    const uz = Math.sin(angle);
    const ra =
      halfLen * Math.abs(ux * Math.cos(ah) + uz * Math.sin(ah)) +
      halfWidth * Math.abs(-ux * Math.sin(ah) + uz * Math.cos(ah));
    const rb =
      halfLen * Math.abs(ux * Math.cos(bh) + uz * Math.sin(bh)) +
      halfWidth * Math.abs(-ux * Math.sin(bh) + uz * Math.cos(bh));
    // If the projection of the center distance exceeds the sum of projected extents + margin:
    // a separating axis is found, boxes do not overlap.
    if (Math.abs(dx * ux + dz * uz) > ra + rb + margin) {
      return false;
    }
  }
  return true;
}

/**
 * Build an automated directional flow map for storage rack aisles.
 * Alternates flow directions (North/South for vertical aisles, East/West for horizontal aisles)
 * to eliminate head-on deadlocks and ensure continuous unidirectional loop flow.
 * Returns Uint8Array of size cols * rows: 0=ANY, 1=NORTH, 2=SOUTH, 3=EAST, 4=WEST.
 */
export function buildAisleFlowMap(grid: NavGrid): Uint8Array {
  const { cols, rows, cells } = grid;
  const flowMap = new Uint8Array(cols * rows);

  // Scan columns to detect vertical aisles flanked by racks (cells === 1)
  for (let c = 1; c < cols - 1; c++) {
    let rackFlankCount = 0;
    for (let r = 2; r < rows - 2; r++) {
      const idx = r * cols + c;
      if (cells[idx] === 0) {
        const leftRack = cells[r * cols + (c - 1)] === 1 || cells[r * cols + Math.max(0, c - 2)] === 1;
        const rightRack = cells[r * cols + (c + 1)] === 1 || cells[r * cols + Math.min(cols - 1, c + 2)] === 1;
        if (leftRack || rightRack) {
          rackFlankCount++;
        }
      }
    }

    // If substantial portion of column is an aisle flanked by racks
    if (rackFlankCount >= Math.floor(rows * 0.25)) {
      // Alternate direction based on column index: even columns South (2), odd columns North (1)
      const direction: 1 | 2 = (Math.floor(c / 2) % 2 === 0) ? 2 : 1;
      for (let r = 2; r < rows - 2; r++) {
        const idx = r * cols + c;
        if (cells[idx] === 0) {
          flowMap[idx] = direction;
        }
      }
    }
  }

  // Scan rows to detect horizontal aisles flanked by racks
  for (let r = 1; r < rows - 1; r++) {
    let horizontalAisleCount = 0;
    for (let c = 2; c < cols - 2; c++) {
      const idx = r * cols + c;
      if (cells[idx] === 0 && flowMap[idx] === 0) {
        const topRack = cells[(r - 1) * cols + c] === 1;
        const bottomRack = cells[(r + 1) * cols + c] === 1;
        if (topRack || bottomRack) {
          horizontalAisleCount++;
        }
      }
    }

    if (horizontalAisleCount >= Math.floor(cols * 0.25)) {
      // Alternate direction: even rows East (3), odd rows West (4)
      const direction: 3 | 4 = (Math.floor(r / 2) % 2 === 0) ? 3 : 4;
      for (let c = 2; c < cols - 2; c++) {
        const idx = r * cols + c;
        if (cells[idx] === 0 && flowMap[idx] === 0) {
          flowMap[idx] = direction;
        }
      }
    }
  }

  return flowMap;
}
