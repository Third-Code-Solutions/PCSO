"use server";

/**
 * Recruitment Appointments server actions (RPM-022..025).
 *
 * Implements PRD appointment lifecycle:
 * 1. Create appointment from selected applicant
 * 2. Generate CSC documents (appointment, PDS, oath, ATAD, ATAF)
 * 3. Auto-provision employee atomically across modules
 * 4. Update employee profile from RPM
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { eq, and, isNull, desc, ne } from "drizzle-orm";
import {
  appointments,
  appointmentDocuments,
  applications,
  vacancies,
  applicants,
  type NewAppointment,
  type NewAppointmentDocument,
} from "@/lib/db/schema/recruitment";
import { employees } from "@/lib/db/schema/employees";
import { plantillaPositions } from "@/lib/db/schema/plantilla";
import { offices } from "@/lib/db/schema/offices";
import { salaryGrades } from "@/lib/db/schema/government-rates";
import { workSchedules } from "@/lib/db/schema/attendance";
import { requirePermission } from "@/lib/auth/guards";
import { requireRecruitmentViewer } from "@/lib/utils/rpm/recruitment-viewer";
import { withTx } from "@/lib/db/transaction";
import {
  atomicallyProvisionNewEmployee,
  type AppointmentIssueInput,
} from "@/lib/utils/rpm/auto-provision";

// ─── Validation Schemas ──────────────────────────────────────────────────────

const CreateAppointmentSchema = z.object({
  applicationId: z.string().uuid(),
  appointmentDate: z.string().date(),
  effectiveDate: z.string().date(),
  appointmentType: z.enum([
    "permanent",
    "temporary",
    "coterminous",
    "cas",
    "job_order",
    "cos",
  ]),
  notes: z.string().optional(),
});

const ProvisionEmployeeSchema = z.object({
  appointmentId: z.string().uuid(),
});

const GenerateDocumentsSchema = z.object({
  appointmentId: z.string().uuid(),
});

// ─── Serial Number Generation ────────────────────────────────────────────────

async function generateAppointmentNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const lastAppointment = await db
    .select({ appointmentNumber: appointments.appointmentNumber })
    .from(appointments)
    .where(isNull(appointments.deletedAt))
    .orderBy(desc(appointments.createdAt))
    .limit(1);

  let sequence = 1;
  if (lastAppointment.length > 0 && lastAppointment[0]?.appointmentNumber) {
    const match =
      lastAppointment[0].appointmentNumber.match(/APT-\d{4}-(\d{6})/);
    if (match?.[1]) {
      const lastSeq = parseInt(match[1], 10);
      sequence = lastSeq + 1;
    }
  }

  return `APT-${year}-${sequence.toString().padStart(6, "0")}`;
}

// ─── Create Appointment ──────────────────────────────────────────────────────

export async function createAppointment(input: unknown) {
  const user = await requirePermission("employees", "create");
  const result = CreateAppointmentSchema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      error: result.error.issues[0]?.message ?? "Invalid appointment details",
    };
  }
  const parsed = result.data;
  if (!user.employeeId) {
    return {
      success: false,
      error: "Your account is not linked to an employee record",
    };
  }

  const [application] = await db
    .select({
      id: applications.id,
      vacancyId: applications.vacancyId,
      applicantId: applications.applicantId,
      status: applications.status,
    })
    .from(applications)
    .where(
      and(
        eq(applications.id, parsed.applicationId),
        isNull(applications.deletedAt),
      ),
    )
    .limit(1);

  if (!application) {
    return { success: false, error: "Application not found" };
  }

  if (application.status !== "results_released") {
    return {
      success: false,
      error:
        "Only applicants whose results were released as selected can be appointed",
    };
  }

  const [openAppointment] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.applicationId, application.id),
        isNull(appointments.deletedAt),
        ne(appointments.status, "cancelled"),
      ),
    )
    .limit(1);
  if (openAppointment) {
    return {
      success: false,
      error: "An appointment already exists for this application",
    };
  }

  const [vacancy] = await db
    .select({
      id: vacancies.id,
      positionId: vacancies.positionId,
      officeId: vacancies.officeId,
      itemNumber: vacancies.itemNumber,
    })
    .from(vacancies)
    .where(
      and(eq(vacancies.id, application.vacancyId), isNull(vacancies.deletedAt)),
    )
    .limit(1);

  if (!vacancy) {
    return { success: false, error: "Vacancy not found" };
  }

  const [position] = await db
    .select({
      id: plantillaPositions.id,
      salaryGrade: plantillaPositions.salaryGrade,
      positionTitle: plantillaPositions.positionTitle,
    })
    .from(plantillaPositions)
    .where(
      and(
        eq(plantillaPositions.id, vacancy.positionId),
        isNull(plantillaPositions.deletedAt),
      ),
    )
    .limit(1);

  if (!position) {
    return { success: false, error: "Position not found" };
  }

  const monthlySalary = await calculateMonthlySalary(position.salaryGrade, 1);

  const appointmentNumber = await generateAppointmentNumber();

  const newAppointment: NewAppointment = {
    appointmentNumber,
    applicationId: application.id,
    vacancyId: vacancy.id,
    positionId: vacancy.positionId,
    officeId: vacancy.officeId,
    itemNumber: vacancy.itemNumber,
    appointmentDate: parsed.appointmentDate,
    effectiveDate: parsed.effectiveDate,
    salaryGrade: position.salaryGrade,
    stepIncrement: 1,
    monthlySalary: monthlySalary.toString(),
    appointmentType: parsed.appointmentType,
    status: "draft",
    preparedByEmployeeId: user.employeeId,
    notes: parsed.notes,
  };

  const [created] = await db
    .insert(appointments)
    .values(newAppointment)
    .returning({ id: appointments.id });

  revalidatePath("/recruitment/appointments");
  return { success: true, appointmentId: created?.id };
}

async function calculateMonthlySalary(
  salaryGrade: number,
  step: number,
): Promise<number> {
  // Resolve the authoritative SSL/CPCS monthly rate for (grade, step) from the
  // salary-schedule table (most recent schedule in effect). Returns 0 when no
  // rate row exists so the gap is visible to HR, rather than masking it with a
  // hardcoded guess (the old map only covered SG 1-10 and defaulted everything
  // else to PHP 13,000).
  const [row] = await db
    .select({ monthlySalary: salaryGrades.monthlySalary })
    .from(salaryGrades)
    .where(
      and(eq(salaryGrades.grade, salaryGrade), eq(salaryGrades.step, step)),
    )
    .orderBy(desc(salaryGrades.effectiveDate))
    .limit(1);

  return row ? Number(row.monthlySalary) : 0;
}

// ─── Generate Appointment Documents ──────────────────────────────────────────

export async function generateAppointmentDocuments(input: unknown) {
  const user = await requirePermission("employees", "edit");
  const parsed = GenerateDocumentsSchema.parse(input);
  const generatedByEmployeeId = user.employeeId;
  if (!generatedByEmployeeId) {
    return {
      success: false,
      error: "Your account is not linked to an employee record",
    };
  }

  const [appointment] = await db
    .select({
      id: appointments.id,
      appointmentNumber: appointments.appointmentNumber,
      applicationId: appointments.applicationId,
      positionId: appointments.positionId,
      officeId: appointments.officeId,
      salaryGrade: appointments.salaryGrade,
      stepIncrement: appointments.stepIncrement,
      monthlySalary: appointments.monthlySalary,
      appointmentDate: appointments.appointmentDate,
      effectiveDate: appointments.effectiveDate,
      status: appointments.status,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.id, parsed.appointmentId),
        isNull(appointments.deletedAt),
      ),
    )
    .limit(1);

  if (!appointment) {
    return { success: false, error: "Appointment not found" };
  }

  if (appointment.status === "provisioned") {
    return {
      success: false,
      error: "Cannot regenerate documents for provisioned appointment",
    };
  }

  const [application] = await db
    .select({
      id: applications.id,
      applicantId: applications.applicantId,
      personalInfo: applications.personalInfo,
    })
    .from(applications)
    .where(eq(applications.id, appointment.applicationId))
    .limit(1);

  if (!application) {
    return { success: false, error: "Application not found" };
  }

  const [applicant] = await db
    .select({
      id: applicants.id,
      firstName: applicants.firstName,
      lastName: applicants.lastName,
      middleName: applicants.middleName,
      email: applicants.email,
    })
    .from(applicants)
    .where(eq(applicants.id, application.applicantId))
    .limit(1);

  if (!applicant) {
    return { success: false, error: "Applicant not found" };
  }

  const [position] = await db
    .select({
      id: plantillaPositions.id,
      positionTitle: plantillaPositions.positionTitle,
    })
    .from(plantillaPositions)
    .where(eq(plantillaPositions.id, appointment.positionId))
    .limit(1);

  if (!position) {
    return { success: false, error: "Position not found" };
  }

  const [office] = await db
    .select({
      id: offices.id,
      name: offices.name,
    })
    .from(offices)
    .where(eq(offices.id, appointment.officeId))
    .limit(1);

  if (!office) {
    return { success: false, error: "Office not found" };
  }

  const documentTypes = [
    "csc_appointment",
    "position_description",
    "oath_of_office",
    "assumption_to_duty",
    "ataf",
  ] as const;

  const generatedUrls: Record<string, string> = {};

  for (const docType of documentTypes) {
    const pdfUrl = `/api/documents/appointment/${appointment.id}/${docType}.pdf`;
    generatedUrls[docType] = pdfUrl;

    const newDoc: NewAppointmentDocument = {
      appointmentId: appointment.id,
      docType,
      fileName: `${appointment.appointmentNumber}_${docType}.pdf`,
      fileUrl: pdfUrl,
      generatedByEmployeeId,
    };

    await db.insert(appointmentDocuments).values(newDoc);
  }

  await db
    .update(appointments)
    .set({
      generatedDocuments: generatedUrls,
      status: "ready_for_provisioning",
      updatedAt: new Date(),
    })
    .where(eq(appointments.id, appointment.id));

  revalidatePath(`/recruitment/appointments/${appointment.id}`);
  return { success: true, documents: generatedUrls };
}

// ─── Provision Employee ───────────────────────────────────────────────────────

/** employees.appointment_type enum accepted by the provisioning core. */
type ProvisionAppointmentType = AppointmentIssueInput["appointmentType"];

/**
 * The recruitment `appointments.appointment_type` column is a free-text
 * varchar constrained by CreateAppointmentSchema to the RPM vocabulary
 * (`cas`, `cos`, …). The `employees.appointment_type` pgEnum uses the
 * canonical CSC codes (`casual`, `contract_of_service`, …). Bridge the two
 * so the employee record is written with a valid enum value — a raw cast
 * would push `cas`/`cos` straight into the enum column and fail at runtime.
 */
const APPOINTMENT_TYPE_MAP: Record<string, ProvisionAppointmentType> = {
  permanent: "permanent",
  temporary: "temporary",
  coterminous: "coterminous",
  cas: "casual",
  casual: "casual",
  job_order: "job_order",
  cos: "contract_of_service",
  contract_of_service: "contract_of_service",
};

function normalizeAppointmentType(raw: string): ProvisionAppointmentType {
  return APPOINTMENT_TYPE_MAP[raw] ?? "permanent";
}

function normalizeGender(
  raw: string | null | undefined,
): "male" | "female" | "prefer_not_to_say" {
  if (raw === "male" || raw === "female") return raw;
  return "prefer_not_to_say";
}

export async function provisionEmployee(input: unknown) {
  const user = await requirePermission("employees", "create");
  const parsed = ProvisionEmployeeSchema.parse(input);

  const [appointment] = await db
    .select({
      id: appointments.id,
      applicationId: appointments.applicationId,
      positionId: appointments.positionId,
      officeId: appointments.officeId,
      itemNumber: appointments.itemNumber,
      salaryGrade: appointments.salaryGrade,
      stepIncrement: appointments.stepIncrement,
      monthlySalary: appointments.monthlySalary,
      appointmentType: appointments.appointmentType,
      effectiveDate: appointments.effectiveDate,
      status: appointments.status,
      provisioned: appointments.provisioned,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.id, parsed.appointmentId),
        isNull(appointments.deletedAt),
      ),
    )
    .limit(1);

  if (!appointment) {
    return { success: false, error: "Appointment not found" };
  }

  if (appointment.provisioned) {
    return { success: false, error: "Appointment already provisioned" };
  }

  if (appointment.status !== "ready_for_provisioning") {
    return {
      success: false,
      error: "Appointment must be ready_for_provisioning",
    };
  }

  const [application] = await db
    .select({
      id: applications.id,
      applicantId: applications.applicantId,
      personalInfo: applications.personalInfo,
      employeeId: applications.employeeId,
    })
    .from(applications)
    .where(eq(applications.id, appointment.applicationId))
    .limit(1);

  if (!application) {
    return { success: false, error: "Application not found" };
  }

  const [applicant] = await db
    .select({
      id: applicants.id,
      firstName: applicants.firstName,
      lastName: applicants.lastName,
      middleName: applicants.middleName,
      email: applicants.email,
      contactNumber: applicants.contactNumber,
      dateOfBirth: applicants.dateOfBirth,
      gender: applicants.gender,
      currentAddress: applicants.currentAddress,
    })
    .from(applicants)
    .where(eq(applicants.id, application.applicantId))
    .limit(1);

  if (!applicant) {
    return { success: false, error: "Applicant not found" };
  }

  // Internal promotion (TOR 1.9.13): the application carries the employee,
  // whose 201 record is updated in place. External applicants must not
  // collide with an existing employee.
  const internalEmployeeId = application.employeeId ?? undefined;
  const [existingEmployee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(eq(employees.email, applicant.email), isNull(employees.deletedAt)),
    )
    .limit(1);

  if (existingEmployee && existingEmployee.id !== internalEmployeeId) {
    return {
      success: false,
      error:
        "An employee with this email already exists. Internal applicants must apply through the Employee Portal promotion form.",
    };
  }

  // Resolve the plantilla position title — drives employees.positionTitle
  // (the previous implementation hardcoded "TBD").
  const [plantilla] = await db
    .select({
      id: plantillaPositions.id,
      positionTitle: plantillaPositions.positionTitle,
    })
    .from(plantillaPositions)
    .where(eq(plantillaPositions.id, appointment.positionId))
    .limit(1);

  if (!plantilla) {
    return {
      success: false,
      error: "Plantilla position not found for this appointment",
    };
  }

  // Agency-wide default schedule gives the new hire a DTR/attendance profile.
  const [defaultSchedule] = await db
    .select({ id: workSchedules.id })
    .from(workSchedules)
    .where(isNull(workSchedules.deletedAt))
    .limit(1);

  try {
    // RPM-023 / §12.3 APPOINTED: one transaction provisions the employee 201,
    // fills the plantilla item, opens the leave ledger for every active leave
    // type, records the schedule linkage, writes the audit row, and advances
    // the application + vacancy pipeline. Any failure rolls the whole unit
    // back — no partial employee is ever committed.
    const provision = await withTx(async (tx) => {
      const result = await atomicallyProvisionNewEmployee(tx, {
        applicationId: appointment.applicationId,
        positionId: appointment.positionId,
        officeId: appointment.officeId,
        itemNumber: appointment.itemNumber ?? "",
        salaryGrade: appointment.salaryGrade,
        stepIncrement: appointment.stepIncrement ?? 1,
        appointmentType: normalizeAppointmentType(appointment.appointmentType),
        effectiveDate: appointment.effectiveDate,
        positionTitle: plantilla.positionTitle,
        appointingAuthorityEmployeeId: user.employeeId ?? "",
        workScheduleId: defaultSchedule?.id,
        existingEmployeeId: internalEmployeeId,
        applicant: {
          firstName: applicant.firstName,
          middleName: applicant.middleName ?? null,
          lastName: applicant.lastName,
          birthDate: applicant.dateOfBirth,
          gender: normalizeGender(applicant.gender),
          civilStatus: "single",
          email: applicant.email ?? null,
          phone: applicant.contactNumber ?? null,
        },
        issuedByUserId: user.id,
      });

      // Flip the appointment to provisioned in the same transaction so the
      // appointment row and the new employee commit atomically together.
      await tx
        .update(appointments)
        .set({
          provisioned: true,
          provisionedAt: new Date(),
          provisionedEmployeeId: result.employeeId,
          status: "provisioned",
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, appointment.id));

      return result;
    });

    revalidatePath("/recruitment/appointments");
    revalidatePath(`/recruitment/appointments/${appointment.id}`);
    revalidatePath("/employees");

    return { success: true, employeeId: provision.employeeId };
  } catch (error) {
    console.error("Provisioning error:", error);
    return {
      success: false,
      error: "Failed to provision employee. Transaction rolled back.",
    };
  }
}

// ─── List Appointments ────────────────────────────────────────────────────────

export async function listAppointments() {
  await requireRecruitmentViewer();

  const rows = await db
    .select({
      id: appointments.id,
      appointmentNumber: appointments.appointmentNumber,
      appointmentDate: appointments.appointmentDate,
      effectiveDate: appointments.effectiveDate,
      status: appointments.status,
      provisioned: appointments.provisioned,
      applicantFirstName: applicants.firstName,
      applicantLastName: applicants.lastName,
      positionTitle: plantillaPositions.positionTitle,
      officeName: offices.name,
    })
    .from(appointments)
    .leftJoin(applications, eq(appointments.applicationId, applications.id))
    .leftJoin(applicants, eq(applications.applicantId, applicants.id))
    .leftJoin(
      plantillaPositions,
      eq(appointments.positionId, plantillaPositions.id),
    )
    .leftJoin(offices, eq(appointments.officeId, offices.id))
    .where(isNull(appointments.deletedAt))
    .orderBy(desc(appointments.createdAt))
    .limit(200);

  return rows;
}

// ─── Get Single Appointment ───────────────────────────────────────────────────

export async function getAppointment(id: string) {
  await requireRecruitmentViewer();

  const [row] = await db
    .select({
      id: appointments.id,
      appointmentNumber: appointments.appointmentNumber,
      appointmentDate: appointments.appointmentDate,
      effectiveDate: appointments.effectiveDate,
      salaryGrade: appointments.salaryGrade,
      stepIncrement: appointments.stepIncrement,
      monthlySalary: appointments.monthlySalary,
      appointmentType: appointments.appointmentType,
      status: appointments.status,
      provisioned: appointments.provisioned,
      provisionedAt: appointments.provisionedAt,
      generatedDocuments: appointments.generatedDocuments,
      notes: appointments.notes,
      applicationId: applications.id,
      applicantFirstName: applicants.firstName,
      applicantLastName: applicants.lastName,
      applicantMiddleName: applicants.middleName,
      applicantEmail: applicants.email,
      positionTitle: plantillaPositions.positionTitle,
      officeName: offices.name,
      itemNumber: appointments.itemNumber,
      provisionedEmployeeId: appointments.provisionedEmployeeId,
    })
    .from(appointments)
    .leftJoin(applications, eq(appointments.applicationId, applications.id))
    .leftJoin(applicants, eq(applications.applicantId, applicants.id))
    .leftJoin(
      plantillaPositions,
      eq(appointments.positionId, plantillaPositions.id),
    )
    .leftJoin(offices, eq(appointments.officeId, offices.id))
    .where(and(eq(appointments.id, id), isNull(appointments.deletedAt)))
    .limit(1);

  return row ?? null;
}
