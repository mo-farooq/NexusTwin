/**
 * NexusTwin Station Nodes & Freight Elevators
 *
 * High-performance 3D operational workstation nodes and multi-tier freight lifts
 * built with @react-three/drei <RoundedBox>.
 * Features high-contrast clickable <Html distanceFactor={40}> status pills
 * (#1C1C1C background, #F8CB46 text) hovering above active picking stations and elevators.
 */

import React, { useState } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
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
// Shared Singleton Geometries & Materials (Institutional Performance)
// ─────────────────────────────────────────────────────────────

const SHARED_STATION_GEOMETRIES = {
  bench: new RoundedBoxGeometry(2.8, 0.9, 1.4, 3, 0.04),
  desktop: new RoundedBoxGeometry(2.7, 0.04, 1.3, 3, 0.01),
  mast: new THREE.BoxGeometry(0.08, 1.8, 0.08),
  monitor: new RoundedBoxGeometry(0.9, 0.5, 0.06, 3, 0.02),
  screenFace: new THREE.PlaneGeometry(0.82, 0.42),
  conveyorBelt: new RoundedBoxGeometry(2.2, 0.25, 0.8, 3, 0.02),
};

const SHARED_STATION_MATERIALS = {
  bench: new THREE.MeshStandardMaterial({
    color: COLORS.STATION_BENCH,
    roughness: 0.4,
    metalness: 0.5,
  }),
  desktop: new THREE.MeshStandardMaterial({
    color: "#CBD5E1",
    roughness: 0.2,
    metalness: 0.8,
  }),
  mast: new THREE.MeshStandardMaterial({
    color: COLORS.STATION_SURFACE,
  }),
  monitor: new THREE.MeshStandardMaterial({
    color: COLORS.OVERHEAD_MONITOR,
    roughness: 0.3,
  }),
  screenFace: new THREE.MeshBasicMaterial({
    color: "#38BDF8",
  }),
  conveyorBelt: new THREE.MeshStandardMaterial({
    color: COLORS.CONVEYOR_BELT,
    roughness: 0.3,
    metalness: 0.6,
  }),
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
        <Html position={[0, 2.7, 0]} center distanceFactor={40} zIndexRange={[isSelected ? 85 : 12, 0]}>
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
        <mesh
          geometry={SHARED_STATION_GEOMETRIES.bench}
          material={SHARED_STATION_MATERIALS.bench}
          castShadow
          receiveShadow
        />

        {/* Stainless Steel Desktop Layer */}
        <group position={[0, 0.46, 0]}>
          <mesh
            geometry={SHARED_STATION_GEOMETRIES.desktop}
            material={SHARED_STATION_MATERIALS.desktop}
            receiveShadow
          />
        </group>
      </group>

      {/* Overhead Monitor & Barcode Gantry */}
      <group position={[0, 1.8, -0.6]}>
        {/* Support Mast */}
        <mesh
          geometry={SHARED_STATION_GEOMETRIES.mast}
          material={SHARED_STATION_MATERIALS.mast}
        />

        {/* Dispatch Screen Monitor */}
        <group position={[0, 0.4, 0.4]}>
          <mesh
            geometry={SHARED_STATION_GEOMETRIES.monitor}
            material={SHARED_STATION_MATERIALS.monitor}
          />
          {/* Active Screen Face */}
          <mesh
            position={[0, 0, 0.035]}
            geometry={SHARED_STATION_GEOMETRIES.screenFace}
            material={SHARED_STATION_MATERIALS.screenFace}
          />
        </group>
      </group>

      {/* Outfeed Roller Conveyor Segment */}
      <group position={[0, 0.4, 1.1]}>
        <mesh
          geometry={SHARED_STATION_GEOMETRIES.conveyorBelt}
          material={SHARED_STATION_MATERIALS.conveyorBelt}
          castShadow
        />
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
