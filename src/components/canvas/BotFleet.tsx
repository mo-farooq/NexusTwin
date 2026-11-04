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
  perceptionState?: string;
  warningProximity?: boolean;
  isBackingOff?: boolean;
  onClick: () => void;
}

function BotStatusBadge({
  botId,
  status,
  batteryPct,
  isSelected,
  statusColor,
  perceptionState,
  warningProximity,
  isBackingOff,
  onClick,
}: BotStatusBadgeProps) {
  const [hovered, setHovered] = useState(false);

  const acBadge = useMemo(() => {
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
  }, [perceptionState, isBackingOff]);

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
          [Math.sin(bot.headingRad) * range, 0.05, Math.cos(bot.headingRad) * range],
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
  const [hovered, setHovered] = useState(false);
  const groupRef = useRef<THREE.Group>(null!);
  const wheelsRef = useRef<THREE.Group>(null!);
  const ledRingRef = useRef<THREE.Mesh>(null!);

  // Initial mount coordinate references to prevent frame flickers
  const initRef = useRef<{ pos: [number, number, number]; heading: number } | null>(null);
  if (!initRef.current) {
    initRef.current = {
      pos: [bot.position[0], 0.2, bot.position[2]],
      heading: bot.headingRad,
    };
  }

  // Real-time status LED color mapping
  const statusColor = useMemo(() => {
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
  }, [bot.status]);

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
    grp.position.y = 0.2; // Keep fixed ground clearance

    // Shortest angular turn interpolation
    let dHeading = bot.headingRad - grp.rotation.y;
    while (dHeading > Math.PI) dHeading -= Math.PI * 2;
    while (dHeading < -Math.PI) dHeading += Math.PI * 2;
    grp.rotation.y += dHeading * (simulationSpeed >= 5 ? Math.max(k, 0.85) : k);

    // Rotate wheels dynamically based on linear movement velocity and simulationSpeed
    if (wheelsRef.current && bot.velocity > 0.05) {
      wheelsRef.current.rotation.x -= (bot.velocity / 0.08) * effectiveDt;
    }

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
        {(showLabels || isSelected || hovered) && (
          <Html
            position={[0, 1.45, 0]}
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
                perceptionState={bot.perception?.state}
                warningProximity={bot.perception?.warningProximity}
                isBackingOff={bot.backingOff}
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

        {/* 2.5 Selected Robot Perception Gizmo */}
        {isSelected && <PerceptionGizmo bot={bot} />}

        {/* 3. Breathing Status LED Ring on Floor */}
        <mesh
          ref={ledRingRef}
          position={[0, -0.18, 0]}
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
        <mesh position={[0, -0.188, 0]} rotation-x={-Math.PI / 2}>
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
          <mesh position={[0, -0.186, 0.35]} rotation-x={-Math.PI / 2}>
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
          <mesh position={[0, -0.19, 0]} rotation-x={-Math.PI / 2}>
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
          <group position={[0, 0.12, 0]}>
            <RoundedBox
              args={[0.96, 0.24, 0.7]}
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
          <group position={[0.47, 0.08, 0]}>
            <RoundedBox args={[0.04, 0.1, 0.68]} radius={0.015} smoothness={4}>
              <meshStandardMaterial
                color={BOT_THEME.ACCENT_YELLOW}
                roughness={0.3}
                metalness={0.1}
              />
            </RoundedBox>
          </group>
          <group position={[-0.47, 0.08, 0]}>
            <RoundedBox args={[0.04, 0.1, 0.68]} radius={0.015} smoothness={4}>
              <meshStandardMaterial
                color={BOT_THEME.ACCENT_YELLOW}
                roughness={0.3}
                metalness={0.1}
              />
            </RoundedBox>
          </group>

          {/* Contrast Top Deck Plate */}
          <group position={[0, 0.26, 0]}>
            <RoundedBox
              args={[0.82, 0.05, 0.58]}
              radius={0.02}
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
          <group position={[0.485, 0.14, 0]}>
            <RoundedBox args={[0.02, 0.05, 0.48]} radius={0.01} smoothness={4}>
              <meshBasicMaterial color={BOT_THEME.FRONT_LIGHT} />
            </RoundedBox>
          </group>

          {/* 4 Charcoal (#1C1C1C) Wheels */}
          <group ref={wheelsRef}>
            {[
              [-0.32, -0.34],
              [0.32, -0.34],
              [-0.32, 0.34],
              [0.32, 0.34],
            ].map(([wx, wz], idx) => (
              <mesh
                key={`wheel-${idx}`}
                position={[wx, 0.07, wz]}
                rotation-z={Math.PI / 2}
              >
                <cylinderGeometry args={[0.075, 0.075, 0.065, 16]} />
                <meshStandardMaterial
                  color={BOT_THEME.WHEEL_CHARCOAL}
                  roughness={0.8}
                  metalness={0.3}
                />
              </mesh>
            ))}
          </group>

          {/* Toggleable Packaging Box on Top (when carrying load) */}
          {bot.currentPayloadKg > 0 && (
            <group position={[0, 0.56, 0]}>
              {/* Kraft Corrugated Box */}
              <RoundedBox
                args={[0.72, 0.48, 0.54]}
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
