/**
 * Loan ledger amortization tests — PAY-009
 *
 * Covers:
 * - Schedule matching (semi_monthly every run, monthly on second-half runs)
 * - Partial final deduction (never deduct past the running balance)
 * - Skipping inactive, unstarted, and zero-balance loans
 * - Totals across multiple loans
 */

import { describe, it, expect } from "vitest";
import {
  computeLoanDeductions,
  monthlyScheduleApplies,
  collectionWindowKey,
  type LoanForDeduction,
} from "./loans";

function loan(overrides: Partial<LoanForDeduction> = {}): LoanForDeduction {
  return {
    id: "loan-1",
    deductionSchedule: "semi_monthly",
    deductionAmount: "1000.00",
    runningBalance: "5000.00",
    startDate: "2026-01-01",
    status: "active",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// monthlyScheduleApplies
// ---------------------------------------------------------------------------

describe("monthlyScheduleApplies", () => {
  it("does not apply to a first-half period (end on the 15th)", () => {
    expect(monthlyScheduleApplies("2026-07-15")).toBe(false);
  });

  it("applies to a second-half period (end on the 30th/31st)", () => {
    expect(monthlyScheduleApplies("2026-07-31")).toBe(true);
    expect(monthlyScheduleApplies("2026-06-30")).toBe(true);
  });

  it("applies to a February second-half period (end on the 28th)", () => {
    expect(monthlyScheduleApplies("2026-02-28")).toBe(true);
  });

  it("throws on a malformed period end", () => {
    expect(() => monthlyScheduleApplies("garbage")).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// collectionWindowKey (F-LOAN-DOUBLE cross-period dedup)
// ---------------------------------------------------------------------------

describe("collectionWindowKey", () => {
  it("keys monthly loans by calendar month", () => {
    expect(collectionWindowKey("monthly", "2026-07-31")).toBe("2026-07");
    expect(collectionWindowKey("monthly", "2026-07-15")).toBe("2026-07");
  });

  it("collides two monthly runs in the same month (double-collect guard)", () => {
    expect(collectionWindowKey("monthly", "2026-07-15")).toBe(
      collectionWindowKey("monthly", "2026-07-31"),
    );
  });

  it("separates monthly runs in different months", () => {
    expect(collectionWindowKey("monthly", "2026-07-31")).not.toBe(
      collectionWindowKey("monthly", "2026-08-31"),
    );
  });

  it("keys semi_monthly loans by half-month", () => {
    expect(collectionWindowKey("semi_monthly", "2026-07-15")).toBe(
      "2026-07-H1",
    );
    expect(collectionWindowKey("semi_monthly", "2026-07-31")).toBe(
      "2026-07-H2",
    );
  });

  it("separates the two halves of the same month for semi_monthly", () => {
    expect(collectionWindowKey("semi_monthly", "2026-07-15")).not.toBe(
      collectionWindowKey("semi_monthly", "2026-07-31"),
    );
  });

  it("throws on a malformed period end", () => {
    expect(() => collectionWindowKey("monthly", "nope")).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// computeLoanDeductions
// ---------------------------------------------------------------------------

describe("computeLoanDeductions", () => {
  it("deducts a semi-monthly loan every run", () => {
    const result = computeLoanDeductions([loan()], "2026-07-15");

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toEqual({
      loanId: "loan-1",
      amount: 1_000,
      balanceAfter: 4_000,
      paidOff: false,
    });
    expect(result.total).toBe(1_000);
  });

  it("skips monthly loans on first-half runs and collects on second-half runs", () => {
    const monthly = loan({ deductionSchedule: "monthly" });

    const firstHalf = computeLoanDeductions([monthly], "2026-07-15");
    expect(firstHalf.entries).toHaveLength(0);
    expect(firstHalf.total).toBe(0);

    const secondHalf = computeLoanDeductions([monthly], "2026-07-31");
    expect(secondHalf.entries).toHaveLength(1);
    expect(secondHalf.total).toBe(1_000);
  });

  it("applies a partial final deduction and flags the loan paid off", () => {
    const nearlyPaid = loan({ runningBalance: "350.50" });

    const result = computeLoanDeductions([nearlyPaid], "2026-07-31");

    expect(result.entries[0]).toEqual({
      loanId: "loan-1",
      amount: 350.5,
      balanceAfter: 0,
      paidOff: true,
    });
    expect(result.total).toBe(350.5);
  });

  it("skips loans that have not started yet", () => {
    const future = loan({ startDate: "2026-08-01" });
    const result = computeLoanDeductions([future], "2026-07-31");
    expect(result.entries).toHaveLength(0);
  });

  it("skips paid-off and cancelled loans", () => {
    const paidOff = loan({ status: "paid_off" });
    const cancelled = loan({ id: "loan-2", status: "cancelled" });
    const result = computeLoanDeductions([paidOff, cancelled], "2026-07-31");
    expect(result.entries).toHaveLength(0);
  });

  it("skips loans with a zero running balance", () => {
    const drained = loan({ runningBalance: "0.00" });
    const result = computeLoanDeductions([drained], "2026-07-31");
    expect(result.entries).toHaveLength(0);
  });

  it("sums amortizations across multiple loans", () => {
    const loans = [
      loan(),
      loan({ id: "loan-2", deductionAmount: "500.00", runningBalance: "250.00" }),
      loan({ id: "loan-3", deductionSchedule: "monthly" }),
    ];

    const result = computeLoanDeductions(loans, "2026-07-31");

    expect(result.entries).toHaveLength(3);
    // 1,000 (full) + 250 (partial final) + 1,000 (monthly, second half)
    expect(result.total).toBe(2_250);
    expect(result.entries[1]?.paidOff).toBe(true);
  });
});
