"use server";

/**
 * RPM — Manpower Request Form (MRF) server actions.
 * PRD §4.2.1 RPM-001..RPM-005 and state machine §12.3
 * (MRF_DRAFT → MRF_PENDING → PUBLISHED).
 *
 * Lifecycle:
 *   createMrf    → status='draft'
 *   submitMrf    → status='submitted', mrfNumber assigned, 3 approval rows
 *   approveMrfStep → advances chain; last step flips status='approved' and
 *                    creates a vacancy draft with CSC9 number
 *   returnMrf    → status='returned', clears remaining approvals
 *   publishVacancy → vacancy.status='published', PDF uploaded to storage
 *   uploadCscReceipt → stores the CSC confirmation URL
 *
 * All actions:
 *   - validate via Zod
 *   - require an authenticated session
 *   - return `{ data: T } | { error: string }`
 *   - never throw to the caller
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { renderToBuffer } from "@react-pdf/renderer";
import { z } from "zod";

import { db } from "@/lib/db";
import { withTx, type Tx } from "@/lib/db/transaction";
import { requireAuth, requirePermission } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  mrfs,
  mrfApprovals,
  vacancies,
  type Mrf,
  type MrfApproval,
  type Vacancy,
} from "@/lib/db/schema/recruitment";
import { offices } from "@/lib/db/schema/offices";
import { plantillaPositions } from "@/lib/db/schema/plantilla";
import {
  createMrfSchema,
  updateMrfSchema,
  submitMrfSchema,
  approveMrfSchema,
  qualificationStandardsSchema,
  type CreateMrfInput,
  type UpdateMrfInput,
  type SubmitMrfInput,
  type ApproveMrfInput,
  type QualificationStandards,
} from "@/lib/validations/recruitment";
import { nextMrfNumber, nextCscForm9Number } from "@/lib/utils/rpm/mrf-number";
import {
  buildCscForm9Data,
  type MrfInput as MrfDataInput,
  type OfficeInput,
  type OrgProfileInput,
  type PositionInput,
  type VacancyInput,
} from "@/lib/utils/rpm/csc-form-9-data";
import { CscForm9 } from "@/components/pdf/csc-form-9";
import { getOrgProfile } from "@/lib/org-profile";

// ---------------------------------------------------------------------------
// Result envelope
// ---------------------------------------------------------------------------

export type ActionResult<T> = { data: T } | { error: string };

function ok<T>(data: T): ActionResult<T> {
  return { data };
}

function fail(error: unknown): ActionResult<never> {
  if (error instanceof z.ZodError) {
    const first = error.issues[0];
    return {
      error: first
        ? `${first.path.join(".")}: ${first.message}`
        : "Validation failed",
    };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: "Unexpected error" };
}

// ---------------------------------------------------------------------------
// Local schemas (not duplicated from validations)
// ---------------------------------------------------------------------------

const publishVacancyInputSchema = z.object({
  vacancyId: z.string().uuid(),
  applicationDeadline: z.string().datetime({ offset: true }),
  qualificationStandards: qualificationStandardsSchema.optional(),
});

const uploadCscReceiptSchema = z.object({
  vacancyId: z.string().uuid(),
  fileUrl: z.string().trim().url().max(500),
});

const returnMrfSchema = z.object({
  mrfId: z.string().uuid(),
  reason: z.string().trim().min(1).max(2000),
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 3-level approval chain roles per PRD FM-022 / RPM-002. */
const APPROVAL_ROLES = ["dept_head", "agm", "gm"] as const;
type ApprovalRole = (typeof APPROVAL_ROLES)[number];

/** Supabase storage bucket for RPM PDFs. */
const RPM_DOCS_BUCKET = "rpm-documents";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

async function signatoryEmployeeIdOrSelf(
  _role: ApprovalRole,
  fallback: string,
): Promise<string> {
  // TODO(PRD FM-022 signatory chains): look up the current incumbent for
  // `_role` via the signatories table (not yet in schema). Until that exists
  // we fall back to the requesting employee so the FK is always satisfied.
  return fallback;
}

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.toISOString();
}

// ---------------------------------------------------------------------------
// createMrf
// ---------------------------------------------------------------------------

export async function createMrf(
  input: CreateMrfInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("employees", "create");
    const parsed = createMrfSchema.parse(input);

    const [row] = await db
      .insert(mrfs)
      .values({
        positionId: parsed.positionId,
        officeId: parsed.officeId,
        requestedByEmployeeId: parsed.requestedByEmployeeId,
        itemNumber: parsed.itemNumber,
        justification: parsed.justification,
        numberOfVacancies: parsed.numberOfVacancies,
        status: "draft",
      })
      .returning({ id: mrfs.id });

    if (!row) return { error: "Failed to create MRF" };
    revalidatePath("/recruitment/mrf");
    return ok({ id: row.id });
  } catch (err: unknown) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// updateMrf
// ---------------------------------------------------------------------------

export async function updateMrf(
  input: UpdateMrfInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("employees", "edit");
    const parsed = updateMrfSchema.parse(input);
    const { id, ...rest } = parsed;

    const [current] = await db
      .select()
      .from(mrfs)
      .where(eq(mrfs.id, id))
      .limit(1);
    if (!current) return { error: "MRF not found" };
    if (current.status !== "draft" && current.status !== "returned") {
      return { error: `MRF in status "${current.status}" cannot be edited` };
    }

    const [row] = await db
      .update(mrfs)
      .set({ ...rest, updatedAt: new Date() })
      .where(eq(mrfs.id, id))
      .returning({ id: mrfs.id });

    if (!row) return { error: "Failed to update MRF" };
    revalidatePath(`/recruitment/mrf/${id}`);
    return ok({ id: row.id });
  } catch (err: unknown) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// submitMrf — assigns MRF number, creates 3 approval rows
// ---------------------------------------------------------------------------

export async function submitMrf(
  input: SubmitMrfInput,
): Promise<ActionResult<{ id: string; mrfNumber: string }>> {
  try {
    await requirePermission("employees", "edit");
    const parsed = submitMrfSchema.parse(input);

    const result = await withTx(async (tx: Tx) => {
      const [current] = await tx
        .select()
        .from(mrfs)
        .where(eq(mrfs.id, parsed.id))
        .limit(1);
      if (!current) throw new Error("MRF not found");
      if (current.status !== "draft" && current.status !== "returned") {
        throw new Error(
          `MRF in status "${current.status}" cannot be submitted`,
        );
      }

      const allocation = await nextMrfNumber(tx);

      const [updated] = await tx
        .update(mrfs)
        .set({
          mrfNumber: allocation.formatted,
          status: "submitted",
          submittedAt: new Date(),
          returnedReason: null,
          updatedAt: new Date(),
        })
        .where(eq(mrfs.id, parsed.id))
        .returning();

      if (!updated) throw new Error("MRF submission failed");

      // Clear any prior approvals (for returned → resubmit)
      await tx.delete(mrfApprovals).where(eq(mrfApprovals.mrfId, parsed.id));

      const approvalRows = await Promise.all(
        APPROVAL_ROLES.map(async (role, idx) => ({
          mrfId: parsed.id,
          approverRole: role,
          approverEmployeeId: await signatoryEmployeeIdOrSelf(
            role,
            current.requestedByEmployeeId,
          ),
          sequenceOrder: idx + 1,
          decision: "pending",
        })),
      );
      await tx.insert(mrfApprovals).values(approvalRows);

      return { id: updated.id, mrfNumber: allocation.formatted };
    });

    revalidatePath(`/recruitment/mrf/${result.id}`);
    return ok(result);
  } catch (err: unknown) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// approveMrfStep — single approval; on final approval creates vacancy draft
// ---------------------------------------------------------------------------

export async function approveMrfStep(input: ApproveMrfInput): Promise<
  ActionResult<{
    mrfId: string;
    completed: boolean;
    vacancyId: string | null;
  }>
> {
  try {
    await requirePermission("employees", "process");
    const parsed = approveMrfSchema.parse(input);

    const result = await withTx(async (tx: Tx) => {
      const [current] = await tx
        .select()
        .from(mrfs)
        .where(eq(mrfs.id, parsed.mrfId))
        .limit(1);
      if (!current) throw new Error("MRF not found");
      if (current.status === "approved")
        throw new Error("MRF already approved");
      if (current.status === "cancelled" || current.status === "returned")
        throw new Error(`MRF in status "${current.status}" cannot be approved`);

      const [step] = await tx
        .select()
        .from(mrfApprovals)
        .where(
          and(
            eq(mrfApprovals.mrfId, parsed.mrfId),
            eq(mrfApprovals.sequenceOrder, parsed.sequenceOrder),
          ),
        )
        .limit(1);
      if (!step) throw new Error("Approval step not found");
      if (step.decision !== "pending")
        throw new Error("Approval step already decided");

      // Enforce sequential order
      if (parsed.sequenceOrder > 1) {
        const prior = await tx
          .select()
          .from(mrfApprovals)
          .where(
            and(
              eq(mrfApprovals.mrfId, parsed.mrfId),
              sql`${mrfApprovals.sequenceOrder} < ${parsed.sequenceOrder}`,
            ),
          );
        const allPriorApproved = prior.every((r) => r.decision === "approved");
        if (!allPriorApproved)
          throw new Error("Prior approval steps not yet approved");
      }

      await tx
        .update(mrfApprovals)
        .set({
          decision: parsed.decision,
          approverEmployeeId: parsed.approverEmployeeId,
          comments: parsed.comments ?? null,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(mrfApprovals.id, step.id));

      // Set MRF to pending_approval on first approve step if still submitted
      if (
        current.status === "submitted" &&
        parsed.decision === "approved" &&
        parsed.sequenceOrder < APPROVAL_ROLES.length
      ) {
        await tx
          .update(mrfs)
          .set({ status: "pending_approval", updatedAt: new Date() })
          .where(eq(mrfs.id, parsed.mrfId));
      }

      // If this step returned, short-circuit
      if (parsed.decision === "returned") {
        await tx
          .update(mrfs)
          .set({
            status: "returned",
            returnedReason: parsed.comments ?? null,
            updatedAt: new Date(),
          })
          .where(eq(mrfs.id, parsed.mrfId));
        return {
          mrfId: parsed.mrfId,
          completed: false,
          vacancyId: null as string | null,
        };
      }

      // Last step approved → mark MRF approved and create vacancy draft
      if (parsed.sequenceOrder === APPROVAL_ROLES.length) {
        await tx
          .update(mrfs)
          .set({
            status: "approved",
            approvedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(mrfs.id, parsed.mrfId));

        const cscAlloc = await nextCscForm9Number(tx);
        const defaultQs: QualificationStandards = {
          education: "TBD",
          eligibility: "TBD",
          experience: 0,
          training: "TBD",
        };
        // 30 days from now as placeholder deadline
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 30);

        const [newVacancy] = await tx
          .insert(vacancies)
          .values({
            mrfId: parsed.mrfId,
            positionId: current.positionId,
            officeId: current.officeId,
            itemNumber: current.itemNumber,
            cscForm9Number: cscAlloc.formatted,
            qualificationStandards: defaultQs,
            applicationDeadline: deadline,
            status: "draft",
            pipelineStage: "mrf_pending",
          })
          .returning({ id: vacancies.id });

        return {
          mrfId: parsed.mrfId,
          completed: true,
          vacancyId: newVacancy?.id ?? null,
        };
      }

      return {
        mrfId: parsed.mrfId,
        completed: false,
        vacancyId: null as string | null,
      };
    });

    revalidatePath(`/recruitment/mrf/${result.mrfId}`);
    return ok(result);
  } catch (err: unknown) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// returnMrf
// ---------------------------------------------------------------------------

export async function returnMrf(
  input: z.infer<typeof returnMrfSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("employees", "process");
    const parsed = returnMrfSchema.parse(input);

    await withTx(async (tx: Tx) => {
      const [current] = await tx
        .select()
        .from(mrfs)
        .where(eq(mrfs.id, parsed.mrfId))
        .limit(1);
      if (!current) throw new Error("MRF not found");
      if (current.status === "approved")
        throw new Error("Cannot return an already-approved MRF");

      await tx
        .update(mrfs)
        .set({
          status: "returned",
          returnedReason: parsed.reason,
          updatedAt: new Date(),
        })
        .where(eq(mrfs.id, parsed.mrfId));

      // Clear still-pending approvals so resubmission re-seeds them
      await tx
        .delete(mrfApprovals)
        .where(
          and(
            eq(mrfApprovals.mrfId, parsed.mrfId),
            eq(mrfApprovals.decision, "pending"),
          ),
        );
    });

    revalidatePath(`/recruitment/mrf/${parsed.mrfId}`);
    return ok({ id: parsed.mrfId });
  } catch (err: unknown) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// publishVacancy — generates CSC Form 9 PDF, uploads, flips to published
// ---------------------------------------------------------------------------

export async function publishVacancy(
  input: z.infer<typeof publishVacancyInputSchema>,
): Promise<ActionResult<{ id: string; pdfPath: string }>> {
  try {
    await requirePermission("employees", "process");
    const parsed = publishVacancyInputSchema.parse(input);

    // Load vacancy + related rows BEFORE the tx (we'll still write inside tx).
    const [vacancy] = await db
      .select()
      .from(vacancies)
      .where(eq(vacancies.id, parsed.vacancyId))
      .limit(1);
    if (!vacancy) return { error: "Vacancy not found" };
    if (vacancy.status === "published")
      return { error: "Vacancy already published" };

    // mrfId may be null for imported vacancies.
    const mrf: Mrf | null = vacancy.mrfId
      ? ((
          await db
            .select()
            .from(mrfs)
            .where(eq(mrfs.id, vacancy.mrfId))
            .limit(1)
        )[0] ?? null)
      : null;

    // Load the real plantilla position, office, and agency profile so the
    // published CSC Form 9 carries actual data (RPM-002) instead of the
    // "Position" / SG 0 / ₱0 / "PCSO" placeholders it used before.
    const [position] = vacancy.positionId
      ? await db
          .select({
            positionTitle: plantillaPositions.positionTitle,
            salaryGrade: plantillaPositions.salaryGrade,
            authorizedSalary: plantillaPositions.authorizedSalary,
            itemNo: plantillaPositions.itemNo,
          })
          .from(plantillaPositions)
          .where(eq(plantillaPositions.id, vacancy.positionId))
          .limit(1)
      : [undefined];
    const [office] = vacancy.officeId
      ? await db
          .select({ name: offices.name, code: offices.code })
          .from(offices)
          .where(eq(offices.id, vacancy.officeId))
          .limit(1)
      : [undefined];
    const org = await getOrgProfile();

    const resolvedTitle = position?.positionTitle ?? "Position";
    const resolvedSalaryGrade = position?.salaryGrade ?? 0;
    const resolvedMonthlySalary = position?.authorizedSalary
      ? Number(position.authorizedSalary)
      : 0;
    const resolvedItemNumber = vacancy.itemNumber ?? position?.itemNo ?? "";

    // Build PDF data — qualification standards override beats stored
    const qsStored = vacancy.qualificationStandards as QualificationStandards;
    const vacancyInput: VacancyInput = {
      id: vacancy.id,
      itemNumber: resolvedItemNumber,
      positionTitle: resolvedTitle,
      salaryGrade: resolvedSalaryGrade,
      monthlySalary: resolvedMonthlySalary,
      placeOfAssignment: office?.name ?? null,
      applicationDeadline: parsed.applicationDeadline,
      publishedAt: new Date(),
      cscForm9Number: vacancy.cscForm9Number,
      qualificationStandards: {
        education: qsStored?.education ?? "",
        training: qsStored?.training ?? "",
        experience: String(qsStored?.experience ?? ""),
        eligibility: qsStored?.eligibility ?? "",
      },
    };
    const mrfInput: MrfDataInput = {
      id: mrf?.id ?? "",
      mrfNumber: mrf?.mrfNumber ?? null,
      justification: mrf?.justification ?? null,
    };
    const positionInput: PositionInput = {
      title: resolvedTitle,
      itemNumber: resolvedItemNumber,
      salaryGrade: resolvedSalaryGrade,
    };
    const officeInput: OfficeInput = {
      name: office?.name ?? "PCSO",
      code: office?.code ?? "PCSO",
    };
    const orgProfile: OrgProfileInput | null = {
      agencyName: org.agencyName,
      agencyAddress: org.agencyAddress,
      agencyLogoUrl: org.logoUrl ?? null,
    };

    const pdfData = buildCscForm9Data({
      vacancy: vacancyInput,
      mrf: mrfInput,
      position: positionInput,
      office: officeInput,
      orgProfile,
      qualificationStandardsOverride: parsed.qualificationStandards
        ? {
            education: parsed.qualificationStandards.education,
            training: parsed.qualificationStandards.training,
            experience: String(parsed.qualificationStandards.experience),
            eligibility: parsed.qualificationStandards.eligibility,
          }
        : null,
    });

    // Generate PDF bytes
    const pdfBuffer = await renderToBuffer(CscForm9({ data: pdfData }));

    // Ensure bucket exists (creates it if missing)
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === RPM_DOCS_BUCKET);
    if (!bucketExists) {
      const { error: bucketErr } = await supabaseAdmin.storage.createBucket(
        RPM_DOCS_BUCKET,
        { public: false },
      );
      if (bucketErr && !bucketErr.message.includes("already exists")) {
        return { error: `Storage bucket error: ${bucketErr.message}` };
      }
    }

    // Upload to Supabase storage
    const pdfPath = `csc-form-9/${parsed.vacancyId}.pdf`;
    const { error: uploadErr } = await supabaseAdmin.storage
      .from(RPM_DOCS_BUCKET)
      .upload(pdfPath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadErr) {
      return { error: `Storage upload failed: ${uploadErr.message}` };
    }

    // Flip the vacancy row
    await withTx(async (tx: Tx) => {
      const nextQs = parsed.qualificationStandards ?? qsStored;
      await tx
        .update(vacancies)
        .set({
          status: "published",
          pipelineStage: "published",
          publishedAt: new Date(),
          applicationDeadline: new Date(parsed.applicationDeadline),
          qualificationStandards: nextQs,
          updatedAt: new Date(),
        })
        .where(eq(vacancies.id, parsed.vacancyId));
    });

    revalidatePath(`/recruitment/vacancies`);
    revalidatePath(`/recruitment/vacancies/${parsed.vacancyId}`);
    return ok({ id: parsed.vacancyId, pdfPath });
  } catch (err: unknown) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// uploadCscReceipt — stores the CSC confirmation URL on the vacancy
// ---------------------------------------------------------------------------

export async function uploadCscReceipt(
  input: z.infer<typeof uploadCscReceiptSchema>,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("employees", "edit");
    const parsed = uploadCscReceiptSchema.parse(input);

    const [row] = await db
      .update(vacancies)
      .set({
        receivedConfirmationUrl: parsed.fileUrl,
        updatedAt: new Date(),
      })
      .where(eq(vacancies.id, parsed.vacancyId))
      .returning({ id: vacancies.id });
    if (!row) return { error: "Vacancy not found" };

    revalidatePath(`/recruitment/vacancies/${parsed.vacancyId}`);
    return ok({ id: row.id });
  } catch (err: unknown) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// detectDuplicateItemNumber — returns count of active published vacancies
// ---------------------------------------------------------------------------

export async function detectDuplicateItemNumber(
  itemNumber: string,
): Promise<ActionResult<{ count: number }>> {
  try {
    await requirePermission("employees", "view");
    const trimmed = z.string().trim().min(1).max(20).parse(itemNumber);

    const rows = await db
      .select({ id: vacancies.id })
      .from(vacancies)
      .where(
        and(
          eq(vacancies.itemNumber, trimmed),
          eq(vacancies.status, "published"),
          isNull(vacancies.deletedAt),
        ),
      );

    return ok({ count: rows.length });
  } catch (err: unknown) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Read actions
// ---------------------------------------------------------------------------

export async function listMrfs(): Promise<ActionResult<Mrf[]>> {
  try {
    await requirePermission("employees", "view");
    const rows = await db
      .select()
      .from(mrfs)
      .where(isNull(mrfs.deletedAt))
      .orderBy(mrfs.createdAt);
    return ok(rows);
  } catch (err: unknown) {
    return fail(err);
  }
}

export async function getMrf(id: string): Promise<
  ActionResult<{
    mrf: Mrf & { officeName: string | null; positionTitle: string | null };
    approvals: MrfApproval[];
    vacancyId: string | null;
  }>
> {
  try {
    await requirePermission("employees", "view");
    const parsed = z.string().uuid().parse(id);

    const [row] = await db
      .select({
        mrf: mrfs,
        officeName: offices.name,
        positionTitle: plantillaPositions.positionTitle,
      })
      .from(mrfs)
      .leftJoin(offices, eq(mrfs.officeId, offices.id))
      .leftJoin(plantillaPositions, eq(mrfs.positionId, plantillaPositions.id))
      .where(eq(mrfs.id, parsed))
      .limit(1);
    if (!row) return { error: "MRF not found" };

    const [approvals, vacancyRows] = await Promise.all([
      db
        .select()
        .from(mrfApprovals)
        .where(eq(mrfApprovals.mrfId, parsed))
        .orderBy(mrfApprovals.sequenceOrder),
      db
        .select({ id: vacancies.id })
        .from(vacancies)
        .where(and(eq(vacancies.mrfId, parsed), isNull(vacancies.deletedAt)))
        .limit(1),
    ]);

    return ok({
      mrf: {
        ...row.mrf,
        officeName: row.officeName ?? null,
        positionTitle: row.positionTitle ?? null,
      },
      approvals,
      vacancyId: vacancyRows[0]?.id ?? null,
    });
  } catch (err: unknown) {
    return fail(err);
  }
}

/** Publish the vacancy linked to an MRF using a 30-day default deadline. */
export async function publishVacancyForMrf(
  vacancyId: string,
): Promise<ActionResult<{ id: string }>> {
  try {
    await requirePermission("employees", "process");
    const parsed = z.string().uuid().parse(vacancyId);
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    const result = await publishVacancy({
      vacancyId: parsed,
      applicationDeadline: deadline.toISOString(),
    });
    if ("error" in result) return result;
    return ok({ id: result.data.id });
  } catch (err: unknown) {
    return fail(err);
  }
}

export async function listActiveVacancies(): Promise<ActionResult<Vacancy[]>> {
  try {
    await requirePermission("employees", "view");
    const rows = await db
      .select()
      .from(vacancies)
      .where(
        and(eq(vacancies.status, "published"), isNull(vacancies.deletedAt)),
      )
      .orderBy(vacancies.applicationDeadline);
    return ok(rows);
  } catch (err: unknown) {
    return fail(err);
  }
}

// ---------------------------------------------------------------------------
// Debug-only export (prevents unused-import warnings from `toIsoString`
// when TS-strict is on, and exposes a stable formatting helper to callers).
// ---------------------------------------------------------------------------

export async function formatTimestamp(
  value: Date | string | null,
): Promise<string> {
  await requireAuth();
  return toIsoString(value);
}
