import { PageHeader } from "@/components/layouts/page-header";
import { PeriodForm } from "@/components/payroll/period-form";
import { requirePermission } from "@/lib/auth/guards";

export const metadata = { title: "New Benefits Payroll" };

export default async function NewBenefitsPage() {
  await requirePermission("payroll", "create");

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New Benefits Payroll"
        description="Create a benefits and bonuses payroll run."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Benefits", href: "/payroll/benefits" },
          { label: "New" },
        ]}
      />
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <PeriodForm defaultScope="benefits_bonuses" />
      </div>
    </main>
  );
}
