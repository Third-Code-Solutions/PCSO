import { PageHeader } from "@/components/layouts/page-header";
import { PeriodForm } from "@/components/payroll/period-form";
import { requirePermission } from "@/lib/auth/guards";

export const metadata = { title: "New RATA Payroll Period" };

export default async function NewRataPayrollPage() {
  await requirePermission("payroll", "create");

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New RATA Payroll Period"
        description="Create a new Representation and Transportation Allowance payroll run."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "RATA", href: "/payroll/rata" },
          { label: "New Period" },
        ]}
      />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <PeriodForm defaultScope="rata" />
      </div>
    </main>
  );
}
