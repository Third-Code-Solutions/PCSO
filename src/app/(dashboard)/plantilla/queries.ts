/**
 * Server-side data fetching for the plantilla module.
 * NOTE: This must NOT have "use server" — that directive turns exports into
 * Server Actions (client-invoked RPCs). These are inline server-component
 * queries, not actions, so adding "use server" here causes the page to hang.
 *
 * These functions READ data only — mutations live in actions.ts.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface PlantillaPositionRow {
  id: string;
  itemNo: string;
  positionTitle: string;
  salaryGrade: number;
  authorizedSalary: string;
  officeId: string;
  officeName: string;
  officeCode: string;
  isFilled: boolean;
  employeeId: string | null;
  employeeName: string | null;
  employeeNo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VacancySummaryRow {
  officeId: string;
  officeName: string;
  officeCode: string;
  officeType: string;
  total: number;
  filled: number;
  vacant: number;
  fillRatePct: number;
}

export interface OfficeRow {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId: string | null;
  headEmployeeId: string | null;
  headEmployeeName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeSelectorRow {
  id: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  positionTitle: string;
  officeId: string | null;
}

export interface PlantillaListParams {
  page?: number;
  perPage?: number;
  search?: string;
  officeId?: string;
  salaryGrade?: number;
  status?: "filled" | "vacant" | "all";
}

// ---------------------------------------------------------------------------
// Plantilla positions list
// ---------------------------------------------------------------------------

export async function getPlantillaPositions(
  params: PlantillaListParams = {},
): Promise<{ rows: PlantillaPositionRow[]; total: number }> {
  const supabase = supabaseAdmin;
  const page = params.page ?? 1;
  const perPage = params.perPage ?? 50;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase
    .from("plantilla_positions")
    .select(
      `
      id,
      item_no,
      position_title,
      salary_grade,
      authorized_salary,
      office_id,
      is_filled,
      employee_id,
      created_at,
      updated_at,
      offices!inner(name, code),
      employees(employee_no, first_name, last_name)
    `,
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order("item_no", { ascending: true })
    .range(from, to);

  if (params.officeId) {
    query = query.eq("office_id", params.officeId);
  }
  if (params.salaryGrade) {
    query = query.eq("salary_grade", params.salaryGrade);
  }
  if (params.status === "filled") {
    query = query.eq("is_filled", true);
  } else if (params.status === "vacant") {
    query = query.eq("is_filled", false);
  }
  if (params.search) {
    query = query.or(
      `position_title.ilike.%${params.search}%,item_no.ilike.%${params.search}%`,
    );
  }

  const { data, error, count } = await query;
  if (error)
    throw new Error(`Failed to fetch plantilla positions: ${error.message}`);

  const rows: PlantillaPositionRow[] = (data ?? []).map((row) => {
    const office = Array.isArray(row.offices) ? row.offices[0] : row.offices;
    const employee = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees;
    return {
      id: row.id as string,
      itemNo: row.item_no as string,
      positionTitle: row.position_title as string,
      salaryGrade: row.salary_grade as number,
      authorizedSalary: row.authorized_salary as string,
      officeId: row.office_id as string,
      officeName: (office as { name: string } | null)?.name ?? "",
      officeCode: (office as { code: string } | null)?.code ?? "",
      isFilled: row.is_filled as boolean,
      employeeId: row.employee_id as string | null,
      employeeName: employee
        ? `${(employee as { first_name: string }).first_name} ${(employee as { last_name: string }).last_name}`
        : null,
      employeeNo: employee
        ? (employee as { employee_no: string }).employee_no
        : null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  });

  return { rows, total: count ?? 0 };
}

// ---------------------------------------------------------------------------
// Single plantilla position
// ---------------------------------------------------------------------------

export async function getPlantillaPositionById(
  id: string,
): Promise<PlantillaPositionRow | null> {
  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("plantilla_positions")
    .select(
      `
      id,
      item_no,
      position_title,
      salary_grade,
      authorized_salary,
      office_id,
      is_filled,
      employee_id,
      created_at,
      updated_at,
      offices(name, code),
      employees(employee_no, first_name, last_name)
    `,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) return null;

  const office = Array.isArray(data.offices) ? data.offices[0] : data.offices;
  const employee = Array.isArray(data.employees)
    ? data.employees[0]
    : data.employees;

  return {
    id: data.id as string,
    itemNo: data.item_no as string,
    positionTitle: data.position_title as string,
    salaryGrade: data.salary_grade as number,
    authorizedSalary: data.authorized_salary as string,
    officeId: data.office_id as string,
    officeName: (office as { name: string } | null)?.name ?? "",
    officeCode: (office as { code: string } | null)?.code ?? "",
    isFilled: data.is_filled as boolean,
    employeeId: data.employee_id as string | null,
    employeeName: employee
      ? `${(employee as { first_name: string }).first_name} ${(employee as { last_name: string }).last_name}`
      : null,
    employeeNo: employee
      ? (employee as { employee_no: string }).employee_no
      : null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// Vacancy summary grouped by office
// ---------------------------------------------------------------------------

export async function getVacancySummary(): Promise<VacancySummaryRow[]> {
  const supabase = supabaseAdmin;

  // Fetch all positions with their office info
  const { data, error } = await supabase
    .from("plantilla_positions")
    .select(
      `
      office_id,
      is_filled,
      offices!inner(id, name, code, type)
    `,
    )
    .is("deleted_at", null);

  if (error)
    throw new Error(`Failed to fetch vacancy summary: ${error.message}`);

  // Group by office in memory
  const officeMap = new Map<
    string,
    {
      officeId: string;
      officeName: string;
      officeCode: string;
      officeType: string;
      total: number;
      filled: number;
    }
  >();

  for (const row of data ?? []) {
    const office = Array.isArray(row.offices) ? row.offices[0] : row.offices;
    const officeId = row.office_id as string;
    const existing = officeMap.get(officeId);

    if (!existing) {
      officeMap.set(officeId, {
        officeId,
        officeName: (office as { name: string }).name,
        officeCode: (office as { code: string }).code,
        officeType: (office as { type: string }).type,
        total: 1,
        filled: (row.is_filled as boolean) ? 1 : 0,
      });
    } else {
      existing.total += 1;
      if (row.is_filled as boolean) existing.filled += 1;
    }
  }

  return Array.from(officeMap.values())
    .map((entry) => ({
      officeId: entry.officeId,
      officeName: entry.officeName,
      officeCode: entry.officeCode,
      officeType: entry.officeType,
      total: entry.total,
      filled: entry.filled,
      vacant: entry.total - entry.filled,
      fillRatePct:
        entry.total > 0 ? Math.round((entry.filled / entry.total) * 100) : 0,
    }))
    .sort((a, b) => a.officeName.localeCompare(b.officeName));
}

// ---------------------------------------------------------------------------
// Offices list (for filters and forms)
// ---------------------------------------------------------------------------

export async function getOffices(): Promise<OfficeRow[]> {
  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("offices")
    .select(
      `
      id,
      name,
      code,
      type,
      parent_id,
      head_employee_id,
      created_at,
      updated_at,
      employees(first_name, last_name)
    `,
    )
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to fetch offices: ${error.message}`);

  return (data ?? []).map((row) => {
    const headEmployee = Array.isArray(row.employees)
      ? row.employees[0]
      : row.employees;
    return {
      id: row.id as string,
      name: row.name as string,
      code: row.code as string,
      type: row.type as string,
      parentId: row.parent_id as string | null,
      headEmployeeId: row.head_employee_id as string | null,
      headEmployeeName: headEmployee
        ? `${(headEmployee as { first_name: string }).first_name} ${(headEmployee as { last_name: string }).last_name}`
        : null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  });
}

// ---------------------------------------------------------------------------
// Single office
// ---------------------------------------------------------------------------

export async function getOfficeById(id: string): Promise<OfficeRow | null> {
  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("offices")
    .select(
      `
      id,
      name,
      code,
      type,
      parent_id,
      head_employee_id,
      created_at,
      updated_at,
      employees(first_name, last_name)
    `,
    )
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (error) return null;

  const headEmployee = Array.isArray(data.employees)
    ? data.employees[0]
    : data.employees;
  return {
    id: data.id as string,
    name: data.name as string,
    code: data.code as string,
    type: data.type as string,
    parentId: data.parent_id as string | null,
    headEmployeeId: data.head_employee_id as string | null,
    headEmployeeName: headEmployee
      ? `${(headEmployee as { first_name: string }).first_name} ${(headEmployee as { last_name: string }).last_name}`
      : null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

// ---------------------------------------------------------------------------
// Active employees (for assignment selector)
// ---------------------------------------------------------------------------

export async function getActiveEmployees(): Promise<EmployeeSelectorRow[]> {
  const supabase = supabaseAdmin;

  const { data, error } = await supabase
    .from("employees")
    .select("id, employee_no, first_name, last_name, position_title, office_id")
    .eq("status", "active")
    .is("deleted_at", null)
    .order("last_name", { ascending: true });

  if (error) throw new Error(`Failed to fetch employees: ${error.message}`);

  return (data ?? []).map((row) => ({
    id: row.id as string,
    employeeNo: row.employee_no as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    positionTitle: row.position_title as string,
    officeId: row.office_id as string | null,
  }));
}
