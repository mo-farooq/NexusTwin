/**
 * NexusTwin 2D Blueprint Map View
 *
 * High-performance 2D SVG map view of the warehouse facility rendering:
 * - Layout perimeter walls and 5m grid lines
 * - Functional zones (Inbound, Storage, Charging, Packing, Outbound)
 * - 4-tier storage rack blocks
 * - Motorized conveyor lines with animated flow
 * - DC fast-charging bays & workstations
 * - Dynamic human workers and autonomous BotUnits with directional heading arrows
 * - Interactive click selection and route lines
 */

import React, { useMemo } from "react";
import { useTwinStore } from "../../store/useTwinStore";

export function MapView2D({ mode = "MAP" }: { mode?: "MAP" | "TRAFFIC" | "HEATMAP" }) {
  const gridDimensions = useTwinStore((s) => s.gridDimensions);
  const zones = useTwinStore((s) => s.zones);
  const locations = useTwinStore((s) => s.locations);
  const chargingDocks = useTwinStore((s) => s.chargingDocks);
  const conveyors = useTwinStore((s) => s.conveyors);
  const botUnits = useTwinStore((s) => s.botUnits);
  const people = useTwinStore((s) => s.people);
  const selectedBotId = useTwinStore((s) => s.selectedBotId);
  const selectBot = useTwinStore((s) => s.selectBot);
  const trafficDensityMap = useTwinStore((s) => s.trafficDensityMap);
  const activeCongestionMap = useTwinStore((s) => s.activeCongestionMap);

  const { widthM: W, depthM: D, cols, rows, cellSize } = gridDimensions;

  // Rack run-length blocks from locations
  const rackBlocks = useMemo(() => {
    return Object.values(locations).filter((l) => l.type === "SHELF");
  }, [locations]);

  const stations = useMemo(() => {
    return Object.values(locations).filter((l) => l.type !== "SHELF");
  }, [locations]);

  return (
    <svg
      className="map2d"
      viewBox={`-2 -4 ${W + 4} ${D + 8}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", background: "#F8FAFC" }}
    >
      {/* Background Floor */}
      <rect x="0" y="0" width={W} height={D} fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.5" />

      {/* 5m Grid Lines */}
      {Array.from({ length: Math.floor(W / 5) + 1 }, (_, i) => (
        <line
          key={"v" + i}
          x1={i * 5}
          x2={i * 5}
          y1="0"
          y2={D}
          stroke="#E2E8F0"
          strokeWidth="0.25"
        />
      ))}
      {Array.from({ length: Math.floor(D / 5) + 1 }, (_, i) => (
        <line
          key={"h" + i}
          y1={i * 5}
          y2={i * 5}
          x1="0"
          x2={W}
          stroke="#E2E8F0"
          strokeWidth="0.25"
        />
      ))}

      {/* Warehouse Zones */}
      {Object.values(zones).map((z) => {
        const [minX, minZ, maxX, maxZ] = z.bounds;
        const w = maxX - minX;
        const h = maxZ - minZ;
        return (
          <g key={z.id}>
            <rect
              x={minX}
              y={minZ}
              width={w}
              height={h}
              fill={z.color}
              fillOpacity="0.08"
              stroke={z.color}
              strokeWidth="0.35"
              strokeDasharray="1.5 1"
            />
            <text
              x={minX + 0.8}
              y={minZ + 2.2}
              fill={z.color}
              fontSize="1.6"
              fontWeight="800"
              fontFamily="'Inter', sans-serif"
              letterSpacing="0.05em"
            >
              {z.name.toUpperCase()}
            </text>
          </g>
        );
      })}

      {/* Storage Racks */}
      {rackBlocks.map((r) => (
        <rect
          key={r.id}
          x={r.coords[0] - 0.75}
          y={r.coords[1] - 0.4}
          width={1.5}
          height={0.8}
          fill="#E2E8F0"
          stroke="#94A3B8"
          strokeWidth="0.15"
          rx="0.1"
        />
      ))}

      {/* Workstations & Inbound Bays */}
      {stations.map((s) => (
        <g key={s.id}>
          <rect
            x={s.coords[0] - 1.2}
            y={s.coords[1] - 0.6}
            width={2.4}
            height={1.2}
            fill="#FEF3C7"
            stroke="#D97706"
            strokeWidth="0.25"
            rx="0.2"
          />
          <text
            x={s.coords[0]}
            y={s.coords[1] + 0.35}
            fill="#92400E"
            fontSize="0.9"
            fontWeight="700"
            textAnchor="middle"
            fontFamily="'JetBrains Mono', monospace"
          >
            {s.name}
          </text>
        </g>
      ))}

      {/* Conveyor Lines */}
      {conveyors.map((c) => (
        <g key={c.id}>
          <line
            x1={c.startCoords[0]}
            y1={c.startCoords[1]}
            x2={c.endCoords[0]}
            y2={c.endCoords[1]}
            stroke="#38BDF8"
            strokeWidth="0.9"
            strokeDasharray="1 0.5"
          />
        </g>
      ))}

      {/* EV Charging Docks */}
      {Object.values(chargingDocks).map((d) => (
        <circle
          key={d.id}
          cx={d.coords[0]}
          cy={d.coords[1]}
          r="0.75"
          fill="#10B981"
          fillOpacity="0.8"
          stroke="#059669"
          strokeWidth="0.2"
        />
      ))}

      {/* Dynamic Human Workers */}
      {people &&
        Object.values(people).map((p) => (
          <g key={p.id}>
            <circle
              cx={p.position[0]}
              cy={p.position[2]}
              r="0.8"
              fill="#F97316"
              fillOpacity="0.4"
            />
            <circle
              cx={p.position[0]}
              cy={p.position[2]}
              r="0.45"
              fill="#EA580C"
              stroke="#FFFFFF"
              strokeWidth="0.15"
            />
            <text
              x={p.position[0]}
              y={p.position[2] - 0.9}
              fill="#FDBA74"
              fontSize="0.85"
              fontWeight="700"
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
            >
              {p.name.split(" ")[0]}
            </text>
          </g>
        ))}

      {/* Active Robot Navigation Routes */}
      {Object.values(botUnits).map((bot) => {
        if (!bot.path || bot.path.length <= 1) return null;
        const pts = bot.path
          .slice(Math.max(0, bot.pathIndex - 1))
          .map((c) => `${c[0] * cellSize + cellSize / 2},${c[1] * cellSize + cellSize / 2}`)
          .join(" ");
        return (
          <polyline
            key={"path-" + bot.id}
            points={pts}
            fill="none"
            stroke={bot.id === selectedBotId ? "#FFFFFF" : "#F8CB46"}
            strokeWidth={bot.id === selectedBotId ? "0.45" : "0.25"}
            strokeDasharray="0.6 0.3"
            opacity="0.85"
          />
        );
      })}

      {/* BotUnits */}
      {Object.values(botUnits).map((bot) => {
        const isSel = bot.id === selectedBotId;
        const statusCol =
          bot.status === "ACTIVE"
            ? "#10B981"
            : bot.status === "CHARGING"
            ? "#3B82F6"
            : bot.status === "ERROR"
            ? "#EF4444"
            : "#F59E0B";

        const rad = bot.headingRad || 0;
        const tipX = bot.position[0] + Math.sin(rad) * 0.9;
        const tipY = bot.position[2] + Math.cos(rad) * 0.9;

        return (
          <g
            key={bot.id}
            onClick={(e) => {
              e.stopPropagation();
              selectBot(bot.id);
            }}
            style={{ cursor: "pointer" }}
          >
            {/* Selection Halo */}
            {isSel && (
              <circle
                cx={bot.position[0]}
                cy={bot.position[2]}
                r="1.4"
                fill="none"
                stroke="#2563EB"
                strokeWidth="0.3"
                strokeDasharray="0.6 0.3"
              />
            )}

            {/* Direction Heading Pointer */}
            <line
              x1={bot.position[0]}
              y1={bot.position[2]}
              x2={tipX}
              y2={tipY}
              stroke={statusCol}
              strokeWidth="0.35"
            />

            {/* Robot Chassis Circle */}
            <circle
              cx={bot.position[0]}
              cy={bot.position[2]}
              r="0.6"
              fill={statusCol}
              stroke="#FFFFFF"
              strokeWidth="0.18"
            />

            {/* Bot ID Label */}
            <text
              x={bot.position[0]}
              y={bot.position[2] + 1.25}
              fill={isSel ? "#2563EB" : "#334155"}
              fontSize="0.85"
              fontWeight={isSel ? "900" : "700"}
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
            >
              {bot.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default MapView2D;
