/**
 * NexusTwin Rack System (High-Performance InstancedMesh Architecture)
 *
 * Ultra-high-performance 3D warehouse storage racks rendered using Three.js InstancedMesh.
 * Converts 1,250+ individual meshes down to 6 instanced draw calls:
 * 1. Upright structural posts
 * 2. Crossbeams (Front & Back per tier)
 * 3. Steel tier deck plates
 * 4. Signature #F8CB46 yellow top fascia trim
 * 5. Structural contrast lip plates
 * 6. Multi-colored inventory totes with per-instance color buffers
 *
 * Includes dynamic volumetric congestion glow when heatmap mode is active,
 * clickable hitboxes, and active selection plinth.
 */

import React, { useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import { useTwinStore } from "../../store/useTwinStore";
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
// Primary High-Performance Instanced RackSystem
// ─────────────────────────────────────────────────────────────

export interface RackSystemProps {
  forceHeatmapMode?: boolean;
}

export function RackSystem({ forceHeatmapMode }: RackSystemProps) {
  const locations = useTwinStore((s) => s.locations);
  const activeCongestionMap = useTwinStore((s) => s.activeCongestionMap);
  const storeHeatmapMode = useTwinStore((s) => s.heatmapMode);
  const gridDimensions = useTwinStore((s) => s.gridDimensions);
  const selectedRackId = useTwinStore((s) => s.selectedRackId);
  const selectRack = useTwinStore((s) => s.selectRack);

  const isHeatmapActive = forceHeatmapMode ?? storeHeatmapMode;

  const shelfLocations = useMemo(
    () => Object.values(locations).filter((l) => l.type === "SHELF"),
    [locations]
  );

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

  // Refs for InstancedMesh instances
  const postMeshRef = useRef<THREE.InstancedMesh>(null!);
  const beamMeshRef = useRef<THREE.InstancedMesh>(null!);
  const deckMeshRef = useRef<THREE.InstancedMesh>(null!);
  const fasciaMeshRef = useRef<THREE.InstancedMesh>(null!);
  const lipMeshRef = useRef<THREE.InstancedMesh>(null!);
  const toteMeshRef = useRef<THREE.InstancedMesh>(null!);

  // Geometries & Materials memoized for zero GC allocation
  const geometries = useMemo(() => {
    return {
      post: new THREE.BoxGeometry(POST_THICKNESS, TOTAL_HEIGHT, POST_THICKNESS),
      beam: new THREE.BoxGeometry(WIDTH - 0.02, BEAM_HEIGHT, 0.05),
      deck: new THREE.BoxGeometry(WIDTH - POST_THICKNESS * 2, DECK_THICKNESS, DEPTH - POST_THICKNESS),
      fascia: new THREE.BoxGeometry(WIDTH + 0.04, FASCIA_HEIGHT, DEPTH + 0.04),
      lip: new THREE.BoxGeometry(0.9, 0.09, 0.02),
      tote: new THREE.BoxGeometry(0.85, 0.55, DEPTH - 0.22),
    };
  }, [WIDTH, DEPTH, TOTAL_HEIGHT, POST_THICKNESS, BEAM_HEIGHT, DECK_THICKNESS, FASCIA_HEIGHT]);

  const materials = useMemo(() => {
    return {
      post: new THREE.MeshStandardMaterial({
        color: COLORS.FRAME_LIGHT_SLATE,
        roughness: 0.35,
        metalness: 0.65,
      }),
      beam: new THREE.MeshStandardMaterial({
        color: COLORS.FRAME_DARK_SLATE,
        roughness: 0.4,
        metalness: 0.5,
      }),
      deck: new THREE.MeshStandardMaterial({
        color: COLORS.DECK_SLATE,
        roughness: 0.45,
        metalness: 0.55,
      }),
      fascia: new THREE.MeshStandardMaterial({
        color: COLORS.TOP_FASCIA_YELLOW,
        roughness: 0.25,
        metalness: 0.15,
      }),
      lip: new THREE.MeshStandardMaterial({
        color: "#1E293B",
        roughness: 0.3,
      }),
      tote: new THREE.MeshStandardMaterial({
        roughness: 0.65,
        metalness: 0.15,
      }),
    };
  }, [COLORS]);

  // Corner post relative offsets
  const postOffsets: Array<[number, number]> = useMemo(
    () => [
      [-WIDTH / 2 + POST_THICKNESS / 2, -DEPTH / 2 + POST_THICKNESS / 2],
      [WIDTH / 2 - POST_THICKNESS / 2, -DEPTH / 2 + POST_THICKNESS / 2],
      [-WIDTH / 2 + POST_THICKNESS / 2, DEPTH / 2 - POST_THICKNESS / 2],
      [WIDTH / 2 - POST_THICKNESS / 2, DEPTH / 2 - POST_THICKNESS / 2],
    ],
    [WIDTH, DEPTH, POST_THICKNESS]
  );

  // Populate transformation matrices & colors across instanced buffers
  useEffect(() => {
    if (!postMeshRef.current || !beamMeshRef.current || !deckMeshRef.current ||
        !fasciaMeshRef.current || !lipMeshRef.current || !toteMeshRef.current) {
      return;
    }

    const dummy = new THREE.Object3D();
    const tempColor = new THREE.Color();

    let postIdx = 0;
    let beamIdx = 0;
    let deckIdx = 0;
    let toteIdx = 0;

    shelfLocations.forEach((shelf, sIdx) => {
      const [x, z] = shelf.coords;

      // 1. Four Structural Upright Posts
      postOffsets.forEach(([px, pz]) => {
        dummy.position.set(x + px, TOTAL_HEIGHT / 2, z + pz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        postMeshRef.current.setMatrixAt(postIdx++, dummy.matrix);
      });

      // 2. Shelf Tiers: Beams & Decks
      for (let tierIdx = 0; tierIdx < TIER_COUNT; tierIdx++) {
        const tierY = (tierIdx + 1) * tierHeight;

        // Front Support Beam
        dummy.position.set(x, tierY, z + DEPTH / 2 - POST_THICKNESS / 2);
        dummy.updateMatrix();
        beamMeshRef.current.setMatrixAt(beamIdx++, dummy.matrix);

        // Back Support Beam
        dummy.position.set(x, tierY, z - DEPTH / 2 + POST_THICKNESS / 2);
        dummy.updateMatrix();
        beamMeshRef.current.setMatrixAt(beamIdx++, dummy.matrix);

        // Steel Deck Plate
        dummy.position.set(x, tierY + DECK_THICKNESS / 2, z);
        dummy.updateMatrix();
        deckMeshRef.current.setMatrixAt(deckIdx++, dummy.matrix);
      }

      // 3. Top Yellow Fascia Trim
      dummy.position.set(x, TOTAL_HEIGHT + FASCIA_HEIGHT / 2, z);
      dummy.updateMatrix();
      fasciaMeshRef.current.setMatrixAt(sIdx, dummy.matrix);

      // 4. Contrast Lip Plate
      dummy.position.set(x, TOTAL_HEIGHT + FASCIA_HEIGHT / 2, z + DEPTH / 2 + 0.025);
      dummy.updateMatrix();
      lipMeshRef.current.setMatrixAt(sIdx, dummy.matrix);

      // 5. Inventory Totes & Cartons (8 totes per shelf)
      for (let tier = 1; tier <= TIER_COUNT; tier++) {
        const tierY = (tier - 1) * tierHeight + 0.1;
        const tierData = shelf.tiers?.find((t) => t.level === tier);

        for (let b = 0; b < 2; b++) {
          const offsetX = -WIDTH / 4 + b * (WIDTH / 2);
          const boxHeight = 0.55;

          dummy.position.set(x + offsetX, tierY + boxHeight / 2 + DECK_THICKNESS, z);
          dummy.updateMatrix();
          toteMeshRef.current.setMatrixAt(toteIdx, dummy.matrix);

          // Pallet color selection
          const charCode = shelf.id.charCodeAt(shelf.id.length - 1) + tier + b;
          let colorHex = COLORS.BOX_PALETTE[charCode % COLORS.BOX_PALETTE.length];

          // Heatmap SKU velocity coloring
          if (isHeatmapActive && tierData) {
            if (tier === 4 && tierData.velocity === "HIGH") {
              colorHex = "#EF4444";
            } else if (tier <= 2 && tierData.velocity === "HIGH") {
              colorHex = "#0C831F";
            }
          }

          tempColor.set(colorHex);
          toteMeshRef.current.setColorAt(toteIdx, tempColor);
          toteIdx++;
        }
      }
    });

    postMeshRef.current.instanceMatrix.needsUpdate = true;
    beamMeshRef.current.instanceMatrix.needsUpdate = true;
    deckMeshRef.current.instanceMatrix.needsUpdate = true;
    fasciaMeshRef.current.instanceMatrix.needsUpdate = true;
    lipMeshRef.current.instanceMatrix.needsUpdate = true;
    toteMeshRef.current.instanceMatrix.needsUpdate = true;
    if (toteMeshRef.current.instanceColor) {
      toteMeshRef.current.instanceColor.needsUpdate = true;
    }
  }, [
    shelfLocations,
    postOffsets,
    tierHeight,
    WIDTH,
    DEPTH,
    TOTAL_HEIGHT,
    TIER_COUNT,
    POST_THICKNESS,
    DECK_THICKNESS,
    FASCIA_HEIGHT,
    COLORS,
    isHeatmapActive,
  ]);

  // Selected rack coordinate
  const selectedShelf = useMemo(
    () => shelfLocations.find((s) => s.id === selectedRackId),
    [shelfLocations, selectedRackId]
  );

  // Volumetric Congestion Glow for high-traffic aisles (only computed when heatmap mode is active)
  const congestedRacks = useMemo(() => {
    if (!isHeatmapActive) return [];

    return shelfLocations
      .map((shelf) => {
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

        if (congestionScore <= 0.08) return null;

        const heatColor =
          congestionScore < 0.4 ? COLORS.HEATMAP_LOW : COLORS.HEATMAP_HIGH;

        return {
          shelf,
          congestionScore,
          heatColor,
        };
      })
      .filter(Boolean) as Array<{
        shelf: (typeof shelfLocations)[0];
        congestionScore: number;
        heatColor: string;
      }>;
  }, [
    isHeatmapActive,
    shelfLocations,
    activeCongestionMap,
    gridDimensions,
    COLORS,
  ]);

  const totalShelves = shelfLocations.length;
  if (totalShelves === 0) return null;

  return (
    <group name="RackSystem">
      {/* 1. Structural Corner Uprights (1 Instanced Mesh) */}
      <instancedMesh
        ref={postMeshRef}
        args={[geometries.post, materials.post, totalShelves * 4]}
        castShadow
        receiveShadow
      />

      {/* 2. Shelf Crossbeams (1 Instanced Mesh) */}
      <instancedMesh
        ref={beamMeshRef}
        args={[geometries.beam, materials.beam, totalShelves * 8]}
        castShadow
      />

      {/* 3. Steel Deck Plates (1 Instanced Mesh) */}
      <instancedMesh
        ref={deckMeshRef}
        args={[geometries.deck, materials.deck, totalShelves * 4]}
        receiveShadow
      />

      {/* 4. Yellow Top Fascia Trim (1 Instanced Mesh) */}
      <instancedMesh
        ref={fasciaMeshRef}
        args={[geometries.fascia, materials.fascia, totalShelves]}
        castShadow
      />

      {/* 5. Contrast Lip Plate (1 Instanced Mesh) */}
      <instancedMesh
        ref={lipMeshRef}
        args={[geometries.lip, materials.lip, totalShelves]}
      />

      {/* 6. Inventory Storage Totes with Multi-Color Buffer (1 Instanced Mesh) */}
      <instancedMesh
        ref={toteMeshRef}
        args={[geometries.tote, materials.tote, totalShelves * 8]}
        castShadow
        receiveShadow
      />

      {/* Selected Rack Glow Base Plinth */}
      {selectedShelf && (
        <mesh
          position={[selectedShelf.coords[0], 0.035, selectedShelf.coords[1]]}
          rotation-x={-Math.PI / 2}
        >
          <planeGeometry args={[WIDTH + 0.5, DEPTH + 0.5]} />
          <meshBasicMaterial color="#F8CB46" transparent opacity={0.65} />
        </mesh>
      )}

      {/* Volumetric Congestion Aura (Rendered only for congested aisles when heatmap active) */}
      {isHeatmapActive &&
        congestedRacks.map(({ shelf, congestionScore, heatColor }) => (
          <mesh
            key={`glow-${shelf.id}`}
            position={[shelf.coords[0], TOTAL_HEIGHT / 2, shelf.coords[1]]}
          >
            <boxGeometry
              args={[WIDTH + 0.35, TOTAL_HEIGHT + 0.2, DEPTH + 0.35]}
            />
            <meshStandardMaterial
              color={heatColor}
              emissive={heatColor}
              emissiveIntensity={0.8 + congestionScore * 1.6}
              transparent
              opacity={0.18 + Math.min(0.5, congestionScore * 0.5)}
              roughness={0.2}
            />
          </mesh>
        ))}

      {/* Invisible Interactive Click & Hover Hitboxes (0 draw overhead) */}
      <group name="RackHitBoxes">
        {shelfLocations.map((shelf) => (
          <mesh
            key={`hit-${shelf.id}`}
            position={[shelf.coords[0], TOTAL_HEIGHT / 2, shelf.coords[1]]}
            onClick={(e) => {
              e.stopPropagation();
              selectRack(shelf.id);
            }}
            onPointerOver={() => {
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              document.body.style.cursor = "default";
            }}
          >
            <boxGeometry args={[WIDTH + 0.1, TOTAL_HEIGHT + 0.2, DEPTH + 0.1]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export default RackSystem;
