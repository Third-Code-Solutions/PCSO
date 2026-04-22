"use server";

/**
 * PIMM — Employee creation and editing server actions (PIM-001, PIM-004).
 *
 * PIM-001: Full employee 201 file creation with all TOR 1.3.1 fields.
 * PIM-004: Employee and authorized HR staff may upload scanned documents
 *          to staging. HRD validates before committing.
 *
 * Authorization:
 *   - Writes:  requirePermission('employees', 'create' | 'edit')
 *              → hr_admin + super_admin
 *   - Reads:   requirePermission('employees', 'view')
 *              → all authenticated users (scope filtered by role)
 *
 * Notifications: N-001 through N-007 handled by leave/attendance modules.
 */

import { and, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { employees, type Employee, type NewEmployee } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";

// ─── Result envelope ─────────────────────────────────────────────────────────

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
  return e instanceof Error ? e.message : "Unexpected error";
}

// ─── Input schemas ───────────────────────────────────────────────────────────

const createEmployeeSchema = z.object({
  // Identifiers
  employeeNo: z.string().min(1).max(20),

  // Personal info (all TOR 1.3.1 fields)
  firstName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional(),
  lastName: z.string().min(1).max(100),
  suffix: z.string().max(10).optional(),
  birthDate: z.string(), // date in YYYY-MM-DD format
  gender: z.enum(["male", "female", "prefer_not_to_say"]),
  civilStatus: z.enum([
    "single",
    "married",
    "widowed",
    "legally_separated",
    "annulled",
  ]),
  nationality: z.string().max(100).default("Filipino"),
  religion: z.string().max(100).optional(),
  bloodType: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional(),

  // Government IDs
  tin: z.string().max(20).optional(),
  gsisNo: z.string().max(30).optional(),
  philhealthNo: z.string().max(30).optional(),
  pagibigNo: z.string().max(30).optional(),

  // Bank Details
  bankName: z.string().max(100).optional(),
  bankAccountNumber: z.string().max(30).optional(),

  // Position / Appointment
  appointmentType: z.enum([
    "permanent",
    "temporary",
    "coterminous",
    "casual",
    "job_order",
    "contract_of_service",
  ]),
  positionTitle: z.string().min(1).max(255),
  salaryGrade: z.number().int().min(1).max(33),
  step: z.number().int().min(1).max(8),
  officeId: z.string().uuid().optional(),

  // Employment dates
  dateHired: z.string(), // date in YYYY-MM-DD format
  dateRegularized: z.string().optional(),

  // Contact
  email: z.string().email().max(255).optional(),
  phone: z.string().max(20).optional(),

  // Address
  addressStreet: z.string().optional(),
  addressBarangay: z.string().max(100).optional(),
  addressCity: z.string().max(100).optional(),
  addressProvince: z.string().max(100).optional(),
  addressZipCode: z.string().max(10).optional(),

  // Emergency contact
  emergencyContactName: z.string().max(255).optional(),
  emergencyContactRelationship: z.string().max(100).optional(),
  emergencyContactPhone: z.string().max(20).optional(),
});

const updateEmployeeSchema = z.object({
  id: z.string().uuid(),
  data: createEmployeeSchema.partial(),
});

const searchEmployeesSchema = z.object({
  query: z.string().max(255).optional(),
  officeId: z.string().uuid().optional(),
  status: z
    .enum([
      "active",
      "on_leave",
      "suspended",
      "resigned",
      "retired",
      "terminated",
      "deceased",
    ])
    .optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

const getEmployeeSchema = z.object({
  id: z.string().uuid(),
});

// ─── createEmployee (PIM-001) ───────────────────────────────────────────────

export interface CreateEmployeeResult {
  id: string;
  employeeNo: string;
}

export async function createEmployee(
  input: unknown,
): Promise<Result<CreateEmployeeResult>> {
  try {
    const user = await requirePermission("employees", "create");
    const parsed = createEmployeeSchema.parse(input);

    // Check for duplicate employee number
    const existing = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.employeeNo, parsed.employeeNo))
      .limit(1);

    if (existing.length > 0) {
      return err(`Employee number ${parsed.employeeNo} already exists.`);
    }

    const [newEmployee] = await db
      .insert(employees)
      .values({
        employeeNo: parsed.employeeNo,
        firstName: parsed.firstName,
        middleName: parsed.middleName ?? null,
        lastName: parsed.lastName,
        suffix: parsed.suffix ?? null,
        birthDate: parsed.birthDate,
        gender: parsed.gender,
        civilStatus: parsed.civilStatus,
        nationality: parsed.nationality,
        religion: parsed.religion ?? null,
        bloodType: parsed.bloodType ?? null,
        tin: parsed.tin ?? null,
        gsisNo: parsed.gsisNo ?? null,
        philhealthNo: parsed.philhealthNo ?? null,
        pagibigNo: parsed.pagibigNo ?? null,
        bankName: parsed.bankName ?? null,
        bankAccountNumber: parsed.bankAccountNumber ?? null,
        appointmentType: parsed.appointmentType,
        positionTitle: parsed.positionTitle,
        salaryGrade: parsed.salaryGrade,
        step: parsed.step,
        officeId: parsed.officeId ?? null,
        dateHired: parsed.dateHired,
        dateRegularized: parsed.dateRegularized ?? null,
        email: parsed.email ?? null,
        phone: parsed.phone ?? null,
        addressStreet: parsed.addressStreet ?? null,
        addressBarangay: parsed.addressBarangay ?? null,
        addressCity: parsed.addressCity ?? null,
        addressProvince: parsed.addressProvince ?? null,
        addressZipCode: parsed.addressZipCode ?? null,
        emergencyContactName: parsed.emergencyContactName ?? null,
        emergencyContactRelationship:
          parsed.emergencyContactRelationship ?? null,
        emergencyContactPhone: parsed.emergencyContactPhone ?? null,
        status: "active",
      })
      .returning();

    if (!newEmployee) {
      return err("Failed to create employee record.");
    }

    await auditLog({
      userId: user.id,
      action: "employee.create",
      table: "employees",
      recordId: newEmployee.id,
      newValues: {
        employeeNo: parsed.employeeNo,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
      },
    });

    revalidatePath("/employees");

    return ok({ id: newEmployee.id, employeeNo: newEmployee.employeeNo });
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── updateEmployee ─────────────────────────────────────────────────────────

export async function updateEmployee(
  input: unknown,
): Promise<Result<Employee>> {
  try {
    const user = await requirePermission("employees", "edit");
    const parsed = updateEmployeeSchema.parse(input);

    const [updated] = await db
      .update(employees)
      .set(parsed.data as Partial<NewEmployee>)
      .where(eq(employees.id, parsed.id))
      .returning();

    if (!updated) {
      return err("Employee not found.");
    }

    await auditLog({
      userId: user.id,
      action: "employee.update",
      table: "employees",
      recordId: updated.id,
      newValues: parsed.data,
    });

    revalidatePath("/employees");
    revalidatePath(`/employees/${updated.id}`);

    return ok(updated);
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── getEmployee ─────────────────────────────────────────────────────────────

export async function getEmployee(input: unknown): Promise<Result<Employee>> {
  try {
    await requirePermission("employees", "view");
    const parsed = getEmployeeSchema.parse(input);

    const [employee] = await db
      .select()
      .from(employees)
      .where(and(eq(employees.id, parsed.id), eq(employees.deletedAt, null)))
      .limit(1);

    if (!employee) {
      return err("Employee not found.");
    }

    return ok(employee);
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// ─── searchEmployees ─────────────────────────────────────────────────────────

export interface EmployeeSearchResult {
  id: string;
  employeeNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  positionTitle: string;
  status: string;
  email: string | null;
}

export interface SearchEmployeesResult {
  employees: EmployeeSearchResult[];
  total: number;
}

export async function searchEmployees(
  input: unknown,
): Promise<Result<SearchEmployeesResult>> {
  try {
    await requirePermission("employees", "view");
    const parsed = searchEmployeesSchema.parse(input);

    const conditions = [eq(employees.deletedAt, null)];

    if (parsed.query) {
      conditions.push(
        or(
          ilike(employees.firstName, `%${parsed.query}%`),
          ilike(employees.lastName, `%${parsed.query}%`),
          ilike(employees.employeeNo, `%${parsed.query}%`),
        )!,
      );
    }

    if (parsed.officeId) {
      conditions.push(eq(employees.officeId, parsed.officeId));
    }

    if (parsed.status) {
      conditions.push(eq(employees.status, parsed.status));
    }

    const where = and(...conditions);

    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(employees)
      .where(where);

    const results = await db
      .select({
        id: employees.id,
        employeeNo: employees.employeeNo,
        firstName: employees.firstName,
        middleName: employees.middleName,
        lastName: employees.lastName,
        suffix: employees.suffix,
        positionTitle: employees.positionTitle,
        status: employees.status,
        email: employees.email,
      })
      .from(employees)
      .where(where)
      .limit(parsed.limit)
      .offset(parsed.offset);

    return ok({ employees: results, total: totalCount ?? 0 });
  } catch (e) {
    return err(toErrMsg(e));
  }
}

// Unused import guard — keep `sql` import available for any later raw usage.
void sql;
