import { describe, it, expect } from "vitest";
import { buildOverridePatch } from "./override";

const record = {
  grossPay: "15000.00",
  totalDeductions: "2500.00",
  netPay: "12500.00",
  basicPay: "15000.00",
  withholdingTax: "500.00",
  gsisEmployer: "1800.00",
};

describe("buildOverridePatch (H-16 journal balance)", () => {
  it("moves gross and net when an earning line changes", () => {
    expect(buildOverridePatch(record, "basicPay", "15100.50")).toEqual({
      basicPay: "15100.50",
      grossPay: "15100.50",
      netPay: "12600.50",
    });
  });

  it("moves total deductions and net when a personal deduction changes", () => {
    expect(buildOverridePatch(record, "withholdingTax", "450.25")).toEqual({
      withholdingTax: "450.25",
      totalDeductions: "2450.25",
      netPay: "12549.75",
    });
  });

  it("changes only the employer share itself", () => {
    expect(buildOverridePatch(record, "gsisEmployer", "1900.00")).toEqual({
      gsisEmployer: "1900.00",
    });
  });

  it("rejects overriding derived totals", () => {
    for (const field of ["grossPay", "totalDeductions", "netPay"]) {
      expect(() => buildOverridePatch(record, field, "1.00")).toThrow(
        /computed from the pay lines/,
      );
    }
  });

  it("keeps gross − deductions = net to the centavo", () => {
    const p = buildOverridePatch(record, "withholdingTax", "0.10");
    const gross = 1500000;
    const ded = Math.round(Number(p.totalDeductions) * 100);
    const net = Math.round(Number(p.netPay) * 100);
    expect(gross - ded).toBe(net);
  });
});
