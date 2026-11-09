import { describe, it, expect, beforeEach } from "vitest";
import { useTwinStore } from "../src/store/useTwinStore";

describe("Dynamic Obstacle Injection & Live A* Rerouting", () => {
  beforeEach(() => {
    useTwinStore.getState().resetSimulation(42);
    useTwinStore.getState().clearInjections();
  });

  it("successfully drops an obstacle even when zoneId does not strictly match (graceful fallback)", () => {
    const store = useTwinStore.getState();
    expect(store.customObstacles.length).toBe(0);

    // Call with legacy zone ID "ZONE_A"
    store.injectAisleBlockage("ZONE_A", 45);

    const updated = useTwinStore.getState();
    expect(updated.customObstacles.length).toBeGreaterThan(0);
    const obs = updated.customObstacles[0];
    expect(obs.col).toBeGreaterThanOrEqual(0);
    expect(obs.row).toBeGreaterThanOrEqual(0);
    expect(obs.label).toContain("Spilled Pallet");

    // Grid cell must be marked impassable
    const cellIdx = obs.row * updated.navGrid.cols + obs.col;
    expect(updated.navGrid.cells[cellIdx]).toBe(1);
  });

  it("dynamically intercepts an active robot's path and triggers A* detour replanning", () => {
    const store = useTwinStore.getState();

    // Find an active robot with a path
    const bot = Object.values(store.botUnits).find((b) => b.status === "ACTIVE" && b.path && b.path.length > 3);
    if (bot) {
      const stepAhead = bot.path[bot.pathIndex + 3];
      // Inject obstacle
      store.injectAisleBlockage("ZONE_STORAGE", 45);

      const after = useTwinStore.getState();
      expect(after.customObstacles.length).toBe(1);
      // The obstacle was dropped directly on the forward path
      const obs = after.customObstacles[0];
      expect(obs.col).toBe(stepAhead[0]);
      expect(obs.row).toBe(stepAhead[1]);

      // Robot must be yielding or re-routing
      const updatedBot = after.botUnits[bot.id];
      expect(updatedBot.perception.frontObstacleId).toContain("Barricade");
    }
  });

  it("cleanly removes obstacles and restores grid traversability via clearInjections", () => {
    const store = useTwinStore.getState();
    store.injectAisleBlockage("ZONE_STORAGE", 45);
    expect(useTwinStore.getState().customObstacles.length).toBe(1);

    const obs = useTwinStore.getState().customObstacles[0];
    const cellIdx = obs.row * store.navGrid.cols + obs.col;

    store.clearInjections();
    const cleaned = useTwinStore.getState();
    expect(cleaned.customObstacles.length).toBe(0);
    expect(cleaned.navGrid.cells[cellIdx]).toBe(0); // restored to walkable
  });
});
