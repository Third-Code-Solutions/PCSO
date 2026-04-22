import { PageHeader } from "@/components/layouts/page-header";
import { PeriodForm } from "@/components/payroll/period-form";
import { requirePermission } from "@/lib/auth/guards";

export const metadata = { title: "New Cash Advance Payroll" };

export default async function NewCashAdvancePage() {
  await requirePermission("payroll", "create");

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New Cash Advance Payroll"
        description="Create a cash advance payroll run for loan deductions."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Cash Advance", href: "/payroll/cash-advance" },
          { label: "New" },
        ]}
      />
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <PeriodForm defaultScope="cash_advance" />
      </div>
    </main>
  );
}
