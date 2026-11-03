/**
 * NexusTwin SCADA Top Command Bar
 *
 * Mission-critical top perimeter control bar featuring:
 * - Brand logo & LIVE status indicator
 * - Simulation clock & tick counter
 * - Real-time deterministic playback controls (Pause, 1x, 2x, 5x)
 * - Quick chaos triggers (Festive Surge, Block Path, Breakdown, VIP Order, AI Defrag)
 * - Navigation drawers & modals (Studio Builder, Decision Sandbox, What-If, Audit Log, AI Copilot)
 */

import React, { useEffect, useState } from "react";
import { useTwinStore } from "../../store/useTwinStore";

export function TopBar() {
  const isRunning = useTwinStore((s) => s.isRunning);
  const simulationSpeed = useTwinStore((s) => s.simulationSpeed);
  const tick = useTwinStore((s) => s.tick);
  const heatmapMode = useTwinStore((s) => s.heatmapMode);

  const startSimulation = useTwinStore((s) => s.startSimulation);
  const pauseSimulation = useTwinStore((s) => s.pauseSimulation);
  const setSimulationSpeed = useTwinStore((s) => s.setSimulationSpeed);
  const toggleHeatmapMode = useTwinStore((s) => s.toggleHeatmapMode);

  const isFestiveSurgeActive = useTwinStore((s) => s.isFestiveSurgeActive);
  const injectFestiveSurge = useTwinStore((s) => s.injectFestiveSurge);
  const breakdownBot = useTwinStore((s) => s.breakdownBot);
  const injectVipOrder = useTwinStore((s) => s.injectVipOrder);
  const defragmentRacks = useTwinStore((s) => s.defragmentRacks);
  const isObstaclePlacementActive = useTwinStore((s) => s.isObstaclePlacementActive);
  const toggleObstaclePlacementMode = useTwinStore((s) => s.toggleObstaclePlacementMode);

  const openBuilderModal = useTwinStore((s) => s.openBuilderModal);
  const openSandboxModal = useTwinStore((s) => s.openSandboxModal);
  const setDrawer = useTwinStore((s) => s.setDrawer);
  const setModal = useTwinStore((s) => s.setModal);
  const activeDrawer = useTwinStore((s) => s.drawer);

  const [clockStr, setClockStr] = useState("09:00:00");

  useEffect(() => {
    const totalSec = Math.floor(tick * 0.1);
    const hrs = String(9 + Math.floor(totalSec / 3600)).padStart(2, "0");
    const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const secs = String(totalSec % 60).padStart(2, "0");
    setClockStr(`${hrs}:${mins}:${secs}`);
  }, [tick]);

  return (
    <header className="topbar">
      {/* 1. Brand Logo & Live Badge */}
      <div className="brand">
        <span>
          NEXUS<span className="highlight">TWIN</span>
        </span>
        <span className="brand-badge">SCADA 3D</span>
      </div>

      <div className={`badge-live ${isRunning ? "live" : "paused"}`}>
        <span>●</span>
        <span>{isRunning ? "LIVE 10 Hz" : "SIM PAUSED"}</span>
      </div>

      {/* 2. Simulation Clock */}
      <div className="clock" style={{ marginLeft: "6px" }}>
        <div className="t">{clockStr}</div>
        <div className="d">TICK #{tick}</div>
      </div>

      <div className="vsep" />

      {/* 3. Playback Controls */}
      <div className="sim-controls">
        <button
          onClick={() => (isRunning ? pauseSimulation() : startSimulation())}
          title={isRunning ? "Pause Simulation" : "Resume Simulation"}
          style={{ color: isRunning ? "#EF4444" : "#10B981" }}
        >
          {isRunning ? "⏸ Pause" : "▶ Simulate"}
        </button>

        {([1, 2, 5] as const).map((spd) => (
          <button
            key={spd}
            className={simulationSpeed === spd ? "on" : ""}
            onClick={() => setSimulationSpeed(spd)}
          >
            {spd}x
          </button>
        ))}
      </div>

      {/* 4. Visual Layer Toggles */}
      <button
        className={`tb-btn ${heatmapMode ? "yellow" : ""}`}
        onClick={toggleHeatmapMode}
        title="Toggle Volumetric Congestion Heatmap"
      >
        <span>🔥</span>
        <span>Heatmap</span>
      </button>

      {/* 5. Quick Chaos Injections */}
      <button
        className={`tb-btn ${isFestiveSurgeActive ? "yellow" : ""}`}
        onClick={() => injectFestiveSurge(30, 3)}
        title="Inject 3x Festive Order Surge"
      >
        <span>🔥</span>
        <span>{isFestiveSurgeActive ? "Surge (3x Active)" : "Festive Surge"}</span>
      </button>

      <button
        className={`tb-btn ${isObstaclePlacementActive ? "yellow" : ""}`}
        onClick={() => toggleObstaclePlacementMode()}
        title="Click floor tiles in 3D to drop barricades & force A* rerouting"
      >
        <span>🚧</span>
        <span>{isObstaclePlacementActive ? "Click Floor" : "Block Path"}</span>
      </button>

      <button
        className="tb-btn"
        onClick={() => breakdownBot()}
        title="Force random AMR mechanical breakdown"
      >
        <span>🔋</span>
        <span>Breakdown</span>
      </button>

      <button
        className="tb-btn"
        onClick={() => injectVipOrder()}
        title="Dispatch 4-item VIP basket swarm"
      >
        <span>⚡</span>
        <span>VIP Swarm</span>
      </button>

      <button
        className="tb-btn"
        onClick={() => defragmentRacks()}
        title="AI Defrag: Move fast-moving SKUs to Level 1"
      >
        <span>✨</span>
        <span>AI Defrag</span>
      </button>

      {/* 6. Navigation Drawers & Modals (Right Aligned) */}
      <div className="topbar-right">
        {/* Studio Builder */}
        <button
          className="tb-btn purple"
          onClick={() => openBuilderModal()}
          title="Open Warehouse Layout Builder & Auto-Zoner Studio"
        >
          <span>🏗️</span>
          <span>Studio Builder</span>
        </button>

        {/* Decision Sandbox */}
        <button
          className="tb-btn yellow"
          onClick={() => openSandboxModal()}
          title="Vendor AMR Comparison & INR Capex Payback"
        >
          <span>⚡</span>
          <span>Decision Sandbox</span>
        </button>

        {/* What-If Simulation Drawer */}
        <button
          className={`tb-btn ${activeDrawer === "whatif" ? "primary" : ""}`}
          onClick={() => setDrawer(activeDrawer === "whatif" ? null : "whatif")}
          title="Clone Twin & Fast-Forward 5 Minutes Under Failure"
        >
          <span>🧪</span>
          <span>What-If</span>
        </button>

        {/* Audit Log Modal */}
        <button
          className="tb-btn"
          onClick={() => setModal("audit")}
          title="500-Event Audit Ledger with CSV/JSON Export"
        >
          <span>📋</span>
          <span>Audit Log</span>
        </button>

        {/* AI Copilot Drawer */}
        <button
          className={`tb-btn ${activeDrawer === "copilot" ? "primary" : ""}`}
          onClick={() => setDrawer(activeDrawer === "copilot" ? null : "copilot")}
          title="Ask Grounded AI Operations Copilot with 3D Citations"
        >
          <span>🤖</span>
          <span>Copilot</span>
        </button>
      </div>
    </header>
  );
}

export default TopBar;
