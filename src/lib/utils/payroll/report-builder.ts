/**
 * Payroll ad hoc report shaping — TOR 1.8.15 (PAY-017).
 *
 * Pure helpers for the parametrized payroll report builder: the canonical
 * selectable column catalog, row → display-cell shaping for a chosen column
 * set, per-column money totals, and CSV serialization. The server action
 * fetches raw rows; this module owns everything shape-related so it is fully
 * testable without a database and reusable by the client for CSV export.
 */

// ---------------------------------------------------------------------------
// Row type (as returned by the report server action)
// ---------------------------------------------------------------------------

export interface PayrollReportRow {
  employeeNo: string;
  employeeName: string;
  officeName: string;
  positionTitle: string;
  appointmentType: string;
  periodName: string;
  payrollType: string;
  periodStart: string;
  periodEnd: string;
  periodStatus: string;
  // Money fields (numeric-as-string per DB convention)
  basicPay: string;
  grossPay: string;
  rata: string;
  longevityPay: string;
  overtimePay: string;
  pera: string;
  otherEarnings: string;
  gsisPersonal: string;
  gsisEmployer: string;
  philhealthPersonal: string;
  philhealthEmployer: string;
  pagibigPersonal: string;
  pagibigEmployer: string;
  withholdingTax: string;
  lateDeduction: string;
  undertimeDeduction: string;
  absenceDeduction: string;
  otherDeductions: string;
  totalDeductions: string;
  netPay: string;
}

// ---------------------------------------------------------------------------
// Column catalog
// ---------------------------------------------------------------------------

export interface PayrollReportColumn {
  key: keyof PayrollReportRow;
  label: string;
  /** Money columns are right-aligned, 2-decimal formatted, and totaled. */
  isMoney: boolean;
}

/**
 * Identity columns always present in every report (not user-selectable).
 * Order matters — it is the leading column order in tables and CSV.
 */
export const PAYROLL_REPORT_FIXED_COLUMNS: readonly PayrollReportColumn[] = [
  { key: "employeeNo", label: "Employee No.", isMoney: false },
  { key: "employeeName", label: "Employee Name", isMoney: false },
  { key: "officeName", label: "Office", isMoney: false },
  { key: "positionTitle", label: "Position", isMoney: false },
  { key: "appointmentType", label: "Appointment", isMoney: false },
  { key: "periodName", label: "Payroll Period", isMoney: false },
  { key: "payrollType", label: "Payroll Type", isMoney: false },
  { key: "periodStatus", label: "Run Status", isMoney: false },
];

/** User-selectable columns (column picker), keyed by row field. */
export const PAYROLL_REPORT_SELECTABLE_COLUMNS: readonly PayrollReportColumn[] =
  [
    { key: "basicPay", label: "Basic Pay", isMoney: true },
    { key: "rata", label: "RATA", isMoney: true },
    { key: "longevityPay", label: "Longevity Pay", isMoney: true },
    { key: "overtimePay", label: "Overtime Pay", isMoney: true },
    { key: "pera", label: "PERA", isMoney: true },
    { key: "otherEarnings", label: "Other Earnings", isMoney: true },
    { key: "grossPay", label: "Gross Pay", isMoney: true },
    { key: "gsisPersonal", label: "GSIS (EE)", isMoney: true },
    { key: "gsisEmployer", label: "GSIS (ER)", isMoney: true },
    { key: "philhealthPersonal", label: "PhilHealth (EE)", isMoney: true },
    { key: "philhealthEmployer", label: "PhilHealth (ER)", isMoney: true },
    { key: "pagibigPersonal", label: "Pag-IBIG (EE)", isMoney: true },
    { key: "pagibigEmployer", label: "Pag-IBIG (ER)", isMoney: true },
    { key: "withholdingTax", label: "Withholding Tax", isMoney: true },
    { key: "lateDeduction", label: "Late Deduction", isMoney: true },
    { key: "undertimeDeduction", label: "Undertime Deduction", isMoney: true },
    { key: "absenceDeduction", label: "Absence Deduction", isMoney: true },
    { key: "otherDeductions", label: "Other Deductions", isMoney: true },
    { key: "totalDeductions", label: "Total Deductions", isMoney: true },
    { key: "netPay", label: "Net Pay", isMoney: true },
  ];

/** Default column selection when the user has not picked anything yet. */
export const PAYROLL_REPORT_DEFAULT_COLUMN_KEYS: readonly (keyof PayrollReportRow)[] =
  ["grossPay", "totalDeductions", "netPay"];

/**
 * Resolve a set of selected keys into ordered column definitions:
 * fixed identity columns first, then the selected money/detail columns in
 * catalog order. Unknown keys are ignored; an empty selection falls back to
 * the default column set.
 */
export function resolveReportColumns(
  selectedKeys: readonly string[],
): PayrollReportColumn[] {
  const wanted = new Set(
    selectedKeys.length > 0 ? selectedKeys : PAYROLL_REPORT_DEFAULT_COLUMN_KEYS,
  );
  const selected = PAYROLL_REPORT_SELECTABLE_COLUMNS.filter((col) =>
    wanted.has(col.key),
  );
  const effective =
    selected.length > 0
      ? selected
      : PAYROLL_REPORT_SELECTABLE_COLUMNS.filter((col) =>
          PAYROLL_REPORT_DEFAULT_COLUMN_KEYS.includes(col.key),
        );
  return [...PAYROLL_REPORT_FIXED_COLUMNS, ...effective];
}

// ---------------------------------------------------------------------------
// Shaping
// ---------------------------------------------------------------------------

export interface ShapedPayrollReport {
  columns: PayrollReportColumn[];
  /** One display row per record, cells ordered like `columns`. */
  rows: string[][];
  /** Column totals aligned to `columns` — empty string for non-money cells. */
  totals: string[];
}

function formatMoneyCell(raw: string): string {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return "0.00";
  return value.toFixed(2);
}

/**
 * Shape raw report rows into display cells for the chosen columns, plus
 * per-money-column totals. Cell values are plain strings (money as fixed
 * 2-decimal, no currency symbol) so the same output feeds tables and CSV.
 */
export function shapePayrollReport(
  records: readonly PayrollReportRow[],
  selectedKeys: readonly string[],
): ShapedPayrollReport {
  const columns = resolveReportColumns(selectedKeys);

  const totalsAccumulator = new Map<keyof PayrollReportRow, number>();
  for (const col of columns) {
    if (col.isMoney) totalsAccumulator.set(col.key, 0);
  }

  const rows = records.map((record) =>
    columns.map((col) => {
      const raw = record[col.key] ?? "";
      if (!col.isMoney) return String(raw);
      const cell = formatMoneyCell(String(raw));
      totalsAccumulator.set(
        col.key,
        (totalsAccumulator.get(col.key) ?? 0) + Number.parseFloat(cell),
      );
      return cell;
    }),
  );

  const totals = columns.map((col, index) => {
    if (!col.isMoney) return index === 0 ? `TOTAL (${records.length})` : "";
    return (totalsAccumulator.get(col.key) ?? 0).toFixed(2);
  });

  return { columns, rows, totals };
}

// ---------------------------------------------------------------------------
// CSV serialization
// ---------------------------------------------------------------------------

function escapeCsvCell(cell: string): string {
  if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

/**
 * Serialize a shaped report to CSV: header row, data rows, then the totals
 * row. Callers prepend a UTF-8 BOM at download time (house Excel convention).
 */
export function buildReportCsv(report: ShapedPayrollReport): string {
  const lines: string[] = [];
  lines.push(report.columns.map((c) => escapeCsvCell(c.label)).join(","));
  for (const row of report.rows) {
    lines.push(row.map(escapeCsvCell).join(","));
  }
  lines.push(report.totals.map(escapeCsvCell).join(","));
  return lines.join("\n") + "\n";
}
