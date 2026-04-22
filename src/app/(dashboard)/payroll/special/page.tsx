import Link from "next/link";
import { Plus, FileText, Tag } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { PeriodStatusBadge } from "@/components/payroll/period-status-badge";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { payrollPeriods } from "@/lib/db/schema";
import { eq, isNull, desc, and } from "drizzle-orm";
import type { PayrollPeriod } from "@/lib/db/schema";

export const metadata = { title: "Special Payroll" };

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

function PeriodCard({ period }: { period: PayrollPeriod }) {
  return (
    <Link href={`/payroll/${period.id}`} className="group block">
      <article className="rounded-xl border border-border bg-card p-5 transition-all hover:border-[#C8A84B] hover:shadow-md">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-[#0B2545] group-hover:underline">
              {period.name}
            </h3>
            {period.customTitle && (
              <div className="mt-1 flex items-center gap-1.5">
                <Tag className="h-3 w-3 text-[#C8A84B] shrink-0" />
                <p className="truncate text-xs font-medium text-[#C8A84B]">
                  {period.customTitle}
                </p>
              </div>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
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

        {period.skipMandatoryDeductions && (
          <div className="mt-3 rounded-md bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
            No mandatory deductions applied to this run.
          </div>
        )}
      </article>
    </Link>
  );
}

export default async function SpecialPayrollPage() {
  await requirePermission("payroll", "view");

  const periods = await db
    .select()
    .from(payrollPeriods)
    .where(
      and(
        eq(payrollPeriods.scope, "special"),
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
        title="Special Payroll"
        description="Custom payroll runs with configurable title per PAY-007. No mandatory deductions unless explicitly configured."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Special" },
        ]}
        actions={
          <Button
            size="sm"
            asChild
            className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/special/new">
              <Plus className="mr-2 h-4 w-4" />
              New Special Run
            </Link>
          </Button>
        }
      />

      {/* Info banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
        <strong>PAY-007 — Special Payroll:</strong> Each run requires a custom
        title (e.g., "Hazard Pay — March 2025"). Mandatory deductions (GSIS,
        PhilHealth, Pag-IBIG, BIR) are <em>not</em> applied unless the Payroll
        Master explicitly configures them for the run.
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

      {/* Closed / Paid Periods */}
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
            No special payroll runs yet
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a special payroll run with a custom title (e.g., Hazard Pay,
            Emergency Relief).
          </p>
          <Button
            size="sm"
            asChild
            className="mt-6 bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/special/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Special Run
            </Link>
          </Button>
        </div>
      )}
    </main>
  );
}
