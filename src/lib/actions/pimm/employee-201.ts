"use server";

/**
 * PIMM — Employee 201-File section server actions (PIM-001, TOR 1.3.1/1.3.25).
 *
 * CRUD for the seven CS Form 212 backing tables (family & dependents,
 * education, eligibilities, work experience, voluntary work, external
 * trainings, designations/special orders) plus the PDS-profile extras stored
 * directly on the employees row (place of birth, height/weight, permanent
 * address, dual citizenship, government-issued ID, page-4 questionnaire,
 * distinctions, org memberships).
 *
 * Authorization (Section 11 role-permission matrix):
 *   - Reads:  requirePermission('employees', 'view')
 *   - Writes: requirePermission('employees', 'edit')
 *
 * Every write emits an auditLog row (module: PIMM) and revalidates the
 * employee profile + 201 pages. All rows soft-delete via deletedAt.
 */

import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { isRedirectError } from "next/dist/client/components/redirect-error";

import { db } from "@/lib/db";
import {
  employees,
  employeeFamilyMembers,
  employeeEducation,
  employeeEligibilities,
  employeeWorkExperiences,
  employeeVoluntaryWorks,
  employeeExternalTrainings,
  employeeDesignations,
  type EmployeeFamilyMember,
  type EmployeeEducationRow,
  type EmployeeEligibility,
  type EmployeeWorkExperience,
  type EmployeeVoluntaryWork,
  type EmployeeExternalTraining,
  type EmployeeDesignation,
} from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import type { CurrentUser } from "@/lib/auth/get-current-user";
import { auditLog } from "@/lib/audit";
import {
  createFamilyMemberSchema,
  updateFamilyMemberSchema,
  createEducationSchema,
  updateEducationSchema,
  createEligibilitySchema,
  updateEligibilitySchema,
  createWorkExperienceSchema,
  updateWorkExperienceSchema,
  createVoluntaryWorkSchema,
  updateVoluntaryWorkSchema,
  createExternalTrainingSchema,
  updateExternalTrainingSchema,
  createDesignationSchema,
  updateDesignationSchema,
  list201SectionSchema,
  remove201RowSchema,
  updatePdsProfileSchema,
  type CreateFamilyMemberInput,
  type CreateEducationInput,
  type CreateEligibilityInput,
  type CreateWorkExperienceInput,
  type CreateVoluntaryWorkInput,
  type CreateExternalTrainingInput,
  type CreateDesignationInput,
} from "@/lib/validations/employee-201";

// ─── Result envelope (mirrors employee-documents.ts) ─────────────────────────

type Ok<T> = { data: T };
type Err = { error: string };
type Result<T> = Ok<T> | Err;

function ok<T>(data: T): Ok<T> {
  return { data };
}
function err(message: string): Err {
  return { error: message };
}
function toErrMsg(e: unknown): string {
  if (e instanceof z.ZodError) {
    return e.issues[0]?.message ?? "Invalid input.";
  }
  return e instanceof Error ? e.message : "Unexpected error";
}

/** Redirect markers from requirePermission must propagate to the framework. */
function handleActionError(e: unknown): Err {
  if (isRedirectError(e)) throw e;
  return err(toErrMsg(e));
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

const MODULE = "PIMM";

function revalidateEmployee201(employeeId: string): void {
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath(`/employees/${employeeId}/201`);
}

async function audit201Write(
  user: CurrentUser,
  action: string,
  table: string,
  recordId: string,
  subModule: string,
  newValues?: Record<string, unknown>,
): Promise<void> {
  await auditLog({
    userId: user.id,
    action,
    table,
    recordId,
    newValues,
    module: MODULE,
    subModule,
  });
}

// ═══ Section II — Family & Dependents ════════════════════════════════════════

type FamilyPayload = Omit<CreateFamilyMemberInput, "employeeId">;

function familyMemberValues(p: FamilyPayload) {
  return {
    memberType: p.memberType,
    lastName: p.lastName,
    firstName: p.firstName,
    middleName: p.middleName ?? null,
    extensionName: p.extensionName ?? null,
    birthDate: p.birthDate ?? null,
    occupation: p.occupation ?? null,
    employerName: p.employerName ?? null,
    employerAddress: p.employerAddress ?? null,
    telephoneNo: p.telephoneNo ?? null,
    isDependent: p.isDependent,
    sortOrder: p.sortOrder,
  };
}

export async function listFamilyMembers(
  input: unknown,
): Promise<Result<EmployeeFamilyMember[]>> {
  try {
    await requirePermission("employees", "view");
    const parsed = list201SectionSchema.parse(input);
    const rows = await db
      .select()
      .from(employeeFamilyMembers)
      .where(
        and(
          eq(employeeFamilyMembers.employeeId, parsed.employeeId),
          isNull(employeeFamilyMembers.deletedAt),
        ),
      )
      .orderBy(
        asc(employeeFamilyMembers.sortOrder),
        asc(employeeFamilyMembers.createdAt),
      );
    return ok(rows);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function createFamilyMember(
  input: unknown,
): Promise<Result<EmployeeFamilyMember>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = createFamilyMemberSchema.parse(input);

    const [row] = await db
      .insert(employeeFamilyMembers)
      .values({ employeeId: parsed.employeeId, ...familyMemberValues(parsed) })
      .returning();
    if (!row) return err("Failed to add family member.");

    await audit201Write(
      user,
      "employee_201.family_member.create",
      "employee_family_members",
      row.id,
      "family_members",
      { employeeId: parsed.employeeId, memberType: parsed.memberType },
    );
    revalidateEmployee201(parsed.employeeId);
    return ok(row);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function updateFamilyMember(
  input: unknown,
): Promise<Result<EmployeeFamilyMember>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = updateFamilyMemberSchema.parse(input);

    const [row] = await db
      .update(employeeFamilyMembers)
      .set({ ...familyMemberValues(parsed), updatedAt: new Date() })
      .where(
        and(
          eq(employeeFamilyMembers.id, parsed.id),
          isNull(employeeFamilyMembers.deletedAt),
        ),
      )
      .returning();
    if (!row) return err("Family member record not found.");

    await audit201Write(
      user,
      "employee_201.family_member.update",
      "employee_family_members",
      row.id,
      "family_members",
      { memberType: parsed.memberType },
    );
    revalidateEmployee201(row.employeeId);
    return ok(row);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function removeFamilyMember(
  input: unknown,
): Promise<Result<{ id: string }>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = remove201RowSchema.parse(input);

    const [row] = await db
      .update(employeeFamilyMembers)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(employeeFamilyMembers.id, parsed.id),
          isNull(employeeFamilyMembers.deletedAt),
        ),
      )
      .returning();
    if (!row) return err("Family member record not found.");

    await audit201Write(
      user,
      "employee_201.family_member.remove",
      "employee_family_members",
      row.id,
      "family_members",
      { softDeleted: true },
    );
    revalidateEmployee201(row.employeeId);
    return ok({ id: row.id });
  } catch (e) {
    return handleActionError(e);
  }
}

// ═══ Section III — Educational Background ════════════════════════════════════

type EducationPayload = Omit<CreateEducationInput, "employeeId">;

function educationValues(p: EducationPayload) {
  return {
    level: p.level,
    schoolName: p.schoolName,
    degreeCourse: p.degreeCourse ?? null,
    attendanceFrom: p.attendanceFrom ?? null,
    attendanceTo: p.attendanceTo ?? null,
    highestLevelUnits: p.highestLevelUnits ?? null,
    yearGraduated: p.yearGraduated ?? null,
    honorsReceived: p.honorsReceived ?? null,
    sortOrder: p.sortOrder,
  };
}

export async function listEducationRecords(
  input: unknown,
): Promise<Result<EmployeeEducationRow[]>> {
  try {
    await requirePermission("employees", "view");
    const parsed = list201SectionSchema.parse(input);
    const rows = await db
      .select()
      .from(employeeEducation)
      .where(
        and(
          eq(employeeEducation.employeeId, parsed.employeeId),
          isNull(employeeEducation.deletedAt),
        ),
      )
      .orderBy(asc(employeeEducation.level), asc(employeeEducation.sortOrder));
    return ok(rows);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function createEducationRecord(
  input: unknown,
): Promise<Result<EmployeeEducationRow>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = createEducationSchema.parse(input);

    const [row] = await db
      .insert(employeeEducation)
      .values({ employeeId: parsed.employeeId, ...educationValues(parsed) })
      .returning();
    if (!row) return err("Failed to add education record.");

    await audit201Write(
      user,
      "employee_201.education.create",
      "employee_education",
      row.id,
      "education",
      { employeeId: parsed.employeeId, level: parsed.level },
    );
    revalidateEmployee201(parsed.employeeId);
    return ok(row);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function updateEducationRecord(
  input: unknown,
): Promise<Result<EmployeeEducationRow>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = updateEducationSchema.parse(input);

    const [row] = await db
      .update(employeeEducation)
      .set({ ...educationValues(parsed), updatedAt: new Date() })
      .where(
        and(
          eq(employeeEducation.id, parsed.id),
          isNull(employeeEducation.deletedAt),
        ),
      )
      .returning();
    if (!row) return err("Education record not found.");

    await audit201Write(
      user,
      "employee_201.education.update",
      "employee_education",
      row.id,
      "education",
      { level: parsed.level },
    );
    revalidateEmployee201(row.employeeId);
    return ok(row);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function removeEducationRecord(
  input: unknown,
): Promise<Result<{ id: string }>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = remove201RowSchema.parse(input);

    const [row] = await db
      .update(employeeEducation)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(employeeEducation.id, parsed.id),
          isNull(employeeEducation.deletedAt),
        ),
      )
      .returning();
    if (!row) return err("Education record not found.");

    await audit201Write(
      user,
      "employee_201.education.remove",
      "employee_education",
      row.id,
      "education",
      { softDeleted: true },
    );
    revalidateEmployee201(row.employeeId);
    return ok({ id: row.id });
  } catch (e) {
    return handleActionError(e);
  }
}

// ═══ Section IV — Civil Service Eligibility ══════════════════════════════════

type EligibilityPayload = Omit<CreateEligibilityInput, "employeeId">;

function eligibilityValues(p: EligibilityPayload) {
  return {
    eligibilityName: p.eligibilityName,
    rating: p.rating ?? null,
    examDate: p.examDate ?? null,
    examPlace: p.examPlace ?? null,
    licenseNo: p.licenseNo ?? null,
    licenseValidity: p.licenseValidity ?? null,
  };
}

export async function listEligibilities(
  input: unknown,
): Promise<Result<EmployeeEligibility[]>> {
  try {
    await requirePermission("employees", "view");
    const parsed = list201SectionSchema.parse(input);
    const rows = await db
      .select()
      .from(employeeEligibilities)
      .where(
        and(
          eq(employeeEligibilities.employeeId, parsed.employeeId),
          isNull(employeeEligibilities.deletedAt),
        ),
      )
      .orderBy(
        desc(employeeEligibilities.examDate),
        asc(employeeEligibilities.createdAt),
      );
    return ok(rows);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function createEligibility(
  input: unknown,
): Promise<Result<EmployeeEligibility>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = createEligibilitySchema.parse(input);

    const [row] = await db
      .insert(employeeEligibilities)
      .values({ employeeId: parsed.employeeId, ...eligibilityValues(parsed) })
      .returning();
    if (!row) return err("Failed to add eligibility.");

    await audit201Write(
      user,
      "employee_201.eligibility.create",
      "employee_eligibilities",
      row.id,
      "eligibilities",
      {
        employeeId: parsed.employeeId,
        eligibilityName: parsed.eligibilityName,
      },
    );
    revalidateEmployee201(parsed.employeeId);
    return ok(row);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function updateEligibility(
  input: unknown,
): Promise<Result<EmployeeEligibility>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = updateEligibilitySchema.parse(input);

    const [row] = await db
      .update(employeeEligibilities)
      .set({ ...eligibilityValues(parsed), updatedAt: new Date() })
      .where(
        and(
          eq(employeeEligibilities.id, parsed.id),
          isNull(employeeEligibilities.deletedAt),
        ),
      )
      .returning();
    if (!row) return err("Eligibility record not found.");

    await audit201Write(
      user,
      "employee_201.eligibility.update",
      "employee_eligibilities",
      row.id,
      "eligibilities",
      { eligibilityName: parsed.eligibilityName },
    );
    revalidateEmployee201(row.employeeId);
    return ok(row);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function removeEligibility(
  input: unknown,
): Promise<Result<{ id: string }>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = remove201RowSchema.parse(input);

    const [row] = await db
      .update(employeeEligibilities)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(employeeEligibilities.id, parsed.id),
          isNull(employeeEligibilities.deletedAt),
        ),
      )
      .returning();
    if (!row) return err("Eligibility record not found.");

    await audit201Write(
      user,
      "employee_201.eligibility.remove",
      "employee_eligibilities",
      row.id,
      "eligibilities",
      { softDeleted: true },
    );
    revalidateEmployee201(row.employeeId);
    return ok({ id: row.id });
  } catch (e) {
    return handleActionError(e);
  }
}

// ═══ Section V — Work Experience (external / pre-PCSO) ═══════════════════════

type WorkExperiencePayload = Omit<CreateWorkExperienceInput, "employeeId">;

function workExperienceValues(p: WorkExperiencePayload) {
  return {
    dateFrom: p.dateFrom,
    dateTo: p.dateTo ?? null,
    positionTitle: p.positionTitle,
    companyName: p.companyName,
    monthlySalary: p.monthlySalary != null ? p.monthlySalary.toFixed(2) : null,
    salaryGradeStep: p.salaryGradeStep ?? null,
    statusOfAppointment: p.statusOfAppointment ?? null,
    isGovernmentService: p.isGovernmentService,
  };
}

export async function listWorkExperiences(
  input: unknown,
): Promise<Result<EmployeeWorkExperience[]>> {
  try {
    await requirePermission("employees", "view");
    const parsed = list201SectionSchema.parse(input);
    const rows = await db
      .select()
      .from(employeeWorkExperiences)
      .where(
        and(
          eq(employeeWorkExperiences.employeeId, parsed.employeeId),
          isNull(employeeWorkExperiences.deletedAt),
        ),
      )
      .orderBy(desc(employeeWorkExperiences.dateFrom));
    return ok(rows);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function createWorkExperience(
  input: unknown,
): Promise<Result<EmployeeWorkExperience>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = createWorkExperienceSchema.parse(input);

    const [row] = await db
      .insert(employeeWorkExperiences)
      .values({
        employeeId: parsed.employeeId,
        ...workExperienceValues(parsed),
      })
      .returning();
    if (!row) return err("Failed to add work experience.");

    await audit201Write(
      user,
      "employee_201.work_experience.create",
      "employee_work_experiences",
      row.id,
      "work_experiences",
      { employeeId: parsed.employeeId, companyName: parsed.companyName },
    );
    revalidateEmployee201(parsed.employeeId);
    return ok(row);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function updateWorkExperience(
  input: unknown,
): Promise<Result<EmployeeWorkExperience>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = updateWorkExperienceSchema.parse(input);

    const [row] = await db
      .update(employeeWorkExperiences)
      .set({ ...workExperienceValues(parsed), updatedAt: new Date() })
      .where(
        and(
          eq(employeeWorkExperiences.id, parsed.id),
          isNull(employeeWorkExperiences.deletedAt),
        ),
      )
      .returning();
    if (!row) return err("Work experience record not found.");

    await audit201Write(
      user,
      "employee_201.work_experience.update",
      "employee_work_experiences",
      row.id,
      "work_experiences",
      { companyName: parsed.companyName },
    );
    revalidateEmployee201(row.employeeId);
    return ok(row);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function removeWorkExperience(
  input: unknown,
): Promise<Result<{ id: string }>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = remove201RowSchema.parse(input);

    const [row] = await db
      .update(employeeWorkExperiences)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(employeeWorkExperiences.id, parsed.id),
          isNull(employeeWorkExperiences.deletedAt),
        ),
      )
      .returning();
    if (!row) return err("Work experience record not found.");

    await audit201Write(
      user,
      "employee_201.work_experience.remove",
      "employee_work_experiences",
      row.id,
      "work_experiences",
      { softDeleted: true },
    );
    revalidateEmployee201(row.employeeId);
    return ok({ id: row.id });
  } catch (e) {
    return handleActionError(e);
  }
}

// ═══ Section VI — Voluntary Work ═════════════════════════════════════════════

type VoluntaryWorkPayload = Omit<CreateVoluntaryWorkInput, "employeeId">;

function voluntaryWorkValues(p: VoluntaryWorkPayload) {
  return {
    organizationName: p.organizationName,
    organizationAddress: p.organizationAddress ?? null,
    dateFrom: p.dateFrom ?? null,
    dateTo: p.dateTo ?? null,
    numberOfHours: p.numberOfHours ?? null,
    positionNature: p.positionNature ?? null,
  };
}

export async function listVoluntaryWorks(
  input: unknown,
): Promise<Result<EmployeeVoluntaryWork[]>> {
  try {
    await requirePermission("employees", "view");
    const parsed = list201SectionSchema.parse(input);
    const rows = await db
      .select()
      .from(employeeVoluntaryWorks)
      .where(
        and(
          eq(employeeVoluntaryWorks.employeeId, parsed.employeeId),
          isNull(employeeVoluntaryWorks.deletedAt),
        ),
      )
      .orderBy(desc(employeeVoluntaryWorks.dateFrom));
    return ok(rows);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function createVoluntaryWork(
  input: unknown,
): Promise<Result<EmployeeVoluntaryWork>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = createVoluntaryWorkSchema.parse(input);

    const [row] = await db
      .insert(employeeVoluntaryWorks)
      .values({ employeeId: parsed.employeeId, ...voluntaryWorkValues(parsed) })
      .returning();
    if (!row) return err("Failed to add voluntary work.");

    await audit201Write(
      user,
      "employee_201.voluntary_work.create",
      "employee_voluntary_works",
      row.id,
      "voluntary_works",
      {
        employeeId: parsed.employeeId,
        organizationName: parsed.organizationName,
      },
    );
    revalidateEmployee201(parsed.employeeId);
    return ok(row);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function updateVoluntaryWork(
  input: unknown,
): Promise<Result<EmployeeVoluntaryWork>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = updateVoluntaryWorkSchema.parse(input);

    const [row] = await db
      .update(employeeVoluntaryWorks)
      .set({ ...voluntaryWorkValues(parsed), updatedAt: new Date() })
      .where(
        and(
          eq(employeeVoluntaryWorks.id, parsed.id),
          isNull(employeeVoluntaryWorks.deletedAt),
        ),
      )
      .returning();
    if (!row) return err("Voluntary work record not found.");

    await audit201Write(
      user,
      "employee_201.voluntary_work.update",
      "employee_voluntary_works",
      row.id,
      "voluntary_works",
      { organizationName: parsed.organizationName },
    );
    revalidateEmployee201(row.employeeId);
    return ok(row);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function removeVoluntaryWork(
  input: unknown,
): Promise<Result<{ id: string }>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = remove201RowSchema.parse(input);

    const [row] = await db
      .update(employeeVoluntaryWorks)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(employeeVoluntaryWorks.id, parsed.id),
          isNull(employeeVoluntaryWorks.deletedAt),
        ),
      )
      .returning();
    if (!row) return err("Voluntary work record not found.");

    await audit201Write(
      user,
      "employee_201.voluntary_work.remove",
      "employee_voluntary_works",
      row.id,
      "voluntary_works",
      { softDeleted: true },
    );
    revalidateEmployee201(row.employeeId);
    return ok({ id: row.id });
  } catch (e) {
    return handleActionError(e);
  }
}

// ═══ Section VII — External Trainings (outside LDM) ══════════════════════════

type ExternalTrainingPayload = Omit<CreateExternalTrainingInput, "employeeId">;

function externalTrainingValues(p: ExternalTrainingPayload) {
  return {
    title: p.title,
    dateFrom: p.dateFrom ?? null,
    dateTo: p.dateTo ?? null,
    numberOfHours: p.numberOfHours != null ? p.numberOfHours.toFixed(1) : null,
    ldType: p.ldType ?? null,
    conductedBy: p.conductedBy ?? null,
  };
}

export async function listExternalTrainings(
  input: unknown,
): Promise<Result<EmployeeExternalTraining[]>> {
  try {
    await requirePermission("employees", "view");
    const parsed = list201SectionSchema.parse(input);
    const rows = await db
      .select()
      .from(employeeExternalTrainings)
      .where(
        and(
          eq(employeeExternalTrainings.employeeId, parsed.employeeId),
          isNull(employeeExternalTrainings.deletedAt),
        ),
      )
      .orderBy(desc(employeeExternalTrainings.dateFrom));
    return ok(rows);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function createExternalTraining(
  input: unknown,
): Promise<Result<EmployeeExternalTraining>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = createExternalTrainingSchema.parse(input);

    const [row] = await db
      .insert(employeeExternalTrainings)
      .values({
        employeeId: parsed.employeeId,
        ...externalTrainingValues(parsed),
      })
      .returning();
    if (!row) return err("Failed to add training record.");

    await audit201Write(
      user,
      "employee_201.external_training.create",
      "employee_external_trainings",
      row.id,
      "external_trainings",
      { employeeId: parsed.employeeId, title: parsed.title },
    );
    revalidateEmployee201(parsed.employeeId);
    return ok(row);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function updateExternalTraining(
  input: unknown,
): Promise<Result<EmployeeExternalTraining>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = updateExternalTrainingSchema.parse(input);

    const [row] = await db
      .update(employeeExternalTrainings)
      .set({ ...externalTrainingValues(parsed), updatedAt: new Date() })
      .where(
        and(
          eq(employeeExternalTrainings.id, parsed.id),
          isNull(employeeExternalTrainings.deletedAt),
        ),
      )
      .returning();
    if (!row) return err("Training record not found.");

    await audit201Write(
      user,
      "employee_201.external_training.update",
      "employee_external_trainings",
      row.id,
      "external_trainings",
      { title: parsed.title },
    );
    revalidateEmployee201(row.employeeId);
    return ok(row);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function removeExternalTraining(
  input: unknown,
): Promise<Result<{ id: string }>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = remove201RowSchema.parse(input);

    const [row] = await db
      .update(employeeExternalTrainings)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(employeeExternalTrainings.id, parsed.id),
          isNull(employeeExternalTrainings.deletedAt),
        ),
      )
      .returning();
    if (!row) return err("Training record not found.");

    await audit201Write(
      user,
      "employee_201.external_training.remove",
      "employee_external_trainings",
      row.id,
      "external_trainings",
      { softDeleted: true },
    );
    revalidateEmployee201(row.employeeId);
    return ok({ id: row.id });
  } catch (e) {
    return handleActionError(e);
  }
}

// ═══ Designations & Special Orders (TOR 1.3.25) ══════════════════════════════

type DesignationPayload = Omit<CreateDesignationInput, "employeeId">;

function designationValues(p: DesignationPayload) {
  return {
    designationType: p.designationType,
    designationTitle: p.designationTitle,
    officeId: p.officeId ?? null,
    specialOrderNo: p.specialOrderNo ?? null,
    startDate: p.startDate,
    endDate: p.endDate ?? null,
    status: p.status,
    remarks: p.remarks ?? null,
    documentUrl: p.documentUrl ?? null,
  };
}

export async function listDesignations(
  input: unknown,
): Promise<Result<EmployeeDesignation[]>> {
  try {
    await requirePermission("employees", "view");
    const parsed = list201SectionSchema.parse(input);
    const rows = await db
      .select()
      .from(employeeDesignations)
      .where(
        and(
          eq(employeeDesignations.employeeId, parsed.employeeId),
          isNull(employeeDesignations.deletedAt),
        ),
      )
      .orderBy(desc(employeeDesignations.startDate));
    return ok(rows);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function createDesignation(
  input: unknown,
): Promise<Result<EmployeeDesignation>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = createDesignationSchema.parse(input);

    const [row] = await db
      .insert(employeeDesignations)
      .values({ employeeId: parsed.employeeId, ...designationValues(parsed) })
      .returning();
    if (!row) return err("Failed to add designation.");

    await audit201Write(
      user,
      "employee_201.designation.create",
      "employee_designations",
      row.id,
      "designations",
      {
        employeeId: parsed.employeeId,
        designationType: parsed.designationType,
        designationTitle: parsed.designationTitle,
      },
    );
    revalidateEmployee201(parsed.employeeId);
    return ok(row);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function updateDesignation(
  input: unknown,
): Promise<Result<EmployeeDesignation>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = updateDesignationSchema.parse(input);

    const [row] = await db
      .update(employeeDesignations)
      .set({ ...designationValues(parsed), updatedAt: new Date() })
      .where(
        and(
          eq(employeeDesignations.id, parsed.id),
          isNull(employeeDesignations.deletedAt),
        ),
      )
      .returning();
    if (!row) return err("Designation record not found.");

    await audit201Write(
      user,
      "employee_201.designation.update",
      "employee_designations",
      row.id,
      "designations",
      {
        designationType: parsed.designationType,
        designationTitle: parsed.designationTitle,
        status: parsed.status,
      },
    );
    revalidateEmployee201(row.employeeId);
    return ok(row);
  } catch (e) {
    return handleActionError(e);
  }
}

export async function removeDesignation(
  input: unknown,
): Promise<Result<{ id: string }>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = remove201RowSchema.parse(input);

    const [row] = await db
      .update(employeeDesignations)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(employeeDesignations.id, parsed.id),
          isNull(employeeDesignations.deletedAt),
        ),
      )
      .returning();
    if (!row) return err("Designation record not found.");

    await audit201Write(
      user,
      "employee_201.designation.remove",
      "employee_designations",
      row.id,
      "designations",
      { softDeleted: true },
    );
    revalidateEmployee201(row.employeeId);
    return ok({ id: row.id });
  } catch (e) {
    return handleActionError(e);
  }
}

// ═══ PDS profile extras (stored on the employees row) ════════════════════════

export async function updateEmployeePdsProfile(
  input: unknown,
): Promise<Result<{ employeeId: string }>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = updatePdsProfileSchema.parse(input);

    const governmentIssuedId = parsed.governmentIssuedId
      ? {
          idType: parsed.governmentIssuedId.idType ?? undefined,
          idNo: parsed.governmentIssuedId.idNo ?? undefined,
          dateIssued: parsed.governmentIssuedId.dateIssued ?? undefined,
          placeIssued: parsed.governmentIssuedId.placeIssued ?? undefined,
        }
      : null;

    const pdsQuestionnaire = parsed.pdsQuestionnaire
      ? Object.fromEntries(
          Object.entries(parsed.pdsQuestionnaire).map(([key, value]) => [
            key,
            { answer: value.answer, details: value.details ?? null },
          ]),
        )
      : null;

    const [row] = await db
      .update(employees)
      .set({
        placeOfBirth: parsed.placeOfBirth ?? null,
        heightM: parsed.heightM != null ? parsed.heightM.toFixed(2) : null,
        weightKg: parsed.weightKg != null ? parsed.weightKg.toFixed(2) : null,
        sssNo: parsed.sssNo ?? null,
        telephoneNo: parsed.telephoneNo ?? null,
        permanentAddressStreet: parsed.permanentAddressStreet ?? null,
        permanentAddressBarangay: parsed.permanentAddressBarangay ?? null,
        permanentAddressCity: parsed.permanentAddressCity ?? null,
        permanentAddressProvince: parsed.permanentAddressProvince ?? null,
        permanentAddressZipCode: parsed.permanentAddressZipCode ?? null,
        dualCitizenshipType: parsed.dualCitizenshipType ?? null,
        dualCitizenshipCountry: parsed.dualCitizenshipCountry ?? null,
        governmentIssuedId,
        pdsQuestionnaire,
        nonAcademicDistinctions: parsed.nonAcademicDistinctions ?? null,
        organizationMemberships: parsed.organizationMemberships ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(employees.id, parsed.employeeId), isNull(employees.deletedAt)),
      )
      .returning({ id: employees.id });
    if (!row) return err("Employee not found.");

    await audit201Write(
      user,
      "employee_201.pds_profile.update",
      "employees",
      row.id,
      "pds_profile",
      {
        // Non-PII summary of which field groups were touched.
        hasGovernmentId: governmentIssuedId != null,
        hasQuestionnaire: pdsQuestionnaire != null,
        distinctionCount: parsed.nonAcademicDistinctions?.length ?? 0,
        membershipCount: parsed.organizationMemberships?.length ?? 0,
      },
    );
    revalidateEmployee201(parsed.employeeId);
    return ok({ employeeId: row.id });
  } catch (e) {
    return handleActionError(e);
  }
}
