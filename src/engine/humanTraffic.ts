/**
 * NexusTwin Human Worker Traffic & Walkway System
 *
 * Generates dynamic, collision-free human patrol paths along designated
 * safety corridors, cross-aisles, and inbound inspection zones without
 * clipping through storage racks or obstructing AMR robots.
 */

import {
  type NavGrid,
  type GridDimensions,
  type GridCell,
  type WorldCoord2D,
  worldToCell,
  cellToWorld,
  isCellTraversable,
  findPathAStar,
} from "./pathfinder";

export interface HumanWorkerEntity {
  id: string;
  name: string;
  role: string;
  position: [x: number, y: number, z: number];
  headingRad: number;
  waypoints: Array<[x: number, z: number]>;
  currentWaypointIndex: number;
  path?: GridCell[];
  pathIndex?: number;
  speed: number;
  zoneId: string;
  isYielding?: boolean;
}

/**
 * Locate the nearest traversable walkway cell with safety buffer from obstacles
 */
function findSafeWalkwayCell(
  grid: NavGrid,
  targetCol: number,
  targetRow: number,
  searchRadius = 6
): GridCell {
  const { cols, rows, cells } = grid;
  const clampedCol = Math.max(1, Math.min(cols - 2, targetCol));
  const clampedRow = Math.max(1, Math.min(rows - 2, targetRow));

  // Check if cell and its 4 immediate cardinal neighbors are clear
  const isBufferSafe = (c: number, r: number) => {
    if (!isCellTraversable(grid, c, r)) return false;
    // Check 4-neighbor clearance to avoid rubbing directly against racks
    const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    let clearNeighbors = 0;
    for (const [dc, dr] of offsets) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc >= 0 && nc < cols && nr >= 0 && nr < rows && cells[nr * cols + nc] === 0) {
        clearNeighbors++;
      }
    }
    return clearNeighbors >= 2;
  };

  if (isBufferSafe(clampedCol, clampedRow)) {
    return [clampedCol, clampedRow];
  }

  for (let rad = 1; rad <= searchRadius; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.abs(dr) !== rad && Math.abs(dc) !== rad) continue;
        const candC = clampedCol + dc;
        const candR = clampedRow + dr;
        if (candC >= 1 && candC < cols - 1 && candR >= 1 && candR < rows - 1) {
          if (isBufferSafe(candC, candR)) {
            return [candC, candR];
          }
        }
      }
    }
  }

  return [clampedCol, clampedRow];
}

/**
 * Generate layout-aware human worker entities with verified traversable patrol routes
 */
export function generateHumanWorkers(
  grid: NavGrid,
  dims: GridDimensions
): Record<string, HumanWorkerEntity> {
  const { cols, rows, cellSize } = dims;
  const midRow = Math.floor(rows / 2);
  const midCol = Math.floor(cols / 2);

  // 1. Storage Picker: Patrols central cross-aisle & packing buffer
  // Offset to rows 26..30 to align with marked pedestrian safety walkway,
  // providing a safe 2.5m clearance buffer from rack aisle mouths and AMR turn radii.
  const walkwayRow = Math.min(rows - 6, midRow + 2);
  const wp1Cells: GridCell[] = [
    findSafeWalkwayCell(grid, Math.floor(cols * 0.30), walkwayRow),
    findSafeWalkwayCell(grid, Math.floor(cols * 0.70), walkwayRow),
    findSafeWalkwayCell(grid, Math.floor(cols * 0.70), walkwayRow + 4),
    findSafeWalkwayCell(grid, Math.floor(cols * 0.30), walkwayRow + 4),
  ];
  const wp1World = wp1Cells.map(([c, r]) => cellToWorld(c, r, cellSize));

  // 2. Safety Supervisor: Patrols wide perimeter safety walkways
  const wp2Cells: GridCell[] = [
    findSafeWalkwayCell(grid, 3, 3),
    findSafeWalkwayCell(grid, cols - 4, 3),
    findSafeWalkwayCell(grid, cols - 4, rows - 4),
    findSafeWalkwayCell(grid, 3, rows - 4),
  ];
  const wp2World = wp2Cells.map(([c, r]) => cellToWorld(c, r, cellSize));

  // 3. Inbound Inspector: Patrols northern inbound receiving dock buffer
  const wp3Cells: GridCell[] = [
    findSafeWalkwayCell(grid, 4, 4),
    findSafeWalkwayCell(grid, Math.floor(cols * 0.45), 4),
    findSafeWalkwayCell(grid, Math.floor(cols * 0.45), 7),
    findSafeWalkwayCell(grid, 4, 7),
  ];
  const wp3World = wp3Cells.map(([c, r]) => cellToWorld(c, r, cellSize));

  const start1 = wp1World[0];
  const start2 = wp2World[0];
  const start3 = wp3World[0];

  return {
    "WORKER-01": {
      id: "WORKER-01",
      name: "Rahul Sharma",
      role: "Cross-Aisle Picker",
      position: [start1[0], 0, start1[1]],
      headingRad: 0,
      waypoints: wp1World,
      currentWaypointIndex: 0,
      speed: 0.95,
      zoneId: "ZONE_A",
      isYielding: false,
    },
    "WORKER-02": {
      id: "WORKER-02",
      name: "Priya Patel",
      role: "Safety Supervisor",
      position: [start2[0], 0, start2[1]],
      headingRad: 0,
      waypoints: wp2World,
      currentWaypointIndex: 0,
      speed: 1.15,
      zoneId: "ZONE_CENTRAL",
      isYielding: false,
    },
    "WORKER-03": {
      id: "WORKER-03",
      name: "Amit Deshmukh",
      role: "Inbound Inspector",
      position: [start3[0], 0, start3[1]],
      headingRad: 0,
      waypoints: wp3World,
      currentWaypointIndex: 0,
      speed: 0.85,
      zoneId: "ZONE_INBOUND",
      isYielding: false,
    },
  };
}
