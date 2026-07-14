"use server";

/**
 * RPM — Interview scheduling server actions (TOR 1.2.20).
 *
 * HRD groups shortlisted/qualified applicants of a vacancy into an interview
 * batch (date/time, venue, mode, panel). Creating a batch:
 *   1. inserts an `interview_schedules` row,
 *   2. links the chosen `applications.interviewScheduleId`,
 *   3. notifies each applicant in-app (portal) — inside the tx,
 *   4. emails each applicant (best-effort, after commit) and stamps
 *      `notifiedAt`,
 *   5. audit-logs the write (module RPM).
 *
 * Cancellation reverses the links, soft-deletes the schedule, and notifies
 * the affected applicants.
 *
 * Permissions mirror the sibling selection actions: reads gate on
 * employees.view, writes on employees.process (hr_admin / super_admin).
 */

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/lib/db";
import { withTx } from "@/lib/db/transaction";
import {
  applicants,
  applications,
  interviewSchedules,
  vacancies,
} from "@/lib/db/schema/recruitment";
import { plantillaPositions } from "@/lib/db/schema/plantilla";
import { systemUsers } from "@/lib/db/schema/users";
import { notifications } from "@/lib/db/schema/notifications";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import {
  applicantStatusUrl,
  sendApplicantEmail,
} from "@/lib/email/applicant-mailer";
import {
  RpmInterviewScheduleEmail,
  rpmInterviewSchedulePlainText,
  type RpmInterviewScheduleEmailProps,
} from "@/lib/email/templates/rpm-interview-schedule";

// ── Local types (not exported — 'use server' modules export functions only) ──

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

interface InterviewRecipient {
  applicationId: string;
  applicantId: string;
  employeeId: string | null;
  email: string;
  name: string;
}

interface ScheduleApplicantSummary {
  applicationId: string;
  applicationNumber: string;
  applicantName: string;
  status: string;
}

interface InterviewScheduleSummary {
  id: string;
  vacancyId: string;
  scheduledAt: string;
  venue: string;
  mode: string;
  panel: string | null;
  notes: string | null;
  notifiedAt: string | null;
  createdAt: string;
  applicants: ScheduleApplicantSummary[];
}

// ── Validation ────────────────────────────────────────────────────────────────

const INTERVIEW_MODES = ["in_person", "online", "phone"] as const;

const createInterviewScheduleSchema = z.object({
  vacancyId: z.string().uuid(),
  applicationIds: z.array(z.string().uuid()).min(1).max(200),
  scheduledAt: z.coerce.date(),
  venue: z.string().trim().min(1).max(255),
  mode: z.enum(INTERVIEW_MODES),
  panel: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(4000).optional(),
});

// Statuses eligible for interview assignment (TOR 1.2.20: shortlisted or
// qualified applicants; for_interview allows re-batching after a board
// recommendation or a cancelled schedule).
const ELIGIBLE_STATUSES = [
  "qualified",
  "shortlisted",
  "for_interview",
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

async function loadPositionTitle(vacancyId: string): Promise<string | null> {
  const [row] = await db
    .select({ positionTitle: plantillaPositions.positionTitle })
    .from(vacancies)
    .innerJoin(
      plantillaPositions,
      eq(vacancies.positionId, plantillaPositions.id),
    )
    .where(eq(vacancies.id, vacancyId))
    .limit(1);
  return row?.positionTitle ?? null;
}

/**
 * Email every recipient (best-effort, sequential) and audit one summary row.
 * Never throws — an email outage must not break the scheduling action.
 */
async function dispatchInterviewEmails(params: {
  actorUserId: string;
  scheduleId: string;
  recipients: ReadonlyArray<InterviewRecipient>;
  emailProps: Omit<
    RpmInterviewScheduleEmailProps,
    "applicantName" | "statusUrl"
  >;
}): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  const failures: string[] = [];
  const subject =
    params.emailProps.variant === "cancelled"
      ? `Interview Cancelled — ${params.emailProps.positionTitle}`
      : `Interview Schedule — ${params.emailProps.positionTitle}`;

  for (const recipient of params.recipients) {
    if (!recipient.email) continue;
    const props: RpmInterviewScheduleEmailProps = {
      ...params.emailProps,
      applicantName: recipient.name,
      statusUrl: applicantStatusUrl(recipient.applicationId),
    };
    const result = await sendApplicantEmail({
      to: recipient.email,
      subject,
      react: RpmInterviewScheduleEmail(props),
      text: rpmInterviewSchedulePlainText(props),
    });
    if (result.sent) sent += 1;
    else failures.push(`${recipient.email}: ${result.reason}`);
  }

  await auditLog({
    userId: params.actorUserId,
    action: "notify",
    table: "interview_schedules",
    recordId: params.scheduleId,
    module: "RPM",
    subModule: "interview_schedule",
    outcome: failures.length > 0 && sent === 0 ? "failure" : "success",
    severity: failures.length > 0 ? "warn" : "info",
    reason:
      failures.length > 0
        ? `Interview emails failed (${failures.length}/${params.recipients.length}): ${failures.slice(0, 5).join("; ")}`
        : undefined,
    newValues: {
      sent,
      failed: failures.length,
      variant: params.emailProps.variant,
    },
  });

  return { sent, failed: failures.length };
}

// ── createInterviewSchedule ───────────────────────────────────────────────────

/**
 * TOR 1.2.20 — create an interview batch for a vacancy and notify the chosen
 * applicants (in-app + email). `notifiedAt` is stamped once dispatch has been
 * attempted; a retried action would re-send emails (acceptable — dispatch is
 * informational and happens post-commit).
 */
export async function createInterviewSchedule(
  input: unknown,
): Promise<Result<{ scheduleId: string; assigned: number }>> {
  try {
    const user = await requirePermission("employees", "process");
    const parsed = createInterviewScheduleSchema.parse(input);

    if (parsed.scheduledAt.getTime() <= Date.now()) {
      return { ok: false, error: "Interview must be scheduled in the future" };
    }

    const positionTitle = await loadPositionTitle(parsed.vacancyId);
    if (!positionTitle) return { ok: false, error: "Vacancy not found" };

    let recipients: InterviewRecipient[] = [];

    const scheduleId = await withTx(async (tx) => {
      // Validate the applications belong to this vacancy and are eligible.
      const rows = await tx
        .select({
          applicationId: applications.id,
          applicantId: applications.applicantId,
          employeeId: applications.employeeId,
          status: applications.status,
          email: applicants.email,
          firstName: applicants.firstName,
          lastName: applicants.lastName,
        })
        .from(applications)
        .innerJoin(applicants, eq(applicants.id, applications.applicantId))
        .where(
          and(
            inArray(applications.id, parsed.applicationIds),
            eq(applications.vacancyId, parsed.vacancyId),
          ),
        );

      if (rows.length !== parsed.applicationIds.length) {
        throw new Error(
          "One or more applications do not belong to this vacancy",
        );
      }
      const ineligible = rows.filter(
        (r) =>
          !ELIGIBLE_STATUSES.includes(
            r.status as (typeof ELIGIBLE_STATUSES)[number],
          ),
      );
      if (ineligible.length > 0) {
        throw new Error(
          `Only qualified, shortlisted, or for-interview applicants can be scheduled (${ineligible.length} ineligible)`,
        );
      }

      const [inserted] = await tx
        .insert(interviewSchedules)
        .values({
          vacancyId: parsed.vacancyId,
          scheduledAt: parsed.scheduledAt,
          venue: parsed.venue,
          mode: parsed.mode,
          panel: parsed.panel ?? null,
          notes: parsed.notes ?? null,
          createdBy: user.id,
        })
        .returning({ id: interviewSchedules.id });
      if (!inserted) throw new Error("Failed to create interview schedule");

      await tx
        .update(applications)
        .set({ interviewScheduleId: inserted.id })
        .where(inArray(applications.id, parsed.applicationIds));

      recipients = rows.map((r) => ({
        applicationId: r.applicationId,
        applicantId: r.applicantId,
        employeeId: r.employeeId,
        email: r.email,
        name: `${r.firstName} ${r.lastName}`.trim(),
      }));

      // Portal (in-app) notifications — internal promotion applicants map via
      // applications.employeeId; the sibling applicantId match is kept for
      // applicant accounts that are provisioned as system users.
      const matchIds = [
        ...recipients.map((r) => r.applicantId),
        ...recipients
          .map((r) => r.employeeId)
          .filter((id): id is string => Boolean(id)),
      ];
      if (matchIds.length > 0) {
        const users = await tx
          .select({ userId: systemUsers.id })
          .from(systemUsers)
          .where(
            and(
              inArray(systemUsers.employeeId, matchIds),
              eq(systemUsers.isActive, true),
            ),
          );
        if (users.length > 0) {
          await tx.insert(notifications).values(
            users.map((u) => ({
              userId: u.userId,
              type: "generic" as const,
              title: "Interview scheduled",
              body: `Your interview for ${positionTitle} is on ${parsed.scheduledAt.toISOString()} at ${parsed.venue}.`,
              entityType: "interview_schedule",
              entityId: inserted.id,
            })),
          );
        }
      }

      return inserted.id;
    });

    // Email dispatch AFTER commit (non-transactional side effect).
    await dispatchInterviewEmails({
      actorUserId: user.id,
      scheduleId,
      recipients,
      emailProps: {
        positionTitle,
        scheduledAt: parsed.scheduledAt.toISOString(),
        venue: parsed.venue,
        mode: parsed.mode,
        panel: parsed.panel ?? null,
        notes: parsed.notes ?? null,
        variant: "scheduled",
      },
    });

    // Notifications (portal + email) have been dispatched — stamp notifiedAt.
    await db
      .update(interviewSchedules)
      .set({ notifiedAt: new Date() })
      .where(eq(interviewSchedules.id, scheduleId));

    await auditLog({
      userId: user.id,
      action: "create",
      table: "interview_schedules",
      recordId: scheduleId,
      module: "RPM",
      subModule: "interview_schedule",
      newValues: {
        vacancyId: parsed.vacancyId,
        applicationIds: parsed.applicationIds,
        scheduledAt: parsed.scheduledAt.toISOString(),
        venue: parsed.venue,
        mode: parsed.mode,
      },
    });

    revalidatePath(`/recruitment/selection/${parsed.vacancyId}`);

    return {
      ok: true,
      data: { scheduleId, assigned: parsed.applicationIds.length },
    };
  } catch (error: unknown) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

// ── listInterviewSchedules ────────────────────────────────────────────────────

/** Active (non-cancelled) interview batches for a vacancy, newest first. */
export async function listInterviewSchedules(
  vacancyId: string,
): Promise<Result<InterviewScheduleSummary[]>> {
  try {
    await requirePermission("employees", "view");

    const schedules = await db
      .select()
      .from(interviewSchedules)
      .where(
        and(
          eq(interviewSchedules.vacancyId, vacancyId),
          isNull(interviewSchedules.deletedAt),
        ),
      )
      .orderBy(interviewSchedules.scheduledAt);

    if (schedules.length === 0) return { ok: true, data: [] };

    const assigned = await db
      .select({
        applicationId: applications.id,
        applicationNumber: applications.applicationNumber,
        status: applications.status,
        interviewScheduleId: applications.interviewScheduleId,
        firstName: applicants.firstName,
        lastName: applicants.lastName,
      })
      .from(applications)
      .innerJoin(applicants, eq(applicants.id, applications.applicantId))
      .where(
        inArray(
          applications.interviewScheduleId,
          schedules.map((s) => s.id),
        ),
      );

    const bySchedule = new Map<string, ScheduleApplicantSummary[]>();
    for (const row of assigned) {
      if (!row.interviewScheduleId) continue;
      const list = bySchedule.get(row.interviewScheduleId) ?? [];
      list.push({
        applicationId: row.applicationId,
        applicationNumber: row.applicationNumber,
        applicantName: `${row.firstName} ${row.lastName}`.trim(),
        status: row.status,
      });
      bySchedule.set(row.interviewScheduleId, list);
    }

    return {
      ok: true,
      data: schedules.map((s) => ({
        id: s.id,
        vacancyId: s.vacancyId,
        scheduledAt: s.scheduledAt.toISOString(),
        venue: s.venue,
        mode: s.mode,
        panel: s.panel,
        notes: s.notes,
        notifiedAt: s.notifiedAt ? s.notifiedAt.toISOString() : null,
        createdAt: s.createdAt.toISOString(),
        applicants: bySchedule.get(s.id) ?? [],
      })),
    };
  } catch (error: unknown) {
    return { ok: false, error: toErrorMessage(error) };
  }
}

// ── cancelInterviewSchedule ───────────────────────────────────────────────────

/**
 * Cancel an interview batch: unlink the assigned applications, soft-delete the
 * schedule, and notify the affected applicants (in-app + email).
 */
export async function cancelInterviewSchedule(
  id: string,
): Promise<Result<{ scheduleId: string; unassigned: number }>> {
  try {
    const user = await requirePermission("employees", "process");
    const parsedId = z.string().uuid().parse(id);

    let recipients: InterviewRecipient[] = [];
    let scheduleInfo: {
      vacancyId: string;
      scheduledAt: Date;
      venue: string;
      mode: string;
    } | null = null;

    const unassigned = await withTx(async (tx) => {
      const [schedule] = await tx
        .select()
        .from(interviewSchedules)
        .where(
          and(
            eq(interviewSchedules.id, parsedId),
            isNull(interviewSchedules.deletedAt),
          ),
        )
        .limit(1);
      if (!schedule) throw new Error("Interview schedule not found");
      scheduleInfo = {
        vacancyId: schedule.vacancyId,
        scheduledAt: schedule.scheduledAt,
        venue: schedule.venue,
        mode: schedule.mode,
      };

      const rows = await tx
        .select({
          applicationId: applications.id,
          applicantId: applications.applicantId,
          employeeId: applications.employeeId,
          email: applicants.email,
          firstName: applicants.firstName,
          lastName: applicants.lastName,
        })
        .from(applications)
        .innerJoin(applicants, eq(applicants.id, applications.applicantId))
        .where(eq(applications.interviewScheduleId, parsedId));

      recipients = rows.map((r) => ({
        applicationId: r.applicationId,
        applicantId: r.applicantId,
        employeeId: r.employeeId,
        email: r.email,
        name: `${r.firstName} ${r.lastName}`.trim(),
      }));

      await tx
        .update(applications)
        .set({ interviewScheduleId: null })
        .where(eq(applications.interviewScheduleId, parsedId));

      await tx
        .update(interviewSchedules)
        .set({ deletedAt: new Date() })
        .where(eq(interviewSchedules.id, parsedId));

      // Portal (in-app) cancellation notices.
      const matchIds = [
        ...recipients.map((r) => r.applicantId),
        ...recipients
          .map((r) => r.employeeId)
          .filter((eid): eid is string => Boolean(eid)),
      ];
      if (matchIds.length > 0) {
        const users = await tx
          .select({ userId: systemUsers.id })
          .from(systemUsers)
          .where(
            and(
              inArray(systemUsers.employeeId, matchIds),
              eq(systemUsers.isActive, true),
            ),
          );
        if (users.length > 0) {
          await tx.insert(notifications).values(
            users.map((u) => ({
              userId: u.userId,
              type: "generic" as const,
              title: "Interview cancelled",
              body: `Your interview scheduled on ${schedule.scheduledAt.toISOString()} at ${schedule.venue} has been cancelled.`,
              entityType: "interview_schedule",
              entityId: parsedId,
            })),
          );
        }
      }

      return rows.length;
    });

    const info = scheduleInfo as {
      vacancyId: string;
      scheduledAt: Date;
      venue: string;
      mode: string;
    } | null;

    if (info && recipients.length > 0) {
      const positionTitle =
        (await loadPositionTitle(info.vacancyId)) ?? "the position";
      await dispatchInterviewEmails({
        actorUserId: user.id,
        scheduleId: parsedId,
        recipients,
        emailProps: {
          positionTitle,
          scheduledAt: info.scheduledAt.toISOString(),
          venue: info.venue,
          mode: (INTERVIEW_MODES as readonly string[]).includes(info.mode)
            ? (info.mode as (typeof INTERVIEW_MODES)[number])
            : "in_person",
          panel: null,
          notes: null,
          variant: "cancelled",
        },
      });
    }

    await auditLog({
      userId: user.id,
      action: "delete",
      table: "interview_schedules",
      recordId: parsedId,
      module: "RPM",
      subModule: "interview_schedule",
      reason: "Interview schedule cancelled",
      newValues: { unassigned },
    });

    if (info) {
      revalidatePath(`/recruitment/selection/${info.vacancyId}`);
    }

    return { ok: true, data: { scheduleId: parsedId, unassigned } };
  } catch (error: unknown) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
