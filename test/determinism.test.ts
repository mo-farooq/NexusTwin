import { describe, it, expect } from "vitest";
import {
  createEmptyNavGrid,
  cellToWorld,
} from "../src/engine/pathfinder";
import {
  cloneVirtualTwinState,
  stepVirtual,
  type VirtualTwinState,
} from "../src/engine/whatif";
import type { BotUnit, WarehouseLocation } from "../src/store/useTwinStore";

function createMulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("NexusTwin Simulation Determinism & Replay", () => {
  it("produces bit-identical trajectories from identical PRNG seeds", () => {
    const grid = createEmptyNavGrid(40, 30, 1.0);

    const locations: Record<string, WarehouseLocation> = {
      "SHELF-01": {
        id: "SHELF-01",
        name: "Shelf A1",
        type: "SHELF",
        bounds: [4, 4, 2, 8],
        accessPoint: [3, 6],
        color: "#64748B",
        inventory: [],
      },
      "PACK-01": {
        id: "PACK-01",
        name: "Packing Station 1",
        type: "PACK_STATION",
        bounds: [2, 26, 4, 2],
        accessPoint: [4, 25],
        color: "#0E9F8E",
        inventory: [],
      },
    };

    const initialBot: BotUnit = {
      id: "BOT-01",
      profileId: "ADDVERB_DYNAMO_200",
      position: [10, 0.2, 10],
      headingRad: 0,
      velocity: 0,
      batteryPct: 100,
      status: "IDLE",
      fsmState: "IDLE",
      healthPct: 100,
      currentTaskId: null,
      targetLocationId: null,
      path: [],
      pathIndex: 0,
      currentPayloadKg: 0,
      stats: { distanceTraveledM: 0, tasksCompleted: 0, energyConsumedWh: 0, busyTicks: 0, idleTicks: 0, waitTicks: 0 },
      perception: { state: "CLEAR", frontObstacleId: null, frontDistM: null, warningProximity: false, yieldsToId: null },
      waitTicks: 0,
      backingOff: false,
      resumeGoalCoords: null,
      resumeTaskId: null,
      resumeLocationId: null,
      resumeFsmState: null,
      safeYieldsCount: 0,
    };

    const baseStateInput = {
      tick: 0,
      navGrid: grid,
      locations,
      botUnits: { "BOT-01": initialBot },
      tasks: {},
      chargingDocks: {},
      zones: {},
      activeCongestionMap: new Float32Array(grid.cols * grid.rows),
      taskSequence: 100,
      customObstacles: [],
    };

    // Run 1 with seed 1337
    const rng1 = createMulberry32(1337);
    const state1 = cloneVirtualTwinState(baseStateInput);
    for (let t = 0; t < 120; t++) {
      stepVirtual(state1, rng1);
    }

    // Run 2 with same seed 1337
    const rng2 = createMulberry32(1337);
    const state2 = cloneVirtualTwinState(baseStateInput);
    for (let t = 0; t < 120; t++) {
      stepVirtual(state2, rng2);
    }

    // Coordinates, battery, tick, and task sequence must be exact bit-identical matches
    expect(state1.tick).toBe(state2.tick);
    expect(state1.taskSequence).toBe(state2.taskSequence);
    expect(state1.completedTasksCount).toBe(state2.completedTasksCount);
    expect(state1.totalWaitTicks).toBe(state2.totalWaitTicks);

    const b1 = state1.botUnits["BOT-01"];
    const b2 = state2.botUnits["BOT-01"];
    expect(b1.position[0]).toBe(b2.position[0]);
    expect(b1.position[2]).toBe(b2.position[2]);
    expect(b1.batteryPct).toBe(b2.batteryPct);
    expect(b1.fsmState).toBe(b2.fsmState);
  });
});
