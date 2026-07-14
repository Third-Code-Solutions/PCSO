/**
 * Ad Hoc Report Builder — TOR 1.3.26 (employees) + TOR 1.2.29 (RPM
 * applications)
 *
 * Parameterized reports: the caller picks columns from a catalog and applies
 * filters; results render as a dynamic table with CSV export. Column
 * catalogs live in src/lib/utils/pimm/adhoc-report.ts.
 */

import { requirePermission } from "@/lib/auth/guards";
import {
  getOfficesForReportFilters,
  getVacanciesForReportFilters,
} from "@/lib/actions/reports/workforce-reports";
import { AdhocReportClient } from "./_client";

export const metadata = {
  title: "Ad Hoc Report Builder",
  description: "Column-picker reports for employees and RPM applications.",
};

export default async function AdhocReportPage() {
  await requirePermission("reports", "view");
  const [offices, vacancies] = await Promise.all([
    getOfficesForReportFilters(),
    getVacanciesForReportFilters(),
  ]);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          Ad Hoc Report Builder
        </h1>
        <p className="text-sm text-muted-foreground">
          Pick columns and filters to build employee (TOR 1.3.26) or RPM
          application (TOR 1.2.29) reports
        </p>
      </header>

      <AdhocReportClient offices={offices} vacancies={vacancies} />
    </div>
  );
}
