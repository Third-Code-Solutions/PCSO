/**
 * NAP Archival Report — TOR 1.3.19
 *
 * Separated employees (resigned / retired / terminated / deceased, or
 * soft-deleted records) with hire and separation years, mode of separation,
 * last position held, step increment count, and loyalty milestones reached —
 * per National Archives of the Philippines archival guidelines (PIM-009).
 */

import { requirePermission } from "@/lib/auth/guards";
import { getOfficesForReportFilters } from "@/lib/actions/reports/workforce-reports";
import { NapArchivalClient } from "./_client";

export const metadata = {
  title: "NAP Archival Report",
  description: "Separated employee records for NAP archival.",
};

export default async function NapArchivalPage() {
  await requirePermission("reports", "view");
  const offices = await getOfficesForReportFilters();

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          NAP Archival Report
        </h1>
        <p className="text-sm text-muted-foreground">
          Separated employees with service history for National Archives
          compliance (TOR 1.3.19)
        </p>
      </header>

      <NapArchivalClient offices={offices} />
    </div>
  );
}
