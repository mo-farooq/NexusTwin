/**
 * NexusTwin Application Entry
 *
 * SCADA Industrial Operations Digital Twin Console:
 * - TopBar: Perimeter controls, simulation clock, chaos triggers, drawer toggles
 * - LeftPanels: Fleet Overview, Task Overview, System Status, Alerts
 * - Center: Viewport (3D FacilityCanvas / 2D MapView)
 * - RightPanels: Selected Robot Telemetry, Live FPV Vision, Audit Event Stream
 * - BottomPanels: Task Queue, Throughput Sparkline, Robot Status Donut
 * - Drawers & Modals: CopilotDrawer, WhatIfDrawer, AuditLedgerModal, WarehouseBuilderModal, DecisionSandboxModal
 */

import React, { useEffect } from "react";
import { useTwinStore } from "./store/useTwinStore";
import { TopBar } from "./components/shell/TopBar";
import { Viewport } from "./components/views/Viewport";
import {
  FleetOverviewPanel,
  TaskOverviewPanel,
  SystemStatusPanel,
  AlertsPanel,
} from "./components/panels/LeftPanels";
import {
  SelectedRobotPanel,
  LiveCameraPanel,
  EventLogPanel,
} from "./components/panels/RightPanels";
import {
  TaskQueuePanel,
  ThroughputPanel,
  RobotStatusPanel,
} from "./components/panels/BottomPanels";
import { CopilotDrawer } from "./components/ops/CopilotDrawer";
import { WhatIfDrawer } from "./components/ops/WhatIfDrawer";
import { AuditLedgerModal } from "./components/ops/AuditLedgerModal";
import { WarehouseBuilderModal } from "./components/hud/WarehouseBuilderModal";
import { DecisionSandboxModal } from "./components/hud/DecisionSandboxModal";

const DESIGN_W = 1536;
const DESIGN_H = 860;

function useFitScale() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const z = Math.min(1, window.innerWidth / DESIGN_W, window.innerHeight / DESIGN_H);
      root.style.setProperty("--ui-scale", z < 0.995 ? z.toFixed(4) : "1");
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);
}

export function App() {
  useFitScale();

  const isRunning = useTwinStore((s) => s.isRunning);
  const simulationSpeed = useTwinStore((s) => s.simulationSpeed);
  const stepSimulation = useTwinStore((s) => s.stepSimulation);

  // Deterministic simulation tick engine (100ms baseline adjusted by simulationSpeed)
  useEffect(() => {
    if (!isRunning) return;

    const intervalMs = Math.max(10, Math.round(100 / simulationSpeed));
    const timer = setInterval(() => {
      stepSimulation();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isRunning, simulationSpeed, stepSimulation]);

  return (
    <div className="shell">
      <TopBar />

      <div className="shell-body">
        {/* Left Operations Column */}
        <aside className="col-left">
          <FleetOverviewPanel />
          <TaskOverviewPanel />
          <SystemStatusPanel />
          <AlertsPanel />
        </aside>

        {/* Center 3D/2D Viewport */}
        <main className="center">
          <Viewport />
        </main>

        {/* Right Asset Inspection Column */}
        <aside className="col-right">
          <SelectedRobotPanel />
          <LiveCameraPanel />
          <EventLogPanel />
        </aside>

        {/* Bottom Dispatch & Analytics Row */}
        <footer className="bottom">
          <TaskQueuePanel />
          <ThroughputPanel />
          <RobotStatusPanel />
        </footer>
      </div>

      {/* Drawers & Operational Intelligence */}
      <CopilotDrawer />
      <WhatIfDrawer />

      {/* Enterprise Modals */}
      <AuditLedgerModal />
      <WarehouseBuilderModal />
      <DecisionSandboxModal />
    </div>
  );
}

export default App;
