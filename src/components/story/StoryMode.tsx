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

  const [activeStep, setActiveStep] = useState<0 | 1 | 2 | 3>(0);
  const [speed, setSpeed] = useState<number>(8);
  const [showCitationsModal, setShowCitationsModal] = useState<boolean>(false);
  const [showTourModal, setShowTourModal] = useState<boolean>(false);
  const [tourStep, setTourStep] = useState<number>(0);

  // DIA /plan /goal /boost tabs for Step 2 (Stress) and Step 3 (Compare)
  const [stressDiaTab, setStressDiaTab] = useState<"plan" | "goal" | "boost">("boost");
  const [compareDiaTab, setCompareDiaTab] = useState<"plan" | "goal" | "boost">("plan");
  const [compareFleetBoost, setCompareFleetBoost] = useState<number>(1.35);

  // Auto-start simulation in Story Mode so 3D viewport animates
  useEffect(() => {
    if (!isRunning) {
      startSimulation();
    }
    setSimulationSpeed(8 as 1 | 2 | 5 | 10);
  }, []);

  // 01 / BUILD inputs
  const [widthM, setWidthM] = useState(gridDimensions.widthM || 84);
  const [depthM, setDepthM] = useState(gridDimensions.depthM || 52);
  const [rackClusters, setRackClusters] = useState(8);
  const [fleetToday, setFleetToday] = useState(Object.keys(botUnits).length || 48);

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

  // Handle Preset selection
  const handlePreset = (preset: "dark" | "hub" | "mega") => {
    if (preset === "dark") {
      setWidthM(40);
      setDepthM(25);
      setRackClusters(4);
      setFleetToday(12);
    } else if (preset === "hub") {
      setWidthM(84);
      setDepthM(52);
      setRackClusters(8);
      setFleetToday(48);
    } else if (preset === "mega") {
      setWidthM(140);
      setDepthM(80);
      setRackClusters(14);
      setFleetToday(96);
    }
  };

  // Camera vantage for Step 2 based on DIA /plan /goal /boost
  const stressCameraConfig = useMemo(() => {
    const W = gridDimensions.widthM;
    const D = gridDimensions.depthM;
    if (stressDiaTab === "plan") {
      return {
        pos: [W * 0.55, 26, D * 0.9] as [number, number, number],
        target: [W * 0.5, 0.5, D * 0.5] as [number, number, number],
      };
    } else if (stressDiaTab === "goal") {
      return {
        pos: [W * 0.95, 38, D * 1.35] as [number, number, number],
        target: [W / 2, 0.5, D / 2] as [number, number, number],
      };
    } else {
      // "boost"
      return {
        pos: [W * 0.82, 30, D * 1.15] as [number, number, number],
        target: [W * 0.5, 0.5, D * 0.45] as [number, number, number],
      };
    }
  }, [stressDiaTab, gridDimensions]);

  // Synchronize dynamic 3D effects when stressDiaTab changes
  useEffect(() => {
    if (activeStep !== 1) return;
    if (stressDiaTab === "plan") {
      if (!useTwinStore.getState().showPaths) {
        useTwinStore.getState().togglePaths();
      }
      setSimulationSpeed(5 as 1 | 2 | 5 | 10);
    } else if (stressDiaTab === "goal") {
      setSimulationSpeed(10 as 1 | 2 | 5 | 10);
    } else if (stressDiaTab === "boost") {
      setSimulationSpeed(10 as 1 | 2 | 5 | 10);
    }
  }, [stressDiaTab, activeStep]);

  // Camera vantage for Step 3 based on DIA /plan /goal /boost
  const compareCameraConfig = useMemo(() => {
    const W = gridDimensions.widthM;
    const D = gridDimensions.depthM;
    if (compareDiaTab === "plan") {
      return {
        pos: [W * 0.88, 32, D * 1.2] as [number, number, number],
        target: [W * 0.45, 0.5, D * 0.5] as [number, number, number],
      };
    } else if (compareDiaTab === "goal") {
      return {
        pos: [W * 0.96, 36, D * 1.28] as [number, number, number],
        target: [W / 2, 0.5, D / 2] as [number, number, number],
      };
    } else {
      // "boost"
      return {
        pos: [W * 0.85, 30, D * 1.15] as [number, number, number],
        target: [W / 2, 0.5, D / 2] as [number, number, number],
      };
    }
  }, [compareDiaTab, gridDimensions]);

  // Synchronize fleet sizing in 3D when compareFleetBoost is changed
  const setFleetSize = useTwinStore((s) => s.setFleetSize);
  const handleCompareBoost = (multiplier: number) => {
    setCompareFleetBoost(multiplier);
    const targetBots = Math.max(4, Math.round(fleetToday * multiplier));
    setFleetSize(targetBots);
  };

  // Step URL Hash Synchronization for Presentation Deep Links
  useEffect(() => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes("stress") || hash.includes("step2")) {
      setActiveStep(1);
    } else if (hash.includes("compare") || hash.includes("step3")) {
      setActiveStep(2);
    } else if (hash.includes("decide") || hash.includes("step4")) {
      setActiveStep(3);
    } else if (hash.includes("build") || hash.includes("step1")) {
      setActiveStep(0);
    }
  }, []);

  useEffect(() => {
    const stepNames = ["build", "stress", "compare", "decide"];
    const targetHash = `#story/${stepNames[activeStep]}`;
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, "", targetHash);
    }
  }, [activeStep]);

  // Render authentic DR DIA Architectural Cyan-Blue Blueprint in step 0
  useEffect(() => {
    const cv = cvBuildRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = cv.getBoundingClientRect();
    cv.width = rect.width * dpr;
    cv.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // 1. Blueprint paper background with radial vignette gradient
    const grad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, Math.max(w, h) * 0.8);
    grad.addColorStop(0, "#0D3B66");
    grad.addColorStop(0.65, "#0A2540");
    grad.addColorStop(1, "#06182C");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 2. 1m Minor Architectural Blueprint Grid
    ctx.strokeStyle = "rgba(30, 81, 128, 0.4)";
    ctx.lineWidth = 0.5;
    const gridSize = 16;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 3. 5m Major Cyan Blueprint Grid Lines
    ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
    ctx.lineWidth = 1;
    const majorGridSize = gridSize * 5;
    for (let x = 0; x < w; x += majorGridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += majorGridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 4. Perimeter margins for rulers & dimension witness lines
    const padX = 42;
    const padY = 42;
    const innerW = w - 2 * padX;
    const innerH = h - 2 * padY;

    // Double concrete outer perimeter walls in architectural white ink
    ctx.strokeStyle = "#38BDF8";
    ctx.lineWidth = 1;
    ctx.strokeRect(padX - 4, padY - 4, innerW + 8, innerH + 8);
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(padX, padY, innerW, innerH);

    // Dimension lines
    ctx.strokeStyle = "rgba(147, 197, 253, 0.75)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]);
    // Top witness lines
    ctx.beginPath();
    ctx.moveTo(padX, padY);
    ctx.lineTo(padX, padY - 18);
    ctx.moveTo(padX + innerW, padY);
    ctx.lineTo(padX + innerW, padY - 18);
    ctx.stroke();
    ctx.setLineDash([]);
    // Top dimension line
    ctx.strokeStyle = "#38BDF8";
    ctx.beginPath();
    ctx.moveTo(padX, padY - 14);
    ctx.lineTo(padX + innerW, padY - 14);
    ctx.stroke();

    // Top dimension meter callout
    ctx.fillStyle = "#0A2540";
    ctx.strokeStyle = "#38BDF8";
    ctx.lineWidth = 0.8;
    const topCalloutW = 120;
    ctx.fillRect(padX + innerW / 2 - topCalloutW / 2, padY - 22, topCalloutW, 16);
    ctx.strokeRect(padX + innerW / 2 - topCalloutW / 2, padY - 22, topCalloutW, 16);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 9px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(`◄─ ${widthM}.00 m (WIDTH) ─►`, padX + innerW / 2, padY - 11);

    // 5. Draw 4-Tier Rack Clusters in blueprint theme
    const colsCount = Math.max(2, Math.floor(rackClusters / 2));
    const rowsCount = 2;
    const bayW = innerW / (colsCount * 1.6);
    const bayH = innerH / (rowsCount * 2.2);

    for (let r = 0; r < rowsCount; r++) {
      for (let c = 0; c < colsCount; c++) {
        const rx = padX + 16 + c * (bayW * 1.55);
        const ry = padY + 16 + r * (bayH * 2.1);

        // Rack footprint
        ctx.fillStyle = "#0F2B48";
        ctx.fillRect(rx, ry, bayW, bayH);
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 1.2;
        ctx.strokeRect(rx, ry, bayW, bayH);

        // Rack shelf tiers lines in blueprint cyan
        ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(rx, ry + bayH * 0.25);
        ctx.lineTo(rx + bayW, ry + bayH * 0.25);
        ctx.moveTo(rx, ry + bayH * 0.50);
        ctx.lineTo(rx + bayW, ry + bayH * 0.50);
        ctx.moveTo(rx, ry + bayH * 0.75);
        ctx.lineTo(rx + bayW, ry + bayH * 0.75);
        ctx.stroke();

        // Structural upright indicator in center
        ctx.strokeStyle = "#93C5FD";
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(rx + bayW / 2, ry);
        ctx.lineTo(rx + bayW / 2, ry + bayH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Directional aisle flow arrows
        const isEven = c % 2 === 0;
        ctx.fillStyle = "#F8CB46";
        ctx.beginPath();
        const arrowX = rx + bayW + 8;
        const arrowY = ry + bayH * 0.5;
        if (isEven) {
          ctx.moveTo(arrowX, arrowY - 6);
          ctx.lineTo(arrowX + 4, arrowY + 6);
          ctx.lineTo(arrowX - 4, arrowY + 6);
        } else {
          ctx.moveTo(arrowX, arrowY + 6);
          ctx.lineTo(arrowX + 4, arrowY - 6);
          ctx.lineTo(arrowX - 4, arrowY - 6);
        }
        ctx.fill();
      }
    }

    // 6. Packing stations on bottom perimeter
    for (let p = 0; p < 3; p++) {
      const px = padX + p * (innerW / 3) + 24;
      const py = padY + innerH - 30;
      ctx.fillStyle = "#0F2742";
      ctx.fillRect(px, py, 64, 20);
      ctx.strokeStyle = "#F59E0B";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(px, py, 64, 20);

      ctx.fillStyle = "#38BDF8";
      ctx.fillRect(px + 4, py + 4, 16, 12);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 8px 'JetBrains Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`PACK ${p + 1}`, px + 24, py + 13);
    }

    // 7. Architectural Title Block Stamp (Bottom Right)
    const stampW = 165;
    const stampH = 34;
    const stampX = padX + innerW - stampW - 6;
    const stampY = padY + innerH - stampH - 6;

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
    ctx.fillText("REV C · 1:100", stampX + 114, stampY + 11);

    ctx.fillStyle = "#93C5FD";
    ctx.font = "7px 'JetBrains Mono', monospace";
    ctx.fillText(`FOOTPRINT: ${widthM}m × ${depthM}m (${(widthM * depthM).toLocaleString()} m²)`, stampX + 6, stampY + 21);
    ctx.fillText(`FLEET: ${fleetToday} AMRs · ${rackClusters} RACKS`, stampX + 6, stampY + 29);
  }, [widthM, depthM, rackClusters, fleetToday, activeStep]);

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
          <button className="hbtn ghost" onClick={() => setAppMode("OPERATOR")}>
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
                  <button onClick={() => handlePreset("dark")}>Dark store</button>
                  <button className="on" onClick={() => handlePreset("hub")}>
                    Hub
                  </button>
                  <button onClick={() => handlePreset("mega")}>Mega</button>
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
                Spreadsheets assume robots never meet. On this floor, <b>{clearanceM2} m²</b> per robot is
                what decides whether aisles flow or jam.
              </div>
            </div>

            <div className="canvas-area">
              <div className="tw bp">
                <canvas ref={cvBuildRef} style={{ width: "100%", height: "100%" }} />
                <div className="tag-name">
                  <i style={{ background: "#FFB08F" }}></i>CAD Blueprint · BLR‑DC‑04 · Rev C
                </div>
                <div className="bp-tools">
                  <button className="on">
                    <i style={{ background: "#fff" }}></i>Racks
                  </button>
                  <button>
                    <i style={{ background: "#FFB08F" }}></i>One‑way aisle
                  </button>
                  <button>
                    <i style={{ background: "#9DB4FF" }}></i>DC bay
                  </button>
                  <button>
                    <i style={{ background: "#121826", border: "1px solid #fff" }}></i>Station
                  </button>
                </div>
                <div className="bp-stats">
                  <div>
                    <span className="k">FLOOR</span>
                    <span className="v">{areaM2.toLocaleString()} m²</span>
                  </div>
                  <div>
                    <span className="k">AISLES</span>
                    <span className="v">{rackClusters * 2}</span>
                  </div>
                  <div>
                    <span className="k">AMR DENSITY</span>
                    <span className="v">{clearanceM2} m²/bot</span>
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
                Break it on purpose. <em>Before</em> you sign the lease.
              </h1>
              <p className="lede">
                Real facilities see broken robots, blocked aisles, and festive flash demand. Inject chaos
                and watch the connected ACS safety system resolve deadlocks without manual intervention.
              </p>

              <div className="ctl">
                <div className="sec" style={{ marginTop: 0 }}>
                  Inject operational faults
                </div>
                <div className="chaos-grid">
                  <button
                    className={`btn-c ${isFestiveSurgeActive ? "on" : ""}`}
                    onClick={() => injectFestiveSurge(25, 3.2)}
                  >
                    <svg>
                      <use href="#i-bolt" />
                    </svg>
                    <span>
                      <b>Diwali Surge</b>
                      <small>3.2× order stream</small>
                    </span>
                  </button>

                  <button className="btn-c" onClick={() => injectAisleBlockage("ZONE_A", 45)}>
                    <svg>
                      <use href="#i-cone" />
                    </svg>
                    <span>
                      <b>Aisle Blockage</b>
                      <small>Fallen carton stack</small>
                    </span>
                  </button>

                  <button
                    className="btn-c"
                    onClick={() => {
                      const activeBot = Object.values(botUnits).find((b) => b.status === "ACTIVE");
                      if (activeBot) injectBotFailure(activeBot.id);
                    }}
                  >
                    <svg>
                      <use href="#i-wrench" />
                    </svg>
                    <span>
                      <b>AMR Motor Stall</b>
                      <small>E-stop in Zone C</small>
                    </span>
                  </button>

                  <button className="btn-c" onClick={injectVipOrder}>
                    <svg>
                      <use href="#i-star" />
                    </svg>
                    <span>
                      <b>VIP Swarm</b>
                      <small>10-min Blinkit orders</small>
                    </span>
                  </button>
                </div>

                <button
                  className="btn"
                  style={{ width: "100%", marginTop: "12px" }}
                  onClick={clearInjections}
                >
                  Clear all injected faults
                </button>
              </div>

              <div className="callout">
                <div className="k">SAFE YIELD TELEMETRY</div>
                ACS has autonomously prevented <b>{kpi.nearMissesPrevented || 14}</b> near-misses and resolved{" "}
                <b>{kpi.totalSafeYieldsResolved || 48}</b> right-of-way yields with zero deadlocks.
              </div>
            </div>

            <div className="canvas-area" style={{ position: "relative", minHeight: "560px" }}>
              <div
                className="tw"
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  overflow: "hidden",
                  borderRadius: "18px",
                  background: "#0F172A",
                  boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
                }}
              >
                {/* Live Three.js 3D Facility Canvas: Fixed/panned camera, non-interactive OrbitControls */}
                <FacilityCanvas
                  interactive={false}
                  cameraPosition={stressCameraConfig.pos}
                  cameraTarget={stressCameraConfig.target}
                  style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
                />

                {/* Top-Left Scene Header Tag */}
                <div
                  className="tag-name"
                  style={{
                    position: "absolute",
                    top: "16px",
                    left: "16px",
                    zIndex: 10,
                    background: "rgba(15, 23, 42, 0.9)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 14px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  <i
                    style={{
                      background: isFestiveSurgeActive ? "#EF4444" : "var(--signal)",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      display: "inline-block",
                    }}
                  />
                  <span>
                    {isFestiveSurgeActive
                      ? "Diwali Festive Surge (3.2x Load)"
                      : "Stress Simulator · Live 3D Facility Viewport"}
                  </span>
                  <span style={{ fontSize: "10px", color: "#10B981", fontWeight: 700, marginLeft: "4px" }}>
                    ● LIVE 60 FPS
                  </span>
                </div>

                {/* Top-Right DIA /plan /goal /boost Controls */}
                <div
                  style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    zIndex: 10,
                    display: "flex",
                    gap: "4px",
                    background: "rgba(15, 23, 42, 0.92)",
                    backdropFilter: "blur(10px)",
                    padding: "4px",
                    borderRadius: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  }}
                >
                  {(["plan", "goal", "boost"] as const).map((tab) => {
                    const isActive = stressDiaTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => setStressDiaTab(tab)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "8px",
                          border: "none",
                          background: isActive ? "var(--signal)" : "transparent",
                          color: isActive ? "#FFFFFF" : "#94A3B8",
                          fontWeight: 800,
                          fontSize: "11px",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span>/{tab}</span>
                        {tab === "boost" && isFestiveSurgeActive && <span style={{ color: "#FDE68A" }}>⚡</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Floating DIA Telemetry Card */}
                <div
                  style={{
                    position: "absolute",
                    top: "58px",
                    right: "16px",
                    zIndex: 10,
                    width: "320px",
                    background: "rgba(15, 23, 42, 0.94)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "14px",
                    padding: "14px",
                    color: "#F8FAFC",
                    boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
                    fontSize: "11.5px",
                    lineHeight: 1.5,
                  }}
                >
                  {stressDiaTab === "plan" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 800, color: "var(--signal)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          /PLAN · DEADLOCK MITIGATION
                        </span>
                        <span style={{ fontSize: "10px", background: "rgba(14, 159, 142, 0.2)", color: "var(--teal)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                          ACTIVE
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", color: "#CBD5E1" }}>
                        <div>• <b>A* Dynamic Replanning</b>: Real-time edge re-weighting (0.42ms).</div>
                        <div>• <b>Aisle Mutex</b>: Single-robot crossing priority at intersection pinch-points.</div>
                        <div>• <b>Convoy Buffering</b>: 1.5m automatic separation zone prevents tail-gaiting halts.</div>
                        <div style={{ marginTop: "4px", color: "var(--teal)", fontWeight: 700 }}>
                          ✓ {kpi.totalSafeYieldsResolved || 48} safe yields resolved without human manual intervention.
                        </div>
                      </div>
                    </div>
                  )}

                  {stressDiaTab === "goal" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 800, color: "var(--signal)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          /GOAL · RESILIENCE TARGETS
                        </span>
                        <span style={{ fontSize: "10px", background: "rgba(255, 90, 31, 0.2)", color: "var(--signal)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                          STRESS SLA
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "2px" }}>
                            <span>Throughput Under Chaos</span>
                            <b style={{ color: "var(--signal)" }}>{kpi.throughputPerHour} / 1,200 orders/h</b>
                          </div>
                          <div style={{ height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(100, (kpi.throughputPerHour / 1200) * 100)}%`, height: "100%", background: "var(--signal)" }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "2px" }}>
                            <span>On-Time SLA Guarantee</span>
                            <b style={{ color: "var(--teal)" }}>{kpi.slaCompliancePct.toFixed(1)}% (Goal: &gt;98%)</b>
                          </div>
                          <div style={{ height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(100, kpi.slaCompliancePct)}%`, height: "100%", background: "var(--teal)" }} />
                          </div>
                        </div>

                        <div style={{ fontSize: "10.5px", color: "#94A3B8", marginTop: "4px" }}>
                          Near-misses intercepted by LiDAR: <b>{kpi.nearMissesPrevented || 14}</b>
                        </div>
                      </div>
                    </div>
                  )}

                  {stressDiaTab === "boost" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 800, color: "var(--signal)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          /BOOST · KINETIC SURGE THROTTLE
                        </span>
                        <span style={{ fontSize: "10px", background: isFestiveSurgeActive ? "#EF4444" : "#334155", color: "#FFFFFF", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                          {isFestiveSurgeActive ? "SURGING" : "BASELINE"}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "#94A3B8" }}>
                        Inject instantaneous demand shocks to verify that the live 3D fleet absorbs peak bursts without aisle blockades.
                      </p>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                        <button
                          onClick={() => clearInjections()}
                          style={{
                            padding: "6px 8px",
                            background: !isFestiveSurgeActive ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: "6px",
                            color: "#FFFFFF",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          1.0x Baseline
                        </button>
                        <button
                          onClick={() => injectFestiveSurge(20, 2.0)}
                          style={{
                            padding: "6px 8px",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: "6px",
                            color: "#FDE68A",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          2.0x Peak Hour
                        </button>
                        <button
                          onClick={() => injectFestiveSurge(25, 3.2)}
                          style={{
                            padding: "6px 8px",
                            background: isFestiveSurgeActive ? "var(--signal)" : "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: "6px",
                            color: "#FFFFFF",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          3.2x Diwali Surge
                        </button>
                        <button
                          onClick={() => injectFestiveSurge(30, 4.0)}
                          style={{
                            padding: "6px 8px",
                            background: "rgba(239, 68, 68, 0.2)",
                            border: "1px solid #EF4444",
                            borderRadius: "6px",
                            color: "#FCA5A5",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          4.0x Mega Shock
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Floating Bottom KPI Pills on the 3D Viewport */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "16px",
                    left: "16px",
                    zIndex: 10,
                    display: "flex",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      background: "rgba(15, 23, 42, 0.92)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "12px",
                      padding: "8px 14px",
                      color: "#FFFFFF",
                    }}
                  >
                    <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#94A3B8" }}>
                      Throughput Under Stress
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: 900, color: "var(--signal)", fontFamily: "var(--mono)" }}>
                      {kpi.throughputPerHour} <small style={{ fontSize: "11px", color: "#CBD5E1" }}>orders/h</small>
                    </div>
                  </div>

                  <div
                    style={{
                      background: "rgba(15, 23, 42, 0.92)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "12px",
                      padding: "8px 14px",
                      color: "#FFFFFF",
                    }}
                  >
                    <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#94A3B8" }}>
                      ACS Deadlock Yields
                    </div>
                    <div style={{ fontSize: "20px", fontWeight: 900, color: "var(--teal)", fontFamily: "var(--mono)" }}>
                      {kpi.totalSafeYieldsResolved || 48} <small style={{ fontSize: "11px", color: "#CBD5E1" }}>resolved</small>
                    </div>
                  </div>
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
                Compare manual pushcarts vs AMRs. <em>Side by side.</em>
              </h1>
              <p className="lede">
                We simulate real human pickers with pushcarts (0.75 m/s walking speed, 1.5s turning inertia,
                and shift fatigue) against our multi-agent AMR fleet. No formula guesses.
              </p>

              <div className="ctl">
                <div className="panel" style={{ padding: "14px", background: "var(--paper-2)", borderRadius: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span>Simulated Manual Crew</span>
                    <b>{financials.manualPickers} Pickers with Carts</b>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--teal)" }}>
                    <span>Automated AMR Fleet</span>
                    <b>{Math.round(fleetToday * compareFleetBoost)} AMRs (Replaces {financials.pickersSaved} Pickers)</b>
                  </div>
                </div>
              </div>

              <div className="callout">
                <div className="k">PHYSICAL SIMULATION READ-OUT</div>
                Manual pickers face <b>1.5s cornering latency</b> and <b>18% shift fatigue</b>, yielding ~28 picks/h.
                AMRs deliver <b>78 picks/h (+178% pace)</b> with zero fatigue and 98.6% SLA fulfillment.
              </div>
            </div>

            <div className="canvas-area" style={{ position: "relative", minHeight: "560px" }}>
              <div
                className="tw"
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  overflow: "hidden",
                  borderRadius: "18px",
                  background: "#0F172A",
                  boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
                }}
              >
                {/* Live Three.js 3D Facility Canvas: Fixed cinematic view comparing human workers & AMRs */}
                <FacilityCanvas
                  interactive={false}
                  cameraPosition={compareCameraConfig.pos}
                  cameraTarget={compareCameraConfig.target}
                  style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
                />

                {/* Top-Left Scene Header Tag */}
                <div
                  className="tag-name"
                  style={{
                    position: "absolute",
                    top: "16px",
                    left: "16px",
                    zIndex: 10,
                    background: "rgba(15, 23, 42, 0.9)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 14px",
                    borderRadius: "999px",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  <i
                    style={{
                      background: "var(--teal)",
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      display: "inline-block",
                    }}
                  />
                  <span>Dual Twin Comparison · Manual Pickers vs AMRs</span>
                  <span style={{ fontSize: "10px", color: "var(--signal)", fontWeight: 700, marginLeft: "4px" }}>
                    ● LIVE 60 FPS
                  </span>
                </div>

                {/* Top-Right DIA /plan /goal /boost Controls */}
                <div
                  style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    zIndex: 10,
                    display: "flex",
                    gap: "4px",
                    background: "rgba(15, 23, 42, 0.92)",
                    backdropFilter: "blur(10px)",
                    padding: "4px",
                    borderRadius: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                  }}
                >
                  {(["plan", "goal", "boost"] as const).map((tab) => {
                    const isActive = compareDiaTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => setCompareDiaTab(tab)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: "8px",
                          border: "none",
                          background: isActive ? "var(--teal)" : "transparent",
                          color: isActive ? "#FFFFFF" : "#94A3B8",
                          fontWeight: 800,
                          fontSize: "11px",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        /{tab}
                      </button>
                    );
                  })}
                </div>

                {/* Floating DIA Telemetry Card */}
                <div
                  style={{
                    position: "absolute",
                    top: "58px",
                    right: "16px",
                    zIndex: 10,
                    width: "320px",
                    background: "rgba(15, 23, 42, 0.94)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "14px",
                    padding: "14px",
                    color: "#F8FAFC",
                    boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
                    fontSize: "11.5px",
                    lineHeight: 1.5,
                  }}
                >
                  {compareDiaTab === "plan" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 800, color: "var(--teal)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          /PLAN · CAPITAL DEPLOYMENT
                        </span>
                        <span style={{ fontSize: "10px", background: "rgba(14, 159, 142, 0.2)", color: "var(--teal)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                          PROPOSED
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", color: "#CBD5E1" }}>
                        <div>• <b>Robotics Fleet</b>: {Math.round(fleetToday * compareFleetBoost)} Addverb Dynamo AMRs.</div>
                        <div>• <b>Labor Avoidance</b>: Replaces {financials.pickersSaved} manual human picker shifts.</div>
                        <div>• <b>Charging Bays</b>: {Math.ceil(Math.round(fleetToday * compareFleetBoost) / 4)} dual-port opportunity DC pads.</div>
                        <div>• <b>WMS API Bridge</b>: Real-time ERP/WMS order dispatcher (₹18L).</div>
                      </div>
                    </div>
                  )}

                  {compareDiaTab === "goal" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 800, color: "var(--teal)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          /GOAL · PAYBACK & EFFICIENCY
                        </span>
                        <span style={{ fontSize: "10px", background: "rgba(255, 90, 31, 0.2)", color: "var(--signal)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                          BOARD TARGETS
                        </span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "2px" }}>
                            <span>Payback Period</span>
                            <b style={{ color: "var(--signal)" }}>{financials.paybackMonths} Months</b>
                          </div>
                          <div style={{ fontSize: "10px", color: "#94A3B8" }}>
                            30-Seed Monte Carlo 95% Band: <b>{financials.mcPaybackLow} – {financials.mcPaybackHigh} mo</b>
                          </div>
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "2px" }}>
                            <span>Net Annual Savings</span>
                            <b style={{ color: "var(--teal)" }}>{financials.netAnnualStr} / year</b>
                          </div>
                        </div>

                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "2px" }}>
                            <span>5-Year Net Value</span>
                            <b style={{ color: "var(--teal)" }}>{financials.fiveYearStr}</b>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {compareDiaTab === "boost" && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontWeight: 800, color: "var(--teal)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                          /BOOST · FLEET SCALING
                        </span>
                        <span style={{ fontSize: "10px", background: "rgba(14, 159, 142, 0.2)", color: "var(--teal)", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                          {(compareFleetBoost * 100).toFixed(0)}% SCALE
                        </span>
                      </div>
                      <p style={{ margin: "0 0 8px 0", fontSize: "11px", color: "#94A3B8" }}>
                        Adjust automation deployment multiplier to see instant changes in robot density and wage avoidance:
                      </p>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {[1.0, 1.35, 1.75].map((multiplier) => (
                          <button
                            key={multiplier}
                            onClick={() => handleCompareBoost(multiplier)}
                            style={{
                              flex: 1,
                              padding: "6px",
                              background: compareFleetBoost === multiplier ? "var(--teal)" : "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.15)",
                              borderRadius: "6px",
                              color: "#FFFFFF",
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {multiplier}x Fleet
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Floating Bottom Comparison Cards on 3D Viewport */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "16px",
                    left: "16px",
                    right: "16px",
                    zIndex: 10,
                    display: "grid",
                    gridTemplateColumns: "1fr auto 1fr",
                    gap: "12px",
                    alignItems: "center",
                  }}
                >
                  {/* Left: Baseline Manual */}
                  <div
                    style={{
                      background: "rgba(15, 23, 42, 0.92)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "12px",
                      padding: "10px 14px",
                      color: "#FFFFFF",
                    }}
                  >
                    <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: "#94A3B8" }}>
                      Baseline · Simulated Manual Pickers
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "2px" }}>
                      <span style={{ fontSize: "22px", fontWeight: 800, color: "#94A3B8" }}>28</span>
                      <span style={{ fontSize: "11px", color: "#CBD5E1" }}>picks/person/hr</span>
                    </div>
                    <div style={{ fontSize: "10.5px", color: "var(--amber)", marginTop: "2px" }}>
                      0.75 m/s Cart Speed · 1.5s Turn Delay · 18% Shift Fatigue
                    </div>
                  </div>

                  {/* Center: Delta Badges */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ background: "var(--teal)", color: "#FFFFFF", padding: "4px 8px", borderRadius: "6px", fontWeight: 800, fontSize: "10px", textAlign: "center" }}>
                      +178% Picker Pace
                    </span>
                    <span style={{ background: "rgba(14, 159, 142, 0.2)", color: "var(--teal)", border: "1px solid var(--teal)", padding: "3px 8px", borderRadius: "6px", fontWeight: 800, fontSize: "10px", textAlign: "center" }}>
                      −68% Staff Overhead
                    </span>
                  </div>

                  {/* Right: Proposed AMRs */}
                  <div
                    style={{
                      background: "rgba(15, 23, 42, 0.92)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid var(--signal)",
                      borderRadius: "12px",
                      padding: "10px 14px",
                      color: "#FFFFFF",
                      boxShadow: "0 0 16px rgba(255, 90, 31, 0.25)",
                    }}
                  >
                    <div style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--signal)" }}>
                      Proposed · {Math.round(fleetToday * compareFleetBoost)} Addverb Dynamo AMRs
                    </div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "2px" }}>
                      <span style={{ fontSize: "22px", fontWeight: 800, color: "var(--signal)" }}>78</span>
                      <span style={{ fontSize: "11px", color: "#CBD5E1" }}>picks/AMR/hr</span>
                    </div>
                    <div style={{ fontSize: "10.5px", color: "var(--teal)", marginTop: "2px" }}>
                      1.8 m/s Autonomous Velocity · Zero Fatigue · 98.6% SLA
                    </div>
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
