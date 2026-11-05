/**
 * PDS Submission Report — TOR 1.3.17 / PIM-023
 */

import { requirePermission } from "@/lib/auth/guards";
import { getOfficesForReportFilters } from "@/lib/actions/reports/workforce-reports";
import { WorkforceListReport } from "../../_components/workforce-list-report";

export const metadata = {
  title: "PDS Submission Report",
  description: "Employees with and without a submitted Personal Data Sheet.",
};

export default async function Page() {
  await requirePermission("reports", "view");
  const offices = await getOfficesForReportFilters();

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          PDS Submission Report
        </h1>
        <p className="text-sm text-muted-foreground">
          Employees with and without a submitted Personal Data Sheet (TOR 1.3.17
          / PIM-023)
        </p>
      </header>

      <WorkforceListReport kind="pds" offices={offices} />
    </div>
  );
}
