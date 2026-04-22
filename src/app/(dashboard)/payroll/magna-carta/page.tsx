import Link from "next/link";
import { Plus, FileText, Shield } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { PeriodStatusBadge } from "@/components/payroll/period-status-badge";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { payrollPeriods } from "@/lib/db/schema";
import { eq, isNull, desc, and } from "drizzle-orm";
import type { PayrollPeriod } from "@/lib/db/schema";

export const metadata = { title: "Magna Carta Benefits" };

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPeso(value: string | null | undefined): string {
  if (!value) return "—";
  const num = parseFloat(value);
  return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Infer Women / PWD type from period name for display label. */
function getMagnaCartaType(name: string): { label: string; color: string } {
  const lower = name.toLowerCase();
  if (
    lower.includes("pwd") ||
    lower.includes("7277") ||
    lower.includes("disability")
  ) {
    return { label: "PWD — RA 7277", color: "bg-blue-100 text-blue-700" };
  }
  if (lower.includes("women") || lower.includes("9710")) {
    return { label: "Women — RA 9710", color: "bg-pink-100 text-pink-700" };
  }
  return { label: "Magna Carta", color: "bg-purple-100 text-purple-700" };
}

function PeriodCard({ period }: { period: PayrollPeriod }) {
  const typeTag = getMagnaCartaType(period.name);

  return (
    <Link href={`/payroll/${period.id}`} className="group block">
      <article className="rounded-xl border border-border bg-card p-5 transition-all hover:border-[#C8A84B] hover:shadow-md">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-[#0B2545] group-hover:underline">
              {period.name}
            </h3>
            <div className="mt-1 flex items-center gap-1.5">
              <Shield className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeTag.color}`}
              >
                {typeTag.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDate(period.periodStart)} – {formatDate(period.periodEnd)}
            </p>
          </div>
          <PeriodStatusBadge status={period.status} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/40 p-2">
            <p className="text-xs text-muted-foreground">Net Pay</p>
            <p className="mt-0.5 text-sm font-semibold text-[#0B2545]">
              {formatPeso(period.totalNetPay)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <p className="text-xs text-muted-foreground">Employees</p>
            <p className="mt-0.5 text-sm font-semibold text-[#0B2545]">
              {period.employeeCount ?? "—"}
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <p className="text-xs text-muted-foreground">Pay Date</p>
            <p className="mt-0.5 text-sm font-semibold text-[#0B2545]">
              {formatDate(period.payDate)}
            </p>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default async function MagnaCartaPayrollPage() {
  await requirePermission("payroll", "view");

  const periods = await db
    .select()
    .from(payrollPeriods)
    .where(
      and(
        eq(payrollPeriods.scope, "magna_carta"),
        isNull(payrollPeriods.deletedAt),
      ),
    )
    .orderBy(desc(payrollPeriods.createdAt))
    .limit(20);

  const activePeriods = periods.filter(
    (p: PayrollPeriod) => p.status === "processing" || p.status === "approved",
  );
  const draftPeriods = periods.filter(
    (p: PayrollPeriod) => p.status === "draft",
  );
  const closedPeriods = periods.filter(
    (p: PayrollPeriod) => p.status === "paid",
  );

  return (
    <main className="space-y-8">
      <PageHeader
        title="Magna Carta Benefits Payroll"
        description="RA 9710 (Women) and RA 7277 (PWD) benefits per PAY-008."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Magna Carta" },
        ]}
        actions={
          <Button
            size="sm"
            asChild
            className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/magna-carta/new">
              <Plus className="mr-2 h-4 w-4" />
              New Magna Carta Run
            </Link>
          </Button>
        }
      />

      {/* Reference banner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-pink-200 bg-pink-50 px-5 py-4">
          <p className="text-sm font-semibold text-pink-800">
            RA 9710 — Women&apos;s Benefits
          </p>
          <p className="mt-1 text-xs text-pink-700">
            Magna Carta of Women. Covers special leave benefits for female
            employees (up to 2 months with pay after gynecological surgery),
            safe spaces, and other gender-based entitlements.
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
          <p className="text-sm font-semibold text-blue-800">
            RA 7277 — PWD Benefits
          </p>
          <p className="mt-1 text-xs text-blue-700">
            Magna Carta for Disabled Persons. Covers rehabilitation leave,
            special allowances, and other benefits for qualified employees with
            disabilities.
          </p>
        </div>
      </div>

      {/* Active Periods */}
      {activePeriods.length > 0 && (
        <section aria-labelledby="active-heading">
          <h2
            id="active-heading"
            className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#0B2545]"
          >
            In Progress
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {activePeriods.map((period: PayrollPeriod) => (
              <PeriodCard key={period.id} period={period} />
            ))}
          </div>
        </section>
      )}

      {/* Draft Periods */}
      {draftPeriods.length > 0 && (
        <section aria-labelledby="draft-heading">
          <h2
            id="draft-heading"
            className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Drafts
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {draftPeriods.map((period: PayrollPeriod) => (
              <PeriodCard key={period.id} period={period} />
            ))}
          </div>
        </section>
      )}

      {/* Closed Periods */}
      {closedPeriods.length > 0 && (
        <section aria-labelledby="closed-heading">
          <h2
            id="closed-heading"
            className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Completed
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {closedPeriods.map((period: PayrollPeriod) => (
              <PeriodCard key={period.id} period={period} />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {periods.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-20 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold text-foreground">
            No Magna Carta payroll runs yet
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a run for Women (RA 9710) or PWD (RA 7277) benefit
            disbursements.
          </p>
          <Button
            size="sm"
            asChild
            className="mt-6 bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/magna-carta/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Magna Carta Run
            </Link>
          </Button>
        </div>
      )}
    </main>
  );
}
