import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { employees, offices, type Employee } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { EmployeeListParams } from "@/lib/validations/employees";

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

type EmployeeListQueryRow = {
  id: string;
  employee_no: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  position_title: string;
  appointment_type: Employee["appointmentType"];
  salary_grade: number;
  step: number;
  status: Employee["status"];
  office_id: string | null;
  email: string | null;
  phone: string | null;
  date_hired: string;
  created_at: string;
  updated_at: string;
  offices: { name: string } | { name: string }[] | null;
};

const EMPLOYEE_LIST_COLUMNS = `
  id,
  employee_no,
  first_name,
  middle_name,
  last_name,
  suffix,
  position_title,
  appointment_type,
  salary_grade,
  step,
  status,
  office_id,
  email,
  phone,
  date_hired,
  created_at,
  updated_at,
  offices(name)
`;

function sanitizeEmployeeSearch(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9 _-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

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

  // Use the pooled Supabase server client for this list read. The direct
  // Postgres client remains in use for detail reads and mutations, but opening
  // a cold serverless DB connection here made every directory navigation wait.
  let query = supabaseAdmin
    .from("employees")
    .select(EMPLOYEE_LIST_COLUMNS, { count: "exact" })
    .is("deleted_at", null);

  if (appointmentType) query = query.eq("appointment_type", appointmentType);
  if (officeId) query = query.eq("office_id", officeId);
  if (status) query = query.eq("status", status);
  if (salaryGrade) query = query.eq("salary_grade", salaryGrade);

  const safeSearch = search ? sanitizeEmployeeSearch(search) : "";
  if (safeSearch) {
    const pattern = `*${safeSearch}*`;
    query = query.or(
      [
        `first_name.ilike.${pattern}`,
        `last_name.ilike.${pattern}`,
        `middle_name.ilike.${pattern}`,
        `employee_no.ilike.${pattern}`,
        `position_title.ilike.${pattern}`,
      ].join(","),
    );
  }

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .range(offset, offset + perPage - 1);

  if (error) throw new Error(`Failed to fetch employees: ${error.message}`);

  const rows = (data ?? []) as unknown as EmployeeListQueryRow[];
  const total = count ?? 0;

  return {
    data: rows.map((r) => ({
      id: r.id,
      employeeNo: r.employee_no,
      firstName: r.first_name,
      middleName: r.middle_name ?? null,
      lastName: r.last_name,
      suffix: r.suffix ?? null,
      positionTitle: r.position_title,
      appointmentType: r.appointment_type,
      salaryGrade: r.salary_grade,
      step: r.step,
      status: r.status,
      officeId: r.office_id ?? null,
      officeName: Array.isArray(r.offices)
        ? (r.offices[0]?.name ?? null)
        : (r.offices?.name ?? null),
      email: r.email ?? null,
      phone: r.phone ?? null,
      dateHired: r.date_hired,
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
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

async function fetchOfficesForSelect(): Promise<OfficeSelectOption[]> {
  return db
    .select({
      id: offices.id,
      name: offices.name,
      code: offices.code,
    })
    .from(offices)
    .orderBy(offices.name);
}

export const getOfficesForSelect = unstable_cache(
  fetchOfficesForSelect,
  ["employees:office-select:v1"],
  { revalidate: 300, tags: ["offices"] },
);

// ---------------------------------------------------------------------------
// getEmployeeForEdit — same as getEmployeeById, used in edit page
// ---------------------------------------------------------------------------
export const getEmployeeForEdit = getEmployeeById;
