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
import { RoundedBox, Line, Html } from "@react-three/drei";
import * as THREE from "three";
import { useTwinStore, type BotUnit } from "../../store/useTwinStore";
import { cellToWorld } from "../../engine/pathfinder";

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
      return { label: "🛡️ YIELDING", color: "#F59E0B", bg: "rgba(245, 158, 11, 0.2)" };
    }
    if (perceptionState === "HOLDING") {
      return { label: "🛑 LiDAR HOLD", color: "#EF4444", bg: "rgba(239, 68, 68, 0.2)" };
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
}

function SingleBot({ bot, isSelected, onSelect, showLabels, showPaths, simulationSpeed }: SingleBotProps) {
  const activeCamera = useTwinStore((s) => s.activeCamera);
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

    // Breathing pulse animation for status LED ring
    if (ledRingRef.current) {
      const pulse = 1.0 + Math.sin(clock.elapsedTime * 3.5) * 0.06;
      ledRingRef.current.scale.set(pulse, pulse, pulse);
    }
  });

  // Calculate remaining continuous A* route in world coordinates
  const isMoving = bot.status === "ACTIVE" && bot.path.length > 0;
  const showRoute = isSelected || (showPaths && isMoving);

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

  return (
    <>
      {/* 1. Floor Navigation Route Line (Dashed #F8CB46) */}
      {routePoints && routePoints.length > 1 && (
        <group>
          <Line
            points={routePoints}
            color={BOT_THEME.ACCENT_YELLOW}
            lineWidth={isSelected ? 3.0 : 2.0}
            dashed
            dashSize={0.6}
            gapSize={0.3}
            transparent
            opacity={isSelected ? 0.95 : 0.65}
          />
          {/* Destination Target Marker */}
          {destinationPoint && (
            <mesh
              position={[destinationPoint[0], 0.035, destinationPoint[2]]}
              rotation-x={-Math.PI / 2}
            >
              <ringGeometry args={[0.35, 0.52, 24]} />
              <meshBasicMaterial
                color={BOT_THEME.ACCENT_YELLOW}
                transparent
                opacity={0.8}
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
        {/* Clickable Hovering HTML Status Badge (Shown when selected, hovered, or labels toggled ON) */}
        {(showLabels || isSelected || hovered) && activeCamera !== "robot" && (
          <Html
            position={[0, 1.25, 0]}
            center
            distanceFactor={32}
            zIndexRange={[15, 0]}
          >
            {isSelected ? (
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
            ) : (
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
            )}
          </Html>
        )}

        {/* High-visibility Vertical Rack Lift Latency Dwell Progress Bar */}
        {isPicking && activeCamera !== "robot" && (
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

        {/* 2.5 Selected Robot Perception Gizmo */}
        {isSelected && <PerceptionGizmo bot={bot} />}

        {/* 3. Breathing Status LED Ring on Floor */}
        <mesh
          ref={ledRingRef}
          position={[0, 0.005, 0]}
          rotation-x={-Math.PI / 2}
        >
          <ringGeometry args={[0.56, 0.72, 36]} />
          <meshBasicMaterial
            color={
              bot.perception?.state === "HOLDING" || bot.perception?.state === "YIELDING"
                ? "#EF4444"
                : bot.perception?.state === "SLOWING"
                ? "#F59E0B"
                : bot.perception?.state === "BACKING_OFF"
                ? "#8B5CF6"
                : statusColor
            }
            transparent
            opacity={isSelected ? 0.95 : 0.65}
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
          {/* Main White Chassis */}
          <group position={[0, 0.15, 0]}>
            <RoundedBox
              args={[0.96, 0.18, 0.62]}
              radius={0.03}
              smoothness={4}
              castShadow
            >
              <meshStandardMaterial
                color={BOT_THEME.CHASSIS_WHITE}
                roughness={0.25}
                metalness={0.2}
              />
            </RoundedBox>
          </group>

          {/* Yellow Front & Rear Bumper Trim (#F8CB46) */}
          <group position={[0.47, 0.14, 0]}>
            <RoundedBox args={[0.04, 0.12, 0.60]} radius={0.015} smoothness={4}>
              <meshStandardMaterial
                color={BOT_THEME.ACCENT_YELLOW}
                roughness={0.3}
                metalness={0.1}
              />
            </RoundedBox>
          </group>
          <group position={[-0.47, 0.14, 0]}>
            <RoundedBox args={[0.04, 0.12, 0.60]} radius={0.015} smoothness={4}>
              <meshStandardMaterial
                color={BOT_THEME.ACCENT_YELLOW}
                roughness={0.3}
                metalness={0.1}
              />
            </RoundedBox>
          </group>

          {/* Contrast Top Deck Plate */}
          <group position={[0, 0.245, 0]}>
            <RoundedBox
              args={[0.82, 0.02, 0.56]}
              radius={0.01}
              smoothness={4}
              castShadow
            >
              <meshStandardMaterial
                color={BOT_THEME.DECK_CHARCOAL}
                roughness={0.5}
                metalness={0.6}
              />
            </RoundedBox>
          </group>

          {/* Front Cyan Navigational Light Strip */}
          <group position={[0.485, 0.16, 0]}>
            <RoundedBox args={[0.02, 0.04, 0.44]} radius={0.01} smoothness={4}>
              <meshBasicMaterial color={BOT_THEME.FRONT_LIGHT} />
            </RoundedBox>
          </group>

          {/* 4 Realistic Industrial AMR Wheels with Individual Axle Rotation */}
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
                  <mesh rotation-x={Math.PI / 2} castShadow>
                    <cylinderGeometry args={[0.08, 0.08, 0.052, 16]} />
                    <meshStandardMaterial
                      color="#18181B"
                      roughness={0.85}
                      metalness={0.15}
                    />
                  </mesh>
                  {/* Signature Yellow Axle Hub Cap */}
                  <mesh rotation-x={Math.PI / 2}>
                    <cylinderGeometry args={[0.032, 0.032, 0.058, 12]} />
                    <meshStandardMaterial
                      color={BOT_THEME.ACCENT_YELLOW}
                      roughness={0.35}
                      metalness={0.5}
                    />
                  </mesh>
                  {/* High-Contrast Dual-Axle Spoke Cross for unmistakable rotation visibility */}
                  <mesh position={[0, 0, wz > 0 ? 0.029 : -0.029]}>
                    <boxGeometry args={[0.12, 0.022, 0.004]} />
                    <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.7} />
                  </mesh>
                  <mesh position={[0, 0, wz > 0 ? 0.029 : -0.029]}>
                    <boxGeometry args={[0.022, 0.12, 0.004]} />
                    <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.7} />
                  </mesh>
                </group>
              </group>
            ))}
          </group>

          {/* Toggleable Packaging Box on Top (when carrying load) */}
          {bot.currentPayloadKg > 0 && (
            <group position={[0, 0.44, 0]}>
              {/* Kraft Corrugated Box */}
              <RoundedBox
                args={[0.64, 0.36, 0.48]}
                radius={0.02}
                smoothness={4}
                castShadow
              >
                <meshStandardMaterial
                  color={BOT_THEME.PACKAGE_KRAFT}
                  roughness={0.75}
                  metalness={0.05}
                />
              </RoundedBox>

              {/* Sealing Tape Strip across the Box */}
              <group position={[0, 0.245, 0]}>
                <RoundedBox args={[0.73, 0.015, 0.1]} radius={0.005} smoothness={4}>
                  <meshStandardMaterial
                    color={BOT_THEME.PACKAGE_TAPE}
                    roughness={0.4}
                  />
                </RoundedBox>
              </group>

              {/* Shipping Label Tag */}
              <group position={[0.2, 0.1, 0.275]}>
                <RoundedBox args={[0.18, 0.12, 0.01]} radius={0.005} smoothness={4}>
                  <meshBasicMaterial color="#FFFFFF" />
                </RoundedBox>
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

export function BotFleet() {
  const botUnits = useTwinStore((s) => s.botUnits);
  const selectedBotId = useTwinStore((s) => s.selectedBotId);
  const selectBot = useTwinStore((s) => s.selectBot);
  const showLabels = useTwinStore((s) => s.showLabels);
  const showPaths = useTwinStore((s) => s.showPaths);
  const simulationSpeed = useTwinStore((s) => s.simulationSpeed);

  return (
    <group name="BotFleet">
      {Object.values(botUnits).map((bot) => (
        <SingleBot
          key={bot.id}
          bot={bot}
          isSelected={selectedBotId === bot.id}
          onSelect={() => selectBot(bot.id)}
          showLabels={showLabels}
          showPaths={showPaths}
          simulationSpeed={simulationSpeed}
        />
      ))}
    </group>
  );
}

export default BotFleet;
