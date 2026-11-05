/**
 * BIR Withholding Tax computations — Phase 09 Part A
 *
 * Implements TRAIN Law (RA 10963) tax brackets effective January 1, 2023.
 * Revenue Regulations No. 8-2018, as amended by RR 2-2023.
 *
 * Monthly tax brackets (2023 onwards):
 *   ≤ 20,833              → 0
 *   20,833 – 33,332       → 15% of excess over 20,833
 *   33,332 – 66,666       → 1,875 + 20% of excess over 33,332
 *   66,666 – 166,666      → 8,541.80 + 25% of excess over 66,666
 *   166,666 – 666,666     → 33,541.80 + 30% of excess over 166,666
 *   > 666,666             → 183,541.80 + 35% of excess over 666,666
 *
 * Semi-monthly brackets = monthly brackets ÷ 2.
 * Annual brackets = monthly brackets × 12.
 */

import { roundHalfEven } from "./rounding";
import type { StatutoryRates, TaxBracket, TaxComputationDetail } from "./types";

// ---------------------------------------------------------------------------
// Tax bracket definitions — fallback when bir_tax_tables has no effective
// rows (C-13). Loaded DB brackets are passed in via `rates`.
// ---------------------------------------------------------------------------

/**
 * Monthly TRAIN Law brackets (2023+).
 * All peso amounts from RR 2-2023.
 */
export const MONTHLY_TAX_BRACKETS: readonly TaxBracket[] = [
  { floor: 0, ceiling: 20_833, baseAmount: 0, rate: 0 },
  { floor: 20_833, ceiling: 33_333, baseAmount: 0, rate: 0.15 },
  { floor: 33_332, ceiling: 66_666, baseAmount: 1_875, rate: 0.2 },
  { floor: 66_666, ceiling: 166_666, baseAmount: 8_541.8, rate: 0.25 },
  { floor: 166_666, ceiling: 666_666, baseAmount: 33_541.8, rate: 0.3 },
  { floor: 666_666, ceiling: Infinity, baseAmount: 183_541.8, rate: 0.35 },
] as const;

/**
 * Semi-monthly TRAIN Law brackets (monthly / 2).
 * BIR withholds on each semi-monthly payroll run.
 */
export const SEMI_MONTHLY_TAX_BRACKETS: readonly TaxBracket[] = [
  { floor: 0, ceiling: 10_416.5, baseAmount: 0, rate: 0 },
  { floor: 10_416.5, ceiling: 16_666.5, baseAmount: 0, rate: 0.15 },
  { floor: 16_666, ceiling: 33_333, baseAmount: 937.5, rate: 0.2 },
  { floor: 33_333, ceiling: 83_333, baseAmount: 4_270.9, rate: 0.25 },
  { floor: 83_333, ceiling: 333_333, baseAmount: 16_770.9, rate: 0.3 },
  { floor: 333_333, ceiling: Infinity, baseAmount: 91_770.9, rate: 0.35 },
] as const;

/**
 * Annual TRAIN Law brackets (monthly × 12).
 * Used for annualized computation (alphalist, year-end adjustment).
 */
export const ANNUAL_TAX_BRACKETS: readonly TaxBracket[] = [
  { floor: 0, ceiling: 250_000, baseAmount: 0, rate: 0 },
  { floor: 250_000, ceiling: 400_000, baseAmount: 0, rate: 0.15 },
  { floor: 400_000, ceiling: 800_000, baseAmount: 22_500, rate: 0.2 },
  { floor: 800_000, ceiling: 2_000_000, baseAmount: 102_500, rate: 0.25 },
  { floor: 2_000_000, ceiling: 8_000_000, baseAmount: 402_500, rate: 0.3 },
  { floor: 8_000_000, ceiling: Infinity, baseAmount: 2_202_500, rate: 0.35 },
] as const;

// ---------------------------------------------------------------------------
// Core tax computation
// ---------------------------------------------------------------------------

/**
 * Compute withholding tax given a taxable income and a bracket table.
 * Returns both the tax amount and computation detail for audit trail.
 *
 * @param taxableIncome - Taxable income for the period
 * @param brackets - Bracket table matching the period type
 * @returns Tax amount (rounded half-even to 2 decimals) and detail
 */
function computeTaxFromBrackets(
  taxableIncome: number,
  brackets: readonly TaxBracket[],
): { tax: number; detail: TaxComputationDetail } {
  if (taxableIncome < 0) {
    throw new RangeError(
      `computeTaxFromBrackets: taxableIncome must be >= 0, got ${taxableIncome}`,
    );
  }

  // Find applicable bracket. Income in a gap between published brackets
  // (e.g. 33,332.50 between 33,332 and 33,333) belongs to the bracket with
  // the greatest floor at or below it — never the top bracket.
  let bracket = brackets.find(
    (b) => taxableIncome >= b.floor && taxableIncome < b.ceiling,
  );
  if (!bracket) {
    for (const b of brackets) {
      if (b.floor <= taxableIncome && (!bracket || b.floor > bracket.floor)) {
        bracket = b;
      }
    }
  }
  if (!bracket) {
    throw new RangeError(
      `computeTaxFromBrackets: no bracket covers taxable income ${taxableIncome}`,
    );
  }

  const excess = taxableIncome - bracket.floor;
  const tax = bracket.baseAmount + excess * bracket.rate;

  return {
    tax,
    detail: {
      taxableIncome,
      bracketFloor: bracket.floor,
      bracketTaxBase: bracket.baseAmount,
      bracketRate: bracket.rate,
      excessAmount: excess,
      tax,
    },
  };
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Compute taxable income by subtracting mandatory deductions from gross pay.
 *
 * Per BIR rules, the following are excluded from taxable compensation:
 * - GSIS personal contributions
 * - PhilHealth personal contributions
 * - Pag-IBIG personal contributions
 * - Other mandatory government deductions
 *
 * @param grossPay - Total gross pay for the period
 * @param mandatoryDeductions - Sum of GSIS personal + PhilHealth personal + PagIBIG personal
 * @returns Taxable income (non-negative)
 */
export function computeTaxableIncome(
  grossPay: number,
  mandatoryDeductions: number,
): number {
  if (grossPay < 0) {
    throw new RangeError(
      `computeTaxableIncome: grossPay must be >= 0, got ${grossPay}`,
    );
  }
  if (mandatoryDeductions < 0) {
    throw new RangeError(
      `computeTaxableIncome: mandatoryDeductions must be >= 0, got ${mandatoryDeductions}`,
    );
  }
  const taxable = grossPay - mandatoryDeductions;
  return roundHalfEven(Math.max(0, taxable), 2);
}

/**
 * Compute withholding tax for a semi-monthly or monthly payroll period.
 *
 * Uses TRAIN Law brackets. Semi-monthly uses halved brackets.
 * For semi-monthly payroll, this is the tax withheld each 15th and 30th.
 *
 * @param taxableIncome - Taxable income for the period
 * @param periodType - 'semi-monthly' or 'monthly'
 * @param rates - Effective statutory rates (bir_tax_tables); constants when undefined
 * @returns Withholding tax amount (unrounded; callers round to centavos)
 */
export function computeWithholdingTax(
  taxableIncome: number,
  periodType: "semi-monthly" | "monthly" = "semi-monthly",
  rates?: StatutoryRates,
): number {
  return computeTaxFromBrackets(taxableIncome, bracketsFor(periodType, rates))
    .tax;
}

/** Effective bracket table: loaded bir_tax_tables rows, else the constants. */
function bracketsFor(
  periodType: "semi-monthly" | "monthly",
  rates?: StatutoryRates,
): readonly TaxBracket[] {
  if (periodType === "semi-monthly") {
    return rates?.taxBrackets?.semiMonthly ?? SEMI_MONTHLY_TAX_BRACKETS;
  }
  return rates?.taxBrackets?.monthly ?? MONTHLY_TAX_BRACKETS;
}

/**
 * Compute withholding tax on a supplemental payment that stacks on top of the
 * employee's regular monthly taxable compensation (BIR cumulative method).
 *
 * Supplemental payments (RATA excess, taxable bonuses, salary differential)
 * must NOT be taxed from the zero bracket in isolation — doing so understates
 * withholding because the regular salary has already consumed the lower
 * brackets. The correct marginal tax is:
 *   tax(regular + supplemental) - tax(regular)
 * both evaluated against the MONTHLY brackets.
 *
 * @param regularMonthlyTaxable - Employee's regular monthly taxable income
 * @param supplementalTaxable - Taxable portion of the supplemental payment
 * @param rates - Effective statutory rates (bir_tax_tables); constants when undefined
 * @returns Withholding tax attributable to the supplemental payment
 */
export function computeSupplementalWithholding(
  regularMonthlyTaxable: number,
  supplementalTaxable: number,
  rates?: StatutoryRates,
): number {
  if (regularMonthlyTaxable < 0) {
    throw new RangeError(
      `computeSupplementalWithholding: regularMonthlyTaxable must be >= 0, got ${regularMonthlyTaxable}`,
    );
  }
  if (supplementalTaxable < 0) {
    throw new RangeError(
      `computeSupplementalWithholding: supplementalTaxable must be >= 0, got ${supplementalTaxable}`,
    );
  }
  const withSupplemental = computeWithholdingTax(
    regularMonthlyTaxable + supplementalTaxable,
    "monthly",
    rates,
  );
  const withoutSupplemental = computeWithholdingTax(
    regularMonthlyTaxable,
    "monthly",
    rates,
  );
  return roundHalfEven(withSupplemental - withoutSupplemental, 2);
}

/**
 * Compute withholding tax with full computation detail for audit reporting.
 *
 * @param taxableIncome - Taxable income for the period
 * @param periodType - 'semi-monthly' or 'monthly'
 * @returns Tax amount and computation detail
 */
export function computeWithholdingTaxWithDetail(
  taxableIncome: number,
  periodType: "semi-monthly" | "monthly" = "semi-monthly",
): { tax: number; detail: TaxComputationDetail } {
  const brackets =
    periodType === "semi-monthly"
      ? SEMI_MONTHLY_TAX_BRACKETS
      : MONTHLY_TAX_BRACKETS;
  return computeTaxFromBrackets(taxableIncome, brackets);
}

/**
 * Compute annualized withholding tax for year-end alphalist / Form 2316.
 *
 * The annualized method:
 * 1. Project the monthly taxable income to annual: monthlyTaxable × 12
 * 2. Apply annual tax brackets
 * 3. Divide by 12 to get monthly withholding
 *
 * This is an alternative withholding computation method under BIR Revenue
 * Memorandum Circular 79-2013. It is used for year-end tax equalization.
 *
 * @param monthlyTaxableIncome - Monthly taxable income (average)
 * @returns Annualized tax (full year amount, NOT monthly)
 */
export function computeAnnualizedTax(monthlyTaxableIncome: number): number {
  if (monthlyTaxableIncome < 0) {
    throw new RangeError(
      `computeAnnualizedTax: monthlyTaxableIncome must be >= 0, got ${monthlyTaxableIncome}`,
    );
  }
  const annualTaxable = roundHalfEven(monthlyTaxableIncome * 12, 2);
  return computeTaxFromBrackets(annualTaxable, ANNUAL_TAX_BRACKETS).tax;
}

/**
 * Compute the monthly equivalent tax from an annualized computation.
 * Useful for BIR alphalist and monthly remittances.
 *
 * @param monthlyTaxableIncome - Monthly taxable income
 * @returns Monthly tax amount (annualized ÷ 12)
 */
export function computeMonthlyTaxFromAnnualized(
  monthlyTaxableIncome: number,
): number {
  const annualTax = computeAnnualizedTax(monthlyTaxableIncome);
  return roundHalfEven(annualTax / 12, 2);
}
