"use server";

/**
 * Salary adjustment workflow — TOR 1.8.11/1.8.12/1.8.13 + 1.3.10
 * (PAY-011 / PIM-015).
 *
 * Actions: createSalaryAdjustment (snapshot + pending), approveSalaryAdjustment
 * (NOSA serial + PDF to storage, 201 grade/step update + status "effected" in
 * one transaction), disapproveSalaryAdjustment (reason required),
 * listSalaryAdjustments (status/employee filters).
 *
 * Conventions: zod at the boundary, requirePermission on every action, audit
 * log on every write (module "PM"), PDF→storage mirrors the COE generator
 * (documents bucket → public URL), signatory titles from the FM-022 chain.
 */

import { revalidatePath } from "next/cache";
import { createElement, type ReactElement } from "react";
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import { db } from "@/lib/db";
import {
  salaryAdjustments,
  employees,
  offices,
  salaryGrades,
} from "@/lib/db/schema";
import { and, desc, eq, isNull, lte } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { withTx, withRetry } from "@/lib/db/transaction";
import { lockKey } from "@/lib/concurrency";
import { notifyEmployee } from "@/lib/notifications";
import { createServerClient } from "@/lib/supabase/server";
import {
  generateSerialNumber,
  DOCUMENT_TYPES,
} from "@/lib/db/serial-sequence-helpers";
import { getPayrollSignatories } from "@/lib/utils/payroll/signatories";
import { getOrgProfile } from "@/lib/org-profile";
import { SalaryAdjustmentNoticePdf } from "@/components/pdf/salary-adjustment-notice";
import {
  resolveSalaryAsOf,
  type SalaryGradeRow,
} from "@/lib/utils/payroll/run-support";
import { getAuthorizedSalary } from "@/lib/utils/payroll/salary";
import { parseMoney, roundMoney } from "@/lib/utils/payroll/rounding";
import {
  CreateSalaryAdjustmentSchema,
  ApproveSalaryAdjustmentSchema,
  DisapproveSalaryAdjustmentSchema,
  ListSalaryAdjustmentsSchema,
  resolveAdjustmentTarget,
  isSalaryAdjustableAppointmentType,
  formatGradeStep,
  SALARY_ADJUSTMENT_TYPE_LABELS,
  type SalaryAdjustmentTypeValue,
  type ListSalaryAdjustmentsInput,
} from "@/lib/utils/payroll/salary-adjustment";

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * Resolve the authorized monthly salary for (grade, step) as of a date:
 * salary_grades reference rows first (rates are data, not code — Risk
 * Register), static SSL V table as fallback. Returns undefined when neither
 * source knows the pair.
 */
async function resolveAuthorizedSalary(
  grade: number,
  step: number,
  asOf: string,
): Promise<number | undefined> {
  const rows: SalaryGradeRow[] = await db
    .select({
      grade: salaryGrades.grade,
      step: salaryGrades.step,
      monthlySalary: salaryGrades.monthlySalary,
      effectiveDate: salaryGrades.effectiveDate,
    })
    .from(salaryGrades)
    .where(
      and(
        eq(salaryGrades.grade, grade),
        eq(salaryGrades.step, step),
        lte(salaryGrades.effectiveDate, asOf),
      ),
    );

  const fromTable = resolveSalaryAsOf(rows, grade, step, asOf);
  if (fromTable !== undefined && fromTable > 0) return fromTable;

  try {
    return getAuthorizedSalary(grade, step);
  } catch {
    return undefined;
  }
}

function employeeFullName(emp: {
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
}): string {
  return [
    emp.firstName,
    emp.middleName ? `${emp.middleName.charAt(0)}.` : "",
    emp.lastName,
    emp.suffix ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Resolve the acting user's display name for the NOSA signature block. */
async function resolveActorName(user: {
  employeeId: string | null;
  email: string;
}): Promise<string> {
  if (user.employeeId) {
    const [actor] = await db
      .select({
        firstName: employees.firstName,
        lastName: employees.lastName,
      })
      .from(employees)
      .where(eq(employees.id, user.employeeId))
      .limit(1);
    if (actor) return `${actor.firstName} ${actor.lastName}`;
  }
  return "Human Resource Department";
}

// ─── Action: createSalaryAdjustment (TOR 1.8.11) ────────────────────────────

export interface CreateSalaryAdjustmentResult {
  adjustmentId: string;
  oldSalary: number | null;
  newSalary: number;
}

/**
 * Stage a salary adjustment for approval: snapshots the employee's current
 * grade/step/authorized salary, resolves the proposed target, and inserts a
 * `pending` salary_adjustments row. No 201 change happens here — the update
 * is approval-gated (PAY-011).
 */
export async function createSalaryAdjustment(
  input: unknown,
): Promise<CreateSalaryAdjustmentResult> {
  const parsed = CreateSalaryAdjustmentSchema.parse(input);
  const user = await requirePermission("payroll", "edit");

  const [employee] = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      lastName: employees.lastName,
      salaryGrade: employees.salaryGrade,
      step: employees.step,
      appointmentType: employees.appointmentType,
      status: employees.status,
    })
    .from(employees)
    .where(
      and(eq(employees.id, parsed.employeeId), isNull(employees.deletedAt)),
    )
    .limit(1);

  if (!employee) throw new Error("Employee not found.");
  if (employee.status !== "active") {
    throw new Error(
      `Salary adjustments can only be created for active employees (current status: ${employee.status}).`,
    );
  }
  if (!isSalaryAdjustableAppointmentType(employee.appointmentType)) {
    throw new Error(
      "JO/COS, consultant, and confidential-agent personnel are paid on contract rates — " +
        "their pay is not adjusted through the NOSA workflow.",
    );
  }

  // One in-flight adjustment per employee: a second pending row would make
  // the old-state snapshot ambiguous.
  const [existing] = await db
    .select({ id: salaryAdjustments.id })
    .from(salaryAdjustments)
    .where(
      and(
        eq(salaryAdjustments.employeeId, parsed.employeeId),
        eq(salaryAdjustments.status, "pending"),
        isNull(salaryAdjustments.deletedAt),
      ),
    )
    .limit(1);
  if (existing) {
    throw new Error(
      "This employee already has a pending salary adjustment. Approve or disapprove it first.",
    );
  }

  // Snapshot old state (TOR 1.8.11: preserve pre-adjustment basis for audit).
  const oldSalary =
    (await resolveAuthorizedSalary(
      employee.salaryGrade,
      employee.step,
      parsed.effectiveDate,
    )) ?? null;

  // Pre-resolve the authorized amount for grade/step targets (the resolver
  // injected into the pure helper cannot be async).
  let preResolvedSalary: number | undefined;
  if (
    parsed.newGrade !== undefined &&
    parsed.newStep !== undefined &&
    parsed.newSalary === undefined
  ) {
    preResolvedSalary = await resolveAuthorizedSalary(
      parsed.newGrade,
      parsed.newStep,
      parsed.effectiveDate,
    );
  }

  const target = resolveAdjustmentTarget(
    parsed,
    { salaryGrade: employee.salaryGrade, step: employee.step },
    () => preResolvedSalary,
  );
  const newSalary = target.newSalary;

  const [inserted] = await db
    .insert(salaryAdjustments)
    .values({
      employeeId: parsed.employeeId,
      oldSalary: oldSalary !== null ? roundMoney(oldSalary) : null,
      oldGrade: employee.salaryGrade,
      oldStep: employee.step,
      newSalary: roundMoney(newSalary),
      newGrade: target.newGrade,
      newStep: target.newStep,
      adjustmentType: parsed.adjustmentType,
      reason: parsed.reason ?? null,
      status: "pending",
      requestedBy: user.id,
      effectiveDate: parsed.effectiveDate,
    })
    .returning({ id: salaryAdjustments.id });

  if (!inserted) throw new Error("Failed to create the salary adjustment.");

  void auditLog({
    userId: user.id,
    action: "create",
    table: "salary_adjustments",
    recordId: inserted.id,
    newValues: {
      employeeId: parsed.employeeId,
      employeeNo: employee.employeeNo,
      adjustmentType: parsed.adjustmentType,
      oldGrade: employee.salaryGrade,
      oldStep: employee.step,
      oldSalary,
      newGrade: target.newGrade,
      newStep: target.newStep,
      newSalary,
      effectiveDate: parsed.effectiveDate,
      status: "pending",
    },
    module: "PM",
    subModule: "salary_adjustment",
  });

  revalidatePath("/payroll/salary-adjustments");

  return { adjustmentId: inserted.id, oldSalary, newSalary };
}

// ─── Action: approveSalaryAdjustment (TOR 1.8.12 + 1.3.10) ──────────────────

export interface ApproveSalaryAdjustmentResult {
  adjustmentId: string;
  nosaSerial: string;
  nosaDocumentUrl: string;
}

/**
 * Approve a pending adjustment: issues the NOSA (serial NOSA-YYYY-NNNNNN +
 * PDF in the documents bucket), then in ONE transaction marks the adjustment
 * `effected` and updates the employee's 201 salary grade/step (PIM-015 auto
 * 201 update). The PDF is rendered BEFORE the transaction so a document
 * failure aborts the approval with zero state change.
 */
export async function approveSalaryAdjustment(
  input: unknown,
): Promise<ApproveSalaryAdjustmentResult> {
  const parsed = ApproveSalaryAdjustmentSchema.parse(input);
  const user = await requirePermission("payroll", "approve");

  // Load the adjustment + employee + office for the document face.
  const [row] = await db
    .select({
      adjustment: salaryAdjustments,
      employee: {
        id: employees.id,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        middleName: employees.middleName,
        lastName: employees.lastName,
        suffix: employees.suffix,
        positionTitle: employees.positionTitle,
        salaryGrade: employees.salaryGrade,
        step: employees.step,
      },
      officeName: offices.name,
    })
    .from(salaryAdjustments)
    .innerJoin(employees, eq(salaryAdjustments.employeeId, employees.id))
    .leftJoin(offices, eq(employees.officeId, offices.id))
    .where(
      and(
        eq(salaryAdjustments.id, parsed.adjustmentId),
        isNull(salaryAdjustments.deletedAt),
      ),
    )
    .limit(1);

  if (!row) throw new Error("Salary adjustment not found.");
  const adjustment = row.adjustment;
  if (adjustment.status !== "pending") {
    throw new Error(
      `Only pending adjustments can be approved (current status: ${adjustment.status}).`,
    );
  }

  // ── NOSA document (PIM-015) — rendered before any state change ───────────
  const [org, chain, issuedByName] = await Promise.all([
    getOrgProfile(),
    getPayrollSignatories("NOSA"),
    resolveActorName(user),
  ]);
  const issuedBlock =
    chain.find((b) => b.role === "approved_by") ?? chain[chain.length - 1];

  const nosaSerial = await generateSerialNumber(DOCUMENT_TYPES.NOSA);
  const issuedDate = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const adjustmentTypeLabel =
    SALARY_ADJUSTMENT_TYPE_LABELS[
      adjustment.adjustmentType as SalaryAdjustmentTypeValue
    ] ?? adjustment.adjustmentType;

  const element = createElement(SalaryAdjustmentNoticePdf, {
    noticeNumber: nosaSerial,
    agencyName: org.agencyName,
    employee: {
      fullName: employeeFullName(row.employee),
      employeeNo: row.employee.employeeNo,
      positionTitle: row.employee.positionTitle,
      officeName: row.officeName ?? "Unassigned",
    },
    adjustmentTypeLabel,
    oldSalary:
      adjustment.oldSalary !== null ? parseMoney(adjustment.oldSalary) : null,
    newSalary: parseMoney(adjustment.newSalary),
    oldGrade: adjustment.oldGrade,
    newGrade: adjustment.newGrade,
    oldStep: adjustment.oldStep,
    newStep: adjustment.newStep,
    effectiveDate: adjustment.effectiveDate,
    reason: adjustment.reason,
    issuedByName,
    issuedByTitle: issuedBlock?.title ?? "Approving Authority",
    issuedDate,
    // Root of SalaryAdjustmentNoticePdf is a react-pdf <Document>, so the
    // cast to the DocumentProps element type pdf() expects is sound.
  }) as unknown as ReactElement<DocumentProps>;

  const blob = await pdf(element).toBlob();

  const supabase = await createServerClient();
  const storagePath = `nosa/${nosaSerial}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, blob, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) {
    throw new Error(`Failed to store the NOSA PDF: ${uploadError.message}`);
  }
  const { data: urlData } = supabase.storage
    .from("documents")
    .getPublicUrl(storagePath);
  const nosaDocumentUrl = urlData.publicUrl;

  // ── Atomic state change: adjustment → effected + 201 grade/step update ───
  await withRetry(() =>
    withTx(async (tx) => {
      // Serialize double-approvals (two tabs / double click).
      await lockKey(tx, `salary_adjustment:${parsed.adjustmentId}`);

      const [fresh] = await tx
        .select({ status: salaryAdjustments.status })
        .from(salaryAdjustments)
        .where(eq(salaryAdjustments.id, parsed.adjustmentId))
        .limit(1);
      if (!fresh || fresh.status !== "pending") {
        throw new Error(
          `Adjustment is no longer pending (current status: ${fresh?.status ?? "missing"}).`,
        );
      }

      if (adjustment.newGrade !== null && adjustment.newStep !== null) {
        await tx
          .update(employees)
          .set({
            salaryGrade: adjustment.newGrade,
            step: adjustment.newStep,
            updatedAt: new Date(),
          })
          .where(eq(employees.id, adjustment.employeeId));
      }

      await tx
        .update(salaryAdjustments)
        .set({
          status: "effected",
          approvedBy: user.id,
          approvedAt: new Date(),
          nosaSerial,
          nosaDocumentUrl,
          updatedAt: new Date(),
        })
        .where(eq(salaryAdjustments.id, parsed.adjustmentId));
    }),
  );

  void auditLog({
    userId: user.id,
    action: "approve",
    table: "salary_adjustments",
    recordId: parsed.adjustmentId,
    oldValues: {
      status: "pending",
      salaryGrade: row.employee.salaryGrade,
      step: row.employee.step,
    },
    newValues: {
      status: "effected",
      nosaSerial,
      nosaDocumentUrl,
      newGrade: adjustment.newGrade,
      newStep: adjustment.newStep,
      newSalary: adjustment.newSalary,
      effectiveDate: adjustment.effectiveDate,
    },
    module: "PM",
    subModule: "salary_adjustment",
  });

  const gradeStepText = formatGradeStep(
    adjustment.newGrade,
    adjustment.newStep,
  );
  await notifyEmployee(adjustment.employeeId, {
    type: "generic",
    title: `Notice of Salary Adjustment issued (${nosaSerial})`,
    body:
      `Your monthly salary is adjusted to PHP ${parseMoney(adjustment.newSalary).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` +
      (gradeStepText ? ` (${gradeStepText})` : "") +
      ` effective ${adjustment.effectiveDate}. Your NOSA document is available for download.`,
    actionUrl: nosaDocumentUrl,
    entityType: "salary_adjustment",
    entityId: parsed.adjustmentId,
  });

  revalidatePath("/payroll/salary-adjustments");
  revalidatePath("/employees");

  return { adjustmentId: parsed.adjustmentId, nosaSerial, nosaDocumentUrl };
}

// ─── Action: disapproveSalaryAdjustment (TOR 1.8.12) ────────────────────────

export interface DisapproveSalaryAdjustmentResult {
  adjustmentId: string;
}

/** Reject a pending adjustment with a mandatory reason. No 201 change. */
export async function disapproveSalaryAdjustment(
  input: unknown,
): Promise<DisapproveSalaryAdjustmentResult> {
  const parsed = DisapproveSalaryAdjustmentSchema.parse(input);
  const user = await requirePermission("payroll", "approve");

  const updated = await withRetry(() =>
    withTx(async (tx) => {
      await lockKey(tx, `salary_adjustment:${parsed.adjustmentId}`);

      const [adjustment] = await tx
        .select()
        .from(salaryAdjustments)
        .where(
          and(
            eq(salaryAdjustments.id, parsed.adjustmentId),
            isNull(salaryAdjustments.deletedAt),
          ),
        )
        .limit(1);

      if (!adjustment) throw new Error("Salary adjustment not found.");
      if (adjustment.status !== "pending") {
        throw new Error(
          `Only pending adjustments can be disapproved (current status: ${adjustment.status}).`,
        );
      }

      await tx
        .update(salaryAdjustments)
        .set({
          status: "disapproved",
          approvedBy: user.id,
          approvedAt: new Date(),
          disapprovalReason: parsed.reason,
          updatedAt: new Date(),
        })
        .where(eq(salaryAdjustments.id, parsed.adjustmentId));

      return adjustment;
    }),
  );

  void auditLog({
    userId: user.id,
    action: "disapprove",
    table: "salary_adjustments",
    recordId: parsed.adjustmentId,
    oldValues: { status: "pending" },
    newValues: { status: "disapproved", disapprovalReason: parsed.reason },
    reason: parsed.reason,
    module: "PM",
    subModule: "salary_adjustment",
  });

  await notifyEmployee(updated.employeeId, {
    type: "generic",
    title: "Salary adjustment disapproved",
    body: `Your proposed salary adjustment was disapproved. Reason: ${parsed.reason}`,
    entityType: "salary_adjustment",
    entityId: parsed.adjustmentId,
  });

  revalidatePath("/payroll/salary-adjustments");

  return { adjustmentId: parsed.adjustmentId };
}

// ─── Action: listSalaryAdjustments (TOR 1.8.13) ─────────────────────────────

export interface SalaryAdjustmentListRow {
  id: string;
  employeeId: string;
  employeeNo: string;
  employeeName: string;
  officeName: string;
  positionTitle: string;
  adjustmentType: string;
  oldSalary: string | null;
  oldGrade: number | null;
  oldStep: number | null;
  newSalary: string;
  newGrade: number | null;
  newStep: number | null;
  status: string;
  effectiveDate: string;
  reason: string | null;
  disapprovalReason: string | null;
  nosaSerial: string | null;
  nosaDocumentUrl: string | null;
  createdAt: string;
}

const LIST_ROW_CAP = 200;

/** List adjustments (newest first) with optional status/employee filters. */
export async function listSalaryAdjustments(
  filters?: ListSalaryAdjustmentsInput,
): Promise<SalaryAdjustmentListRow[]> {
  const parsed = ListSalaryAdjustmentsSchema.parse(filters ?? {});
  await requirePermission("payroll", "view");

  const conditions = [isNull(salaryAdjustments.deletedAt)];
  if (parsed.status) {
    conditions.push(eq(salaryAdjustments.status, parsed.status));
  }
  if (parsed.employeeId) {
    conditions.push(eq(salaryAdjustments.employeeId, parsed.employeeId));
  }

  const rows = await db
    .select({
      adjustment: salaryAdjustments,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      middleName: employees.middleName,
      lastName: employees.lastName,
      positionTitle: employees.positionTitle,
      officeName: offices.name,
    })
    .from(salaryAdjustments)
    .innerJoin(employees, eq(salaryAdjustments.employeeId, employees.id))
    .leftJoin(offices, eq(employees.officeId, offices.id))
    .where(and(...conditions))
    .orderBy(desc(salaryAdjustments.createdAt))
    .limit(LIST_ROW_CAP);

  return rows.map((row) => {
    const mi = row.middleName ? ` ${row.middleName.charAt(0)}.` : "";
    return {
      id: row.adjustment.id,
      employeeId: row.adjustment.employeeId,
      employeeNo: row.employeeNo,
      employeeName: `${row.lastName}, ${row.firstName}${mi}`,
      officeName: row.officeName ?? "Unassigned",
      positionTitle: row.positionTitle,
      adjustmentType: row.adjustment.adjustmentType,
      oldSalary: row.adjustment.oldSalary,
      oldGrade: row.adjustment.oldGrade,
      oldStep: row.adjustment.oldStep,
      newSalary: row.adjustment.newSalary,
      newGrade: row.adjustment.newGrade,
      newStep: row.adjustment.newStep,
      status: row.adjustment.status,
      effectiveDate: row.adjustment.effectiveDate,
      reason: row.adjustment.reason,
      disapprovalReason: row.adjustment.disapprovalReason,
      nosaSerial: row.adjustment.nosaSerial,
      nosaDocumentUrl: row.adjustment.nosaDocumentUrl,
      createdAt:
        row.adjustment.createdAt instanceof Date
          ? row.adjustment.createdAt.toISOString()
          : String(row.adjustment.createdAt),
    };
  });
}
