import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PipelineStageBadge } from "./pipeline-stage-badge";

export interface ApplicantRow {
  id: string;
  applicantName: string;
  vacancyTitle: string;
  status: string;
  matchScore: number | null;
  submittedAt: Date | string | null;
}

interface ApplicantTableProps {
  rows: ApplicantRow[];
  total?: number;
  hrefBase?: string;
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

export function ApplicantTable({
  rows,
  total,
  hrefBase = "/recruitment/applicants",
}: ApplicantTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        No applications match this filter.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Applicant</TableHead>
            <TableHead>Vacancy</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Match Score</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.applicantName}</TableCell>
              <TableCell className="text-muted-foreground">
                {row.vacancyTitle}
              </TableCell>
              <TableCell>
                <PipelineStageBadge stage={row.status} />
              </TableCell>
              <TableCell className="text-right font-mono">
                {row.matchScore !== null ? row.matchScore.toFixed(2) : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(row.submittedAt)}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`${hrefBase}/${row.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {typeof total === "number" && (
        <div className="border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          Showing {rows.length} of {total}
        </div>
      )}
    </div>
  );
}

export default ApplicantTable;
