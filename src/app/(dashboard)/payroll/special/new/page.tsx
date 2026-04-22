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
        description="Create a special payroll run with custom title."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Special", href: "/payroll/special" },
          { label: "New" },
        ]}
      />
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <PeriodForm defaultScope="special" />
      </div>
    </main>
  );
}
