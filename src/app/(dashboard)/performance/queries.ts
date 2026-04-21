/**
 * Performance module read-only queries — PCSO HRIS Phase 12
 *
 * Used by Server Components. All queries use the Supabase server client
 * with RLS awareness.
 */

import { createServerClient } from "@/lib/supabase/server";
import type { AdjectivalRating } from "@/lib/constants/performance";
import { RATING_BANDS } from "@/lib/constants/performance";
import {
  checkStepEligibility,
  toRatingRecord,
} from "@/lib/utils/performance/step-eligibility";

// ─── Shared Row Types ─────────────────────────────────────────────────────────

export interface PerformancePeriodRow {
  id: string;
  year: number;
  semester: "1" | "2";
  dateFrom: string;
  dateTo: string;
  status: "open" | "rating" | "review" | "closed";
  label: string;
  createdAt: string;
}

export interface PerformanceRatingRow {
  id: string;
  employeeId: string;
  periodId: string;
  periodLabel: string;
  ratingType: "ipcrf" | "opcrf";
  numericalRating: string;
  adjectivalRating: AdjectivalRating;
  ratedBy: string;
  approvedBy: string | null;
  status: string;
  kras: KraRatingData[] | null;
  supervisorFeedback: string | null;
  raterRemarks: string | null;
  midYearRemarks: string | null;
  createdAt: string;
}

export interface KraRatingData {
  position: number;
  title: string;
  description?: string;
  weight: number;
  successIndicators: string;
  baseline?: string;
  actualAccomplishments?: string;
  rating?: number;
}

export interface StepIncrementRow {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeNo: string;
  fromStep: number;
  toStep: number;
  effectivityDate: string;
  basisPeriodIds: string[];
  status: string;
  approvedBy: string | null;
  remarks: string | null;
  createdAt: string;
}

export interface EligibleEmployeeRow {
  employeeId: string;
  employeeNo: string;
  fullName: string;
  positionTitle: string;
  salaryGrade: number;
  currentStep: number;
  officeId: string | null;
  officeName: string | null;
  consecutiveCount: number;
  triggerRule: string;
  qualifyingPeriods: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePeriodLabel(year: number, semester: string): string {
  return `${year}-${semester === "1" ? "S1" : "S2"}`;
}

function toPeriodRow(row: Record<string, unknown>): PerformancePeriodRow {
  const year = Number(row["year"] ?? 0);
  const semester = String(row["semester"] ?? "1") as "1" | "2";
  return {
    id: String(row["id"] ?? ""),
    year,
    semester,
    dateFrom: String(row["date_from"] ?? ""),
    dateTo: String(row["date_to"] ?? ""),
    status: String(row["status"] ?? "open") as PerformancePeriodRow["status"],
    label: makePeriodLabel(year, semester),
    createdAt: String(row["created_at"] ?? ""),
  };
}

/**
 * Extracts KRA items from the kras JSONB column.
 * Supports both the legacy array format and the envelope format:
 *   { items: KraRatingData[], monitoring?: {...}, review?: {...} }
 */
function extractKras(krasRaw: unknown): KraRatingData[] | null {
  if (Array.isArray(krasRaw)) return krasRaw as KraRatingData[];
  if (krasRaw !== null && typeof krasRaw === "object") {
    const envelope = krasRaw as Record<string, unknown>;
    if (Array.isArray(envelope["items"]))
      return envelope["items"] as KraRatingData[];
  }
  return null;
}

function extractMonitoringData(krasRaw: unknown): {
  supervisorFeedback: string | null;
  midYearRemarks: string | null;
  raterRemarks: string | null;
} {
  if (
    krasRaw !== null &&
    typeof krasRaw === "object" &&
    !Array.isArray(krasRaw)
  ) {
    const envelope = krasRaw as Record<string, unknown>;

    const raterRemarks =
      typeof envelope["raterRemarks"] === "string"
        ? envelope["raterRemarks"]
        : null;

    const mon = envelope["monitoring"];
    if (mon !== null && typeof mon === "object") {
      const m = mon as Record<string, unknown>;
      return {
        supervisorFeedback:
          typeof m["supervisorFeedback"] === "string"
            ? m["supervisorFeedback"]
            : null,
        midYearRemarks:
          typeof m["midYearRemarks"] === "string" ? m["midYearRemarks"] : null,
        raterRemarks,
      };
    }
    return { supervisorFeedback: null, midYearRemarks: null, raterRemarks };
  }
  return { supervisorFeedback: null, midYearRemarks: null, raterRemarks: null };
}

function toRatingRow(
  row: Record<string, unknown>,
  periodLabel: string,
): PerformanceRatingRow {
  const krasRaw = row["kras"];
  const kras = extractKras(krasRaw);
  const { supervisorFeedback, midYearRemarks, raterRemarks } =
    extractMonitoringData(krasRaw);

  return {
    id: String(row["id"] ?? ""),
    employeeId: String(row["employee_id"] ?? ""),
    periodId: String(row["period_id"] ?? ""),
    periodLabel,
    ratingType: String(row["rating_type"] ?? "ipcrf") as "ipcrf" | "opcrf",
    numericalRating: String(row["numerical_rating"] ?? "0"),
    adjectivalRating: String(
      row["adjectival_rating"] ?? "satisfactory",
    ) as AdjectivalRating,
    ratedBy: String(row["rated_by"] ?? ""),
    approvedBy:
      typeof row["approved_by"] === "string" ? row["approved_by"] : null,
    status: String(row["status"] ?? "draft"),
    kras,
    supervisorFeedback,
    raterRemarks,
    midYearRemarks,
    createdAt: String(row["created_at"] ?? ""),
  };
}

// ─── Performance Periods ──────────────────────────────────────────────────────

export async function getPerformancePeriods(): Promise<PerformancePeriodRow[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("performance_periods")
    .select("id, year, semester, date_from, date_to, status, created_at")
    .order("year", { ascending: false })
    .order("semester", { ascending: false });

  if (error)
    throw new Error(`Failed to fetch performance periods: ${error.message}`);

  return (data ?? []).map((row) => toPeriodRow(row as Record<string, unknown>));
}

export async function getPerformancePeriodById(
  periodId: string,
): Promise<PerformancePeriodRow | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("performance_periods")
    .select("id, year, semester, date_from, date_to, status, created_at")
    .eq("id", periodId)
    .single();

  if (error || !data) return null;

  return toPeriodRow(data as Record<string, unknown>);
}

// ─── Performance Ratings ──────────────────────────────────────────────────────

export async function getMyPerformanceRatings(
  employeeId: string,
): Promise<PerformanceRatingRow[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("performance_ratings")
    .select(
      `
      id,
      employee_id,
      period_id,
      rating_type,
      numerical_rating,
      adjectival_rating,
      rated_by,
      approved_by,
      status,
      kras,
      created_at,
      performance_periods ( year, semester )
    `,
    )
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to fetch ratings: ${error.message}`);

  return (data ?? []).map((row) => {
    const period = row.performance_periods as {
      year?: number;
      semester?: string;
    } | null;
    const periodLabel = period
      ? makePeriodLabel(Number(period.year), String(period.semester))
      : "Unknown";
    return toRatingRow(row as Record<string, unknown>, periodLabel);
  });
}

// ─── Approved IPCRF ratings with period dateFrom (for eligibility checks) ────

export interface ApprovedIpcrfRow extends PerformanceRatingRow {
  /** Actual period start date (YYYY-MM-DD) — used for chronological sorting in step-eligibility. */
  periodDateFrom: string;
}

/**
 * Returns approved IPCRF ratings for an employee, including the period's
 * actual dateFrom so step-eligibility calculations are chronologically correct.
 */
export async function getApprovedIpcrfWithPeriodDates(
  employeeId: string,
): Promise<ApprovedIpcrfRow[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("performance_ratings")
    .select(
      `
      id,
      employee_id,
      period_id,
      rating_type,
      numerical_rating,
      adjectival_rating,
      rated_by,
      approved_by,
      status,
      kras,
      created_at,
      performance_periods ( year, semester, date_from )
    `,
    )
    .eq("employee_id", employeeId)
    .eq("rating_type", "ipcrf")
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  if (error)
    throw new Error(`Failed to fetch approved IPCRF ratings: ${error.message}`);

  return (data ?? []).map((row) => {
    const period = row.performance_periods as {
      year?: number;
      semester?: string;
      date_from?: string;
    } | null;
    const periodLabel = period
      ? makePeriodLabel(Number(period.year), String(period.semester))
      : "Unknown";

    return {
      ...toRatingRow(row as Record<string, unknown>, periodLabel),
      periodDateFrom: String(
        period?.date_from ?? row.created_at ?? "2020-01-01",
      ),
    };
  });
}

export async function getPerformanceRatingById(
  ratingId: string,
): Promise<PerformanceRatingRow | null> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("performance_ratings")
    .select(
      `
      id,
      employee_id,
      period_id,
      rating_type,
      numerical_rating,
      adjectival_rating,
      rated_by,
      approved_by,
      status,
      kras,
      created_at,
      performance_periods ( year, semester )
    `,
    )
    .eq("id", ratingId)
    .single();

  if (error || !data) return null;

  const period = data.performance_periods as {
    year?: number;
    semester?: string;
  } | null;
  const periodLabel = period
    ? makePeriodLabel(Number(period.year), String(period.semester))
    : "Unknown";

  return toRatingRow(data as Record<string, unknown>, periodLabel);
}

export async function getRatingsByPeriod(
  periodId: string,
): Promise<
  (PerformanceRatingRow & { employeeName: string; employeeNo: string })[]
> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("performance_ratings")
    .select(
      `
      id,
      employee_id,
      period_id,
      rating_type,
      numerical_rating,
      adjectival_rating,
      rated_by,
      approved_by,
      status,
      kras,
      created_at,
      performance_periods ( year, semester ),
      employees ( first_name, last_name, employee_no )
    `,
    )
    .eq("period_id", periodId)
    .order("created_at", { ascending: false });

  if (error)
    throw new Error(`Failed to fetch period ratings: ${error.message}`);

  return (data ?? []).map((row) => {
    const period = row.performance_periods as {
      year?: number;
      semester?: string;
    } | null;
    const emp = row.employees as {
      first_name?: string;
      last_name?: string;
      employee_no?: string;
    } | null;
    const periodLabel = period
      ? makePeriodLabel(Number(period.year), String(period.semester))
      : "Unknown";

    return {
      ...toRatingRow(row as Record<string, unknown>, periodLabel),
      employeeName: `${emp?.last_name ?? ""}, ${emp?.first_name ?? ""}`.trim(),
      employeeNo: String(emp?.employee_no ?? ""),
    };
  });
}

// ─── OPCRF (Office-level) ─────────────────────────────────────────────────────

export interface OpcfrRow extends PerformanceRatingRow {
  officeName: string | null;
  officeId: string | null;
}

export async function getOpcfrRatings(periodId?: string): Promise<OpcfrRow[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("performance_ratings")
    .select(
      `
      id,
      employee_id,
      period_id,
      rating_type,
      numerical_rating,
      adjectival_rating,
      rated_by,
      approved_by,
      status,
      kras,
      created_at,
      performance_periods ( year, semester ),
      employees ( office_id, offices ( name ) )
    `,
    )
    .eq("rating_type", "opcrf")
    .order("created_at", { ascending: false });

  if (periodId) {
    query = query.eq("period_id", periodId);
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to fetch OPCRF ratings: ${error.message}`);

  return (data ?? []).map((row) => {
    const period = row.performance_periods as {
      year?: number;
      semester?: string;
    } | null;
    const emp = row.employees as {
      office_id?: string;
      offices?: { name?: string } | null;
    } | null;
    const periodLabel = period
      ? makePeriodLabel(Number(period.year), String(period.semester))
      : "Unknown";

    return {
      ...toRatingRow(row as Record<string, unknown>, periodLabel),
      officeName: emp?.offices?.name ?? null,
      officeId: emp?.office_id ?? null,
    };
  });
}

// ─── Step Increments ──────────────────────────────────────────────────────────

export async function getStepIncrements(
  status?: string,
): Promise<StepIncrementRow[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("step_increments")
    .select(
      `
      id,
      employee_id,
      from_step,
      to_step,
      effectivity_date,
      basis_period_ids,
      status,
      approved_by,
      remarks,
      created_at,
      employees ( first_name, last_name, employee_no )
    `,
    )
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error)
    throw new Error(`Failed to fetch step increments: ${error.message}`);

  return (data ?? []).map((row) => {
    const emp = row.employees as {
      first_name?: string;
      last_name?: string;
      employee_no?: string;
    } | null;

    return {
      id: String(row.id),
      employeeId: String(row.employee_id),
      employeeName: `${emp?.last_name ?? ""}, ${emp?.first_name ?? ""}`.trim(),
      employeeNo: String(emp?.employee_no ?? ""),
      fromStep: Number(row.from_step),
      toStep: Number(row.to_step),
      effectivityDate: String(row.effectivity_date),
      basisPeriodIds: Array.isArray(row.basis_period_ids)
        ? (row.basis_period_ids as string[])
        : [],
      status: String(row.status ?? "pending"),
      approvedBy: typeof row.approved_by === "string" ? row.approved_by : null,
      remarks: typeof row.remarks === "string" ? row.remarks : null,
      createdAt: String(row.created_at),
    };
  });
}

export async function getStepIncrementsByEmployee(
  employeeId: string,
): Promise<StepIncrementRow[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("step_increments")
    .select(
      `
      id,
      employee_id,
      from_step,
      to_step,
      effectivity_date,
      basis_period_ids,
      status,
      approved_by,
      remarks,
      created_at,
      employees ( first_name, last_name, employee_no )
    `,
    )
    .eq("employee_id", employeeId)
    .order("effectivity_date", { ascending: false });

  if (error)
    throw new Error(
      `Failed to fetch employee step increments: ${error.message}`,
    );

  return (data ?? []).map((row) => {
    const emp = row.employees as {
      first_name?: string;
      last_name?: string;
      employee_no?: string;
    } | null;

    return {
      id: String(row.id),
      employeeId: String(row.employee_id),
      employeeName: `${emp?.last_name ?? ""}, ${emp?.first_name ?? ""}`.trim(),
      employeeNo: String(emp?.employee_no ?? ""),
      fromStep: Number(row.from_step),
      toStep: Number(row.to_step),
      effectivityDate: String(row.effectivity_date),
      basisPeriodIds: Array.isArray(row.basis_period_ids)
        ? (row.basis_period_ids as string[])
        : [],
      status: String(row.status ?? "pending"),
      approvedBy: typeof row.approved_by === "string" ? row.approved_by : null,
      remarks: typeof row.remarks === "string" ? row.remarks : null,
      createdAt: String(row.created_at),
    };
  });
}

// ─── Eligible Employees for Step Increment ────────────────────────────────────

export async function getEligibleEmployeesForStepIncrement(): Promise<
  EligibleEmployeeRow[]
> {
  const supabase = await createServerClient();

  // Fetch all active employees with their recent ratings
  const { data: employees, error: empError } = await supabase
    .from("employees")
    .select(
      `
      id,
      employee_no,
      first_name,
      last_name,
      position_title,
      salary_grade,
      step,
      office_id,
      offices ( name )
    `,
    )
    .eq("status", "active")
    .is("deleted_at", null)
    .order("last_name");

  if (empError)
    throw new Error(`Failed to fetch employees: ${empError.message}`);

  const eligible: EligibleEmployeeRow[] = [];

  for (const emp of employees ?? []) {
    const empId = String(emp.id);

    // Fetch ratings for this employee (IPCRF only, approved)
    const { data: ratingsData } = await supabase
      .from("performance_ratings")
      .select(
        `
        numerical_rating,
        adjectival_rating,
        period_id,
        performance_periods ( year, semester, date_from )
      `,
      )
      .eq("employee_id", empId)
      .eq("rating_type", "ipcrf")
      .eq("status", "approved")
      .order("created_at", { ascending: true });

    // Fetch last approved step increment for cooldown check
    const { data: lastIncrement } = await supabase
      .from("step_increments")
      .select("effectivity_date")
      .eq("employee_id", empId)
      .in("status", ["approved", "implemented"])
      .order("effectivity_date", { ascending: false })
      .limit(1)
      .single();

    const ratings = (ratingsData ?? []).map((r) => {
      const period = r.performance_periods as {
        year?: number;
        semester?: string;
        date_from?: string;
      } | null;

      return toRatingRecord({
        periodLabel: period
          ? makePeriodLabel(Number(period.year), String(period.semester))
          : "Unknown",
        numericalRating: String(r.numerical_rating ?? "1"),
        periodDateFrom: String(period?.date_from ?? "2020-01-01"),
      });
    });

    const lastIncrementDate =
      lastIncrement && typeof lastIncrement.effectivity_date === "string"
        ? lastIncrement.effectivity_date
        : null;

    const eligibility = checkStepEligibility(ratings, lastIncrementDate);

    if (eligibility.eligible) {
      const officeData = emp.offices as { name?: string } | null;

      eligible.push({
        employeeId: empId,
        employeeNo: String(emp.employee_no),
        fullName: `${emp.last_name}, ${emp.first_name}`,
        positionTitle: String(emp.position_title),
        salaryGrade: Number(emp.salary_grade),
        currentStep: Number(emp.step),
        officeId: typeof emp.office_id === "string" ? emp.office_id : null,
        officeName: officeData?.name ?? null,
        consecutiveCount: eligibility.consecutiveCount,
        triggerRule: eligibility.triggerRule,
        qualifyingPeriods: eligibility.qualifyingPeriods.map(
          (p) => p.periodLabel,
        ),
      });
    }
  }

  return eligible;
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface PerformanceAnalyticsSummary {
  totalRatings: number;
  byAdjectival: Record<AdjectivalRating, number>;
  averageRating: number;
  topPerformers: {
    employeeId: string;
    employeeName: string;
    averageRating: number;
    periodCount: number;
  }[];
  eligibleForStepIncrement: number;
}

export async function getPerformanceAnalytics(
  periodId?: string,
): Promise<PerformanceAnalyticsSummary> {
  const supabase = await createServerClient();

  let query = supabase
    .from("performance_ratings")
    .select(
      `
      id,
      employee_id,
      numerical_rating,
      adjectival_rating,
      period_id,
      employees ( first_name, last_name )
    `,
    )
    .eq("rating_type", "ipcrf")
    .eq("status", "approved");

  if (periodId) {
    query = query.eq("period_id", periodId);
  }

  const { data, error } = await query;

  if (error)
    throw new Error(`Failed to fetch analytics data: ${error.message}`);

  const rows = data ?? [];

  // Count by adjectival
  const byAdjectival: Record<AdjectivalRating, number> = {
    outstanding: 0,
    very_satisfactory: 0,
    satisfactory: 0,
    unsatisfactory: 0,
    poor: 0,
  };

  // Group by employee for averages
  const byEmployee = new Map<string, { name: string; ratings: number[] }>();

  let ratingSum = 0;

  for (const row of rows) {
    const adj = String(row.adjectival_rating) as AdjectivalRating;
    if (adj in byAdjectival) byAdjectival[adj]++;

    const numerical = parseFloat(String(row.numerical_rating ?? "0"));
    ratingSum += numerical;

    const empId = String(row.employee_id);
    const empData = row.employees as {
      first_name?: string;
      last_name?: string;
    } | null;
    const name =
      `${empData?.last_name ?? ""}, ${empData?.first_name ?? ""}`.trim();

    const existing = byEmployee.get(empId);
    if (existing) {
      existing.ratings.push(numerical);
    } else {
      byEmployee.set(empId, { name, ratings: [numerical] });
    }
  }

  const averageRating =
    rows.length > 0 ? Math.round((ratingSum / rows.length) * 1000) / 1000 : 0;

  // Top performers: employees with highest average rating
  const topPerformers = Array.from(byEmployee.entries())
    .map(([employeeId, { name, ratings }]) => ({
      employeeId,
      employeeName: name,
      averageRating:
        Math.round(
          (ratings.reduce((a, b) => a + b, 0) / ratings.length) * 1000,
        ) / 1000,
      periodCount: ratings.length,
    }))
    .filter((e) => RATING_BANDS.outstanding.min <= e.averageRating)
    .sort((a, b) => b.averageRating - a.averageRating)
    .slice(0, 10);

  // Count eligible for step increment (lightweight — check from byEmployee)
  // Full check is done separately in getEligibleEmployeesForStepIncrement
  const eligibleForStepIncrement = 0; // Placeholder — computed by dedicated query

  return {
    totalRatings: rows.length,
    byAdjectival,
    averageRating,
    topPerformers,
    eligibleForStepIncrement,
  };
}

// ─── HR Dashboard KPIs ────────────────────────────────────────────────────────

export interface PerformanceDashboardKpis {
  activeCycles: number;
  totalRatings: number;
  pendingApprovals: number;
  approvedThisYear: number;
  eligibleForIncrement: number;
  pendingIncrements: number;
  stepIncrementsDueThisYear: number;
}

export async function getPerformanceDashboardKpis(): Promise<PerformanceDashboardKpis> {
  const supabase = await createServerClient();
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [
    activeCyclesRes,
    totalRatingsRes,
    pendingRes,
    approvedYearRes,
    pendingIncrementsRes,
    dueThisYearRes,
  ] = await Promise.all([
    supabase
      .from("performance_periods")
      .select("id", { count: "exact", head: true })
      .neq("status", "closed"),
    supabase
      .from("performance_ratings")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("performance_ratings")
      .select("id", { count: "exact", head: true })
      .in("status", ["submitted", "reviewed"]),
    supabase
      .from("performance_ratings")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .gte("created_at", yearStart)
      .lte("created_at", `${yearEnd}T23:59:59`),
    supabase
      .from("step_increments")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "approved"]),
    supabase
      .from("step_increments")
      .select("id", { count: "exact", head: true })
      .gte("effectivity_date", yearStart)
      .lte("effectivity_date", yearEnd),
  ]);

  return {
    activeCycles: activeCyclesRes.count ?? 0,
    totalRatings: totalRatingsRes.count ?? 0,
    pendingApprovals: pendingRes.count ?? 0,
    approvedThisYear: approvedYearRes.count ?? 0,
    eligibleForIncrement: 0,
    pendingIncrements: pendingIncrementsRes.count ?? 0,
    stepIncrementsDueThisYear: dueThisYearRes.count ?? 0,
  };
}

// ─── Paginated Periods ────────────────────────────────────────────────────────

export interface PaginatedPeriodsResult {
  rows: PerformancePeriodRow[];
  total: number;
  page: number;
  limit: number;
}

export async function getPerformancePeriodsPaginated(
  page: number,
  limit: number,
  statusFilter?: string,
): Promise<PaginatedPeriodsResult> {
  const supabase = await createServerClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("performance_periods")
    .select("id, year, semester, date_from, date_to, status, created_at", {
      count: "exact",
    })
    .order("year", { ascending: false })
    .order("semester", { ascending: false })
    .range(from, to);

  if (statusFilter && statusFilter !== "all")
    query = query.eq("status", statusFilter);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch periods: ${error.message}`);

  return {
    rows: (data ?? []).map((row) =>
      toPeriodRow(row as Record<string, unknown>),
    ),
    total: count ?? 0,
    page,
    limit,
  };
}

// ─── Paginated: All IPCRF across employees (HR view) ──────────────────────────

export interface AllIpcrfRow extends PerformanceRatingRow {
  employeeName: string;
  employeeNo: string;
  officeName: string | null;
}

export interface PaginatedIpcrfResult {
  rows: AllIpcrfRow[];
  total: number;
  page: number;
  limit: number;
}

export async function getAllIpcrfPaginated(
  page: number,
  limit: number,
  filters: {
    periodId?: string;
    status?: string;
    q?: string;
  } = {},
): Promise<PaginatedIpcrfResult> {
  const supabase = await createServerClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("performance_ratings")
    .select(
      `
      id,
      employee_id,
      period_id,
      rating_type,
      numerical_rating,
      adjectival_rating,
      rated_by,
      approved_by,
      status,
      kras,
      created_at,
      performance_periods ( year, semester ),
      employees!inner ( first_name, last_name, employee_no, offices ( name ) )
    `,
      { count: "exact" },
    )
    .eq("rating_type", "ipcrf")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.periodId) query = query.eq("period_id", filters.periodId);
  if (filters.status && filters.status !== "all")
    query = query.eq("status", filters.status);

  const { data, error, count } = await query;
  if (error) throw new Error(`Failed to fetch IPCRF list: ${error.message}`);

  const mapped = (data ?? []).map((row) => {
    const period = row.performance_periods as {
      year?: number;
      semester?: string;
    } | null;
    const emp = row.employees as {
      first_name?: string;
      last_name?: string;
      employee_no?: string;
      offices?: { name?: string } | null;
    } | null;
    const periodLabel = period
      ? makePeriodLabel(Number(period.year), String(period.semester))
      : "Unknown";
    return {
      ...toRatingRow(row as Record<string, unknown>, periodLabel),
      employeeName: `${emp?.last_name ?? ""}, ${emp?.first_name ?? ""}`.trim(),
      employeeNo: String(emp?.employee_no ?? ""),
      officeName: emp?.offices?.name ?? null,
    };
  });

  const q = filters.q?.trim().toLowerCase();
  const filtered = q
    ? mapped.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(q) ||
          r.employeeNo.toLowerCase().includes(q),
      )
    : mapped;

  return { rows: filtered, total: count ?? 0, page, limit };
}

// ─── Paginated Step Increments ────────────────────────────────────────────────

export interface PaginatedStepIncrementsResult {
  rows: StepIncrementRow[];
  total: number;
  page: number;
  limit: number;
}

export async function getStepIncrementsPaginated(
  page: number,
  limit: number,
  statusFilter?: string,
): Promise<PaginatedStepIncrementsResult> {
  const supabase = await createServerClient();
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from("step_increments")
    .select(
      `
      id,
      employee_id,
      from_step,
      to_step,
      effectivity_date,
      basis_period_ids,
      status,
      approved_by,
      remarks,
      created_at,
      employees ( first_name, last_name, employee_no )
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (statusFilter && statusFilter !== "all")
    query = query.eq("status", statusFilter);

  const { data, error, count } = await query;
  if (error)
    throw new Error(`Failed to fetch step increments: ${error.message}`);

  const rows: StepIncrementRow[] = (data ?? []).map((row) => {
    const emp = row.employees as {
      first_name?: string;
      last_name?: string;
      employee_no?: string;
    } | null;
    return {
      id: String(row.id),
      employeeId: String(row.employee_id),
      employeeName: `${emp?.last_name ?? ""}, ${emp?.first_name ?? ""}`.trim(),
      employeeNo: String(emp?.employee_no ?? ""),
      fromStep: Number(row.from_step),
      toStep: Number(row.to_step),
      effectivityDate: String(row.effectivity_date),
      basisPeriodIds: Array.isArray(row.basis_period_ids)
        ? (row.basis_period_ids as string[])
        : [],
      status: String(row.status ?? "pending"),
      approvedBy: typeof row.approved_by === "string" ? row.approved_by : null,
      remarks: typeof row.remarks === "string" ? row.remarks : null,
      createdAt: String(row.created_at),
    };
  });

  return { rows, total: count ?? 0, page, limit };
}

// ─── Office-Level Analytics ───────────────────────────────────────────────────

export interface OfficeAnalyticsRow {
  officeId: string | null;
  officeName: string;
  totalRatings: number;
  averageRating: number;
  outstanding: number;
  verySatisfactory: number;
  satisfactory: number;
  belowSatisfactory: number;
}

export async function getOfficePerformanceBreakdown(
  periodId?: string,
): Promise<OfficeAnalyticsRow[]> {
  const supabase = await createServerClient();

  let query = supabase
    .from("performance_ratings")
    .select(
      `
      numerical_rating,
      adjectival_rating,
      employees!inner ( office_id, offices ( name ) )
    `,
    )
    .eq("rating_type", "ipcrf")
    .eq("status", "approved");

  if (periodId) query = query.eq("period_id", periodId);

  const { data, error } = await query;
  if (error)
    throw new Error(`Failed to fetch office breakdown: ${error.message}`);

  const byOffice = new Map<
    string,
    {
      officeId: string | null;
      officeName: string;
      sum: number;
      count: number;
      outstanding: number;
      verySatisfactory: number;
      satisfactory: number;
      belowSatisfactory: number;
    }
  >();

  for (const row of data ?? []) {
    const emp = row.employees as {
      office_id?: string;
      offices?: { name?: string } | null;
    } | null;
    const officeId = emp?.office_id ?? null;
    const officeName = emp?.offices?.name ?? "Unassigned";
    const key = officeId ?? "__unassigned__";
    const numerical = parseFloat(String(row.numerical_rating ?? "0"));
    const adj = String(row.adjectival_rating);

    const existing = byOffice.get(key) ?? {
      officeId,
      officeName,
      sum: 0,
      count: 0,
      outstanding: 0,
      verySatisfactory: 0,
      satisfactory: 0,
      belowSatisfactory: 0,
    };

    existing.sum += numerical;
    existing.count++;
    if (adj === "outstanding") existing.outstanding++;
    else if (adj === "very_satisfactory") existing.verySatisfactory++;
    else if (adj === "satisfactory") existing.satisfactory++;
    else existing.belowSatisfactory++;

    byOffice.set(key, existing);
  }

  return Array.from(byOffice.values())
    .map((o) => ({
      officeId: o.officeId,
      officeName: o.officeName,
      totalRatings: o.count,
      averageRating:
        o.count > 0 ? Math.round((o.sum / o.count) * 1000) / 1000 : 0,
      outstanding: o.outstanding,
      verySatisfactory: o.verySatisfactory,
      satisfactory: o.satisfactory,
      belowSatisfactory: o.belowSatisfactory,
    }))
    .sort((a, b) => b.averageRating - a.averageRating);
}

// ─── Trend over cycles ────────────────────────────────────────────────────────

export interface CycleTrendRow {
  periodId: string;
  periodLabel: string;
  averageRating: number;
  totalRatings: number;
}

export async function getRatingTrend(): Promise<CycleTrendRow[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("performance_ratings")
    .select(
      `
      period_id,
      numerical_rating,
      performance_periods ( year, semester )
    `,
    )
    .eq("rating_type", "ipcrf")
    .eq("status", "approved");

  if (error) throw new Error(`Failed to fetch rating trend: ${error.message}`);

  const byPeriod = new Map<
    string,
    { label: string; sum: number; count: number }
  >();
  for (const row of data ?? []) {
    const period = row.performance_periods as {
      year?: number;
      semester?: string;
    } | null;
    const key = String(row.period_id);
    const label = period
      ? makePeriodLabel(Number(period.year), String(period.semester))
      : "Unknown";
    const numerical = parseFloat(String(row.numerical_rating ?? "0"));
    const existing = byPeriod.get(key) ?? { label, sum: 0, count: 0 };
    existing.sum += numerical;
    existing.count++;
    byPeriod.set(key, existing);
  }

  return Array.from(byPeriod.entries())
    .map(([periodId, { label, sum, count }]) => ({
      periodId,
      periodLabel: label,
      averageRating: count > 0 ? Math.round((sum / count) * 1000) / 1000 : 0,
      totalRatings: count,
    }))
    .sort((a, b) => a.periodLabel.localeCompare(b.periodLabel));
}
