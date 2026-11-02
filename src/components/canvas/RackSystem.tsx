/**
 * NexusTwin Rack System
 *
 * High-performance 3D warehouse storage racks rendered using @react-three/drei <RoundedBox>.
 * Features 4 vertical shelf tiers per rack, light slate structural frames, #F8CB46 yellow
 * top fascia trim, inventory storage totes, and a volumetric heatmap mode where
 * high-congestion rack aisles glow dynamically from amber to critical red.
 */

import React, { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useTwinStore, type WarehouseLocation } from "../../store/useTwinStore";
import { worldToCell } from "../../engine/pathfinder";

// ─────────────────────────────────────────────────────────────
// Architectural Colors & Dimensions
// ─────────────────────────────────────────────────────────────

const RACK_CONFIG = {
  WIDTH: 2.4,
  DEPTH: 1.0,
  TOTAL_HEIGHT: 4.4,
  TIER_COUNT: 4,
  POST_THICKNESS: 0.08,
  BEAM_HEIGHT: 0.07,
  DECK_THICKNESS: 0.04,
  FASCIA_HEIGHT: 0.16,
  COLORS: {
    FRAME_LIGHT_SLATE: "#94A3B8", // Light slate structural uprights
    FRAME_DARK_SLATE: "#64748B",  // Shelf crossbeam supports
    DECK_SLATE: "#CBD5E1",        // Steel tier deck plate
    TOP_FASCIA_YELLOW: "#F8CB46", // Signature Blinkit Yellow top trim
    BOX_PALETTE: ["#D97706", "#B45309", "#92400E", "#F59E0B", "#E2E8F0", "#0284C7"],
    HEATMAP_LOW: "#F59E0B",       // Amber for moderate traffic
    HEATMAP_HIGH: "#EF4444",      // Critical red for high bottleneck/congestion
  },
};

// ─────────────────────────────────────────────────────────────
// Single Rack Unit Component
// ─────────────────────────────────────────────────────────────

interface SingleRackProps {
  shelf: WarehouseLocation;
  congestionLevel: number; // 0.0 to 1.0
  isHeatmapActive: boolean;
}

function SingleRack({ shelf, congestionLevel, isHeatmapActive }: SingleRackProps) {
  const [x, z] = shelf.coords;
  const selectRack = useTwinStore((s) => s.selectRack);
  const selectedRackId = useTwinStore((s) => s.selectedRackId);
  const isSelected = selectedRackId === shelf.id;

  const {
    WIDTH,
    DEPTH,
    TOTAL_HEIGHT,
    TIER_COUNT,
    POST_THICKNESS,
    BEAM_HEIGHT,
    DECK_THICKNESS,
    FASCIA_HEIGHT,
    COLORS,
  } = RACK_CONFIG;

  const tierHeight = (TOTAL_HEIGHT - FASCIA_HEIGHT) / TIER_COUNT;

  // Determine dynamic volumetric heatmap color & intensity
  const heatColor = useMemo(() => {
    if (congestionLevel < 0.4) {
      return COLORS.HEATMAP_LOW;
    }
    return COLORS.HEATMAP_HIGH;
  }, [congestionLevel, COLORS]);

  const showGlow = isHeatmapActive && congestionLevel > 0.08;

  // Inventory boxes on each of the 4 tiers (colored by SKU velocity in heatmap mode)
  const tierBoxes = useMemo(() => {
    const boxes: Array<{
      key: string;
      position: [number, number, number];
      size: [number, number, number];
      color: string;
      emissive?: string;
      emissiveIntensity?: number;
    }> = [];

    for (let tier = 1; tier <= TIER_COUNT; tier++) {
      const tierY = (tier - 1) * tierHeight + 0.1;
      const tierData = shelf.tiers?.find((t) => t.level === tier);

      // 2 storage totes per tier
      for (let b = 0; b < 2; b++) {
        const boxWidth = 0.85;
        const boxHeight = 0.55;
        const boxDepth = DEPTH - 0.22;
        const offsetX = -WIDTH / 4 + b * (WIDTH / 2);

        // Default pallet color
        const charCode = shelf.id.charCodeAt(shelf.id.length - 1) + tier + b;
        let color = COLORS.BOX_PALETTE[charCode % COLORS.BOX_PALETTE.length];
        let emissive = "#000000";
        let emissiveIntensity = 0;

        // In heatmap mode, highlight Level 4 high-velocity bottleneck vs Level 1 fast-picks
        if (isHeatmapActive && tierData) {
          if (tier === 4 && tierData.velocity === "HIGH") {
            color = "#EF4444";
            emissive = "#EF4444";
            emissiveIntensity = 0.5;
          } else if (tier <= 2 && tierData.velocity === "HIGH") {
            color = "#0C831F";
            emissive = "#0C831F";
            emissiveIntensity = 0.35;
          }
        }

        boxes.push({
          key: `${shelf.id}-t${tier}-b${b}`,
          position: [offsetX, tierY + boxHeight / 2 + DECK_THICKNESS, 0],
          size: [boxWidth, boxHeight, boxDepth],
          color,
          emissive,
          emissiveIntensity,
        });
      }
    }

    return boxes;
  }, [shelf.id, shelf.tiers, tierHeight, TIER_COUNT, WIDTH, DEPTH, DECK_THICKNESS, COLORS.BOX_PALETTE, isHeatmapActive]);

  // Corner post positions
  const postOffsets: Array<[number, number]> = useMemo(
    () => [
      [-WIDTH / 2 + POST_THICKNESS / 2, -DEPTH / 2 + POST_THICKNESS / 2],
      [WIDTH / 2 - POST_THICKNESS / 2, -DEPTH / 2 + POST_THICKNESS / 2],
      [-WIDTH / 2 + POST_THICKNESS / 2, DEPTH / 2 - POST_THICKNESS / 2],
      [WIDTH / 2 - POST_THICKNESS / 2, DEPTH / 2 - POST_THICKNESS / 2],
    ],
    [WIDTH, DEPTH, POST_THICKNESS]
  );

  return (
    <group
      position={[x, 0, z]}
      onClick={(e) => {
        e.stopPropagation();
        selectRack(shelf.id);
      }}
    >
      {/* Selected Rack Glow Base Plinth */}
      {isSelected && (
        <mesh position={[0, 0.035, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[WIDTH + 0.5, DEPTH + 0.5]} />
          <meshBasicMaterial color="#F8CB46" transparent opacity={0.65} />
        </mesh>
      )}

      {/* 1. Volumetric Congestion Heatmap Aura (Glows Amber/Red when congested) */}
      {showGlow && (
        <group position={[0, TOTAL_HEIGHT / 2, 0]}>
          <RoundedBox
            args={[WIDTH + 0.35, TOTAL_HEIGHT + 0.2, DEPTH + 0.35]}
            radius={0.08}
            smoothness={4}
          >
            <meshStandardMaterial
              color={heatColor}
              emissive={heatColor}
              emissiveIntensity={0.8 + congestionLevel * 1.6}
              transparent
              opacity={0.18 + Math.min(0.5, congestionLevel * 0.5)}
              roughness={0.2}
            />
          </RoundedBox>
        </group>
      )}

      {/* 2. Four Structural Corner Uprights (Light Slate Frames) */}
      {postOffsets.map(([px, pz], idx) => (
        <group key={`post-${idx}`} position={[px, TOTAL_HEIGHT / 2, pz]}>
          <RoundedBox
            args={[POST_THICKNESS, TOTAL_HEIGHT, POST_THICKNESS]}
            radius={0.015}
            smoothness={4}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={COLORS.FRAME_LIGHT_SLATE}
              roughness={0.35}
              metalness={0.65}
            />
          </RoundedBox>
        </group>
      ))}

      {/* 3. Four Vertical Shelf Tiers (Crossbeams & Deck Plates) */}
      {Array.from({ length: TIER_COUNT }).map((_, tierIdx) => {
        const tierY = (tierIdx + 1) * tierHeight;

        return (
          <group key={`tier-${tierIdx}`}>
            {/* Front Support Beam */}
            <group position={[0, tierY, DEPTH / 2 - POST_THICKNESS / 2]}>
              <RoundedBox
                args={[WIDTH - 0.02, BEAM_HEIGHT, 0.05]}
                radius={0.01}
                smoothness={4}
                castShadow
              >
                <meshStandardMaterial
                  color={COLORS.FRAME_DARK_SLATE}
                  roughness={0.4}
                  metalness={0.5}
                />
              </RoundedBox>
            </group>

            {/* Back Support Beam */}
            <group position={[0, tierY, -DEPTH / 2 + POST_THICKNESS / 2]}>
              <RoundedBox
                args={[WIDTH - 0.02, BEAM_HEIGHT, 0.05]}
                radius={0.01}
                smoothness={4}
                castShadow
              >
                <meshStandardMaterial
                  color={COLORS.FRAME_DARK_SLATE}
                  roughness={0.4}
                  metalness={0.5}
                />
              </RoundedBox>
            </group>

            {/* Steel Deck Plate */}
            <group position={[0, tierY + DECK_THICKNESS / 2, 0]}>
              <RoundedBox
                args={[WIDTH - POST_THICKNESS * 2, DECK_THICKNESS, DEPTH - POST_THICKNESS]}
                radius={0.008}
                smoothness={4}
                receiveShadow
              >
                <meshStandardMaterial
                  color={COLORS.DECK_SLATE}
                  roughness={0.45}
                  metalness={0.55}
                />
              </RoundedBox>
            </group>
          </group>
        );
      })}

      {/* 4. Signature #F8CB46 Yellow Top Fascia Trim */}
      <group position={[0, TOTAL_HEIGHT + FASCIA_HEIGHT / 2, 0]}>
        <RoundedBox
          args={[WIDTH + 0.04, FASCIA_HEIGHT, DEPTH + 0.04]}
          radius={0.02}
          smoothness={4}
          castShadow
        >
          <meshStandardMaterial
            color={COLORS.TOP_FASCIA_YELLOW}
            roughness={0.25}
            metalness={0.15}
            emissive={showGlow ? heatColor : COLORS.TOP_FASCIA_YELLOW}
            emissiveIntensity={showGlow ? 0.35 : 0.05}
          />
        </RoundedBox>

        {/* Structural Fascia Lip / Contrast Aisle Plate */}
        <group position={[0, 0, DEPTH / 2 + 0.025]}>
          <RoundedBox args={[0.9, 0.09, 0.02]} radius={0.005} smoothness={4}>
            <meshStandardMaterial color="#1E293B" roughness={0.3} />
          </RoundedBox>
        </group>
      </group>

      {/* 5. Inventory Totes & Cartons on Shelf Tiers */}
      {tierBoxes.map((box) => (
        <group key={box.key} position={box.position}>
          <RoundedBox
            args={box.size}
            radius={0.03}
            smoothness={4}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={box.color}
              emissive={box.emissive || "#000000"}
              emissiveIntensity={box.emissiveIntensity || 0}
              roughness={0.65}
              metalness={0.15}
            />
          </RoundedBox>
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Primary RackSystem Export
// ─────────────────────────────────────────────────────────────

export interface RackSystemProps {
  forceHeatmapMode?: boolean;
}

export function RackSystem({ forceHeatmapMode }: RackSystemProps) {
  const locations = useTwinStore((s) => s.locations);
  const activeCongestionMap = useTwinStore((s) => s.activeCongestionMap);
  const storeHeatmapMode = useTwinStore((s) => s.heatmapMode);
  const gridDimensions = useTwinStore((s) => s.gridDimensions);

  const isHeatmapActive = forceHeatmapMode ?? storeHeatmapMode;

  const shelfLocations = useMemo(
    () => Object.values(locations).filter((l) => l.type === "SHELF"),
    [locations]
  );

  return (
    <group name="RackSystem">
      {shelfLocations.map((shelf) => {
        // Sample surrounding congestion at the rack's picking access point
        const [accCol, accRow] = worldToCell(
          shelf.accessPoint[0],
          shelf.accessPoint[1],
          gridDimensions.cellSize
        );
        const cellIndex = accRow * gridDimensions.cols + accCol;

        let congestionScore = 0.0;
        if (cellIndex >= 0 && cellIndex < activeCongestionMap.length) {
          congestionScore = Math.min(1.0, activeCongestionMap[cellIndex] / 1.5);
        }

        return (
          <SingleRack
            key={shelf.id}
            shelf={shelf}
            congestionLevel={congestionScore}
            isHeatmapActive={isHeatmapActive}
          />
        );
      })}
    </group>
  );
}

export default RackSystem;
