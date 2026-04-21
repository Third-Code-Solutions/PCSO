"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { deleteLoan } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface LoanTableProps {
  loans: {
    id: string;
    employeeId: string;
    employeeNo: string;
    employeeName: string;
    employeeLastName: string;
    loanType: string;
    principal: string;
    startDate: string;
    endDate: string;
    deductionSchedule: string;
    deductionAmount: string;
    runningBalance: string;
    remarks: string | null;
    createdAt: Date | null;
  }[];
}

const loanTypeLabels: Record<string, string> = {
  gsis_personal: "GSIS Personal",
  gsis_policy: "GSIS Policy",
  gsis_emergency: "GSIS Emergency",
  gsis_multi_purpose: "GSIS Multi-Purpose",
  pagibig_multi_purpose: "Pag-IBIG Multi-Purpose",
  pcso_in_house: "PCSO In-House",
};

const scheduleLabels: Record<string, string> = {
  semi_monthly: "Semi-Monthly",
  monthly: "Monthly",
};

export function LoanTable({ loans }: LoanTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this loan record?")) return;

    setDeletingId(id);
    try {
      await deleteLoan({ id });
      toast.success("Loan record deleted successfully");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete loan",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (loans.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No loan records found. Create a new loan to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Loan Type</TableHead>
            <TableHead>Principal</TableHead>
            <TableHead>Running Balance</TableHead>
            <TableHead>Deduction</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loans.map((loan) => {
            const fullName = `${loan.employeeLastName}, ${loan.employeeName}`;
            const isFullyPaid = parseFloat(loan.runningBalance) === 0;

            return (
              <TableRow key={loan.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{fullName}</div>
                    <div className="text-xs text-muted-foreground">
                      {loan.employeeNo}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {loanTypeLabels[loan.loanType]}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono">
                  ₱
                  {parseFloat(loan.principal).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell className="font-mono">
                  {isFullyPaid ? (
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800"
                    >
                      FULLY PAID
                    </Badge>
                  ) : (
                    `₱${parseFloat(loan.runningBalance).toLocaleString(
                      "en-PH",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}`
                  )}
                </TableCell>
                <TableCell className="font-mono">
                  ₱
                  {parseFloat(loan.deductionAmount).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell>{scheduleLabels[loan.deductionSchedule]}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {format(new Date(loan.startDate), "MMM d, yyyy")} –{" "}
                  {format(new Date(loan.endDate), "MMM d, yyyy")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        router.push(`/payroll/loans/${loan.id}/edit`)
                      }
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(loan.id)}
                      disabled={deletingId === loan.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
