/**
 * NexusTwin Application Entry
 *
 * Light Industrial SCADA Operations Twin & Story Mode Presentation:
 * - AppMode Switcher: "OPERATOR" (SCADA Real-time Console) <-> "STORY" (4-Step Executive ROI Flow)
 * - Header: Transport speed, digital clock, LIVE engine pulse, Story Mode / Operator toggle
 * - Left Column: Fleet Overview, Throughput Pace, Systems Subsystem Health, Incidents / Alerts
 * - Center: High-Performance 3D WebGL FacilityCanvas / 2D CAD Viewport with floating overlays
 * - Bottom Row: Dispatch Queue, Throughput SVG Chart, Order Lifecycle Pipeline
 * - Right Column: Tabbed Inspector (Robot + LiDAR Radar, Rack 4-tier slotting, Station queue), Ledger, Roadmap
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
import { RightPanels } from "./components/panels/RightPanels";
import { BottomPanels } from "./components/panels/BottomPanels";
import { StoryMode } from "./components/story/StoryMode";
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

  const appMode = useTwinStore((s) => s.appMode);
  const isRunning = useTwinStore((s) => s.isRunning);
  const simulationSpeed = useTwinStore((s) => s.simulationSpeed);
  const stepSimulation = useTwinStore((s) => s.stepSimulation);

  // High-performance requestAnimationFrame simulation runner with time accumulator
  // Synchronizes ticks to the display frame rate without throttling or flooding React dispatches
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let accumulator = 0;
    const TICK_S = 0.1; // 100ms baseline simulation tick
    const MAX_TICKS_PER_FRAME = 20;

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      const dt = Math.min(0.25, (now - lastTime) / 1000);
      lastTime = now;

      const state = useTwinStore.getState();
      if (!state.isRunning) {
        accumulator = 0;
        return;
      }

      const speed = state.simulationSpeed;
      accumulator += dt * speed;

      let ticksToStep = 0;
      while (accumulator >= TICK_S && ticksToStep < MAX_TICKS_PER_FRAME) {
        accumulator -= TICK_S;
        ticksToStep++;
      }

      if (ticksToStep > 0) {
        state.stepSimulation(ticksToStep);
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Keyboard shortcut listener: Space to toggle play/pause, 'w' for What-If
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        const state = useTwinStore.getState();
        if (state.isRunning) {
          state.pauseSimulation();
        } else {
          state.startSimulation();
        }
      } else if (e.key === "w" || e.key === "W") {
        useTwinStore.getState().setDrawer("whatif");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (appMode === "STORY") {
    return <StoryMode />;
  }

  return (
    <div className="app calm">
      <TopBar />

      <main className="body">
        {/* Left Operations Column */}
        <aside className="col l">
          <FleetOverviewPanel />
          <TaskOverviewPanel />
          <SystemStatusPanel />
          <AlertsPanel />
        </aside>

        {/* Center 3D/2D Viewport */}
        <section className="center">
          <Viewport />
        </section>

        {/* Bottom Dispatch & Analytics Dock */}
        <BottomPanels />

        {/* Right Asset Inspection & Ledger Column */}
        <RightPanels />
      </main>

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
