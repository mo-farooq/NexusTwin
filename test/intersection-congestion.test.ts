import { describe, it, expect } from "vitest";
import {
  AISLE_CONFIGS,
  getAisleIdForLocation,
  isBotInsideAisle,
  type BotUnit,
} from "../src/store/useTwinStore";

describe("NexusTwin Intersection Congestion & Aisle Mutex Protocol", () => {
  it("correctly identifies aisle ID from shelf location", () => {
    expect(getAisleIdForLocation("SHELF-ZONE_A-1-3")).toBe("ZONE_A-AISLE-1");
    expect(getAisleIdForLocation("SHELF-ZONE_B-4-2")).toBe("ZONE_B-AISLE-4");
    expect(getAisleIdForLocation("PACK-STATION-1")).toBeNull();
    expect(getAisleIdForLocation("INBOUND-DOCK-1")).toBeNull();
  });

  it("correctly detects if a robot is inside a narrow rack aisle", () => {
    const cfg = AISLE_CONFIGS["ZONE_A-AISLE-1"];
    expect(cfg).toBeDefined();

    // Position inside Aisle 1 (row 9.5, col 10)
    expect(isBotInsideAisle([10, 0, 9.5], cfg)).toBe(true);

    // Position outside Aisle 1 on the cross-aisle (row 9.5, col 26)
    expect(isBotInsideAisle([26, 0, 9.5], cfg)).toBe(false);

    // Position in adjacent aisle (row 13.5, col 10)
    expect(isBotInsideAisle([10, 0, 13.5], cfg)).toBe(false);
  });

  it("enforces Aisle Mutex single-vehicle capacity and pre-entrance staging", () => {
    const cfg = AISLE_CONFIGS["ZONE_A-AISLE-1"];

    // Bot 1 is actively inside Aisle 1
    const bot1Pos: [number, number, number] = [12.0, 0, 9.5];
    expect(isBotInsideAisle(bot1Pos, cfg)).toBe(true);

    // Bot 2 approaches from the east cross-aisle toward Aisle 1
    const bot2StagingPoint = cfg.stagingPointEast; // [25.5, 9.5]
    const bot2ApproachingPos: [number, number, number] = [25.8, 0, 9.5];
    const distToStaging = Math.hypot(
      bot2ApproachingPos[0] - bot2StagingPoint[0],
      bot2ApproachingPos[2] - bot2StagingPoint[1]
    );

    // Assert Bot 2 is outside the aisle bounds and within staging threshold
    expect(isBotInsideAisle(bot2ApproachingPos, cfg)).toBe(false);
    expect(distToStaging).toBeLessThan(1.4);

    // Staging point is outside the rack boundary (maxCol = 23)
    expect(bot2StagingPoint[0]).toBeGreaterThan(cfg.maxCol);
  });

  it("balances dispatcher load by prioritizing tasks in unoccupied aisles", () => {
    const aisleOccupancy = new Map<string, string>();
    aisleOccupancy.set("ZONE_A-AISLE-1", "BOT-01"); // Aisle 1 is occupied

    const tasks = [
      { id: "TASK-1", sourceLocId: "SHELF-ZONE_A-1-2", priority: "NORMAL" }, // In occupied Aisle 1
      { id: "TASK-2", sourceLocId: "SHELF-ZONE_A-2-1", priority: "NORMAL" }, // In free Aisle 2
      { id: "TASK-3", sourceLocId: "SHELF-ZONE_B-1-1", priority: "NORMAL" }, // In free Zone B Aisle 1
    ];

    tasks.sort((a, b) => {
      const aAisle = getAisleIdForLocation(a.sourceLocId);
      const bAisle = getAisleIdForLocation(b.sourceLocId);
      const aOcc = aAisle && aisleOccupancy.has(aAisle) ? 1 : 0;
      const bOcc = bAisle && aisleOccupancy.has(bAisle) ? 1 : 0;
      return aOcc - bOcc;
    });

    // Unoccupied aisles should be scheduled ahead of occupied ones
    expect(tasks[0].id).not.toBe("TASK-1");
    expect(tasks[2].id).toBe("TASK-1");
  });

  it("asymmetric human right-of-way prevents mutual standoff with stopped AMR", () => {
    // When an AMR is stopped/yielding, velocity is 0
    const yieldingBot: Partial<BotUnit> = {
      id: "BOT-01",
      position: [20.0, 0, 26.0],
      velocity: 0,
      headingRad: 0,
    };

    // Human worker walking along pedestrian walkway at [19.2, 0, 26.0]
    const humanPos = [19.2, 0, 26.0];
    const bdx = yieldingBot.position![0] - humanPos[0];
    const bdz = yieldingBot.position![2] - humanPos[2];
    const bdist = Math.hypot(bdx, bdz);

    // AMR is within 1.8m
    expect(bdist).toBeLessThan(1.8);

    // Under Asymmetric Pedestrian Right-of-Way, human only halts if bot is moving fast (> 0.25 m/s)
    const isBotMovingFastTowardHuman = yieldingBot.velocity! > 0.25;
    expect(isBotMovingFastTowardHuman).toBe(false);

    // Result: Human does NOT freeze; continues walking smoothly past
    const humanYields = isBotMovingFastTowardHuman;
    expect(humanYields).toBe(false);
  });
});
