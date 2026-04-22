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
        description="Create a Magna Carta benefits payroll run per PAY-008."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Magna Carta", href: "/payroll/magna-carta" },
          { label: "New" },
        ]}
      />

      {/* Law reference cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-pink-200 bg-pink-50 px-5 py-4">
          <p className="text-sm font-semibold text-pink-800">
            RA 9710 — Magna Carta of Women
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-pink-700">
            <li>Special leave up to 2 months after gynecological surgery</li>
            <li>Paid at full basic pay (no deduction from SL/VL credits)</li>
            <li>Applicable to female employees only</li>
            <li>Must be supported by medical certificate</li>
          </ul>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="text-sm font-semibold text-blue-800">
            RA 7277 — Magna Carta for Disabled Persons
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-blue-700">
            <li>Rehabilitation leave for PWD employees</li>
            <li>Special allowances per DBM issuances</li>
            <li>Anti-discrimination provisions</li>
            <li>
              Employee must have a PWD Identification Card from DSWD / LGU
            </li>
          </ul>
        </div>
      </div>

      {/* Naming convention tip */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        <strong>Tip:</strong> Include the benefit type in the period name for
        clarity — e.g., &ldquo;Women&apos;s Special Leave — March 2025 (RA
        9710)&rdquo; or &ldquo;PWD Rehabilitation Leave — Q1 2025 (RA
        7277)&rdquo;. This helps filter runs on the list page.
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <PeriodForm defaultScope="magna_carta" />
      </div>
    </main>
  );
}
