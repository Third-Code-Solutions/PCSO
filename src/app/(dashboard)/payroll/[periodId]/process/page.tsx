import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PeriodStatusBadge } from "@/components/payroll/period-status-badge";
import { RecordsTable } from "@/components/payroll/records-table";
import { ExceptionReport } from "@/components/payroll/exception-report";
import { requirePermission } from "@/lib/auth/guards";
import {
  getPayrollPeriodById,
  getPayrollRecordsByPeriod,
  getExceptionRecords,
  getPeriodTotals,
} from "../../queries";
import { PeriodActionsBar } from "../_components/period-actions-bar";

interface Props {
  params: Promise<{ periodId: string }>;
}

function formatPeso(value: string | null | undefined): string {
  if (!value) return "₱0.00";
  const num = parseFloat(value);
  return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function ProcessPayrollPage({ params }: Props) {
  const { periodId } = await params;
  await requirePermission("payroll", "process");

  const [period, records, exceptions, totals] = await Promise.all([
    getPayrollPeriodById(periodId),
    getPayrollRecordsByPeriod(periodId),
    getExceptionRecords(periodId),
    getPeriodTotals(periodId),
  ]);

  if (!period) notFound();

  return (
    <main className="space-y-6">
      <PageHeader
        title="Process Payroll"
        description={`Review computed records for ${period.name} before approval.`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: period.name, href: `/payroll/${periodId}` },
          { label: "Process" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <PeriodStatusBadge status={period.status} />
            <Button variant="outline" size="sm" asChild>
              <Link href={`/payroll/${periodId}`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Period
              </Link>
            </Button>
          </div>
        }
      />

      {/* Workflow bar */}
      <PeriodActionsBar period={period} />

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Records", value: totals.employeeCount.toString() },
          { label: "Gross Pay", value: formatPeso(totals.totalGrossPay) },
          { label: "Deductions", value: formatPeso(totals.totalDeductions) },
          { label: "Net Pay", value: formatPeso(totals.totalNetPay) },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Exception summary */}
      {exceptions.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-800">
              Exception Report — {exceptions.length} Record
              {exceptions.length !== 1 ? "s" : ""} Need Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ExceptionReport records={exceptions} periodId={periodId} />
          </CardContent>
        </Card>
      )}

      {/* Records table */}
      <section aria-labelledby="records-heading">
        <h2
          id="records-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#0B2545]"
        >
          All Payroll Records
        </h2>
        <RecordsTable
          records={records}
          periodId={periodId}
          periodStatus={period.status}
        />
      </section>
    </main>
  );
}
