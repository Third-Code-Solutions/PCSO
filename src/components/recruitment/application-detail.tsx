import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PipelineStageBadge } from "./pipeline-stage-badge";

export interface ApplicationDetailData {
  id: string;
  status: string;
  matchScore: number | string | null;
  submittedAt: Date | string | null;
  applicant: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  vacancy: {
    id: string;
    title?: string | null;
    itemNumber?: string;
    cscForm9Number?: string;
  };
}

function fullName(first: string | null, last: string | null): string {
  return [first, last].filter(Boolean).join(" ") || "—";
}

function formatScore(value: number | string | null): string {
  if (value === null || value === undefined) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function formatDate(value: Date | string | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ApplicationDetailProps {
  application: ApplicationDetailData;
  children?: React.ReactNode;
}

export function ApplicationDetail({
  application,
  children,
}: ApplicationDetailProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Applicant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium">
                {fullName(
                  application.applicant.firstName,
                  application.applicant.lastName,
                )}
              </dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-mono text-xs">
                {application.applicant.email}
              </dd>
              <dt className="text-muted-foreground">Vacancy</dt>
              <dd>
                {application.vacancy.title ??
                  application.vacancy.itemNumber ??
                  "—"}
              </dd>
              <dt className="text-muted-foreground">Submitted</dt>
              <dd>{formatDate(application.submittedAt)}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <PipelineStageBadge stage={application.status} />
            <div className="text-sm">
              <div className="text-muted-foreground">Match score</div>
              <div className="font-mono text-2xl font-semibold">
                {formatScore(application.matchScore)}
              </div>
            </div>
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ApplicationDetail;
