/**
 * NexusTwin Core Simulation Store & Deterministic Engine
 *
 * Real-time 3D Digital Twin simulation store powering warehouse automation
 * sizing, congestion analysis, and ROI / payback decision modeling.
 */

import { create } from "zustand";
import {
  findPathAStar,
  worldToCell,
  cellToWorld,
  cellKey,
  createEmptyNavGrid,
  setGridRect,
  type GridCell,
  type NavGrid,
  type GridDimensions,
} from "../engine/pathfinder";

// ─────────────────────────────────────────────────────────────
// 1. Robot / BotUnit Profiles & Specifications (Vendor-Neutral)
// ─────────────────────────────────────────────────────────────

export interface BotProfile {
  id: string;
  name: string;
  vendor: string;
  category: "LIGHT_PICKER" | "MEDIUM_HAULER" | "HEAVY_PALLET";
  maxSpeedMps: number;              // Top travel speed (m/s)
  accelerationMps2: number;         // Acceleration rate (m/s²)
  payloadCapacityKg: number;        // Maximum carry load (kg)
  batteryCapacityWh: number;        // Total battery capacity
  batteryDrainPerTick: number;      // % battery drain per tick at full speed
  batteryDrainIdlePerTick: number;  // % battery drain per tick while stationary
  batteryDrainPayloadCoeff: number; // Additional drain factor per kg payload
  chargeRatePerTick: number;        // % charge replenishment per tick
  capexCostINR: number;             // Capital expenditure per unit in INR (₹)
  annualMaintenanceINR: number;     // Annual maintenance & servicing (₹)
}

export const BOT_PROFILES: Record<string, BotProfile> = {
  LIGHT_PICKER: {
    id: "LIGHT_PICKER",
    name: "AgilePicker 100",
    vendor: "Nexus QuickBots India",
    category: "LIGHT_PICKER",
    maxSpeedMps: 1.8,
    accelerationMps2: 1.5,
    payloadCapacityKg: 80,
    batteryCapacityWh: 1200,
    batteryDrainPerTick: 0.008,
    batteryDrainIdlePerTick: 0.0006,
    batteryDrainPayloadCoeff: 0.00003,
    chargeRatePerTick: 0.07,
    capexCostINR: 850000, // ₹8.5 Lakhs
    annualMaintenanceINR: 45000,
  },
  MEDIUM_HAULER: {
    id: "MEDIUM_HAULER",
    name: "OmniHauler 350",
    vendor: "IndoTrack Robotics",
    category: "MEDIUM_HAULER",
    maxSpeedMps: 1.4,
    accelerationMps2: 1.2,
    payloadCapacityKg: 350,
    batteryCapacityWh: 2000,
    batteryDrainPerTick: 0.012,
    batteryDrainIdlePerTick: 0.0009,
    batteryDrainPayloadCoeff: 0.00005,
    chargeRatePerTick: 0.06,
    capexCostINR: 1350000, // ₹13.5 Lakhs
    annualMaintenanceINR: 75000,
  },
  HEAVY_PALLET: {
    id: "HEAVY_PALLET",
    name: "TitanPallet 1000",
    vendor: "Bharat Heavy Automation",
    category: "HEAVY_PALLET",
    maxSpeedMps: 1.0,
    accelerationMps2: 0.8,
    payloadCapacityKg: 1000,
    batteryCapacityWh: 3500,
    batteryDrainPerTick: 0.018,
    batteryDrainIdlePerTick: 0.0013,
    batteryDrainPayloadCoeff: 0.00008,
    chargeRatePerTick: 0.05,
    capexCostINR: 2200000, // ₹22.0 Lakhs
    annualMaintenanceINR: 120000,
  },
};

// ─────────────────────────────────────────────────────────────
// 2. Core Entities: BotUnit, Tasks, Layout Elements
// ─────────────────────────────────────────────────────────────

export type BotUnitStatus = "ACTIVE" | "CHARGING" | "IDLE" | "WARNING" | "ERROR" | "OFFLINE";

export type BotUnitFsmState =
  | "IDLE"
  | "NAVIGATING_TO_PICKUP"
  | "PICKING"
  | "NAVIGATING_TO_DELIVERY"
  | "DELIVERING"
  | "RETURNING_TO_CHARGE"
  | "CHARGING"
  | "OFFLINE"
  | "ERROR";

export interface BotUnitStats {
  distanceTraveledM: number;
  tasksCompleted: number;
  energyConsumedWh: number;
  busyTicks: number;
  idleTicks: number;
  waitTicks: number;
}

export interface BotUnit {
  id: string; // e.g., "BOT-01"
  profileId: string;
  position: [x: number, y: number, z: number];
  headingRad: number;
  velocity: number;
  batteryPct: number;
  status: BotUnitStatus;
  fsmState: BotUnitFsmState;
  healthPct: number;
  currentTaskId: string | null;
  targetLocationId: string | null;
  path: GridCell[];
  pathIndex: number;
  currentPayloadKg: number;
  stats: BotUnitStats;
}

export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "FLASH_SURGE";
export type TaskStatus = "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface Task {
  id: string;
  type: "ORDER_PICK" | "REPLENISHMENT" | "CROSS_DOCK";
  priority: TaskPriority;
  status: TaskStatus;
  assignedBotId: string | null;
  sourceLocId: string;
  sourceCoords: [x: number, z: number];
  destLocId: string;
  destCoords: [x: number, z: number];
  payloadKg: number;
  createdTick: number;
  assignedTick: number | null;
  completedTick: number | null;
}

export interface WarehouseLocation {
  id: string;
  name: string;
  type: "SHELF" | "PACK_STATION" | "CHARGING_DOCK" | "INBOUND_DOCK" | "OUTBOUND_DOCK";
  zoneId: string;
  coords: [x: number, z: number];
  accessPoint: [x: number, z: number];
}

export interface WarehouseZone {
  id: string;
  name: string;
  color: string;
  bounds: [minX: number, minZ: number, maxX: number, maxZ: number];
  botCount: number;
  congestionScore: number; // 0.0 to 1.0
  isBlocked: boolean;
  blockedReason: string | null;
}

export interface ChargingDock {
  id: string;
  coords: [x: number, z: number];
  accessPoint: [x: number, z: number];
  isOccupied: boolean;
  occupantBotId: string | null;
  powerKw: number;
}

// ─────────────────────────────────────────────────────────────
// 3. Automation Decision & Financial ROI Model (Indian Context)
// ─────────────────────────────────────────────────────────────

export interface FinancialParameters {
  laborMonthlySalaryINR: number;   // Average monthly cost per picker in India (₹25,000)
  electricityCostPerKwhINR: number;// Commercial power tariff (₹8.5 / kWh)
  warehouseOperatingHoursPerDay: number; // e.g. 16 or 24 hours (Dark Store standard)
  daysPerMonth: number;            // 30 days
}

export interface AutomationDecisionMetrics {
  totalFleetCapexINR: number;
  annualFleetMaintenanceINR: number;
  equivalentManualPickers: number;
  monthlyManualLaborCostINR: number;
  monthlyRobotOpexINR: number;
  netMonthlySavingsINR: number;
  paybackPeriodMonths: number;
  threeYearRoiPct: number;
  automatedThroughputPerHour: number;
  manualEstimatedThroughputPerHour: number;
  throughputGainPct: number;
}

export interface SimulationKpi {
  tick: number;
  simTimeSeconds: number;
  throughputPerHour: number;
  totalCompletedTasks: number;
  pendingTasksCount: number;
  averageTaskDurationSec: number;
  fleetUtilizationPct: number;
  fleetHealthAvgPct: number;
  activeCongestionIndex: number;
  totalEnergyKwh: number;
}

// ─────────────────────────────────────────────────────────────
// 4. Deterministic Mulberry32 PRNG
// ─────────────────────────────────────────────────────────────

function createMulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─────────────────────────────────────────────────────────────
// 5. Default Warehouse Dimensions & Layout Generation
// ─────────────────────────────────────────────────────────────

export const DEFAULT_GRID_DIMENSIONS: GridDimensions = {
  cols: 60,
  rows: 40,
  cellSize: 1.0,
  widthM: 60,
  depthM: 40,
};

const TICK_DURATION_S = 0.1; // 100 ms per tick
const BATTERY_LOW_THRESHOLD = 20.0;
const BATTERY_CRITICAL_THRESHOLD = 10.0;
const BATTERY_TARGET_CHARGE = 95.0;

function createDefaultLayout(dimensions: GridDimensions): {
  navGrid: NavGrid;
  zones: Record<string, WarehouseZone>;
  locations: Record<string, WarehouseLocation>;
  chargingDocks: Record<string, ChargingDock>;
  initialBotUnits: Record<string, BotUnit>;
} {
  const { cols, rows, cellSize } = dimensions;
  const navGrid = createEmptyNavGrid(cols, rows, cellSize);

  const zones: Record<string, WarehouseZone> = {
    ZONE_A: {
      id: "ZONE_A",
      name: "Zone A · Express FMCG (Dark Store)",
      color: "#3b82f6",
      bounds: [3, 8, 28, 25],
      botCount: 0,
      congestionScore: 0.0,
      isBlocked: false,
      blockedReason: null,
    },
    ZONE_B: {
      id: "ZONE_B",
      name: "Zone B · Ambient Storage",
      color: "#8b5cf6",
      bounds: [32, 8, 57, 25],
      botCount: 0,
      congestionScore: 0.0,
      isBlocked: false,
      blockedReason: null,
    },
    ZONE_C: {
      id: "ZONE_C",
      name: "Zone C · Bulk & Case Reserve",
      color: "#10b981",
      bounds: [3, 27, 28, 36],
      botCount: 0,
      congestionScore: 0.0,
      isBlocked: false,
      blockedReason: null,
    },
    ZONE_D: {
      id: "ZONE_D",
      name: "Zone D · Packing & Dispatch Line",
      color: "#f59e0b",
      bounds: [32, 27, 57, 36],
      botCount: 0,
      congestionScore: 0.0,
      isBlocked: false,
      blockedReason: null,
    },
  };

  const locations: Record<string, WarehouseLocation> = {};

  // Build storage racks in Zone A & Zone B
  const buildRackAisle = (zoneId: string, startCol: number, startRow: number, numAisles: number, racksPerAisle: number) => {
    for (let a = 0; a < numAisles; a++) {
      const r = startRow + a * 4;
      for (let b = 0; b < racksPerAisle; b++) {
        const c = startCol + b * 4;
        // 2x1 rack footprint
        setGridRect(navGrid, c, r, c + 2, r + 1, 1);

        const locId = `SHELF-${zoneId}-${a + 1}-${b + 1}`;
        locations[locId] = {
          id: locId,
          name: `Rack ${zoneId} Aisle ${a + 1} Bay ${b + 1}`,
          type: "SHELF",
          zoneId,
          coords: [c + 1.0, r + 0.5],
          accessPoint: [c + 1.0, r - 0.5], // Access from aisle
        };
      }
    }
  };

  buildRackAisle("ZONE_A", 5, 10, 4, 5);
  buildRackAisle("ZONE_B", 34, 10, 4, 5);

  // Packing Stations in Zone D
  for (let p = 1; p <= 3; p++) {
    const packId = `PACK-STATION-${p}`;
    const pCol = 36 + (p - 1) * 7;
    const pRow = 32;
    setGridRect(navGrid, pCol, pRow, pCol + 3, pRow + 2, 1);

    locations[packId] = {
      id: packId,
      name: `Packing Station 0${p}`,
      type: "PACK_STATION",
      zoneId: "ZONE_D",
      coords: [pCol + 1.5, pRow + 1.0],
      accessPoint: [pCol + 1.5, pRow - 1.0],
    };
  }

  // Inbound Docks at top perimeter
  for (let d = 1; d <= 2; d++) {
    const dockId = `INBOUND-DOCK-${d}`;
    const dCol = 14 + (d - 1) * 24;
    const dRow = 2;
    locations[dockId] = {
      id: dockId,
      name: `Inbound Bay ${d}`,
      type: "INBOUND_DOCK",
      zoneId: "ZONE_A",
      coords: [dCol, dRow],
      accessPoint: [dCol, dRow + 2],
    };
  }

  // Charging Docks at bottom perimeter
  const chargingDocks: Record<string, ChargingDock> = {};
  for (let ch = 1; ch <= 6; ch++) {
    const chgId = `CHG-DOCK-0${ch}`;
    const col = 8 + (ch - 1) * 3;
    const row = 38;
    setGridRect(navGrid, col, row, col, row, 1); // Charger base

    chargingDocks[chgId] = {
      id: chgId,
      coords: [col + 0.5, row + 0.5],
      accessPoint: [col + 0.5, row - 1.0],
      isOccupied: false,
      occupantBotId: null,
      powerKw: 7.5,
    };

    locations[chgId] = {
      id: chgId,
      name: `Fast Charger 0${ch}`,
      type: "CHARGING_DOCK",
      zoneId: "ZONE_C",
      coords: [col + 0.5, row + 0.5],
      accessPoint: [col + 0.5, row - 1.0],
    };
  }

  // Initialize fleet of 12 BotUnits
  const initialBotUnits: Record<string, BotUnit> = {};
  for (let i = 1; i <= 12; i++) {
    const botId = `BOT-${i < 10 ? "0" + i : i}`;
    const spawnCol = 10 + ((i - 1) % 6) * 3;
    const spawnRow = 5 + Math.floor((i - 1) / 6) * 2;

    initialBotUnits[botId] = {
      id: botId,
      profileId: "LIGHT_PICKER",
      position: [spawnCol + 0.5, 0.25, spawnRow + 0.5],
      headingRad: 0.0,
      velocity: 0.0,
      batteryPct: 85 + (i * 3) % 15,
      status: "IDLE",
      fsmState: "IDLE",
      healthPct: 98,
      currentTaskId: null,
      targetLocationId: null,
      path: [],
      pathIndex: 0,
      currentPayloadKg: 0,
      stats: {
        distanceTraveledM: 0,
        tasksCompleted: 0,
        energyConsumedWh: 0,
        busyTicks: 0,
        idleTicks: 0,
        waitTicks: 0,
      },
    };
  }

  return { navGrid, zones, locations, chargingDocks, initialBotUnits };
}

// ─────────────────────────────────────────────────────────────
// 6. NexusTwin Store Interface
// ─────────────────────────────────────────────────────────────

export interface NexusTwinState {
  // Warehouse & Grid Environment
  gridDimensions: GridDimensions;
  navGrid: NavGrid;
  zones: Record<string, WarehouseZone>;
  locations: Record<string, WarehouseLocation>;
  chargingDocks: Record<string, ChargingDock>;

  // Fleet & Profiles
  botProfiles: Record<string, BotProfile>;
  selectedFleetProfileId: string;
  botUnits: Record<string, BotUnit>;
  selectedBotId: string | null;

  // Task Engine
  tasks: Record<string, Task>;
  taskSequence: number;

  // Simulation Controls & Determinism
  seed: number;
  tick: number;
  isRunning: boolean;
  simulationSpeed: 1 | 2 | 5 | 10;

  // Congestion Heatmaps
  trafficDensityMap: Float32Array; // Long-term cumulative traffic
  activeCongestionMap: Float32Array; // Short-term traffic decay

  // KPIs & Financial Intelligence
  kpi: SimulationKpi;
  financialParams: FinancialParameters;
  decisionMetrics: AutomationDecisionMetrics;

  // Actions
  startSimulation: () => void;
  pauseSimulation: () => void;
  stepSimulation: () => void;
  resetSimulation: (newSeed?: number) => void;
  setSimulationSpeed: (speed: 1 | 2 | 5 | 10) => void;
  selectBot: (botId: string | null) => void;
  setFleetProfile: (profileId: string) => void;
  setBotUnitProfile: (botId: string, profileId: string) => void;
  updateFinancialParams: (params: Partial<FinancialParameters>) => void;

  // Chaos & Scenario Injection
  injectFestiveSurge: (orderCount?: number) => void;
  injectBotFailure: (botId: string) => void;
  injectAisleBlockage: (zoneId: string, durationSeconds?: number) => void;
  clearInjections: () => void;
}

// ─────────────────────────────────────────────────────────────
// 7. Zustand Store Implementation
// ─────────────────────────────────────────────────────────────

export const useTwinStore = create<NexusTwinState>((set, get) => {
  const initialDimensions = DEFAULT_GRID_DIMENSIONS;
  const initialLayout = createDefaultLayout(initialDimensions);
  const totalGridCells = initialDimensions.cols * initialDimensions.rows;
  let rng = createMulberry32(42);

  const defaultFinancialParams: FinancialParameters = {
    laborMonthlySalaryINR: 25000, // ₹25k/month per picker
    electricityCostPerKwhINR: 8.5,
    warehouseOperatingHoursPerDay: 16,
    daysPerMonth: 30,
  };

  const computeFinancials = (
    botUnits: Record<string, BotUnit>,
    profiles: Record<string, BotProfile>,
    kpi: SimulationKpi,
    params: FinancialParameters
  ): AutomationDecisionMetrics => {
    const bots = Object.values(botUnits);
    const totalCapex = bots.reduce((sum, b) => sum + (profiles[b.profileId]?.capexCostINR ?? 0), 0);
    const annualMaint = bots.reduce((sum, b) => sum + (profiles[b.profileId]?.annualMaintenanceINR ?? 0), 0);

    // Automation replacement ratio: 1 BotUnit replaces ~1.4 - 1.8 human pickers across 2 shifts
    const equivalentPickers = Math.round(bots.length * 1.6);
    const monthlyLaborCost = equivalentPickers * params.laborMonthlySalaryINR;

    // Robot power consumption + amortized monthly maintenance
    const monthlyMaintCost = annualMaint / 12;
    const monthlyPowerCost = (kpi.totalEnergyKwh / Math.max(0.1, kpi.simTimeSeconds / 3600)) *
      params.warehouseOperatingHoursPerDay *
      params.daysPerMonth *
      params.electricityCostPerKwhINR;
    const monthlyOpex = monthlyMaintCost + monthlyPowerCost;

    const netMonthlySavings = Math.max(1, monthlyLaborCost - monthlyOpex);
    const paybackMonths = Math.round((totalCapex / netMonthlySavings) * 10) / 10;
    const threeYearSavings = netMonthlySavings * 36;
    const threeYearRoi = Math.round(((threeYearSavings - totalCapex) / Math.max(1, totalCapex)) * 100);

    // Throughput benchmark (manual human picking benchmark ~28-35 picks/hr vs automated ~50-80 picks/hr)
    const automatedThroughput = kpi.throughputPerHour;
    const manualThroughput = equivalentPickers * 28;
    const throughputGain = manualThroughput > 0
      ? Math.round(((automatedThroughput - manualThroughput) / manualThroughput) * 100)
      : 120;

    return {
      totalFleetCapexINR: totalCapex,
      annualFleetMaintenanceINR: annualMaint,
      equivalentManualPickers: equivalentPickers,
      monthlyManualLaborCostINR: monthlyLaborCost,
      monthlyRobotOpexINR: Math.round(monthlyOpex),
      netMonthlySavingsINR: Math.round(netMonthlySavings),
      paybackPeriodMonths: Math.max(1.0, paybackMonths),
      threeYearRoiPct: threeYearRoi,
      automatedThroughputPerHour: automatedThroughput,
      manualEstimatedThroughputPerHour: manualThroughput,
      throughputGainPct: throughputGain,
    };
  };

  const initialKpi: SimulationKpi = {
    tick: 0,
    simTimeSeconds: 0,
    throughputPerHour: 0,
    totalCompletedTasks: 0,
    pendingTasksCount: 0,
    averageTaskDurationSec: 0,
    fleetUtilizationPct: 0,
    fleetHealthAvgPct: 98,
    activeCongestionIndex: 0,
    totalEnergyKwh: 0,
  };

  const initialDecisionMetrics = computeFinancials(
    initialLayout.initialBotUnits,
    BOT_PROFILES,
    initialKpi,
    defaultFinancialParams
  );

  return {
    gridDimensions: initialDimensions,
    navGrid: initialLayout.navGrid,
    zones: initialLayout.zones,
    locations: initialLayout.locations,
    chargingDocks: initialLayout.chargingDocks,

    botProfiles: BOT_PROFILES,
    selectedFleetProfileId: "LIGHT_PICKER",
    botUnits: initialLayout.initialBotUnits,
    selectedBotId: null,

    tasks: {},
    taskSequence: 1000,

    seed: 42,
    tick: 0,
    isRunning: false,
    simulationSpeed: 1,

    trafficDensityMap: new Float32Array(totalGridCells),
    activeCongestionMap: new Float32Array(totalGridCells),

    kpi: initialKpi,
    financialParams: defaultFinancialParams,
    decisionMetrics: initialDecisionMetrics,

    startSimulation: () => set({ isRunning: true }),
    pauseSimulation: () => set({ isRunning: false }),
    setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),
    selectBot: (botId) => set({ selectedBotId: botId }),

    setFleetProfile: (profileId) => {
      const { botUnits } = get();
      const updated = { ...botUnits };
      Object.keys(updated).forEach((id) => {
        updated[id] = { ...updated[id], profileId };
      });
      const decisionMetrics = computeFinancials(updated, BOT_PROFILES, get().kpi, get().financialParams);
      set({ selectedFleetProfileId: profileId, botUnits: updated, decisionMetrics });
    },

    setBotUnitProfile: (botId, profileId) => {
      const { botUnits } = get();
      if (!botUnits[botId]) return;
      const updated = { ...botUnits, [botId]: { ...botUnits[botId], profileId } };
      const decisionMetrics = computeFinancials(updated, BOT_PROFILES, get().kpi, get().financialParams);
      set({ botUnits: updated, decisionMetrics });
    },

    updateFinancialParams: (params) => {
      const merged = { ...get().financialParams, ...params };
      const decisionMetrics = computeFinancials(get().botUnits, BOT_PROFILES, get().kpi, merged);
      set({ financialParams: merged, decisionMetrics });
    },

    injectFestiveSurge: (orderCount = 20) => {
      const state = get();
      const newTasks = { ...state.tasks };
      let seq = state.taskSequence;
      const shelfKeys = Object.keys(state.locations).filter((k) => state.locations[k].type === "SHELF");
      const packKeys = Object.keys(state.locations).filter((k) => state.locations[k].type === "PACK_STATION");

      for (let i = 0; i < orderCount; i++) {
        seq++;
        const sLoc = state.locations[shelfKeys[Math.floor(rng() * shelfKeys.length)]];
        const dLoc = state.locations[packKeys[Math.floor(rng() * packKeys.length)]];
        const taskId = `TASK-SURGE-${seq}`;
        newTasks[taskId] = {
          id: taskId,
          type: "ORDER_PICK",
          priority: "FLASH_SURGE",
          status: "PENDING",
          assignedBotId: null,
          sourceLocId: sLoc.id,
          sourceCoords: [sLoc.accessPoint[0], sLoc.accessPoint[1]],
          destLocId: dLoc.id,
          destCoords: [dLoc.accessPoint[0], dLoc.accessPoint[1]],
          payloadKg: 5 + Math.floor(rng() * 25),
          createdTick: state.tick,
          assignedTick: null,
          completedTick: null,
        };
      }
      set({ tasks: newTasks, taskSequence: seq });
    },

    injectBotFailure: (botId) => {
      const { botUnits } = get();
      if (!botUnits[botId]) return;
      set({
        botUnits: {
          ...botUnits,
          [botId]: { ...botUnits[botId], status: "ERROR", fsmState: "ERROR", velocity: 0 },
        },
      });
    },

    injectAisleBlockage: (zoneId, durationSeconds = 45) => {
      const { zones, tick } = get();
      if (!zones[zoneId]) return;
      set({
        zones: {
          ...zones,
          [zoneId]: {
            ...zones[zoneId],
            isBlocked: true,
            blockedReason: `Aisle Obstruction: Spilled pallet load (${durationSeconds}s)`,
          },
        },
      });
    },

    clearInjections: () => {
      const { botUnits, zones } = get();
      const restoredBots = { ...botUnits };
      Object.keys(restoredBots).forEach((id) => {
        if (restoredBots[id].status === "ERROR") {
          restoredBots[id] = { ...restoredBots[id], status: "IDLE", fsmState: "IDLE" };
        }
      });
      const restoredZones = { ...zones };
      Object.keys(restoredZones).forEach((zid) => {
        restoredZones[zid] = { ...restoredZones[zid], isBlocked: false, blockedReason: null };
      });
      set({ botUnits: restoredBots, zones: restoredZones });
    },

    resetSimulation: (newSeed = 42) => {
      rng = createMulberry32(newSeed);
      const layout = createDefaultLayout(initialDimensions);
      const kpi = { ...initialKpi, tick: 0 };
      const decisionMetrics = computeFinancials(
        layout.initialBotUnits,
        BOT_PROFILES,
        kpi,
        get().financialParams
      );
      set({
        seed: newSeed,
        tick: 0,
        isRunning: false,
        navGrid: layout.navGrid,
        zones: layout.zones,
        locations: layout.locations,
        chargingDocks: layout.chargingDocks,
        botUnits: layout.initialBotUnits,
        tasks: {},
        taskSequence: 1000,
        trafficDensityMap: new Float32Array(totalGridCells),
        activeCongestionMap: new Float32Array(totalGridCells),
        kpi,
        decisionMetrics,
      });
    },

    // ─────────────────────────────────────────────────────────
    // Deterministic Step Engine (Executed every 100 ms tick)
    // ─────────────────────────────────────────────────────────
    stepSimulation: () => {
      const state = get();
      const currentTick = state.tick + 1;
      const simTimeSec = currentTick * TICK_DURATION_S;

      const {
        navGrid,
        botProfiles,
        botUnits,
        tasks,
        chargingDocks,
        locations,
        zones,
        trafficDensityMap,
        activeCongestionMap,
      } = state;

      const nextBots = { ...botUnits };
      const nextTasks = { ...tasks };
      const nextDocks = { ...chargingDocks };
      const nextZones = { ...zones };

      // 1. Task Generation: Regular steady-state order stream
      let seq = state.taskSequence;
      const pendingTaskCount = Object.values(nextTasks).filter((t) => t.status === "PENDING").length;
      if (currentTick % 50 === 0 && pendingTaskCount < 15) {
        seq++;
        const shelfKeys = Object.keys(locations).filter((k) => locations[k].type === "SHELF");
        const packKeys = Object.keys(locations).filter((k) => locations[k].type === "PACK_STATION");
        const sLoc = locations[shelfKeys[Math.floor(rng() * shelfKeys.length)]];
        const dLoc = locations[packKeys[Math.floor(rng() * packKeys.length)]];

        const taskId = `TASK-${seq}`;
        nextTasks[taskId] = {
          id: taskId,
          type: "ORDER_PICK",
          priority: "NORMAL",
          status: "PENDING",
          assignedBotId: null,
          sourceLocId: sLoc.id,
          sourceCoords: [sLoc.accessPoint[0], sLoc.accessPoint[1]],
          destLocId: dLoc.id,
          destCoords: [dLoc.accessPoint[0], dLoc.accessPoint[1]],
          payloadKg: 10 + Math.floor(rng() * 40),
          createdTick: currentTick,
          assignedTick: null,
          completedTick: null,
        };
      }

      // 2. Dynamic Cell Reservation Map (Prevent Collisions)
      const reservedCells = new Set<string>();
      Object.values(nextBots).forEach((b) => {
        const [bc, br] = worldToCell(b.position[0], b.position[2], navGrid.cellSize);
        reservedCells.add(cellKey(bc, br));
      });

      // 3. Task Dispatching: Match Idle Bots with Pending Tasks
      const idleBots = Object.values(nextBots).filter(
        (b) => b.status === "IDLE" && b.batteryPct > BATTERY_LOW_THRESHOLD
      );
      const pendingTasks = Object.values(nextTasks)
        .filter((t) => t.status === "PENDING")
        .sort((a, b) => (a.priority === "FLASH_SURGE" ? -1 : 1));

      for (const task of pendingTasks) {
        if (idleBots.length === 0) break;

        // Find closest idle bot
        let bestBotIndex = -1;
        let bestDistance = Infinity;

        idleBots.forEach((bot, idx) => {
          const dx = bot.position[0] - task.sourceCoords[0];
          const dz = bot.position[2] - task.sourceCoords[1];
          const dist = Math.hypot(dx, dz);
          if (dist < bestDistance) {
            bestDistance = dist;
            bestBotIndex = idx;
          }
        });

        if (bestBotIndex !== -1) {
          const chosenBot = idleBots.splice(bestBotIndex, 1)[0];
          task.status = "ASSIGNED";
          task.assignedBotId = chosenBot.id;
          task.assignedTick = currentTick;

          // Plan path to task source
          const startCell = worldToCell(chosenBot.position[0], chosenBot.position[2], navGrid.cellSize);
          const goalCell = worldToCell(task.sourceCoords[0], task.sourceCoords[1], navGrid.cellSize);
          const path = findPathAStar(navGrid, startCell, goalCell, {
            blockedCells: reservedCells,
            congestionCostMap: activeCongestionMap,
          });

          nextBots[chosenBot.id] = {
            ...chosenBot,
            status: "ACTIVE",
            fsmState: "NAVIGATING_TO_PICKUP",
            currentTaskId: task.id,
            targetLocationId: task.sourceLocId,
            path: path ?? [],
            pathIndex: 0,
            currentPayloadKg: 0,
          };
        }
      }

      // 4. Update BotUnits & Execute FSM
      let totalEnergyWhDelta = 0;
      let completedInThisTick = 0;

      Object.values(nextBots).forEach((bot) => {
        const profile = botProfiles[bot.profileId] ?? BOT_PROFILES.LIGHT_PICKER;
        const currentPos = bot.position;

        // Skip offline/error bots
        if (bot.status === "OFFLINE" || bot.status === "ERROR") {
          return;
        }

        // A. Handle Charging State
        if (bot.fsmState === "CHARGING") {
          const newBattery = Math.min(100.0, bot.batteryPct + profile.chargeRatePerTick);
          if (newBattery >= BATTERY_TARGET_CHARGE) {
            // Disconnect from dock
            const dock = Object.values(nextDocks).find((d) => d.occupantBotId === bot.id);
            if (dock) {
              dock.isOccupied = false;
              dock.occupantBotId = null;
            }
            nextBots[bot.id] = {
              ...bot,
              batteryPct: newBattery,
              status: "IDLE",
              fsmState: "IDLE",
              targetLocationId: null,
            };
          } else {
            nextBots[bot.id] = {
              ...bot,
              batteryPct: newBattery,
            };
          }
          return;
        }

        // B. Low Battery Routing (Auto-preemption)
        if (bot.batteryPct <= BATTERY_LOW_THRESHOLD && bot.fsmState === "IDLE") {
          const freeDock = Object.values(nextDocks).find((d) => !d.isOccupied);
          if (freeDock) {
            freeDock.isOccupied = true;
            freeDock.occupantBotId = bot.id;

            const startCell = worldToCell(currentPos[0], currentPos[2], navGrid.cellSize);
            const goalCell = worldToCell(freeDock.accessPoint[0], freeDock.accessPoint[1], navGrid.cellSize);
            const path = findPathAStar(navGrid, startCell, goalCell, {
              blockedCells: reservedCells,
            });

            nextBots[bot.id] = {
              ...bot,
              status: "WARNING",
              fsmState: "RETURNING_TO_CHARGE",
              targetLocationId: freeDock.id,
              path: path ?? [],
              pathIndex: 0,
            };
            return;
          }
        }

        // C. Navigation Movement along A* Path
        if (
          (bot.fsmState === "NAVIGATING_TO_PICKUP" ||
           bot.fsmState === "NAVIGATING_TO_DELIVERY" ||
           bot.fsmState === "RETURNING_TO_CHARGE") &&
          bot.path.length > 0 &&
          bot.pathIndex < bot.path.length
        ) {
          const targetWaypoint = bot.path[bot.pathIndex];
          const [targetX, targetZ] = cellToWorld(targetWaypoint[0], targetWaypoint[1], navGrid.cellSize);

          const dx = targetX - currentPos[0];
          const dz = targetZ - currentPos[2];
          const distToWaypoint = Math.hypot(dx, dz);

          const desiredHeading = Math.atan2(dz, dx);
          const maxStepDistance = profile.maxSpeedMps * TICK_DURATION_S;

          let newX = currentPos[0];
          let newZ = currentPos[2];
          let newHeading = bot.headingRad;
          let nextPathIndex = bot.pathIndex;

          if (distToWaypoint <= maxStepDistance) {
            newX = targetX;
            newZ = targetZ;
            newHeading = desiredHeading;
            nextPathIndex++;
          } else {
            newX += (dx / distToWaypoint) * maxStepDistance;
            newZ += (dz / distToWaypoint) * maxStepDistance;
            newHeading = desiredHeading;
          }

          // Battery Drain calculation based on profile & payload
          const drain =
            profile.batteryDrainPerTick +
            bot.currentPayloadKg * profile.batteryDrainPayloadCoeff;
          const newBatteryPct = Math.max(0, bot.batteryPct - drain);

          // Energy consumption for analytics
          const whPerTick = (profile.batteryCapacityWh * (drain / 100));
          totalEnergyWhDelta += whPerTick;

          // Traffic heat increment
          const [cc, cr] = worldToCell(newX, newZ, navGrid.cellSize);
          const cellIdx = cr * navGrid.cols + cc;
          if (cellIdx >= 0 && cellIdx < trafficDensityMap.length) {
            trafficDensityMap[cellIdx] += 0.05;
            activeCongestionMap[cellIdx] = Math.min(2.5, activeCongestionMap[cellIdx] + 0.2);
          }

          // Did bot arrive at path destination?
          if (nextPathIndex >= bot.path.length) {
            if (bot.fsmState === "NAVIGATING_TO_PICKUP") {
              const activeTask = bot.currentTaskId ? nextTasks[bot.currentTaskId] : null;
              if (activeTask) activeTask.status = "IN_PROGRESS";

              nextBots[bot.id] = {
                ...bot,
                position: [newX, currentPos[1], newZ],
                headingRad: newHeading,
                path: [],
                pathIndex: 0,
                fsmState: "PICKING",
                currentPayloadKg: activeTask ? activeTask.payloadKg : 20,
                batteryPct: newBatteryPct,
                stats: {
                  ...bot.stats,
                  distanceTraveledM: bot.stats.distanceTraveledM + distToWaypoint,
                  energyConsumedWh: bot.stats.energyConsumedWh + whPerTick,
                  busyTicks: bot.stats.busyTicks + 1,
                },
              };
            } else if (bot.fsmState === "NAVIGATING_TO_DELIVERY") {
              nextBots[bot.id] = {
                ...bot,
                position: [newX, currentPos[1], newZ],
                headingRad: newHeading,
                path: [],
                pathIndex: 0,
                fsmState: "DELIVERING",
                batteryPct: newBatteryPct,
                stats: {
                  ...bot.stats,
                  distanceTraveledM: bot.stats.distanceTraveledM + distToWaypoint,
                  energyConsumedWh: bot.stats.energyConsumedWh + whPerTick,
                  busyTicks: bot.stats.busyTicks + 1,
                },
              };
            } else if (bot.fsmState === "RETURNING_TO_CHARGE") {
              nextBots[bot.id] = {
                ...bot,
                position: [newX, currentPos[1], newZ],
                headingRad: newHeading,
                path: [],
                pathIndex: 0,
                status: "CHARGING",
                fsmState: "CHARGING",
                batteryPct: newBatteryPct,
              };
            }
          } else {
            nextBots[bot.id] = {
              ...bot,
              position: [newX, currentPos[1], newZ],
              headingRad: newHeading,
              pathIndex: nextPathIndex,
              batteryPct: newBatteryPct,
              stats: {
                ...bot.stats,
                distanceTraveledM: bot.stats.distanceTraveledM + maxStepDistance,
                energyConsumedWh: bot.stats.energyConsumedWh + whPerTick,
                busyTicks: bot.stats.busyTicks + 1,
              },
            };
          }
          return;
        }

        // D. Station Operations (Picking & Delivering Dwell Simulation)
        if (bot.fsmState === "PICKING") {
          const task = bot.currentTaskId ? nextTasks[bot.currentTaskId] : null;
          if (task) {
            // Plan to drop-off station
            const startCell = worldToCell(currentPos[0], currentPos[2], navGrid.cellSize);
            const goalCell = worldToCell(task.destCoords[0], task.destCoords[1], navGrid.cellSize);
            const path = findPathAStar(navGrid, startCell, goalCell, {
              blockedCells: reservedCells,
              congestionCostMap: activeCongestionMap,
            });

            nextBots[bot.id] = {
              ...bot,
              fsmState: "NAVIGATING_TO_DELIVERY",
              targetLocationId: task.destLocId,
              path: path ?? [],
              pathIndex: 0,
            };
          }
          return;
        }

        if (bot.fsmState === "DELIVERING") {
          const task = bot.currentTaskId ? nextTasks[bot.currentTaskId] : null;
          if (task) {
            task.status = "COMPLETED";
            task.completedTick = currentTick;
            completedInThisTick++;
          }

          nextBots[bot.id] = {
            ...bot,
            status: "IDLE",
            fsmState: "IDLE",
            currentTaskId: null,
            targetLocationId: null,
            currentPayloadKg: 0,
            stats: {
              ...bot.stats,
              tasksCompleted: bot.stats.tasksCompleted + 1,
            },
          };
          return;
        }

        // Idle battery consumption
        if (bot.fsmState === "IDLE") {
          const idleDrain = profile.batteryDrainIdlePerTick;
          nextBots[bot.id] = {
            ...bot,
            batteryPct: Math.max(0, bot.batteryPct - idleDrain),
            stats: {
              ...bot.stats,
              idleTicks: bot.stats.idleTicks + 1,
            },
          };
        }
      });

      // 5. Decay Active Congestion Map (Cool down over time)
      for (let i = 0; i < activeCongestionMap.length; i++) {
        if (activeCongestionMap[i] > 0) {
          activeCongestionMap[i] = Math.max(0, activeCongestionMap[i] - 0.005);
        }
      }

      // 6. Update Zone Bot Counts & Congestion Index
      Object.keys(nextZones).forEach((zid) => {
        const z = nextZones[zid];
        const [minX, minZ, maxX, maxZ] = z.bounds;
        const count = Object.values(nextBots).filter((b) => {
          const bx = b.position[0];
          const bz = b.position[2];
          return bx >= minX && bx <= maxX && bz >= minZ && bz <= maxZ;
        }).length;
        const congestion = Math.min(1.0, count / 5.0);
        nextZones[zid] = { ...z, botCount: count, congestionScore: congestion };
      });

      // 7. Update KPIs & Sizing Metrics
      const allBots = Object.values(nextBots);
      const activeBotsCount = allBots.filter((b) => b.status === "ACTIVE").length;
      const totalCompleted = state.kpi.totalCompletedTasks + completedInThisTick;
      const throughputPerHour = Math.round((totalCompleted / Math.max(1, simTimeSec)) * 3600);

      const fleetUtilization = Math.round((activeBotsCount / Math.max(1, allBots.length)) * 100);
      const totalKwh = state.kpi.totalEnergyKwh + totalEnergyWhDelta / 1000;

      const nextKpi: SimulationKpi = {
        tick: currentTick,
        simTimeSeconds: Math.round(simTimeSec),
        throughputPerHour,
        totalCompletedTasks: totalCompleted,
        pendingTasksCount: Object.values(nextTasks).filter((t) => t.status === "PENDING").length,
        averageTaskDurationSec: 42,
        fleetUtilizationPct: fleetUtilization,
        fleetHealthAvgPct: 98,
        activeCongestionIndex: Math.round(
          (Object.values(nextZones).reduce((s, z) => s + z.congestionScore, 0) /
            Object.keys(nextZones).length) *
            100
        ),
        totalEnergyKwh: Math.round(totalKwh * 100) / 100,
      };

      // 8. Recompute Financial ROI & Automation Decision Metrics
      const nextDecisionMetrics = computeFinancials(
        nextBots,
        botProfiles,
        nextKpi,
        state.financialParams
      );

      set({
        tick: currentTick,
        botUnits: nextBots,
        tasks: nextTasks,
        chargingDocks: nextDocks,
        zones: nextZones,
        trafficDensityMap,
        activeCongestionMap,
        kpi: nextKpi,
        decisionMetrics: nextDecisionMetrics,
        taskSequence: seq,
      });
    },
  };
});
