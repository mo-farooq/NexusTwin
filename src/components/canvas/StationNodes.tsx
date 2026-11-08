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
import { useTwinStore, type WarehouseLocation } from "../../store/useTwinStore";

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
  const showLabels = useTwinStore((s) => s.showLabels);
  const [x, z] = station.coords;
  const isPacking = station.type === "PACK_STATION";

  return (
    <group position={[x, 0, z]}>
      {/* Clickable <Html distanceFactor={40}> Floating Status Pill */}
      {(showLabels || isSelected) && (
        <Html position={[0, 2.7, 0]} center distanceFactor={40} zIndexRange={[10, 0]}>
          <StatusPill
            label={station.name}
            subtext={isPacking ? "READY (58 picks/hr)" : "RECEIVING"}
            onClick={onSelect}
            isActive={isSelected}
          />
        </Html>
      )}

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
// 3. Primary StationNodes Composite Export
// ─────────────────────────────────────────────────────────────

export function StationNodes() {
  const locations = useTwinStore((s) => s.locations);
  const gridDimensions = useTwinStore((s) => s.gridDimensions);
  const { widthM, depthM } = gridDimensions;
  const selectedStationId = useTwinStore((s) => s.selectedStationId);
  const selectStation = useTwinStore((s) => s.selectStation);

  // Strictly filter out any workstations that lie outside the facility bounds
  const activeWorkstations = Object.values(locations).filter(
    (l) =>
      (l.type === "PACK_STATION" || l.type === "INBOUND_DOCK") &&
      l.coords[0] >= 0.5 &&
      l.coords[0] <= widthM - 0.5 &&
      l.coords[1] >= 0.5 &&
      l.coords[1] <= depthM - 0.5
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
    </group>
  );
}

export default StationNodes;
