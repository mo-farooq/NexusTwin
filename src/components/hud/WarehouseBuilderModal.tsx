/**
 * NexusTwin Warehouse Builder & Blueprint Studio Modal
 *
 * Fullscreen split-screen studio allowing warehouse owners to:
 * - Upload CAD blueprints (PNG/JPG/SVG/JSON) or load a procedural sample MSME blueprint
 * - Automatically partition the floor into 5 functional zones using AI auto-zoning
 * - Manually customize or paint cells on an interactive 2D blueprint grid canvas
 * - Commit and generate the live 3D Digital Twin with 1 click
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  generateAutoZonedWarehouse,
  detectWallsFromBlueprint,
  generateSampleBlueprintDataUrl,
  type FlowType,
  type AutoZonedLayout,
} from "../../engine/autoZoner";
import { useTwinStore } from "../../store/useTwinStore";

// ─────────────────────────────────────────────────────────────
// Paint Brushes & Color Palette
// ─────────────────────────────────────────────────────────────

type BrushType =
  | "INBOUND"
  | "STORAGE"
  | "CHARGER"
  | "PACKING"
  | "CONVEYOR"
  | "PILLAR"
  | "ERASER";

interface BrushDef {
  id: BrushType;
  label: string;
  color: string;
  icon: string;
  desc: string;
}

const BRUSHES: BrushDef[] = [
  { id: "INBOUND", label: "Inbound Staging", color: "#8B5CF6", icon: "📥", desc: "Purple #8B5CF6 · Raw package receiving" },
  { id: "STORAGE", label: "4-Tier Storage Rack", color: "#F8CB46", icon: "📦", desc: "Blinkit Yellow #F8CB46 · Central inventory" },
  { id: "CHARGER", label: "EV Charger Pad", color: "#0C831F", icon: "⚡", desc: "Green #0C831F · Perimeter battery docks" },
  { id: "PACKING", label: "Packing Station", color: "#F59E0B", icon: "🛠️", desc: "Amber #F59E0B · Fulfillment benches" },
  { id: "CONVEYOR", label: "Outbound Conveyor", color: "#1C1C1C", icon: "📤", desc: "Charcoal #1C1C1C · Motorized shipping line" },
  { id: "PILLAR", label: "Wall / Pillar", color: "#334155", icon: "🧱", desc: "Slate #334155 · Impassable obstacle" },
  { id: "ERASER", label: "Clear Cell", color: "#FFFFFF", icon: "🧹", desc: "White · Walkable open aisle floor" },
];

export function WarehouseBuilderModal() {
  const isBuilderModalOpen = useTwinStore((s) => s.isBuilderModalOpen || s.modal === "builder");
  const closeBuilderModal = () => {
    useTwinStore.setState({ isBuilderModalOpen: false, modal: null });
    if (typeof window !== "undefined" && (window.location.hash.includes("studio") || window.location.hash.includes("builder"))) {
      window.location.hash = "#operator";
    }
  };
  const applyCustomLayout = useTwinStore((s) => s.applyCustomLayout);

  // Layout parameters
  const [widthM, setWidthM] = useState(60);
  const [depthM, setDepthM] = useState(40);
  const [flowType, setFlowType] = useState<FlowType>("I_FLOW");
  const [tierCount, setTierCount] = useState<2 | 3 | 4>(4);

  // ── Indian Facility Archetypes & Operational Priors ───────────
  type IndianArchetype = "ZEPTO_DARKSTORE" | "BHIWANDI_3PL" | "PEENYA_MSME";
  const [selectedArchetype, setSelectedArchetype] = useState<IndianArchetype | null>("BHIWANDI_3PL");
  const [avgBasketSize, setAvgBasketSize] = useState<number>(6.5);
  const [targetSlaText, setTargetSlaText] = useState<string>("Same-Day Dispatch");
  const [skuParetoPct, setSkuParetoPct] = useState<number>(70);
  const [gridPowerLimitKw, setGridPowerLimitKw] = useState<number>(45);

  const applyArchetype = (arch: IndianArchetype) => {
    setSelectedArchetype(arch);
    let nextW = 60;
    let nextD = 40;
    let nextFlow: FlowType = "I_FLOW";
    let nextTiers: 2 | 3 | 4 = 4;

    if (arch === "ZEPTO_DARKSTORE") {
      nextW = 20;
      nextD = 16;
      nextFlow = "U_FLOW";
      nextTiers = 3;
      setAvgBasketSize(2.2);
      setTargetSlaText("12 mins (Instant Delivery)");
      setSkuParetoPct(75);
      setGridPowerLimitKw(18);
    } else if (arch === "BHIWANDI_3PL") {
      nextW = 60;
      nextD = 40;
      nextFlow = "I_FLOW";
      nextTiers = 4;
      setAvgBasketSize(6.5);
      setTargetSlaText("Same-Day Dispatch");
      setSkuParetoPct(70);
      setGridPowerLimitKw(45);
    } else if (arch === "PEENYA_MSME") {
      nextW = 35;
      nextD = 25;
      nextFlow = "I_FLOW";
      nextTiers = 2;
      setAvgBasketSize(1.4);
      setTargetSlaText("Next-Day Dispatch (24h)");
      setSkuParetoPct(60);
      setGridPowerLimitKw(28);
    }

    setWidthM(nextW);
    setDepthM(nextD);
    setFlowType(nextFlow);
    setTierCount(nextTiers);

    const layout = generateAutoZonedWarehouse({
      widthMeters: nextW,
      depthMeters: nextD,
      flowType: nextFlow,
      tierCount: nextTiers,
      pillarCells: detectedPillars,
      uploadedImageUrl: blueprintUrl || undefined,
    });
    setActiveLayout(layout);
  };

  // Blueprint & canvas state
  const [blueprintUrl, setBlueprintUrl] = useState<string | null>(null);
  const [blueprintName, setBlueprintName] = useState<string | null>(null);
  const [detectedPillars, setDetectedPillars] = useState<Array<[number, number]>>([]);
  const [activeBrush, setActiveBrush] = useState<BrushType>("STORAGE");
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [hoverCoord, setHoverCoord] = useState<[number, number] | null>(null);

  // Active generated layout
  const [activeLayout, setActiveLayout] = useState<AutoZonedLayout | null>(null);
  const [customPaints, setCustomPaints] = useState<Record<string, BrushType>>({});

  // Auto-generate initial layout on mount or dimension/flow change
  useEffect(() => {
    const layout = generateAutoZonedWarehouse({
      widthMeters: widthM,
      depthMeters: depthM,
      flowType,
      tierCount,
      pillarCells: detectedPillars,
      uploadedImageUrl: blueprintUrl || undefined,
    });
    setActiveLayout(layout);
  }, [widthM, depthM, flowType, tierCount, detectedPillars, blueprintUrl]);

  // Handle Drag & Drop blueprint image upload
  const handleFileUpload = (file: File) => {
    if (!file) return;
    setBlueprintName(file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setBlueprintUrl(dataUrl);

      // Auto-detect walls/pillars using Computer Vision scanner
      try {
        const pillars = await detectWallsFromBlueprint(dataUrl, widthM, depthM, 90);
        setDetectedPillars(pillars);
      } catch (err) {
        console.warn("Luminance scanning fallback", err);
      }
    };
    reader.readAsDataURL(file);
  };

  // Quick 1-click sample MSME blueprint loader
  const handleLoadSampleBlueprint = async () => {
    const sampleUrl = generateSampleBlueprintDataUrl(widthM, depthM);
    setBlueprintUrl(sampleUrl);
    setBlueprintName("Sample_MSME_Warehouse_CAD_60x40.png");

    // Scan sample pillars
    const pillars = await detectWallsFromBlueprint(sampleUrl, widthM, depthM, 85);
    setDetectedPillars(pillars);
  };

  // Run AI Auto-Zoning
  const handleRunAutoZoner = () => {
    const layout = generateAutoZonedWarehouse({
      widthMeters: widthM,
      depthMeters: depthM,
      flowType,
      tierCount,
      pillarCells: detectedPillars,
      uploadedImageUrl: blueprintUrl || undefined,
    });
    setActiveLayout(layout);
    setCustomPaints({});
  };

  // Zoom level for Studio canvas viewport (Fit, 75%, 100%)
  const [zoomLevel, setZoomLevel] = useState<"fit" | "75" | "100">("100");

  // Global mouseup listener so dragging never gets stuck outside canvas
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsMouseDown(false);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, []);

  // Clean out-of-bounds custom paints when widthM or depthM changes
  useEffect(() => {
    setCustomPaints((prev) => {
      const next: Record<string, BrushType> = {};
      let changed = false;
      Object.entries(prev).forEach(([key, brush]) => {
        const [c, r] = key.split(",").map(Number);
        if (c < widthM && r < depthM) {
          next[key] = brush;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [widthM, depthM]);

  // Interactive 2D Canvas cell painting
  const paintCell = (col: number, row: number) => {
    if (col < 1 || col >= widthM - 1 || row < 1 || row >= depthM - 1) return;
    const key = `${col},${row}`;
    setCustomPaints((prev) => ({
      ...prev,
      [key]: activeBrush,
    }));
  };

  // Commit layout & generate 3D Twin
  const handleGenerate3DTwin = () => {
    if (!activeLayout) return;

    // Apply any manual custom paints into navgrid and location objects
    const finalGrid = { ...activeLayout.navGrid, cells: new Uint8Array(activeLayout.navGrid.cells) };
    const finalLocations = { ...activeLayout.locations };
    const finalChargingDocks = { ...activeLayout.chargingDocks };
    const finalConveyors = [...activeLayout.conveyors];
    let finalRackCount = activeLayout.summary.rackCount;

    // Custom obstacles collection (pillars, detected walls, custom barriers)
    const customObstacles: Array<{ id: string; col: number; row: number; label: string }> = [];
    detectedPillars.forEach(([c, r], pIdx) => {
      customObstacles.push({
        id: `obs-pillar-${pIdx}-${c}-${r}`,
        col: c,
        row: r,
        label: "Wall Pillar",
      });
    });

    Object.entries(customPaints).forEach(([coord, brush]) => {
      const [c, r] = coord.split(",").map(Number);
      if (c < 0 || c >= widthM || r < 0 || r >= depthM) return;
      const cellIdx = r * finalGrid.cols + c;
      const wx = c + 0.5;
      const wz = r + 0.5;

      // 1. Remove any existing entity at this cell (prevents duplicate locations)
      Object.keys(finalLocations).forEach((locKey) => {
        const loc = finalLocations[locKey];
        if (Math.abs(loc.coords[0] - wx) < 1.0 && Math.abs(loc.coords[1] - wz) < 1.0) {
          delete finalLocations[locKey];
          if (loc.type === "SHELF") finalRackCount = Math.max(0, finalRackCount - 1);
        }
      });
      Object.keys(finalChargingDocks).forEach((dockKey) => {
        const dock = finalChargingDocks[dockKey];
        if (Math.abs(dock.coords[0] - wx) < 1.0 && Math.abs(dock.coords[1] - wz) < 1.0) {
          delete finalChargingDocks[dockKey];
        }
      });

      // 2. Apply painted brush
      if (brush === "STORAGE") {
        finalGrid.cells[cellIdx] = 1;
        const locId = `SHELF-CUSTOM-${c}-${r}`;
        finalLocations[locId] = {
          id: locId,
          name: `Custom Rack ${c}-${r}`,
          type: "SHELF",
          zoneId: "ZONE_A",
          coords: [wx, wz],
          accessPoint: [wx, Math.max(1, wz - 1.0)],
          tiers: [
            { level: 4, skuName: "Bulk SKU High", velocity: "HIGH", pickDurationSec: 9.0, batteryMultiplier: 2.2 },
            { level: 3, skuName: "Fast SKU Mid", velocity: "MEDIUM", pickDurationSec: 6.0, batteryMultiplier: 1.6 },
            { level: 2, skuName: "Medium SKU", velocity: "MEDIUM", pickDurationSec: 4.5, batteryMultiplier: 1.3 },
            { level: 1, skuName: "Ground SKU", velocity: "HIGH", pickDurationSec: 2.0, batteryMultiplier: 1.0 },
          ],
        };
        finalRackCount++;
      } else if (brush === "CHARGER") {
        finalGrid.cells[cellIdx] = 0; // Chargers are drivable pads
        const dockId = `DOCK-CUSTOM-${c}-${r}`;
        finalChargingDocks[dockId] = {
          id: dockId,
          coords: [wx, wz],
          accessPoint: [wx, Math.max(1, wz - 1.0)],
          isOccupied: false,
          occupantBotId: null,
          powerKw: 12,
        };
      } else if (brush === "PACKING") {
        finalGrid.cells[cellIdx] = 1;
        const packId = `PACK-CUSTOM-${c}-${r}`;
        finalLocations[packId] = {
          id: packId,
          name: `Packing Station ${c}-${r}`,
          type: "PACK_STATION",
          zoneId: "ZONE_D",
          coords: [wx, wz],
          accessPoint: [wx, Math.max(1, wz - 1.0)],
        };
      } else if (brush === "INBOUND") {
        finalGrid.cells[cellIdx] = 0;
        const dockId = `INBOUND-CUSTOM-${c}-${r}`;
        finalLocations[dockId] = {
          id: dockId,
          name: `Inbound Staging ${c}-${r}`,
          type: "INBOUND_DOCK",
          zoneId: "ZONE_C",
          coords: [wx, wz],
          accessPoint: [wx, Math.min(depthM - 2, wz + 1.0)],
        };
      } else if (brush === "PILLAR") {
        finalGrid.cells[cellIdx] = 1;
        customObstacles.push({
          id: `obs-custom-${c}-${r}`,
          col: c,
          row: r,
          label: "Custom Barrier",
        });
      } else if (brush === "CONVEYOR") {
        finalGrid.cells[cellIdx] = 1;
        finalConveyors.push({
          id: `conv-custom-${c}-${r}`,
          name: `Conveyor ${c}-${r}`,
          startCoords: [wx - 0.5, wz],
          endCoords: [wx + 0.5, wz],
          lengthM: 1.0,
          speedMps: 1.5,
        });
      } else if (brush === "ERASER") {
        finalGrid.cells[cellIdx] = 0;
      }
    });

    applyCustomLayout(
      {
        ...activeLayout,
        navGrid: finalGrid,
        locations: finalLocations,
        chargingDocks: finalChargingDocks,
        conveyors: finalConveyors,
        summary: {
          ...activeLayout.summary,
          rackCount: finalRackCount,
          totalStorageCapacityBins: finalRackCount * tierCount * 24,
          autoPlacedChargingDocks: Object.keys(finalChargingDocks).length,
        },
      },
      blueprintUrl
    );

    // Populate custom obstacles in store so pillars render in 3D
    useTwinStore.setState({ customObstacles });

    // Close studio modal and return to live facility view
    closeBuilderModal();
  };

  if (!isBuilderModalOpen) return null;

  return (
    <div
      onClick={closeBuilderModal}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(16px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      {/* Main Studio Frame */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "1380px",
          height: "92vh",
          background: "#FFFFFF",
          borderRadius: "20px",
          boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(226, 232, 240, 0.8)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Studio Top Header */}
        <header
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                fontSize: "24px",
                background: "#FEF3C7",
                padding: "6px 10px",
                borderRadius: "10px",
                border: "1px solid #FDE68A",
              }}
            >
              🏗️
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 900, color: "#0F172A", letterSpacing: "-0.02em" }}>
                  Warehouse Layout Builder & Blueprint Studio
                </h2>
                <span
                  style={{
                    background: "#F8CB46",
                    color: "#1C1C1C",
                    fontSize: "10px",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "6px",
                  }}
                >
                  AI AUTO-ZONER
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748B" }}>
                Upload CAD floorplan, auto-partition 5 functional warehouse zones, or customize cells before generating your live 3D Digital Twin.
              </p>
            </div>
          </div>

          <button
            onClick={closeBuilderModal}
            style={{
              background: "#F1F5F9",
              border: "none",
              borderRadius: "10px",
              width: "34px",
              height: "34px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#64748B",
              fontWeight: 800,
              fontSize: "16px",
              transition: "all 0.15s ease",
            }}
            title="Close builder"
          >
            ✕
          </button>
        </header>

        {/* Split Studio Body */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* ════════════════════════════════════════════════════════
              LEFT PANEL: Inputs, Sliders & Auto-Zoning Engine
             ════════════════════════════════════════════════════════ */}
          <div
            style={{
              width: "390px",
              borderRight: "1px solid #E2E8F0",
              background: "#FFFFFF",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              overflowY: "auto",
            }}
          >
            {/* 1. Blueprint Upload Dropzone */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: "8px" }}>
                1. Floorplan Blueprint Upload
              </label>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0]) handleFileUpload(e.dataTransfer.files[0]);
                }}
                style={{
                  border: "2px dashed #CBD5E1",
                  borderRadius: "12px",
                  padding: "14px",
                  textAlign: "center",
                  background: blueprintUrl ? "#F8FAFC" : "#F8FAFC",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".png,.jpg,.jpeg,.svg,.json";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleFileUpload(file);
                  };
                  input.click();
                }}
              >
                {blueprintUrl ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}>
                    <img
                      src={blueprintUrl}
                      alt="Blueprint Thumbnail"
                      style={{ width: "48px", height: "36px", objectFit: "cover", borderRadius: "6px", border: "1px solid #CBD5E1" }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {blueprintName || "Blueprint Loaded"}
                      </div>
                      <div style={{ fontSize: "10px", color: "#10B981", fontWeight: 700 }}>
                        ✓ Walls & Pillars Detected ({detectedPillars.length} cells)
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span style={{ fontSize: "24px" }}>📐</span>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginTop: "4px" }}>
                      Drop CAD floorplan (.png, .jpg, .svg)
                    </div>
                    <div style={{ fontSize: "10px", color: "#94A3B8" }}>or click to browse local file</div>
                  </div>
                )}
              </div>

              {/* 1-Click Sample MSME Blueprint Demo Button */}
              <button
                onClick={handleLoadSampleBlueprint}
                style={{
                  width: "100%",
                  marginTop: "8px",
                  padding: "8px 12px",
                  background: "#F1F5F9",
                  border: "1px solid #CBD5E1",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: 800,
                  color: "#2563EB",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                <span>📄</span> Load Sample MSME Blueprint (1-Click Demo)
              </button>
            </div>

            {/* 2. Facility Dimensions & Flow Selection */}
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: "8px" }}>
                2. Facility Sizing & Material Flow
              </label>

              {/* 1-Click Indian Facility Archetypes */}
              <div style={{ marginBottom: "14px" }}>
                <span style={{ display: "block", fontSize: "10px", fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: "6px", letterSpacing: "0.03em" }}>
                  1-Click Indian Facility Archetypes:
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {/* Archetype 1: Urban Quick-Commerce */}
                  <button
                    onClick={() => applyArchetype("ZEPTO_DARKSTORE")}
                    style={{
                      padding: "10px 12px",
                      background: selectedArchetype === "ZEPTO_DARKSTORE" ? "#FFFBEB" : "#F8FAFC",
                      border: selectedArchetype === "ZEPTO_DARKSTORE" ? "2px solid #F59E0B" : "1px solid #E2E8F0",
                      borderRadius: "10px",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A" }}>
                        ⚡ Urban Quick-Commerce Dark Store
                      </span>
                      <span style={{ fontSize: "9px", fontWeight: 800, color: "#B45309", background: "#FEF3C7", padding: "1px 6px", borderRadius: "4px" }}>
                        ZEPTO / BLINKIT
                      </span>
                    </div>
                    <div style={{ fontSize: "10px", color: "#64748B", marginTop: "2px" }}>
                      3,500 sq ft (20m × 16m) · 3–4 AMRs · 1.4m Narrow Aisles
                    </div>
                    <div
                      style={{
                        marginTop: "5px",
                        fontSize: "9px",
                        fontWeight: 700,
                        color: "#92400E",
                        background: "#FEF3C7",
                        padding: "3px 6px",
                        borderRadius: "5px",
                        lineHeight: 1.3,
                        border: "1px solid #FDE68A",
                      }}
                    >
                      Priors: Avg Basket: 2.2 items | Target SLA: 12 mins | SKU Pareto: Top 12% = 75% picks | Grid Load: 18 kW
                    </div>
                  </button>

                  {/* Archetype 2: Bhiwandi 3PL Hub */}
                  <button
                    onClick={() => applyArchetype("BHIWANDI_3PL")}
                    style={{
                      padding: "10px 12px",
                      background: selectedArchetype === "BHIWANDI_3PL" ? "#EFF6FF" : "#F8FAFC",
                      border: selectedArchetype === "BHIWANDI_3PL" ? "2px solid #3B82F6" : "1px solid #E2E8F0",
                      borderRadius: "10px",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A" }}>
                        📦 Bhiwandi Regional E-Commerce 3PL Hub
                      </span>
                      <span style={{ fontSize: "9px", fontWeight: 800, color: "#1D4ED8", background: "#DBEAFE", padding: "1px 6px", borderRadius: "4px" }}>
                        TIER-1 3PL
                      </span>
                    </div>
                    <div style={{ fontSize: "10px", color: "#64748B", marginTop: "2px" }}>
                      25,000 sq ft (60m × 40m) · 12–16 AMRs · 4-Tier High Rack
                    </div>
                    <div
                      style={{
                        marginTop: "5px",
                        fontSize: "9px",
                        fontWeight: 700,
                        color: "#1E40AF",
                        background: "#DBEAFE",
                        padding: "3px 6px",
                        borderRadius: "5px",
                        lineHeight: 1.3,
                        border: "1px solid #BFDBFE",
                      }}
                    >
                      Priors: Avg Basket: 6.5 items | Target SLA: Same-Day | SKU Pareto: Top 15% = 70% picks | Grid Load: 45 kW
                    </div>
                  </button>

                  {/* Archetype 3: Peenya MSME Depot */}
                  <button
                    onClick={() => applyArchetype("PEENYA_MSME")}
                    style={{
                      padding: "10px 12px",
                      background: selectedArchetype === "PEENYA_MSME" ? "#F0FDF4" : "#F8FAFC",
                      border: selectedArchetype === "PEENYA_MSME" ? "2px solid #16A34A" : "1px solid #E2E8F0",
                      borderRadius: "10px",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A" }}>
                        ⚙️ Peenya MSME Auto-Components Depot
                      </span>
                      <span style={{ fontSize: "9px", fontWeight: 800, color: "#166534", background: "#DCFCE7", padding: "1px 6px", borderRadius: "4px" }}>
                        MSME SHED
                      </span>
                    </div>
                    <div style={{ fontSize: "10px", color: "#64748B", marginTop: "2px" }}>
                      10,000 sq ft (35m × 25m) · 6 Heavy AMRs · Hybrid Aisles
                    </div>
                    <div
                      style={{
                        marginTop: "5px",
                        fontSize: "9px",
                        fontWeight: 700,
                        color: "#166534",
                        background: "#DCFCE7",
                        padding: "3px 6px",
                        borderRadius: "5px",
                        lineHeight: 1.3,
                        border: "1px solid #BBF7D0",
                      }}
                    >
                      Priors: Avg Basket: 1.4 heavy cartons (35kg) | Hybrid Forklift + AMR | Grid Load: 28 kW
                    </div>
                  </button>
                </div>
              </div>

              {/* Width Slider */}
              <div style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>
                  <span style={{ color: "#334155" }}>Warehouse Width (East-West)</span>
                  <span style={{ color: "#0F172A", background: "#F1F5F9", padding: "1px 6px", borderRadius: "4px" }}>{widthM} meters</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="80"
                  step="2"
                  value={widthM}
                  onChange={(e) => setWidthM(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#F8CB46", cursor: "pointer" }}
                />
              </div>

              {/* Depth Slider */}
              <div style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>
                  <span style={{ color: "#334155" }}>Warehouse Depth (North-South)</span>
                  <span style={{ color: "#0F172A", background: "#F1F5F9", padding: "1px 6px", borderRadius: "4px" }}>{depthM} meters</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="60"
                  step="2"
                  value={depthM}
                  onChange={(e) => setDepthM(Number(e.target.value))}
                  style={{ width: "100%", accentColor: "#F8CB46", cursor: "pointer" }}
                />
              </div>

              {/* Material Flow Type Selector */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
                <button
                  onClick={() => setFlowType("I_FLOW")}
                  style={{
                    padding: "10px",
                    borderRadius: "10px",
                    border: flowType === "I_FLOW" ? "2px solid #3B82F6" : "1px solid #E2E8F0",
                    background: flowType === "I_FLOW" ? "#EFF6FF" : "#F8FAFC",
                    color: flowType === "I_FLOW" ? "#1D4ED8" : "#475569",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 800 }}>Through-Flow (I)</div>
                  <div style={{ fontSize: "10px", opacity: 0.8, marginTop: "2px" }}>West Inbound ➔ East Dispatch</div>
                </button>

                <button
                  onClick={() => setFlowType("U_FLOW")}
                  style={{
                    padding: "10px",
                    borderRadius: "10px",
                    border: flowType === "U_FLOW" ? "2px solid #3B82F6" : "1px solid #E2E8F0",
                    background: flowType === "U_FLOW" ? "#EFF6FF" : "#F8FAFC",
                    color: flowType === "U_FLOW" ? "#1D4ED8" : "#475569",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ fontSize: "12px", fontWeight: 800 }}>Same-Side Dock (U)</div>
                  <div style={{ fontSize: "10px", opacity: 0.8, marginTop: "2px" }}>NW Inbound ➔ SW Dispatch</div>
                </button>
              </div>

              {/* Vertical Rack Tiers */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#334155" }}>Vertical Rack Tiers</span>
                <div style={{ display: "flex", gap: "4px" }}>
                  {([2, 3, 4] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTierCount(t)}
                      style={{
                        padding: "3px 10px",
                        borderRadius: "6px",
                        border: tierCount === t ? "1.5px solid #0F172A" : "1px solid #CBD5E1",
                        background: tierCount === t ? "#0F172A" : "#FFFFFF",
                        color: tierCount === t ? "#FFFFFF" : "#475569",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {t} Tiers
                    </button>
                  ))}
                </div>
              </div>

              {/* Operational & Order Profile Priors Strip */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1.5px solid #CBD5E1",
                  borderRadius: "10px",
                  padding: "12px",
                  marginTop: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#0F172A" }}>
                    🎯 Operational & Order Profile Priors
                  </span>
                  <span style={{ fontSize: "9px", fontWeight: 800, color: "#64748B", background: "#E2E8F0", padding: "2px 6px", borderRadius: "4px" }}>
                    {targetSlaText}
                  </span>
                </div>

                {/* Prior 1: Basket Size */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontWeight: 700, color: "#475569", marginBottom: "2px" }}>
                    <span>Avg Basket Size (Items/Order)</span>
                    <span style={{ color: "#0F172A", fontWeight: 800 }}>{avgBasketSize.toFixed(1)} items</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    step="0.5"
                    value={avgBasketSize}
                    onChange={(e) => setAvgBasketSize(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#F59E0B" }}
                  />
                </div>

                {/* Prior 2: SKU Pareto Concentration */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontWeight: 700, color: "#475569", marginBottom: "2px" }}>
                    <span>SKU Velocity Pareto Skew</span>
                    <span style={{ color: "#0F172A", fontWeight: 800 }}>Top 15% = {skuParetoPct}% volume</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="90"
                    step="5"
                    value={skuParetoPct}
                    onChange={(e) => setSkuParetoPct(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#3B82F6" }}
                  />
                </div>

                {/* Prior 3: Max Transformer Power Limit */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontWeight: 700, color: "#475569", marginBottom: "2px" }}>
                    <span>Max Transformer Power Limit (kW)</span>
                    <span style={{ color: "#0F172A", fontWeight: 800 }}>{gridPowerLimitKw} kW limit</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="2"
                    value={gridPowerLimitKw}
                    onChange={(e) => setGridPowerLimitKw(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#10B981" }}
                  />
                </div>
              </div>
            </div>

            {/* 3. AI Auto-Zoner Action Button */}
            <div>
              <button
                onClick={handleRunAutoZoner}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "12px",
                  border: "none",
                  background: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
                  color: "#FFFFFF",
                  fontSize: "13px",
                  fontWeight: 900,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  boxShadow: "0 6px 18px rgba(37, 99, 235, 0.3)",
                  transition: "all 0.15s ease",
                }}
              >
                <span>✨</span> AI Auto-Divide Warehouse Sections
              </button>
            </div>

            {/* 4. Live Operational Sizing Card */}
            {activeLayout && (
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px",
                  padding: "14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E2E8F0", paddingBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>
                    Operational Sizing Model
                  </span>
                  <span style={{ fontSize: "10px", fontWeight: 800, color: "#059669", background: "#ECFDF5", padding: "2px 6px", borderRadius: "4px" }}>
                    OPTIMIZED
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px" }}>
                  <div>
                    <span style={{ color: "#64748B", display: "block" }}>Storage Capacity:</span>
                    <b style={{ color: "#0F172A", fontSize: "12px" }}>
                      {activeLayout.summary.totalStorageCapacityBins.toLocaleString()} Bins
                    </b>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", display: "block" }}>Storage Racks:</span>
                    <b style={{ color: "#0F172A", fontSize: "12px" }}>{activeLayout.summary.rackCount} Units</b>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", display: "block" }}>EV Charging Docks:</span>
                    <b style={{ color: "#0C831F", fontSize: "12px" }}>{activeLayout.summary.autoPlacedChargingDocks} Pads</b>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", display: "block" }}>Recommended Fleet:</span>
                    <b style={{ color: "#2563EB", fontSize: "12px" }}>{activeLayout.summary.recommendedFleetSize} Bots</b>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", display: "block" }}>Est. Throughput:</span>
                    <b style={{ color: "#D97706", fontSize: "12px" }}>{activeLayout.summary.estimatedThroughputPerHour} orders/hr</b>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", display: "block" }}>Floor Density:</span>
                    <b style={{ color: "#0F172A", fontSize: "12px" }}>
                      {Math.round((widthM * depthM) / (activeLayout.summary.recommendedFleetSize || 1))} m²/AMR
                    </b>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", display: "block" }}>Order Profile:</span>
                    <b style={{ color: "#0F172A", fontSize: "11px" }}>
                      {avgBasketSize.toFixed(1)} items · {skuParetoPct}% Pareto
                    </b>
                  </div>
                  <div>
                    <span style={{ color: "#64748B", display: "block" }}>Grid Power Draw:</span>
                    <b style={{ color: (activeLayout.summary.recommendedFleetSize * 2.2) > gridPowerLimitKw ? "#DC2626" : "#0C831F", fontSize: "11px" }}>
                      {(activeLayout.summary.recommendedFleetSize * 2.2).toFixed(1)} kW / {gridPowerLimitKw} kW
                    </b>
                  </div>
                </div>

                {activeLayout.summary.fleetSizing && (
                  <div
                    style={{
                      marginTop: "6px",
                      padding: "8px 10px",
                      background: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                      borderRadius: "8px",
                      fontSize: "11px",
                      lineHeight: "1.4",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                      <span style={{ fontWeight: 800, color: "#1E40AF" }}>
                        📐 Auto-Sizing Engine:
                      </span>
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: 800,
                          background: "#DBEAFE",
                          color: "#1E3A8A",
                          padding: "1px 5px",
                          borderRadius: "4px",
                        }}
                      >
                        {activeLayout.summary.fleetSizing.categoryLabel}
                      </span>
                    </div>
                    <div style={{ color: "#1D4ED8" }}>
                      {activeLayout.summary.fleetSizing.rationale}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════
              RIGHT PANEL: Interactive 2D Blueprint & Zone Painter
             ════════════════════════════════════════════════════════ */}
          <div
            style={{
              flex: 1,
              background: "#F1F5F9",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Zone Paint Toolbar */}
            <div
              style={{
                padding: "10px 16px",
                background: "#FFFFFF",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", marginRight: "4px" }}>
                  Zone Brush:
                </span>
                {BRUSHES.map((b) => {
                  const isSelected = activeBrush === b.id;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setActiveBrush(b.id)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "8px",
                        border: isSelected ? "2px solid #0F172A" : "1px solid #E2E8F0",
                        background: isSelected ? "#0F172A" : "#FFFFFF",
                        color: isSelected ? "#FFFFFF" : "#334155",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "5px",
                        transition: "all 0.12s ease",
                      }}
                      title={b.desc}
                    >
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: b.color }} />
                      <span>{b.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Zoom & Reset Toolbar Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {/* Canvas Zoom Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#F1F5F9", padding: "2px 6px", borderRadius: "8px", border: "1px solid #CBD5E1" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748B" }}>Zoom:</span>
                  {(["100", "75", "fit"] as const).map((z) => (
                    <button
                      key={z}
                      onClick={() => setZoomLevel(z)}
                      style={{
                        padding: "3px 8px",
                        borderRadius: "5px",
                        border: zoomLevel === z ? "1px solid #0F172A" : "none",
                        background: zoomLevel === z ? "#0F172A" : "transparent",
                        color: zoomLevel === z ? "#FFFFFF" : "#64748B",
                        fontSize: "10px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {z === "fit" ? "Fit" : `${z}%`}
                    </button>
                  ))}
                </div>

                {/* Reset / Clear Button */}
                <button
                  onClick={() => setCustomPaints({})}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#F8FAFC",
                    color: "#64748B",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Reset Custom Edits
                </button>
              </div>
            </div>

            {/* Interactive 2D Blueprint Canvas Viewport */}
            <div
              style={{
                flex: 1,
                overflow: "auto",
                padding: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                userSelect: "none",
              }}
              onMouseUp={() => setIsMouseDown(false)}
            >
              <div
                style={{
                  position: "relative",
                  width: `${widthM * 16}px`,
                  height: `${depthM * 16}px`,
                  background: "#FFFFFF",
                  borderRadius: "12px",
                  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.12)",
                  overflow: "hidden",
                  cursor: "crosshair",
                  transform: `scale(${zoomLevel === "fit" ? Math.min(1, 680 / (widthM * 16), 460 / (depthM * 16)).toFixed(2) : zoomLevel === "75" ? "0.75" : "1"})`,
                  transformOrigin: "center center",
                  transition: "transform 0.15s ease",
                }}
                onMouseDown={() => setIsMouseDown(true)}
              >
                {/* 1. Underlying Blueprint Image (Opacity: 0.35) */}
                {blueprintUrl && (
                  <img
                    src={blueprintUrl}
                    alt="Blueprint"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "fill",
                      opacity: 0.35,
                      pointerEvents: "none",
                    }}
                  />
                )}

                {/* 2. Interactive SVG 2D Grid with Color-Coded Cells */}
                <svg
                  width={widthM * 16}
                  height={depthM * 16}
                  style={{ position: "absolute", inset: 0, background: "#0A2540" }}
                  onMouseLeave={() => setHoverCoord(null)}
                >
                  {/* Subtle Blueprint Grid Lines */}
                  <defs>
                    <pattern id="gridPattern" width="16" height="16" patternUnits="userSpaceOnUse">
                      <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(56, 189, 248, 0.22)" strokeWidth="0.5" />
                    </pattern>
                    <pattern id="majorGridPattern" width="80" height="80" patternUnits="userSpaceOnUse">
                      <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(56, 189, 248, 0.55)" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#gridPattern)" />
                  <rect width="100%" height="100%" fill="url(#majorGridPattern)" />

                  {/* Outer Perimeter Walls */}
                  <rect
                    x="2"
                    y="2"
                    width={widthM * 16 - 4}
                    height={depthM * 16 - 4}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                  />

                  {/* Render Detected Pillars from Blueprint Wall Detector */}
                  {detectedPillars.map(([c, r], pIdx) => (
                    <g key={"pillar-" + pIdx}>
                      <rect
                        x={c * 16}
                        y={r * 16}
                        width="16"
                        height="16"
                        fill="#334155"
                        stroke="#60A5FA"
                        strokeWidth="1"
                      />
                      <line x1={c * 16} y1={r * 16} x2={c * 16 + 16} y2={r * 16 + 16} stroke="#60A5FA" strokeWidth="0.75" />
                      <line x1={c * 16 + 16} y1={r * 16} x2={c * 16} y2={r * 16 + 16} stroke="#60A5FA" strokeWidth="0.75" />
                    </g>
                  ))}

                  {/* Render 5 Functional Operational Zones */}
                  {activeLayout &&
                    Object.values(activeLayout.zones).map((z) => {
                      const [x0, z0, x1, z1] = z.bounds;
                      return (
                        <g key={z.id}>
                          <rect
                            x={x0 * 16}
                            y={z0 * 16}
                            width={(x1 - x0 + 1) * 16}
                            height={(z1 - z0 + 1) * 16}
                            fill={z.color}
                            fillOpacity="0.1"
                            stroke="#38BDF8"
                            strokeWidth="2"
                            strokeDasharray="4 2"
                            rx="4"
                          />
                          <text
                            x={x0 * 16 + 8}
                            y={z0 * 16 + 18}
                            fill="#38BDF8"
                            fontSize="11"
                            fontWeight="800"
                            fontFamily="'JetBrains Mono', monospace"
                            opacity="0.95"
                          >
                            [ {z.name.toUpperCase()} ]
                          </text>
                        </g>
                      );
                    })}

                  {/* Render Auto-Zoned Elements & Racks */}
                  {activeLayout && (
                    <>
                      {/* Racks */}
                      {Object.values(activeLayout.locations)
                        .filter((l) => {
                          if (l.type !== "SHELF") return false;
                          const c = Math.floor(l.coords[0]);
                          const r = Math.floor(l.coords[1]);
                          return !customPaints[`${c},${r}`] && !customPaints[`${c - 1},${r}`];
                        })
                        .map((shelf) => (
                          <g key={shelf.id}>
                            <rect
                              x={(shelf.coords[0] - 1.0) * 16}
                              y={(shelf.coords[1] - 1.0) * 16}
                              width="32"
                              height="16"
                              fill="#0F2B48"
                              stroke="#FFFFFF"
                              strokeWidth="1.2"
                              rx="2"
                            />
                            <line
                              x1={(shelf.coords[0] - 1.0) * 16}
                              y1={(shelf.coords[1] - 0.5) * 16}
                              x2={(shelf.coords[0] + 1.0) * 16}
                              y2={(shelf.coords[1] - 0.5) * 16}
                              stroke="#F8CB46"
                              strokeWidth="0.8"
                            />
                            <line
                              x1={(shelf.coords[0] - 1.0) * 16}
                              y1={(shelf.coords[1] + 0.5) * 16}
                              x2={(shelf.coords[0] + 1.0) * 16}
                              y2={(shelf.coords[1] + 0.5) * 16}
                              stroke="#F8CB46"
                              strokeWidth="0.8"
                            />
                          </g>
                        ))}

                      {/* Inbound Docks */}
                      {Object.values(activeLayout.locations)
                        .filter((l) => {
                          if (l.type !== "INBOUND_DOCK") return false;
                          const c = Math.floor(l.coords[0]);
                          const r = Math.floor(l.coords[1]);
                          return !customPaints[`${c},${r}`];
                        })
                        .map((dock) => (
                          <rect
                            key={dock.id}
                            x={(dock.coords[0] - 1.2) * 16}
                            y={(dock.coords[1] - 1.2) * 16}
                            width="28"
                            height="28"
                            fill="#8B5CF6"
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                            rx="4"
                          />
                        ))}

                      {/* Packing Stations */}
                      {Object.values(activeLayout.locations)
                        .filter((l) => {
                          if (l.type !== "PACK_STATION") return false;
                          const c = Math.floor(l.coords[0]);
                          const r = Math.floor(l.coords[1]);
                          return !customPaints[`${c},${r}`];
                        })
                        .map((pack) => (
                          <rect
                            key={pack.id}
                            x={(pack.coords[0] - 1.2) * 16}
                            y={(pack.coords[1] - 1.2) * 16}
                            width="36"
                            height="24"
                            fill="#F59E0B"
                            stroke="#FFFFFF"
                            strokeWidth="1.5"
                            rx="3"
                          />
                        ))}

                      {/* EV Chargers */}
                      {Object.values(activeLayout.chargingDocks)
                        .filter((chg) => {
                          const c = Math.floor(chg.coords[0]);
                          const r = Math.floor(chg.coords[1]);
                          return !customPaints[`${c},${r}`];
                        })
                        .map((chg) => (
                          <g key={chg.id}>
                            <circle
                              cx={chg.coords[0] * 16}
                              cy={chg.coords[1] * 16}
                              r="9"
                              fill="#064E3B"
                              stroke="#34D399"
                              strokeWidth="1.5"
                            />
                            <text
                              x={chg.coords[0] * 16}
                              y={chg.coords[1] * 16 + 4}
                              fill="#34D399"
                              fontSize="9"
                              fontWeight="900"
                              textAnchor="middle"
                            >
                              ⚡
                            </text>
                          </g>
                        ))}

                      {/* Conveyors */}
                      {activeLayout.conveyors.map((conv) => (
                        <line
                          key={conv.id}
                          x1={conv.startCoords[0] * 16}
                          y1={conv.startCoords[1] * 16}
                          x2={conv.endCoords[0] * 16}
                          y2={conv.endCoords[1] * 16}
                          stroke="#38BDF8"
                          strokeWidth="6"
                          strokeDasharray="4 2"
                        />
                      ))}
                    </>
                  )}

                  {/* Render Manual Custom Paints */}
                  {Object.entries(customPaints).map(([coord, brush]) => {
                    const [c, r] = coord.split(",").map(Number);
                    if (brush === "ERASER") {
                      return (
                        <g key={coord}>
                          <rect
                            x={c * 16}
                            y={r * 16}
                            width="16"
                            height="16"
                            fill="#0A2540"
                            stroke="#38BDF8"
                            strokeWidth="0.5"
                            strokeDasharray="2 2"
                            opacity="0.9"
                          />
                        </g>
                      );
                    }
                    const brushDef = BRUSHES.find((b) => b.id === brush);
                    if (!brushDef) return null;
                    return (
                      <g key={coord}>
                        <rect
                          x={c * 16}
                          y={r * 16}
                          width="16"
                          height="16"
                          fill={brushDef.color}
                          stroke="#FFFFFF"
                          strokeWidth="0.8"
                          opacity="0.9"
                        />
                        <text
                          x={c * 16 + 8}
                          y={r * 16 + 11}
                          fontSize="8"
                          textAnchor="middle"
                        >
                          {brushDef.icon}
                        </text>
                      </g>
                    );
                  })}

                  {/* Hover Cell Highlight */}
                  {hoverCoord && (
                    <rect
                      x={hoverCoord[0] * 16}
                      y={hoverCoord[1] * 16}
                      width="16"
                      height="16"
                      fill="rgba(56, 189, 248, 0.4)"
                      stroke="#00FFFF"
                      strokeWidth="2"
                    />
                  )}
                </svg>

                {/* Mouse Interaction Layer for Drag/Click Painting */}
                <div
                  style={{ position: "absolute", inset: 0 }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const scale = zoomLevel === "fit" ? Math.min(1, 680 / (widthM * 16), 460 / (depthM * 16)) : zoomLevel === "75" ? 0.75 : 1.0;
                    const c = Math.floor((e.clientX - rect.left) / (16 * scale));
                    const r = Math.floor((e.clientY - rect.top) / (16 * scale));
                    if (c >= 0 && c < widthM && r >= 0 && r < depthM) {
                      setHoverCoord([c, r]);
                      if (isMouseDown || e.buttons === 1) paintCell(c, r);
                    }
                  }}
                  onMouseDown={(e) => {
                    setIsMouseDown(true);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const scale = zoomLevel === "fit" ? Math.min(1, 680 / (widthM * 16), 460 / (depthM * 16)) : zoomLevel === "75" ? 0.75 : 1.0;
                    const c = Math.floor((e.clientX - rect.left) / (16 * scale));
                    const r = Math.floor((e.clientY - rect.top) / (16 * scale));
                    if (c >= 0 && c < widthM && r >= 0 && r < depthM) {
                      paintCell(c, r);
                    }
                  }}
                />
              </div>
            </div>

            {/* Bottom Footer Action Bar */}
            <footer
              style={{
                padding: "14px 24px",
                background: "#FFFFFF",
                borderTop: "1px solid #E2E8F0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "14px", fontSize: "12px", color: "#64748B" }}>
                <span>
                  Grid: <b>{widthM}m x {depthM}m</b> ({widthM * depthM} sq m)
                </span>
                <span>•</span>
                <span>
                  Active Flow: <b>{flowType === "I_FLOW" ? "Through-Flow (I)" : "Same-Side (U)"}</b>
                </span>
                {hoverCoord && (
                  <>
                    <span>•</span>
                    <span style={{ color: "#2563EB", fontWeight: 700 }}>
                      Cursor: [{hoverCoord[0]}m, {hoverCoord[1]}m]
                    </span>
                  </>
                )}
              </div>

              {/* Generate 3D Twin CTA Button */}
              <button
                onClick={handleGenerate3DTwin}
                style={{
                  background: "#F8CB46",
                  color: "#1C1C1C",
                  fontWeight: 900,
                  fontSize: "14px",
                  padding: "12px 28px",
                  borderRadius: "12px",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 8px 24px rgba(248, 203, 70, 0.45)",
                  transition: "all 0.18s ease-in-out",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                <span>🚀</span>
                <span>Generate 3D Digital Twin</span>
              </button>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WarehouseBuilderModal;
