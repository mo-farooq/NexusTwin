/**
 * NexusTwin Enterprise Audit Ledger Modal
 *
 * Full 500-event operational audit ledger featuring:
 * - Search by keyword, robot ID, or zone
 * - Filter by Severity (Critical, High, Medium, Info) and Source
 * - 1-Click CSV and JSON export
 * - Click-to-focus on specific robots or zones
 */

import React, { useMemo, useState } from "react";
import { useTwinStore, type TwinEvent } from "../../store/useTwinStore";

export function AuditLedgerModal() {
  const isOpen = useTwinStore((s) => s.modal === "audit");
  const setModal = useTwinStore((s) => s.setModal);
  const selectBot = useTwinStore((s) => s.selectBot);
  const recentEvents = useTwinStore((s) => s.recentEvents);

  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredEvents = useMemo(() => {
    return recentEvents.filter((ev) => {
      if (severityFilter && ev.severity !== severityFilter) return false;
      if (sourceFilter && ev.source !== sourceFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesMsg = ev.message.toLowerCase().includes(q);
        const matchesType = ev.type.toLowerCase().includes(q);
        const matchesBot = ev.robotId?.toLowerCase().includes(q);
        const matchesZone = ev.zoneId?.toLowerCase().includes(q);
        if (!matchesMsg && !matchesType && !matchesBot && !matchesZone) return false;
      }
      return true;
    });
  }, [recentEvents, severityFilter, sourceFilter, searchQuery]);

  if (!isOpen) return null;

  const exportFile = (format: "csv" | "json") => {
    let content = "";
    let mime = "";
    let filename = `nexustwin_audit_${Date.now()}`;

    if (format === "csv") {
      const headers = "id,tick,time,type,source,severity,robot_id,zone_id,message";
      const rows = filteredEvents.map((e) =>
        [
          e.id,
          e.tick,
          e.time,
          e.type,
          e.source,
          e.severity,
          e.robotId || "",
          e.zoneId || "",
          `"${e.message.replace(/"/g, '""')}"`,
        ].join(",")
      );
      content = [headers, ...rows].join("\n");
      mime = "text/csv";
      filename += ".csv";
    } else {
      content = JSON.stringify(filteredEvents, null, 2);
      mime = "application/json";
      filename += ".json";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-bg" onClick={() => setModal(null)}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-h">
          <span>📋 Enterprise Audit Ledger & Event History</span>
          <span className="spacer" />
          <button className="btn" onClick={() => exportFile("csv")}>
            Export CSV
          </button>
          <button className="btn" onClick={() => exportFile("json")}>
            Export JSON
          </button>
          <button className="icon-btn" onClick={() => setModal(null)}>
            ✕
          </button>
        </header>

        <div className="modal-b">
          {/* Filters Bar */}
          <div className="filters">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
            >
              <option value="">All Severities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="INFO">INFO</option>
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="">All Sources</option>
              <option value="ROBOT">ROBOT</option>
              <option value="FLEET_MANAGER">FLEET_MANAGER</option>
              <option value="PLANNER">PLANNER</option>
              <option value="SIMULATION">SIMULATION</option>
              <option value="CONVEYOR">CONVEYOR</option>
              <option value="LIDAR">LIDAR</option>
              <option value="USER">USER</option>
            </select>

            <input
              placeholder="Search message, BOT-ID, or event type…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: "220px" }}
            />

            <span className="count">
              Showing {filteredEvents.length} of {recentEvents.length} records
            </span>
          </div>

          {/* Ledger Table */}
          <table className="dt full">
            <thead>
              <tr>
                <th>Time</th>
                <th>Tick</th>
                <th>Severity</th>
                <th>Source</th>
                <th>Type</th>
                <th>Asset</th>
                <th>Audit Message</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((ev) => (
                <tr
                  key={ev.id}
                  onClick={() => {
                    if (ev.robotId) {
                      selectBot(ev.robotId);
                      setModal(null);
                    }
                  }}
                  title={ev.robotId ? `Click to focus camera on ${ev.robotId}` : undefined}
                >
                  <td style={{ color: "var(--muted)" }}>{ev.time}</td>
                  <td style={{ color: "var(--muted)" }}>#{ev.tick}</td>
                  <td className={`sev-${ev.severity}`}>{ev.severity}</td>
                  <td>{ev.source}</td>
                  <td style={{ fontWeight: 600 }}>{ev.type}</td>
                  <td style={{ color: "#38BDF8", fontWeight: 700 }}>
                    {ev.robotId || ev.zoneId || "—"}
                  </td>
                  <td style={{ fontFamily: "var(--font)", color: "var(--text)" }}>
                    {ev.message}
                  </td>
                </tr>
              ))}
              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "20px", color: "var(--muted)" }}>
                    No events match the specified filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AuditLedgerModal;
