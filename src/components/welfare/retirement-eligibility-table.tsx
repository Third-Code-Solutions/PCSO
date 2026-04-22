import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export interface RetirementNoticeDisplayRow {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeNo?: string;
  retirementType: "optional" | "compulsory";
  eligibleDate: string;
  monthsUntilEligible: number;
  status: "generated" | "sent" | "acknowledged";
}

interface RetirementEligibilityTableProps {
  rows: ReadonlyArray<RetirementNoticeDisplayRow>;
}

const STATUS_VARIANT: Record<
  RetirementNoticeDisplayRow["status"],
  "warning" | "info" | "success"
> = {
  generated: "warning",
  sent: "info",
  acknowledged: "success",
};

export function RetirementEligibilityTable({
  rows,
}: RetirementEligibilityTableProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        No retirement notices generated for this year yet.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Employee No.</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Eligible date</TableHead>
          <TableHead>Months until</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>
              {row.employeeName ?? (
                <span className="font-mono text-xs text-muted-foreground">
                  {row.employeeId}
                </span>
              )}
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {row.employeeNo ?? "—"}
            </TableCell>
            <TableCell className="capitalize">{row.retirementType}</TableCell>
            <TableCell>{row.eligibleDate}</TableCell>
            <TableCell className="tabular-nums">
              {row.monthsUntilEligible}
            </TableCell>
            <TableCell>
              <Badge
                variant={STATUS_VARIANT[row.status]}
                className="capitalize"
              >
                {row.status}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
