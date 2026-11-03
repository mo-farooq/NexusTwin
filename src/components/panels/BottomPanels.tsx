/**
 * NexusTwin Bottom Panels
 *
 * Real-time operational dispatch & analytics:
 * - Task Queue Table (Live active tasks, priority, From -> To, status)
 * - Throughput Sparkline Chart (Completed orders vs. target timeline)
 * - Robot Status Donut Chart (Fleet distribution across operational states)
 */

import React, { useMemo } from "react";
import { useTwinStore } from "../../store/useTwinStore";
import { Panel } from "../ui/primitives";

export function TaskQueuePanel() {
  const tasks = useTwinStore((s) => s.tasks);
  const selectedBotId = useTwinStore((s) => s.selectedBotId);
  const selectBot = useTwinStore((s) => s.selectBot);
  const setModal = useTwinStore((s) => s.setModal);

  const taskList = useMemo(() => {
    return Object.values(tasks)
      .filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED")
      .slice(0, 5);
  }, [tasks]);

  return (
    <Panel
      title="Task Dispatch Queue"
      action={
        <button className="link" onClick={() => setModal("tasks")}>
          View All ({Object.keys(tasks).length}) →
        </button>
      }
    >
      <div className="table-wrap">
        <table className="dt">
          <thead>
            <tr>
              <th>Task ID</th>
              <th>Type</th>
              <th>From</th>
              <th>To</th>
              <th>Bot Unit</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {taskList.map((t) => (
              <tr
                key={t.id}
                className={t.assignedBotId === selectedBotId ? "sel" : ""}
                onClick={() => t.assignedBotId && selectBot(t.assignedBotId)}
              >
                <td style={{ color: t.priority === "FLASH_SURGE" ? "#EF4444" : "inherit" }}>
                  #{t.id}
                </td>
                <td>{t.type === "INBOUND_PUTAWAY" ? "Inbound" : "Pick & Pack"}</td>
                <td>{t.sourceLocId}</td>
                <td>{t.destLocId}</td>
                <td style={{ fontWeight: 700, color: "#38BDF8" }}>
                  {t.assignedBotId || "Unassigned"}
                </td>
                <td
                  className={
                    t.status === "IN_PROGRESS"
                      ? "st-inprog"
                      : t.status === "ASSIGNED"
                      ? "st-inprog"
                      : "st-wait"
                  }
                >
                  {t.status.replace("_", " ")}
                </td>
              </tr>
            ))}
            {taskList.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: "10px" }}>
                  Task queue clear. Waiting for next batch stream.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function ThroughputPanel() {
  const kpi = useTwinStore((s) => s.kpi);

  const completed = kpi.totalCompletedTasks;
  const target = 180;

  // Generate synthetic smooth timeline points based on completed orders
  const points = useMemo(() => {
    const pts = [];
    const count = 12;
    for (let i = 0; i <= count; i++) {
      const x = (i / count) * 260 + 20;
      const progress = i / count;
      const y = 80 - Math.min(65, (progress * completed / Math.max(1, target)) * 65);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  }, [completed, target]);

  return (
    <Panel title="Throughput Pace" sub="(Live Velocity)">
      <div className="legend">
        <span>
          <i style={{ background: "#10B981" }} /> Completed
        </span>
        <span>
          <i style={{ background: "#38BDF8", borderTop: "2px dashed #38BDF8", height: 0 }} /> Target
        </span>
        <span className="big">
          <b>{completed}</b> / {target} units
        </span>
      </div>

      <div className="chart-wrap" style={{ marginTop: "4px" }}>
        <svg viewBox="0 0 300 95" width="100%" height="100%" preserveAspectRatio="none">
          <defs>
            <linearGradient id="tpfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#10B981" stopOpacity="0.3" />
              <stop offset="1" stopColor="#10B981" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1="20" x2="290" y1="20" y2="20" stroke="#1E293B" strokeWidth="0.8" />
          <line x1="20" x2="290" y1="50" y2="50" stroke="#1E293B" strokeWidth="0.8" />
          <line x1="20" x2="290" y1="80" y2="80" stroke="#1E293B" strokeWidth="0.8" />

          {/* Target Dashed Line */}
          <line x1="20" y1="65" x2="290" y2="20" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="4 3" />

          {/* Completed Actual Path */}
          <polyline points={points} fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
      </div>
    </Panel>
  );
}

export function RobotStatusPanel() {
  const botUnits = useTwinStore((s) => s.botUnits);

  const stats = useMemo(() => {
    const bots = Object.values(botUnits);
    const total = Math.max(1, bots.length);
    const active = bots.filter((b) => b.status === "ACTIVE").length;
    const charging = bots.filter((b) => b.status === "CHARGING").length;
    const idle = bots.filter((b) => b.status === "IDLE" || b.status === "WARNING").length;
    const error = bots.filter((b) => b.status === "ERROR" || b.status === "OFFLINE").length;

    return {
      total,
      parts: [
        { label: "Active", count: active, color: "#10B981" },
        { label: "Charging", count: charging, color: "#3B82F6" },
        { label: "Idle", count: idle, color: "#F59E0B" },
        { label: "Fault", count: error, color: "#EF4444" },
      ],
    };
  }, [botUnits]);

  const R = 38;
  const C = 2 * Math.PI * R;
  let accumulated = 0;

  return (
    <Panel title="Fleet Distribution">
      <div className="donut-wrap">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={R} fill="none" stroke="#1E293B" strokeWidth="12" />
          {stats.parts.map((p) => {
            const len = (p.count / stats.total) * C;
            const el = (
              <circle
                key={p.label}
                cx="50"
                cy="50"
                r={R}
                fill="none"
                stroke={p.color}
                strokeWidth="12"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-accumulated}
                transform="rotate(-90 50 50)"
              />
            );
            accumulated += len;
            return el;
          })}
          <text
            x="50"
            y="48"
            textAnchor="middle"
            fill="#FFFFFF"
            fontSize="16"
            fontWeight="800"
            fontFamily="'JetBrains Mono', monospace"
          >
            {stats.total}
          </text>
          <text
            x="50"
            y="62"
            textAnchor="middle"
            fill="var(--muted)"
            fontSize="8"
            fontWeight="600"
          >
            FLEET
          </text>
        </svg>

        <div className="donut-legend">
          {stats.parts.map((p) => (
            <div className="row" key={p.label}>
              <span className="dot" style={{ background: p.color }} />
              <span>{p.label}</span>
              <span className="n">
                {p.count} ({Math.round((p.count / stats.total) * 100)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
