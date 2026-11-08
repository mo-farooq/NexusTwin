/**
 * NexusTwin Right Panels (Industrial SCADA Design System)
 *
 * Tabbed Inspector & Intelligence Column:
 * - Inspector Tab:
 *   - Robot Subtab: FSM state machine track, segmented battery gauge, position/velocity grid, and animated LiDAR Radar Scanner
 *   - Rack Subtab: 4-tier slotting matrix (L1-L4 velocity, SKU details, crane pick latency)
 *   - Station Subtab: Queue depth, throughput pace, incoming AMR ETA queue
 * - Ledger Tab: Live explainable dispatch logs & ACS near-miss event feed
 * - Roadmap Tab: 2026 predictive maintenance, multi-floor AMR, and solar energy milestones
 */

import React, { useState, useMemo, useEffect } from "react";
import { useTwinStore, type BotUnit } from "../../store/useTwinStore";

const FSM_STATES = [
  "NAVIGATING_TO_PICKUP",
  "PICKING",
  "NAVIGATING_TO_DELIVERY",
  "DELIVERING",
  "CHARGING",
];

export function RightPanels({ asDock }: { asDock?: boolean } = {}) {
  const selectedBotId = useTwinStore((s) => s.selectedBotId);
  const selectBot = useTwinStore((s) => s.selectBot);
  const botUnits = useTwinStore((s) => s.botUnits);
  const locations = useTwinStore((s) => s.locations);
  const selectedRackId = useTwinStore((s) => s.selectedRackId);
  const selectedStationId = useTwinStore((s) => s.selectedStationId);
  const explainableLogs = useTwinStore((s) => s.explainableLogs);
  const recentEvents = useTwinStore((s) => s.recentEvents);
  const kpi = useTwinStore((s) => s.kpi);
  const setModal = useTwinStore((s) => s.setModal);
  const defragmentRacks = useTwinStore((s) => s.defragmentRacks);
  const defragMessage = useTwinStore((s) => s.defragMessage);

  const [mainTab, setMainTab] = useState<"insp" | "ledger" | "road">("insp");
  const [inspSubTab, setInspSubTab] = useState<"bot" | "rack" | "station">("bot");
  const [ledgerSubTab, setLedgerSubTab] = useState<"disp" | "safe">("disp");

  // Synchronize active inspector subtab with 3D selection
  useEffect(() => {
    if (selectedRackId) {
      setMainTab("insp");
      setInspSubTab("rack");
    }
  }, [selectedRackId]);

  useEffect(() => {
    if (selectedStationId) {
      setMainTab("insp");
      setInspSubTab("station");
    }
  }, [selectedStationId]);

  useEffect(() => {
    if (selectedBotId) {
      setMainTab("insp");
      setInspSubTab("bot");
    }
  }, [selectedBotId]);

  const bots = Object.values(botUnits);
  const currentBot: BotUnit | undefined = (selectedBotId && botUnits[selectedBotId]) || bots[0];

  // Calculate nearest robot for LiDAR radar sweep
  const nearestObstacle = useMemo(() => {
    if (!currentBot || bots.length <= 1) return null;
    let closestBot: BotUnit | null = null;
    let minDist = Infinity;

    for (const b of bots) {
      if (b.id === currentBot.id) continue;
      const d = Math.hypot(b.position[0] - currentBot.position[0], b.position[2] - currentBot.position[2]);
      if (d < minDist) {
        minDist = d;
        closestBot = b;
      }
    }

    return { bot: closestBot, dist: minDist };
  }, [currentBot, bots]);

  // Selected Rack details
  const shelfKeys = Object.keys(locations).filter((k) => locations[k].type === "SHELF");
  const currentRack = (selectedRackId && locations[selectedRackId]) || locations[shelfKeys[0]];

  // Selected Station details (Packing, Inbound Dock, or Fast Charger)
  const stationKeys = Object.keys(locations).filter(
    (k) =>
      locations[k].type === "PACK_STATION" ||
      locations[k].type === "INBOUND_DOCK" ||
      locations[k].type === "CHARGING_DOCK"
  );
  const currentStation = (selectedStationId && locations[selectedStationId]) || locations[stationKeys[0]];

  // Safety events (ACS near-misses and yields)
  const safetyEvents = useMemo(() => {
    return explainableLogs
      .filter((l) => l.reason.includes("ACS") || l.reason.includes("Yield") || l.reason.includes("Anti-Collision"))
      .slice(0, 15);
  }, [explainableLogs]);

  const cardContent = (
    <section className="card grow">
      {/* Primary Panel Tabs */}
      <div className="ptabs" id="pTabs">
          <button className={mainTab === "insp" ? "on" : ""} onClick={() => setMainTab("insp")}>
            Inspector
          </button>
          <button className={mainTab === "ledger" ? "on" : ""} onClick={() => setMainTab("ledger")}>
            Ledger
          </button>
          <button className={mainTab === "road" ? "on" : ""} onClick={() => setMainTab("road")}>
            Roadmap
          </button>
        </div>

        {/* 1. INSPECTOR PANE */}
        {mainTab === "insp" && (
          <div className="pane on">
            <div className="tabs" id="inspTabs">
              <button className={inspSubTab === "bot" ? "on" : ""} onClick={() => setInspSubTab("bot")}>
                Robot
              </button>
              <button className={inspSubTab === "rack" ? "on" : ""} onClick={() => setInspSubTab("rack")}>
                Rack
              </button>
              <button className={inspSubTab === "station" ? "on" : ""} onClick={() => setInspSubTab("station")}>
                Station
              </button>
            </div>

            <div className="card-b" id="insp">
              {/* ROBOT INSPECTOR */}
              {inspSubTab === "bot" && currentBot && (
                <>
                  <div className="insp-head">
                    <div className="botpic">
                      <svg viewBox="0 0 24 24">
                        <use href="#i-bot" />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="id">{currentBot.id}</div>
                      <div className="prof">
                        {currentBot.profileId === "HEAVY_CARRIER" ? "Heavy Carrier" : "Light Picker"} · payload{" "}
                        {currentBot.currentPayloadKg > 0 ? `${currentBot.currentPayloadKg} kg` : "0 kg (Empty)"}
                      </div>
                    </div>
                  </div>

                  {/* FSM State Pill */}
                  <span
                    className="fsm"
                    style={{
                      background:
                        currentBot.status === "ERROR"
                          ? "var(--red-soft)"
                          : currentBot.perception?.state === "YIELDING"
                          ? "var(--amber-soft)"
                          : "var(--paper-2)",
                      color:
                        currentBot.status === "ERROR"
                          ? "var(--red)"
                          : currentBot.perception?.state === "YIELDING"
                          ? "#94640A"
                          : "var(--ink)",
                    }}
                  >
                    ● {currentBot.fsmState.replace(/_/g, " ")}
                  </span>

                  {/* FSM Workflow Track */}
                  <div className="fsm-track">
                    {FSM_STATES.map((f) => (
                      <span key={f} className={f === currentBot.fsmState || (f === "NAVIGATING_TO_PICKUP" && currentBot.fsmState === "STAGED_WAITING_AISLE") ? "on" : ""}>
                        {f.replace(/_/g, " ").replace("NAVIGATING TO", "NAV")}
                      </span>
                    ))}
                  </div>

                  {/* 10-Cell Battery Gauge */}
                  <div className="batt">
                    <span className="cell">
                      {Array.from({ length: 10 }, (_, i) => {
                        const cellPct = (i + 1) * 10;
                        const isFilled = currentBot.batteryPct >= cellPct - 5;
                        const isLow = currentBot.batteryPct < 25;
                        return (
                          <span
                            key={i}
                            className={isFilled ? "on" : ""}
                            style={{
                              background: isFilled ? (isLow ? "var(--red)" : "var(--teal)") : undefined,
                            }}
                          />
                        );
                      })}
                    </span>
                    <span className="pct">{Math.round(currentBot.batteryPct)}%</span>
                    <span className="eta">
                      fast‑charge
                      <br />
                      <b>{Math.round((100 - currentBot.batteryPct) * 0.32)} min</b> to full
                    </span>
                  </div>

                  {/* Kinematics & Energy Telemetry */}
                  <div className="tele">
                    <div>
                      <div className="k">Position (x, z)</div>
                      <div className="v">
                        {currentBot.position[0].toFixed(1)}, {currentBot.position[2].toFixed(1)}
                        <small> m</small>
                      </div>
                    </div>
                    <div>
                      <div className="k">Velocity</div>
                      <div className="v">
                        {currentBot.velocity.toFixed(2)}
                        <small> m/s</small>
                      </div>
                    </div>
                    <div>
                      <div className="k">Distance</div>
                      <div className="v">
                        {Math.round(currentBot.stats.distanceTraveledM)}
                        <small> m</small>
                      </div>
                    </div>
                    <div>
                      <div className="k">Energy</div>
                      <div className="v">
                        {Math.round(currentBot.stats.energyConsumedWh)}
                        <small> Wh</small>
                      </div>
                    </div>
                  </div>

                  {/* Animated LiDAR Radar Scanner Widget */}
                  {nearestObstacle && nearestObstacle.bot && (
                    <div className="radar">
                      <svg viewBox="0 0 96 96">
                        <circle cx="48" cy="48" r="44" fill="none" stroke="#2C3448" />
                        <circle cx="48" cy="48" r="29" fill="none" stroke="#2C3448" />
                        <circle cx="48" cy="48" r="14" fill="none" stroke="#2C3448" />

                        {/* Animated Rotating Radar Beam */}
                        <path d="M48 48 L48 4 A44 44 0 0 1 86 26 Z" fill="rgba(63,208,185,.22)">
                          <animateTransform
                            attributeName="transform"
                            type="rotate"
                            from="0 48 48"
                            to="360 48 48"
                            dur="2.4s"
                            repeatCount="indefinite"
                          />
                        </path>

                        {/* Blip for Nearest Obstacle AMR */}
                        <circle
                          cx={48 + Math.min(40, nearestObstacle.dist * 9) * 0.7}
                          cy={48 - Math.min(40, nearestObstacle.dist * 9) * 0.7}
                          r="3.5"
                          fill={nearestObstacle.dist < 1.6 ? "#FF8A5C" : "#3FD0B9"}
                        />
                        <circle cx="48" cy="48" r="3" fill="#FFFFFF" />
                      </svg>

                      <div>
                        <div className="k">LiDAR · nearest</div>
                        <div className="v">
                          <b>{nearestObstacle.bot.id}</b>
                        </div>
                        <div className="k">Distance</div>
                        <div className="v">{nearestObstacle.dist.toFixed(2)} m</div>
                        <div className="k">Safe margin</div>
                        <div
                          className="v"
                          style={{ color: nearestObstacle.dist < 1.6 ? "#FF8A5C" : "#3FD0B9" }}
                        >
                          {(nearestObstacle.dist - 1.05).toFixed(2)} m{" "}
                          {nearestObstacle.dist < 1.6 ? "· YIELD" : "· CLEAR"}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* RACK INSPECTOR */}
              {inspSubTab === "rack" && currentRack && (
                <>
                  <div className="insp-head">
                    <div className="botpic" style={{ background: "var(--paper-2)" }}>
                      <svg viewBox="0 0 24 24" style={{ width: "26px", height: "26px" }}>
                        <path
                          fill="none"
                          stroke="#121826"
                          strokeWidth="2"
                          d="M4 3v18M20 3v18M4 7h16M4 12h16M4 17h16"
                        />
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="id">{currentRack.id}</div>
                      <div className="prof">
                        {currentRack.name} · {currentRack.zoneId || "Zone A"}
                      </div>
                    </div>
                  </div>

                  {/* 4-Tier Slotting Capacity Header */}
                  <div style={{ margin: "10px 0 6px 0", fontSize: "11px", display: "flex", justifyContent: "space-between", color: "var(--mute)" }}>
                    <span>4-Tier Slotting Capacity</span>
                    <b style={{ color: "var(--ink)" }}>16 Pallet Slots / 96 Bins</b>
                  </div>

                  {/* 4-Tier SKU Breakdown */}
                  <div className="tiers">
                    {(currentRack.tiers || []).map((t) => (
                      <div key={t.level} className="tier">
                        <span className="l">L{t.level}</span>
                        <div>
                          <div className="s">{t.skuName}</div>
                          <div className="m">
                            pick {t.pickDurationSec.toFixed(1)}s · {t.level === 1 ? "Fast-Moving (Golden Zone)" : t.level === 4 ? "Bulk Reserve" : `${t.velocity} velocity`}
                          </div>
                        </div>
                        <span className="vel">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <span
                              key={i}
                              className={
                                (t.level === 1 && i <= 5) ||
                                (t.level === 2 && i <= 3) ||
                                (t.level === 3 && i <= 2) ||
                                (t.level === 4 && i <= 1)
                                  ? "on"
                                  : ""
                              }
                            />
                          ))}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="life-tele">
                    <span>
                      Fill <b>84%</b>
                    </span>
                    <span>
                      Picks / h <b>142</b>
                    </span>
                    <span>
                      Re‑slot score <b style={{ color: "var(--teal)" }}>A</b>
                    </span>
                  </div>

                  {/* 1-Click Defragment Rack Button */}
                  <div style={{ marginTop: "12px" }}>
                    <button
                      className="btn primary"
                      style={{ width: "100%", padding: "8px 12px", fontSize: "11px", fontWeight: 700, background: "var(--signal)", color: "#0F172A", border: "none", borderRadius: "6px", cursor: "pointer" }}
                      onClick={() => defragmentRacks()}
                      title="Rebalance high-velocity SKUs to Level 1 Golden Zone to cut vertical lift latency by 36%"
                    >
                      ⚡ Defragment Rack (Re-Slot to L1)
                    </button>
                    {defragMessage && (
                      <div style={{ marginTop: "6px", fontSize: "10px", color: "var(--teal)", lineHeight: 1.3, fontWeight: 600 }}>
                        ✓ {defragMessage}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* STATION INSPECTOR */}
              {inspSubTab === "station" && currentStation && (
                <>
                  <div className="insp-head">
                    <div className="botpic" style={{ background: currentStation.type === "CHARGING_DOCK" ? "var(--teal-soft)" : "var(--paper-2)" }}>
                      <svg viewBox="0 0 24 24" style={{ width: "26px", height: "26px" }}>
                        {currentStation.type === "CHARGING_DOCK" ? (
                          <path fill="none" stroke="var(--teal)" strokeWidth="2" d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        ) : (
                          <path fill="none" stroke="#121826" strokeWidth="2" d="M3 9h18v11H3zM7 9V5h10v4M9 14h6" />
                        )}
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="id">{currentStation.id}</div>
                      <div className="prof">
                        {currentStation.name} · {currentStation.zoneId || "Zone"}
                      </div>
                    </div>
                  </div>

                  {/* Station Type */}
                  <div style={{ margin: "8px 0 10px 0", fontSize: "11.5px" }}>
                    <span style={{ color: "var(--mute)" }}>Type: </span>
                    <b style={{ color: "var(--ink)" }}>
                      {currentStation.type === "INBOUND_DOCK"
                        ? "Inbound Pallet Bay (Receiving)"
                        : currentStation.type === "CHARGING_DOCK"
                        ? "Autonomous Fast-Charging Pad"
                        : "Packing & Sorting Station"}
                    </b>
                  </div>

                  <div className="tele">
                    <div>
                      <div className="k">Queue depth</div>
                      <div className="v">
                        {bots.filter((b) => b.targetLocationId === currentStation.id || (b.fsmState === "DELIVERING" && b.targetLocationId === currentStation.id)).length}
                        <small> bots</small>
                      </div>
                    </div>
                    <div>
                      <div className="k">Throughput</div>
                      <div className="v">
                        {currentStation.type === "INBOUND_DOCK"
                          ? "32"
                          : currentStation.type === "CHARGING_DOCK"
                          ? "8.5"
                          : Math.round(kpi.throughputPerHour / Math.max(1, stationKeys.length))}
                        <small> {currentStation.type === "CHARGING_DOCK" ? "kW" : "/h"}</small>
                      </div>
                    </div>
                  </div>

                  <div className="sec" style={{ marginTop: "12px" }}>
                    Station Activity
                  </div>
                  {bots
                    .filter((b) => b.targetLocationId === currentStation.id)
                    .slice(0, 4)
                    .map((b, i) => (
                      <div key={b.id} className="ledger-row" style={{ fontSize: "11px" }}>
                        <span className="mono">{b.id}</span>
                        <span className="mono" style={{ color: "var(--mute)" }}>
                          ETA {8 + i * 11}s · {b.fsmState.replace(/_/g, " ")}
                        </span>
                      </div>
                    ))}
                  {bots.filter((b) => b.targetLocationId === currentStation.id).length === 0 && (
                    <div style={{ color: "var(--mute)", fontSize: "11px", padding: "8px 0" }}>
                      Queue clear. Ready for next incoming robot.
                    </div>
                  )}
                </>
              )}

              {/* View Task Queue & Logs button inside Inspector Pane */}
              <div style={{ marginTop: "16px", borderTop: "1px solid var(--border)", paddingTop: "10px" }}>
                <button
                  className="btn"
                  onClick={() => setModal("tasks")}
                  style={{ width: "100%", padding: "7px 12px", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                  title="Open Operations Registry & Dispatch Task Queue"
                >
                  View Task Queue & Logs
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. LEDGER PANE */}
        {mainTab === "ledger" && (
          <div className="pane on">
            <div className="tabs" id="ledTabs" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "4px" }}>
                <button className={ledgerSubTab === "disp" ? "on" : ""} onClick={() => setLedgerSubTab("disp")}>
                  Dispatch reasoning
                </button>
                <button className={ledgerSubTab === "safe" ? "on" : ""} onClick={() => setLedgerSubTab("safe")}>
                  Safety events
                </button>
              </div>
              <button
                className="pill-s"
                onClick={() => setModal("audit")}
                title="Open Enterprise Audit Ledger"
                style={{ padding: "2px 8px", fontSize: "10px", fontWeight: 700, cursor: "pointer", background: "rgba(248, 203, 70, 0.15)", color: "#0F172A", border: "1px solid rgba(248, 203, 70, 0.5)", borderRadius: "4px" }}
              >
                Full Ledger ↗
              </button>
            </div>
            <div className="card-b fill">
              <div className="ledger">
                {ledgerSubTab === "disp" &&
                  explainableLogs.map((log) => (
                    <div key={log.id} className="item">
                      <div className="w">
                        <b>{log.taskId}</b> → <b>{log.botId}</b> · {log.targetRack} (Tier {log.tier})
                        <div className="why">
                          <span>{log.reason}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                {ledgerSubTab === "safe" &&
                  safetyEvents.map((log) => (
                    <div key={log.id} className="item">
                      <div className="w">
                        <span className="ev r">ACS RESOLVED</span>
                        <b>{log.botId}</b> · {log.reason}
                      </div>
                    </div>
                  ))}

                {explainableLogs.length === 0 && (
                  <div style={{ color: "var(--mute)", padding: "16px 0", fontSize: "11.5px" }}>
                    No dispatch entries recorded yet.
                  </div>
                )}
              </div>

              {/* View Task Queue & Logs button inside Ledger Pane */}
              <div style={{ marginTop: "12px", borderTop: "1px solid var(--border)", paddingTop: "8px" }}>
                <button
                  className="btn"
                  onClick={() => setModal("tasks")}
                  style={{ width: "100%", padding: "6px 12px", fontSize: "11px", fontWeight: 700 }}
                  title="Open Operations Registry & Task Queue Modal"
                >
                  View Task Queue & Logs
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. ROADMAP PANE */}
        {mainTab === "road" && (
          <div className="pane on">
            <div className="card-b">
              <div className="road">
                <div className="rm">
                  <div className="k">PREDICTIVE MAINT.</div>
                  <div className="t">Motor temp · AMR‑17</div>
                  <div className="v">68°C</div>
                  <div className="m">wheel service in 6 days</div>
                </div>
                <div className="rm">
                  <div className="k">AGV + CONVEYOR</div>
                  <div className="t">Cross‑dock sorter</div>
                  <div className="v">2.4 m/s</div>
                  <div className="m">2 tow‑tractors online</div>
                </div>
                <div className="rm">
                  <div className="k">CARBON</div>
                  <div className="t">Solar roof today</div>
                  <div className="v">412 kWh</div>
                  <div className="m">net offset 0.31 t CO₂</div>
                </div>
                <div className="rm">
                  <div className="k">OFF‑PEAK CHARGING</div>
                  <div className="t">Charge shifted</div>
                  <div className="v">−18%</div>
                  <div className="m">energy cost vs peak</div>
                </div>
                <div className="rm">
                  <div className="k">MULTI‑FLOOR</div>
                  <div className="t">Freight lift L‑1</div>
                  <div className="v">G → M1</div>
                  <div className="m">3 bots queued</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
  );

  if (asDock) {
    return cardContent;
  }

  return (
    <aside className="col r">
      {cardContent}
    </aside>
  );
}

export default RightPanels;
