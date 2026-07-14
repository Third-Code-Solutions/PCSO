/**
 * DTR Tabulation Report — TOR 1.5.12.
 *
 * Per-employee attendance aggregates (days present, absences, tardiness,
 * undertime, overtime) over any date range with office / employment status /
 * position filters.
 */

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { getTamReportOffices } from "@/lib/actions/attendance/tam-reports";
import { DtrTabulationClient } from "./_client";

export const metadata = {
  title: "DTR Tabulation Report",
  description: "Per-employee attendance aggregates (TOR 1.5.12).",
};

export default async function DtrTabulationPage() {
  const user = await requirePermission("attendance", "view");
  if (user.role === "employee_self_service") redirect("/attendance/dtr");

  const offices = await getTamReportOffices();

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          DTR Tabulation
        </h1>
        <p className="text-sm text-muted-foreground">
          Per-employee attendance aggregates with office, status, and position
          filters (TOR 1.5.12)
        </p>
      </header>

      <DtrTabulationClient offices={offices} />
    </div>
  );
}
