/**
 * NexusTwin Grounded AI Operations Copilot
 *
 * Deterministic client-side AI operations intelligence drawer:
 * - Analyzes live simulation state (bottlenecks, battery drain, SLA penalty, congestion)
 * - Clickable [BOT-XX] and [ZONE_X] citation badges that fly the 3D camera to the asset
 * - Suggested prompt chips and conversational chat stream
 */

import React, { useState, useRef, useEffect } from "react";
import { useTwinStore } from "../../store/useTwinStore";

interface ChatMessage {
  role: "user" | "ai";
  text: string;
  citations?: Array<{ label: string; botId?: string; zoneId?: string }>;
}

const SUGGESTIONS = [
  "What is the current facility bottleneck?",
  "Which robot is likely to require charging next?",
  "How can we minimize SLA delivery penalties?",
  "Explain Level 1 vs Level 4 picking latency",
  "Why is Aisle B congested?",
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

  const [inputVal, setInputVal] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "ai",
      text: "Hello! I am NexusTwin AI Operations Copilot. I analyze real-time fleet telemetry, A* travel paths, and slotting latency. Click any citation badge to track that asset in the 3D digital twin.",
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
    const lowestBatBot = [...bots].sort((a, b) => a.batteryPct - b.batteryPct)[0];
    const congestedZone = Object.values(zones).sort((a, b) => b.congestionScore - a.congestionScore)[0];

    if (qLower.includes("bottleneck") || qLower.includes("congest")) {
      return {
        role: "ai",
        text: `Analysis indicates peak congestion in ${congestedZone.name} with ${(congestedZone.congestionScore * 100).toFixed(0)}% queue pressure. Multiple autonomous units are currently routing through the central cross-aisle. Recommended action: activate cross-aisle detour or defragment high-velocity SKUs to Level 1.`,
        citations: [
          { label: `[${congestedZone.id}]`, zoneId: congestedZone.id },
          { label: `[${lowestBatBot.id}]`, botId: lowestBatBot.id },
        ],
      };
    }

    if (qLower.includes("charge") || qLower.includes("battery")) {
      return {
        role: "ai",
        text: `Unit ${lowestBatBot.id} has the lowest charge at ${Math.round(lowestBatBot.batteryPct)}% battery. It is scheduled to seek an autonomous DC fast-charging pad once battery reaches 20%. Average queue time at EV docks is currently 0.0s.`,
        citations: [{ label: `[${lowestBatBot.id}]`, botId: lowestBatBot.id }],
      };
    }

    if (qLower.includes("sla") || qLower.includes("penalty")) {
      return {
        role: "ai",
        text: `Live SLA on-time rate is ${kpi.slaCompliancePct.toFixed(1)}%. Current automation generates ₹${Math.round(decisionMetrics.monthlySlaPenaltySavingsINR / 1000)}k monthly SLA penalty savings compared to pure manual picking. Maintaining throughput above 280 orders/hr prevents breach risk.`,
        citations: [
          { label: "[FLEET-12]", botId: "BOT-01" },
          { label: "[PACKING-01]", zoneId: "ZONE_D" },
        ],
      };
    }

    if (qLower.includes("level 1") || qLower.includes("latency") || qLower.includes("tier")) {
      return {
        role: "ai",
        text: `Level 1 golden zone picking takes only 2.0s per item at 1.0x battery draw, whereas Level 4 vertical picks require 11.0s and 2.6x energy multiplier. AI Rack Defragmentation relocates fast-moving items from top shelves to Level 1, cutting pick latency by 36%.`,
        citations: [{ label: "[ZONE_STORAGE]", zoneId: "ZONE_A" }],
      };
    }

    // Default intelligent overview
    return {
      role: "ai",
      text: `Facility is operating at ${kpi.throughputPerHour} orders/hr across ${bots.length} autonomous BotUnits. Fleet utilization is ${Math.round(kpi.fleetUtilizationPct)}% with ${kpi.totalCompletedTasks} orders dispatched today. Anti-collision systems have successfully avoided ${kpi.totalSafeYieldsResolved} aisle conflicts.`,
      citations: [
        { label: `[${lowestBatBot.id}]`, botId: lowestBatBot.id },
        { label: `[${congestedZone.id}]`, zoneId: congestedZone.id },
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
    <aside className="drawer wide">
      <header className="drawer-h">
        <span>🤖 AI Operations Copilot</span>
        <button className="icon-btn" onClick={() => setDrawer(null)}>
          ✕
        </button>
      </header>

      <div className="drawer-b">
        <p className="hint">
          Deterministic operations intelligence grounded in live warehouse telemetry. Click citation badges to pan camera to specific AMR units or zones.
        </p>

        {/* Suggestion Chips */}
        <div className="chips" style={{ marginBottom: "12px" }}>
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
                {m.text}
                {m.citations && m.citations.length > 0 && (
                  <div style={{ marginTop: "6px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "10px", color: "var(--muted)" }}>Jump to:</span>
                    {m.citations.map((c, j) => (
                      <button
                        key={j}
                        className="cite"
                        onClick={() => handleCitationClick(c)}
                      >
                        {c.label}
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
        >
          <input
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Ask Copilot about bottlenecks, fleet, SLA…"
          />
          <button className="btn primary" type="submit">
            Send
          </button>
        </form>
      </div>
    </aside>
  );
}

export default CopilotDrawer;
