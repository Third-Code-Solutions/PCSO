import Link from "next/link";
import { Plus, FileText, TrendingUp } from "lucide-react";
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

export const metadata = { title: "Salary Differential Payroll" };

export default async function DifferentialPayrollPage() {
  await requirePermission("payroll", "view");

  const periods = await db
    .select()
    .from(payrollPeriods)
    .where(
      and(
        eq(payrollPeriods.scope, "salary_differential"),
        isNull(payrollPeriods.deletedAt),
      ),
    )
    .orderBy(desc(payrollPeriods.createdAt))
    .limit(50);

  return (
    <main className="space-y-8">
      <PageHeader
        title="Salary Differential Payroll"
        description="Retroactive pay adjustments per PAY-006. Computed as (new rate − old rate) × applicable months, subject to BIR withholding on the differential amount."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Differential" },
        ]}
        actions={
          <Button
            size="sm"
            asChild
            className="bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/differential/new">
              <Plus className="mr-2 h-4 w-4" />
              New Differential Run
            </Link>
          </Button>
        }
      />

      {periods.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 py-20 text-center">
          <TrendingUp className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold text-foreground">
            No salary differential runs yet
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Create a salary differential payroll run when employees are entitled
            to retroactive pay due to approved salary adjustments, promotions,
            or SSL/CPCS schedule updates.
          </p>
          <Button
            size="sm"
            asChild
            className="mt-6 bg-[#0B2545] text-white hover:bg-[#13315C]"
          >
            <Link href="/payroll/differential/new">
              <Plus className="mr-2 h-4 w-4" />
              New Differential Run
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
                  <TableHead>Retroactive Period</TableHead>
                  <TableHead>Pay Date</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Gross Differential</TableHead>
                  <TableHead>Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => (
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
                      {period.totalGrossPay != null ? (
                        <>
                          ₱
                          {parseFloat(period.totalGrossPay).toLocaleString(
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
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Regulatory reference panel */}
      <div className="rounded-xl border border-[#C8A84B]/30 bg-[#C8A84B]/5 p-5">
        <h3 className="mb-2 text-sm font-semibold text-[#0B2545]">
          PAY-006 — Salary Differential Reference
        </h3>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Formula:</span> (New
            Rate − Old Rate) × Number of Applicable Months = Differential Amount
          </li>
          <li>
            <span className="font-medium text-foreground">Period range:</span>{" "}
            Selectable retroactive start and end dates (the period of the salary
            adjustment, not the payment date).
          </li>
          <li>
            <span className="font-medium text-foreground">Tax treatment:</span>{" "}
            Differential amount is subject to BIR withholding tax. System
            computes withholding on the differential amount per TRAIN Law.
          </li>
          <li>
            <span className="font-medium text-foreground">Trigger:</span>{" "}
            Usually triggered by approved salary adjustments (NOSA), SSL/CPCS
            schedule updates, or step increment issuances (NOSI).
          </li>
        </ul>
      </div>
    </main>
  );
}
