import { describe, it, expect } from "vitest";
import {
  createEmptyNavGrid,
  findPathAStar,
  cellToWorld,
  worldToCell,
  cellKey,
} from "../src/engine/pathfinder";
import {
  cloneVirtualTwinState,
  stepVirtual,
  type VirtualTwinState,
} from "../src/engine/whatif";
import type { BotUnit, Task } from "../src/store/useTwinStore";

describe("NexusTwin Anti-Collision & Cooperative Yielding", () => {
  it("maintains physical safety distance threshold under head-on approach", () => {
    const grid = createEmptyNavGrid(30, 20, 1.0);

    const botA: BotUnit = {
      id: "BOT-01",
      profileId: "ADDVERB_DYNAMO_200",
      position: [5, 0.2, 10],
      headingRad: 0,
      velocity: 1.4,
      batteryPct: 90,
      status: "ACTIVE",
      fsmState: "NAVIGATING_TO_PICKUP",
      healthPct: 100,
      currentTaskId: "TASK-01",
      targetLocationId: "LOC-A",
      path: [[6, 10], [7, 10], [8, 10], [9, 10], [10, 10]],
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

    const botB: BotUnit = {
      id: "BOT-02",
      profileId: "ADDVERB_DYNAMO_200",
      position: [11, 0.2, 10],
      headingRad: Math.PI,
      velocity: 1.4,
      batteryPct: 90,
      status: "ACTIVE",
      fsmState: "NAVIGATING_TO_DELIVERY",
      healthPct: 100,
      currentTaskId: "TASK-02",
      targetLocationId: "LOC-B",
      path: [[10, 10], [9, 10], [8, 10], [7, 10], [6, 10]],
      pathIndex: 0,
      currentPayloadKg: 25, // Loaded bot has higher priority!
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

    const tasks: Record<string, Task> = {
      "TASK-01": {
        id: "TASK-01",
        type: "ORDER_PICK",
        priority: "NORMAL",
        status: "IN_PROGRESS",
        assignedBotId: "BOT-01",
        sourceLocId: "SHELF-1",
        sourceCoords: [12, 10],
        destLocId: "PACK-1",
        destCoords: [2, 10],
        payloadKg: 0,
        createdTick: 0,
        assignedTick: 0,
        completedTick: null,
      },
      "TASK-02": {
        id: "TASK-02",
        type: "ORDER_PICK",
        priority: "NORMAL",
        status: "IN_PROGRESS",
        assignedBotId: "BOT-02",
        sourceLocId: "SHELF-2",
        sourceCoords: [12, 10],
        destLocId: "PACK-1",
        destCoords: [2, 10],
        payloadKg: 25,
        createdTick: 0,
        assignedTick: 0,
        completedTick: null,
      },
    };

    const state: VirtualTwinState = {
      tick: 0,
      navGrid: grid,
      locations: {},
      botUnits: { "BOT-01": botA, "BOT-02": botB },
      manualPickers: {},
      tasks,
      chargingDocks: {},
      zones: {},
      activeCongestionMap: new Float32Array(grid.cols * grid.rows),
      taskSequence: 10,
      customObstacles: [],
      isConveyorJammed: false,
      isFestiveSurge: false,
      surgeMultiplier: 1,
      completedTasksCount: 0,
      manualCompletedTasksCount: 0,
      totalWaitTicks: 0,
      manualTotalWaitTicks: 0,
      totalEnergyWh: 0,
      safeYieldsCount: 0,
      nearMissesCount: 0,
      events: [],
    };

    let rngVal = 0.5;
    const fakeRng = () => {
      rngVal = (rngVal * 9301 + 49297) % 233280;
      return rngVal / 233280;
    };

    // Step simulation 25 ticks forward
    for (let t = 0; t < 25; t++) {
      stepVirtual(state, fakeRng);
      const posA = state.botUnits["BOT-01"].position;
      const posB = state.botUnits["BOT-02"].position;
      const dist = Math.hypot(posA[0] - posB[0], posA[2] - posB[2]);
      // Minimum safety distance must never breach physical robot radius (1.0m)
      expect(dist).toBeGreaterThanOrEqual(0.95);
    }

    // Because BOT-02 is carrying cargo (fsmState=NAVIGATING_TO_DELIVERY, payload=25kg),
    // empty BOT-01 should yield or sidestep
    expect(state.nearMissesCount).toBeGreaterThan(0);
  });
});
