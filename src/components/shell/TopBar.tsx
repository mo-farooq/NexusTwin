/**
 * NexusTwin SCADA Top Command Bar
 *
 * Mission-critical top perimeter control bar featuring:
 * - Brand identity with pulsing live beacon & tag
 * - Simulation engine telemetry: LIVE badge, digital clock, 60 FPS · tick #
 * - Playback transport (Pause, 1x, 2x, 5x, 10x)
 * - Mode switch between Operator View and Story Mode
 * - Action buttons (Studio Builder, ROI Sandbox, What-If, Copilot)
 */

import React, { useEffect, useState } from "react";
import { useTwinStore } from "../../store/useTwinStore";

export function TopBar() {
  const isRunning = useTwinStore((s) => s.isRunning);
  const simulationSpeed = useTwinStore((s) => s.simulationSpeed);
  const tick = useTwinStore((s) => s.tick);
  const appMode = useTwinStore((s) => s.appMode);
  const setAppMode = useTwinStore((s) => s.setAppMode);
  const viewMode = useTwinStore((s) => s.viewMode);
  const setViewMode = useTwinStore((s) => s.setViewMode);

  const startSimulation = useTwinStore((s) => s.startSimulation);
  const pauseSimulation = useTwinStore((s) => s.pauseSimulation);
  const setSimulationSpeed = useTwinStore((s) => s.setSimulationSpeed);

  const openBuilderModal = useTwinStore((s) => s.openBuilderModal);
  const openSandboxModal = useTwinStore((s) => s.openSandboxModal);
  const setDrawer = useTwinStore((s) => s.setDrawer);
  const activeDrawer = useTwinStore((s) => s.drawer);
  const defragMessage = useTwinStore((s) => s.defragMessage);

  const [clockStr, setClockStr] = useState("14:22:08");

  useEffect(() => {
    const totalSec = Math.floor(tick * 0.1);
    const hrs = String(14 + Math.floor(totalSec / 3600)).padStart(2, "0");
    const mins = String(22 + Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const secs = String(totalSec % 60).padStart(2, "0");
    setClockStr(`${hrs}:${mins}:${secs}`);
  }, [tick]);

  return (
    <header className="hdr">
      {/* 1. Brand Identity */}
      <div className="brand">
        <div className="logo">
          <svg viewBox="0 0 24 24">
            <path fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" d="m12 2 9 5v10l-9 5-9-5V7z" />
            <path fill="none" stroke="#FF5A1F" strokeWidth="2" d="M7.5 9.5v6l4.5 2.5 4.5-2.5v-6" />
          </svg>
        </div>
        <div>
          <div className="wordmark">
            Nexus<b>Twin</b>
          </div>
          <div className="tag">
            {appMode === "STORY" ? "Story Mode · Decision Engine" : "Operator view"}
          </div>
        </div>
      </div>

      {/* 2. Simulation Engine Telemetry */}
      <div className="engine">
        <span className={`live ${isRunning ? "" : "paused"}`} id="liveBadge">
          <i></i>
          {isRunning ? "LIVE" : "PAUSED"}
        </span>
        <span className="clock" id="clock">
          {clockStr}
        </span>
        <span className="sep"></span>
        <span className="m" title="10 Hz discrete clock · render FPS · simulation tick">
          <b id="fps">60</b> FPS · tick <b id="tick">{tick.toLocaleString("en-IN")}</b>
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* 3. Right Transport & Action Hub */}
      <div className="right">
        {/* Focus / Full Mode Switcher */}
        {appMode === "OPERATOR" && (
          <>
            <div className="seg mode-sw" id="modeSw" title="Press F to switch view">
              <button
                className={viewMode === "focus" ? "on" : ""}
                onClick={() => setViewMode("focus")}
              >
                Focus
              </button>
              <button
                className={viewMode === "full" ? "on" : ""}
                onClick={() => setViewMode("full")}
              >
                Full
              </button>
            </div>
            <span className="vsep" />
          </>
        )}

        {/* Playback Controls */}
        <div className="transport">
          <button
            className={`play ${isRunning ? "on" : ""}`}
            onClick={() => (isRunning ? pauseSimulation() : startSimulation())}
            title={isRunning ? "Pause Simulation" : "Resume Simulation"}
          >
            <svg>
              <use href={isRunning ? "#i-pause" : "#i-play"} />
            </svg>
          </button>
          {([1, 2, 5, 10] as const).map((spd) => (
            <button
              key={spd}
              className={`spd ${simulationSpeed === spd ? "on" : ""}`}
              onClick={() => setSimulationSpeed(spd as 1 | 2 | 5 | 10)}
            >
              {spd}×
            </button>
          ))}
        </div>

        {/* Story Mode / Operator View Switcher */}
        <button
          className="hbtn ghost"
          onClick={() => {
            if (appMode === "OPERATOR") {
              window.location.hash = "#story/build";
            } else {
              window.location.hash = "#operator";
            }
          }}
          style={{ cursor: "pointer", fontWeight: 700 }}
          title={appMode === "OPERATOR" ? "Switch to Story Mode executive walkthrough" : "Switch to Operator View SCADA console"}
        >
          {appMode === "OPERATOR" ? "Story Mode →" : "← Operator View"}
        </button>

        {/* Studio Builder */}
        <button
          className="hbtn"
          onClick={() => {
            window.location.hash = "#studio";
            openBuilderModal();
          }}
          title="Open Warehouse Layout Builder & Auto-Zoner Studio"
        >
          <svg>
            <use href="#i-grid" />
          </svg>
          <span>Studio</span>
        </button>

        {/* ROI Sandbox */}
        <button
          className="hbtn"
          onClick={() => {
            window.location.hash = "#sandbox";
            openSandboxModal();
          }}
          title="Vendor AMR Comparison & INR Capex Payback"
        >
          <svg>
            <use href="#i-coin" />
          </svg>
          <span>ROI Sandbox</span>
        </button>

        {/* What-If Simulation Drawer */}
        <button
          className={`hbtn primary ${activeDrawer === "whatif" ? "on" : ""}`}
          onClick={() => setDrawer(activeDrawer === "whatif" ? null : "whatif")}
          title="Clone Twin & Fast-Forward Under Failure Scenarios"
        >
          <svg>
            <use href="#i-flask" />
          </svg>
          <span>What-If</span>
          <kbd>W</kbd>
        </button>

        {/* AI Copilot Drawer */}
        <button
          className={`hbtn ink ${activeDrawer === "copilot" ? "on" : ""}`}
          onClick={() => setDrawer(activeDrawer === "copilot" ? null : "copilot")}
          title="Ask Grounded AI Operations Copilot"
        >
          <span>🤖</span>
          <span>Copilot</span>
        </button>
      </div>

      {defragMessage && (
        <div
          style={{
            position: "absolute",
            top: "50px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(135deg, #0C831F 0%, #065F14 100%)",
            color: "#FFFFFF",
            padding: "8px 18px",
            borderRadius: "10px",
            fontSize: "12px",
            fontWeight: 800,
            boxShadow: "0 8px 24px rgba(12, 131, 31, 0.4)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            zIndex: 9999,
            maxWidth: "750px",
            border: "1.5px solid #34D399",
            lineHeight: 1.4,
          }}
        >
          <span style={{ fontSize: "16px" }}>🔄</span>
          <span>{defragMessage}</span>
        </div>
      )}
    </header>
  );
}

export default TopBar;
