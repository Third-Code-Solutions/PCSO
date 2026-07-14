/**
 * InterviewSection — server wrapper for TOR 1.2.20 interview scheduling.
 *
 * Loads the vacancy's active interview batches and interview-eligible
 * applicants (qualified / shortlisted / for_interview), then renders the
 * client dialog + schedule list. Kept as a self-loading section so the
 * selection page only needs an import + render.
 */

import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { applicants, applications } from "@/lib/db/schema/recruitment";
import { listInterviewSchedules } from "@/lib/actions/rpm/interviews";
import {
  InterviewSectionClient,
  type EligibleApplicantView,
  type InterviewScheduleView,
} from "./interview-section-client";

interface InterviewSectionProps {
  vacancyId: string;
  canManage: boolean;
}

export async function InterviewSection({
  vacancyId,
  canManage,
}: InterviewSectionProps) {
  const [schedulesResult, eligibleRows] = await Promise.all([
    listInterviewSchedules(vacancyId).catch(() => ({
      ok: false as const,
      error: "failed",
    })),
    db
      .select({
        applicationId: applications.id,
        status: applications.status,
        interviewScheduleId: applications.interviewScheduleId,
        firstName: applicants.firstName,
        lastName: applicants.lastName,
      })
      .from(applications)
      .innerJoin(applicants, eq(applicants.id, applications.applicantId))
      .where(
        and(
          eq(applications.vacancyId, vacancyId),
          inArray(applications.status, [
            "qualified",
            "shortlisted",
            "for_interview",
          ]),
        ),
      )
      .catch(() => []),
  ]);

  const schedules: InterviewScheduleView[] = schedulesResult.ok
    ? schedulesResult.data.map((s) => ({
        id: s.id,
        scheduledAt: s.scheduledAt,
        venue: s.venue,
        mode: s.mode,
        panel: s.panel,
        notes: s.notes,
        notifiedAt: s.notifiedAt,
        applicants: s.applicants,
      }))
    : [];

  const eligible: EligibleApplicantView[] = eligibleRows.map((r) => ({
    applicationId: r.applicationId,
    applicantName: `${r.firstName} ${r.lastName}`.trim(),
    status: r.status,
    alreadyScheduled: Boolean(r.interviewScheduleId),
  }));

  return (
    <InterviewSectionClient
      vacancyId={vacancyId}
      canManage={canManage}
      eligible={eligible}
      schedules={schedules}
    />
  );
}

export default InterviewSection;
