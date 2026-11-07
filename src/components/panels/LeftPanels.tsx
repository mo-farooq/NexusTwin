/**
 * NexusTwin Left Panels (Industrial SCADA Design System)
 *
 * Operational telemetry cards:
 * - Fleet: AMR count, floor clearance density, live proportional statebar, active/charging/idle split
 * - Performance: Throughput pace vs hourly target, pacebar, on-time SLA, cycle time, completed/in-flight
 * - Systems: Subsystem hardware telemetry with active LED status indicators
 * - Incidents: Live priority alerts with severity pills, 1-click camera focus, and acknowledgment actions
 */

import React from "react";
import { useTwinStore } from "../../store/useTwinStore";

export function FleetOverviewPanel() {
  const fleetSummary = useTwinStore((s) => s.fleetSummary);
  const gridDimensions = useTwinStore((s) => s.gridDimensions);
  const setModal = useTwinStore((s) => s.setModal);

  const { total, active, charging, idle, error } = fleetSummary;

  const areaM2 = gridDimensions.widthM * gridDimensions.depthM;
  const density = total > 0 ? (areaM2 / total).toFixed(1) : "0.0";
  const scaleBadge =
    areaM2 <= 600
      ? "Micro Dark Store"
      : areaM2 <= 1400
      ? "Compact MSME Depot"
      : areaM2 <= 2800
      ? "Standard Hub"
      : "Regional Mega DC";

  const pActive = total > 0 ? (active / total) * 100 : 0;
  const pCharge = total > 0 ? (charging / total) * 100 : 0;
  const pIdle = total > 0 ? ((idle + error) / total) * 100 : 0;

  return (
    <section className="card">
      <div className="card-h">
        <span className="t">Fleet</span>
        <span className="sp"></span>
        <button className="pill-s" onClick={() => setModal("tasks")} title="Configure Fleet">
          {scaleBadge}
        </button>
      </div>
      <div className="card-b">
        <div className="hero">
          <div className="big num">
            {total}
            <small>AMRs</small>
          </div>
          <div className="scale">
            <span className="sub">
              <b>{density}</b> m² / bot
            </span>
          </div>
        </div>

        {/* Proportional State Bar */}
        <div className="statebar">
          <div style={{ width: `${pActive}%`, background: "var(--signal)" }} title={`Moving: ${active}`} />
          <div style={{ width: `${pCharge}%`, background: "var(--blue)" }} title={`Charging: ${charging}`} />
          <div style={{ width: `${pIdle}%`, background: "#C9C2AF" }} title={`Idle/Fault: ${idle + error}`} />
        </div>

        {/* 3-way telemetry split */}
        <div className="split">
          <div>
            <div className="n num">{active}</div>
            <div className="k">
              <i style={{ background: "var(--signal)" }}></i>Moving
            </div>
          </div>
          <div>
            <div className="n num">{charging}</div>
            <div className="k">
              <i style={{ background: "var(--blue)" }}></i>Charging
            </div>
          </div>
          <div>
            <div className="n num">{idle + error}</div>
            <div className="k">
              <i style={{ background: "#C9C2AF" }}></i>Idle/fault
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TaskOverviewPanel() {
  const kpi = useTwinStore((s) => s.kpi);
  const tasks = useTwinStore((s) => s.tasks);

  const ongoing = Object.values(tasks).filter(
    (t) => t.status === "IN_PROGRESS" || t.status === "ASSIGNED"
  ).length;

  const targetHourly = 1200;
  const throughput = kpi.throughputPerHour || 0;
  const pacePct = Math.min(100, Math.round((throughput / targetHourly) * 100));

  return (
    <section className="card">
      <div className="card-h">
        <span className="t">Performance</span>
        <span className="sp"></span>
        <span className="lnk">shift A</span>
      </div>
      <div className="card-b">
        <div className="k-sm">Throughput pace</div>
        <div className="pace-v">
          <span className="num">{throughput.toLocaleString()}</span>
          <small>/ {targetHourly.toLocaleString()} units·h target</small>
        </div>

        {/* Throughput Target Pacebar */}
        <div className="pacebar">
          <div className="f" style={{ width: `${pacePct}%` }}></div>
          <div className="tgt" style={{ left: "80%" }} title="Shift Target: 80%"></div>
        </div>

        <div className="kgrid">
          <div>
            <div className="k-sm">On‑time SLA</div>
            <div className="v num">
              <span>{kpi.slaCompliancePct.toFixed(1)}</span>
              <small>%</small>
            </div>
          </div>
          <div>
            <div className="k-sm">Cycle time</div>
            <div className="v num">
              <span>{kpi.averageTaskDurationSec}</span>
              <small>s</small>
            </div>
          </div>
          <div>
            <div className="k-sm">Completed</div>
            <div className="v num">{kpi.totalCompletedTasks.toLocaleString()}</div>
          </div>
          <div>
            <div className="k-sm">In flight</div>
            <div className="v num">{ongoing}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SystemStatusPanel() {
  const conveyors = useTwinStore((s) => s.conveyors);
  const kpi = useTwinStore((s) => s.kpi);

  const isConveyorJammed = conveyors.some((c) => c.isJammed);
  const hasAcsViolations = (kpi.safetyViolationCount || 0) > 0;

  const systems = [
    { name: "A* Grid & Aisle Loops", status: "Nominal", color: "var(--signal)" },
    {
      name: "Outbound Sorter Lines",
      status: isConveyorJammed ? "Jammed" : "2.4 m/s",
      color: isConveyorJammed ? "var(--amber)" : "var(--signal)",
    },
    { name: "EV Fast Chargers (8 Pad)", status: "480 V · OK", color: "var(--signal)" },
    { name: "Mesh Comms & Telemetry", status: "8 ms latency", color: "var(--signal)" },
    {
      name: "LiDAR Safety ACS Radar",
      status: hasAcsViolations ? "ACS Alert" : "0 Breaches",
      color: hasAcsViolations ? "var(--red)" : "var(--signal)",
    },
  ];

  return (
    <section className="card">
      <div className="card-h">
        <span className="t">Systems</span>
        <span className="sp"></span>
        <span className="lnk">5 / 5 nominal</span>
      </div>
      <div className="card-b">
        <div className="health">
          {systems.map((s, idx) => (
            <div className="hrow" key={idx}>
              <span className="led" style={{ background: s.color }}></span>
              <span className="nm">{s.name}</span>
              <span className="st">{s.status}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
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

  const handleAckAll = () => {
    alertList.forEach((a) => {
      if (!a.acknowledged) ackAlert(a.id);
    });
  };

  return (
    <section className="card grow">
      <div className="card-h">
        <span className="t">Incidents</span>
        <span className="sp"></span>
        <button className="lnk" onClick={handleAckAll}>
          Ack all
        </button>
      </div>
      <div className="card-b fill">
        <div className="alerts">
          {alertList.map((a) => {
            const sevClass =
              a.severity === "CRITICAL" ? "c" : a.severity === "HIGH" ? "h" : "i";
            return (
              <div
                key={a.id}
                className={`alert ${sevClass} ${a.acknowledged ? "acked" : ""}`}
                onClick={() => handleAlertClick(a)}
              >
                <span className="bar"></span>
                <div>
                  <div className="ttl">{a.title}</div>
                  <div className="meta">
                    T+{a.createdTick} · {a.detail}
                  </div>
                </div>
                {!a.acknowledged && (
                  <button
                    className="ack"
                    onClick={(e) => {
                      e.stopPropagation();
                      ackAlert(a.id);
                    }}
                  >
                    ACK
                  </button>
                )}
              </div>
            );
          })}
          {alertList.length === 0 && (
            <div style={{ color: "var(--mute)", padding: "12px 0", fontSize: "11px" }}>
              All warehouse systems nominal. Zero active incidents.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
