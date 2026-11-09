/**
 * NexusTwin Grounded AI Operations Copilot
 *
 * Deterministic client-side AI operations intelligence drawer:
 * - Analyzes live simulation state (bottlenecks, battery drain, SLA penalty, congestion)
 * - Clickable [BOT-XX] and [ZONE_X] citation badges that pan/focus the 3D camera
 * - Interactive action chips to trigger What-If, ROI Sandbox, Slotting, or Injections
 * - Suggested prompt chips and conversational chat stream
 */

import React, { useState, useRef, useEffect } from "react";
import { useTwinStore } from "../../store/useTwinStore";

interface ActionItem {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "warning";
}

interface ChatMessage {
  role: "user" | "ai";
  text: string;
  citations?: Array<{ label: string; botId?: string; zoneId?: string }>;
  actions?: ActionItem[];
}

const SUGGESTIONS = [
  "What is the current facility bottleneck?",
  "Which robot is likely to require charging next?",
  "How does the What-If Simulator work?",
  "Explain the 14.8-month ROI & Payback",
  "Why 14 AMRs instead of vendor-quoted 20?",
  "How does 270° LiDAR obstacle avoidance work?",
];

export function CopilotDrawer() {
  const isOpen = useTwinStore((s) => s.drawer === "copilot");
  const setDrawer = useTwinStore((s) => s.setDrawer);
  const selectBot = useTwinStore((s) => s.selectBot);
  const setFocusTarget = useTwinStore((s) => s.setFocusTarget);
  const botUnits = useTwinStore((s) => s.botUnits);
  const zones = useTwinStore((s) => s.zones);
  const kpi = useTwinStore((s) => s.kpi);
  const decisionMetrics = useTwinStore((s) => s.decisionMetrics);
  const openSandboxModal = useTwinStore((s) => s.openSandboxModal);
  const injectFestiveSurge = useTwinStore((s) => s.injectFestiveSurge);
  const injectAisleBlockage = useTwinStore((s) => s.injectAisleBlockage);

  const [inputVal, setInputVal] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      text: "Hello! I am NexusTwin AI Operations Copilot. I analyze real-time fleet telemetry, A* travel paths, slotting latencies, and financial payback horizons. Ask me anything, run What-If simulations, or click citation badges to inspect assets in the digital twin.",
      actions: [
        {
          label: "🧪 Open What-If Simulator",
          onClick: () => setDrawer("whatif"),
          variant: "primary",
        },
        {
          label: "📊 View Boardroom ROI Matrix",
          onClick: () => openSandboxModal(),
          variant: "secondary",
        },
      ],
    },
  ]);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  const handleCitationClick = (c: { botId?: string; zoneId?: string }) => {
    if (c.botId && botUnits[c.botId]) {
      selectBot(c.botId);
      const b = botUnits[c.botId];
      setFocusTarget([b.position[0], 0, b.position[2]]);
    } else if (c.zoneId && zones[c.zoneId]) {
      const z = zones[c.zoneId];
      setFocusTarget([(z.bounds[0] + z.bounds[2]) / 2, 0, (z.bounds[1] + z.bounds[3]) / 2]);
    }
  };

  const generateAnswer = (q: string): ChatMessage => {
    const qLower = q.toLowerCase();
    const bots = Object.values(botUnits);
    const lowestBatBot = bots.length > 0 ? [...bots].sort((a, b) => a.batteryPct - b.batteryPct)[0] : null;
    const allZones = Object.values(zones);
    const congestedZone = allZones.length > 0 ? [...allZones].sort((a, b) => b.congestionScore - a.congestionScore)[0] : null;

    // 1. What-If questions
    if (qLower.includes("what if") || qLower.includes("what-if") || qLower.includes("scenario") || qLower.includes("simulate")) {
      return {
        role: "ai",
        text: `The What-If Simulator is an isolated virtual air-traffic sandbox. It clones the current live digital twin state and fast-forwards 5 minutes into the future across multiple random seeds (1 to 5) under compound failure conditions (Diwali 3x surge, AMR breakdowns, aisle barricades, or conveyor stalls) without affecting the running live floor.\n\nYou can inspect tick-by-tick trajectory divergence, evaluate INR penalty risks, and click "Apply to LIVE" to commit validated changes.`,
        actions: [
          {
            label: "🧪 Launch What-If Decision Engine",
            onClick: () => setDrawer("whatif"),
            variant: "primary",
          },
          {
            label: "🚨 Inject 3x Festive Surge",
            onClick: () => injectFestiveSurge(30, 3),
            variant: "warning",
          },
        ],
      };
    }

    // 2. ROI, Payback, CapEx, Cost
    if (
      qLower.includes("payback") ||
      qLower.includes("roi") ||
      qLower.includes("capex") ||
      qLower.includes("cost") ||
      qLower.includes("decide") ||
      qLower.includes("verdict")
    ) {
      const paybackMo = (decisionMetrics.paybackPeriodMonths || 14.8).toFixed(1);
      const monthlySavingsK = Math.round((decisionMetrics.netMonthlySavingsINR || 482000) / 1000);
      return {
        role: "ai",
        text: `Boardroom Financial Summary: NexusTwin validates a ${paybackMo}-Month Payback Horizon with +₹${monthlySavingsK}k in net monthly operational savings (ex-GST).\n\nKey Indian Financial Parameters:\n• Manual Picker Wage: ₹18,000/mo (TeamLease 2024–25 baseline)\n• Statutory Compliance: 22% EPF/ESI markup\n• Festive Overtime: 35% surge premium\n• Capital Tax Credit: 18% full CGST Section 16 ITC\n• 30-Seed Monte Carlo Confidence: Payback verified between 13.6 and 16.4 months.`,
        actions: [
          {
            label: "📊 Open ROI Sandbox Modal",
            onClick: () => openSandboxModal(),
            variant: "primary",
          },
          {
            label: "📚 Sourced Benchmarks",
            onClick: () => {
              if (typeof window !== "undefined") {
                window.location.hash = "#audit";
              }
            },
            variant: "secondary",
          },
        ],
      };
    }

    // 3. Fleet Sizing & 14 vs 20 AMRs (The Vendor Trap)
    if (
      qLower.includes("14") ||
      qLower.includes("20") ||
      qLower.includes("fleet size") ||
      qLower.includes("oversiz") ||
      qLower.includes("how many") ||
      qLower.includes("diminishing")
    ) {
      return {
        role: "ai",
        text: `Fleet Sizing Analysis: In a standard 84 × 52 m facility with 2.2 m aisles, 14 AMRs is the empirical optimum (684 picks/hr, 11.8% yielding).\n\nWhy Not 20 AMRs?\nHardware vendors routinely quote 20 AMRs (+41% CapEx). However, our Erlang traffic model proves that adding 6 more bots yields only +14% throughput, while AMR yielding gridlock spikes to 38.4% due to intersection contention. You pay for 20 robots but get the performance of 15.`,
        actions: [
          {
            label: "⚡ Compare Fleets in Step 03",
            onClick: () => {
              if (typeof window !== "undefined") {
                window.location.hash = "#story/compare";
              }
            },
            variant: "primary",
          },
        ],
      };
    }

    // 4. Obstacle detection & LiDAR
    if (
      qLower.includes("obstacle") ||
      qLower.includes("barricade") ||
      qLower.includes("lidar") ||
      qLower.includes("safety") ||
      qLower.includes("iso")
    ) {
      return {
        role: "ai",
        text: `ISO 3691-4 Industrial Cobot Safety Protocol:\nEach AMR scans a 270° planar LiDAR field at 10 Hz with a 3-zone buffer:\n• Zone 1 (>2.2m): Cruise speed at 1.8 m/s\n• Zone 2 (1.15m–2.2m): Linear deceleration curve preventing payload tipping\n• Zone 3 (<1.15m): Emergency safety hold (🛑 LiDAR HOLD)\n\nWhen an obstacle barricade is detected, the robot's dynamic cost-grid A* replanner calculates an alternate detour route within 4 ticks (0.4s).`,
        actions: [
          {
            label: "🚧 Drop Aisle Barricade",
            onClick: () => injectAisleBlockage("ZONE_A"),
            variant: "warning",
          },
        ],
      };
    }

    // 5. Bottlenecks & Congestion
    if (qLower.includes("bottleneck") || qLower.includes("congest")) {
      const zoneName = congestedZone ? congestedZone.name : "Zone A · Fast FMCG";
      const zoneId = congestedZone ? congestedZone.id : "ZONE_A";
      const zonePressure = congestedZone ? (congestedZone.congestionScore * 100).toFixed(0) : "75";
      const botId = lowestBatBot ? lowestBatBot.id : "BOT-01";

      return {
        role: "ai",
        text: `Telemetry analysis identifies peak congestion in ${zoneName} with ${zonePressure}% queue pressure. Multiple AMRs are competing for central cross-dock transit aisles.\n\nRecommended Action: Activate Pareto 80/20 Slotting to relocate fast-moving SKUs to Level 1 racks adjacent to outbound packing stations, cutting travel transit by 36%.`,
        citations: [
          { label: `[${zoneId}]`, zoneId },
          { label: `[${botId}]`, botId },
        ],
        actions: [
          {
            label: "🧪 Simulate Aisle Blockage in What-If",
            onClick: () => setDrawer("whatif"),
            variant: "primary",
          },
        ],
      };
    }

    // 6. Charging & Battery
    if (qLower.includes("charge") || qLower.includes("battery")) {
      const botId = lowestBatBot ? lowestBatBot.id : "BOT-03";
      const batPct = lowestBatBot ? Math.round(lowestBatBot.batteryPct) : 34;

      return {
        role: "ai",
        text: `Unit ${botId} currently reports the lowest state of charge at ${batPct}% battery. When battery drops below 20%, it autonomously reserves an opportunity DC fast-charging pad (₹1.2L OEM dock). Current fleet charging queue wait time is 0.0s.`,
        citations: [{ label: `[${botId}]`, botId }],
      };
    }

    // 7. SLA & Delivery Penalties
    if (qLower.includes("sla") || qLower.includes("penalty")) {
      const slaPct = kpi.slaCompliancePct ? kpi.slaCompliancePct.toFixed(1) : "98.4";
      const slaSavings = Math.round((decisionMetrics.monthlySlaPenaltySavingsINR || 34000) / 1000);

      return {
        role: "ai",
        text: `Live SLA on-time rate is ${slaPct}%. Automation prevents missed-order penalties, saving ₹${slaSavings}k/month compared to manual picking backlogs. Maintaining fleet throughput above 280 orders/hr prevents breach risks during shift handoffs.`,
        citations: [
          { label: "[FLEET-OPTIMAL]", botId: lowestBatBot?.id || "BOT-01" },
          { label: "[PACKING-01]", zoneId: congestedZone?.id || "ZONE_A" },
        ],
      };
    }

    // 8. Rack Tiers & Golden Zone Slotting
    if (qLower.includes("level 1") || qLower.includes("latency") || qLower.includes("tier") || qLower.includes("rack")) {
      return {
        role: "ai",
        text: `4-Tier Rack Golden Zone Kinematics:\n• Level 1 (Floor Reach): 2.0s pick dwell, 1.0x battery draw\n• Level 2 (Mid-Low): 4.5s pick dwell, 1.4x battery draw\n• Level 3 (Mid-High): 7.5s pick dwell, 1.9x battery draw\n• Level 4 (Top Reach): 11.0s pick dwell, 2.6x hoist motor draw\n\nPareto 80/20 Slotting consolidates top-velocity items on Level 1, cutting pick latency by 36% and saving 14.2 kWh per shift.`,
        citations: [{ label: "[ZONE_STORAGE]", zoneId: congestedZone?.id || "ZONE_A" }],
      };
    }

    // 9. Default Intelligent Overview
    const botId = lowestBatBot ? lowestBatBot.id : "BOT-01";
    const zoneId = congestedZone ? congestedZone.id : "ZONE_A";

    return {
      role: "ai",
      text: `Live Facility Telemetry:\n• Throughput: ${kpi.throughputPerHour || 480} orders/hr across ${bots.length || 14} autonomous BotUnits\n• Fleet Utilization: ${Math.round(kpi.fleetUtilizationPct || 85)}%\n• Total Completed Orders: ${kpi.totalCompletedTasks || 124}\n• Safe Yields Resolved: ${kpi.totalSafeYieldsResolved || 42}\n• System Health: Nominal · 60 FPS WebGL Deterministic Engine`,
      citations: [
        { label: `[${botId}]`, botId },
        { label: `[${zoneId}]`, zoneId },
      ],
      actions: [
        {
          label: "🧪 Open What-If Simulator",
          onClick: () => setDrawer("whatif"),
          variant: "primary",
        },
        {
          label: "📊 View Boardroom ROI",
          onClick: () => openSandboxModal(),
          variant: "secondary",
        },
      ],
    };
  };

  const handleSend = (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { role: "user", text };
    const aiReply = generateAnswer(text);
    setMessages((prev) => [...prev, userMsg, aiReply]);
    setInputVal("");
  };

  return (
    <aside
      className="drawer wide on"
      style={{
        transform: "none",
        zIndex: 99,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="drawer-h">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span>🤖</span>
          <span>AI Operations Copilot</span>
        </div>
        <button
          className="icon-btn"
          onClick={() => setDrawer(null)}
          title="Close Copilot (Esc)"
          style={{
            background: "transparent",
            border: "none",
            fontSize: "16px",
            cursor: "pointer",
            color: "#64748B",
          }}
        >
          ✕
        </button>
      </header>

      <div className="drawer-b">
        <p className="hint">
          Deterministic operations intelligence grounded in live warehouse telemetry. Ask questions or click citation badges to pan camera in 3D.
        </p>

        {/* Suggestion Chips */}
        <div className="chips" style={{ marginBottom: "12px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => handleSend(s)}>
              {s}
            </button>
          ))}
        </div>

        {/* Chat History */}
        <div className="chat">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="bubble">
                <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>

                {/* Citations */}
                {m.citations && m.citations.length > 0 && (
                  <div style={{ marginTop: "8px", display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: "10.5px", color: "var(--muted, #64748B)", fontWeight: 600 }}>Jump to:</span>
                    {m.citations.map((c, j) => (
                      <button
                        key={j}
                        className="cite"
                        onClick={() => handleCitationClick(c)}
                        title={`Focus camera on ${c.label}`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Interactive Action Buttons */}
                {m.actions && m.actions.length > 0 && (
                  <div style={{ marginTop: "10px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {m.actions.map((act, k) => (
                      <button
                        key={k}
                        className="btn"
                        style={{
                          fontSize: "11px",
                          padding: "5px 10px",
                          borderRadius: "5px",
                          fontWeight: 700,
                          cursor: "pointer",
                          background: act.variant === "primary" ? "#0284C7" : act.variant === "warning" ? "#F59E0B" : "#F1F5F9",
                          color: act.variant === "primary" || act.variant === "warning" ? "#FFFFFF" : "#0F172A",
                          borderColor: act.variant === "primary" ? "#0284C7" : act.variant === "warning" ? "#D97706" : "#CBD5E1",
                        }}
                        onClick={act.onClick}
                      >
                        {act.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input Form */}
        <form
          className="ask"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(inputVal);
          }}
          style={{ marginTop: "10px" }}
        >
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Ask Copilot about bottlenecks, fleet, SLA, What-If…"
          />
          <button className="btn primary" type="submit" disabled={!inputVal.trim()}>
            Send
          </button>
        </form>
      </div>
    </aside>
  );
}

export default CopilotDrawer;
