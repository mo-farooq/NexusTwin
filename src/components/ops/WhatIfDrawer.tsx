/**
 * NexusTwin Headless What-If Simulation Engine
 *
 * Fast-forwards an isolated cloned simulation 5 minutes into the future
 * under injected stress/failure conditions and compares KPIs against baseline:
 * - Side-by-side KPI diffs (Throughput, SLA %, INR Penalty risk, Congestion)
 * - AI recommendation
 * - "Apply to LIVE" button committing scenario into running operations
 */

import React, { useState } from "react";
import { useTwinStore } from "../../store/useTwinStore";

type ScenarioType = "FESTIVE_3X" | "BOT_BREAKDOWN" | "AISLE_BLOCK" | "CONVEYOR_JAM";

interface ScenarioOption {
  id: ScenarioType;
  title: string;
  badge: string;
  desc: string;
}

const SCENARIOS: ScenarioOption[] = [
  {
    id: "FESTIVE_3X",
    title: "🔥 Festive Season 3x Flash Load",
    badge: "DEMO 01",
    desc: "Injects +30 rapid flash orders and 3x order arrival frequency.",
  },
  {
    id: "BOT_BREAKDOWN",
    title: "🔋 Dual Bot Mechanical Breakdown",
    badge: "DEMO 02",
    desc: "Forces sudden hardware faults on BOT-03 and BOT-07 in peak transit.",
  },
  {
    id: "AISLE_BLOCK",
    title: "🚧 Central Cross-Aisle Obstruction",
    badge: "DEMO 03",
    desc: "Simulates fallen pallet stack barricading high-traffic intersection.",
  },
  {
    id: "CONVEYOR_JAM",
    title: "📦 Outbound Conveyor Motor Failure",
    badge: "DEMO 04",
    desc: "Simulates packaging conveyor stall causing tote backup into rack lanes.",
  },
];

export function WhatIfDrawer() {
  const isOpen = useTwinStore((s) => s.drawer === "whatif");
  const setDrawer = useTwinStore((s) => s.setDrawer);
  const whatIfResult = useTwinStore((s) => s.whatIfResult);
  const runWhatIfSimulation = useTwinStore((s) => s.runWhatIfSimulation);
  const applyWhatIfToLive = useTwinStore((s) => s.applyWhatIfToLive);

  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>("FESTIVE_3X");
  const [durationSec, setDurationSec] = useState<number>(300);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleRun = async () => {
    setIsRunning(true);
    await new Promise((r) => setTimeout(r, 600)); // UI polish delay
    await runWhatIfSimulation(selectedScenario);
    setIsRunning(false);
  };

  return (
    <aside className="drawer wide">
      <header className="drawer-h">
        <span>🧪 Headless What-If Engine</span>
        <button className="icon-btn" onClick={() => setDrawer(null)}>
          ✕
        </button>
      </header>

      <div className="drawer-b">
        <p className="hint">
          Clones live warehouse state and fast-forwards 5 minutes into the future under stress. Identical random seed ensures differences stem strictly from injected chaos. LIVE floor is untouched until you click "Apply to Live".
        </p>

        {/* Scenario Presets */}
        <h4 className="drawer-sub">Select Chaos Scenario</h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {SCENARIOS.map((sc) => (
            <div
              key={sc.id}
              onClick={() => setSelectedScenario(sc.id)}
              style={{
                padding: "8px 10px",
                borderRadius: "6px",
                border: selectedScenario === sc.id ? "1.5px solid #2563EB" : "1px solid var(--border)",
                background: selectedScenario === sc.id ? "rgba(37, 99, 235, 0.15)" : "var(--panel-2)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: "12px", color: "#FFFFFF" }}>{sc.title}</span>
                <span className="demo-tag">{sc.badge}</span>
              </div>
              <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "3px" }}>{sc.desc}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center", margin: "14px 0" }}>
          <label style={{ fontSize: "11.5px", color: "var(--muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            Duration:
            <select
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
              style={{
                background: "var(--panel-2)",
                border: "1px solid var(--border-strong)",
                borderRadius: "4px",
                padding: "4px 8px",
                fontSize: "11.5px",
                color: "#FFFFFF",
              }}
            >
              <option value={60}>1 min (Quick Test)</option>
              <option value={180}>3 min (Standard)</option>
              <option value={300}>5 min (Extended Shift)</option>
            </select>
          </label>

          <button
            className="btn primary"
            style={{ marginLeft: "auto", padding: "6px 14px" }}
            disabled={isRunning}
            onClick={handleRun}
          >
            {isRunning ? "Simulating… 3,000 Ticks" : "▶ Run What-If Diff"}
          </button>
        </div>

        {/* Results Diff Table */}
        {whatIfResult && (
          <div style={{ marginTop: "16px" }}>
            <h4 className="drawer-sub">
              Simulation Diff · {whatIfResult.scenarioName} ({whatIfResult.durationSeconds}s)
            </h4>

            <table className="dt wi-table" style={{ marginTop: "6px" }}>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th style={{ textAlign: "right" }}>Baseline</th>
                  <th style={{ textAlign: "right" }}>Scenario</th>
                  <th style={{ textAlign: "right" }}>Delta (Δ)</th>
                </tr>
              </thead>
              <tbody>
                {whatIfResult.metrics.map((m) => {
                  const isGood = m.higherIsBetter ? m.delta > 0 : m.delta < 0;
                  const deltaColor = m.delta === 0 ? "var(--muted)" : isGood ? "#10B981" : "#EF4444";
                  return (
                    <tr key={m.key}>
                      <td>{m.label}</td>
                      <td style={{ textAlign: "right" }}>{m.baseline}</td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>{m.scenario}</td>
                      <td style={{ textAlign: "right", color: deltaColor, fontWeight: 700 }}>
                        {m.delta > 0 ? `+${m.delta}` : m.delta} {m.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* AI Recommendation Box */}
            <div
              style={{
                background: "rgba(37, 99, 235, 0.12)",
                border: "1px solid #1E40AF",
                borderRadius: "6px",
                padding: "10px",
                marginTop: "12px",
                fontSize: "11.5px",
                lineHeight: "1.5",
              }}
            >
              <div style={{ fontWeight: 800, color: "#38BDF8", marginBottom: "3px" }}>
                💡 Autonomous Copilot Recommendation:
              </div>
              <div style={{ color: "var(--text)" }}>{whatIfResult.recommendation}</div>
            </div>

            {/* Commit to Live Button */}
            <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
              <button
                className="btn primary"
                style={{ flex: 1, padding: "8px", justifyContent: "center" }}
                onClick={applyWhatIfToLive}
              >
                🚀 Apply Scenario to LIVE Floor
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default WhatIfDrawer;
