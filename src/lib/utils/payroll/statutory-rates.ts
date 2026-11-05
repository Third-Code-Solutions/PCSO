/**
 * Statutory rate resolution — C-13 / TOR 1.8.3.
 *
 * Converts government rate-table rows (gsis_rates, philhealth_rates,
 * pagibig_rates, bir_tax_tables) into the engine's StatutoryRates for one
 * payroll period. Pure: callers load the rows.
 *
 * Per table, the row with the latest effectiveDate <= asOf wins. A table
 * with no effective row, or with values that fail the sanity checks below,
 * is left undefined so the computation falls back to the built-in constants
 * (never a silent zero rate).
 */

import { parseMoney } from "./rounding";
import type {
  GsisRateConfig,
  PagIbigRateConfig,
  PhilHealthRateConfig,
  StatutoryRates,
  TaxBracket,
} from "./types";

export interface GsisRateRow {
  employeeRate: string;
  employerRate: string;
  effectiveDate: string;
}

export interface PhilHealthRateRow {
  employeeRate: string;
  employerRate: string;
  minMsalary: string;
  maxMsalary: string;
  effectiveDate: string;
}

export interface PagIbigRateRow {
  employeeRateLow: string;
  employeeRateHigh: string;
  employerRate: string;
  salaryThreshold: string;
  /** Monthly cap per side (employee and employer each). */
  maxContribution: string;
  effectiveDate: string;
}

export interface BirTaxRow {
  periodType: "semi_monthly" | "monthly";
  bracketFrom: string;
  baseTax: string;
  excessRate: string;
  effectiveDate: string;
}

export interface StatutoryRateRows {
  gsis: readonly GsisRateRow[];
  philHealth: readonly PhilHealthRateRow[];
  pagIbig: readonly PagIbigRateRow[];
  bir: readonly BirTaxRow[];
}

/** Max peso gap tolerated between a bracket's base tax and the tax the
 * previous bracket reaches at its floor (catches mixed/corrupt tables). */
const BRACKET_CONTINUITY_TOLERANCE = 1;

function latestAsOf<T extends { effectiveDate: string }>(
  rows: readonly T[],
  asOf: string,
): T | undefined {
  let best: T | undefined;
  for (const row of rows) {
    // ISO dates compare correctly as strings.
    if (row.effectiveDate > asOf) continue;
    if (!best || row.effectiveDate > best.effectiveDate) best = row;
  }
  return best;
}

const isRate = (n: number): boolean => Number.isFinite(n) && n >= 0 && n < 1;

function toGsis(row: GsisRateRow | undefined): GsisRateConfig | undefined {
  if (!row) return undefined;
  const personalRate = parseMoney(row.employeeRate);
  const employerRate = parseMoney(row.employerRate);
  if (!isRate(personalRate) || !isRate(employerRate) || personalRate === 0) {
    return undefined;
  }
  return { personalRate, employerRate };
}

function toPhilHealth(
  row: PhilHealthRateRow | undefined,
): PhilHealthRateConfig | undefined {
  if (!row) return undefined;
  const cfg = {
    employeeRate: parseMoney(row.employeeRate),
    employerRate: parseMoney(row.employerRate),
    salaryFloor: parseMoney(row.minMsalary),
    salaryCeiling: parseMoney(row.maxMsalary),
  };
  if (
    !isRate(cfg.employeeRate) ||
    !isRate(cfg.employerRate) ||
    cfg.employeeRate === 0 ||
    cfg.salaryFloor <= 0 ||
    cfg.salaryCeiling < cfg.salaryFloor
  ) {
    return undefined;
  }
  return cfg;
}

function toPagIbig(
  row: PagIbigRateRow | undefined,
): PagIbigRateConfig | undefined {
  if (!row) return undefined;
  const cfg = {
    employeeRateLow: parseMoney(row.employeeRateLow),
    employeeRateHigh: parseMoney(row.employeeRateHigh),
    employerRate: parseMoney(row.employerRate),
    salaryThreshold: parseMoney(row.salaryThreshold),
    maxContribution: parseMoney(row.maxContribution),
  };
  if (
    !isRate(cfg.employeeRateLow) ||
    !isRate(cfg.employeeRateHigh) ||
    !isRate(cfg.employerRate) ||
    cfg.employeeRateHigh === 0 ||
    cfg.salaryThreshold < 0 ||
    cfg.maxContribution <= 0
  ) {
    return undefined;
  }
  return cfg;
}

/**
 * Build one bracket table from the rows of a single period type. Uses the
 * latest effective date's rows only, dedupes repeated seed inserts by
 * bracketFrom, and derives each ceiling from the next floor so every income
 * maps to exactly one bracket.
 */
export function toTaxBrackets(
  rows: readonly BirTaxRow[],
  periodType: BirTaxRow["periodType"],
  asOf: string,
): TaxBracket[] | undefined {
  const ofType = rows.filter((r) => r.periodType === periodType);
  const effective = latestAsOf(ofType, asOf)?.effectiveDate;
  if (!effective) return undefined;

  const byFloor = new Map<number, BirTaxRow>();
  for (const row of ofType) {
    if (row.effectiveDate !== effective) continue;
    const floor = parseMoney(row.bracketFrom);
    if (!byFloor.has(floor)) byFloor.set(floor, row);
  }

  const sorted = [...byFloor.entries()].sort((a, b) => a[0] - b[0]);
  if (sorted.length === 0 || sorted[0]![0] !== 0) return undefined;

  const brackets: TaxBracket[] = sorted.map(([floor, row], i) => ({
    floor,
    ceiling: i + 1 < sorted.length ? sorted[i + 1]![0] : Infinity,
    baseAmount: parseMoney(row.baseTax),
    rate: parseMoney(row.excessRate),
  }));

  for (let i = 0; i < brackets.length; i++) {
    const b = brackets[i]!;
    if (!isRate(b.rate) || b.baseAmount < 0) return undefined;
    if (i === 0) continue;
    const prev = brackets[i - 1]!;
    const reached = prev.baseAmount + (b.floor - prev.floor) * prev.rate;
    if (
      b.rate < prev.rate ||
      Math.abs(b.baseAmount - reached) > BRACKET_CONTINUITY_TOLERANCE
    ) {
      return undefined;
    }
  }
  return brackets;
}

/** Resolve all statutory rates effective on `asOf` (YYYY-MM-DD). */
export function resolveStatutoryRates(
  rows: StatutoryRateRows,
  asOf: string,
): StatutoryRates {
  const monthly = toTaxBrackets(rows.bir, "monthly", asOf);
  const semiMonthly = toTaxBrackets(rows.bir, "semi_monthly", asOf);
  return {
    gsis: toGsis(latestAsOf(rows.gsis, asOf)),
    philHealth: toPhilHealth(latestAsOf(rows.philHealth, asOf)),
    pagIbig: toPagIbig(latestAsOf(rows.pagIbig, asOf)),
    taxBrackets: monthly && semiMonthly ? { monthly, semiMonthly } : undefined,
  };
}
