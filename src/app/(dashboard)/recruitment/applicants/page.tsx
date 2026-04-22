import type { Metadata } from "next";
import { PageHeader } from "@/components/layouts/page-header";
import {
  ApplicantTable,
  type ApplicantRow,
} from "@/components/recruitment/applicant-table";
import { ActionStatusBanner } from "@/components/feedback/action-status-banner";
import { listApplications } from "@/lib/actions/rpm/applicants";
import { requireAuth } from "@/lib/auth/guards";
import { unwrap } from "@/components/recruitment/_result";

export const metadata: Metadata = {
  title: "Applicants",
};

interface ApplicantsListPageProps {
  searchParams: Promise<Record<string, string | string[]>>;
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

export default async function ApplicantsListPage({
  searchParams,
}: ApplicantsListPageProps) {
  await requireAuth();

  const sp = await searchParams;
  const statusParam = Array.isArray(sp.status) ? sp.status[0] : sp.status;

  const result = await listApplications({
    status: statusParam,
    perPage: 100,
  }).catch(() => null);

  const data = unwrap<
    { rows?: ApplicationListRow[]; total?: number } | ApplicationListRow[]
  >(result);
  const rows: ApplicationListRow[] = Array.isArray(data)
    ? data
    : (data?.rows ?? []);
  const total = Array.isArray(data)
    ? data.length
    : (data?.total ?? rows.length);

  const applicantRows: ApplicantRow[] = rows.map((r) => ({
    id: r.id,
    applicantName:
      r.applicantName ??
      ([r.applicantFirstName, r.applicantLastName].filter(Boolean).join(" ") ||
        "Applicant"),
    vacancyTitle: r.vacancyTitle ?? "—",
    status: r.status,
    matchScore: r.matchScore,
    submittedAt: r.submittedAt,
  }));

  return (
    <div>
      <PageHeader
        title="Applicants"
        description="All applications across every active vacancy."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "Applicants" },
        ]}
      />
      <ActionStatusBanner status={statusParam} entityLabel="Application" />
      <ApplicantTable rows={applicantRows} total={total} />
    </div>
  );
}
