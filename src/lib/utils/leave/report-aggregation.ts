/**
 * Pure aggregation helpers for advanced leave reports — PCSO HRIS LAM module.
 *
 * Requirements covered:
 *  - LAM-005 / TOR 1.4.5:  LWOP employee list for a period
 *  - LAM-010 / TOR 1.4.13: sex-disaggregated leave statistics (GAD)
 *  - LAM-014 / TOR 1.4.14: ad hoc totals — applications filed by
 *                          day/month/year + disapproved list
 *
 * Everything in this module is pure and side-effect free so it can be unit
 * tested without a database and safely imported from client components
 * (CSV building) as well as server actions (aggregation).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One leave application row, denormalized for reporting. */
export interface LeaveReportRow {
  id: string;
  employeeId: string;
  employeeNo: string;
  /** "Last, First" display name. */
  employeeName: string;
  /** employees.gender enum value: male | female | prefer_not_to_say. */
  sex: string;
  office: string;
  leaveTypeCode: string;
  leaveType: string;
  /** leave_types.is_with_pay — false marks a Leave Without Pay type. */
  isWithPay: boolean;
  /** Inclusive leave period start (YYYY-MM-DD). */
  dateFrom: string;
  /** Inclusive leave period end (YYYY-MM-DD). */
  dateTo: string;
  noOfDays: number;
  status: string;
  remarks: string | null;
  /** Date the application was filed (created_at date part, YYYY-MM-DD). */
  filedAt: string;
}

export interface LeaveReportSummary {
  totalApplications: number;
  /** approved + consumed + consumed_auto. */
  approved: number;
  /** pending + cancellation_requested (still awaiting a decision). */
  pending: number;
  disapproved: number;
  /** Sum of noOfDays across the approved bucket, rounded to 3 decimals. */
  totalDays: number;
}

export interface LwopEmployeeSummary {
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  office: string;
  /** Number of LWOP applications in the period. */
  applications: number;
  /** Total LWOP days, rounded to 3 decimals. */
  lwopDays: number;
  /** Earliest dateFrom across the employee's LWOP rows. */
  periodStart: string;
  /** Latest dateTo across the employee's LWOP rows. */
  periodEnd: string;
}

export interface LwopReport {
  /** Individual LWOP applications (approved/consumed only). */
  rows: LeaveReportRow[];
  /** Per-employee rollup, sorted by employee name. */
  byEmployee: LwopEmployeeSummary[];
  employeeCount: number;
  totalDays: number;
}

export interface SexDisaggregatedRow {
  leaveTypeCode: string;
  leaveType: string;
  maleCount: number;
  maleDays: number;
  femaleCount: number;
  femaleDays: number;
  /** gender = prefer_not_to_say (or any future value). */
  otherCount: number;
  otherDays: number;
  totalCount: number;
  totalDays: number;
}

export type FiledTotalsGranularity = "day" | "month" | "year";

export interface FiledTotalRow {
  /** YYYY-MM-DD, YYYY-MM, or YYYY depending on granularity. */
  period: string;
  count: number;
  days: number;
}

// ---------------------------------------------------------------------------
// Status predicates
// ---------------------------------------------------------------------------

/** Statuses that represent a granted (approved-or-later) application. */
export const APPROVED_STATUSES: readonly string[] = [
  "approved",
  "consumed",
  "consumed_auto",
];

/** Statuses still awaiting a decision. */
export const PENDING_STATUSES: readonly string[] = [
  "pending",
  "cancellation_requested",
];

export function isApprovedStatus(status: string): boolean {
  return APPROVED_STATUSES.includes(status);
}

/**
 * LWOP predicate: an application counts toward the LWOP report when its leave
 * type is without pay AND the application was actually granted. Pending or
 * disapproved without-pay filings do not create a salary-deduction event.
 */
export function isLwopRow(
  row: Pick<LeaveReportRow, "isWithPay" | "status">,
): boolean {
  return !row.isWithPay && isApprovedStatus(row.status);
}

// ---------------------------------------------------------------------------
// Numeric helper
// ---------------------------------------------------------------------------

/** Round to 3 decimals — matches leave day precision numeric(6,3). */
export function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// ---------------------------------------------------------------------------
// Summary (existing dashboard cards)
// ---------------------------------------------------------------------------

export function buildLeaveReportSummary(
  rows: readonly LeaveReportRow[],
): LeaveReportSummary {
  let approved = 0;
  let pending = 0;
  let disapproved = 0;
  let totalDays = 0;

  for (const row of rows) {
    if (isApprovedStatus(row.status)) {
      approved++;
      totalDays += row.noOfDays;
    } else if (PENDING_STATUSES.includes(row.status)) {
      pending++;
    } else if (row.status === "disapproved") {
      disapproved++;
    }
  }

  return {
    totalApplications: rows.length,
    approved,
    pending,
    disapproved,
    totalDays: round3(totalDays),
  };
}

// ---------------------------------------------------------------------------
// LWOP report (LAM-005)
// ---------------------------------------------------------------------------

export function buildLwopReport(rows: readonly LeaveReportRow[]): LwopReport {
  const lwopRows = rows.filter(isLwopRow);

  const byEmployeeMap = new Map<string, LwopEmployeeSummary>();
  for (const row of lwopRows) {
    const existing = byEmployeeMap.get(row.employeeId);
    if (!existing) {
      byEmployeeMap.set(row.employeeId, {
        employeeId: row.employeeId,
        employeeNo: row.employeeNo,
        employeeName: row.employeeName,
        office: row.office,
        applications: 1,
        lwopDays: round3(row.noOfDays),
        periodStart: row.dateFrom,
        periodEnd: row.dateTo,
      });
      continue;
    }
    // Immutable update per coding conventions.
    byEmployeeMap.set(row.employeeId, {
      ...existing,
      applications: existing.applications + 1,
      lwopDays: round3(existing.lwopDays + row.noOfDays),
      periodStart:
        row.dateFrom < existing.periodStart
          ? row.dateFrom
          : existing.periodStart,
      periodEnd:
        row.dateTo > existing.periodEnd ? row.dateTo : existing.periodEnd,
    });
  }

  const byEmployee = [...byEmployeeMap.values()].sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName),
  );

  return {
    rows: lwopRows,
    byEmployee,
    employeeCount: byEmployee.length,
    totalDays: round3(byEmployee.reduce((sum, emp) => sum + emp.lwopDays, 0)),
  };
}

// ---------------------------------------------------------------------------
// Sex-disaggregated statistics (LAM-010, GAD compliance)
// ---------------------------------------------------------------------------

export function aggregateByTypeAndSex(
  rows: readonly LeaveReportRow[],
): SexDisaggregatedRow[] {
  const map = new Map<string, SexDisaggregatedRow>();

  for (const row of rows) {
    const key = row.leaveTypeCode;
    const current = map.get(key) ?? {
      leaveTypeCode: row.leaveTypeCode,
      leaveType: row.leaveType,
      maleCount: 0,
      maleDays: 0,
      femaleCount: 0,
      femaleDays: 0,
      otherCount: 0,
      otherDays: 0,
      totalCount: 0,
      totalDays: 0,
    };

    const bucket: "male" | "female" | "other" =
      row.sex === "male" ? "male" : row.sex === "female" ? "female" : "other";

    map.set(key, {
      ...current,
      maleCount: current.maleCount + (bucket === "male" ? 1 : 0),
      maleDays: round3(
        current.maleDays + (bucket === "male" ? row.noOfDays : 0),
      ),
      femaleCount: current.femaleCount + (bucket === "female" ? 1 : 0),
      femaleDays: round3(
        current.femaleDays + (bucket === "female" ? row.noOfDays : 0),
      ),
      otherCount: current.otherCount + (bucket === "other" ? 1 : 0),
      otherDays: round3(
        current.otherDays + (bucket === "other" ? row.noOfDays : 0),
      ),
      totalCount: current.totalCount + 1,
      totalDays: round3(current.totalDays + row.noOfDays),
    });
  }

  return [...map.values()].sort((a, b) =>
    a.leaveTypeCode.localeCompare(b.leaveTypeCode),
  );
}

// ---------------------------------------------------------------------------
// Filed totals by day/month/year (LAM-014)
// ---------------------------------------------------------------------------

function periodKey(
  isoDate: string,
  granularity: FiledTotalsGranularity,
): string {
  // isoDate is YYYY-MM-DD…; slice avoids timezone drift from Date parsing.
  if (granularity === "day") return isoDate.slice(0, 10);
  if (granularity === "month") return isoDate.slice(0, 7);
  return isoDate.slice(0, 4);
}

/**
 * Totals of applications FILED per period. Grouping key is the filing date
 * (`filedAt` = created_at date part), not the leave period, per TOR 1.4.14
 * "total leave applications filed by day/month/year".
 */
export function aggregateFiledTotals(
  rows: readonly LeaveReportRow[],
  granularity: FiledTotalsGranularity,
): FiledTotalRow[] {
  const map = new Map<string, FiledTotalRow>();

  for (const row of rows) {
    if (!row.filedAt) continue;
    const key = periodKey(row.filedAt, granularity);
    const current = map.get(key) ?? { period: key, count: 0, days: 0 };
    map.set(key, {
      period: key,
      count: current.count + 1,
      days: round3(current.days + row.noOfDays),
    });
  }

  return [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
}

// ---------------------------------------------------------------------------
// Disapproved list (LAM-010 / LAM-014)
// ---------------------------------------------------------------------------

export function listDisapproved(
  rows: readonly LeaveReportRow[],
): LeaveReportRow[] {
  return rows
    .filter((row) => row.status === "disapproved")
    .sort((a, b) => b.dateFrom.localeCompare(a.dateFrom));
}

// ---------------------------------------------------------------------------
// CSV building (client download helpers)
// ---------------------------------------------------------------------------

/** Escape a single CSV cell per RFC 4180. */
export function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build a CSV document (CRLF line endings for Excel compatibility). */
export function buildCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<unknown>>,
): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(","));
  }
  return lines.join("\r\n");
}
