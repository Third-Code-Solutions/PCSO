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
import { unwrap } from "@/components/recruitment/_result";

export const metadata: Metadata = {
  title: "Vacancies",
};

interface VacancyListRow {
  id: string;
  title: string | null;
  itemNumber: string;
  status: string;
  applicationDeadline: Date | string | null;
  officeName: string | null;
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

export default async function VacanciesListPage() {
  const result = await listActiveVacancies().catch(() => null);

  const data = unwrap<{ rows?: VacancyListRow[] } | VacancyListRow[]>(result);
  const rows: VacancyListRow[] = Array.isArray(data)
    ? data
    : (data?.rows ?? []);

  return (
    <div>
      <PageHeader
        title="Active Vacancies"
        description="Published vacancies that are accepting applications."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "Vacancies" },
        ]}
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
          <p className="text-sm text-muted-foreground">No active vacancies.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item No</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono">{row.itemNumber}</TableCell>
                  <TableCell className="font-medium">
                    {row.title ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.officeName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.applicationDeadline)}
                  </TableCell>
                  <TableCell>
                    <PipelineStageBadge stage={row.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/recruitment/vacancies/${row.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Open
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
