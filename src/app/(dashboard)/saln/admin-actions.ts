"use server";

/**
 * SALN admin-only server actions — split from actions.ts to keep files <400 LOC.
 *
 * Contains actions that only super_admin can execute:
 *  - reviewSaln: mark received / verified / deficient, with remarks
 *  - exportDocuments: COA-ready CSV of all submissions for a year
 *  - generateSignedDocumentUrl: 1-hour signed URL for saln-documents bucket
 *
 * All Zod-validated, all audited.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requirePermission } from "@/lib/auth/guards";
import { notifyEmployee } from "@/lib/notifications";
import { ExportSalnSchema, SalnStatusSchema } from "@/lib/validations/saln";

// ---------------------------------------------------------------------------
// Shared audit helper
// ---------------------------------------------------------------------------

async function writeAuditLog(
  supabase: SupabaseClient,
  params: {
    userId: string;
    action: string;
    recordId: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  },
): Promise<void> {
  await supabase.from("audit_logs").insert({
    user_id: params.userId,
    action: params.action,
    table_name: "saln_submissions",
    record_id: params.recordId,
    old_values: params.oldValues ?? null,
    new_values: params.newValues ?? null,
  });
}

// ---------------------------------------------------------------------------
// Action: reviewSaln
//
// Note: schema lives inline (not exported) because 'use server' files may only
// export async functions. Consumers cross the boundary with `unknown` input.
// ---------------------------------------------------------------------------

const reviewSalnSchema = z.object({
  id: z.string().uuid("Invalid SALN ID."),
  status: SalnStatusSchema.refine(
    (s) => s === "received" || s === "verified" || s === "deficient",
    {
      message:
        "Only received, verified, or deficient are valid review outcomes.",
    },
  ),
  remarks: z.string().max(1000).optional(),
});

export async function reviewSaln(input: unknown): Promise<{ id: string }> {
  const parsed = reviewSalnSchema.parse(input);
  const user = await requirePermission("saln", "approve");

  if (user.role !== "super_admin") {
    throw Object.assign(
      new Error("Forbidden: Only super_admin can review SALN submissions."),
      { status: 403 },
    );
  }

  const supabase = supabaseAdmin;

  const { data: existing, error: fetchError } = await supabase
    .from("saln_submissions")
    .select("id, employee_id, status, year")
    .eq("id", parsed.id)
    .single();

  if (fetchError || !existing) {
    throw new Error("SALN submission not found.");
  }

  const currentStatus = String(existing.status ?? "");
  if (currentStatus === "draft") {
    throw new Error("Cannot review a draft SALN — it must be submitted first.");
  }

  // Idempotent review: only flip status if it actually changes.
  // Equivalent of: UPDATE saln_submissions SET status=$1 WHERE id=$2 AND status != $1
  const statusChanged = currentStatus !== parsed.status;

  const { error: updateError, data: updated } = await supabase
    .from("saln_submissions")
    .update({
      status: parsed.status,
      remarks: parsed.remarks ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.id)
    .neq("status", parsed.status)
    .select("id");

  if (updateError) {
    throw new Error(`Failed to review SALN: ${updateError.message}`);
  }

  const didUpdate = Array.isArray(updated) && updated.length > 0;

  // Only emit audit + notification when the status actually flipped.
  // Re-submitting the same review is a no-op.
  if (didUpdate && statusChanged) {
    await writeAuditLog(supabase, {
      userId: user.id,
      action: parsed.status === "deficient" ? "flag" : "review",
      recordId: parsed.id,
      oldValues: { status: currentStatus },
      newValues: { status: parsed.status, remarks: parsed.remarks ?? null },
    });
  }

  // Notify owning employee (only on real status change — idempotent review)
  const ownerEmployeeId = String(existing.employee_id ?? "");
  if (didUpdate && statusChanged && ownerEmployeeId) {
    const titleMap: Record<string, string> = {
      received: "SALN received by compliance office",
      verified: "SALN verified — thank you for your compliance",
      deficient: "SALN flagged as deficient — action required",
    };
    try {
      await notifyEmployee(ownerEmployeeId, {
        type: "saln_reminder",
        title:
          titleMap[parsed.status] ?? `SALN status updated: ${parsed.status}`,
        body:
          parsed.status === "deficient" && parsed.remarks
            ? `Remarks: ${parsed.remarks}`
            : undefined,
        actionUrl: `/saln/${parsed.id}`,
        entityType: "saln_submission",
        entityId: parsed.id,
      });
    } catch (notifyErr) {
      console.error(
        "[saln/admin-actions] reviewSaln notification failed:",
        notifyErr,
      );
    }
  }

  revalidatePath("/saln");
  revalidatePath(`/saln/${parsed.id}`);
  revalidatePath("/saln/submissions");
  revalidatePath("/saln/admin");
  revalidatePath("/saln/tracking");

  return { id: parsed.id };
}

// ---------------------------------------------------------------------------
// Action: exportDocuments — COA compliance CSV (super_admin only)
// ---------------------------------------------------------------------------

export interface ExportResult {
  content: string;
  filename: string;
  mimeType: string;
}

export async function exportDocuments(input: unknown): Promise<ExportResult> {
  const parsed = ExportSalnSchema.parse(input);
  const user = await requirePermission("saln", "export");

  if (user.role !== "super_admin") {
    throw Object.assign(
      new Error("Forbidden: Only super_admin can export SALN data."),
      { status: 403 },
    );
  }

  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("saln_submissions")
    .select(
      `
      id,
      year,
      filing_type,
      status,
      total_assets,
      total_liabilities,
      net_worth,
      date_filed,
      employees!inner (
        employee_no,
        first_name,
        middle_name,
        last_name,
        position_title,
        offices (name)
      )
    `,
    )
    .eq("year", parsed.year)
    .neq("status", "draft")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load SALN data for export: ${error.message}`);
  }

  await writeAuditLog(supabase, {
    userId: user.id,
    action: "export",
    recordId: user.id,
    newValues: {
      year: parsed.year,
      format: parsed.format,
      count: (data ?? []).length,
    },
  });

  const headers = [
    "Employee No.",
    "Full Name",
    "Position",
    "Office",
    "Filing Type",
    "Status",
    "Date Filed",
    "Total Assets",
    "Total Liabilities",
    "Net Worth",
  ];

  const rows = (data ?? []).map((row) => {
    const empRaw = row.employees;
    const emp =
      ((Array.isArray(empRaw) ? empRaw[0] : empRaw) as Record<
        string,
        unknown
      > | null) ?? {};
    const officeRaw = emp["offices"];
    const office = (
      Array.isArray(officeRaw) ? officeRaw[0] : officeRaw
    ) as Record<string, unknown> | null;
    const name = [emp["first_name"], emp["middle_name"], emp["last_name"]]
      .filter(Boolean)
      .join(" ");
    return [
      String(emp["employee_no"] ?? ""),
      name,
      String(emp["position_title"] ?? ""),
      office ? String(office["name"] ?? "") : "",
      String(row.filing_type ?? ""),
      String(row.status ?? ""),
      String(row.date_filed ?? ""),
      String(row.total_assets ?? "0.00"),
      String(row.total_liabilities ?? "0.00"),
      String(row.net_worth ?? "0.00"),
    ]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(",");
  });

  const content = [headers.join(","), ...rows].join("\n");
  const filename = `saln-compliance-${parsed.year}.csv`;

  return { content, filename, mimeType: "text/csv" };
}

// ---------------------------------------------------------------------------
// Action: generateSignedDocumentUrl — 1-hour signed URL for SALN docs
// ---------------------------------------------------------------------------

export async function generateSignedDocumentUrl(
  submissionId: string,
): Promise<{ signedUrl: string }> {
  const user = await requirePermission("saln", "view");

  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("saln_submissions")
    .select("employee_id, document_url, year")
    .eq("id", submissionId)
    .single();

  if (error || !data) {
    throw new Error("SALN submission not found.");
  }

  if (
    user.role !== "super_admin" &&
    user.employeeId !== String(data.employee_id ?? "")
  ) {
    throw Object.assign(
      new Error("Forbidden: You may only access your own SALN documents."),
      { status: 403 },
    );
  }

  const storagePath = String(data.document_url ?? "");
  if (!storagePath) {
    throw new Error("No document is attached to this SALN submission.");
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from("saln-documents")
    .createSignedUrl(storagePath, 60 * 60);

  if (signedError || !signedData?.signedUrl) {
    throw new Error(
      `Failed to generate signed URL: ${signedError?.message ?? "Unknown error"}`,
    );
  }

  await writeAuditLog(supabase, {
    userId: user.id,
    action: "access_document",
    recordId: submissionId,
    newValues: {
      storage_path: storagePath,
      note: "Signed URL generated for SALN document — 1hr expiry",
    },
  });

  return { signedUrl: signedData.signedUrl };
}
