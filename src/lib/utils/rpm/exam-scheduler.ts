/**
 * Exam scheduling helpers for RPM (CLAUDE.md §4.2.3 RPM-015).
 *
 * Policy: an exam must be scheduled on a PH business day at least 7 calendar
 * days in the future. Saturday/Sunday and known holidays are disallowed.
 *
 * Pure functions only — no DB reads. The `getQualifiedApplicantsQuery` helper
 * produces a Drizzle predicate object that callers combine with their own
 * `db.select(...).from(applications).where(...)` chain; it does not execute
 * anything on its own.
 */

import { and, eq, SQL } from "drizzle-orm";

export const MIN_EXAM_LEAD_DAYS = 7;

export type ExamWindowValidation =
  | { ok: true }
  | { ok: false; reason: "too_soon" | "weekend" | "invalid_date" };

/**
 * Validate that `examDate` is a legal scheduling target. Caller supplies
 * `now` so tests stay deterministic; production callers pass `new Date()`.
 */
export function validateExamWindow(
  examDate: Date,
  now: Date = new Date(),
): ExamWindowValidation {
  if (!(examDate instanceof Date) || Number.isNaN(examDate.getTime())) {
    return { ok: false, reason: "invalid_date" };
  }
  const diffMs = examDate.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < MIN_EXAM_LEAD_DAYS) {
    return { ok: false, reason: "too_soon" };
  }
  const day = examDate.getUTCDay();
  if (day === 0 || day === 6) {
    return { ok: false, reason: "weekend" };
  }
  return { ok: true };
}

/**
 * Build the Drizzle WHERE predicate that selects applications considered
 * QUALIFIED for the given vacancy (i.e. eligible to sit the exam).
 *
 * Agent 01 owns the `applications` schema. We import the table lazily via
 * a typed parameter so this helper can be unit-tested without the schema
 * present, and so the module still type-checks before Agent 01 lands.
 */
export interface ApplicationsTableLike {
  vacancyId: unknown;
  status: unknown;
}

export function getQualifiedApplicantsQuery<T extends ApplicationsTableLike>(
  table: T,
  vacancyId: string,
): SQL | undefined {
  return and(
    eq(table.vacancyId as never, vacancyId),
    eq(table.status as never, "qualified"),
  );
}
