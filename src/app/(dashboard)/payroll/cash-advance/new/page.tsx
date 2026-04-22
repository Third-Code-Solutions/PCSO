import { PageHeader } from "@/components/layouts/page-header";
import { PeriodForm } from "@/components/payroll/period-form";
import { requirePermission } from "@/lib/auth/guards";
import { Info } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "New Cash Advance Payroll" };

export default async function NewCashAdvancePage() {
  await requirePermission("payroll", "create");

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New Cash Advance Payroll Run"
        description="Create a cash advance payroll run for loan deductions and running balance updates."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Cash Advance", href: "/payroll/cash-advance" },
          { label: "New" },
        ]}
      />

      {/* Workflow explanation */}
      <div className="rounded-xl border border-[#0B2545]/20 bg-[#0B2545]/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Info className="h-4 w-4 text-[#0B2545]" />
          <h3 className="text-sm font-semibold text-[#0B2545]">
            How Cash Advance Payroll Works (PAY-004)
          </h3>
        </div>
        <ol className="space-y-2 text-xs text-muted-foreground">
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B2545] text-[10px] font-bold text-white">
              1
            </span>
            <span>
              Create this payroll period with the applicable pay date and period
              range.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B2545] text-[10px] font-bold text-white">
              2
            </span>
            <span>
              After creation, select employees with active cash advance loan
              entries from the{" "}
              <Link
                href="/payroll/loans"
                className="font-medium text-[#0B2545] underline-offset-2 hover:underline"
              >
                Loan Ledger
              </Link>
              .
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B2545] text-[10px] font-bold text-white">
              3
            </span>
            <span>
              System computes deduction amounts per schedule (semi-monthly or
              monthly) and updates running balances.
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B2545] text-[10px] font-bold text-white">
              4
            </span>
            <span>
              Approve and finalize the run. Balances in the Loan Ledger are
              updated automatically.
            </span>
          </li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="font-medium">Note:</span> Cash advance payroll
          periods do not include mandatory deductions (GSIS, PhilHealth,
          Pag-IBIG) unless configured by the Payroll Master.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <PeriodForm defaultScope="cash_advance" />
      </div>
    </main>
  );
}
