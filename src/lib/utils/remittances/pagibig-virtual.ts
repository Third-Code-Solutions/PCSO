/**
 * Virtual Pag-IBIG CSV export — Phase 11
 *
 * The Virtual Pag-IBIG portal accepts a CSV remittance file with this layout:
 *
 *   MID No. | Last Name | First Name | Middle Name | Suffix |
 *   Basic Monthly Compensation | Employee Share | Employer Share | Total
 *
 * Spec reference: Pag-IBIG Fund Circular No. 427 (2022) — Virtual Pag-IBIG
 * upload format for employer contributions.
 *
 * Rules:
 *   - MID No.: 12 digits, no dashes
 *   - Names: UPPERCASE, no special characters
 *   - Monetary values: plain decimal, 2 decimal places, no comma separators
 *   - File encoding: UTF-8 without BOM
 *   - Line endings: CRLF (\r\n)
 */

import { roundHalfEven } from '@/lib/utils/payroll/rounding';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PagibigVirtualRow {
  /** Pag-IBIG MID Number (12 digits) */
  pagibigNo: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  suffix: string | null;
  /** Monthly salary used to determine contribution tier */
  basicMonthlyCompensation: string;
  /** Employee share */
  employeeShare: string;
  /** Employer share */
  employerShare: string;
  /** Total = employee + employer */
  total: string;
}

export interface PagibigVirtualMeta {
  agencyName: string;
  /** Pag-IBIG employer ID */
  employerId: string;
  /** Coverage period label, e.g. "January 2025" */
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  batchNo: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMoney(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(num)) {
    throw new RangeError(`formatMoney: cannot format "${value}"`);
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
 * Builds the Virtual Pag-IBIG CSV content as a UTF-8 string.
 */
export function buildPagibigVirtualCsv(
  rows: PagibigVirtualRow[],
  meta: PagibigVirtualMeta,
): string {
  const lines: string[] = [];

  // Header block
  lines.push(`# Employer: ${csvEscape(meta.agencyName)} (Pag-IBIG Employer ID: ${csvEscape(meta.employerId)})`);
  lines.push(`# Period: ${csvEscape(meta.periodLabel)}`);
  lines.push(`# Batch: ${csvEscape(meta.batchNo)}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);

  // Column headers — Virtual Pag-IBIG portal exact labels
  lines.push(
    [
      'MID NO',
      'LAST NAME',
      'FIRST NAME',
      'MIDDLE NAME',
      'SUFFIX',
      'BASIC MONTHLY COMPENSATION',
      'EMPLOYEE SHARE',
      'EMPLOYER SHARE',
      'TOTAL',
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
    const total = parseFloat(row.total);

    sumEmployee += ee;
    sumEmployer += er;
    sumTotal += total;

    lines.push(
      [
        csvEscape(row.pagibigNo),
        csvEscape(row.lastName.toUpperCase()),
        csvEscape(row.firstName.toUpperCase()),
        csvEscape((row.middleName ?? '').toUpperCase()),
        csvEscape((row.suffix ?? '').toUpperCase()),
        formatMoney(row.basicMonthlyCompensation),
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
 * Entry point: generate Virtual Pag-IBIG CSV export as Uint8Array.
 */
export function generatePagibigVirtualExport(
  rows: PagibigVirtualRow[],
  meta: PagibigVirtualMeta,
): { data: Uint8Array; mimeType: string; filename: string } {
  const csv = buildPagibigVirtualCsv(rows, meta);
  const encoder = new TextEncoder();
  const safePeriod = meta.periodLabel.replace(/[^a-zA-Z0-9-_]/g, '_');
  const safeBatch = meta.batchNo.replace(/[^a-zA-Z0-9-_]/g, '_');

  return {
    data: encoder.encode(csv),
    mimeType: 'text/csv; charset=UTF-8',
    filename: `PagIBIG_Virtual_${safePeriod}_${safeBatch}.csv`,
  };
}
