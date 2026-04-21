import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export interface AwardeeDisplayRow {
  id: string;
  employeeId: string;
  milestoneYears: number;
  yearsOfServiceComputed: string;
  awardGrantedAt: Date | null;
  previousAwardFlag: boolean;
}

interface AwardeesTableProps {
  rows: ReadonlyArray<AwardeeDisplayRow>;
}

export function AwardeesTable({ rows }: AwardeesTableProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        No awardees in this run.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Milestone</TableHead>
          <TableHead>Years of service</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-mono text-xs">
              {row.employeeId}
            </TableCell>
            <TableCell>{row.milestoneYears} yrs</TableCell>
            <TableCell className="tabular-nums">
              {row.yearsOfServiceComputed}
            </TableCell>
            <TableCell>
              {row.awardGrantedAt ? (
                <Badge variant="secondary">Granted</Badge>
              ) : (
                <Badge variant="outline">Pending</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
