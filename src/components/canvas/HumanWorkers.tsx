/**
 * NexusTwin Human Workers
 *
 * 3D high-visibility human worker avatars with animated walking cycles,
 * reflective safety vests, hard hats, and dynamic LiDAR intrusion zones.
 */

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { useTwinStore, type HumanWorker } from "../../store/useTwinStore";

// ─────────────────────────────────────────────────────────────
// Shared Singleton Geometries & Materials (Institutional Performance)
// ─────────────────────────────────────────────────────────────

const SHARED_HUMAN_GEOMETRIES = {
  safetyRing: new THREE.RingGeometry(1.2, 1.35, 24),
  leg: new RoundedBoxGeometry(0.13, 0.55, 0.16, 2, 0.02),
  boot: new THREE.BoxGeometry(0.14, 0.1, 0.22),
  torso: new RoundedBoxGeometry(0.42, 0.55, 0.26, 2, 0.04),
  reflectiveStrip: new THREE.PlaneGeometry(0.4, 0.08),
  head: new THREE.SphereGeometry(0.14, 12, 12),
  helmetDome: new THREE.SphereGeometry(0.17, 12, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
  helmetBrim: new THREE.CylinderGeometry(0.2, 0.2, 0.02, 12),
};

const SHARED_HUMAN_MATERIALS = {
  safetyRing: new THREE.MeshBasicMaterial({ color: "#F97316", transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
  pants: new THREE.MeshStandardMaterial({ color: "#1E293B", roughness: 0.7 }),
  boot: new THREE.MeshStandardMaterial({ color: "#0F172A", roughness: 0.9 }),
  vest: new THREE.MeshStandardMaterial({ color: "#EA580C", roughness: 0.5 }),
  reflective: new THREE.MeshStandardMaterial({ color: "#E2E8F0", roughness: 0.1, metalness: 0.9 }),
  skin: new THREE.MeshStandardMaterial({ color: "#FBBF24", roughness: 0.6 }),
  helmetDome: new THREE.MeshStandardMaterial({ color: "#FACC15", roughness: 0.3, metalness: 0.2 }),
  helmetBrim: new THREE.MeshStandardMaterial({ color: "#EAB308", roughness: 0.3 }),
};

function SingleHumanWorker({
  worker,
  showLabels,
  simulationSpeed,
}: {
  worker: HumanWorker;
  showLabels: boolean;
  simulationSpeed: number;
}) {
  const groupRef = useRef<THREE.Group>(null!);
  const leftLegRef = useRef<THREE.Group>(null!);
  const rightLegRef = useRef<THREE.Group>(null!);

  // Initial mount coordinate references to avoid transform snaps on React dispatches
  const initRef = useRef<{ pos: [number, number, number]; heading: number } | null>(null);
  if (!initRef.current) {
    initRef.current = {
      pos: [worker.position[0], 0, worker.position[2]],
      heading: worker.headingRad,
    };
  }

  useFrame(({ clock }, dt) => {
    const grp = groupRef.current;
    if (!grp) return;

    const speedMultiplier = simulationSpeed >= 5 ? 4.8 : simulationSpeed >= 2 ? 2.4 : 1.0;
    const effectiveDt = dt * speedMultiplier;
    const k = Math.min(1.0, 1.0 - Math.pow(0.0001, effectiveDt));

    const distToTarget = Math.hypot(worker.position[0] - grp.position.x, worker.position[2] - grp.position.z);
    if (distToTarget > 1.8 || simulationSpeed >= 5) {
      const fastK = Math.max(k, 0.88);
      grp.position.x += (worker.position[0] - grp.position.x) * fastK;
      grp.position.z += (worker.position[2] - grp.position.z) * fastK;
    } else {
      grp.position.x += (worker.position[0] - grp.position.x) * k;
      grp.position.z += (worker.position[2] - grp.position.z) * k;
    }
    grp.position.y = 0;

    // Angular orientation
    let dh = worker.headingRad - grp.rotation.y;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    grp.rotation.y += dh * (simulationSpeed >= 5 ? Math.max(k, 0.85) : k);

    // Walking leg cycle (pauses when yielding/standing still)
    const isWalking = !worker.isYielding && worker.speed > 0;
    const walkPhase = isWalking
      ? clock.elapsedTime * 6 * worker.speed * Math.max(1, simulationSpeed * 0.7)
      : 0;
    if (leftLegRef.current && rightLegRef.current) {
      leftLegRef.current.rotation.x = Math.sin(walkPhase) * 0.45;
      rightLegRef.current.rotation.x = -Math.sin(walkPhase) * 0.45;
    }
  });

  return (
    <group ref={groupRef} position={initRef.current.pos} rotation-y={initRef.current.heading}>
      {/* Dynamic 2.0m Human LiDAR Safety Perimeter Ring */}
      <mesh
        position={[0, 0.02, 0]}
        rotation-x={-Math.PI / 2}
        geometry={SHARED_HUMAN_GEOMETRIES.safetyRing}
        material={SHARED_HUMAN_MATERIALS.safetyRing}
      />

      {/* Floating Name Badge */}
      {showLabels && (
        <Html position={[0, 2.1, 0]} center distanceFactor={32} zIndexRange={[12, 0]}>
          <div
            style={{
              background: "rgba(15, 23, 42, 0.92)",
              color: "#FDE047",
              border: "1px solid #EA580C",
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "10px",
              fontWeight: 800,
              whiteSpace: "nowrap",
              fontFamily: "'JetBrains Mono', monospace",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#F97316",
                display: "inline-block",
              }}
            />
            <span>{worker.name}</span>
            <span style={{ color: "#94A3B8" }}>({worker.role})</span>
          </div>
        </Html>
      )}

      {/* Human Body Model */}
      <group position={[0, 0, 0]}>
        {/* Left Leg */}
        <group ref={leftLegRef} position={[-0.14, 0.55, 0]}>
          <mesh
            position={[0, -0.27, 0]}
            geometry={SHARED_HUMAN_GEOMETRIES.leg}
            material={SHARED_HUMAN_MATERIALS.pants}
          />
          {/* Boot */}
          <mesh
            position={[0, -0.52, 0.04]}
            geometry={SHARED_HUMAN_GEOMETRIES.boot}
            material={SHARED_HUMAN_MATERIALS.boot}
          />
        </group>

        {/* Right Leg */}
        <group ref={rightLegRef} position={[0.14, 0.55, 0]}>
          <mesh
            position={[0, -0.27, 0]}
            geometry={SHARED_HUMAN_GEOMETRIES.leg}
            material={SHARED_HUMAN_MATERIALS.pants}
          />
          {/* Boot */}
          <mesh
            position={[0, -0.52, 0.04]}
            geometry={SHARED_HUMAN_GEOMETRIES.boot}
            material={SHARED_HUMAN_MATERIALS.boot}
          />
        </group>

        {/* Torso & High-Vis Orange Safety Vest */}
        <group position={[0, 0.95, 0]}>
          <mesh
            geometry={SHARED_HUMAN_GEOMETRIES.torso}
            material={SHARED_HUMAN_MATERIALS.vest}
          />

          {/* Silver Reflective Vest Strip */}
          <mesh
            position={[0, 0.02, 0.135]}
            geometry={SHARED_HUMAN_GEOMETRIES.reflectiveStrip}
            material={SHARED_HUMAN_MATERIALS.reflective}
          />
          <mesh
            position={[0, -0.15, 0.135]}
            geometry={SHARED_HUMAN_GEOMETRIES.reflectiveStrip}
            material={SHARED_HUMAN_MATERIALS.reflective}
          />
        </group>

        {/* Head & Face */}
        <group position={[0, 1.4, 0]}>
          <mesh
            geometry={SHARED_HUMAN_GEOMETRIES.head}
            material={SHARED_HUMAN_MATERIALS.skin}
          />

          {/* Yellow Safety Hard Hat */}
          <group position={[0, 0.08, 0]}>
            <mesh
              geometry={SHARED_HUMAN_GEOMETRIES.helmetDome}
              material={SHARED_HUMAN_MATERIALS.helmetDome}
            />
            {/* Hard Hat Brim */}
            <mesh
              position={[0, -0.02, 0.04]}
              rotation-x={0.15}
              geometry={SHARED_HUMAN_GEOMETRIES.helmetBrim}
              material={SHARED_HUMAN_MATERIALS.helmetBrim}
            />
          </group>
        </group>
      </group>
    </group>
  );
}

export function HumanWorkers() {
  const people = useTwinStore((s) => s.people);
  const showLabels = useTwinStore((s) => s.showLabels);
  const isAnyModalOpen = useTwinStore((s) => s.isSandboxModalOpen || s.isBuilderModalOpen || s.modal !== null);
  const simulationSpeed = useTwinStore((s) => s.simulationSpeed);

  if (!people) return null;

  return (
    <group name="HumanWorkers">
      {Object.values(people).map((worker) => (
        <SingleHumanWorker
          key={worker.id}
          worker={worker}
          showLabels={showLabels && !isAnyModalOpen}
          simulationSpeed={simulationSpeed}
        />
      ))}
    </group>
  );
}

export default HumanWorkers;
