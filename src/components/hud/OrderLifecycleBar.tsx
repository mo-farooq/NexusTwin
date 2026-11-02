/**
 * NexusTwin Order Lifecycle Bar HUD
 *
 * Bottom-left floating progress tracker monitoring the 5-stage fulfillment lifecycle:
 * 1. Order Ingested ➔ 2. Bot Dispatched ➔ 3. Rack Pick (Lvl 1-4) ➔ 4. Transit to Station ➔ 5. Packed & Dispatched
 * Synchronized live to the currently selected BotUnit or the latest priority order.
 */

import React from "react";
import { useTwinStore } from "../../store/useTwinStore";

export function OrderLifecycleBar() {
  const selectedBotId = useTwinStore((s) => s.selectedBotId);
  const botUnits = useTwinStore((s) => s.botUnits);
  const tasks = useTwinStore((s) => s.tasks);
  const locations = useTwinStore((s) => s.locations);

  // Find the relevant task: either from selected bot or the most recent in-progress/pending task
  const activeBot = selectedBotId ? botUnits[selectedBotId] : null;
  const currentTaskId = activeBot?.currentTaskId;

  const currentTask = currentTaskId
    ? tasks[currentTaskId]
    : Object.values(tasks)
        .reverse()
        .find((t) => t.status === "IN_PROGRESS" || t.status === "ASSIGNED" || t.status === "PENDING") ||
      Object.values(tasks).slice(-1)[0];

  if (!currentTask) return null;

  const assignedBot = currentTask.assignedBotId ? botUnits[currentTask.assignedBotId] : null;
  const sourceRack = locations[currentTask.sourceLocId];
  const destStation = locations[currentTask.destLocId];

  // Determine stage (1 to 5)
  let activeStage = 1;
  if (currentTask.status === "COMPLETED") {
    activeStage = 5;
  } else if (assignedBot) {
    if (assignedBot.fsmState === "NAVIGATING_TO_PICKUP") {
      activeStage = 2;
    } else if (assignedBot.fsmState === "PICKING") {
      activeStage = 3;
    } else if (assignedBot.fsmState === "NAVIGATING_TO_DELIVERY") {
      activeStage = 4;
    } else if (assignedBot.fsmState === "DELIVERING") {
      activeStage = 5;
    }
  }

  const tierLevel = currentTask.targetTier || 2;
  const tierLatency = tierLevel === 4 ? "11.0s" : tierLevel === 3 ? "7.5s" : tierLevel === 2 ? "4.5s" : "2.0s";

  const steps = [
    { num: 1, label: "Ingested", sub: "Order Queue" },
    { num: 2, label: "Dispatched", sub: assignedBot?.id || "Assigning AMR" },
    { num: 3, label: `Rack Pick (L${tierLevel})`, sub: `${tierLatency} lift` },
    { num: 4, label: "Transit", sub: destStation?.name?.replace("Packing Station 0", "Pack #") || "To Station" },
    { num: 5, label: "Dispatched", sub: "10-Min SLA" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        bottom: "16px",
        left: "16px",
        zIndex: 20,
        background: "rgba(255, 255, 255, 0.94)",
        backdropFilter: "blur(14px)",
        borderRadius: "16px",
        border: "1px solid rgba(226, 232, 240, 0.9)",
        boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
        padding: "12px 18px",
        width: "440px",
        maxWidth: "calc(100vw - 32px)",
        pointerEvents: "auto",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Header Info */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              background: currentTask.priority === "FLASH_SURGE" ? "#FEF08A" : "#F1F5F9",
              color: currentTask.priority === "FLASH_SURGE" ? "#854D0E" : "#0F172A",
              border: currentTask.priority === "FLASH_SURGE" ? "1px solid #EAB308" : "1px solid #CBD5E1",
              fontSize: "10px",
              fontWeight: 800,
              padding: "2px 7px",
              borderRadius: "6px",
            }}
          >
            {currentTask.priority === "FLASH_SURGE" ? "⚡ VIP ORDER" : "STD ORDER"}
          </span>
          <span style={{ fontSize: "12px", fontWeight: 800, color: "#0F172A" }}>
            {currentTask.id}
          </span>
          <span style={{ fontSize: "11px", color: "#64748B", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            · {currentTask.skuName || sourceRack?.name || "Inventory Item"}
          </span>
        </div>

        <span
          style={{
            fontSize: "10px",
            fontWeight: 800,
            padding: "2px 6px",
            borderRadius: "5px",
            background: activeStage === 5 ? "#DCFCE7" : "#EFF6FF",
            color: activeStage === 5 ? "#166534" : "#2563EB",
          }}
        >
          {activeStage === 5 ? "COMPLETED" : "IN PROGRESS"}
        </span>
      </div>

      {/* 5-Step Horizontal Tracker */}
      <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
        {/* Connecting Progress Bar */}
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "14px",
            right: "14px",
            height: "2px",
            background: "#E2E8F0",
            zIndex: 0,
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${((activeStage - 1) / 4) * 100}%`,
              background: "#0C831F",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* 5 Step Nodes */}
        {steps.map((step) => {
          const isDone = activeStage > step.num;
          const isCurrent = activeStage === step.num;

          return (
            <div
              key={step.num}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                zIndex: 1,
                textAlign: "center",
              }}
            >
              {/* Circle Node */}
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: isDone ? "#0C831F" : isCurrent ? "#F8CB46" : "#FFFFFF",
                  border: isDone
                    ? "2px solid #0C831F"
                    : isCurrent
                    ? "2px solid #CA8A04"
                    : "2px solid #CBD5E1",
                  color: isDone ? "#FFFFFF" : isCurrent ? "#0F172A" : "#94A3B8",
                  fontSize: "10px",
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: isCurrent ? "0 0 10px rgba(248, 203, 70, 0.5)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {isDone ? "✓" : step.num}
              </div>

              {/* Labels */}
              <span
                style={{
                  marginTop: "6px",
                  fontSize: "10px",
                  fontWeight: isCurrent ? 800 : 600,
                  color: isCurrent ? "#0F172A" : "#64748B",
                  whiteSpace: "nowrap",
                }}
              >
                {step.label}
              </span>
              <span
                style={{
                  fontSize: "9px",
                  color: isCurrent ? "#854D0E" : "#94A3B8",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                {step.sub}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default OrderLifecycleBar;
