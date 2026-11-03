/**
 * NexusTwin Human Workers
 *
 * 3D high-visibility human worker avatars with animated walking cycles,
 * reflective safety vests, hard hats, and dynamic LiDAR intrusion zones.
 */

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { useTwinStore, type HumanWorker } from "../../store/useTwinStore";

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

    const effectiveDt = dt * Math.max(1, simulationSpeed);
    const k = 1.0 - Math.pow(0.001, effectiveDt);

    // Smooth movement interpolation along continuous floor plane
    grp.position.x += (worker.position[0] - grp.position.x) * k;
    grp.position.z += (worker.position[2] - grp.position.z) * k;
    grp.position.y = 0;

    // Angular orientation
    let dh = worker.headingRad - grp.rotation.y;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    grp.rotation.y += dh * k;

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
      <mesh position={[0, 0.02, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.2, 1.35, 32]} />
        <meshBasicMaterial color="#F97316" transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>

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
          <RoundedBox args={[0.13, 0.55, 0.16]} radius={0.02} smoothness={4} position={[0, -0.27, 0]}>
            <meshStandardMaterial color="#1E293B" roughness={0.7} />
          </RoundedBox>
          {/* Boot */}
          <mesh position={[0, -0.52, 0.04]}>
            <boxGeometry args={[0.14, 0.1, 0.22]} />
            <meshStandardMaterial color="#0F172A" roughness={0.9} />
          </mesh>
        </group>

        {/* Right Leg */}
        <group ref={rightLegRef} position={[0.14, 0.55, 0]}>
          <RoundedBox args={[0.13, 0.55, 0.16]} radius={0.02} smoothness={4} position={[0, -0.27, 0]}>
            <meshStandardMaterial color="#1E293B" roughness={0.7} />
          </RoundedBox>
          {/* Boot */}
          <mesh position={[0, -0.52, 0.04]}>
            <boxGeometry args={[0.14, 0.1, 0.22]} />
            <meshStandardMaterial color="#0F172A" roughness={0.9} />
          </mesh>
        </group>

        {/* Torso & High-Vis Orange Safety Vest */}
        <group position={[0, 0.95, 0]}>
          <RoundedBox args={[0.42, 0.55, 0.26]} radius={0.04} smoothness={4}>
            <meshStandardMaterial color="#EA580C" roughness={0.5} />
          </RoundedBox>

          {/* Silver Reflective Vest Strip */}
          <mesh position={[0, 0.02, 0.135]}>
            <planeGeometry args={[0.4, 0.08]} />
            <meshStandardMaterial color="#E2E8F0" roughness={0.1} metalness={0.9} />
          </mesh>
          <mesh position={[0, -0.15, 0.135]}>
            <planeGeometry args={[0.4, 0.08]} />
            <meshStandardMaterial color="#E2E8F0" roughness={0.1} metalness={0.9} />
          </mesh>
        </group>

        {/* Head & Face */}
        <group position={[0, 1.4, 0]}>
          <mesh>
            <sphereGeometry args={[0.14, 16, 16]} />
            <meshStandardMaterial color="#FBBF24" roughness={0.6} />
          </mesh>

          {/* Yellow Safety Hard Hat */}
          <group position={[0, 0.08, 0]}>
            <mesh>
              <sphereGeometry args={[0.17, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <meshStandardMaterial color="#FACC15" roughness={0.3} metalness={0.2} />
            </mesh>
            {/* Hard Hat Brim */}
            <mesh position={[0, -0.02, 0.04]} rotation-x={0.15}>
              <cylinderGeometry args={[0.2, 0.2, 0.02, 16]} />
              <meshStandardMaterial color="#EAB308" roughness={0.3} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

export function HumanWorkers() {
  const people = useTwinStore((s) => s.people);
  const showLabels = useTwinStore((s) => s.showLabels);
  const simulationSpeed = useTwinStore((s) => s.simulationSpeed);

  if (!people) return null;

  return (
    <group name="HumanWorkers">
      {Object.values(people).map((worker) => (
        <SingleHumanWorker
          key={worker.id}
          worker={worker}
          showLabels={showLabels}
          simulationSpeed={simulationSpeed}
        />
      ))}
    </group>
  );
}

export default HumanWorkers;
