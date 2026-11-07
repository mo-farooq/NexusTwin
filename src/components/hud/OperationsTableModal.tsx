/**
 * NexusTwin Operations Table Modal
 *
 * Full-screen SCADA Operations Registry & Dispatch Modal:
 * - Tabbed management: Fleet Units, Storage Zones, and Live Order Tasks
 * - Search by Unit ID, Zone Name, Order ID, or Status
 * - CSV Export capability for operational audit
 * - Click-to-focus 3D camera navigation to any asset in the warehouse
 */

import React, { useState, useMemo } from "react";
import { useTwinStore } from "../../store/useTwinStore";

type TabMode = "FLEET" | "ZONES" | "ORDERS";

export function OperationsTableModal() {
  const isOpen = useTwinStore((s) => s.modal === "tasks");
  const setModal = useTwinStore((s) => s.setModal);
  const closeModal = () => {
    setModal(null);
    if (typeof window !== "undefined" && (window.location.hash.includes("operations") || window.location.hash.includes("tasks") || window.location.hash.includes("table"))) {
      window.location.hash = "#operator";
    }
  };
  const botUnits = useTwinStore((s) => s.botUnits);
  const zones = useTwinStore((s) => s.zones);
  const tasks = useTwinStore((s) => s.tasks);
  const selectedBotId = useTwinStore((s) => s.selectedBotId);
  const selectBot = useTwinStore((s) => s.selectBot);
  const setFocusTarget = useTwinStore((s) => s.setFocusTarget);

  const [activeTab, setActiveTab] = useState<TabMode>("FLEET");
  const [searchQuery, setSearchQuery] = useState("");

  const allBots = useMemo(() => Object.values(botUnits), [botUnits]);
  const allZones = useMemo(() => Object.values(zones), [zones]);
  const allTasks = useMemo(() => Object.values(tasks), [tasks]);

  const filteredBots = useMemo(() => {
    if (!searchQuery) return allBots;
    const q = searchQuery.toLowerCase();
    return allBots.filter(
      (b) =>
        b.id.toLowerCase().includes(q) ||
        b.status.toLowerCase().includes(q) ||
        (b.perception?.state && b.perception.state.toLowerCase().includes(q))
    );
  }, [allBots, searchQuery]);

  const filteredZones = useMemo(() => {
    if (!searchQuery) return allZones;
    const q = searchQuery.toLowerCase();
    return allZones.filter(
      (z) =>
        z.id.toLowerCase().includes(q) ||
        z.name.toLowerCase().includes(q) ||
        (z.isBlocked ? "blocked" : "optimal").includes(q)
    );
  }, [allZones, searchQuery]);

  const filteredTasks = useMemo(() => {
    if (!searchQuery) return allTasks;
    const q = searchQuery.toLowerCase();
    return allTasks.filter(
      (t) =>
        t.id.toLowerCase().includes(q) ||
        t.priority.toLowerCase().includes(q) ||
        t.status.toLowerCase().includes(q) ||
        (t.assignedBotId && t.assignedBotId.toLowerCase().includes(q)) ||
        t.sourceLocId.toLowerCase().includes(q)
    );
  }, [allTasks, searchQuery]);

  if (!isOpen) return null;

  const handleFocusBot = (botId: string) => {
    selectBot(botId);
    const b = botUnits[botId];
    if (b) {
      setFocusTarget([b.position[0], 0.6, b.position[2]]);
    }
    closeModal();
  };

  const handleFocusZone = (zoneId: string) => {
    const z = zones[zoneId];
    if (z) {
      const midX = (z.bounds[0] + z.bounds[2]) / 2;
      const midZ = (z.bounds[1] + z.bounds[3]) / 2;
      setFocusTarget([midX, 0.5, midZ]);
    }
    closeModal();
  };

  const handleFocusTask = (taskId: string) => {
    const t = tasks[taskId];
    if (t) {
      if (t.assignedBotId) {
        selectBot(t.assignedBotId);
      } else {
        setFocusTarget([t.sourceCoords[0], 0.6, t.sourceCoords[1]]);
      }
    }
    closeModal();
  };

  const exportCSV = () => {
    let csv = "";
    let filename = `nexustwin_operations_${activeTab.toLowerCase()}_${Date.now()}.csv`;

    if (activeTab === "FLEET") {
      csv = "UnitID,Status,BatteryPct,Velocity,PayloadKg,TasksCompleted,PerceptionState\n";
      csv += filteredBots
        .map(
          (b) =>
            `${b.id},${b.status},${b.batteryPct.toFixed(1)},${b.velocity.toFixed(2)},${b.currentPayloadKg},${b.stats.tasksCompleted},${b.perception?.state || "CLEAR"}`
        )
        .join("\n");
    } else if (activeTab === "ZONES") {
      csv = "ZoneID,Name,BotCount,CongestionScore,IsBlocked\n";
      csv += filteredZones
        .map((z) => `${z.id},${z.name},${z.botCount},${z.congestionScore.toFixed(3)},${z.isBlocked}`)
        .join("\n");
    } else {
      csv = "OrderID,Priority,Status,AssignedBot,SourceLoc,DestLoc\n";
      csv += filteredTasks
        .map((t) => `${t.id},${t.priority},${t.status},${t.assignedBotId || "UNASSIGNED"},${t.sourceLocId},${t.destLocId}`)
        .join("\n");
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-bg" onClick={closeModal}>
      <div
        className="modal on"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(1100px, 94vw)", height: "min(680px, 85vh)" }}
      >
        <header className="modal-h">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "15px" }}>📋</span>
            <span>Warehouse Operations Registry & Dispatch</span>
          </div>

          <div style={{ display: "flex", gap: "4px", marginLeft: "20px" }}>
            {(["FLEET", "ZONES", "ORDERS"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  border: "none",
                  background: activeTab === tab ? "var(--accent)" : "#E2E8F0",
                  color: activeTab === tab ? "#0F172A" : "#64748B",
                  fontWeight: 800,
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "6px",
                  cursor: "pointer",
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

          <span className="spacer" />

          <button className="btn" onClick={exportCSV} style={{ fontSize: "11px", padding: "4px 10px" }}>
            Export CSV
          </button>
          <button className="icon-btn" onClick={closeModal} title="Close Modal">
            ✕
          </button>
        </header>

        <div className="modal-b" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Search bar */}
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              placeholder={`Search ${activeTab.toLowerCase()} by ID, status, or keyword...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 12px",
                fontSize: "12px",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                background: "#FFFFFF",
                color: "#0F172A",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  padding: "0 12px",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  background: "#F1F5F9",
                  cursor: "pointer",
                  fontSize: "11px",
                }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Table display */}
          <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border)", borderRadius: "6px" }}>
            {activeTab === "FLEET" && (
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "11.5px" }}>
                <thead>
                  <tr style={{ color: "#64748B", borderBottom: "1px solid var(--border)", background: "#F8FAFC" }}>
                    <th style={{ padding: "8px 12px", fontWeight: 700 }}>UNIT ID</th>
                    <th style={{ padding: "8px 8px", fontWeight: 700 }}>STATUS</th>
                    <th style={{ padding: "8px 8px", fontWeight: 700 }}>SAFETY / ACS</th>
                    <th style={{ padding: "8px 8px", fontWeight: 700 }}>BATTERY</th>
                    <th style={{ padding: "8px 8px", fontWeight: 700 }}>VELOCITY</th>
                    <th style={{ padding: "8px 8px", fontWeight: 700 }}>PAYLOAD</th>
                    <th style={{ padding: "8px 8px", fontWeight: 700 }}>PICKS DONE</th>
                    <th style={{ padding: "8px 12px", fontWeight: 700, textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBots.map((bot) => {
                    const isSelected = selectedBotId === bot.id;
                    return (
                      <tr
                        key={bot.id}
                        style={{
                          borderBottom: "1px solid #F1F5F9",
                          background: isSelected ? "rgba(248, 203, 70, 0.15)" : "transparent",
                        }}
                      >
                        <td style={{ padding: "8px 12px", fontWeight: 700, color: "#0F172A" }}>{bot.id}</td>
                        <td style={{ padding: "8px 8px" }}>
                          <span
                            style={{
                              fontSize: "10px",
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
                        <td style={{ padding: "8px 8px" }}>
                          {bot.perception?.state === "CLEAR" || !bot.perception?.state ? (
                            <span style={{ color: "#059669", fontWeight: 600 }}>● CLEAR</span>
                          ) : bot.backingOff ? (
                            <span style={{ color: "#7C3AED", fontWeight: 700, background: "#EDE9FE", padding: "1px 5px", borderRadius: "3px" }}>
                              REVERSING
                            </span>
                          ) : (
                            <span style={{ color: "#D97706", fontWeight: 700, background: "#FEF3C7", padding: "1px 5px", borderRadius: "3px" }}>
                              {bot.perception?.state || "CAUTION"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px 8px", fontWeight: 600, color: bot.batteryPct < 25 ? "#EF4444" : "#10B981" }}>
                          {Math.round(bot.batteryPct)}%
                        </td>
                        <td style={{ padding: "8px 8px", color: "#64748B" }}>{bot.velocity.toFixed(2)} m/s</td>
                        <td style={{ padding: "8px 8px", color: bot.currentPayloadKg > 0 ? "#D97706" : "#94A3B8" }}>
                          {bot.currentPayloadKg > 0 ? `${bot.currentPayloadKg} kg` : "Empty"}
                        </td>
                        <td style={{ padding: "8px 8px", fontWeight: 700 }}>{bot.stats.tasksCompleted}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          <button
                            onClick={() => handleFocusBot(bot.id)}
                            style={{
                              padding: "3px 8px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background: "rgba(248, 203, 70, 0.2)",
                              border: "1px solid rgba(248, 203, 70, 0.6)",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                          >
                            Focus 3D 🎯
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {activeTab === "ZONES" && (
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "11.5px" }}>
                <thead>
                  <tr style={{ color: "#64748B", borderBottom: "1px solid var(--border)", background: "#F8FAFC" }}>
                    <th style={{ padding: "8px 12px", fontWeight: 700 }}>ZONE ID</th>
                    <th style={{ padding: "8px 8px", fontWeight: 700 }}>NAME</th>
                    <th style={{ padding: "8px 8px", fontWeight: 700 }}>BOT COUNT</th>
                    <th style={{ padding: "8px 8px", fontWeight: 700 }}>CONGESTION INDEX</th>
                    <th style={{ padding: "8px 8px", fontWeight: 700 }}>STATUS</th>
                    <th style={{ padding: "8px 12px", fontWeight: 700, textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredZones.map((z) => (
                    <tr key={z.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 700 }}>{z.id}</td>
                      <td style={{ padding: "8px 8px", fontWeight: 700, color: "#0F172A" }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: "8px",
                            height: "8px",
                            borderRadius: "2px",
                            background: z.color,
                            marginRight: "6px",
                          }}
                        />
                        {z.name}
                      </td>
                      <td style={{ padding: "8px 8px", fontWeight: 600 }}>{z.botCount} bots</td>
                      <td style={{ padding: "8px 8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "60px", height: "6px", background: "#E2E8F0", borderRadius: "9999px", overflow: "hidden" }}>
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
                      <td style={{ padding: "8px 8px" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: z.isBlocked ? "#EF4444" : "#059669" }}>
                          {z.isBlocked ? "BLOCKED" : "OPTIMAL"}
                        </span>
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        <button
                          onClick={() => handleFocusZone(z.id)}
                          style={{
                            padding: "3px 8px",
                            fontSize: "11px",
                            fontWeight: 700,
                            background: "#F1F5F9",
                            border: "1px solid var(--border)",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          Focus 3D 🎯
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === "ORDERS" && (
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "11.5px" }}>
                <thead>
                  <tr style={{ color: "#64748B", borderBottom: "1px solid var(--border)", background: "#F8FAFC" }}>
                    <th style={{ padding: "8px 12px", fontWeight: 700 }}>ORDER ID</th>
                    <th style={{ padding: "8px 8px", fontWeight: 700 }}>PRIORITY</th>
                    <th style={{ padding: "8px 8px", fontWeight: 700 }}>ASSIGNED AMR</th>
                    <th style={{ padding: "8px 8px", fontWeight: 700 }}>SOURCE ➔ DEST</th>
                    <th style={{ padding: "8px 8px", fontWeight: 700 }}>STATUS</th>
                    <th style={{ padding: "8px 12px", fontWeight: 700, textAlign: "right" }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "24px", textAlign: "center", color: "#94A3B8" }}>
                        No orders match current query.
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((t) => (
                      <tr key={t.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 700, color: "#0F172A" }}>{t.id}</td>
                        <td style={{ padding: "8px 8px" }}>
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
                        <td style={{ padding: "8px 8px", fontWeight: 700, color: t.assignedBotId ? "#0F172A" : "#94A3B8" }}>
                          {t.assignedBotId || "Unassigned"}
                        </td>
                        <td style={{ padding: "8px 8px", color: "#334155" }}>
                          {t.sourceLocId.replace("SHELF-", "")} ➔ {t.destLocId.replace("PACK-STATION-", "Pack-")}
                        </td>
                        <td style={{ padding: "8px 8px" }}>
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
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          <button
                            onClick={() => handleFocusTask(t.id)}
                            style={{
                              padding: "3px 8px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background: "rgba(248, 203, 70, 0.2)",
                              border: "1px solid rgba(248, 203, 70, 0.6)",
                              borderRadius: "4px",
                              cursor: "pointer",
                            }}
                          >
                            Focus 3D 🎯
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default OperationsTableModal;
