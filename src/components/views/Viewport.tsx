/**
 * NexusTwin Viewport Component (SCADA Design System)
 *
 * Primary 3D WebGL Digital Twin & 2D CAD Viewport with floating SCADA overlays:
 * - Top-left: 3D / 2D CAD toggle and Floor selector (G / M1 / L2)
 * - Top-right: Camera views dropdown (Full facility, Isometric, Top-down, Robot POV, Packing zoom)
 * - Toolbar: Select, Pan, Ruler, A* Paths layer toggle, Labels & LiDAR cones toggle
 * - Bottom test bar: Chaos & operational injection (Surge, Obstacle, Breakdown, VIP, Heatmap, Re-slot)
 * - Bottom-right: Telemetry legend and discrete frame latency display
 */

import React, { useState } from "react";
import { useTwinStore } from "../../store/useTwinStore";
import { FacilityCanvas } from "../canvas/FacilityCanvas";
import { MapView2D } from "./MapView2D";
import { InspectorDock } from "../hud/InspectorDock";

export function Viewport() {
  const viewTab = useTwinStore((s) => s.viewTab);
  const setViewTab = useTwinStore((s) => s.setViewTab);
  const showPaths = useTwinStore((s) => s.showPaths);
  const showLabels = useTwinStore((s) => s.showLabels);
  const togglePaths = useTwinStore((s) => s.togglePaths);
  const toggleLabels = useTwinStore((s) => s.toggleLabels);
  const activeFloor = useTwinStore((s) => s.activeFloor);
  const setActiveFloor = useTwinStore((s) => s.setActiveFloor);
  const activeCamera = useTwinStore((s) => s.activeCamera);
  const setActiveCamera = useTwinStore((s) => s.setActiveCamera);
  const selectBot = useTwinStore((s) => s.selectBot);
  const setFocusTarget = useTwinStore((s) => s.setFocusTarget);
  const botUnits = useTwinStore((s) => s.botUnits);
  const isFestiveSurgeActive = useTwinStore((s) => s.isFestiveSurgeActive);
  const surgeMultiplier = useTwinStore((s) => s.surgeMultiplier);
  const injectFestiveSurge = useTwinStore((s) => s.injectFestiveSurge);
  const injectVipOrder = useTwinStore((s) => s.injectVipOrder);
  const injectAisleBlockage = useTwinStore((s) => s.injectAisleBlockage);
  const injectBotFailure = useTwinStore((s) => s.injectBotFailure);
  const defragmentRacks = useTwinStore((s) => s.defragmentRacks);
  const clearInjections = useTwinStore((s) => s.clearInjections);
  const selectedBotId = useTwinStore((s) => s.selectedBotId);
  const selectedRackId = useTwinStore((s) => s.selectedRackId);
  const selectedStationId = useTwinStore((s) => s.selectedStationId);
  const isInspOpen = Boolean(selectedBotId || selectedRackId || selectedStationId);

  const activeTool = useTwinStore((s) => s.activeTool);
  const setActiveTool = useTwinStore((s) => s.setActiveTool);
  const storeHeatmapMode = useTwinStore((s) => s.heatmapMode);
  const toggleHeatmapMode = useTwinStore((s) => s.toggleHeatmapMode);

  const [showCamMenu, setShowCamMenu] = useState(false);

  const totalBots = Object.keys(botUnits).length;

  const handleCameraSelect = (cam: "full" | "iso" | "top" | "robot" | "pack") => {
    setShowCamMenu(false);
    if (cam === "robot") {
      const activeBot = Object.values(botUnits).find((b) => b.status === "ACTIVE") || Object.values(botUnits)[0];
      if (activeBot) selectBot(activeBot.id);
    } else {
      selectBot(null);
    }

    if (activeCamera === cam) {
      setActiveCamera("custom");
      setTimeout(() => setActiveCamera(cam), 16);
    } else {
      setActiveCamera(cam);
    }
  };

  const handleChaosMode = (mode: string) => {
    if (mode === "surge") {
      injectFestiveSurge(25, 3.2);
    } else if (mode === "obstacle") {
      injectAisleBlockage("ZONE_A", 45);
    } else if (mode === "fault") {
      const activeBot = Object.values(botUnits).find((b) => b.status === "ACTIVE");
      if (activeBot) injectBotFailure(activeBot.id);
    } else if (mode === "vip") {
      injectVipOrder();
    } else if (mode === "heat") {
      toggleHeatmapMode();
    } else if (mode === "slot") {
      defragmentRacks();
    }
  };

  return (
    <div className={`vp ${isInspOpen ? "insp-open" : ""}`} id="vp">
      {/* Primary 3D Canvas or 2D Map */}
      {viewTab === "3D" ? (
        <FacilityCanvas style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }} />
      ) : (
        <MapView2D mode={viewTab} />
      )}

      {/* Diwali Festive Surge Banner */}
      {isFestiveSurgeActive && (
        <div className="surge-banner" style={{ display: "flex" }}>
          <svg width="14" height="14">
            <use href="#i-bolt" />
          </svg>
          DIWALI SURGE <b>×{surgeMultiplier || 3.2}</b>
          <button
            onClick={clearInjections}
            style={{
              marginLeft: "10px",
              background: "transparent",
              border: "none",
              color: "#FFFFFF",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Active Measurement Ruler Overlay */}
      {activeTool === "ruler" && (
        <div
          style={{
            position: "absolute",
            top: "56px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15, 23, 42, 0.88)",
            color: "#F8FAFC",
            backdropFilter: "blur(8px)",
            padding: "6px 16px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 30,
            pointerEvents: "auto",
          }}
        >
          <span>📐 <b>Facility Scale</b>: 60.0m × 40.0m (2,400 m²)</span>
          <span style={{ color: "#94A3B8" }}>|</span>
          <span><b>Aisle Clearance</b>: 2.40m</span>
          <span style={{ color: "#94A3B8" }}>|</span>
          <span><b>Rack Pitch</b>: 1.20m</span>
          <button
            onClick={() => setActiveTool("sel")}
            style={{
              background: "transparent",
              border: "none",
              color: "#94A3B8",
              cursor: "pointer",
              marginLeft: "6px",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top-Left: View mode + Floor selector */}
      <div className="float f-view" id="viewSw">
        <button className={viewTab === "3D" ? "on" : ""} onClick={() => setViewTab("3D")}>
          <svg>
            <use href="#i-cube" />
          </svg>
          3D
        </button>
        <button className={viewTab === "MAP" ? "on" : ""} onClick={() => setViewTab("MAP")}>
          <svg>
            <use href="#i-plan" />
          </svg>
          2D CAD
        </button>
      </div>

      <div className="float f-floor" id="floorSw">
        <button className={activeFloor === 1 ? "on" : ""} onClick={() => setActiveFloor(1)}>
          G
        </button>
        <button className={activeFloor === 2 ? "on" : ""} onClick={() => setActiveFloor(2)}>
          M1
        </button>
        <button className={activeFloor === "all" ? "on" : ""} onClick={() => setActiveFloor("all")}>
          L2
        </button>
      </div>

      {/* Top-Right: Camera dropdown menu + Toolbar */}
      <div className="f-tr">
        <div className="float" style={{ position: "relative" }}>
          <button id="camBtn" onClick={() => setShowCamMenu(!showCamMenu)}>
            <svg>
              <use href="#i-cam" />
            </svg>
            <span>
              {activeCamera === "top"
                ? "Top-down"
                : activeCamera === "iso"
                ? "Isometric"
                : activeCamera === "full"
                ? "Full facility"
                : activeCamera === "robot"
                ? "Robot POV"
                : activeCamera === "pack"
                ? "Packing zoom"
                : "Isometric"}
            </span> ▾
          </button>
          {showCamMenu && (
            <div className="float cam-menu" style={{ display: "flex", position: "absolute", top: "100%", right: 0, marginTop: "4px" }}>
              <button onClick={() => handleCameraSelect("full")}>Full facility</button>
              <button onClick={() => handleCameraSelect("iso")}>Isometric</button>
              <button onClick={() => handleCameraSelect("top")}>Top‑down</button>
              <button onClick={() => handleCameraSelect("robot")}>Robot POV</button>
              <button onClick={() => handleCameraSelect("pack")}>Packing zoom</button>
            </div>
          )}
        </div>

        <div className="float icons" id="tools">
          <button
            className={activeTool === "sel" ? "on" : ""}
            onClick={() => setActiveTool("sel")}
            title="Inspect"
          >
            <svg>
              <use href="#i-cursor" />
            </svg>
          </button>
          <button
            className={activeTool === "pan" ? "on" : ""}
            onClick={() => setActiveTool(activeTool === "pan" ? "sel" : "pan")}
            title="Pan Mode (Left-Click Drag to Pan 3D View)"
          >
            <svg>
              <use href="#i-hand" />
            </svg>
          </button>
          <button
            className={activeTool === "ruler" ? "on" : ""}
            onClick={() => setActiveTool(activeTool === "ruler" ? "sel" : "ruler")}
            title="Measure Tool (Facility Dimensions & Clearances)"
          >
            <svg>
              <use href="#i-ruler" />
            </svg>
          </button>
          <span className="div"></span>
          <button
            className={`layer ${showPaths ? "on" : ""}`}
            onClick={togglePaths}
            title="Toggle A* navigation paths"
          >
            <svg>
              <use href="#i-path" />
            </svg>
          </button>
          <button
            className={`layer ${showLabels ? "on" : ""}`}
            onClick={toggleLabels}
            title="Sensor labels & LiDAR hazard zones"
          >
            <svg>
              <use href="#i-tag" />
            </svg>
          </button>
        </div>
      </div>

      {/* Bottom-Center: Operational Chaos & Scenario Injection */}
      <div className="inject" id="chaos">
        <span className="ttl">TEST</span>
        <button onClick={() => handleChaosMode("surge")} title="Trigger Diwali Festive 3x Demand Peak">
          <svg>
            <use href="#i-bolt" />
          </svg>
          Surge
        </button>
        <button onClick={() => handleChaosMode("obstacle")} title="Drop Physical Obstacle in Storage Aisle">
          <svg>
            <use href="#i-cone" />
          </svg>
          Obstacle
        </button>
        <button onClick={() => handleChaosMode("fault")} title="Simulate Motor / E-Stop AMR Breakdown">
          <svg>
            <use href="#i-wrench" />
          </svg>
          Breakdown
        </button>
        <button onClick={() => handleChaosMode("vip")} title="Inject 10-Minute Blinkit VIP Order">
          <svg>
            <use href="#i-star" />
          </svg>
          VIP
        </button>
        <span className="div"></span>
        <button
          onClick={() => handleChaosMode("heat")}
          className={storeHeatmapMode ? "on" : ""}
          title="Toggle Dynamic Floor Congestion Heatmap"
        >
          <svg>
            <use href="#i-heat" />
          </svg>
          Heatmap <span className="x">{storeHeatmapMode ? "LIVE" : "OFF"}</span>
        </button>
        <button onClick={() => handleChaosMode("slot")} title="AI Rack Dynamic Reslotting">
          <svg>
            <use href="#i-grid" />
          </svg>
          Re‑slot
        </button>
      </div>

      {/* Bottom-Right: State legend + discrete frame telemetry */}
      <div className="f-legend2">
        <span>
          <i style={{ background: "var(--signal)" }}></i>Moving
        </span>
        <span>
          <i style={{ background: "var(--blue)" }}></i>Charging
        </span>
        <span>
          <i style={{ background: "var(--amber)" }}></i>Yielding
        </span>
        <span>
          <i style={{ background: "var(--red)" }}></i>Fault
        </span>
        <span className="mono dim">
          <b>16.6ms</b> · A* <b>0.42ms</b> · <b>{totalBots}</b> agents
        </span>
      </div>

      {/* Focus Mode Slide-in Inspector Dock */}
      <InspectorDock />
    </div>
  );
}
export default Viewport;
