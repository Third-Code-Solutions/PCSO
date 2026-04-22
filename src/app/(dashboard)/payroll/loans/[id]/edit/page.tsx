import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loanLedger, employees } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { LoanForm } from "../../_components/loan-form";

export const metadata: Metadata = { title: "Edit Loan Record" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditLoanPage({ params }: PageProps) {
  await requirePermission("payroll", "edit");

  const { id } = await params;

  const [loan, employeeList] = await Promise.all([
    db
      .select()
      .from(loanLedger)
      .where(and(eq(loanLedger.id, id), isNull(loanLedger.deletedAt)))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        id: employees.id,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        lastName: employees.lastName,
      })
      .from(employees)
      .where(and(isNull(employees.deletedAt), eq(employees.status, "active")))
      .orderBy(employees.lastName, employees.firstName),
  ]);

  if (!loan) notFound();

  const defaultValues = {
    employeeId: loan.employeeId,
    loanType: loan.loanType,
    principal: loan.principal,
    startDate: loan.startDate,
    endDate: loan.endDate,
    deductionSchedule: loan.deductionSchedule,
    deductionAmount: loan.deductionAmount,
    remarks: loan.remarks ?? undefined,
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Edit Loan Record"
        description="Update loan details. All changes are audit-logged."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Loan Ledger", href: "/payroll/loans" },
          { label: "Edit Loan" },
        ]}
      />

      <LoanForm
        employees={employeeList}
        defaultValues={defaultValues}
        loanId={loan.id}
      />
    </div>
  );
}
