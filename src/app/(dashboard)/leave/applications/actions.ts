"use server";

/**
 * Leave Applications browser — server actions
 * Covers: bulkApprove, exportCsv. Cancellation lives in ../actions.ts
 * (cancelLeave / decideLeaveCancellation, PRD §12.1).
 *
 * Conventions:
 *  - Every write is guarded by `requirePermission` per the permission matrix.
 *  - Every write uses an optimistic WHERE clause on `status` to avoid lost
 *    updates under concurrent approval. A zero-row result = concurrent change.
 *  - Every write produces an audit log entry.
 *  - Zod validates all inputs before processing.
 *  - bulkApprove delegates each row to approveLeave (../actions.ts), which
 *    enforces unit scope + escalation (any non-HR approver on a >threshold
 *    leave leaves status='pending' for HR sign-off).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { csvCell } from "@/lib/utils/csv";
import { approveLeave } from "../actions";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Paths invalidated by every leave-application write. Keeping this in one
// place guarantees that credits / admin views stay in sync with approvals.
function revalidateLeaveSurfaces(): void {
  revalidatePath("/leave/applications");
  revalidatePath("/leave");
  revalidatePath("/leave/approvals");
  revalidatePath("/leave/credits");
  revalidatePath("/leave/credits/admin");
}

// ---------------------------------------------------------------------------
// Schema: bulkApprove
// ---------------------------------------------------------------------------

const BulkApproveSchema = z.object({
  leaveApplicationIds: z
    .array(z.string().uuid())
    .min(1, "At least one application ID is required.")
    .max(50, "Cannot bulk approve more than 50 applications at once."),
  remarks: z.string().max(500).optional(),
});

export interface BulkApproveResult {
  approved: number;
  escalated: number;
  skipped: number;
  errors: Array<{ id: string; message: string }>;
}

// ---------------------------------------------------------------------------
// Action: bulkApprove
// ---------------------------------------------------------------------------

export async function bulkApprove(input: unknown): Promise<BulkApproveResult> {
  const parsed = BulkApproveSchema.parse(input);
  await requirePermission("leave", "approve");

  const result: BulkApproveResult = {
    approved: 0,
    escalated: 0,
    skipped: 0,
    errors: [],
  };

  for (const id of parsed.leaveApplicationIds) {
    try {
      // approveLeave owns the self/unit scope checks, the >threshold
      // escalation, the optimistic status guard, audit and notifications —
      // and writes through Drizzle, never the session client.
      const { status } = await approveLeave({
        leaveApplicationId: id,
        remarks: parsed.remarks,
      });
      if (status === "approved") result.approved++;
      else if (status === "escalated") result.escalated++;
      else result.skipped++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Not pending any more / lost the race to another approver.
      if (
        /^(Cannot approve an application in|Already processed)/.test(message)
      ) {
        result.skipped++;
      } else {
        result.errors.push({ id, message });
      }
    }
  }

  revalidateLeaveSurfaces();

  return result;
}

// ---------------------------------------------------------------------------
// Schema: exportCsv
// ---------------------------------------------------------------------------

const ExportCsvSchema = z.object({
  status: z.string().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
});

// ---------------------------------------------------------------------------
// Action: exportCsv
// Returns a CSV string that the client downloads via a blob URL.
// ---------------------------------------------------------------------------

export async function exportCsv(input: unknown): Promise<string> {
  const parsed = ExportCsvSchema.parse(input);
  const user = await requirePermission("leave", "export");
  const supabase = await createServerClient();

  let query = supabase
    .from("leave_applications")
    .select(
      `
      id,
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
      employees ( first_name, last_name, employee_no )
    `,
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (parsed.status) query = query.eq("status", parsed.status);
  if (parsed.dateFrom) query = query.gte("date_from", parsed.dateFrom);
  if (parsed.dateTo) query = query.lte("date_to", parsed.dateTo);

  const { data, error } = await query;

  if (error) throw new Error(`Export failed: ${error.message}`);

  const rows = (data ?? []).map((row) => {
    const emp = row.employees as {
      first_name?: string;
      last_name?: string;
      employee_no?: string;
    } | null;
    const lt = row.leave_types as { code?: string; name?: string } | null;

    return {
      "Employee No": String(emp?.employee_no ?? ""),
      "Last Name": String(emp?.last_name ?? ""),
      "First Name": String(emp?.first_name ?? ""),
      "Leave Type": String(lt?.name ?? lt?.code ?? ""),
      "Date From": String(row.date_from ?? ""),
      "Date To": String(row.date_to ?? ""),
      Days: String(row.no_of_days ?? ""),
      Reason: String(row.reason ?? ""),
      Status: String(row.status ?? ""),
      "Approved At": row.approved_at
        ? new Date(String(row.approved_at)).toISOString()
        : "",
      Remarks: String(row.remarks ?? ""),
      "Filed On": row.created_at
        ? new Date(String(row.created_at)).toISOString()
        : "",
    };
  });

  // Audit the export. auditLog() writes via service role (session-client
  // inserts are rejected by RLS) and never throws, so it cannot block the export.
  await auditLog({
    userId: user.id,
    action: "export",
    table: "leave_applications",
    newValues: {
      rowCount: rows.length,
      filters: {
        status: parsed.status ?? null,
        dateFrom: parsed.dateFrom ?? null,
        dateTo: parsed.dateTo ?? null,
      },
    },
    module: "LAM",
    subModule: "leave_application",
  });

  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]!);

  // csvCell: RFC 4180 quoting + formula-injection guard (=, +, -, @ …).
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((row) =>
      headers.map((h) => csvCell(row[h as keyof typeof row])).join(","),
    ),
  ];

  return lines.join("\r\n");
}
