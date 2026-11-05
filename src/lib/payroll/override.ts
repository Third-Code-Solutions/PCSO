/**
 * Manual override of one payroll line, keeping the record reconciled
 * (gross − total deductions = net) so the register, bank file and the
 * balanced journal (H-16) stay consistent. Pure; integer centavos.
 */

import { toCentavos } from "./journal";

const EARNING_LINES = new Set([
  "basicPay",
  "rata",
  "longevityPay",
  "overtimePay",
  "pera",
  "otherEarnings",
]);

const PERSONAL_DEDUCTION_LINES = new Set([
  "gsisPersonal",
  "philhealthPersonal",
  "pagibigPersonal",
  "withholdingTax",
  "lateDeduction",
  "undertimeDeduction",
  "absenceDeduction",
  "otherDeductions",
]);

/** Totals derived from the lines; never overridden directly. */
const DERIVED_TOTALS = new Set(["grossPay", "totalDeductions", "netPay"]);

export interface OverrideTotals {
  grossPay: string;
  totalDeductions: string;
  netPay: string;
}

const money = (c: number): string => (c / 100).toFixed(2);

/**
 * Column patch for overriding `field` with `value` on a record. Earnings
 * move gross and net; personal deductions move total deductions and net;
 * other overridable columns (employer shares, authorized salary) change only
 * themselves.
 */
export function buildOverridePatch(
  record: OverrideTotals & Record<string, unknown>,
  field: string,
  value: string,
): Record<string, string> {
  if (DERIVED_TOTALS.has(field)) {
    throw new Error(
      `${field} is computed from the pay lines — override the earning or deduction line instead.`,
    );
  }
  const current = record[field];
  const delta =
    toCentavos(value) - toCentavos(typeof current === "string" ? current : "0");
  const patch: Record<string, string> = { [field]: value };

  if (EARNING_LINES.has(field)) {
    patch.grossPay = money(toCentavos(record.grossPay) + delta);
    patch.netPay = money(toCentavos(record.netPay) + delta);
  } else if (PERSONAL_DEDUCTION_LINES.has(field)) {
    patch.totalDeductions = money(toCentavos(record.totalDeductions) + delta);
    patch.netPay = money(toCentavos(record.netPay) - delta);
  }
  return patch;
}
