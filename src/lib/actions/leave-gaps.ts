"use server";

/**
 * Leave Administration Gaps Actions — PCSO HRIS LAM Module
 *
 * Actions: adjustLeaveCredits, uploadLeaveLedgerCsv, commitLeaveLedgerUpload,
 *          getAdvancedLeaveReports
 *
 * Requirements: LAM-001 (bulk upload), LAM-006 (auto-approval config),
 *               LAM-011 (manual adjustment), LAM-014 (ad hoc reports)
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
import {
  parseLeaveLedgerCsv,
  validateRowsForCommit,
  normalizeLedgerId,
  existingLedgerKey,
} from "@/lib/utils/leave/bulk-ledger";
import { z } from "zod";
import { eq, and, inArray } from "drizzle-orm";

// ─── Schema Validation ────────────────────────────────────────────────────

const AdjustLeaveCreditsSchema = z.object({
  employeeId: z.string().uuid("Invalid employee ID."),
  leaveTypeId: z.string().uuid("Invalid leave type ID."),
  adjustment: z
    .number()
    .refine((v) => v !== 0, "Adjustment cannot be zero.")
    .refine(
      (v) => Math.abs(v) <= 200,
      "Adjustment must be within +/- 200 days.",
    ),
  reason: z
    .string()
    .min(5, "Please provide a reason (min 5 characters) for audit.")
    .max(500),
});

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

// ─── Action: adjustLeaveCredits ───────────────────────────────────────────

export interface AdjustLeaveCreditsResult {
  leaveCreditId: string;
  previousBalance: number;
  newBalance: number;
}

/**
 * LAM-011: Manual leave credit adjustment with audit trail
 */
export async function adjustLeaveCredits(
  input: unknown,
): Promise<AdjustLeaveCreditsResult> {
  const parsed = AdjustLeaveCreditsSchema.parse(input);
  const user = await requirePermission("leave", "approve");

  const currentYear = new Date().getFullYear();

  const result = await withTx(async (tx) => {
    // Get or create leave credit record
    const [creditRow] = await tx
      .select({
        id: leaveCredits.id,
        balance: leaveCredits.balance,
        totalCredits: leaveCredits.totalCredits,
        usedCredits: leaveCredits.usedCredits,
        carryOver: leaveCredits.carryOver,
      })
      .from(leaveCredits)
      .where(
        and(
          eq(leaveCredits.employeeId, parsed.employeeId),
          eq(leaveCredits.leaveTypeId, parsed.leaveTypeId),
          eq(leaveCredits.year, currentYear),
        ),
      )
      .limit(1);

    const previousBalance = creditRow ? Number(creditRow.balance) : 0;
    const newBalance = previousBalance + parsed.adjustment;

    if (newBalance < 0) {
      throw new Error(
        `Adjustment would drive balance negative (${previousBalance.toFixed(3)} + ${parsed.adjustment.toFixed(3)} = ${newBalance.toFixed(3)}).`,
      );
    }

    let creditId: string;

    if (creditRow) {
      // Update existing record
      await tx
        .update(leaveCredits)
        .set({
          balance: String(newBalance),
          totalCredits:
            parsed.adjustment > 0
              ? String(Number(creditRow.totalCredits ?? 0) + parsed.adjustment)
              : String(creditRow.totalCredits ?? 0),
          updatedAt: new Date(),
        })
        .where(eq(leaveCredits.id, creditRow.id));
      creditId = String(creditRow.id);
    } else {
      // Create new record
      const inserted = await tx
        .insert(leaveCredits)
        .values({
          employeeId: parsed.employeeId,
          leaveTypeId: parsed.leaveTypeId,
          year: currentYear,
          balance: String(newBalance),
          totalCredits: String(Math.max(0, parsed.adjustment)),
          usedCredits: "0",
          carryOver: "0",
        })
        .returning({ id: leaveCredits.id });
      const row = inserted[0];
      if (!row) throw new Error("Failed to create leave_credits row.");
      creditId = String(row.id);
    }

    // Audit log
    await tx.insert(auditLogs).values({
      userId: user.id,
      action: "adjust",
      tableName: "leave_credits",
      recordId: creditId,
      oldValues: { balance: previousBalance },
      newValues: {
        balance: newBalance,
        adjustment: parsed.adjustment,
        reason: parsed.reason,
      },
    });

    return { leaveCreditId: creditId, previousBalance, newBalance };
  });

  revalidatePath("/leave/credits");
  revalidatePath("/leave/credits/admin");

  return result;
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
  const user = await requirePermission("leave", "approve");

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
  const user = await requirePermission("leave", "approve");

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
      employeeRows.map((e) => [normalizeLedgerId(e.employeeNo), String(e.id)]),
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
        existingLedgerKey(String(c.employeeId), String(c.leaveTypeId), c.year),
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

interface AdvancedLeaveReportFilters {
  startDate?: string;
  endDate?: string;
  officeId?: string;
  leaveTypeCode?: string;
  status?: string;
  sex?: string;
}

export interface AdvancedLeaveReportResult {
  applications: Array<{
    id: string;
    employeeNo: string;
    employeeName: string;
    sex: string;
    office: string;
    leaveType: string;
    dateFrom: string;
    dateTo: string;
    noOfDays: string;
    status: string;
  }>;
  summary: {
    totalApplications: number;
    approved: number;
    pending: number;
    disapproved: number;
    totalDays: number;
  };
}

/**
 * LAM-014: Ad hoc leave reports with filters
 */
export async function getAdvancedLeaveReports(
  filters: AdvancedLeaveReportFilters,
): Promise<AdvancedLeaveReportResult> {
  await requirePermission("leave", "view");

  // This is a placeholder implementation
  // Real implementation would use complex SQL joins
  const result: AdvancedLeaveReportResult = {
    applications: [],
    summary: {
      totalApplications: 0,
      approved: 0,
      pending: 0,
      disapproved: 0,
      totalDays: 0,
    },
  };

  return result;
}
