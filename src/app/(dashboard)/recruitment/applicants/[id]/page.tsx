import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layouts/page-header";
import { ApplicationDetail } from "@/components/recruitment/application-detail";
import { QualifyButton } from "@/components/recruitment/qualify-button";
import { RoleGate } from "@/components/role-gate";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getApplicationDetail,
  listApplicationDocuments,
  qualifyApplication,
  shortlistApplication,
  startApplicationReview,
} from "@/lib/actions/rpm/applicants";

export const metadata: Metadata = {
  title: "Application Detail",
};

interface ApplicationDetailPageProps {
  params: Promise<{ id: string }>;
}

const SCREENABLE = new Set(["submitted", "under_review"]);

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
  // Documents carry applicant PII: only screeners (employees.edit) see them.
  const canScreen = hasPermission(role, "employees", "edit");
  const docsResult = canScreen ? await listApplicationDocuments(data.id) : null;
  const documents = docsResult?.ok ? docsResult.data : [];

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
            {data.status === "submitted" ? (
              <form
                action={async () => {
                  "use server";
                  await startApplicationReview(data.id);
                }}
              >
                <button
                  type="submit"
                  className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  Start Review
                </button>
              </form>
            ) : null}

            {SCREENABLE.has(data.status) ? (
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

            {canScreen ? (
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  Documents
                </p>
                {docsResult && !docsResult.ok ? (
                  <p className="mt-1 text-sm text-destructive">
                    {docsResult.error}
                  </p>
                ) : documents.length === 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    No documents uploaded.
                  </p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {documents.map((doc) => (
                      <li key={doc.id}>
                        {doc.url ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline-offset-2 hover:underline"
                          >
                            {doc.fileName}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">
                            {doc.fileName} (link unavailable)
                          </span>
                        )}{" "}
                        <span className="text-xs text-muted-foreground">
                          · {doc.docType.replaceAll("_", " ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </RoleGate>
      </ApplicationDetail>
    </div>
  );
}
