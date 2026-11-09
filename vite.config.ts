/// <reference types="vitest" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function copilotDevPlugin(): Plugin {
  return {
    name: "copilot-dev-api",
    configureServer(server) {
      server.middlewares.use("/api/copilot", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        let bodyStr = "";
        req.on("data", (chunk) => {
          bodyStr += chunk;
        });

        req.on("end", async () => {
          try {
            const body = JSON.parse(bodyStr || "{}");
            const { query, telemetry = {}, customApiKey } = body;
            const apiKey =
              customApiKey ||
              (req.headers["x-gemini-key"] as string) ||
              process.env.GEMINI_API_KEY ||
              "";

            if (!apiKey) {
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: false,
                  fallback: true,
                  reason: "NO_API_KEY",
                  message:
                    "No GEMINI_API_KEY configured in local dev environment or BYOK. Falling back to grounded SCADA engine.",
                })
              );
              return;
            }

            const systemInstruction = `You are NexusTwin AI Operations Copilot — an institutional AI embedded within a high-throughput 3D industrial warehouse digital twin.

CURRENT LIVE WAREHOUSE TELEMETRY SNAPSHOT:
• Active Fleet: 14 Autonomous Mobile Robots (AMRs) with LiDAR 270° safety bubble.
• Current Throughput: ${telemetry.throughputPerHour || 480} picks/hr.
• SLA On-Time Compliance: ${(telemetry.slaCompliancePct || 98.4).toFixed(1)}%.
• Fleet Utilization: ${Math.round(telemetry.fleetUtilizationPct || 85)}%.
• Safe Yields Resolved: ${telemetry.totalSafeYieldsResolved || 42} anti-collision yields.
• Lowest Battery Unit: ${telemetry.lowestBatBotId || "BOT-03"} at ${Math.round(telemetry.lowestBatPct || 34)}% (charges at ₹1.2L OEM fast-dock).
• Most Congested Zone: ${telemetry.congestedZoneId || "ZONE_A"} (Congestion index: ${(telemetry.congestedZoneScore || 0.65).toFixed(2)}).
• Financial Payback: ${(telemetry.paybackMonths || 14.8).toFixed(1)} Months to break-even.
• Net Monthly Operational Savings: ₹${Math.round((telemetry.netMonthlySavingsINR || 482000) / 1000)}k/month (ex-GST).
• Indian Statutory Baseline: ₹18,000/mo manual picker wage (TeamLease 2024-25 baseline), 22% statutory markup (EPF/ESI), 35% festive overtime premium, 18% CGST Section 16 Input Tax Credit.
• Hardware Optimization: 14 AMRs optimal vs vendor-quoted 20 AMRs (prevents +41% CapEx and 38.4% gridlock trap).

GUIDELINES:
1. Provide concise, professional, executive-ready answers (2 to 4 paragraphs max or sharp bullet points).
2. When mentioning specific robots or zones, ALWAYS enclose their ID in square brackets like [BOT-01], [BOT-03], [ZONE_A], [ZONE_STORAGE], or [ZONE_DISPATCH]. The 3D UI parses these as interactive camera navigation links.
3. Suggest relevant interactive actions at the very end of your response using these exact action tags (choose 1-2):
   - [ACTION:WHAT_IF] for running What-If scenarios.
   - [ACTION:ROI] for inspecting the Boardroom ROI & Capex Payback matrix.
   - [ACTION:BENCHMARKS] for reviewing statutory wage benchmarks.
   - [ACTION:SURGE] for simulating peak festive season demand.
4. Maintain factual consistency with the Indian logistics benchmarks and SCADA physics telemetry provided above.`;

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(
              apiKey
            )}`;

            const resp = await fetch(geminiUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: query }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: { temperature: 0.35, maxOutputTokens: 900 },
              }),
            });

            if (resp.ok) {
              const data = await resp.json();
              const candidate = data.candidates?.[0];
              const text = candidate?.content?.parts?.[0]?.text;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  ok: true,
                  text: text || "Telemetry analysis complete.",
                  model: "gemini-2.0-flash",
                  source: "gemini",
                })
              );
            } else {
              const err = await resp.text();
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, fallback: true, error: err }));
            }
          } catch (err: any) {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, fallback: true, error: err.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), copilotDevPlugin()],
  resolve: {
    alias: {
      nexustwin: path.resolve(__dirname, "./"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3003,
    host: true,
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three") || id.includes("node_modules/@react-three")) {
            return "vendor-three";
          }
          if (id.includes("node_modules/react") || id.includes("node_modules/zustand")) {
            return "vendor-react";
          }
        },
      },
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
