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

import React, { useEffect, Suspense, lazy } from "react";
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
import { CopilotDrawer } from "./components/ops/CopilotDrawer";
import { WhatIfDrawer } from "./components/ops/WhatIfDrawer";
import { KpiStrip } from "./components/hud/KpiStrip";
import { AnalyticsDock } from "./components/hud/AnalyticsDock";

// Async code splitting for heavy presentation & modal bundles
const StoryMode = lazy(() =>
  import("./components/story/StoryMode").then((m) => ({ default: m.StoryMode }))
);
const AuditLedgerModal = lazy(() =>
  import("./components/ops/AuditLedgerModal").then((m) => ({ default: m.AuditLedgerModal }))
);
const WarehouseBuilderModal = lazy(() =>
  import("./components/hud/WarehouseBuilderModal").then((m) => ({ default: m.WarehouseBuilderModal }))
);
const DecisionSandboxModal = lazy(() =>
  import("./components/hud/DecisionSandboxModal").then((m) => ({ default: m.DecisionSandboxModal }))
);
const OperationsTableModal = lazy(() =>
  import("./components/hud/OperationsTableModal").then((m) => ({ default: m.OperationsTableModal }))
);

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
  const viewMode = useTwinStore((s) => s.viewMode);
  const isRunning = useTwinStore((s) => s.isRunning);
  const simulationSpeed = useTwinStore((s) => s.simulationSpeed);
  const stepSimulation = useTwinStore((s) => s.stepSimulation);
  const isBuilderModalOpen = useTwinStore((s) => s.isBuilderModalOpen);
  const isSandboxModalOpen = useTwinStore((s) => s.isSandboxModalOpen);
  const modal = useTwinStore((s) => s.modal);

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

      // 1. Performance optimization: Suspend simulation tick accumulator when tab is backgrounded / minimized
      if (typeof document !== "undefined" && document.hidden) {
        accumulator = 0;
        return;
      }

      const state = useTwinStore.getState();
      if (!state.isRunning) {
        accumulator = 0;
        return;
      }

      // 2. Performance optimization: When in Story Mode step 0 (Build) or step 3 (Decide),
      // there is no 3D canvas active, so throttle/skip background physics ticks to preserve CPU and GPU
      const hash = typeof window !== "undefined" ? window.location.hash.toLowerCase() : "";
      if (state.appMode === "STORY" && (hash.includes("build") || hash.includes("decide") || hash === "#story")) {
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

  // Keyboard shortcut listener: Space to toggle play/pause, 'w' for What-If, 'f' for Focus/Full, Escape to close focus popups
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
      } else if (e.key === "f" || e.key === "F") {
        const state = useTwinStore.getState();
        state.setViewMode(state.viewMode === "focus" ? "full" : "focus");
      } else if (e.key === "Escape") {
        const state = useTwinStore.getState();
        state.closeAllFocusPopups();
        state.selectBot(null);
        state.selectRack(null);
        state.selectStation(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Deep-link URL hash synchronization for executive presentations and direct bookmarking
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      const state = useTwinStore.getState();

      if (hash.startsWith("#story")) {
        if (state.appMode !== "STORY") state.setAppMode("STORY");
      } else {
        if (state.appMode !== "OPERATOR") state.setAppMode("OPERATOR");

        if (hash.includes("studio") || hash.includes("builder")) {
          if (!state.isBuilderModalOpen) state.openBuilderModal();
        } else if (hash.includes("sandbox") || hash.includes("roi")) {
          if (!state.isSandboxModalOpen) state.openSandboxModal();
        } else if (hash.includes("audit") || hash.includes("ledger")) {
          if (state.modal !== "audit") state.setModal("audit");
        } else if (hash.includes("operations") || hash.includes("tasks") || hash.includes("table")) {
          if (state.modal !== "tasks") state.setModal("tasks");
        } else {
          // Normal operator view (#operator or #/) -> close modals
          if (state.isBuilderModalOpen) state.closeBuilderModal();
          if (state.isSandboxModalOpen) state.closeSandboxModal();
          if (state.modal) state.setModal(null);
        }
      }
    };

    handleHash();
    window.addEventListener("hashchange", handleHash);
    window.addEventListener("popstate", handleHash);
    return () => {
      window.removeEventListener("hashchange", handleHash);
      window.removeEventListener("popstate", handleHash);
    };
  }, []);

  // Sync current mode and modals to URL hash seamlessly with browser history
  useEffect(() => {
    const currentHash = window.location.hash.toLowerCase();

    if (appMode === "STORY") {
      if (!currentHash.startsWith("#story")) {
        window.history.pushState(null, "", "#story/build");
      }
      return;
    }

    // When in OPERATOR mode:
    if (isBuilderModalOpen) {
      if (!currentHash.includes("studio") && !currentHash.includes("builder")) {
        window.history.pushState(null, "", "#studio");
      }
    } else if (isSandboxModalOpen) {
      if (!currentHash.includes("sandbox") && !currentHash.includes("roi")) {
        window.history.pushState(null, "", "#sandbox");
      }
    } else if (modal === "audit") {
      if (!currentHash.includes("audit") && !currentHash.includes("ledger")) {
        window.history.pushState(null, "", "#audit");
      }
    } else if (modal === "tasks") {
      if (!currentHash.includes("operations") && !currentHash.includes("tasks") && !currentHash.includes("table")) {
        window.history.pushState(null, "", "#operations");
      }
    } else {
      // No modals open - return to operator root if previously on a modal hash
      if (
        currentHash.includes("studio") ||
        currentHash.includes("builder") ||
        currentHash.includes("sandbox") ||
        currentHash.includes("audit") ||
        currentHash.includes("ledger") ||
        currentHash.includes("operations") ||
        currentHash.includes("tasks") ||
        currentHash.includes("table")
      ) {
        window.history.pushState(null, "", "#operator");
      }
    }
  }, [appMode, isBuilderModalOpen, isSandboxModalOpen, modal]);

  if (appMode === "STORY") {
    return (
      <Suspense fallback={<div className="story-loading" style={{ background: "#06182C", width: "100vw", height: "100vh" }} />}>
        <StoryMode />
      </Suspense>
    );
  }

  return (
    <div className={`app calm ${viewMode === "focus" ? "focus" : ""}`}>
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
          {viewMode === "focus" && <KpiStrip />}
          <Viewport />
          {viewMode === "focus" && <AnalyticsDock />}
        </section>

        {/* Bottom Dispatch & Analytics Dock */}
        <BottomPanels />

        {/* Right Asset Inspection & Ledger Column */}
        <RightPanels />
      </main>

      {/* Drawers & Operational Intelligence */}
      <CopilotDrawer />
      <WhatIfDrawer />

      {/* Enterprise Modals (Lazy Loaded) */}
      <Suspense fallback={null}>
        <AuditLedgerModal />
        <OperationsTableModal />
        <WarehouseBuilderModal />
        <DecisionSandboxModal />
      </Suspense>
    </div>
  );
}

export default App;
