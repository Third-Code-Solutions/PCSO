import type { Metadata } from "next";
import Link from "next/link";
import { desc, isNull, eq } from "drizzle-orm";
import { PlusIcon } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { ActionStatusBanner } from "@/components/feedback/action-status-banner";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PipelineStageBadge } from "@/components/recruitment/pipeline-stage-badge";
import { RoleGate } from "@/components/role-gate";
import { requireAuth } from "@/lib/auth/guards";
import type { Role } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { mrfs, offices, plantillaPositions } from "@/lib/db/schema";

export const metadata: Metadata = {
  title: "Manpower Requests",
};

const ADMIN_ROLES: ReadonlyArray<Role> = ["super_admin", "hr_admin"];

interface MrfRow {
  id: string;
  itemNumber: string;
  mrfNumber: string | null;
  status: string;
  positionTitle: string | null;
  officeName: string | null;
  numberOfVacancies: number;
  createdAt: Date;
}

async function listMrfs(): Promise<MrfRow[]> {
  const rows = await db
    .select({
      id: mrfs.id,
      itemNumber: mrfs.itemNumber,
      mrfNumber: mrfs.mrfNumber,
      status: mrfs.status,
      positionTitle: plantillaPositions.positionTitle,
      officeName: offices.name,
      numberOfVacancies: mrfs.numberOfVacancies,
      createdAt: mrfs.createdAt,
    })
    .from(mrfs)
    .leftJoin(plantillaPositions, eq(plantillaPositions.id, mrfs.positionId))
    .leftJoin(offices, eq(offices.id, mrfs.officeId))
    .where(isNull(mrfs.deletedAt))
    .orderBy(desc(mrfs.createdAt))
    .limit(200);

  return rows;
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MrfListPage({ searchParams }: PageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const statusRaw = Array.isArray(params["status"])
    ? params["status"][0]
    : params["status"];

  const rows = await listMrfs();

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <PageHeader
        title="Manpower Request Forms (MRF)"
        description="Initiate recruitment approval workflow per CSC rules."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "MRFs" },
        ]}
        actions={
          <RoleGate role={user.role} roles={ADMIN_ROLES} fallback={null}>
            <Button
              size="sm"
              asChild
              className="bg-pcso-navy hover:bg-pcso-navy-light text-pcso-cream"
            >
              <Link href="/recruitment/mrf/new">
                <PlusIcon className="mr-1.5 h-4 w-4" />
                New MRF
              </Link>
            </Button>
          </RoleGate>
        }
      />
      <ActionStatusBanner status={statusRaw} entityLabel="MRF" />

      <div className="mt-6">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
            <p className="text-sm text-muted-foreground">
              No MRFs yet. Create one to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>MRF #</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead className="text-center">Vacancies</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        href={`/recruitment/mrf/${row.id}`}
                        className="font-mono text-sm font-medium hover:underline"
                      >
                        {row.mrfNumber ?? row.itemNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{row.positionTitle ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.officeName ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.numberOfVacancies}
                    </TableCell>
                    <TableCell>
                      <PipelineStageBadge stage={row.status} />
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDate(row.createdAt)}
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
