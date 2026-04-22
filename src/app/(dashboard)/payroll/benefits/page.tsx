import Link from "next/link";
import { Plus, FileText, Gift } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { payrollPeriods } from "@/lib/db/schema";
import { eq, isNull, desc, and } from "drizzle-orm";
import { PeriodStatusBadge } from "@/components/payroll/period-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";

export const metadata = { title: "Benefits & Bonuses Payroll" };

const BENEFIT_TYPE_MAP: Record<string, { label: string; color: string }> = {
  "Mid-Year Bonus": {
    label: "Mid-Year Bonus",
    color: "text-blue-700 bg-blue-50 border-blue-200",
  },
  "Year-End Bonus": {
    label: "Year-End Bonus",
    color: "text-purple-700 bg-purple-50 border-purple-200",
  },
  "Cash Gift": {
    label: "Cash Gift",
    color: "text-green-700 bg-green-50 border-green-200",
  },
  PBB: { label: "PBB", color: "text-amber-700 bg-amber-50 border-amber-200" },
};

function inferBenefitType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("mid-year") || lower.includes("mid year"))
    return "Mid-Year Bonus";
  if (
    lower.includes("year-end") ||
    lower.includes("year end") ||
    lower.includes("yeb")
  )
    return "Year-End Bonus";
  if (lower.includes("cash gift") || lower.includes("cashgift"))
    return "Cash Gift";
  if (lower.includes("pbb")) return "PBB";
  return "Benefits Bonus";
}

export default async function BenefitsPayrollPage() {
  await requirePermission("payroll", "view");

  const periods = await db
    .select()
    .from(payrollPeriods)
    .where(
      and(
        eq(payrollPeriods.scope, "benefits_bonuses"),
        isNull(payrollPeriods.deletedAt),
      ),
    )
    .orderBy(desc(payrollPeriods.createdAt))
    .limit(50);

  return (
    <main className="space-y-8">
      <PageHeader
        title="Benefits & Bonuses Payroll"
        description="Mid-Year Bonus, Year-End Bonus, Cash Gift, and PBB runs per PAY-005. Tax treatment follows TRAIN Law de minimis rules (PHP 90,000 ceiling)."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Benefits" },
        ]}
        actions={
          <Button
            size="sm"
            asChild
            className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/benefits/new">
              <Plus className="mr-2 h-4 w-4" />
              New Benefit Run
            </Link>
          </Button>
        }
      />

      {periods.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-20 text-center">
          <Gift className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold text-foreground">
            No benefits payroll runs yet
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create your first benefits and bonuses payroll run. Covers Mid-Year
            Bonus, Year-End Bonus, Cash Gift (₱5,000), and PBB per PAY-005.
          </p>
          <Button
            size="sm"
            asChild
            className="mt-6 bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/benefits/new">
              <Plus className="mr-2 h-4 w-4" />
              New Benefit Run
            </Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {periods.length} payroll run{periods.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Pay Date</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => {
                  const benefitType = inferBenefitType(period.name);
                  const typeConfig = BENEFIT_TYPE_MAP[benefitType];
                  return (
                    <TableRow key={period.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div>
                          <div className="font-medium text-foreground">
                            {period.name}
                          </div>
                          {period.notes && (
                            <div className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                              {period.notes}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {typeConfig ? (
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${typeConfig.color}`}
                          >
                            {typeConfig.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {benefitType}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(period.periodStart), "MMM d")} –{" "}
                        {format(new Date(period.periodEnd), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(period.payDate), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {period.employeeCount != null ? (
                          period.employeeCount.toLocaleString()
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {period.totalNetPay != null ? (
                          <>
                            ₱
                            {parseFloat(period.totalNetPay).toLocaleString(
                              "en-PH",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <PeriodStatusBadge status={period.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="text-[#0B2545] hover:bg-[#0B2545]/10"
                        >
                          <Link href={`/payroll/${period.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Regulatory reference panel */}
      <div className="rounded-xl border border-[#C8A84B]/30 bg-[#C8A84B]/5 p-5">
        <h3 className="mb-2 text-sm font-semibold text-[#0B2545]">
          PAY-005 — Benefits &amp; Bonuses Reference
        </h3>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Mid-Year Bonus:</span>{" "}
            1 month basic salary. Released June.
          </li>
          <li>
            <span className="font-medium text-foreground">Year-End Bonus:</span>{" "}
            1 month basic salary. Released November/December.
          </li>
          <li>
            <span className="font-medium text-foreground">Cash Gift:</span> PHP
            5,000 fixed. Released with Year-End Bonus.
          </li>
          <li>
            <span className="font-medium text-foreground">PBB:</span> Per
            approved PBB-qualified list from Performance Management (PMM-007).
          </li>
          <li>
            <span className="font-medium text-foreground">Tax ceiling:</span>{" "}
            PHP 90,000 total tax-exempt bonuses per year (TRAIN Law). Excess is
            subject to BIR withholding.
          </li>
        </ul>
      </div>
    </main>
  );
}
