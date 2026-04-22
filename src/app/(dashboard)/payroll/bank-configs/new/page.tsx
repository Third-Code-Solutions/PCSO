import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { BankConfigForm } from "../_components/bank-config-form";

export const metadata = { title: "New Bank Configuration" };

export default async function NewBankConfigPage() {
  await requirePermission("payroll", "create");

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New Bank Configuration"
        description="Configure CSV column mapping for bank hash file generation (PAY-010)."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Bank Configurations", href: "/payroll/bank-configs" },
          { label: "New Configuration" },
        ]}
      />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <BankConfigForm />
      </div>
    </main>
  );
}
