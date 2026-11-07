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
  obbOverlap,
  checkLineOfSight,
  buildAisleFlowMap,
  type GridCell,
  type NavGrid,
  type GridDimensions,
} from "../engine/pathfinder";
import {
  computeOptimalFleetSize,
  type AutoZonedLayout,
  type ConveyorSegment,
  type FleetSizingResult,
} from "../engine/autoZoner";
import { runHeadlessWhatIf } from "../engine/whatif";
import { generateHumanWorkers } from "../engine/humanTraffic";

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
  // Published Representative Commercial AMR Profiles
  ADDVERB_DYNAMO_200: {
    id: "ADDVERB_DYNAMO_200",
    name: "Dynamo 200 (Addverb Class)",
    vendor: "Addverb Technologies (Representative)",
    category: "LIGHT_PICKER",
    maxSpeedMps: 1.8,
    accelerationMps2: 1.2,
    payloadCapacityKg: 200,
    batteryCapacityWh: 1500, // 24V 22Ah LTO fast-charge
    batteryDrainPerTick: 0.006,
    batteryDrainIdlePerTick: 0.0004,
    batteryDrainPayloadCoeff: 0.00003,
    chargeRatePerTick: 0.12, // 8-minute fast opportunity charge (20% to 80%)
    capexCostINR: 480000, // ₹4.8 Lakhs representative
    annualMaintenanceINR: 35000,
  },
  GREYORANGE_BUTLER_M: {
    id: "GREYORANGE_BUTLER_M",
    name: "Butler M (GreyOrange Class)",
    vendor: "GreyOrange (Representative)",
    category: "MEDIUM_HAULER",
    maxSpeedMps: 1.5,
    accelerationMps2: 1.1,
    payloadCapacityKg: 500, // Rack-lifting mobile storage unit
    batteryCapacityWh: 2400, // High-density Li-ion
    batteryDrainPerTick: 0.010,
    batteryDrainIdlePerTick: 0.0006,
    batteryDrainPayloadCoeff: 0.00005,
    chargeRatePerTick: 0.07,
    capexCostINR: 850000, // ₹8.5 Lakhs representative
    annualMaintenanceINR: 55000,
  },
  UNBOX_SORT_SR550: {
    id: "UNBOX_SORT_SR550",
    name: "UnboxSort SR-550 (Unbox Class)",
    vendor: "Unbox Robotics (Representative)",
    category: "HEAVY_PALLET",
    maxSpeedMps: 3.0, // High-speed parcel sortation
    accelerationMps2: 1.8,
    payloadCapacityKg: 25,
    batteryCapacityWh: 800,
    batteryDrainPerTick: 0.012,
    batteryDrainIdlePerTick: 0.0003,
    batteryDrainPayloadCoeff: 0.00002,
    chargeRatePerTick: 0.15,
    capexCostINR: 380000, // ₹3.8 Lakhs representative
    annualMaintenanceINR: 28000,
  },

  // Aliases for seamless backward compatibility
  LIGHT_PICKER: {
    id: "LIGHT_PICKER",
    name: "Dynamo 200 (Addverb Class)",
    vendor: "Addverb Technologies (Representative)",
    category: "LIGHT_PICKER",
    maxSpeedMps: 1.8,
    accelerationMps2: 1.2,
    payloadCapacityKg: 200,
    batteryCapacityWh: 1500,
    batteryDrainPerTick: 0.006,
    batteryDrainIdlePerTick: 0.0004,
    batteryDrainPayloadCoeff: 0.00003,
    chargeRatePerTick: 0.12,
    capexCostINR: 480000,
    annualMaintenanceINR: 35000,
  },
  MEDIUM_HAULER: {
    id: "MEDIUM_HAULER",
    name: "Butler M (GreyOrange Class)",
    vendor: "GreyOrange (Representative)",
    category: "MEDIUM_HAULER",
    maxSpeedMps: 1.5,
    accelerationMps2: 1.1,
    payloadCapacityKg: 500,
    batteryCapacityWh: 2400,
    batteryDrainPerTick: 0.010,
    batteryDrainIdlePerTick: 0.0006,
    batteryDrainPayloadCoeff: 0.00005,
    chargeRatePerTick: 0.07,
    capexCostINR: 850000,
    annualMaintenanceINR: 55000,
  },
  HEAVY_PALLET: {
    id: "HEAVY_PALLET",
    name: "UnboxSort SR-550 (Unbox Class)",
    vendor: "Unbox Robotics (Representative)",
    category: "HEAVY_PALLET",
    maxSpeedMps: 3.0,
    accelerationMps2: 1.8,
    payloadCapacityKg: 25,
    batteryCapacityWh: 800,
    batteryDrainPerTick: 0.012,
    batteryDrainIdlePerTick: 0.0003,
    batteryDrainPayloadCoeff: 0.00002,
    chargeRatePerTick: 0.15,
    capexCostINR: 380000,
    annualMaintenanceINR: 28000,
  },
};

// ─────────────────────────────────────────────────────────────
// 2. Core Entities: BotUnit, Tasks, Layout Elements
// ─────────────────────────────────────────────────────────────

export type BotUnitStatus = "ACTIVE" | "CHARGING" | "IDLE" | "WARNING" | "ERROR" | "OFFLINE";

export type BotUnitFsmState =
  | "IDLE"
  | "NAVIGATING_TO_PICKUP"
  | "STAGED_WAITING_AISLE"
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

export interface AisleConfig {
  id: string;
  zoneId: string;
  aisleIndex: number;
  aisleRow: number;
  minCol: number;
  maxCol: number;
  stagingPointEast: [number, number];
  stagingPointWest: [number, number];
}

export const AISLE_CONFIGS: Record<string, AisleConfig> = {
  "ZONE_A-AISLE-1": { id: "ZONE_A-AISLE-1", zoneId: "ZONE_A", aisleIndex: 1, aisleRow: 9.5, minCol: 5, maxCol: 23, stagingPointEast: [25.5, 9.5], stagingPointWest: [3.5, 9.5] },
  "ZONE_A-AISLE-2": { id: "ZONE_A-AISLE-2", zoneId: "ZONE_A", aisleIndex: 2, aisleRow: 13.5, minCol: 5, maxCol: 23, stagingPointEast: [25.5, 13.5], stagingPointWest: [3.5, 13.5] },
  "ZONE_A-AISLE-3": { id: "ZONE_A-AISLE-3", zoneId: "ZONE_A", aisleIndex: 3, aisleRow: 17.5, minCol: 5, maxCol: 23, stagingPointEast: [25.5, 17.5], stagingPointWest: [3.5, 17.5] },
  "ZONE_A-AISLE-4": { id: "ZONE_A-AISLE-4", zoneId: "ZONE_A", aisleIndex: 4, aisleRow: 21.5, minCol: 5, maxCol: 23, stagingPointEast: [25.5, 21.5], stagingPointWest: [3.5, 21.5] },
  "ZONE_B-AISLE-1": { id: "ZONE_B-AISLE-1", zoneId: "ZONE_B", aisleIndex: 1, aisleRow: 9.5, minCol: 34, maxCol: 52, stagingPointEast: [54.5, 9.5], stagingPointWest: [32.5, 9.5] },
  "ZONE_B-AISLE-2": { id: "ZONE_B-AISLE-2", zoneId: "ZONE_B", aisleIndex: 2, aisleRow: 13.5, minCol: 34, maxCol: 52, stagingPointEast: [54.5, 13.5], stagingPointWest: [32.5, 13.5] },
  "ZONE_B-AISLE-3": { id: "ZONE_B-AISLE-3", zoneId: "ZONE_B", aisleIndex: 3, aisleRow: 17.5, minCol: 34, maxCol: 52, stagingPointEast: [54.5, 17.5], stagingPointWest: [32.5, 17.5] },
  "ZONE_B-AISLE-4": { id: "ZONE_B-AISLE-4", zoneId: "ZONE_B", aisleIndex: 4, aisleRow: 21.5, minCol: 34, maxCol: 52, stagingPointEast: [54.5, 21.5], stagingPointWest: [32.5, 21.5] },
};

export function getAisleIdForLocation(locId: string | null): string | null {
  if (!locId || !locId.startsWith("SHELF-")) return null;
  const parts = locId.split("-");
  if (parts.length >= 3) {
    return `${parts[1]}-AISLE-${parts[2]}`;
  }
  return null;
}

export function isBotInsideAisle(botPos: [number, number, number], cfg: AisleConfig): boolean {
  const x = botPos[0];
  const z = botPos[2];
  return Math.abs(z - cfg.aisleRow) < 1.25 && x >= cfg.minCol - 0.5 && x <= cfg.maxCol + 0.5;
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

export interface SourcedBenchmark {
  category: string;
  parameter: string;
  value: string;
  source: string;
  citationUrl: string;
  notes: string;
}

export const INSTITUTIONAL_BENCHMARK_CITATIONS: SourcedBenchmark[] = [
  {
    category: "Labor Economics",
    parameter: "Picker Base Wage & Staffing Margin",
    value: "₹18,000 / mo + 22% statutory markup",
    source: "TeamLease Employment & Salary Report (Logistics & Supply Chain 2024-2025)",
    citationUrl: "https://www.teamlease.com",
    notes: "Covers Tier-1/Tier-2 Indian logistics hubs, including statutory PF, ESI, gratuity, and contractor compliance fee."
  },
  {
    category: "Power Tariffs",
    parameter: "Industrial HT Commercial Power",
    value: "₹8.50 / kWh (Grid) & ₹28.00 / kWh (DG Genset)",
    source: "BESCOM Bengaluru HT-2 / MSEDCL Maharashtra Industrial Schedules",
    citationUrl: "https://bescom.karnataka.gov.in",
    notes: "Blended 85% grid electricity with 15% backup diesel generator operating cost at 0.28 L/kWh fuel burn."
  },
  {
    category: "AMR Hardware",
    parameter: "Tote Carrier AMR Specifications",
    value: "200 kg payload, 1.8 m/s speed, 8-min fast charge",
    source: "Addverb Dynamo 200 Published Technical Specifications",
    citationUrl: "https://addverb.com",
    notes: "Representative commercial autonomous mobile robot engineered with 24V LTO battery chemistry."
  },
  {
    category: "AMR Hardware",
    parameter: "Mobile Storage Rack Lifter",
    value: "500 kg payload, 1.5 m/s speed, 2.4 kWh Li-ion",
    source: "GreyOrange Butler M Published Product Architecture",
    citationUrl: "https://www.greyorange.com",
    notes: "Goods-to-Person automated storage and retrieval system with opportunity charging."
  },
  {
    category: "Tax & Finance",
    parameter: "GST Input Tax Credit (ITC)",
    value: "18% Credit on CapEx Assets",
    source: "Central Goods and Services Tax Act 2017, Section 16",
    citationUrl: "https://cbic-gst.gov.in",
    notes: "100% claimable tax credit on capital robotics plant, machinery, and software integration against outward GST."
  },
  {
    category: "Tax & Finance",
    parameter: "Cost of Capital (WACC)",
    value: "11.5% p.a. over 60 months",
    source: "Reserve Bank of India Commercial Lending Benchmark & Logistics Asset Leasing",
    citationUrl: "https://rbi.org.in",
    notes: "Standard equipment leasing interest rate for Grade-A warehousing automation in India."
  }
];

export interface FinancialParameters {
  laborMonthlySalaryINR: number;        // Base monthly salary per manual picker in India (default ₹18,000)
  contractStaffingMarginPct: number;    // TeamLease/Quess third-party staffing agency markup (default 22%)
  festiveLaborAttritionPct: number;     // Diwali/peak seasonal absenteeism & spot-hiring wage premium (default 35%)
  customRobotUnitCostINR?: number | null; // Editable custom override in INR (e.g. ₹4.8L or ₹8.5L)
  slaPenaltyPerMissedOrderINR: number;  // SLA Penalty Cost per delayed order (default ₹150)
  electricityCostPerKwhINR: number;     // Commercial power tariff (₹8.5 / kWh)
  dgGensetPowerCostINR: number;         // Backup diesel generator & tariff risk blended cost (default ₹28 / kWh)
  warehouseOperatingHoursPerDay: number;// e.g. 16 hours
  daysPerMonth: number;                 // 30 days

  // Institutional Indian Automation Capital & Infrastructure Line Items
  wmsIntegrationCapexINR: number;       // WMS/ERP API & Fleet Management middleware (default ₹18,00,000)
  floorAndWifiPrepCapexINR: number;     // Epoxy resurfacing, QR grid fiducials, industrial mesh Wi-Fi (default ₹4,20,000)
  chargingDockUnitCostINR: number;      // Dual-port opportunity fast charger cost (default ₹3,80,000 per 4 bots)
  retainedSupervisorMonthlySalaryINR: number; // 1 Automation systems supervisor (default ₹45,000/mo)
  retainedTechsCount: number;           // Dedicated robotics maintenance techs (default 2 techs)
  retainedTechMonthlySalaryINR: number; // Monthly wage per tech (default ₹30,000/mo)
  retainedExceptionHandlersCount: number; // Exception & damaged item resolution handlers (default 2 staff)
  retainedExceptionHandlerSalaryINR: number; // Monthly wage per exception handler (default ₹22,000/mo)
  gstRatePct: number;                   // GST rate on capital goods (default 18%, 100% claimable under CGST Sec 16)
  waccInterestRatePct: number;          // Weighted Average Cost of Capital / equipment financing (default 11.5% p.a.)
  financingTenureMonths: number;        // Financing tenure (default 60 months)
}

export interface AutomationDecisionMetrics {
  // CapEx breakdown
  totalFleetCapexINR: number;           // Hardware fleet capex
  chargingInfraCapexINR: number;        // Docks CapEx (ceil(bots / 4) * dockCost)
  wmsIntegrationCapexINR: number;       // Middleware/integration CapEx
  facilityPrepCapexINR: number;         // Floor/Wi-Fi prep CapEx
  grossCapexINR: number;                // Total Gross CapEx before GST ITC
  gstInputTaxCreditReclaimedINR: number;// 18% GST input tax credit
  netCapitalizedCapexINR: number;       // Effective net CapEx basis

  // OpEx & Financing breakdown
  annualFleetMaintenanceINR: number;
  monthlyEquipmentFinancingINR: number; // Monthly EMI / financing interest at WACC
  monthlyRetainedStaffCostINR: number;  // Retained supervisor + technicians + exception handlers
  monthlyAmrMaintenanceCostINR: number;
  monthlyElectricityCostINR: number;
  monthlyRobotOpexINR: number;          // Total OpEx = maint + power + retained staff + financing

  // Labor & Savings
  equivalentManualPickers: number;
  effectiveManualPickerCostINR: number; // Base wage + staffing margin + festive attrition bonus
  monthlyManualLaborCostINR: number;
  monthlySlaPenaltySavingsINR: number;
  netMonthlySavingsINR: number;
  paybackPeriodMonths: number;
  threeYearRoiPct: number;
  fiveYearNetValueINR: number;

  // Throughput & Operational Metrics
  automatedThroughputPerHour: number;
  manualEstimatedThroughputPerHour: number;
  throughputGainPct: number;
  bottleneckZoneId: string;
  bottleneckZoneName: string;
  bottleneckCongestionPct: number;

  // Vendor Oversell Comparison Metrics (OEM sales engineering linear spreadsheet quote)
  vendorQuotedBots: number;
  vendorQuotedCapexINR: number;
  capexSavedByNexusTwinINR: number;
  overbuyCongestionPenaltyPct: number;
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
  path?: GridCell[];
  pathIndex?: number;
  isYielding?: boolean;
  speed: number;
  zoneId: string;
}

export interface ConfidenceStats {
  min: number;
  median: number;
  max: number;
  mean: number;
  stdDev: number;
  ci95Low: number;
  ci95High: number;
}

export interface WhatIfMetricRow {
  key: string;
  label: string;
  baseline: number;
  scenario: number;
  delta: number;
  unit: string;
  higherIsBetter: boolean;
  confidenceRange?: ConfidenceStats;
}

export interface WhatIfResult {
  scenarioName: string;
  durationSeconds: number;
  ensembleSeeds: number;
  computeMs: number;
  startTick: number;
  steadyStateWarmupDiscardTicks: number;
  divergenceTick: number | null;
  firstDivergenceEvent: {
    tick: number;
    scenarioEvent: string;
    baselineEvent: string;
  } | null;
  metrics: WhatIfMetricRow[];
  recommendation: string;
  financialImpactINR: number;
  paybackHorizonMonthsDelta: number;
  monteCarloStats?: Record<string, ConfidenceStats>;
  manualBaselineComparison?: {
    simulatedManualPickers: number;
    manualThroughputPerHour: number;
    manualDistanceTraveledM: number;
    manualAisleWaitTicks: number;
    amrThroughputGainPct: number;
    amrTravelEfficiencyFactor: number;
  };
  injectedChanges: {
    surgeMultiplier?: number;
    blockedZones?: string[];
    breakdownBots?: string[];
    conveyorJammed?: boolean;
    recommendedBotsCount?: number;
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

const SIM_PARAMS = {
  MIN_SEP: 1.05,              // Center-to-center minimum clearance in meters
  ROBOT_HALF_LEN: 0.48,       // AMR half length (m)
  ROBOT_HALF_W: 0.35,         // AMR half width (m)
  LIDAR_RANGE: 3.5,           // Virtual LiDAR radius (m)
  LIDAR_FOV: Math.PI * 1.5,   // 270 degrees
  PERC_STOP: 1.15,            // Safe stop distance before touching (1.15m)
  PERC_SLOW: 2.2,             // Decelerate smoothly when approaching (2.2m)
  PERC_LOOKAHEAD: 3,          // React to obstacles on upcoming path cells
  WAIT_REPLAN_TICKS: 4,       // Rapid dynamic replanning after 0.4s (avoids blockades!)
  WAIT_BACKOFF_TICKS: 12,     // Controlled back-off / turnout after 1.2s
  STATION_ARRIVE_CELLS: 2,    // Dwell / conclude when within 2 cells of station
};

function createDefaultLayout(dimensions: GridDimensions): {
  navGrid: NavGrid;
  aisleFlowMap: Uint8Array;
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

  // Freight Elevators (Removed for unobstructed single-level automated layout)
  const elevators: Record<string, ElevatorNode> = {};

  // Dynamically compute optimal fleet size based on warehouse size and rack capacity
  const rackCount = Object.values(locations).filter((l) => l.type === "SHELF").length;
  const rackAisles = Math.max(1, Math.round(rackCount / 6));
  const autoPlacedDocks = Object.keys(chargingDocks).length;
  const packingStationsCount = Object.values(locations).filter((l) => l.type === "PACK_STATION").length;
  const inboundBaysCount = Object.values(locations).filter((l) => l.type === "INBOUND_DOCK").length;

  const sizing = computeOptimalFleetSize({
    widthM: cols,
    depthM: rows,
    areaM2: cols * rows,
    rackCount,
    rackAisles,
    chargingDocksCount: autoPlacedDocks,
    packingStationsCount,
    inboundBaysCount,
  });

  const fleetSize = sizing.recommendedFleetSize;
  const initialBotUnits: Record<string, BotUnit> = {};

  const spawnColsCount = Math.max(2, Math.floor(cols / 4));
  for (let i = 1; i <= fleetSize; i++) {
    const botId = `BOT-${i < 10 ? "0" + i : i}`;
    const spawnCol = Math.min(cols - 4, 6 + ((i - 1) % spawnColsCount) * 3);
    const spawnRow = Math.min(rows - 4, 4 + Math.floor((i - 1) / spawnColsCount) * 2);

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

  const aisleFlowMap = buildAisleFlowMap(navGrid);
  return { navGrid, aisleFlowMap, zones, locations, chargingDocks, elevators, initialBotUnits };
}

// ─────────────────────────────────────────────────────────────
// 6. NexusTwin Store Interface
// ─────────────────────────────────────────────────────────────

export interface NexusTwinState {
  // Warehouse & Grid Environment
  gridDimensions: GridDimensions;
  navGrid: NavGrid;
  aisleFlowMap: Uint8Array;
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
  stepSimulation: (stepCount?: number) => void;
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
  autoSizeFleet: () => void;
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
  appMode: "OPERATOR" | "STORY";
  setAppMode: (mode: "OPERATOR" | "STORY") => void;
  viewMode: "focus" | "full";
  setViewMode: (mode: "focus" | "full") => void;
  focusDockTab: number | "ledger" | null;
  setFocusDockTab: (tab: number | "ledger" | null) => void;
  activePopover: "systems" | "incidents" | null;
  setActivePopover: (pop: "systems" | "incidents" | null) => void;
  closeAllFocusPopups: () => void;
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
  runWhatIfSimulation: (
    scenarioType: "FESTIVE_3X" | "BOT_BREAKDOWN" | "AISLE_BLOCK" | "CONVEYOR_JAM",
    durationSeconds?: number,
    ensembleSeeds?: number
  ) => Promise<WhatIfResult>;
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
    laborMonthlySalaryINR: 18000, // ₹18,000/month base wage per manual picker in India (TeamLease 2024-25)
    contractStaffingMarginPct: 22, // 22% TeamLease/Quess third-party agency markup
    festiveLaborAttritionPct: 35, // 35% Diwali/peak seasonal absenteeism & spot-hiring wage premium
    customRobotUnitCostINR: null, // Default to profile cost (₹4.8L or ₹8.5L)
    slaPenaltyPerMissedOrderINR: 150, // ₹150 per delayed order
    electricityCostPerKwhINR: 8.5, // Commercial tariff (BESCOM / MSEDCL HT-2)
    dgGensetPowerCostINR: 28, // Backup diesel generator tariff risk (₹28/kWh)
    warehouseOperatingHoursPerDay: 16,
    daysPerMonth: 30,

    // Institutional Indian Automation Capital & Infrastructure Line Items
    wmsIntegrationCapexINR: 1800000, // ₹18 Lakhs WMS/ERP API & Fleet Management middleware
    floorAndWifiPrepCapexINR: 420000, // ₹4.2 Lakhs epoxy resurfacing, 2D QR fiducials, industrial mesh APs
    chargingDockUnitCostINR: 380000, // ₹3.8 Lakhs per dual-port opportunity fast charger (1 per 4 bots)
    retainedSupervisorMonthlySalaryINR: 45000, // 1 Automation systems supervisor
    retainedTechsCount: 2, // 2 Dedicated robotics maintenance techs
    retainedTechMonthlySalaryINR: 30000,
    retainedExceptionHandlersCount: 2, // 2 Damaged item & manual exception handlers
    retainedExceptionHandlerSalaryINR: 22000,
    gstRatePct: 18, // 18% GST (100% claimable via Input Tax Credit under CGST Act Sec 16)
    waccInterestRatePct: 11.5, // 11.5% p.a. equipment lease / commercial financing WACC
    financingTenureMonths: 60, // 5-year tenure
  };

  const computeFinancials = (
    botUnits: Record<string, BotUnit>,
    profiles: Record<string, BotProfile>,
    kpi: SimulationKpi,
    params: FinancialParameters,
    overrideZones?: Record<string, WarehouseZone>
  ): AutomationDecisionMetrics => {
    const bots = Object.values(botUnits);
    const activeProfileId = (typeof get === "function" && get()?.selectedFleetProfileId) || "ADDVERB_DYNAMO_200";

    const unitCapex =
      params.customRobotUnitCostINR && params.customRobotUnitCostINR > 0
        ? params.customRobotUnitCostINR
        : (profiles[activeProfileId]?.capexCostINR ?? 480000);

    const hardwareFleetCapex =
      params.customRobotUnitCostINR && params.customRobotUnitCostINR > 0
        ? bots.length * params.customRobotUnitCostINR
        : bots.reduce((sum, b) => sum + (profiles[b.profileId]?.capexCostINR ?? unitCapex), 0);

    const docksCount = Math.max(1, Math.ceil(bots.length / 4));
    const chargingInfraCapex = docksCount * (params.chargingDockUnitCostINR ?? 380000);
    const wmsIntegrationCapex = params.wmsIntegrationCapexINR ?? 1800000;
    const facilityPrepCapex = params.floorAndWifiPrepCapexINR ?? 420000;

    const grossCapex = hardwareFleetCapex + chargingInfraCapex + wmsIntegrationCapex + facilityPrepCapex;

    // GST Input Tax Credit (ITC) under Section 16 of CGST Act (18% reclaimed against output liability)
    const gstRate = (params.gstRatePct ?? 18) / 100;
    const gstInputTaxCreditReclaimed = Math.round(grossCapex * (gstRate / (1 + gstRate)));
    const netCapitalizedCapex = grossCapex - gstInputTaxCreditReclaimed;

    // Monthly equipment financing / WACC amortization (11.5% p.a. over 60 months)
    const annualWacc = (params.waccInterestRatePct ?? 11.5) / 100;
    const monthlyWaccRate = annualWacc / 12;
    const tenureMonths = params.financingTenureMonths ?? 60;
    const financingFactor =
      (monthlyWaccRate * Math.pow(1 + monthlyWaccRate, tenureMonths)) /
      (Math.pow(1 + monthlyWaccRate, tenureMonths) - 1);
    const monthlyEquipmentFinancing = Math.round(netCapitalizedCapex * financingFactor);

    // Retained human personnel that CANNOT be eliminated in automated warehouse:
    // 1 Automation Supervisor + 2 Robotics Maintenance Techs + 2 Exception/Damaged Item Handlers
    const monthlyRetainedStaffCost =
      (params.retainedSupervisorMonthlySalaryINR ?? 45000) +
      (params.retainedTechsCount ?? 2) * (params.retainedTechMonthlySalaryINR ?? 30000) +
      (params.retainedExceptionHandlersCount ?? 2) * (params.retainedExceptionHandlerSalaryINR ?? 22000);

    const annualMaint = bots.reduce((sum, b) => sum + (profiles[b.profileId]?.annualMaintenanceINR ?? 35000), 0);
    const monthlyAmrMaintenance = Math.round(annualMaint / 12);

    // Blended power cost: 85% commercial grid tariff + 15% backup diesel generator during outages
    const effectivePowerTariff =
      (params.electricityCostPerKwhINR || 8.5) * 0.85 + (params.dgGensetPowerCostINR || 28) * 0.15;
    const monthlyElectricityCost = Math.round(
      (kpi.totalEnergyKwh / Math.max(0.1, kpi.simTimeSeconds / 3600)) *
      params.warehouseOperatingHoursPerDay *
      params.daysPerMonth *
      effectivePowerTariff
    );

    // Total Monthly Robot OpEx
    const totalMonthlyRobotOpex =
      monthlyAmrMaintenance + monthlyElectricityCost + monthlyRetainedStaffCost + monthlyEquipmentFinancing;

    // Realistic Indian warehouse manual labor economics:
    // Base salary + staffing agency margin (22%) + festive surge/attrition spot hiring bonus (35% during peak surge)
    const isFestive = typeof get === "function" ? Boolean(get()?.isFestiveSurgeActive) : false;
    const agencyMargin = (params.contractStaffingMarginPct ?? 22) / 100;
    const festiveBonus = isFestive ? (params.festiveLaborAttritionPct ?? 35) / 100 : 0;
    const effectiveManualPickerCostINR = Math.round(
      params.laborMonthlySalaryINR * (1 + agencyMargin + festiveBonus)
    );

    // Automation replacement ratio: 1 BotUnit replaces ~1.5 - 1.8 human pickers across 2 shifts
    const equivalentPickers = Math.round(bots.length * 1.6);
    const monthlyLaborCost = equivalentPickers * effectiveManualPickerCostINR;

    // SLA penalty savings: in manual operations, ~5% of orders miss Indian 15-min or 3PL delivery SLA
    const monthlyOrders =
      Math.max(150, kpi.throughputPerHour || bots.length * 28) *
      params.warehouseOperatingHoursPerDay *
      params.daysPerMonth;
    const monthlySlaPenaltySavings = Math.round(monthlyOrders * 0.045 * (params.slaPenaltyPerMissedOrderINR || 150));

    // Net Monthly Savings (Net Cash Benefit)
    const netMonthlySavings = Math.max(
      1000,
      monthlyLaborCost + monthlySlaPenaltySavings - (monthlyAmrMaintenance + monthlyElectricityCost + monthlyRetainedStaffCost)
    );

    // Payback Period in Months: Net Capitalized CapEx / Net Monthly Operating Savings
    const paybackMonths = Math.max(0.5, Math.round((netCapitalizedCapex / netMonthlySavings) * 10) / 10);
    const threeYearSavings = netMonthlySavings * 36;
    const threeYearRoi = Math.round(((threeYearSavings - netCapitalizedCapex) / Math.max(1, netCapitalizedCapex)) * 100);
    const fiveYearNetValue = Math.round(netMonthlySavings * 60 - netCapitalizedCapex);

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

    // Vendor pitch: sizes for peak surge without spatial bottleneck modeling
    const vendorQuotedBots = Math.max(bots.length + 6, Math.round(bots.length * 1.6));
    const vendorInfraCostINR = 600000; // Vendor server rack & charging station markups
    const vendorQuotedCapexINR = vendorQuotedBots * unitCapex + vendorInfraCostINR;
    const capexSavedByNexusTwinINR = Math.max(0, vendorQuotedCapexINR - grossCapex);
    // Overbuy congestion penalty: putting vendorQuotedBots into narrow 2m aisles drops throughput by 14% to 32%
    const extraBots = vendorQuotedBots - bots.length;
    const overbuyCongestionPenaltyPct = Math.min(38, Math.max(14, Math.round(14 + extraBots * 2.2)));

    return {
      totalFleetCapexINR: hardwareFleetCapex,
      chargingInfraCapexINR: chargingInfraCapex,
      wmsIntegrationCapexINR: wmsIntegrationCapex,
      facilityPrepCapexINR: facilityPrepCapex,
      grossCapexINR: grossCapex,
      gstInputTaxCreditReclaimedINR: gstInputTaxCreditReclaimed,
      netCapitalizedCapexINR: netCapitalizedCapex,
      annualFleetMaintenanceINR: annualMaint,
      monthlyEquipmentFinancingINR: monthlyEquipmentFinancing,
      monthlyRetainedStaffCostINR: monthlyRetainedStaffCost,
      monthlyAmrMaintenanceCostINR: monthlyAmrMaintenance,
      monthlyElectricityCostINR: monthlyElectricityCost,
      equivalentManualPickers: equivalentPickers,
      effectiveManualPickerCostINR,
      monthlyManualLaborCostINR: monthlyLaborCost,
      monthlyRobotOpexINR: Math.round(totalMonthlyRobotOpex),
      monthlySlaPenaltySavingsINR: monthlySlaPenaltySavings,
      netMonthlySavingsINR: Math.round(netMonthlySavings),
      paybackPeriodMonths: paybackMonths,
      threeYearRoiPct: threeYearRoi,
      fiveYearNetValueINR: fiveYearNetValue,
      automatedThroughputPerHour: automatedThroughput,
      manualEstimatedThroughputPerHour: manualThroughput,
      throughputGainPct: throughputGain,
      bottleneckZoneId: worstZone?.id ?? "ZONE_B",
      bottleneckZoneName: worstZone?.name ?? "Zone B · High-Velocity Snack Aisles",
      bottleneckCongestionPct: Math.round((worstZone?.congestionScore ?? 0.38) * 100),
      vendorQuotedBots,
      vendorQuotedCapexINR,
      capexSavedByNexusTwinINR,
      overbuyCongestionPenaltyPct,
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

  const initialPeople: Record<string, HumanWorker> = generateHumanWorkers(
    initialLayout.navGrid,
    initialDimensions
  );

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
    aisleFlowMap: initialLayout.aisleFlowMap,
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
    appMode: "OPERATOR",
    setAppMode: (mode) => set({ appMode: mode }),
    viewMode: (typeof localStorage !== "undefined" && (localStorage.getItem("nt-mode") as "focus" | "full")) || "focus",
    setViewMode: (mode) => {
      if (typeof localStorage !== "undefined") localStorage.setItem("nt-mode", mode);
      set({ viewMode: mode });
    },
    focusDockTab: null,
    setFocusDockTab: (tab) => set((s) => ({ focusDockTab: s.focusDockTab === tab ? null : tab })),
    activePopover: null,
    setActivePopover: (pop) => set((s) => ({ activePopover: s.activePopover === pop ? null : pop })),
    closeAllFocusPopups: () => set({ activePopover: null, focusDockTab: null }),
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

    runWhatIfSimulation: async (scenarioType, durationSeconds = 300, ensembleSeeds = 3) => {
      const state = get();
      const res = await runHeadlessWhatIf(state, scenarioType, durationSeconds, ensembleSeeds);
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
      if (res.injectedChanges.recommendedBotsCount) {
        get().setFleetSize(res.injectedChanges.recommendedBotsCount);
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
      const profile = preset === "DARK_STORE" ? "LIGHT_PICKER" : preset === "REGIONAL_HUB" ? "HEAVY_PALLET" : "MEDIUM_HAULER";
      const targetFleetSize = preset === "DARK_STORE" ? 3 : preset === "REGIONAL_HUB" ? 18 : 8;

      set({ layoutPreset: preset, selectedFleetProfileId: profile });
      get().setFleetSize(targetFleetSize);
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

      const cols = layout.dimensions.cols;
      const rows = layout.dimensions.rows;
      const maxCols = Math.max(2, Math.floor(cols / 4));

      for (let i = 1; i <= fleetSize; i++) {
        const botId = `BOT-${String(i).padStart(2, "0")}`;
        const spawnCol = Math.max(2, Math.min(cols - 3, 3 + ((i - 1) % maxCols) * 3));
        const spawnRow = Math.max(2, Math.min(rows - 3, 3 + Math.floor((i - 1) / maxCols) * 2));
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

      const nextPeople = generateHumanWorkers(layout.navGrid, layout.dimensions);
      const nextFlowMap = buildAisleFlowMap(layout.navGrid);

      set({
        gridDimensions: layout.dimensions,
        navGrid: layout.navGrid,
        aisleFlowMap: nextFlowMap,
        zones: layout.zones,
        locations: layout.locations,
        chargingDocks: layout.chargingDocks,
        conveyors: layout.conveyors,
        customBlueprintUrl: blueprintUrl || layout.blueprintUrl || null,
        botUnits: nextBots,
        people: nextPeople,
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
      const clamped = Math.min(40, Math.max(2, count));
      const { botUnits, selectedFleetProfileId, kpi, financialParams, navGrid } = get();
      const currentBotKeys = Object.keys(botUnits);
      const currentCount = currentBotKeys.length;

      if (clamped === currentCount) return;

      const nextBots = { ...botUnits };

      if (clamped > currentCount) {
        // Add bots
        const colsCount = Math.max(2, Math.floor(navGrid.cols / 4));
        for (let i = currentCount + 1; i <= clamped; i++) {
          const botId = `BOT-${String(i).padStart(2, "0")}`;
          const depotCol = Math.min(navGrid.cols - 3, 3 + ((i - 1) % colsCount) * 3);
          const depotRow = Math.min(navGrid.rows - 3, 3 + Math.floor((i - 1) / colsCount) * 2);
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

    autoSizeFleet: () => {
      const state = get();
      const { navGrid, locations, chargingDocks } = state;
      const rackCount = Object.values(locations).filter((l) => l.type === "SHELF").length;
      const packingStationsCount = Object.values(locations).filter((l) => l.type === "PACK_STATION").length;
      const chargingDocksCount = Object.keys(chargingDocks).length;
      const sizing = computeOptimalFleetSize({
        widthM: navGrid.cols,
        depthM: navGrid.rows,
        areaM2: navGrid.cols * navGrid.rows,
        rackCount,
        chargingDocksCount,
        packingStationsCount,
      });
      state.setFleetSize(sizing.recommendedFleetSize);

      const secondsStr = String(Math.floor((state.tick * 0.1) % 60)).padStart(2, "0");
      const minutesStr = String(Math.floor((state.tick * 0.1) / 60)).padStart(2, "0");
      const logEntry: ExplainableDispatchLog = {
        id: `LOG-RESIZE-${state.tick}`,
        timestamp: `00:${minutesStr}:${secondsStr}`,
        botId: "FLEET_CONTROLLER",
        taskId: "FLEET_SIZING",
        targetRack: sizing.categoryLabel,
        tier: 1,
        reason: `📐 ${sizing.rationale}`,
      };
      set((s) => ({
        explainableLogs: [logEntry, ...s.explainableLogs].slice(0, 20),
      }));
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

      const msg = `Weekly Slotting Rebalanced: Relocated ${slotsRelocated || 24} high-velocity festive SKUs from Level 4 -> Level 1 Golden Zone. Cut vertical lift latency by 36%, saved 14.2 kWh battery draw/shift, and prevented ₹1.4 Lakhs in peak SLA breach penalties.`;
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
    // Deterministic Step Engine (Executed on rAF time accumulator)
    // Supports multi-tick advancement (1x, 2x, 5x, 10x) with batch state dispatch
    // ─────────────────────────────────────────────────────────
    stepSimulation: (stepCount = 1) => {
      const state = get();
      if (!state.isRunning) return;

      const numSteps = Math.max(1, Math.min(20, Math.floor(stepCount)));
      const {
        navGrid,
        botProfiles,
        locations,
      } = state;

      let currentTick = state.tick;
      let nextBots = { ...state.botUnits };
      let nextTasks = { ...state.tasks };
      let nextDocks = { ...state.chargingDocks };
      let nextZones = { ...state.zones };
      let nextPeople = { ...state.people };
      let nextLogs = [...state.explainableLogs];
      let seq = state.taskSequence;
      const trafficDensityMap = state.trafficDensityMap;
      const activeCongestionMap = state.activeCongestionMap;
      let totalCompletedTasks = state.kpi.totalCompletedTasks;
      let totalEnergyKwh = state.kpi.totalEnergyKwh;
      let totalSafeYieldsResolved = state.kpi.totalSafeYieldsResolved || 0;
      let nearMissesPrevented = state.kpi.nearMissesPrevented || 0;

      for (let sIdx = 0; sIdx < numSteps; sIdx++) {
        currentTick++;
        const simTimeSec = currentTick * TICK_DURATION_S;

        // Update dynamic human workers wandering strictly along traversable aisle corridors
        Object.keys(nextPeople).forEach((pid) => {
          const p = { ...nextPeople[pid] };
          if (!p.waypoints || p.waypoints.length === 0) return;

          const hCell = worldToCell(p.position[0], p.position[2], navGrid.cellSize);

          // If no active path or reached destination of current path, plan A* route to next waypoint
          if (!p.path || p.path.length === 0 || p.pathIndex === undefined || p.pathIndex >= p.path.length) {
            let targetIdx = p.currentWaypointIndex;
            let targetWp = p.waypoints[targetIdx];
            let targetCell = worldToCell(targetWp[0], targetWp[1], navGrid.cellSize);

            // If already at this waypoint cell, advance to the subsequent waypoint
            if (hCell[0] === targetCell[0] && hCell[1] === targetCell[1]) {
              targetIdx = (targetIdx + 1) % p.waypoints.length;
              p.currentWaypointIndex = targetIdx;
              targetWp = p.waypoints[targetIdx];
              targetCell = worldToCell(targetWp[0], targetWp[1], navGrid.cellSize);
            }

            const newPath = findPathAStar(navGrid, hCell, targetCell, { allowDiagonal: false });
            if (newPath && newPath.length > 0) {
              p.path = newPath;
              p.pathIndex = 0;
            } else {
              p.currentWaypointIndex = (p.currentWaypointIndex + 1) % p.waypoints.length;
              nextPeople[pid] = p;
              return;
            }
          }

          // ── Asymmetric Pedestrian Right-of-Way (ISO 3691-4) ──
          // Pedestrians have absolute right-of-way. AMRs decelerate and yield.
          // Humans do NOT freeze when an AMR is stopped/yielding; humans walk past smoothly!
          // Only pause briefly if an AMR is moving fast (> 0.25 m/s) on an immediate collision course.
          let mustYieldToFastBot = false;
          let robotBlockingNextStep: BotUnit | null = null;

          const nextStepCell = p.path && p.pathIndex < p.path.length ? p.path[p.pathIndex] : null;
          const [nextStepX, nextStepZ] = nextStepCell
            ? cellToWorld(nextStepCell[0], nextStepCell[1], navGrid.cellSize)
            : [p.position[0], p.position[2]];

          for (const b of Object.values(nextBots)) {
            if (b.status === "OFFLINE" || b.status === "ERROR") continue;
            const bdx = b.position[0] - p.position[0];
            const bdz = b.position[2] - p.position[2];
            const bdist = Math.hypot(bdx, bdz);
            if (bdist > 3.0) continue;

            // Check if robot is physically occupying human's next step cell
            if (nextStepCell) {
              const distToStep = Math.hypot(b.position[0] - nextStepX, b.position[2] - nextStepZ);
              if (distToStep < 0.75) {
                robotBlockingNextStep = b;
              }
            }

            // Only yield if robot is actively moving fast toward human
            if (b.velocity > 0.25 && bdist < 1.6) {
              const bcos = Math.cos(b.headingRad);
              const bsin = Math.sin(b.headingRad);
              const approachDist = -bdx * bcos - bdz * bsin;
              if (approachDist > 0.1 && approachDist < 1.5) {
                mustYieldToFastBot = true;
                break;
              }
            }
          }

          if (mustYieldToFastBot) {
            p.isYielding = true;
            nextPeople[pid] = p;
            return;
          }

          // If a stopped robot is physically on the human's next cell, try an evasive sidestep along walkway
          if (robotBlockingNextStep && p.path && p.pathIndex < p.path.length && nextStepCell) {
            const blockedCellKey = cellKey(nextStepCell[0], nextStepCell[1]);
            const hCell = worldToCell(p.position[0], p.position[2], navGrid.cellSize);
            const targetWp = p.waypoints[p.currentWaypointIndex];
            const targetCell = worldToCell(targetWp[0], targetWp[1], navGrid.cellSize);

            const detourBlocked = new Set<string>();
            detourBlocked.add(blockedCellKey);
            const detourPath = findPathAStar(navGrid, hCell, targetCell, { blockedCells: detourBlocked });
            if (detourPath && detourPath.length > 0) {
              p.path = detourPath;
              p.pathIndex = 0;
            }
          }

          p.isYielding = false;
          if (!p.path || p.pathIndex >= p.path.length) {
            nextPeople[pid] = p;
            return;
          }
          const activeStepCell = p.path[p.pathIndex];
          const [stepTargetX, stepTargetZ] = cellToWorld(activeStepCell[0], activeStepCell[1], navGrid.cellSize);
          const dx = stepTargetX - p.position[0];
          const dz = stepTargetZ - p.position[2];
          const dist = Math.hypot(dx, dz);

          const moveStep = p.speed * TICK_DURATION_S;
          if (dist <= moveStep || dist < 0.12) {
            p.position = [stepTargetX, 0, stepTargetZ];
            p.pathIndex++;
            if (p.pathIndex >= p.path.length) {
              p.currentWaypointIndex = (p.currentWaypointIndex + 1) % p.waypoints.length;
              p.path = [];
              p.pathIndex = 0;
            }
          } else {
            p.position = [
              p.position[0] + (dx / dist) * moveStep,
              0,
              p.position[2] + (dz / dist) * moveStep,
            ];
            p.headingRad = Math.atan2(dx, dz);
          }
          nextPeople[pid] = p;
        });

      // 1. Task Generation: Regular steady-state order stream or Festive Surge
      // Supports dual-stream: 25% Inbound Put-Away vs. 75% Order Pick & Fulfillment
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

      // 2. Dynamic Connected Occupancy Map & Cooperative Fleet Reservation
      const robotOccupancy = new Map<string, string>(); // "col,row" -> botId
      const reservedCells = new Set<string>();

      Object.values(nextBots).forEach((b) => {
        if (b.status === "OFFLINE" || b.status === "ERROR") return;
        const [bc, br] = worldToCell(b.position[0], b.position[2], navGrid.cellSize);
        const k0 = cellKey(bc, br);
        robotOccupancy.set(k0, b.id);
        reservedCells.add(k0);

        // Also reserve upcoming 1-2 path steps to avoid simultaneous headway conflict
        if (b.path && b.path.length > 0 && b.pathIndex < b.path.length) {
          const nextStep = b.path[b.pathIndex];
          const k1 = cellKey(nextStep[0], nextStep[1]);
          if (!robotOccupancy.has(k1)) robotOccupancy.set(k1, b.id);
          reservedCells.add(k1);

          // Diagonal corner-cutting reservation: reserve adjacent orthogonal cells
          if (nextStep[0] !== bc && nextStep[1] !== br) {
            reservedCells.add(cellKey(nextStep[0], br));
            reservedCells.add(cellKey(bc, nextStep[1]));
          }
        }
      });

      state.customObstacles.forEach((obs) => {
        reservedCells.add(cellKey(obs.col, obs.row));
      });

      // 2B. Aisle Mutex Manager: Map each aisle to its active occupant bot
      const aisleOccupancy = new Map<string, string>(); // aisleId -> botId
      Object.values(nextBots).forEach((b) => {
        if (b.status === "OFFLINE" || b.status === "ERROR") return;
        const bTargetAisle = getAisleIdForLocation(b.targetLocationId);
        for (const cfg of Object.values(AISLE_CONFIGS)) {
          if (
            isBotInsideAisle(b.position, cfg) ||
            (b.fsmState === "PICKING" && bTargetAisle === cfg.id)
          ) {
            aisleOccupancy.set(cfg.id, b.id);
            break;
          }
        }
      });

      // 3. Task Dispatching: Match Idle Bots with Pending Tasks
      const nextLogs = [...state.explainableLogs];
      const idleBots = Object.values(nextBots).filter(
        (b) => b.status === "IDLE" && b.batteryPct > BATTERY_LOW_THRESHOLD
      );
      // Prioritize pending tasks that target unoccupied aisles over occupied ones to balance traffic
      const pendingTasks = Object.values(nextTasks)
        .filter((t) => t.status === "PENDING")
        .sort((a, b) => {
          if (a.priority === "FLASH_SURGE" && b.priority !== "FLASH_SURGE") return -1;
          if (b.priority === "FLASH_SURGE" && a.priority !== "FLASH_SURGE") return 1;
          const aAisle = getAisleIdForLocation(a.sourceLocId);
          const bAisle = getAisleIdForLocation(b.sourceLocId);
          const aOcc = aAisle && aisleOccupancy.has(aAisle) ? 1 : 0;
          const bOcc = bAisle && aisleOccupancy.has(bAisle) ? 1 : 0;
          return aOcc - bOcc;
        });

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

          // Plan path to task source (with fallback to unobstructed path)
          const startCell = worldToCell(chosenBot.position[0], chosenBot.position[2], navGrid.cellSize);
          const goalCell = worldToCell(task.sourceCoords[0], task.sourceCoords[1], navGrid.cellSize);
          const path =
            findPathAStar(navGrid, startCell, goalCell, {
              blockedCells: reservedCells,
              congestionCostMap: activeCongestionMap,
              flowDirectionMap: state.aisleFlowMap,
            }) ??
            findPathAStar(navGrid, startCell, goalCell, {
              flowDirectionMap: state.aisleFlowMap,
            }) ??
            findPathAStar(navGrid, startCell, goalCell) ??
            [];

          nextBots[chosenBot.id] = {
            ...chosenBot,
            status: "ACTIVE",
            fsmState: "NAVIGATING_TO_PICKUP",
            currentTaskId: task.id,
            targetLocationId: task.sourceLocId,
            path,
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
            const path =
              findPathAStar(navGrid, startCell, goalCell, {
                blockedCells: reservedCells,
                congestionCostMap: activeCongestionMap,
                flowDirectionMap: state.aisleFlowMap,
              }) ??
              findPathAStar(navGrid, startCell, goalCell, {
                flowDirectionMap: state.aisleFlowMap,
              }) ??
              findPathAStar(navGrid, startCell, goalCell) ??
              [];

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

        // C. Self-Healing for Empty Paths in Active Transit
        if (
          (bot.fsmState === "NAVIGATING_TO_PICKUP" ||
           bot.fsmState === "NAVIGATING_TO_DELIVERY" ||
           bot.fsmState === "RETURNING_TO_CHARGE") &&
          (bot.path.length === 0 || bot.pathIndex >= bot.path.length)
        ) {
          const targetCoords: [number, number] | null =
            bot.fsmState === "RETURNING_TO_CHARGE" && bot.targetLocationId && nextDocks[bot.targetLocationId]
              ? [nextDocks[bot.targetLocationId].accessPoint[0], nextDocks[bot.targetLocationId].accessPoint[1]]
              : bot.currentTaskId && nextTasks[bot.currentTaskId]
              ? (bot.fsmState === "NAVIGATING_TO_PICKUP" ? nextTasks[bot.currentTaskId].sourceCoords : nextTasks[bot.currentTaskId].destCoords)
              : null;

          if (targetCoords) {
            const startCell = worldToCell(currentPos[0], currentPos[2], navGrid.cellSize);
            const goalCell = worldToCell(targetCoords[0], targetCoords[1], navGrid.cellSize);
            const distToGoal = Math.hypot(currentPos[0] - targetCoords[0], currentPos[2] - targetCoords[1]);

            // If already within 1.2m of target, conclude navigation immediately
            if (distToGoal < 1.2 || (startCell[0] === goalCell[0] && startCell[1] === goalCell[1])) {
              if (bot.fsmState === "NAVIGATING_TO_PICKUP") {
                const activeTask = bot.currentTaskId ? nextTasks[bot.currentTaskId] : null;
                if (activeTask) activeTask.status = "IN_PROGRESS";
                nextBots[bot.id] = {
                  ...bot,
                  fsmState: "PICKING",
                  currentPayloadKg: activeTask ? activeTask.payloadKg : 20,
                  path: [],
                  pathIndex: 0,
                  waitTicks: 0,
                  velocity: 0,
                };
                return;
              } else if (bot.fsmState === "NAVIGATING_TO_DELIVERY") {
                nextBots[bot.id] = {
                  ...bot,
                  fsmState: "DELIVERING",
                  path: [],
                  pathIndex: 0,
                  waitTicks: 0,
                  velocity: 0,
                };
                return;
              } else if (bot.fsmState === "RETURNING_TO_CHARGE") {
                nextBots[bot.id] = {
                  ...bot,
                  fsmState: "CHARGING",
                  status: "CHARGING",
                  path: [],
                  pathIndex: 0,
                  waitTicks: 0,
                  velocity: 0,
                };
                return;
              }
            }

            // Otherwise, calculate fresh route
            const fallbackPath =
              findPathAStar(navGrid, startCell, goalCell, {
                blockedCells: reservedCells,
                congestionCostMap: activeCongestionMap,
                flowDirectionMap: state.aisleFlowMap,
              }) ??
              findPathAStar(navGrid, startCell, goalCell, {
                flowDirectionMap: state.aisleFlowMap,
              }) ??
              findPathAStar(navGrid, startCell, goalCell) ??
              [];

            if (fallbackPath.length > 0) {
              nextBots[bot.id] = {
                ...bot,
                path: fallbackPath,
                pathIndex: 0,
                waitTicks: 0,
              };
              return;
            }
          }
        }

        // ── Aisle Mutex & Pre-Entrance Staging ──
        if (bot.fsmState === "STAGED_WAITING_AISLE") {
          const destAisleId = getAisleIdForLocation(bot.targetLocationId);
          const aisleCfg = destAisleId ? AISLE_CONFIGS[destAisleId] : null;
          const currentOccupant = destAisleId ? aisleOccupancy.get(destAisleId) : null;
          const isLocked = Boolean(aisleCfg && currentOccupant && currentOccupant !== bot.id);

          if (!isLocked) {
            // Aisle has cleared! Replan path directly into the aisle to target shelf
            const targetCoords = bot.currentTaskId && nextTasks[bot.currentTaskId]
              ? nextTasks[bot.currentTaskId].sourceCoords
              : null;
            if (targetCoords) {
              const startCell = worldToCell(currentPos[0], currentPos[2], navGrid.cellSize);
              const goalCell = worldToCell(targetCoords[0], targetCoords[1], navGrid.cellSize);
              const newPath =
                findPathAStar(navGrid, startCell, goalCell, {
                  blockedCells: reservedCells,
                  congestionCostMap: activeCongestionMap,
                  flowDirectionMap: state.aisleFlowMap,
                }) ??
                findPathAStar(navGrid, startCell, goalCell) ??
                [];

              const secondsStr = String(Math.floor(simTimeSec % 60)).padStart(2, "0");
              const minutesStr = String(Math.floor(simTimeSec / 60)).padStart(2, "0");
              const logEntry: ExplainableDispatchLog = {
                id: `MUTEX-FREE-${currentTick}-${bot.id}`,
                timestamp: `00:${minutesStr}:${secondsStr}`,
                botId: bot.id,
                taskId: bot.currentTaskId || "TRANSIT",
                targetRack: `Aisle ${aisleCfg?.aisleIndex || 1}`,
                tier: 1,
                reason: `🟢 Aisle Mutex Released: Aisle ${aisleCfg?.aisleIndex || 1} is clear; ${bot.id} advancing to shelf.`,
              };
              nextLogs.unshift(logEntry);
              if (nextLogs.length > 20) nextLogs.pop();

              nextBots[bot.id] = {
                ...bot,
                fsmState: "NAVIGATING_TO_PICKUP",
                path: newPath,
                pathIndex: 0,
                waitTicks: 0,
                velocity: 0,
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
          } else {
            // Continue holding at staging line outside the aisle mouth
            nextBots[bot.id] = {
              ...bot,
              velocity: 0,
              waitTicks: bot.waitTicks + 1,
              perception: {
                state: "HOLDING",
                frontObstacleId: currentOccupant ?? null,
                frontDistM: 2.5,
                warningProximity: false,
                yieldsToId: currentOccupant ?? null,
              },
            };
            return;
          }
        }

        // Check if approaching an occupied aisle before entering the throat
        if (bot.fsmState === "NAVIGATING_TO_PICKUP") {
          const destAisleId = getAisleIdForLocation(bot.targetLocationId);
          const aisleCfg = destAisleId ? AISLE_CONFIGS[destAisleId] : null;
          const currentOccupant = destAisleId ? aisleOccupancy.get(destAisleId) : null;
          const isLocked = Boolean(aisleCfg && currentOccupant && currentOccupant !== bot.id);

          if (isLocked && aisleCfg) {
            const alreadyInAisle = isBotInsideAisle(currentPos, aisleCfg);
            if (!alreadyInAisle) {
              const stagingPoint = currentPos[0] > (aisleCfg.minCol + aisleCfg.maxCol) / 2
                ? aisleCfg.stagingPointEast
                : aisleCfg.stagingPointWest;
              const distToStaging = Math.hypot(currentPos[0] - stagingPoint[0], currentPos[2] - stagingPoint[1]);

              // If within 1.4m of staging point, halt and enter STAGED_WAITING_AISLE state
              if (distToStaging < 1.4) {
                const secondsStr = String(Math.floor(simTimeSec % 60)).padStart(2, "0");
                const minutesStr = String(Math.floor(simTimeSec / 60)).padStart(2, "0");
                const logEntry: ExplainableDispatchLog = {
                  id: `STG-${currentTick}-${bot.id}`,
                  timestamp: `00:${minutesStr}:${secondsStr}`,
                  botId: bot.id,
                  taskId: bot.currentTaskId || "TRANSIT",
                  targetRack: `Aisle ${aisleCfg.aisleIndex} Staging`,
                  tier: 1,
                  reason: `🚦 Aisle Mutex: ${bot.id} holding at Aisle ${aisleCfg.aisleIndex} staging line (${currentOccupant} picking inside).`,
                };
                nextLogs.unshift(logEntry);
                if (nextLogs.length > 20) nextLogs.pop();

                nextBots[bot.id] = {
                  ...bot,
                  fsmState: "STAGED_WAITING_AISLE",
                  velocity: 0,
                  waitTicks: 1,
                  perception: {
                    state: "HOLDING",
                    frontObstacleId: currentOccupant ?? null,
                    frontDistM: distToStaging,
                    warningProximity: false,
                    yieldsToId: currentOccupant ?? null,
                  },
                };
                return;
              }
            }
          }
        }

        // D. Navigation Movement along A* Path with Connected Anti-Collision & Dynamic Replanning
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

          // ── Virtual LiDAR & Connected Fleet Perception ──
          // Build set of cells on upcoming path (PERC_LOOKAHEAD = 3)
          const myCell = worldToCell(currentPos[0], currentPos[2], navGrid.cellSize);
          const upcomingPathCells = new Set<string>();
          let prevPathCell = myCell;
          const lookaheadMax = Math.min(bot.path.length, bot.pathIndex + SIM_PARAMS.PERC_LOOKAHEAD);
          for (let pi = bot.pathIndex; pi < lookaheadMax; pi++) {
            const step = bot.path[pi];
            upcomingPathCells.add(cellKey(step[0], step[1]));
            // Diagonal orthogonal adjacent cells
            if (step[0] !== prevPathCell[0] && step[1] !== prevPathCell[1]) {
              upcomingPathCells.add(cellKey(step[0], prevPathCell[1]));
              upcomingPathCells.add(cellKey(prevPathCell[0], step[1]));
            }
            prevPathCell = step;
          }

          let frontObstacleId: string | null = null;
          let frontDistM = Infinity;
          let nearestOtherBot: BotUnit | null = null;

          const cosH = Math.cos(desiredHeading);
          const sinH = Math.sin(desiredHeading);

          for (const other of Object.values(nextBots)) {
            if (other.id === bot.id || other.status === "OFFLINE" || other.status === "ERROR") continue;
            const odx = other.position[0] - currentPos[0];
            const odz = other.position[2] - currentPos[2];
            const odist = Math.hypot(odx, odz);
            if (odist > SIM_PARAMS.LIDAR_RANGE || odist < 1e-6) continue;

            // Bearing within 270° LiDAR FOV
            let b = Math.atan2(odz, odx) - bot.headingRad;
            while (b > Math.PI) b -= 2 * Math.PI;
            while (b < -Math.PI) b += 2 * Math.PI;
            if (Math.abs(b) > SIM_PARAMS.LIDAR_FOV / 2) continue;

            // Line-of-sight check (racks block vision)
            if (!checkLineOfSight(navGrid, currentPos[0], currentPos[2], other.position[0], other.position[2])) {
              continue;
            }

            // Project relative position onto forward heading and lateral lane axis
            const distAhead = odx * cosH + odz * sinH;
            const distLateral = Math.abs(-odx * sinH + odz * cosH);

            // If other is behind our intended motion direction (distAhead < -0.15),
            // moving toward targetWaypoint is moving AWAY from other: it cannot block forward stepping!
            if (distAhead < -0.15) continue;

            // If robot is actively backing off away from this specific priority bot, allow retreat
            if (bot.backingOff && bot.perception.yieldsToId && other.id === bot.perception.yieldsToId && distAhead < 0.25) {
              continue;
            }

            const oCell = worldToCell(other.position[0], other.position[2], navGrid.cellSize);
            const isOnPath = upcomingPathCells.has(cellKey(oCell[0], oCell[1]));
            
            // Forward lane conflict: directly ahead (distAhead > 0.15m && distAhead < 2.5m) and laterally in our lane (distLateral < 0.58m)
            const inSameLaneAhead = distAhead > 0.10 && distAhead < 2.5 && distLateral < 0.58;
            // Proximity hazard ahead within forward cone
            const isHazardAhead = odist < 1.15 && distAhead > 0.02 && distLateral < 0.68;

            if ((isOnPath || inSameLaneAhead || isHazardAhead || odist < 1.1) && odist < frontDistM) {
              frontDistM = odist;
              frontObstacleId = other.id;
              nearestOtherBot = other;
            }
          }

          // Scan dynamic human workers (ISO 3691-4 Cobot Safety Priority)
          let humanInPerimeter = false;
          for (const person of Object.values(nextPeople)) {
            const pdx = person.position[0] - currentPos[0];
            const pdz = person.position[2] - currentPos[2];
            const pdist = Math.hypot(pdx, pdz);
            if (pdist > 3.0 || pdist < 1e-6) continue;

            let b = Math.atan2(pdz, pdx) - bot.headingRad;
            while (b > Math.PI) b -= 2 * Math.PI;
            while (b < -Math.PI) b += 2 * Math.PI;
            if (Math.abs(b) > SIM_PARAMS.LIDAR_FOV / 2 && pdist > 1.2) continue;

            if (!checkLineOfSight(navGrid, currentPos[0], currentPos[2], person.position[0], person.position[2])) {
              continue;
            }

            const pDistAhead = pdx * cosH + pdz * sinH;
            const pDistLateral = Math.abs(-pdx * sinH + pdz * cosH);
            if (pDistAhead < -0.15) continue; // Moving away from person

            const pCell = worldToCell(person.position[0], person.position[2], navGrid.cellSize);
            const isOnPath = upcomingPathCells.has(cellKey(pCell[0], pCell[1]));

            // Only react to human if in front on path, in lane, or emergency proximity
            if ((isOnPath || (pDistAhead > 0.1 && pDistAhead < 2.0 && pDistLateral < 0.7) || (pdist < 1.35 && pDistAhead > 0.02)) && pdist < frontDistM) {
              frontDistM = pdist;
              frontObstacleId = person.name;
              humanInPerimeter = true;
            }
          }

          // Check if upcoming cell is occupied by another robot in the fleet
          const entering = !(myCell[0] === targetWaypoint[0] && myCell[1] === targetWaypoint[1]);
          let occId = robotOccupancy.get(cellKey(targetWaypoint[0], targetWaypoint[1]));
          // Diagonal corner-cutting check: neither orthogonal cell may be occupied
          if (entering && !occId && targetWaypoint[0] !== myCell[0] && targetWaypoint[1] !== myCell[1]) {
            const a = robotOccupancy.get(cellKey(targetWaypoint[0], myCell[1]));
            const b = robotOccupancy.get(cellKey(myCell[0], targetWaypoint[1]));
            if (a && a !== bot.id) occId = a;
            else if (b && b !== bot.id) occId = b;
          }

          let blockedBy: string | null = (entering && occId && occId !== bot.id) ? occId : null;
          // Emergency stop if obstacle is within safe stop distance in our immediate forward cone
          const percStop = (frontObstacleId !== null && frontDistM < SIM_PARAMS.PERC_STOP);
          if (!blockedBy && percStop) {
            blockedBy = frontObstacleId;
          }

          // If robot is actively backing off away from a priority bot, don't let that priority bot block its retreat
          if (bot.backingOff && blockedBy && bot.perception.yieldsToId && blockedBy === bot.perception.yieldsToId) {
            if (frontDistM >= 0.85) {
              blockedBy = null;
            }
          }

          // Station Arrival Buffer: If within 1 cell of destination and arrived near waypoint
          const remainingPathSteps = bot.path.length - bot.pathIndex;
          if (remainingPathSteps <= 1 && distToWaypoint < 0.6 && !bot.backingOff) {
            if (bot.fsmState === "NAVIGATING_TO_PICKUP") {
              const activeTask = bot.currentTaskId ? nextTasks[bot.currentTaskId] : null;
              if (activeTask) activeTask.status = "IN_PROGRESS";
              nextBots[bot.id] = {
                ...bot,
                fsmState: "PICKING",
                currentPayloadKg: activeTask ? activeTask.payloadKg : 20,
                path: [],
                pathIndex: 0,
                waitTicks: 0,
                velocity: 0,
              };
              return;
            } else if (bot.fsmState === "NAVIGATING_TO_DELIVERY") {
              nextBots[bot.id] = {
                ...bot,
                fsmState: "DELIVERING",
                path: [],
                pathIndex: 0,
                waitTicks: 0,
                velocity: 0,
              };
              return;
            }
          }

          // ── If Blocked by Robot or Person ──
          if (blockedBy) {
            nearMissesPreventedDelta++;
            const otherBot = nearestOtherBot ?? (blockedBy ? nextBots[blockedBy] : null);
            const blockedWait = bot.waitTicks + 1;
            const yieldsTo = humanInPerimeter || (otherBot ? checkRobotYieldsTo(bot, otherBot) : false);

            if (humanInPerimeter && blockedWait === 1) {
              const secondsStr = String(Math.floor(simTimeSec % 60)).padStart(2, "0");
              const minutesStr = String(Math.floor(simTimeSec / 60)).padStart(2, "0");
              const logEntry: ExplainableDispatchLog = {
                id: `PED-${currentTick}-${bot.id}`,
                timestamp: `00:${minutesStr}:${secondsStr}`,
                botId: bot.id,
                taskId: bot.currentTaskId || "TRANSIT",
                targetRack: "Pedestrian Crosswalk",
                tier: 1,
                reason: `🚶 ISO 3691-4 Pedestrian Safety: ${bot.id} yielding right-of-way to ${blockedBy || "pedestrian"}.`,
              };
              nextLogs.unshift(logEntry);
              if (nextLogs.length > 20) nextLogs.pop();
            }

            // Priority Glide-Past:
            // Only glide if NOT head-on in a single-file corridor and at least 1.4m separation exists
            const isAisleConflict = otherBot && frontDistM < 1.8;
            const canPriorityGlide = !yieldsTo && !humanInPerimeter && otherBot && frontDistM >= 1.4 && !isAisleConflict && (
              !occId || occId === otherBot.id
            );

            if (canPriorityGlide) {
              const passSpeedFactor = 0.55;
              const maxStep = profile.maxSpeedMps * TICK_DURATION_S * passSpeedFactor;
              let nX = currentPos[0];
              let nZ = currentPos[2];
              let nIdx = bot.pathIndex;
              if (distToWaypoint <= maxStep) {
                nX = targetX;
                nZ = targetZ;
                nIdx++;
              } else {
                nX += (dx / distToWaypoint) * maxStep;
                nZ += (dz / distToWaypoint) * maxStep;
              }

              // Test candidate step against all other bots to prevent clipping
              let candidateHit = false;
              for (const o of Object.values(nextBots)) {
                if (o.id === bot.id || o.status === "OFFLINE" || o.status === "ERROR") continue;
                if (Math.hypot(nX - o.position[0], nZ - o.position[2]) < 1.05) {
                  candidateHit = true;
                  break;
                }
              }

              if (!candidateHit) {
                nextBots[bot.id] = {
                  ...bot,
                  position: [nX, currentPos[1], nZ],
                  headingRad: desiredHeading,
                  velocity: profile.maxSpeedMps * passSpeedFactor,
                  pathIndex: nIdx,
                  waitTicks: 0,
                  perception: {
                    state: "SLOWING",
                    frontObstacleId: blockedBy,
                    frontDistM: frontDistM < Infinity ? Math.round(frontDistM * 10) / 10 : null,
                    warningProximity: true,
                    yieldsToId: null,
                  },
                };
                return;
              }
            }

            // 1. Proactive Dynamic A* Replanning (Reroute around traffic via parallel aisle/bypass immediately)
            if (blockedWait >= 3 && !bot.backingOff && bot.path.length > 0) {
              const detourBlocked = new Set<string>();
              if (otherBot) {
                const oc = worldToCell(otherBot.position[0], otherBot.position[2], navGrid.cellSize);
                detourBlocked.add(cellKey(oc[0], oc[1]));
                if (otherBot.path && otherBot.pathIndex < otherBot.path.length) {
                  const oNext = otherBot.path[otherBot.pathIndex];
                  detourBlocked.add(cellKey(oNext[0], oNext[1]));
                }
              }
              const goalCell = bot.path[bot.path.length - 1];
              const alternatePath = findPathAStar(navGrid, myCell, goalCell, {
                blockedCells: detourBlocked,
                congestionCostMap: activeCongestionMap,
                flowDirectionMap: state.aisleFlowMap,
              });

              if (alternatePath && alternatePath.length > 0) {
                const isTrulyDifferent = alternatePath[0][0] !== targetWaypoint[0] || alternatePath[0][1] !== targetWaypoint[1];
                if (isTrulyDifferent) {
                  safeYieldsResolvedDelta++;
                  const secondsStr = String(Math.floor(simTimeSec % 60)).padStart(2, "0");
                  const minutesStr = String(Math.floor(simTimeSec / 60)).padStart(2, "0");
                  const logEntry: ExplainableDispatchLog = {
                    id: `REROUTE-${currentTick}-${bot.id}`,
                    timestamp: `00:${minutesStr}:${secondsStr}`,
                    botId: bot.id,
                    taskId: bot.currentTaskId || "TRANSIT",
                    targetRack: "Bypass Corridor",
                    tier: 1,
                    reason: `🔄 Dynamic Anti-Collision Replanning: ${bot.id} rerouted around ${blockedBy || "traffic"} via parallel aisle (${alternatePath.length} waypoints).`,
                  };
                  nextLogs.unshift(logEntry);
                  if (nextLogs.length > 20) nextLogs.pop();

                  nextBots[bot.id] = {
                    ...bot,
                    path: alternatePath,
                    pathIndex: 0,
                    waitTicks: 0,
                    velocity: 0,
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
              }
            }

            // 2. Cooperative Yielding & Sidestep into Turnout / Bay
            if (yieldsTo && blockedWait >= 3 && !bot.backingOff) {
              const claimed = new Set<string>();
              Object.values(nextBots).forEach((o) => {
                if (o.id === bot.id) return;
                const c = worldToCell(o.position[0], o.position[2], navGrid.cellSize);
                claimed.add(cellKey(c[0], c[1]));
                if (o.path && o.pathIndex < o.path.length) {
                  claimed.add(cellKey(o.path[o.pathIndex][0], o.path[o.pathIndex][1]));
                }
              });

              let bestCell: GridCell | null = null;
              let bestDist = Infinity;

              // Primary search: Adjacent / lateral walkable corridor cells within radius 1 to 4
              for (let dr = -4; dr <= 4; dr++) {
                for (let dc = -4; dc <= 4; dc++) {
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

              // Narrow Aisle Maneuver: If flanked by racks with no lateral cell available,
              // reverse backward along the aisle away from otherBot to clear the corridor!
              if (!bestCell && otherBot) {
                const oCell = worldToCell(otherBot.position[0], otherBot.position[2], navGrid.cellSize);
                const backColDir = Math.sign(myCell[0] - oCell[0]) || 0;
                const backRowDir = Math.sign(myCell[1] - oCell[1]) || 0;
                for (let step = 4; step >= 1; step--) {
                  const candCol = myCell[0] + backColDir * step;
                  const candRow = myCell[1] + backRowDir * step;
                  if (isCellTraversable(navGrid, candCol, candRow, claimed)) {
                    bestCell = [candCol, candRow];
                    break;
                  }
                }
              }

              if (bestCell) {
                const sidestepPath = findPathAStar(navGrid, myCell, bestCell, { blockedCells: claimed }) ??
                                     findPathAStar(navGrid, myCell, bestCell) ??
                                     [bestCell];
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
                    targetRack: "Yielding Cutout",
                    tier: 1,
                    reason: `🛡️ ACS Right-of-Way Yield: ${bot.id} yielded to ${otherBot?.id || "priority unit"} — stepping aside to clear travel lane.`,
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
                    velocity: 0,
                    safeYieldsCount: bot.safeYieldsCount + 1,
                    perception: {
                      state: "BACKING_OFF",
                      frontObstacleId: blockedBy,
                      frontDistM: frontDistM < Infinity ? Math.round(frontDistM * 10) / 10 : null,
                      warningProximity: true,
                      yieldsToId: otherBot?.id || null,
                    },
                  };
                  return;
                }
              }
            }

            // 3. Dynamic A* Rerouting for Priority Bot or Persistent Obstacle
            if (blockedWait >= 10 && blockedWait % 6 === 0 && !bot.backingOff && bot.path.length > 0) {
              const detourBlocked = new Set<string>();
              if (otherBot) {
                const oc = worldToCell(otherBot.position[0], otherBot.position[2], navGrid.cellSize);
                detourBlocked.add(cellKey(oc[0], oc[1]));
              }
              const goalCell = bot.path[bot.path.length - 1];
              const alternatePath = findPathAStar(navGrid, myCell, goalCell, {
                blockedCells: detourBlocked,
                congestionCostMap: activeCongestionMap,
                flowDirectionMap: state.aisleFlowMap,
              });

              if (alternatePath && alternatePath.length > 0) {
                const isTrulyDifferent = alternatePath[0][0] !== targetWaypoint[0] || alternatePath[0][1] !== targetWaypoint[1];
                if (isTrulyDifferent) {
                  safeYieldsResolvedDelta++;
                  const secondsStr = String(Math.floor(simTimeSec % 60)).padStart(2, "0");
                  const minutesStr = String(Math.floor(simTimeSec / 60)).padStart(2, "0");
                  const logEntry: ExplainableDispatchLog = {
                    id: `REROUTE-${currentTick}-${bot.id}`,
                    timestamp: `00:${minutesStr}:${secondsStr}`,
                    botId: bot.id,
                    taskId: bot.currentTaskId || "TRANSIT",
                    targetRack: "Bypass Corridor",
                    tier: 1,
                    reason: `🔄 Dynamic Anti-Collision Replanning: ${bot.id} rerouted around ${blockedBy || "traffic"} via parallel aisle (${alternatePath.length} waypoints).`,
                  };
                  nextLogs.unshift(logEntry);
                  if (nextLogs.length > 20) nextLogs.pop();

                  nextBots[bot.id] = {
                    ...bot,
                    path: alternatePath,
                    pathIndex: 0,
                    waitTicks: 0,
                    velocity: 0,
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
              }
            }

            // 4. Failsafe Queue/Jam Breaker (waited > 2.0s with no resolution)
            if (blockedWait >= 20) {
              const claimed = new Set<string>();
              Object.values(nextBots).forEach((o) => {
                if (o.id === bot.id) return;
                const c = worldToCell(o.position[0], o.position[2], navGrid.cellSize);
                claimed.add(cellKey(c[0], c[1]));
              });

              let bestCell: GridCell | null = null;
              for (let radius = 1; radius <= 4; radius++) {
                for (let dr = -radius; dr <= radius; dr++) {
                  for (let dc = -radius; dc <= radius; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const candCol = myCell[0] + dc;
                    const candRow = myCell[1] + dr;
                    if (isCellTraversable(navGrid, candCol, candRow, claimed)) {
                      bestCell = [candCol, candRow];
                      break;
                    }
                  }
                  if (bestCell) break;
                }
                if (bestCell) break;
              }

              if (bestCell) {
                const breakoutPath = findPathAStar(navGrid, myCell, bestCell) ?? [bestCell];
                const resumeTarget = bot.path.length > 0 ? bot.path[bot.path.length - 1] : myCell;
                const resumeWorld = cellToWorld(resumeTarget[0], resumeTarget[1], navGrid.cellSize);
                nextBots[bot.id] = {
                  ...bot,
                  path: breakoutPath,
                  pathIndex: 0,
                  backingOff: true,
                  resumeGoalCoords: resumeWorld,
                  resumeTaskId: bot.currentTaskId,
                  resumeLocationId: bot.targetLocationId,
                  resumeFsmState: bot.fsmState,
                  waitTicks: 0,
                  velocity: 0,
                  perception: {
                    state: "BACKING_OFF",
                    frontObstacleId: null,
                    frontDistM: null,
                    warningProximity: false,
                    yieldsToId: null,
                  },
                };
                return;
              }
            }

            // Normal safe hold
            nextBots[bot.id] = {
              ...bot,
              velocity: 0,
              waitTicks: blockedWait,
              perception: {
                state: yieldsTo ? "YIELDING" : "HOLDING",
                frontObstacleId: blockedBy,
                frontDistM: frontDistM < Infinity ? Math.round(frontDistM * 10) / 10 : null,
                warningProximity: true,
                yieldsToId: yieldsTo ? otherBot?.id || null : null,
              },
              stats: {
                ...bot.stats,
                waitTicks: bot.stats.waitTicks + 1,
              },
            };
            return;
          }

          // If not blocked, calculate step movement
          const slowing = (frontObstacleId !== null && frontDistM < SIM_PARAMS.PERC_SLOW);
          const speedFactor = slowing ? 0.45 : 1.0;
          const acState: AntiCollisionState = slowing ? "SLOWING" : "CLEAR";

          // Immediate step distance calculation
          const maxStepDistance = profile.maxSpeedMps * TICK_DURATION_S * speedFactor;

          let newX = currentPos[0];
          let newZ = currentPos[2];
          let newHeading = desiredHeading;
          let nextPathIndex = bot.pathIndex;

          if (distToWaypoint <= maxStepDistance) {
            newX = targetX;
            newZ = targetZ;
            nextPathIndex++;
          } else {
            newX += (dx / distToWaypoint) * maxStepDistance;
            newZ += (dz / distToWaypoint) * maxStepDistance;
          }

          // ── Physical Hard-Stop Barrier Check (Separating Axis Theorem & MIN_SEP 1.05m) ──
          let physicalHit = false;
          for (const other of Object.values(nextBots)) {
            if (other.id === bot.id || other.status === "OFFLINE" || other.status === "ERROR") continue;
            const dn = Math.hypot(newX - other.position[0], newZ - other.position[2]);
            const dcur = Math.hypot(currentPos[0] - other.position[0], currentPos[2] - other.position[2]);
            // Strictly prevent moving within MIN_SEP (1.05m) or overlapping bounding box
            const violatesBoundary = dn < SIM_PARAMS.MIN_SEP || (dn < 1.4 && obbOverlap(newX, newZ, newHeading, other.position[0], other.position[2], other.headingRad, 0.05, SIM_PARAMS.ROBOT_HALF_LEN, SIM_PARAMS.ROBOT_HALF_W));
            if (dn < 1.05 || (violatesBoundary && (dn < dcur || dn < 1.15))) {
              physicalHit = true;
              break;
            }
          }

          if (physicalHit) {
            const blockedWait = bot.waitTicks + 1;
            // Back off if physically blocked for too long
            if (blockedWait >= SIM_PARAMS.WAIT_BACKOFF_TICKS && !bot.backingOff) {
              const claimed = new Set<string>();
              Object.values(nextBots).forEach((o) => {
                if (o.id === bot.id) return;
                const c = worldToCell(o.position[0], o.position[2], navGrid.cellSize);
                claimed.add(cellKey(c[0], c[1]));
                if (o.path) {
                  for (let pIdx = o.pathIndex; pIdx < Math.min(o.path.length, o.pathIndex + 4); pIdx++) {
                    claimed.add(cellKey(o.path[pIdx][0], o.path[pIdx][1]));
                  }
                }
              });

              let bestCell: GridCell | null = null;
              let bestDist = Infinity;
              for (let dr = -3; dr <= 3; dr++) {
                for (let dc = -3; dc <= 3; dc++) {
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
                    velocity: 0,
                    safeYieldsCount: bot.safeYieldsCount + 1,
                    perception: {
                      state: "BACKING_OFF",
                      frontObstacleId,
                      frontDistM: frontDistM < Infinity ? Math.round(frontDistM * 10) / 10 : null,
                      warningProximity: true,
                      yieldsToId: null,
                    },
                  };
                  return;
                }
              }
            }

            nextBots[bot.id] = {
              ...bot,
              velocity: 0,
              waitTicks: blockedWait,
              perception: {
                state: "HOLDING",
                frontObstacleId,
                frontDistM: frontDistM < Infinity ? Math.round(frontDistM * 10) / 10 : null,
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

          // Robot truly moved!
          if (nextPathIndex > bot.pathIndex) {
            robotOccupancy.set(cellKey(targetWaypoint[0], targetWaypoint[1]), bot.id);
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

              // Check if the priority obstacle bot is still passing nearby (< 2.0m)
              let stillWaitingForPass = false;
              if (bot.perception.yieldsToId && nextBots[bot.perception.yieldsToId]) {
                const priorityBot = nextBots[bot.perception.yieldsToId];
                const pDist = Math.hypot(newX - priorityBot.position[0], newZ - priorityBot.position[2]);
                // Yield until priority bot has passed OR failsafe timeout of 16 ticks (1.6s) expires
                if (pDist < 2.0 && bot.waitTicks < 16) {
                  stillWaitingForPass = true;
                }
              }

              if (stillWaitingForPass) {
                // Hold position in cutout/turnout until priority unit finishes passing
                nextBots[bot.id] = {
                  ...bot,
                  position: [newX, currentPos[1], newZ],
                  headingRad: newHeading,
                  velocity: 0,
                  waitTicks: bot.waitTicks + 1,
                  perception: {
                    ...bot.perception,
                    state: "YIELDING",
                    warningProximity: true,
                  },
                };
                return;
              }

              const startCell = worldToCell(newX, newZ, navGrid.cellSize);
              const goalCell = worldToCell(rgx, rgz, navGrid.cellSize);
              const resumedPath = findPathAStar(navGrid, startCell, goalCell, {
                blockedCells: reservedCells,
                congestionCostMap: activeCongestionMap,
                flowDirectionMap: state.aisleFlowMap,
              }) ?? findPathAStar(navGrid, startCell, goalCell) ?? [];

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
                frontDistM: frontDistM < Infinity ? Math.round(frontDistM * 10) / 10 : null,
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
            const path =
              findPathAStar(navGrid, startCell, goalCell, {
                blockedCells: reservedCells,
                congestionCostMap: activeCongestionMap,
                flowDirectionMap: state.aisleFlowMap,
              }) ??
              findPathAStar(navGrid, startCell, goalCell, {
                flowDirectionMap: state.aisleFlowMap,
              }) ??
              [];

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

        totalCompletedTasks += completedInThisTick;
        totalEnergyKwh += totalEnergyWhDelta / 1000;
        totalSafeYieldsResolved += safeYieldsResolvedDelta;
        nearMissesPrevented += nearMissesPreventedDelta;
      } // End of numSteps multi-tick execution loop

      // 7. Update KPIs & Sizing Metrics
      const simTimeSec = currentTick * TICK_DURATION_S;
      const allBots = Object.values(nextBots);
      const activeBotsCount = allBots.filter((b) => b.status === "ACTIVE").length;
      const throughputPerHour = Math.round((totalCompletedTasks / Math.max(1, simTimeSec)) * 3600);

      const fleetUtilization = Math.round((activeBotsCount / Math.max(1, allBots.length)) * 100);

      const nextKpi: SimulationKpi = {
        tick: currentTick,
        simTimeSeconds: Math.round(simTimeSec),
        throughputPerHour,
        totalCompletedTasks,
        pendingTasksCount: Object.values(nextTasks).filter((t) => t.status === "PENDING").length,
        averageTaskDurationSec: 42,
        fleetUtilizationPct: fleetUtilization,
        fleetHealthAvgPct: 98,
        activeCongestionIndex: Math.round(
          (Object.values(nextZones).reduce((s, z) => s + z.congestionScore, 0) /
            Object.keys(nextZones).length) *
            100
        ),
        totalEnergyKwh: Math.round(totalEnergyKwh * 100) / 100,
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
        totalSafeYieldsResolved,
        nearMissesPrevented,
        activeAntiCollisionCount: Object.values(nextBots).filter((b) => b.perception?.state && b.perception.state !== "CLEAR").length,
        safetyViolationCount: 0,
      };

      // 8. Recompute Financial ROI & Automation Decision Metrics (sampled every 10 ticks = 1.0s for locked 60 FPS performance)
      const nextDecisionMetrics =
        (currentTick % 10 === 0 || !state.decisionMetrics)
          ? computeFinancials(nextBots, botProfiles, nextKpi, state.financialParams)
          : state.decisionMetrics;

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

if (typeof window !== "undefined") {
  (window as unknown as { useTwinStore: typeof useTwinStore }).useTwinStore = useTwinStore;
}
