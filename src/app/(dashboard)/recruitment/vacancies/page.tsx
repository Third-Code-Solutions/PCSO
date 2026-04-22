import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, isNull } from "drizzle-orm";
import { PageHeader } from "@/components/layouts/page-header";
import { ActionStatusBanner } from "@/components/feedback/action-status-banner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PipelineStageBadge } from "@/components/recruitment/pipeline-stage-badge";
import { requireAuth } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { vacancies, mrfs, offices, plantillaPositions } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Vacancies",
};

interface VacancyRow {
  id: string;
  title: string | null;
  itemNumber: string;
  status: string;
  applicationDeadline: Date | null;
  officeName: string | null;
  cscForm9Number: string | null;
}

async function listActiveVacancies(): Promise<VacancyRow[]> {
  const rows = await db
    .select({
      id: vacancies.id,
      title: plantillaPositions.positionTitle,
      itemNumber: mrfs.itemNumber,
      status: vacancies.status,
      applicationDeadline: vacancies.applicationDeadline,
      officeName: offices.name,
      cscForm9Number: vacancies.cscForm9Number,
    })
    .from(vacancies)
    .leftJoin(mrfs, eq(vacancies.mrfId, mrfs.id))
    .leftJoin(plantillaPositions, eq(mrfs.positionId, plantillaPositions.id))
    .leftJoin(offices, eq(mrfs.officeId, offices.id))
    .where(isNull(vacancies.deletedAt))
    .orderBy(desc(vacancies.createdAt))
    .limit(200);

  return rows;
}

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VacanciesListPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const statusRaw = Array.isArray(params["status"])
    ? params["status"][0]
    : params["status"];

  const rows = await listActiveVacancies();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title="Active Vacancies"
        description="Published vacancies accepting applications. Compliance with CSC Form 9 requirements."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "Vacancies" },
        ]}
      />
      <ActionStatusBanner status={statusRaw} entityLabel="Vacancy" />

      <div className="mt-6">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No active vacancies.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item No</TableHead>
                  <TableHead>CSC Form 9</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/recruitment/vacancies/${row.id}`}
                        className="font-mono text-sm font-medium hover:underline"
                      >
                        {row.itemNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.cscForm9Number ?? "—"}
                    </TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </main>
  );
}
