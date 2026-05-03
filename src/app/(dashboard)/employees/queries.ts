import { db } from "@/lib/db";
import { employees, offices, type Employee } from "@/lib/db/schema";
import { eq, and, isNull, ilike, or, desc, sql, count } from "drizzle-orm";
import type { EmployeeListParams } from "@/lib/validations/employees";

// ---------------------------------------------------------------------------
// Shared column selection for list views
// ---------------------------------------------------------------------------
const employeeListSelect = {
  id: employees.id,
  employeeNo: employees.employeeNo,
  firstName: employees.firstName,
  middleName: employees.middleName,
  lastName: employees.lastName,
  suffix: employees.suffix,
  positionTitle: employees.positionTitle,
  appointmentType: employees.appointmentType,
  salaryGrade: employees.salaryGrade,
  step: employees.step,
  status: employees.status,
  officeId: employees.officeId,
  email: employees.email,
  phone: employees.phone,
  dateHired: employees.dateHired,
  createdAt: employees.createdAt,
  updatedAt: employees.updatedAt,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type EmployeeListRow = {
  id: string;
  employeeNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  suffix: string | null;
  positionTitle: string;
  appointmentType: Employee["appointmentType"];
  salaryGrade: number;
  step: number;
  status: Employee["status"];
  officeId: string | null;
  officeName: string | null;
  email: string | null;
  phone: string | null;
  dateHired: string;
  createdAt: Date;
  updatedAt: Date;
};

export type EmployeeListResult = {
  data: EmployeeListRow[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

// ---------------------------------------------------------------------------
// getEmployees — paginated list with search and filters
// ---------------------------------------------------------------------------
export async function getEmployees(
  params: EmployeeListParams,
): Promise<EmployeeListResult> {
  const {
    page,
    perPage,
    search,
    appointmentType,
    officeId,
    status,
    salaryGrade,
  } = params;
  const offset = (page - 1) * perPage;

  const conditions = [isNull(employees.deletedAt)];

  if (search) {
    const searchTerm = `%${search}%`;
    conditions.push(
      or(
        ilike(employees.firstName, searchTerm),
        ilike(employees.lastName, searchTerm),
        ilike(employees.middleName, searchTerm),
        ilike(employees.employeeNo, searchTerm),
        ilike(employees.positionTitle, searchTerm),
        // FTS vector — uses the ts_vector index if available
        sql`to_tsvector('simple', coalesce(${employees.firstName}, '') || ' ' || coalesce(${employees.lastName}, '') || ' ' || coalesce(${employees.positionTitle}, '')) @@ plainto_tsquery('simple', ${search})`,
      )!,
    );
  }

  if (appointmentType) {
    conditions.push(eq(employees.appointmentType, appointmentType));
  }

  if (officeId) {
    conditions.push(eq(employees.officeId, officeId));
  }

  if (status) {
    conditions.push(eq(employees.status, status));
  }

  if (salaryGrade) {
    conditions.push(eq(employees.salaryGrade, salaryGrade));
  }

  const whereClause = and(...conditions);

  const [totalResult, rows] = await Promise.all([
    db.select({ count: count() }).from(employees).where(whereClause),
    db
      .select({
        ...employeeListSelect,
        officeName: offices.name,
      })
      .from(employees)
      .leftJoin(offices, eq(employees.officeId, offices.id))
      .where(whereClause)
      .orderBy(
        desc(employees.updatedAt),
        employees.lastName,
        employees.firstName,
      )
      .limit(perPage)
      .offset(offset),
  ]);

  const total = totalResult[0]?.count ?? 0;

  return {
    data: rows.map((r) => ({
      id: r.id,
      employeeNo: r.employeeNo,
      firstName: r.firstName,
      middleName: r.middleName ?? null,
      lastName: r.lastName,
      suffix: r.suffix ?? null,
      positionTitle: r.positionTitle,
      appointmentType: r.appointmentType,
      salaryGrade: r.salaryGrade,
      step: r.step,
      status: r.status,
      officeId: r.officeId ?? null,
      officeName: r.officeName ?? null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      dateHired: r.dateHired,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

// ---------------------------------------------------------------------------
// getEmployeeById — full profile for view/edit pages
// ---------------------------------------------------------------------------
export type EmployeeProfile = Employee & {
  officeName: string | null;
};

// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getEmployeeById(
  id: string,
): Promise<EmployeeProfile | null> {
  // Guard against non-UUID strings (e.g. segment names like "org-chart") which
  // would cause a Postgres "invalid input syntax for type uuid" error.
  if (!UUID_REGEX.test(id)) return null;

  const [row] = await db
    .select({
      employee: employees,
      officeName: offices.name,
    })
    .from(employees)
    .leftJoin(offices, eq(employees.officeId, offices.id))
    .where(and(eq(employees.id, id), isNull(employees.deletedAt)))
    .limit(1);

  if (!row) return null;

  return {
    ...row.employee,
    officeName: row.officeName ?? null,
  };
}

// ---------------------------------------------------------------------------
// getOfficesForSelect — lightweight list for office dropdowns
// ---------------------------------------------------------------------------
export type OfficeSelectOption = {
  id: string;
  name: string;
  code: string;
};

export async function getOfficesForSelect(): Promise<OfficeSelectOption[]> {
  return db
    .select({
      id: offices.id,
      name: offices.name,
      code: offices.code,
    })
    .from(offices)
    .orderBy(offices.name);
}

// ---------------------------------------------------------------------------
// getEmployeeForEdit — same as getEmployeeById, used in edit page
// ---------------------------------------------------------------------------
export const getEmployeeForEdit = getEmployeeById;
