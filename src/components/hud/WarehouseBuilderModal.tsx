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
  const isBuilderModalOpen = useTwinStore((s) => s.isBuilderModalOpen);
  const closeBuilderModal = useTwinStore((s) => s.closeBuilderModal);
  const applyCustomLayout = useTwinStore((s) => s.applyCustomLayout);

  // Layout parameters
  const [widthM, setWidthM] = useState(60);
  const [depthM, setDepthM] = useState(40);
  const [flowType, setFlowType] = useState<FlowType>("I_FLOW");
  const [tierCount, setTierCount] = useState<2 | 3 | 4>(4);

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

  // Interactive 2D Canvas cell painting
  const paintCell = (col: number, row: number) => {
    if (col < 1 || col >= widthM - 1 || row < 1 || row >= depthM - 1) return;
    const key = `${col},${row}`;
    setCustomPaints((prev) => {
      if (activeBrush === "ERASER") {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: activeBrush };
    });
  };

  // Commit layout & generate 3D Twin
  const handleGenerate3DTwin = () => {
    if (!activeLayout) return;

    // Apply any manual custom paints into navgrid
    const finalGrid = { ...activeLayout.navGrid, cells: new Uint8Array(activeLayout.navGrid.cells) };
    Object.entries(customPaints).forEach(([coord, brush]) => {
      const [c, r] = coord.split(",").map(Number);
      if (brush === "PILLAR" || brush === "STORAGE" || brush === "CONVEYOR") {
        finalGrid.cells[r * finalGrid.cols + c] = 1;
      } else if (brush === "ERASER") {
        finalGrid.cells[r * finalGrid.cols + c] = 0;
      }
    });

    applyCustomLayout(
      {
        ...activeLayout,
        navGrid: finalGrid,
      },
      blueprintUrl
    );
  };

  if (!isBuilderModalOpen) return null;

  return (
    <div
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

              {/* Width Slider */}
              <div style={{ marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>
                  <span style={{ color: "#334155" }}>Warehouse Width (East-West)</span>
                  <span style={{ color: "#0F172A", background: "#F1F5F9", padding: "1px 6px", borderRadius: "4px" }}>{widthM} meters</span>
                </div>
                <input
                  type="range"
                  min="20"
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
                  min="20"
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
                    <span style={{ color: "#64748B", display: "block" }}>Aisle Clearance:</span>
                    <b style={{ color: "#0F172A", fontSize: "12px" }}>2.0 m (Anti-Deadlock)</b>
                  </div>
                </div>
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
                  style={{ position: "absolute", inset: 0 }}
                  onMouseLeave={() => setHoverCoord(null)}
                >
                  {/* Subtle Grid Lines */}
                  <defs>
                    <pattern id="gridPattern" width="16" height="16" patternUnits="userSpaceOnUse">
                      <path d="M 16 0 L 0 0 0 16" fill="none" stroke="rgba(148, 163, 184, 0.25)" strokeWidth="0.5" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#gridPattern)" />

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
                            fillOpacity="0.12"
                            stroke={z.color}
                            strokeWidth="2"
                            strokeDasharray="4 2"
                            rx="4"
                          />
                          <text
                            x={x0 * 16 + 8}
                            y={z0 * 16 + 18}
                            fill={z.color}
                            fontSize="11"
                            fontWeight="800"
                            fontFamily="'Inter', sans-serif"
                            opacity="0.9"
                          >
                            {z.name.toUpperCase()}
                          </text>
                        </g>
                      );
                    })}

                  {/* Render Auto-Zoned Elements & Racks */}
                  {activeLayout && (
                    <>
                      {/* Racks */}
                      {Object.values(activeLayout.locations)
                        .filter((l) => l.type === "SHELF")
                        .map((shelf) => (
                          <rect
                            key={shelf.id}
                            x={(shelf.coords[0] - 1.0) * 16}
                            y={(shelf.coords[1] - 1.0) * 16}
                            width="32"
                            height="16"
                            fill="#F8CB46"
                            stroke="#D97706"
                            strokeWidth="1"
                            rx="2"
                          />
                        ))}

                      {/* Inbound Docks */}
                      {Object.values(activeLayout.locations)
                        .filter((l) => l.type === "INBOUND_DOCK")
                        .map((dock) => (
                          <rect
                            key={dock.id}
                            x={(dock.coords[0] - 1.2) * 16}
                            y={(dock.coords[1] - 1.2) * 16}
                            width="28"
                            height="28"
                            fill="#8B5CF6"
                            stroke="#6D28D9"
                            strokeWidth="1.5"
                            rx="4"
                          />
                        ))}

                      {/* Packing Stations */}
                      {Object.values(activeLayout.locations)
                        .filter((l) => l.type === "PACK_STATION")
                        .map((pack) => (
                          <rect
                            key={pack.id}
                            x={(pack.coords[0] - 1.2) * 16}
                            y={(pack.coords[1] - 1.2) * 16}
                            width="36"
                            height="24"
                            fill="#F59E0B"
                            stroke="#B45309"
                            strokeWidth="1.5"
                            rx="3"
                          />
                        ))}

                      {/* EV Chargers */}
                      {Object.values(activeLayout.chargingDocks).map((chg) => (
                        <circle
                          key={chg.id}
                          cx={chg.coords[0] * 16}
                          cy={chg.coords[1] * 16}
                          r="7"
                          fill="#0C831F"
                          stroke="#FFFFFF"
                          strokeWidth="1"
                        />
                      ))}

                      {/* Conveyors */}
                      {activeLayout.conveyors.map((conv) => (
                        <line
                          key={conv.id}
                          x1={conv.startCoords[0] * 16}
                          y1={conv.startCoords[1] * 16}
                          x2={conv.endCoords[0] * 16}
                          y2={conv.endCoords[1] * 16}
                          stroke="#1C1C1C"
                          strokeWidth="6"
                          strokeDasharray="4 2"
                        />
                      ))}
                    </>
                  )}

                  {/* Render Manual Custom Paints */}
                  {Object.entries(customPaints).map(([coord, brush]) => {
                    const [c, r] = coord.split(",").map(Number);
                    const brushDef = BRUSHES.find((b) => b.id === brush);
                    if (!brushDef) return null;
                    return (
                      <rect
                        key={coord}
                        x={c * 16}
                        y={r * 16}
                        width="16"
                        height="16"
                        fill={brushDef.color}
                        stroke="#0F172A"
                        strokeWidth="0.5"
                        opacity="0.85"
                      />
                    );
                  })}

                  {/* Hover Cell Highlight */}
                  {hoverCoord && (
                    <rect
                      x={hoverCoord[0] * 16}
                      y={hoverCoord[1] * 16}
                      width="16"
                      height="16"
                      fill="rgba(59, 130, 246, 0.35)"
                      stroke="#2563EB"
                      strokeWidth="1.5"
                    />
                  )}
                </svg>

                {/* Mouse Interaction Layer for Drag/Click Painting */}
                <div
                  style={{ position: "absolute", inset: 0 }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const c = Math.floor((e.clientX - rect.left) / 16);
                    const r = Math.floor((e.clientY - rect.top) / 16);
                    if (c >= 0 && c < widthM && r >= 0 && r < depthM) {
                      setHoverCoord([c, r]);
                      if (isMouseDown) paintCell(c, r);
                    }
                  }}
                  onMouseDown={(e) => {
                    setIsMouseDown(true);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const c = Math.floor((e.clientX - rect.left) / 16);
                    const r = Math.floor((e.clientY - rect.top) / 16);
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
