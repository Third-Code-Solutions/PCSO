"use client";

/**
 * Salary Adjustments client UI — TOR 1.8.11/1.8.12/1.8.13.
 *
 * Create dialog (employee, nature, new grade/step or explicit salary,
 * effectivity, reason), approvals table with approve/disapprove dialogs, and
 * NOSA PDF links once issued. Server actions re-validate everything; this
 * component only does fast-feedback checks.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createSalaryAdjustment,
  approveSalaryAdjustment,
  disapproveSalaryAdjustment,
  type SalaryAdjustmentListRow,
} from "@/lib/actions/payroll/salary-adjustments";
import {
  SALARY_ADJUSTMENT_TYPE_VALUES,
  SALARY_ADJUSTMENT_TYPE_LABELS,
  formatGradeStep,
} from "@/lib/utils/payroll/salary-adjustment";

interface PickerEmployee {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  positionTitle: string;
  salaryGrade: number;
  step: number;
}

interface Props {
  adjustments: SalaryAdjustmentListRow[];
  employees: PickerEmployee[];
  canEdit: boolean;
  canApprove: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  effected: "bg-emerald-50 text-emerald-700 border-emerald-200",
  disapproved: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "effected", label: "Effected" },
  { value: "disapproved", label: "Disapproved" },
] as const;

function formatPeso(value: string | number | null): string {
  if (value === null || value === "") return "—";
  const num = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(num)) return "—";
  return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

export function SalaryAdjustmentsClient({
  adjustments,
  employees,
  canEdit,
  canApprove,
}: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = React.useState<string>("all");

  const visible =
    statusFilter === "all"
      ? adjustments
      : adjustments.filter((a) => a.status === statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {canEdit && (
          <NewAdjustmentDialog
            employees={employees}
            onCreated={() => router.refresh()}
          />
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Nature</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Effectivity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>NOSA</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No salary adjustments{" "}
                  {statusFilter !== "all"
                    ? `with status "${statusFilter}"`
                    : "yet"}
                  .
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) => (
                <AdjustmentRow
                  key={row.id}
                  row={row}
                  canApprove={canApprove}
                  onChanged={() => router.refresh()}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Table row with approve / disapprove actions ─────────────────────────────

function AdjustmentRow({
  row,
  canApprove,
  onChanged,
}: {
  row: SalaryAdjustmentListRow;
  canApprove: boolean;
  onChanged: () => void;
}) {
  const [isPending, startTransition] = React.useTransition();
  const [disapproveOpen, setDisapproveOpen] = React.useState(false);
  const [disapproveReason, setDisapproveReason] = React.useState("");

  const typeLabel =
    SALARY_ADJUSTMENT_TYPE_LABELS[
      row.adjustmentType as keyof typeof SALARY_ADJUSTMENT_TYPE_LABELS
    ] ?? row.adjustmentType;

  function handleApprove() {
    startTransition(async () => {
      try {
        const result = await approveSalaryAdjustment({ adjustmentId: row.id });
        toast.success(
          `Adjustment effected — NOSA ${result.nosaSerial} issued.`,
        );
        onChanged();
      } catch (err) {
        if (isNextRedirect(err)) throw err;
        toast.error(
          err instanceof Error ? err.message : "Failed to approve adjustment",
        );
      }
    });
  }

  function handleDisapprove() {
    if (disapproveReason.trim().length < 5) {
      toast.error("A disapproval reason (at least 5 characters) is required.");
      return;
    }
    startTransition(async () => {
      try {
        await disapproveSalaryAdjustment({
          adjustmentId: row.id,
          reason: disapproveReason.trim(),
        });
        toast.success("Adjustment disapproved.");
        setDisapproveOpen(false);
        setDisapproveReason("");
        onChanged();
      } catch (err) {
        if (isNextRedirect(err)) throw err;
        toast.error(
          err instanceof Error
            ? err.message
            : "Failed to disapprove adjustment",
        );
      }
    });
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-[#0B2545]">{row.employeeName}</span>
          <span className="text-xs text-muted-foreground">
            {row.employeeNo} · {row.officeName}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-sm">{typeLabel}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-mono text-sm">{formatPeso(row.oldSalary)}</span>
          <span className="text-xs text-muted-foreground">
            {formatGradeStep(row.oldGrade, row.oldStep) ?? "—"}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-mono text-sm font-semibold">
            {formatPeso(row.newSalary)}
          </span>
          <span className="text-xs text-muted-foreground">
            {formatGradeStep(row.newGrade, row.newStep) ?? "Amount only"}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-sm">{row.effectiveDate}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Badge
            variant="outline"
            className={`w-fit text-xs ${STATUS_BADGE[row.status] ?? ""}`}
          >
            {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
          </Badge>
          {row.status === "disapproved" && row.disapprovalReason && (
            <span
              className="max-w-48 truncate text-xs text-red-600"
              title={row.disapprovalReason}
            >
              {row.disapprovalReason}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {row.nosaDocumentUrl ? (
          <a
            href={row.nosaDocumentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-[#0B2545] hover:underline"
          >
            <FileText className="h-3.5 w-3.5" />
            {row.nosaSerial}
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        {row.status === "pending" && canApprove ? (
          <div className="flex items-center justify-end gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  disabled={isPending}
                  className="bg-[#0B2545] text-white hover:bg-[#13315C]"
                >
                  Approve
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Approve salary adjustment</AlertDialogTitle>
                  <AlertDialogDescription>
                    Approving effects the adjustment immediately: the NOSA (
                    {formatPeso(row.newSalary)}
                    {formatGradeStep(row.newGrade, row.newStep)
                      ? `, ${formatGradeStep(row.newGrade, row.newStep)}`
                      : ""}
                    , effective {row.effectiveDate}) is issued and the 201 file
                    is updated. This cannot be undone from this screen.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleApprove}
                    className="bg-[#0B2545] text-white hover:bg-[#13315C]"
                  >
                    Approve & Issue NOSA
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Dialog open={disapproveOpen} onOpenChange={setDisapproveOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={isPending}>
                  Disapprove
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Disapprove salary adjustment</DialogTitle>
                  <DialogDescription>
                    State the reason for disapproving {row.employeeName}&apos;s
                    adjustment. The employee is notified with this reason.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  <Label htmlFor={`disapprove-reason-${row.id}`}>Reason</Label>
                  <Textarea
                    id={`disapprove-reason-${row.id}`}
                    value={disapproveReason}
                    onChange={(e) => setDisapproveReason(e.target.value)}
                    placeholder="At least 5 characters..."
                    rows={3}
                  />
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDisapproveOpen(false)}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDisapprove}
                    disabled={isPending || disapproveReason.trim().length < 5}
                  >
                    {isPending ? "Saving..." : "Disapprove"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── New adjustment dialog ────────────────────────────────────────────────────

function NewAdjustmentDialog({
  employees,
  onCreated,
}: {
  employees: PickerEmployee[];
  onCreated: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const [employeeId, setEmployeeId] = React.useState("");
  const [adjustmentType, setAdjustmentType] = React.useState("");
  const [newGrade, setNewGrade] = React.useState("");
  const [newStep, setNewStep] = React.useState("");
  const [newSalary, setNewSalary] = React.useState("");
  const [effectiveDate, setEffectiveDate] = React.useState("");
  const [reason, setReason] = React.useState("");

  const selectedEmployee = employees.find((e) => e.id === employeeId);

  function resetForm() {
    setEmployeeId("");
    setAdjustmentType("");
    setNewGrade("");
    setNewStep("");
    setNewSalary("");
    setEffectiveDate("");
    setReason("");
  }

  function handleSubmit() {
    // Fast-feedback checks — the server action re-validates with zod.
    if (!employeeId) return toast.error("Select an employee.");
    if (!adjustmentType) return toast.error("Select the nature of adjustment.");
    if (!effectiveDate) return toast.error("Set the effectivity date.");
    const hasGrade = newGrade.trim() !== "";
    const hasStep = newStep.trim() !== "";
    if (hasGrade !== hasStep) {
      return toast.error("New grade and new step must be provided together.");
    }
    if (!hasGrade && newSalary.trim() === "") {
      return toast.error(
        "Provide a new grade + step, or an explicit new monthly salary.",
      );
    }

    startTransition(async () => {
      try {
        const result = await createSalaryAdjustment({
          employeeId,
          adjustmentType,
          effectiveDate,
          newGrade,
          newStep,
          newSalary,
          reason,
        });
        toast.success(
          `Adjustment submitted for approval (new salary ${formatPeso(result.newSalary)}).`,
        );
        resetForm();
        setOpen(false);
        onCreated();
      } catch (err) {
        if (isNextRedirect(err)) throw err;
        toast.error(
          err instanceof Error ? err.message : "Failed to create adjustment",
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#0B2545] text-white hover:bg-[#13315C]">
          <Plus className="mr-2 h-4 w-4" />
          New Adjustment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New salary adjustment</DialogTitle>
          <DialogDescription>
            The adjustment is staged as pending. Approval issues the NOSA and
            updates the 201 file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.lastName}, {emp.firstName} ({emp.employeeNo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEmployee && (
              <p className="text-xs text-muted-foreground">
                Current: {selectedEmployee.positionTitle} · SG{" "}
                {selectedEmployee.salaryGrade}, Step {selectedEmployee.step}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Nature of adjustment</Label>
            <Select value={adjustmentType} onValueChange={setAdjustmentType}>
              <SelectTrigger>
                <SelectValue placeholder="Select nature" />
              </SelectTrigger>
              <SelectContent>
                {SALARY_ADJUSTMENT_TYPE_VALUES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {SALARY_ADJUSTMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="adj-new-grade">New salary grade (1–33)</Label>
              <Input
                id="adj-new-grade"
                type="number"
                min={1}
                max={33}
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
                placeholder="e.g. 15"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adj-new-step">New step (1–8)</Label>
              <Input
                id="adj-new-step"
                type="number"
                min={1}
                max={8}
                value={newStep}
                onChange={(e) => setNewStep(e.target.value)}
                placeholder="e.g. 2"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-new-salary">
              New monthly salary (₱) — optional when grade/step set
            </Label>
            <Input
              id="adj-new-salary"
              type="text"
              inputMode="decimal"
              value={newSalary}
              onChange={(e) => setNewSalary(e.target.value)}
              placeholder="Resolved from the salary schedule when blank"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use the authorized amount for the new grade/step.
              Fill it in for amount-only adjustments or manual overrides.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-effective-date">Effectivity date</Label>
            <Input
              id="adj-effective-date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-reason">Basis / remarks (optional)</Label>
            <Textarea
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Promotion per Board Resolution No. 123, s. 2026"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            {isPending ? "Submitting..." : "Submit for Approval"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
