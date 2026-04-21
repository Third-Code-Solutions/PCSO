import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
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
import { listMrfs } from "@/lib/actions/rpm/mrf";
import { unwrap } from "@/components/recruitment/_result";

export const metadata: Metadata = {
  title: "Manpower Requests",
};

interface MrfListPageProps {
  searchParams: Promise<Record<string, string | string[]>>;
}

interface MrfListRow {
  id: string;
  itemNumber: string;
  positionTitle: string | null;
  officeName: string | null;
  status: string;
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

export default async function MrfListPage({ searchParams }: MrfListPageProps) {
  const sp = await searchParams;
  const statusParam = Array.isArray(sp.status) ? sp.status[0] : sp.status;

  void statusParam;
  const result = await (listMrfs as unknown as () => Promise<unknown>)().catch(
    () => null,
  );
  const data = unwrap<{ rows?: MrfListRow[] } | MrfListRow[]>(result);
  const rows: MrfListRow[] = Array.isArray(data)
    ? (data as MrfListRow[])
    : ((data as { rows?: MrfListRow[] } | null)?.rows ?? []);

  return (
    <div>
      <PageHeader
        title="Manpower Requests"
        description="Manpower Request Forms (MRFs) awaiting action across the 3-step approval chain."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Recruitment", href: "/recruitment" },
          { label: "MRFs" },
        ]}
        actions={
          <Button size="sm" asChild>
            <Link href="/recruitment/mrf/new">
              <Plus className="mr-2 h-4 w-4" />
              New MRF
            </Link>
          </Button>
        }
      />

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
                <TableHead>Item No</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono">{row.itemNumber}</TableCell>
                  <TableCell>{row.positionTitle ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.officeName ?? "—"}
                  </TableCell>
                  <TableCell>
                    <PipelineStageBadge stage={row.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(row.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/recruitment/mrf/${row.id}`}
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
