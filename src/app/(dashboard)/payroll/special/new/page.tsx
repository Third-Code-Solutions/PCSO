import { PageHeader } from "@/components/layouts/page-header";
import { PeriodForm } from "@/components/payroll/period-form";
import { requirePermission } from "@/lib/auth/guards";

export const metadata = { title: "New Special Payroll" };

export default async function NewSpecialPage() {
  await requirePermission("payroll", "create");

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New Special Payroll"
        description="Create a custom payroll run with configurable title per PAY-007."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Special", href: "/payroll/special" },
          { label: "New" },
        ]}
      />

      {/* PAY-007 guidance */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
        <p className="text-sm font-semibold text-amber-800">
          PAY-007 — Special Payroll Rules
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-700">
          <li>
            A <strong>custom title</strong> is required (e.g., &ldquo;Hazard Pay
            — March 2025&rdquo;, &ldquo;Emergency Relief Allowance&rdquo;). Set
            it in the <em>Period Name</em> field or via the Notes field.
          </li>
          <li>
            Mandatory deductions (GSIS, PhilHealth, Pag-IBIG, BIR withholding)
            are <strong>not applied</strong> by default unless configured by the
            Payroll Master after the period is created.
          </li>
          <li>
            Special payroll runs are excluded from regular 15th/30th payroll
            reports — they appear in a separate Special Payroll register.
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <PeriodForm defaultScope="special" />
      </div>
    </main>
  );
}
