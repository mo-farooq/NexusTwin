/**
 * NexusTwin Auto-Zoning & Spatial Layout Engine
 *
 * Deterministic warehouse layout partitioner:
 * - Divides any warehouse grid into 5 color-coded functional operational zones:
 *   1. INBOUND_RECEIVING (Purple #8B5CF6 / Staging Pallets & Scan Portals)
 *   2. STORAGE_RACKS (Blinkit Yellow #F8CB46 / 4-Tier Racks with 2-cell aisles & cross-aisle)
 *   3. CHARGING_DOCKS (Operational Green #0C831F / Dedicated EV Pads)
 *   4. PACKING_STATIONS (Amber #F59E0B / Fulfillment Kiosks)
 *   5. OUTBOUND_CONVEYORS (Charcoal #1C1C1C / Motorized Roller Lines & Dispatch Doors)
 * - Computer Vision Floorplan Wall Detector using offscreen Canvas brightness scanning
 * - Procedural Architectural Blueprint Generator (for 1-click sample demo testing)
 */

import {
  createEmptyNavGrid,
  setGridRect,
  type GridDimensions,
  type NavGrid,
} from "./pathfinder";
import type {
  WarehouseLocation,
  WarehouseZone,
  ChargingDock,
  ShelfTier,
} from "../store/useTwinStore";

export type FlowType = "I_FLOW" | "U_FLOW";

export interface ConveyorSegment {
  id: string;
  name: string;
  startCoords: [x: number, z: number];
  endCoords: [x: number, z: number];
  lengthM: number;
  speedMps: number;
  isJammed?: boolean;
}

export interface AutoZonerParams {
  widthMeters: number;      // 20 - 80m
  depthMeters: number;      // 20 - 60m
  flowType: FlowType;
  tierCount?: 2 | 3 | 4;
  pillarCells?: Array<[number, number]>;
  uploadedImageUrl?: string;
  customPaints?: Record<string, number>; // "col,row" -> cellType / zone
}

export interface AutoZonedLayout {
  dimensions: GridDimensions;
  navGrid: NavGrid;
  zones: Record<string, WarehouseZone>;
  locations: Record<string, WarehouseLocation>;
  chargingDocks: Record<string, ChargingDock>;
  conveyors: ConveyorSegment[];
  summary: {
    totalStorageCapacityBins: number;
    rackCount: number;
    autoPlacedChargingDocks: number;
    recommendedFleetSize: number;
    estimatedThroughputPerHour: number;
    aisleWidthMeters: number;
    inboundBaysCount: number;
    packingStationsCount: number;
  };
  blueprintUrl?: string | null;
}

/**
 * 1. Procedural Sample Blueprint Generator (for instant 1-click testing)
 */
export function generateSampleBlueprintDataUrl(widthM = 60, depthM = 40): string {
  if (typeof document === "undefined") return "";

  const canvas = document.createElement("canvas");
  const scale = 16; // 16 px per meter
  canvas.width = widthM * scale;
  canvas.height = depthM * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Blueprint navy background
  ctx.fillStyle = "#0B2545";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle grid lines (1m minor, 5m major)
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += scale) {
    ctx.strokeStyle = x % (scale * 5) === 0 ? "rgba(30, 90, 160, 0.45)" : "rgba(20, 60, 110, 0.25)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += scale) {
    ctx.strokeStyle = y % (scale * 5) === 0 ? "rgba(30, 90, 160, 0.45)" : "rgba(20, 60, 110, 0.25)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Thick white exterior concrete perimeter walls
  ctx.lineWidth = scale * 0.6;
  ctx.strokeStyle = "#FFFFFF";
  ctx.strokeRect(scale * 1, scale * 1, canvas.width - scale * 2, canvas.height - scale * 2);

  // Structural column grid (pillars)
  ctx.fillStyle = "#E2E8F0";
  for (let cx = scale * 10; cx < canvas.width - scale * 5; cx += scale * 12) {
    for (let cy = scale * 8; cy < canvas.height - scale * 5; cy += scale * 10) {
      ctx.fillRect(cx - scale * 0.4, cy - scale * 0.4, scale * 0.8, scale * 0.8);
      ctx.strokeStyle = "#60A5FA";
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - scale * 0.5, cy - scale * 0.5, scale * 1.0, scale * 1.0);
    }
  }

  // Inbound Loading Docks (West Wall)
  ctx.fillStyle = "#8B5CF6";
  ctx.fillRect(scale * 0.6, scale * 10, scale * 0.8, scale * 6);
  ctx.fillRect(scale * 0.6, scale * 24, scale * 0.8, scale * 6);

  // Outbound Dispatch Bays (East Wall)
  ctx.fillStyle = "#10B981";
  ctx.fillRect(canvas.width - scale * 1.4, scale * 10, scale * 0.8, scale * 6);
  ctx.fillRect(canvas.width - scale * 1.4, scale * 24, scale * 0.8, scale * 6);

  // Architectural Title Block
  const tbW = scale * 16;
  const tbH = scale * 4.5;
  const tbX = canvas.width - tbW - scale * 1.5;
  const tbY = canvas.height - tbH - scale * 1.5;
  ctx.fillStyle = "rgba(10, 30, 60, 0.9)";
  ctx.fillRect(tbX, tbY, tbW, tbH);
  ctx.strokeStyle = "#38BDF8";
  ctx.lineWidth = 2;
  ctx.strokeRect(tbX, tbY, tbW, tbH);

  ctx.fillStyle = "#F8CB46";
  ctx.font = `bold ${scale * 0.75}px 'Inter', sans-serif`;
  ctx.fillText("NEXUSTWIN ARCHITECTURAL CAD", tbX + scale * 0.6, tbY + scale * 1.2);

  ctx.fillStyle = "#93C5FD";
  ctx.font = `${scale * 0.5}px 'Inter', sans-serif`;
  ctx.fillText(`DIMENSIONS: ${widthM}m x ${depthM}m (${widthM * depthM * 10.764 | 0} SQ FT)`, tbX + scale * 0.6, tbY + scale * 2.2);
  ctx.fillText("FLOW: AUTOMATED AGV / AMR HYBRID", tbX + scale * 0.6, tbY + scale * 3.1);
  ctx.fillText("SCALE: 1:100 METRIC · COMPLIANT", tbX + scale * 0.6, tbY + scale * 3.9);

  return canvas.toDataURL("image/png");
}

/**
 * 2. Computer Vision Wall & Pillar Detector
 * Scans pixel brightness from an uploaded floorplan image to auto-detect walls and pillars.
 */
export async function detectWallsFromBlueprint(
  imageSource: HTMLImageElement | string,
  cols: number,
  rows: number,
  darknessThreshold = 95
): Promise<Array<[number, number]>> {
  if (typeof document === "undefined") return [];

  let img: HTMLImageElement;
  if (typeof imageSource === "string") {
    img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSource;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
  } else {
    img = imageSource;
  }

  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d");
  if (!ctx) return [];

  // Draw scaled image to match discrete grid dimensions
  ctx.drawImage(img, 0, 0, cols, rows);
  const imgData = ctx.getImageData(0, 0, cols, rows).data;

  const detectedObstacles: Array<[number, number]> = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = (r * cols + c) * 4;
      const rVal = imgData[idx];
      const gVal = imgData[idx + 1];
      const bVal = imgData[idx + 2];
      const alpha = imgData[idx + 3];

      if (alpha < 50) continue; // transparent pixel

      // Standard perceptual luminance
      const luminance = 0.299 * rVal + 0.587 * gVal + 0.114 * bVal;

      // Dark lines on light blueprint, or distinct walls
      if (luminance < darknessThreshold) {
        // Skip edges where perimeter plinth is already built
        if (c > 0 && c < cols - 1 && r > 0 && r < rows - 1) {
          detectedObstacles.push([c, r]);
        }
      }
    }
  }

  return detectedObstacles;
}

/**
 * 3. Deterministic Spatial Layout Auto-Zoning Engine
 */
export function generateAutoZonedWarehouse(params: AutoZonerParams): AutoZonedLayout {
  const { widthMeters, depthMeters, flowType, tierCount = 4, uploadedImageUrl } = params;
  const cols = Math.max(20, Math.min(80, Math.round(widthMeters)));
  const rows = Math.max(20, Math.min(60, Math.round(depthMeters)));

  const dimensions: GridDimensions = {
    cols,
    rows,
    cellSize: 1.0,
    widthM: cols,
    depthM: rows,
  };

  const navGrid = createEmptyNavGrid(cols, rows, 1.0);
  const locations: Record<string, WarehouseLocation> = {};
  const chargingDocks: Record<string, ChargingDock> = {};
  const conveyors: ConveyorSegment[] = [];

  // Set boundary walls (outer perimeter cells)
  for (let c = 0; c < cols; c++) {
    navGrid.cells[0 * cols + c] = 1;
    navGrid.cells[(rows - 1) * cols + c] = 1;
  }
  for (let r = 0; r < rows; r++) {
    navGrid.cells[r * cols + 0] = 1;
    navGrid.cells[r * cols + (cols - 1)] = 1;
  }

  // Inject detected / manual pillars
  if (params.pillarCells) {
    params.pillarCells.forEach(([c, r]) => {
      if (c >= 0 && c < cols && r >= 0 && r < rows) {
        navGrid.cells[r * cols + c] = 1;
      }
    });
  }

  let rackAisleCount = 0;
  let totalBins = 0;

  // ─────────────────────────────────────────────────────────────
  // Partitioning by Flow Type: I_FLOW (Through) vs U_FLOW (Same-Side)
  // ─────────────────────────────────────────────────────────────

  let zones: Record<string, WarehouseZone> = {};

  if (flowType === "I_FLOW") {
    // ════════════════════════════════════════════════════════════
    // I_FLOW: West (Inbound) ➔ Center (Racks) ➔ East (Outbound)
    // ════════════════════════════════════════════════════════════

    const inboundMaxCol = Math.max(3, Math.floor(cols * 0.14));
    const storageMinCol = inboundMaxCol + 3;
    const storageMaxCol = Math.floor(cols * 0.76);
    const packingCol = storageMaxCol + 3;
    const outboundCol = cols - 3;

    // 1. INBOUND_RECEIVING (Purple #8B5CF6)
    zones["ZONE_INBOUND"] = {
      id: "ZONE_INBOUND",
      name: "Inbound Receiving Section · Staging Pallets",
      color: "#8B5CF6",
      bounds: [2, 3, inboundMaxCol, rows - 4],
      botCount: 0,
      congestionScore: 0.05,
      isBlocked: false,
      blockedReason: null,
      sectionType: "INBOUND",
    };

    // Inbound Docks / Pallet Staging Portals
    const inboundCount = Math.max(2, Math.floor(rows / 14));
    for (let d = 1; d <= inboundCount; d++) {
      const dockId = `INBOUND-DOCK-${d}`;
      const dRow = Math.floor((rows / (inboundCount + 1)) * d);
      locations[dockId] = {
        id: dockId,
        name: `Inbound Pallet Bay 0${d}`,
        type: "INBOUND_DOCK",
        zoneId: "ZONE_INBOUND",
        coords: [2.5, dRow + 0.5],
        accessPoint: [inboundMaxCol, dRow + 0.5],
      };
      setGridRect(navGrid, 1, dRow - 1, 2, dRow + 1, 1); // dock fixture
    }

    // 2. STORAGE_RACKS (Blinkit Yellow #F8CB46)
    zones["ZONE_STORAGE"] = {
      id: "ZONE_STORAGE",
      name: "Multi-Tier High-Density Storage Section",
      color: "#F8CB46",
      bounds: [storageMinCol - 1, 4, storageMaxCol + 1, rows - 5],
      botCount: 0,
      congestionScore: 0.12,
      isBlocked: false,
      blockedReason: null,
      sectionType: "STORAGE",
    };

    // Build 4-tier storage racks with 2-cell longitudinal aisles & 1 horizontal cross-aisle
    const midRow = Math.floor(rows / 2);
    let shelfSeq = 1;

    for (let c = storageMinCol; c <= storageMaxCol - 2; c += 4) {
      rackAisleCount++;

      // North bank
      for (let r = 5; r <= midRow - 3; r += 3) {
        setGridRect(navGrid, c, r, c + 1, r + 1, 1);
        const shelfId = `SHELF-${String(shelfSeq++).padStart(3, "0")}`;
        const tiers: ShelfTier[] = [];
        for (let t = 1; t <= tierCount; t++) {
          tiers.push({
            level: t as 1 | 2 | 3 | 4,
            skuName: `SKU-AISLE-${rackAisleCount}-L${t}`,
            velocity: t === 1 ? "HIGH" : t === 2 ? "MEDIUM" : "LOW",
            pickDurationSec: t === 1 ? 2.0 : t === 2 ? 4.5 : t === 3 ? 7.5 : 11.0,
            batteryMultiplier: t === 1 ? 1.0 : t === 2 ? 1.4 : t === 3 ? 1.9 : 2.6,
          });
          totalBins += 4;
        }

        locations[shelfId] = {
          id: shelfId,
          name: `Aisle ${rackAisleCount} Rack 0${shelfSeq}`,
          type: "SHELF",
          zoneId: "ZONE_STORAGE",
          coords: [c + 1.0, r + 1.0],
          accessPoint: [c - 1.0, r + 1.0],
          tiers,
        };
      }

      // South bank
      for (let r = midRow + 2; r <= rows - 6; r += 3) {
        setGridRect(navGrid, c, r, c + 1, r + 1, 1);
        const shelfId = `SHELF-${String(shelfSeq++).padStart(3, "0")}`;
        const tiers: ShelfTier[] = [];
        for (let t = 1; t <= tierCount; t++) {
          tiers.push({
            level: t as 1 | 2 | 3 | 4,
            skuName: `SKU-AISLE-${rackAisleCount}-L${t}`,
            velocity: t === 1 ? "HIGH" : t === 2 ? "MEDIUM" : "LOW",
            pickDurationSec: t === 1 ? 2.0 : t === 2 ? 4.5 : t === 3 ? 7.5 : 11.0,
            batteryMultiplier: t === 1 ? 1.0 : t === 2 ? 1.4 : t === 3 ? 1.9 : 2.6,
          });
          totalBins += 4;
        }

        locations[shelfId] = {
          id: shelfId,
          name: `Aisle ${rackAisleCount} Rack 0${shelfSeq}`,
          type: "SHELF",
          zoneId: "ZONE_STORAGE",
          coords: [c + 1.0, r + 1.0],
          accessPoint: [c - 1.0, r + 1.0],
          tiers,
        };
      }
    }

    // 3. CHARGING_DOCKS (Operational Green #0C831F)
    const chargerCount = Math.max(4, Math.min(10, Math.floor(cols / 7)));
    zones["ZONE_CHARGING"] = {
      id: "ZONE_CHARGING",
      name: "Autonomous EV Fast-Charging Bay",
      color: "#0C831F",
      bounds: [storageMinCol, rows - 4, storageMinCol + chargerCount * 3, rows - 2],
      botCount: 0,
      congestionScore: 0.02,
      isBlocked: false,
      blockedReason: null,
      sectionType: "CHARGING",
    };

    for (let ch = 1; ch <= chargerCount; ch++) {
      const chgId = `CHG-DOCK-0${ch}`;
      const col = storageMinCol + (ch - 1) * 3;
      const row = rows - 3;
      setGridRect(navGrid, col, row, col, row, 1);

      chargingDocks[chgId] = {
        id: chgId,
        coords: [col + 0.5, row + 0.5],
        accessPoint: [col + 0.5, row - 1.5],
        isOccupied: false,
        occupantBotId: null,
        powerKw: 7.5,
      };

      locations[chgId] = {
        id: chgId,
        name: `Fast Charger 0${ch}`,
        type: "CHARGING_DOCK",
        zoneId: "ZONE_CHARGING",
        coords: [col + 0.5, row + 0.5],
        accessPoint: [col + 0.5, row - 1.5],
      };
    }

    // 4. PACKING_STATIONS (Amber #F59E0B)
    const packCount = Math.max(2, Math.min(6, Math.floor(rows / 9)));
    zones["ZONE_PACKING"] = {
      id: "ZONE_PACKING",
      name: "Packing & Automated Sorting Section",
      color: "#F59E0B",
      bounds: [packingCol - 1, 5, packingCol + 3, rows - 6],
      botCount: 0,
      congestionScore: 0.18,
      isBlocked: false,
      blockedReason: null,
      sectionType: "PACKING",
    };

    for (let p = 1; p <= packCount; p++) {
      const packId = `PACK-STATION-${p}`;
      const pRow = Math.floor((rows / (packCount + 1)) * p);
      setGridRect(navGrid, packingCol, pRow - 1, packingCol + 2, pRow + 1, 1);

      locations[packId] = {
        id: packId,
        name: `Packing Station 0${p}`,
        type: "PACK_STATION",
        zoneId: "ZONE_PACKING",
        coords: [packingCol + 1.0, pRow],
        accessPoint: [packingCol - 1.5, pRow],
      };

      // 5. OUTBOUND_CONVEYORS (Charcoal #1C1C1C) Connecting Packing Station to Outbound Wall
      conveyors.push({
        id: `CONV-${p}`,
        name: `Express Roller Conveyor ${p}`,
        startCoords: [packingCol + 2.5, pRow],
        endCoords: [outboundCol, pRow],
        lengthM: Math.round(outboundCol - (packingCol + 2.5)),
        speedMps: 1.5,
        isJammed: false,
      });

      // Outbound dispatch bay
      const outDockId = `OUTBOUND-BAY-${p}`;
      locations[outDockId] = {
        id: outDockId,
        name: `Shipping Dispatch Door 0${p}`,
        type: "OUTBOUND_DOCK",
        zoneId: "ZONE_OUTBOUND",
        coords: [outboundCol + 0.5, pRow],
        accessPoint: [outboundCol - 1.0, pRow],
      };
      setGridRect(navGrid, outboundCol, pRow - 1, outboundCol + 1, pRow + 1, 1);
    }

    // 5. OUTBOUND DISPATCH ZONE
    zones["ZONE_OUTBOUND"] = {
      id: "ZONE_OUTBOUND",
      name: "Outbound Dispatch & Shipping Lines",
      color: "#1C1C1C",
      bounds: [packingCol + 4, 3, cols - 2, rows - 4],
      botCount: 0,
      congestionScore: 0.08,
      isBlocked: false,
      blockedReason: null,
      sectionType: "OUTBOUND",
    };

  } else {
    // ════════════════════════════════════════════════════════════
    // U_FLOW: North-West (Inbound) ➔ Center/East (Racks) ➔ South-West (Outbound)
    // ════════════════════════════════════════════════════════════

    const westWidth = Math.max(5, Math.floor(cols * 0.28));
    const midRow = Math.floor(rows * 0.48);

    // 1. INBOUND_RECEIVING (North-West Quadrant)
    zones["ZONE_INBOUND"] = {
      id: "ZONE_INBOUND",
      name: "Inbound Receiving Section · Staging Pallets",
      color: "#8B5CF6",
      bounds: [2, 3, westWidth, midRow - 2],
      botCount: 0,
      congestionScore: 0.05,
      isBlocked: false,
      blockedReason: null,
      sectionType: "INBOUND",
    };

    for (let d = 1; d <= 2; d++) {
      const dockId = `INBOUND-DOCK-${d}`;
      const dRow = 4 + (d - 1) * 6;
      locations[dockId] = {
        id: dockId,
        name: `Inbound Pallet Bay 0${d}`,
        type: "INBOUND_DOCK",
        zoneId: "ZONE_INBOUND",
        coords: [3.0, dRow],
        accessPoint: [westWidth, dRow],
      };
      setGridRect(navGrid, 1, dRow - 1, 2, dRow + 1, 1);
    }

    // 2. PACKING & OUTBOUND (South-West Quadrant)
    zones["ZONE_PACKING"] = {
      id: "ZONE_PACKING",
      name: "Packing & Automated Sorting Section",
      color: "#F59E0B",
      bounds: [2, midRow + 2, westWidth, rows - 4],
      botCount: 0,
      congestionScore: 0.16,
      isBlocked: false,
      blockedReason: null,
      sectionType: "PACKING",
    };

    zones["ZONE_OUTBOUND"] = {
      id: "ZONE_OUTBOUND",
      name: "Outbound Dispatch & Shipping Lines",
      color: "#1C1C1C",
      bounds: [1, midRow + 4, 3, rows - 5],
      botCount: 0,
      congestionScore: 0.06,
      isBlocked: false,
      blockedReason: null,
      sectionType: "OUTBOUND",
    };

    for (let p = 1; p <= 3; p++) {
      const packId = `PACK-STATION-${p}`;
      const pRow = midRow + 4 + (p - 1) * 5;
      setGridRect(navGrid, westWidth - 3, pRow - 1, westWidth - 1, pRow + 1, 1);

      locations[packId] = {
        id: packId,
        name: `Packing Station 0${p}`,
        type: "PACK_STATION",
        zoneId: "ZONE_PACKING",
        coords: [westWidth - 2, pRow],
        accessPoint: [westWidth + 1.5, pRow],
      };

      // Roller conveyor line from packing station to West dock wall
      conveyors.push({
        id: `CONV-${p}`,
        name: `U-Flow Conveyor ${p}`,
        startCoords: [westWidth - 3.5, pRow],
        endCoords: [2.5, pRow],
        lengthM: Math.round(westWidth - 6),
        speedMps: 1.5,
        isJammed: false,
      });

      const outDockId = `OUTBOUND-BAY-${p}`;
      locations[outDockId] = {
        id: outDockId,
        name: `Dispatch Bay 0${p}`,
        type: "OUTBOUND_DOCK",
        zoneId: "ZONE_OUTBOUND",
        coords: [2.0, pRow],
        accessPoint: [3.5, pRow],
      };
      setGridRect(navGrid, 1, pRow - 1, 2, pRow + 1, 1);
    }

    // 3. STORAGE_RACKS (East & Central Core)
    const storageMinCol = westWidth + 3;
    const storageMaxCol = cols - 4;

    zones["ZONE_STORAGE"] = {
      id: "ZONE_STORAGE",
      name: "Multi-Tier High-Density Storage Section",
      color: "#F8CB46",
      bounds: [storageMinCol - 1, 4, storageMaxCol + 1, rows - 5],
      botCount: 0,
      congestionScore: 0.14,
      isBlocked: false,
      blockedReason: null,
      sectionType: "STORAGE",
    };

    let shelfSeq = 1;
    for (let c = storageMinCol; c <= storageMaxCol - 2; c += 4) {
      rackAisleCount++;
      for (let r = 5; r <= rows - 6; r += 3) {
        if (Math.abs(r - midRow) < 2) continue; // cross-aisle
        setGridRect(navGrid, c, r, c + 1, r + 1, 1);
        const shelfId = `SHELF-${String(shelfSeq++).padStart(3, "0")}`;
        const tiers: ShelfTier[] = [];
        for (let t = 1; t <= tierCount; t++) {
          tiers.push({
            level: t as 1 | 2 | 3 | 4,
            skuName: `SKU-AISLE-${rackAisleCount}-L${t}`,
            velocity: t === 1 ? "HIGH" : t === 2 ? "MEDIUM" : "LOW",
            pickDurationSec: t === 1 ? 2.0 : t === 2 ? 4.5 : t === 3 ? 7.5 : 11.0,
            batteryMultiplier: t === 1 ? 1.0 : t === 2 ? 1.4 : t === 3 ? 1.9 : 2.6,
          });
          totalBins += 4;
        }

        locations[shelfId] = {
          id: shelfId,
          name: `Aisle ${rackAisleCount} Rack 0${shelfSeq}`,
          type: "SHELF",
          zoneId: "ZONE_STORAGE",
          coords: [c + 1.0, r + 1.0],
          accessPoint: [c - 1.0, r + 1.0],
          tiers,
        };
      }
    }

    // 4. CHARGING_DOCKS (North-East Perimeter)
    const chargerCount = Math.max(4, Math.min(8, Math.floor(cols / 8)));
    zones["ZONE_CHARGING"] = {
      id: "ZONE_CHARGING",
      name: "Autonomous EV Fast-Charging Bay",
      color: "#0C831F",
      bounds: [storageMinCol, 1, storageMinCol + chargerCount * 3, 3],
      botCount: 0,
      congestionScore: 0.02,
      isBlocked: false,
      blockedReason: null,
      sectionType: "CHARGING",
    };

    for (let ch = 1; ch <= chargerCount; ch++) {
      const chgId = `CHG-DOCK-0${ch}`;
      const col = storageMinCol + (ch - 1) * 3;
      const row = 2;
      setGridRect(navGrid, col, row, col, row, 1);

      chargingDocks[chgId] = {
        id: chgId,
        coords: [col + 0.5, row + 0.5],
        accessPoint: [col + 0.5, row + 1.5],
        isOccupied: false,
        occupantBotId: null,
        powerKw: 7.5,
      };

      locations[chgId] = {
        id: chgId,
        name: `Fast Charger 0${ch}`,
        type: "CHARGING_DOCK",
        zoneId: "ZONE_CHARGING",
        coords: [col + 0.5, row + 0.5],
        accessPoint: [col + 0.5, row + 1.5],
      };
    }
  }

  // Calculate high-confidence sizing metrics
  const autoPlacedDocks = Object.keys(chargingDocks).length;
  const recommendedFleetSize = Math.max(5, Math.min(24, Math.round(rackAisleCount * 2.2)));
  const estimatedThroughput = Math.round(recommendedFleetSize * 28.5);

  return {
    dimensions,
    navGrid,
    zones,
    locations,
    chargingDocks,
    conveyors,
    summary: {
      totalStorageCapacityBins: totalBins,
      rackCount: Object.values(locations).filter((l) => l.type === "SHELF").length,
      autoPlacedChargingDocks: autoPlacedDocks,
      recommendedFleetSize,
      estimatedThroughputPerHour: estimatedThroughput,
      aisleWidthMeters: 2.0,
      inboundBaysCount: Object.values(locations).filter((l) => l.type === "INBOUND_DOCK").length,
      packingStationsCount: Object.values(locations).filter((l) => l.type === "PACK_STATION").length,
    },
    blueprintUrl: uploadedImageUrl || null,
  };
}
