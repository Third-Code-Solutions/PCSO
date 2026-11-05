/**
 * Office Clearance Report — TOR 1.3.18 / PIM-024
 */

import { requirePermission } from "@/lib/auth/guards";
import { getOfficesForReportFilters } from "@/lib/actions/reports/workforce-reports";
import { WorkforceListReport } from "../../_components/workforce-list-report";

export const metadata = {
  title: "Office Clearance Report",
  description:
    "Clearance processing status for active and separated employees.",
};

export default async function Page() {
  await requirePermission("reports", "view");
  const offices = await getOfficesForReportFilters();

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          Office Clearance Report
        </h1>
        <p className="text-sm text-muted-foreground">
          Clearance processing status for active and separated employees (TOR
          1.3.18 / PIM-024)
        </p>
      </header>

      <WorkforceListReport kind="clearance" offices={offices} />
    </div>
  );
}
