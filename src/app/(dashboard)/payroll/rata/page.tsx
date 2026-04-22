import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PeriodStatusBadge } from "@/components/payroll/period-status-badge";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { payrollPeriods } from "@/lib/db/schema";
import { eq, isNull, desc } from "drizzle-orm";
import type { PayrollPeriod } from "@/lib/db/schema";

export const metadata = { title: "RATA Payroll" };

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
          <div>
            <h3 className="font-semibold text-[#0B2545] group-hover:underline">
              {period.name}
            </h3>
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
      </article>
    </Link>
  );
}

export default async function RataPayrollPage() {
  await requirePermission("payroll", "view");

  const periods = await db
    .select()
    .from(payrollPeriods)
    .where(eq(payrollPeriods.scope, "rata"))
    .where(isNull(payrollPeriods.deletedAt))
    .orderBy(desc(payrollPeriods.createdAt))
    .limit(20);

  const activePeriods = periods.filter(
    (p) => p.status === "processing" || p.status === "approved",
  );
  const draftPeriods = periods.filter((p) => p.status === "draft");

  return (
    <main className="space-y-8">
      <PageHeader
        title="RATA Payroll"
        description="Representation and Transportation Allowance (RATA) payroll runs per PAY-003."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "RATA" },
        ]}
        actions={
          <Button
            size="sm"
            asChild
            className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/rata/new">
              <Plus className="mr-2 h-4 w-4" />
              New RATA Run
            </Link>
          </Button>
        }
      />

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
            {activePeriods.map((period) => (
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
            {draftPeriods.map((period) => (
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
            No RATA payroll runs yet
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Create your first RATA payroll period to get started.
          </p>
          <Button
            size="sm"
            asChild
            className="mt-6 bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/rata/new">
              <Plus className="mr-2 h-4 w-4" />
              Create RATA Run
            </Link>
          </Button>
        </div>
      )}
    </main>
  );
}
