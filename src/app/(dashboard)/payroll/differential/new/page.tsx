import { PageHeader } from "@/components/layouts/page-header";
import { PeriodForm } from "@/components/payroll/period-form";
import { requirePermission } from "@/lib/auth/guards";
import { Info, AlertCircle } from "lucide-react";

export const metadata = { title: "New Salary Differential" };

export default async function NewDifferentialPage() {
  await requirePermission("payroll", "create");

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New Salary Differential Run"
        description="Create a retroactive pay adjustment payroll run per PAY-006."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Differential", href: "/payroll/differential" },
          { label: "New" },
        ]}
      />

      {/* What is salary differential */}
      <div className="rounded-xl border border-[#0B2545]/20 bg-[#0B2545]/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Info className="h-4 w-4 text-[#0B2545]" />
          <h3 className="text-sm font-semibold text-[#0B2545]">
            What is Salary Differential? (PAY-006)
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Salary differential is retroactive pay owed to an employee when their
          salary is adjusted effective a past date. It covers the gap between
          the old and new salary rates for the retroactive period.
        </p>

        {/* Formula box */}
        <div className="mt-3 rounded-lg border border-[#0B2545]/20 bg-white/60 px-4 py-3 font-mono text-xs text-[#0B2545]">
          Differential = (New Rate − Old Rate) × Applicable Months
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-white/50 px-3 py-2">
            <div className="text-xs font-semibold text-foreground">
              Common Triggers
            </div>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              <li>• Approved salary adjustments (NOSA)</li>
              <li>• SSL or CPCS schedule update (DBM)</li>
              <li>• Promotion with retroactive effectivity</li>
              <li>• Step increment issuance (NOSI)</li>
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-white/50 px-3 py-2">
            <div className="text-xs font-semibold text-foreground">
              Period Dates
            </div>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              <li>
                <span className="font-medium">Period Start/End:</span> The
                retroactive period (e.g., Jan 1 – Jun 30)
              </li>
              <li>
                <span className="font-medium">Pay Date:</span> When the
                differential is actually disbursed
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tax notice */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="text-xs text-amber-800">
          <span className="font-semibold">BIR Tax Treatment:</span> The salary
          differential amount is subject to BIR withholding tax per TRAIN Law.
          The system will compute withholding on the differential amount during
          payroll processing. Ensure the employee&rsquo;s year-to-date taxable
          income is current before running computation.
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="mb-6 text-sm text-muted-foreground">
          Set the <span className="font-medium">Period Start</span> and{" "}
          <span className="font-medium">Period End</span> to the retroactive
          period (when the salary adjustment was effective). Set{" "}
          <span className="font-medium">Pay Date</span> to the actual
          disbursement date. After creating the period, select employees and
          enter old and new salary rates to compute each employee&rsquo;s
          differential.
        </p>
        <PeriodForm defaultScope="salary_differential" />
      </div>
    </main>
  );
}
