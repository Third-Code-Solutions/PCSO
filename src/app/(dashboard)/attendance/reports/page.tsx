/**
 * /attendance/reports — TAM report hub (TOR 1.5.12 / 1.5.14).
 *
 * Links to the four TAM analytics reports: unauthorized absences, tardiness
 * frequency, DTR tabulation, and the ad hoc report builder. Self-service
 * accounts are redirected to their own DTR — these reports expose other
 * employees' attendance records.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarX2,
  ClockAlert,
  Table2,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/guards";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Attendance Reports",
  description: "TAM analytics reports (TOR 1.5.12 / 1.5.14).",
};

const REPORTS = [
  {
    href: "/attendance/reports/unauthorized-absences",
    title: "Unauthorized Absences",
    description:
      "Working-day gaps with no attendance log and no approved leave. Flags employees exceeding 2.5 days per month.",
    icon: CalendarX2,
  },
  {
    href: "/attendance/reports/tardiness",
    title: "Tardiness Frequency",
    description:
      "Tardiness instances per employee per week and month. Flags habitual tardiness (10+ instances/month per CSC).",
    icon: ClockAlert,
  },
  {
    href: "/attendance/reports/tabulation",
    title: "DTR Tabulation",
    description:
      "Per-employee attendance aggregates — presence, absences, tardiness, undertime, and overtime — with office, status, and position filters.",
    icon: Table2,
  },
  {
    href: "/attendance/reports/adhoc",
    title: "Ad Hoc Report Builder",
    description:
      "Pick the columns you need and export attendance data for any date range (TOR 1.5.14).",
    icon: SlidersHorizontal,
  },
] as const;

export default async function AttendanceReportsHubPage() {
  const user = await requirePermission("attendance", "view");
  if (user.role === "employee_self_service") {
    // Org-wide analytics are not part of the self-service scope.
    redirect("/attendance/dtr");
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="font-serif text-2xl font-bold text-pcso-navy">
          Attendance Reports
        </h1>
        <p className="text-sm text-muted-foreground">
          TAM analytics — unauthorized absences, tardiness, tabulation, and ad
          hoc reports (TOR 1.5.12 / 1.5.14)
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((report) => (
          <Link key={report.href} href={report.href} className="group">
            <Card className="h-full transition-colors hover:border-pcso-navy/40 hover:bg-muted/20">
              <CardHeader className="flex flex-row items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-pcso-navy/5 p-2.5">
                    <report.icon className="h-5 w-5 text-pcso-navy" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{report.title}</CardTitle>
                    <CardDescription className="mt-1.5 text-xs leading-relaxed">
                      {report.description}
                    </CardDescription>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
