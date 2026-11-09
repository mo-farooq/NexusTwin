/**
 * NexusTwin BotFleet Component
 *
 * Real-time 3D autonomous BotUnit fleet renderer featuring:
 * - Crisp white chassis with signature #F8CB46 yellow bumper accents
 * - Rotating charcoal (#1C1C1C) wheels driven by travel velocity
 * - Breathing green/amber/red status LED ring on the ground
 * - Toggleable corrugated delivery package box when carrying cargo
 * - Dashed #F8CB46 floor line visualizing the active A* navigation route
 * - Clickable hovering <Html> badge displaying "BOT-ID | Status | Battery %"
 * - High-precision 60fps exponential interpolation loop
 */

import React, { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { useTwinStore, type BotUnit } from "../../store/useTwinStore";
import { cellToWorld, findPathAStar } from "../../engine/pathfinder";

// ─────────────────────────────────────────────────────────────
// Design System & Palette
// ─────────────────────────────────────────────────────────────

const BOT_THEME = {
  CHASSIS_WHITE: "#FFFFFF",
  ACCENT_YELLOW: "#F8CB46",   // Blinkit Yellow bumper & trim
  DECK_CHARCOAL: "#1E293B",   // Contrast top lid
  WHEEL_CHARCOAL: "#1C1C1C",  // Charcoal matte wheels
  FRONT_LIGHT: "#38BDF8",     // Cyan headlight bar
  PACKAGE_KRAFT: "#D97706",   // Corrugated kraft box
  PACKAGE_TAPE: "#FEF08A",    // Packing tape accent
  LED_GREEN: "#10B981",       // Active status
  LED_AMBER: "#F59E0B",       // Idle / Warning status
  LED_BLUE: "#3B82F6",        // Charging status
  LED_RED: "#EF4444",         // Error status
  BADGE_BG: "#1C1C1C",
  BADGE_TEXT: "#F8CB46",
  BADGE_BORDER: "rgba(248, 203, 70, 0.45)",
};

// ─────────────────────────────────────────────────────────────
// Shared Singleton Geometries (Institutional Memory & Draw Call Optimization)
// ─────────────────────────────────────────────────────────────

const SHARED_GEOMETRIES = {
  // Chassis: 0.96, 0.18, 0.62, radius: 0.03, smoothness: 4
  chassis: new RoundedBoxGeometry(0.96, 0.18, 0.62, 4, 0.03),
  // Front / Rear Bumpers: 0.04, 0.12, 0.60, radius: 0.015, smoothness: 4
  bumper: new RoundedBoxGeometry(0.04, 0.12, 0.60, 4, 0.015),
  // Contrast Top Deck Plate: 0.82, 0.02, 0.56, radius: 0.01, smoothness: 4
  deckPlate: new RoundedBoxGeometry(0.82, 0.02, 0.56, 4, 0.01),
  // Front Cyan Navigational Light Strip: 0.02, 0.04, 0.44, radius: 0.01, smoothness: 4
  frontLight: new RoundedBoxGeometry(0.02, 0.04, 0.44, 4, 0.01),
  // Wheel Rubber Tires: cylinder 0.08, 0.08, 0.052, 16
  wheelTire: new THREE.CylinderGeometry(0.08, 0.08, 0.052, 16),
  // Wheel Hub Caps: cylinder 0.032, 0.032, 0.058, 12
  wheelHub: new THREE.CylinderGeometry(0.032, 0.032, 0.058, 12),
  // Wheel Spoke Cross H: box 0.12, 0.022, 0.004
  spokeH: new THREE.BoxGeometry(0.12, 0.022, 0.004),
  // Wheel Spoke Cross V: box 0.022, 0.12, 0.004
  spokeV: new THREE.BoxGeometry(0.022, 0.12, 0.004),
  // Corrugated Cargo Box: 0.64, 0.36, 0.48, radius: 0.02, smoothness: 4
  packageBox: new RoundedBoxGeometry(0.64, 0.36, 0.48, 4, 0.02),
  // Cargo Sealing Tape Strip: 0.73, 0.015, 0.1, radius: 0.005, smoothness: 4
  packageTape: new RoundedBoxGeometry(0.73, 0.015, 0.1, 4, 0.005),
  // Cargo Shipping Label: 0.18, 0.12, 0.01, radius: 0.005, smoothness: 4
  packageLabel: new RoundedBoxGeometry(0.18, 0.12, 0.01, 4, 0.005),
  // Ground Breathing LED Ring: ring 0.56, 0.72, 36
  ledRing: new THREE.RingGeometry(0.56, 0.72, 36),
  // Destination Target Ring: ring 0.35, 0.52, 24
  destRing: new THREE.RingGeometry(0.35, 0.52, 24),
};

// ─────────────────────────────────────────────────────────────
// 1. Clickable Status Badge (HTML Pill)
// ─────────────────────────────────────────────────────────────

interface BotStatusBadgeProps {
  botId: string;
  status: string;
  batteryPct: number;
  isSelected: boolean;
  statusColor: string;
  fsmState?: string;
  perceptionState?: string;
  warningProximity?: boolean;
  isBackingOff?: boolean;
  isReversing?: boolean;
  targetTier?: number;
  pickDwellTicksRemaining?: number;
  pickDwellTotalTicks?: number;
  onClick: () => void;
}

function BotStatusBadge({
  botId,
  status,
  batteryPct,
  isSelected,
  statusColor,
  fsmState,
  perceptionState,
  warningProximity,
  isBackingOff,
  isReversing,
  targetTier,
  pickDwellTicksRemaining,
  pickDwellTotalTicks,
  onClick,
}: BotStatusBadgeProps) {
  const [hovered, setHovered] = useState(false);

  const acBadge = useMemo(() => {
    if (fsmState === "PICKING") {
      const tier = targetTier ?? 1;
      const total = pickDwellTotalTicks || (tier === 4 ? 110 : tier === 3 ? 75 : tier === 2 ? 45 : 20);
      const rem = pickDwellTicksRemaining ?? total;
      const frac = Math.max(0, Math.min(1, (total - rem) / total));
      const filled = Math.min(6, Math.max(0, Math.round(frac * 6)));
      const bar = "█".repeat(filled) + "░".repeat(6 - filled);
      const sec = (rem / 10).toFixed(1);
      return {
        label: `Lifting Tier ${tier} [${bar}] ${sec}s`,
        color: "#60A5FA",
        bg: "rgba(59, 130, 246, 0.28)",
      };
    }
    if (isReversing) {
      return { label: "⏪ REVERSING", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.24)" };
    }
    if (isBackingOff || perceptionState === "BACKING_OFF") {
      return { label: "🛡️ SIDESTEP", color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.18)" };
    }
    if (perceptionState === "YIELDING") {
      return { label: "🛡️ YIELDING (EMPTY ➔ LOADED)", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.25)" };
    }
    if (perceptionState === "HOLDING") {
      return { label: "🛑 LiDAR HOLD", color: "#EF4444", bg: "rgba(239, 68, 68, 0.25)" };
    }
    if (perceptionState === "SLOWING") {
      return { label: "⚠️ DECEL", color: "#FBBF24", bg: "rgba(251, 191, 36, 0.15)" };
    }
    return null;
  }, [fsmState, perceptionState, isBackingOff, isReversing]);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered || isSelected ? "#27272A" : BOT_THEME.BADGE_BG,
        color: BOT_THEME.BADGE_TEXT,
        border: isSelected
          ? `1.5px solid ${BOT_THEME.ACCENT_YELLOW}`
          : warningProximity
          ? "1.5px solid #F59E0B"
          : `1px solid ${BOT_THEME.BADGE_BORDER}`,
        padding: "4px 10px",
        borderRadius: "9999px",
        fontSize: "11px",
        fontWeight: 700,
        fontFamily: "'Inter', -apple-system, sans-serif",
        letterSpacing: "0.02em",
        boxShadow: isSelected
          ? "0 0 14px rgba(248, 203, 70, 0.5)"
          : warningProximity
          ? "0 0 12px rgba(245, 158, 11, 0.45)"
          : "0 4px 12px rgba(0, 0, 0, 0.35)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        userSelect: "none",
        whiteSpace: "nowrap",
        transition: "all 0.16s ease-in-out",
        transform: hovered ? "scale(1.08)" : "scale(1)",
      }}
    >
      <span
        style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          backgroundColor: statusColor,
          display: "inline-block",
          boxShadow: `0 0 6px ${statusColor}`,
        }}
      />
      <span>{botId}</span>
      <span style={{ color: "#94A3B8", fontWeight: 400 }}>|</span>
      <span style={{ color: "#E2E8F0", fontWeight: 600 }}>{status}</span>
      <span style={{ color: "#94A3B8", fontWeight: 400 }}>|</span>
      <span style={{ color: BOT_THEME.ACCENT_YELLOW }}>{Math.round(batteryPct)}%</span>
      {acBadge && (
        <>
          <span style={{ color: "#94A3B8", fontWeight: 400 }}>|</span>
          <span
            style={{
              color: acBadge.color,
              background: acBadge.bg,
              padding: "1px 6px",
              borderRadius: "4px",
              fontSize: "10px",
              fontWeight: 800,
            }}
          >
            {acBadge.label}
          </span>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// 1.5 Selected Robot Perception Gizmo (270° Virtual LiDAR Arc)
// ─────────────────────────────────────────────────────────────

function PerceptionGizmo({ bot }: { bot: BotUnit }) {
  const pState = bot.perception?.state || "CLEAR";
  const color =
    pState === "HOLDING" || pState === "YIELDING"
      ? "#EF4444"
      : pState === "SLOWING"
      ? "#F59E0B"
      : "#38BDF8";
  const range = 3.6;

  return (
    <group position={[0, -0.17, 0]}>
      {/* 270° LiDAR Ground Scanning Arc */}
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.65, range, 48, 1, -Math.PI * 0.75, Math.PI * 1.5]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={pState === "HOLDING" ? 0.22 : 0.12}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Outer Border Rim */}
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[range - 0.05, range, 48, 1, -Math.PI * 0.75, Math.PI * 1.5]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.65}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Forward Heading Clearance Ray */}
      <Line
        points={[
          [0, 0.05, 0],
          [range, 0.05, 0],
        ]}
        color={color}
        lineWidth={2.2}
        transparent
        opacity={0.85}
      />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Individual BotUnit Mesh & Frame Interpolation Loop
// ─────────────────────────────────────────────────────────────

interface SingleBotProps {
  bot: BotUnit;
  isSelected: boolean;
  onSelect: () => void;
  showLabels: boolean;
  showPaths: boolean;
  simulationSpeed: number;
  isTopPickingBot?: boolean;
}

function SingleBot({ bot, isSelected, onSelect, showLabels, showPaths, simulationSpeed, isTopPickingBot = false }: SingleBotProps) {
  const activeCamera = useTwinStore((s) => s.activeCamera);
  const isFestiveSurgeActive = useTwinStore((s) => s.isFestiveSurgeActive);
  const customObstacles = useTwinStore((s) => s.customObstacles);
  const hasObstacles = customObstacles.length > 0;
  const currentTask = useTwinStore((s) => bot.currentTaskId ? s.tasks[bot.currentTaskId] : null);
  const targetTier = currentTask?.targetTier ?? 1;
  const isPicking = bot.fsmState === "PICKING";
  const totalTicks = bot.pickDwellTotalTicks || (targetTier === 4 ? 110 : targetTier === 3 ? 75 : targetTier === 2 ? 45 : 20);
  const remainingTicks = bot.pickDwellTicksRemaining !== undefined ? bot.pickDwellTicksRemaining : Math.max(0, totalTicks - (bot.waitTicks || 0));
  const progressFraction = Math.max(0, Math.min(1, (totalTicks - remainingTicks) / totalTicks));
  const remainingSec = (remainingTicks / 10).toFixed(1);
  const filledBlocks = Math.min(6, Math.max(0, Math.round(progressFraction * 6)));
  const asciiBar = "█".repeat(filledBlocks) + "░".repeat(6 - filledBlocks);

  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null!);
  const wheelRefs = useRef<Array<THREE.Group | null>>([]);
  const leftWheelAngleRef = useRef(0);
  const rightWheelAngleRef = useRef(0);
  const ledRingRef = useRef<THREE.Mesh>(null!);

  // Initial mount coordinate references to prevent frame flickers
  const initRef = useRef<{ pos: [number, number, number]; heading: number } | null>(null);
  if (!initRef.current) {
    initRef.current = {
      pos: [bot.position[0], 0.0, bot.position[2]],
      heading: -bot.headingRad,
    };
  }

  // Real-time status LED color mapping
  const statusColor = useMemo(() => {
    if (bot.isReversing) {
      return BOT_THEME.LED_AMBER; // Strobe amber on reverse
    }
    switch (bot.status) {
      case "ACTIVE":
        return BOT_THEME.LED_GREEN;
      case "CHARGING":
        return BOT_THEME.LED_BLUE;
      case "WARNING":
      case "IDLE":
        return BOT_THEME.LED_AMBER;
      case "ERROR":
      case "OFFLINE":
        return BOT_THEME.LED_RED;
      default:
        return BOT_THEME.LED_AMBER;
    }
  }, [bot.status, bot.isReversing]);

  // High-precision useFrame interpolation loop (scales proportionally with simulationSpeed 1x/2x/5x/10x)
  useFrame(({ clock }, dt) => {
    const grp = groupRef.current;
    if (!grp) return;

    // Scale smoothing factor proportionally with simulationSpeed (1x/2x/5x) so 3D meshes track 2D speed accurately
    const speedMultiplier = simulationSpeed >= 5 ? 4.8 : simulationSpeed >= 2 ? 2.4 : 1.0;
    const effectiveDt = dt * speedMultiplier;
    const k = Math.min(1.0, 1.0 - Math.pow(0.00001, effectiveDt));

    const distToTarget = Math.hypot(bot.position[0] - grp.position.x, bot.position[2] - grp.position.z);
    if (distToTarget > 1.8 || simulationSpeed >= 5) {
      const fastK = Math.max(k, 0.88);
      grp.position.x += (bot.position[0] - grp.position.x) * fastK;
      grp.position.z += (bot.position[2] - grp.position.z) * fastK;
    } else {
      grp.position.x += (bot.position[0] - grp.position.x) * k;
      grp.position.z += (bot.position[2] - grp.position.z) * k;
    }
    grp.position.y = 0.0; // Grounded on floor

    // Shortest angular turn interpolation (Three.js Euler Y rotation requires -headingRad for +X forward)
    let dHeading = -bot.headingRad - grp.rotation.y;
    while (dHeading > Math.PI) dHeading -= Math.PI * 2;
    while (dHeading < -Math.PI) dHeading += Math.PI * 2;
    const turnStep = dHeading * (simulationSpeed >= 5 ? Math.max(k, 0.85) : k);
    grp.rotation.y += turnStep;

    // Realistic AMR Differential Drive Wheel Kinematics:
    // Wheels roll based on linear travel velocity AND turn rotation!
    const wheelRadius = 0.08;
    const halfTrackWidth = 0.32;
    const linearDist = bot.velocity * effectiveDt;
    const turnDist = turnStep * halfTrackWidth;

    // Differential drive: Left wheels roll forward with (+turn), Right wheels with (-turn)
    const dLeft = (linearDist + turnDist) / wheelRadius;
    const dRight = (linearDist - turnDist) / wheelRadius;

    leftWheelAngleRef.current += dLeft;
    rightWheelAngleRef.current += dRight;

    wheelRefs.current.forEach((w, idx) => {
      if (w) {
        // idx 0, 1 are Right wheels (wz > 0); idx 2, 3 are Left wheels (wz < 0)
        const angle = idx < 2 ? rightWheelAngleRef.current : leftWheelAngleRef.current;
        w.rotation.z = -angle;
      }
    });

    // Breathing pulse animation for status LED ring (Pulsing amber for yielding, rapid amber for surge)
    if (ledRingRef.current) {
      const isYielding = bot.perception?.state === "YIELDING" || bot.perception?.state === "HOLDING" || bot.isReversing;
      const isSurge = isFestiveSurgeActive || currentTask?.priority === "FLASH_SURGE";
      const isLoaded = (bot.currentPayloadKg ?? 0) > 0 || bot.fsmState === "NAVIGATING_TO_DELIVERY";

      const freq = isYielding ? 10.0 : isSurge ? 9.0 : isLoaded ? 4.5 : 3.5;
      const amp = isYielding ? 0.22 : isSurge ? 0.16 : 0.08;
      const pulse = 1.0 + Math.sin(clock.elapsedTime * freq) * amp;
      ledRingRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  // Calculate remaining continuous A* route in world coordinates
  // Institutional optimization: Only render continuous Line paths for selectedBotId or when hovered
  const showRoute = (isSelected || hovered) && bot.path && bot.path.length > 0;

  const routePoints = useMemo(() => {
    if (!showRoute || !bot.path || bot.path.length === 0) return null;

    const remainingCells = bot.path.slice(Math.max(0, bot.pathIndex - 1));
    if (remainingCells.length === 0) return null;

    const points: Array<[number, number, number]> = [
      [bot.position[0], 0.04, bot.position[2]],
    ];

    remainingCells.forEach((c) => {
      const [wx, wz] = cellToWorld(c[0], c[1]);
      points.push([wx, 0.04, wz]);
    });

    return points;
  }, [showRoute, bot.path, bot.pathIndex, bot.position]);

  const destinationPoint = useMemo(() => {
    if (!routePoints || routePoints.length === 0) return null;
    return routePoints[routePoints.length - 1];
  }, [routePoints]);

  const shouldRenderDetailedBadge = isSelected || hovered || isTopPickingBot;
  const isYieldingConflict = bot.perception?.state === "YIELDING" || bot.perception?.state === "HOLDING" || bot.isReversing;

  return (
    <>
      {/* 1. Floor Navigation Route Line (Rendered only when selected or hovered to eliminate 48 redundant line buffers) */}
      {routePoints && routePoints.length > 1 && (
        <group>
          <Line
            points={routePoints}
            color={hasObstacles ? "#FFE600" : BOT_THEME.ACCENT_YELLOW}
            lineWidth={hasObstacles ? (isSelected ? 4.5 : 3.5) : (isSelected ? 3.0 : 2.0)}
            dashed
            dashSize={0.6}
            gapSize={0.3}
            transparent
            opacity={hasObstacles ? 1.0 : (isSelected ? 0.95 : 0.65)}
          />
          {/* Destination Target Marker */}
          {destinationPoint && (
            <mesh
              geometry={SHARED_GEOMETRIES.destRing}
              position={[destinationPoint[0], 0.035, destinationPoint[2]]}
              rotation-x={-Math.PI / 2}
            >
              <meshBasicMaterial
                color={hasObstacles ? "#FFE600" : BOT_THEME.ACCENT_YELLOW}
                transparent
                opacity={hasObstacles ? 0.95 : 0.8}
              />
            </mesh>
          )}
        </group>
      )}

      {/* 2. Main BotUnit 3D Group */}
      <group
        ref={groupRef}
        position={initRef.current.pos}
        rotation-y={initRef.current.heading}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => {
          setHovered(false);
        }}
      >
        {/* Clickable Hovering HTML Status Badge - Guarded to selected, hovered, or lightweight indicator dots */}
        {(showLabels || isSelected || hovered) && activeCamera !== "robot" && (
          <Html
            position={[0, 1.25, 0]}
            center
            distanceFactor={32}
            zIndexRange={[isSelected ? 90 : 15, 0]}
          >
            {isSelected || hovered ? (
              <BotStatusBadge
                botId={bot.id}
                status={bot.status}
                batteryPct={bot.batteryPct}
                isSelected={isSelected}
                statusColor={statusColor}
                fsmState={bot.fsmState}
                perceptionState={bot.perception?.state}
                warningProximity={bot.perception?.warningProximity}
                isBackingOff={bot.backingOff}
                isReversing={bot.isReversing}
                targetTier={targetTier}
                pickDwellTicksRemaining={remainingTicks}
                pickDwellTotalTicks={totalTicks}
                onClick={onSelect}
              />
            ) : isTopPickingBot ? (
              <div
                className={`lbl ${bot.status === "ERROR" ? "err" : bot.status === "CHARGING" ? "chg" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect();
                }}
              >
                {bot.status === "ERROR" ? "⚠ " : ""}
                {bot.id}
              </div>
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect();
                }}
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  backgroundColor: statusColor,
                  boxShadow: `0 0 6px ${statusColor}`,
                  cursor: "pointer",
                }}
              />
            )}
          </Html>
        )}

        {/* High-visibility Vertical Rack Lift Latency Dwell Progress Bar - Guarded to selected or top 2 picking bots */}
        {isPicking && shouldRenderDetailedBadge && activeCamera !== "robot" && (
          <Html
            position={[0, 1.85, 0]}
            center
            distanceFactor={28}
            zIndexRange={[30, 0]}
          >
            <div
              style={{
                background: "rgba(15, 23, 42, 0.94)",
                border: "1.5px solid #38BDF8",
                borderRadius: "8px",
                padding: "4px 10px",
                boxShadow: "0 0 16px rgba(56, 189, 248, 0.55), 0 4px 12px rgba(0,0,0,0.4)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                fontFamily: "'JetBrains Mono', monospace, sans-serif",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 800, color: "#38BDF8", letterSpacing: "0.02em" }}>
                Lifting Tier {targetTier} <span style={{ color: "#F8CB46" }}>[{asciiBar}]</span> <span style={{ color: "#F8FAFC" }}>{remainingSec}s</span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: "4px",
                  background: "#1E293B",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.round(progressFraction * 100)}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, #38BDF8 0%, #F8CB46 100%)",
                    transition: "width 0.1s linear",
                  }}
                />
              </div>
            </div>
          </Html>
        )}

        {/* 2.4 Unmistakable 3D High-Contrast Status Pill for Right-of-Way Yielding */}
        {isYieldingConflict && activeCamera !== "robot" && (
          <Html
            position={[0, 1.95, 0]}
            center
            distanceFactor={28}
            zIndexRange={[99, 0]}
          >
            <div className="badge-yielding">
              🛡️ YIELDING (EMPTY ➔ LOADED PRIORITY)
            </div>
          </Html>
        )}

        {/* 2.5 Selected Robot Perception Gizmo */}
        {isSelected && <PerceptionGizmo bot={bot} />}

        {/* 3. Breathing Status LED Ring on Floor */}
        <mesh
          ref={ledRingRef}
          geometry={SHARED_GEOMETRIES.ledRing}
          position={[0, 0.005, 0]}
          rotation-x={-Math.PI / 2}
        >
          <meshBasicMaterial
            color={
              (bot.perception?.state === "YIELDING" || bot.perception?.state === "HOLDING" || bot.isReversing)
                ? "#F59E0B"
                : ((bot.currentPayloadKg ?? 0) > 0 || bot.fsmState === "NAVIGATING_TO_DELIVERY" || bot.fsmState === "DELIVERING")
                ? "#06B6D4"
                : (isFestiveSurgeActive || currentTask?.priority === "FLASH_SURGE") && bot.status === "ACTIVE"
                ? "#F59E0B"
                : bot.perception?.state === "SLOWING"
                ? "#F59E0B"
                : bot.perception?.state === "BACKING_OFF"
                ? "#8B5CF6"
                : statusColor
            }
            transparent
            opacity={
              isSelected
                ? 0.95
                : (bot.perception?.state === "YIELDING" || bot.perception?.state === "HOLDING" || bot.isReversing)
                ? 0.95
                : ((bot.currentPayloadKg ?? 0) > 0 || bot.fsmState === "NAVIGATING_TO_DELIVERY")
                ? 0.88
                : 0.65
            }
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* 4. Compact LiDAR Proximity Safety Zone & Chassis Footprint */}
        <mesh position={[0, 0.003, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry
            args={[
              0.52,
              bot.perception?.state === "HOLDING" || bot.perception?.state === "YIELDING"
                ? 0.72
                : bot.perception?.state === "SLOWING"
                ? 0.66
                : 0.58,
              32,
            ]}
          />
          <meshBasicMaterial
            color={
              bot.perception?.state === "HOLDING" || bot.perception?.state === "YIELDING"
                ? "#EF4444"
                : bot.perception?.state === "SLOWING"
                ? "#F59E0B"
                : bot.perception?.state === "BACKING_OFF"
                ? "#8B5CF6"
                : "#38BDF8"
            }
            transparent
            opacity={
              bot.perception?.state && bot.perception.state !== "CLEAR"
                ? 0.45
                : isSelected
                ? 0.28
                : 0.10
            }
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* 5. Directional Forward Path Guidance Ray (Compact & Clean) */}
        {isSelected && (
          <mesh position={[0.35, 0.004, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.9, 24, -Math.PI / 6, Math.PI / 3]} />
            <meshBasicMaterial
              color={
                bot.perception?.state === "SLOWING"
                  ? "#F59E0B"
                  : bot.perception?.state === "HOLDING" || bot.perception?.state === "YIELDING"
                  ? "#EF4444"
                  : "#10B981"
              }
              transparent
              opacity={0.22}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Selected Highlight Aura Disk */}
        {isSelected && (
          <mesh position={[0, 0.002, 0]} rotation-x={-Math.PI / 2}>
            <circleGeometry args={[0.9, 36]} />
            <meshBasicMaterial
              color={BOT_THEME.ACCENT_YELLOW}
              transparent
              opacity={0.16}
            />
          </mesh>
        )}

        {/* Interactive Clickable Collision Box */}
        <group
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onPointerOver={() => (document.body.style.cursor = "pointer")}
          onPointerOut={() => (document.body.style.cursor = "default")}
        >
          {/* Main White Chassis - Shared Singleton Geometry */}
          <group position={[0, 0.15, 0]}>
            <mesh geometry={SHARED_GEOMETRIES.chassis} castShadow>
              <meshStandardMaterial
                color={BOT_THEME.CHASSIS_WHITE}
                roughness={0.25}
                metalness={0.2}
              />
            </mesh>
          </group>

          {/* Yellow Front & Rear Bumper Trim (#F8CB46) - Shared Singleton Geometry */}
          <group position={[0.47, 0.14, 0]}>
            <mesh geometry={SHARED_GEOMETRIES.bumper}>
              <meshStandardMaterial
                color={BOT_THEME.ACCENT_YELLOW}
                roughness={0.3}
                metalness={0.1}
              />
            </mesh>
          </group>
          <group position={[-0.47, 0.14, 0]}>
            <mesh geometry={SHARED_GEOMETRIES.bumper}>
              <meshStandardMaterial
                color={BOT_THEME.ACCENT_YELLOW}
                roughness={0.3}
                metalness={0.1}
              />
            </mesh>
          </group>

          {/* Contrast Top Deck Plate - Shared Singleton Geometry */}
          <group position={[0, 0.245, 0]}>
            <mesh geometry={SHARED_GEOMETRIES.deckPlate} castShadow>
              <meshStandardMaterial
                color={BOT_THEME.DECK_CHARCOAL}
                roughness={0.5}
                metalness={0.6}
              />
            </mesh>
          </group>

          {/* Front Cyan Navigational Light Strip - Shared Singleton Geometry */}
          <group position={[0.485, 0.16, 0]}>
            <mesh geometry={SHARED_GEOMETRIES.frontLight}>
              <meshBasicMaterial color={BOT_THEME.FRONT_LIGHT} />
            </mesh>
          </group>

          {/* 4 Realistic Industrial AMR Wheels with Shared Singleton Geometries */}
          <group>
            {[
              [0.28, 0.32],
              [-0.28, 0.32],
              [0.28, -0.32],
              [-0.28, -0.32],
            ].map(([wx, wz], idx) => (
              <group key={`wheel-pos-${idx}`} position={[wx, 0.08, wz]}>
                <group ref={(el) => (wheelRefs.current[idx] = el)}>
                  {/* Outer Rubber Tire with Treads */}
                  <mesh geometry={SHARED_GEOMETRIES.wheelTire} rotation-x={Math.PI / 2} castShadow>
                    <meshStandardMaterial
                      color="#18181B"
                      roughness={0.85}
                      metalness={0.15}
                    />
                  </mesh>
                  {/* Signature Yellow Axle Hub Cap */}
                  <mesh geometry={SHARED_GEOMETRIES.wheelHub} rotation-x={Math.PI / 2}>
                    <meshStandardMaterial
                      color={BOT_THEME.ACCENT_YELLOW}
                      roughness={0.35}
                      metalness={0.5}
                    />
                  </mesh>
                  {/* High-Contrast Dual-Axle Spoke Cross for rotation visibility */}
                  <mesh geometry={SHARED_GEOMETRIES.spokeH} position={[0, 0, wz > 0 ? 0.029 : -0.029]}>
                    <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.7} />
                  </mesh>
                  <mesh geometry={SHARED_GEOMETRIES.spokeV} position={[0, 0, wz > 0 ? 0.029 : -0.029]}>
                    <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.7} />
                  </mesh>
                </group>
              </group>
            ))}
          </group>

          {/* Toggleable Packaging Box on Top (when carrying load) - Shared Singleton Geometries */}
          {bot.currentPayloadKg > 0 && (
            <group position={[0, 0.44, 0]}>
              {/* Kraft Corrugated Box */}
              <mesh geometry={SHARED_GEOMETRIES.packageBox} castShadow>
                <meshStandardMaterial
                  color={BOT_THEME.PACKAGE_KRAFT}
                  roughness={0.75}
                  metalness={0.05}
                />
              </mesh>

              {/* Sealing Tape Strip across the Box */}
              <group position={[0, 0.245, 0]}>
                <mesh geometry={SHARED_GEOMETRIES.packageTape}>
                  <meshStandardMaterial
                    color={BOT_THEME.PACKAGE_TAPE}
                    roughness={0.4}
                  />
                </mesh>
              </group>

              {/* Shipping Label Tag */}
              <group position={[0.2, 0.1, 0.275]}>
                <mesh geometry={SHARED_GEOMETRIES.packageLabel}>
                  <meshBasicMaterial color="#FFFFFF" />
                </mesh>
              </group>
            </group>
          )}
        </group>
      </group>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Primary BotFleet Composite Export
// ─────────────────────────────────────────────────────────────

export interface BotFleetProps {
  fleetCountOverride?: number;
}

interface VirtualBotInternal {
  id: string;
  position: [number, number, number];
  headingRad: number;
  velocity: number;
  currentCell: [number, number];
  targetCell: [number, number];
  path: [number, number][];
  pathIndex: number;
  dwellTicks: number;
  payloadKg: number;
  isYielding: boolean;
}

export function BotFleet({ fleetCountOverride }: BotFleetProps = {}) {
  const botUnits = useTwinStore((s) => s.botUnits);
  const selectedBotId = useTwinStore((s) => s.selectedBotId);
  const selectBot = useTwinStore((s) => s.selectBot);
  const showLabels = useTwinStore((s) => s.showLabels);
  const showPaths = useTwinStore((s) => s.showPaths);
  const simulationSpeed = useTwinStore((s) => s.simulationSpeed);
  const navGrid = useTwinStore((s) => s.navGrid);
  const tick = useTwinStore((s) => s.tick);

  // Extract traversable aisle cells for virtual bot swarm distribution
  const walkableCells = useMemo(() => {
    if (!navGrid || !navGrid.cells) return [];
    const list: [number, number][] = [];
    const cols = navGrid.cols;
    const rows = navGrid.rows;
    for (let r = 2; r < rows - 2; r++) {
      for (let c = 2; c < cols - 2; c++) {
        if (navGrid.cells[r * cols + c] === 0) {
          list.push([c, r]);
        }
      }
    }
    return list;
  }, [navGrid]);

  const virtualBotsRef = useRef<Map<string, VirtualBotInternal>>(new Map());
  const lastTickRef = useRef(tick);

  // Scale virtual bot fleet when fleetCountOverride is active
  const renderedBots = useMemo(() => {
    const baseBots = Object.values(botUnits);
    if (fleetCountOverride === undefined) {
      return baseBots;
    }

    const targetCount = Math.max(1, Math.round(fleetCountOverride));
    if (targetCount <= baseBots.length) {
      return baseBots.slice(0, targetCount);
    }

    if (walkableCells.length === 0) {
      return baseBots;
    }

    const tickDelta = Math.max(0, Math.min(10, tick - lastTickRef.current));
    lastTickRef.current = tick;

    // Congestion scaling: past 64 AMRs, robots begin yielding at cross-aisles
    const congRate = targetCount <= 56
      ? 0.094
      : Math.min(0.55, 0.094 + Math.pow((targetCount - 56) / 64, 1.4) * 0.374);

    const vBotsMap = virtualBotsRef.current;
    const virtualBotUnits: BotUnit[] = [];

    for (let i = baseBots.length; i < targetCount; i++) {
      const botId = `BOT-${i < 9 ? "0" + (i + 1) : i + 1}`;
      let vb = vBotsMap.get(botId);

      if (!vb) {
        // Disperse virtual bot spawns across distinct warehouse aisles
        const spawnIdx = (i * 37 + 13) % walkableCells.length;
        const targetIdx = (i * 79 + 47) % walkableCells.length;
        const startCell = walkableCells[spawnIdx];
        const goalCell = walkableCells[targetIdx];
        const [wx, wz] = cellToWorld(startCell[0], startCell[1], navGrid?.cellSize || 1.0);
        const initialPath = (navGrid && findPathAStar(navGrid, startCell, goalCell)) || [];

        vb = {
          id: botId,
          position: [wx, 0.25, wz],
          headingRad: (i * 0.785) % (Math.PI * 2),
          velocity: 1.2,
          currentCell: startCell,
          targetCell: goalCell,
          path: initialPath,
          pathIndex: 0,
          dwellTicks: (i * 3) % 10,
          payloadKg: i % 2 === 0 ? 15 : 0,
          isYielding: false,
        };
        vBotsMap.set(botId, vb);
      } else if (tickDelta > 0) {
        // Congestion yield simulation
        const shouldYield = targetCount > 64 && ((i * 17 + Math.floor(tick / 12)) % 100) < (congRate * 100);

        if (shouldYield) {
          vb.isYielding = true;
          vb.velocity = 0;
        } else {
          vb.isYielding = false;
          if (vb.dwellTicks > 0) {
            vb.dwellTicks -= tickDelta;
            vb.velocity = 0;
          } else {
            const steps = Math.min(tickDelta, 3);
            for (let s = 0; s < steps; s++) {
              if (vb.path && vb.pathIndex < vb.path.length) {
                vb.velocity = 1.2;
                const nextCell = vb.path[vb.pathIndex];
                const [nextWx, nextWz] = cellToWorld(nextCell[0], nextCell[1], navGrid?.cellSize || 1.0);
                const dx = nextWx - vb.position[0];
                const dz = nextWz - vb.position[2];
                if (Math.hypot(dx, dz) > 0.01) {
                  vb.headingRad = Math.atan2(dz, dx);
                }
                vb.position = [nextWx, 0.25, nextWz];
                vb.currentCell = nextCell;
                vb.pathIndex += 1;
              } else {
                // Reached destination: dwell and route to next destination
                vb.dwellTicks = 8;
                vb.payloadKg = vb.payloadKg > 0 ? 0 : 15;
                const nextGoalIdx = (i * 73 + tick * 5) % walkableCells.length;
                const nextGoal = walkableCells[nextGoalIdx];
                vb.targetCell = nextGoal;
                vb.path = (navGrid && findPathAStar(navGrid, vb.currentCell, nextGoal)) || [];
                vb.pathIndex = 0;
                break;
              }
            }
          }
        }
      }

      virtualBotUnits.push({
        id: vb.id,
        profileId: "LIGHT_PICKER",
        position: vb.position,
        headingRad: vb.headingRad,
        velocity: vb.velocity,
        batteryPct: 80 + (i * 5) % 20,
        status: "ACTIVE",
        fsmState: vb.isYielding ? "IDLE" : vb.dwellTicks > 0 ? "PICKING" : vb.payloadKg > 0 ? "NAVIGATING_TO_DELIVERY" : "NAVIGATING_TO_PICKUP",
        healthPct: 98,
        currentTaskId: null,
        targetLocationId: null,
        path: vb.path,
        pathIndex: vb.pathIndex,
        currentPayloadKg: vb.payloadKg,
        stats: {
          distanceTraveledM: 120,
          tasksCompleted: 12,
          energyConsumedWh: 60,
          busyTicks: 120,
          idleTicks: 12,
          waitTicks: 6,
        },
        perception: {
          state: vb.isYielding ? "YIELDING" : "CLEAR",
          frontObstacleId: null,
          frontDistM: vb.isYielding ? 1.0 : null,
          warningProximity: vb.isYielding,
          yieldsToId: null,
        },
        waitTicks: vb.isYielding ? 10 : 0,
        backingOff: false,
        resumeGoalCoords: null,
        resumeTaskId: null,
        resumeLocationId: null,
        resumeFsmState: null,
        safeYieldsCount: 0,
        isReversing: false,
        reverseTicks: 0,
        recentBreadcrumbs: [],
      });
    }

    return [...baseBots, ...virtualBotUnits];
  }, [botUnits, fleetCountOverride, walkableCells, tick, navGrid]);

  // Top 2 active picking bots closest to camera center for high-detail progress rendering
  const topPickingBotIds = useMemo(() => {
    const picking = renderedBots.filter((b) => b.fsmState === "PICKING");
    if (picking.length <= 2) {
      return new Set(picking.map((b) => b.id));
    }
    return new Set(picking.slice(0, 2).map((b) => b.id));
  }, [renderedBots]);

  return (
    <group name="BotFleet">
      {renderedBots.map((bot) => (
        <SingleBot
          key={bot.id}
          bot={bot}
          isSelected={selectedBotId === bot.id}
          onSelect={() => selectBot(bot.id)}
          showLabels={showLabels}
          showPaths={showPaths}
          simulationSpeed={simulationSpeed}
          isTopPickingBot={topPickingBotIds.has(bot.id)}
        />
      ))}
    </group>
  );
}

export default BotFleet;
