/**
 * Payroll run support helpers — PAY-003 / PAY-005 / PAY-006 / PAY-008
 *
 * Pure helpers used by the payroll processing action to turn reference data
 * (salary_grades rows, allowance configuration rows) into per-employee
 * amounts. No DB access here — callers load the rows and pass them in.
 */

import { parseMoney, roundHalfEven } from "./rounding";
import { getAuthorizedSalary } from "./salary";
import { computeGSIS, computePhilHealth, computePagIBIG } from "./deductions";
import type { AppointmentType } from "./types";
import { isJobOrderOrCOS } from "./types";

// ---------------------------------------------------------------------------
// Salary resolution (salary_grades reference table with SSL fallback)
// ---------------------------------------------------------------------------

export interface SalaryGradeRow {
  grade: number;
  step: number;
  /** Numeric string, e.g. "25439.00" */
  monthlySalary: string;
  /** ISO date (YYYY-MM-DD) */
  effectiveDate: string;
}

/**
 * Resolve the monthly salary for (grade, step) from salary_grades rows,
 * effective as of `asOf` (YYYY-MM-DD). Picks the row with the latest
 * effectiveDate <= asOf. Returns undefined when no matching row exists.
 */
export function resolveSalaryAsOf(
  rows: readonly SalaryGradeRow[],
  grade: number,
  step: number,
  asOf: string,
): number | undefined {
  let best: SalaryGradeRow | undefined;
  for (const row of rows) {
    if (row.grade !== grade || row.step !== step) continue;
    // ISO date strings compare correctly lexicographically.
    if (row.effectiveDate > asOf) continue;
    if (!best || row.effectiveDate > best.effectiveDate) best = row;
  }
  return best ? parseMoney(best.monthlySalary) : undefined;
}

/**
 * Resolve an employee's authorized monthly salary.
 *
 * Preference order (per Risk Register: rates are data, not code):
 *   1. salary_grades reference table row effective as of `asOf`
 *   2. Static SSL V table fallback (DBM BC 2020-1)
 *
 * Throws RangeError when the grade/step cannot be resolved anywhere —
 * callers must record the employee as an exception instead of paying a
 * silent zero.
 */
export function resolveEmployeeMonthlySalary(
  rows: readonly SalaryGradeRow[],
  grade: number,
  step: number,
  asOf: string,
): number {
  const fromTable = resolveSalaryAsOf(rows, grade, step, asOf);
  if (fromTable !== undefined && fromTable > 0) return fromTable;
  return getAuthorizedSalary(grade, step);
}

// ---------------------------------------------------------------------------
// Allowance amount resolution (allowances configuration table)
// ---------------------------------------------------------------------------

export interface AllowanceAmountConfig {
  /** JSONB map of salary grade → amount string, e.g. { "24": "11000.00" } */
  amountBySg: Record<string, string> | null;
  /** Flat amount for allowances that do not vary by salary grade */
  flatAmount: string | null;
}

/**
 * Resolve the monthly amount of a configured allowance for a salary grade.
 * amountBySg wins over flatAmount; grades absent from amountBySg are not
 * entitled (returns 0).
 */
export function resolveAllowanceMonthlyAmount(
  config: AllowanceAmountConfig,
  salaryGrade: number,
): number {
  if (config.amountBySg) {
    const raw = config.amountBySg[String(salaryGrade)];
    return raw === undefined ? 0 : parseMoney(raw);
  }
  if (config.flatAmount !== null) return parseMoney(config.flatAmount);
  return 0;
}

// ---------------------------------------------------------------------------
// Salary differential period (PAY-006)
// ---------------------------------------------------------------------------

/**
 * Count calendar months covered by a retroactive period, inclusive of both
 * endpoints (Jan 1 – Jun 30 → 6). Partial months count as whole months per
 * PAY-006: "(new rate − old rate) × applicable months".
 */
export function monthsInclusive(startISO: string, endISO: string): number {
  const startYear = Number(startISO.slice(0, 4));
  const startMonth = Number(startISO.slice(5, 7));
  const endYear = Number(endISO.slice(0, 4));
  const endMonth = Number(endISO.slice(5, 7));

  if (!startYear || !startMonth || !endYear || !endMonth) {
    throw new RangeError(
      `monthsInclusive: invalid dates "${startISO}" – "${endISO}"`,
    );
  }

  const months = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  if (months < 1) {
    throw new RangeError(
      `monthsInclusive: end "${endISO}" precedes start "${startISO}"`,
    );
  }
  return months;
}

/**
 * Return the ISO date (YYYY-MM-DD) of the calendar day before `iso`.
 *
 * Salary differential (PAY-006) resolves the OLD rate as of the day BEFORE the
 * period start: the differential/new-rate UI sets the period start to the
 * adjustment's effectivity date, and salary-grade resolution is inclusive of
 * effectiveDate == asOf. Resolving at period start would pick up the NEW rate
 * effective that day and compute a zero differential.
 */
export function isoDayBefore(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) {
    throw new RangeError(`isoDayBefore: invalid date "${iso}"`);
  }
  const date = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
  );
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Regular monthly taxable income (for supplemental withholding stacking)
// ---------------------------------------------------------------------------

/**
 * Derive an employee's regular monthly taxable compensation, matching how
 * computeFullPayroll derives taxable income: monthly basic salary minus the
 * employee-share mandatory deductions (GSIS + PhilHealth + Pag-IBIG). RATA and
 * PERA are non-taxable and excluded. JO/COS have no mandatory deductions so
 * their whole monthly rate is the taxable base.
 *
 * Used to stack supplemental payments (RATA excess, taxable bonuses, salary
 * differential) on top of the regular base for correct marginal withholding.
 */
export function computeRegularMonthlyTaxable(
  monthlySalary: number,
  appointmentType: AppointmentType,
): number {
  if (monthlySalary < 0) {
    throw new RangeError(
      `computeRegularMonthlyTaxable: monthlySalary must be >= 0, got ${monthlySalary}`,
    );
  }
  if (isJobOrderOrCOS(appointmentType)) {
    return roundHalfEven(monthlySalary, 2);
  }
  const gsis = parseMoney(computeGSIS(monthlySalary, "monthly").personal);
  const philHealth = parseMoney(
    computePhilHealth(monthlySalary, "monthly").personal,
  );
  const pagIBIG = parseMoney(computePagIBIG(monthlySalary, "monthly").personal);
  return roundHalfEven(
    Math.max(0, monthlySalary - (gsis + philHealth + pagIBIG)),
    2,
  );
}

// ---------------------------------------------------------------------------
// Magna Carta benefits (PAY-008)
// ---------------------------------------------------------------------------

export interface MagnaCartaEligibility {
  /** RA 9710 (Magna Carta of Women) applies to female employees */
  isFemale: boolean;
  /** RA 7277 (Magna Carta for Disabled Persons) applies to PWD employees */
  isPwd: boolean;
}

export interface MagnaCartaAmounts {
  womenMonthlyAmount: number;
  pwdMonthlyAmount: number;
}

export interface MagnaCartaBenefit {
  women: number;
  pwd: number;
  total: number;
}

/**
 * Compute Magna Carta benefits for a run (PAY-008).
 * Amounts come from configured allowance records (types magna_carta_women /
 * magna_carta_pwd). The two benefits stack for employees qualifying under
 * both laws.
 */
export function computeMagnaCartaBenefit(
  eligibility: MagnaCartaEligibility,
  amounts: MagnaCartaAmounts,
): MagnaCartaBenefit {
  if (amounts.womenMonthlyAmount < 0 || amounts.pwdMonthlyAmount < 0) {
    throw new RangeError(
      `computeMagnaCartaBenefit: amounts must be >= 0, got women=${amounts.womenMonthlyAmount}, pwd=${amounts.pwdMonthlyAmount}`,
    );
  }

  const women = eligibility.isFemale
    ? roundHalfEven(amounts.womenMonthlyAmount, 2)
    : 0;
  const pwd = eligibility.isPwd ? roundHalfEven(amounts.pwdMonthlyAmount, 2) : 0;

  return { women, pwd, total: roundHalfEven(women + pwd, 2) };
}
