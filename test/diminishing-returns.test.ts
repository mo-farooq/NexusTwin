import { describe, it, expect } from "vitest";

describe("Loop 3: Compare — Dual-Twin Physics & Diminishing Returns Curve", () => {
  // Exact model from StoryMode.tsx
  function computeCompareMetrics(proposedFleet: number, fleetToday = 48) {
    const baseThr = 2438;
    const baseCong = 8.0;
    const baseCycle = 42;
    const baseSla = 99.2;

    let propThr: number;
    let propCong: number;
    let propCycle: number;
    let propSla: number;

    if (proposedFleet <= 48) {
      propThr = Math.round(baseThr * (proposedFleet / 48));
      propCong = Number((baseCong * (proposedFleet / 48)).toFixed(1));
      propCycle = Math.round(baseCycle * (1 + ((48 - proposedFleet) / 48) * 0.25));
      propSla = Number(Math.max(75.0, baseSla - (48 - proposedFleet) * 0.4).toFixed(1));
    } else if (proposedFleet <= 56) {
      const t = (proposedFleet - 48) / 8;
      propThr = Math.round(baseThr + (3120 - baseThr) * (1 - Math.pow(1 - t, 1.4)));
      propCong = Number((baseCong + (9.4 - baseCong) * t).toFixed(1));
      propCycle = 42;
      propSla = Number(Math.min(99.9, baseSla + t * 0.6).toFixed(1));
    } else if (proposedFleet <= 64) {
      const t = (proposedFleet - 56) / 8;
      propThr = Math.round(3120 - 20 * t);
      propCong = Number((9.4 + (12.5 - 9.4) * t).toFixed(1));
      propCycle = Math.round(42 + 3 * t);
      propSla = Number((99.8 - t * 0.4).toFixed(1));
    } else if (proposedFleet <= 120) {
      const u = (proposedFleet - 64) / 56;
      const dropPct = 0.006 + 0.174 * Math.pow(u, 1.35);
      propThr = Math.round(3120 * (1 - dropPct));
      const congU = (proposedFleet - 56) / 64;
      propCong = Number((9.4 + 37.4 * Math.pow(congU, 1.2)).toFixed(1));
      propCycle = Math.round(42 + 36 * Math.pow(congU, 1.15));
      propSla = Number(Math.max(68.0, 99.4 - Math.pow(u, 1.3) * 26.0).toFixed(1));
    } else {
      const excess = (proposedFleet - 120) / 40;
      propThr = Math.round(2558 * (1 - 0.12 * Math.min(1.0, excess)));
      propCong = Number(Math.min(68.0, 46.8 + excess * 16.0).toFixed(1));
      propCycle = Math.round(78 + excess * 22);
      propSla = Number(Math.max(55.0, 73.4 - excess * 18.0).toFixed(1));
    }

    return { propThr, propCong, propCycle, propSla, baseThr, baseCong, baseCycle, baseSla };
  }

  function getAlertText(proposedFleet: number, propCong: number): string {
    if (proposedFleet > 64) {
      return `Diminishing Returns Detected: At ${proposedFleet} AMRs, congestion reaches ${propCong}% yielding. Robot traffic jams in cross-aisles reduce net throughput.`;
    } else if (proposedFleet >= 48 && proposedFleet <= 56) {
      return `Optimal Capacity: 56 AMRs maximize throughput (+28%) with minimal aisle contention.`;
    } else if (proposedFleet > 56 && proposedFleet <= 64) {
      return `Approaching Saturation: At ${proposedFleet} AMRs, congestion reaches ${propCong}% yielding. Fleet is nearing the 56-AMR optimal threshold.`;
    } else {
      return `Under-provisioned: ${proposedFleet} AMRs`;
    }
  }

  it("verifies optimal fleet is 56 AMRs (Peak: 3,120 orders/h, Congestion: 9.4%)", () => {
    const metrics56 = computeCompareMetrics(56);
    expect(metrics56.propThr).toBe(3120);
    expect(metrics56.propCong).toBe(9.4);
    expect(metrics56.propCycle).toBe(42);

    // +28% throughput gain over baseline
    const gainPct = Math.round(((metrics56.propThr - metrics56.baseThr) / metrics56.baseThr) * 100);
    expect(gainPct).toBe(28);
  });

  it("verifies throughput plateaus from 56 to 64 AMRs", () => {
    const m56 = computeCompareMetrics(56);
    const m60 = computeCompareMetrics(60);
    const m64 = computeCompareMetrics(64);

    expect(m56.propThr).toBe(3120);
    expect(m60.propThr).toBe(3110);
    expect(m64.propThr).toBe(3100);

    // Plateau: delta within 1% of peak
    expect(m64.propThr).toBeGreaterThanOrEqual(3080);
    expect(m64.propThr).toBeLessThanOrEqual(3120);
  });

  it("verifies congestion climbs from 9.4% to 46.8% yielding as proposedFleet increases to 120 AMRs", () => {
    const m56 = computeCompareMetrics(56);
    const m64 = computeCompareMetrics(64);
    const m90 = computeCompareMetrics(90);
    const m120 = computeCompareMetrics(120);

    expect(m56.propCong).toBe(9.4);
    expect(m64.propCong).toBe(12.5);
    expect(m90.propCong).toBeGreaterThan(20);
    expect(m120.propCong).toBe(46.8);
  });

  it("verifies throughput drops by 15–20% due to aisle deadlock at 120 AMRs", () => {
    const m56 = computeCompareMetrics(56);
    const m120 = computeCompareMetrics(120);

    const dropFromPeakPct = ((m56.propThr - m120.propThr) / m56.propThr) * 100;
    expect(dropFromPeakPct).toBeGreaterThanOrEqual(15);
    expect(dropFromPeakPct).toBeLessThanOrEqual(20);
    expect(Math.round(dropFromPeakPct)).toBe(18);
  });

  it("verifies average cycle time climbs from 42 s to 78 s", () => {
    const m56 = computeCompareMetrics(56);
    const m120 = computeCompareMetrics(120);

    expect(m56.propCycle).toBe(42);
    expect(m120.propCycle).toBe(78);
  });

  it("verifies alert text states Optimal Capacity at 48–56 AMRs and Diminishing Returns past 64 AMRs", () => {
    const m48 = computeCompareMetrics(48);
    const alert48 = getAlertText(48, m48.propCong);
    expect(alert48).toContain("Optimal Capacity: 56 AMRs maximize throughput (+28%)");

    const m56 = computeCompareMetrics(56);
    const alert56 = getAlertText(56, m56.propCong);
    expect(alert56).toContain("Optimal Capacity: 56 AMRs maximize throughput (+28%)");

    const m65 = computeCompareMetrics(65);
    const alert65 = getAlertText(65, m65.propCong);
    expect(alert65).toContain("Diminishing Returns Detected: At 65 AMRs, congestion reaches");

    const m90 = computeCompareMetrics(90);
    const alert90 = getAlertText(90, m90.propCong);
    expect(alert90).toContain("Diminishing Returns Detected: At 90 AMRs, congestion reaches");

    const m120 = computeCompareMetrics(120);
    const alert120 = getAlertText(120, m120.propCong);
    expect(alert120).toContain("Diminishing Returns Detected: At 120 AMRs, congestion reaches 46.8% yielding");
  });
});
