import { PageHeader } from "@/components/layouts/page-header";
import { PeriodForm } from "@/components/payroll/period-form";
import { requirePermission } from "@/lib/auth/guards";

export const metadata = { title: "New Magna Carta Payroll" };

export default async function NewMagnaCartaPage() {
  await requirePermission("payroll", "create");

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New Magna Carta Payroll"
        description="Create a Magna Carta benefits payroll run."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Magna Carta", href: "/payroll/magna-carta" },
          { label: "New" },
        ]}
      />
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <PeriodForm defaultScope="magna_carta" />
      </div>
    </main>
  );
}
