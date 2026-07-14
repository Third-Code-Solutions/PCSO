"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { type ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/tables/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DataTableColumnHeader as ColumnHeader } from "@/components/tables/column-header";
import { AlertTriangle, UserRoundX } from "lucide-react";
import { setRecordInclusion } from "@/lib/actions/payroll-gaps";
import type { PayrollRecordWithEmployee } from "@/app/(dashboard)/payroll/queries";
import type { PayrollRecordStatus } from "@/lib/db/schema";

interface RecordsTableProps {
  records: PayrollRecordWithEmployee[];
  periodId: string;
  /**
   * Status of the parent payroll period. Include/exclude tagging (TOR 1.8.4)
   * is only offered while the run is draft/processing; when omitted the
   * toggle is hidden entirely (read-only contexts).
   */
  periodStatus?: string;
}

const RECORD_STATUS_COLORS: Record<PayrollRecordStatus, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  override: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  paid: "bg-[#C8A84B] text-white border-[#C8A84B]",
};

const TOGGLEABLE_PERIOD_STATUSES = ["draft", "processing"];

function formatPeso(value: string | null): string {
  if (!value) return "₱0.00";
  const num = parseFloat(value);
  return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fullName(emp: PayrollRecordWithEmployee["employee"]): string {
  const parts = [emp.lastName, emp.firstName];
  if (emp.middleName)
    parts[1] = `${emp.firstName} ${emp.middleName.charAt(0)}.`;
  return parts.join(", ");
}

function isNextRedirect(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest: string }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_")
  );
}

export function RecordsTable({
  records,
  periodId,
  periodStatus,
}: RecordsTableProps) {
  const router = useRouter();
  const canToggle =
    periodStatus !== undefined &&
    TOGGLEABLE_PERIOD_STATUSES.includes(periodStatus);

  // Reason dialog state for the exclusion flow (TOR 1.8.4).
  const [excludeTarget, setExcludeTarget] =
    React.useState<PayrollRecordWithEmployee | null>(null);
  const [excludeReason, setExcludeReason] = React.useState("");
  const [isPending, startTransition] = React.useTransition();

  function handleExclude() {
    if (!excludeTarget) return;
    if (excludeReason.trim().length < 5) {
      toast.error("An exclusion reason (at least 5 characters) is required.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await setRecordInclusion({
          recordId: excludeTarget.id,
          included: false,
          reason: excludeReason.trim(),
        });
        toast.success(
          result.loanAmountReversed > 0
            ? `Employee excluded. Loan amortization of ₱${result.loanAmountReversed.toFixed(2)} was credited back to the ledger.`
            : "Employee excluded from this run.",
        );
        setExcludeTarget(null);
        setExcludeReason("");
        router.refresh();
      } catch (err) {
        if (isNextRedirect(err)) throw err;
        toast.error(
          err instanceof Error ? err.message : "Failed to exclude record",
        );
      }
    });
  }

  function handleInclude(record: PayrollRecordWithEmployee) {
    startTransition(async () => {
      try {
        await setRecordInclusion({ recordId: record.id, included: true });
        toast.success(
          "Employee re-included. Re-run Process Payroll so amounts are recomputed before approval.",
        );
        router.refresh();
      } catch (err) {
        if (isNextRedirect(err)) throw err;
        toast.error(
          err instanceof Error ? err.message : "Failed to re-include record",
        );
      }
    });
  }

  const columns: ColumnDef<PayrollRecordWithEmployee>[] = [
    {
      id: "employee",
      accessorFn: (r) => `${r.employee.lastName} ${r.employee.firstName}`,
      header: ({ column }) => <ColumnHeader column={column} title="Employee" />,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <Link
            href={`/payroll/${periodId}/records/${r.id}`}
            className={`group flex flex-col ${r.included === false ? "opacity-60" : ""}`}
          >
            <span className="font-medium text-[#0B2545] group-hover:underline">
              {fullName(r.employee)}
            </span>
            <span className="text-xs text-muted-foreground">
              {r.employee.employeeNo}
            </span>
          </Link>
        );
      },
    },
    {
      accessorKey: "positionTitle",
      header: ({ column }) => <ColumnHeader column={column} title="Position" />,
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="text-sm">{row.original.positionTitle}</span>
          {row.original.employee.officeName && (
            <span className="text-xs text-muted-foreground">
              {row.original.employee.officeName}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "salaryGrade",
      accessorFn: (r) => `SG ${r.salaryGrade}-${r.step}`,
      header: ({ column }) => <ColumnHeader column={column} title="SG/Step" />,
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          SG {row.original.salaryGrade}-{row.original.step}
        </span>
      ),
    },
    {
      accessorKey: "grossPay",
      header: ({ column }) => (
        <ColumnHeader
          column={column}
          title="Gross Pay"
          className="text-right"
        />
      ),
      cell: ({ row }) => (
        <span className="block text-right font-mono text-sm">
          {formatPeso(row.original.grossPay)}
        </span>
      ),
    },
    {
      accessorKey: "totalDeductions",
      header: ({ column }) => (
        <ColumnHeader
          column={column}
          title="Deductions"
          className="text-right"
        />
      ),
      cell: ({ row }) => (
        <span className="block text-right font-mono text-sm text-red-600">
          ({formatPeso(row.original.totalDeductions)})
        </span>
      ),
    },
    {
      accessorKey: "netPay",
      header: ({ column }) => (
        <ColumnHeader column={column} title="Net Pay" className="text-right" />
      ),
      cell: ({ row }) => (
        <span className="block text-right font-mono text-sm font-semibold">
          {formatPeso(row.original.netPay)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <ColumnHeader column={column} title="Status" />,
      cell: ({ row }) => {
        const status = row.original.status as PayrollRecordStatus;
        return (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`text-xs ${RECORD_STATUS_COLORS[status]}`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
            {row.original.hasException && (
              <AlertTriangle
                className="h-4 w-4 text-amber-500"
                aria-label="Has exception"
              />
            )}
          </div>
        );
      },
    },
    {
      id: "included",
      accessorFn: (r) => (r.included === false ? "excluded" : "included"),
      header: ({ column }) => (
        <ColumnHeader column={column} title="Inclusion" />
      ),
      cell: ({ row }) => {
        const r = row.original;
        const excluded = r.included === false;
        return (
          <div className="flex flex-col gap-1">
            {excluded ? (
              <Badge
                variant="outline"
                className="w-fit border-red-200 bg-red-50 text-xs text-red-700"
              >
                <UserRoundX className="mr-1 h-3 w-3" />
                Excluded
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="w-fit border-emerald-200 bg-emerald-50 text-xs text-emerald-700"
              >
                Included
              </Badge>
            )}
            {excluded && r.exclusionReason && (
              <span
                className="max-w-40 truncate text-xs text-muted-foreground"
                title={r.exclusionReason}
              >
                {r.exclusionReason}
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const r = row.original;
        const excluded = r.included === false;
        return (
          <div className="flex items-center justify-end gap-2">
            {canToggle &&
              (excluded ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" disabled={isPending}>
                      Re-include
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Re-include {fullName(r.employee)}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        The record rejoins this run&apos;s totals. Re-run
                        Process Payroll before approval so deductions (including
                        loan amortizations) are recomputed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleInclude(r)}
                        className="bg-[#0B2545] text-white hover:bg-[#13315C]"
                      >
                        Re-include
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700"
                  disabled={isPending}
                  onClick={() => {
                    setExcludeReason("");
                    setExcludeTarget(r);
                  }}
                >
                  Exclude
                </Button>
              ))}
            <Link
              href={`/payroll/${periodId}/records/${r.id}`}
              className="text-sm text-[#0B2545] hover:underline"
            >
              View
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={records}
        searchPlaceholder="Search by employee name or ID..."
        emptyMessage="No payroll records. Process the payroll to generate records."
      />

      {/* Exclusion reason dialog (TOR 1.8.4: reason is mandatory) */}
      <Dialog
        open={excludeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setExcludeTarget(null);
            setExcludeReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Exclude {excludeTarget ? fullName(excludeTarget.employee) : ""}{" "}
              from this run
            </DialogTitle>
            <DialogDescription>
              The record is removed from the run&apos;s totals, register, bank
              file, and remittances. Loan amortizations already collected in
              this run are credited back. A reason is required for the audit
              trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="exclusion-reason">Exclusion reason</Label>
            <Textarea
              id="exclusion-reason"
              value={excludeReason}
              onChange={(e) => setExcludeReason(e.target.value)}
              placeholder="e.g. On leave without pay for the entire period"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setExcludeTarget(null);
                setExcludeReason("");
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleExclude}
              disabled={isPending || excludeReason.trim().length < 5}
            >
              {isPending ? "Excluding..." : "Exclude Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
