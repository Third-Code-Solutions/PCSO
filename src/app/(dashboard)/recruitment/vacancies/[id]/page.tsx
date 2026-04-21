import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layouts/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PipelineStageBadge } from "@/components/recruitment/pipeline-stage-badge";
import {
  ApplicantTable,
  type ApplicantRow,
} from "@/components/recruitment/applicant-table";
import { listActiveVacancies } from "@/lib/actions/rpm/mrf";
import { listApplications } from "@/lib/actions/rpm/applicants";
import { unwrap } from "@/components/recruitment/_result";

export const metadata: Metadata = {
  title: "Vacancy Detail",
};

interface VacancyDetailPageProps {
  params: Promise<{ id: string }>;
}

interface VacancyDetail {
  id: string;
  title?: string | null;
  itemNumber?: string;
  itemNo?: string;
  status: string;
  cscForm9Number?: string | null;
  cscForm9Id?: string | null;
  applicationDeadline?: Date | string | null;
  qualificationStandards?: {
    education: string;
    eligibility: string;
    experience: number;
    training: string;
  } | null;
  officeName?: string | null;
}

interface ApplicationListRow {
  id: string;
  applicantFirstName?: string | null;
  applicantLastName?: string | null;
  applicantName?: string;
  vacancyTitle?: string;
  status: string;
  matchScore: number | null;
  submittedAt: Date | string | null;
}

function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function VacancyDetailPage({
  params,
}: VacancyDetailPageProps) {
  const { id } = await params;
  const [allVacanciesResult, applicationsResult] = await Promise.all([
    listActiveVacancies().catch(() => null),
    listApplications({ vacancyId: id, perPage: 100 }).catch(() => null),
  ]);

  const allVacancies = unwrap<VacancyDetail[] | { rows?: VacancyDetail[] }>(
    allVacanciesResult,
  );
  const vacancyList: VacancyDetail[] = Array.isArray(allVacancies)
    ? allVacancies
    : (allVacancies?.rows ?? []);
  const vacancy = vacancyList.find((v) => v.id === id);
  if (!vacancy) {
    notFound();
  }

  const applications = unwrap<
    { rows?: ApplicationListRow[] } | ApplicationListRow[]
  >(applicationsResult);
  const rawRows: ApplicationListRow[] = Array.isArray(applications)
    ? applications
    : (applications?.rows ?? []);

  const applicantRows: ApplicantRow[] = rawRows.map((r) => ({
    id: r.id,
    applicantName:
      r.applicantName ??
      ([r.applicantFirstName, r.applicantLastName].filter(Boolean).join(" ") ||
        "Applicant"),
    vacancyTitle: r.vacancyTitle ?? vacancy.title ?? "—",
    status: r.status,
    matchScore: r.matchScore,
    submittedAt: r.submittedAt,
  }));

  return (
    <div>
      <PageHeader
        title={
          vacancy.title ??
          `Vacancy ${vacancy.itemNumber ?? vacancy.itemNo ?? ""}`
        }
        description={vacancy.officeName ?? undefined}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "Vacancies", href: "/recruitment/vacancies" },
          {
            label:
              vacancy.itemNumber ?? vacancy.itemNo ?? vacancy.id.slice(0, 8),
          },
        ]}
        actions={<PipelineStageBadge stage={vacancy.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Qualification Standards
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {vacancy.qualificationStandards ? (
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">
                      Education
                    </dt>
                    <dd className="mt-1">
                      {vacancy.qualificationStandards.education}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">
                      Eligibility
                    </dt>
                    <dd className="mt-1">
                      {vacancy.qualificationStandards.eligibility}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">
                      Experience
                    </dt>
                    <dd className="mt-1">
                      {vacancy.qualificationStandards.experience} years
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-muted-foreground">
                      Training
                    </dt>
                    <dd className="mt-1">
                      {vacancy.qualificationStandards.training}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-muted-foreground">Not specified.</p>
              )}
            </CardContent>
          </Card>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">
              Applications ({applicantRows.length})
            </h2>
            <ApplicantTable rows={applicantRows} total={applicantRows.length} />
          </section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Posting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <dl className="grid grid-cols-2 gap-2">
                <dt className="text-muted-foreground">Item No</dt>
                <dd className="font-mono">
                  {vacancy.itemNumber ?? vacancy.itemNo ?? "—"}
                </dd>
                <dt className="text-muted-foreground">CSC Form 9</dt>
                <dd className="font-mono text-xs">
                  {vacancy.cscForm9Number ?? vacancy.cscForm9Id ?? "—"}
                </dd>
                <dt className="text-muted-foreground">Deadline</dt>
                <dd>{formatDate(vacancy.applicationDeadline ?? null)}</dd>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
