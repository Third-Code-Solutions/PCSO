import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  employees,
  plantillaPositions,
  leaveApplications,
  leaveCredits,
  leaveTypes,
  payrollPeriods,
  payrollRecords,
  auditLogs,
  systemUsers,
  remittanceBatches,
  gsisRemittanceBatches,
  holidays,
  dtrPeriods,
  attendanceLogs,
  salnSubmissions,
  overtimeRequests,
  documentRequests,
  notifications,
} from "@/lib/db/schema";
import {
  eq,
  and,
  isNull,
  count,
  sql,
  desc,
  gte,
  lte,
  inArray,
  notInArray,
} from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KpiCounts {
  totalActiveEmployees: number;
  permanentCount: number;
  joCosCount: number;
  vacantPositions: number;
  pendingLeaveApplications: number;
  /** Days until next payroll period end; 0 means today or overdue */
  payrollCutoffDays: number;
  /** ISO date string of the next payroll cutoff end date; null if none */
  nextCutoffDate: string | null;
  /** Human-readable label for the next payroll period */
  nextPeriodName: string | null;
}

export interface RecentActivityRow {
  id: string;
  action: string;
  tableName: string;
  recordId: string | null;
  performedBy: string;
  performedAt: string;
}

export interface UpcomingCutoffRow {
  id: string;
  name: string;
  periodEnd: string;
  payDate: string;
  status: "draft" | "processing";
  scope: "regular" | "jo_cos";
}

export interface PersonalKpis {
  /** Total VL + SL balance across the current year */
  leaveBalanceDays: number;
  /** Pending leave applications submitted by this employee */
  pendingLeaveApplications: number;
  /** Approved leave applications in the current year */
  approvedLeaveApplications: number;
  /** Days until next payroll cutoff */
  payrollCutoffDays: number;
  /** Human-readable label for the next payroll period, if any */
  nextPeriodName: string | null;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns KPI counts for the dashboard top row.
 * All queries run in parallel via Promise.all.
 */
export async function getKpiCounts(): Promise<KpiCounts> {
  const [
    activeResult,
    permanentResult,
    joCosResult,
    vacantResult,
    pendingLeaveResult,
    nextPeriodResult,
  ] = await Promise.all([
    // Total active employees (not soft-deleted)
    db
      .select({ c: count() })
      .from(employees)
      .where(and(eq(employees.status, "active"), isNull(employees.deletedAt))),

    // Permanent / temporary / coterminous / casual (non-JO/COS)
    db
      .select({ c: count() })
      .from(employees)
      .where(
        and(
          eq(employees.status, "active"),
          isNull(employees.deletedAt),
          inArray(employees.appointmentType, [
            "permanent",
            "temporary",
            "coterminous",
            "casual",
          ]),
        ),
      ),

    // Non-organic (Job Order + Contract of Service + Confidential Agent)
    db
      .select({ c: count() })
      .from(employees)
      .where(
        and(
          eq(employees.status, "active"),
          isNull(employees.deletedAt),
          inArray(employees.appointmentType, [
            "job_order",
            "contract_of_service",
            "confidential_agent",
          ]),
        ),
      ),

    // Vacant plantilla positions (is_filled = false, not soft-deleted)
    db
      .select({ c: count() })
      .from(plantillaPositions)
      .where(
        and(
          eq(plantillaPositions.isFilled, false),
          isNull(plantillaPositions.deletedAt),
        ),
      ),

    // Pending leave applications
    db
      .select({ c: count() })
      .from(leaveApplications)
      .where(eq(leaveApplications.status, "pending")),

    // Next payroll period with status draft or processing, ordered by period_end asc
    db
      .select({
        id: payrollPeriods.id,
        name: payrollPeriods.name,
        periodEnd: payrollPeriods.periodEnd,
      })
      .from(payrollPeriods)
      .where(
        and(
          inArray(payrollPeriods.status, ["draft", "processing"]),
          isNull(payrollPeriods.deletedAt),
        ),
      )
      .orderBy(payrollPeriods.periodEnd)
      .limit(1),
  ]);

  const totalActiveEmployees = Number(activeResult[0]?.c ?? 0);
  const permanentCount = Number(permanentResult[0]?.c ?? 0);
  const joCosCount = Number(joCosResult[0]?.c ?? 0);
  const vacantPositions = Number(vacantResult[0]?.c ?? 0);
  const pendingLeaveApplications = Number(pendingLeaveResult[0]?.c ?? 0);

  const nextPeriod = nextPeriodResult[0] ?? null;
  let payrollCutoffDays = 0;
  let nextCutoffDate: string | null = null;
  let nextPeriodName: string | null = null;

  if (nextPeriod) {
    nextCutoffDate = nextPeriod.periodEnd;
    nextPeriodName = nextPeriod.name;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(nextPeriod.periodEnd);
    cutoff.setHours(0, 0, 0, 0);
    const diffMs = cutoff.getTime() - today.getTime();
    payrollCutoffDays = Math.max(0, Math.ceil(diffMs / 86_400_000));
  }

  return {
    totalActiveEmployees,
    permanentCount,
    joCosCount,
    vacantPositions,
    pendingLeaveApplications,
    payrollCutoffDays,
    nextCutoffDate,
    nextPeriodName,
  };
}

/**
 * Sums totalAmount across remittance_batches (draft/generated) and
 * totalRemittance across gsis_remittance_batches (draft/generated)
 * where the period overlaps the current calendar month.
 *
 * Returns a numeric string per CONVENTIONS.md money rules.
 */
export async function getTotalRemittancesDueThisMonth(): Promise<string> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);

  const [remittanceResult, gsisResult] = await Promise.all([
    // PhilHealth / Pag-IBIG / BIR batches (draft or generated = not yet remitted)
    db
      .select({
        total: sql<string>`COALESCE(SUM(${remittanceBatches.totalAmount}), '0')`,
      })
      .from(remittanceBatches)
      .where(
        and(
          inArray(remittanceBatches.status, ["draft", "generated"]),
          lte(remittanceBatches.periodStart, monthEnd),
          gte(remittanceBatches.periodEnd, monthStart),
        ),
      ),

    // GSIS batches (draft or generated)
    db
      .select({
        total: sql<string>`COALESCE(SUM(${gsisRemittanceBatches.totalRemittance}), '0')`,
      })
      .from(gsisRemittanceBatches)
      .where(inArray(gsisRemittanceBatches.status, ["draft", "generated"])),
  ]);

  const remittanceTotal = Number(remittanceResult[0]?.total ?? "0");
  const gsisTotal = Number(gsisResult[0]?.total ?? "0");
  const combined = remittanceTotal + gsisTotal;

  return combined.toFixed(2);
}

/**
 * Returns the last `limit` audit log entries joined with system_users for
 * a human-readable performer name.
 */
export async function getRecentActivity(
  limit = 10,
): Promise<RecentActivityRow[]> {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      tableName: auditLogs.tableName,
      recordId: auditLogs.recordId,
      createdAt: auditLogs.createdAt,
      userEmail: systemUsers.email,
    })
    .from(auditLogs)
    .leftJoin(systemUsers, eq(auditLogs.userId, systemUsers.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    tableName: row.tableName,
    recordId: row.recordId ?? null,
    performedBy: row.userEmail ?? "System",
    performedAt: row.createdAt.toISOString(),
  }));
}

/**
 * Personal KPIs for self-service employees. Scoped to a single employee UUID.
 * Returns zeros when the employee has no records — safe to render.
 */
export async function getPersonalKpis(
  employeeId: string,
): Promise<PersonalKpis> {
  const currentYear = new Date().getFullYear();

  const [balanceRows, pendingRows, approvedRows, nextPeriodRows] =
    await Promise.all([
      // Sum of VL + SL balance for the current year. Gracefully falls back to 0.
      db
        .select({
          total: sql<string>`COALESCE(SUM(${leaveCredits.balance}), '0')`,
        })
        .from(leaveCredits)
        .leftJoin(leaveTypes, eq(leaveCredits.leaveTypeId, leaveTypes.id))
        .where(
          and(
            eq(leaveCredits.employeeId, employeeId),
            eq(leaveCredits.year, currentYear),
            inArray(leaveTypes.code, ["VL", "SL"]),
          ),
        ),

      // Pending applications
      db
        .select({ c: count() })
        .from(leaveApplications)
        .where(
          and(
            eq(leaveApplications.employeeId, employeeId),
            eq(leaveApplications.status, "pending"),
          ),
        ),

      // Approved applications this year
      db
        .select({ c: count() })
        .from(leaveApplications)
        .where(
          and(
            eq(leaveApplications.employeeId, employeeId),
            eq(leaveApplications.status, "approved"),
            gte(leaveApplications.dateFrom, `${currentYear}-01-01`),
            lte(leaveApplications.dateFrom, `${currentYear}-12-31`),
          ),
        ),

      // Next payroll cutoff (org-wide; scoped-filtering not available at employee grain)
      db
        .select({
          name: payrollPeriods.name,
          periodEnd: payrollPeriods.periodEnd,
        })
        .from(payrollPeriods)
        .where(
          and(
            inArray(payrollPeriods.status, ["draft", "processing"]),
            isNull(payrollPeriods.deletedAt),
          ),
        )
        .orderBy(payrollPeriods.periodEnd)
        .limit(1),
    ]);

  const leaveBalanceDays = Number(balanceRows[0]?.total ?? "0");
  const pendingLeaveApplications = Number(pendingRows[0]?.c ?? 0);
  const approvedLeaveApplications = Number(approvedRows[0]?.c ?? 0);

  const nextPeriod = nextPeriodRows[0] ?? null;
  let payrollCutoffDays = 0;
  let nextPeriodName: string | null = null;
  if (nextPeriod) {
    nextPeriodName = nextPeriod.name;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(nextPeriod.periodEnd);
    cutoff.setHours(0, 0, 0, 0);
    const diffMs = cutoff.getTime() - today.getTime();
    payrollCutoffDays = Math.max(0, Math.ceil(diffMs / 86_400_000));
  }

  return {
    leaveBalanceDays,
    pendingLeaveApplications,
    approvedLeaveApplications,
    payrollCutoffDays,
    nextPeriodName,
  };
}

/**
 * Returns the next 3 payroll periods with status 'draft' or 'processing',
 * ordered by period_end ascending (soonest first).
 */
export async function getUpcomingCutoffs(): Promise<UpcomingCutoffRow[]> {
  const rows = await db
    .select({
      id: payrollPeriods.id,
      name: payrollPeriods.name,
      periodEnd: payrollPeriods.periodEnd,
      payDate: payrollPeriods.payDate,
      status: payrollPeriods.status,
      scope: payrollPeriods.scope,
    })
    .from(payrollPeriods)
    .where(
      and(
        inArray(payrollPeriods.status, ["draft", "processing"]),
        isNull(payrollPeriods.deletedAt),
      ),
    )
    .orderBy(payrollPeriods.periodEnd)
    .limit(3);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    periodEnd: row.periodEnd,
    payDate: row.payDate,
    status: row.status as "draft" | "processing",
    scope: row.scope as "regular" | "jo_cos",
  }));
}

// ─── Role-aware dashboard types ──────────────────────────────────────────────

export interface AdminKpis {
  totalEmployees: number;
  pendingLeaves: number;
  pendingOvertimes: number;
  pendingDtrApprovals: number;
  salnNonFilers: number;
  upcomingHolidays: number;
}

export interface PayrollAdminKpis {
  activePayrollPeriodName: string | null;
  activePayrollPeriodId: string | null;
  pendingPayrollEntries: number;
  remittanceDeadlines: number;
  payrollEmployeeCount: number;
}

export interface LeaveApproverKpis {
  pendingMyApprovals: number;
  approvedLeavesToday: number;
  teamOnLeaveToday: number;
}

export interface EmployeeKpis {
  vlBalance: number;
  slBalance: number;
  latestPayslipPeriodName: string | null;
  latestPayslipPeriodId: string | null;
  dtrTodayStatus: "present" | "incomplete" | "absent";
  salnDeadline: string | null;
  nextHolidayName: string | null;
  nextHolidayDate: string | null;
  pendingDocRequests: number;
}

// ─── Role-aware dashboard queries ────────────────────────────────────────────

/**
 * Returns the count of pending overtime requests.
 */
export async function getPendingOvertimeCount(): Promise<number> {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(overtimeRequests)
      .where(eq(overtimeRequests.status, "pending"));
    return Number(row?.c ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Count DTR periods submitted and awaiting approval.
 */
export async function getPendingDtrApprovalsCount(): Promise<number> {
  try {
    const [row] = await db
      .select({ c: count() })
      .from(dtrPeriods)
      .where(eq(dtrPeriods.status, "submitted"));
    return Number(row?.c ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Count of holidays occurring in the next 90 days.
 */
export async function getUpcomingHolidaysCount(
  daysAhead = 90,
): Promise<number> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + daysAhead * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const [row] = await db
      .select({ c: count() })
      .from(holidays)
      .where(
        and(
          gte(holidays.holidayDate, today),
          lte(holidays.holidayDate, horizon),
        ),
      );
    return Number(row?.c ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Returns the next upcoming holiday (name + date) from today.
 */
export async function getNextHoliday(): Promise<{
  name: string;
  date: string;
} | null> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [row] = await db
      .select({ name: holidays.name, date: holidays.holidayDate })
      .from(holidays)
      .where(gte(holidays.holidayDate, today))
      .orderBy(holidays.holidayDate)
      .limit(1);

    if (!row) return null;
    return { name: row.name, date: row.date };
  } catch {
    return null;
  }
}

/**
 * Count employees who have NOT filed SALN for the given year.
 * Defaults to last calendar year (annual SALN is due April 30 for prior year).
 */
export async function getSalnNonFilersCount(year?: number): Promise<number> {
  try {
    const targetYear = year ?? new Date().getFullYear() - 1;

    const [activeRow] = await db
      .select({ c: count() })
      .from(employees)
      .where(and(eq(employees.status, "active"), isNull(employees.deletedAt)));

    const activeCount = Number(activeRow?.c ?? 0);

    const filerRows = await db
      .selectDistinct({ employeeId: salnSubmissions.employeeId })
      .from(salnSubmissions)
      .where(
        and(
          eq(salnSubmissions.year, targetYear),
          inArray(salnSubmissions.status, [
            "submitted",
            "received",
            "verified",
          ]),
        ),
      );

    return Math.max(0, activeCount - filerRows.length);
  } catch {
    return 0;
  }
}

/**
 * System-wide KPIs for super_admin / hr_admin.
 */
export async function getAdminDashboardKpis(): Promise<AdminKpis> {
  const safeCount = async (
    query: Promise<{ c: unknown }[]>,
  ): Promise<number> => {
    try {
      const [row] = await query;
      return Number(row?.c ?? 0);
    } catch {
      return 0;
    }
  };

  const [
    totalEmployees,
    pendingLeaves,
    pendingOvertimes,
    pendingDtrApprovals,
    upcomingHolidays,
    salnNonFilers,
  ] = await Promise.all([
    safeCount(
      db
        .select({ c: count() })
        .from(employees)
        .where(
          and(eq(employees.status, "active"), isNull(employees.deletedAt)),
        ),
    ),
    safeCount(
      db
        .select({ c: count() })
        .from(leaveApplications)
        .where(eq(leaveApplications.status, "pending")),
    ),
    getPendingOvertimeCount(),
    getPendingDtrApprovalsCount(),
    getUpcomingHolidaysCount(),
    getSalnNonFilersCount(),
  ]);

  return {
    totalEmployees,
    pendingLeaves,
    pendingOvertimes,
    pendingDtrApprovals,
    salnNonFilers,
    upcomingHolidays,
  };
}

/**
 * Payroll admin dashboard KPIs.
 */
export async function getPayrollAdminKpis(): Promise<PayrollAdminKpis> {
  try {
    const [activePeriodRows, totalEmpRow, remittancesActiveRow] =
      await Promise.all([
        db
          .select({
            id: payrollPeriods.id,
            name: payrollPeriods.name,
          })
          .from(payrollPeriods)
          .where(
            and(
              inArray(payrollPeriods.status, ["draft", "processing"]),
              isNull(payrollPeriods.deletedAt),
            ),
          )
          .orderBy(payrollPeriods.periodEnd)
          .limit(1),
        db
          .select({ c: count() })
          .from(employees)
          .where(
            and(eq(employees.status, "active"), isNull(employees.deletedAt)),
          ),
        db
          .select({ c: count() })
          .from(remittanceBatches)
          .where(inArray(remittanceBatches.status, ["draft", "generated"])),
      ]);

    const activePeriod = activePeriodRows[0] ?? null;
    let pendingPayrollEntries = 0;

    if (activePeriod) {
      try {
        const [entries] = await db
          .select({ c: count() })
          .from(payrollRecords)
          .where(
            and(
              eq(payrollRecords.periodId, activePeriod.id),
              notInArray(payrollRecords.status, ["paid"]),
            ),
          );
        pendingPayrollEntries = Number(entries?.c ?? 0);
      } catch {
        pendingPayrollEntries = 0;
      }
    }

    return {
      activePayrollPeriodName: activePeriod?.name ?? null,
      activePayrollPeriodId: activePeriod?.id ?? null,
      pendingPayrollEntries,
      remittanceDeadlines: Number(remittancesActiveRow[0]?.c ?? 0),
      payrollEmployeeCount: Number(totalEmpRow[0]?.c ?? 0),
    };
  } catch {
    return {
      activePayrollPeriodName: null,
      activePayrollPeriodId: null,
      pendingPayrollEntries: 0,
      remittanceDeadlines: 0,
      payrollEmployeeCount: 0,
    };
  }
}

/**
 * Leave-approver dashboard KPIs.
 *
 * When `officeId` is provided, counts are scoped to employees in that office.
 * Falls back to org-wide counts when `officeId` is null/undefined.
 */
export async function getLeaveApproverKpis(
  _approverUserId: string,
  officeId?: string | null,
): Promise<LeaveApproverKpis> {
  const today = new Date().toISOString().slice(0, 10);

  if (officeId) {
    const [pendingRow, approvedTodayRow, onLeaveTodayRow] = await Promise.all([
      db
        .select({ c: count() })
        .from(leaveApplications)
        .innerJoin(employees, eq(leaveApplications.employeeId, employees.id))
        .where(
          and(
            eq(leaveApplications.status, "pending"),
            eq(employees.officeId, officeId),
          ),
        ),
      db
        .select({ c: count() })
        .from(leaveApplications)
        .innerJoin(employees, eq(leaveApplications.employeeId, employees.id))
        .where(
          and(
            eq(leaveApplications.status, "approved"),
            gte(leaveApplications.approvedAt, new Date(`${today}T00:00:00Z`)),
            eq(employees.officeId, officeId),
          ),
        ),
      db
        .select({ c: count() })
        .from(leaveApplications)
        .innerJoin(employees, eq(leaveApplications.employeeId, employees.id))
        .where(
          and(
            eq(leaveApplications.status, "approved"),
            lte(leaveApplications.dateFrom, today),
            gte(leaveApplications.dateTo, today),
            eq(employees.officeId, officeId),
          ),
        ),
    ]);

    return {
      pendingMyApprovals: Number(pendingRow[0]?.c ?? 0),
      approvedLeavesToday: Number(approvedTodayRow[0]?.c ?? 0),
      teamOnLeaveToday: Number(onLeaveTodayRow[0]?.c ?? 0),
    };
  }

  // Org-wide fallback when no officeId is provided.
  const [pendingRow, approvedTodayRow, onLeaveTodayRow] = await Promise.all([
    db
      .select({ c: count() })
      .from(leaveApplications)
      .where(eq(leaveApplications.status, "pending")),
    db
      .select({ c: count() })
      .from(leaveApplications)
      .where(
        and(
          eq(leaveApplications.status, "approved"),
          gte(leaveApplications.approvedAt, new Date(`${today}T00:00:00Z`)),
        ),
      ),
    db
      .select({ c: count() })
      .from(leaveApplications)
      .where(
        and(
          eq(leaveApplications.status, "approved"),
          lte(leaveApplications.dateFrom, today),
          gte(leaveApplications.dateTo, today),
        ),
      ),
  ]);

  return {
    pendingMyApprovals: Number(pendingRow[0]?.c ?? 0),
    approvedLeavesToday: Number(approvedTodayRow[0]?.c ?? 0),
    teamOnLeaveToday: Number(onLeaveTodayRow[0]?.c ?? 0),
  };
}

// ─── Supervisor / Executive / Auditor KPI types ──────────────────────────────

export interface SupervisorKpis {
  pendingTeamLeaves: number;
  teamOnLeaveToday: number;
  pendingOtApprovals: number;
  upcomingHolidays: number;
}

export interface ExecutiveKpis {
  totalEmployees: number;
  vacantPositions: number;
  salnNonFilers: number;
  upcomingHolidays: number;
}

export interface AuditorKpis {
  salnNonFilers: number;
  auditEntriesLast7Days: number;
  pendingLeaves: number;
  upcomingHolidays: number;
}

export interface SystemAdminKpis {
  totalSystemUsers: number;
  activeSystemUsers: number;
  usersByRole: { role: string; count: number }[];
  totalEmployees: number;
  auditEntriesLast7Days: number;
  securityEventsLast7Days: number;
  notificationsLast7Days: number;
  recentSecurityEvents: RecentActivityRow[];
}

/**
 * Supervisor / manager dashboard KPIs.
 * When `officeId` is provided, counts are scoped to employees in that office.
 * Falls back to org-wide counts when `officeId` is null/undefined.
 */
export async function getSupervisorKpis(
  _supervisorUserId: string,
  officeId?: string | null,
): Promise<SupervisorKpis> {
  try {
    const today = new Date().toISOString().slice(0, 10);

    if (officeId) {
      const unitEmployeeRows = await db
        .select({ id: employees.id })
        .from(employees)
        .where(
          and(
            eq(employees.officeId, officeId),
            eq(employees.status, "active"),
            isNull(employees.deletedAt),
          ),
        );

      const unitEmployeeIds = unitEmployeeRows.map((r) => r.id);

      const [pendingRow, onLeaveTodayRow, pendingOtRow, upcomingHol] =
        await Promise.all([
          unitEmployeeIds.length > 0
            ? db
                .select({ c: count() })
                .from(leaveApplications)
                .where(
                  and(
                    eq(leaveApplications.status, "pending"),
                    inArray(leaveApplications.employeeId, unitEmployeeIds),
                  ),
                )
            : Promise.resolve([{ c: 0 }]),
          unitEmployeeIds.length > 0
            ? db
                .select({ c: count() })
                .from(leaveApplications)
                .where(
                  and(
                    eq(leaveApplications.status, "approved"),
                    lte(leaveApplications.dateFrom, today),
                    gte(leaveApplications.dateTo, today),
                    inArray(leaveApplications.employeeId, unitEmployeeIds),
                  ),
                )
            : Promise.resolve([{ c: 0 }]),
          unitEmployeeIds.length > 0
            ? db
                .select({ c: count() })
                .from(overtimeRequests)
                .where(
                  and(
                    eq(overtimeRequests.status, "pending"),
                    inArray(overtimeRequests.employeeId, unitEmployeeIds),
                  ),
                )
            : Promise.resolve([{ c: 0 }]),
          getUpcomingHolidaysCount(),
        ]);

      return {
        pendingTeamLeaves: Number(pendingRow[0]?.c ?? 0),
        teamOnLeaveToday: Number(onLeaveTodayRow[0]?.c ?? 0),
        pendingOtApprovals: Number(pendingOtRow[0]?.c ?? 0),
        upcomingHolidays: upcomingHol,
      };
    }

    // Org-wide fallback when no officeId is provided.
    const [pendingRow, onLeaveTodayRow, pendingOtRow, upcomingHol] =
      await Promise.all([
        db
          .select({ c: count() })
          .from(leaveApplications)
          .where(eq(leaveApplications.status, "pending")),
        db
          .select({ c: count() })
          .from(leaveApplications)
          .where(
            and(
              eq(leaveApplications.status, "approved"),
              lte(leaveApplications.dateFrom, today),
              gte(leaveApplications.dateTo, today),
            ),
          ),
        db
          .select({ c: count() })
          .from(overtimeRequests)
          .where(eq(overtimeRequests.status, "pending")),
        getUpcomingHolidaysCount(),
      ]);

    return {
      pendingTeamLeaves: Number(pendingRow[0]?.c ?? 0),
      teamOnLeaveToday: Number(onLeaveTodayRow[0]?.c ?? 0),
      pendingOtApprovals: Number(pendingOtRow[0]?.c ?? 0),
      upcomingHolidays: upcomingHol,
    };
  } catch {
    return {
      pendingTeamLeaves: 0,
      teamOnLeaveToday: 0,
      pendingOtApprovals: 0,
      upcomingHolidays: 0,
    };
  }
}

/**
 * Executive / leadership dashboard KPIs. Read-only aggregates.
 */
export async function getExecutiveKpis(): Promise<ExecutiveKpis> {
  try {
    const [totalEmpRow, vacantRow, upcomingHol, salnNon] = await Promise.all([
      db
        .select({ c: count() })
        .from(employees)
        .where(
          and(eq(employees.status, "active"), isNull(employees.deletedAt)),
        ),
      db
        .select({ c: count() })
        .from(plantillaPositions)
        .where(
          and(
            eq(plantillaPositions.isFilled, false),
            isNull(plantillaPositions.deletedAt),
          ),
        ),
      getUpcomingHolidaysCount(),
      getSalnNonFilersCount(),
    ]);

    return {
      totalEmployees: Number(totalEmpRow[0]?.c ?? 0),
      vacantPositions: Number(vacantRow[0]?.c ?? 0),
      salnNonFilers: salnNon,
      upcomingHolidays: upcomingHol,
    };
  } catch {
    return {
      totalEmployees: 0,
      vacantPositions: 0,
      salnNonFilers: 0,
      upcomingHolidays: 0,
    };
  }
}

/**
 * Compliance / audit dashboard KPIs. Read-only aggregates.
 */
export async function getAuditorKpis(): Promise<AuditorKpis> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

    const [auditRow, salnNon, pendingLeaveRow, upcomingHol] = await Promise.all(
      [
        db
          .select({ c: count() })
          .from(auditLogs)
          .where(gte(auditLogs.createdAt, sevenDaysAgo)),
        getSalnNonFilersCount(),
        db
          .select({ c: count() })
          .from(leaveApplications)
          .where(eq(leaveApplications.status, "pending")),
        getUpcomingHolidaysCount(),
      ],
    );

    return {
      salnNonFilers: salnNon,
      auditEntriesLast7Days: Number(auditRow[0]?.c ?? 0),
      pendingLeaves: Number(pendingLeaveRow[0]?.c ?? 0),
      upcomingHolidays: upcomingHol,
    };
  } catch {
    return {
      salnNonFilers: 0,
      auditEntriesLast7Days: 0,
      pendingLeaves: 0,
      upcomingHolidays: 0,
    };
  }
}

/**
 * Audit-log actions treated as security-relevant on the SysAdmin dashboard
 * (LOG-004): auth events, destructive changes, and data exports. There is no
 * dedicated failed-login store yet — Supabase Auth failures never reach
 * audit_logs — so no failed-login KPI is surfaced.
 */
const SECURITY_AUDIT_ACTIONS = ["login", "signout_all", "delete", "export"];

/**
 * System Administrator dashboard KPIs (PRD 3.4 D7). Read-only aggregates:
 * user counts by role, security-relevant audit activity, and platform totals.
 */
export async function getSystemAdminKpis(): Promise<SystemAdminKpis> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

    const [
      roleRows,
      activeUserRow,
      totalEmpRow,
      auditRow,
      securityRow,
      notificationRow,
      recentSecurityRows,
    ] = await Promise.all([
      db
        .select({ role: systemUsers.role, c: count() })
        .from(systemUsers)
        .groupBy(systemUsers.role),
      db
        .select({ c: count() })
        .from(systemUsers)
        .where(eq(systemUsers.isActive, true)),
      db
        .select({ c: count() })
        .from(employees)
        .where(
          and(eq(employees.status, "active"), isNull(employees.deletedAt)),
        ),
      db
        .select({ c: count() })
        .from(auditLogs)
        .where(gte(auditLogs.createdAt, sevenDaysAgo)),
      db
        .select({ c: count() })
        .from(auditLogs)
        .where(
          and(
            gte(auditLogs.createdAt, sevenDaysAgo),
            inArray(auditLogs.action, SECURITY_AUDIT_ACTIONS),
          ),
        ),
      db
        .select({ c: count() })
        .from(notifications)
        .where(gte(notifications.createdAt, sevenDaysAgo)),
      db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          tableName: auditLogs.tableName,
          recordId: auditLogs.recordId,
          createdAt: auditLogs.createdAt,
          userEmail: systemUsers.email,
        })
        .from(auditLogs)
        .leftJoin(systemUsers, eq(auditLogs.userId, systemUsers.id))
        .where(inArray(auditLogs.action, SECURITY_AUDIT_ACTIONS))
        .orderBy(desc(auditLogs.createdAt))
        .limit(5),
    ]);

    const usersByRole = roleRows
      .map((row) => ({ role: row.role, count: Number(row.c ?? 0) }))
      .sort((a, b) => b.count - a.count);
    const totalSystemUsers = usersByRole.reduce((sum, r) => sum + r.count, 0);

    return {
      totalSystemUsers,
      activeSystemUsers: Number(activeUserRow[0]?.c ?? 0),
      usersByRole,
      totalEmployees: Number(totalEmpRow[0]?.c ?? 0),
      auditEntriesLast7Days: Number(auditRow[0]?.c ?? 0),
      securityEventsLast7Days: Number(securityRow[0]?.c ?? 0),
      notificationsLast7Days: Number(notificationRow[0]?.c ?? 0),
      recentSecurityEvents: recentSecurityRows.map((row) => ({
        id: row.id,
        action: row.action,
        tableName: row.tableName,
        recordId: row.recordId ?? null,
        performedBy: row.userEmail ?? "System",
        performedAt: row.createdAt.toISOString(),
      })),
    };
  } catch {
    return {
      totalSystemUsers: 0,
      activeSystemUsers: 0,
      usersByRole: [],
      totalEmployees: 0,
      auditEntriesLast7Days: 0,
      securityEventsLast7Days: 0,
      notificationsLast7Days: 0,
      recentSecurityEvents: [],
    };
  }
}

/**
 * Personal dashboard KPIs for employee_self_service.
 */
export async function getEmployeeDashboardKpis(
  employeeId: string,
): Promise<EmployeeKpis> {
  const now = new Date();
  const year = now.getFullYear();
  const deadlineThisYear = new Date(Date.UTC(year, 3, 30));
  const salnDeadline =
    now <= deadlineThisYear
      ? deadlineThisYear.toISOString().slice(0, 10)
      : new Date(Date.UTC(year + 1, 3, 30)).toISOString().slice(0, 10);

  const currentYear = now.getFullYear();
  const today = now.toISOString().slice(0, 10);

  const safeQuery = async <T>(query: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await query;
    } catch {
      return fallback;
    }
  };

  const creditRowsPromise = (async () => {
    try {
      const { data } = await supabaseAdmin
        .from("leave_credits")
        .select("balance, leave_types(code)")
        .eq("employee_id", employeeId)
        .eq("year", currentYear);
      return (data ?? [])
        .map((r) => ({
          code:
            (r.leave_types as unknown as { code: string } | null)?.code ?? null,
          balance: r.balance as string | null,
        }))
        .filter((r) => r.code === "VL" || r.code === "SL");
    } catch {
      return [] as { code: string | null; balance: string | null }[];
    }
  })();

  const [creditRows, latestPayrollRows, todayLog, nextHol, docRequestRow] =
    await Promise.all([
      creditRowsPromise,
      safeQuery(
        db
          .select({
            periodId: payrollRecords.periodId,
            periodName: payrollPeriods.name,
            periodEnd: payrollPeriods.periodEnd,
          })
          .from(payrollRecords)
          .leftJoin(
            payrollPeriods,
            eq(payrollRecords.periodId, payrollPeriods.id),
          )
          .where(
            and(
              eq(payrollRecords.employeeId, employeeId),
              eq(payrollRecords.status, "paid"),
            ),
          )
          .orderBy(desc(payrollPeriods.periodEnd))
          .limit(1),
        [],
      ),
      safeQuery(
        db
          .select({
            timeIn: attendanceLogs.timeIn,
            timeOut: attendanceLogs.timeOut,
          })
          .from(attendanceLogs)
          .where(
            and(
              eq(attendanceLogs.employeeId, employeeId),
              eq(attendanceLogs.logDate, today),
            ),
          )
          .limit(1),
        [],
      ),
      getNextHoliday(),
      safeQuery(
        db
          .select({ c: count() })
          .from(documentRequests)
          .where(
            and(
              eq(documentRequests.employeeId, employeeId),
              notInArray(documentRequests.status, ["released", "disapproved"]),
            ),
          ),
        [{ c: 0 }],
      ),
    ]);

  let vlBalance = 0;
  let slBalance = 0;
  for (const row of creditRows) {
    if (row.code === "VL") vlBalance = Number(row.balance ?? 0);
    if (row.code === "SL") slBalance = Number(row.balance ?? 0);
  }

  const latestPayslip = latestPayrollRows[0] ?? null;
  const log = todayLog[0] ?? null;

  let dtrTodayStatus: "present" | "incomplete" | "absent" = "absent";
  if (log?.timeIn && log?.timeOut) dtrTodayStatus = "present";
  else if (log?.timeIn || log?.timeOut) dtrTodayStatus = "incomplete";

  return {
    vlBalance,
    slBalance,
    latestPayslipPeriodName: latestPayslip?.periodName ?? null,
    latestPayslipPeriodId: latestPayslip?.periodId ?? null,
    dtrTodayStatus,
    salnDeadline,
    nextHolidayName: nextHol?.name ?? null,
    nextHolidayDate: nextHol?.date ?? null,
    pendingDocRequests: Number(docRequestRow[0]?.c ?? 0),
  };
}
