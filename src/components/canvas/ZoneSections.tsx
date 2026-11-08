/**
 * NexusTwin Zone Sections & Architectural 3D Ground Markers
 *
 * Renders distinct 3D visual boundaries and floating <Html> section signage
 * across all 5 warehouse zones:
 * 1. INBOUND_RECEIVING (Purple #8B5CF6 / Stacked incoming pallets & scan portal)
 * 2. STORAGE_RACKS (Blinkit Yellow #F8CB46 / Multi-tier rack boundary)
 * 3. CHARGING_DOCKS (Operational Green #0C831F / Dedicated EV pad perimeter)
 * 4. PACKING_STATIONS (Amber #F59E0B / Kiosk sorting buffer)
 * 5. OUTBOUND_CONVEYORS (Charcoal #1C1C1C / Shipping dispatch doors)
 */

import React, { useMemo } from "react";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useTwinStore, type WarehouseZone } from "../../store/useTwinStore";

// ─────────────────────────────────────────────────────────────
// Section Icons & Signage Definitions
// ─────────────────────────────────────────────────────────────

interface SectionMeta {
  icon: string;
  badge: string;
  title: string;
  desc: string;
}

const SECTION_METAS: Record<string, SectionMeta> = {
  ZONE_INBOUND: {
    icon: "📥",
    badge: "INBOUND",
    title: "RECEIVING & STAGING",
    desc: "Raw Pallet Buffer · Barcode Verification",
  },
  ZONE_STORAGE: {
    icon: "📦",
    badge: "STORAGE",
    title: "MULTI-TIER CORE",
    desc: "4-Level High-Density AMR Racks",
  },
  ZONE_CHARGING: {
    icon: "⚡",
    badge: "ENERGY",
    title: "EV CHARGING BAY",
    desc: "Autonomous DC Fast-Charging",
  },
  ZONE_PACKING: {
    icon: "🛠️",
    badge: "FULFILLMENT",
    title: "PACKING & SORTING",
    desc: "Automated Kiosks & Queue Buffer",
  },
  ZONE_OUTBOUND: {
    icon: "📤",
    badge: "DISPATCH",
    title: "OUTBOUND CONVEYORS",
    desc: "Motorized Rollers ➔ Shipping Bays",
  },
};

// ─────────────────────────────────────────────────────────────
// Floating 3D Section Billboard Sign
// ─────────────────────────────────────────────────────────────

function SectionSignage({
  meta,
  color,
  position,
}: {
  meta: SectionMeta;
  color: string;
  position: [number, number, number];
}) {
  const showLabels = useTwinStore((s) => s.showLabels);
  if (!showLabels) return null;

  return (
    <Html position={position} center distanceFactor={48} zIndexRange={[12, 0]}>
      <div
        style={{
          background: "rgba(15, 23, 42, 0.92)",
          backdropFilter: "blur(8px)",
          border: `1.5px solid ${color}`,
          borderRadius: "8px",
          padding: "4px 10px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          boxShadow: `0 8px 20px rgba(0, 0, 0, 0.35), 0 0 14px ${color}33`,
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
          transform: "translateY(-50%)",
        }}
      >
        <span style={{ fontSize: "14px" }}>{meta.icon}</span>
        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span
              style={{
                fontSize: "9px",
                fontWeight: 900,
                color: "#0F172A",
                background: color,
                padding: "1px 5px",
                borderRadius: "3px",
                letterSpacing: "0.04em",
              }}
            >
              {meta.badge}
            </span>
            <span style={{ fontSize: "11px", fontWeight: 800, color: "#FFFFFF", letterSpacing: "0.02em" }}>
              {meta.title}
            </span>
          </div>
          <span style={{ fontSize: "9px", color: "#94A3B8", fontWeight: 500 }}>
            {meta.desc}
          </span>
        </div>
      </div>
    </Html>
  );
}

// ─────────────────────────────────────────────────────────────
// 3D Pallet Staging Portal Mesh (for Inbound Receiving)
// ─────────────────────────────────────────────────────────────

function InboundPortalNode({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Wooden Staged Pallet Base */}
      <group position={[0, 0.08, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.4, 0.12, 1.2]} />
          <meshStandardMaterial color="#B45309" roughness={0.9} />
        </mesh>
        {/* Incoming Carton on Pallet */}
        <RoundedBox args={[1.1, 0.7, 0.9]} position={[0, 0.42, 0]} radius={0.02} smoothness={2}>
          <meshStandardMaterial color="#D97706" roughness={0.7} />
        </RoundedBox>
        {/* Shipping Label */}
        <mesh position={[0.56, 0.45, 0]}>
          <planeGeometry args={[0.2, 0.3]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      </group>

      {/* Inbound Scan Portal Archway */}
      <group position={[0, 0, 1.4]}>
        {/* Left upright */}
        <mesh position={[-0.9, 1.2, 0]}>
          <boxGeometry args={[0.08, 2.4, 0.08]} />
          <meshStandardMaterial color="#8B5CF6" metalness={0.6} />
        </mesh>
        {/* Right upright */}
        <mesh position={[0.9, 1.2, 0]}>
          <boxGeometry args={[0.08, 2.4, 0.08]} />
          <meshStandardMaterial color="#8B5CF6" metalness={0.6} />
        </mesh>
        {/* Top crossbeam */}
        <mesh position={[0, 2.38, 0]}>
          <boxGeometry args={[1.88, 0.08, 0.08]} />
          <meshStandardMaterial color="#8B5CF6" metalness={0.6} />
        </mesh>
        {/* Green laser scan bar */}
        <mesh position={[0, 2.3, 0]}>
          <boxGeometry args={[1.7, 0.02, 0.02]} />
          <meshBasicMaterial color="#10B981" />
        </mesh>
      </group>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Zone Sections Renderer
// ─────────────────────────────────────────────────────────────

export function ZoneSections() {
  const zones = useTwinStore((s) => s.zones);
  const gridDimensions = useTwinStore((s) => s.gridDimensions);
  const { widthM, depthM } = gridDimensions;

  const zoneList = useMemo(() => Object.values(zones), [zones]);

  return (
    <group>
      {zoneList.map((z) => {
        const rawX0 = Math.min(z.bounds[0], z.bounds[2]);
        const rawX1 = Math.max(z.bounds[0], z.bounds[2]);
        const rawZ0 = Math.min(z.bounds[1], z.bounds[3]);
        const rawZ1 = Math.max(z.bounds[1], z.bounds[3]);

        const x0 = Math.max(1, Math.min(widthM - 2, rawX0));
        const x1 = Math.max(x0 + 1, Math.min(widthM - 1, rawX1));
        const z0 = Math.max(1, Math.min(depthM - 2, rawZ0));
        const z1 = Math.max(z0 + 1, Math.min(depthM - 1, rawZ1));

        const width = Math.max(1, x1 - x0);
        const depth = Math.max(1, z1 - z0);
        const midX = (x0 + x1) / 2;
        const midZ = (z0 + z1) / 2;

        const meta =
          SECTION_METAS[z.id] || {
            icon: "📍",
            badge: "ZONE",
            title: z.name,
            desc: "Operational Floor Segment",
          };

        return (
          <group key={z.id}>
            {/* 1. Floor Tint Mesh */}
            <mesh
              position={[midX, 0.004, midZ]}
              rotation-x={-Math.PI / 2}
            >
              <planeGeometry args={[width, depth]} />
              <meshBasicMaterial
                color={z.color}
                transparent
                opacity={0.06}
                depthWrite={false}
              />
            </mesh>

            {/* 2. Perimeter Floor Border Ribbon (Thick Colored Line) */}
            <group position={[midX, 0.012, midZ]}>
              {/* North border */}
              <mesh position={[0, 0, -depth / 2]}>
                <boxGeometry args={[width, 0.005, 0.12]} />
                <meshBasicMaterial color={z.color} transparent opacity={0.8} />
              </mesh>
              {/* South border */}
              <mesh position={[0, 0, depth / 2]}>
                <boxGeometry args={[width, 0.005, 0.12]} />
                <meshBasicMaterial color={z.color} transparent opacity={0.8} />
              </mesh>
              {/* West border */}
              <mesh position={[-width / 2, 0, 0]}>
                <boxGeometry args={[0.12, 0.005, depth]} />
                <meshBasicMaterial color={z.color} transparent opacity={0.8} />
              </mesh>
              {/* East border */}
              <mesh position={[width / 2, 0, 0]}>
                <boxGeometry args={[0.12, 0.005, depth]} />
                <meshBasicMaterial color={z.color} transparent opacity={0.8} />
              </mesh>
            </group>

            {/* 3. Floating 3D Section Billboard Signage */}
            <SectionSignage
              meta={meta}
              color={z.color}
              position={[midX, 4.2, z0 + 1.0]}
            />

            {/* 4. Inbound Pallet Staging Portal Fixture */}
            {(z.id === "ZONE_INBOUND" || z.sectionType === "INBOUND") && (
              <InboundPortalNode position={[x0 + 1.2, 0, (z0 + z1) / 2]} />
            )}
          </group>
        );
      })}
    </group>
  );
}

export default ZoneSections;
