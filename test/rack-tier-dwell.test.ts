import { describe, it, expect, beforeEach } from "vitest";
import { useTwinStore } from "../src/store/useTwinStore";

describe("Ground Truth Simulation Math: Rack Tier Lift & Physical Dwell", () => {
  beforeEach(() => {
    useTwinStore.getState().resetSimulation(42);
    useTwinStore.setState({ isRunning: true });
  });

  it("proves Level 4 picks physically dwell 5.5x longer than Level 1 picks", () => {
    const store = useTwinStore.getState();
    const botId = "BOT-01";
    const bot = store.botUnits[botId];
    expect(bot).toBeDefined();

    // 1. Test Level 1 pick dwell
    useTwinStore.setState({
      tasks: {
        "TASK-TEST-L1": {
          id: "TASK-TEST-L1",
          type: "ORDER_PICK",
          priority: "HIGH",
          status: "IN_PROGRESS",
          assignedBotId: botId,
          sourceLocId: "SHELF-ZONE_A-1-1",
          sourceCoords: [5, 6],
          destLocId: "PACK-STATION-1",
          destCoords: [36, 32],
          payloadKg: 20,
          createdTick: 0,
          assignedTick: 0,
          completedTick: null,
          targetTier: 1,
        },
      },
      botUnits: {
        ...store.botUnits,
        [botId]: {
          ...bot,
          status: "BUSY",
          fsmState: "PICKING",
          currentTaskId: "TASK-TEST-L1",
          targetLocationId: "SHELF-ZONE_A-1-1",
          waitTicks: 0,
        },
      },
    });

    // Step simulation 15 ticks (< 20 ticks required for Level 1)
    useTwinStore.getState().stepSimulation(15);
    let state = useTwinStore.getState();
    let currentBot = state.botUnits[botId];
    // Still picking because 15 < 20 ticks
    expect(currentBot.fsmState).toBe("PICKING");
    expect(currentBot.waitTicks).toBe(15);
    expect(currentBot.pickDwellTicksRemaining).toBe(5);

    // Step 10 more ticks (total 25 ticks > 20 ticks) -> should complete pick & transition to NAVIGATING_TO_DELIVERY
    useTwinStore.getState().stepSimulation(10);
    state = useTwinStore.getState();
    currentBot = state.botUnits[botId];
    expect(currentBot.fsmState).toBe("NAVIGATING_TO_DELIVERY");
    expect(currentBot.pickDwellTicksRemaining).toBe(0);

    // 2. Test Level 4 pick dwell (requires 110 ticks at 10 Hz / 11.0s)
    useTwinStore.setState({
      tasks: {
        "TASK-TEST-L4": {
          id: "TASK-TEST-L4",
          type: "ORDER_PICK",
          priority: "HIGH",
          status: "IN_PROGRESS",
          assignedBotId: botId,
          sourceLocId: "SHELF-ZONE_A-1-1",
          sourceCoords: [5, 6],
          destLocId: "PACK-STATION-1",
          destCoords: [36, 32],
          payloadKg: 20,
          createdTick: 0,
          assignedTick: 0,
          completedTick: null,
          targetTier: 4,
        },
      },
      botUnits: {
        ...state.botUnits,
        [botId]: {
          ...currentBot,
          status: "BUSY",
          fsmState: "PICKING",
          currentTaskId: "TASK-TEST-L4",
          targetLocationId: "SHELF-ZONE_A-1-1",
          waitTicks: 0,
        },
      },
    });

    // Step simulation 50 ticks (far past Level 1 duration of 20 ticks)
    for (let i = 0; i < 5; i++) useTwinStore.getState().stepSimulation(10);
    state = useTwinStore.getState();
    currentBot = state.botUnits[botId];
    // Must STILL be in PICKING state because Level 4 requires 110 ticks!
    expect(currentBot.fsmState).toBe("PICKING");
    expect(currentBot.waitTicks).toBe(50);
    expect(currentBot.pickDwellTicksRemaining).toBe(60);

    // Step another 50 ticks (total 100 ticks, still < 110 ticks)
    for (let i = 0; i < 5; i++) useTwinStore.getState().stepSimulation(10);
    state = useTwinStore.getState();
    currentBot = state.botUnits[botId];
    expect(currentBot.fsmState).toBe("PICKING");
    expect(currentBot.waitTicks).toBe(100);
    expect(currentBot.pickDwellTicksRemaining).toBe(10);

    // Step final 20 ticks (total 120 ticks >= 110 ticks) -> now transitions to NAVIGATING_TO_DELIVERY
    useTwinStore.getState().stepSimulation(20);
    state = useTwinStore.getState();
    currentBot = state.botUnits[botId];
    expect(currentBot.fsmState).toBe("NAVIGATING_TO_DELIVERY");
    expect(currentBot.pickDwellTicksRemaining).toBe(0);
  });
});
