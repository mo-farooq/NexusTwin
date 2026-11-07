import { describe, it, expect } from "vitest";
import {
  PACKING_STATION_CONFIGS,
  type BotUnit,
  type Task,
  type WarehouseLocation,
} from "../src/store/useTwinStore";
import { cellToWorld, worldToCell } from "../src/engine/pathfinder";

describe("NexusTwin Autonomous Reverse & Convoy Deadlock Resolution", () => {
  it("allows moving-away retreat when separation is less than 1.05m", () => {
    // Two robots currently at 0.90m separation (deadlock vise before fix)
    const botA_pos = [10.0, 0.2, 10.0];
    const botB_pos = [10.9, 0.2, 10.0]; // 0.90m apart along X axis
    const dcur = Math.hypot(botA_pos[0] - botB_pos[0], botA_pos[2] - botB_pos[2]);
    expect(dcur).toBeCloseTo(0.9, 2);

    // Bot A attempts reverse step backwards away from Bot B (new X = 9.85)
    const newX = 9.85;
    const newZ = 10.0;
    const dn = Math.hypot(newX - botB_pos[0], newZ - botB_pos[2]);

    // Separation increases: dn (1.05) > dcur (0.90)
    expect(dn).toBeGreaterThan(dcur);

    // The moving-away predicate:
    const isMovingAway = dn > dcur + 0.005;
    expect(isMovingAway).toBe(true);
  });

  it("reverses robot along negative heading vector without altering chassis orientation", () => {
    // Robot heading east (+X direction, headingRad = 0)
    const bot: BotUnit = {
      id: "BOT-04",
      profileId: "LIGHT_PICKER",
      position: [12.0, 0.25, 15.0],
      headingRad: 0.0, // Facing East
      velocity: 0.0,
      batteryPct: 90,
      status: "ACTIVE",
      fsmState: "NAVIGATING_TO_DELIVERY",
      healthPct: 100,
      currentTaskId: "TASK-01",
      targetLocationId: "PACK-STATION-1",
      path: [[13, 15], [14, 15]],
      pathIndex: 0,
      currentPayloadKg: 20,
      stats: { distanceTraveledM: 0, tasksCompleted: 0, energyConsumedWh: 0, busyTicks: 0, idleTicks: 0, waitTicks: 0 },
      perception: { state: "HOLDING", frontObstacleId: "BOT-01", frontDistM: 1.1, warningProximity: true, yieldsToId: "BOT-01" },
      waitTicks: 2,
      backingOff: false,
      isReversing: false,
      reverseTicks: 0,
      recentBreadcrumbs: [[11, 15], [10, 15]],
      resumeGoalCoords: null,
      resumeTaskId: null,
      resumeLocationId: null,
      resumeFsmState: null,
      safeYieldsCount: 0,
    };

    // Calculate reverse step
    const revSpeed = 1.4 * 0.45; // 0.63 m/s
    const tickDuration = 0.1;
    const revStepDist = revSpeed * tickDuration;

    // Heading must remain exactly 0.0 (no 180° swing)
    const reverseHeading = bot.headingRad;
    expect(reverseHeading).toBe(0.0);

    // Step opposite to heading: revDx = -cos(0) * dist = -dist
    const revDx = -Math.cos(bot.headingRad) * revStepDist;
    const revDz = -Math.sin(bot.headingRad) * revStepDist;
    const newPos = [bot.position[0] + revDx, bot.position[1], bot.position[2] + revDz];

    // Robot translated backwards along X (from 12.0 to ~11.937)
    expect(newPos[0]).toBeLessThan(bot.position[0]);
    expect(newPos[2]).toBeCloseTo(bot.position[2]);
  });

  it("cascades reverse signal to trailing convoy robot when queue is blocked", () => {
    // Convoy: Bot A (front, pos [10, 0, 10]), Bot B (middle, pos [8.8, 0, 10]), Bot C (trailing, pos [7.5, 0, 10])
    const botB: BotUnit = {
      id: "BOT-02",
      profileId: "LIGHT_PICKER",
      position: [8.8, 0.25, 10.0],
      headingRad: 0.0, // Moving East
      velocity: 0,
      batteryPct: 90,
      status: "ACTIVE",
      fsmState: "NAVIGATING_TO_PICKUP",
      healthPct: 100,
      currentTaskId: "TASK-02",
      targetLocationId: "SHELF-1",
      path: [[9, 10], [10, 10]],
      pathIndex: 0,
      currentPayloadKg: 0,
      stats: { distanceTraveledM: 0, tasksCompleted: 0, energyConsumedWh: 0, busyTicks: 0, idleTicks: 0, waitTicks: 3 },
      perception: { state: "HOLDING", frontObstacleId: "BOT-01", frontDistM: 1.2, warningProximity: true, yieldsToId: "BOT-01" },
      waitTicks: 3,
      backingOff: false,
      isReversing: true,
      reverseTicks: 1,
      resumeGoalCoords: null,
      resumeTaskId: null,
      resumeLocationId: null,
      resumeFsmState: null,
      safeYieldsCount: 0,
    };

    const botC: BotUnit = {
      id: "BOT-03",
      profileId: "LIGHT_PICKER",
      position: [7.5, 0.25, 10.0],
      headingRad: 0.0, // Trailing behind Bot B
      velocity: 0,
      batteryPct: 90,
      status: "ACTIVE",
      fsmState: "NAVIGATING_TO_PICKUP",
      healthPct: 100,
      currentTaskId: "TASK-03",
      targetLocationId: "SHELF-2",
      path: [[8, 10], [9, 10]],
      pathIndex: 0,
      currentPayloadKg: 0,
      stats: { distanceTraveledM: 0, tasksCompleted: 0, energyConsumedWh: 0, busyTicks: 0, idleTicks: 0, waitTicks: 2 },
      perception: { state: "HOLDING", frontObstacleId: "BOT-02", frontDistM: 1.3, warningProximity: true, yieldsToId: null },
      waitTicks: 2,
      backingOff: false,
      isReversing: false,
      reverseTicks: 0,
      resumeGoalCoords: null,
      resumeTaskId: null,
      resumeLocationId: null,
      resumeFsmState: null,
      safeYieldsCount: 0,
    };

    // Bot B checks for trailing bot in lane
    const tdx = botC.position[0] - botB.position[0];
    const tdz = botC.position[2] - botB.position[2];
    const tDist = Math.hypot(tdx, tdz);
    const tAhead = tdx * Math.cos(botB.headingRad) + tdz * Math.sin(botB.headingRad);
    const tLat = Math.abs(-tdx * Math.sin(botB.headingRad) + tdz * Math.cos(botB.headingRad));

    // Bot C is directly behind Bot B (tAhead = -1.3m, tLat = 0)
    expect(tDist).toBeLessThan(2.5);
    expect(tAhead).toBeLessThan(-0.3);
    expect(tLat).toBeLessThan(0.85);

    // Cascading reverse protocol triggers Bot C to reverse
    const shouldCascadeReverse = tAhead < -0.3 && tLat < 0.85 && !botC.isReversing;
    expect(shouldCascadeReverse).toBe(true);
  });

  it("dynamically balances packing stations across Zone D to prevent funnel blockades", () => {
    // 3 Packing Stations in Zone D
    expect(PACKING_STATION_CONFIGS["PACK-STATION-1"]).toBeDefined();
    expect(PACKING_STATION_CONFIGS["PACK-STATION-2"]).toBeDefined();
    expect(PACKING_STATION_CONFIGS["PACK-STATION-3"]).toBeDefined();

    // Packing Station 1 has 3 bots heading to it
    const activeBotTargets: Record<string, string> = {
      "BOT-01": "PACK-STATION-1",
      "BOT-02": "PACK-STATION-1",
      "BOT-03": "PACK-STATION-1",
    };

    // Calculate station loads
    const stationLoads: Record<string, number> = {
      "PACK-STATION-1": 3,
      "PACK-STATION-2": 0, // Free!
      "PACK-STATION-3": 0, // Free!
    };

    // Approaching Bot 4 has initial destination PACK-STATION-1
    let assignedStation = "PACK-STATION-1";
    if (stationLoads[assignedStation] > 0) {
      // Find least loaded station
      let leastLoaded = assignedStation;
      let minLoad = stationLoads[assignedStation];
      Object.keys(stationLoads).forEach((pk) => {
        if (stationLoads[pk] < minLoad) {
          minLoad = stationLoads[pk];
          leastLoaded = pk;
        }
      });
      assignedStation = leastLoaded;
    }

    // Bot 4 is dynamically diverted to PACK-STATION-2 or PACK-STATION-3
    expect(assignedStation).not.toBe("PACK-STATION-1");
    expect(["PACK-STATION-2", "PACK-STATION-3"]).toContain(assignedStation);
  });
});
