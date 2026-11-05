import "server-only";

/**
 * v1 employee resource — shared schemas, serializer and mutation helpers for
 * `/api/v1/employees`, `/api/v1/employees/[id]` and `/api/v1/employees/batch`
 * (TOR 3.3.5 / 3.3.6).
 *
 * Wire format uses snake_case field names (public-API convention; matches
 * the XML element naming). Zod schemas mirror the minimal required column
 * set of `createEmployeeSchema` in `src/lib/actions/pimm/employees.ts`
 * (enum values imported from `src/lib/validations/employees.ts` so drift is
 * impossible).
 */

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import type { Tx } from "@/lib/db/transaction";
import { employees, type Employee, type NewEmployee } from "@/lib/db/schema";
import {
  APPOINTMENT_TYPE_VALUES,
  CIVIL_STATUS_VALUES,
  EMPLOYEE_STATUS_VALUES,
  GENDER_VALUES,
} from "@/lib/validations/employees";

// ─── Wire schemas ────────────────────────────────────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = z
  .string()
  .regex(ISO_DATE, "Expected date in YYYY-MM-DD format");

export const apiEmployeeCreateSchema = z.object({
  employee_no: z.string().min(1).max(20),
  first_name: z.string().min(1).max(100),
  middle_name: z.string().max(100).optional(),
  last_name: z.string().min(1).max(100),
  suffix: z.string().max(10).optional(),
  birth_date: isoDate,
  gender: z.enum(GENDER_VALUES),
  civil_status: z.enum(CIVIL_STATUS_VALUES),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(20).optional(),
  appointment_type: z.enum(APPOINTMENT_TYPE_VALUES),
  position_title: z.string().min(1).max(255),
  salary_grade: z.number().int().min(1).max(33),
  step: z.number().int().min(1).max(8),
  office_id: z.string().uuid().optional(),
  status: z.enum(EMPLOYEE_STATUS_VALUES).optional(),
  date_hired: isoDate,
  date_regularized: isoDate.optional(),
  is_pwd: z.boolean().optional(),
});

export const apiEmployeeUpdateSchema = apiEmployeeCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export type ApiEmployeeCreateInput = z.infer<typeof apiEmployeeCreateSchema>;
export type ApiEmployeeUpdateInput = z.infer<typeof apiEmployeeUpdateSchema>;

// ─── Serializer ──────────────────────────────────────────────────────────────

export interface ApiEmployee {
  id: string;
  employee_no: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  birth_date: string;
  gender: string;
  civil_status: string;
  email: string | null;
  phone: string | null;
  appointment_type: string;
  position_title: string;
  salary_grade: number;
  step: number;
  office_id: string | null;
  status: string;
  date_hired: string;
  date_regularized: string | null;
  is_pwd: boolean;
  created_at: string;
  updated_at: string;
}

export function serializeEmployee(row: Employee): ApiEmployee {
  return {
    id: row.id,
    employee_no: row.employeeNo,
    first_name: row.firstName,
    middle_name: row.middleName ?? null,
    last_name: row.lastName,
    suffix: row.suffix ?? null,
    birth_date: row.birthDate,
    gender: row.gender,
    civil_status: row.civilStatus,
    email: row.email ?? null,
    phone: row.phone ?? null,
    appointment_type: row.appointmentType,
    position_title: row.positionTitle,
    salary_grade: row.salaryGrade,
    step: row.step,
    office_id: row.officeId ?? null,
    status: row.status,
    date_hired: row.dateHired,
    date_regularized: row.dateRegularized ?? null,
    is_pwd: row.isPwd,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

// ─── Mutation helpers (shared by single + batch routes) ──────────────────────

export type EmployeeMutationResult =
  | { ok: true; employee: Employee; created: boolean }
  | {
      ok: false;
      code: "not_found" | "conflict" | "invalid_reference";
      message: string;
    };

function pgErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/** Translate DB constraint failures into API-facing results; rethrow others. */
function mapConstraintError(error: unknown): EmployeeMutationResult {
  const code = pgErrorCode(error);
  if (code === "23505") {
    return {
      ok: false,
      code: "conflict",
      message:
        "An employee with this employee_no (or unique field) already exists.",
    };
  }
  if (code === "23503") {
    return {
      ok: false,
      code: "invalid_reference",
      message: "Referenced record does not exist (check office_id).",
    };
  }
  throw error;
}

function toInsertValues(input: ApiEmployeeCreateInput): NewEmployee {
  return {
    employeeNo: input.employee_no,
    firstName: input.first_name,
    middleName: input.middle_name ?? null,
    lastName: input.last_name,
    suffix: input.suffix ?? null,
    birthDate: input.birth_date,
    gender: input.gender,
    civilStatus: input.civil_status,
    email: input.email ?? null,
    phone: input.phone ?? null,
    appointmentType: input.appointment_type,
    positionTitle: input.position_title,
    salaryGrade: input.salary_grade,
    step: input.step,
    officeId: input.office_id ?? null,
    status: input.status ?? "active",
    dateHired: input.date_hired,
    dateRegularized: input.date_regularized ?? null,
    isPwd: input.is_pwd ?? false,
  };
}

function toUpdateValues(input: ApiEmployeeUpdateInput): Partial<NewEmployee> {
  const patch: Partial<NewEmployee> = {};
  if (input.employee_no !== undefined) patch.employeeNo = input.employee_no;
  if (input.first_name !== undefined) patch.firstName = input.first_name;
  if (input.middle_name !== undefined) patch.middleName = input.middle_name;
  if (input.last_name !== undefined) patch.lastName = input.last_name;
  if (input.suffix !== undefined) patch.suffix = input.suffix;
  if (input.birth_date !== undefined) patch.birthDate = input.birth_date;
  if (input.gender !== undefined) patch.gender = input.gender;
  if (input.civil_status !== undefined) patch.civilStatus = input.civil_status;
  if (input.email !== undefined) patch.email = input.email;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.appointment_type !== undefined)
    patch.appointmentType = input.appointment_type;
  if (input.position_title !== undefined)
    patch.positionTitle = input.position_title;
  if (input.salary_grade !== undefined) patch.salaryGrade = input.salary_grade;
  if (input.step !== undefined) patch.step = input.step;
  if (input.office_id !== undefined) patch.officeId = input.office_id;
  if (input.status !== undefined) patch.status = input.status;
  if (input.date_hired !== undefined) patch.dateHired = input.date_hired;
  if (input.date_regularized !== undefined)
    patch.dateRegularized = input.date_regularized;
  if (input.is_pwd !== undefined) patch.isPwd = input.is_pwd;
  return patch;
}

/** `db`, or a transaction handle so the batch route can run all-or-nothing. */
type DbExecutor = typeof db | Tx;

export async function findApiEmployee(id: string): Promise<Employee | null> {
  const [row] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function createApiEmployee(
  input: ApiEmployeeCreateInput,
  executor: DbExecutor = db,
): Promise<EmployeeMutationResult> {
  try {
    const [row] = await executor
      .insert(employees)
      .values(toInsertValues(input))
      .returning();
    if (!row) throw new Error("Insert returned no row");
    return { ok: true, employee: row, created: true };
  } catch (error: unknown) {
    return mapConstraintError(error);
  }
}

export async function updateApiEmployee(
  id: string,
  input: ApiEmployeeUpdateInput,
  executor: DbExecutor = db,
): Promise<EmployeeMutationResult> {
  try {
    const [row] = await executor
      .update(employees)
      .set({ ...toUpdateValues(input), updatedAt: new Date() })
      .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
      .returning();
    if (!row) {
      return { ok: false, code: "not_found", message: "Employee not found" };
    }
    return { ok: true, employee: row, created: false };
  } catch (error: unknown) {
    return mapConstraintError(error);
  }
}

/** Soft delete (PIM-009: personnel records are never hard-deleted). */
export async function softDeleteApiEmployee(
  id: string,
): Promise<EmployeeMutationResult> {
  const [row] = await db
    .update(employees)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
    .returning();
  if (!row) {
    return { ok: false, code: "not_found", message: "Employee not found" };
  }
  return { ok: true, employee: row, created: false };
}
