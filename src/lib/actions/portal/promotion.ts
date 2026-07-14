"use server";

/**
 * Portal — Online promotion application (TOR 1.9.13 / EPM-014).
 *
 * Employees browse OPEN published vacancies and apply internally. The
 * application row is created with `employee_id` set (internal tag for HRD)
 * and its JSONB detail columns pre-filled from the employee's 201 file:
 * employees + employee_education / employee_eligibilities /
 * employee_work_experiences / employee_external_trainings.
 *
 * An `applicants` row is required (applications.applicant_id NOT NULL); it is
 * found or auto-provisioned keyed by the employee's email. Auto-provisioned
 * internal applicant accounts carry a non-bcrypt password marker so they can
 * never be used to sign in to the public applicant portal (fail-closed).
 *
 * Application numbers mirror the public applicant portal convention
 * (APP-YYYY-NNNNNN with a random 6-digit component; the DB UNIQUE index
 * resolves collisions).
 */

import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import {
  applications,
  applicants,
  vacancies,
} from "@/lib/db/schema/recruitment";
import { plantillaPositions } from "@/lib/db/schema/plantilla";
import { offices } from "@/lib/db/schema/offices";
import { employees } from "@/lib/db/schema/employees";
import {
  employeeEducation,
  employeeEligibilities,
  employeeWorkExperiences,
  employeeExternalTrainings,
} from "@/lib/db/schema/employee-201";
import { requireAuth } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { notifyRoles } from "@/lib/notifications";

// ─── Result envelope ─────────────────────────────────────────────────────────

type Ok<T> = { data: T };
type Err = { error: string };
type Result<T> = Ok<T> | Err;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateApplicationNumber(): string {
  const year = new Date().getUTCFullYear();
  const suffix = Math.floor(100_000 + Math.random() * 900_000).toString();
  return `APP-${year}-${suffix}`;
}

function toIsoDateTime(dateOnly: string | null | undefined): string | null {
  if (!dateOnly) return null;
  const d = new Date(`${dateOnly}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function joinAddress(e: {
  addressStreet: string | null;
  addressBarangay: string | null;
  addressCity: string | null;
  addressProvince: string | null;
  addressZipCode: string | null;
}): string {
  const parts = [
    e.addressStreet,
    e.addressBarangay,
    e.addressCity,
    e.addressProvince,
    e.addressZipCode,
  ].filter(Boolean);
  return parts.length > 0
    ? parts.join(", ")
    : "On file with PCSO HRD (201 file)";
}

/** employee_education.level → applicant education level vocabulary. */
const EDUCATION_LEVEL_MAP: Record<string, string> = {
  elementary: "elementary",
  secondary: "secondary",
  vocational: "vocational",
  college: "college",
  graduate_studies: "graduate",
};

// ─── Actions ─────────────────────────────────────────────────────────────────

/**
 * Published vacancies still open for application, with position/office names.
 */
export async function getOpenVacanciesForEmployees(): Promise<
  Result<
    {
      id: string;
      itemNumber: string;
      cscForm9Number: string;
      applicationDeadline: Date;
      qualificationStandards: unknown;
      positionTitle: string;
      salaryGrade: number | null;
      officeName: string;
    }[]
  >
> {
  await requireAuth();
  try {
    const rows = await db
      .select({
        id: vacancies.id,
        itemNumber: vacancies.itemNumber,
        cscForm9Number: vacancies.cscForm9Number,
        applicationDeadline: vacancies.applicationDeadline,
        qualificationStandards: vacancies.qualificationStandards,
        positionTitle: plantillaPositions.positionTitle,
        salaryGrade: plantillaPositions.salaryGrade,
        officeName: offices.name,
      })
      .from(vacancies)
      .innerJoin(
        plantillaPositions,
        eq(vacancies.positionId, plantillaPositions.id),
      )
      .innerJoin(offices, eq(vacancies.officeId, offices.id))
      .where(
        and(
          eq(vacancies.status, "published"),
          gte(vacancies.applicationDeadline, new Date()),
          isNull(vacancies.deletedAt),
        ),
      )
      .orderBy(desc(vacancies.publishedAt));
    return { data: rows };
  } catch (error) {
    console.error("[getOpenVacanciesForEmployees]", error);
    return { error: "Failed to load open vacancies" };
  }
}

/** Own internal promotion applications, newest first. */
export async function getMyPromotionApplications(): Promise<
  Result<
    {
      id: string;
      applicationNumber: string;
      status: string;
      submittedAt: Date | null;
      createdAt: Date;
      positionTitle: string;
      officeName: string;
      itemNumber: string;
    }[]
  >
> {
  const session = await requireAuth();
  if (!session.employeeId) return { data: [] };
  try {
    const rows = await db
      .select({
        id: applications.id,
        applicationNumber: applications.applicationNumber,
        status: applications.status,
        submittedAt: applications.submittedAt,
        createdAt: applications.createdAt,
        positionTitle: plantillaPositions.positionTitle,
        officeName: offices.name,
        itemNumber: vacancies.itemNumber,
      })
      .from(applications)
      .innerJoin(vacancies, eq(applications.vacancyId, vacancies.id))
      .innerJoin(
        plantillaPositions,
        eq(vacancies.positionId, plantillaPositions.id),
      )
      .innerJoin(offices, eq(vacancies.officeId, offices.id))
      .where(
        and(
          eq(applications.employeeId, session.employeeId),
          isNull(applications.deletedAt),
        ),
      )
      .orderBy(desc(applications.createdAt));
    return { data: rows };
  } catch (error) {
    console.error("[getMyPromotionApplications]", error);
    return { error: "Failed to load your applications" };
  }
}

const applySchema = z.object({ vacancyId: z.string().uuid() });

/**
 * Employee applies to an open vacancy (TOR 1.9.13). Creates (or reuses) the
 * internal applicant account and inserts a SUBMITTED application pre-filled
 * from 201 data. Idempotent per (vacancy, applicant).
 */
export async function applyForPromotion(
  input: z.infer<typeof applySchema>,
): Promise<Result<{ id: string; applicationNumber: string; status: string }>> {
  const session = await requireAuth();
  if (!session.employeeId) {
    return { error: "No employee record is linked to this account" };
  }
  const parsed = applySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Validation failed" };
  }
  const { vacancyId } = parsed.data;

  try {
    const employee = await db.query.employees.findFirst({
      where: eq(employees.id, session.employeeId),
    });
    if (!employee) return { error: "Employee not found" };
    if (!employee.email) {
      return {
        error:
          "Your 201 file has no email address — ask HR to update it before applying",
      };
    }

    const vacancy = await db.query.vacancies.findFirst({
      where: and(eq(vacancies.id, vacancyId), isNull(vacancies.deletedAt)),
    });
    if (!vacancy || vacancy.status !== "published") {
      return { error: "Vacancy is not open for applications" };
    }
    if (new Date(vacancy.applicationDeadline).getTime() < Date.now()) {
      return { error: "The application deadline for this vacancy has passed" };
    }

    // ── Find-or-create the internal applicant account ────────────────────────
    const email = employee.email.toLowerCase();
    let applicant = await db.query.applicants.findFirst({
      where: eq(applicants.email, email),
    });
    if (!applicant) {
      const [created] = await db
        .insert(applicants)
        .values({
          email,
          emailVerifiedAt: new Date(),
          firstName: employee.firstName,
          lastName: employee.lastName,
          middleName: employee.middleName,
          contactNumber: employee.phone ?? "N/A",
          dateOfBirth: employee.birthDate,
          gender: employee.gender,
          currentAddress: joinAddress(employee),
          // Non-bcrypt marker — can never verify on the public portal login.
          passwordHash: `internal-employee:${crypto.randomUUID()}`,
          status: "active",
        })
        .returning();
      if (!created)
        return { error: "Failed to provision internal applicant record" };
      applicant = created;
    }

    // ── Idempotency: one application per (vacancy, applicant) ────────────────
    const existing = await db.query.applications.findFirst({
      where: and(
        eq(applications.vacancyId, vacancyId),
        eq(applications.applicantId, applicant.id),
      ),
    });
    if (existing) {
      return {
        data: {
          id: existing.id,
          applicationNumber: existing.applicationNumber,
          status: existing.status,
        },
      };
    }

    // ── Pre-fill from the 201 file ───────────────────────────────────────────
    const [education, eligibilities, workExperiences, trainings] =
      await Promise.all([
        db.query.employeeEducation.findMany({
          where: and(
            eq(employeeEducation.employeeId, employee.id),
            isNull(employeeEducation.deletedAt),
          ),
        }),
        db.query.employeeEligibilities.findMany({
          where: and(
            eq(employeeEligibilities.employeeId, employee.id),
            isNull(employeeEligibilities.deletedAt),
          ),
        }),
        db.query.employeeWorkExperiences.findMany({
          where: and(
            eq(employeeWorkExperiences.employeeId, employee.id),
            isNull(employeeWorkExperiences.deletedAt),
          ),
        }),
        db.query.employeeExternalTrainings.findMany({
          where: and(
            eq(employeeExternalTrainings.employeeId, employee.id),
            isNull(employeeExternalTrainings.deletedAt),
          ),
        }),
      ]);

    const personalInfo = {
      firstName: employee.firstName,
      lastName: employee.lastName,
      middleName: employee.middleName ?? undefined,
      dateOfBirth:
        toIsoDateTime(employee.birthDate) ?? new Date(0).toISOString(),
      gender: employee.gender,
      contactNumber: employee.phone ?? "N/A",
      email,
      currentAddress: joinAddress(employee),
      // Internal-application marker for HRD reviewers.
      employeeNo: employee.employeeNo,
      currentPosition: employee.positionTitle,
    };

    const educationalBackground = education.map((row) => ({
      level: EDUCATION_LEVEL_MAP[row.level] ?? row.level,
      schoolName: row.schoolName,
      degree: row.degreeCourse ?? undefined,
      yearGraduated: row.yearGraduated
        ? Number(row.yearGraduated) || undefined
        : undefined,
    }));

    const workExperience = [
      // Current PCSO appointment first — the reviewer's primary signal.
      {
        position: employee.positionTitle,
        company: "Philippine Charity Sweepstakes Office",
        startDate:
          toIsoDateTime(employee.dateHired) ?? new Date().toISOString(),
        endDate: null,
        isCurrent: true,
      },
      ...workExperiences.map((row) => ({
        position: row.positionTitle,
        company: row.companyName,
        startDate: toIsoDateTime(row.dateFrom) ?? new Date(0).toISOString(),
        endDate: toIsoDateTime(row.dateTo),
        isCurrent: row.dateTo === null,
      })),
    ];

    const eligibility = eligibilities.map((row) => ({
      type: row.eligibilityName,
      rating: row.rating ? Number(row.rating) || undefined : undefined,
      dateTaken: toIsoDateTime(row.examDate) ?? undefined,
      licenseNumber: row.licenseNo ?? undefined,
    }));

    const trainingEntries = trainings.map((row) => ({
      title: row.title,
      provider: row.conductedBy ?? "Not specified",
      hours: row.numberOfHours ? Number(row.numberOfHours) || 0 : 0,
      dateCompleted:
        toIsoDateTime(row.dateTo) ??
        toIsoDateTime(row.dateFrom) ??
        new Date(0).toISOString(),
    }));

    const [inserted] = await db
      .insert(applications)
      .values({
        vacancyId,
        applicantId: applicant.id,
        applicationNumber: generateApplicationNumber(),
        status: "submitted",
        submittedAt: new Date(),
        personalInfo: personalInfo as Record<string, unknown>,
        educationalBackground: educationalBackground as unknown as Record<
          string,
          unknown
        >[],
        workExperience: workExperience as unknown as Record<string, unknown>[],
        eligibility: eligibility as unknown as Record<string, unknown>[],
        trainings: trainingEntries as unknown as Record<string, unknown>[],
        referencesJson: [] as Record<string, unknown>[],
        employeeId: employee.id,
      })
      .returning({
        id: applications.id,
        applicationNumber: applications.applicationNumber,
        status: applications.status,
      });
    if (!inserted) return { error: "Failed to create application" };

    await auditLog({
      userId: session.id,
      action: "promotion_application.submit",
      table: "applications",
      recordId: inserted.id,
      module: "EPM",
      subModule: "promotion",
      newValues: {
        vacancyId,
        employeeId: employee.id,
        applicationNumber: inserted.applicationNumber,
      },
    });

    await notifyRoles(["hr_admin", "super_admin"], {
      type: "generic",
      title: "Internal Promotion Application",
      body: `${employee.firstName} ${employee.lastName} (${employee.employeeNo}) applied to vacancy ${vacancy.itemNumber} via the Employee Portal`,
      entityType: "application",
      entityId: inserted.id,
    });

    revalidatePath("/portal/promotion");
    return { data: inserted };
  } catch (error) {
    console.error("[applyForPromotion]", error);
    return { error: "Failed to submit promotion application" };
  }
}
