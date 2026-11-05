/**
 * Salary adjustment validation & target resolution — TOR 1.8.11–1.8.13 /
 * 1.3.10 (PAY-011 / PIM-015).
 *
 * Pure helpers shared by the salary-adjustment server actions, the HR-facing
 * form, and unit tests: zod schemas for the workflow inputs, the adjustment
 * type catalog, and the deterministic old→new snapshot resolver. No database
 * or server-only imports — fully testable without env.
 */

import { z } from "zod";
import { parseMoney } from "./rounding";
import type { SalaryGradeRow } from "./run-support";

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

/**
 * Adjustment natures accepted by the workflow. Mirrors
 * SALARY_ADJUSTMENT_TYPES in src/lib/db/schema/salary-adjustments.ts (the
 * column is varchar(30), so this list is the single UI/action-facing gate).
 */
export const SALARY_ADJUSTMENT_TYPE_VALUES = [
  "promotion",
  "salary_increase",
  "step_increment",
  "cpcs_migration",
  "correction",
] as const;

export type SalaryAdjustmentTypeValue =
  (typeof SALARY_ADJUSTMENT_TYPE_VALUES)[number];

export const SALARY_ADJUSTMENT_TYPE_LABELS: Record<
  SalaryAdjustmentTypeValue,
  string
> = {
  promotion: "Promotion",
  salary_increase: "Salary Increase",
  step_increment: "Step Increment",
  cpcs_migration: "CPCS Migration",
  correction: "Correction",
};

/**
 * Appointment types whose pay is grade/step based and therefore adjustable
 * through this workflow. ALLOWLIST (fail-safe): JO/COS/consultant/
 * confidential-agent personnel are paid on contract rates, never via NOSA.
 * Mirrors the step-increment organic allowlist (performance/queries.ts).
 */
export const SALARY_ADJUSTABLE_APPOINTMENT_TYPES = [
  "permanent",
  "temporary",
  "coterminous",
  "casual",
] as const;

export function isSalaryAdjustableAppointmentType(
  appointmentType: string,
): boolean {
  return (SALARY_ADJUSTABLE_APPOINTMENT_TYPES as readonly string[]).includes(
    appointmentType,
  );
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Sanity ceiling shared with payroll bulk inputs (10M). */
export const MAX_ADJUSTMENT_SALARY = 10_000_000;

/** Coerce "" (unset UI field) to undefined before optional validation. */
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const CreateSalaryAdjustmentSchema = z
  .object({
    employeeId: z.string().uuid("Select an employee"),
    adjustmentType: z.enum(SALARY_ADJUSTMENT_TYPE_VALUES, {
      message: "Select the nature of the adjustment",
    }),
    effectiveDate: z
      .string()
      .regex(ISO_DATE_RE, "Effectivity date must be a date (YYYY-MM-DD)"),
    /** New salary grade (1–33). Must be provided together with newStep. */
    newGrade: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number()
        .int("Salary grade must be a whole number")
        .min(1, "Salary grade must be 1–33")
        .max(33, "Salary grade must be 1–33")
        .optional(),
    ),
    /** New step (1–8). Must be provided together with newGrade. */
    newStep: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number()
        .int("Step must be a whole number")
        .min(1, "Step must be 1–8")
        .max(8, "Step must be 1–8")
        .optional(),
    ),
    /**
     * Explicit new monthly salary. Optional when grade/step are given (the
     * authorized amount is resolved from the salary schedule); acts as a
     * manual override when provided alongside them.
     */
    newSalary: z.preprocess(
      emptyToUndefined,
      z.coerce
        .number()
        .positive("New salary must be greater than zero")
        .max(
          MAX_ADJUSTMENT_SALARY,
          `New salary exceeds the ${MAX_ADJUSTMENT_SALARY.toLocaleString("en-PH")} sanity limit`,
        )
        .optional(),
    ),
    reason: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .max(1000, "Reason must be 1,000 characters or fewer")
        .optional(),
    ),
  })
  .superRefine((d, ctx) => {
    const hasGrade = d.newGrade !== undefined;
    const hasStep = d.newStep !== undefined;
    if (hasGrade !== hasStep) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "New grade and new step must be provided together",
        path: [hasGrade ? "newStep" : "newGrade"],
      });
    }
    if (!hasGrade && !hasStep && d.newSalary === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provide a new grade + step, or an explicit new monthly salary",
        path: ["newSalary"],
      });
    }
  });

export type CreateSalaryAdjustmentInput = z.input<
  typeof CreateSalaryAdjustmentSchema
>;
export type CreateSalaryAdjustmentParsed = z.output<
  typeof CreateSalaryAdjustmentSchema
>;

export const ApproveSalaryAdjustmentSchema = z.object({
  adjustmentId: z.string().uuid("Invalid adjustment ID"),
});

export const DisapproveSalaryAdjustmentSchema = z.object({
  adjustmentId: z.string().uuid("Invalid adjustment ID"),
  reason: z
    .string()
    .trim()
    .min(5, "A disapproval reason (at least 5 characters) is required")
    .max(500, "Reason must be 500 characters or fewer"),
});

export const ListSalaryAdjustmentsSchema = z.object({
  status: z
    .preprocess(
      emptyToUndefined,
      z
        .enum(["draft", "pending", "approved", "disapproved", "effected"])
        .optional(),
    )
    .optional(),
  employeeId: z
    .preprocess(emptyToUndefined, z.string().uuid().optional())
    .optional(),
});

export type ListSalaryAdjustmentsInput = z.input<
  typeof ListSalaryAdjustmentsSchema
>;

// ---------------------------------------------------------------------------
// Target resolution (pure)
// ---------------------------------------------------------------------------

export interface AdjustmentCurrentState {
  salaryGrade: number;
  step: number;
}

export interface ResolvedAdjustmentTarget {
  newGrade: number | null;
  newStep: number | null;
  /** Final monthly amount recorded on the adjustment + NOSA face. */
  newSalary: number;
}

/**
 * Resolve the proposed (grade, step, salary) target of an adjustment.
 *
 * Rules:
 *  - grade/step given → authorized salary resolved via `resolveSalary`
 *    (salary_grades reference table with SSL fallback, injected by the
 *    caller); an explicit `newSalary` overrides the resolved amount (manual
 *    override, e.g. CPCS rates not in the SSL table).
 *  - amount-only → grade/step unchanged on the 201 (recorded as null here);
 *    the amount is the NOSA face value.
 *  - A grade/step target identical to the current state with no salary
 *    override is rejected — the adjustment would be a no-op.
 *
 * @throws {Error} On a no-op target or when the salary cannot be resolved.
 */
export function resolveAdjustmentTarget(
  input: Pick<
    CreateSalaryAdjustmentParsed,
    "newGrade" | "newStep" | "newSalary"
  >,
  current: AdjustmentCurrentState,
  resolveSalary: (grade: number, step: number) => number | undefined,
): ResolvedAdjustmentTarget {
  const { newGrade, newStep, newSalary } = input;

  if (newGrade !== undefined && newStep !== undefined) {
    if (
      newGrade === current.salaryGrade &&
      newStep === current.step &&
      newSalary === undefined
    ) {
      throw new Error(
        `Employee is already at SG ${newGrade}, Step ${newStep} — nothing to adjust.`,
      );
    }
    const resolved = newSalary ?? resolveSalary(newGrade, newStep);
    if (resolved === undefined || !(resolved > 0)) {
      throw new Error(
        `No authorized salary found for SG ${newGrade}, Step ${newStep} — ` +
          "encode the rate in the salary schedule or provide an explicit new salary.",
      );
    }
    return { newGrade, newStep, newSalary: resolved };
  }

  // Amount-only adjustment (grade/step unchanged).
  if (newSalary === undefined) {
    throw new Error(
      "Provide a new grade + step, or an explicit new monthly salary.",
    );
  }
  return { newGrade: null, newStep: null, newSalary };
}

// ---------------------------------------------------------------------------
// Effectivity (pure) — H-17
// ---------------------------------------------------------------------------

/** Today's date in Philippine time, YYYY-MM-DD. */
export function manilaToday(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

/**
 * An approved adjustment takes effect on the 201/payroll only once its
 * effectivity date has arrived; future-dated ones stay `approved` until then.
 */
export function isAdjustmentDue(effectiveDate: string, today: string): boolean {
  return effectiveDate <= today;
}

/** Fields of an effected salary_adjustments row needed by payroll. */
export interface EffectedAdjustmentRow {
  effectiveDate: string;
  newSalary: string;
  oldGrade: number | null;
  oldStep: number | null;
  newGrade: number | null;
  newStep: number | null;
}

/**
 * Monthly salary set by the employee's latest effected adjustment as of
 * `asOf`, or undefined when the salary schedule should be used instead.
 *
 * The adjustment amount applies only while it is still the most recent
 * pricing decision for the employee's current grade/step:
 *  - its resulting grade/step (new, else old for amount-only) must equal the
 *    current grade/step (a later NOSI/promotion supersedes it), and
 *  - no salary_grades row for that grade/step took effect after it (a newer
 *    tranche supersedes it).
 * This is what makes amount-only and manual-amount adjustments reach payroll.
 *
 * @param adjustments Effected rows for ONE employee, oldest approval first.
 */
export function resolveAdjustedSalary(
  adjustments: readonly EffectedAdjustmentRow[],
  salaryRows: readonly SalaryGradeRow[],
  grade: number,
  step: number,
  asOf: string,
): number | undefined {
  let latest: EffectedAdjustmentRow | undefined;
  for (const row of adjustments) {
    if (row.effectiveDate > asOf) continue;
    if (!latest || row.effectiveDate >= latest.effectiveDate) latest = row;
  }
  if (!latest) return undefined;

  const resultingGrade = latest.newGrade ?? latest.oldGrade;
  const resultingStep = latest.newStep ?? latest.oldStep;
  if (resultingGrade !== grade || resultingStep !== step) return undefined;

  const newerSchedule = salaryRows.some(
    (r) =>
      r.grade === grade &&
      r.step === step &&
      r.effectiveDate > latest.effectiveDate &&
      r.effectiveDate <= asOf,
  );
  if (newerSchedule) return undefined;

  const amount = parseMoney(latest.newSalary);
  return amount > 0 ? amount : undefined;
}

// ---------------------------------------------------------------------------
// Display helpers (pure)
// ---------------------------------------------------------------------------

/** "SG 15, Step 2" / "SG 15" / "Step 2" / null when neither present. */
export function formatGradeStep(
  grade: number | null | undefined,
  step: number | null | undefined,
): string | null {
  const parts: string[] = [];
  if (grade != null) parts.push(`SG ${grade}`);
  if (step != null) parts.push(`Step ${step}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

// ---------------------------------------------------------------------------
// Maker-checker (segregation of duties — COA; PAY-011)
// ---------------------------------------------------------------------------

export interface SalaryAdjustmentActor {
  /** auth user id */
  id: string;
  employeeId: string | null;
}

/**
 * Why `actor` may not create (no `requestedBy`) or approve (with
 * `requestedBy`) an adjustment for `employeeId`; null when allowed. Nobody
 * adjusts their own pay, and the approver must differ from the requester.
 */
export function salaryAdjustmentSegregationError(
  actor: SalaryAdjustmentActor,
  adjustment: { employeeId: string; requestedBy?: string | null },
): string | null {
  if (actor.employeeId && adjustment.employeeId === actor.employeeId) {
    return "You cannot create or approve a salary adjustment for your own employee record.";
  }
  if (adjustment.requestedBy && adjustment.requestedBy === actor.id) {
    return "You requested this salary adjustment, so another authorized officer must approve it.";
  }
  return null;
}
