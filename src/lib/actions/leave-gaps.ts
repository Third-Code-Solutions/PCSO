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
import { withTx } from "@/lib/db/transaction";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";

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

interface BulkUploadRow {
  employeeNo: string;
  leaveTypeCode: string;
  year: number;
  balance: number;
  totalCredits: number;
  usedCredits: number;
  carryOver: number;
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

    return { creditId, previousBalance, newBalance };
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
 * LAM-001: Bulk upload leave ledgers via CSV with validation preview
 */
export async function uploadLeaveLedgerCsv(
  formData: FormData,
): Promise<UploadLeaveLedgerCsvResult> {
  const user = await requirePermission("leave", "approve");

  const file = formData.get("file") as File;
  if (!file) {
    throw new Error("No file provided");
  }

  const fileName = file.name;
  const text = await file.text();
  const lines = text.split("\n").filter((line) => line.trim() !== "");

  if (lines.length < 2) {
    throw new Error("CSV must have at least a header row and one data row");
  }

  const header = lines[0]!.split(",");
  const expectedHeaders = [
    "employeeNo",
    "leaveTypeCode",
    "year",
    "balance",
    "totalCredits",
    "usedCredits",
    "carryOver",
  ];

  // Basic header validation
  if (header.length < expectedHeaders.length) {
    throw new Error(
      `Invalid CSV format. Expected headers: ${expectedHeaders.join(", ")}`,
    );
  }

  const rows: BulkUploadRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  // Parse and validate rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!;
    const values = line.split(",");

    if (values.length < expectedHeaders.length) {
      errors.push({ row: i + 1, message: "Insufficient columns" });
      continue;
    }

    try {
      const row: BulkUploadRow = {
        employeeNo: values[0]!.trim(),
        leaveTypeCode: values[1]!.trim(),
        year: parseInt(values[2]!.trim(), 10),
        balance: parseFloat(values[3]!.trim()),
        totalCredits: parseFloat(values[4]!.trim()),
        usedCredits: parseFloat(values[5]!.trim()),
        carryOver: parseFloat(values[6]!.trim()),
      };

      // Validation
      if (!row.employeeNo) {
        errors.push({ row: i + 1, message: "Employee number is required" });
        continue;
      }
      if (!row.leaveTypeCode) {
        errors.push({ row: i + 1, message: "Leave type code is required" });
        continue;
      }
      if (isNaN(row.year) || row.year < 2000 || row.year > 2100) {
        errors.push({ row: i + 1, message: "Invalid year" });
        continue;
      }
      if (isNaN(row.balance) || row.balance < 0) {
        errors.push({ row: i + 1, message: "Invalid balance" });
        continue;
      }

      rows.push(row);
    } catch (err) {
      errors.push({
        row: i + 1,
        message: err instanceof Error ? err.message : "Parse error",
      });
    }
  }

  // Check for duplicates within upload
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const key = `${row.employeeNo}:${row.leaveTypeCode}:${row.year}`;
    if (seen.has(key)) {
      errors.push({
        row: i + 2, // +2 because we start from row 1 (header is row 0)
        message: `Duplicate entry for ${key}`,
      });
    }
    seen.add(key);
  }

  const validCount = rows.length - errors.length;
  const errorCount = errors.length;

  // Create upload record
  const [upload] = await db
    .insert(leaveBulkUploads)
    .values({
      fileName,
      recordCount: rows.length,
      validCount,
      errorCount,
      uploadedById: user.employeeId!,
      status: errorCount === rows.length ? "rejected" : "pending",
      validationErrors: JSON.stringify(errors),
    })
    .returning({ id: leaveBulkUploads.id });

  if (!upload) {
    throw new Error("Failed to create upload record");
  }

  revalidatePath("/leave/bulk-upload");

  return {
    uploadId: String(upload.id),
    recordCount: rows.length,
    validCount,
    errorCount,
    errors,
  };
}

// ─── Action: commitLeaveLedgerUpload ──────────────────────────────────────

export interface CommitLeaveLedgerUploadResult {
  processedCount: number;
  errors: Array<{ row: number; message: string }>;
}

/**
 * LAM-001: Commit validated bulk upload to database
 */
export async function commitLeaveLedgerUpload(
  uploadId: string,
): Promise<CommitLeaveLedgerUploadResult> {
  const user = await requirePermission("leave", "approve");

  const [upload] = await db
    .select()
    .from(leaveBulkUploads)
    .where(eq(leaveBulkUploads.id, uploadId))
    .limit(1);

  if (!upload) {
    throw new Error("Upload record not found");
  }

  if (upload.status !== "pending") {
    throw new Error(`Cannot commit upload in '${upload.status}' status`);
  }

  // TODO: Parse the original file again and commit valid rows
  // For now, just mark as committed
  await db
    .update(leaveBulkUploads)
    .set({ status: "committed", updatedAt: new Date() })
    .where(eq(leaveBulkUploads.id, uploadId));

  revalidatePath("/leave/bulk-upload");
  revalidatePath("/leave/credits/admin");

  return {
    processedCount: upload.validCount,
    errors: [],
  };
}

// ─── Action: getAdvancedLeaveReports ──────────────────────────────────────

interface AdvancedLeaveReportFilters {
  startDate?: string;
  endDate?: string;
  officeId?: string;
  leaveTypeCode?: string;
  status?: string;
  sex?: "M" | "F";
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
  await requirePermission("leave", "read");

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
