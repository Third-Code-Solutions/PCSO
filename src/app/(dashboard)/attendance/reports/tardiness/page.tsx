/**
 * Tardiness Frequency Report — TOR 1.5.12.
 *
 * Tardiness instance counts per employee per week and month. Flags habitual
 * tardiness (10 or more instances within a calendar month per CSC rules).
 */

import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/guards";
import { getTamReportOffices } from "@/lib/actions/attendance/tam-reports";
import { TardinessFrequencyClient } from "./_client";

export const metadata = {
  title: "Tardiness Frequency Report",
  description: "Tardiness instances per employee (TOR 1.5.12).",
};

export default async function TardinessFrequencyPage() {
  const user = await requirePermission("attendance", "view");
  if (user.role === "employee_self_service") redirect("/attendance/dtr");

  const offices = await getTamReportOffices();

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          Tardiness Frequency
        </h1>
        <p className="text-sm text-muted-foreground">
          Weekly and monthly tardiness instances per employee — habitual
          tardiness flagged at 10+ instances/month per CSC (TOR 1.5.12)
        </p>
      </header>

      <TardinessFrequencyClient offices={offices} />
    </div>
  );
}
