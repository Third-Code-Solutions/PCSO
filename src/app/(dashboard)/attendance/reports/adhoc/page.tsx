/**
 * TAM Ad Hoc Report Builder — TOR 1.5.14.
 *
 * Column-picker report over per-employee attendance aggregates for any date
 * range, with office / status / position filters and CSV export.
 */

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { getTamReportOffices } from "@/lib/actions/attendance/tam-reports";
import { TamAdhocClient } from "./_client";

export const metadata = {
  title: "TAM Ad Hoc Report",
  description: "Attendance ad hoc report builder (TOR 1.5.14).",
};

export default async function TamAdhocPage() {
  const user = await requirePermission("attendance", "view");
  if (user.role === "employee_self_service") redirect("/attendance/dtr");

  const offices = await getTamReportOffices();

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          TAM Ad Hoc Report
        </h1>
        <p className="text-sm text-muted-foreground">
          Build a custom attendance report — pick the columns you need and
          export to CSV (TOR 1.5.14)
        </p>
      </header>

      <TamAdhocClient offices={offices} />
    </div>
  );
}
