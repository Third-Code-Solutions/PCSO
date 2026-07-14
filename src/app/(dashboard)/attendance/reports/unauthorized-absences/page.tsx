/**
 * Unauthorized Absences Report — TOR 1.5.12.
 *
 * Employees with working-day gaps (Mon–Fri minus holidays/suspensions) that
 * have no attendance log AND no approved leave. Flags employees exceeding
 * 2.5 days in the month.
 */

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { getTamReportOffices } from "@/lib/actions/attendance/tam-reports";
import { UnauthorizedAbsencesClient } from "./_client";

export const metadata = {
  title: "Unauthorized Absences Report",
  description: "Absences without filed leave (TOR 1.5.12).",
};

export default async function UnauthorizedAbsencesPage() {
  const user = await requirePermission("attendance", "view");
  if (user.role === "employee_self_service") redirect("/attendance/dtr");

  const offices = await getTamReportOffices();

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          Unauthorized Absences
        </h1>
        <p className="text-sm text-muted-foreground">
          Working days with no attendance log and no approved leave — flags
          employees exceeding 2.5 days in the month (TOR 1.5.12)
        </p>
      </header>

      <UnauthorizedAbsencesClient offices={offices} />
    </div>
  );
}
