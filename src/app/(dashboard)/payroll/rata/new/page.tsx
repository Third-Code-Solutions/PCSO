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
        description="Create a new Representation and Transportation Allowance payroll run per PAY-003."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "RATA", href: "/payroll/rata" },
          { label: "New Period" },
        ]}
      />

      {/* PAY-003 RATA regulatory note */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
        <p className="text-sm font-semibold text-blue-800">
          PAY-003 — RATA Tax Treatment
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-blue-700">
          <li>
            RATA is <strong>non-taxable</strong> up to{" "}
            <strong>₱35,000 per month</strong> for qualifying positions (DBM
            issuance).
          </li>
          <li>
            Only the amount in <em>excess</em> of the ₱35,000 ceiling is
            included in taxable compensation for BIR withholding computation.
          </li>
          <li>
            Eligible positions must be pre-configured in File Maintenance
            (FM-017 — Job Grade Category). Employees without an eligible
            position assignment will be excluded from this run.
          </li>
          <li>
            RATA is disbursed separately from the regular 15th/30th payroll run.
            It does not affect the regular payslip gross figure.
          </li>
        </ul>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <PeriodForm defaultScope="rata" />
      </div>
    </main>
  );
}
