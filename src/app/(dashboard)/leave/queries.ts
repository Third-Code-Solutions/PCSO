/**
 * Leave module read-only queries — PCSO HRIS Phase 08
 *
 * Used by Server Components and React Query hooks.
 * All queries go through Supabase RLS-aware client.
 *
 * Scoping conventions:
 *  - Callers pass `scopeEmployeeId` when the acting user is
 *    `employee_self_service` (or otherwise restricted to their own records).
 *  - All queries return safe empty defaults (`[]`, `null`, `{ balance: 0 }`)
 *    on error or missing data — they never throw on empty result sets.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { LEAVE_TYPES, LEAVE_TYPE_CODES } from "@/lib/constants/leave-types";
import type { LeaveTypeCode } from "@/lib/constants/leave-types";
import {
  EMPLOYEE_DOCUMENTS_BUCKET,
  LEAVE_ATTACHMENT_SIGNED_URL_TTL_SECONDS,
} from "@/lib/constants/storage";
import {
  isLeaveHr,
  isOwnLeaveAttachmentPath,
} from "@/lib/utils/leave/workflow";
import type { Role } from "@/lib/auth/permissions";

// Known leave type codes we surface across the module. Used to defensively
// filter out any junk rows the DB might have from pre-migration seed scripts.
const KNOWN_LEAVE_CODES: readonly string[] = LEAVE_TYPE_CODES;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeaveApplicationRow {
  id: string;
  employeeId: string;
  leaveTypeCode: LeaveTypeCode;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  workingDays: number;
  period: "am" | "pm" | "whole_day";
  reason: string | null;
  status: string;
  attachmentPaths: string[] | null;
  isCommutation: boolean;
  currentApproverId: string | null;
  approverRemarks: string | null;
  createdAt: string;
}

export interface LeaveCreditBalanceRow {
  employeeId: string;
  year: number;
  vlBalance: number;
  slBalance: number;
  vlEarned: number;
  slEarned: number;
  vlCarryOver: number;
  slCarryOver: number;
  vlForfeited: number;
}

// ---------------------------------------------------------------------------
// Helper: map DB row to typed shape
// ---------------------------------------------------------------------------

function toLeaveApplication(row: Record<string, unknown>): LeaveApplicationRow {
  const code = (row["leave_type_code"] ?? "") as LeaveTypeCode;
  return {
    id: String(row["id"] ?? ""),
    employeeId: String(row["employee_id"] ?? ""),
    leaveTypeCode: code,
    leaveTypeName: LEAVE_TYPES[code]?.name ?? String(code),
    startDate: String(row["date_from"] ?? row["start_date"] ?? ""),
    endDate: String(row["date_to"] ?? row["end_date"] ?? ""),
    workingDays: Number(row["no_of_days"] ?? row["working_days"] ?? 0),
    period: (row["period"] as "am" | "pm" | "whole_day") ?? "whole_day",
    reason: typeof row["reason"] === "string" ? row["reason"] : null,
    status: String(row["status"] ?? "pending"),
    attachmentPaths: Array.isArray(row["attachment_paths"])
      ? (row["attachment_paths"] as string[])
      : null,
    isCommutation: Boolean(row["is_commutation"] ?? false),
    currentApproverId:
      typeof row["approved_by"] === "string" ? row["approved_by"] : null,
    approverRemarks: typeof row["remarks"] === "string" ? row["remarks"] : null,
    createdAt: String(row["created_at"] ?? ""),
  };
}

function toLeaveCreditBalance(
  row: Record<string, unknown>,
): LeaveCreditBalanceRow {
  return {
    employeeId: String(row["employee_id"] ?? ""),
    year: Number(row["year"] ?? new Date().getFullYear()),
    vlBalance: Number(row["balance"] ?? row["vl_balance"] ?? 0),
    slBalance: Number(row["sl_balance"] ?? 0),
    vlEarned: Number(row["vl_earned"] ?? row["total_credits"] ?? 0),
    slEarned: Number(row["sl_earned"] ?? 0),
    vlCarryOver: Number(row["carry_over"] ?? row["vl_carry_over"] ?? 0),
    slCarryOver: Number(row["sl_carry_over"] ?? 0),
    vlForfeited: Number(row["vl_forfeited"] ?? 0),
  };
}

/**
 * LAM-008: convert stored attachment storage paths into short-lived signed
 * URLs. Only objects under the applicant's own `leave-attachments/{id}/`
 * prefix are signed (the service role can read every employee's documents);
 * anything else — another prefix, a raw URL, a failed signature — is dropped
 * so a stored string is never rendered as a link.
 */
async function resolveAttachmentUrls(
  storagePaths: string[] | null,
  employeeId: string,
): Promise<string[] | null> {
  if (!storagePaths || storagePaths.length === 0) return storagePaths;

  const resolved = await Promise.all(
    storagePaths.map(async (path): Promise<string | null> => {
      if (!isOwnLeaveAttachmentPath(path, employeeId)) {
        console.error("[leave/queries] resolveAttachmentUrls: rejected path");
        return null;
      }
      try {
        const { data, error } = await supabaseAdmin.storage
          .from(EMPLOYEE_DOCUMENTS_BUCKET)
          .createSignedUrl(path, LEAVE_ATTACHMENT_SIGNED_URL_TTL_SECONDS);
        if (error || !data?.signedUrl) {
          console.error(
            "[leave/queries] resolveAttachmentUrls sign failed:",
            error?.message ?? "no url",
          );
          return null;
        }
        return data.signedUrl;
      } catch (err) {
        console.error("[leave/queries] resolveAttachmentUrls:", err);
        return null;
      }
    }),
  );

  return resolved.filter((url): url is string => url !== null);
}

// ---------------------------------------------------------------------------
// Query: my leave applications (employee self-service)
// ---------------------------------------------------------------------------

export async function getMyLeaveApplications(
  employeeId: string,
): Promise<LeaveApplicationRow[]> {
  if (!employeeId) return [];
  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("leave_applications")
    .select(
      `
      id,
      employee_id,
      leave_type_id,
      date_from,
      date_to,
      no_of_days,
      reason,
      status,
      approved_by,
      remarks,
      created_at,
      leave_types ( code, name )
    `,
    )
    .eq("employee_id", employeeId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Defensive: never throw on empty/error — return empty list so pages keep
  // rendering a usable shell for the user.
  if (error) {
    console.error("[leave/queries] getMyLeaveApplications:", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const leaveTypeData = row.leave_types as {
      code?: string;
      name?: string;
    } | null;
    const code = (leaveTypeData?.code ?? "VL") as LeaveTypeCode;
    return {
      id: String(row.id),
      employeeId: String(row.employee_id),
      leaveTypeCode: code,
      leaveTypeName: leaveTypeData?.name ?? LEAVE_TYPES[code]?.name ?? code,
      startDate: String(row.date_from),
      endDate: String(row.date_to),
      workingDays: Number(row.no_of_days),
      period: "whole_day",
      reason: typeof row.reason === "string" ? row.reason : null,
      status: String(row.status),
      attachmentPaths: null,
      isCommutation: false,
      currentApproverId:
        typeof row.approved_by === "string" ? row.approved_by : null,
      approverRemarks: typeof row.remarks === "string" ? row.remarks : null,
      createdAt: String(row.created_at),
    };
  });
}

// ---------------------------------------------------------------------------
// Query: pending approvals queue (for leave_approver / hr_admin)
// ---------------------------------------------------------------------------

export interface PendingApprovalRow extends LeaveApplicationRow {
  employeeFullName: string;
  employeeNo: string;
  /** Current pre-deduction balance for VL/SL, null for non-accrued types. */
  currentBalance: number | null;
  /** Balance after this leave is approved (currentBalance for VL/SL since
   *  credits are already deducted on apply). */
  balanceAfterDeduction: number | null;
}

export interface GetPendingApprovalsOptions {
  /** Optionally filter to a specific approver's queue. Reserved for
   *  org-chart escalation — currently a no-op at the DB level. */
  approverId?: string;
  /** Restrict the queue to a single employee's applications. Pass when the
   *  caller is `employee_self_service` so they only see their own pending
   *  items (defence-in-depth alongside RLS). */
  scopeEmployeeId?: string;
  /** Approver unit scope: non-HR approvers see only their own office's
   *  applications; no office → empty queue (fails closed). */
  approverScope?: { role: Role; officeId: string | null };
  /** 1-indexed page (defaults to 1). */
  page?: number;
  /** Rows per page (defaults to 25, max 100). */
  pageSize?: number;
}

export interface PaginatedPendingApprovals {
  rows: PendingApprovalRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Paginated pending-approvals queue. The second overload (legacy)
 * keeps existing callers working — it returns a plain array.
 */
export async function getPendingApprovals(
  options: GetPendingApprovalsOptions & { paginated: true },
): Promise<PaginatedPendingApprovals>;
export async function getPendingApprovals(
  options?: GetPendingApprovalsOptions,
): Promise<PendingApprovalRow[]>;
export async function getPendingApprovals(
  options?: GetPendingApprovalsOptions & { paginated?: boolean },
): Promise<PendingApprovalRow[] | PaginatedPendingApprovals> {
  const supabase = supabaseAdmin;

  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, options?.pageSize ?? 25));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let pendingQuery = supabase
    .from("leave_applications")
    .select(
      `
      id,
      employee_id,
      leave_type_id,
      date_from,
      date_to,
      no_of_days,
      reason,
      status,
      approved_by,
      remarks,
      created_at,
      leave_types ( code, name ),
      employees!inner ( first_name, last_name, employee_no, office_id )
    `,
      { count: "exact" },
    )
    .eq("status", "pending")
    .is("deleted_at", null);

  if (options?.scopeEmployeeId) {
    pendingQuery = pendingQuery.eq("employee_id", options.scopeEmployeeId);
  }

  const scope = options?.approverScope;
  if (scope && !isLeaveHr(scope.role)) {
    if (!scope.officeId) {
      return options?.paginated
        ? { rows: [], total: 0, page, pageSize, totalPages: 1 }
        : [];
    }
    pendingQuery = pendingQuery.eq("employees.office_id", scope.officeId);
  }

  const { data, error, count } = await pendingQuery
    .order("created_at", { ascending: true })
    .range(from, to);

  // Defensive: on error we return an empty, structurally-valid payload so
  // approver UIs can still render a "no pending" empty state.
  if (error) {
    console.error("[leave/queries] getPendingApprovals:", error.message);
    if (options?.paginated) {
      return { rows: [], total: 0, page, pageSize, totalPages: 1 };
    }
    return [];
  }

  // Batch-fetch current VL/SL balances for the employees we're about to show,
  // so the approver sees balance-after-deduction without N+1 queries.
  const rows = data ?? [];
  const year = new Date().getFullYear();
  const employeeIds = [...new Set(rows.map((r) => String(r.employee_id)))];
  const balanceMap = new Map<string, { VL: number; SL: number }>();

  if (employeeIds.length > 0) {
    const { data: credits } = await supabase
      .from("leave_credits")
      .select("employee_id, balance, leave_types ( code )")
      .in("employee_id", employeeIds)
      .eq("year", year);

    for (const c of credits ?? []) {
      const empId = String(c.employee_id);
      const code = (c.leave_types as { code?: string } | null)?.code ?? "";
      if (code !== "VL" && code !== "SL") continue;
      const existing = balanceMap.get(empId) ?? { VL: 0, SL: 0 };
      if (code === "VL") existing.VL = Number(c.balance ?? 0);
      if (code === "SL") existing.SL = Number(c.balance ?? 0);
      balanceMap.set(empId, existing);
    }
  }

  const enriched: PendingApprovalRow[] = rows.map((row) => {
    const leaveTypeData = row.leave_types as {
      code?: string;
      name?: string;
    } | null;
    const empData = row.employees as {
      first_name?: string;
      last_name?: string;
      employee_no?: string;
    } | null;
    const code = (leaveTypeData?.code ?? "VL") as LeaveTypeCode;
    const base = toLeaveApplication({
      ...row,
      leave_type_code: code,
      date_from: row.date_from,
      date_to: row.date_to,
      no_of_days: row.no_of_days,
    });

    const empId = String(row.employee_id);
    let currentBalance: number | null = null;
    if (code === "VL") currentBalance = balanceMap.get(empId)?.VL ?? 0;
    else if (code === "SL") currentBalance = balanceMap.get(empId)?.SL ?? 0;

    // Credits are deducted at apply time — current balance already reflects
    // the deduction, so balanceAfterDeduction === currentBalance.
    const balanceAfterDeduction = currentBalance;

    return {
      ...base,
      employeeFullName: empData
        ? `${empData.last_name ?? ""}, ${empData.first_name ?? ""}`.trim()
        : "Unknown",
      employeeNo: String(empData?.employee_no ?? ""),
      currentBalance,
      balanceAfterDeduction,
    };
  });

  const total = typeof count === "number" ? count : enriched.length;

  if (options?.paginated) {
    return {
      rows: enriched,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  return enriched;
}

// ---------------------------------------------------------------------------
// Query: single leave application detail
// ---------------------------------------------------------------------------

export interface LeaveApplicationDetail extends LeaveApplicationRow {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    employeeNo: string;
    officeId: string | null;
  };
}

export async function getLeaveApplicationDetail(
  leaveApplicationId: string,
): Promise<LeaveApplicationDetail | null> {
  if (!leaveApplicationId) return null;
  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("leave_applications")
    .select(
      `
      id,
      employee_id,
      leave_type_id,
      date_from,
      date_to,
      no_of_days,
      reason,
      status,
      approved_by,
      remarks,
      attachment_paths,
      created_at,
      leave_types ( code, name ),
      employees ( id, first_name, last_name, employee_no, office_id )
    `,
    )
    .eq("id", leaveApplicationId)
    .single();

  if (error) return null;

  const leaveTypeData = data.leave_types as {
    code?: string;
    name?: string;
  } | null;
  const employeeData = data.employees as {
    id?: string;
    first_name?: string;
    last_name?: string;
    employee_no?: string;
    office_id?: string;
  } | null;

  const code = (leaveTypeData?.code ?? "VL") as LeaveTypeCode;
  const base = toLeaveApplication({
    ...data,
    leave_type_code: code,
    date_from: data.date_from,
    date_to: data.date_to,
    no_of_days: data.no_of_days,
  });

  // LAM-008: attachment_paths stores storage object paths. Resolve them to
  // short-lived signed URLs so the approval UI can link to the documents.
  const attachmentPaths = await resolveAttachmentUrls(
    base.attachmentPaths,
    String(data.employee_id),
  );

  return {
    ...base,
    attachmentPaths,
    employee: {
      id: String(employeeData?.id ?? data.employee_id),
      firstName: String(employeeData?.first_name ?? ""),
      lastName: String(employeeData?.last_name ?? ""),
      employeeNo: String(employeeData?.employee_no ?? ""),
      officeId:
        typeof employeeData?.office_id === "string"
          ? employeeData.office_id
          : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Query: leave credit balance for an employee + year
// ---------------------------------------------------------------------------

/**
 * Returns the VL/SL balance row for `employeeId` in `year`.
 * Always resolves to a structurally-valid object — even when the employee has
 * no credits on file yet — so callers can render a zero-balance state without
 * branching on `null`. Returns `null` only when the lookup itself is invalid
 * (no employeeId).
 */
export async function getLeaveCreditBalance(
  employeeId: string,
  year: number,
): Promise<LeaveCreditBalanceRow | null> {
  if (!employeeId) return null;
  const supabase = supabaseAdmin;

  // Filter to known leave codes so any stale/unknown rows the DB might carry
  // don't leak into the balance summary.
  const { data, error } = await supabase
    .from("leave_credits")
    .select(
      `
      employee_id,
      year,
      balance,
      total_credits,
      used_credits,
      carry_over,
      leave_types!inner ( code )
    `,
    )
    .eq("employee_id", employeeId)
    .eq("year", year)
    .in("leave_types.code", KNOWN_LEAVE_CODES as string[]);

  if (error) {
    console.error("[leave/queries] getLeaveCreditBalance:", error.message);
    return {
      employeeId,
      year,
      vlBalance: 0,
      slBalance: 0,
      vlEarned: 0,
      slEarned: 0,
      vlCarryOver: 0,
      slCarryOver: 0,
      vlForfeited: 0,
    };
  }

  const vlRow = (data ?? []).find(
    (r) => (r.leave_types as { code?: string } | null)?.code === "VL",
  );
  const slRow = (data ?? []).find(
    (r) => (r.leave_types as { code?: string } | null)?.code === "SL",
  );

  // Zero-balance default — never return `null` just because the employee
  // hasn't received any accrual yet.
  return {
    employeeId,
    year,
    vlBalance: Number(vlRow?.balance ?? 0),
    slBalance: Number(slRow?.balance ?? 0),
    vlEarned: Number(vlRow?.total_credits ?? 0),
    slEarned: Number(slRow?.total_credits ?? 0),
    vlCarryOver: Number(vlRow?.carry_over ?? 0),
    slCarryOver: Number(slRow?.carry_over ?? 0),
    vlForfeited: 0,
  };
}

// ---------------------------------------------------------------------------
// Query: all employees' leave credits (HR admin)
// ---------------------------------------------------------------------------

export interface EmployeeCreditSummary {
  employeeId: string;
  employeeNo: string;
  fullName: string;
  officeId: string | null;
  vlBalance: number;
  slBalance: number;
  year: number;
}

export interface PaginatedEmployeeCreditSummaries {
  rows: EmployeeCreditSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getAllEmployeeCreditSummaries(
  year: number,
): Promise<EmployeeCreditSummary[]> {
  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("leave_credits")
    .select(
      `
      employee_id,
      year,
      balance,
      leave_types!inner ( code ),
      employees!inner ( id, employee_no, first_name, last_name, office_id )
    `,
    )
    .eq("year", year)
    .in("leave_types.code", KNOWN_LEAVE_CODES as string[])
    .is("employees.deleted_at", null);

  if (error) {
    console.error(
      "[leave/queries] getAllEmployeeCreditSummaries:",
      error.message,
    );
    return [];
  }

  // Group by employee
  const byEmployee = new Map<string, EmployeeCreditSummary>();

  for (const row of data ?? []) {
    const empData = row.employees as {
      id?: string;
      employee_no?: string;
      first_name?: string;
      last_name?: string;
      office_id?: string;
    } | null;

    const leaveTypeData = row.leave_types as { code?: string } | null;
    const empId = String(row.employee_id);
    const code = leaveTypeData?.code ?? "";

    if (!byEmployee.has(empId)) {
      byEmployee.set(empId, {
        employeeId: empId,
        employeeNo: String(empData?.employee_no ?? ""),
        fullName:
          `${empData?.last_name ?? ""}, ${empData?.first_name ?? ""}`.trim(),
        officeId:
          typeof empData?.office_id === "string" ? empData.office_id : null,
        vlBalance: 0,
        slBalance: 0,
        year,
      });
    }

    const summary = byEmployee.get(empId)!;
    if (code === "VL") summary.vlBalance = Number(row.balance);
    if (code === "SL") summary.slBalance = Number(row.balance);
  }

  return Array.from(byEmployee.values()).sort((a, b) =>
    a.fullName.localeCompare(b.fullName),
  );
}

/**
 * Returns ALL active, non-deleted employees with their current leave credit
 * balances for the given year.  Employees who have no credit row yet appear
 * with vlBalance: 0 / slBalance: 0 so HR can still adjust them from the
 * Adjust Credits page.
 */
export async function getAllActiveEmployeesWithCredits(
  year: number,
): Promise<EmployeeCreditSummary[]> {
  const [empResult, creditsResult] = await Promise.all([
    supabaseAdmin
      .from("employees")
      .select("id, employee_no, first_name, last_name, office_id")
      .is("deleted_at", null)
      .in("status", ["active", "on_leave"]),
    supabaseAdmin
      .from("leave_credits")
      .select("employee_id, balance, leave_types(code)")
      .eq("year", year),
  ]);

  if (empResult.error) {
    console.error(
      "[leave/queries] getAllActiveEmployeesWithCredits employees:",
      empResult.error.message,
    );
    return [];
  }

  const creditMap = new Map<string, { vlBalance: number; slBalance: number }>();
  for (const row of creditsResult.data ?? []) {
    const empId = String(row.employee_id);
    const code = (row.leave_types as { code?: string } | null)?.code ?? "";
    if (!creditMap.has(empId))
      creditMap.set(empId, { vlBalance: 0, slBalance: 0 });
    const entry = creditMap.get(empId)!;
    if (code === "VL") entry.vlBalance = Number(row.balance);
    if (code === "SL") entry.slBalance = Number(row.balance);
  }

  return (empResult.data ?? [])
    .map((emp) => {
      const credits = creditMap.get(emp.id) ?? { vlBalance: 0, slBalance: 0 };
      return {
        employeeId: emp.id,
        employeeNo: String(emp.employee_no ?? ""),
        fullName: `${emp.last_name ?? ""}, ${emp.first_name ?? ""}`.trim(),
        officeId: typeof emp.office_id === "string" ? emp.office_id : null,
        vlBalance: credits.vlBalance,
        slBalance: credits.slBalance,
        year,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/**
 * Paginated variant of {@link getAllEmployeeCreditSummaries} for admin
 * screens that render a large roster. Pagination happens in-memory after the
 * per-row aggregation because the underlying table has two rows per employee
 * (VL + SL) — a DB-side range() would split an employee across pages.
 */
export async function getAllEmployeeCreditSummariesPaged(
  year: number,
  options?: { page?: number; pageSize?: number; search?: string },
): Promise<PaginatedEmployeeCreditSummaries> {
  const all = await getAllEmployeeCreditSummaries(year);

  const search = (options?.search ?? "").trim().toLowerCase();
  const filtered = search
    ? all.filter(
        (r) =>
          r.fullName.toLowerCase().includes(search) ||
          r.employeeNo.toLowerCase().includes(search),
      )
    : all;

  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, options?.pageSize ?? 25));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize;
  const rows = filtered.slice(from, from + pageSize);

  return { rows, total, page, pageSize, totalPages };
}

// ---------------------------------------------------------------------------
// Query: team calendar — approved leaves in a date range
// ---------------------------------------------------------------------------

export interface CalendarLeaveEntry {
  employeeId: string;
  fullName: string;
  leaveTypeCode: LeaveTypeCode;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  workingDays: number;
}

export async function getApprovedLeavesForCalendar(
  startDate: string,
  endDate: string,
  officeId?: string,
  scopeEmployeeId?: string,
): Promise<CalendarLeaveEntry[]> {
  const supabase = supabaseAdmin;

  let query = supabase
    .from("leave_applications")
    .select(
      `
      employee_id,
      date_from,
      date_to,
      no_of_days,
      leave_types ( code, name ),
      employees ( first_name, last_name, office_id )
    `,
    )
    .eq("status", "approved")
    .is("deleted_at", null)
    .lte("date_from", endDate)
    .gte("date_to", startDate);

  if (officeId) {
    query = query.eq("employees.office_id", officeId);
  }
  if (scopeEmployeeId) {
    query = query.eq("employee_id", scopeEmployeeId);
  }

  const { data, error } = await query.order("date_from");

  if (error) {
    console.error(
      "[leave/queries] getApprovedLeavesForCalendar:",
      error.message,
    );
    return [];
  }

  return (data ?? []).map((row) => {
    const leaveTypeData = row.leave_types as {
      code?: string;
      name?: string;
    } | null;
    const empData = row.employees as {
      first_name?: string;
      last_name?: string;
    } | null;
    const code = (leaveTypeData?.code ?? "VL") as LeaveTypeCode;

    return {
      employeeId: String(row.employee_id),
      fullName:
        `${empData?.last_name ?? ""}, ${empData?.first_name ?? ""}`.trim(),
      leaveTypeCode: code,
      leaveTypeName: leaveTypeData?.name ?? LEAVE_TYPES[code]?.name ?? code,
      startDate: String(row.date_from),
      endDate: String(row.date_to),
      workingDays: Number(row.no_of_days),
    };
  });
}

// ---------------------------------------------------------------------------
// Query: all leave applications (hr_admin + super_admin) — paginated
// ---------------------------------------------------------------------------

export interface LeaveApplicationRowEnriched extends LeaveApplicationRow {
  employeeFullName: string;
  employeeNo: string;
  approverName: string | null;
  approvedAt: string | null;
}

export interface GetAllLeaveApplicationsFilters {
  status?: string;
  employeeId?: string;
  leaveTypeCode?: string;
  dateFrom?: string;
  dateTo?: string;
  /** Forces every row to match this employee id. Pass when the caller is
   *  `employee_self_service`. Overrides `employeeId` if both are provided. */
  scopeEmployeeId?: string;
  /** Unit scope: only applicants in this office. `null` = the caller has no
   *  office, so nothing is returned. Omit (undefined) for org-wide roles. */
  scopeOfficeId?: string | null;
  /** 1-indexed page number (defaults to 1). */
  page?: number;
  /** Rows per page (defaults to 50, max 200). */
  pageSize?: number;
}

export interface PaginatedLeaveApplications {
  rows: LeaveApplicationRowEnriched[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

async function runLeaveApplicationsQuery(
  filters: GetAllLeaveApplicationsFilters | undefined,
  withCount: boolean,
): Promise<PaginatedLeaveApplications> {
  const supabase = supabaseAdmin;

  const page = Math.max(1, filters?.page ?? 1);
  const pageSize = Math.min(200, Math.max(5, filters?.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("leave_applications")
    .select(
      `
      id,
      employee_id,
      leave_type_id,
      date_from,
      date_to,
      no_of_days,
      reason,
      status,
      approved_by,
      approved_at,
      remarks,
      created_at,
      leave_types ( code, name ),
      employees!inner ( first_name, last_name, employee_no, office_id )
    `,
      withCount ? { count: "exact" } : {},
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters?.scopeOfficeId === null) {
    return { rows: [], total: 0, page, pageSize, totalPages: 1 };
  }
  if (filters?.scopeOfficeId) {
    query = query.eq("employees.office_id", filters.scopeOfficeId);
  }
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.scopeEmployeeId) {
    query = query.eq("employee_id", filters.scopeEmployeeId);
  } else if (filters?.employeeId) {
    query = query.eq("employee_id", filters.employeeId);
  }
  if (filters?.dateFrom) query = query.gte("date_from", filters.dateFrom);
  if (filters?.dateTo) query = query.lte("date_to", filters.dateTo);

  const { data, error, count } = await query;
  if (error) {
    console.error("[leave/queries] runLeaveApplicationsQuery:", error.message);
    return { rows: [], total: 0, page, pageSize, totalPages: 1 };
  }

  // Resolve approver display names in one round-trip.
  const approverIds = [
    ...new Set(
      (data ?? [])
        .map((row) =>
          typeof row.approved_by === "string" ? row.approved_by : null,
        )
        .filter((id): id is string => id !== null),
    ),
  ];

  const approverMap = new Map<string, string>();
  if (approverIds.length > 0) {
    const { data: approvers } = await supabase
      .from("system_users")
      .select("id, employees ( first_name, last_name )")
      .in("id", approverIds);
    for (const approver of approvers ?? []) {
      const empData = approver.employees as {
        first_name?: string;
        last_name?: string;
      } | null;
      const name = empData
        ? `${empData.last_name ?? ""}, ${empData.first_name ?? ""}`.trim()
        : null;
      if (name) approverMap.set(String(approver.id), name);
    }
  }

  const rows: LeaveApplicationRowEnriched[] = (data ?? []).map((row) => {
    const leaveTypeData = row.leave_types as {
      code?: string;
      name?: string;
    } | null;
    const empData = row.employees as {
      first_name?: string;
      last_name?: string;
      employee_no?: string;
    } | null;
    const code = (leaveTypeData?.code ?? "VL") as LeaveTypeCode;
    const base = toLeaveApplication({
      ...row,
      leave_type_code: code,
      date_from: row.date_from,
      date_to: row.date_to,
      no_of_days: row.no_of_days,
    });

    return {
      ...base,
      employeeFullName: empData
        ? `${empData.last_name ?? ""}, ${empData.first_name ?? ""}`.trim()
        : "Unknown",
      employeeNo: String(empData?.employee_no ?? ""),
      approverName:
        typeof row.approved_by === "string"
          ? (approverMap.get(row.approved_by) ?? null)
          : null,
      approvedAt: typeof row.approved_at === "string" ? row.approved_at : null,
    };
  });

  const total = typeof count === "number" ? count : rows.length;
  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Paginated admin list query. Preferred over the un-paginated
 * `getAllLeaveApplications` for tables that need totals or for workspaces
 * with more than a few hundred rows.
 */
export async function getAllLeaveApplicationsPaged(
  filters?: GetAllLeaveApplicationsFilters,
): Promise<PaginatedLeaveApplications> {
  return runLeaveApplicationsQuery(filters, true);
}

/**
 * Legacy entry point — returns rows only (no totals). Backed by the paged
 * implementation so existing callers keep working. Caps at the same pageSize.
 */
export async function getAllLeaveApplications(
  filters?: GetAllLeaveApplicationsFilters,
): Promise<LeaveApplicationRowEnriched[]> {
  const result = await runLeaveApplicationsQuery(filters, false);
  return result.rows;
}

// Suppress unused import warning
void toLeaveCreditBalance;
