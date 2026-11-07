/**
 * NexusTwin Focus Mode Collapsible Analytics Dock
 *
 * Bottom accordion dock with 4 on-demand tabs:
 * 0: Dispatch queue
 * 1: Throughput pace & actuals curve
 * 2: Order lifecycle pipeline
 * "ledger": Real-time decision ledger
 */

import React from "react";
import { useTwinStore } from "../../store/useTwinStore";
import { TaskQueuePanel, ThroughputPanel, OrderLifecycleBar } from "../panels/BottomPanels";

export function AnalyticsDock() {
  const focusDockTab = useTwinStore((s) => s.focusDockTab);
  const setFocusDockTab = useTwinStore((s) => s.setFocusDockTab);
  const fleetSummary = useTwinStore((s) => s.fleetSummary);
  const explainableLogs = useTwinStore((s) => s.explainableLogs);

  const activeTaskCount = fleetSummary.inFlightTasks;

  const isOpen = focusDockTab !== null;

  return (
    <div className={`dock ${isOpen ? "open" : ""}`} id="dock">
      <div className="dock-tabs" id="dockTabs">
        <button
          className={focusDockTab === 0 ? "on" : ""}
          onClick={() => setFocusDockTab(0)}
        >
          Dispatch queue <span className="cnt" id="dkQ">{activeTaskCount}</span>
        </button>

        <button
          className={focusDockTab === 1 ? "on" : ""}
          onClick={() => setFocusDockTab(1)}
        >
          Throughput
        </button>

        <button
          className={focusDockTab === 2 ? "on" : ""}
          onClick={() => setFocusDockTab(2)}
        >
          Order lifecycle
        </button>

        <button
          className={focusDockTab === "ledger" ? "on" : ""}
          onClick={() => setFocusDockTab("ledger")}
        >
          Decision ledger
        </button>

        <span className="sp" />
        <span className="dock-hint">Click a robot, rack or station to inspect it</span>
      </div>

      <div className="dock-sheet" id="dockSheet">
        {focusDockTab === 0 && (
          <div className="card on">
            <TaskQueuePanel />
          </div>
        )}

        {focusDockTab === 1 && (
          <div className="card on">
            <ThroughputPanel />
          </div>
        )}

        {focusDockTab === 2 && (
          <div className="card on">
            <OrderLifecycleBar />
          </div>
        )}

        {focusDockTab === "ledger" && (
          <div className="card on" style={{ padding: "12px 16px", overflowY: "auto", maxHeight: "220px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {explainableLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "var(--paper-2)",
                    border: "1px solid var(--hair)",
                    fontSize: "12px",
                    lineHeight: "1.4",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span className="mono" style={{ fontWeight: 700, color: "var(--teal)" }}>
                      {log.botId} · {log.taskId}
                    </span>
                    <span className="mono dim">{log.timestamp}</span>
                  </div>
                  <div>{log.reason}</div>
                </div>
              ))}
              {explainableLogs.length === 0 && (
                <div style={{ color: "var(--mute)", textAlign: "center", padding: "20px 0" }}>
                  Awaiting dispatch decisions...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
