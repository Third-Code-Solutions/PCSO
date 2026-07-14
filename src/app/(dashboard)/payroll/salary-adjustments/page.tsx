/**
 * Salary Adjustments — TOR 1.8.11/1.8.12/1.8.13 + 1.3.10 (PAY-011 / PIM-015).
 *
 * HR creates approval-gated salary adjustments (promotion, increase, CPCS
 * migration, correction); approvers effect them, which issues the NOSA
 * (serial + PDF) and auto-updates the 201 salary grade/step.
 */

import { PageHeader } from "@/components/layouts/page-header";
import { requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { listSalaryAdjustments } from "@/lib/actions/payroll/salary-adjustments";
import { SALARY_ADJUSTABLE_APPOINTMENT_TYPES } from "@/lib/utils/payroll/salary-adjustment";
import { SalaryAdjustmentsClient } from "./_client";

export const metadata = { title: "Salary Adjustments" };

export default async function SalaryAdjustmentsPage() {
  const user = await requirePermission("payroll", "view");

  const [adjustments, pickerEmployees] = await Promise.all([
    listSalaryAdjustments({}),
    db
      .select({
        id: employees.id,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        lastName: employees.lastName,
        positionTitle: employees.positionTitle,
        salaryGrade: employees.salaryGrade,
        step: employees.step,
      })
      .from(employees)
      .where(
        and(
          eq(employees.status, "active"),
          // Organic allowlist — contract-rate personnel are never NOSA-adjusted.
          inArray(employees.appointmentType, [
            ...SALARY_ADJUSTABLE_APPOINTMENT_TYPES,
          ]),
          isNull(employees.deletedAt),
        ),
      )
      .orderBy(asc(employees.lastName), asc(employees.firstName)),
  ]);

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Salary Adjustments"
        description="Approval-gated salary updates. Approval issues the Notice of Salary Adjustment (NOSA) and updates the 201 file."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payroll", href: "/payroll" },
          { label: "Salary Adjustments" },
        ]}
      />

      <SalaryAdjustmentsClient
        adjustments={adjustments}
        employees={pickerEmployees}
        canEdit={hasPermission(user.role, "payroll", "edit")}
        canApprove={hasPermission(user.role, "payroll", "approve")}
      />
    </main>
  );
}
