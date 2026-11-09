/**
 * NexusTwin Conveyor System
 *
 * 3D motorized roller conveyors connecting packing stations to outbound dispatch doors:
 * - Steel side guide rails (#1E293B) and structural support legs
 * - Animated rotating cylindrical rollers driven by conveyor speed
 * - Animated corrugated cardboard boxes traveling along the line to shipping doors
 * - Jam / backlog detection with warning strobe indicators
 */

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { useTwinStore } from "../../store/useTwinStore";
import type { ConveyorSegment } from "../../engine/autoZoner";

// ─────────────────────────────────────────────────────────────
// Shared Singleton Geometries & Materials (Institutional Performance)
// ─────────────────────────────────────────────────────────────

const SHARED_CONVEYOR_GEOMETRIES = {
  legCylinder: new THREE.CylinderGeometry(0.03, 0.04, 0.44, 8),
  legBase: new THREE.BoxGeometry(0.1, 0.04, 1.0),
  rollerCylinder: new THREE.CylinderGeometry(0.035, 0.035, 0.88, 10),
  packageBox: new RoundedBoxGeometry(0.42, 0.22, 0.38, 2, 0.02),
  packageTape: new THREE.BoxGeometry(0.43, 0.002, 0.08),
  beaconSphere: new THREE.SphereGeometry(0.09, 10, 10),
};

const SHARED_CONVEYOR_MATERIALS = {
  leg: new THREE.MeshStandardMaterial({ color: "#334155", metalness: 0.7, roughness: 0.3 }),
  legBase: new THREE.MeshStandardMaterial({ color: "#1E293B" }),
  rail: new THREE.MeshStandardMaterial({ color: "#1E293B", metalness: 0.8, roughness: 0.3 }),
  roller: new THREE.MeshStandardMaterial({ color: "#64748B", metalness: 0.85, roughness: 0.25 }),
  package: new THREE.MeshStandardMaterial({ color: "#D97706", roughness: 0.7 }),
  tape: new THREE.MeshBasicMaterial({ color: "#FEF08A" }),
  beacon: new THREE.MeshBasicMaterial({ color: "#EF4444" }),
};

interface SingleConveyorProps {
  conveyor: ConveyorSegment;
  simulationSpeed: number;
}

function SingleConveyor({ conveyor, simulationSpeed }: SingleConveyorProps) {
  const { startCoords, endCoords, lengthM, speedMps = 1.5, isJammed } = conveyor;
  const rollersRef = useRef<THREE.Group>(null!);
  const packagesRef = useRef<THREE.Group>(null!);

  const dx = endCoords[0] - startCoords[0];
  const dz = endCoords[1] - startCoords[1];
  const angle = Math.atan2(dz, dx);
  const midX = (startCoords[0] + endCoords[0]) / 2;
  const midZ = (startCoords[1] + endCoords[1]) / 2;

  // Memoize rail geometry for this segment length
  const railGeo = useMemo(() => new THREE.BoxGeometry(lengthM, 0.08, 0.04), [lengthM]);

  // Number of rollers along the conveyor length
  const rollerCount = Math.max(4, Math.floor(lengthM / 0.5));

  // Package offsets along conveyor line
  const pkgCount = Math.max(1, Math.min(6, Math.floor(lengthM / 2.5)));
  const pkgOffsets = useRef<number[]>(
    Array.from({ length: pkgCount }, (_, i) => (i * (lengthM / pkgCount)))
  );

  useFrame((_, dt) => {
    if (isJammed) return;
    const effectiveDt = dt * Math.max(1, simulationSpeed);

    // Rotate rollers
    if (rollersRef.current) {
      rollersRef.current.children.forEach((child) => {
        (child as THREE.Mesh).rotation.z -= (speedMps / 0.1) * effectiveDt;
      });
    }

    // Move packages along conveyor
    if (packagesRef.current) {
      packagesRef.current.children.forEach((child, i) => {
        pkgOffsets.current[i] = (pkgOffsets.current[i] + speedMps * effectiveDt) % lengthM;
        // Position relative to conveyor center
        child.position.x = pkgOffsets.current[i] - lengthM / 2;
      });
    }
  });

  return (
    <group position={[midX, 0, midZ]} rotation-y={-angle}>
      {/* 1. Structural Steel Support Legs */}
      {[-lengthM / 2 + 0.4, 0, lengthM / 2 - 0.4].map((lx, idx) => (
        <group key={idx} position={[lx, 0, 0]}>
          <mesh
            position={[0, 0.22, -0.45]}
            geometry={SHARED_CONVEYOR_GEOMETRIES.legCylinder}
            material={SHARED_CONVEYOR_MATERIALS.leg}
          />
          <mesh
            position={[0, 0.22, 0.45]}
            geometry={SHARED_CONVEYOR_GEOMETRIES.legCylinder}
            material={SHARED_CONVEYOR_MATERIALS.leg}
          />
          <mesh
            position={[0, 0.02, 0]}
            geometry={SHARED_CONVEYOR_GEOMETRIES.legBase}
            material={SHARED_CONVEYOR_MATERIALS.legBase}
          />
        </group>
      ))}

      {/* 2. Side Guide Rails (Dark Charcoal #1E293B) */}
      <mesh
        position={[0, 0.46, -0.48]}
        geometry={railGeo}
        material={SHARED_CONVEYOR_MATERIALS.rail}
      />
      <mesh
        position={[0, 0.46, 0.48]}
        geometry={railGeo}
        material={SHARED_CONVEYOR_MATERIALS.rail}
      />

      {/* 3. Motorized Rollers */}
      <group ref={rollersRef} position={[0, 0.44, 0]}>
        {Array.from({ length: rollerCount }).map((_, rIdx) => {
          const rx = -lengthM / 2 + (rIdx + 0.5) * (lengthM / rollerCount);
          return (
            <mesh
              key={rIdx}
              position={[rx, 0, 0]}
              rotation-x={Math.PI / 2}
              geometry={SHARED_CONVEYOR_GEOMETRIES.rollerCylinder}
              material={SHARED_CONVEYOR_MATERIALS.roller}
            />
          );
        })}
      </group>

      {/* 4. Animated Traveling Packages */}
      <group ref={packagesRef} position={[0, 0.56, 0]}>
        {Array.from({ length: pkgCount }).map((_, pIdx) => (
          <group key={pIdx} position={[pkgOffsets.current[pIdx] - lengthM / 2, 0, 0]}>
            <mesh
              geometry={SHARED_CONVEYOR_GEOMETRIES.packageBox}
              material={SHARED_CONVEYOR_MATERIALS.package}
              castShadow
            />
            {/* Box tape strip */}
            <mesh
              position={[0, 0.112, 0]}
              geometry={SHARED_CONVEYOR_GEOMETRIES.packageTape}
              material={SHARED_CONVEYOR_MATERIALS.tape}
            />
          </group>
        ))}
      </group>

      {/* 5. Jam / Warning Beacon if jammed */}
      {isJammed && (
        <group position={[0, 0.8, 0]}>
          <mesh
            geometry={SHARED_CONVEYOR_GEOMETRIES.beaconSphere}
            material={SHARED_CONVEYOR_MATERIALS.beacon}
          />
        </group>
      )}
    </group>
  );
}

export function ConveyorSystem() {
  const conveyors = useTwinStore((s) => s.conveyors);
  const simulationSpeed = useTwinStore((s) => s.simulationSpeed);
  const gridDimensions = useTwinStore((s) => s.gridDimensions);
  const { widthM, depthM } = gridDimensions;

  if (!conveyors || conveyors.length === 0) return null;

  // Filter out invalid, zero/negative-length, or out-of-bounds conveyor lines
  const validConveyors = conveyors.filter(
    (c) =>
      c.lengthM > 0.4 &&
      c.startCoords[0] >= 0 &&
      c.startCoords[0] <= widthM &&
      c.startCoords[1] >= 0 &&
      c.startCoords[1] <= depthM &&
      c.endCoords[0] >= 0 &&
      c.endCoords[0] <= widthM &&
      c.endCoords[1] >= 0 &&
      c.endCoords[1] <= depthM
  );

  if (validConveyors.length === 0) return null;

  return (
    <group>
      {validConveyors.map((conv) => (
        <SingleConveyor key={conv.id} conveyor={conv} simulationSpeed={simulationSpeed} />
      ))}
    </group>
  );
}

export default ConveyorSystem;
