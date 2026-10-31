/**
 * NexusTwin Inspector Drawer HUD
 *
 * Right-side slide-over panel displaying real-time telemetry, battery health,
 * kinematic velocity, active task routing, and operational controls when any 3D
 * BotUnit, storage rack, workstation, or elevator is selected.
 */

import React from "react";
import { useTwinStore } from "../../store/useTwinStore";

export function InspectorDrawer() {
  const selectedBotId = useTwinStore((s) => s.selectedBotId);
  const selectedRackId = useTwinStore((s) => s.selectedRackId);
  const selectedStationId = useTwinStore((s) => s.selectedStationId);
  const selectedElevatorId = useTwinStore((s) => s.selectedElevatorId);

  const selectBot = useTwinStore((s) => s.selectBot);
  const selectRack = useTwinStore((s) => s.selectRack);
  const selectStation = useTwinStore((s) => s.selectStation);
  const selectElevator = useTwinStore((s) => s.selectElevator);

  const botUnits = useTwinStore((s) => s.botUnits);
  const botProfiles = useTwinStore((s) => s.botProfiles);
  const locations = useTwinStore((s) => s.locations);
  const elevators = useTwinStore((s) => s.elevators);
  const tasks = useTwinStore((s) => s.tasks);
  const injectBotFailure = useTwinStore((s) => s.injectBotFailure);

  const hasSelection = Boolean(
    selectedBotId || selectedRackId || selectedStationId || selectedElevatorId
  );

  if (!hasSelection) return null;

  const handleClose = () => {
    selectBot(null);
    selectRack(null);
    selectStation(null);
    selectElevator(null);
  };

  const selectedBot = selectedBotId ? botUnits[selectedBotId] : null;
  const selectedProfile = selectedBot ? botProfiles[selectedBot.profileId] : null;
  const selectedRack = selectedRackId ? locations[selectedRackId] : null;
  const selectedStation = selectedStationId ? locations[selectedStationId] : null;
  const selectedElevator = selectedElevatorId ? elevators[selectedElevatorId] : null;

  return (
    <aside
      style={{
        position: "absolute",
        top: "78px",
        right: "16px",
        bottom: "16px",
        width: "340px",
        zIndex: 25,
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(226, 232, 240, 0.9)",
        borderRadius: "16px",
        boxShadow: "0 20px 35px -10px rgba(15, 23, 42, 0.12), 0 10px 15px -3px rgba(15, 23, 42, 0.05)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        pointerEvents: "auto",
        animation: "slideInRight 0.22s ease-out",
      }}
    >
      {/* Drawer Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #F1F5F9",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "16px" }}>
            {selectedBot ? "🤖" : selectedRack ? "📦" : selectedElevator ? "🛗" : "🏭"}
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 800, color: "#0F172A" }}>
              {selectedBot
                ? selectedBot.id
                : selectedRack
                ? selectedRack.name
                : selectedElevator
                ? selectedElevator.name
                : selectedStation?.name}
            </h3>
            <span style={{ fontSize: "10px", color: "#64748B", fontWeight: 600 }}>
              {selectedBot ? "AUTONOMOUS MOBILE BOT" : "FACILITY ELEMENT"}
            </span>
          </div>
        </div>

        <button
          onClick={handleClose}
          style={{
            background: "#F1F5F9",
            border: "none",
            borderRadius: "8px",
            width: "28px",
            height: "28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#64748B",
            fontWeight: 700,
          }}
        >
          ✕
        </button>
      </div>

      {/* Drawer Body (Scrollable) */}
      <div style={{ flex: 1, padding: "16px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* BOTUNIT TELEMETRY VIEW */}
        {selectedBot && selectedProfile && (
          <>
            {/* Status & Battery Card */}
            <div
              style={{
                background: "#F8FAFC",
                borderRadius: "12px",
                padding: "12px",
                border: "1px solid #E2E8F0",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>OPERATIONAL STATUS</span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: "9999px",
                    background:
                      selectedBot.status === "ACTIVE"
                        ? "#ECFDF5"
                        : selectedBot.status === "CHARGING"
                        ? "#EFF6FF"
                        : "#FFFBEB",
                    color:
                      selectedBot.status === "ACTIVE"
                        ? "#059669"
                        : selectedBot.status === "CHARGING"
                        ? "#2563EB"
                        : "#D97706",
                  }}
                >
                  {selectedBot.status} · {selectedBot.fsmState}
                </span>
              </div>

              {/* Battery Bar */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: 700, marginBottom: "4px" }}>
                  <span style={{ color: "#334155" }}>Battery Level</span>
                  <span style={{ color: selectedBot.batteryPct < 20 ? "#EF4444" : "#059669" }}>
                    {Math.round(selectedBot.batteryPct)}%
                  </span>
                </div>
                <div style={{ width: "100%", height: "8px", background: "#E2E8F0", borderRadius: "9999px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${selectedBot.batteryPct}%`,
                      height: "100%",
                      background:
                        selectedBot.batteryPct < 20
                          ? "#EF4444"
                          : selectedBot.batteryPct < 50
                          ? "#F59E0B"
                          : "#10B981",
                      borderRadius: "9999px",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Hardware Profile & Specs */}
            <div style={{ background: "#F8FAFC", borderRadius: "12px", padding: "12px", border: "1px solid #E2E8F0" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#0F172A", display: "block", marginBottom: "8px" }}>
                BOT HARDWARE SPECIFICATION
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px" }}>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Model:</span>
                  <b style={{ color: "#0F172A" }}>{selectedProfile.name}</b>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Vendor:</span>
                  <b style={{ color: "#0F172A" }}>{selectedProfile.vendor}</b>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Max Speed:</span>
                  <b style={{ color: "#0F172A" }}>{selectedProfile.maxSpeedMps} m/s</b>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Payload Cap:</span>
                  <b style={{ color: "#0F172A" }}>{selectedProfile.payloadCapacityKg} kg</b>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>CapEx Cost:</span>
                  <b style={{ color: "#059669" }}>₹{(selectedProfile.capexCostINR / 100000).toFixed(1)} Lakh</b>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Health:</span>
                  <b style={{ color: "#0F172A" }}>{selectedBot.healthPct}%</b>
                </div>
              </div>
            </div>

            {/* Real-time Kinematics & Coordinates */}
            <div style={{ background: "#F8FAFC", borderRadius: "12px", padding: "12px", border: "1px solid #E2E8F0" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#0F172A", display: "block", marginBottom: "8px" }}>
                LIVE KINEMATICS & POSE
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px" }}>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Velocity:</span>
                  <b style={{ color: "#0F172A" }}>{selectedBot.velocity.toFixed(2)} m/s</b>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Current Load:</span>
                  <b style={{ color: selectedBot.currentPayloadKg > 0 ? "#D97706" : "#64748B" }}>
                    {selectedBot.currentPayloadKg} kg
                  </b>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>World Position:</span>
                  <b style={{ color: "#0F172A" }}>
                    [{selectedBot.position[0].toFixed(1)}, {selectedBot.position[2].toFixed(1)}]
                  </b>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Waypoints Left:</span>
                  <b style={{ color: "#0F172A" }}>
                    {Math.max(0, selectedBot.path.length - selectedBot.pathIndex)}
                  </b>
                </div>
              </div>
            </div>

            {/* Mission Telemetry Stats */}
            <div style={{ background: "#F8FAFC", borderRadius: "12px", padding: "12px", border: "1px solid #E2E8F0" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#0F172A", display: "block", marginBottom: "8px" }}>
                CUMULATIVE TELEMETRY
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px" }}>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Distance Traveled:</span>
                  <b style={{ color: "#0F172A" }}>{Math.round(selectedBot.stats.distanceTraveledM)} m</b>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Tasks Done:</span>
                  <b style={{ color: "#0F172A" }}>{selectedBot.stats.tasksCompleted}</b>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Energy Used:</span>
                  <b style={{ color: "#0F172A" }}>{Math.round(selectedBot.stats.energyConsumedWh)} Wh</b>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block" }}>Active Ticks:</span>
                  <b style={{ color: "#0F172A" }}>{selectedBot.stats.busyTicks}</b>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
              <button
                onClick={() => injectBotFailure(selectedBot.id)}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid #FCA5A5",
                  background: "#FEF2F2",
                  color: "#DC2626",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Inject Failure
              </button>
            </div>
          </>
        )}

        {/* STORAGE RACK TELEMETRY VIEW */}
        {selectedRack && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ background: "#F8FAFC", borderRadius: "12px", padding: "12px", border: "1px solid #E2E8F0" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#0F172A", display: "block", marginBottom: "8px" }}>
                RACK SPECIFICATIONS
              </span>
              <div style={{ fontSize: "11px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div><span style={{ color: "#64748B" }}>Zone:</span> <b>{selectedRack.zoneId}</b></div>
                <div><span style={{ color: "#64748B" }}>Bay Coordinates:</span> <b>[{selectedRack.coords[0]}, {selectedRack.coords[1]}]</b></div>
                <div><span style={{ color: "#64748B" }}>Access Point:</span> <b>[{selectedRack.accessPoint[0]}, {selectedRack.accessPoint[1]}]</b></div>
                <div><span style={{ color: "#64748B" }}>Vertical Tiers:</span> <b>4 Storage Tiers</b></div>
                <div><span style={{ color: "#64748B" }}>Capacity:</span> <b>8 Storage Totes (2 per tier)</b></div>
              </div>
            </div>
          </div>
        )}

        {/* WORKSTATION VIEW */}
        {selectedStation && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ background: "#F8FAFC", borderRadius: "12px", padding: "12px", border: "1px solid #E2E8F0" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#0F172A", display: "block", marginBottom: "8px" }}>
                WORKSTATION TELEMETRY
              </span>
              <div style={{ fontSize: "11px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div><span style={{ color: "#64748B" }}>Type:</span> <b>{selectedStation.type}</b></div>
                <div><span style={{ color: "#64748B" }}>Zone:</span> <b>{selectedStation.zoneId}</b></div>
                <div><span style={{ color: "#64748B" }}>Coordinates:</span> <b>[{selectedStation.coords[0]}, {selectedStation.coords[1]}]</b></div>
                <div><span style={{ color: "#64748B" }}>Pack Throughput:</span> <b>58 orders / hr</b></div>
              </div>
            </div>
          </div>
        )}

        {/* FREIGHT ELEVATOR VIEW */}
        {selectedElevator && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ background: "#F8FAFC", borderRadius: "12px", padding: "12px", border: "1px solid #E2E8F0" }}>
              <span style={{ fontSize: "11px", fontWeight: 800, color: "#0F172A", display: "block", marginBottom: "8px" }}>
                FREIGHT ELEVATOR STATUS
              </span>
              <div style={{ fontSize: "11px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div><span style={{ color: "#64748B" }}>Floor Level:</span> <b>Floor {selectedElevator.currentFloor}</b></div>
                <div><span style={{ color: "#64748B" }}>Door Interlock:</span> <b>{selectedElevator.doorState}</b></div>
                <div><span style={{ color: "#64748B" }}>Status:</span> <b>{selectedElevator.status}</b></div>
                <div><span style={{ color: "#64748B" }}>Queued Bots:</span> <b>{selectedElevator.queueLength}</b></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default InspectorDrawer;
