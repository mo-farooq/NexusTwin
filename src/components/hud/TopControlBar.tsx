/**
 * NexusTwin Top Control Bar HUD
 *
 * Glassmorphism perimeter control header featuring:
 * - NexusTwin brand mark with signature #F8CB46 badge
 * - Global facility entity search bar (BotUnits, Racks, Stations)
 * - Layout preset switcher (Dark Store 3,000 sq ft, 3PL Regional Hub, MSME Center)
 * - Deterministic simulation speed controls (Pause, 1x, 2x, 5x)
 * - Indian Festive Surge injection trigger
 */

import React, { useState } from "react";
import { useTwinStore } from "../../store/useTwinStore";

export function TopControlBar() {
  const isRunning = useTwinStore((s) => s.isRunning);
  const simulationSpeed = useTwinStore((s) => s.simulationSpeed);
  const layoutPreset = useTwinStore((s) => s.layoutPreset);
  const heatmapMode = useTwinStore((s) => s.heatmapMode);

  const startSimulation = useTwinStore((s) => s.startSimulation);
  const pauseSimulation = useTwinStore((s) => s.pauseSimulation);
  const setSimulationSpeed = useTwinStore((s) => s.setSimulationSpeed);
  const setLayoutPreset = useTwinStore((s) => s.setLayoutPreset);
  const toggleHeatmapMode = useTwinStore((s) => s.toggleHeatmapMode);
  const injectFestiveSurge = useTwinStore((s) => s.injectFestiveSurge);

  // Decision Sandbox & Chaos Triggers
  const isObstaclePlacementActive = useTwinStore((s) => s.isObstaclePlacementActive);
  const toggleObstaclePlacementMode = useTwinStore((s) => s.toggleObstaclePlacementMode);
  const customObstacles = useTwinStore((s) => s.customObstacles);
  const isFestiveSurgeActive = useTwinStore((s) => s.isFestiveSurgeActive);
  const breakdownBot = useTwinStore((s) => s.breakdownBot);
  const openSandboxModal = useTwinStore((s) => s.openSandboxModal);

  const botUnits = useTwinStore((s) => s.botUnits);
  const locations = useTwinStore((s) => s.locations);
  const selectBot = useTwinStore((s) => s.selectBot);
  const selectStation = useTwinStore((s) => s.selectStation);
  const selectRack = useTwinStore((s) => s.selectRack);

  const [searchQuery, setSearchQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim().toUpperCase();
    if (!query) return;

    // Check bot match
    const matchedBot = Object.values(botUnits).find((b) => b.id.toUpperCase().includes(query));
    if (matchedBot) {
      selectBot(matchedBot.id);
      return;
    }

    // Check location/station match
    const matchedLoc = Object.values(locations).find((l) =>
      l.id.toUpperCase().includes(query) || l.name.toUpperCase().includes(query)
    );
    if (matchedLoc) {
      if (matchedLoc.type === "SHELF") {
        selectRack(matchedLoc.id);
      } else {
        selectStation(matchedLoc.id);
      }
    }
  };

  return (
    <header
      style={{
        position: "absolute",
        top: "16px",
        left: "16px",
        right: "16px",
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        pointerEvents: "auto",
      }}
    >
      {/* Brand & Badge Card */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "8px 16px",
          borderRadius: "12px",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(226, 232, 240, 0.9)",
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              fontWeight: 900,
              fontSize: "16px",
              letterSpacing: "-0.03em",
              color: "#0F172A",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            NEXUS<span style={{ color: "#3B82F6" }}>TWIN</span>
          </span>
          <span
            style={{
              background: "#F8CB46",
              color: "#1E293B",
              fontSize: "10px",
              fontWeight: 800,
              padding: "2px 7px",
              borderRadius: "6px",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            3D TWIN
          </span>
        </div>
      </div>

      {/* Global Search Bar */}
      <form
        onSubmit={handleSearch}
        style={{
          flex: "1",
          maxWidth: "340px",
          display: "flex",
          alignItems: "center",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(226, 232, 240, 0.9)",
          borderRadius: "12px",
          padding: "4px 12px",
          boxShadow: "0 8px 20px -4px rgba(15, 23, 42, 0.06)",
        }}
      >
        <span style={{ color: "#94A3B8", marginRight: "8px", fontSize: "14px" }}>🔍</span>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search BOT-01, SHELF-A, PACK-01…"
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            width: "100%",
            fontSize: "12px",
            color: "#1E293B",
            fontWeight: 500,
            fontFamily: "'Inter', sans-serif",
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94A3B8",
              fontSize: "12px",
            }}
          >
            ✕
          </button>
        )}
      </form>

      {/* Controls & Preset Selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "6px 12px",
          borderRadius: "12px",
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(226, 232, 240, 0.9)",
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.08)",
        }}
      >
        {/* Layout Preset Switcher */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748B" }}>LAYOUT:</span>
          <select
            value={layoutPreset}
            onChange={(e) =>
              setLayoutPreset(e.target.value as "DARK_STORE" | "REGIONAL_HUB" | "MSME_CENTER")
            }
            style={{
              fontSize: "12px",
              fontWeight: 600,
              padding: "5px 8px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              color: "#0F172A",
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="DARK_STORE">Dark Store 3,000 sq ft (Quick-Commerce)</option>
            <option value="REGIONAL_HUB">3PL Regional Hub (Sorting Center)</option>
            <option value="MSME_CENTER">MSME Fulfillment Center</option>
          </select>
        </div>

        {/* Volumetric Heatmap Toggle */}
        <button
          onClick={toggleHeatmapMode}
          title="Toggle Volumetric Heatmap Glow on Racks"
          style={{
            padding: "5px 10px",
            borderRadius: "8px",
            border: heatmapMode ? "1px solid #F59E0B" : "1px solid #E2E8F0",
            background: heatmapMode ? "rgba(245, 158, 11, 0.15)" : "#F8FAFC",
            color: heatmapMode ? "#B45309" : "#64748B",
            fontWeight: 700,
            fontSize: "11px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            transition: "all 0.16s ease",
          }}
        >
          <span>🔥</span> Heatmap
        </button>

        <div style={{ width: "1px", height: "18px", background: "#E2E8F0" }} />

        {/* Play/Pause Button */}
        <button
          onClick={() => (isRunning ? pauseSimulation() : startSimulation())}
          style={{
            padding: "5px 12px",
            borderRadius: "8px",
            border: "none",
            background: isRunning ? "#EF4444" : "#10B981",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: "11px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            boxShadow: isRunning
              ? "0 4px 12px rgba(239, 68, 68, 0.25)"
              : "0 4px 12px rgba(16, 185, 129, 0.25)",
          }}
        >
          <span>{isRunning ? "⏸" : "▶"}</span>
          <span>{isRunning ? "Pause" : "Simulate"}</span>
        </button>

        {/* Speed Toggles */}
        <div style={{ display: "flex", gap: "2px", background: "#F1F5F9", padding: "2px", borderRadius: "8px" }}>
          {([1, 2, 5] as const).map((spd) => (
            <button
              key={spd}
              onClick={() => setSimulationSpeed(spd)}
              style={{
                border: "none",
                background: simulationSpeed === spd ? "#0F172A" : "transparent",
                color: simulationSpeed === spd ? "#FFFFFF" : "#64748B",
                fontWeight: 700,
                fontSize: "11px",
                padding: "3px 8px",
                borderRadius: "6px",
                cursor: "pointer",
              }}
            >
              {spd}x
            </button>
          ))}
        </div>

        <div style={{ width: "1px", height: "18px", background: "#E2E8F0" }} />

        {/* Quick Trigger 1: Festive Surge (3x Load) */}
        <button
          onClick={() => injectFestiveSurge(30, 3)}
          title="Inject festive peak demand (+30 flash orders, 3x arrival rate)"
          style={{
            padding: "5px 11px",
            borderRadius: "8px",
            border: isFestiveSurgeActive ? "1px solid #DC2626" : "1px solid #FCD34D",
            background: isFestiveSurgeActive ? "#FEE2E2" : "#FEF3C7",
            color: isFestiveSurgeActive ? "#B91C1C" : "#92400E",
            fontWeight: 800,
            fontSize: "11px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            boxShadow: isFestiveSurgeActive
              ? "0 0 10px rgba(239, 68, 68, 0.4)"
              : "0 2px 6px rgba(245, 158, 11, 0.15)",
            transition: "all 0.18s ease",
          }}
        >
          <span>🔥</span>
          <span>{isFestiveSurgeActive ? "Surge (3x Active)" : "Festive Surge"}</span>
        </button>

        {/* Quick Trigger 2: Block Aisle Path (Click Floor) */}
        <button
          onClick={() => toggleObstaclePlacementMode()}
          title="Click floor tiles to drop 3D hazard barricades and force live A* rerouting"
          style={{
            padding: "5px 11px",
            borderRadius: "8px",
            border: isObstaclePlacementActive ? "1px solid #EA580C" : "1px solid #E2E8F0",
            background: isObstaclePlacementActive ? "#FFEDD5" : "#FFFFFF",
            color: isObstaclePlacementActive ? "#C2410C" : "#475569",
            fontWeight: 800,
            fontSize: "11px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            boxShadow: isObstaclePlacementActive
              ? "0 0 10px rgba(234, 88, 12, 0.35)"
              : "0 2px 5px rgba(0,0,0,0.03)",
            transition: "all 0.18s ease",
          }}
        >
          <span>🚧</span>
          <span>
            {isObstaclePlacementActive
              ? "Click Floor to Drop"
              : customObstacles.length > 0
              ? `Block Path (${customObstacles.length})`
              : "Block Path"}
          </span>
        </button>

        {/* Quick Trigger 3: Force Bot Breakdown */}
        <button
          onClick={() => breakdownBot()}
          title="Force an instant mechanical breakdown on an active bot"
          style={{
            padding: "5px 10px",
            borderRadius: "8px",
            border: "1px solid #FECACA",
            background: "#FFF1F2",
            color: "#BE123C",
            fontWeight: 700,
            fontSize: "11px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            transition: "all 0.18s ease",
          }}
        >
          <span>🔋</span>
          <span>Breakdown</span>
        </button>

        {/* Master Action: Decision Sandbox Modal */}
        <button
          onClick={() => openSandboxModal()}
          title="Open NexusTwin Decision Sandbox: Vendor Comparison, Chaos Testing & Financial ROI"
          style={{
            padding: "6px 14px",
            borderRadius: "9px",
            border: "1px solid #CA8A04",
            background: "linear-gradient(135deg, #FACC15 0%, #F8CB46 100%)",
            color: "#0F172A",
            fontWeight: 900,
            fontSize: "12px",
            letterSpacing: "-0.01em",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 4px 14px rgba(234, 179, 8, 0.35)",
            transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <span style={{ fontSize: "13px" }}>⚡</span>
          <span>Decision Sandbox</span>
        </button>
      </div>
    </header>
  );
}

export default TopControlBar;
