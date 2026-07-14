/**
 * Payroll income/deduction bulk upload — TOR 1.8.1 (PAY-014).
 *
 * CSV staging → validation preview → all-or-nothing commit into
 * payroll_employee_inputs (consumed by Process Payroll as otherAdjustments).
 * Backend chain: uploadPayrollInputsCsv / commitPayrollInputsUpload in
 * src/lib/actions/payroll-gaps.ts.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layouts/page-header";
import { Button } from "@/components/ui/button";
import { PeriodStatusBadge } from "@/components/payroll/period-status-badge";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  payrollEmployeeInputs,
  payrollBulkUploads,
  employees,
} from "@/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { getPayrollPeriodById } from "../../queries";
import { InputsUploadClient } from "./_client";

export const metadata = { title: "Income & Deduction Upload" };

interface Props {
  params: Promise<{ periodId: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PayrollInputsPage({ params }: Props) {
  const { periodId } = await params;
  if (!UUID_RE.test(periodId)) notFound();
  // Upload/commit is an editing surface — gate the whole page on payroll.edit.
  await requirePermission("payroll", "edit");

  const period = await getPayrollPeriodById(periodId);
  if (!period) notFound();

  const [committedInputs, uploads] = await Promise.all([
    db
      .select({
        id: payrollEmployeeInputs.id,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        lastName: employees.lastName,
        otherIncome: payrollEmployeeInputs.otherIncome,
        otherDeductions: payrollEmployeeInputs.otherDeductions,
        remarks: payrollEmployeeInputs.remarks,
      })
      .from(payrollEmployeeInputs)
      .innerJoin(employees, eq(payrollEmployeeInputs.employeeId, employees.id))
      .where(eq(payrollEmployeeInputs.periodId, periodId))
      .orderBy(asc(employees.lastName), asc(employees.firstName)),
    db
      .select({
        id: payrollBulkUploads.id,
        fileName: payrollBulkUploads.fileName,
        recordCount: payrollBulkUploads.recordCount,
        validCount: payrollBulkUploads.validCount,
        errorCount: payrollBulkUploads.errorCount,
        status: payrollBulkUploads.status,
        createdAt: payrollBulkUploads.createdAt,
      })
      .from(payrollBulkUploads)
      .where(eq(payrollBulkUploads.periodId, periodId))
      .orderBy(desc(payrollBulkUploads.createdAt))
      .limit(10),
  ]);

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Income & Deduction Upload"
        description={`Bulk other-income / other-deduction inputs for ${period.name}.`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: period.name, href: `/payroll/${periodId}` },
          { label: "Inputs" },
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

      <InputsUploadClient
        periodId={periodId}
        periodName={period.name}
        periodStatus={period.status}
        periodScope={period.scope}
        committedInputs={committedInputs.map((row) => ({
          ...row,
          otherIncome: String(row.otherIncome),
          otherDeductions: String(row.otherDeductions),
        }))}
        uploads={uploads.map((u) => ({
          ...u,
          createdAt:
            u.createdAt instanceof Date
              ? u.createdAt.toISOString()
              : String(u.createdAt),
        }))}
      />
    </main>
  );
}
