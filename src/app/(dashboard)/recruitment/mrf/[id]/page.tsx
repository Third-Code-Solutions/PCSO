import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layouts/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PipelineStageBadge } from "@/components/recruitment/pipeline-stage-badge";
import {
  MrfApprovalList,
  type MrfApprovalStep,
} from "@/components/recruitment/mrf-approval-list";
import { PublishVacancyButtonClient } from "@/components/recruitment/_publish-vacancy-button";
import { SubmitMrfButton } from "@/components/recruitment/_submit-mrf-button";
import { RoleGate } from "@/components/role-gate";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import {
  getMrf,
  submitMrf,
  approveMrfStep,
  publishVacancyForMrf,
} from "@/lib/actions/rpm/mrf";
import { unwrap } from "@/components/recruitment/_result";

export const metadata: Metadata = {
  title: "MRF Detail",
};

interface MrfDetailPageProps {
  params: Promise<{ id: string }>;
}

interface MrfDetailData {
  id: string;
  itemNumber?: string;
  mrfNumber?: string | null;
  status: string;
  justification?: string | null;
  numberOfVacancies?: number;
  positionTitle?: string | null;
  officeName?: string | null;
  createdAt: Date | string;
}

function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function MrfDetailPage({ params }: MrfDetailPageProps) {
  const { id } = await params;
  const [user, result] = await Promise.all([getCurrentUser(), getMrf(id)]);

  const unwrapped = unwrap<{
    mrf: MrfDetailData;
    approvals: MrfApprovalStep[];
    vacancyId: string | null;
  }>(result);
  if (!unwrapped) {
    notFound();
  }

  const mrf: MrfDetailData = unwrapped.mrf;
  const approvals: MrfApprovalStep[] = unwrapped.approvals ?? [];
  const vacancyId: string | null = unwrapped.vacancyId ?? null;
  const currentApproverEmployeeId = user?.employeeId ?? null;
  const role = user?.role ?? "employee_self_service";
  const displayItem = mrf.mrfNumber ?? mrf.itemNumber ?? mrf.id.slice(0, 8);
  const isDraft = mrf.status === "draft" || mrf.status === "returned";

  return (
    <div>
      <PageHeader
        title={`MRF ${displayItem}`}
        description={mrf.positionTitle ?? "Manpower Request"}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "MRFs", href: "/recruitment/mrf" },
          { label: displayItem },
        ]}
        actions={<PipelineStageBadge stage={mrf.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <dl className="grid grid-cols-2 gap-3">
                <dt className="text-muted-foreground">Office</dt>
                <dd>{mrf.officeName ?? "—"}</dd>
                <dt className="text-muted-foreground">Position</dt>
                <dd>{mrf.positionTitle ?? "—"}</dd>
                <dt className="text-muted-foreground">Vacancies</dt>
                <dd>{mrf.numberOfVacancies ?? "—"}</dd>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(mrf.createdAt)}</dd>
              </dl>
              {mrf.justification && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Justification
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {mrf.justification}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {isDraft && (
            <RoleGate
              role={role}
              roles={["super_admin", "hr_admin"]}
              fallback={null}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Submit for Approval
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Submit this MRF to start the approval chain configured under
                    File Maintenance → Document Signatories (MRF).
                  </p>
                  <SubmitMrfButton mrfId={mrf.id} submitAction={submitMrf} />
                </CardContent>
              </Card>
            </RoleGate>
          )}

          {mrf.status === "approved" && vacancyId && (
            <RoleGate
              role={role}
              roles={["super_admin", "hr_admin"]}
              fallback={null}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Next Step: Publish Vacancy
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    This MRF has completed all approval steps. Publish the
                    vacancy to open it for applicants.
                  </p>
                  <PublishVacancyButtonClient
                    vacancyId={vacancyId}
                    publishAction={publishVacancyForMrf}
                  />
                </CardContent>
              </Card>
            </RoleGate>
          )}
        </div>

        <div className="space-y-6">
          <MrfApprovalList
            mrfId={mrf.id}
            steps={approvals}
            currentApproverEmployeeId={currentApproverEmployeeId}
            approveAction={approveMrfStep}
          />
        </div>
      </div>
    </div>
  );
}
