"use server";

/**
 * Portal — PDS Update Request actions (EPM-012).
 *
 * Workflow (no supervisor step — HRD approves employee-submitted PDS changes
 * directly, per PRD §4 EPM-012):
 *   1. Employee submits proposed PDS section changes  → SUBMITTED
 *   2. HR approves → APPROVED, and the change is committed to the 201 file
 *      inside the same transaction. HR rejects → REJECTED.
 *
 * The one PDS section wired to an employee column today is Section 31
 * (Special Skills & Hobbies), which is written to
 * `employees.special_skills_hobbies` — the store the EWBM wellness report
 * (EWB-005) reads. Other sections are recorded and approved but have no
 * direct employee-column mapping yet; they are applied out-of-band.
 *
 * Authorization:
 *   - Submit: Own employee only (requireAuth + own-record scope).
 *   - Approve / Reject: requirePermission('employees', 'process')
 *     → super_admin + hr_admin.
 *   - HR queue reads: requirePermission('employees', 'approve') (same roles).
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { pdsUpdateRequests, type PdsUpdateRequest } from "@/lib/db/schema";
import { employees } from "@/lib/db/schema/employees";
import { requireAuth, requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { notifyEmployee, notifyRoles } from "@/lib/notifications";
import { withTx, lockKey } from "@/lib/db/transaction";
import { normalizePdsSection31 } from "@/lib/utils/portal/pds-section31";

// ─── Result envelope ─────────────────────────────────────────────────────────

type Ok<T> = { data: T };
type Err = { error: string };
type Result<T> = Ok<T> | Err;

// Joined people are display-only: never ship TIN / GSIS / bank / salary
// columns to the client components that render these lists.
const NAME_ONLY = {
  columns: { id: true, firstName: true, lastName: true, employeeNumber: true },
} as const;

// ─── PDS sections ────────────────────────────────────────────────────────────
//
// Section 31 is the only section with a committed employee-column write path
// today. The rest are accepted so the full PDS-update surface is captured,
// but they do not mutate the employee row on approval.

const PDS_SECTIONS = [
  "section_31",
  "personal_info",
  "family_background",
  "education",
  "eligibility",
  "work_experience",
  "voluntary_work",
  "training",
  "other_information",
] as const;

// ─── Validation schemas ──────────────────────────────────────────────────────

const section31Schema = z.object({
  skills: z.array(z.string().max(200)).max(200),
  hobbies: z.array(z.string().max(200)).max(200),
});

const submitSchema = z
  .object({
    sectionUpdated: z.enum(PDS_SECTIONS),
    // Proposed field-level changes for the section. For section_31 this MUST
    // be a { skills: string[], hobbies: string[] } shape.
    proposedChanges: z.record(z.string(), z.unknown()),
    currentValues: z.record(z.string(), z.unknown()).default({}),
    reason: z.string().min(10, "Reason must be at least 10 characters"),
    supportingDocumentUrls: z.array(z.string().url()).default([]),
  })
  .superRefine((val, ctx) => {
    if (
      val.sectionUpdated === "section_31" &&
      !section31Schema.safeParse(val.proposedChanges).success
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["proposedChanges"],
        message:
          "Section 31 changes must be { skills: string[], hobbies: string[] }",
      });
    }
  });

const approveSchema = z.object({
  requestId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
});

const rejectSchema = z.object({
  requestId: z.string().uuid(),
  rejectionReason: z.string().min(1, "Rejection reason is required").max(2000),
  notes: z.string().max(2000).optional(),
});

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Submit a PDS update request (EPM-012). Own-record scope only.
 * Creates a SUBMITTED request carrying the proposed section changes; for
 * Section 31 it also snapshots the employee's current skills/hobbies.
 */
export async function submitPdsUpdateRequest(
  input: z.infer<typeof submitSchema>,
): Promise<Result<PdsUpdateRequest>> {
  const session = await requireAuth();
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Validation failed" };
  }

  if (!session.employeeId) {
    return { error: "No employee record is linked to this account" };
  }
  const employeeId = session.employeeId;

  const {
    sectionUpdated,
    proposedChanges,
    currentValues,
    reason,
    supportingDocumentUrls,
  } = parsed.data;

  try {
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, employeeId),
    });
    if (!employee) {
      return { error: "Employee not found" };
    }

    const isSection31 = sectionUpdated === "section_31";

    // For Section 31, snapshot the live employee value so the request records
    // exactly what it replaced (falls back to the caller-supplied snapshot).
    const currentSnapshot = isSection31
      ? {
          section_31: employee.specialSkillsHobbies ?? {
            skills: [],
            hobbies: [],
          },
        }
      : currentValues;

    const [request] = await db
      .insert(pdsUpdateRequests)
      .values({
        employeeId,
        sectionUpdated,
        proposedChanges: proposedChanges as unknown,
        currentValues: currentSnapshot as unknown,
        reason,
        supportingDocumentUrls: supportingDocumentUrls as unknown[],
        status: "submitted",
        propagateToWellness: isSection31,
      })
      .returning();

    if (!request) {
      return { error: "Failed to create PDS update request" };
    }

    await auditLog({
      userId: session.id,
      action: "pds_update.submit",
      table: "pds_update_requests",
      recordId: request.id,
    });

    // Notify the HR review queue (non-blocking).
    await notifyRoles(["hr_admin", "super_admin"], {
      type: "generic",
      title: "PDS Update Request",
      body: `${employee.firstName} ${employee.lastName} submitted a PDS update (${sectionUpdated.replace(/_/g, " ")}) for review`,
      entityType: "pds_update_request",
      entityId: request.id,
    });

    revalidatePath("/portal/pds-update");
    return { data: request };
  } catch (error) {
    console.error("[submitPdsUpdateRequest]", error);
    return { error: "Failed to submit PDS update request" };
  }
}

/**
 * HR approves a PDS update request (EPM-012).
 * On approval, inside a single transaction: mark the request APPROVED and,
 * when it carries Section 31 data, commit it to
 * `employees.special_skills_hobbies` (the wellness-report source).
 */
export async function approvePdsUpdateRequest(
  input: z.infer<typeof approveSchema>,
): Promise<Result<PdsUpdateRequest>> {
  const user = await requirePermission("employees", "process");
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Validation failed" };
  }

  const { requestId, notes } = parsed.data;

  try {
    const request = await db.query.pdsUpdateRequests.findFirst({
      where: eq(pdsUpdateRequests.id, requestId),
      with: { employee: true },
    });

    if (!request) {
      return { error: "Request not found" };
    }
    if (request.status !== "submitted") {
      return { error: "Request is not pending HR review" };
    }

    // Audit payload for the employee mutation, captured inside the tx.
    let appliedEmployeeWrite: {
      employeeId: string;
      oldValues: Record<string, unknown>;
      newValues: Record<string, unknown>;
    } | null = null;

    const updated = await withTx(async (tx) => {
      // Serialize concurrent HR reviewers of the same request.
      await lockKey(tx, `pds_update:${requestId}`);

      const [locked] = await tx
        .select({ status: pdsUpdateRequests.status })
        .from(pdsUpdateRequests)
        .where(eq(pdsUpdateRequests.id, requestId))
        .limit(1);

      if (!locked || locked.status !== "submitted") {
        throw new Error("REQUEST_NOT_PENDING");
      }

      let applied = false;

      // Section 31 → employees.special_skills_hobbies (wellness source).
      if (request.sectionUpdated === "section_31") {
        const section = normalizePdsSection31(request.proposedChanges);

        const [emp] = await tx
          .select({ current: employees.specialSkillsHobbies })
          .from(employees)
          .where(eq(employees.id, request.employeeId))
          .limit(1);

        if (!emp) {
          throw new Error("EMPLOYEE_NOT_FOUND");
        }

        const [written] = await tx
          .update(employees)
          .set({ specialSkillsHobbies: section, updatedAt: new Date() })
          .where(eq(employees.id, request.employeeId))
          .returning({ id: employees.id });

        if (!written) {
          throw new Error("Failed to apply Section 31 update to employee");
        }

        applied = true;
        appliedEmployeeWrite = {
          employeeId: request.employeeId,
          oldValues: { specialSkillsHobbies: emp.current ?? null },
          newValues: { specialSkillsHobbies: section },
        };
      }

      const [row] = await tx
        .update(pdsUpdateRequests)
        .set({
          status: "approved",
          hrReviewerId: user.employeeId ?? null,
          hrApprovedAt: new Date(),
          hrNotes: notes ?? null,
          appliedAt: applied ? new Date() : null,
        })
        .where(eq(pdsUpdateRequests.id, requestId))
        .returning();

      if (!row) {
        throw new Error("Failed to update PDS update request");
      }
      return row;
    });

    await auditLog({
      userId: user.id,
      action: "pds_update.approve",
      table: "pds_update_requests",
      recordId: requestId,
    });

    if (appliedEmployeeWrite !== null) {
      const applied: {
        employeeId: string;
        oldValues: Record<string, unknown>;
        newValues: Record<string, unknown>;
      } = appliedEmployeeWrite;
      await auditLog({
        userId: user.id,
        action: "employee.pds_section31_update",
        table: "employees",
        recordId: applied.employeeId,
        oldValues: applied.oldValues,
        newValues: applied.newValues,
      });
    }

    // Notify employee (non-blocking).
    await notifyEmployee(request.employeeId, {
      type: "generic",
      title: "PDS Update Approved",
      body: `Your PDS update (${request.sectionUpdated.replace(/_/g, " ")}) has been approved and applied to your 201 file`,
      entityType: "pds_update_request",
      entityId: requestId,
    });

    revalidatePath("/portal/pds-update");
    return { data: updated };
  } catch (error) {
    console.error("[approvePdsUpdateRequest]", error);
    if (error instanceof Error && error.message === "REQUEST_NOT_PENDING") {
      return { error: "Request is not pending HR review" };
    }
    return { error: "Failed to approve PDS update request" };
  }
}

/**
 * HR rejects a PDS update request (EPM-012). No employee mutation.
 */
export async function rejectPdsUpdateRequest(
  input: z.infer<typeof rejectSchema>,
): Promise<Result<PdsUpdateRequest>> {
  const user = await requirePermission("employees", "process");
  const parsed = rejectSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Validation failed" };
  }

  const { requestId, rejectionReason, notes } = parsed.data;

  try {
    const request = await db.query.pdsUpdateRequests.findFirst({
      where: eq(pdsUpdateRequests.id, requestId),
    });

    if (!request) {
      return { error: "Request not found" };
    }
    if (request.status !== "submitted") {
      return { error: "Request is not pending HR review" };
    }

    const updated = await withTx(async (tx) => {
      await lockKey(tx, `pds_update:${requestId}`);

      const [locked] = await tx
        .select({ status: pdsUpdateRequests.status })
        .from(pdsUpdateRequests)
        .where(eq(pdsUpdateRequests.id, requestId))
        .limit(1);

      if (!locked || locked.status !== "submitted") {
        throw new Error("REQUEST_NOT_PENDING");
      }

      const [row] = await tx
        .update(pdsUpdateRequests)
        .set({
          status: "rejected",
          hrReviewerId: user.employeeId ?? null,
          hrNotes: notes ?? null,
          rejectionReason,
        })
        .where(eq(pdsUpdateRequests.id, requestId))
        .returning();

      if (!row) {
        throw new Error("Failed to update PDS update request");
      }
      return row;
    });

    await auditLog({
      userId: user.id,
      action: "pds_update.reject",
      table: "pds_update_requests",
      recordId: requestId,
    });

    await notifyEmployee(request.employeeId, {
      type: "generic",
      title: "PDS Update Rejected",
      body: `Your PDS update request was rejected by HR: ${rejectionReason}`,
      entityType: "pds_update_request",
      entityId: requestId,
    });

    revalidatePath("/portal/pds-update");
    return { data: updated };
  } catch (error) {
    console.error("[rejectPdsUpdateRequest]", error);
    if (error instanceof Error && error.message === "REQUEST_NOT_PENDING") {
      return { error: "Request is not pending HR review" };
    }
    return { error: "Failed to reject PDS update request" };
  }
}

/**
 * Get PDS update requests for the current user (own records).
 */
export async function getMyPdsUpdateRequests(): Promise<
  Result<PdsUpdateRequest[]>
> {
  const session = await requireAuth();

  if (!session.employeeId) {
    return { data: [] };
  }

  try {
    const requests = await db.query.pdsUpdateRequests.findMany({
      where: and(
        eq(pdsUpdateRequests.employeeId, session.employeeId),
        sql`${pdsUpdateRequests.deletedAt} IS NULL`,
      ),
      with: { hrReviewer: NAME_ONLY },
      orderBy: desc(pdsUpdateRequests.createdAt),
    });

    return { data: requests };
  } catch (error) {
    console.error("[getMyPdsUpdateRequests]", error);
    return { error: "Failed to fetch PDS update requests" };
  }
}

/**
 * Get pending PDS update requests for the HR review queue.
 */
export async function getPendingPdsUpdateRequestsForHR(): Promise<
  Result<PdsUpdateRequest[]>
> {
  // HR only — the same roles that may approve/reject (employees.process).
  await requirePermission("employees", "approve");

  try {
    const requests = await db.query.pdsUpdateRequests.findMany({
      where: and(
        eq(pdsUpdateRequests.status, "submitted"),
        sql`${pdsUpdateRequests.deletedAt} IS NULL`,
      ),
      with: { employee: NAME_ONLY },
      orderBy: desc(pdsUpdateRequests.createdAt),
    });

    return { data: requests };
  } catch (error) {
    console.error("[getPendingPdsUpdateRequestsForHR]", error);
    return { error: "Failed to fetch pending PDS update requests" };
  }
}

/**
 * Get all PDS update requests for HR (full history).
 */
export async function getAllPdsUpdateRequestsForHR(): Promise<
  Result<PdsUpdateRequest[]>
> {
  // HR only — the same roles that may approve/reject (employees.process).
  await requirePermission("employees", "approve");

  try {
    const requests = await db.query.pdsUpdateRequests.findMany({
      where: sql`${pdsUpdateRequests.deletedAt} IS NULL`,
      with: { employee: NAME_ONLY, hrReviewer: NAME_ONLY },
      orderBy: desc(pdsUpdateRequests.createdAt),
    });

    return { data: requests };
  } catch (error) {
    console.error("[getAllPdsUpdateRequestsForHR]", error);
    return { error: "Failed to fetch PDS update requests" };
  }
}
