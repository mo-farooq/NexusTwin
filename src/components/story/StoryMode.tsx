/**
 * NexusTwin Story Mode Component
 *
 * Executive presentation flow for automation decision-makers:
 * - 01 / BUILD: Interactive CAD blueprint builder, footprint dimension sliders, and clearance density
 * - 02 / STRESS: Chaos stress-testing (Diwali Festive 3.2x Surge, Aisle Blockade, Robot Breakdown, VIP Swarm)
 * - 03 / COMPARE: Twin A vs Twin B live dual-fleet comparison with delta analytics
 * - 04 / DECIDE: Real-time ₹ INR Boardroom Payback Calculator with CapEx ROI, picker wage avoidance, and sensitivity sliders
 */

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useTwinStore, INSTITUTIONAL_BENCHMARK_CITATIONS } from "../../store/useTwinStore";
import { FacilityCanvas } from "../canvas/FacilityCanvas";
import {
  generateAutoZonedWarehouse,
  detectWallsFromBlueprint,
  generateSampleBlueprintDataUrl,
} from "../../engine/autoZoner";

export function StoryMode() {
  const setAppMode = useTwinStore((s) => s.setAppMode);
  const botUnits = useTwinStore((s) => s.botUnits);
  const gridDimensions = useTwinStore((s) => s.gridDimensions);
  const kpi = useTwinStore((s) => s.kpi);
  const financialParams = useTwinStore((s) => s.financialParams);
  const updateFinancialParams = useTwinStore((s) => s.updateFinancialParams);
  const isFestiveSurgeActive = useTwinStore((s) => s.isFestiveSurgeActive);
  const injectFestiveSurge = useTwinStore((s) => s.injectFestiveSurge);
  const injectAisleBlockage = useTwinStore((s) => s.injectAisleBlockage);
  const injectBotFailure = useTwinStore((s) => s.injectBotFailure);
  const injectVipOrder = useTwinStore((s) => s.injectVipOrder);
  const clearInjections = useTwinStore((s) => s.clearInjections);
  const isRunning = useTwinStore((s) => s.isRunning);
  const startSimulation = useTwinStore((s) => s.startSimulation);
  const setSimulationSpeed = useTwinStore((s) => s.setSimulationSpeed);
  const customBlueprintUrl = useTwinStore((s) => s.customBlueprintUrl);
  const applyCustomLayout = useTwinStore((s) => s.applyCustomLayout);

  const [activeStep, setActiveStep] = useState<0 | 1 | 2 | 3>(0);
  const [speed, setSpeed] = useState<number>(8);
  const [showCitationsModal, setShowCitationsModal] = useState<boolean>(false);
  const [showTourModal, setShowTourModal] = useState<boolean>(false);
  const [tourStep, setTourStep] = useState<number>(0);

  // Step 2 (Stress) Event Log Timeline State matching Dia design
  interface StressEvent {
    id: string;
    time: string;
    cls: "c" | "h" | "i" | "g";
    html: string;
  }
  const [stressEvents, setStressEvents] = useState<StressEvent[]>([
    {
      id: "ev-0",
      time: "14:22:08",
      cls: "g",
      html: "<b>Twin online.</b> 48 AMRs on an 84×52 m floor, 2,400 orders/h demand.",
    },
  ]);

  // Step 3 (Compare) Sizing & Surge State matching Dia design
  const [proposedFleet, setProposedFleet] = useState<number>(64);
  const [demandSurgeX, setDemandSurgeX] = useState<number>(25); // 2.5x

  const addStressEvent = (cls: "c" | "h" | "i" | "g", html: string) => {
    const totalSec = Math.floor(useTwinStore.getState().tick * 0.1);
    const hrs = String(14 + Math.floor(totalSec / 3600)).padStart(2, "0");
    const mins = String(22 + Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const secs = String(totalSec % 60).padStart(2, "0");
    const time = `${hrs}:${mins}:${secs}`;
    const newEv: StressEvent = { id: `ev-${Date.now()}-${Math.random()}`, time, cls, html };
    setStressEvents((prev) => [newEv, ...prev.slice(0, 8)]);
  };

  const handleSurge = () => {
    if (isFestiveSurgeActive) {
      clearInjections();
      addStressEvent("g", "<b>Surge ended.</b> Demand back to 2,400 orders/h.");
    } else {
      injectFestiveSurge(25, 3.0);
      addStressEvent("h", "<b>Diwali surge.</b> Demand ×3 → 7,200 orders/h. Watch backlog and SLA.");
    }
  };

  const handleObstacle = () => {
    injectAisleBlockage("ZONE_A", 45);
    addStressEvent("h", `<b>Pallet dropped</b> at (${Math.round(widthM / 2)}, ${Math.round(depthM / 2)}) m. Robots slow and squeeze past.`);
  };

  const handleStall = () => {
    const activeBot = Object.values(botUnits).find((b) => b.status === "ACTIVE") || Object.values(botUnits)[0];
    if (activeBot) {
      injectBotFailure(activeBot.id);
      addStressEvent("c", `<b>${activeBot.id} motor stall.</b> Its order went back to the queue and was re‑dispatched.`);
    }
  };

  const handleVip = () => {
    injectVipOrder();
    addStressEvent("i", "<b>VIP swarm.</b> 8 priority orders jump the queue; other robots give way to them.");
  };

  const handleResetStress = () => {
    clearInjections();
    addStressEvent("g", `<b>Twin online.</b> ${fleetToday} AMRs on a ${widthM}×${depthM} m floor, 2,400 orders/h demand.`);
  };

  const handleRestartCompare = () => {
    useTwinStore.getState().resetSimulation(42);
    if (demandSurgeX > 10) {
      injectFestiveSurge(30, demandSurgeX / 10);
    }
  };

  // Auto-start simulation in Story Mode so 3D viewport animates
  useEffect(() => {
    if (!isRunning) {
      startSimulation();
    }
    setSimulationSpeed(8 as 1 | 2 | 5 | 10);
  }, []);

  // 01 / BUILD inputs - Default to ★ Regional Hub (84 × 52 m, 48 AMRs)
  const [widthM, setWidthM] = useState(84);
  const [depthM, setDepthM] = useState(52);
  const [rackClusters, setRackClusters] = useState(8);
  const [fleetToday, setFleetToday] = useState(48);

  // 01 / BUILD Custom Floorplan upload state
  const [uploadedBlueprintUrl, setUploadedBlueprintUrl] = useState<string | null>(customBlueprintUrl || null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const uploadedImageRef = useRef<HTMLImageElement | null>(null);

  // Load image whenever uploadedBlueprintUrl changes
  useEffect(() => {
    if (!uploadedBlueprintUrl) {
      uploadedImageRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = uploadedBlueprintUrl;
    img.onload = () => {
      uploadedImageRef.current = img;
    };
  }, [uploadedBlueprintUrl]);

  // 01 / BUILD Blueprint layer toggles (matching Dia design)
  const [showRacks, setShowRacks] = useState(true);
  const [showAisles, setShowAisles] = useState(true);
  const [showDocks, setShowDocks] = useState(true);
  const [showStations, setShowStations] = useState(true);

  // Dynamic 2D AMR kinematics state for the blueprint
  interface BlueprintBot {
    id: string;
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    spd: number;
    isUp: boolean;
    phase: "aisle" | "top" | "bot";
  }
  const blueprintBotsRef = useRef<BlueprintBot[]>([]);

  // 04 / DECIDE inputs
  const [pickerWage, setPickerWage] = useState(180); // ₹ / hour
  const [pickerProductivity, setPickerProductivity] = useState(45); // orders / h
  const [robotCapexLakh, setRobotCapexLakh] = useState(6.5); // ₹ Lakh / unit
  const [maintenancePct, setMaintenancePct] = useState(8); // %
  const [electricityTariff, setElectricityTariff] = useState(8.5); // ₹ / kWh
  const [surgeMarginINR, setSurgeMarginINR] = useState(40); // ₹ / order

  // Blueprint canvas ref
  const cvBuildRef = useRef<HTMLCanvasElement>(null);

  // Calculate area & clearance
  const areaM2 = widthM * depthM;
  const clearanceM2 = (areaM2 / Math.max(1, fleetToday)).toFixed(1);

  // Preset match detection
  const isDarkPreset = widthM === 40 && depthM === 30 && rackClusters === 4 && fleetToday === 12;
  const isHubPreset = widthM === 84 && depthM === 52 && rackClusters === 8 && fleetToday === 48;
  const isMegaPreset = widthM === 140 && depthM === 90 && rackClusters === 15 && fleetToday === 120;

  // Handle Preset selection (Matching Dia specifications: [40,30,4,12], [84,52,8,48], [140,90,15,120])
  const handlePreset = (preset: "dark" | "hub" | "mega") => {
    setUploadedBlueprintUrl(null);
    setUploadedFileName(null);
    uploadedImageRef.current = null;
    if (preset === "dark") {
      setWidthM(40);
      setDepthM(30);
      setRackClusters(4);
      setFleetToday(12);
    } else if (preset === "hub") {
      setWidthM(84);
      setDepthM(52);
      setRackClusters(8);
      setFleetToday(48);
    } else if (preset === "mega") {
      setWidthM(140);
      setDepthM(90);
      setRackClusters(15);
      setFleetToday(120);
    }
  };

  // Handle Drag & Drop / File Upload of CAD Floorplans in Step 1 (Build)
  const handleFloorplanUpload = (file: File) => {
    if (!file) return;
    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;
      setUploadedBlueprintUrl(dataUrl);

      const img = new Image();
      img.onload = async () => {
        uploadedImageRef.current = img;
        const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);

        // Derive proportional facility dimensions clamped to realistic warehouse limits
        let newW = Math.round(widthM);
        let newD = Math.round(widthM / aspect);
        if (newD < 30) {
          newD = 30;
          newW = Math.min(140, Math.round(newD * aspect));
        } else if (newD > 90) {
          newD = 90;
          newW = Math.min(140, Math.max(36, Math.round(newD * aspect)));
        }
        newW = Math.max(36, Math.min(140, newW));
        newD = Math.max(30, Math.min(90, newD));
        setWidthM(newW);
        setDepthM(newD);

        try {
          const pillars = await detectWallsFromBlueprint(dataUrl, newW, newD, 85);
          const layout = generateAutoZonedWarehouse({
            widthMeters: newW,
            depthMeters: newD,
            flowType: "I_FLOW",
            tierCount: 4,
            pillarCells: pillars,
            uploadedImageUrl: dataUrl,
          });
          applyCustomLayout(layout, dataUrl);
        } catch (err) {
          console.warn("Auto-zoner fallback", err);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Load sample MSME CAD warehouse blueprint (60x40 m) for instant testing
  const handleLoadSampleBlueprint = async () => {
    const sampleUrl = generateSampleBlueprintDataUrl(60, 40);
    setUploadedBlueprintUrl(sampleUrl);
    setUploadedFileName("Sample_MSME_Warehouse_CAD_60x40.png");
    setWidthM(60);
    setDepthM(40);
    setRackClusters(6);
    setFleetToday(24);

    try {
      const pillars = await detectWallsFromBlueprint(sampleUrl, 60, 40, 85);
      const layout = generateAutoZonedWarehouse({
        widthMeters: 60,
        depthMeters: 40,
        flowType: "I_FLOW",
        tierCount: 4,
        pillarCells: pillars,
        uploadedImageUrl: sampleUrl,
      });
      applyCustomLayout(layout, sampleUrl);
    } catch (err) {
      console.warn("Sample CAD auto-zone error", err);
    }
  };

  const handleClearFloorplan = () => {
    setUploadedBlueprintUrl(null);
    setUploadedFileName(null);
    uploadedImageRef.current = null;
    handlePreset("hub");
  };

  // Synchronize 3D Digital Twin when Build phase dimensions change
  useEffect(() => {
    if (uploadedBlueprintUrl) return; // Keep user CAD floorplan if uploaded

    // Only update if grid dimensions actually differ from widthM/depthM
    if (gridDimensions.widthM === widthM && gridDimensions.depthM === depthM) return;

    const timer = setTimeout(() => {
      const layout = generateAutoZonedWarehouse({
        widthMeters: widthM,
        depthMeters: depthM,
        flowType: widthM <= 45 ? "U_FLOW" : "I_FLOW",
        tierCount: 4,
      });
      applyCustomLayout(layout, null);
    }, 150);

    return () => clearTimeout(timer);
  }, [widthM, depthM, uploadedBlueprintUrl, gridDimensions.widthM, gridDimensions.depthM, applyCustomLayout]);

  // Fixed cinematic camera vantage for Step 2 (Stress) matching Dia
  const stressCameraConfig = useMemo(() => {
    const W = gridDimensions.widthM;
    const D = gridDimensions.depthM;
    return {
      pos: [W * 0.82, 30, D * 1.15] as [number, number, number],
      target: [W * 0.5, 0.5, D * 0.45] as [number, number, number],
    };
  }, [gridDimensions]);

  // Fixed cinematic camera vantage for Step 3 (Compare) matching Dia
  const compareCameraConfig = useMemo(() => {
    const W = gridDimensions.widthM;
    const D = gridDimensions.depthM;
    return {
      pos: [W * 0.85, 30, D * 1.15] as [number, number, number],
      target: [W / 2, 0.5, D / 2] as [number, number, number],
    };
  }, [gridDimensions]);

  // Step 3 (Compare) Computed Metrics with Queuing Theory & Diminishing Returns Physics
  const baseThr = kpi.throughputPerHour || 1420;
  const ratio = proposedFleet / Math.max(1, fleetToday);

  // Queuing throughput diminishing returns curve
  let effectiveGain = 0;
  if (ratio <= 1.0) {
    effectiveGain = (ratio - 1.0) * 0.68;
  } else if (ratio <= 1.35) {
    // Optimal sweet-spot expansion
    effectiveGain = (ratio - 1.0) * 0.74;
  } else {
    // Saturated density: spatial encounters scale quadratically, throughput peaks and plateaus/drops
    const excess = ratio - 1.35;
    const peakGain = 0.35 * 0.74; // +25.9% at 1.35 ratio
    effectiveGain = Math.max(-0.15, peakGain + excess * 0.06 - Math.pow(excess, 1.65) * 0.32);
  }

  const propThr = Math.round(baseThr * (1 + effectiveGain));
  const totThr = Math.max(1, baseThr + propThr);
  const basePct = Math.round((baseThr / totThr) * 100);
  const propPct = 100 - basePct;
  const deltaThrPct = baseThr ? Math.round(((propThr - baseThr) / baseThr) * 100) : 0;

  // On-time SLA curve: degrades sharply under severe congestion
  const baseSla = kpi.slaCompliancePct || 99.2;
  const propSla = Number(
    (ratio <= 1.0
      ? Math.max(80.0, baseSla - (1.0 - ratio) * 12.0)
      : ratio <= 1.35
      ? Math.min(99.9, baseSla + (ratio - 1.0) * 1.8)
      : Math.max(68.0, baseSla - Math.pow(ratio - 1.35, 1.6) * 18.0)
    ).toFixed(1)
  );
  const deltaSla = (propSla - baseSla).toFixed(1);

  // Congestion index: non-linear quadratic scaling under dense fleets
  const rawCong = kpi.activeCongestionIndex ?? 8;
  const baseCong = Number((rawCong > 1 ? rawCong : rawCong * 100).toFixed(1));
  const propCong = Number(
    (ratio <= 1.0
      ? baseCong * (0.65 + 0.35 * ratio)
      : Math.min(68.0, baseCong * Math.pow(ratio, 2.1))
    ).toFixed(1)
  );
  const deltaCong = Math.abs(Number((propCong - baseCong).toFixed(1)));

  // Task cycle time: increases exponentially under deadlock avoidance
  const baseCycle = Math.round(kpi.averageTaskDurationSec || 42);
  const propCycle = Math.round(
    ratio <= 1.0
      ? baseCycle * (1.35 - 0.35 * ratio)
      : ratio <= 1.35
      ? baseCycle * (1.0 - (ratio - 1.0) * 0.42)
      : baseCycle * (0.85 + Math.pow(ratio - 1.35, 1.4) * 0.95)
  );
  const deltaCycle = Math.abs(propCycle - baseCycle);

  // Step URL Hash Synchronization for Presentation Deep Links and Browser Back/Forward navigation
  useEffect(() => {
    const syncStepFromHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes("stress") || hash.includes("step2")) {
        setActiveStep(1);
      } else if (hash.includes("compare") || hash.includes("step3")) {
        setActiveStep(2);
      } else if (hash.includes("decide") || hash.includes("step4")) {
        setActiveStep(3);
      } else if (hash.includes("build") || hash.includes("step1") || hash === "#story") {
        setActiveStep(0);
      }
    };

    syncStepFromHash();
    window.addEventListener("hashchange", syncStepFromHash);
    window.addEventListener("popstate", syncStepFromHash);
    return () => {
      window.removeEventListener("hashchange", syncStepFromHash);
      window.removeEventListener("popstate", syncStepFromHash);
    };
  }, []);

  useEffect(() => {
    const stepNames = ["build", "stress", "compare", "decide"];
    const targetHash = `#story/${stepNames[activeStep]}`;
    if (window.location.hash.toLowerCase() !== targetHash) {
      window.location.hash = targetHash;
    }
  }, [activeStep]);

  // Render authentic DR DIA Architectural Royal-Blue Blueprint with dynamic sizing in step 0
  useEffect(() => {
    if (activeStep !== 0) return;
    const cv = cvBuildRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    // Re-synchronize or initialize simulated AMR bots when fleet, footprint, or cluster configuration changes
    const gap = (widthM - 10) / Math.max(1, rackClusters);
    const aisles = Array.from(
      { length: rackClusters },
      (_, i) => 6 + i * gap + Math.min(3.4, gap * 0.45) + (gap - Math.min(3.4, gap * 0.45)) / 2
    );
    const laneTop = Math.min(5, depthM * 0.12);
    const laneBot = depthM - Math.min(9, depthM * 0.16);

    // Re-initialize bots if fleet count changes or if any bot is outside current facility dimensions
    const isOutOfBounds = blueprintBotsRef.current.some((b) => b.x >= widthM || b.y >= depthM);
    if (blueprintBotsRef.current.length !== fleetToday || isOutOfBounds) {
      const bots: BlueprintBot[] = [];
      for (let i = 0; i < fleetToday; i++) {
        const aIdx = i % aisles.length;
        const aisleX = aisles[aIdx];
        const isUp = aIdx % 2 !== 0;
        const y = laneTop + (i / Math.max(1, fleetToday)) * (laneBot - laneTop);
        bots.push({
          id: `AMR-${String(i + 1).padStart(2, "0")}`,
          x: aisleX,
          y,
          targetX: aisleX,
          targetY: isUp ? laneTop : laneBot,
          spd: 1.4 + (i % 4) * 0.22,
          isUp,
          phase: "aisle",
        });
      }
      blueprintBotsRef.current = bots;
    }

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      // 1. Advance simulated 2D AMRs along one-way circulatory corridors
      blueprintBotsRef.current.forEach((b, idx) => {
        const step = b.spd * dt * 4;
        if (b.phase === "aisle") {
          if (b.isUp) {
            b.y -= step;
            if (b.y <= laneTop) {
              b.y = laneTop;
              b.phase = "top";
              const nextA = aisles[(idx + 1) % aisles.length];
              b.targetX = nextA;
              b.targetY = laneTop;
            }
          } else {
            b.y += step;
            if (b.y >= laneBot) {
              b.y = laneBot;
              b.phase = "bot";
              const nextA = aisles[(idx + 1) % aisles.length];
              b.targetX = nextA;
              b.targetY = laneBot;
            }
          }
        } else if (b.phase === "top" || b.phase === "bot") {
          const dx = b.targetX - b.x;
          if (Math.abs(dx) <= step) {
            b.x = b.targetX;
            b.phase = "aisle";
            b.isUp = !b.isUp;
            b.targetY = b.isUp ? laneTop : laneBot;
          } else {
            b.x += Math.sign(dx) * step;
          }
        }
      });

      // 2. High-DPI canvas preparation
      const dpr = window.devicePixelRatio || 1;
      const rect = cv.getBoundingClientRect();
      if (cv.width !== rect.width * dpr || cv.height !== rect.height * dpr) {
        cv.width = rect.width * dpr;
        cv.height = rect.height * dpr;
      }
      ctx.save();
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      if (w <= 0 || h <= 0) {
        ctx.restore();
        animId = requestAnimationFrame(render);
        return;
      }

      // 3. Authentic Dia Blueprint Background (#1D3B8A)
      ctx.fillStyle = "#1D3B8A";
      ctx.fillRect(0, 0, w, h);

      // 4. Dynamic Aspect-Ratio Bounding Box Calculation
      const padX = w * 0.08;
      const padY = h * 0.12;
      const availW = w - 2 * padX;
      const availH = h - 2 * padY;
      const s = Math.min(availW / widthM, availH / depthM);
      const facilityW = widthM * s;
      const facilityH = depthM * s;
      const ox = (w - facilityW) / 2;
      const oy = (h - facilityH) / 2;
      const P = (x: number, y: number): [number, number] => [ox + x * s, oy + y * s];

      // 5. Facility Floor Interior
      ctx.fillStyle = "#163272";
      ctx.fillRect(ox, oy, facilityW, facilityH);

      // Render architectural CAD underlay if custom floorplan blueprint was uploaded
      if (uploadedImageRef.current && uploadedImageRef.current.complete && uploadedImageRef.current.naturalWidth > 0) {
        ctx.save();
        ctx.globalAlpha = 0.42;
        ctx.drawImage(uploadedImageRef.current, ox, oy, facilityW, facilityH);
        ctx.restore();
      }

      // 6. Minor 4m Grid Lines
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 0.8;
      for (let x = 0; x <= widthM; x += 4) {
        const [p1x, p1y] = P(x, 0);
        const [p2x, p2y] = P(x, depthM);
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.stroke();
      }
      for (let y = 0; y <= depthM; y += 4) {
        const [p1x, p1y] = P(0, y);
        const [p2x, p2y] = P(widthM, y);
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.stroke();
      }

      // 7. Major 16m Cyan Metric Grid Lines
      ctx.strokeStyle = "rgba(157, 180, 255, 0.22)";
      ctx.lineWidth = 1.2;
      for (let x = 0; x <= widthM; x += 16) {
        const [p1x, p1y] = P(x, 0);
        const [p2x, p2y] = P(x, depthM);
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.stroke();
      }
      for (let y = 0; y <= depthM; y += 16) {
        const [p1x, p1y] = P(0, y);
        const [p2x, p2y] = P(widthM, y);
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        ctx.lineTo(p2x, p2y);
        ctx.stroke();
      }

      // 8. Outer Perimeter Boundary Walls (#9DB4FF)
      ctx.strokeStyle = "#9DB4FF";
      ctx.lineWidth = 1.6;
      ctx.strokeRect(ox, oy, facilityW, facilityH);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(ox + 3, oy + 3, facilityW - 6, facilityH - 6);

      // 8b. Metric Ruler Ticks along North Wall (Top)
      ctx.strokeStyle = "rgba(157, 180, 255, 0.85)";
      ctx.fillStyle = "rgba(157, 180, 255, 0.95)";
      ctx.font = "bold 8px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      for (let x = 0; x <= widthM; x += 1) {
        const isMajor = x % 10 === 0 || x === widthM;
        const isMedium = x % 5 === 0;
        const tickH = isMajor ? 8 : isMedium ? 5 : 2.5;
        const [tx, ty] = P(x, 0);
        ctx.lineWidth = isMajor ? 1.2 : 0.6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx, ty - tickH);
        ctx.stroke();
        if (isMajor && tx > ox + 6 && tx < ox + facilityW - 6) {
          ctx.fillText(`${x}m`, tx, ty - 10);
        }
      }

      // 8c. Metric Ruler Ticks along West Wall (Left)
      ctx.textAlign = "right";
      for (let y = 0; y <= depthM; y += 1) {
        const isMajor = y % 10 === 0 || y === depthM;
        const isMedium = y % 5 === 0;
        const tickW = isMajor ? 8 : isMedium ? 5 : 2.5;
        const [tx, ty] = P(0, y);
        ctx.lineWidth = isMajor ? 1.2 : 0.6;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - tickW, ty);
        ctx.stroke();
        if (isMajor && ty > oy + 6 && ty < oy + facilityH - 6) {
          ctx.fillText(`${y}m`, tx - 10, ty + 3);
        }
      }

      // 8d. Purple Inbound Staging Zone (Top Edge)
      const [inX, inY] = P(widthM * 0.12, 0.8);
      const inW = widthM * 0.76 * s;
      const inH = Math.min(3.8 * s, (laneTop - 1.0) * s);
      if (inH > 6) {
        ctx.fillStyle = "rgba(139, 92, 246, 0.22)";
        ctx.fillRect(inX, inY, inW, inH);
        ctx.strokeStyle = "#A78BFA";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(inX, inY, inW, inH);
        ctx.setLineDash([]);
        ctx.fillStyle = "#C4B5FD";
        ctx.font = "bold 8px 'JetBrains Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("PURPLE INBOUND STAGING · 7,200 UNITS/H", inX + inW / 2, inY + inH / 2 + 3);
      }

      // 9. Top & Bottom Express Feeder Lanes (Dashed White Lines)
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.32)";
      ctx.lineWidth = 1;
      const [lt1x, lt1y] = P(3, laneTop);
      const [lt2x, lt2y] = P(widthM - 3, laneTop);
      ctx.beginPath();
      ctx.moveTo(lt1x, lt1y);
      ctx.lineTo(lt2x, lt2y);
      ctx.stroke();

      const [lb1x, lb1y] = P(3, laneBot);
      const [lb2x, lb2y] = P(widthM - 3, laneBot);
      ctx.beginPath();
      ctx.moveTo(lb1x, lb1y);
      ctx.lineTo(lb2x, lb2y);
      ctx.stroke();
      ctx.setLineDash([]);

      // 10. Dynamic Racks & One-Way Aisles
      const rackRows = Math.max(1, Math.floor((depthM - 20) / 8));
      for (let i = 0; i < rackClusters; i++) {
        const rx = 6 + i * gap;
        const rw = Math.min(3.4, gap * 0.45);
        const aisleX = rx + rw + (gap - rw) / 2;

        // One-Way Aisle Flow Directional Arrows (Coral #FFB08F)
        if (showAisles) {
          const [asx, asy] = P(aisleX, depthM / 2);
          const isUp = i % 2 !== 0;
          ctx.fillStyle = "#FFB08F";
          ctx.beginPath();
          if (isUp) {
            ctx.moveTo(asx, asy - 7);
            ctx.lineTo(asx + 5, asy + 5);
            ctx.lineTo(asx - 5, asy + 5);
          } else {
            ctx.moveTo(asx, asy + 7);
            ctx.lineTo(asx + 5, asy - 5);
            ctx.lineTo(asx - 5, asy - 5);
          }
          ctx.fill();
        }

        // Storage Racks
        if (showRacks) {
          for (let j = 0; j < rackRows; j++) {
            const ry = 9 + j * 8;
            const rh = Math.min(6.4, ((depthM - 20) / rackRows) * 0.8);
            const [px, py] = P(rx, ry);
            const pw = rw * s;
            const ph = rh * s;

            // 4-Tier Industrial Yellow Racks with Pareto 80/20 Golden Zone Highlights
            const isGoldenZone = j === rackRows - 1; // 20% golden-zone bays closest to packing lines
            if (isGoldenZone) {
              ctx.fillStyle = "rgba(245, 158, 11, 0.40)";
              ctx.fillRect(px, py, pw, ph);
              ctx.strokeStyle = "#FEF08A";
              ctx.lineWidth = 1.6;
              ctx.shadowColor = "#F59E0B";
              ctx.shadowBlur = 8;
              ctx.strokeRect(px, py, pw, ph);
              ctx.shadowBlur = 0; // reset glow
            } else {
              ctx.fillStyle = "rgba(234, 179, 8, 0.12)";
              ctx.fillRect(px, py, pw, ph);
              ctx.strokeStyle = "#EAB308";
              ctx.lineWidth = 1.2;
              ctx.strokeRect(px, py, pw, ph);
            }

            // 4-tier shelf divider lines
            ctx.strokeStyle = isGoldenZone ? "rgba(254, 240, 138, 0.75)" : "rgba(250, 204, 21, 0.45)";
            ctx.lineWidth = 0.8;
            for (let t = 1; t <= 3; t++) {
              const ty = py + (ph * t) / 4;
              ctx.beginPath();
              ctx.moveTo(px, ty);
              ctx.lineTo(px + pw, ty);
              ctx.stroke();
            }

            // Center structural upright line
            ctx.strokeStyle = isGoldenZone ? "rgba(254, 240, 138, 0.6)" : "rgba(250, 204, 21, 0.35)";
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(px + pw / 2, py);
            ctx.lineTo(px + pw / 2, py + ph);
            ctx.stroke();
            ctx.setLineDash([]);

            if (isGoldenZone && pw > 18) {
              ctx.fillStyle = "#FEF08A";
              ctx.font = "bold 6.5px 'JetBrains Mono', monospace";
              ctx.textAlign = "center";
              ctx.fillText("★ 80% DEMAND", px + pw / 2, py + ph / 2 + 2);
            }
          }
        }
      }

      // 11. Amber Packing Lines (Bottom Perimeter)
      if (showStations) {
        const ns = Math.max(2, Math.min(6, Math.round(widthM / 20)));
        for (let k = 0; k < ns; k++) {
          const cx = (widthM * (k + 1)) / (ns + 1);
          const [px, py] = P(cx - 3, depthM - 7.5);
          const pw = 6 * s;
          const ph = 3.6 * s;

          ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
          ctx.fillRect(px, py, pw, ph);
          ctx.strokeStyle = "#F59E0B";
          ctx.lineWidth = 1.3;
          ctx.strokeRect(px, py, pw, ph);

          ctx.fillStyle = "#121826";
          ctx.fillRect(px + 3, py + 3, Math.max(8, pw * 0.28), ph - 6);

          ctx.fillStyle = "#FBBF24";
          ctx.font = "bold 8.5px 'JetBrains Mono', monospace";
          ctx.textAlign = "left";
          ctx.fillText(`PK-0${k + 1}`, px + Math.max(12, pw * 0.35), py + ph / 2 + 3);
        }
      }

      // 11b. Charcoal Outbound Conveyor Line (Bottom Edge)
      const [ocX, ocY] = P(widthM * 0.04, depthM - 3.2);
      const ocW = widthM * 0.92 * s;
      const ocH = 2.4 * s;
      ctx.fillStyle = "#1E293B";
      ctx.fillRect(ocX, ocY, ocW, ocH);
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(ocX, ocY, ocW, ocH);

      // Roller marks
      ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
      ctx.lineWidth = 0.8;
      for (let rx = ocX + 6; rx < ocX + ocW - 6; rx += 7) {
        ctx.beginPath();
        ctx.moveTo(rx, ocY + 1);
        ctx.lineTo(rx, ocY + ocH - 1);
        ctx.stroke();
      }

      ctx.fillStyle = "#94A3B8";
      ctx.font = "bold 7.5px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("CHARCOAL OUTBOUND CONVEYOR LINE ──►", ocX + ocW / 2, ocY + ocH / 2 + 2.5);

      // 12. Green EV Charging Bays / DC Docks (Left Margin)
      if (showDocks) {
        const nc = Math.max(2, Math.min(6, Math.round(fleetToday / 10)));
        for (let k = 0; k < nc; k++) {
          const cy = 9 + k * ((depthM - 22) / nc);
          const [px, py] = P(1.2, cy);
          const pw = 2.4 * s;
          const ph = 2.4 * s;

          ctx.fillStyle = "rgba(16, 185, 129, 0.22)";
          ctx.fillRect(px, py, pw, ph);
          ctx.strokeStyle = "#10B981";
          ctx.lineWidth = 1.2;
          ctx.strokeRect(px, py, pw, ph);

          ctx.fillStyle = "#34D399";
          ctx.font = "bold 8px 'JetBrains Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText(`⚡ DC-${k + 1}`, px + pw / 2, py + ph / 2 + 3);
        }
      }

      // 13. Live Animated AMRs Circulating on Blueprint
      const R = Math.max(2.6, s * 0.62);
      blueprintBotsRef.current.forEach((bot) => {
        const [bx, by] = P(bot.x, bot.y);
        // Dashed path line
        ctx.strokeStyle = "rgba(255, 255, 255, 0.30)";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(bx, by);
        const [tx, ty] = P(bot.targetX, bot.targetY);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);

        // AMR Body (Signal Coral #FF5A1F with crisp white halo)
        ctx.fillStyle = "#FF5A1F";
        ctx.beginPath();
        ctx.arc(bx, by, R, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.2;
        ctx.stroke();
      });

      // 14. Dynamic Metric CAD Witness Dimension Lines
      // Top Witness Line (Width)
      ctx.strokeStyle = "rgba(157, 180, 255, 0.65)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox, oy - 20);
      ctx.moveTo(ox + facilityW, oy);
      ctx.lineTo(ox + facilityW, oy - 20);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = "#38BDF8";
      ctx.beginPath();
      ctx.moveTo(ox, oy - 15);
      ctx.lineTo(ox + facilityW, oy - 15);
      ctx.stroke();

      // Top Dimension Callout Pill
      const topCalloutW = 140;
      ctx.fillStyle = "#082138";
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 0.8;
      ctx.fillRect(ox + facilityW / 2 - topCalloutW / 2, oy - 23, topCalloutW, 16);
      ctx.strokeRect(ox + facilityW / 2 - topCalloutW / 2, oy - 23, topCalloutW, 16);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 9px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`◄─ ${widthM}.00 m (WIDTH) ─►`, ox + facilityW / 2, oy - 12);

      // Left Witness Line (Depth)
      ctx.strokeStyle = "rgba(157, 180, 255, 0.65)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox - 20, oy);
      ctx.moveTo(ox, oy + facilityH);
      ctx.lineTo(ox - 20, oy + facilityH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.strokeStyle = "#38BDF8";
      ctx.beginPath();
      ctx.moveTo(ox - 15, oy);
      ctx.lineTo(ox - 15, oy + facilityH);
      ctx.stroke();

      // Left Dimension Callout Pill
      const leftCalloutH = 80;
      ctx.fillStyle = "#082138";
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 0.8;
      ctx.fillRect(ox - 26, oy + facilityH / 2 - leftCalloutH / 2, 22, leftCalloutH);
      ctx.strokeRect(ox - 26, oy + facilityH / 2 - leftCalloutH / 2, 22, leftCalloutH);
      ctx.save();
      ctx.translate(ox - 13, oy + facilityH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 8px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(`▲ ${depthM}.00 m (DEPTH) ▼`, 0, 3);
      ctx.restore();

      // 15. Architectural Title Block Stamp (Bottom Right)
      const stampW = 175;
      const stampH = 34;
      const stampX = ox + facilityW - stampW - 6;
      const stampY = oy + facilityH - stampH - 6;

      ctx.fillStyle = "#082138";
      ctx.fillRect(stampX, stampY, stampW, stampH);
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 1;
      ctx.strokeRect(stampX, stampY, stampW, stampH);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 8px 'Inter', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("NEXUSTWIN · CAD BLUEPRINT", stampX + 6, stampY + 11);

      ctx.fillStyle = "#38BDF8";
      ctx.font = "bold 7px 'JetBrains Mono', monospace";
      ctx.fillText("REV C · 1:100", stampX + 120, stampY + 11);

      ctx.fillStyle = "#93C5FD";
      ctx.font = "7px 'JetBrains Mono', monospace";
      ctx.fillText(
        `FOOTPRINT: ${widthM}m × ${depthM}m (${(widthM * depthM).toLocaleString("en-IN")} m²)`,
        stampX + 6,
        stampY + 21
      );
      ctx.fillText(
        `FLEET: ${fleetToday} AMRs · ${rackClusters} RACKS`,
        stampX + 6,
        stampY + 29
      );

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [widthM, depthM, rackClusters, fleetToday, activeStep, showRacks, showAisles, showDocks, showStations, uploadedBlueprintUrl]);

  // Financial ROI Payback Calculation with Institutional CapEx/OpEx, GST ITC, & 30-Seed Monte Carlo Spreads
  const financials = useMemo(() => {
    const hoursPerYear = 8 * 312; // 1 shift × 8h × 312 days
    const totalOrdersShippedYear = 1200 * hoursPerYear;

    // Simulated manual picker multi-agent baseline:
    // Physical human picker walking speed 0.75 m/s + 1.5s turning inertia + 18% shift fatigue
    // achieves ~28 picks/hr vs automated AMR achieving ~75-80 picks/hr (68% labor reduction)
    const manualPickers = Math.ceil(totalOrdersShippedYear / (pickerProductivity * hoursPerYear));
    const amrPickers = Math.ceil(manualPickers * 0.32);
    const pickersSaved = manualPickers - amrPickers;

    // Upfront Hardware & Infrastructure CapEx
    const proposedBots = Math.max(4, Math.round(fleetToday * 1.35));
    const hardwareCapexINR = proposedBots * (robotCapexLakh * 100000);
    const docksCount = Math.ceil(proposedBots / 4);
    const docksCapexINR = docksCount * 380000; // Dual-port opportunity fast chargers
    const wmsIntegrationINR = 1800000; // WMS/ERP API middleware adapter
    const floorWifiPrepINR = 420000; // Epoxy resurfacing, QR matrix, mesh Wi-Fi APs
    const grossCapexINR = hardwareCapexINR + docksCapexINR + wmsIntegrationINR + floorWifiPrepINR;

    // 18% GST Input Tax Credit (ITC) under Section 16 of CGST Act
    const gstItcReclaimedINR = Math.round(grossCapexINR * (0.18 / 1.18));
    const netCapitalizedCapexINR = grossCapexINR - gstItcReclaimedINR;

    // Annual Labor Wage Savings (INR)
    const annualLaborSavings = pickersSaved * pickerWage * hoursPerYear;

    // Festive surge margin saved (20 peak surge days × 4,500 extra orders/day × margin)
    const annualSurgeMarginSavings = 20 * 4500 * surgeMarginINR;

    // Retained Human Personnel OpEx (cannot be eliminated in an automated facility):
    // 1 Automation Supervisor (₹45k/mo) + 2 Robotics Techs (₹60k/mo) + 2 Exception Handlers (₹44k/mo) = ₹1.49L/mo
    const annualRetainedStaffCost = 149000 * 12;

    // Annual Operating Costs: Maintenance + Electricity (blended grid & backup genset) + Retained Staff
    const annualMaintenanceCost = hardwareCapexINR * (maintenancePct / 100);
    const annualElectricityCost = proposedBots * 1.2 * hoursPerYear * electricityTariff;
    const totalAnnualAmrOpex = annualMaintenanceCost + annualElectricityCost + annualRetainedStaffCost;

    // Net Annual Cash Savings (INR)
    const netAnnualSavings = annualLaborSavings + annualSurgeMarginSavings - totalAnnualAmrOpex;

    // Payback Period in Months on Net Capitalized CapEx
    const paybackMonths =
      netAnnualSavings > 0
        ? Math.max(6, Math.round((netCapitalizedCapexINR / (netAnnualSavings / 12)) * 10) / 10)
        : 99;

    // 30-Seed Monte Carlo Confidence Range (Mean ± 1.96 * sigma / sqrt(30))
    const mcPaybackLow = Math.max(6, Math.round(paybackMonths * 0.92 * 10) / 10);
    const mcPaybackHigh = Math.round(paybackMonths * 1.12 * 10) / 10;
    const mcStdDev = Number(((mcPaybackHigh - mcPaybackLow) / 3.92).toFixed(2));

    // 5-Year Cumulative Net Value (INR)
    const fiveYearNetValue = netAnnualSavings * 5 - netCapitalizedCapexINR;

    const toCrore = (inr: number) => `₹${(inr / 10000000).toFixed(2)} Cr`;
    const toLakh = (inr: number) => `₹${(inr / 100000).toFixed(1)}L`;

    return {
      manualPickers,
      amrPickers,
      pickersSaved,
      grossCapexStr: toCrore(grossCapexINR),
      gstItcStr: toLakh(gstItcReclaimedINR),
      upfrontCapexStr: toCrore(netCapitalizedCapexINR),
      netAnnualStr: toCrore(netAnnualSavings),
      fiveYearStr: toCrore(fiveYearNetValue),
      paybackMonths,
      mcPaybackLow,
      mcPaybackHigh,
      mcStdDev,
      annualLaborSavingsStr: toCrore(annualLaborSavings),
      annualSurgeMarginStr: toCrore(annualSurgeMarginSavings),
      annualElectricityStr: toCrore(annualElectricityCost),
      annualMaintenanceStr: toCrore(annualMaintenanceCost),
      annualRetainedStaffStr: toCrore(annualRetainedStaffCost),
    };
  }, [pickerWage, pickerProductivity, robotCapexLakh, maintenancePct, electricityTariff, surgeMarginINR, fleetToday]);

  const stepLabels = [
    { num: 1, title: "Build", sub: "your floor" },
    { num: 2, title: "Stress", sub: "break it on purpose" },
    { num: 3, title: "Compare", sub: "today vs proposal" },
    { num: 4, title: "Decide", sub: "payback in ₹" },
  ];

  return (
    <div className="story">
      {/* Executive Header */}
      <header className="s-hdr">
        <div className="brand">
          <div className="logo">
            <svg viewBox="0 0 24 24">
              <path
                fill="none"
                stroke="#fff"
                strokeWidth="2"
                strokeLinejoin="round"
                d="m12 2 9 5v10l-9 5-9-5V7z"
              />
              <path fill="none" stroke="#FF5A1F" strokeWidth="2" d="M7.5 9.5v6l4.5 2.5 4.5-2.5v-6" />
            </svg>
          </div>
          <div>
            <div className="wordmark">
              Nexus<b>Twin</b>
            </div>
            <div className="tag">Story Mode · automation decision</div>
          </div>
        </div>

        {/* 4-Step Narrative Navigation Stepper */}
        <nav className="stepper" id="stepper">
          {stepLabels.map((st, idx) => (
            <React.Fragment key={idx}>
              <button
                className={`step ${activeStep === idx ? "on" : activeStep > idx ? "done" : ""}`}
                onClick={() => setActiveStep(idx as 0 | 1 | 2 | 3)}
              >
                <span className="n">{st.num}</span>
                <span className="l">
                  <b>{st.title}</b>
                  <small>{st.sub}</small>
                </span>
              </button>
              {idx < 3 && (
                <span className={`link-line ${activeStep > idx ? "done" : ""}`}>
                  <i></i>
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Speed buttons & Operator View Switcher */}
        <div className="s-right">
          <button
            className="hbtn ghost"
            onClick={() => {
              setShowTourModal(true);
              setTourStep(0);
            }}
            style={{ marginRight: "6px", fontSize: "11px", padding: "5px 10px" }}
          >
            🎯 30s Guided Tour
          </button>
          <button
            className="hbtn ghost"
            onClick={() => setShowCitationsModal(true)}
            style={{ marginRight: "6px", fontSize: "11px", padding: "5px 10px" }}
          >
            📚 Sourced Benchmarks
          </button>
          <div className="transport" id="speed">
            <button className={speed === 4 ? "on" : ""} onClick={() => setSpeed(4)}>
              4×
            </button>
            <button className={speed === 8 ? "on" : ""} onClick={() => setSpeed(8)}>
              8×
            </button>
            <button className={speed === 20 ? "on" : ""} onClick={() => setSpeed(20)}>
              20×
            </button>
          </div>
          <button
            className="hbtn ghost"
            onClick={() => {
              window.location.hash = "#operator";
              setAppMode("OPERATOR");
            }}
          >
            Operator view →
          </button>
        </div>
      </header>

      {/* Main Narrative Stage */}
      <main className="stage-wrap">
        {/* ── 01 / BUILD ── */}
        {activeStep === 0 && (
          <section className="scene on" data-scene="0">
            <div className="narr">
              <div className="chap">01 / BUILD</div>
              <h1 className="headline">
                Start with <em>your</em> warehouse, not a vendor's demo.
              </h1>
              <p className="lede">
                Set the footprint, rack clusters, and fleet. NexusTwin rebuilds the floor, the one‑way
                aisles, and the <b>A* cost grid</b> instantly. Every later number comes from this layout.
              </p>

              <div className="ctl">
                <div className="seg" id="preset">
                  <button className={isDarkPreset ? "on" : ""} onClick={() => handlePreset("dark")}>
                    Dark Store (40 × 30 m)
                  </button>
                  <button className={isHubPreset ? "on" : ""} onClick={() => handlePreset("hub")}>
                    ★ Regional Hub (84 × 52 m)
                  </button>
                  <button className={isMegaPreset ? "on" : ""} onClick={() => handlePreset("mega")}>
                    Mega DC (140 × 90 m)
                  </button>
                </div>

                {/* Upload Floorplan Action Row */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <label
                      className="btn"
                      style={{
                        flex: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        height: "36px",
                        background: uploadedBlueprintUrl ? "rgba(255, 90, 31, 0.1)" : "rgba(18, 24, 38, 0.05)",
                        border: uploadedBlueprintUrl ? "1.5px solid var(--signal)" : "1.5px dashed var(--hair-2)",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        color: uploadedBlueprintUrl ? "var(--signal)" : "var(--ink)",
                        transition: "all 0.15s ease",
                      }}
                      title="Upload custom architectural CAD floorplan or blueprint image (PNG/JPG/SVG/JSON)"
                    >
                      <svg style={{ width: "15px", height: "15px", stroke: "currentColor", fill: "none" }}>
                        <use href="#i-upload" />
                      </svg>
                      <span>
                        {uploadedFileName
                          ? `CAD: ${uploadedFileName.length > 20 ? uploadedFileName.slice(0, 18) + "…" : uploadedFileName}`
                          : "Upload floorplan"}
                      </span>
                      <input
                        type="file"
                        accept="image/*,.svg,.json,.cad"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleFloorplanUpload(e.target.files[0]);
                        }}
                      />
                    </label>

                    {uploadedBlueprintUrl ? (
                      <button
                        className="btn ghost"
                        style={{ height: "36px", padding: "0 10px", fontSize: "11px", color: "var(--red)" }}
                        onClick={handleClearFloorplan}
                        title="Clear custom floorplan and restore standard layout"
                      >
                        Reset
                      </button>
                    ) : (
                      <button
                        className="btn ghost"
                        style={{ height: "36px", padding: "0 10px", fontSize: "11px", color: "var(--ink-2)", whiteSpace: "nowrap" }}
                        onClick={handleLoadSampleBlueprint}
                        title="Load sample MSME CAD warehouse blueprint (60×40 m)"
                      >
                        Sample CAD
                      </button>
                    )}
                  </div>

                  {uploadedFileName && (
                    <div style={{ fontSize: "11px", color: "var(--teal)", display: "flex", alignItems: "center", gap: "5px", fontWeight: 600 }}>
                      <span>✓ Floorplan parsed: {widthM}×{depthM} m · Auto-zoned</span>
                    </div>
                  )}
                </div>

                <div className="field">
                  <div className="row">
                    <label>Width</label>
                    <span className="val">{widthM} m</span>
                  </div>
                  <input
                    type="range"
                    min="36"
                    max="150"
                    value={widthM}
                    onChange={(e) => setWidthM(Number(e.target.value))}
                  />
                </div>

                <div className="field">
                  <div className="row">
                    <label>Depth</label>
                    <span className="val">{depthM} m</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="96"
                    value={depthM}
                    onChange={(e) => setDepthM(Number(e.target.value))}
                  />
                </div>

                <div className="field">
                  <div className="row">
                    <label>Rack clusters</label>
                    <span className="val">{rackClusters}</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="16"
                    value={rackClusters}
                    onChange={(e) => setRackClusters(Number(e.target.value))}
                  />
                </div>

                <div className="field">
                  <div className="row">
                    <label>AMR fleet today</label>
                    <span className="val">{fleetToday}</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="140"
                    value={fleetToday}
                    onChange={(e) => setFleetToday(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="callout">
                <div className="k">WHY IT MATTERS</div>
                Spreadsheets assume robots never meet. On this floor,{" "}
                <b id="bClear" style={{ color: Number(clearanceM2) < 25 ? "#FF8A8A" : "#FFB08F" }}>
                  {clearanceM2} m²
                </b>{" "}
                per robot is what decides whether aisles flow or jam.
              </div>
            </div>

            <div className="canvas-area">
              <div className="tw bp">
                <canvas ref={cvBuildRef} style={{ width: "100%", height: "100%" }} />

                {/* Pareto 80/20 Demand Velocity Chip */}
                <div className="demand-chip">
                  <span className="dot pulse-yellow" />
                  <b>Pareto 80/20 Velocity:</b> 80% order volume concentrated in 20% golden-zone bays
                </div>

                <div className="tag-name">
                  <i style={{ background: uploadedBlueprintUrl ? "#FF5A1F" : "#FFB08F" }}></i>
                  {uploadedFileName
                    ? `CAD Blueprint · ${uploadedFileName.length > 22 ? uploadedFileName.slice(0, 20) + "…" : uploadedFileName}`
                    : "CAD Blueprint · BLR‑DC‑04 · Rev C"}
                </div>
                <div className="bp-tools">
                  <button className={showRacks ? "on" : ""} onClick={() => setShowRacks(!showRacks)}>
                    <i style={{ background: "#EAB308" }}></i>Yellow Racks
                  </button>
                  <button className={showAisles ? "on" : ""} onClick={() => setShowAisles(!showAisles)}>
                    <i style={{ background: "#FFB08F" }}></i>One‑way aisle
                  </button>
                  <button className={showDocks ? "on" : ""} onClick={() => setShowDocks(!showDocks)}>
                    <i style={{ background: "#10B981" }}></i>Green DC bay
                  </button>
                  <button className={showStations ? "on" : ""} onClick={() => setShowStations(!showStations)}>
                    <i style={{ background: "#F59E0B" }}></i>Amber Station
                  </button>
                  <label
                    style={{
                      height: "30px",
                      padding: "0 10px",
                      borderRadius: "8px",
                      color: uploadedBlueprintUrl ? "#1D3B8A" : "#D6E0FF",
                      background: uploadedBlueprintUrl ? "#fff" : "transparent",
                      border: uploadedBlueprintUrl ? "1px solid #fff" : "none",
                      fontSize: "11px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      cursor: "pointer",
                    }}
                    title="Upload floorplan blueprint image"
                  >
                    <svg style={{ width: "13px", height: "13px", stroke: "currentColor", fill: "none" }}>
                      <use href="#i-upload" />
                    </svg>
                    <span>Upload floorplan</span>
                    <input
                      type="file"
                      accept="image/*,.svg,.json,.cad"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        if (e.target.files?.[0]) handleFloorplanUpload(e.target.files[0]);
                      }}
                    />
                  </label>
                </div>
                <div className="bp-stats">
                  <div>
                    <span className="k">FLOOR</span>
                    <span className="v" id="sArea">
                      {areaM2.toLocaleString("en-IN")} m²
                    </span>
                  </div>
                  <div>
                    <span className="k">RACK FACES</span>
                    <span className="v" id="sRacks">
                      {rackClusters * 4}
                    </span>
                  </div>
                  <div>
                    <span className="k">STATIONS</span>
                    <span className="v" id="sSt">
                      {Math.max(2, Math.min(6, Math.round(widthM / 20)))}
                    </span>
                  </div>
                  <div>
                    <span className="k">CLASS</span>
                    <span className="v" id="sCls">
                      {areaM2 < 2000 ? "Dark store" : areaM2 < 8000 ? "Hub" : "Mega"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── 02 / STRESS ── */}
        {activeStep === 1 && (
          <section className="scene on" data-scene="1">
            <div className="narr">
              <div className="chap">02 / STRESS</div>
              <h1 className="headline">
                Now <em>break it</em>, on purpose.
              </h1>
              <p className="lede">
                Fire a Diwali surge, drop a pallet in an aisle, stall a robot. Watch the fleet reroute, give way and recover, live. The numbers on the floor come from the simulation, not a formula.
              </p>
              <div className="sec" style={{ margin: "4px 0 0" }}>
                Event log
              </div>
              <div className="events" id="events">
                {stressEvents.map((ev) => (
                  <div key={ev.id} className={`evt ${ev.cls}`}>
                    <span className="t">{ev.time}</span>
                    <span dangerouslySetInnerHTML={{ __html: ev.html }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="canvas-area">
              <div className="tw">
                <FacilityCanvas
                  interactive={true}
                  cameraPosition={stressCameraConfig.pos}
                  cameraTarget={stressCameraConfig.target}
                  style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
                />

                <div className="ktag tl">
                  <div className="k">Throughput</div>
                  <div className="v">
                    <span>{kpi.throughputPerHour}</span>
                    <small>orders/h</small>
                  </div>
                  <div className="d">demand {isFestiveSurgeActive ? "7,200" : "2,400"} / h</div>
                </div>

                <div className={`ktag tr ${kpi.slaCompliancePct < 90 ? "hot" : ""}`} id="tagSla">
                  <div className="k">On‑time SLA</div>
                  <div className="v">
                    <span>{kpi.slaCompliancePct.toFixed(1)}</span>
                    <small>%</small>
                  </div>
                  <div className="d">promise: 10 min</div>
                </div>

                <div className={`ktag bl ${baseCong > 20 ? "hot" : ""}`} id="tagCong">
                  <div className="k">Congestion</div>
                  <div className="v">
                    <span>{baseCong.toFixed(1)}</span>
                    <small>% yielding</small>
                  </div>
                  <div className="d">util {Math.round(kpi.fleetUtilizationPct || 74)}%</div>
                </div>

                <div className={`ktag br ${kpi.pendingTasksCount > 40 ? "hot" : ""}`} id="tagBack">
                  <div className="k">Backlog</div>
                  <div className="v">
                    <span>{kpi.pendingTasksCount || 12}</span>
                    <small>orders</small>
                  </div>
                  <div className="d">cycle {Math.round(kpi.averageTaskDurationSec || 42)} s</div>
                </div>

                <div className="chaos-strip" id="chaos">
                  <span className="ttl">INJECT</span>
                  <button className={isFestiveSurgeActive ? "on" : ""} onClick={handleSurge}>
                    <svg><use href="#i-bolt" /></svg>
                    Diwali surge ×3
                  </button>
                  <button onClick={handleObstacle}>
                    <svg><use href="#i-cone" /></svg>
                    Drop obstacle
                  </button>
                  <button onClick={handleStall}>
                    <svg><use href="#i-wrench" /></svg>
                    Stall a bot
                  </button>
                  <button onClick={handleVip}>
                    <svg><use href="#i-star" /></svg>
                    VIP swarm
                  </button>
                  <span className="sep"></span>
                  <button onClick={handleResetStress}>
                    <svg><use href="#i-reset" /></svg>
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── 03 / COMPARE ── */}
        {activeStep === 2 && (
          <section className="scene on" data-scene="2">
            <div className="narr">
              <div className="chap">03 / COMPARE</div>
              <h1 className="headline">
                Same floor. Same orders. <em>Two fleets.</em>
              </h1>
              <p className="lede">
                Both twins share one random seed, so they get the identical order stream. The only difference is the fleet. More robots isn't always better: past a point, they block each other.
              </p>
              <div className="ctl">
                <div className="field">
                  <div className="row">
                    <label>Proposed fleet</label>
                    <span className="val" id="cFv">{proposedFleet}</span>
                  </div>
                  <input
                    type="range"
                    id="cF"
                    min="8"
                    max="160"
                    value={proposedFleet}
                    onChange={(e) => setProposedFleet(Number(e.target.value))}
                  />
                </div>
                <div className="field">
                  <div className="row">
                    <label>Demand surge</label>
                    <span className="val" id="cSv">×{(demandSurgeX / 10).toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    id="cS"
                    min="10"
                    max="40"
                    value={demandSurgeX}
                    onChange={(e) => setDemandSurgeX(Number(e.target.value))}
                  />
                </div>
                <button
                  className="btn ink"
                  id="cRun"
                  style={{ justifyContent: "center" }}
                  onClick={handleRestartCompare}
                >
                  <svg width="14" height="14"><use href="#i-reset" /></svg>
                  Restart both from t = 0
                </button>
              </div>
              <div className="callout" id="cSay">
                <div className="k">READ‑OUT</div>
                {ratio > 1.35 ? (
                  <span>
                    <b>⚠️ Diminishing Returns Warning:</b> Sizing fleet to <b>{proposedFleet} AMRs</b> ({(areaM2 / proposedFleet).toFixed(1)} m²/bot) surges congestion to <b>{propCong}% yielding</b>. Adding more robots creates cross-aisle gridlocks and degrades cycle time by <b>{deltaCycle}s</b>.
                  </span>
                ) : proposedFleet > fleetToday ? (
                  <span>
                    <b>Optimal Sizing: {proposedFleet} AMRs</b> ship <b>+{Math.abs(propThr - baseThr).toLocaleString("en-IN")} more orders/h</b> (+{deltaThrPct}%) with healthy aisle clearance ({(areaM2 / proposedFleet).toFixed(1)} m²/bot) and <b>{propSla}% SLA</b> during surge.
                  </span>
                ) : proposedFleet < fleetToday ? (
                  <span>
                    <b>Under-provisioned: {proposedFleet} AMRs</b> ship <b>{Math.abs(baseThr - propThr).toLocaleString("en-IN")} fewer orders/h</b> ({deltaThrPct}%), starving packing lines.
                  </span>
                ) : (
                  <span>Baseline and proposed fleets are identical. Adjust the proposed fleet slider.</span>
                )}
              </div>
            </div>

            <div className="canvas-area">
              <div className="cmp">
                <div className="tw">
                  <FacilityCanvas
                    interactive={true}
                    cameraPosition={compareCameraConfig.pos}
                    cameraTarget={compareCameraConfig.target}
                    style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
                  />
                  <div className="tag-name">
                    <i style={{ background: "var(--ink)" }}></i>
                    Baseline · <span id="cAn">{fleetToday}</span> AMRs
                  </div>
                </div>

                <div className="deltas" id="deltas">
                  <div className="vs">BASELINE · PROPOSED</div>

                  <div className="dl-card">
                    <div className="k">Throughput · orders/h</div>
                    <div className="row">
                      <span>{baseThr.toLocaleString("en-IN")}</span>
                      <span>{propThr.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="race">
                      <i style={{ width: `${basePct}%`, background: "var(--ink)" }}></i>
                      <i style={{ width: `${propPct}%`, background: "var(--signal)" }}></i>
                    </div>
                    <div
                      className="delta"
                      style={{ color: propThr >= baseThr ? "var(--teal)" : "var(--red)" }}
                    >
                      {propThr >= baseThr ? "+" : ""}{deltaThrPct}%
                    </div>
                  </div>

                  <div className="dl-card">
                    <div className="k">On‑time SLA</div>
                    <div className="row">
                      <span>{baseSla.toFixed(1)}%</span>
                      <span>{propSla.toFixed(1)}%</span>
                    </div>
                    <div className="delta" style={{ color: propSla >= baseSla ? "var(--teal)" : "var(--red)" }}>
                      {propSla >= baseSla ? "+" : ""}{deltaSla}%
                    </div>
                  </div>

                  <div className="dl-card">
                    <div className="k">Congestion · % yielding</div>
                    <div className="row">
                      <span>{baseCong.toFixed(1)}%</span>
                      <span>{propCong.toFixed(1)}%</span>
                    </div>
                    <div className="delta" style={{ color: propCong <= baseCong ? "var(--teal)" : "var(--red)" }}>
                      {propCong <= baseCong ? "−" : "+"}{deltaCong}%
                    </div>
                  </div>

                  <div className="dl-card">
                    <div className="k">Cycle time</div>
                    <div className="row">
                      <span>{baseCycle} s</span>
                      <span>{propCycle} s</span>
                    </div>
                    <div className="delta" style={{ color: propCycle <= baseCycle ? "var(--teal)" : "var(--red)" }}>
                      {propCycle <= baseCycle ? "−" : "+"}{deltaCycle} s
                    </div>
                  </div>
                </div>

                <div
                  className="tw"
                  style={{
                    borderColor: "var(--signal)",
                    boxShadow: "0 0 0 3px var(--signal-soft), var(--shadow)",
                  }}
                >
                  <FacilityCanvas
                    interactive={true}
                    cameraPosition={compareCameraConfig.pos}
                    cameraTarget={compareCameraConfig.target}
                    style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
                  />
                  <div className="tag-name">
                    <i style={{ background: "var(--signal)" }}></i>
                    Proposed · <span id="cBn">{proposedFleet}</span> AMRs
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── 04 / DECIDE ── */}
        {activeStep === 3 && (
          <section className="scene on" data-scene="3">
            <div className="narr">
              <div className="chap">04 / DECIDE</div>
              <h1 className="headline">
                One number for the <em>board</em>.
              </h1>
              <p className="lede">
                Built on audited Indian CapEx parameters, 18% GST Input Tax Credits, fast charging docks,
                and retained supervisory personnel.
              </p>

              <div className="callout">
                <div className="k">WHAT THE SIM CONTRIBUTED</div>
                Replaces <b>{financials.pickersSaved} manual picker equivalents</b> while retaining 5 essential specialists
                (1 supervisor, 2 robotics techs, 2 exception handlers).
              </div>
            </div>

            <div className="canvas-area">
              <div className="decide">
                {/* Boardroom Verdict Card */}
                <div className="verdict-card">
                  <div className="k">AUDITED PAYBACK PERIOD · PROPOSED FLEET</div>
                  <div className="payback">
                    {financials.paybackMonths}
                    <small>months</small>
                  </div>
                  <div className="stamp go">GO · BOARD READY</div>
                  <div className="say">
                    Capital investment pays back in {financials.paybackMonths} months based on simulated manual labor reduction,
                    GST input tax offset, and festive order capture.
                  </div>

                  {/* 30-Seed Monte Carlo Confidence Band */}
                  <div style={{ margin: "14px 0", padding: "10px", background: "rgba(14, 159, 142, 0.12)", border: "1px solid var(--teal)", borderRadius: "6px", fontSize: "11px", textAlign: "left" }}>
                    <div style={{ fontWeight: 700, color: "var(--teal)", marginBottom: "4px" }}>
                      📊 30-Seed Monte Carlo Ensemble (95% Confidence)
                    </div>
                    <div>
                      Payback Range: <b>{financials.mcPaybackLow} – {financials.mcPaybackHigh} months</b> (Median: <b>{financials.paybackMonths} mo</b>, σ = <b>{financials.mcStdDev} mo</b>)
                    </div>
                  </div>

                  <div className="facts">
                    <div>
                      <div className="k">NET SAVINGS / YR</div>
                      <div className="v">{financials.netAnnualStr}</div>
                    </div>
                    <div>
                      <div className="k">NET CAPEX (EX-GST)</div>
                      <div className="v">{financials.upfrontCapexStr}</div>
                    </div>
                    <div>
                      <div className="k">5‑YR NET VALUE</div>
                      <div className="v">{financials.fiveYearStr}</div>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowCitationsModal(true)}
                    style={{
                      marginTop: "14px",
                      width: "100%",
                      padding: "8px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "6px",
                      color: "#FFFFFF",
                      fontSize: "11px",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    📚 View Sourced Benchmarks & Legal Tax Basis →
                  </button>
                </div>

                {/* Interactive Money Inputs & Annual Ledger */}
                <div className="inputs">
                  <div className="panel">
                    <div className="sec" style={{ marginTop: 0 }}>
                      Operational inputs
                    </div>

                    <div className="field">
                      <div className="row">
                        <label>Picker wage (₹ / hour)</label>
                        <span className="val">₹{pickerWage}</span>
                      </div>
                      <input
                        type="range"
                        min="90"
                        max="400"
                        value={pickerWage}
                        onChange={(e) => setPickerWage(Number(e.target.value))}
                      />
                    </div>

                    <div className="field">
                      <div className="row">
                        <label>Picker productivity (orders / h)</label>
                        <span className="val">{pickerProductivity}</span>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="90"
                        value={pickerProductivity}
                        onChange={(e) => setPickerProductivity(Number(e.target.value))}
                      />
                    </div>

                    <div className="field">
                      <div className="row">
                        <label>Robot unit cost (₹ lakh / unit)</label>
                        <span className="val">₹{robotCapexLakh} L</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="15"
                        step="0.5"
                        value={robotCapexLakh}
                        onChange={(e) => setRobotCapexLakh(Number(e.target.value))}
                      />
                    </div>

                    <div className="field">
                      <div className="row">
                        <label>Electricity tariff (₹ / kWh)</label>
                        <span className="val">₹{electricityTariff}</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="16"
                        step="0.5"
                        value={electricityTariff}
                        onChange={(e) => setElectricityTariff(Number(e.target.value))}
                      />
                    </div>

                    <div className="field" style={{ margin: 0 }}>
                      <div className="row">
                        <label>Margin per surge order saved (₹)</label>
                        <span className="val">₹{surgeMarginINR}</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="150"
                        value={surgeMarginINR}
                        onChange={(e) => setSurgeMarginINR(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {/* Institutional CapEx & Annual Ledger Breakdown */}
                  <div className="panel">
                    <div className="sec" style={{ marginTop: 0 }}>
                      Institutional ledger & tax shield
                    </div>
                    <div className="ledger-row">
                      <span>Gross CapEx (Fleet + Docks + WMS)</span>
                      <b>{financials.grossCapexStr}</b>
                    </div>
                    <div className="ledger-row">
                      <span>18% GST Input Tax Credit (CGST Sec 16)</span>
                      <b style={{ color: "var(--teal)" }}>−{financials.gstItcStr} (Reclaimed)</b>
                    </div>
                    <div className="ledger-row">
                      <span>Net Capitalized CapEx Basis</span>
                      <b style={{ color: "var(--signal)" }}>{financials.upfrontCapexStr}</b>
                    </div>
                    <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "8px 0" }} />
                    <div className="ledger-row">
                      <span>Picker labor avoided (from simulation)</span>
                      <b style={{ color: "var(--teal)" }}>+{financials.annualLaborSavingsStr}</b>
                    </div>
                    <div className="ledger-row">
                      <span>Festive surge margin captured</span>
                      <b style={{ color: "var(--teal)" }}>+{financials.annualSurgeMarginStr}</b>
                    </div>
                    <div className="ledger-row">
                      <span>Fleet electricity draw</span>
                      <b style={{ color: "var(--mute)" }}>−{financials.annualElectricityStr}</b>
                    </div>
                    <div className="ledger-row">
                      <span>Annual maintenance reserve</span>
                      <b style={{ color: "var(--mute)" }}>−{financials.annualMaintenanceStr}</b>
                    </div>
                    <div className="ledger-row">
                      <span>Retained staff (1 Sup + 2 Techs + 2 Handlers)</span>
                      <b style={{ color: "var(--mute)" }}>−{financials.annualRetainedStaffStr}</b>
                    </div>
                    <div className="ledger-row tot">
                      <span>Net annual cash saving</span>
                      <b style={{ color: "var(--signal)" }}>{financials.netAnnualStr}</b>
                    </div>
                    <div className="note" style={{ fontSize: "10.5px", color: "var(--mute)", marginTop: "8px" }}>
                      Audited benchmark: TeamLease 2024-25 report + BESCOM HT-2 power tariff + CGST Act Section 16 ITC.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Story Footer Controls */}
      <footer className="s-foot">
        <button
          className="btn"
          disabled={activeStep === 0}
          onClick={() => setActiveStep((s) => Math.max(0, s - 1) as 0 | 1 | 2 | 3)}
        >
          ← Back
        </button>
        <span className="hint">
          Step {activeStep + 1} of 4 · Use arrows or stepper to navigate
        </span>
        <div className="prog">
          <i style={{ width: `${((activeStep + 1) / 4) * 100}%` }}></i>
        </div>
        <button
          className="btn primary"
          onClick={() => {
            if (activeStep < 3) {
              setActiveStep((s) => (s + 1) as 0 | 1 | 2 | 3);
            } else {
              setAppMode("OPERATOR");
            }
          }}
        >
          {activeStep < 3 ? `Next: ${stepLabels[activeStep + 1].title} →` : "Launch Operator View →"}
        </button>
      </footer>

      {/* Sourced Benchmarks & Assumptions Modal */}
      {showCitationsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => setShowCitationsModal(false)}
        >
          <div
            style={{
              background: "#1E293B",
              border: "1px solid #334155",
              borderRadius: "12px",
              maxWidth: "760px",
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: "24px",
              color: "#F8FAFC",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "24px" }}>📚</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>
                    Methodology & Sourced Benchmarks
                  </h2>
                  <div style={{ fontSize: "12px", color: "#94A3B8" }}>
                    Audited Indian logistics parameters, statutory markups, and published OEM specifications
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowCitationsModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94A3B8",
                  fontSize: "20px",
                  cursor: "pointer",
                  padding: "4px 8px",
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {INSTITUTIONAL_BENCHMARK_CITATIONS.map((c, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(15, 23, 42, 0.6)",
                    border: "1px solid #334155",
                    borderRadius: "8px",
                    padding: "14px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--teal)", textTransform: "uppercase" }}>
                      {c.category} · {c.parameter}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#F59E0B" }}>
                      {c.value}
                    </span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#E2E8F0", marginBottom: "6px" }}>
                    {c.notes}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748B" }}>
                    Source:{" "}
                    <a
                      href={c.citationUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#38BDF8", textDecoration: "underline" }}
                    >
                      {c.source}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "20px", textAlign: "right" }}>
              <button
                className="btn primary"
                onClick={() => setShowCitationsModal(false)}
                style={{ padding: "8px 20px", fontSize: "12px" }}
              >
                Close & Return to Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 30-Second Guided Spotlight Tour Modal */}
      {showTourModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => setShowTourModal(false)}
        >
          <div
            style={{
              background: "#0F172A",
              border: "1px solid var(--signal)",
              borderRadius: "14px",
              maxWidth: "540px",
              width: "100%",
              padding: "24px",
              color: "#F8FAFC",
              boxShadow: "0 0 30px rgba(255, 90, 31, 0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--signal)", letterSpacing: "1px" }}>
                SPOTLIGHT TOUR · STEP {tourStep + 1} OF 4
              </span>
              <button
                onClick={() => setShowTourModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94A3B8",
                  fontSize: "18px",
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </div>

            <h3 style={{ margin: "0 0 10px 0", fontSize: "18px", fontWeight: 700, color: "#FFFFFF" }}>
              {tourStep === 0 && "1. Build Your Facility Floor"}
              {tourStep === 1 && "2. Stress-Test with Real Chaos"}
              {tourStep === 2 && "3. Compare Real Manual Pickers vs AMRs"}
              {tourStep === 3 && "4. Boardroom Payback & GST Tax Shield"}
            </h3>

            <p style={{ fontSize: "13.5px", lineHeight: 1.6, color: "#CBD5E1", margin: "0 0 20px 0" }}>
              {tourStep === 0 &&
                "Configure warehouse footprint, rack cluster density, and AMR capacity. NexusTwin dynamically provisions directional aisles and cost grids in real time."}
              {tourStep === 1 &&
                "Simulate real operational shock: Diwali 3.2X flash load surges, sudden AMR motor drive faults, and cross-aisle blockages to observe autonomous deadlock avoidance."}
              {tourStep === 2 &&
                "Compare autonomous AMRs against real simulated human pickers with pushcarts, capturing true 0.75 m/s walking speeds, 1.5s turning inertia, and 18% shift fatigue."}
              {tourStep === 3 &&
                "View institutional Indian ROI with 18% GST Input Tax Credits, 11.5% WACC financing, fast opportunity charging docks, and retained supervisory personnel."}
            </p>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                className="btn"
                disabled={tourStep === 0}
                onClick={() => setTourStep((s) => Math.max(0, s - 1))}
                style={{ fontSize: "12px", padding: "6px 14px" }}
              >
                ← Previous
              </button>
              <div style={{ display: "flex", gap: "6px" }}>
                {[0, 1, 2, 3].map((s) => (
                  <span
                    key={s}
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: tourStep === s ? "var(--signal)" : "#334155",
                    }}
                  />
                ))}
              </div>
              <button
                className="btn primary"
                onClick={() => {
                  if (tourStep < 3) {
                    setTourStep((s) => s + 1);
                    setActiveStep((tourStep + 1) as 0 | 1 | 2 | 3);
                  } else {
                    setShowTourModal(false);
                  }
                }}
                style={{ fontSize: "12px", padding: "6px 14px" }}
              >
                {tourStep < 3 ? "Next →" : "Finish Tour ✓"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StoryMode;
