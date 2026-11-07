/**
 * NexusTwin Focus Mode Top KPI Strip
 *
 * Compact progressive disclosure header displaying the 5 essential warehouse
 * metrics + on-demand floating popovers for Systems health and Incidents.
 */

import React, { useEffect, useRef } from "react";
import { useTwinStore } from "../../store/useTwinStore";
import { SystemStatusPanel, AlertsPanel } from "../panels/LeftPanels";

export function KpiStrip() {
  const kpi = useTwinStore((s) => s.kpi);
  const botUnits = useTwinStore((s) => s.botUnits);
  const tasks = useTwinStore((s) => s.tasks);
  const alerts = useTwinStore((s) => s.alerts);
  const conveyors = useTwinStore((s) => s.conveyors);

  const activePopover = useTwinStore((s) => s.activePopover);
  const setActivePopover = useTwinStore((s) => s.setActivePopover);

  const stripRef = useRef<HTMLDivElement>(null);

  // Close popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (stripRef.current && !stripRef.current.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [setActivePopover]);

  const bots = Object.values(botUnits);
  const totalBots = bots.length;
  const activeBots = bots.filter((b) => b.status === "ACTIVE").length;
  const chargingBots = bots.filter((b) => b.status === "CHARGING").length;
  const idleBots = bots.filter((b) => b.status === "IDLE").length;
  const errorBots = bots.filter((b) => b.status === "ERROR" || b.status === "WARNING" || b.status === "OFFLINE").length;

  const inFlightCount = Object.values(tasks).filter(
    (t) => t.status === "IN_PROGRESS" || t.status === "ASSIGNED"
  ).length;

  const alertList = Object.values(alerts);
  const unackedAlerts = alertList.filter((a) => !a.acknowledged);
  const hasCriticalAlert = unackedAlerts.some((a) => a.severity === "CRITICAL" || a.severity === "HIGH");

  // Systems health check
  const isConveyorJammed = conveyors.some((c) => c.isJammed);
  const hasAcsViolations = (kpi.safetyViolationCount || 0) > 0;
  const systemErrors = (isConveyorJammed ? 1 : 0) + (hasAcsViolations ? 1 : 0);

  const slaPct = kpi.slaCompliancePct || 95.0;
  const isSlaWarning = slaPct < 95.0;

  return (
    <div className="kstrip" id="kstrip" ref={stripRef}>
      {/* 1. Throughput Pace */}
      <div className="kq">
        <span className="k">Throughput</span>
        <span className="v">
          <b id="fkPace">{kpi.throughputPerHour || 0}</b>
          <small>/ 1,200 u·h</small>
        </span>
      </div>

      {/* 2. On-Time SLA */}
      <div className={`kq ${isSlaWarning ? "warn" : ""}`}>
        <span className="k">On‑time</span>
        <span className="v">
          <b id="fkSla">{slaPct.toFixed(1)}</b>
          <small>%</small>
        </span>
      </div>

      {/* 3. Cycle Time */}
      <div className="kq">
        <span className="k">Cycle</span>
        <span className="v">
          <b id="fkCyc">{Math.round(kpi.averageTaskDurationSec || 42)}</b>
          <small>s</small>
        </span>
      </div>

      {/* 4. In Flight */}
      <div className="kq">
        <span className="k">In flight</span>
        <span className="v">
          <b id="fkFly">{inFlightCount}</b>
        </span>
      </div>

      {/* 5. Fleet Moving Bar */}
      <div className="kq fleet">
        <span className="k">
          Fleet · <b id="fkMov">{activeBots}</b> of {totalBots} moving
        </span>
        <span className="kbar" id="fkBar">
          {totalBots > 0 && (
            <>
              <i
                title={`Moving: ${activeBots}`}
                style={{ width: `${(activeBots / totalBots) * 100}%`, background: "var(--signal)" }}
              />
              <i
                title={`Charging: ${chargingBots}`}
                style={{ width: `${(chargingBots / totalBots) * 100}%`, background: "var(--blue)" }}
              />
              <i
                title={`Idle: ${idleBots}`}
                style={{ width: `${(idleBots / totalBots) * 100}%`, background: "#C9C2AF" }}
              />
              <i
                title={`Fault: ${errorBots}`}
                style={{ width: `${(errorBots / totalBots) * 100}%`, background: "var(--red)" }}
              />
            </>
          )}
        </span>
      </div>

      <span className="sp" />

      {/* Systems Status Pill */}
      <button
        className={`kbtn ${systemErrors > 0 ? "err" : ""} ${activePopover === "systems" ? "on" : ""}`}
        id="sysPill"
        onClick={() => setActivePopover(activePopover === "systems" ? null : "systems")}
        title="Subsystem Telemetry"
      >
        <span className={`led ${systemErrors > 0 ? "err" : ""}`} id="sysLed" />
        <span id="sysTxt">
          {systemErrors > 0
            ? `${systemErrors} system${systemErrors > 1 ? "s" : ""} down`
            : "All systems nominal"}
        </span>
      </button>

      {/* Incidents Button */}
      <button
        className={`kbtn ${hasCriticalAlert ? "warn ping" : ""} ${activePopover === "incidents" ? "on" : ""}`}
        id="incBtn"
        onClick={() => setActivePopover(activePopover === "incidents" ? null : "incidents")}
        title="Operational Incidents & Alerts"
      >
        <svg viewBox="0 0 24 24" width="15" height="15">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4"
          />
        </svg>
        <span>Incidents</span>
        <span className={`badge ${unackedAlerts.length === 0 ? "zero" : ""}`} id="incBadge">
          {unackedAlerts.length}
        </span>
      </button>

      {/* Popovers */}
      <div className={`pop ${activePopover === "systems" ? "on" : ""}`} id="popSys">
        <SystemStatusPanel />
      </div>

      <div className={`pop ${activePopover === "incidents" ? "on" : ""}`} id="popInc">
        <AlertsPanel />
      </div>
    </div>
  );
}
