/**
 * NexusTwin Right Panels
 *
 * Detailed asset inspection & streaming telemetry:
 * - Selected Robot Panel (Battery bar, Velocity, FSM state, Cargo weight, LiDAR sensor readout, Path preview)
 * - Live Camera / FPV Viewport (Simulated robot FPV / dock CCTV perspective)
 * - Real-time Streaming Audit Event Log
 */

import React, { useState } from "react";
import { useTwinStore } from "../../store/useTwinStore";
import { Panel, Dot } from "../ui/primitives";

export function SelectedRobotPanel() {
  const selectedBotId = useTwinStore((s) => s.selectedBotId);
  const botUnits = useTwinStore((s) => s.botUnits);
  const tasks = useTwinStore((s) => s.tasks);
  const setModal = useTwinStore((s) => s.setModal);
  const setFocusTarget = useTwinStore((s) => s.setFocusTarget);

  const bot = selectedBotId ? botUnits[selectedBotId] : null;
  const currentTask = bot?.currentTaskId ? tasks[bot.currentTaskId] : null;

  if (!bot) {
    return (
      <Panel title="Asset Telemetry">
        <div style={{ color: "var(--muted)", padding: "16px 0", textAlign: "center", fontSize: "11.5px" }}>
          Click any autonomous bot, rack, or station to inspect live telemetry.
        </div>
      </Panel>
    );
  }

  const statusColor =
    bot.status === "ACTIVE"
      ? "#10B981"
      : bot.status === "CHARGING"
      ? "#3B82F6"
      : bot.status === "ERROR"
      ? "#EF4444"
      : "#F59E0B";

  const estHours = ((bot.batteryPct / 100) * 4.2).toFixed(1);

  return (
    <Panel
      title="Asset Telemetry"
      action={
        <button
          className="link"
          onClick={() => setFocusTarget([bot.position[0], 0, bot.position[2]])}
        >
          Track Camera ➔
        </button>
      }
    >
      <div className="robot-head">
        <span className="id">{bot.id}</span>
        <span className="status-text" style={{ color: statusColor }}>
          <Dot color={statusColor} />
          {bot.status}
        </span>
      </div>

      {/* Battery Gauge */}
      <div className="battery">
        <span className="bar">
          <span
            className="fill"
            style={{
              width: `${bot.batteryPct}%`,
              background:
                bot.batteryPct < 20
                  ? "#EF4444"
                  : bot.batteryPct < 40
                  ? "#F59E0B"
                  : "#10B981",
            }}
          />
        </span>
        <span className="pct">{Math.round(bot.batteryPct)}%</span>
        <span className="est">Est. {estHours}h remaining</span>
      </div>

      <div className="kv">
        <span className="k">FSM State</span>
        <span className="v" style={{ fontFamily: "var(--mono)", fontSize: "11px" }}>
          {bot.fsmState} {bot.velocity > 0.05 ? `· ${bot.velocity.toFixed(2)} m/s` : ""}
        </span>
      </div>

      <div className="kv">
        <span className="k">LiDAR ACS</span>
        <span
          className="v"
          style={{
            fontFamily: "var(--mono)",
            fontSize: "11px",
            color:
              bot.perception?.state === "HOLDING"
                ? "#EF4444"
                : bot.perception?.state === "SLOWING"
                ? "#F59E0B"
                : "#38BDF8",
          }}
        >
          {bot.perception?.state || "CLEAR"}
          {bot.perception?.frontDistM ? ` · ${bot.perception.frontDistM.toFixed(1)}m` : ""}
        </span>
      </div>

      <div className="kv">
        <span className="k">Current Task</span>
        <span className="v">{currentTask ? `#${currentTask.id}` : "Idle Standby"}</span>
      </div>

      <div className="kv">
        <span className="k">Payload</span>
        <span className="v">
          {bot.currentPayloadKg > 0 ? `${bot.currentPayloadKg} kg (Inbound/Pick)` : "Empty Tray"}
        </span>
      </div>

      <div className="kv">
        <span className="k">Tasks Completed</span>
        <span className="v">{bot.stats.tasksCompleted}</span>
      </div>

      <button
        className="btn primary"
        style={{ marginTop: "10px", width: "100%", justifyContent: "center" }}
        onClick={() => setModal("tasks")}
      >
        View Task Queue & Logs
      </button>
    </Panel>
  );
}

export function LiveCameraPanel() {
  const selectedBotId = useTwinStore((s) => s.selectedBotId);
  const [camIndex, setCamIndex] = useState(0);

  const cameras = [
    { id: selectedBotId ? `${selectedBotId}-FPV` : "CCTV-DOCK-01", label: "Front Dock Bay Cam" },
    { id: "CCTV-AISLE-B", label: "Aisle B Multi-Tier Cam" },
    { id: "CCTV-PACK-01", label: "Packing Line 1 Overhead" },
  ];

  const currentCam = cameras[camIndex];

  return (
    <Panel
      title="Live Sensor Vision"
      action={
        <div style={{ display: "flex", gap: "4px" }}>
          {cameras.map((_, i) => (
            <button
              key={i}
              onClick={() => setCamIndex(i)}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: camIndex === i ? "#38BDF8" : "var(--border-strong)",
              }}
            />
          ))}
        </div>
      }
    >
      <div className="cam-view">
        <span className="live">● LIVE REC</span>
        <span className="tag">{currentCam.id} · 1080p 30fps</span>

        {/* Simulated CCTV Camera Viewport Graphic */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "4px",
            background: "radial-gradient(ellipse at 50% 50%, #0D1B2A 0%, #050B14 85%)",
          }}
        >
          <div style={{ fontSize: "24px" }}>📹</div>
          <span style={{ fontSize: "10.5px", color: "var(--muted)", fontWeight: 600 }}>
            {currentCam.label}
          </span>
          <span style={{ fontSize: "9px", color: "#64748B", fontFamily: "var(--mono)" }}>
            STREAM OK · 18 ms LATENCY
          </span>
        </div>
      </div>
    </Panel>
  );
}

export function EventLogPanel() {
  const recentEvents = useTwinStore((s) => s.recentEvents);
  const setModal = useTwinStore((s) => s.setModal);
  const selectBot = useTwinStore((s) => s.selectBot);

  return (
    <Panel
      title="Audit Event Stream"
      grow
      action={
        <button className="link" onClick={() => setModal("audit")}>
          Full Ledger →
        </button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "auto" }}>
        {recentEvents.slice(0, 15).map((ev) => (
          <div
            key={ev.id}
            className="ev-row"
            onClick={() => ev.robotId && selectBot(ev.robotId)}
          >
            <span className="t">{ev.time}</span>
            <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: "10.5px",
                  color:
                    ev.severity === "CRITICAL"
                      ? "#EF4444"
                      : ev.severity === "HIGH"
                      ? "#F59E0B"
                      : "#38BDF8",
                  marginRight: "4px",
                }}
              >
                [{ev.type}]
              </span>
              <span>{ev.message}</span>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
