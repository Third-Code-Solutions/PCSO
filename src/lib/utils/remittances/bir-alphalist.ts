/**
 * BIR Alphalist generator — Phase 11
 *
 * Generates the alphalist required for BIR Form 1604-C (Annual Information Return
 * of Income Taxes Withheld on Compensation).
 *
 * Alphalist Schedule 1 columns (BIR Revenue Regulations No. 11-2013 / updated per
 * RR 1-2015 and 12-2020):
 *   TIN | Last Name | First Name | Middle Name | Date of Birth |
 *   Status of Employment | Gross Compensation Income |
 *   Non-Taxable / Exempt Compensation | Taxable Compensation |
 *   Tax Due | Tax Withheld Previous Employer |
 *   Tax Withheld Current Employer | Total Tax Withheld |
 *   Over/Under Remittance
 *
 * Output format: CSV (UTF-8, CRLF) compatible with eBIRForms alphalist import.
 */

import { roundHalfEven } from "@/lib/utils/payroll/rounding";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Employment status codes per BIR RR 11-2013 */
export type BirEmploymentStatus =
  | "MWE" // Minimum Wage Earner
  | "P" // Purely Compensation
  | "G"; // Government Employee

export interface BirAlphalistRow {
  /** Employee TIN (format: NNN-NNN-NNN-NNNNN or NNN-NNN-NNN) */
  tin: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  /** ISO date of birth, e.g. "1990-01-15" */
  birthDate: string | null;
  employmentStatus: BirEmploymentStatus;

  // Compensation breakdown
  /** Total gross compensation income for the year */
  grossCompensation: string;
  /**
   * Non-taxable / exempt compensation:
   *   13th month + other benefits (up to PHP 90,000 per TRAIN law)
   *   + de minimis + SSS/GSIS/PhilHealth/Pag-IBIG contributions
   */
  nonTaxableCompensation: string;
  /** Taxable compensation = gross - non-taxable */
  taxableCompensation: string;

  // Tax computation
  /** Computed tax due on taxable compensation */
  taxDue: string;
  /** Tax withheld by previous employer (if any) */
  taxWithheldPreviousEmployer: string;
  /** Tax withheld by current employer (PCSO) */
  taxWithheldCurrentEmployer: string;
  /** Total tax withheld = previous + current */
  totalTaxWithheld: string;
  /**
   * Over-remittance (positive) or under-remittance (negative).
   * overUnder = totalTaxWithheld - taxDue
   */
  overUnderRemittance: string;
}

export interface BirAlphalistMeta {
  agencyName: string;
  /** BIR-registered TIN of the employer (PCSO) */
  employerTin: string;
  /** Calendar year covered */
  year: string;
  batchNo: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!Number.isFinite(num)) {
    throw new RangeError(`formatMoney: cannot format "${value}"`);
  }
  return roundHalfEven(num, 2).toFixed(2);
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── CSV generator ────────────────────────────────────────────────────────────

/**
 * Builds the eBIRForms-compatible alphalist CSV.
 *
 * The output file is suitable for import into the BIR Alphalist Data Entry
 * System (ADAS) or eBIRForms desktop tool.
 */
export function buildBirAlphalistCsv(
  rows: BirAlphalistRow[],
  meta: BirAlphalistMeta,
): string {
  const lines: string[] = [];

  // Info header (eBIRForms ignores # lines)
  lines.push(`# BIR Form 1604-C Alphalist`);
  lines.push(
    `# Employer: ${csvEscape(meta.agencyName)} TIN: ${csvEscape(meta.employerTin)}`,
  );
  lines.push(`# Year: ${csvEscape(meta.year)}`);
  lines.push(`# Batch: ${csvEscape(meta.batchNo)}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);

  // BIR column headers
  lines.push(
    [
      "TIN",
      "LAST NAME",
      "FIRST NAME",
      "MIDDLE NAME",
      "DATE OF BIRTH",
      "STATUS",
      "GROSS COMPENSATION",
      "NON-TAXABLE COMPENSATION",
      "TAXABLE COMPENSATION",
      "TAX DUE",
      "TAX WITHHELD (PREV EMPLOYER)",
      "TAX WITHHELD (CURR EMPLOYER)",
      "TOTAL TAX WITHHELD",
      "OVER/UNDER REMITTANCE",
    ]
      .map(csvEscape)
      .join(","),
  );

  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.tin),
        csvEscape(row.lastName.toUpperCase()),
        csvEscape(row.firstName.toUpperCase()),
        csvEscape((row.middleName ?? "").toUpperCase()),
        csvEscape(row.birthDate ?? ""),
        csvEscape(row.employmentStatus),
        formatMoney(row.grossCompensation),
        formatMoney(row.nonTaxableCompensation),
        formatMoney(row.taxableCompensation),
        formatMoney(row.taxDue),
        formatMoney(row.taxWithheldPreviousEmployer),
        formatMoney(row.taxWithheldCurrentEmployer),
        formatMoney(row.totalTaxWithheld),
        formatMoney(row.overUnderRemittance),
      ].join(","),
    );
  }

  return lines.join("\r\n");
}

/**
 * Entry point: generate alphalist CSV as Uint8Array.
 */
export function generateBirAlphalistExport(
  rows: BirAlphalistRow[],
  meta: BirAlphalistMeta,
): { data: Uint8Array; mimeType: string; filename: string } {
  const csv = buildBirAlphalistCsv(rows, meta);
  const encoder = new TextEncoder();
  const safeYear = meta.year.replace(/[^0-9]/g, "");
  const safeBatch = meta.batchNo.replace(/[^a-zA-Z0-9-_]/g, "_");

  return {
    data: encoder.encode(csv),
    mimeType: "text/csv; charset=UTF-8",
    filename: `BIR_1604C_Alphalist_${safeYear}_${safeBatch}.csv`,
  };
}

// ─── Over/Under helper ───────────────────────────────────────────────────────

/**
 * Computes the over/under remittance string for a single employee.
 * Positive = over-remittance (refundable), negative = under-remittance (payable).
 */
export function computeOverUnderRemittance(
  totalTaxWithheld: string,
  taxDue: string,
): string {
  const withheld = parseFloat(totalTaxWithheld);
  const due = parseFloat(taxDue);
  if (!Number.isFinite(withheld) || !Number.isFinite(due)) {
    return "0.00";
  }
  return roundHalfEven(withheld - due, 2).toFixed(2);
}
