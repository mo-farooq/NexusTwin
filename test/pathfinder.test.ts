import { describe, it, expect } from "vitest";
import {
  createEmptyNavGrid,
  findPathAStar,
  setGridRect,
  isCellTraversable,
  cellKey,
} from "../src/engine/pathfinder";

describe("NexusTwin A* Pathfinder Engine", () => {
  it("finds optimal straight path on unobstructed grid", () => {
    const grid = createEmptyNavGrid(20, 20, 1.0);
    const start: [number, number] = [2, 2];
    const goal: [number, number] = [10, 2];

    const path = findPathAStar(grid, start, goal);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(0);
    // Path ends at goal and contains the step sequence
    expect(path![path!.length - 1]).toEqual(goal);
    // Straight line distance along row 2 from col 2 to col 10 is 8 steps
    expect(path!.length).toBe(8);
  });

  it("navigates cleanly around static storage rack obstacles", () => {
    const grid = createEmptyNavGrid(20, 20, 1.0);
    // Place a vertical obstacle wall across col 5, rows 0 to 12
    setGridRect(grid, 5, 0, 5, 12, 1);

    const start: [number, number] = [2, 5];
    const goal: [number, number] = [8, 5];

    const path = findPathAStar(grid, start, goal);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(0);

    // Verify no waypoint in path intersects the obstacle wall
    for (const [col, row] of path!) {
      expect(isCellTraversable(grid, col, row)).toBe(true);
      expect(grid.cells[row * grid.cols + col]).not.toBe(1);
    }
    expect(path![path!.length - 1]).toEqual(goal);
  });

  it("strictly prevents diagonal corner-cutting between obstacles", () => {
    const grid = createEmptyNavGrid(10, 10, 1.0);
    // Create diagonally touching obstacles at [3, 3] and [4, 4]
    grid.cells[3 * 10 + 3] = 1;
    grid.cells[4 * 10 + 4] = 1;

    const start: [number, number] = [3, 4];
    const goal: [number, number] = [4, 3];

    const path = findPathAStar(grid, start, goal, { allowDiagonal: true });
    expect(path).not.toBeNull();

    // Check that path does not cut diagonally through [3, 4] -> [4, 3]
    for (let i = 0; i < path!.length - 1; i++) {
      const [c1, r1] = path![i];
      const [c2, r2] = path![i + 1];
      const isCornerCut =
        (c1 === 3 && r1 === 4 && c2 === 4 && r2 === 3) ||
        (c1 === 4 && r1 === 3 && c2 === 3 && r2 === 4);
      expect(isCornerCut).toBe(false);
    }
  });

  it("respects dynamic cell reservations and blocked cells set", () => {
    const grid = createEmptyNavGrid(15, 15, 1.0);
    const start: [number, number] = [1, 5];
    const goal: [number, number] = [5, 5];

    // Block cells [2, 5], [3, 5], [4, 5] dynamically via options
    const blockedCells = new Set<string>([
      cellKey(2, 5),
      cellKey(3, 5),
      cellKey(4, 5),
    ]);

    const path = findPathAStar(grid, start, goal, { blockedCells });
    expect(path).not.toBeNull();

    // Ensure none of the blocked cells are traversed
    for (const [col, row] of path!) {
      expect(blockedCells.has(cellKey(col, row))).toBe(false);
    }
  });

  it("handles completely unreachable goals gracefully without infinite loop", () => {
    const grid = createEmptyNavGrid(10, 10, 1.0);
    // Enclose goal [8, 8] completely in a box of obstacles
    for (let r = 7; r <= 9; r++) {
      for (let c = 7; c <= 9; c++) {
        if (r !== 8 || c !== 8) {
          grid.cells[r * 10 + c] = 1;
        }
      }
    }

    const start: [number, number] = [1, 1];
    const goal: [number, number] = [8, 8];

    const path = findPathAStar(grid, start, goal, { maxExpansions: 200 });
    expect(path).toBeNull();
  });
});
