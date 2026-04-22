import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layouts/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PipelineStageBadge } from "@/components/recruitment/pipeline-stage-badge";
import { listActiveVacancies } from "@/lib/actions/rpm/mrf";
import { requireAuth } from "@/lib/auth/guards";
import { unwrap } from "@/components/recruitment/_result";

export const metadata: Metadata = {
  title: "Selection",
};

interface VacancyRow {
  id: string;
  title: string | null;
  itemNumber: string;
  status: string;
  officeName: string | null;
}

const SELECTION_WRITE_ROLES: ReadonlyArray<string> = [
  "super_admin",
  "hr_admin",
];

export default async function SelectionIndexPage() {
  const user = await requireAuth();
  const canScore = SELECTION_WRITE_ROLES.includes(user.role);

  const result = await listActiveVacancies().catch(() => null);

  const data = unwrap<{ rows?: VacancyRow[] } | VacancyRow[]>(result);
  const rows: VacancyRow[] = Array.isArray(data) ? data : (data?.rows ?? []);

  const relevant = rows.filter((r) =>
    ["exam_scheduled", "rated", "under_review", "published", "posted"].includes(
      r.status,
    ),
  );

  return (
    <div>
      <PageHeader
        title="Selection"
        description="Vacancies in rating and shortlisting. Encode scores and rank applicants."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "Selection" },
        ]}
      />

      {relevant.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No vacancies currently in selection.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item No</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {relevant.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono">{row.itemNumber}</TableCell>
                  <TableCell className="font-medium">
                    {row.title ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.officeName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <PipelineStageBadge stage={row.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/recruitment/selection/${row.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {canScore ? "Score" : "View"}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
