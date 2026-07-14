/**
 * Step Increment Eligibility Report — TOR 1.3.15 (PIM-021 / PMM-009)
 *
 * PIMM surface over the CSC MC 6, s. 2012 step increment eligibility
 * computation (3 consecutive Very Satisfactory or 2 consecutive Outstanding
 * ratings, 3-year cooldown, organic personnel only).
 */

import { requirePermission } from "@/lib/auth/guards";
import { getOfficesForReportFilters } from "@/lib/actions/reports/workforce-reports";
import { StepIncrementsReportClient } from "./_client";

export const metadata = {
  title: "Step Increment Eligibility Report",
  description: "Employees eligible for a salary step increment.",
};

export default async function StepIncrementsReportPage() {
  await requirePermission("reports", "view");
  const offices = await getOfficesForReportFilters();

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          Step Increment Eligibility Report
        </h1>
        <p className="text-sm text-muted-foreground">
          Employees eligible for a salary step increment per CSC MC 6, s. 2012
          (TOR 1.3.15)
        </p>
      </header>

      <StepIncrementsReportClient offices={offices} />
    </div>
  );
}
