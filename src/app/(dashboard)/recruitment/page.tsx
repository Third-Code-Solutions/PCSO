/**
 * Recruitment Overview — pipeline-stage counts and recent activity.
 */
import type { Metadata } from "next";
import Link from "next/link";
import {
  FileText,
  ClipboardList,
  Users,
  Gauge,
  Award,
  Megaphone,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PipelineStageBadge } from "@/components/recruitment/pipeline-stage-badge";
import { requireAuth } from "@/lib/auth/guards";
import { listMrfs } from "@/lib/actions/rpm/mrf";
import { listApplications } from "@/lib/actions/rpm/applicants";
import { listActiveVacancies } from "@/lib/actions/rpm/mrf";
import { listAppointments } from "@/lib/actions/rpm/appointment";
import { unwrap } from "@/components/recruitment/_result";

export const metadata: Metadata = {
  title: "Overview",
};

interface StageCardProps {
  label: string;
  count: number;
  icon: React.ReactNode;
  href: string;
  tone: string;
}

function StageCard({ label, count, icon, href, tone }: StageCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-lg border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone} text-foreground`}
        >
          {icon}
        </div>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-foreground">
        {count}
      </div>
      <div className="mt-1 text-xs text-muted-foreground group-hover:text-primary">
        View list →
      </div>
    </Link>
  );
}

// Roles that may create a new MRF (mirrors mrf/new/page.tsx gate).
const MRF_CREATE_ROLES: ReadonlyArray<string> = [
  "super_admin",
  "hr_admin",
  "leave_approver",
  "supervisor",
];

export default async function RecruitmentOverviewPage() {
  const user = await requireAuth();
  const canCreateMrf = MRF_CREATE_ROLES.includes(user.role);

  const [mrfResult, vacanciesResult, applicationsResult, appointmentsResult] =
    await Promise.all([
      (listMrfs as unknown as () => Promise<unknown>)().catch(() => null),
      listActiveVacancies().catch(() => null),
      listApplications({ perPage: 200 }).catch(() => null),
      (listAppointments as unknown as () => Promise<unknown>)().catch(
        () => null,
      ),
    ]);

  type MrfRow = { id: string; status: string; createdAt: Date | string };
  type VacancyRow = { id: string; status: string; title: string | null };
  type ApplicationRow = {
    id: string;
    status: string;
    matchScore: number | null;
    submittedAt: Date | string | null;
    createdAt: Date | string;
  };
  type AppointmentRow = { id: string; createdAt: Date | string };

  const mrfData = unwrap<{ rows?: MrfRow[] } | MrfRow[]>(mrfResult);
  const mrfRows: MrfRow[] = Array.isArray(mrfData)
    ? mrfData
    : (mrfData?.rows ?? []);

  const vacancyData = unwrap<{ rows?: VacancyRow[] } | VacancyRow[]>(
    vacanciesResult,
  );
  const vacancyRowsNormalised: VacancyRow[] = Array.isArray(vacancyData)
    ? vacancyData
    : (vacancyData?.rows ?? []);

  const applicationData = unwrap<
    { rows?: ApplicationRow[] } | ApplicationRow[]
  >(applicationsResult);
  const applicationRows: ApplicationRow[] = Array.isArray(applicationData)
    ? applicationData
    : (applicationData?.rows ?? []);

  const appointmentData = unwrap<
    { rows?: AppointmentRow[] } | AppointmentRow[]
  >(appointmentsResult);
  const appointmentRows: AppointmentRow[] = Array.isArray(appointmentData)
    ? appointmentData
    : (appointmentData?.rows ?? []);

  const draftMrfs = mrfRows.filter((r) => r.status === "draft").length;
  const publishedVacancies = vacancyRowsNormalised.filter(
    (r) => r.status === "published" || r.status === "posted",
  ).length;
  const underReview = applicationRows.filter(
    (r) => r.status === "under_review" || r.status === "received",
  ).length;
  const examScheduled = applicationRows.filter(
    (r) => r.status === "exam_scheduled",
  ).length;
  const rated = applicationRows.filter((r) => r.status === "rated").length;
  const shortlisted = applicationRows.filter(
    (r) => r.status === "shortlisted",
  ).length;
  const appointed = appointmentRows.length;

  const recent = [...applicationRows]
    .sort((a, b) => {
      const ad = new Date(a.createdAt).getTime();
      const bd = new Date(b.createdAt).getTime();
      return bd - ad;
    })
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Recruitment"
        description="Manpower requests, vacancies, applications, and appointments."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment" },
        ]}
        actions={
          canCreateMrf ? (
            <Button size="sm" asChild>
              <Link href="/recruitment/mrf/new">
                <Plus className="mr-2 h-4 w-4" />
                New MRF
              </Link>
            </Button>
          ) : null
        }
      />

      <section
        aria-label="Pipeline counts"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
        <StageCard
          label="Draft MRFs"
          count={draftMrfs}
          href="/recruitment/mrf?status=draft"
          icon={<FileText className="h-4 w-4" />}
          tone="bg-slate-100"
        />
        <StageCard
          label="Published Vacancies"
          count={publishedVacancies}
          href="/recruitment/vacancies"
          icon={<Megaphone className="h-4 w-4" />}
          tone="bg-indigo-100"
        />
        <StageCard
          label="Under Review"
          count={underReview}
          href="/recruitment/applicants?status=under_review"
          icon={<ClipboardList className="h-4 w-4" />}
          tone="bg-sky-100"
        />
        <StageCard
          label="Exam Scheduled"
          count={examScheduled}
          href="/recruitment/selection"
          icon={<Gauge className="h-4 w-4" />}
          tone="bg-violet-100"
        />
        <StageCard
          label="Rated"
          count={rated}
          href="/recruitment/selection"
          icon={<Users className="h-4 w-4" />}
          tone="bg-fuchsia-100"
        />
        <StageCard
          label="Shortlisted"
          count={shortlisted}
          href="/recruitment/applicants?status=shortlisted"
          icon={<Award className="h-4 w-4" />}
          tone="bg-amber-100"
        />
        <StageCard
          label="Appointed"
          count={appointed}
          href="/recruitment/appointments"
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="bg-emerald-100"
        />
      </section>

      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Applications</CardTitle>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent applications.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <Link
                      href={`/recruitment/applicants/${row.id}`}
                      className="min-w-0 flex-1 truncate font-medium hover:underline"
                    >
                      Application {row.id.slice(0, 8)}
                    </Link>
                    <PipelineStageBadge stage={row.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
