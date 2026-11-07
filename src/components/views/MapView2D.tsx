/**
 * NexusTwin 2D Architectural CAD Blueprint Map View
 *
 * Authentic architectural cyan-blue blueprint rendering:
 * - Deep cyan-navy blueprint paper background (#0A2540 / #0B3A60)
 * - 1m minor architectural blueprint grid and 5m major cyan grid lines
 * - Dimension witness lines and metric coordinate rulers (Width & Depth)
 * - White & cyan architectural ink for perimeter concrete walls
 * - 4-tier storage rack blocks with shelf tier dividers & bay indicators
 * - Motorized conveyor lines with roller dashes and directional flow
 * - DC fast-charging bays with lightning glyphs & fulfillment workstations
 * - Dynamic human workers and autonomous BotUnits with LiDAR radar ring and heading vector
 * - Interactive click-selection, active A* trajectory polyline
 * - Architectural title block stamp with scale (1:100), footprint, revision, and North arrow
 * - Traffic density & congestion heatmap layer when in TRAFFIC/HEATMAP mode
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

  const botList = useMemo(() => Object.values(botUnits), [botUnits]);
  const totalBots = botList.length;

  // Heatmap cells for TRAFFIC / HEATMAP mode
  const heatmapCells = useMemo(() => {
    if (mode === "MAP") return [];
    const cells: Array<{ x: number; y: number; val: number }> = [];
    const maxVal = 10;
    const len = Math.min(trafficDensityMap.length, cols * rows);
    for (let i = 0; i < len; i++) {
      const v = trafficDensityMap[i];
      if (v > 0.2) {
        const c = i % cols;
        const r = Math.floor(i / cols);
        cells.push({ x: c * cellSize, y: r * cellSize, val: Math.min(1, v / maxVal) });
      }
    }
    return cells;
  }, [mode, trafficDensityMap, cols, rows, cellSize]);

  // Margin offsets for dimension lines and rulers
  const padLeft = 4.5;
  const padTop = 4.5;
  const padRight = 3.5;
  const padBottom = 3.5;
  const viewX = -padLeft;
  const viewY = -padTop;
  const viewW = W + padLeft + padRight;
  const viewH = D + padTop + padBottom;

  return (
    <svg
      className="map2d"
      viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
      preserveAspectRatio="xMidYMid meet"
      onClick={() => selectBot(null)}
      style={{
        width: "100%",
        height: "100%",
        background: "#071E33",
        display: "block",
        cursor: "default",
      }}
    >
      <defs>
        {/* Blueprint Paper Radial Vignette Gradient */}
        <radialGradient id="bpPaperGrad" cx="50%" cy="50%" r="75%">
          <stop offset="0%" stopColor="#0D3B66" />
          <stop offset="60%" stopColor="#0A2540" />
          <stop offset="100%" stopColor="#06182C" />
        </radialGradient>

        {/* 1m Minor Architectural Blueprint Grid Pattern */}
        <pattern id="bpGrid1m" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#1E5180" strokeWidth="0.04" strokeOpacity="0.45" />
        </pattern>

        {/* Rack Crosshatch Pattern */}
        <pattern id="rackHatch" width="0.4" height="0.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="0.4" stroke="#38BDF8" strokeWidth="0.05" strokeOpacity="0.4" />
        </pattern>

        {/* Conveyor Roller Pattern */}
        <pattern id="conveyorRollers" width="0.4" height="0.8" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0.4" x2="0.4" y2="0.4" stroke="#00F0FF" strokeWidth="0.08" strokeOpacity="0.8" />
        </pattern>

        {/* Glow Filter for Active Elements */}
        <filter id="bpCyanGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.25" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── 1. Outer Blueprint Canvas Paper ── */}
      <rect
        x={viewX}
        y={viewY}
        width={viewW}
        height={viewH}
        fill="#06182C"
      />

      {/* ── 2. Facility Floor Base Plane ── */}
      <rect
        x="0"
        y="0"
        width={W}
        height={D}
        fill="url(#bpPaperGrad)"
        stroke="#FFFFFF"
        strokeWidth="0.4"
      />

      {/* ── 3. 1m Minor Grid Overlay ── */}
      <rect
        x="0"
        y="0"
        width={W}
        height={D}
        fill="url(#bpGrid1m)"
      />

      {/* ── 4. 5m Major Cyan Blueprint Grid Lines ── */}
      {Array.from({ length: Math.floor(W / 5) + 1 }, (_, i) => {
        const x = i * 5;
        const isTen = i % 2 === 0;
        return (
          <g key={"v" + i}>
            <line
              x1={x}
              x2={x}
              y1="0"
              y2={D}
              stroke={isTen ? "#38BDF8" : "#205A88"}
              strokeWidth={isTen ? "0.18" : "0.1"}
              strokeOpacity={isTen ? "0.6" : "0.35"}
            />
            {/* Top Metric Ruler Tick Marks */}
            <line
              x1={x}
              x2={x}
              y1="-0.8"
              y2="0"
              stroke="#38BDF8"
              strokeWidth={isTen ? "0.18" : "0.1"}
              strokeOpacity="0.75"
            />
            {isTen && (
              <text
                x={x}
                y="-1.2"
                fill="#93C5FD"
                fontSize="0.8"
                fontWeight="700"
                textAnchor="middle"
                fontFamily="'JetBrains Mono', monospace"
              >
                {x}m
              </text>
            )}
          </g>
        );
      })}

      {Array.from({ length: Math.floor(D / 5) + 1 }, (_, i) => {
        const y = i * 5;
        const isTen = i % 2 === 0;
        return (
          <g key={"h" + i}>
            <line
              y1={y}
              y2={y}
              x1="0"
              x2={W}
              stroke={isTen ? "#38BDF8" : "#205A88"}
              strokeWidth={isTen ? "0.18" : "0.1"}
              strokeOpacity={isTen ? "0.6" : "0.35"}
            />
            {/* Left Metric Ruler Tick Marks */}
            <line
              x1="-0.8"
              x2="0"
              y1={y}
              y2={y}
              stroke="#38BDF8"
              strokeWidth={isTen ? "0.18" : "0.1"}
              strokeOpacity="0.75"
            />
            {isTen && (
              <text
                x="-1.2"
                y={y + 0.3}
                fill="#93C5FD"
                fontSize="0.8"
                fontWeight="700"
                textAnchor="end"
                fontFamily="'JetBrains Mono', monospace"
              >
                {y}m
              </text>
            )}
          </g>
        );
      })}

      {/* ── 5. Double Perimeter Concrete Wall Border ── */}
      <rect
        x="-0.35"
        y="-0.35"
        width={W + 0.7}
        height={D + 0.7}
        fill="none"
        stroke="#38BDF8"
        strokeWidth="0.12"
        strokeOpacity="0.5"
      />
      <rect
        x="0"
        y="0"
        width={W}
        height={D}
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="0.45"
      />

      {/* ── 6. Architectural Dimension Lines & Extension Witness Lines ── */}
      {/* Top Dimension: Width */}
      <g opacity="0.9">
        <line x1="0" y1="-0.4" x2="0" y2="-3.2" stroke="#93C5FD" strokeWidth="0.12" strokeDasharray="0.3 0.2" />
        <line x1={W} y1="-0.4" x2={W} y2="-3.2" stroke="#93C5FD" strokeWidth="0.12" strokeDasharray="0.3 0.2" />
        <line x1="0" y1="-2.6" x2={W} y2="-2.6" stroke="#38BDF8" strokeWidth="0.18" />
        {/* Dimension Tick Slashes */}
        <line x1="-0.4" y1="-2.9" x2="0.4" y2="-2.3" stroke="#FFFFFF" strokeWidth="0.25" />
        <line x1={W - 0.4} y1="-2.9" x2={W + 0.4} y2="-2.3" stroke="#FFFFFF" strokeWidth="0.25" />
        <rect x={W / 2 - 6} y="-3.3" width="12" height="1.4" fill="#0A2540" stroke="#38BDF8" strokeWidth="0.12" rx="0.2" />
        <text
          x={W / 2}
          y="-2.3"
          fill="#FFFFFF"
          fontSize="0.85"
          fontWeight="800"
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
          letterSpacing="0.04em"
        >
          ◄─ {W.toFixed(2)} m (WIDTH) ─►
        </text>
      </g>

      {/* Left Dimension: Depth */}
      <g opacity="0.9">
        <line x1="-0.4" y1="0" x2="-3.2" y2="0" stroke="#93C5FD" strokeWidth="0.12" strokeDasharray="0.3 0.2" />
        <line x1="-0.4" y1={D} x2="-3.2" y2={D} stroke="#93C5FD" strokeWidth="0.12" strokeDasharray="0.3 0.2" />
        <line x1="-2.6" y1="0" x2="-2.6" y2={D} stroke="#38BDF8" strokeWidth="0.18" />
        {/* Dimension Tick Slashes */}
        <line x1="-2.9" y1="-0.4" x2="-2.3" y2="0.4" stroke="#FFFFFF" strokeWidth="0.25" />
        <line x1="-2.9" y1={D - 0.4} x2="-2.3" y2={D + 0.4} stroke="#FFFFFF" strokeWidth="0.25" />
        <g transform={`translate(-2.6, ${D / 2}) rotate(-90)`}>
          <rect x="-6" y="-0.7" width="12" height="1.4" fill="#0A2540" stroke="#38BDF8" strokeWidth="0.12" rx="0.2" />
          <text
            x="0"
            y="0.3"
            fill="#FFFFFF"
            fontSize="0.85"
            fontWeight="800"
            textAnchor="middle"
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="0.04em"
          >
            ◄─ {D.toFixed(2)} m (DEPTH) ─►
          </text>
        </g>
      </g>

      {/* ── 7. Traffic Density & Congestion Heatmap Cells (TRAFFIC/HEATMAP mode) ── */}
      {heatmapCells.map((hc, idx) => {
        const col =
          hc.val > 0.7
            ? "#EF4444"
            : hc.val > 0.4
            ? "#F59E0B"
            : "#38BDF8";
        return (
          <rect
            key={"hm-" + idx}
            x={hc.x}
            y={hc.y}
            width={cellSize}
            height={cellSize}
            fill={col}
            fillOpacity={0.25 + hc.val * 0.4}
            stroke={col}
            strokeWidth="0.06"
          />
        );
      })}

      {/* ── 8. Functional Operational Zones (Architectural Cyan Blueprint Styling) ── */}
      {Object.values(zones).map((z) => {
        const [minX, minZ, maxX, maxZ] = z.bounds;
        const w = maxX - minX;
        const h = maxZ - minZ;
        return (
          <g key={z.id}>
            {/* Zone Fill with blueprint tint */}
            <rect
              x={minX}
              y={minZ}
              width={w}
              height={h}
              fill={z.color}
              fillOpacity="0.08"
              stroke="#38BDF8"
              strokeWidth="0.25"
              strokeDasharray="1.2 0.8"
            />

            {/* Corner Architectural Bracket Marks */}
            <path
              d={`M ${minX + 0.8} ${minZ} L ${minX} ${minZ} L ${minX} ${minZ + 0.8}`}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="0.3"
            />
            <path
              d={`M ${maxX - 0.8} ${minZ} L ${maxX} ${minZ} L ${maxX} ${minZ + 0.8}`}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="0.3"
            />
            <path
              d={`M ${minX + 0.8} ${maxZ} L ${minX} ${maxZ} L ${minX} ${maxZ - 0.8}`}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="0.3"
            />
            <path
              d={`M ${maxX - 0.8} ${maxZ} L ${maxX} ${maxZ} L ${maxX} ${maxZ - 0.8}`}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="0.3"
            />

            {/* Zone Title Header Tag */}
            <rect
              x={minX + 0.4}
              y={minZ + 0.4}
              width={Math.min(w - 0.8, 14)}
              height="1.8"
              fill="rgba(10, 37, 64, 0.9)"
              stroke="#38BDF8"
              strokeWidth="0.12"
              rx="0.2"
            />
            <text
              x={minX + 0.8}
              y={minZ + 1.6}
              fill="#38BDF8"
              fontSize="0.95"
              fontWeight="800"
              fontFamily="'JetBrains Mono', monospace"
              letterSpacing="0.05em"
            >
              [ {z.name.toUpperCase()} ]
            </text>
          </g>
        );
      })}

      {/* ── 9. Storage Racks (4-Tier Blueprint CAD Hatching) ── */}
      {rackBlocks.map((r) => {
        const rx = r.coords[0] - 0.75;
        const ry = r.coords[1] - 0.4;
        const rw = 1.5;
        const rh = 0.8;
        return (
          <g key={r.id}>
            {/* Base Rack Bay footprint */}
            <rect
              x={rx}
              y={ry}
              width={rw}
              height={rh}
              fill="#0F2B48"
              stroke="#FFFFFF"
              strokeWidth="0.18"
              rx="0.1"
            />
            {/* 4 Shelf Tiers Blueprint Division Lines */}
            <line x1={rx} y1={ry + rh * 0.25} x2={rx + rw} y2={ry + rh * 0.25} stroke="#38BDF8" strokeWidth="0.06" />
            <line x1={rx} y1={ry + rh * 0.50} x2={rx + rw} y2={ry + rh * 0.50} stroke="#38BDF8" strokeWidth="0.06" />
            <line x1={rx} y1={ry + rh * 0.75} x2={rx + rw} y2={ry + rh * 0.75} stroke="#38BDF8" strokeWidth="0.06" />
            {/* Center Structural Upright */}
            <line x1={rx + rw / 2} y1={ry} x2={rx + rw / 2} y2={ry + rh} stroke="#93C5FD" strokeWidth="0.08" strokeDasharray="0.15 0.1" />
          </g>
        );
      })}

      {/* ── 10. Workstations & Inbound Bays ── */}
      {stations.map((s) => {
        const sx = s.coords[0] - 1.2;
        const sy = s.coords[1] - 0.6;
        const isDock = s.type === "INBOUND_DOCK";
        const themeCol = isDock ? "#8B5CF6" : "#F59E0B";

        return (
          <g key={s.id}>
            <rect
              x={sx}
              y={sy}
              width={2.4}
              height={1.2}
              fill="#0F2742"
              stroke={themeCol}
              strokeWidth="0.25"
              rx="0.2"
            />
            {/* Desk Surface & Terminal Glyphs */}
            <rect x={sx + 0.3} y={sy + 0.2} width="0.6" height="0.4" fill="#38BDF8" fillOpacity="0.4" stroke="#38BDF8" strokeWidth="0.06" />
            <text
              x={s.coords[0]}
              y={s.coords[1] + 0.35}
              fill="#FDE68A"
              fontSize="0.8"
              fontWeight="800"
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
            >
              {s.name}
            </text>
          </g>
        );
      })}

      {/* ── 11. Conveyor Lines (Dual Rails & Roller Hatch) ── */}
      {conveyors.map((c) => (
        <g key={c.id}>
          {/* Main conveyor band */}
          <line
            x1={c.startCoords[0]}
            y1={c.startCoords[1]}
            x2={c.endCoords[0]}
            y2={c.endCoords[1]}
            stroke="#0284C7"
            strokeWidth="0.85"
            strokeDasharray="0.3 0.15"
          />
          {/* Guide rails */}
          <line
            x1={c.startCoords[0]}
            y1={c.startCoords[1]}
            x2={c.endCoords[0]}
            y2={c.endCoords[1]}
            stroke="#FFFFFF"
            strokeWidth="0.95"
            strokeDasharray="1.2 0.4"
            strokeOpacity="0.75"
          />
        </g>
      ))}

      {/* ── 12. EV Charging Docks (Blueprint Lightning Hex Nodes) ── */}
      {Object.values(chargingDocks).map((d) => (
        <g key={d.id}>
          <circle
            cx={d.coords[0]}
            cy={d.coords[1]}
            r="0.85"
            fill="#064E3B"
            stroke="#34D399"
            strokeWidth="0.22"
          />
          <circle
            cx={d.coords[0]}
            cy={d.coords[1]}
            r="0.4"
            fill="none"
            stroke="#A7F3D0"
            strokeWidth="0.08"
            strokeDasharray="0.2 0.15"
          />
          <text
            x={d.coords[0]}
            y={d.coords[1] + 0.3}
            fill="#34D399"
            fontSize="0.75"
            fontWeight="900"
            textAnchor="middle"
            fontFamily="'Inter', sans-serif"
          >
            ⚡
          </text>
        </g>
      ))}

      {/* ── 13. Dynamic Human Workers (High-Vis Safety Crosshairs) ── */}
      {people &&
        Object.values(people).map((p) => (
          <g key={p.id}>
            {/* Safety proximity bubble */}
            <circle
              cx={p.position[0]}
              cy={p.position[2]}
              r="1.2"
              fill="rgba(249, 115, 22, 0.15)"
              stroke="#F97316"
              strokeWidth="0.1"
              strokeDasharray="0.3 0.2"
            />
            {/* Worker Pin */}
            <circle
              cx={p.position[0]}
              cy={p.position[2]}
              r="0.45"
              fill="#EA580C"
              stroke="#FFFFFF"
              strokeWidth="0.18"
            />
            <text
              x={p.position[0]}
              y={p.position[2] - 0.8}
              fill="#FFEDD5"
              fontSize="0.8"
              fontWeight="800"
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
            >
              {p.name.split(" ")[0]}
            </text>
          </g>
        ))}

      {/* ── 14. Active Robot Navigation Routes (Laser Blueprint Lines) ── */}
      {botList.map((bot) => {
        if (!bot.path || bot.path.length <= 1) return null;
        const isSel = bot.id === selectedBotId;
        const pts = bot.path
          .slice(Math.max(0, bot.pathIndex - 1))
          .map((c) => `${c[0] * cellSize + cellSize / 2},${c[1] * cellSize + cellSize / 2}`)
          .join(" ");

        return (
          <polyline
            key={"path-" + bot.id}
            points={pts}
            fill="none"
            stroke={isSel ? "#00F0FF" : "#F8CB46"}
            strokeWidth={isSel ? "0.45" : "0.22"}
            strokeDasharray="0.5 0.25"
            opacity={isSel ? "1" : "0.75"}
            filter={isSel ? "url(#bpCyanGlow)" : undefined}
          />
        );
      })}

      {/* ── 15. Autonomous BotUnits (Blueprint Circular Nodes + Heading) ── */}
      {botList.map((bot) => {
        const isSel = bot.id === selectedBotId;
        const statusCol =
          bot.status === "ACTIVE"
            ? "#00F0FF"
            : bot.status === "CHARGING"
            ? "#3B82F6"
            : bot.status === "ERROR"
            ? "#EF4444"
            : "#F59E0B";

        const rad = bot.headingRad || 0;
        const tipX = bot.position[0] + Math.cos(rad) * 1.0;
        const tipY = bot.position[2] + Math.sin(rad) * 1.0;

        return (
          <g
            key={bot.id}
            onClick={(e) => {
              e.stopPropagation();
              selectBot(bot.id);
            }}
            style={{ cursor: "pointer" }}
          >
            {/* Selected Bot LiDAR Radar Range Ring */}
            {isSel && (
              <>
                <circle
                  cx={bot.position[0]}
                  cy={bot.position[2]}
                  r="3.2"
                  fill="rgba(56, 189, 248, 0.08)"
                  stroke="#38BDF8"
                  strokeWidth="0.12"
                  strokeDasharray="0.4 0.3"
                />
                <circle
                  cx={bot.position[0]}
                  cy={bot.position[2]}
                  r="1.35"
                  fill="none"
                  stroke="#00F0FF"
                  strokeWidth="0.28"
                  strokeDasharray="0.5 0.25"
                />
              </>
            )}

            {/* Direction Heading Vector Pointer */}
            <line
              x1={bot.position[0]}
              y1={bot.position[2]}
              x2={tipX}
              y2={tipY}
              stroke="#FFFFFF"
              strokeWidth="0.25"
            />
            <circle cx={tipX} cy={tipY} r="0.12" fill={statusCol} />

            {/* Robot Chassis Blueprint Circle */}
            <circle
              cx={bot.position[0]}
              cy={bot.position[2]}
              r="0.58"
              fill={statusCol}
              stroke="#FFFFFF"
              strokeWidth="0.18"
            />

            {/* Bot ID Architectural Label */}
            <text
              x={bot.position[0]}
              y={bot.position[2] + 1.3}
              fill={isSel ? "#00F0FF" : "#FFFFFF"}
              fontSize="0.8"
              fontWeight={isSel ? "900" : "700"}
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
            >
              {bot.id}
            </text>
          </g>
        );
      })}

      {/* ── 16. Architectural Compass & North Arrow (Top-Right) ── */}
      <g transform={`translate(${W - 2.5}, -2.6)`} opacity="0.95">
        <circle cx="0" cy="0" r="1.4" fill="#0A2540" stroke="#38BDF8" strokeWidth="0.15" />
        <line x1="0" y1="1.1" x2="0" y2="-1.1" stroke="#38BDF8" strokeWidth="0.12" />
        <line x1="-1.1" y1="0" x2="1.1" y2="0" stroke="#38BDF8" strokeWidth="0.12" />
        <polygon points="0,-1.2 0.35,-0.2 -0.35,-0.2" fill="#FFFFFF" />
        <text
          x="0"
          y="-1.5"
          fill="#FFFFFF"
          fontSize="0.8"
          fontWeight="900"
          textAnchor="middle"
          fontFamily="'JetBrains Mono', monospace"
        >
          N
        </text>
      </g>

      {/* ── 17. Architectural Title Block Stamp (Bottom-Right Corner) ── */}
      {W >= 18 && D >= 14 && (() => {
        const stampW = Math.min(25, W - 2);
        const stampH = 5;
        const stampX = W - stampW - 0.5;
        const stampY = D - stampH - 0.5;
        const colDivX = Math.max(12, stampW - 8.5);

        return (
          <g transform={`translate(${stampX}, ${stampY})`} opacity="0.95">
            {/* Outer Title Box */}
            <rect
              x="0"
              y="0"
              width={stampW}
              height={stampH}
              fill="#082138"
              stroke="#38BDF8"
              strokeWidth="0.25"
              rx="0.2"
            />
            {/* Inner horizontal separator */}
            <line x1="0" y1="1.7" x2={stampW} y2="1.7" stroke="#38BDF8" strokeWidth="0.12" />
            <line x1={colDivX} y1="0" x2={colDivX} y2={stampH} stroke="#38BDF8" strokeWidth="0.12" />

            {/* Project Title */}
            <text
              x="0.8"
              y="1.15"
              fill="#FFFFFF"
              fontSize={stampW < 22 ? "0.6" : "0.75"}
              fontWeight="900"
              fontFamily="'Inter', sans-serif"
              letterSpacing="0.04em"
            >
              {stampW < 22 ? "NEXUSTWIN · CAD BLUEPRINT" : "NEXUSTWIN · 2D ARCHITECTURAL CAD BLUEPRINT"}
            </text>

            {/* Scale & Rev */}
            <text
              x={colDivX + 0.6}
              y="1.15"
              fill="#38BDF8"
              fontSize="0.65"
              fontWeight="800"
              fontFamily="'JetBrains Mono', monospace"
            >
              REV C · 1:100
            </text>

            {/* Facility Footprint Metadata */}
            <text
              x="0.8"
              y="2.8"
              fill="#93C5FD"
              fontSize={stampW < 22 ? "0.52" : "0.6"}
              fontFamily="'JetBrains Mono', monospace"
            >
              FOOTPRINT: {W}m × {D}m ({(W * D).toLocaleString()} m²) · {rackBlocks.length} Racks
            </text>
            <text
              x="0.8"
              y="4.1"
              fill="#93C5FD"
              fontSize={stampW < 22 ? "0.52" : "0.6"}
              fontFamily="'JetBrains Mono', monospace"
            >
              FLEET: {totalBots} AMRs · ACS AIR-TRAFFIC
            </text>

            {/* Mode Badge */}
            <rect
              x={colDivX + 0.6}
              y="2.2"
              width={stampW - colDivX - 1.2}
              height="2.2"
              fill="#0A2540"
              stroke="#34D399"
              strokeWidth="0.1"
              rx="0.2"
            />
            <text
              x={colDivX + (stampW - colDivX) / 2}
              y="3.6"
              fill="#34D399"
              fontSize={stampW < 22 ? "0.5" : "0.65"}
              fontWeight="800"
              textAnchor="middle"
              fontFamily="'JetBrains Mono', monospace"
            >
              {mode === "MAP" ? "CAD BLUEPRINT" : mode === "TRAFFIC" ? "TRAFFIC DENSITY" : "HEATMAP VIEW"}
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

export default MapView2D;

