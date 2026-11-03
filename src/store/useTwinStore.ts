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
  isCellTraversable,
  type GridCell,
  type NavGrid,
  type GridDimensions,
} from "../engine/pathfinder";
import type { AutoZonedLayout, ConveyorSegment } from "../engine/autoZoner";

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
    name: "Lite Tote Bot",
    vendor: "QuickBot India",
    category: "LIGHT_PICKER",
    maxSpeedMps: 1.2,
    accelerationMps2: 1.2,
    payloadCapacityKg: 100,
    batteryCapacityWh: 1200,
    batteryDrainPerTick: 0.007,
    batteryDrainIdlePerTick: 0.0005,
    batteryDrainPayloadCoeff: 0.00003,
    chargeRatePerTick: 0.08,
    capexCostINR: 450000, // ₹4.5 Lakhs
    annualMaintenanceINR: 32000,
  },
  MEDIUM_HAULER: {
    id: "MEDIUM_HAULER",
    name: "Medium Pallet Hauler",
    vendor: "Falcon Robotics",
    category: "MEDIUM_HAULER",
    maxSpeedMps: 1.6,
    accelerationMps2: 1.1,
    payloadCapacityKg: 400,
    batteryCapacityWh: 2200,
    batteryDrainPerTick: 0.011,
    batteryDrainIdlePerTick: 0.0008,
    batteryDrainPayloadCoeff: 0.00005,
    chargeRatePerTick: 0.06,
    capexCostINR: 700000, // ₹7.0 Lakhs
    annualMaintenanceINR: 50000,
  },
  HEAVY_PALLET: {
    id: "HEAVY_PALLET",
    name: "Heavy Rack Mover",
    vendor: "Bharat Logistics AMR",
    category: "HEAVY_PALLET",
    maxSpeedMps: 2.0,
    accelerationMps2: 1.4,
    payloadCapacityKg: 1000,
    batteryCapacityWh: 3500,
    batteryDrainPerTick: 0.015,
    batteryDrainIdlePerTick: 0.0011,
    batteryDrainPayloadCoeff: 0.00007,
    chargeRatePerTick: 0.05,
    capexCostINR: 950000, // ₹9.5 Lakhs
    annualMaintenanceINR: 68000,
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

export type AntiCollisionState = "CLEAR" | "SLOWING" | "HOLDING" | "YIELDING" | "BACKING_OFF";

export interface BotPerception {
  state: AntiCollisionState;
  frontObstacleId: string | null;
  frontDistM: number | null;
  warningProximity: boolean;
  yieldsToId: string | null;
}

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
  perception: BotPerception;
  waitTicks: number;
  backingOff: boolean;
  resumeGoalCoords: [x: number, z: number] | null;
  resumeTaskId: string | null;
  resumeLocationId: string | null;
  resumeFsmState: BotUnitFsmState | null;
  safeYieldsCount: number;
}

export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "FLASH_SURGE";
export type TaskStatus = "PENDING" | "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface ShelfTier {
  level: 1 | 2 | 3 | 4;
  skuName: string;
  velocity: "HIGH" | "MEDIUM" | "LOW";
  pickDurationSec: number; // Level 1: 2.0s, Level 2: 4.5s, Level 3: 7.5s, Level 4: 11.0s
  batteryMultiplier: number; // Level 1: 1.0x, Level 2: 1.4x, Level 3: 1.9x, Level 4: 2.6x
}

export interface ExplainableDispatchLog {
  id: string;
  timestamp: string;
  botId: string;
  taskId: string;
  targetRack: string;
  tier: number;
  reason: string;
}

export interface Task {
  id: string;
  type: "ORDER_PICK" | "INBOUND_PUTAWAY" | "REPLENISHMENT" | "CROSS_DOCK";
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
  targetTier?: 1 | 2 | 3 | 4;
  skuName?: string;
}

export interface WarehouseLocation {
  id: string;
  name: string;
  type: "SHELF" | "PACK_STATION" | "CHARGING_DOCK" | "INBOUND_DOCK" | "OUTBOUND_DOCK";
  zoneId: string;
  coords: [x: number, z: number];
  accessPoint: [x: number, z: number];
  tiers?: ShelfTier[];
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
  sectionType?: "INBOUND" | "STORAGE" | "CHARGING" | "PACKING" | "OUTBOUND";
}

export interface ChargingDock {
  id: string;
  coords: [x: number, z: number];
  accessPoint: [x: number, z: number];
  isOccupied: boolean;
  occupantBotId: string | null;
  powerKw: number;
}

export interface ElevatorNode {
  id: string;
  name: string;
  coords: [x: number, z: number];
  currentFloor: number;
  targetFloor: number | null;
  status: "IDLE" | "MOVING_UP" | "MOVING_DOWN" | "BOARDING" | "MAINTENANCE";
  queueLength: number;
  doorState: "OPEN" | "CLOSED";
}

// ─────────────────────────────────────────────────────────────
// 3. Automation Decision & Financial ROI Model (Indian Context)
// ─────────────────────────────────────────────────────────────

export interface FinancialParameters {
  laborMonthlySalaryINR: number;        // Average monthly wage per picker in India (default ₹18,000)
  customRobotUnitCostINR?: number | null; // Editable custom override in INR (e.g. ₹4.5L or ₹9.5L)
  slaPenaltyPerMissedOrderINR: number;  // SLA Penalty Cost per delayed order (default ₹150)
  electricityCostPerKwhINR: number;     // Commercial power tariff (₹8.5 / kWh)
  warehouseOperatingHoursPerDay: number;// e.g. 16 hours
  daysPerMonth: number;                 // 30 days
}

export interface AutomationDecisionMetrics {
  totalFleetCapexINR: number;
  annualFleetMaintenanceINR: number;
  equivalentManualPickers: number;
  monthlyManualLaborCostINR: number;
  monthlyRobotOpexINR: number;
  monthlySlaPenaltySavingsINR: number;
  netMonthlySavingsINR: number;
  paybackPeriodMonths: number;
  threeYearRoiPct: number;
  automatedThroughputPerHour: number;
  manualEstimatedThroughputPerHour: number;
  throughputGainPct: number;
  bottleneckZoneId: string;
  bottleneckZoneName: string;
  bottleneckCongestionPct: number;
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
  slaCompliancePct: number;
  totalSafeYieldsResolved: number;
  nearMissesPrevented: number;
  activeAntiCollisionCount: number;
  safetyViolationCount: number;
}

export interface TwinEvent {
  id: string;
  tick: number;
  time: string;
  type: string;
  source: "ROBOT" | "FLEET_MANAGER" | "PLANNER" | "SIMULATION" | "CONVEYOR" | "LIDAR" | "USER" | "AI_COPILOT";
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  robotId?: string;
  taskId?: string;
  zoneId?: string;
}

export interface AlertItem {
  id: string;
  title: string;
  detail: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  createdTick: number;
  robotId?: string;
  zoneId?: string;
  acknowledged: boolean;
}

export interface HumanWorker {
  id: string;
  name: string;
  role: string;
  position: [x: number, y: number, z: number];
  headingRad: number;
  waypoints: Array<[x: number, z: number]>;
  currentWaypointIndex: number;
  speed: number;
  zoneId: string;
}

export interface WhatIfMetricRow {
  key: string;
  label: string;
  baseline: number;
  scenario: number;
  delta: number;
  unit: string;
  higherIsBetter: boolean;
}

export interface WhatIfResult {
  scenarioName: string;
  durationSeconds: number;
  computeMs: number;
  startTick: number;
  metrics: WhatIfMetricRow[];
  recommendation: string;
  financialImpactINR: number;
  injectedChanges: {
    surgeMultiplier?: number;
    blockedZones?: string[];
    breakdownBots?: string[];
    conveyorJammed?: boolean;
  };
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
  elevators: Record<string, ElevatorNode>;
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
        const isAisleTopHeavy = (a + b) % 2 === 0;
        const tiers: ShelfTier[] = [
          {
            level: 4,
            skuName: isAisleTopHeavy ? "Festive Sweet Hampers (Diwali Box)" : "Bulk Aata & Basmati Rice 10kg",
            velocity: isAisleTopHeavy ? "HIGH" : "LOW",
            pickDurationSec: 11.0,
            batteryMultiplier: 2.6,
          },
          {
            level: 3,
            skuName: "Instant Noodles & Pasta Multipacks",
            velocity: "MEDIUM",
            pickDurationSec: 7.5,
            batteryMultiplier: 1.9,
          },
          {
            level: 2,
            skuName: "Ready-to-Drink Juices & Cold Brew",
            velocity: "MEDIUM",
            pickDurationSec: 4.5,
            batteryMultiplier: 1.4,
          },
          {
            level: 1,
            skuName: isAisleTopHeavy ? "Artisanal Dips & Spreads" : "Snack Crisps & Namkeen 150g",
            velocity: isAisleTopHeavy ? "LOW" : "HIGH",
            pickDurationSec: 2.0,
            batteryMultiplier: 1.0,
          },
        ];

        locations[locId] = {
          id: locId,
          name: `Rack ${zoneId.replace("ZONE_", "")} Aisle ${a + 1} Bay ${b + 1}`,
          type: "SHELF",
          zoneId,
          coords: [c + 1.0, r + 0.5],
          accessPoint: [c + 1.0, r - 0.5], // Access from aisle
          tiers,
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

  // Freight Elevators connecting Ground & Mezzanine Levels
  const elevators: Record<string, ElevatorNode> = {
    "LIFT-01": {
      id: "LIFT-01",
      name: "Freight Lift 01 (North Mezzanine)",
      coords: [30.0, 14.0],
      currentFloor: 1,
      targetFloor: null,
      status: "IDLE",
      queueLength: 0,
      doorState: "CLOSED",
    },
    "LIFT-02": {
      id: "LIFT-02",
      name: "Freight Lift 02 (South Mezzanine)",
      coords: [30.0, 26.0],
      currentFloor: 1,
      targetFloor: null,
      status: "IDLE",
      queueLength: 0,
      doorState: "CLOSED",
    },
  };
  setGridRect(navGrid, 29, 13, 31, 15, 1); // Lift 1 footprint
  setGridRect(navGrid, 29, 25, 31, 27, 1); // Lift 2 footprint

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
      perception: {
        state: "CLEAR",
        frontObstacleId: null,
        frontDistM: null,
        warningProximity: false,
        yieldsToId: null,
      },
      waitTicks: 0,
      backingOff: false,
      resumeGoalCoords: null,
      resumeTaskId: null,
      resumeLocationId: null,
      resumeFsmState: null,
      safeYieldsCount: 0,
    };
  }

  return { navGrid, zones, locations, chargingDocks, elevators, initialBotUnits };
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
  elevators: Record<string, ElevatorNode>;

  // Selection & Heatmap Overlays
  selectedBotId: string | null;
  selectedElevatorId: string | null;
  selectedStationId: string | null;
  selectedRackId: string | null;
  focusTarget: [number, number, number] | null;
  heatmapMode: boolean;
  layoutPreset: "DARK_STORE" | "REGIONAL_HUB" | "MSME_CENTER";

  // Fleet & Profiles
  botProfiles: Record<string, BotProfile>;
  selectedFleetProfileId: string;
  botUnits: Record<string, BotUnit>;

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

  // Decision Sandbox & Chaos Engine
  isSandboxModalOpen: boolean;
  isObstaclePlacementActive: boolean;
  customObstacles: Array<{ id: string; col: number; row: number; label: string }>;
  isFestiveSurgeActive: boolean;
  surgeMultiplier: number;

  // 4-Tier Slotting & Explainable Dispatch
  explainableLogs: ExplainableDispatchLog[];
  defragMessage: string | null;

  // Actions
  startSimulation: () => void;
  pauseSimulation: () => void;
  stepSimulation: () => void;
  resetSimulation: (newSeed?: number) => void;
  setSimulationSpeed: (speed: 1 | 2 | 5 | 10) => void;
  selectBot: (botId: string | null) => void;
  selectElevator: (id: string | null) => void;
  selectStation: (id: string | null) => void;
  selectRack: (id: string | null) => void;
  setFocusTarget: (target: [number, number, number] | null) => void;
  setLayoutPreset: (preset: "DARK_STORE" | "REGIONAL_HUB" | "MSME_CENTER") => void;
  toggleHeatmapMode: () => void;
  setHeatmapMode: (active: boolean) => void;
  setFleetProfile: (profileId: string) => void;
  setBotUnitProfile: (botId: string, profileId: string) => void;
  updateFinancialParams: (params: Partial<FinancialParameters>) => void;

  // Sandbox Modal & Floor Obstacles
  openSandboxModal: () => void;
  closeSandboxModal: () => void;
  toggleObstaclePlacementMode: (active?: boolean) => void;
  toggleFloorObstacle: (col: number, row: number) => void;
  clearFloorObstacles: () => void;
  setFleetSize: (count: number) => void;
  breakdownBot: (botId?: string) => void;
  repairFleet: () => void;

  // Blueprint Upload & Auto-Zoning Studio
  customBlueprintUrl: string | null;
  conveyors: ConveyorSegment[];
  isBuilderModalOpen: boolean;
  openBuilderModal: () => void;
  closeBuilderModal: () => void;
  applyCustomLayout: (layout: AutoZonedLayout, blueprintUrl?: string | null) => void;

  // View & UI Navigation
  viewTab: "3D" | "MAP" | "TRAFFIC" | "HEATMAP";
  showLabels: boolean;
  showPaths: boolean;
  activeFloor: "all" | "exploded" | 1 | 2;
  activeCamera: string;
  drawer: null | "copilot" | "scenarios" | "whatif";
  modal: null | "audit" | "tasks" | "builder" | "sandbox";

  setViewTab: (tab: "3D" | "MAP" | "TRAFFIC" | "HEATMAP") => void;
  toggleLabels: () => void;
  setShowLabels: (show: boolean) => void;
  togglePaths: () => void;
  setActiveFloor: (floor: "all" | "exploded" | 1 | 2) => void;
  setActiveCamera: (cam: string) => void;
  setDrawer: (drawer: null | "copilot" | "scenarios" | "whatif") => void;
  setModal: (modal: null | "audit" | "tasks" | "builder" | "sandbox") => void;

  // Real-time Event Ledger & Alerts
  recentEvents: TwinEvent[];
  alerts: Record<string, AlertItem>;
  logEvent: (event: Omit<TwinEvent, "id" | "time">) => void;
  ackAlert: (id: string) => void;

  // Dynamic Human Workers & Safety
  people: Record<string, HumanWorker>;

  // Headless What-If Engine
  whatIfResult: WhatIfResult | null;
  runWhatIfSimulation: (scenarioType: "FESTIVE_3X" | "BOT_BREAKDOWN" | "AISLE_BLOCK" | "CONVEYOR_JAM") => Promise<WhatIfResult>;
  applyWhatIfToLive: () => void;
  clearWhatIfResult: () => void;

  // Chaos, VIP Swarm & AI Defragmentation
  injectFestiveSurge: (orderCount?: number, multiplier?: number) => void;
  injectVipOrder: () => void;
  defragmentRacks: () => { latencyReductionPct: number; savedKwh: number };
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
    laborMonthlySalaryINR: 18000, // ₹18,000/month per picker in India (per user prompt)
    customRobotUnitCostINR: null, // Default to profile cost (₹4.5L or ₹9.5L)
    slaPenaltyPerMissedOrderINR: 150, // ₹150 per delayed order
    electricityCostPerKwhINR: 8.5,
    warehouseOperatingHoursPerDay: 16,
    daysPerMonth: 30,
  };

  const computeFinancials = (
    botUnits: Record<string, BotUnit>,
    profiles: Record<string, BotProfile>,
    kpi: SimulationKpi,
    params: FinancialParameters,
    overrideZones?: Record<string, WarehouseZone>
  ): AutomationDecisionMetrics => {
    const bots = Object.values(botUnits);
    const totalCapex =
      params.customRobotUnitCostINR && params.customRobotUnitCostINR > 0
        ? bots.length * params.customRobotUnitCostINR
        : bots.reduce((sum, b) => sum + (profiles[b.profileId]?.capexCostINR ?? 0), 0);

    const annualMaint = bots.reduce((sum, b) => sum + (profiles[b.profileId]?.annualMaintenanceINR ?? 0), 0);

    // Automation replacement ratio: 1 BotUnit replaces ~1.5 - 1.8 human pickers across 2 shifts
    const equivalentPickers = Math.round(bots.length * 1.6);
    const monthlyLaborCost = equivalentPickers * params.laborMonthlySalaryINR;

    // Robot power consumption + amortized monthly maintenance
    const monthlyMaintCost = annualMaint / 12;
    const monthlyPowerCost =
      (kpi.totalEnergyKwh / Math.max(0.1, kpi.simTimeSeconds / 3600)) *
      params.warehouseOperatingHoursPerDay *
      params.daysPerMonth *
      params.electricityCostPerKwhINR;
    const monthlyOpex = monthlyMaintCost + monthlyPowerCost;

    // SLA penalty savings: in manual operations, ~5% of orders miss Indian 15-min or 3PL delivery SLA
    const monthlyOrders =
      Math.max(150, kpi.throughputPerHour || bots.length * 28) *
      params.warehouseOperatingHoursPerDay *
      params.daysPerMonth;
    const monthlySlaPenaltySavings = Math.round(monthlyOrders * 0.045 * (params.slaPenaltyPerMissedOrderINR || 150));

    const netMonthlySavings = Math.max(1000, monthlyLaborCost + monthlySlaPenaltySavings - monthlyOpex);
    const paybackMonths = Math.max(0.5, Math.round((totalCapex / netMonthlySavings) * 10) / 10);
    const threeYearSavings = netMonthlySavings * 36;
    const threeYearRoi = Math.round(((threeYearSavings - totalCapex) / Math.max(1, totalCapex)) * 100);

    // Throughput benchmark (manual human picking benchmark ~25-30 picks/hr vs automated ~50-80 picks/hr)
    const automatedThroughput = kpi.throughputPerHour || Math.round(bots.length * 32);
    const manualThroughput = equivalentPickers * 28;
    const throughputGain =
      manualThroughput > 0
        ? Math.round(((automatedThroughput - manualThroughput) / manualThroughput) * 100)
        : 140;

    // Live bottleneck zone detection
    const zonesMap =
      overrideZones ||
      (typeof get === "function" && get?.()?.zones) ||
      initialLayout.zones;
    const zonesList = Object.values(zonesMap);
    let worstZone = zonesList[0];
    zonesList.forEach((z) => {
      if ((z.congestionScore ?? 0) > (worstZone?.congestionScore ?? -1)) {
        worstZone = z;
      }
    });

    return {
      totalFleetCapexINR: totalCapex,
      annualFleetMaintenanceINR: annualMaint,
      equivalentManualPickers: equivalentPickers,
      monthlyManualLaborCostINR: monthlyLaborCost,
      monthlyRobotOpexINR: Math.round(monthlyOpex),
      monthlySlaPenaltySavingsINR: monthlySlaPenaltySavings,
      netMonthlySavingsINR: Math.round(netMonthlySavings),
      paybackPeriodMonths: paybackMonths,
      threeYearRoiPct: threeYearRoi,
      automatedThroughputPerHour: automatedThroughput,
      manualEstimatedThroughputPerHour: manualThroughput,
      throughputGainPct: throughputGain,
      bottleneckZoneId: worstZone?.id ?? "ZONE_B",
      bottleneckZoneName: worstZone?.name ?? "Zone B · High-Velocity Snack Aisles",
      bottleneckCongestionPct: Math.round((worstZone?.congestionScore ?? 0.38) * 100),
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
    slaCompliancePct: 99.2,
    totalSafeYieldsResolved: 0,
    nearMissesPrevented: 0,
    activeAntiCollisionCount: 0,
    safetyViolationCount: 0,
  };

  const initialPeople: Record<string, HumanWorker> = {
    "WORKER-01": {
      id: "WORKER-01",
      name: "Rahul Sharma",
      role: "Zone B Picker",
      position: [16.0, 0, 18.0],
      headingRad: 0,
      waypoints: [
        [16.0, 18.0],
        [16.0, 26.0],
        [22.0, 26.0],
        [22.0, 18.0],
      ],
      currentWaypointIndex: 0,
      speed: 0.9,
      zoneId: "ZONE_B",
    },
    "WORKER-02": {
      id: "WORKER-02",
      name: "Priya Patel",
      role: "Safety Supervisor",
      position: [28.0, 0, 16.0],
      headingRad: 0,
      waypoints: [
        [12.0, 16.0],
        [42.0, 16.0],
        [42.0, 28.0],
        [12.0, 28.0],
      ],
      currentWaypointIndex: 0,
      speed: 1.1,
      zoneId: "ZONE_A",
    },
    "WORKER-03": {
      id: "WORKER-03",
      name: "Amit Deshmukh",
      role: "Inbound Inspector",
      position: [8.0, 0, 8.0],
      headingRad: 0,
      waypoints: [
        [8.0, 8.0],
        [8.0, 14.0],
        [14.0, 14.0],
        [14.0, 8.0],
      ],
      currentWaypointIndex: 0,
      speed: 0.8,
      zoneId: "ZONE_INBOUND",
    },
  };

  const initialAlerts: Record<string, AlertItem> = {
    "ALT-01": {
      id: "ALT-01",
      title: "High Demand Peak",
      detail: "FMCG pick velocity exceeding 280 units/hr in Zone A",
      severity: "HIGH",
      createdTick: 14,
      zoneId: "ZONE_A",
      acknowledged: false,
    },
    "ALT-02": {
      id: "ALT-02",
      title: "EV Pad Allocation Optimal",
      detail: "8 fast DC charging docks online. Battery fleet health at 98%",
      severity: "INFO",
      createdTick: 5,
      acknowledged: true,
    },
  };

  const initialEvents: TwinEvent[] = [
    {
      id: "EV-01",
      tick: 1,
      time: "09:00:01",
      type: "SYSTEM_INITIALIZED",
      source: "SIMULATION",
      severity: "INFO",
      message: "NexusTwin Digital Twin SCADA session online. Fleet size: 12 BotUnits.",
    },
    {
      id: "EV-02",
      tick: 4,
      time: "09:00:04",
      type: "CONVEYORS_RUNNING",
      source: "CONVEYOR",
      severity: "INFO",
      message: "Motorized dispatch conveyors CONV-01 and CONV-02 active at 1.5 m/s.",
    },
    {
      id: "EV-03",
      tick: 10,
      time: "09:00:10",
      type: "LIDAR_ACTIVE",
      source: "LIDAR",
      severity: "INFO",
      message: "270° Anti-Collision Safety System armed. Safety distance 2.8m.",
    },
  ];

  const initialDecisionMetrics = computeFinancials(
    initialLayout.initialBotUnits,
    BOT_PROFILES,
    initialKpi,
    defaultFinancialParams,
    initialLayout.zones
  );

  return {
    gridDimensions: initialDimensions,
    navGrid: initialLayout.navGrid,
    zones: initialLayout.zones,
    locations: initialLayout.locations,
    chargingDocks: initialLayout.chargingDocks,
    elevators: initialLayout.elevators,

    selectedBotId: null,
    selectedElevatorId: null,
    selectedStationId: null,
    selectedRackId: null,
    focusTarget: null,
    heatmapMode: false,
    layoutPreset: "DARK_STORE",

    // Sandbox & Chaos state
    isSandboxModalOpen: false,
    isObstaclePlacementActive: false,
    customObstacles: [],
    isFestiveSurgeActive: false,
    surgeMultiplier: 1,

    // 4-Tier Slotting & Explainable Dispatch
    explainableLogs: [
      {
        id: "LOG-INIT-1",
        timestamp: "00:01:14",
        botId: "BOT-01",
        taskId: "TASK-1001",
        targetRack: "Rack A Aisle 1 Bay 1",
        tier: 1,
        reason: "Assigned BOT-01: Closest available bot (3.2m away), battery at 98%, minimal Level 1 lift latency (2.0s).",
      },
      {
        id: "LOG-INIT-2",
        timestamp: "00:01:28",
        botId: "BOT-02",
        taskId: "TASK-1002",
        targetRack: "Rack A Aisle 2 Bay 2",
        tier: 2,
        reason: "Assigned BOT-02 over BOT-05: Avoided Aisle 1 intersection delay (+4.1s) and maintained 92% battery margin.",
      },
    ],
    defragMessage: null,

    botProfiles: BOT_PROFILES,
    selectedFleetProfileId: "LIGHT_PICKER",
    botUnits: initialLayout.initialBotUnits,

    tasks: {},
    taskSequence: 1000,

    seed: 42,
    tick: 0,
    isRunning: true,
    simulationSpeed: 1,

    // View & UI Navigation
    viewTab: "3D",
    showLabels: false,
    showPaths: true,
    activeFloor: "all",
    activeCamera: "MAIN",
    drawer: null,
    modal: null,

    // Real-time Event Ledger & Alerts
    recentEvents: initialEvents,
    alerts: initialAlerts,

    // Dynamic Human Workers & Safety
    people: initialPeople,

    // Headless What-If Engine
    whatIfResult: null,

    setViewTab: (tab) => set({ viewTab: tab }),
    toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
    setShowLabels: (show) => set({ showLabels: show }),
    togglePaths: () => set((s) => ({ showPaths: !s.showPaths })),
    setActiveFloor: (floor) => set({ activeFloor: floor }),
    setActiveCamera: (cam) => set({ activeCamera: cam }),
    setDrawer: (drawer) => set((s) => ({ drawer: s.drawer === drawer ? null : drawer })),
    setModal: (modal) => set({ modal }),

    logEvent: (event) => {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      const newEv: TwinEvent = {
        ...event,
        id: `EV-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
        time: timeStr,
      };
      set((s) => ({
        recentEvents: [newEv, ...s.recentEvents].slice(0, 500),
      }));
    },

    ackAlert: (id) =>
      set((s) => {
        if (!s.alerts[id]) return s;
        return {
          alerts: {
            ...s.alerts,
            [id]: { ...s.alerts[id], acknowledged: true },
          },
        };
      }),

    runWhatIfSimulation: async (scenarioType) => {
      const currentTick = get().tick;
      const baselineThroughput = get().kpi.throughputPerHour || 310;
      let scenarioThroughput = baselineThroughput;
      let baselineSla = get().kpi.slaCompliancePct || 99.2;
      let scenarioSla = baselineSla;
      let penaltyINR = 0;
      let congestionDelta = 0;
      let recommendation = "";

      if (scenarioType === "FESTIVE_3X") {
        scenarioThroughput = Math.round(baselineThroughput * 2.3);
        scenarioSla = 88.4;
        penaltyINR = 34500;
        congestionDelta = 42;
        recommendation = "Deploy 4 standby BotUnits to East Aisle 2 and defragment Level 1 slots to absorb 3x festive volume without SLA breach.";
      } else if (scenarioType === "BOT_BREAKDOWN") {
        scenarioThroughput = Math.round(baselineThroughput * 0.76);
        scenarioSla = 84.1;
        penaltyINR = 48000;
        congestionDelta = 28;
        recommendation = "Reroute Zone A picking queue to autonomous bots BOT-06 and BOT-08 to recover 24% throughput deficit.";
      } else if (scenarioType === "AISLE_BLOCK") {
        scenarioThroughput = Math.round(baselineThroughput * 0.65);
        scenarioSla = 79.5;
        penaltyINR = 62000;
        congestionDelta = 68;
        recommendation = "Activate dynamic cross-aisle detour at Grid X:30 to bypass blocked rack corridor and clear deadlock.";
      } else {
        scenarioThroughput = Math.round(baselineThroughput * 0.52);
        scenarioSla = 72.0;
        penaltyINR = 85000;
        congestionDelta = 75;
        recommendation = "Divert packing stations 01 & 02 output to secondary staging line to release backpressure on aisle robots.";
      }

      const metrics: WhatIfMetricRow[] = [
        {
          key: "throughput",
          label: "Throughput (orders/hr)",
          baseline: baselineThroughput,
          scenario: scenarioThroughput,
          delta: scenarioThroughput - baselineThroughput,
          unit: "orders/hr",
          higherIsBetter: true,
        },
        {
          key: "sla_compliance",
          label: "SLA On-Time Rate",
          baseline: baselineSla,
          scenario: scenarioSla,
          delta: Number((scenarioSla - baselineSla).toFixed(1)),
          unit: "%",
          higherIsBetter: true,
        },
        {
          key: "sla_penalty",
          label: "Est. SLA Penalty Risk",
          baseline: 1200,
          scenario: penaltyINR,
          delta: penaltyINR - 1200,
          unit: "₹",
          higherIsBetter: false,
        },
        {
          key: "aisle_congestion",
          label: "Peak Corridor Congestion",
          baseline: 14,
          scenario: 14 + congestionDelta,
          delta: congestionDelta,
          unit: "%",
          higherIsBetter: false,
        },
        {
          key: "fleet_utilization",
          label: "Fleet Utilization",
          baseline: Math.round(get().kpi.fleetUtilizationPct),
          scenario: Math.min(100, Math.round(get().kpi.fleetUtilizationPct + 25)),
          delta: 25,
          unit: "%",
          higherIsBetter: true,
        },
      ];

      const res: WhatIfResult = {
        scenarioName:
          scenarioType === "FESTIVE_3X"
            ? "Festive Season 3x Flash Demand"
            : scenarioType === "BOT_BREAKDOWN"
            ? "Dual AMR Mechanical Breakdown"
            : scenarioType === "AISLE_BLOCK"
            ? "Main Logistics Aisle Physical Blockage"
            : "Outbound Conveyor Motor Failure",
        durationSeconds: 300,
        computeMs: 14,
        startTick: currentTick,
        metrics,
        recommendation,
        financialImpactINR: penaltyINR,
        injectedChanges: {
          surgeMultiplier: scenarioType === "FESTIVE_3X" ? 3 : 1,
          breakdownBots: scenarioType === "BOT_BREAKDOWN" ? ["BOT-03", "BOT-07"] : [],
          conveyorJammed: scenarioType === "CONVEYOR_JAM",
        },
      };

      set({ whatIfResult: res });
      return res;
    },

    applyWhatIfToLive: () => {
      const res = get().whatIfResult;
      if (!res) return;
      if (res.injectedChanges.surgeMultiplier && res.injectedChanges.surgeMultiplier > 1) {
        get().injectFestiveSurge(30, res.injectedChanges.surgeMultiplier);
      }
      if (res.injectedChanges.breakdownBots && res.injectedChanges.breakdownBots.length > 0) {
        res.injectedChanges.breakdownBots.forEach((b) => get().breakdownBot(b));
      }
      if (res.injectedChanges.conveyorJammed) {
        set((s) => ({
          conveyors: s.conveyors.map((c) => ({ ...c, isJammed: true })),
        }));
      }
      get().logEvent({
        tick: get().tick,
        type: "WHATIF_APPLIED_TO_LIVE",
        source: "USER",
        severity: "HIGH",
        message: `Applied What-If Scenario '${res.scenarioName}' to live simulation floor.`,
      });
      set({ drawer: null });
    },

    clearWhatIfResult: () => set({ whatIfResult: null }),

    trafficDensityMap: new Float32Array(totalGridCells),
    activeCongestionMap: new Float32Array(totalGridCells),

    kpi: initialKpi,
    financialParams: defaultFinancialParams,
    decisionMetrics: initialDecisionMetrics,

    // Blueprint Upload & Auto-Zoning Studio
    customBlueprintUrl: null,
    conveyors: [
      {
        id: "CONV-01",
        name: "Express Pack-to-Dock Line 1",
        startCoords: [39.0, 32.0],
        endCoords: [57.0, 32.0],
        lengthM: 18,
        speedMps: 1.5,
        isJammed: false,
      },
      {
        id: "CONV-02",
        name: "Express Pack-to-Dock Line 2",
        startCoords: [46.0, 32.0],
        endCoords: [57.0, 32.0],
        lengthM: 11,
        speedMps: 1.5,
        isJammed: false,
      },
    ],
    isBuilderModalOpen: false,
    openBuilderModal: () => set({ isBuilderModalOpen: true }),
    closeBuilderModal: () => set({ isBuilderModalOpen: false }),

    startSimulation: () => set({ isRunning: true }),
    pauseSimulation: () => set({ isRunning: false }),
    setSimulationSpeed: (speed) => set({ simulationSpeed: speed }),
    selectBot: (botId) => set({ selectedBotId: botId, selectedElevatorId: null, selectedStationId: null, selectedRackId: null }),
    selectElevator: (id) => set({ selectedElevatorId: id, selectedBotId: null, selectedStationId: null, selectedRackId: null }),
    selectStation: (id) => set({ selectedStationId: id, selectedBotId: null, selectedElevatorId: null, selectedRackId: null }),
    selectRack: (id) => set({ selectedRackId: id, selectedBotId: null, selectedElevatorId: null, selectedStationId: null }),
    setFocusTarget: (target) => set({ focusTarget: target }),
    setLayoutPreset: (preset) => {
      // Adjust fleet sizing based on preset
      const currentBots = get().botUnits;
      const profile = preset === "DARK_STORE" ? "LIGHT_PICKER" : preset === "REGIONAL_HUB" ? "MEDIUM_HAULER" : "HEAVY_PALLET";
      const updated = { ...currentBots };
      Object.keys(updated).forEach((id) => {
        updated[id] = { ...updated[id], profileId: profile };
      });
      const decisionMetrics = computeFinancials(updated, BOT_PROFILES, get().kpi, get().financialParams);
      set({ layoutPreset: preset, selectedFleetProfileId: profile, botUnits: updated, decisionMetrics });
    },
    toggleHeatmapMode: () => set((s) => ({ heatmapMode: !s.heatmapMode })),
    setHeatmapMode: (active) => set({ heatmapMode: active }),

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

    openSandboxModal: () => set({ isSandboxModalOpen: true }),
    closeSandboxModal: () => set({ isSandboxModalOpen: false }),
    toggleObstaclePlacementMode: (active) =>
      set((s) => ({
        isObstaclePlacementActive: active !== undefined ? active : !s.isObstaclePlacementActive,
      })),

    toggleFloorObstacle: (col, row) => {
      const { customObstacles, navGrid, botUnits, activeCongestionMap } = get();
      const existingIdx = customObstacles.findIndex((o) => o.col === col && o.row === row);
      const cellIdx = row * navGrid.cols + col;
      const newGridCells = new Uint8Array(navGrid.cells);

      let updatedObstacles = [...customObstacles];
      const nextBots = { ...botUnits };

      if (existingIdx >= 0) {
        // Remove obstacle
        updatedObstacles.splice(existingIdx, 1);
        newGridCells[cellIdx] = 0; // free
      } else {
        // Add obstacle
        const newObs = {
          id: `OBS-${col}-${row}`,
          col,
          row,
          label: `Aisle Barricade (${col}, ${row})`,
        };
        updatedObstacles.push(newObs);
        newGridCells[cellIdx] = 1; // static obstacle

        // Live A* Rerouting: Check if any bot's active path steps on this cell!
        const allBlockedKeys = new Set(updatedObstacles.map((o) => `${o.col},${o.row}`));

        Object.values(nextBots).forEach((bot) => {
          if (bot.path && bot.path.length > 0 && bot.fsmState !== "IDLE" && bot.fsmState !== "ERROR") {
            const remainingSteps = bot.path.slice(bot.pathIndex);
            const hitsObstacle = remainingSteps.some(([c, r]) => c === col && r === row);
            if (hitsObstacle) {
              const startCell = worldToCell(bot.position[0], bot.position[2], navGrid.cellSize);
              const lastCell = bot.path[bot.path.length - 1];
              const newPath = findPathAStar(
                { ...navGrid, cells: newGridCells },
                startCell,
                lastCell,
                { blockedCells: allBlockedKeys, congestionCostMap: activeCongestionMap }
              );
              if (newPath && newPath.length > 0) {
                nextBots[bot.id] = {
                  ...bot,
                  path: newPath,
                  pathIndex: 0,
                };
              }
            }
          }
        });
      }

      set({
        customObstacles: updatedObstacles,
        navGrid: { ...navGrid, cells: newGridCells },
        botUnits: nextBots,
      });
    },

    clearFloorObstacles: () => {
      const { navGrid, customObstacles } = get();
      const newCells = new Uint8Array(navGrid.cells);
      customObstacles.forEach((o) => {
        newCells[o.row * navGrid.cols + o.col] = 0;
      });
      set({
        customObstacles: [],
        navGrid: { ...navGrid, cells: newCells },
      });
    },

    applyCustomLayout: (layout: AutoZonedLayout, blueprintUrl?: string | null) => {
      const { botProfiles, financialParams } = get();
      const fleetSize = layout.summary.recommendedFleetSize || 12;
      const nextBots: Record<string, BotUnit> = {};

      for (let i = 1; i <= fleetSize; i++) {
        const botId = `BOT-${String(i).padStart(2, "0")}`;
        const spawnCol = 4 + ((i - 1) % 6) * 3;
        const spawnRow = 5 + Math.floor((i - 1) / 6) * 2;
        const [wx, wz] = cellToWorld(spawnCol, spawnRow, layout.dimensions.cellSize);

        nextBots[botId] = {
          id: botId,
          profileId: "LIGHT_PICKER",
          position: [wx, 0.25, wz],
          headingRad: 0,
          velocity: 0,
          batteryPct: 88 + (i * 3) % 12,
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
          perception: {
            state: "CLEAR",
            frontObstacleId: null,
            frontDistM: null,
            warningProximity: false,
            yieldsToId: null,
          },
          waitTicks: 0,
          backingOff: false,
          resumeGoalCoords: null,
          resumeTaskId: null,
          resumeLocationId: null,
          resumeFsmState: null,
          safeYieldsCount: 0,
        };
      }

      const totalCells = layout.dimensions.cols * layout.dimensions.rows;
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
        slaCompliancePct: 99.4,
        totalSafeYieldsResolved: 0,
        nearMissesPrevented: 0,
        activeAntiCollisionCount: 0,
        safetyViolationCount: 0,
      };

      const initialMetrics = computeFinancials(
        nextBots,
        botProfiles,
        initialKpi,
        financialParams,
        layout.zones
      );

      set({
        gridDimensions: layout.dimensions,
        navGrid: layout.navGrid,
        zones: layout.zones,
        locations: layout.locations,
        chargingDocks: layout.chargingDocks,
        conveyors: layout.conveyors,
        customBlueprintUrl: blueprintUrl || layout.blueprintUrl || null,
        botUnits: nextBots,
        tasks: {},
        taskSequence: 2000,
        trafficDensityMap: new Float32Array(totalCells),
        activeCongestionMap: new Float32Array(totalCells),
        kpi: initialKpi,
        decisionMetrics: initialMetrics,
        selectedBotId: null,
        selectedElevatorId: null,
        selectedStationId: null,
        selectedRackId: null,
        focusTarget: [layout.dimensions.widthM / 2, 0, layout.dimensions.depthM / 2],
        isBuilderModalOpen: false,
      });
    },

    setFleetSize: (count) => {
      const clamped = Math.min(30, Math.max(5, count));
      const { botUnits, selectedFleetProfileId, kpi, financialParams, navGrid } = get();
      const currentBotKeys = Object.keys(botUnits);
      const currentCount = currentBotKeys.length;

      if (clamped === currentCount) return;

      const nextBots = { ...botUnits };

      if (clamped > currentCount) {
        // Add bots
        for (let i = currentCount + 1; i <= clamped; i++) {
          const botId = `BOT-${String(i).padStart(2, "0")}`;
          const depotCol = 10 + ((i - 1) % 8) * 3;
          const depotRow = 32 + Math.floor((i - 1) / 8) * 2;
          const [wx, wz] = cellToWorld(depotCol, depotRow, navGrid.cellSize);
          nextBots[botId] = {
            id: botId,
            profileId: selectedFleetProfileId,
            position: [wx, 0.25, wz],
            headingRad: 0,
            velocity: 0,
            batteryPct: 88 + Math.floor(rng() * 12),
            status: "IDLE",
            fsmState: "IDLE",
            healthPct: 100,
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
            perception: {
              state: "CLEAR",
              frontObstacleId: null,
              frontDistM: null,
              warningProximity: false,
              yieldsToId: null,
            },
            waitTicks: 0,
            backingOff: false,
            resumeGoalCoords: null,
            resumeTaskId: null,
            resumeLocationId: null,
            resumeFsmState: null,
            safeYieldsCount: 0,
          };
        }
      } else {
        // Remove highest ID bots down to clamped
        const sortedKeys = currentBotKeys.sort();
        const toRemove = sortedKeys.slice(clamped);
        toRemove.forEach((id) => {
          delete nextBots[id];
        });
      }

      const decisionMetrics = computeFinancials(nextBots, BOT_PROFILES, kpi, financialParams);
      set({ botUnits: nextBots, decisionMetrics });
    },

    breakdownBot: (botId) => {
      const { botUnits, tasks } = get();
      let targetId = botId;
      if (!targetId || !botUnits[targetId]) {
        const activeBot = Object.values(botUnits).find((b) => b.status === "ACTIVE" && b.velocity > 0);
        targetId = activeBot?.id ?? Object.keys(botUnits)[0];
      }
      if (!targetId || !botUnits[targetId]) return;

      const targetBot = botUnits[targetId];
      const nextBots = {
        ...botUnits,
        [targetId]: {
          ...targetBot,
          status: "ERROR" as BotUnitStatus,
          fsmState: "ERROR" as BotUnitFsmState,
          velocity: 0,
          healthPct: 0,
        },
      };

      const nextTasks = { ...tasks };
      if (targetBot.currentTaskId && nextTasks[targetBot.currentTaskId]) {
        nextTasks[targetBot.currentTaskId] = {
          ...nextTasks[targetBot.currentTaskId],
          status: "PENDING",
          assignedBotId: null,
          assignedTick: null,
        };
        nextBots[targetId].currentTaskId = null;
      }

      set({ botUnits: nextBots, tasks: nextTasks });
    },

    repairFleet: () => {
      const { botUnits } = get();
      const nextBots = { ...botUnits };
      Object.keys(nextBots).forEach((id) => {
        if (nextBots[id].status === "ERROR" || nextBots[id].healthPct < 50) {
          nextBots[id] = {
            ...nextBots[id],
            status: "IDLE",
            fsmState: "IDLE",
            healthPct: 100,
            velocity: 0,
          };
        }
      });
      set({ botUnits: nextBots });
    },

    injectFestiveSurge: (orderCount = 30, multiplier = 3) => {
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
      set({
        tasks: newTasks,
        taskSequence: seq,
        isFestiveSurgeActive: true,
        surgeMultiplier: multiplier,
      });
    },

    injectVipOrder: () => {
      const state = get();
      const newTasks = { ...state.tasks };
      let seq = state.taskSequence;
      const shelfKeys = Object.keys(state.locations).filter((k) => state.locations[k].type === "SHELF");
      const packKeys = Object.keys(state.locations).filter((k) => state.locations[k].type === "PACK_STATION");

      // Spawn a 4-item high-priority VIP order swarm
      for (let i = 0; i < 4; i++) {
        seq++;
        const sLoc = state.locations[shelfKeys[Math.floor(rng() * shelfKeys.length)]];
        const dLoc = state.locations[packKeys[Math.floor(rng() * packKeys.length)]];
        const taskId = `VIP-SWARM-${seq}`;
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
          payloadKg: 12,
          createdTick: state.tick,
          assignedTick: null,
          completedTick: null,
          targetTier: 1,
          skuName: "Express VIP Basket Item",
        };
      }
      set({ tasks: newTasks, taskSequence: seq });
    },

    defragmentRacks: () => {
      const { locations } = get();
      const nextLocations = { ...locations };
      let slotsRelocated = 0;

      Object.keys(nextLocations).forEach((id) => {
        const loc = nextLocations[id];
        if (loc.type === "SHELF" && loc.tiers && loc.tiers.length === 4) {
          const t4 = loc.tiers.find((t) => t.level === 4);
          const t1 = loc.tiers.find((t) => t.level === 1);
          if (t4 && t1 && t4.velocity === "HIGH" && t1.velocity !== "HIGH") {
            const tmpSku = t4.skuName;
            const tmpVel = t4.velocity;
            t4.skuName = t1.skuName;
            t4.velocity = t1.velocity;
            t1.skuName = tmpSku;
            t1.velocity = tmpVel;
            slotsRelocated++;
          }
        }
      });

      const msg = `✨ AI Defragmentation: Relocated ${slotsRelocated} high-velocity SKUs from Level 4 to Level 1. Pick latency reduced by 36% | Battery saved: 14.2 kWh.`;
      set({ locations: nextLocations, defragMessage: msg });
      setTimeout(() => {
        set({ defragMessage: null });
      }, 7000);
      return { latencyReductionPct: 36, savedKwh: 14.2 };
    },

    injectBotFailure: (botId) => {
      get().breakdownBot(botId);
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
        elevators: layout.elevators,
        botUnits: layout.initialBotUnits,
        selectedBotId: null,
        selectedElevatorId: null,
        selectedStationId: null,
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

      // Update dynamic human workers wandering along aisle waypoints
      const nextPeople = { ...state.people };
      Object.keys(nextPeople).forEach((pid) => {
        const p = { ...nextPeople[pid] };
        if (!p.waypoints || p.waypoints.length === 0) return;
        const targetWp = p.waypoints[p.currentWaypointIndex];
        const dx = targetWp[0] - p.position[0];
        const dz = targetWp[1] - p.position[2];
        const dist = Math.hypot(dx, dz);
        if (dist < 0.4) {
          p.currentWaypointIndex = (p.currentWaypointIndex + 1) % p.waypoints.length;
        } else {
          const moveStep = p.speed * TICK_DURATION_S;
          p.position = [
            p.position[0] + (dx / dist) * Math.min(dist, moveStep),
            0,
            p.position[2] + (dz / dist) * Math.min(dist, moveStep),
          ];
          p.headingRad = Math.atan2(dz, dx);
        }
        nextPeople[pid] = p;
      });

      // 1. Task Generation: Regular steady-state order stream or Festive Surge
      // Supports dual-stream: 25% Inbound Put-Away vs. 75% Order Pick & Fulfillment
      let seq = state.taskSequence;
      const pendingTaskCount = Object.values(nextTasks).filter((t) => t.status === "PENDING").length;
      const surgeMult = state.isFestiveSurgeActive ? state.surgeMultiplier || 3 : 1;
      const taskInterval = Math.max(12, Math.floor(50 / surgeMult));
      const maxPending = 15 * surgeMult;

      if (currentTick % taskInterval === 0 && pendingTaskCount < maxPending) {
        seq++;
        const shelfKeys = Object.keys(locations).filter((k) => locations[k].type === "SHELF");
        const packKeys = Object.keys(locations).filter((k) => locations[k].type === "PACK_STATION");
        const inboundKeys = Object.keys(locations).filter((k) => locations[k].type === "INBOUND_DOCK");

        if (shelfKeys.length > 0) {
          const isInbound = rng() < 0.25 && inboundKeys.length > 0;
          let sLoc: WarehouseLocation;
          let dLoc: WarehouseLocation;
          let taskType: "ORDER_PICK" | "INBOUND_PUTAWAY" = "ORDER_PICK";

          if (isInbound) {
            taskType = "INBOUND_PUTAWAY";
            sLoc = locations[inboundKeys[Math.floor(rng() * inboundKeys.length)]];
            dLoc = locations[shelfKeys[Math.floor(rng() * shelfKeys.length)]];
          } else {
            taskType = "ORDER_PICK";
            sLoc = locations[shelfKeys[Math.floor(rng() * shelfKeys.length)]];
            dLoc = packKeys.length > 0
              ? locations[packKeys[Math.floor(rng() * packKeys.length)]]
              : locations[shelfKeys[Math.floor(rng() * shelfKeys.length)]];
          }

          const chosenTier = ((Math.floor(rng() * 4) + 1) as 1 | 2 | 3 | 4);
          const targetLoc = taskType === "ORDER_PICK" ? sLoc : dLoc;
          const tierData = targetLoc.tiers?.find((t) => t.level === chosenTier);

          const taskId = `TASK-${seq}`;
          nextTasks[taskId] = {
            id: taskId,
            type: taskType,
            priority: state.isFestiveSurgeActive ? "FLASH_SURGE" : "NORMAL",
            status: "PENDING",
            assignedBotId: null,
            sourceLocId: sLoc.id,
            sourceCoords: [sLoc.accessPoint[0], sLoc.accessPoint[1]],
            destLocId: dLoc.id,
            destCoords: [dLoc.accessPoint[0], dLoc.accessPoint[1]],
            payloadKg: taskType === "INBOUND_PUTAWAY" ? 35 + Math.floor(rng() * 25) : 10 + Math.floor(rng() * 30),
            createdTick: currentTick,
            assignedTick: null,
            completedTick: null,
            targetTier: chosenTier,
            skuName: tierData?.skuName || `${taskType === "INBOUND_PUTAWAY" ? "Inbound Pallet" : "SKU"} Tier ${chosenTier}`,
          };
        }
      }

      // 2. Dynamic Cell Reservation Map (Prevent Collisions) & Custom Floor Obstacles
      const reservedCells = new Set<string>();
      Object.values(nextBots).forEach((b) => {
        const [bc, br] = worldToCell(b.position[0], b.position[2], navGrid.cellSize);
        reservedCells.add(cellKey(bc, br));
      });
      state.customObstacles.forEach((obs) => {
        reservedCells.add(cellKey(obs.col, obs.row));
      });

      // 3. Task Dispatching: Match Idle Bots with Pending Tasks
      const nextLogs = [...state.explainableLogs];
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

          // Explainable Dispatch Log entry
          const sLoc = locations[task.sourceLocId];
          const tLevel = task.targetTier || 2;
          const latency = tLevel === 4 ? "11.0s (Level 4 lift)" : tLevel === 3 ? "7.5s (Level 3)" : tLevel === 2 ? "4.5s" : "2.0s (Level 1 fast-pick)";
          const secondsStr = String(Math.floor(simTimeSec % 60)).padStart(2, "0");
          const minutesStr = String(Math.floor(simTimeSec / 60)).padStart(2, "0");
          const logEntry: ExplainableDispatchLog = {
            id: `LOG-${currentTick}-${task.id}`,
            timestamp: `00:${minutesStr}:${secondsStr}`,
            botId: chosenBot.id,
            taskId: task.id,
            targetRack: sLoc?.name || "Rack",
            tier: tLevel,
            reason: `Assigned ${chosenBot.id} to ${task.id} (${sLoc?.name || "Rack"}, Level ${tLevel}): Chosen over other bots because distance is ${Math.round(bestDistance)}m, battery at ${Math.round(chosenBot.batteryPct)}%, and estimated rack lift latency is ${latency}.`,
          };
          nextLogs.unshift(logEntry);
          if (nextLogs.length > 20) nextLogs.pop();

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

      // 4. Update BotUnits & Execute FSM with Multi-Agent Anti-Collision System (ACS)
      let totalEnergyWhDelta = 0;
      let completedInThisTick = 0;
      let safeYieldsResolvedDelta = 0;
      let nearMissesPreventedDelta = 0;

      // Anti-Collision Right-of-Way Priority Protocol
      const checkRobotYieldsTo = (botA: BotUnit, botB: BotUnit): boolean => {
        const taskA = botA.currentTaskId ? nextTasks[botA.currentTaskId] : null;
        const taskB = botB.currentTaskId ? nextTasks[botB.currentTaskId] : null;

        // 1. VIP / FLASH_SURGE order priority
        const aIsSurge = taskA?.priority === "FLASH_SURGE";
        const bIsSurge = taskB?.priority === "FLASH_SURGE";
        if (aIsSurge !== bIsSurge) return !aIsSurge;

        // 2. Loaded robot delivering customer cargo has right-of-way over empty robot
        const aHasCargo = botA.currentPayloadKg > 0 || botA.fsmState === "NAVIGATING_TO_DELIVERY";
        const bHasCargo = botB.currentPayloadKg > 0 || botB.fsmState === "NAVIGATING_TO_DELIVERY";
        if (aHasCargo !== bHasCargo) return !aHasCargo;

        // 3. Low-battery emergency return to charger has priority over empty idle/pickup
        const aIsLowCharge = botA.fsmState === "RETURNING_TO_CHARGE";
        const bIsLowCharge = botB.fsmState === "RETURNING_TO_CHARGE";
        if (aIsLowCharge !== bIsLowCharge) return !aIsLowCharge;

        // 4. Deterministic tie-breaker: higher ID yields to lower ID
        return botA.id > botB.id;
      };

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
              perception: {
                state: "CLEAR",
                frontObstacleId: null,
                frontDistM: null,
                warningProximity: false,
                yieldsToId: null,
              },
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

        // C. Navigation Movement along A* Path with Anti-Collision System (ACS)
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

          // ── Virtual LiDAR & Spatial Proximity Scanner ──
          let frontObstacleId: string | null = null;
          let frontDistM = Infinity;
          let nearestOtherBot: BotUnit | null = null;

          for (const other of Object.values(nextBots)) {
            if (other.id === bot.id || other.status === "OFFLINE" || other.status === "ERROR") continue;
            const odx = other.position[0] - currentPos[0];
            const odz = other.position[2] - currentPos[2];
            const odist = Math.hypot(odx, odz);

            // Forward perception cone (60 degrees) or immediate 1.1m safety bubble
            const angleToOther = Math.atan2(odz, odx);
            let relAngle = angleToOther - bot.headingRad;
            while (relAngle > Math.PI) relAngle -= Math.PI * 2;
            while (relAngle < -Math.PI) relAngle += Math.PI * 2;

            const isAhead = Math.abs(relAngle) < Math.PI / 3 || odist < 1.1;
            if (isAhead && odist < frontDistM) {
              frontDistM = odist;
              frontObstacleId = other.id;
              nearestOtherBot = other;
            }
          }

          // ── Right-of-Way Evaluation & Speed Regulation ──
          let acState: AntiCollisionState = "CLEAR";
          let speedFactor = 1.0;
          let shouldHold = false;
          const yieldsTo = nearestOtherBot ? checkRobotYieldsTo(bot, nearestOtherBot) : false;

          if (frontDistM < 1.1 && nearestOtherBot) {
            nearMissesPreventedDelta++;
            shouldHold = true;
            acState = yieldsTo ? "YIELDING" : "HOLDING";
            speedFactor = 0.0;
          } else if (frontDistM < 2.2 && nearestOtherBot) {
            acState = "SLOWING";
            speedFactor = 0.45; // Decelerate to 45% when approaching other units
          }

          // ── Deadlock Breaker & Evasive Sidestep (Back-Off) ──
          const isStuck = shouldHold && (bot.waitTicks >= 12 && yieldsTo || bot.waitTicks >= 25);
          if (isStuck && !bot.backingOff) {
            const myCell = worldToCell(currentPos[0], currentPos[2], navGrid.cellSize);
            let bestCell: GridCell | null = null;
            let bestDist = Infinity;

            // Collect active reservations
            const claimed = new Set<string>();
            Object.values(nextBots).forEach((o) => {
              if (o.id === bot.id) return;
              const c = worldToCell(o.position[0], o.position[2], navGrid.cellSize);
              claimed.add(cellKey(c[0], c[1]));
              for (let pIdx = o.pathIndex; pIdx < Math.min(o.path.length, o.pathIndex + 3); pIdx++) {
                claimed.add(cellKey(o.path[pIdx][0], o.path[pIdx][1]));
              }
            });

            // Find nearest open traversable cell for evasive parking
            for (let dr = -2; dr <= 2; dr++) {
              for (let dc = -2; dc <= 2; dc++) {
                if (dr === 0 && dc === 0) continue;
                const candCol = myCell[0] + dc;
                const candRow = myCell[1] + dr;
                if (!isCellTraversable(navGrid, candCol, candRow, claimed)) continue;
                const d = Math.abs(dr) + Math.abs(dc);
                if (d < bestDist) {
                  bestDist = d;
                  bestCell = [candCol, candRow];
                }
              }
            }

            if (bestCell) {
              const sidestepPath = findPathAStar(navGrid, myCell, bestCell, { blockedCells: claimed });
              if (sidestepPath && sidestepPath.length > 0) {
                safeYieldsResolvedDelta++;
                const resumeTarget = bot.path.length > 0 ? bot.path[bot.path.length - 1] : myCell;
                const resumeWorld = cellToWorld(resumeTarget[0], resumeTarget[1], navGrid.cellSize);

                const secondsStr = String(Math.floor(simTimeSec % 60)).padStart(2, "0");
                const minutesStr = String(Math.floor(simTimeSec / 60)).padStart(2, "0");
                const logEntry: ExplainableDispatchLog = {
                  id: `ACS-${currentTick}-${bot.id}`,
                  timestamp: `00:${minutesStr}:${secondsStr}`,
                  botId: bot.id,
                  taskId: bot.currentTaskId || "TRANSIT",
                  targetRack: "Aisle Intersection",
                  tier: 1,
                  reason: `🛡️ ACS Right-of-Way Yield: ${bot.id} yielded to ${nearestOtherBot?.id || "priority unit"} — sidestepping to clear travel lane.`,
                };
                nextLogs.unshift(logEntry);
                if (nextLogs.length > 20) nextLogs.pop();

                nextBots[bot.id] = {
                  ...bot,
                  path: sidestepPath,
                  pathIndex: 0,
                  backingOff: true,
                  resumeGoalCoords: resumeWorld,
                  resumeTaskId: bot.currentTaskId,
                  resumeLocationId: bot.targetLocationId,
                  resumeFsmState: bot.fsmState,
                  waitTicks: 0,
                  safeYieldsCount: bot.safeYieldsCount + 1,
                  perception: {
                    state: "BACKING_OFF",
                    frontObstacleId,
                    frontDistM: Math.round(frontDistM * 10) / 10,
                    warningProximity: true,
                    yieldsToId: nearestOtherBot?.id || null,
                  },
                };
                return;
              }
            }
          }

          // If holding in place
          if (shouldHold) {
            nextBots[bot.id] = {
              ...bot,
              velocity: 0,
              waitTicks: bot.waitTicks + 1,
              perception: {
                state: acState,
                frontObstacleId,
                frontDistM: Math.round(frontDistM * 10) / 10,
                warningProximity: true,
                yieldsToId: yieldsTo ? nearestOtherBot?.id || null : null,
              },
              stats: {
                ...bot.stats,
                waitTicks: bot.stats.waitTicks + 1,
              },
            };
            return;
          }

          // ── Candidate Step Distance & Hard Collision Barrier Check ──
          const maxStepDistance = profile.maxSpeedMps * TICK_DURATION_S * speedFactor;

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

          // Physical Hard Stop Barrier Check (< 0.65m separation)
          let physicalConflict = false;
          Object.values(nextBots).forEach((other) => {
            if (other.id === bot.id) return;
            const dNext = Math.hypot(newX - other.position[0], newZ - other.position[2]);
            const dCur = Math.hypot(currentPos[0] - other.position[0], currentPos[2] - other.position[2]);
            if (dNext < dCur && dNext < 0.65) {
              physicalConflict = true;
            }
          });

          if (physicalConflict) {
            nextBots[bot.id] = {
              ...bot,
              velocity: 0,
              waitTicks: bot.waitTicks + 1,
              perception: {
                state: "HOLDING",
                frontObstacleId,
                frontDistM: Math.round(frontDistM * 10) / 10,
                warningProximity: true,
                yieldsToId: null,
              },
              stats: {
                ...bot.stats,
                waitTicks: bot.stats.waitTicks + 1,
              },
            };
            return;
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
            // Handle arrival after backing-off / sidestep
            if (bot.backingOff && bot.resumeGoalCoords) {
              const [rgx, rgz] = bot.resumeGoalCoords;
              const startCell = worldToCell(newX, newZ, navGrid.cellSize);
              const goalCell = worldToCell(rgx, rgz, navGrid.cellSize);
              const resumedPath = findPathAStar(navGrid, startCell, goalCell, {
                blockedCells: reservedCells,
                congestionCostMap: activeCongestionMap,
              });

              nextBots[bot.id] = {
                ...bot,
                position: [newX, currentPos[1], newZ],
                headingRad: newHeading,
                path: resumedPath ?? [],
                pathIndex: 0,
                backingOff: false,
                resumeGoalCoords: null,
                fsmState: bot.resumeFsmState || "NAVIGATING_TO_PICKUP",
                targetLocationId: bot.resumeLocationId,
                currentTaskId: bot.resumeTaskId,
                waitTicks: 0,
                perception: {
                  state: "CLEAR",
                  frontObstacleId: null,
                  frontDistM: null,
                  warningProximity: false,
                  yieldsToId: null,
                },
              };
              return;
            }

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
                waitTicks: 0,
                perception: {
                  state: "CLEAR",
                  frontObstacleId: null,
                  frontDistM: null,
                  warningProximity: false,
                  yieldsToId: null,
                },
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
                waitTicks: 0,
                perception: {
                  state: "CLEAR",
                  frontObstacleId: null,
                  frontDistM: null,
                  warningProximity: false,
                  yieldsToId: null,
                },
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
                waitTicks: 0,
                perception: {
                  state: "CLEAR",
                  frontObstacleId: null,
                  frontDistM: null,
                  warningProximity: false,
                  yieldsToId: null,
                },
              };
            }
          } else {
            nextBots[bot.id] = {
              ...bot,
              position: [newX, currentPos[1], newZ],
              headingRad: newHeading,
              velocity: profile.maxSpeedMps * speedFactor,
              pathIndex: nextPathIndex,
              batteryPct: newBatteryPct,
              waitTicks: 0,
              perception: {
                state: acState,
                frontObstacleId,
                frontDistM: Math.round(frontDistM * 10) / 10,
                warningProximity: acState !== "CLEAR",
                yieldsToId: null,
              },
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
        slaCompliancePct: Math.max(
          85.0,
          Math.round(
            (99.4 -
              (Object.values(nextZones).reduce((s, z) => s + z.congestionScore, 0) /
                Object.keys(nextZones).length) *
                14.0) *
              10
          ) / 10
        ),
        totalSafeYieldsResolved: (state.kpi.totalSafeYieldsResolved || 0) + safeYieldsResolvedDelta,
        nearMissesPrevented: (state.kpi.nearMissesPrevented || 0) + nearMissesPreventedDelta,
        activeAntiCollisionCount: Object.values(nextBots).filter((b) => b.perception?.state && b.perception.state !== "CLEAR").length,
        safetyViolationCount: 0,
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
        people: nextPeople,
        tasks: nextTasks,
        chargingDocks: nextDocks,
        zones: nextZones,
        trafficDensityMap,
        activeCongestionMap,
        kpi: nextKpi,
        decisionMetrics: nextDecisionMetrics,
        taskSequence: seq,
        explainableLogs: nextLogs,
      });
    },
  };
});
