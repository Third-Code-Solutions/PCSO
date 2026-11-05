"use server";

/**
 * Leave Administration Gaps Actions — PCSO HRIS LAM Module
 *
 * Actions: uploadLeaveLedgerCsv, commitLeaveLedgerUpload,
 *          getAdvancedLeaveReports, sendLwopNotices
 *
 * Manual balance adjustment lives in app/(dashboard)/leave/actions.ts
 * (adjustLeaveCredits, H-12).
 *
 * Requirements: LAM-001 (bulk upload), LAM-005 (LWOP list), LAM-006
 *               (auto-approval config), LAM-010 (sex-disaggregated reports),
 *               LAM-011 (manual adjustment + LWOP/NFL notifications),
 *               LAM-014 (ad hoc reports)
 */

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  leaveCredits,
  leaveTypes,
  employees,
  auditLogs,
} from "@/lib/db/schema";
import { leaveBulkUploads } from "@/lib/db/schema/leave-gaps";
import { requirePermission } from "@/lib/auth/guards";
import { withTx, lockKey } from "@/lib/db/transaction";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  parseLeaveLedgerCsv,
  validateRowsForCommit,
  normalizeLedgerId,
  existingLedgerKey,
} from "@/lib/utils/leave/bulk-ledger";
import {
  buildLeaveReportSummary,
  buildLwopReport,
  aggregateByTypeAndSex,
  aggregateFiledTotals,
  listDisapproved,
  type LeaveReportRow,
  type LeaveReportSummary,
  type LwopReport,
  type SexDisaggregatedRow,
  type FiledTotalRow,
} from "@/lib/utils/leave/report-aggregation";
import { notifyLWOP } from "@/lib/utils/leave/lwop-notifications";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";

// ─── Schema Validation ────────────────────────────────────────────────────

// Staged rows are round-tripped through a text column; re-validate on read
// so a tampered/corrupted staging record can never reach the live ledger.
const StagedRowSchema = z.object({
  csvRow: z.number().int().min(2),
  employeeNo: z.string().min(1),
  leaveTypeCode: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  balance: z.number().min(0),
  totalCredits: z.number().min(0),
  usedCredits: z.number().min(0),
  carryOver: z.number().min(0),
});

const StagedRowsSchema = z.array(StagedRowSchema);

/**
 * Raised inside the commit transaction when the leave_credits unique index
 * rejects a row that a concurrent commit inserted after our pre-check ran.
 * Not exported (a "use server" module may only export async functions); the
 * outer action catches it and returns an all-or-nothing failure result.
 */
class LeaveLedgerConflictError extends Error {
  constructor() {
    super(
      "One or more leave credit rows were created by a concurrent upload. " +
        "No rows were committed — refresh and retry to review the conflicts.",
    );
    this.name = "LeaveLedgerConflictError";
  }
}

// ─── Action: uploadLeaveLedgerCsv ─────────────────────────────────────────

export interface UploadLeaveLedgerCsvResult {
  uploadId: string;
  recordCount: number;
  validCount: number;
  errorCount: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * LAM-001: Bulk upload leave ledgers via CSV with validation preview.
 * Valid rows are persisted on the staging record (staged_rows) so the commit
 * step can re-validate and write them without re-parsing the original file.
 */
export async function uploadLeaveLedgerCsv(
  formData: FormData,
): Promise<UploadLeaveLedgerCsvResult> {
  // Writes balances directly: HR admin only (H-12), not leave approvers.
  const user = await requirePermission("leave", "process");

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("No file provided");
  }

  const fileName = file.name;
  const text = await file.text();

  // Throws on structural problems (no data rows, unexpected header shape).
  const { rows, errors, dataLineCount } = parseLeaveLedgerCsv(text);

  const [upload] = await db
    .insert(leaveBulkUploads)
    .values({
      fileName,
      recordCount: dataLineCount,
      validCount: rows.length,
      errorCount: errors.length,
      uploadedById: user.employeeId!,
      status: rows.length === 0 ? "rejected" : "pending",
      validationErrors: JSON.stringify(errors),
      stagedRows: rows.length > 0 ? JSON.stringify(rows) : null,
    })
    .returning({ id: leaveBulkUploads.id });

  if (!upload) {
    throw new Error("Failed to create upload record");
  }

  revalidatePath("/leave/bulk-upload");

  return {
    uploadId: String(upload.id),
    recordCount: dataLineCount,
    validCount: rows.length,
    errorCount: errors.length,
    errors,
  };
}

// ─── Action: commitLeaveLedgerUpload ──────────────────────────────────────

export interface CommitLeaveLedgerUploadResult {
  processedCount: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * LAM-001: Commit a validated bulk upload to the live leave_credits ledger.
 *
 * ALL-or-NOTHING per SEC-010: staged rows are re-validated against the live
 * database (employee/leave-type existence + duplicate detection on
 * employee + leave type + year). Any validation error aborts with zero writes.
 */
export async function commitLeaveLedgerUpload(
  uploadId: string,
): Promise<CommitLeaveLedgerUploadResult> {
  const parsedUploadId = z.string().uuid("Invalid upload ID.").parse(uploadId);
  const user = await requirePermission("leave", "process");

  let result: CommitLeaveLedgerUploadResult;
  try {
    result = await withTx(async (tx) => {
      // Serialize concurrent commits of the same upload (double-click, two tabs).
      await lockKey(tx, `leave_bulk_upload:${parsedUploadId}`);

      const [upload] = await tx
        .select()
        .from(leaveBulkUploads)
        .where(eq(leaveBulkUploads.id, parsedUploadId))
        .limit(1);

      if (!upload) {
        throw new Error("Upload record not found");
      }
      if (upload.status !== "pending") {
        throw new Error(`Cannot commit upload in '${upload.status}' status`);
      }
      if (!upload.stagedRows) {
        throw new Error(
          "Upload has no staged rows to commit — re-upload the CSV file.",
        );
      }

      let stagedJson: unknown;
      try {
        stagedJson = JSON.parse(upload.stagedRows);
      } catch {
        throw new Error("Staged rows are corrupted — re-upload the CSV file.");
      }
      const staged = StagedRowsSchema.parse(stagedJson);
      if (staged.length === 0) {
        throw new Error("Upload has no valid rows to commit.");
      }

      // Resolve employee numbers → ids (exact stored value; matching is
      // case-insensitive via normalized map keys).
      const employeeNos = [...new Set(staged.map((r) => r.employeeNo.trim()))];
      const employeeRows = await tx
        .select({ id: employees.id, employeeNo: employees.employeeNo })
        .from(employees)
        .where(inArray(employees.employeeNo, employeeNos));
      const employeeIdByNo = new Map(
        employeeRows.map((e) => [
          normalizeLedgerId(e.employeeNo),
          String(e.id),
        ]),
      );

      // Leave types are a small lookup table — load all for code matching.
      const typeRows = await tx
        .select({ id: leaveTypes.id, code: leaveTypes.code })
        .from(leaveTypes);
      const leaveTypeIdByCode = new Map(
        typeRows.map((t) => [normalizeLedgerId(t.code), String(t.id)]),
      );

      // Existing ledger rows for the affected employees/years → duplicate keys.
      const matchedEmployeeIds = [...new Set(employeeIdByNo.values())];
      const years = [...new Set(staged.map((r) => r.year))];
      const existingCredits =
        matchedEmployeeIds.length > 0
          ? await tx
              .select({
                employeeId: leaveCredits.employeeId,
                leaveTypeId: leaveCredits.leaveTypeId,
                year: leaveCredits.year,
              })
              .from(leaveCredits)
              .where(
                and(
                  inArray(leaveCredits.employeeId, matchedEmployeeIds),
                  inArray(leaveCredits.year, years),
                ),
              )
          : [];
      const existingLedgerKeys = new Set(
        existingCredits.map((c) =>
          existingLedgerKey(
            String(c.employeeId),
            String(c.leaveTypeId),
            c.year,
          ),
        ),
      );

      const { resolved, errors } = validateRowsForCommit(staged, {
        employeeIdByNo,
        leaveTypeIdByCode,
        existingLedgerKeys,
      });

      // SEC-010: any validation failure means zero ledger writes.
      if (errors.length > 0) {
        return { processedCount: 0, errors };
      }

      // The SELECT-based pre-check above cannot see rows a *concurrent* commit
      // inserts after it runs. The leave_credits unique index is the real
      // arbiter: skip conflicting rows, then verify every intended row landed.
      // A short insert means a race — abort the whole tx (SEC-010 all-or-nothing)
      // rather than committing a partial batch.
      const inserted = await tx
        .insert(leaveCredits)
        .values(
          resolved.map((row) => ({
            employeeId: row.employeeId,
            leaveTypeId: row.leaveTypeId,
            year: row.year,
            totalCredits: row.totalCredits.toFixed(3),
            usedCredits: row.usedCredits.toFixed(3),
            balance: row.balance.toFixed(3),
            carryOver: row.carryOver.toFixed(3),
          })),
        )
        .onConflictDoNothing({
          target: [
            leaveCredits.employeeId,
            leaveCredits.leaveTypeId,
            leaveCredits.year,
          ],
        })
        .returning({ id: leaveCredits.id });

      if (inserted.length !== resolved.length) {
        throw new LeaveLedgerConflictError();
      }

      await tx
        .update(leaveBulkUploads)
        .set({ status: "committed", updatedAt: new Date() })
        .where(eq(leaveBulkUploads.id, parsedUploadId));

      await tx.insert(auditLogs).values({
        userId: user.id,
        action: "commit",
        tableName: "leave_bulk_uploads",
        recordId: parsedUploadId,
        oldValues: { status: "pending" },
        newValues: {
          status: "committed",
          fileName: upload.fileName,
          committedRows: resolved.length,
        },
      });

      return {
        processedCount: resolved.length,
        errors: [] as Array<{ row: number; message: string }>,
      };
    });
  } catch (err) {
    // A concurrent commit won the race on a shared (employee, leave type, year)
    // key; the unique index rolled our whole batch back. Report cleanly with
    // zero writes rather than surfacing a raw DB error (SEC-010).
    if (err instanceof LeaveLedgerConflictError) {
      return { processedCount: 0, errors: [{ row: 0, message: err.message }] };
    }
    throw err;
  }

  if (result.processedCount > 0) {
    revalidatePath("/leave/bulk-upload");
    revalidatePath("/leave/credits/admin");
    revalidatePath("/leave/credits");
  }

  return result;
}

// ─── Action: getAdvancedLeaveReports ──────────────────────────────────────

/** Turn empty-string filter values (unset UI selects) into undefined. */
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const LEAVE_STATUS_VALUES = [
  "pending",
  "approved",
  "disapproved",
  "cancelled",
  "recalled",
  "cancellation_requested",
  "consumed",
  "consumed_auto",
] as const;

const AdvancedLeaveReportFiltersSchema = z.object({
  startDate: z.preprocess(
    emptyToUndefined,
    z.string().date("Start date must be YYYY-MM-DD.").optional(),
  ),
  endDate: z.preprocess(
    emptyToUndefined,
    z.string().date("End date must be YYYY-MM-DD.").optional(),
  ),
  officeId: z.preprocess(
    emptyToUndefined,
    z.string().uuid("Invalid office ID.").optional(),
  ),
  leaveTypeCode: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .max(20)
      .regex(/^[A-Za-z_]+$/, "Invalid leave type code.")
      .optional(),
  ),
  status: z.preprocess(
    emptyToUndefined,
    z.enum(LEAVE_STATUS_VALUES).optional(),
  ),
  sex: z.preprocess(
    emptyToUndefined,
    z.enum(["male", "female", "prefer_not_to_say"]).optional(),
  ),
});

type AdvancedLeaveReportFilters = z.input<
  typeof AdvancedLeaveReportFiltersSchema
>;
type ParsedReportFilters = z.output<typeof AdvancedLeaveReportFiltersSchema>;

export interface AdvancedLeaveReportResult {
  /** Every application matching the filters (capped at REPORT_ROW_CAP). */
  applications: LeaveReportRow[];
  summary: LeaveReportSummary;
  /** LAM-005: LWOP list — granted without-pay applications in the period. */
  lwop: LwopReport;
  /** LAM-010: sex-disaggregated counts/days per leave type (GAD). */
  byTypeAndSex: SexDisaggregatedRow[];
  /** LAM-014: applications filed per day/month/year (by filing date). */
  filedTotals: {
    byDay: FiledTotalRow[];
    byMonth: FiledTotalRow[];
    byYear: FiledTotalRow[];
  };
  /** LAM-010: disapproved applications with approver remarks. */
  disapproved: LeaveReportRow[];
  /** True when the row cap was hit — narrow the filters for exact totals. */
  truncated: boolean;
}

/** Hard cap on rows fetched per report run (also lifts supabase's 1000 default). */
const REPORT_ROW_CAP = 5000;

/**
 * Shared fetch for the advanced report + LWOP notices. Joins applications to
 * leave type (pay flag) and employee (sex, office) and applies the filters.
 * Uses the period-overlap rule: a leave intersects [startDate, endDate] when
 * date_from <= endDate AND date_to >= startDate.
 */
async function fetchLeaveReportRows(
  filters: ParsedReportFilters,
): Promise<{ rows: LeaveReportRow[]; truncated: boolean }> {
  let query = supabaseAdmin
    .from("leave_applications")
    .select(
      `
      id,
      employee_id,
      date_from,
      date_to,
      no_of_days,
      status,
      remarks,
      created_at,
      leave_types!inner ( code, name, is_with_pay ),
      employees!inner (
        employee_no, first_name, last_name, gender, office_id,
        offices ( name )
      )
    `,
    )
    .is("deleted_at", null)
    .order("date_from", { ascending: false })
    .range(0, REPORT_ROW_CAP - 1);

  if (filters.startDate) query = query.gte("date_to", filters.startDate);
  if (filters.endDate) query = query.lte("date_from", filters.endDate);
  if (filters.officeId) {
    query = query.eq("employees.office_id", filters.officeId);
  }
  if (filters.leaveTypeCode) {
    query = query.eq("leave_types.code", filters.leaveTypeCode);
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.sex) query = query.eq("employees.gender", filters.sex);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load leave report: ${error.message}`);
  }

  const rows: LeaveReportRow[] = (data ?? []).map((row) => {
    const leaveTypeData = row.leave_types as {
      code?: string;
      name?: string;
      is_with_pay?: boolean;
    } | null;
    const empData = row.employees as {
      employee_no?: string;
      first_name?: string;
      last_name?: string;
      gender?: string;
      office_id?: string;
      offices?: { name?: string } | null;
    } | null;

    return {
      id: String(row.id),
      employeeId: String(row.employee_id),
      employeeNo: String(empData?.employee_no ?? ""),
      employeeName:
        `${empData?.last_name ?? ""}, ${empData?.first_name ?? ""}`.trim(),
      sex: String(empData?.gender ?? ""),
      office: String(empData?.offices?.name ?? "Unassigned"),
      leaveTypeCode: String(leaveTypeData?.code ?? ""),
      leaveType: String(leaveTypeData?.name ?? leaveTypeData?.code ?? ""),
      isWithPay: leaveTypeData?.is_with_pay !== false,
      dateFrom: String(row.date_from ?? ""),
      dateTo: String(row.date_to ?? ""),
      noOfDays: Number(row.no_of_days ?? 0),
      status: String(row.status ?? ""),
      remarks: typeof row.remarks === "string" ? row.remarks : null,
      filedAt: String(row.created_at ?? "").slice(0, 10),
    };
  });

  return { rows, truncated: rows.length >= REPORT_ROW_CAP };
}

/**
 * LAM-005 / LAM-010 / LAM-014: ad hoc leave reports with filters —
 * LWOP list, sex-disaggregated statistics, filed totals, disapproved list.
 *
 * Scope: org-wide data — employee_self_service is explicitly rejected even
 * though it holds `leave.view` (self-only) in the permission matrix.
 */
export async function getAdvancedLeaveReports(
  filters: AdvancedLeaveReportFilters,
): Promise<AdvancedLeaveReportResult> {
  const parsed = AdvancedLeaveReportFiltersSchema.parse(filters ?? {});
  const user = await requirePermission("leave", "view");
  if (user.role === "employee_self_service") {
    throw new Error(
      "Forbidden: advanced leave reports are limited to HR, approvers, and auditors.",
    );
  }

  const { rows, truncated } = await fetchLeaveReportRows(parsed);

  return {
    applications: rows,
    summary: buildLeaveReportSummary(rows),
    lwop: buildLwopReport(rows),
    byTypeAndSex: aggregateByTypeAndSex(rows),
    filedTotals: {
      byDay: aggregateFiledTotals(rows, "day"),
      byMonth: aggregateFiledTotals(rows, "month"),
      byYear: aggregateFiledTotals(rows, "year"),
    },
    disapproved: listDisapproved(rows),
    truncated,
  };
}

// ─── Action: sendLwopNotices ──────────────────────────────────────────────

const SendLwopNoticesSchema = z
  .object({
    startDate: z.string().date("Start date must be YYYY-MM-DD."),
    endDate: z.string().date("End date must be YYYY-MM-DD."),
    officeId: z.preprocess(
      emptyToUndefined,
      z.string().uuid("Invalid office ID.").optional(),
    ),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

export interface SendLwopNoticesResult {
  employeesNotified: number;
  totalLwopDays: number;
}

/**
 * LAM-011 (TOR 1.4.6): LWOP / No-Filed-Leave notices.
 *
 * HR triggers this from the LWOP report: for every employee with granted
 * without-pay leave in the period, the system notifies the employee AND the
 * payroll section (hr_admin + payroll_admin roles) for salary deduction
 * processing — see notifyLWOP in lwop-notifications.ts — and writes one
 * audit log entry summarizing the run.
 *
 * Guarded by `leave.approve`, the same permission the surrounding leave
 * admin actions (adjustLeaveCredits, bulk upload commit) require.
 */
export async function sendLwopNotices(
  input: unknown,
): Promise<SendLwopNoticesResult> {
  const parsed = SendLwopNoticesSchema.parse(input);
  const user = await requirePermission("leave", "approve");

  const { rows } = await fetchLeaveReportRows({
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    officeId: parsed.officeId,
    leaveTypeCode: undefined,
    status: undefined,
    sex: undefined,
  });

  const lwop = buildLwopReport(rows);
  if (lwop.byEmployee.length === 0) {
    return { employeesNotified: 0, totalLwopDays: 0 };
  }

  // notifyLWOP is fire-safe (never throws); send sequentially so the
  // notification fan-out cannot exhaust connection pools on large periods.
  for (const emp of lwop.byEmployee) {
    await notifyLWOP({
      employeeId: emp.employeeId,
      lwopDays: emp.lwopDays,
      periodStart: emp.periodStart,
      periodEnd: emp.periodEnd,
      reason: "insufficient_credits",
    });
  }

  await db.insert(auditLogs).values({
    userId: user.id,
    action: "lwop_notices_send",
    tableName: "leave_applications",
    recordId: null,
    newValues: {
      periodStart: parsed.startDate,
      periodEnd: parsed.endDate,
      officeId: parsed.officeId ?? null,
      employeesNotified: lwop.byEmployee.length,
      totalLwopDays: lwop.totalDays,
      employeeIds: lwop.byEmployee.map((emp) => emp.employeeId),
    },
  });

  return {
    employeesNotified: lwop.byEmployee.length,
    totalLwopDays: lwop.totalDays,
  };
}
