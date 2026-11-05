import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/layouts/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ScoreEncoder,
  type QualifiedApplicantRow,
  type ScoreDimension,
} from "@/components/recruitment/score-encoder";
import { RankingTable } from "@/components/recruitment/ranking-table";
import { ExamSchedulerForm } from "@/components/recruitment/exam-scheduler-form";
import { NotifyResultsButton } from "@/components/recruitment/notify-results-button";
import { RoleGate } from "@/components/role-gate";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { listActiveVacancies } from "@/lib/actions/rpm/mrf";
import { listApplications } from "@/lib/actions/rpm/applicants";
import {
  createAssessment,
  recordAssessmentScore,
  shortlistTop5,
  recommendForBoard,
  releaseResults,
  listRanked,
  notifyExamResults,
} from "@/lib/actions/rpm/selection";
import { db } from "@/lib/db";
import { assessments } from "@/lib/db/schema/recruitment";
import { unwrap } from "@/components/recruitment/_result";
import { InterviewSection } from "./interview-section";
import { SummaryOfRatingsButtons } from "./summary-of-ratings-buttons";

export const metadata: Metadata = {
  title: "Score Encoding",
};

interface SelectionDetailPageProps {
  params: Promise<{ vacancyId: string }>;
}

interface VacancyDetail {
  id: string;
  title?: string | null;
  itemNumber?: string;
  itemNo?: string;
  status: string;
}

interface ApplicationRow {
  id: string;
  applicantFirstName?: string | null;
  applicantLastName?: string | null;
  applicantName?: string;
  status: string;
}

export default async function SelectionDetailPage({
  params,
}: SelectionDetailPageProps) {
  const { vacancyId } = await params;

  const [
    user,
    vacanciesResult,
    applicationsResult,
    rankingResult,
    assessmentRows,
  ] = await Promise.all([
    getCurrentUser(),
    listActiveVacancies().catch(() => null),
    listApplications({ vacancyId, status: "qualified", perPage: 100 }).catch(
      () => null,
    ),
    listRanked(vacancyId).catch(() => null),
    db
      .select()
      .from(assessments)
      .where(eq(assessments.vacancyId, vacancyId))
      .limit(1)
      .catch(() => []),
  ]);

  const vacancyList = unwrap<VacancyDetail[] | { rows?: VacancyDetail[] }>(
    vacanciesResult,
  );
  const vacancies: VacancyDetail[] = Array.isArray(vacancyList)
    ? vacancyList
    : (vacancyList?.rows ?? []);
  const vacancy = vacancies.find((v) => v.id === vacancyId);
  if (!vacancy) {
    notFound();
  }

  const applications = unwrap<ApplicationRow[] | { rows?: ApplicationRow[] }>(
    applicationsResult,
  );
  const qualifiedRows: ApplicationRow[] = Array.isArray(applications)
    ? applications
    : (applications?.rows ?? []);

  const qualifiedApplicants: QualifiedApplicantRow[] = qualifiedRows.map(
    (r) => ({
      applicationId: r.id,
      applicantName:
        r.applicantName ??
        ([r.applicantFirstName, r.applicantLastName]
          .filter(Boolean)
          .join(" ") ||
          "Applicant"),
    }),
  );

  const assessment = assessmentRows[0] ?? null;
  const dimensions = (assessment?.dimensions ?? []) as ScoreDimension[];
  const ranking = rankingResult?.ok ? rankingResult.data : [];

  const role = user?.role ?? "employee_self_service";
  const canManage = role === "super_admin" || role === "hr_admin";

  return (
    <div>
      <PageHeader
        title={
          vacancy.title ?? vacancy.itemNumber ?? vacancy.itemNo ?? "Vacancy"
        }
        description="Encode assessment scores and review ranking."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "Selection", href: "/recruitment/selection" },
          {
            label:
              vacancy.itemNumber ?? vacancy.itemNo ?? vacancy.id.slice(0, 8),
          },
        ]}
      />

      <div className="space-y-8">
        {!assessment && (
          <RoleGate
            role={role}
            roles={["super_admin", "hr_admin"]}
            fallback={null}
          >
            <ExamSchedulerForm
              vacancyId={vacancyId}
              createAssessmentAction={createAssessment}
            />
          </RoleGate>
        )}

        {assessment && (
          <>
            <section>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Encode Scores</CardTitle>
                    <RoleGate
                      role={role}
                      roles={["super_admin", "hr_admin"]}
                      fallback={null}
                    >
                      <NotifyResultsButton
                        vacancyId={vacancyId}
                        notifyAction={notifyExamResults}
                      />
                    </RoleGate>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScoreEncoder
                    assessmentId={assessment.id}
                    dimensions={dimensions}
                    applicants={qualifiedApplicants}
                    recordScoreAction={recordAssessmentScore}
                  />
                </CardContent>
              </Card>
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                  Ranking
                </h2>
                <SummaryOfRatingsButtons vacancyId={vacancy.id} />
              </div>
              <RankingTable
                vacancyId={vacancy.id}
                rows={ranking}
                canManage={canManage}
                shortlistTop5={shortlistTop5}
                recommendForBoard={recommendForBoard}
                releaseResults={releaseResults}
              />
            </section>
          </>
        )}

        <section>
          <InterviewSection vacancyId={vacancyId} canManage={canManage} />
        </section>
      </div>
    </div>
  );
}
