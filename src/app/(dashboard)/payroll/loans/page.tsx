import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { loanLedger, employees } from "@/lib/db/schema";
import { isNull, desc, eq } from "drizzle-orm";
import { LoanTable } from "./_components/loan-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

export const metadata = { title: "Loan Ledger" };

export default async function LoansPage() {
  await requirePermission("payroll", "view");

  // Fetch all loans with employee details
  const loans = await db
    .select({
      id: loanLedger.id,
      employeeId: loanLedger.employeeId,
      employeeNo: employees.employeeNo,
      employeeName: employees.firstName, // Will format in component
      employeeLastName: employees.lastName,
      loanType: loanLedger.loanType,
      principal: loanLedger.principal,
      startDate: loanLedger.startDate,
      endDate: loanLedger.endDate,
      deductionSchedule: loanLedger.deductionSchedule,
      deductionAmount: loanLedger.deductionAmount,
      runningBalance: loanLedger.runningBalance,
      remarks: loanLedger.remarks,
      createdAt: loanLedger.createdAt,
    })
    .from(loanLedger)
    .innerJoin(employees, eq(loanLedger.employeeId, employees.id))
    .where(isNull(loanLedger.deletedAt))
    .orderBy(desc(loanLedger.createdAt));

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Loan Ledger"
        description="Manage employee loans: GSIS, Pag-IBIG, and PCSO in-house loans."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Loan Ledger" },
        ]}
        actions={
          <Link href="/payroll/loans/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Loan
            </Button>
          </Link>
        }
      />

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <LoanTable loans={loans} />
      </div>
    </main>
  );
}
