/**
 * Employee Qualifications Report — TOR 1.3.4 / PIM-027
 */

import { requirePermission } from "@/lib/auth/guards";
import { getOfficesForReportFilters } from "@/lib/actions/reports/workforce-reports";
import { WorkforceListReport } from "../../_components/workforce-list-report";

export const metadata = {
  title: "Employee Qualifications Report",
  description:
    "Education, eligibilities, trainings and experience by employee.",
};

export default async function Page() {
  await requirePermission("reports", "view");
  const offices = await getOfficesForReportFilters();

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          Employee Qualifications Report
        </h1>
        <p className="text-sm text-muted-foreground">
          Education, eligibilities, trainings and experience by employee (TOR
          1.3.4 / PIM-027)
        </p>
      </header>

      <WorkforceListReport kind="qualifications" offices={offices} />
    </div>
  );
}
