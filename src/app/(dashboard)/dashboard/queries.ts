import { db } from '@/lib/db';
import {
  employees,
  plantillaPositions,
  leaveApplications,
  payrollPeriods,
  auditLogs,
  systemUsers,
  remittanceBatches,
  gsisRemittanceBatches,
} from '@/lib/db/schema';
import { eq, and, isNull, count, sql, desc, gte, lte, inArray } from 'drizzle-orm';

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
  status: 'draft' | 'processing';
  scope: 'regular' | 'jo_cos';
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
      .where(and(eq(employees.status, 'active'), isNull(employees.deletedAt))),

    // Permanent / temporary / coterminous / casual (non-JO/COS)
    db
      .select({ c: count() })
      .from(employees)
      .where(
        and(
          eq(employees.status, 'active'),
          isNull(employees.deletedAt),
          inArray(employees.appointmentType, [
            'permanent',
            'temporary',
            'coterminous',
            'casual',
          ]),
        ),
      ),

    // Job Order + Contract of Service
    db
      .select({ c: count() })
      .from(employees)
      .where(
        and(
          eq(employees.status, 'active'),
          isNull(employees.deletedAt),
          inArray(employees.appointmentType, ['job_order', 'contract_of_service']),
        ),
      ),

    // Vacant plantilla positions (is_filled = false, not soft-deleted)
    db
      .select({ c: count() })
      .from(plantillaPositions)
      .where(
        and(eq(plantillaPositions.isFilled, false), isNull(plantillaPositions.deletedAt)),
      ),

    // Pending leave applications
    db
      .select({ c: count() })
      .from(leaveApplications)
      .where(eq(leaveApplications.status, 'pending')),

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
          inArray(payrollPeriods.status, ['draft', 'processing']),
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
          inArray(remittanceBatches.status, ['draft', 'generated']),
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
      .where(inArray(gsisRemittanceBatches.status, ['draft', 'generated'])),
  ]);

  const remittanceTotal = Number(remittanceResult[0]?.total ?? '0');
  const gsisTotal = Number(gsisResult[0]?.total ?? '0');
  const combined = remittanceTotal + gsisTotal;

  return combined.toFixed(2);
}

/**
 * Returns the last `limit` audit log entries joined with system_users for
 * a human-readable performer name.
 */
export async function getRecentActivity(limit = 10): Promise<RecentActivityRow[]> {
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
    performedBy: row.userEmail ?? 'System',
    performedAt: row.createdAt.toISOString(),
  }));
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
        inArray(payrollPeriods.status, ['draft', 'processing']),
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
    status: row.status as 'draft' | 'processing',
    scope: row.scope as 'regular' | 'jo_cos',
  }));
}
