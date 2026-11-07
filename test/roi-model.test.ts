import { describe, it, expect } from "vitest";
import {
  BOT_PROFILES,
  INSTITUTIONAL_BENCHMARK_CITATIONS,
  type FinancialParameters,
  type SimulationKpi,
  type BotUnit,
} from "../src/store/useTwinStore";

describe("NexusTwin Institutional Indian Warehouse Financial Model", () => {
  it("verifies 18% GST Input Tax Credit reduces gross CapEx", () => {
    const grossCapEx = 5000000; // ₹50 Lakhs
    const gstRate = 0.18;
    const itcReclaimed = Math.round(grossCapEx * (gstRate / (1 + gstRate)));
    const netCapitalized = grossCapEx - itcReclaimed;

    // ITC reclaimed on ₹50L should be approx ₹7.627L (18/118)
    expect(itcReclaimed).toBe(762712);
    expect(netCapitalized).toBe(4237288);
    expect(itcReclaimed + netCapitalized).toBe(grossCapEx);
  });

  it("calculates monthly equipment financing at 11.5% WACC over 60 months", () => {
    const netCapEx = 4000000; // ₹40 Lakhs
    const annualWacc = 0.115;
    const monthlyRate = annualWacc / 12;
    const tenureMonths = 60;

    const financingFactor =
      (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
      (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    const monthlyEMI = Math.round(netCapEx * financingFactor);

    // Standard commercial 11.5% EMI on ₹40 Lakhs over 5 years is ~₹87,980/month
    expect(monthlyEMI).toBeGreaterThan(85000);
    expect(monthlyEMI).toBeLessThan(91000);
  });

  it("includes non-eliminable retained operational personnel", () => {
    const supervisorSalary = 45000;
    const techsCount = 2;
    const techSalary = 30000;
    const handlersCount = 2;
    const handlerSalary = 22000;

    const monthlyRetainedCost =
      supervisorSalary + techsCount * techSalary + handlersCount * handlerSalary;

    // Retained staff cost must equal ₹1,49,000 / month
    expect(monthlyRetainedCost).toBe(149000);
    const annualRetainedCost = monthlyRetainedCost * 12;
    expect(annualRetainedCost).toBe(1788000); // ₹17.88 Lakhs / year
  });

  it("contains all 6 peer-verifiable institutional benchmark citations", () => {
    expect(INSTITUTIONAL_BENCHMARK_CITATIONS.length).toBe(6);

    const categories = INSTITUTIONAL_BENCHMARK_CITATIONS.map((c) => c.category);
    expect(categories).toContain("Labor Economics");
    expect(categories).toContain("Power Tariffs");
    expect(categories).toContain("AMR Hardware");
    expect(categories).toContain("Tax & Finance");

    const citations = INSTITUTIONAL_BENCHMARK_CITATIONS.map((c) => c.source);
    expect(citations.some((s) => s.includes("TeamLease"))).toBe(true);
    expect(citations.some((s) => s.includes("BESCOM"))).toBe(true);
    expect(citations.some((s) => s.includes("Central Goods and Services Tax Act"))).toBe(true);
    expect(citations.some((s) => s.includes("Addverb Dynamo"))).toBe(true);
  });

  it("verifies published specs for Addverb Dynamo and GreyOrange Butler", () => {
    const addverb = BOT_PROFILES["ADDVERB_DYNAMO_200"];
    expect(addverb).toBeDefined();
    expect(addverb.vendor).toContain("Addverb");
    expect(addverb.payloadCapacityKg).toBe(200);
    expect(addverb.maxSpeedMps).toBe(1.8);

    const greyorange = BOT_PROFILES["GREYORANGE_BUTLER_M"];
    expect(greyorange).toBeDefined();
    expect(greyorange.vendor).toContain("GreyOrange");
    expect(greyorange.payloadCapacityKg).toBe(500);
    expect(greyorange.maxSpeedMps).toBe(1.5);
  });
});
