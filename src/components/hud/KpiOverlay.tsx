/**
 * NexusTwin KPI Overlay HUD
 *
 * Top-left floating operational cards displaying real-time Throughput (Orders/hr),
 * Active Fleet Status & Utilization, and SLA Compliance % with quick-commerce metrics.
 */

import React from "react";
import { useTwinStore } from "../../store/useTwinStore";

export function KpiOverlay() {
  const kpi = useTwinStore((s) => s.kpi);
  const botUnits = useTwinStore((s) => s.botUnits);
  const decisionMetrics = useTwinStore((s) => s.decisionMetrics);

  const allBots = Object.values(botUnits);
  const activeCount = allBots.filter((b) => b.status === "ACTIVE").length;
  const chargingCount = allBots.filter((b) => b.status === "CHARGING").length;
  const idleCount = allBots.filter((b) => b.status === "IDLE").length;
  const errorCount = allBots.filter((b) => b.status === "ERROR" || b.status === "OFFLINE").length;

  const cardStyle: React.CSSProperties = {
    background: "rgba(255, 255, 255, 0.95)",
    backdropFilter: "blur(14px)",
    border: "1px solid rgba(226, 232, 240, 0.9)",
    borderRadius: "14px",
    padding: "14px 18px",
    boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
    width: "230px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    pointerEvents: "auto",
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "78px",
        left: "16px",
        zIndex: 15,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        pointerEvents: "none",
      }}
    >
      {/* 1. Throughput Card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
            Throughput
          </span>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: "4px",
              background: "#ECFDF5",
              color: "#059669",
            }}
          >
            +{decisionMetrics.throughputGainPct}% vs Manual
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span
            style={{
              fontSize: "26px",
              fontWeight: 900,
              color: "#0F172A",
              letterSpacing: "-0.03em",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {kpi.throughputPerHour}
          </span>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748B" }}>orders / hr</span>
        </div>

        <div
          style={{
            fontSize: "11px",
            color: "#64748B",
            fontWeight: 500,
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #F1F5F9",
            paddingTop: "6px",
          }}
        >
          <span>Completed: <b>{kpi.totalCompletedTasks}</b></span>
          <span>Pending: <b>{kpi.pendingTasksCount}</b></span>
        </div>
      </div>

      {/* 2. Active Fleet Status Card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
            Fleet Status
          </span>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#0F172A" }}>
            {kpi.fleetUtilizationPct}% Utilized
          </span>
        </div>

        {/* Fleet Utilization Progress Bar */}
        <div
          style={{
            width: "100%",
            height: "6px",
            background: "#F1F5F9",
            borderRadius: "9999px",
            overflow: "hidden",
            margin: "2px 0",
          }}
        >
          <div
            style={{
              width: `${kpi.fleetUtilizationPct}%`,
              height: "100%",
              background: "linear-gradient(90deg, #10B981, #3B82F6)",
              borderRadius: "9999px",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Micro Status Badges */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4px",
            fontSize: "11px",
            fontWeight: 600,
            paddingTop: "4px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981" }} />
            <span style={{ color: "#334155" }}>Active: {activeCount}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#3B82F6" }} />
            <span style={{ color: "#334155" }}>Charging: {chargingCount}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#F59E0B" }} />
            <span style={{ color: "#334155" }}>Idle: {idleCount}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#EF4444" }} />
            <span style={{ color: errorCount > 0 ? "#EF4444" : "#64748B" }}>Fault: {errorCount}</span>
          </div>
        </div>
      </div>

      {/* 3. SLA Compliance Card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
            SLA Compliance
          </span>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: "4px",
              background: kpi.slaCompliancePct > 95 ? "#ECFDF5" : "#FEF2F2",
              color: kpi.slaCompliancePct > 95 ? "#059669" : "#DC2626",
            }}
          >
            {kpi.slaCompliancePct > 95 ? "ON TARGET" : "AT RISK"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span
            style={{
              fontSize: "26px",
              fontWeight: 900,
              color: kpi.slaCompliancePct > 95 ? "#0F172A" : "#DC2626",
              letterSpacing: "-0.03em",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {kpi.slaCompliancePct}%
          </span>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748B" }}>on-time rate</span>
        </div>

        <div
          style={{
            fontSize: "11px",
            color: "#64748B",
            fontWeight: 500,
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #F1F5F9",
            paddingTop: "6px",
          }}
        >
          <span>Avg Cycle: <b>{kpi.averageTaskDurationSec}s</b></span>
          <span>Congestion: <b>{kpi.activeCongestionIndex}%</b></span>
        </div>
      </div>

      {/* 4. Anti-Collision System (ACS) Safety Card */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: "#10B981",
                boxShadow: "0 0 8px #10B981",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
              Anti-Collision (ACS)
            </span>
          </div>
          <span
            style={{
              fontSize: "10px",
              fontWeight: 800,
              padding: "2px 6px",
              borderRadius: "4px",
              background: "#ECFDF5",
              color: "#059669",
            }}
          >
            100% SAFE
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span
            style={{
              fontSize: "26px",
              fontWeight: 900,
              color: "#0F172A",
              letterSpacing: "-0.03em",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            0
          </span>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "#64748B" }}>collisions</span>
        </div>

        <div
          style={{
            fontSize: "11px",
            color: "#64748B",
            fontWeight: 500,
            display: "flex",
            justifyContent: "space-between",
            borderTop: "1px solid #F1F5F9",
            paddingTop: "6px",
          }}
        >
          <span>Safe Yields: <b style={{ color: "#059669" }}>{kpi.totalSafeYieldsResolved || 0}</b></span>
          <span>LiDAR Holds: <b style={{ color: "#D97706" }}>{kpi.nearMissesPrevented || 0}</b></span>
        </div>
      </div>
    </div>
  );
}

export default KpiOverlay;
