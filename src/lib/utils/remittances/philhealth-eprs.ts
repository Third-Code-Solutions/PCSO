/**
 * PhilHealth EPRS-compatible CSV export — Phase 11
 *
 * The Electronic Premium Remittance System (EPRS) accepts a CSV upload with
 * a specific column layout. This module generates that file from an array of
 * contribution records.
 *
 * Required EPRS columns (PhilHealth Circular 2019-0009 / updated 2023 spec):
 *   PIN | Last Name | First Name | Middle Name | Suffix |
 *   Basic Monthly Salary | Premium Due (Personal) | Premium Due (Employer) | Total Premium
 *
 * Monetary values: plain decimal, exactly 2 decimal places, no peso sign.
 * All text fields: trimmed, no internal double-quotes (escaped if present).
 */

import { roundHalfEven } from '@/lib/utils/payroll/rounding';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PhilHealthEprsRow {
  /** PhilHealth Identification Number (PIN) */
  philhealthNo: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  suffix: string | null;
  /** Basic Monthly Salary used to compute premium */
  basicMonthlySalary: string;
  /** Employee personal share */
  employeeShare: string;
  /** Employer share */
  employerShare: string;
  /** Total = employee + employer */
  totalPremium: string;
}

export interface PhilHealthEprsMeta {
  agencyName: string;
  /** PhilHealth employer number */
  employerNo: string;
  /** Coverage period, e.g. "January 2025" */
  periodLabel: string;
  /** ISO period month start, e.g. "2025-01-01" */
  periodStart: string;
  /** ISO period month end, e.g. "2025-01-31" */
  periodEnd: string;
  batchNo: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(num)) {
    throw new RangeError(`formatMoney: cannot format "${value}" as a monetary amount`);
  }
  return roundHalfEven(num, 2).toFixed(2);
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── CSV generator ────────────────────────────────────────────────────────────

/**
 * Builds the EPRS-compatible CSV content as a UTF-8 string.
 * A totals summary row is appended after the last data row.
 */
export function buildPhilHealthEprsCsv(
  rows: PhilHealthEprsRow[],
  meta: PhilHealthEprsMeta,
): string {
  const lines: string[] = [];

  // Informational header block (EPRS ignores comment rows)
  lines.push(`# Employer: ${csvEscape(meta.agencyName)} (Employer No: ${csvEscape(meta.employerNo)})`);
  lines.push(`# Period: ${csvEscape(meta.periodLabel)}`);
  lines.push(`# Batch: ${csvEscape(meta.batchNo)}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);

  // Column headers (EPRS exact labels)
  lines.push(
    [
      'PIN',
      'LAST NAME',
      'FIRST NAME',
      'MIDDLE NAME',
      'SUFFIX',
      'BASIC MONTHLY SALARY',
      'EE PREMIUM',
      'ER PREMIUM',
      'TOTAL PREMIUM',
    ]
      .map(csvEscape)
      .join(','),
  );

  let sumEmployee = 0;
  let sumEmployer = 0;
  let sumTotal = 0;

  for (const row of rows) {
    const ee = parseFloat(row.employeeShare);
    const er = parseFloat(row.employerShare);
    const total = parseFloat(row.totalPremium);

    sumEmployee += ee;
    sumEmployer += er;
    sumTotal += total;

    lines.push(
      [
        csvEscape(row.philhealthNo),
        csvEscape(row.lastName.toUpperCase()),
        csvEscape(row.firstName),
        csvEscape(row.middleName ?? ''),
        csvEscape(row.suffix ?? ''),
        formatMoney(row.basicMonthlySalary),
        formatMoney(ee),
        formatMoney(er),
        formatMoney(total),
      ].join(','),
    );
  }

  // Totals row
  lines.push(
    [
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      formatMoney(sumEmployee),
      formatMoney(sumEmployer),
      formatMoney(sumTotal),
    ]
      .map(csvEscape)
      .join(','),
  );

  return lines.join('\r\n');
}

/**
 * Entry point: build EPRS CSV as UTF-8 Uint8Array with filename metadata.
 */
export function generatePhilHealthEprsExport(
  rows: PhilHealthEprsRow[],
  meta: PhilHealthEprsMeta,
): { data: Uint8Array; mimeType: string; filename: string } {
  const csv = buildPhilHealthEprsCsv(rows, meta);
  const encoder = new TextEncoder();
  const safePeriod = meta.periodLabel.replace(/[^a-zA-Z0-9-_]/g, '_');
  const safeBatch = meta.batchNo.replace(/[^a-zA-Z0-9-_]/g, '_');

  return {
    data: encoder.encode(csv),
    mimeType: 'text/csv; charset=UTF-8',
    filename: `PhilHealth_EPRS_${safePeriod}_${safeBatch}.csv`,
  };
}
