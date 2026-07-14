/**
 * Payroll Ad Hoc Reports — TOR 1.8.15 (PAY-017).
 *
 * Parametrized report builder: period range / payroll type / office /
 * finalized-only filters, user-selected money columns, on-screen table with
 * totals, and Excel-friendly CSV download. Data comes from
 * getPayrollAdHocReport; shaping/CSV are pure client-side helpers
 * (src/lib/utils/payroll/report-builder.ts).
 */

import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { offices } from "@/lib/db/schema";
import { asc, isNull } from "drizzle-orm";
import { PayrollReportsClient } from "./_client";

export const metadata = { title: "Payroll Reports" };

export default async function PayrollReportsPage() {
  await requirePermission("payroll", "view");

  const officeOptions = await db
    .select({ id: offices.id, name: offices.name })
    .from(offices)
    .where(isNull(offices.deletedAt))
    .orderBy(asc(offices.name));

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Payroll Reports"
        description="Build ad hoc payroll reports: pick a period range, payroll type, and the columns you need, then export to CSV."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Reports" },
        ]}
      />

      <PayrollReportsClient offices={officeOptions} />
    </main>
  );
}
