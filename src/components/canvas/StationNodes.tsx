/**
 * NexusTwin Station Nodes & Freight Elevators
 *
 * High-performance 3D operational workstation nodes and multi-tier freight lifts
 * built with @react-three/drei <RoundedBox>.
 * Features high-contrast clickable <Html distanceFactor={40}> status pills
 * (#1C1C1C background, #F8CB46 text) hovering above active picking stations and elevators.
 */

import React, { useState } from "react";
import { RoundedBox, Html } from "@react-three/drei";
import { useTwinStore, type WarehouseLocation, type ElevatorNode } from "../../store/useTwinStore";

// ─────────────────────────────────────────────────────────────
// Architectural Colors & Styling
// ─────────────────────────────────────────────────────────────

const COLORS = {
  PILL_BG: "#1C1C1C",
  PILL_TEXT: "#F8CB46",
  PILL_BORDER: "rgba(248, 203, 70, 0.4)",
  PILL_HOVER_BG: "#2D2D2D",
  STATION_BENCH: "#334155",
  STATION_SURFACE: "#1E293B",
  OVERHEAD_MONITOR: "#0F172A",
  CONVEYOR_BELT: "#0284C7",
  SHAFT_FRAME: "#1E293B",
  SHAFT_TRIM_YELLOW: "#F8CB46",
  ELEVATOR_CABIN: "#475569",
};

// ─────────────────────────────────────────────────────────────
// 1. Interactive HTML Status Pill Component
// ─────────────────────────────────────────────────────────────

interface StatusPillProps {
  label: string;
  subtext?: string;
  onClick: () => void;
  isActive?: boolean;
}

function StatusPill({ label, subtext, onClick, isActive }: StatusPillProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered || isActive ? COLORS.PILL_HOVER_BG : COLORS.PILL_BG,
        color: COLORS.PILL_TEXT,
        border: isActive ? `1.5px solid ${COLORS.PILL_TEXT}` : `1px solid ${COLORS.PILL_BORDER}`,
        padding: "5px 12px",
        borderRadius: "9999px",
        fontSize: "11px",
        fontWeight: 700,
        fontFamily: "'Inter', -apple-system, sans-serif",
        letterSpacing: "0.02em",
        boxShadow: "0 6px 16px rgba(0, 0, 0, 0.35)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        userSelect: "none",
        transition: "all 0.18s ease-in-out",
        transform: hovered ? "scale(1.06)" : "scale(1)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          backgroundColor: COLORS.PILL_TEXT,
          display: "inline-block",
          boxShadow: `0 0 8px ${COLORS.PILL_TEXT}`,
        }}
      />
      <span>{label}</span>
      {subtext && (
        <span style={{ color: "#E2E8F0", fontWeight: 500, opacity: 0.85 }}>
          · {subtext}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Individual Workstation Component
// ─────────────────────────────────────────────────────────────

interface WorkstationNodeProps {
  station: WarehouseLocation;
  isSelected: boolean;
  onSelect: () => void;
}

function WorkstationNode({ station, isSelected, onSelect }: WorkstationNodeProps) {
  const [x, z] = station.coords;
  const isPacking = station.type === "PACK_STATION";

  return (
    <group position={[x, 0, z]}>
      {/* Clickable <Html distanceFactor={40}> Floating Status Pill */}
      <Html position={[0, 2.7, 0]} center distanceFactor={40} zIndexRange={[10, 0]}>
        <StatusPill
          label={station.name}
          subtext={isPacking ? "READY (58 picks/hr)" : "RECEIVING"}
          onClick={onSelect}
          isActive={isSelected}
        />
      </Html>

      {/* Main Heavy-Duty Work Table */}
      <group position={[0, 0.45, 0]}>
        <RoundedBox
          args={[2.8, 0.9, 1.4]}
          radius={0.04}
          smoothness={4}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={COLORS.STATION_BENCH}
            roughness={0.4}
            metalness={0.5}
          />
        </RoundedBox>

        {/* Stainless Steel Desktop Layer */}
        <group position={[0, 0.46, 0]}>
          <RoundedBox
            args={[2.7, 0.04, 1.3]}
            radius={0.01}
            smoothness={4}
            receiveShadow
          >
            <meshStandardMaterial
              color="#CBD5E1"
              roughness={0.2}
              metalness={0.8}
            />
          </RoundedBox>
        </group>
      </group>

      {/* Overhead Monitor & Barcode Gantry */}
      <group position={[0, 1.8, -0.6]}>
        {/* Support Mast */}
        <RoundedBox args={[0.08, 1.8, 0.08]} radius={0.01} smoothness={4}>
          <meshStandardMaterial color={COLORS.STATION_SURFACE} />
        </RoundedBox>

        {/* Dispatch Screen Monitor */}
        <group position={[0, 0.4, 0.4]}>
          <RoundedBox args={[0.9, 0.5, 0.06]} radius={0.02} smoothness={4}>
            <meshStandardMaterial color={COLORS.OVERHEAD_MONITOR} roughness={0.3} />
          </RoundedBox>
          {/* Active Screen Face */}
          <group position={[0, 0, 0.035]}>
            <RoundedBox args={[0.82, 0.42, 0.01]} radius={0.01} smoothness={4}>
              <meshBasicMaterial color="#38BDF8" />
            </RoundedBox>
          </group>
        </group>
      </group>

      {/* Outfeed Roller Conveyor Segment */}
      <group position={[0, 0.4, 1.1]}>
        <RoundedBox args={[2.2, 0.25, 0.8]} radius={0.02} smoothness={4} castShadow>
          <meshStandardMaterial color={COLORS.CONVEYOR_BELT} roughness={0.3} metalness={0.6} />
        </RoundedBox>
      </group>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Freight Elevator Shaft Component
// ─────────────────────────────────────────────────────────────

interface ElevatorShaftProps {
  elevator: ElevatorNode;
  isSelected: boolean;
  onSelect: () => void;
}

function ElevatorShaft({ elevator, isSelected, onSelect }: ElevatorShaftProps) {
  const [x, z] = elevator.coords;
  const shaftHeight = 8.5;
  const shaftWidth = 2.8;
  const shaftDepth = 2.8;

  const cornerPosts = [
    [-shaftWidth / 2 + 0.1, -shaftDepth / 2 + 0.1],
    [shaftWidth / 2 - 0.1, -shaftDepth / 2 + 0.1],
    [-shaftWidth / 2 + 0.1, shaftDepth / 2 - 0.1],
    [shaftWidth / 2 - 0.1, shaftDepth / 2 - 0.1],
  ];

  return (
    <group position={[x, 0, z]}>
      {/* Clickable <Html distanceFactor={40}> Floating Status Pill */}
      <Html
        position={[0, shaftHeight + 1.2, 0]}
        center
        distanceFactor={40}
        zIndexRange={[10, 0]}
      >
        <StatusPill
          label={elevator.name}
          subtext={`FLOOR ${elevator.currentFloor} · ${elevator.status}`}
          onClick={onSelect}
          isActive={isSelected}
        />
      </Html>

      {/* 4 Vertical Structural Shaft Columns */}
      {cornerPosts.map(([cx, cz], i) => (
        <group key={`elevator-col-${i}`} position={[cx, shaftHeight / 2, cz]}>
          <RoundedBox
            args={[0.18, shaftHeight, 0.18]}
            radius={0.02}
            smoothness={4}
            castShadow
          >
            <meshStandardMaterial
              color={COLORS.SHAFT_FRAME}
              roughness={0.4}
              metalness={0.7}
            />
          </RoundedBox>
        </group>
      ))}

      {/* Overhead Drive Machinery Room with #F8CB46 Trim */}
      <group position={[0, shaftHeight + 0.4, 0]}>
        <RoundedBox
          args={[shaftWidth + 0.1, 0.8, shaftDepth + 0.1]}
          radius={0.05}
          smoothness={4}
          castShadow
        >
          <meshStandardMaterial
            color="#0F172A"
            roughness={0.3}
            metalness={0.7}
          />
        </RoundedBox>

        {/* Yellow Header Fascia Accent */}
        <group position={[0, 0.38, 0]}>
          <RoundedBox
            args={[shaftWidth + 0.12, 0.12, shaftDepth + 0.12]}
            radius={0.02}
            smoothness={4}
          >
            <meshStandardMaterial
              color={COLORS.SHAFT_TRIM_YELLOW}
              roughness={0.2}
              emissive={COLORS.SHAFT_TRIM_YELLOW}
              emissiveIntensity={0.2}
            />
          </RoundedBox>
        </group>
      </group>

      {/* Translucent Safety Glass / Enclosure Grille */}
      <group position={[0, shaftHeight / 2, 0]}>
        <RoundedBox
          args={[shaftWidth - 0.08, shaftHeight - 0.2, shaftDepth - 0.08]}
          radius={0.04}
          smoothness={4}
        >
          <meshStandardMaterial
            color="#38BDF8"
            transparent
            opacity={0.12}
            roughness={0.1}
            metalness={0.9}
          />
        </RoundedBox>
      </group>

      {/* Moving Elevator Platform / Cabin */}
      <group position={[0, elevator.currentFloor === 2 ? 4.5 : 0.2, 0]}>
        <RoundedBox
          args={[shaftWidth - 0.4, 0.25, shaftDepth - 0.4]}
          radius={0.03}
          smoothness={4}
          castShadow
        >
          <meshStandardMaterial
            color={COLORS.ELEVATOR_CABIN}
            roughness={0.5}
            metalness={0.5}
          />
        </RoundedBox>

        {/* Platform Yellow Safety Edge Strip */}
        <group position={[0, 0.14, 0]}>
          <RoundedBox
            args={[shaftWidth - 0.36, 0.04, shaftDepth - 0.36]}
            radius={0.01}
            smoothness={4}
          >
            <meshStandardMaterial color={COLORS.SHAFT_TRIM_YELLOW} />
          </RoundedBox>
        </group>
      </group>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Primary StationNodes Composite Export
// ─────────────────────────────────────────────────────────────

export function StationNodes() {
  const locations = useTwinStore((s) => s.locations);
  const elevators = useTwinStore((s) => s.elevators);
  const selectedStationId = useTwinStore((s) => s.selectedStationId);
  const selectedElevatorId = useTwinStore((s) => s.selectedElevatorId);
  const selectStation = useTwinStore((s) => s.selectStation);
  const selectElevator = useTwinStore((s) => s.selectElevator);

  const activeWorkstations = Object.values(locations).filter(
    (l) => l.type === "PACK_STATION" || l.type === "INBOUND_DOCK"
  );

  return (
    <group name="StationNodes">
      {/* Workstations (Packing Lines & Inbound Bays) */}
      {activeWorkstations.map((station) => (
        <WorkstationNode
          key={station.id}
          station={station}
          isSelected={selectedStationId === station.id}
          onSelect={() => selectStation(station.id)}
        />
      ))}

      {/* Multi-Tier Freight Elevators */}
      {Object.values(elevators).map((elevator) => (
        <ElevatorShaft
          key={elevator.id}
          elevator={elevator}
          isSelected={selectedElevatorId === elevator.id}
          onSelect={() => selectElevator(elevator.id)}
        />
      ))}
    </group>
  );
}

export default StationNodes;
