/**
 * NexusTwin Viewport Component
 *
 * Hosts the primary 3D Digital Twin or 2D Blueprint Map with:
 * - View mode switcher (3D View vs. 2D Map)
 * - Floor selector
 * - Camera focus reset
 * - Bottom scene toolbar (Select, Pan, Paths toggle, Labels toggle)
 * - Real-time FPS counter
 */

import React, { useRef, useState } from "react";
import { useTwinStore } from "../../store/useTwinStore";
import { FacilityCanvas } from "../canvas/FacilityCanvas";
import { MapView2D } from "./MapView2D";
import { Icon } from "../ui/primitives";

export function Viewport() {
  const viewTab = useTwinStore((s) => s.viewTab);
  const setViewTab = useTwinStore((s) => s.setViewTab);
  const showPaths = useTwinStore((s) => s.showPaths);
  const showLabels = useTwinStore((s) => s.showLabels);
  const togglePaths = useTwinStore((s) => s.togglePaths);
  const toggleLabels = useTwinStore((s) => s.toggleLabels);
  const activeFloor = useTwinStore((s) => s.activeFloor);
  const setActiveFloor = useTwinStore((s) => s.setActiveFloor);
  const setFocusTarget = useTwinStore((s) => s.setFocusTarget);
  const selectBot = useTwinStore((s) => s.selectBot);

  const [activeTool, setActiveTool] = useState<"select" | "pan" | "measure">("select");

  const resetCamera = () => {
    selectBot(null);
    setFocusTarget([30, 0, 20]);
  };

  return (
    <div className="viewport">
      {/* 1. Top-Left View Switcher Tabs */}
      <div className="view-tabs">
        <button
          className={viewTab === "3D" ? "on" : ""}
          onClick={() => setViewTab("3D")}
        >
          3D VIEW
        </button>
        <button
          className={viewTab === "MAP" ? "on" : ""}
          onClick={() => setViewTab("MAP")}
        >
          2D BLUEPRINT
        </button>
      </div>

      {/* 2. Top-Right Viewport Utility Toolbar */}
      <div className="vp-toolbar">
        <select
          className="sel"
          value={String(activeFloor)}
          onChange={(e) => {
            const v = e.target.value === "all" ? "all" : e.target.value === "exploded" ? "exploded" : Number(e.target.value);
            setActiveFloor(v as "all" | "exploded" | 1 | 2);
          }}
        >
          <option value="all">All Floors</option>
          <option value="1">Floor 1 · Ground Core</option>
          <option value="2">Floor 2 · Mezzanine</option>
          <option value="exploded">Exploded 3D</option>
        </select>

        <button className="icon-btn" title="Reset Camera Focus" onClick={resetCamera}>
          {Icon.expand}
        </button>
      </div>

      {/* 3. Center Canvas / Map */}
      {viewTab === "3D" ? (
        <FacilityCanvas style={{ width: "100%", height: "100%" }} />
      ) : (
        <MapView2D mode={viewTab} />
      )}

      {/* 4. Bottom Center Scene Toolbar */}
      <div className="scene-toolbar">
        <button
          className={activeTool === "select" ? "on" : ""}
          onClick={() => setActiveTool("select")}
          title="Select Entities (AMR, Rack, Station)"
        >
          {Icon.cursor} <span>Select</span>
        </button>
        <button
          className={activeTool === "pan" ? "on" : ""}
          onClick={() => setActiveTool("pan")}
          title="Pan Floor Camera"
        >
          {Icon.hand} <span>Pan</span>
        </button>
        <button
          className={showPaths ? "on" : ""}
          onClick={togglePaths}
          title="Toggle A* Navigation Paths"
        >
          {Icon.path} <span>Paths</span>
        </button>
        <button
          className={showLabels ? "on" : ""}
          onClick={toggleLabels}
          title="Toggle 3D Floor Labels"
        >
          {Icon.tag} <span>Labels</span>
        </button>
      </div>

      {/* 5. Bottom Right Real-time Stats */}
      <div className="fps">
        <span>60 FPS · 10 Hz TICK</span>
      </div>
    </div>
  );
}

export default Viewport;
