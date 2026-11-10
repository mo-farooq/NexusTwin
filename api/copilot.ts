export const config = {
  runtime: "edge",
};

// In-Memory IP Sliding Window Rate Limiter (Edge Runtime)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20; // 20 requests/min per IP

interface TelemetryPayload {
  activeBotsCount?: number;
  totalCompletedTasks?: number;
  throughputPerHour?: number;
  slaCompliancePct?: number;
  fleetUtilizationPct?: number;
  totalSafeYieldsResolved?: number;
  paybackMonths?: number;
  netMonthlySavingsINR?: number;
  lowestBatBotId?: string;
  lowestBatPct?: number;
  congestedZoneId?: string;
  congestedZoneScore?: number;
}

export default async function handler(req: Request): Promise<Response> {
  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-gemini-key",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 1. IP Rate Limiting Guard
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-client";
  const now = Date.now();
  const pastTimestamps = (rateLimitMap.get(clientIp) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (pastTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return new Response(
      JSON.stringify({
        ok: false,
        fallback: true,
        reason: "RATE_LIMITED",
        message: "Rate limit exceeded (max 20 requests/min). Use local grounded SCADA engine.",
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": "60",
        },
      }
    );
  }
  pastTimestamps.push(now);
  rateLimitMap.set(clientIp, pastTimestamps);

  try {
    const body = await req.json().catch(() => ({}));
    const { query, telemetry = {}, customApiKey } = body as {
      query?: string;
      telemetry?: TelemetryPayload;
      customApiKey?: string;
    };

    // 2. Strict Input Validation & Length Limiting (OWASP DoS & Injection Prevention)
    const trimmedQuery = typeof query === "string" ? query.trim() : "";
    if (!trimmedQuery) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing or empty 'query' parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (trimmedQuery.length > 800) {
      return new Response(
        JSON.stringify({ ok: false, error: "Query exceeds maximum limit of 800 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Resolve API key from client BYOK, header, or Vercel server environment
    const clientHeaderKey = req.headers.get("x-gemini-key");
    const serverEnvKey =
      (typeof process !== "undefined" && process.env ? process.env.GEMINI_API_KEY : "") || "";

    // 4. Origin & Anti-Leeching Protection
    const origin = req.headers.get("origin") || req.headers.get("referer") || "";
    const isLocalhost = origin.includes("localhost") || origin.includes("127.0.0.1");
    const isNexusTwinDomain = origin.includes("vercel.app") || origin.includes("nexus-twin");
    const isTrustedOrigin = !origin || isLocalhost || isNexusTwinDomain;

    // If an external third-party domain attempts to call our endpoint without BYOK:
    if (!isTrustedOrigin && !customApiKey && !clientHeaderKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Unauthorized cross-origin access using server API key. Provide your own key via BYOK.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = customApiKey || clientHeaderKey || serverEnvKey;

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          fallback: true,
          reason: "NO_API_KEY",
          message:
            "No GEMINI_API_KEY configured in Vercel environment or client BYOK settings. Use local grounded SCADA engine.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construct Grounded Domain Context
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
   - [ACTION:WHAT_IF] for running What-If scenarios (Diwali surge, breakdown, jam).
   - [ACTION:ROI] for inspecting the Boardroom ROI & Capex Payback matrix.
   - [ACTION:BENCHMARKS] for reviewing statutory wage benchmarks.
   - [ACTION:SURGE] for simulating peak festive season demand.
4. Maintain factual consistency with the Indian logistics benchmarks and SCADA physics telemetry provided above.`;

    const geminiPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: trimmedQuery }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 900,
      },
    };

    // Try modern Gemini models with multi-model fallback for maximum key compatibility
    const models = [
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash",
      "gemini-flash-latest",
      "gemini-2.5-flash-lite",
      "gemini-1.5-flash",
    ];

    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
          apiKey
        )}`;

        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiPayload),
        });

        if (resp.ok) {
          const data = await resp.json();
          const candidate = data.candidates?.[0];
          const text = candidate?.content?.parts?.[0]?.text;

          if (text) {
            return new Response(
              JSON.stringify({
                ok: true,
                text,
                model,
                source: "gemini",
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch {
        // Fallback cleanly to next model without leaking exception details
      }
    }

    // If Gemini calls failed, signal fallback cleanly without leaking internal errors
    return new Response(
      JSON.stringify({
        ok: false,
        fallback: true,
        reason: "GEMINI_API_FAILURE",
        message: "Gemini provider temporarily unavailable. Falling back to local SCADA engine.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({
        ok: false,
        fallback: true,
        reason: "INTERNAL_ERROR",
        message: "Request processing error. Falling back to local SCADA engine.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
