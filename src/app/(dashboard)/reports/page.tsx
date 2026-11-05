/**
 * Reports Hub — entry point for all PIMM workforce reports.
 *
 * TOR coverage: 1.3.3 (personnel categories), 1.3.4 (qualifications),
 * 1.3.15 (step increments), 1.3.17 (PDS submission), 1.3.18 (office
 * clearance), 1.3.19 (NAP archival),
 * 1.3.21 (personnel complement), 1.3.24 (HR accomplishments),
 * 1.3.26 / 1.2.29 (ad hoc report builder), plus the existing PIM-019
 * retirement and PIM-020 loyalty reports.
 */

import Link from "next/link";
import {
  Archive,
  Award,
  BarChart3,
  Building2,
  CalendarClock,
  ClipboardCheck,
  FileCheck,
  GraduationCap,
  UserCheck,
  Table2,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePermission } from "@/lib/auth/guards";

export const metadata = {
  title: "Reports",
  description: "PIMM workforce, compliance, and ad hoc reports.",
};

const REPORT_GROUPS = [
  {
    heading: "Workforce Reports",
    reports: [
      {
        href: "/reports/personnel-categories",
        title: "Personnel Categories",
        description:
          "Organic vs non-organic employee listing by appointment type (TOR 1.3.3).",
        icon: Users,
      },
      {
        href: "/reports/personnel-complement",
        title: "Personnel Complement",
        description:
          "Headcount, sex split, plantilla utilization, Head Office vs branches (TOR 1.3.21).",
        icon: Building2,
      },
      {
        href: "/reports/step-increments",
        title: "Step Increment Eligibility",
        description:
          "Employees eligible for a salary step increment per CSC MC 6, s. 2012 (TOR 1.3.15).",
        icon: TrendingUp,
      },
      {
        href: "/reports/workforce/retirement",
        title: "Retirement Eligibility",
        description:
          "Optional and compulsory retirement look-ahead list (PIM-019).",
        icon: CalendarClock,
      },
      {
        href: "/reports/workforce/loyalty",
        title: "Loyalty Award Eligibility",
        description: "10 to 45-year service milestone awardees (PIM-020).",
        icon: Award,
      },
      {
        href: "/reports/workforce/qualifications",
        title: "Employee Qualifications",
        description:
          "Education, eligibilities, trainings and experience per employee (TOR 1.3.4).",
        icon: GraduationCap,
      },
    ],
  },
  {
    heading: "Records & Compliance",
    reports: [
      {
        href: "/reports/nap-archival",
        title: "NAP Archival Report",
        description:
          "Separated employees with service history for NAP archival (TOR 1.3.19).",
        icon: Archive,
      },
      {
        href: "/reports/workforce/pds-submissions",
        title: "PDS Submission",
        description:
          "Employees with and without a submitted Personal Data Sheet (TOR 1.3.17).",
        icon: FileCheck,
      },
      {
        href: "/reports/workforce/clearance",
        title: "Office Clearance",
        description:
          "Clearance processing status for active and separated employees (TOR 1.3.18).",
        icon: UserCheck,
      },
      {
        href: "/reports/hr-accomplishments",
        title: "HR Accomplishment Report",
        description:
          "Per-processor document, PDS, and 201-file validation statistics (TOR 1.3.24).",
        icon: ClipboardCheck,
      },
    ],
  },
  {
    heading: "Ad Hoc",
    reports: [
      {
        href: "/reports/adhoc",
        title: "Ad Hoc Report Builder",
        description:
          "Pick columns and filters for employee and RPM application reports (TOR 1.3.26 / 1.2.29).",
        icon: Table2,
      },
    ],
  },
];

export default async function ReportsHubPage() {
  await requirePermission("reports", "view");

  return (
    <div className="space-y-8 p-6">
      <header className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8 text-pcso-navy" />
        <div>
          <h1 className="font-serif text-2xl font-bold text-pcso-navy">
            Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Workforce, compliance, and ad hoc PIMM reports with CSV export
          </p>
        </div>
      </header>

      {REPORT_GROUPS.map((group) => (
        <section key={group.heading} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {group.heading}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.reports.map((report) => (
              <Link key={report.href} href={report.href} className="group">
                <Card className="h-full transition-colors group-hover:border-pcso-navy/40 group-hover:bg-muted/40">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <report.icon className="h-5 w-5 text-pcso-navy" />
                      <CardTitle className="text-base">
                        {report.title}
                      </CardTitle>
                    </div>
                    <CardDescription>{report.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
