/**
 * Atomic provisioning for a newly appointed employee.
 *
 * CLAUDE.md §12.3 (APPOINTED state):
 *   - Create employee record
 *   - Link plantilla position (filledByEmployeeId)
 *   - Create payroll record scaffolding (first-period seed)
 *   - Open leave ledger (vacation + sick, opening balances)
 *   - Assign attendance/DTR profile
 *   - Audit every write
 *   - Update application + vacancy pipeline to APPOINTED
 *
 * Every step runs inside the caller's Drizzle transaction. Any thrown error
 * rolls back the whole tx — partial employee records must NEVER be committed.
 *
 * Internal promotion (application filed by a current employee, H-38): the
 * existing 201 record is updated in place — no new employee number, no second
 * leave ledger — and the employee's previous plantilla item is vacated.
 */

import { and, eq, ne, sql } from "drizzle-orm";
import {
  employees,
  plantillaPositions,
  leaveTypes,
  leaveCredits,
  auditLogs,
} from "@/lib/db/schema";
import { employeeSchedules } from "@/lib/db/schema/attendance";
import { applications, vacancies } from "@/lib/db/schema/recruitment";
import type { Tx } from "@/lib/db/transaction";

// ─── Input ────────────────────────────────────────────────────────────────────

export interface OpeningLeaveBalance {
  /** Matches leaveTypes.code, e.g. 'VL', 'SL'. */
  leaveTypeCode: string;
  totalCredits: string;
  usedCredits?: string;
  carryOver?: string;
}

export interface ApplicantPersonalInfo {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  suffix?: string | null;
  birthDate: string; // ISO date
  gender: "male" | "female" | "prefer_not_to_say";
  civilStatus:
    | "single"
    | "married"
    | "widowed"
    | "legally_separated"
    | "annulled";
  nationality?: string;
  email?: string | null;
  phone?: string | null;
  tin?: string | null;
  gsisNo?: string | null;
  philhealthNo?: string | null;
  pagibigNo?: string | null;
}

export interface AppointmentIssueInput {
  applicationId: string;
  /** Plantilla row id — we mark it filled and copy its itemNo. */
  positionId: string;
  officeId: string;
  /** Plantilla itemNo, already reserved upstream. */
  itemNumber: string;
  salaryGrade: number;
  stepIncrement: number;
  appointmentType:
    | "permanent"
    | "temporary"
    | "coterminous"
    | "casual"
    | "job_order"
    | "contract_of_service";
  effectiveDate: string; // ISO date
  positionTitle: string;
  appointingAuthorityEmployeeId: string;
  /** Optional — populated only when migrating existing employees. */
  openingLeaveBalances?: ReadonlyArray<OpeningLeaveBalance>;
  /** Optional — work_schedules.id assigned from the effective date. */
  workScheduleId?: string;
  /**
   * Set for internal promotion: the applicant is already this employee, so
   * the 201 record is updated instead of a new one being created.
   */
  existingEmployeeId?: string;
  /** Applicant personal info lifted from the application. */
  applicant: ApplicantPersonalInfo;
  /** The system user issuing the appointment (drives audit_logs.userId). */
  issuedByUserId: string;
}

export interface AutoProvisionResult {
  employeeId: string;
  employeeNo: string;
  plantillaId: string;
  leaveLedgerIds: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface EmployeeNoRow {
  employee_no: string;
}

async function generateEmployeeNoInTx(tx: Tx): Promise<string> {
  const year = new Date().getUTCFullYear();
  const prefix = `PCSO-${year}-`;

  const rows = (await tx.execute(sql`
    select employee_no
      from employees
      where employee_no like ${prefix + "%"}
        and deleted_at is null
      order by employee_no desc
      limit 1
  `)) as unknown as EmployeeNoRow[];

  const latest = rows[0]?.employee_no;
  const nextSeq = latest ? parseInt(latest.replace(prefix, ""), 10) + 1 : 1;
  return `${prefix}${nextSeq.toString().padStart(4, "0")}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

/**
 * Atomically provision a newly-appointed employee inside the caller's
 * transaction. Throws to roll back on any failure.
 */
export async function atomicallyProvisionNewEmployee(
  tx: Tx,
  input: AppointmentIssueInput,
): Promise<AutoProvisionResult> {
  if (input.existingEmployeeId) {
    return promoteExistingEmployee(tx, input, input.existingEmployeeId);
  }

  // 1. Generate employee number (PCSO-YYYY-NNNN)
  const employeeNo = await generateEmployeeNoInTx(tx);

  // 2. Insert employees row
  const [employeeRow] = await tx
    .insert(employees)
    .values({
      employeeNo,
      firstName: input.applicant.firstName,
      middleName: input.applicant.middleName ?? null,
      lastName: input.applicant.lastName,
      suffix: input.applicant.suffix ?? null,
      birthDate: input.applicant.birthDate,
      gender: input.applicant.gender,
      civilStatus: input.applicant.civilStatus,
      nationality: input.applicant.nationality ?? "Filipino",
      email: input.applicant.email ?? null,
      phone: input.applicant.phone ?? null,
      tin: input.applicant.tin ?? null,
      gsisNo: input.applicant.gsisNo ?? null,
      philhealthNo: input.applicant.philhealthNo ?? null,
      pagibigNo: input.applicant.pagibigNo ?? null,
      appointmentType: input.appointmentType,
      positionTitle: input.positionTitle,
      salaryGrade: input.salaryGrade,
      step: input.stepIncrement,
      officeId: input.officeId,
      dateHired: input.effectiveDate,
      status: "active",
    })
    .returning({ id: employees.id, employeeNo: employees.employeeNo });

  if (!employeeRow) {
    throw new Error("Auto-provision: employee insert returned no rows");
  }
  const employeeId = employeeRow.id;

  // 3. Mark plantilla position as filled
  const [plantillaRow] = await tx
    .update(plantillaPositions)
    .set({
      isFilled: true,
      employeeId,
      updatedAt: new Date(),
    })
    .where(eq(plantillaPositions.id, input.positionId))
    .returning({ id: plantillaPositions.id });

  if (!plantillaRow) {
    throw new Error(
      `Auto-provision: plantilla position ${input.positionId} not found`,
    );
  }

  // 4. Payroll profile scaffolding — src/lib/db/schema/payroll.ts models payroll
  //    periods + per-period records rather than a standalone employee profile,
  //    so there is no payroll_profiles row to insert here. The first
  //    payroll_records row is created by the payroll batch run. We intentionally
  //    skip payroll scaffolding and rely on the run to pick this employee up.

  // 5. Leave ledger — one row per active leave type
  const year = new Date(input.effectiveDate).getUTCFullYear();
  const allLeaveTypes = await tx
    .select({
      id: leaveTypes.id,
      code: leaveTypes.code,
    })
    .from(leaveTypes)
    .where(eq(leaveTypes.isActive, true));

  const balanceByCode = new Map<string, OpeningLeaveBalance>();
  for (const row of input.openingLeaveBalances ?? []) {
    balanceByCode.set(row.leaveTypeCode, row);
  }

  const leaveLedgerIds: string[] = [];
  for (const lt of allLeaveTypes) {
    const opening = balanceByCode.get(lt.code);
    const totalCredits = opening?.totalCredits ?? "0";
    const usedCredits = opening?.usedCredits ?? "0";
    const carryOver = opening?.carryOver ?? "0";
    const balance = (
      parseFloat(totalCredits) - parseFloat(usedCredits)
    ).toFixed(3);

    const [creditRow] = await tx
      .insert(leaveCredits)
      .values({
        employeeId,
        leaveTypeId: lt.id,
        year,
        totalCredits,
        usedCredits,
        balance,
        carryOver,
      })
      .returning({ id: leaveCredits.id });

    if (!creditRow) {
      throw new Error(
        `Auto-provision: leave ledger insert failed for leaveType=${lt.code}`,
      );
    }
    leaveLedgerIds.push(creditRow.id);
  }

  // 6. Attendance schedule assignment (TAM-001 employee_schedules).
  if (input.workScheduleId) {
    await tx.insert(employeeSchedules).values({
      employeeId,
      scheduleId: input.workScheduleId,
      effectiveFrom: input.effectiveDate,
    });
  }

  // 7. Audit trail — one immutable row for the provisioning event
  await tx.insert(auditLogs).values({
    userId: input.issuedByUserId,
    action: "rpm.employee_provisioned",
    tableName: "employees",
    recordId: employeeId,
    outcome: "success",
    module: "RPM",
    subModule: "appointment",
    newValues: {
      employeeNo,
      applicationId: input.applicationId,
      positionId: input.positionId,
      officeId: input.officeId,
      itemNumber: input.itemNumber,
      salaryGrade: input.salaryGrade,
      stepIncrement: input.stepIncrement,
      appointmentType: input.appointmentType,
      effectiveDate: input.effectiveDate,
      workScheduleId: input.workScheduleId ?? null,
      leaveLedgerIds,
    },
  });

  // 8. Advance the application + vacancy pipeline to APPOINTED.
  await markApplicationAppointed(tx, input.applicationId);

  return {
    employeeId,
    employeeNo,
    plantillaId: plantillaRow.id,
    leaveLedgerIds,
  };
}

async function markApplicationAppointed(
  tx: Tx,
  applicationId: string,
): Promise<void> {
  const [app] = await tx
    .update(applications)
    .set({ status: "appointed", updatedAt: new Date() })
    .where(eq(applications.id, applicationId))
    .returning({ vacancyId: applications.vacancyId });
  if (!app) {
    throw new Error(`Auto-provision: application ${applicationId} not found`);
  }
  await tx
    .update(vacancies)
    .set({
      pipelineStage: "appointed",
      status: "filled",
      updatedAt: new Date(),
    })
    .where(eq(vacancies.id, app.vacancyId));
}

/**
 * Internal promotion: move the existing employee to the new item. Their leave
 * ledger, employee number and schedule carry over unchanged.
 */
/**
 * 201-record changes for an internal promotion. CSC MC 6 s. 2012: promotion
 * restarts the 3-year step-increment clock, so the last-increment date moves
 * to the promotion's effective date. SG/step come from the appointment.
 */
export function promotionUpdate(input: AppointmentIssueInput) {
  return {
    appointmentType: input.appointmentType,
    positionTitle: input.positionTitle,
    salaryGrade: input.salaryGrade,
    step: input.stepIncrement,
    officeId: input.officeId,
    dateLastPromotion: input.effectiveDate,
    dateLastIncrement: input.effectiveDate,
  };
}

async function promoteExistingEmployee(
  tx: Tx,
  input: AppointmentIssueInput,
  employeeId: string,
): Promise<AutoProvisionResult> {
  const [employeeRow] = await tx
    .update(employees)
    .set({ ...promotionUpdate(input), updatedAt: new Date() })
    .where(eq(employees.id, employeeId))
    .returning({ id: employees.id, employeeNo: employees.employeeNo });
  if (!employeeRow) {
    throw new Error(`Auto-provision: employee ${employeeId} not found`);
  }

  // The previous item becomes vacant; the new one is filled.
  await tx
    .update(plantillaPositions)
    .set({ isFilled: false, employeeId: null, updatedAt: new Date() })
    .where(
      and(
        eq(plantillaPositions.employeeId, employeeId),
        ne(plantillaPositions.id, input.positionId),
      ),
    );
  const [plantillaRow] = await tx
    .update(plantillaPositions)
    .set({ isFilled: true, employeeId, updatedAt: new Date() })
    .where(eq(plantillaPositions.id, input.positionId))
    .returning({ id: plantillaPositions.id });
  if (!plantillaRow) {
    throw new Error(
      `Auto-provision: plantilla position ${input.positionId} not found`,
    );
  }

  await tx.insert(auditLogs).values({
    userId: input.issuedByUserId,
    action: "rpm.employee_promoted",
    tableName: "employees",
    recordId: employeeId,
    outcome: "success",
    module: "RPM",
    subModule: "appointment",
    newValues: {
      applicationId: input.applicationId,
      positionId: input.positionId,
      officeId: input.officeId,
      itemNumber: input.itemNumber,
      salaryGrade: input.salaryGrade,
      stepIncrement: input.stepIncrement,
      appointmentType: input.appointmentType,
      effectiveDate: input.effectiveDate,
    },
  });

  await markApplicationAppointed(tx, input.applicationId);

  return {
    employeeId,
    employeeNo: employeeRow.employeeNo,
    plantillaId: plantillaRow.id,
    leaveLedgerIds: [],
  };
}
