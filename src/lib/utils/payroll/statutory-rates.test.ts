/**
 * Statutory rate resolution — C-13 / H-32. Seeds → resolved rates → engine.
 * Pure logic — no database, no env.
 */

import { describe, it, expect } from "vitest";
import { buildBirTaxTableSeeds } from "@/lib/db/seeds/bir-tax-tables";
import { buildGsisRateSeeds } from "@/lib/db/seeds/gsis-rates";
import { buildPagibigRateSeeds } from "@/lib/db/seeds/pagibig-rates";
import { buildPhilhealthRateSeeds } from "@/lib/db/seeds/philhealth-rates";
import { computeGSIS, computePagIBIG, computePhilHealth } from "./deductions";
import { computeWithholdingTax } from "./tax";
import {
  resolveStatutoryRates,
  type StatutoryRateRows,
} from "./statutory-rates";

const SEED_ROWS: StatutoryRateRows = {
  gsis: buildGsisRateSeeds(),
  philHealth: buildPhilhealthRateSeeds(),
  pagIbig: buildPagibigRateSeeds(),
  bir: buildBirTaxTableSeeds(),
};

describe("resolveStatutoryRates — seeded tables", () => {
  const rates = resolveStatutoryRates(SEED_ROWS, "2026-11-15");

  it("resolves every table from the seeds", () => {
    expect(rates.gsis).toEqual({ personalRate: 0.09, employerRate: 0.12 });
    expect(rates.philHealth).toEqual({
      employeeRate: 0.025,
      employerRate: 0.025,
      salaryFloor: 10_000,
      salaryCeiling: 100_000,
    });
    expect(rates.pagIbig?.maxContribution).toBe(200);
    expect(rates.taxBrackets?.monthly.map((b) => b.floor)).toEqual([
      0, 20_833, 33_333, 66_667, 166_667, 666_667,
    ]);
    expect(rates.taxBrackets?.semiMonthly.map((b) => b.baseAmount)).toEqual([
      0, 0, 937.5, 4270.7, 16770.7, 91770.7,
    ]);
  });

  it("H-32: Pag-IBIG cap is ₱200 per side from Feb 2024, ₱100 before", () => {
    const now = computePagIBIG(30_000, "monthly", rates.pagIbig);
    expect(now).toEqual({ personal: "200.00", employer: "200.00" });

    const old = resolveStatutoryRates(SEED_ROWS, "2024-01-31");
    expect(computePagIBIG(30_000, "monthly", old.pagIbig)).toEqual({
      personal: "100.00",
      employer: "100.00",
    });
  });

  it("computes TRAIN withholding from the DB brackets", () => {
    // 1,875 + 20% × (40,000 − 33,333)
    expect(computeWithholdingTax(40_000, "monthly", rates)).toBeCloseTo(
      3208.4,
      6,
    );
    // 937.50 + 20% × (20,000 − 16,667)
    expect(computeWithholdingTax(20_000, "semi-monthly", rates)).toBeCloseTo(
      1604.1,
      6,
    );
    // 4,270.70 + 25% × (40,000 − 33,333)
    expect(computeWithholdingTax(40_000, "semi-monthly", rates)).toBeCloseTo(
      5937.45,
      6,
    );
  });

  it("GSIS / PhilHealth from the seeds match the statutory shares", () => {
    expect(computeGSIS(30_000, "monthly", rates.gsis)).toEqual({
      personal: "2700.00",
      employer: "3600.00",
      lifeInsurance: "0.00",
    });
    expect(
      computePhilHealth(30_000, "monthly", rates.philHealth),
    ).toMatchObject({ personal: "750.00", employer: "750.00" });
  });
});

describe("resolveStatutoryRates — DB values win over constants", () => {
  it("uses a changed DB rate instead of the built-in constant", () => {
    const rates = resolveStatutoryRates(
      {
        ...SEED_ROWS,
        gsis: [
          ...SEED_ROWS.gsis,
          {
            employeeRate: "0.1000",
            employerRate: "0.1300",
            effectiveDate: "2026-01-01",
          },
        ],
      },
      "2026-11-15",
    );
    expect(computeGSIS(10_000, "monthly", rates.gsis).personal).toBe("1000.00");
  });

  it("ignores rows that are not yet effective", () => {
    const rates = resolveStatutoryRates(
      {
        ...SEED_ROWS,
        gsis: [
          ...SEED_ROWS.gsis,
          {
            employeeRate: "0.1000",
            employerRate: "0.1300",
            effectiveDate: "2027-01-01",
          },
        ],
      },
      "2026-11-15",
    );
    expect(rates.gsis?.personalRate).toBe(0.09);
  });

  it("dedupes repeated seed inserts of the same bracket", () => {
    const rows = { ...SEED_ROWS, bir: [...SEED_ROWS.bir, ...SEED_ROWS.bir] };
    const rates = resolveStatutoryRates(rows, "2026-11-15");
    expect(rates.taxBrackets?.monthly).toHaveLength(6);
  });
});

describe("resolveStatutoryRates — invalid tables fall back to constants", () => {
  it("leaves a table undefined when nothing is effective yet", () => {
    const rates = resolveStatutoryRates(SEED_ROWS, "1990-01-01");
    expect(rates.gsis).toBeUndefined();
    expect(rates.pagIbig).toBeUndefined();
    expect(rates.taxBrackets).toBeUndefined();
  });

  it("rejects a bracket table with a discontinuous base tax", () => {
    const bir = SEED_ROWS.bir.map((r) =>
      r.periodType === "monthly" && r.bracketFrom === "66667.00"
        ? { ...r, baseTax: "9999.00" }
        : r,
    );
    const rates = resolveStatutoryRates({ ...SEED_ROWS, bir }, "2026-11-15");
    expect(rates.taxBrackets).toBeUndefined();
    // Constants still produce a tax, never a silent zero.
    expect(computeWithholdingTax(40_000, "monthly", rates)).toBeGreaterThan(0);
  });

  it("rejects a zero employee rate (never a silent zero deduction)", () => {
    const rates = resolveStatutoryRates(
      {
        ...SEED_ROWS,
        gsis: [
          {
            employeeRate: "0",
            employerRate: "0.12",
            effectiveDate: "2026-01-01",
          },
        ],
      },
      "2026-11-15",
    );
    expect(rates.gsis).toBeUndefined();
    expect(computeGSIS(10_000, "monthly", rates.gsis).personal).toBe("900.00");
  });
});
