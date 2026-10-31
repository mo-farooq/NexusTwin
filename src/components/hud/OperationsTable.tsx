/**
 * NexusTwin Operations Table HUD
 *
 * Bottom-right tabbed glassmorphism panel (Fleet, Zones, Orders).
 * Selecting any table row immediately highlights the entity and smoothly
 * lerps the 3D camera focus to its exact warehouse coordinates.
 */

import React, { useState } from "react";
import { useTwinStore } from "../../store/useTwinStore";

type TableTab = "FLEET" | "ZONES" | "ORDERS";

export function OperationsTable() {
  const [activeTab, setActiveTab] = useState<TableTab>("FLEET");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const botUnits = useTwinStore((s) => s.botUnits);
  const zones = useTwinStore((s) => s.zones);
  const tasks = useTwinStore((s) => s.tasks);
  const selectedBotId = useTwinStore((s) => s.selectedBotId);
  const selectBot = useTwinStore((s) => s.selectBot);
  const setFocusTarget = useTwinStore((s) => s.setFocusTarget);

  const allBots = Object.values(botUnits);
  const allZones = Object.values(zones);
  const allTasks = Object.values(tasks);

  const handleBotRowClick = (botId: string) => {
    selectBot(botId);
    const b = botUnits[botId];
    if (b) {
      setFocusTarget([b.position[0], 0.6, b.position[2]]);
    }
  };

  const handleZoneRowClick = (zoneId: string) => {
    const z = zones[zoneId];
    if (z) {
      const midX = (z.bounds[0] + z.bounds[2]) / 2;
      const midZ = (z.bounds[1] + z.bounds[3]) / 2;
      setFocusTarget([midX, 0.5, midZ]);
    }
  };

  const handleTaskRowClick = (taskId: string) => {
    const t = tasks[taskId];
    if (t) {
      if (t.assignedBotId) {
        selectBot(t.assignedBotId);
      } else {
        setFocusTarget([t.sourceCoords[0], 0.6, t.sourceCoords[1]]);
      }
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: "16px",
        right: "16px",
        zIndex: 20,
        width: "430px",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(14px)",
        border: "1px solid rgba(226, 232, 240, 0.9)",
        borderRadius: "14px",
        boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        pointerEvents: "auto",
        transition: "height 0.2s ease",
      }}
    >
      {/* Tab Navigation Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          borderBottom: "1px solid #F1F5F9",
          background: "#F8FAFC",
        }}
      >
        <div style={{ display: "flex", gap: "4px" }}>
          {(["FLEET", "ZONES", "ORDERS"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setIsCollapsed(false);
              }}
              style={{
                border: "none",
                background: activeTab === tab && !isCollapsed ? "#FFFFFF" : "transparent",
                color: activeTab === tab && !isCollapsed ? "#0F172A" : "#64748B",
                fontWeight: 800,
                fontSize: "11px",
                padding: "6px 10px",
                borderRadius: "8px",
                cursor: "pointer",
                boxShadow:
                  activeTab === tab && !isCollapsed
                    ? "0 2px 4px rgba(15, 23, 42, 0.06)"
                    : "none",
              }}
            >
              {tab === "FLEET"
                ? `Fleet (${allBots.length})`
                : tab === "ZONES"
                ? `Zones (${allZones.length})`
                : `Orders (${allTasks.length})`}
            </button>
          ))}
        </div>

        {/* Collapse / Expand Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "#64748B",
            fontSize: "12px",
            padding: "4px",
          }}
          title={isCollapsed ? "Expand panel" : "Collapse panel"}
        >
          {isCollapsed ? "▲" : "▼"}
        </button>
      </div>

      {/* Table Content */}
      {!isCollapsed && (
        <div style={{ maxHeight: "210px", overflowY: "auto", fontSize: "11px" }}>
          {/* TAB 1: FLEET TABLE */}
          {activeTab === "FLEET" && (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ color: "#64748B", borderBottom: "1px solid #F1F5F9", background: "#F8FAFC" }}>
                  <th style={{ padding: "8px 12px", fontWeight: 700 }}>UNIT ID</th>
                  <th style={{ padding: "8px 6px", fontWeight: 700 }}>STATUS</th>
                  <th style={{ padding: "8px 6px", fontWeight: 700 }}>BATTERY</th>
                  <th style={{ padding: "8px 6px", fontWeight: 700 }}>SPEED</th>
                  <th style={{ padding: "8px 12px", fontWeight: 700 }}>LOAD</th>
                </tr>
              </thead>
              <tbody>
                {allBots.map((bot) => {
                  const isSelected = selectedBotId === bot.id;
                  return (
                    <tr
                      key={bot.id}
                      onClick={() => handleBotRowClick(bot.id)}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        cursor: "pointer",
                        background: isSelected ? "rgba(248, 203, 70, 0.15)" : "transparent",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = "#F8FAFC";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <td style={{ padding: "7px 12px", fontWeight: 700, color: "#0F172A" }}>
                        {bot.id}
                      </td>
                      <td style={{ padding: "7px 6px" }}>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 800,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background:
                              bot.status === "ACTIVE"
                                ? "#ECFDF5"
                                : bot.status === "CHARGING"
                                ? "#EFF6FF"
                                : "#FFFBEB",
                            color:
                              bot.status === "ACTIVE"
                                ? "#059669"
                                : bot.status === "CHARGING"
                                ? "#2563EB"
                                : "#D97706",
                          }}
                        >
                          {bot.status}
                        </span>
                      </td>
                      <td style={{ padding: "7px 6px", fontWeight: 600, color: bot.batteryPct < 20 ? "#EF4444" : "#10B981" }}>
                        {Math.round(bot.batteryPct)}%
                      </td>
                      <td style={{ padding: "7px 6px", color: "#64748B" }}>
                        {bot.velocity.toFixed(1)} m/s
                      </td>
                      <td style={{ padding: "7px 12px", color: bot.currentPayloadKg > 0 ? "#D97706" : "#94A3B8" }}>
                        {bot.currentPayloadKg > 0 ? `${bot.currentPayloadKg}kg` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* TAB 2: ZONES TABLE */}
          {activeTab === "ZONES" && (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ color: "#64748B", borderBottom: "1px solid #F1F5F9", background: "#F8FAFC" }}>
                  <th style={{ padding: "8px 12px", fontWeight: 700 }}>ZONE</th>
                  <th style={{ padding: "8px 6px", fontWeight: 700 }}>UNITS</th>
                  <th style={{ padding: "8px 6px", fontWeight: 700 }}>CONGESTION</th>
                  <th style={{ padding: "8px 12px", fontWeight: 700 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {allZones.map((z) => (
                  <tr
                    key={z.id}
                    onClick={() => handleZoneRowClick(z.id)}
                    style={{
                      borderBottom: "1px solid #F1F5F9",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "8px 12px", fontWeight: 700, color: "#0F172A" }}>
                      <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "2px", background: z.color, marginRight: "6px" }} />
                      {z.name}
                    </td>
                    <td style={{ padding: "8px 6px", fontWeight: 600 }}>{z.botCount} bots</td>
                    <td style={{ padding: "8px 6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "50px", height: "6px", background: "#E2E8F0", borderRadius: "9999px", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${Math.round(z.congestionScore * 100)}%`,
                              height: "100%",
                              background: z.congestionScore > 0.6 ? "#EF4444" : "#10B981",
                            }}
                          />
                        </div>
                        <span>{Math.round(z.congestionScore * 100)}%</span>
                      </div>
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, color: z.isBlocked ? "#EF4444" : "#059669" }}>
                        {z.isBlocked ? "BLOCKED" : "OPTIMAL"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* TAB 3: ORDERS TABLE */}
          {activeTab === "ORDERS" && (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ color: "#64748B", borderBottom: "1px solid #F1F5F9", background: "#F8FAFC" }}>
                  <th style={{ padding: "8px 12px", fontWeight: 700 }}>ORDER ID</th>
                  <th style={{ padding: "8px 6px", fontWeight: 700 }}>PRIORITY</th>
                  <th style={{ padding: "8px 6px", fontWeight: 700 }}>SOURCE ➔ DEST</th>
                  <th style={{ padding: "8px 12px", fontWeight: 700 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {allTasks.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "16px", textAlign: "center", color: "#94A3B8" }}>
                      No active orders in queue.
                    </td>
                  </tr>
                ) : (
                  allTasks.slice(0, 15).map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => handleTaskRowClick(t.id)}
                      style={{
                        borderBottom: "1px solid #F1F5F9",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "7px 12px", fontWeight: 700, color: "#0F172A" }}>
                        {t.id}
                      </td>
                      <td style={{ padding: "7px 6px" }}>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 800,
                            padding: "2px 5px",
                            borderRadius: "4px",
                            background:
                              t.priority === "FLASH_SURGE"
                                ? "#FEF08A"
                                : t.priority === "HIGH"
                                ? "#FEE2E2"
                                : "#F1F5F9",
                            color:
                              t.priority === "FLASH_SURGE"
                                ? "#854D0E"
                                : t.priority === "HIGH"
                                ? "#DC2626"
                                : "#475569",
                          }}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td style={{ padding: "7px 6px", color: "#334155" }}>
                        {t.sourceLocId.replace("SHELF-", "")} ➔ {t.destLocId.replace("PACK-STATION-", "P")}
                      </td>
                      <td style={{ padding: "7px 12px" }}>
                        <span
                          style={{
                            fontWeight: 700,
                            color:
                              t.status === "COMPLETED"
                                ? "#10B981"
                                : t.status === "IN_PROGRESS"
                                ? "#3B82F6"
                                : "#F59E0B",
                          }}
                        >
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default OperationsTable;
