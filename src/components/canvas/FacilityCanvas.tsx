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
import { OrbitControls, ContactShadows, RoundedBox, Html } from "@react-three/drei";
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
}

function CameraRig({ controlsRef, widthM, depthM }: CameraRigProps) {
  const selectedBotId = useTwinStore((s) => s.selectedBotId);
  const botUnits = useTwinStore((s) => s.botUnits);
  const focusTarget = useTwinStore((s) => s.focusTarget);
  const activeCamera = useTwinStore((s) => s.activeCamera);
  const activeFloor = useTwinStore((s) => s.activeFloor);

  const defaultCenter = useMemo(
    () => new THREE.Vector3(widthM / 2, 0.5, depthM / 2),
    [widthM, depthM]
  );

  const targetLerpGoal = useRef<THREE.Vector3>(defaultCenter.clone());
  const cameraPositionGoal = useRef<THREE.Vector3 | null>(null);

  // Update target when camera mode, floor level, or selection changes
  useEffect(() => {
    const cx = widthM / 2;
    const cz = depthM / 2;

    if (activeCamera === "top") {
      targetLerpGoal.current.set(cx, 0.2, cz);
      cameraPositionGoal.current = new THREE.Vector3(cx, 58, cz + 0.001);
    } else if (activeCamera === "iso") {
      targetLerpGoal.current.set(cx, 0.2, cz);
      cameraPositionGoal.current = new THREE.Vector3(cx - 28, 32, cz + 32);
    } else if (activeCamera === "pack") {
      targetLerpGoal.current.set(44, 0.2, 31);
      cameraPositionGoal.current = new THREE.Vector3(44, 15, 45);
    } else if (activeCamera === "robot") {
      const bot = (selectedBotId && botUnits[selectedBotId]) || Object.values(botUnits).find((b) => b.status === "ACTIVE") || Object.values(botUnits)[0];
      if (bot) {
        const fwdX = Math.cos(bot.headingRad);
        const fwdZ = Math.sin(bot.headingRad);
        targetLerpGoal.current.set(bot.position[0] + fwdX * 2.5, 0.6, bot.position[2] + fwdZ * 2.5);
        cameraPositionGoal.current = new THREE.Vector3(
          bot.position[0] - fwdX * 4.2,
          2.2,
          bot.position[2] - fwdZ * 4.2
        );
      }
    } else if (activeCamera === "full") {
      targetLerpGoal.current.set(cx, 0.2, cz);
      cameraPositionGoal.current = new THREE.Vector3(cx - 38, 44, cz + 44);
    } else if (selectedBotId && botUnits[selectedBotId]) {
      const bot = botUnits[selectedBotId];
      targetLerpGoal.current.set(bot.position[0], 0.6, bot.position[2]);
    } else if (focusTarget) {
      targetLerpGoal.current.set(focusTarget[0], focusTarget[1], focusTarget[2]);
    } else {
      targetLerpGoal.current.copy(defaultCenter);
    }

    // Floor elevation adjustment
    if (activeFloor === 1) {
      targetLerpGoal.current.y = 0.2;
    } else if (activeFloor === 2) {
      targetLerpGoal.current.y = 4.2;
      if (cameraPositionGoal.current && cameraPositionGoal.current.y < 20) {
        cameraPositionGoal.current.y = 20;
      }
    } else if (activeFloor === "all") {
      targetLerpGoal.current.y = 0.5;
    }
  }, [activeCamera, activeFloor, selectedBotId, botUnits, focusTarget, defaultCenter, widthM, depthM]);

  useFrame(({ camera }, dt) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // Follow moving bot in "robot" POV mode
    if (activeCamera === "robot") {
      const bot = (selectedBotId && botUnits[selectedBotId]) || Object.values(botUnits).find((b) => b.status === "ACTIVE");
      if (bot) {
        const fwdX = Math.cos(bot.headingRad);
        const fwdZ = Math.sin(bot.headingRad);
        targetLerpGoal.current.set(
          bot.position[0] + fwdX * 2.5,
          0.6,
          bot.position[2] + fwdZ * 2.5
        );
        cameraPositionGoal.current = new THREE.Vector3(
          bot.position[0] - fwdX * 4.2,
          2.2,
          bot.position[2] - fwdZ * 4.2
        );
      }
    } else if (selectedBotId && botUnits[selectedBotId] && activeCamera !== "top") {
      const bot = botUnits[selectedBotId];
      targetLerpGoal.current.set(bot.position[0], 0.6, bot.position[2]);
    }

    // Exponential smoothing for fluid 60fps tracking
    const lerpFactor = 1.0 - Math.pow(0.002, dt);
    controls.target.lerp(targetLerpGoal.current, lerpFactor);

    if (cameraPositionGoal.current) {
      camera.position.lerp(cameraPositionGoal.current, lerpFactor);
      if (camera.position.distanceTo(cameraPositionGoal.current) < 0.15 && activeCamera !== "robot") {
        cameraPositionGoal.current = null;
      }
    }

    controls.update();
  });

  return null;
}

// ─────────────────────────────────────────────────────────────
// 2. Warm Architectural Lighting & Atmosphere
// ─────────────────────────────────────────────────────────────

function ArchitecturalLighting({ widthM, depthM }: { widthM: number; depthM: number }) {
  const { scene } = useThree();

  useEffect(() => {
    scene.background = new THREE.Color(COLORS.BACKGROUND);
    scene.fog = new THREE.Fog(COLORS.BACKGROUND, 90, 220);
  }, [scene]);

  return (
    <>
      {/* Soft Daylight Ambient */}
      <ambientLight intensity={0.7} color="#FFFFFF" />

      {/* Sky-to-Ground Hemisphere Light */}
      <hemisphereLight args={["#E0F2FE", "#F1F5F9", 0.45]} />

      {/* Primary Warm Sun Light (Isometric Cast) */}
      <directionalLight
        position={[widthM * 0.45, 50, depthM * 0.25]}
        intensity={1.35}
        color="#FFFBEB"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
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
        intensity={0.3}
        color="#BAE6FD"
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

  // Main transit corridors across picking aisles and packing arteries
  const transitCorridors = useMemo(() => {
    return [
      // Main central north-south thoroughfare
      { start: [30.0, 6.0], end: [30.0, 36.0], width: 1.2 },
      // Top cross-dock artery
      { start: [4.0, 6.5], end: [56.0, 6.5], width: 1.0 },
      // Packing feeder artery
      { start: [4.0, 26.5], end: [56.0, 26.5], width: 1.0 },
      // West boundary express lane
      { start: [4.0, 6.5], end: [4.0, 36.0], width: 0.8 },
      // East boundary dispatch lane
      { start: [56.0, 6.5], end: [56.0, 36.0], width: 0.8 },
    ];
  }, []);

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
        onPointerMove={(e) => {
          if (!isObstaclePlacementActive) return;
          e.stopPropagation();
          const col = Math.floor(e.point.x / cellSize);
          const row = Math.floor(e.point.z / cellSize);
          if (col >= 0 && col < widthM && row >= 0 && row < depthM) {
            setHoverTile([col, row]);
          }
        }}
        onPointerOut={() => setHoverTile(null)}
        onClick={(e) => {
          if (!isObstaclePlacementActive) return;
          e.stopPropagation();
          const col = Math.floor(e.point.x / cellSize);
          const row = Math.floor(e.point.z / cellSize);
          if (col >= 0 && col < widthM && row >= 0 && row < depthM) {
            toggleFloorObstacle(col, row);
          }
        }}
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

      {/* Dashed Blinkit Yellow Transit Lanes */}
      {transitCorridors.map((lane, idx) => {
        const dx = lane.end[0] - lane.start[0];
        const dz = lane.end[1] - lane.start[1];
        const length = Math.hypot(dx, dz);
        const angle = Math.atan2(dz, dx);
        const midX = (lane.start[0] + lane.end[0]) / 2;
        const midZ = (lane.start[1] + lane.end[1]) / 2;

        const clonedTex = dashedLaneTexture.clone();
        clonedTex.repeat.set(length / 2.0, 1);
        clonedTex.needsUpdate = true;

        return (
          <mesh
            key={idx}
            position={[midX, 0.015, midZ]}
            rotation={[-Math.PI / 2, 0, -angle]}
          >
            <planeGeometry args={[length, lane.width]} />
            <meshBasicMaterial
              map={clonedTex}
              transparent
              opacity={0.88}
              polygonOffset
              polygonOffsetFactor={-1}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// 4. Charging Pads (#0C831F Green) with Dedicated Docks
// ─────────────────────────────────────────────────────────────

function ChargingPadsCollection() {
  const chargingDocks = useTwinStore((s) => s.chargingDocks);

  return (
    <group>
      {Object.values(chargingDocks).map((dock) => (
        <group key={dock.id} position={[dock.coords[0], 0, dock.coords[1]]}>
          {/* Green Charging Pad Mat */}
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.018, 0]}>
            <planeGeometry args={[2.0, 2.0]} />
            <meshStandardMaterial
              color={COLORS.CHARGING_PAD}
              roughness={0.4}
              metalness={0.1}
            />
          </mesh>

          {/* High-visibility white parking border line */}
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
            <ringGeometry args={[0.9, 0.98, 4]} />
            <meshBasicMaterial color="#FFFFFF" />
          </mesh>

          {/* Charger Base Hardware Unit */}
          <mesh position={[0, 0.75, 0.7]} castShadow>
            <boxGeometry args={[0.7, 1.5, 0.4]} />
            <meshStandardMaterial
              color="#0F172A"
              roughness={0.3}
              metalness={0.7}
            />
          </mesh>

          {/* Charger Status Screen / LED Beacon */}
          <mesh position={[0, 1.1, 0.49]}>
            <boxGeometry args={[0.4, 0.25, 0.04]} />
            <meshBasicMaterial
              color={dock.isOccupied ? "#F59E0B" : "#22C55E"}
            />
          </mesh>

          {/* Floor Fast-Charging Symbol / Chevron */}
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.022, -0.1]}>
            <planeGeometry args={[0.5, 0.5]} />
            <meshBasicMaterial color="#FACC15" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// 5. 3D Floor Obstacles & Aisle Barricades Collection
// ─────────────────────────────────────────────────────────────

function FloorObstaclesCollection() {
  const customObstacles = useTwinStore((s) => s.customObstacles);
  const toggleFloorObstacle = useTwinStore((s) => s.toggleFloorObstacle);
  const cellSize = useTwinStore((s) => s.navGrid.cellSize);
  const showLabels = useTwinStore((s) => s.showLabels);

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
            {/* Base warning mat */}
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
              <planeGeometry args={[0.9, 0.9]} />
              <meshBasicMaterial color="#DC2626" transparent opacity={0.4} />
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
            <mesh position={[0, 0.5, 0]}>
              <sphereGeometry args={[0.06, 12, 12]} />
              <meshStandardMaterial
                color="#EF4444"
                emissive="#EF4444"
                emissiveIntensity={1.8}
                roughness={0.1}
              />
            </mesh>
            <pointLight position={[0, 0.6, 0]} color="#F59E0B" intensity={1.5} distance={3.5} />

            {/* Click to remove Pill */}
            {showLabels && (
              <Html position={[0, 0.75, 0]} center distanceFactor={35}>
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

function FacilityScene({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl> }) {
  const gridDimensions = useTwinStore((s) => s.gridDimensions);
  const selectBot = useTwinStore((s) => s.selectBot);

  const { widthM, depthM } = gridDimensions;

  return (
    <>
      <CameraRig controlsRef={controlsRef} widthM={widthM} depthM={depthM} />
      <ArchitecturalLighting widthM={widthM} depthM={depthM} />

      {/* Ground Click Deselects Active Bot */}
      <group onPointerMissed={() => selectBot(null)}>
        <FloorAndTransitLanes widthM={widthM} depthM={depthM} />
        <BlueprintGroundUnderlay widthM={widthM} depthM={depthM} />
        <ZoneSections />
        <ConveyorSystem />
        <ChargingPadsCollection />
        <FloorObstaclesCollection />
        <StationNodes />
        <RackSystem />
        <HumanWorkers />
        <BotFleet />

        {/* Soft Grounding Contact Shadows */}
        <ContactShadows
          position={[widthM / 2, 0.005, depthM / 2]}
          opacity={0.45}
          scale={Math.max(widthM, depthM) * 1.15}
          blur={2.2}
          far={10}
          color="#334155"
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
}

export function FacilityCanvas({ className, style }: FacilityCanvasProps) {
  const controlsRef = useRef<OrbitControlsImpl>(null!);
  const gridDimensions = useTwinStore((s) => s.gridDimensions);
  const activeTool = useTwinStore((s) => s.activeTool);

  // Initial Isometric Camera Position
  const cameraPosition: [number, number, number] = useMemo(
    () => [gridDimensions.widthM * 0.95, 38, gridDimensions.depthM * 1.3],
    [gridDimensions]
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
        cursor: activeTool === "pan" ? "grab" : "default",
        ...style,
      }}
    >
      <Canvas
        shadows
        camera={{
          position: cameraPosition,
          fov: 38,
          near: 0.5,
          far: 300,
        }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
      >
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
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
        <FacilityScene controlsRef={controlsRef} />
      </Canvas>
    </div>
  );
}

export default FacilityCanvas;
