/**
 * EWBM — Annual retirement notice generation core (EWB-003).
 *
 * Shared by:
 *  - the HR-triggered server action `generateAnnualNotices`
 *    (src/lib/actions/ewbm/retirement.ts), which wraps this with
 *    `requirePermission` + a user-attributed audit entry, and
 *  - the scheduled /api/cron/annual-retirement-notices endpoint, which runs
 *    it as a system actor on January 1 (PRD §13 N-031).
 *
 * Idempotent: the unique index (for_year, employee_id, retirement_type) on
 * retirement_notices makes re-runs for the same year safe.
 */

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema/employees";
import { retirementNotices } from "@/lib/db/schema/welfare";
import { notifyRoles } from "@/lib/notifications";
import { monthsUntilEligible } from "@/lib/utils/ewbm/retirement-calc";

export interface AnnualNoticesCoreResult {
  /** Number of retirement_notices rows newly inserted for the year. */
  generated: number;
}

/**
 * Scan active employees and insert a retirement notice for anyone reaching
 * optional (age 60 + 15 yrs service) or compulsory (age 65) eligibility
 * within 12 months of January 1 of `year`. Sends N-031 to HRD managers when
 * at least one notice was generated.
 */
export async function generateAnnualNoticesCore(
  year: number,
): Promise<AnnualNoticesCoreResult> {
  const asOf = new Date(Date.UTC(year, 0, 1));

  const empRows = await db
    .select({
      id: employees.id,
      dateHired: employees.dateHired,
      birthDate: employees.birthDate,
    })
    .from(employees)
    .where(eq(employees.status, "active"));

  interface PendingNotice {
    employeeId: string;
    retirementType: "optional" | "compulsory";
    eligibleDate: string;
    monthsUntilEligible: number;
  }

  const toInsert: PendingNotice[] = [];
  for (const e of empRows) {
    if (!e.dateHired || !e.birthDate) continue;
    const dob = new Date(e.birthDate);
    const hire = new Date(e.dateHired);
    if (Number.isNaN(dob.getTime()) || Number.isNaN(hire.getTime())) continue;

    const proj = monthsUntilEligible(dob, hire, asOf);
    if (proj.type === "none" || !proj.eligibleDate) continue;
    if (proj.months > 12) continue;

    toInsert.push({
      employeeId: e.id,
      retirementType: proj.type,
      eligibleDate: proj.eligibleDate.toISOString().slice(0, 10),
      monthsUntilEligible: proj.months,
    });
  }

  let generated = 0;
  if (toInsert.length > 0) {
    // Unique index (for_year, employee_id, retirement_type) makes this
    // idempotent — re-running the job for the same year is safe.
    const inserted = await db
      .insert(retirementNotices)
      .values(
        toInsert.map((n) => ({
          forYear: year,
          employeeId: n.employeeId,
          retirementType: n.retirementType,
          eligibleDate: n.eligibleDate,
          monthsUntilEligible: n.monthsUntilEligible,
        })),
      )
      .onConflictDoNothing({
        target: [
          retirementNotices.forYear,
          retirementNotices.employeeId,
          retirementNotices.retirementType,
        ],
      })
      .returning({ id: retirementNotices.id });
    generated = inserted.length;
  }

  if (generated > 0) {
    // N-031 — one aggregate notification to HRD managers.
    await notifyRoles(["hr_admin", "super_admin"], {
      type: "generic",
      title: `Annual retirement notices — ${year}`,
      body: `${generated} employee(s) reach retirement eligibility within 12 months.`,
      entityType: "retirement_notice_batch",
    });
  }

  return { generated };
}
