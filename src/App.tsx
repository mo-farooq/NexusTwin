/**
 * NexusTwin Application Entry
 *
 * Unified layout mounting the 3D FacilityCanvas with the surrounding
 * perimeter glassmorphism HUD overlay (TopControlBar, KpiOverlay, InspectorDrawer, OperationsTable),
 * and driving the real-time simulation tick engine.
 */

import React, { useEffect } from "react";
import { FacilityCanvas } from "./components/canvas/FacilityCanvas";
import { TopControlBar } from "./components/hud/TopControlBar";
import { KpiOverlay } from "./components/hud/KpiOverlay";
import { InspectorDrawer } from "./components/hud/InspectorDrawer";
import { OperationsTable } from "./components/hud/OperationsTable";
import { DecisionSandboxModal } from "./components/hud/DecisionSandboxModal";
import { useTwinStore } from "./store/useTwinStore";

export function App() {
  const isRunning = useTwinStore((s) => s.isRunning);
  const simulationSpeed = useTwinStore((s) => s.simulationSpeed);
  const stepSimulation = useTwinStore((s) => s.stepSimulation);

  // Simulation tick loop (100 ms baseline interval adjusted by simulationSpeed)
  useEffect(() => {
    if (!isRunning) return;

    const intervalMs = Math.max(10, Math.round(100 / simulationSpeed));
    const timer = setInterval(() => {
      stepSimulation();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isRunning, simulationSpeed, stepSimulation]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#F1F5F9",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* 3D Facility Digital Twin Viewport */}
      <FacilityCanvas />

      {/* 2D HUD Perimeter Overlays */}
      <TopControlBar />
      <KpiOverlay />
      <InspectorDrawer />
      <OperationsTable />
      <DecisionSandboxModal />
    </div>
  );
}

export default App;
