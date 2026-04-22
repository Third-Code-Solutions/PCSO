import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { LoanForm } from "../_components/loan-form";

export const metadata = { title: "New Loan Record" };

export default async function NewLoanPage() {
  await requirePermission("payroll", "create");

  const activeEmployees = await db
    .select({
      id: employees.id,
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
    .from(employees)
    .where(and(isNull(employees.deletedAt), eq(employees.status, "active")))
    .orderBy(employees.lastName, employees.firstName);

  return (
    <main className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New Loan Record"
        description="Record a new employee loan for GSIS, Pag-IBIG, or PCSO in-house loan programs per PAY-009."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Loan Ledger", href: "/payroll/loans" },
          { label: "New Loan" },
        ]}
      />

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <LoanForm employees={activeEmployees} />
      </div>
    </main>
  );
}
