"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, Play, CheckCircle, DollarSign, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  lockPeriod,
  processPayroll,
  approvePayroll,
  releasePayroll,
  emailPayslips,
} from "@/app/(dashboard)/payroll/actions";
import type { PayrollPeriod } from "@/lib/db/schema";

interface PeriodActionsBarProps {
  period: PayrollPeriod;
}

export function PeriodActionsBar({ period }: PeriodActionsBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();

  function handleAction(
    label: string,
    action: () => Promise<unknown>,
    successMessage: string,
  ) {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMessage);
        router.refresh();
      } catch (err) {
        // Next.js redirect() throws a special error — re-throw so the framework
        // can handle the navigation instead of swallowing it as a toast error.
        if (
          typeof err === "object" &&
          err !== null &&
          "digest" in err &&
          typeof (err as { digest: string }).digest === "string" &&
          (err as { digest: string }).digest.startsWith("NEXT_")
        ) {
          throw err;
        }
        const message = err instanceof Error ? err.message : `Failed: ${label}`;
        toast.error(message);
      }
    });
  }

  const { status, id } = period;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 p-4">
      {/* Step indicators */}
      <div className="flex flex-1 items-center gap-2 text-sm text-muted-foreground">
        <StepPill
          step={1}
          label="Draft"
          active={status === "draft"}
          done={status !== "draft"}
        />
        <StepConnector />
        <StepPill
          step={2}
          label="Processing"
          active={status === "processing"}
          done={["approved", "paid"].includes(status)}
        />
        <StepConnector />
        <StepPill
          step={3}
          label="Approved"
          active={status === "approved"}
          done={status === "paid"}
        />
        <StepConnector />
        <StepPill
          step={4}
          label="Paid"
          active={status === "paid"}
          done={false}
        />
      </div>

      {/* Action buttons per status */}
      <div className="flex shrink-0 items-center gap-2">
        {status === "draft" && (
          <ConfirmButton
            label="Lock & Process"
            icon={<Lock className="mr-2 h-4 w-4" />}
            description="Locking this period prevents further attendance edits. The system will compute payroll for all eligible employees."
            confirmLabel="Lock & Process"
            disabled={isPending}
            onConfirm={() =>
              handleAction(
                "lock",
                async () => {
                  await lockPeriod(id);
                  await processPayroll(id);
                },
                "Payroll processed. Review records before approving.",
              )
            }
          />
        )}

        {status === "processing" && (
          <>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                handleAction(
                  "reprocess",
                  () => processPayroll(id),
                  "Payroll re-processed.",
                )
              }
            >
              <Play className="mr-2 h-4 w-4" />
              Re-Process
            </Button>
            <ConfirmButton
              label="Approve Payroll"
              icon={<CheckCircle className="mr-2 h-4 w-4" />}
              description="Approving locks the computation. All records will be marked 'Approved'. This requires payroll approval authority."
              confirmLabel="Approve"
              disabled={isPending}
              className="bg-[#0B2545] text-white hover:bg-[#13315C]"
              onConfirm={() =>
                handleAction(
                  "approve",
                  () => approvePayroll(id),
                  "Payroll approved.",
                )
              }
            />
          </>
        )}

        {status === "approved" && (
          <>
            <ConfirmButton
              label="Release (Mark Paid)"
              icon={<DollarSign className="mr-2 h-4 w-4" />}
              description="Marking as paid is irreversible. Ensure funds have been disbursed before proceeding."
              confirmLabel="Mark as Paid"
              disabled={isPending}
              className="bg-emerald-700 text-white hover:bg-emerald-800"
              onConfirm={() =>
                handleAction(
                  "release",
                  () => releasePayroll(id),
                  "Payroll released and marked as paid.",
                )
              }
            />
          </>
        )}

        {(status === "approved" || status === "paid") && (
          <ConfirmButton
            label="Email Payslips"
            icon={<Mail className="mr-2 h-4 w-4" />}
            description="This will email payslips to all employees in this period. Ensure email addresses are up-to-date."
            confirmLabel="Send Emails"
            disabled={isPending}
            variant="outline"
            onConfirm={() =>
              handleAction(
                "email",
                () => emailPayslips({ periodId: id }),
                "Payslips emailed to all employees.",
              )
            }
          />
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StepPill({
  step,
  label,
  active,
  done,
}: {
  step: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-[#0B2545] text-white"
          : done
            ? "bg-emerald-100 text-emerald-700"
            : "bg-transparent text-muted-foreground"
      }`}
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
          active
            ? "bg-white text-[#0B2545]"
            : done
              ? "bg-emerald-500 text-white"
              : "bg-muted-foreground/20 text-muted-foreground"
        }`}
      >
        {done ? "✓" : step}
      </span>
      {label}
    </div>
  );
}

function StepConnector() {
  return <span className="h-px w-4 bg-border" aria-hidden />;
}

interface ConfirmButtonProps {
  label: string;
  icon: React.ReactNode;
  description: string;
  confirmLabel: string;
  disabled?: boolean;
  className?: string;
  variant?: "default" | "outline";
  onConfirm: () => void;
}

function ConfirmButton({
  label,
  icon,
  description,
  confirmLabel,
  disabled,
  className,
  variant = "default",
  onConfirm,
}: ConfirmButtonProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant={variant}
          disabled={disabled}
          className={className}
        >
          {icon}
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
