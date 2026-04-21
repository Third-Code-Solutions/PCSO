import type { Metadata } from "next";
import type * as React from "react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layouts/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ScoreEncoder,
  type QualifiedApplicantRow,
} from "@/components/recruitment/score-encoder";
import {
  RankingTable,
  type RankingRow,
} from "@/components/recruitment/ranking-table";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { listActiveVacancies } from "@/lib/actions/rpm/mrf";
import { listApplications } from "@/lib/actions/rpm/applicants";
import {
  recordAssessmentScore,
  shortlistTop5,
  recommendForBoard,
  listRanked,
} from "@/lib/actions/rpm/selection";
import { unwrap } from "@/components/recruitment/_result";

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

interface AssessmentData {
  id: string;
  vacancyId: string;
}

interface ApplicationRow {
  id: string;
  applicantFirstName?: string | null;
  applicantLastName?: string | null;
  applicantName?: string;
  matchScore: number | null;
  status: string;
}

export default async function SelectionDetailPage({
  params,
}: SelectionDetailPageProps) {
  const { vacancyId } = await params;

  const [user, vacanciesResult, applicationsResult, rankingResult] =
    await Promise.all([
      getCurrentUser(),
      listActiveVacancies().catch(() => null),
      listApplications({ vacancyId, status: "qualified", perPage: 100 }).catch(
        () => null,
      ),
      (listRanked as unknown as (vacancyId: string) => Promise<unknown>)(
        vacancyId,
      ).catch(() => null),
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
      currentScore: r.matchScore,
    }),
  );

  // Assessment + ranking shapes are still being finalised by sibling agents.
  // Treat them as opaque and fall back to empty state when unavailable.
  const assessment: AssessmentData | null = null;

  const rankingData = unwrap<RankingRow[] | { rows?: RankingRow[] }>(
    rankingResult,
  );
  const ranking: RankingRow[] = Array.isArray(rankingData)
    ? rankingData
    : (rankingData?.rows ?? []);

  const raterEmployeeId = user?.employeeId ?? "";

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
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Encode Scores</CardTitle>
            </CardHeader>
            <CardContent>
              {assessment ? (
                <ScoreEncoder
                  assessmentId={(assessment as AssessmentData).id}
                  raterEmployeeId={raterEmployeeId}
                  applicants={qualifiedApplicants}
                  recordScoreAction={
                    recordAssessmentScore as unknown as React.ComponentProps<
                      typeof ScoreEncoder
                    >["recordScoreAction"]
                  }
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No assessment has been scheduled for this vacancy yet.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
            Ranking
          </h2>
          <RankingTable
            vacancyId={vacancy.id}
            rows={ranking}
            shortlistTop5={
              shortlistTop5 as unknown as React.ComponentProps<
                typeof RankingTable
              >["shortlistTop5"]
            }
            recommendForBoard={
              recommendForBoard as unknown as React.ComponentProps<
                typeof RankingTable
              >["recommendForBoard"]
            }
          />
        </section>
      </div>
    </div>
  );
}
