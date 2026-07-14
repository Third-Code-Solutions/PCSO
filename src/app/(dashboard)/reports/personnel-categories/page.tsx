/**
 * Personnel Categories Report — TOR 1.3.3
 *
 * Organic (Permanent, Temporary, Coterminous, Casual, CTI) vs Non-Organic
 * (JO, COS, Consultant, Confidential Agent) categorized employee listing.
 */

import { requirePermission } from "@/lib/auth/guards";
import { getOfficesForReportFilters } from "@/lib/actions/reports/workforce-reports";
import { PersonnelCategoriesClient } from "./_client";

export const metadata = {
  title: "Personnel Categories Report",
  description: "Organic vs non-organic categorized employee listing.",
};

export default async function PersonnelCategoriesPage() {
  await requirePermission("reports", "view");
  const offices = await getOfficesForReportFilters();

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          Personnel Categories Report
        </h1>
        <p className="text-sm text-muted-foreground">
          Organic and non-organic personnel listed by appointment type (TOR
          1.3.3)
        </p>
      </header>

      <PersonnelCategoriesClient offices={offices} />
    </div>
  );
}
