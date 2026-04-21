import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ChevronRight, Shield, Heart, Home, FileText } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  gsisRates,
  philhealthRates,
  pagibigRates,
  birTaxTables,
} from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Government Rates — Admin",
};

interface RateSummary {
  label: string;
  href: string;
  icon: LucideIcon;
  currentDate: string | null;
  description: string;
}

async function getRateSummaries(): Promise<RateSummary[]> {
  const today = new Date().toISOString().slice(0, 10);

  const [gsis, philhealth, pagibig, bir] = await Promise.all([
    db
      .select({ effectiveDate: gsisRates.effectiveDate })
      .from(gsisRates)
      .where(sql`${gsisRates.effectiveDate} <= ${today}`)
      .orderBy(desc(gsisRates.effectiveDate))
      .limit(1),
    db
      .select({ effectiveDate: philhealthRates.effectiveDate })
      .from(philhealthRates)
      .where(sql`${philhealthRates.effectiveDate} <= ${today}`)
      .orderBy(desc(philhealthRates.effectiveDate))
      .limit(1),
    db
      .select({ effectiveDate: pagibigRates.effectiveDate })
      .from(pagibigRates)
      .where(sql`${pagibigRates.effectiveDate} <= ${today}`)
      .orderBy(desc(pagibigRates.effectiveDate))
      .limit(1),
    db
      .select({ effectiveDate: birTaxTables.effectiveDate })
      .from(birTaxTables)
      .where(sql`${birTaxTables.effectiveDate} <= ${today}`)
      .orderBy(desc(birTaxTables.effectiveDate))
      .limit(1),
  ]);

  return [
    {
      label: "GSIS Rates",
      href: "/admin/rates/gsis",
      icon: Shield,
      currentDate: gsis[0]?.effectiveDate ?? null,
      description: "Employee/employer share rates and life insurance premiums.",
    },
    {
      label: "PhilHealth Rates",
      href: "/admin/rates/philhealth",
      icon: Heart,
      currentDate: philhealth[0]?.effectiveDate ?? null,
      description:
        "Monthly premium rates, salary floor and ceiling, contribution limits.",
    },
    {
      label: "Pag-IBIG Rates",
      href: "/admin/rates/pagibig",
      icon: Home,
      currentDate: pagibig[0]?.effectiveDate ?? null,
      description:
        "Employee/employer share rates by salary bracket and maximum contribution.",
    },
    {
      label: "BIR TRAIN Tax Tables",
      href: "/admin/rates/bir",
      icon: FileText,
      currentDate: bir[0]?.effectiveDate ?? null,
      description:
        "Semi-monthly and monthly withholding tax brackets under the TRAIN Law.",
    },
  ];
}

export default async function RatesDashboardPage() {
  await requirePermission("admin", "view");
  const summaries = await getRateSummaries();

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Government Rates"
        description="All rate changes insert a new effective-date row. Historical rates are never overwritten, preserving payroll accuracy for past periods."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin" },
          { label: "Rates" },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {summaries.map(
          ({ label, href, icon: Icon, currentDate, description }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-pcso-navy/10">
                  <Icon className="h-5 w-5 text-pcso-navy" />
                </span>
                <div className="flex-1">
                  <h2 className="font-semibold text-foreground group-hover:text-pcso-navy transition-colors">
                    {label}
                  </h2>
                  {currentDate && (
                    <p className="text-xs text-muted-foreground">
                      Current:{" "}
                      {new Date(currentDate + "T00:00:00").toLocaleDateString(
                        "en-PH",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </p>
            </Link>
          ),
        )}
      </div>
    </div>
  );
}
