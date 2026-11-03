/**
 * NexusTwin Left Panels
 *
 * Operational overview panels featuring:
 * - Fleet Overview (Total, Active, Charging, Idle, Error)
 * - Task Overview (Throughput, SLA %, Avg Duration, Utilization)
 * - System Subsystem Status (Warehouse, Conveyors, Charging, Network, LiDAR Safety)
 * - Real-time Alerts Panel with 1-click camera focus and acknowledge actions
 */

import React from "react";
import { useTwinStore } from "../../store/useTwinStore";
import { Panel, StatRow, Dot, Icon } from "../ui/primitives";

export function FleetOverviewPanel() {
  const botUnits = useTwinStore((s) => s.botUnits);
  const gridDimensions = useTwinStore((s) => s.gridDimensions);
  const setModal = useTwinStore((s) => s.setModal);

  const bots = Object.values(botUnits);
  const total = bots.length;
  const active = bots.filter((b) => b.status === "ACTIVE").length;
  const charging = bots.filter((b) => b.status === "CHARGING").length;
  const idle = bots.filter((b) => b.status === "IDLE" || b.status === "WARNING").length;
  const error = bots.filter((b) => b.status === "ERROR" || b.status === "OFFLINE").length;

  const areaM2 = gridDimensions.widthM * gridDimensions.depthM;
  const density = total > 0 ? Math.round(areaM2 / total) : 0;
  const scaleBadge =
    areaM2 <= 600
      ? "Micro Dark Store"
      : areaM2 <= 1400
      ? "Compact MSME Depot"
      : areaM2 <= 2800
      ? "Standard Hub"
      : "Regional Mega DC";

  return (
    <Panel
      title="Fleet Overview"
      action={
        <button className="link" onClick={() => setModal("tasks")}>
          Fleet List →
        </button>
      }
    >
      <StatRow label="Total Autonomous Bots" value={total} big />
      <StatRow label="Facility Scale" value={scaleBadge} color="#2563EB" />
      <StatRow label="Floor Clearance" value={`${density} m² / AMR`} />
      <StatRow label="Active in Transit" value={active} color="#10B981" />
      <StatRow label="EV Fast Charging" value={charging} color="#3B82F6" />
      <StatRow label="Idle / Standby" value={idle} color="#F59E0B" />
      {error > 0 && <StatRow label="Mechanical Fault" value={error} color="#EF4444" />}
    </Panel>
  );
}

export function TaskOverviewPanel() {
  const kpi = useTwinStore((s) => s.kpi);
  const tasks = useTwinStore((s) => s.tasks);

  const ongoing = Object.values(tasks).filter(
    (t) => t.status === "IN_PROGRESS" || t.status === "ASSIGNED"
  ).length;

  return (
    <Panel title="Operations & SLA">
      <StatRow label="Active In-Flight Tasks" value={ongoing} />
      <StatRow label="Throughput (Hourly)" value={`${kpi.throughputPerHour} /hr`} color="#38BDF8" big />
      <StatRow label="Completed Orders" value={kpi.totalCompletedTasks} color="#10B981" />
      <StatRow label="Avg Cycle Time" value={`${kpi.averageTaskDurationSec}s`} />
      <StatRow
        label="On-Time SLA Rate"
        value={`${kpi.slaCompliancePct.toFixed(1)}%`}
        color={kpi.slaCompliancePct >= 95 ? "#10B981" : "#F59E0B"}
      />
      <StatRow
        label="Fleet Utilization"
        value={`${Math.round(kpi.fleetUtilizationPct)}%`}
        color="#F8CB46"
      />
    </Panel>
  );
}

export function SystemStatusPanel() {
  const conveyors = useTwinStore((s) => s.conveyors);
  const kpi = useTwinStore((s) => s.kpi);

  const isConveyorJammed = conveyors.some((c) => c.isJammed);
  const hasAcsViolations = (kpi.safetyViolationCount || 0) > 0;

  const subsystems = [
    { name: "Warehouse Core", status: "NORMAL", color: "#10B981" },
    {
      name: "Outbound Conveyors",
      status: isConveyorJammed ? "WARNING" : "NORMAL",
      color: isConveyorJammed ? "#F59E0B" : "#10B981",
    },
    { name: "DC Charging Pads", status: "NORMAL", color: "#10B981" },
    { name: "Network Mesh", status: "NORMAL", color: "#10B981" },
    {
      name: "LiDAR Safety ACS",
      status: hasAcsViolations ? "ERROR" : "NORMAL",
      color: hasAcsViolations ? "#EF4444" : "#10B981",
    },
  ];

  return (
    <Panel title="System Subsystems">
      {subsystems.map((sub) => (
        <div className="stat-row" key={sub.name}>
          <span>{sub.name}</span>
          <span className="status-text" style={{ color: sub.color }}>
            <Dot color={sub.color} />
            {sub.status === "NORMAL" ? "Operational" : sub.status === "WARNING" ? "Jammed" : "Degraded"}
          </span>
        </div>
      ))}
    </Panel>
  );
}

export function AlertsPanel() {
  const alerts = useTwinStore((s) => s.alerts);
  const ackAlert = useTwinStore((s) => s.ackAlert);
  const selectBot = useTwinStore((s) => s.selectBot);
  const setFocusTarget = useTwinStore((s) => s.setFocusTarget);
  const zones = useTwinStore((s) => s.zones);

  const alertList = Object.values(alerts).sort((a, b) => b.createdTick - a.createdTick);

  const handleAlertClick = (a: typeof alertList[0]) => {
    if (a.robotId) {
      selectBot(a.robotId);
    } else if (a.zoneId && zones[a.zoneId]) {
      const z = zones[a.zoneId];
      setFocusTarget([(z.bounds[0] + z.bounds[2]) / 2, 0, (z.bounds[1] + z.bounds[3]) / 2]);
    }
  };

  return (
    <Panel title="Active Alerts" grow>
      {alertList.map((a) => (
        <div
          key={a.id}
          className={`alert-card ${a.severity} ${a.acknowledged ? "acked" : ""}`}
          onClick={() => handleAlertClick(a)}
        >
          <span
            className="ico"
            style={{
              background:
                a.severity === "CRITICAL"
                  ? "#EF4444"
                  : a.severity === "HIGH"
                  ? "#F59E0B"
                  : "#38BDF8",
              color: "#FFFFFF",
            }}
          >
            {a.severity === "CRITICAL" ? "!" : a.severity === "HIGH" ? "▲" : "i"}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="ttl">{a.title}</div>
            <div className="meta">{a.detail}</div>
          </div>
          {!a.acknowledged && (
            <button
              className="ack"
              title="Acknowledge Alert"
              onClick={(e) => {
                e.stopPropagation();
                ackAlert(a.id);
              }}
            >
              {Icon.check}
            </button>
          )}
        </div>
      ))}
      {alertList.length === 0 && (
        <div style={{ color: "var(--muted)", padding: "8px 0", fontSize: "11px" }}>
          All warehouse systems nominal. Zero active alerts.
        </div>
      )}
    </Panel>
  );
}
