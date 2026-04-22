import { PageHeader } from "@/components/layouts/page-header";
import { PeriodForm } from "@/components/payroll/period-form";
import { requirePermission } from "@/lib/auth/guards";
import { Info } from "lucide-react";

export const metadata = { title: "New Benefits Payroll" };

export default async function NewBenefitsPage() {
  await requirePermission("payroll", "create");

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New Benefits Payroll Run"
        description="Create a benefits and bonuses payroll run. Tax treatment follows TRAIN Law de minimis rules."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Benefits", href: "/payroll/benefits" },
          { label: "New" },
        ]}
      />

      {/* Benefit type reference */}
      <div className="rounded-xl border border-[#0B2545]/20 bg-[#0B2545]/5 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Info className="h-4 w-4 text-[#0B2545]" />
          <h3 className="text-sm font-semibold text-[#0B2545]">
            Benefits &amp; Bonus Types (PAY-005)
          </h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
            <div className="text-xs font-semibold text-blue-800">
              Mid-Year Bonus
            </div>
            <div className="mt-0.5 text-xs text-blue-700">
              1 month basic salary. Released June. Non-taxable up to PHP 90k
              ceiling.
            </div>
          </div>
          <div className="rounded-lg border border-purple-200 bg-purple-50 px-3 py-2">
            <div className="text-xs font-semibold text-purple-800">
              Year-End Bonus
            </div>
            <div className="mt-0.5 text-xs text-purple-700">
              1 month basic salary. Released November/December.
            </div>
          </div>
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
            <div className="text-xs font-semibold text-green-800">
              Cash Gift
            </div>
            <div className="mt-0.5 text-xs text-green-700">
              PHP 5,000 fixed per employee. Released with Year-End Bonus.
            </div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <div className="text-xs font-semibold text-amber-800">
              Performance-Based Bonus (PBB)
            </div>
            <div className="mt-0.5 text-xs text-amber-700">
              Per PBB-qualified list from PMM. Requires IPCRF ≥ Satisfactory.
            </div>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          <span className="font-medium">Tax note:</span> Total bonuses up to PHP
          90,000/year are non-taxable under TRAIN Law. Excess is included in
          taxable compensation.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="mb-6 text-sm text-muted-foreground">
          Include the benefit type in the period name (e.g., &ldquo;Mid-Year
          Bonus — June 2026&rdquo;) for easy identification. After creating the
          period, you will be able to select employees and compute amounts.
        </p>
        <PeriodForm defaultScope="benefits_bonuses" />
      </div>
    </main>
  );
}
