/**
 * NexusTwin Headless What-If Simulation Engine
 *
 * Fast-forwards an isolated cloned simulation 5 minutes into the future
 * under injected stress/failure conditions and compares KPIs against baseline:
 * - Multi-Seed Ensemble Confidence (1 to 5 PRNG seeds with Min/Median/Max ranges)
 * - Tick-by-tick divergence detection between Baseline and Scenario event streams
 * - Side-by-side KPI diffs (Throughput, SLA %, INR Penalty risk, Congestion)
 * - Grounded AI strategic recommendation
 * - "Apply to LIVE" button committing scenario into running operations
 */

import React, { useState } from "react";
import { useTwinStore } from "../../store/useTwinStore";
import type { WhatIfScenarioType } from "../../engine/whatif";

interface ScenarioOption {
  id: WhatIfScenarioType;
  title: string;
  badge: string;
  desc: string;
}

const SCENARIOS: ScenarioOption[] = [
  {
    id: "FESTIVE_3X",
    title: "🔥 Festive Season 3x Flash Load",
    badge: "DEMO 01",
    desc: "Simulates 3x order arrivals & 25 priority surge baskets during Diwali rush.",
  },
  {
    id: "BOT_BREAKDOWN",
    title: "🔋 Dual Bot Mechanical Breakdown",
    badge: "DEMO 02",
    desc: "Simulates sudden hardware faults on high-traffic AMRs during peak transit.",
  },
  {
    id: "AISLE_BLOCK",
    title: "🚧 Central Cross-Aisle Obstruction",
    badge: "DEMO 03",
    desc: "Simulates fallen pallet stack barricading the primary highway intersection.",
  },
  {
    id: "CONVEYOR_JAM",
    title: "📦 Outbound Conveyor Motor Stall",
    badge: "DEMO 04",
    desc: "Simulates roller line stall causing tote backup into packing buffer lanes.",
  },
];

export function WhatIfDrawer() {
  const isOpen = useTwinStore((s) => s.drawer === "whatif");
  const setDrawer = useTwinStore((s) => s.setDrawer);
  const whatIfResult = useTwinStore((s) => s.whatIfResult);
  const runWhatIfSimulation = useTwinStore((s) => s.runWhatIfSimulation);
  const applyWhatIfToLive = useTwinStore((s) => s.applyWhatIfToLive);

  const [selectedScenario, setSelectedScenario] = useState<WhatIfScenarioType>("FESTIVE_3X");
  const [durationSec, setDurationSec] = useState<number>(300);
  const [ensembleSeeds, setEnsembleSeeds] = useState<number>(3);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleRun = async () => {
    setIsRunning(true);
    // Yield execution frame to let UI render the progress state
    await new Promise((r) => setTimeout(r, 80));
    await runWhatIfSimulation(selectedScenario, durationSec, ensembleSeeds);
    setIsRunning(false);
  };

  return (
    <aside
      className="drawer wide on"
      style={{
        background: "#FFFFFF",
        color: "#0F172A",
        borderLeft: "1px solid #E2E8F0",
        boxShadow: "-8px 0 24px rgba(15, 23, 42, 0.08)",
        display: "flex",
        flexDirection: "column",
        width: "560px",
        maxWidth: "92vw",
        transform: "none",
        zIndex: 99,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <header
        className="drawer-h"
        style={{
          background: "#F8FAFC",
          borderBottom: "1px solid #E2E8F0",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>🧪</span>
          <span style={{ fontWeight: 800, fontSize: "14px", color: "#0F172A", letterSpacing: "-0.01em" }}>
            Headless What-If Decision Engine
          </span>
        </div>
        <button
          className="icon-btn"
          onClick={() => setDrawer(null)}
          style={{
            background: "#F1F5F9",
            border: "1px solid #CBD5E1",
            color: "#475569",
            borderRadius: "6px",
            width: "28px",
            height: "28px",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          ✕
        </button>
      </header>

      {/* Body */}
      <div className="drawer-b" style={{ padding: "16px 18px", overflowY: "auto", flex: 1 }}>
        <p
          className="hint"
          style={{
            background: "#F1F5F9",
            border: "1px solid #E2E8F0",
            color: "#475569",
            padding: "10px 12px",
            borderRadius: "8px",
            fontSize: "11.5px",
            lineHeight: 1.5,
            marginBottom: "14px",
          }}
        >
          <strong>Virtual Air Traffic Control Sandbox:</strong> Deep-clones the live digital twin state and fast-forwards forward in milliseconds across multiple random seeds. Live floor operation remains 100% untouched until you click <strong>"Apply to LIVE"</strong>.
        </p>

        {/* 1. Scenario Presets */}
        <h4 style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
          1. Select Compound Stress Scenario
        </h4>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {SCENARIOS.map((sc) => {
            const isSelected = selectedScenario === sc.id;
            return (
              <div
                key={sc.id}
                onClick={() => setSelectedScenario(sc.id)}
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: isSelected ? "2px solid #0284C7" : "1px solid #E2E8F0",
                  background: isSelected ? "#F0F9FF" : "#FAFAFA",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isSelected ? "0 2px 8px rgba(2, 132, 199, 0.12)" : "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 800, fontSize: "12.5px", color: isSelected ? "#0369A1" : "#1E293B" }}>
                    {sc.title}
                  </span>
                  <span
                    style={{
                      background: isSelected ? "#0284C7" : "#E2E8F0",
                      color: isSelected ? "#FFFFFF" : "#64748B",
                      fontSize: "9.5px",
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: "4px",
                    }}
                  >
                    {sc.badge}
                  </span>
                </div>
                <div style={{ fontSize: "11px", color: "#64748B", marginTop: "4px", lineHeight: 1.4 }}>
                  {sc.desc}
                </div>
              </div>
            );
          })}
        </div>

        {/* 2. Simulation Horizon & Ensemble Parameters */}
        <div
          style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "8px",
            padding: "12px",
            margin: "14px 0",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", display: "block", marginBottom: "4px" }}>
              Simulation Horizon:
            </label>
            <select
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
              style={{
                width: "100%",
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                padding: "6px 8px",
                fontSize: "12px",
                color: "#0F172A",
                fontWeight: 600,
              }}
            >
              <option value={60}>1 min (600 ticks)</option>
              <option value={180}>3 min (1,800 ticks)</option>
              <option value={300}>5 min (3,000 ticks — Standard)</option>
              <option value={600}>10 min (6,000 ticks — Shift)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", display: "block", marginBottom: "4px" }}>
              Multi-Seed Ensemble:
            </label>
            <select
              value={ensembleSeeds}
              onChange={(e) => setEnsembleSeeds(Number(e.target.value))}
              style={{
                width: "100%",
                background: "#FFFFFF",
                border: "1px solid #CBD5E1",
                borderRadius: "6px",
                padding: "6px 8px",
                fontSize: "12px",
                color: "#0F172A",
                fontWeight: 600,
              }}
            >
              <option value={1}>1 Seed (Fastest · ~80ms)</option>
              <option value={3}>3 Seeds (Recommended Ensemble)</option>
              <option value={5}>5 Seeds (Deep Statistical Confidence)</option>
            </select>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleRun}
          disabled={isRunning}
          style={{
            width: "100%",
            background: isRunning ? "#94A3B8" : "#0F172A",
            color: "#FFFFFF",
            border: "none",
            borderRadius: "8px",
            padding: "10px",
            fontSize: "13px",
            fontWeight: 800,
            cursor: isRunning ? "not-allowed" : "pointer",
            boxShadow: "0 2px 8px rgba(15, 23, 42, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.15s ease",
          }}
        >
          {isRunning ? (
            <>
              <span className="spinner" style={{ display: "inline-block", width: "12px", height: "12px", border: "2px solid #FFF", borderTopColor: "transparent", borderRadius: "50%" }} />
              <span>Fast-Forwarding {Math.floor(durationSec / 0.1) * ensembleSeeds} Virtual Ticks...</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>Run Headless What-If Simulation ({ensembleSeeds} Seeds)</span>
            </>
          )}
        </button>

        {/* 3. Results Diff Table & Telemetry */}
        {whatIfResult && (
          <div style={{ marginTop: "18px" }}>
            {/* Header info */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h4 style={{ fontSize: "11px", fontWeight: 800, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                2. Decision Impact Analysis · {whatIfResult.scenarioName}
              </h4>
              <span style={{ fontSize: "10.5px", color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>
                Computed in {whatIfResult.computeMs}ms ({whatIfResult.ensembleSeeds} seeds)
              </span>
            </div>

            {/* Divergence Detection Callout */}
            {whatIfResult.divergenceTick && (
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  marginBottom: "12px",
                  fontSize: "11.5px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, color: "#991B1B" }}>
                  <span>📍</span>
                  <span>
                    First Divergence Pinpointed at Tick #{whatIfResult.divergenceTick} (+
                    {((whatIfResult.divergenceTick - whatIfResult.startTick) * 0.1).toFixed(1)}s into window)
                  </span>
                </div>
                {whatIfResult.firstDivergenceEvent && (
                  <div style={{ color: "#7F1D1D", marginTop: "4px", fontSize: "11px", lineHeight: 1.4 }}>
                    <div><strong>Scenario Divergence:</strong> {whatIfResult.firstDivergenceEvent.scenarioEvent}</div>
                    <div><strong>Nominal Baseline:</strong> {whatIfResult.firstDivergenceEvent.baselineEvent}</div>
                  </div>
                )}
              </div>
            )}

            {/* Side-by-Side KPI Diff Table */}
            <div style={{ border: "1px solid #E2E8F0", borderRadius: "8px", overflow: "hidden", background: "#FFFFFF", marginBottom: "14px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11.5px" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", color: "#475569", fontWeight: 800 }}>
                    <th style={{ textAlign: "left", padding: "8px 10px" }}>Operational KPI</th>
                    <th style={{ textAlign: "right", padding: "8px 10px" }}>Baseline</th>
                    <th style={{ textAlign: "right", padding: "8px 10px" }}>Scenario</th>
                    <th style={{ textAlign: "right", padding: "8px 10px" }}>Net Impact (Δ)</th>
                    <th style={{ textAlign: "right", padding: "8px 10px" }}>Ensemble [Min – Max]</th>
                  </tr>
                </thead>
                <tbody>
                  {whatIfResult.metrics.map((m, idx) => {
                    const isGood = m.higherIsBetter ? m.delta > 0 : m.delta < 0;
                    const deltaColor = m.delta === 0 ? "#64748B" : isGood ? "#0C831F" : "#DC2626";
                    const deltaBg = m.delta === 0 ? "transparent" : isGood ? "rgba(12, 131, 31, 0.08)" : "rgba(220, 38, 38, 0.08)";
                    return (
                      <tr
                        key={m.key}
                        style={{
                          borderBottom: idx === whatIfResult.metrics.length - 1 ? "none" : "1px solid #F1F5F9",
                          background: idx % 2 === 0 ? "#FFFFFF" : "#FAFAFA",
                        }}
                      >
                        <td style={{ padding: "8px 10px", fontWeight: 600, color: "#1E293B" }}>{m.label}</td>
                        <td style={{ textAlign: "right", padding: "8px 10px", color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>
                          {m.baseline}
                        </td>
                        <td style={{ textAlign: "right", padding: "8px 10px", fontWeight: 800, color: "#0F172A", fontFamily: "'JetBrains Mono', monospace" }}>
                          {m.scenario}
                        </td>
                        <td style={{ textAlign: "right", padding: "8px 10px" }}>
                          <span
                            style={{
                              background: deltaBg,
                              color: deltaColor,
                              fontWeight: 800,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: "11px",
                            }}
                          >
                            {m.delta > 0 ? `+${m.delta}` : m.delta} {m.unit}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", padding: "8px 10px", color: "#64748B", fontSize: "10.5px", fontFamily: "'JetBrains Mono', monospace" }}>
                          {m.confidenceRange ? `[${m.confidenceRange.min} .. ${m.confidenceRange.max}]` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Risk & Payback Callout */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginBottom: "14px",
              }}
            >
              <div
                style={{
                  background: whatIfResult.financialImpactINR > 0 ? "#FEF2F2" : "#F0FDF4",
                  border: `1px solid ${whatIfResult.financialImpactINR > 0 ? "#FECACA" : "#BBF7D0"}`,
                  borderRadius: "8px",
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: "10.5px", fontWeight: 700, color: whatIfResult.financialImpactINR > 0 ? "#991B1B" : "#166534", textTransform: "uppercase" }}>
                  SLA Delay Penalty Risk
                </div>
                <div style={{ fontSize: "16px", fontWeight: 900, color: whatIfResult.financialImpactINR > 0 ? "#DC2626" : "#16A34A", marginTop: "2px" }}>
                  {whatIfResult.financialImpactINR > 0 ? `+₹${whatIfResult.financialImpactINR.toLocaleString("en-IN")}` : "₹0 Penalty Risk"}
                </div>
              </div>

              <div
                style={{
                  background: whatIfResult.paybackHorizonMonthsDelta < 0 ? "#F0FDF4" : "#FFFBEB",
                  border: `1px solid ${whatIfResult.paybackHorizonMonthsDelta < 0 ? "#BBF7D0" : "#FDE68A"}`,
                  borderRadius: "8px",
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: "10.5px", fontWeight: 700, color: whatIfResult.paybackHorizonMonthsDelta < 0 ? "#166534" : "#92400E", textTransform: "uppercase" }}>
                  Payback Horizon Delta
                </div>
                <div style={{ fontSize: "16px", fontWeight: 900, color: whatIfResult.paybackHorizonMonthsDelta < 0 ? "#16A34A" : "#D97706", marginTop: "2px" }}>
                  {whatIfResult.paybackHorizonMonthsDelta < 0
                    ? `${Math.abs(Number(whatIfResult.paybackHorizonMonthsDelta.toFixed(1)))} Months (Faster ROI)`
                    : `+${Number(whatIfResult.paybackHorizonMonthsDelta.toFixed(1))} Months Delay`}
                </div>
              </div>
            </div>

            {/* AI Recommendation Box */}
            <div
              style={{
                background: "#F0F9FF",
                border: "1px solid #BAE6FD",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "14px",
                fontSize: "12px",
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 800, color: "#0284C7", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>💡</span>
                <span>Grounded AI Operations Verdict:</span>
              </div>
              <div style={{ color: "#0C4A6E", fontWeight: 500 }}>{whatIfResult.recommendation}</div>
            </div>

            {/* Commit to Live Button */}
            <button
              onClick={applyWhatIfToLive}
              style={{
                width: "100%",
                background: "#F8CB46",
                color: "#1C1C1C",
                border: "none",
                borderRadius: "8px",
                padding: "12px",
                fontSize: "13px",
                fontWeight: 900,
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(248, 203, 70, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                transition: "all 0.15s ease",
              }}
            >
              <span>🚀</span>
              <span>Apply Validated Parameters to LIVE Operating Twin</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export default WhatIfDrawer;
