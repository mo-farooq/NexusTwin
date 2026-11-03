/**
 * NexusTwin Decision Sandbox & What-If Modal
 *
 * Interactive simulation control panel enabling Indian warehouse operators to:
 * 1. Chaos & Surge Testing: Trigger Festive Order Surge (3x), Block Aisle Paths with 3D barricades, and Force Bot Breakdowns.
 * 2. Vendor-Neutral Robot Profile Comparison: Evaluate Lite Tote Bot (1.2 m/s, ₹4.5L) vs Heavy Rack Mover (2.0 m/s, ₹9.5L).
 * 3. Editable INR CapEx & Payback Engine: Adjust Robot Count (5-30), Worker Wage (₹18,000/mo), Robot Cost, and SLA Penalties—
 *    calculating Output With vs Without Robots, Bottleneck Zones, and Payback Timeline in real-time from the running simulation.
 */

import React, { useState, useEffect } from "react";
import { useTwinStore, BOT_PROFILES } from "../../store/useTwinStore";

export function DecisionSandboxModal() {
  const isOpen = useTwinStore((s) => s.isSandboxModalOpen);
  const closeSandboxModal = useTwinStore((s) => s.closeSandboxModal);

  // Active Tab: "chaos" | "profiles" | "payback"
  const [activeTab, setActiveTab] = useState<"chaos" | "profiles" | "payback">("chaos");

  // Chaos & Surge Store Hooks
  const isFestiveSurgeActive = useTwinStore((s) => s.isFestiveSurgeActive);
  const injectFestiveSurge = useTwinStore((s) => s.injectFestiveSurge);
  const isObstaclePlacementActive = useTwinStore((s) => s.isObstaclePlacementActive);
  const toggleObstaclePlacementMode = useTwinStore((s) => s.toggleObstaclePlacementMode);
  const customObstacles = useTwinStore((s) => s.customObstacles);
  const clearFloorObstacles = useTwinStore((s) => s.clearFloorObstacles);
  const toggleFloorObstacle = useTwinStore((s) => s.toggleFloorObstacle);
  const breakdownBot = useTwinStore((s) => s.breakdownBot);
  const repairFleet = useTwinStore((s) => s.repairFleet);

  // Entities & Selection
  const botUnits = useTwinStore((s) => s.botUnits);
  const [selectedBotToFail, setSelectedBotToFail] = useState<string>("");

  // Profiles & Fleet Store Hooks
  const selectedFleetProfileId = useTwinStore((s) => s.selectedFleetProfileId);
  const setFleetProfile = useTwinStore((s) => s.setFleetProfile);

  // Financial & Decision Store Hooks
  const financialParams = useTwinStore((s) => s.financialParams);
  const updateFinancialParams = useTwinStore((s) => s.updateFinancialParams);
  const decisionMetrics = useTwinStore((s) => s.decisionMetrics);
  const kpi = useTwinStore((s) => s.kpi);
  const setFleetSize = useTwinStore((s) => s.setFleetSize);
  const autoSizeFleet = useTwinStore((s) => s.autoSizeFleet);

  // Local Editable Inputs
  const botCount = Object.keys(botUnits).length;
  const [localWage, setLocalWage] = useState(financialParams.laborMonthlySalaryINR);
  const [localRobotCostLakhs, setLocalRobotCostLakhs] = useState(
    financialParams.customRobotUnitCostINR
      ? financialParams.customRobotUnitCostINR / 100000
      : (BOT_PROFILES[selectedFleetProfileId]?.capexCostINR || 450000) / 100000
  );
  const [localSlaPenalty, setLocalSlaPenalty] = useState(financialParams.slaPenaltyPerMissedOrderINR);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSandboxModal();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeSandboxModal]);

  if (!isOpen) return null;

  const botsList = Object.values(botUnits);
  const liteProfile = BOT_PROFILES["LIGHT_PICKER"];
  const heavyProfile = BOT_PROFILES["HEAVY_PALLET"];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        backgroundColor: "rgba(15, 23, 42, 0.45)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSandboxModal();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "880px",
          maxHeight: "88vh",
          background: "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(20px)",
          borderRadius: "20px",
          border: "1px solid rgba(226, 232, 240, 0.9)",
          boxShadow: "0 25px 60px -12px rgba(15, 23, 42, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#FEF08A",
                color: "#854D0E",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                border: "1px solid #FDE047",
              }}
            >
              ⚡
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: 800,
                    color: "#0F172A",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Decision Sandbox & What-If Engine
                </h3>
                <span
                  style={{
                    background: "#0F172A",
                    color: "#F8CB46",
                    fontSize: "10px",
                    fontWeight: 800,
                    padding: "2px 7px",
                    borderRadius: "6px",
                  }}
                >
                  LIVE SIMULATION
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748B" }}>
                Stress-test peak Indian surges, evaluate vendor AMR profiles, and compute real-time INR payback.
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => closeSandboxModal()}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                border: "1px solid #E2E8F0",
                background: "#FFFFFF",
                color: "#64748B",
                fontSize: "14px",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div
          style={{
            padding: "0 24px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            gap: "24px",
            background: "#FFFFFF",
          }}
        >
          {[
            { id: "chaos", label: "🔥 Chaos & Surge Injectors", desc: "Surge, Block Path, Breakdowns" },
            { id: "profiles", label: "🤖 Vendor AMR Profiles", desc: "Lite Tote Bot vs Heavy Mover" },
            { id: "payback", label: "💰 INR CapEx & Payback", desc: "ROI, Breakeven & Bottleneck" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: "12px 4px",
                border: "none",
                background: "transparent",
                borderBottom: activeTab === tab.id ? "3px solid #F8CB46" : "3px solid transparent",
                color: activeTab === tab.id ? "#0F172A" : "#64748B",
                fontWeight: activeTab === tab.id ? 800 : 600,
                fontSize: "13px",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Modal Scrollable Body */}
        <div
          style={{
            padding: "24px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          {/* ═════════════════════════════════════════════════════════ */}
          {/* TAB 1: CHAOS & SURGE INJECTORS                           */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "chaos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Surge Injector Card */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  border: isFestiveSurgeActive ? "1.5px solid #FCA5A5" : "1px solid #E2E8F0",
                  background: isFestiveSurgeActive ? "#FEF2F2" : "#F8FAFC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "20px" }}>🔥</span>
                    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0F172A" }}>
                      Festive Order Surge (3x Load)
                    </h4>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: 800,
                        background: isFestiveSurgeActive ? "#EF4444" : "#E2E8F0",
                        color: isFestiveSurgeActive ? "#FFFFFF" : "#64748B",
                      }}
                    >
                      {isFestiveSurgeActive ? "ACTIVE (3x LOAD)" : "NOMINAL"}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0 28px", fontSize: "12px", color: "#64748B", maxWidth: "480px" }}>
                    Simulates Indian festival surges (Diwali flash sales, weekend grocery peaks) by injecting +30 flash
                    orders and tripling task arrival rates.
                  </p>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => injectFestiveSurge(30, 3)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#EF4444",
                      color: "#FFFFFF",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                      boxShadow: "0 4px 10px rgba(239, 68, 68, 0.25)",
                    }}
                  >
                    🔥 Trigger 3x Surge
                  </button>
                </div>
              </div>

              {/* Block Aisle Path Card */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  border: isObstaclePlacementActive ? "1.5px solid #FDBA74" : "1px solid #E2E8F0",
                  background: isObstaclePlacementActive ? "#FFF7ED" : "#F8FAFC",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "20px" }}>🚧</span>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0F172A" }}>
                        Block Aisle Path (Interactive 3D Obstacle)
                      </h4>
                      <span
                        style={{
                          padding: "2px 6px",
                          borderRadius: "6px",
                          fontSize: "10px",
                          fontWeight: 800,
                          background: isObstaclePlacementActive ? "#F97316" : "#E2E8F0",
                          color: isObstaclePlacementActive ? "#FFFFFF" : "#64748B",
                        }}
                      >
                        {isObstaclePlacementActive ? "CLICK FLOOR TO DROP" : `${customObstacles.length} BLOCKED`}
                      </span>
                    </div>
                    <p style={{ margin: "4px 0 0 28px", fontSize: "12px", color: "#64748B" }}>
                      Drop hazard barricades directly onto transit aisles in the 3D facility. Approaching BotUnits
                      detect the blocked cell and trigger live A* path recalculation.
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => toggleObstaclePlacementMode()}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "8px",
                        border: isObstaclePlacementActive ? "1px solid #C2410C" : "1px solid #E2E8F0",
                        background: isObstaclePlacementActive ? "#EA580C" : "#FFFFFF",
                        color: isObstaclePlacementActive ? "#FFFFFF" : "#0F172A",
                        fontWeight: 700,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      {isObstaclePlacementActive ? "Done Placing" : "Place Obstacles on Floor"}
                    </button>
                    {customObstacles.length > 0 && (
                      <button
                        onClick={() => clearFloorObstacles()}
                        style={{
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px solid #E2E8F0",
                          background: "#FFFFFF",
                          color: "#64748B",
                          fontWeight: 700,
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        Clear All ({customObstacles.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Placed Obstacles List */}
                {customObstacles.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", paddingTop: "8px" }}>
                    {customObstacles.map((obs) => (
                      <div
                        key={obs.id}
                        onClick={() => toggleFloorObstacle(obs.col, obs.row)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 8px",
                          borderRadius: "6px",
                          background: "#FFFFFF",
                          border: "1px solid #FED7AA",
                          color: "#C2410C",
                          fontSize: "11px",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <span>🚧 Cell ({obs.col}, {obs.row})</span>
                        <span style={{ color: "#EF4444" }}>✕</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bot Breakdown Card */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  border: "1px solid #E2E8F0",
                  background: "#F8FAFC",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "20px" }}>🔋</span>
                    <h4 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0F172A" }}>
                      Force Bot Breakdown
                    </h4>
                  </div>
                  <p style={{ margin: "4px 0 0 28px", fontSize: "12px", color: "#64748B" }}>
                    Force an unexpected hardware failure on a specific AMR. Watch its health drop to 0%, the status LED turn red,
                    and its current task get re-queued to another idle robot.
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <select
                    value={selectedBotToFail}
                    onChange={(e) => setSelectedBotToFail(e.target.value)}
                    style={{
                      padding: "7px 10px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#0F172A",
                    }}
                  >
                    <option value="">First Active Bot</option>
                    {botsList.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.id} ({b.status})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => breakdownBot(selectedBotToFail || undefined)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#DC2626",
                      color: "#FFFFFF",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Breakdown
                  </button>
                  <button
                    onClick={() => repairFleet()}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #BBF7D0",
                      background: "#F0FDF4",
                      color: "#166534",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                    }}
                  >
                    Repair All
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* TAB 2: VENDOR-NEUTRAL ROBOT PROFILE SWITCHER             */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "profiles" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                }}
              >
                {/* Profile Card 1: Lite Tote Bot */}
                <div
                  style={{
                    padding: "18px",
                    borderRadius: "16px",
                    border: selectedFleetProfileId === "LIGHT_PICKER" ? "2px solid #F59E0B" : "1px solid #E2E8F0",
                    background: selectedFleetProfileId === "LIGHT_PICKER" ? "#FFFBEB" : "#FFFFFF",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px",
                    boxShadow: selectedFleetProfileId === "LIGHT_PICKER" ? "0 8px 24px rgba(245, 158, 11, 0.15)" : "none",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span
                        style={{
                          background: "#F8CB46",
                          color: "#0F172A",
                          fontSize: "10px",
                          fontWeight: 900,
                          padding: "2px 8px",
                          borderRadius: "6px",
                        }}
                      >
                        QUICK-COMMERCE SPEC
                      </span>
                      {selectedFleetProfileId === "LIGHT_PICKER" && (
                        <span style={{ color: "#16A34A", fontSize: "11px", fontWeight: 800 }}>● DEPLOYED</span>
                      )}
                    </div>
                    <h4 style={{ margin: "8px 0 2px 0", fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
                      {liteProfile.name}
                    </h4>
                    <span style={{ fontSize: "12px", color: "#64748B" }}>{liteProfile.vendor}</span>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "14px" }}>
                      <div style={{ background: "#F8FAFC", padding: "8px", borderRadius: "8px" }}>
                        <div style={{ fontSize: "10px", color: "#64748B", fontWeight: 600 }}>TOP SPEED</div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: "#0F172A" }}>1.2 m/s</div>
                      </div>
                      <div style={{ background: "#F8FAFC", padding: "8px", borderRadius: "8px" }}>
                        <div style={{ fontSize: "10px", color: "#64748B", fontWeight: 600 }}>PAYLOAD</div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: "#0F172A" }}>100 kg</div>
                      </div>
                      <div style={{ background: "#F8FAFC", padding: "8px", borderRadius: "8px" }}>
                        <div style={{ fontSize: "10px", color: "#64748B", fontWeight: 600 }}>UNIT CAPEX</div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: "#0F172A" }}>₹4.50 Lakhs</div>
                      </div>
                      <div style={{ background: "#F8FAFC", padding: "8px", borderRadius: "8px" }}>
                        <div style={{ fontSize: "10px", color: "#64748B", fontWeight: 600 }}>BATTERY PACK</div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: "#0F172A" }}>1,200 Wh</div>
                      </div>
                    </div>

                    <p style={{ margin: "12px 0 0 0", fontSize: "11px", color: "#64748B", lineHeight: 1.4 }}>
                      Optimized for Blinkit / Zepto FMCG dark stores: agile aisle turns, rapid tote shuttling, and rapid 15-minute top-ups.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setFleetProfile("LIGHT_PICKER");
                      setLocalRobotCostLakhs(4.5);
                      updateFinancialParams({ customRobotUnitCostINR: 450000 });
                    }}
                    disabled={selectedFleetProfileId === "LIGHT_PICKER"}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "10px",
                      border: "none",
                      background: selectedFleetProfileId === "LIGHT_PICKER" ? "#E2E8F0" : "#F59E0B",
                      color: selectedFleetProfileId === "LIGHT_PICKER" ? "#64748B" : "#0F172A",
                      fontWeight: 800,
                      fontSize: "12px",
                      cursor: selectedFleetProfileId === "LIGHT_PICKER" ? "default" : "pointer",
                    }}
                  >
                    {selectedFleetProfileId === "LIGHT_PICKER" ? "Currently Active on Floor" : "Deploy Lite Tote Fleet"}
                  </button>
                </div>

                {/* Profile Card 2: Heavy Rack Mover */}
                <div
                  style={{
                    padding: "18px",
                    borderRadius: "16px",
                    border: selectedFleetProfileId === "HEAVY_PALLET" ? "2px solid #2563EB" : "1px solid #E2E8F0",
                    background: selectedFleetProfileId === "HEAVY_PALLET" ? "#EFF6FF" : "#FFFFFF",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px",
                    boxShadow: selectedFleetProfileId === "HEAVY_PALLET" ? "0 8px 24px rgba(37, 99, 235, 0.15)" : "none",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span
                        style={{
                          background: "#3B82F6",
                          color: "#FFFFFF",
                          fontSize: "10px",
                          fontWeight: 900,
                          padding: "2px 8px",
                          borderRadius: "6px",
                        }}
                      >
                        3PL & PALLET SPEC
                      </span>
                      {selectedFleetProfileId === "HEAVY_PALLET" && (
                        <span style={{ color: "#2563EB", fontSize: "11px", fontWeight: 800 }}>● DEPLOYED</span>
                      )}
                    </div>
                    <h4 style={{ margin: "8px 0 2px 0", fontSize: "16px", fontWeight: 800, color: "#0F172A" }}>
                      {heavyProfile.name}
                    </h4>
                    <span style={{ fontSize: "12px", color: "#64748B" }}>{heavyProfile.vendor}</span>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "14px" }}>
                      <div style={{ background: "#F8FAFC", padding: "8px", borderRadius: "8px" }}>
                        <div style={{ fontSize: "10px", color: "#64748B", fontWeight: 600 }}>TOP SPEED</div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: "#0F172A" }}>2.0 m/s</div>
                      </div>
                      <div style={{ background: "#F8FAFC", padding: "8px", borderRadius: "8px" }}>
                        <div style={{ fontSize: "10px", color: "#64748B", fontWeight: 600 }}>PAYLOAD</div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: "#0F172A" }}>1,000 kg</div>
                      </div>
                      <div style={{ background: "#F8FAFC", padding: "8px", borderRadius: "8px" }}>
                        <div style={{ fontSize: "10px", color: "#64748B", fontWeight: 600 }}>UNIT CAPEX</div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: "#0F172A" }}>₹9.50 Lakhs</div>
                      </div>
                      <div style={{ background: "#F8FAFC", padding: "8px", borderRadius: "8px" }}>
                        <div style={{ fontSize: "10px", color: "#64748B", fontWeight: 600 }}>BATTERY PACK</div>
                        <div style={{ fontSize: "15px", fontWeight: 800, color: "#0F172A" }}>3,500 Wh</div>
                      </div>
                    </div>

                    <p style={{ margin: "12px 0 0 0", fontSize: "11px", color: "#64748B", lineHeight: 1.4 }}>
                      High-torque industrial chassis for 3PL Regional Hubs: entire shelf racks, bulk corrugated cartons, and pallet transfer.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setFleetProfile("HEAVY_PALLET");
                      setLocalRobotCostLakhs(9.5);
                      updateFinancialParams({ customRobotUnitCostINR: 950000 });
                    }}
                    disabled={selectedFleetProfileId === "HEAVY_PALLET"}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: "10px",
                      border: "none",
                      background: selectedFleetProfileId === "HEAVY_PALLET" ? "#E2E8F0" : "#2563EB",
                      color: selectedFleetProfileId === "HEAVY_PALLET" ? "#64748B" : "#FFFFFF",
                      fontWeight: 800,
                      fontSize: "12px",
                      cursor: selectedFleetProfileId === "HEAVY_PALLET" ? "default" : "pointer",
                    }}
                  >
                    {selectedFleetProfileId === "HEAVY_PALLET" ? "Currently Active on Floor" : "Deploy Heavy Mover Fleet"}
                  </button>
                </div>
              </div>

              {/* Live Side-by-Side Comparison Matrix */}
              <div
                style={{
                  background: "#F8FAFC",
                  borderRadius: "14px",
                  padding: "16px",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "10px" }}>
                  Live Facility Impact Comparison (Same Layout)
                </div>
                <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "#64748B", borderBottom: "1px solid #E2E8F0", textAlign: "left" }}>
                      <th style={{ padding: "6px 0" }}>Operational Parameter</th>
                      <th style={{ padding: "6px 0" }}>Lite Tote Bot</th>
                      <th style={{ padding: "6px 0" }}>Heavy Rack Mover</th>
                      <th style={{ padding: "6px 0" }}>Variance / Trade-off</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "8px 0", fontWeight: 600 }}>Top Velocity</td>
                      <td>1.2 m/s</td>
                      <td style={{ fontWeight: 700, color: "#2563EB" }}>2.0 m/s</td>
                      <td style={{ color: "#16A34A", fontWeight: 700 }}>+67% faster transit</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "8px 0", fontWeight: 600 }}>Payload Capacity</td>
                      <td>100 kg</td>
                      <td style={{ fontWeight: 700, color: "#2563EB" }}>1,000 kg</td>
                      <td style={{ color: "#16A34A", fontWeight: 700 }}>10x load capacity</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "8px 0", fontWeight: 600 }}>Unit CapEx</td>
                      <td style={{ fontWeight: 700, color: "#16A34A" }}>₹4.50 Lakhs</td>
                      <td>₹9.50 Lakhs</td>
                      <td style={{ color: "#64748B" }}>-53% lower upfront cost</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "8px 0", fontWeight: 600 }}>Estimated Breakeven</td>
                      <td style={{ fontWeight: 700, color: "#16A34A" }}>~11.4 Months</td>
                      <td>~16.2 Months</td>
                      <td style={{ color: "#64748B" }}>Faster initial ROI horizon</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════ */}
          {/* TAB 3: EDITABLE INR CAPEX & PAYBACK ENGINE               */}
          {/* ═════════════════════════════════════════════════════════ */}
          {activeTab === "payback" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Simulation Verdict Banner */}
              <div
                style={{
                  padding: "14px 18px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)",
                  border: "1.5px solid #FCD34D",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  boxShadow: "0 2px 8px rgba(245, 158, 11, 0.12)",
                }}
              >
                <span style={{ fontSize: "22px" }}>💡</span>
                <div style={{ fontSize: "12px", color: "#854D0E", lineHeight: 1.5 }}>
                  <b>Simulation Verdict:</b> Deploying <b>{botCount} {selectedFleetProfileId === "LIGHT_PICKER" ? "Lite Tote Bots" : "Heavy Rack Movers"}</b> (₹{(decisionMetrics.totalFleetCapexINR / 100000).toFixed(1)}L CapEx) achieves <b>{decisionMetrics.automatedThroughputPerHour} orders/hr</b> ({decisionMetrics.throughputGainPct > 0 ? `+${decisionMetrics.throughputGainPct}%` : ""} vs manual baseline) with <b>{kpi.slaCompliancePct.toFixed(1)}% SLA compliance</b> and pays back in <b>{decisionMetrics.paybackPeriodMonths} Months</b>. Primary constraint: <b>{decisionMetrics.bottleneckZoneName}</b> ({decisionMetrics.bottleneckCongestionPct}% traffic density).
                </div>
              </div>

              {/* Top Row: Live Decision Intelligence Highlights */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                {/* Highlight 1: Output With vs Without */}
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    padding: "14px",
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>OUTPUT: AMR VS MANUAL</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
                    <span style={{ fontSize: "22px", fontWeight: 900, color: "#0F172A" }}>
                      {decisionMetrics.automatedThroughputPerHour}
                    </span>
                    <span style={{ fontSize: "12px", color: "#64748B" }}>vs {decisionMetrics.manualEstimatedThroughputPerHour} /hr</span>
                  </div>
                  <div
                    style={{
                      marginTop: "6px",
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: "#DCFCE7",
                      color: "#166534",
                      fontSize: "11px",
                      fontWeight: 800,
                    }}
                  >
                    +{decisionMetrics.throughputGainPct}% Throughput Gain
                  </div>
                </div>

                {/* Highlight 2: Bottleneck Zone */}
                <div
                  style={{
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: "14px",
                    padding: "14px",
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>PRIMARY BOTTLENECK ZONE</div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
                    {decisionMetrics.bottleneckZoneName}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                    <div style={{ flex: 1, height: "6px", background: "#E2E8F0", borderRadius: "3px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${decisionMetrics.bottleneckCongestionPct}%`,
                          background: decisionMetrics.bottleneckCongestionPct > 60 ? "#EF4444" : "#F59E0B",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 800, color: "#64748B" }}>
                      {decisionMetrics.bottleneckCongestionPct}% Congestion
                    </span>
                  </div>
                </div>

                {/* Highlight 3: Estimated Payback */}
                <div
                  style={{
                    background: "linear-gradient(135deg, #FEF08A 0%, #FDE047 100%)",
                    border: "1px solid #FACC15",
                    borderRadius: "14px",
                    padding: "14px",
                    boxShadow: "0 4px 12px rgba(234, 179, 8, 0.2)",
                  }}
                >
                  <div style={{ fontSize: "11px", fontWeight: 800, color: "#854D0E" }}>ESTIMATED PAYBACK PERIOD</div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "4px" }}>
                    <span style={{ fontSize: "24px", fontWeight: 900, color: "#0F172A" }}>
                      {decisionMetrics.paybackPeriodMonths}
                    </span>
                    <span style={{ fontSize: "14px", fontWeight: 800, color: "#0F172A" }}>Months</span>
                  </div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#854D0E", marginTop: "4px" }}>
                    Net ₹{(decisionMetrics.netMonthlySavingsINR / 100000).toFixed(2)}L/mo savings ({decisionMetrics.threeYearRoiPct}% 3Y ROI)
                  </div>
                </div>
              </div>

              {/* Editable Inputs Form */}
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: "16px",
                  border: "1px solid #E2E8F0",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A" }}>
                  Adjust Investment & Financial Assumptions (India Context)
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  {/* Input 1: Robot Count (5 to 30) */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                      <span style={{ color: "#475569" }}>Active Fleet Size (Robots)</span>
                      <span style={{ color: "#0F172A" }}>{botCount} Bots</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={36}
                      step={1}
                      value={botCount}
                      onChange={(e) => setFleetSize(Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#F59E0B" }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#94A3B8" }}>
                      <span>2 Bots (Micro Store)</span>
                      <span>12 (Standard Hub)</span>
                      <span>36 (Mega DC)</span>
                    </div>

                    <button
                      onClick={autoSizeFleet}
                      style={{
                        marginTop: "8px",
                        width: "100%",
                        padding: "6px 10px",
                        background: "#EFF6FF",
                        border: "1px solid #BFDBFE",
                        borderRadius: "8px",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "#1D4ED8",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>✨</span> Auto-Size Fleet to Facility Dimensions
                    </button>
                  </div>

                  {/* Input 2: Manual Worker Wage (₹18,000/mo) */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                      <span style={{ color: "#475569" }}>Manual Picker Salary (₹/month)</span>
                      <span style={{ color: "#0F172A" }}>₹{localWage.toLocaleString("en-IN")}</span>
                    </div>
                    <input
                      type="number"
                      step={1000}
                      min={12000}
                      max={45000}
                      value={localWage}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalWage(val);
                        updateFinancialParams({ laborMonthlySalaryINR: val });
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#0F172A",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Input 3: Robot Unit CapEx (₹ Lakhs) */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                      <span style={{ color: "#475569" }}>Robot Unit Cost (₹ Lakhs)</span>
                      <span style={{ color: "#0F172A" }}>₹{localRobotCostLakhs.toFixed(2)}L</span>
                    </div>
                    <input
                      type="number"
                      step={0.5}
                      min={2.0}
                      max={30.0}
                      value={localRobotCostLakhs}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalRobotCostLakhs(val);
                        updateFinancialParams({ customRobotUnitCostINR: val * 100000 });
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#0F172A",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Input 4: SLA Penalty Cost */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, marginBottom: "6px" }}>
                      <span style={{ color: "#475569" }}>SLA Penalty Cost (₹/delayed order)</span>
                      <span style={{ color: "#0F172A" }}>₹{localSlaPenalty}</span>
                    </div>
                    <input
                      type="number"
                      step={25}
                      min={50}
                      max={1000}
                      value={localSlaPenalty}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setLocalSlaPenalty(val);
                        updateFinancialParams({ slaPenaltyPerMissedOrderINR: val });
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#0F172A",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Financial Breakdown Table */}
              <div
                style={{
                  background: "#F8FAFC",
                  borderRadius: "14px",
                  padding: "16px",
                  border: "1px solid #E2E8F0",
                }}
              >
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#0F172A", marginBottom: "8px" }}>
                  Financial Breakdown Summary
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #E2E8F0" }}>
                    <span style={{ color: "#64748B" }}>Total CapEx Investment:</span>
                    <span style={{ fontWeight: 800, color: "#0F172A" }}>
                      ₹{(decisionMetrics.totalFleetCapexINR / 100000).toFixed(2)} Lakhs
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #E2E8F0" }}>
                    <span style={{ color: "#64748B" }}>Equivalent Manual Pickers Replaced:</span>
                    <span style={{ fontWeight: 800, color: "#0F172A" }}>
                      {decisionMetrics.equivalentManualPickers} Pickers (2 Shifts)
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #E2E8F0" }}>
                    <span style={{ color: "#64748B" }}>Monthly Labor Cost Replaced:</span>
                    <span style={{ fontWeight: 800, color: "#16A34A" }}>
                      +₹{decisionMetrics.monthlyManualLaborCostINR.toLocaleString("en-IN")}/mo
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #E2E8F0" }}>
                    <span style={{ color: "#64748B" }}>Monthly SLA Penalty Savings:</span>
                    <span style={{ fontWeight: 800, color: "#16A34A" }}>
                      +₹{decisionMetrics.monthlySlaPenaltySavingsINR.toLocaleString("en-IN")}/mo
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                    <span style={{ color: "#64748B" }}>Robot Opex (Maint + Power):</span>
                    <span style={{ fontWeight: 800, color: "#DC2626" }}>
                      -₹{decisionMetrics.monthlyRobotOpexINR.toLocaleString("en-IN")}/mo
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
                    <span style={{ color: "#0F172A", fontWeight: 800 }}>Net Monthly Savings:</span>
                    <span style={{ fontWeight: 900, color: "#0F172A" }}>
                      ₹{decisionMetrics.netMonthlySavingsINR.toLocaleString("en-IN")}/mo
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC",
          }}
        >
          <div style={{ fontSize: "11px", color: "#64748B" }}>
            All calculations synchronize live with the running 3D facility simulation.
          </div>
          <button
            onClick={() => closeSandboxModal()}
            style={{
              padding: "8px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#0F172A",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Close Sandbox
          </button>
        </div>
      </div>
    </div>
  );
}

export default DecisionSandboxModal;
