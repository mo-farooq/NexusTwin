import { describe, it, expect } from "vitest";
import {
  VERIFIED_BENCHMARK_TABS,
  calculateStoryFinancials,
} from "../src/components/story/StoryMode";
import * as fs from "fs";
import * as path from "path";

describe("Loop 4: Boardroom Decide & Sourced Benchmarks", () => {
  it("verifies the 4 statutory benchmark tabs are present with exact citations", () => {
    expect(VERIFIED_BENCHMARK_TABS.length).toBe(4);

    const labels = VERIFIED_BENCHMARK_TABS.map((t) => t.tabLabel);
    expect(labels).toContain("Labor Wages");
    expect(labels).toContain("GST Input Tax Credit");
    expect(labels).toContain("Equipment CapEx");
    expect(labels).toContain("Electricity Tariff");

    const summaries = VERIFIED_BENCHMARK_TABS.map((t) => t.summaryText);
    expect(summaries[0]).toBe(
      "Labor Wages: ₹180/hr Indian logistics baseline, 2 shifts, EPF/ESI statutory contributions."
    );
    expect(summaries[1]).toBe(
      "GST Input Tax Credit: 18% ITC reclaim under Section 16(1) of CGST Act on industrial automation."
    );
    expect(summaries[2]).toBe(
      "Equipment CapEx: ₹6.5L Lite AMR unit cost + ₹1.2L DC Fast-Charging Dock amortized."
    );
    expect(summaries[3]).toBe(
      "Electricity Tariff: ₹8.5/kWh industrial commercial warehouse rate."
    );
  });

  it("verifies legal statutory citations in each benchmark tab", () => {
    const labor = VERIFIED_BENCHMARK_TABS.find((t) => t.id === "labor")!;
    expect(labor.legalCitation).toContain("Code on Wages 2019");
    expect(labor.legalCitation).toContain("Employees' Provident Funds Act 1952");
    expect(labor.legalCitation).toContain("ESI Act 1948");
    expect(labor.source).toContain("TeamLease");

    const gst = VERIFIED_BENCHMARK_TABS.find((t) => t.id === "gst")!;
    expect(gst.legalCitation).toContain("Section 16(1)");
    expect(gst.legalCitation).toContain("Central Goods and Services Tax");
    expect(gst.source).toContain("Central Goods and Services Tax Act 2017");

    const capex = VERIFIED_BENCHMARK_TABS.find((t) => t.id === "capex")!;
    expect(capex.primaryMetric).toContain("₹6.5L AMR + ₹1.2L Dock");
    expect(capex.source).toContain("Addverb");

    const tariff = VERIFIED_BENCHMARK_TABS.find((t) => t.id === "tariff")!;
    expect(tariff.primaryMetric).toContain("₹8.5 / kWh");
    expect(tariff.source).toContain("BESCOM");
  });

  it("produces exact audited baseline financials (14.8 Months, ₹1.75 Cr CapEx, ₹1.42 Cr Net Savings, ₹5.35 Cr 5-yr)", () => {
    const baseline = calculateStoryFinancials();

    expect(baseline.paybackMonths).toBe(14.8);
    expect(baseline.upfrontCapexStr).toBe("₹1.75 Cr");
    expect(baseline.netAnnualStr).toBe("₹1.42 Cr");
    expect(baseline.fiveYearStr).toBe("₹5.35 Cr");
    expect(baseline.grossCapexStr).toBe("₹2.07 Cr");
    expect(baseline.gstItcStr).toBe("₹31.5L");
    expect(baseline.mcPaybackLow).toBe(13.2);
    expect(baseline.mcPaybackHigh).toBe(16.5);
    expect(baseline.mcStdDev).toBe(0.8);
  });

  it("dynamically reacts to picker wage sensitivity slider", () => {
    const higherWage = calculateStoryFinancials(220);
    // Higher wage increases labor avoidance savings, reducing payback period
    expect(higherWage.paybackMonths).toBeLessThan(14.8);
    expect(higherWage.netAnnualSavings).toBeGreaterThan(14200000);
    expect(higherWage.fiveYearNetValue).toBeGreaterThan(53500000);

    const lowerWage = calculateStoryFinancials(140);
    expect(lowerWage.paybackMonths).toBeGreaterThan(14.8);
    expect(lowerWage.netAnnualSavings).toBeLessThan(14200000);
  });

  it("dynamically reacts to robot capex sensitivity slider", () => {
    const higherCapex = calculateStoryFinancials(180, 8.5); // ₹8.5L unit cost
    expect(higherCapex.netCapitalizedCapexINR).toBeGreaterThan(17500000);
    expect(higherCapex.paybackMonths).toBeGreaterThan(14.8);

    const lowerCapex = calculateStoryFinancials(180, 5.0); // ₹5.0L unit cost
    expect(lowerCapex.netCapitalizedCapexINR).toBeLessThan(17500000);
    expect(lowerCapex.paybackMonths).toBeLessThan(14.8);
  });

  it("dynamically reacts to electricity tariff and festive surge margin sliders", () => {
    const higherPowerTariff = calculateStoryFinancials(180, 6.5, 14.0);
    expect(higherPowerTariff.netAnnualSavings).toBeLessThan(14200000);
    expect(higherPowerTariff.paybackMonths).toBeGreaterThan(14.8);

    const higherSurgeMargin = calculateStoryFinancials(180, 6.5, 8.5, 80);
    expect(higherSurgeMargin.netAnnualSavings).toBeGreaterThan(14200000);
    expect(higherSurgeMargin.paybackMonths).toBeLessThan(14.8);
  });

  it("verifies source code contains all required Loop 4 validation tokens", () => {
    const storyModePath = path.resolve(__dirname, "../src/components/story/StoryMode.tsx");
    const content = fs.readFileSync(storyModePath, "utf-8");

    // grep -rn "Launch Operator View" src/components/story/StoryMode.tsx
    expect(content).toContain("Launch Operator View →");

    // grep -rn "Monte Carlo" src/components/story/StoryMode.tsx
    expect(content).toContain("30-Seed Monte Carlo Confidence (95% Interval)");
    expect(content).toContain("simulation randomness was rigorously evaluated across 30 distinct seeds");

    // Emerald green badge #059669
    expect(content).toContain("#059669");
    expect(content).toContain("GO · BOARD READY");

    // Boardroom Verdict Card metrics
    expect(content).toContain("Audited Payback:");
    expect(content).toContain("ANNUAL NET SAVINGS");
    expect(content).toContain("NET CAPEX (EX-GST)");
    expect(content).toContain("5-YEAR NET ECONOMIC VALUE");

    // Benchmark modal trigger
    expect(content).toContain("📚 View Sourced Benchmarks & Legal Tax Basis →");
  });
});
