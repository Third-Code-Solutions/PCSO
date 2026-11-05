import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gte, inArray, isNull, lte, ne } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/lib/db";
import {
  attendanceLogs,
  employees,
  fmWorkSuspensions,
  holidays,
  leaveApplications,
  notifications,
  systemUsers,
} from "@/lib/db/schema";
import { createNotification, notifyRoles } from "@/lib/notifications";
import { env } from "@/lib/env";
import {
  NflNoticeEmail,
  nflNoticePlainText,
} from "@/lib/email/templates/nfl-notice";
import { HABITUAL_TARDINESS_THRESHOLD } from "@/lib/utils/attendance/tam-adhoc";
import {
  loadScheduleAssignments,
  pickFromMaps,
} from "@/lib/actions/attendance/schedule-context";
import {
  DEFAULT_APPLICABLE_DAYS,
  normalizeApplicableDays,
} from "@/lib/utils/attendance/schedule-resolution";
import { isRestDay } from "@/lib/utils/attendance/day-context";
import { checkCronAuth } from "../_lib/auth";
import { recordCronRun } from "../_lib/record-run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * TOR 1.5.11 + TOR 1.4.6 — Daily attendance notifications.
 *
 * Scheduled via vercel.json: "0 23 * * *" (23:00 UTC = 07:00 PH next day),
 * processing YESTERDAY in Philippine time:
 *
 *  (a) Tardiness — employees with lateMinutes > 0 get an in-app
 *      'attendance_anomaly' notification (N-009).
 *  (b) No Filed Leave (NFL) — working-day absences with no attendance log
 *      and no approved leave: employee gets an in-app notification + email,
 *      and payroll_admin receives an aggregate notice for LWOP salary
 *      deduction awareness (N-008 / TOR 1.4.6).
 *  (c) Habitual tardiness — month-to-date tardiness instances >= 10 (CSC):
 *      employee + hr_admin are flagged (N-010).
 *
 * Idempotent: every notification uses a deterministic title carrying the
 * date (or month) and is skipped when a notification with the same type +
 * title already exists for the recipient. Safe to re-run for the same day.
 *
 * Optional query param for manual/backfill runs: ?date=YYYY-MM-DD
 * (the PH calendar date to process; defaults to yesterday PH time).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NOTIFICATION_TYPE = "attendance_anomaly" as const;

/**
 * Mass-absence guard: when more than this fraction of active employees has
 * no log for the day, the biometric import most likely has not landed yet.
 * Per-employee NFL notifications/emails are suppressed (aggregate notices
 * still go out flagged accordingly) to avoid spamming the whole agency.
 */
const MASS_ABSENCE_GUARD_RATIO = 0.5;

/** Upper bound on NFL emails per run (Resend burst safety). */
const MAX_NFL_EMAILS_PER_RUN = 100;

/** Yesterday's date in Asia/Manila (UTC+8, no DST). */
function phYesterday(): string {
  return new Date(Date.now() + 8 * 3_600_000 - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  return new Resend(env.RESEND_API_KEY);
}

/** userIds already holding a notification with this exact type+title. */
async function alreadyNotifiedUserIds(title: string): Promise<Set<string>> {
  const rows = await db
    .select({ userId: notifications.userId })
    .from(notifications)
    .where(
      and(
        eq(notifications.type, NOTIFICATION_TYPE),
        eq(notifications.title, title),
      ),
    );
  return new Set(rows.map((r) => r.userId));
}

/** True when ANY notification with this exact type+title exists (any user). */
async function titleExists(title: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: notifications.userId })
    .from(notifications)
    .where(
      and(
        eq(notifications.type, NOTIFICATION_TYPE),
        eq(notifications.title, title),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export async function GET(request: NextRequest) {
  const unauthorized = checkCronAuth(request);
  if (unauthorized) return unauthorized;

  let targetDate = phYesterday();
  const dateParam = request.nextUrl.searchParams.get("date");
  if (dateParam !== null) {
    if (!DATE_RE.test(dateParam)) {
      return NextResponse.json(
        { error: "Invalid 'date' parameter (expected YYYY-MM-DD)." },
        { status: 400 },
      );
    }
    targetDate = dateParam;
  }

  const monthStart = `${targetDate.slice(0, 7)}-01`;
  const monthKey = targetDate.slice(0, 7);
  const startedAt = new Date();

  const counters = {
    tardinessNotified: 0,
    nflNotified: 0,
    nflEmailsSent: 0,
    habitualFlagged: 0,
    skippedExisting: 0,
    massAbsenceGuardTripped: false,
    nonWorkingDay: false,
  };

  try {
    // ── Base datasets ────────────────────────────────────────────────────
    const [employeeRows, userRows, holidayRows, suspensionRows, dayLogs] =
      await Promise.all([
        db
          .select({
            id: employees.id,
            employeeNo: employees.employeeNo,
            firstName: employees.firstName,
            lastName: employees.lastName,
            email: employees.email,
            dateHired: employees.dateHired,
            officeId: employees.officeId,
          })
          .from(employees)
          .where(
            and(eq(employees.status, "active"), isNull(employees.deletedAt)),
          ),
        db
          .select({ id: systemUsers.id, employeeId: systemUsers.employeeId })
          .from(systemUsers)
          .where(eq(systemUsers.isActive, true)),
        db
          .select({ date: holidays.holidayDate })
          .from(holidays)
          .where(
            and(
              eq(holidays.holidayDate, targetDate),
              ne(holidays.type, "special_working"),
            ),
          ),
        db
          .select({ date: fmWorkSuspensions.applicableDate })
          .from(fmWorkSuspensions)
          .where(
            and(
              eq(fmWorkSuspensions.applicableDate, targetDate),
              eq(fmWorkSuspensions.applicableHours, "full"),
              eq(fmWorkSuspensions.isActive, true),
              isNull(fmWorkSuspensions.deletedAt),
            ),
          ),
        db
          .select({
            employeeId: attendanceLogs.employeeId,
            timeIn: attendanceLogs.timeIn,
            timeOut: attendanceLogs.timeOut,
            timeInPm: attendanceLogs.timeInPm,
            timeOutPm: attendanceLogs.timeOutPm,
            lateMinutes: attendanceLogs.lateMinutes,
          })
          .from(attendanceLogs)
          .where(eq(attendanceLogs.logDate, targetDate)),
      ]);

    const userByEmployee = new Map<string, string>();
    for (const u of userRows) {
      if (u.employeeId) userByEmployee.set(u.employeeId, u.id);
    }
    const employeeById = new Map(employeeRows.map((e) => [e.id, e]));

    // Agency-wide closure only; rest days are per employee schedule (H-13).
    const isWorkingDay =
      holidayRows.length === 0 && suspensionRows.length === 0;
    counters.nonWorkingDay = !isWorkingDay;

    const appUrl = env.NEXT_PUBLIC_APP_URL;

    // ── (a) Tardiness notifications (N-009) ─────────────────────────────
    const tardyTitle = `Tardiness recorded — ${targetDate}`;
    const tardyLogs = dayLogs.filter((l) => (l.lateMinutes ?? 0) > 0);
    if (tardyLogs.length > 0) {
      const notified = await alreadyNotifiedUserIds(tardyTitle);
      for (const log of tardyLogs) {
        const emp = employeeById.get(log.employeeId);
        const userId = userByEmployee.get(log.employeeId);
        if (!emp || !userId) continue;
        if (notified.has(userId)) {
          counters.skippedExisting += 1;
          continue;
        }
        await createNotification({
          userId,
          type: NOTIFICATION_TYPE,
          title: tardyTitle,
          body: `You were recorded ${log.lateMinutes} minute${
            (log.lateMinutes ?? 0) === 1 ? "" : "s"
          } late on ${targetDate}. Repeated tardiness (10+ instances in a month) is flagged for HR review per CSC rules.`,
          actionUrl: "/attendance/dtr",
          entityType: "attendance_log",
        });
        counters.tardinessNotified += 1;
      }
    }

    // ── (b) NFL — absence without filed leave (N-008 / TOR 1.4.6) ────────
    if (isWorkingDay) {
      const presentIds = new Set(
        dayLogs
          .filter(
            (l) =>
              l.timeIn !== null ||
              l.timeOut !== null ||
              l.timeInPm !== null ||
              l.timeOutPm !== null,
          )
          .map((l) => l.employeeId),
      );

      // Rest days come from the employee -> office -> default schedule, so a
      // Saturday-duty schedule is checked on Saturday and skipped on off-days.
      const scheduleMaps = await loadScheduleAssignments(
        employeeRows.map((e) => e.id),
        Array.from(
          new Set(
            employeeRows
              .map((e) => e.officeId)
              .filter((v): v is string => v !== null),
          ),
        ),
        targetDate,
        targetDate,
      );
      const isScheduledToWork = (e: (typeof employeeRows)[number]) => {
        const assignment = pickFromMaps(
          scheduleMaps,
          e.id,
          e.officeId,
          targetDate,
        );
        const days = assignment
          ? normalizeApplicableDays(assignment.schedule.applicableDays)
          : [...DEFAULT_APPLICABLE_DAYS];
        return !isRestDay(targetDate, days);
      };

      const candidates = employeeRows.filter(
        (e) =>
          e.dateHired <= targetDate &&
          !presentIds.has(e.id) &&
          isScheduledToWork(e),
      );

      // Approved leave covering the date removes the NFL flag.
      const candidateIds = candidates.map((c) => c.id);
      const leaveRows =
        candidateIds.length > 0
          ? await db
              .select({ employeeId: leaveApplications.employeeId })
              .from(leaveApplications)
              .where(
                and(
                  inArray(leaveApplications.employeeId, candidateIds),
                  inArray(leaveApplications.status, [
                    "approved",
                    "cancellation_requested",
                    "consumed",
                    "consumed_auto",
                  ]),
                  lte(leaveApplications.dateFrom, targetDate),
                  gte(leaveApplications.dateTo, targetDate),
                ),
              )
          : [];
      const onLeaveIds = new Set(leaveRows.map((r) => r.employeeId));

      const nflEmployees = candidates.filter((c) => !onLeaveIds.has(c.id));

      const massAbsence =
        employeeRows.length > 0 &&
        nflEmployees.length / employeeRows.length > MASS_ABSENCE_GUARD_RATIO;
      counters.massAbsenceGuardTripped = massAbsence;

      if (nflEmployees.length > 0 && !massAbsence) {
        const nflTitle = `No Filed Leave (NFL) — ${targetDate}`;
        const notified = await alreadyNotifiedUserIds(nflTitle);
        const resend = getResend();
        const fromEmail = env.RESEND_FROM_EMAIL ?? "noreply@pcso.gov.ph";

        for (const emp of nflEmployees) {
          const userId = userByEmployee.get(emp.id);
          const fullName = `${emp.firstName} ${emp.lastName}`;

          if (userId && !notified.has(userId)) {
            await createNotification({
              userId,
              type: NOTIFICATION_TYPE,
              title: nflTitle,
              body: `No attendance log and no approved leave was found for ${targetDate}. This day is endorsed to Payroll as LWOP unless a leave application is filed and approved, or a DTR correction is submitted.`,
              actionUrl: "/leave/apply",
              entityType: "attendance_nfl",
            });
            counters.nflNotified += 1;

            // Email (best-effort, capped per run).
            if (
              resend &&
              emp.email &&
              counters.nflEmailsSent < MAX_NFL_EMAILS_PER_RUN
            ) {
              try {
                const { error } = await resend.emails.send({
                  from: fromEmail,
                  to: emp.email,
                  subject: `No Filed Leave — ${targetDate}`,
                  react: NflNoticeEmail({
                    employeeName: fullName,
                    employeeNo: emp.employeeNo,
                    absenceDate: targetDate,
                    appUrl,
                  }),
                  text: nflNoticePlainText({
                    employeeName: fullName,
                    employeeNo: emp.employeeNo,
                    absenceDate: targetDate,
                    appUrl,
                  }),
                });
                if (!error) counters.nflEmailsSent += 1;
              } catch (emailErr) {
                console.error(
                  "[cron/attendance-notifications] NFL email failed:",
                  emailErr,
                );
              }
            }
          } else if (userId) {
            counters.skippedExisting += 1;
          }
        }
      }

      // Aggregate payroll notice (TOR 1.4.6 — salary deduction awareness).
      if (nflEmployees.length > 0) {
        const payrollTitle = `NFL / LWOP endorsement — ${targetDate}`;
        if (!(await titleExists(payrollTitle))) {
          const preview = nflEmployees
            .slice(0, 5)
            .map((e) => `${e.lastName}, ${e.firstName} (${e.employeeNo})`)
            .join("; ");
          const suffix =
            nflEmployees.length > 5
              ? `; and ${nflEmployees.length - 5} more`
              : "";
          await notifyRoles(["payroll_admin"], {
            type: NOTIFICATION_TYPE,
            title: payrollTitle,
            body: massAbsence
              ? `${nflEmployees.length} of ${employeeRows.length} active employees have no attendance log for ${targetDate}. This volume suggests the biometric import has not been processed yet — verify the import before applying LWOP deductions.`
              : `${nflEmployees.length} employee(s) had a working-day absence with no filed leave on ${targetDate}: ${preview}${suffix}. These days are subject to LWOP salary deduction unless leave is filed and approved.`,
            actionUrl: "/attendance/reports/unauthorized-absences",
            entityType: "attendance_nfl",
          });
        }
      }
    }

    // ── (c) Habitual tardiness — month-to-date >= 10 instances (N-010) ───
    const monthLogs = await db
      .select({
        employeeId: attendanceLogs.employeeId,
        logDate: attendanceLogs.logDate,
      })
      .from(attendanceLogs)
      .where(
        and(
          gte(attendanceLogs.logDate, monthStart),
          lte(attendanceLogs.logDate, targetDate),
          gte(attendanceLogs.lateMinutes, 1),
        ),
      );

    const tardyCountByEmployee = new Map<string, number>();
    for (const log of monthLogs) {
      tardyCountByEmployee.set(
        log.employeeId,
        (tardyCountByEmployee.get(log.employeeId) ?? 0) + 1,
      );
    }

    const employeeTitle = `Habitual tardiness flag — ${monthKey}`;
    const habitualNotified = await alreadyNotifiedUserIds(employeeTitle);

    for (const [employeeId, count] of tardyCountByEmployee) {
      if (count < HABITUAL_TARDINESS_THRESHOLD) continue;
      const emp = employeeById.get(employeeId);
      if (!emp) continue;

      const userId = userByEmployee.get(employeeId);
      if (userId) {
        if (!habitualNotified.has(userId)) {
          await createNotification({
            userId,
            type: NOTIFICATION_TYPE,
            title: employeeTitle,
            body: `You have ${count} recorded tardiness instances in ${monthKey}. Ten or more instances in a month constitutes habitual tardiness under CSC rules and has been flagged for HR review.`,
            actionUrl: "/attendance/dtr",
            entityType: "attendance_habitual",
          });
        } else {
          counters.skippedExisting += 1;
        }
      }

      const hrTitle = `Habitual tardiness — ${emp.employeeNo} — ${monthKey}`;
      if (!(await titleExists(hrTitle))) {
        await notifyRoles(["hr_admin"], {
          type: NOTIFICATION_TYPE,
          title: hrTitle,
          body: `${emp.lastName}, ${emp.firstName} (${emp.employeeNo}) has reached ${count} tardiness instances in ${monthKey} — habitual tardiness threshold (${HABITUAL_TARDINESS_THRESHOLD}/month) exceeded per CSC rules.`,
          actionUrl: "/attendance/reports/tardiness",
          entityType: "attendance_habitual",
          entityId: employeeId,
        });
        counters.habitualFlagged += 1;
      }
    }

    // Run-level audit entry (system actor).
    const httpStatus = await recordCronRun({
      job: "attendance_notifications",
      table: "notifications",
      startedAtMs: startedAt.getTime(),
      summary: { targetDate, ...counters },
      errorCount: 0,
    });

    return NextResponse.json(
      {
        success: true,
        targetDate,
        ...counters,
        timestamp: new Date().toISOString(),
      },
      { status: httpStatus },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/attendance-notifications] Job failed:", error);

    const failStatus = await recordCronRun({
      job: "attendance_notifications",
      table: "notifications",
      startedAtMs: startedAt.getTime(),
      summary: { targetDate, ...counters },
      error,
    });

    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: failStatus },
    );
  }
}
