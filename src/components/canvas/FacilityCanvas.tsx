/**
 * NexusTwin Facility 3D Canvas
 *
 * High-performance React Three Fiber canvas rendering a bright architectural isometric
 * digital twin with light concrete flooring, dashed Blinkit-yellow transit corridors,
 * dedicated charging pads, instanced inventory racks, autonomous BotUnit fleets,
 * and smooth OrbitControls camera tracking.
 */

import React, { useMemo, useRef, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, RoundedBox, Html, AdaptiveDpr, AdaptiveEvents } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useTwinStore, type ChargingDock } from "../../store/useTwinStore";
import { RackSystem } from "./RackSystem";
import { StationNodes } from "./StationNodes";
import { BotFleet } from "./BotFleet";
import { ZoneSections } from "./ZoneSections";
import { ConveyorSystem } from "./ConveyorSystem";
import { HumanWorkers } from "./HumanWorkers";

// ─────────────────────────────────────────────────────────────
// Color Palette & Architectural Constants
// ─────────────────────────────────────────────────────────────

const COLORS = {
  BACKGROUND: "#F1F5F9",        // Clean architectural slate-100
  CONCRETE_FLOOR: "#E2E8F0",    // Light architectural concrete slate-200
  GRID_LINES: "#CBD5E1",        // Subtle layout grid line
  TRANSIT_LANE: "#F8CB46",      // High-visibility Blinkit Yellow
  CHARGING_PAD: "#0C831F",      // Indian quick-commerce Green
  CHARGING_BORDER: "#15803D",
  PLINTH_BORDER: "#94A3B8",     // Outer architectural foundation
  RACK_POST: "#334155",         // Anthracite structural steel
  RACK_BEAM: "#F97316",         // Safety orange rack beams
  RACK_SHELF: "#64748B",        // Steel deck plates
  BOT_CHASSIS: "#FFFFFF",       // Pristine white composite chassis
  BOT_TOP_PANEL: "#0F172A",     // Contrast slate top lid
  BOT_ACCENT: "#38BDF8",        // Nexus cyan LED strip
  BOX_PALETTE: ["#D97706", "#B45309", "#92400E", "#F59E0B", "#E2E8F0"],
};

// ─────────────────────────────────────────────────────────────
// 1. Camera Rig with Target Lerping on Entity Selection
// ─────────────────────────────────────────────────────────────

interface CameraRigProps {
  controlsRef: React.RefObject<OrbitControlsImpl>;
  widthM: number;
  depthM: number;
  interactive?: boolean;
  fixedCameraPosition?: [number, number, number];
  fixedCameraTarget?: [number, number, number];
}

function CameraRig({
  controlsRef,
  widthM,
  depthM,
  interactive = true,
  fixedCameraPosition,
  fixedCameraTarget,
}: CameraRigProps) {
  const selectedBotId = useTwinStore((s) => s.selectedBotId);
  const focusTarget = useTwinStore((s) => s.focusTarget);
  const activeCamera = useTwinStore((s) => s.activeCamera);
  const setActiveCamera = useTwinStore((s) => s.setActiveCamera);
  const activeFloor = useTwinStore((s) => s.activeFloor);

  const defaultCenter = useMemo(
    () => (fixedCameraTarget ? new THREE.Vector3(...fixedCameraTarget) : new THREE.Vector3(widthM / 2, 0.2, depthM / 2)),
    [widthM, depthM, fixedCameraTarget]
  );

  // Ensure controls.target is always locked to the middle of the facility from the very start
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    (window as unknown as { __threeControls: OrbitControlsImpl }).__threeControls = controls;
    const initialTarget = fixedCameraTarget
      ? new THREE.Vector3(...fixedCameraTarget)
      : new THREE.Vector3(widthM / 2, 0.2, depthM / 2);
    controls.target.copy(initialTarget);
    controls.update();
  }, [controlsRef, widthM, depthM, fixedCameraTarget]);

  const targetLerpGoal = useRef<THREE.Vector3 | null>(null);
  const cameraPositionGoal = useRef<THREE.Vector3 | null>(null);
  const isUserInteracting = useRef(false);

  // Track user input on OrbitControls so automated camera motions NEVER fight user cursor movement
  useEffect(() => {
    if (!interactive) return;
    const controls = controlsRef.current;
    if (!controls) return;

    const onStart = () => {
      isUserInteracting.current = true;
      cameraPositionGoal.current = null;
      targetLerpGoal.current = null;
      if (useTwinStore.getState().activeCamera !== "custom") {
        setActiveCamera("custom");
      }
    };

    const onEnd = () => {
      isUserInteracting.current = false;
    };

    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);
    return () => {
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
    };
  }, [controlsRef, setActiveCamera, interactive]);

  // One-shot camera preset transitions (ONLY triggers when user clicks a preset)
  const prevCamRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeCamera === prevCamRef.current || activeCamera === "custom") {
      prevCamRef.current = activeCamera;
      return;
    }
    prevCamRef.current = activeCamera;

    const cx = widthM / 2;
    const cz = depthM / 2;

    if (activeCamera === "top") {
      targetLerpGoal.current = new THREE.Vector3(cx, 0.2, cz);
      cameraPositionGoal.current = new THREE.Vector3(cx, 58, cz + 0.001);
    } else if (activeCamera === "iso") {
      targetLerpGoal.current = new THREE.Vector3(cx, 0.2, cz);
      cameraPositionGoal.current = new THREE.Vector3(cx - 28, 32, cz + 32);
    } else if (activeCamera === "pack") {
      const packX = Math.min(widthM - 3.0, widthM * 0.75);
      const packZ = Math.min(depthM - 3.0, depthM * 0.75);
      targetLerpGoal.current = new THREE.Vector3(packX, 0.2, packZ);
      cameraPositionGoal.current = new THREE.Vector3(packX, Math.max(12, depthM * 0.4), packZ + Math.max(10, depthM * 0.35));
    } else if (activeCamera === "full") {
      targetLerpGoal.current = new THREE.Vector3(cx, 0.2, cz);
      cameraPositionGoal.current = new THREE.Vector3(cx - 38, 44, cz + 44);
    } else if (activeCamera === "robot") {
      const bots = useTwinStore.getState().botUnits;
      const bot = (selectedBotId && bots[selectedBotId]) || Object.values(bots).find((b) => b.status === "ACTIVE") || Object.values(bots)[0];
      if (bot) {
        const fwdX = Math.cos(bot.headingRad);
        const fwdZ = Math.sin(bot.headingRad);
        targetLerpGoal.current = new THREE.Vector3(bot.position[0] + fwdX * 2.5, 0.6, bot.position[2] + fwdZ * 2.5);
        cameraPositionGoal.current = new THREE.Vector3(bot.position[0] - fwdX * 4.2, 2.2, bot.position[2] - fwdZ * 4.2);
      }
    }
  }, [activeCamera, widthM, depthM, selectedBotId]);

  // Floor elevation adjustment (one-shot when user clicks G / M1 / L2)
  const prevFloorRef = useRef(activeFloor);
  useEffect(() => {
    if (activeFloor === prevFloorRef.current) return;
    prevFloorRef.current = activeFloor;

    const controls = controlsRef.current;
    if (!controls) return;

    const newTargetY = activeFloor === 2 ? 4.2 : 0.2;
    targetLerpGoal.current = new THREE.Vector3(controls.target.x, newTargetY, controls.target.z);
  }, [activeFloor, controlsRef]);

  // Entity selection focus (one-shot when user clicks a bot or station)
  const prevSelectedBotRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedBotId || selectedBotId === prevSelectedBotRef.current) {
      prevSelectedBotRef.current = selectedBotId;
      return;
    }
    prevSelectedBotRef.current = selectedBotId;
    const bot = useTwinStore.getState().botUnits[selectedBotId];
    if (bot && activeCamera !== "top") {
      targetLerpGoal.current = new THREE.Vector3(bot.position[0], 0.6, bot.position[2]);
    }
  }, [selectedBotId, activeCamera]);

  // Explicit focusTarget change (one-shot when focusTarget is explicitly set)
  const prevFocusTargetRef = useRef<[number, number, number] | null>(null);
  useEffect(() => {
    if (!focusTarget) return;
    if (
      prevFocusTargetRef.current &&
      prevFocusTargetRef.current[0] === focusTarget[0] &&
      prevFocusTargetRef.current[1] === focusTarget[1] &&
      prevFocusTargetRef.current[2] === focusTarget[2]
    ) {
      return;
    }
    prevFocusTargetRef.current = focusTarget;
    targetLerpGoal.current = new THREE.Vector3(focusTarget[0], focusTarget[1], focusTarget[2]);
  }, [focusTarget]);

  // Smooth frame loop
  useFrame(({ camera }, dt) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // In non-interactive mode, hold or smoothly pan to fixed camera position & target
    if (!interactive) {
      const targetVec = fixedCameraTarget
        ? new THREE.Vector3(...fixedCameraTarget)
        : defaultCenter;
      controls.target.lerp(targetVec, Math.min(1.0, dt * 8.0));
      if (fixedCameraPosition) {
        camera.position.lerp(new THREE.Vector3(...fixedCameraPosition), Math.min(1.0, dt * 8.0));
      }
      controls.update();
      return;
    }

    // If the user is actively dragging the mouse or moving controls: do NOT lerp!
    if (isUserInteracting.current) {
      controls.update();
      return;
    }

    const lerpFactor = Math.min(1.0, 1.0 - Math.pow(0.001, dt));

    // Follow moving bot in dedicated "robot" POV mode (if not interacting)
    if (activeCamera === "robot") {
      const bots = useTwinStore.getState().botUnits;
      const bot = (selectedBotId && bots[selectedBotId]) || Object.values(bots).find((b) => b.status === "ACTIVE");
      if (bot) {
        const fwdX = Math.cos(bot.headingRad);
        const fwdZ = Math.sin(bot.headingRad);
        const targetPos = new THREE.Vector3(bot.position[0] + fwdX * 2.5, 0.6, bot.position[2] + fwdZ * 2.5);
        const camPos = new THREE.Vector3(bot.position[0] - fwdX * 4.2, 2.2, bot.position[2] - fwdZ * 4.2);
        controls.target.lerp(targetPos, lerpFactor);
        camera.position.lerp(camPos, lerpFactor);
        controls.update();
        return;
      }
    }

    // Smoothly lerp target towards targetLerpGoal
    if (targetLerpGoal.current) {
      controls.target.lerp(targetLerpGoal.current, lerpFactor);
      if (controls.target.distanceTo(targetLerpGoal.current) < 0.08) {
        targetLerpGoal.current = null; // Reached! Stop lerping so user has 100% free pan control.
      }
    }

    // Smoothly lerp camera position towards cameraPositionGoal
    if (cameraPositionGoal.current) {
      camera.position.lerp(cameraPositionGoal.current, lerpFactor);
      if (camera.position.distanceTo(cameraPositionGoal.current) < 0.15) {
        cameraPositionGoal.current = null; // Reached! Stop lerping so user has 100% free rotation/zoom control.
      }
    }

    controls.update();
  });

  return null;
}

// ─────────────────────────────────────────────────────────────
// 2. Warm Architectural Lighting & Atmosphere
// ─────────────────────────────────────────────────────────────

function ArchitecturalLighting({
  widthM,
  depthM,
  disableShadows = false,
}: {
  widthM: number;
  depthM: number;
  disableShadows?: boolean;
}) {
  const { scene, gl } = useThree();
  const isFestiveSurgeActive = useTwinStore((s) => s.isFestiveSurgeActive);

  useEffect(() => {
    (window as unknown as { __threeRenderer: THREE.WebGLRenderer }).__threeRenderer = gl;
    scene.background = new THREE.Color(isFestiveSurgeActive ? "#0B1528" : COLORS.BACKGROUND);
    scene.fog = new THREE.Fog(isFestiveSurgeActive ? "#0B1528" : COLORS.BACKGROUND, 90, 220);
  }, [scene, gl, isFestiveSurgeActive]);

  return (
    <>
      {/* Soft Daylight Ambient - Shifts to warm golden/amber glow during Festive Surge */}
      <ambientLight
        intensity={isFestiveSurgeActive ? 1.15 : 0.7}
        color={isFestiveSurgeActive ? "#FBBF24" : "#FFFFFF"}
      />

      {/* Sky-to-Ground Hemisphere Light */}
      <hemisphereLight
        args={[
          isFestiveSurgeActive ? "#F59E0B" : "#E0F2FE",
          isFestiveSurgeActive ? "#FEF3C7" : "#F1F5F9",
          isFestiveSurgeActive ? 0.85 : 0.45,
        ]}
      />

      {/* Primary Warm Sun Light (Isometric Cast - 1024x1024 map with -0.0005 bias) */}
      <directionalLight
        position={[widthM * 0.45, 50, depthM * 0.25]}
        intensity={isFestiveSurgeActive ? 1.6 : 1.35}
        color={isFestiveSurgeActive ? "#FFEDD5" : "#FFFBEB"}
        castShadow={!disableShadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
        shadow-camera-left={-widthM * 0.8}
        shadow-camera-right={widthM * 0.8}
        shadow-camera-top={depthM * 0.8}
        shadow-camera-bottom={-depthM * 0.8}
        shadow-camera-near={10}
        shadow-camera-far={140}
      />

      {/* Subtle Cool Fill Light */}
      <directionalLight
        position={[-widthM * 0.3, 30, -depthM * 0.3]}
        intensity={isFestiveSurgeActive ? 0.45 : 0.3}
        color={isFestiveSurgeActive ? "#FCD34D" : "#BAE6FD"}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Concrete Floor Slab & Dashed Blinkit Yellow Transit Lanes
// ─────────────────────────────────────────────────────────────

function FloorAndTransitLanes({ widthM, depthM }: { widthM: number; depthM: number }) {
  const isObstaclePlacementActive = useTwinStore((s) => s.isObstaclePlacementActive);
  const toggleFloorObstacle = useTwinStore((s) => s.toggleFloorObstacle);
  const cellSize = useTwinStore((s) => s.navGrid.cellSize);
  const [hoverTile, setHoverTile] = useState<[number, number] | null>(null);

  // Generate high-resolution procedural light concrete texture with subtle architectural grid
  const floorTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d")!;

    // Concrete base tone
    ctx.fillStyle = COLORS.CONCRETE_FLOOR;
    ctx.fillRect(0, 0, 1024, 1024);

    // Subtle micro-stipple texture
    for (let i = 0; i < 15000; i++) {
      ctx.fillStyle = `rgba(148, 163, 184, ${Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
    }

    // 1m grid subdivisions (mapped to 16 divisions per texture tile)
    ctx.strokeStyle = "rgba(203, 213, 225, 0.55)";
    ctx.lineWidth = 1.0;
    const step = 1024 / 16;
    for (let i = 0; i <= 16; i++) {
      const p = i * step;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, 1024);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(1024, p);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(widthM / 16, depthM / 16);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [widthM, depthM]);

  // Procedural dashed texture for high-visibility transit markings
  const dashedLaneTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext("2d")!;

    ctx.clearRect(0, 0, 128, 32);
    // Yellow stripe (50% solid, 50% gap)
    ctx.fillStyle = COLORS.TRANSIT_LANE;
    ctx.fillRect(0, 4, 64, 24);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // Main transit corridors dynamically scaled to facility footprint
  const transitCorridors = useMemo(() => {
    const marginX = Math.max(1.8, Math.min(4.0, widthM * 0.08));
    const marginZ = Math.max(1.8, Math.min(4.0, depthM * 0.1));
    const minX = marginX;
    const maxX = Math.max(minX + 3.0, widthM - marginX);
    const topZ = marginZ;
    const botZ = Math.max(topZ + 3.0, depthM - marginZ);
    const midX = widthM / 2;
    const feederZ = Math.max(topZ + 2.0, Math.min(botZ - 2.0, depthM * 0.68));

    return [
      // Main central north-south thoroughfare
      { start: [midX, topZ], end: [midX, botZ], width: Math.min(1.2, Math.max(0.6, widthM * 0.04)) },
      // Top cross-dock artery
      { start: [minX, topZ], end: [maxX, topZ], width: Math.min(1.0, Math.max(0.5, depthM * 0.035)) },
      // Packing feeder artery
      { start: [minX, feederZ], end: [maxX, feederZ], width: Math.min(1.0, Math.max(0.5, depthM * 0.035)) },
      // West boundary express lane
      { start: [minX, topZ], end: [minX, botZ], width: Math.min(0.8, Math.max(0.4, widthM * 0.03)) },
      // East boundary dispatch lane
      { start: [maxX, topZ], end: [maxX, botZ], width: Math.min(0.8, Math.max(0.4, widthM * 0.03)) },
    ];
  }, [widthM, depthM]);

  // Memoize transit lane configurations and textures once
  const preparedCorridors = useMemo(() => {
    return transitCorridors.map((lane, idx) => {
      const dx = lane.end[0] - lane.start[0];
      const dz = lane.end[1] - lane.start[1];
      const length = Math.hypot(dx, dz);
      const angle = Math.atan2(dz, dx);
      const midX = (lane.start[0] + lane.end[0]) / 2;
      const midZ = (lane.start[1] + lane.end[1]) / 2;

      const tex = dashedLaneTexture.clone();
      tex.repeat.set(length / 2.0, 1);
      tex.needsUpdate = true;

      return {
        key: idx,
        position: [midX, 0.015, midZ] as [number, number, number],
        rotation: [-Math.PI / 2, 0, -angle] as [number, number, number],
        length,
        width: lane.width,
        texture: tex,
      };
    });
  }, [transitCorridors, dashedLaneTexture]);

  return (
    <group>
      {/* Elevated Foundation Plinth / Perimeter Trim */}
      <mesh position={[widthM / 2, -0.16, depthM / 2]}>
        <boxGeometry args={[widthM + 1.2, 0.3, depthM + 1.2]} />
        <meshStandardMaterial color={COLORS.PLINTH_BORDER} roughness={0.9} />
      </mesh>

      {/* Main Concrete Floor */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[widthM / 2, 0.0, depthM / 2]}
        receiveShadow
        onPointerMove={
          isObstaclePlacementActive
            ? (e) => {
                e.stopPropagation();
                const col = Math.floor(e.point.x / cellSize);
                const row = Math.floor(e.point.z / cellSize);
                if (col >= 0 && col < widthM && row >= 0 && row < depthM) {
                  setHoverTile([col, row]);
                }
              }
            : undefined
        }
        onPointerOut={isObstaclePlacementActive ? () => setHoverTile(null) : undefined}
        onClick={
          isObstaclePlacementActive
            ? (e) => {
                e.stopPropagation();
                const col = Math.floor(e.point.x / cellSize);
                const row = Math.floor(e.point.z / cellSize);
                if (col >= 0 && col < widthM && row >= 0 && row < depthM) {
                  toggleFloorObstacle(col, row);
                }
              }
            : undefined
        }
      >
        <planeGeometry args={[widthM, depthM]} />
        <meshStandardMaterial
          map={floorTexture}
          roughness={0.82}
          metalness={0.08}
        />
      </mesh>

      {/* Hover Tile Placement Indicator (Shows where obstacle drops) */}
      {hoverTile && isObstaclePlacementActive && (
        <mesh
          position={[
            hoverTile[0] * cellSize + cellSize / 2,
            0.035,
            hoverTile[1] * cellSize + cellSize / 2,
          ]}
          rotation-x={-Math.PI / 2}
        >
          <planeGeometry args={[cellSize * 0.95, cellSize * 0.95]} />
          <meshBasicMaterial color="#F59E0B" transparent opacity={0.55} />
        </mesh>
      )}

      {/* Dashed Blinkit Yellow Transit Lanes (Pre-memoized) */}
      {preparedCorridors.map((lane) => (
        <mesh
          key={lane.key}
          position={lane.position}
          rotation={lane.rotation}
        >
          <planeGeometry args={[lane.length, lane.width]} />
          <meshBasicMaterial
            map={lane.texture}
            transparent
            opacity={0.88}
            polygonOffset
            polygonOffsetFactor={-1}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Charging Pads (#0C831F Green) with Dedicated Docks
// ─────────────────────────────────────────────────────────────

const SHARED_CHARGING_GEOMETRIES = {
  pad: new THREE.PlaneGeometry(2.0, 2.0),
  ring: new THREE.RingGeometry(0.9, 0.98, 4),
  base: new THREE.BoxGeometry(0.7, 1.5, 0.4),
  screen: new THREE.BoxGeometry(0.4, 0.25, 0.04),
  chevron: new THREE.PlaneGeometry(0.5, 0.5),
};

const SHARED_CHARGING_MATERIALS = {
  pad: new THREE.MeshStandardMaterial({
    color: COLORS.CHARGING_PAD,
    roughness: 0.4,
    metalness: 0.1,
  }),
  ring: new THREE.MeshBasicMaterial({ color: "#FFFFFF" }),
  base: new THREE.MeshStandardMaterial({
    color: "#0F172A",
    roughness: 0.3,
    metalness: 0.7,
  }),
  screenOccupied: new THREE.MeshBasicMaterial({ color: "#F59E0B" }),
  screenFree: new THREE.MeshBasicMaterial({ color: "#22C55E" }),
  chevron: new THREE.MeshBasicMaterial({ color: "#FACC15" }),
};

function ChargingPadsCollection() {
  const chargingDocks = useTwinStore((s) => s.chargingDocks);

  return (
    <group>
      {Object.values(chargingDocks).map((dock) => (
        <group key={dock.id} position={[dock.coords[0], 0, dock.coords[1]]}>
          {/* Green Charging Pad Mat */}
          <mesh
            rotation-x={-Math.PI / 2}
            position={[0, 0.018, 0]}
            geometry={SHARED_CHARGING_GEOMETRIES.pad}
            material={SHARED_CHARGING_MATERIALS.pad}
          />

          {/* High-visibility white parking border line */}
          <mesh
            rotation-x={-Math.PI / 2}
            position={[0, 0.02, 0]}
            geometry={SHARED_CHARGING_GEOMETRIES.ring}
            material={SHARED_CHARGING_MATERIALS.ring}
          />

          {/* Charger Base Hardware Unit */}
          <mesh
            position={[0, 0.75, 0.7]}
            geometry={SHARED_CHARGING_GEOMETRIES.base}
            material={SHARED_CHARGING_MATERIALS.base}
            castShadow
          />

          {/* Charger Status Screen / LED Beacon */}
          <mesh
            position={[0, 1.1, 0.49]}
            geometry={SHARED_CHARGING_GEOMETRIES.screen}
            material={dock.isOccupied ? SHARED_CHARGING_MATERIALS.screenOccupied : SHARED_CHARGING_MATERIALS.screenFree}
          />

          {/* Floor Fast-Charging Symbol / Chevron */}
          <mesh
            rotation-x={-Math.PI / 2}
            position={[0, 0.022, -0.1]}
            geometry={SHARED_CHARGING_GEOMETRIES.chevron}
            material={SHARED_CHARGING_MATERIALS.chevron}
          />
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. 3D Floor Obstacles & Aisle Barricades Collection
// ─────────────────────────────────────────────────────────────

function FlashingAmberBeacon() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    // 4Hz flashing amber industrial strobe
    const strobe = (Math.sin(clock.elapsedTime * 12) + 1) * 0.5;
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      if (mat) mat.emissiveIntensity = 0.8 + strobe * 2.8;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0.5, 0]}>
      <sphereGeometry args={[0.07, 16, 16]} />
      <meshStandardMaterial
        color="#F59E0B"
        emissive="#F59E0B"
        emissiveIntensity={2.5}
        roughness={0.1}
      />
    </mesh>
  );
}

function FloorObstaclesCollection() {
  const customObstacles = useTwinStore((s) => s.customObstacles);
  const toggleFloorObstacle = useTwinStore((s) => s.toggleFloorObstacle);
  const cellSize = useTwinStore((s) => s.navGrid.cellSize);
  const showLabels = useTwinStore((s) => s.showLabels);
  const isAnyModalOpen = useTwinStore((s) => s.isSandboxModalOpen || s.isBuilderModalOpen || s.modal !== null);

  // Procedural OSHA Yellow & Black Diagonal Striped Hazard Decal
  const hazardTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#FACC15"; // Industrial Safety Yellow
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#0F172A"; // Contrasting Slate Dark
    for (let i = -128; i < 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 16, 0);
      ctx.lineTo(i + 16 + 128, 128);
      ctx.lineTo(i + 128, 128);
      ctx.closePath();
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
  }, []);

  return (
    <group>
      {customObstacles.map((obs) => {
        const x = obs.col * cellSize + cellSize / 2;
        const z = obs.row * cellSize + cellSize / 2;

        return (
          <group
            key={obs.id || `obs-${obs.col}-${obs.row}`}
            position={[x, 0, z]}
            onClick={(e) => {
              e.stopPropagation();
              toggleFloorObstacle(obs.col, obs.row);
            }}
          >
            {obs.label === "Wall Pillar" ? (
              <group>
                {/* Structural Square Concrete/Steel Warehouse Column */}
                <mesh position={[0, 2.0, 0]}>
                  <boxGeometry args={[0.7, 4.0, 0.7]} />
                  <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.2} />
                </mesh>
                {/* High-visibility yellow safety foot base */}
                <mesh position={[0, 0.25, 0]}>
                  <boxGeometry args={[0.78, 0.5, 0.78]} />
                  <meshStandardMaterial color="#F59E0B" roughness={0.4} metalness={0.1} />
                </mesh>
                {/* Floor hazard ring */}
                <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
                  <ringGeometry args={[0.42, 0.55, 16]} />
                  <meshBasicMaterial color="#334155" transparent opacity={0.6} />
                </mesh>
              </group>
            ) : (
              <>
                {/* Bold Striped Hazard Floor Decal (OSHA Diagonal Stripes) */}
                {hazardTexture && (
                  <mesh rotation-x={-Math.PI / 2} position={[0, 0.022, 0]}>
                    <planeGeometry args={[1.35, 1.35]} />
                    <meshBasicMaterial map={hazardTexture} transparent opacity={0.92} />
                  </mesh>
                )}

                {/* Pulsing Outer Hazard Border Ribbon */}
                <mesh rotation-x={-Math.PI / 2} position={[0, 0.025, 0]}>
                  <ringGeometry args={[0.68, 0.74, 32]} />
                  <meshBasicMaterial color="#DC2626" transparent opacity={0.9} />
                </mesh>

                {/* Base warning mat */}
                <mesh rotation-x={-Math.PI / 2} position={[0, 0.026, 0]}>
                  <planeGeometry args={[0.95, 0.95]} />
                  <meshBasicMaterial color="#DC2626" transparent opacity={0.35} />
                </mesh>

                {/* Heavy Barricade Stand / Legs */}
                <mesh position={[-0.32, 0.25, 0]}>
                  <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
                  <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
                </mesh>
                <mesh position={[0.32, 0.25, 0]}>
                  <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
                  <meshStandardMaterial color="#1E293B" metalness={0.8} roughness={0.3} />
                </mesh>

                {/* Yellow-Black Warning Board */}
                <RoundedBox args={[0.75, 0.24, 0.06]} radius={0.02} smoothness={4} position={[0, 0.32, 0]}>
                  <meshStandardMaterial
                    color="#F59E0B"
                    roughness={0.4}
                    metalness={0.2}
                    emissive="#F59E0B"
                    emissiveIntensity={0.25}
                  />
                </RoundedBox>

                {/* Flashing Amber Warning Beacon */}
                <FlashingAmberBeacon />
              </>
            )}

            {/* Click to remove Pill */}
            {showLabels && !isAnyModalOpen && (
              <Html position={[0, 0.75, 0]} center distanceFactor={35} zIndexRange={[15, 0]}>
                <div
                  style={{
                    background: "rgba(15, 23, 42, 0.92)",
                    color: "#F8CB46",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    fontSize: "10px",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    border: "1px solid rgba(248, 203, 70, 0.4)",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  <span>🚧 Blocked</span>
                  <span style={{ color: "#EF4444", marginLeft: "2px" }}>✕</span>
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// 5.5 Blueprint Ground Underlay (Rendered when custom CAD blueprint is active)
// ─────────────────────────────────────────────────────────────

function BlueprintGroundUnderlay({ widthM, depthM }: { widthM: number; depthM: number }) {
  const customBlueprintUrl = useTwinStore((s) => s.customBlueprintUrl);
  const texture = useMemo(() => {
    if (!customBlueprintUrl) return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load(customBlueprintUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [customBlueprintUrl]);

  if (!texture) return null;

  return (
    <mesh position={[widthM / 2, 0.006, depthM / 2]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[widthM, depthM]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.38}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────
// 6. Main Scene Composite
// ─────────────────────────────────────────────────────────────

function FacilityScene({
  controlsRef,
  interactive = true,
  fixedCameraPosition,
  fixedCameraTarget,
  fleetCountOverride,
  disableShadows = false,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl>;
  interactive?: boolean;
  fixedCameraPosition?: [number, number, number];
  fixedCameraTarget?: [number, number, number];
  fleetCountOverride?: number;
  disableShadows?: boolean;
}) {
  const gridDimensions = useTwinStore((s) => s.gridDimensions);
  const selectBot = useTwinStore((s) => s.selectBot);

  const { widthM, depthM } = gridDimensions;

  return (
    <>
      <CameraRig
        controlsRef={controlsRef}
        widthM={widthM}
        depthM={depthM}
        interactive={interactive}
        fixedCameraPosition={fixedCameraPosition}
        fixedCameraTarget={fixedCameraTarget}
      />
      <ArchitecturalLighting widthM={widthM} depthM={depthM} disableShadows={disableShadows} />

      {/* Ground Click Deselects Active Bot */}
      <group
        onPointerMissed={() => {
          if (interactive) selectBot(null);
        }}
      >
        <FloorAndTransitLanes widthM={widthM} depthM={depthM} />
        <BlueprintGroundUnderlay widthM={widthM} depthM={depthM} />
        <ZoneSections />
        <ConveyorSystem />
        <ChargingPadsCollection />
        <FloorObstaclesCollection />
        <StationNodes />
        <RackSystem />
        <HumanWorkers />
        <BotFleet fleetCountOverride={fleetCountOverride} />

        {/* Soft Grounding Contact Shadows (Calculated once for 60 FPS performance) */}
        <ContactShadows
          position={[widthM / 2, 0.005, depthM / 2]}
          opacity={0.45}
          scale={Math.max(widthM, depthM) * 1.15}
          blur={2.2}
          far={10}
          color="#334155"
          frames={1}
        />
      </group>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 10. Public FacilityCanvas Component
// ─────────────────────────────────────────────────────────────

export interface FacilityCanvasProps {
  className?: string;
  style?: React.CSSProperties;
  interactive?: boolean;
  cameraPosition?: [number, number, number];
  cameraTarget?: [number, number, number];
  fleetCountOverride?: number;
  disableShadows?: boolean;
}

export function FacilityCanvas({
  className,
  style,
  interactive = true,
  cameraPosition: customCameraPosition,
  cameraTarget,
  fleetCountOverride,
  disableShadows = false,
}: FacilityCanvasProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null!);
  const gridDimensions = useTwinStore((s) => s.gridDimensions);
  const activeTool = useTwinStore((s) => s.activeTool);

  const cx = gridDimensions.widthM / 2;
  const cz = gridDimensions.depthM / 2;

  // Axis of rotation: Centered in the middle of the warehouse floor from the start
  const defaultTarget: [number, number, number] = useMemo(
    () => cameraTarget || [cx, 0.2, cz],
    [cameraTarget, cx, cz]
  );

  // Initial Isometric Camera Position looking directly at the facility center
  const cameraPosition: [number, number, number] = useMemo(
    () => customCameraPosition || [cx - 28, 32, cz + 32],
    [customCameraPosition, cx, cz]
  );

  return (
    <div
      className={className}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: COLORS.BACKGROUND,
        overflow: "hidden",
        cursor: interactive ? (activeTool === "pan" ? "grab" : "default") : "default",
        pointerEvents: interactive ? "auto" : "none",
        ...style,
      }}
    >
      <Canvas
        shadows={!disableShadows}
        dpr={[1, 1.5]}
        camera={{
          position: cameraPosition,
          fov: 38,
          near: 0.5,
          far: 300,
        }}
        gl={{
          powerPreference: "high-performance",
          antialias: true,
          stencil: false,
          depth: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
      >
        <AdaptiveDpr pixelated={false} />
        <AdaptiveEvents />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={defaultTarget}
          enabled={interactive}
          enableRotate={interactive}
          enablePan={interactive}
          enableZoom={interactive}
          enableDamping={interactive}
          dampingFactor={0.08}
          mouseButtons={{
            LEFT: activeTool === "pan" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
          maxPolarAngle={Math.PI / 2.05} // Prevent camera going below floor
          minDistance={6}
          maxDistance={140}
        />
        <FacilityScene
          controlsRef={controlsRef}
          interactive={interactive}
          fixedCameraPosition={customCameraPosition}
          fixedCameraTarget={cameraTarget}
          fleetCountOverride={fleetCountOverride}
          disableShadows={disableShadows}
        />
      </Canvas>
    </div>
  );
}

export default FacilityCanvas;
