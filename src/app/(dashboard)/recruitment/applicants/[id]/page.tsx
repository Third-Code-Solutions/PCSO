import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layouts/page-header";
import { ApplicationDetail } from "@/components/recruitment/application-detail";
import { QualifyButton } from "@/components/recruitment/qualify-button";
import { RoleGate } from "@/components/role-gate";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  getApplicationDetail,
  qualifyApplication,
  shortlistApplication,
} from "@/lib/actions/rpm/applicants";

export const metadata: Metadata = {
  title: "Application Detail",
};

interface ApplicationDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ApplicationDetailPage({
  params,
}: ApplicationDetailPageProps) {
  const { id } = await params;
  const [user, result] = await Promise.all([
    getCurrentUser(),
    getApplicationDetail(id),
  ]);

  if (!result.ok) {
    notFound();
  }

  const role = user?.role ?? "employee_self_service";
  const data = result.data;

  return (
    <div>
      <PageHeader
        title="Application"
        description={`Submitted by ${data.applicant.email}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "Applicants", href: "/recruitment/applicants" },
          { label: "Detail" },
        ]}
      />

      <ApplicationDetail application={data}>
        <RoleGate
          role={role}
          roles={["super_admin", "hr_admin"]}
          fallback={null}
        >
          <div className="flex flex-col gap-2 pt-2">
            {data.status === "under_review" || data.status === "received" ? (
              <>
                <QualifyButton
                  applicationId={data.id}
                  decision="qualified"
                  action={qualifyApplication}
                />
                <QualifyButton
                  applicationId={data.id}
                  decision="not_qualified"
                  action={qualifyApplication}
                  variant="outline"
                  requireReason
                />
              </>
            ) : null}

            {data.status === "qualified" ? (
              <form
                action={async () => {
                  "use server";
                  await shortlistApplication(data.id);
                }}
              >
                <button
                  type="submit"
                  className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Shortlist Applicant
                </button>
              </form>
            ) : null}
          </div>
        </RoleGate>
      </ApplicationDetail>
    </div>
  );
}
