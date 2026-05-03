import { NextResponse, type NextRequest } from "next/server";
import { and, eq, ilike, isNull, or, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees, offices } from "@/lib/db/schema";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import {
  APPOINTMENT_TYPE_VALUES,
  EMPLOYEE_STATUS_VALUES,
  EmployeeListParamsSchema,
} from "@/lib/validations/employees";
import { APPOINTMENT_TYPE_LABELS } from "@/lib/constants/appointment-types";

export const dynamic = "force-dynamic";

// CSV export — mirrors the filter/search logic in queries.ts so the exported
// rows match exactly what the user sees in the table.

export const runtime = "nodejs";

/**
 * Escape a single CSV cell per RFC 4180.
 * Empty values become empty strings; anything containing a comma, quote or
 * newline gets wrapped in double quotes with embedded quotes doubled.
 */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request: NextRequest) {
  const user = await requirePermission("employees", "view");

  // Parse + validate query params with the same schema used by the list page.
  const searchParams = request.nextUrl.searchParams;
  const parsed = EmployeeListParamsSchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    perPage: searchParams.get("perPage") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    appointmentType: searchParams.get("appointmentType") ?? undefined,
    officeId: searchParams.get("officeId") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    salaryGrade: searchParams.get("salaryGrade") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { search, appointmentType, officeId, status, salaryGrade } =
    parsed.data;

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
        sql`to_tsvector('simple', coalesce(${employees.firstName}, '') || ' ' || coalesce(${employees.lastName}, '') || ' ' || coalesce(${employees.positionTitle}, '')) @@ plainto_tsquery('simple', ${search})`,
      )!,
    );
  }

  if (appointmentType && APPOINTMENT_TYPE_VALUES.includes(appointmentType)) {
    conditions.push(eq(employees.appointmentType, appointmentType));
  }
  if (officeId) conditions.push(eq(employees.officeId, officeId));
  if (status && EMPLOYEE_STATUS_VALUES.includes(status)) {
    conditions.push(eq(employees.status, status));
  }
  if (salaryGrade) conditions.push(eq(employees.salaryGrade, salaryGrade));

  // Hard cap at 10,000 rows per export — anything larger should go through a
  // background job with email delivery.
  const MAX_EXPORT_ROWS = 10_000;

  const rows = await db
    .select({
      employeeNo: employees.employeeNo,
      lastName: employees.lastName,
      firstName: employees.firstName,
      middleName: employees.middleName,
      suffix: employees.suffix,
      positionTitle: employees.positionTitle,
      appointmentType: employees.appointmentType,
      salaryGrade: employees.salaryGrade,
      step: employees.step,
      status: employees.status,
      officeName: offices.name,
      email: employees.email,
      phone: employees.phone,
      dateHired: employees.dateHired,
      dateRegularized: employees.dateRegularized,
      birthDate: employees.birthDate,
      gender: employees.gender,
      civilStatus: employees.civilStatus,
      tin: employees.tin,
      gsisNo: employees.gsisNo,
      philhealthNo: employees.philhealthNo,
      pagibigNo: employees.pagibigNo,
    })
    .from(employees)
    .leftJoin(offices, eq(employees.officeId, offices.id))
    .where(and(...conditions))
    .orderBy(desc(employees.updatedAt), employees.lastName, employees.firstName)
    .limit(MAX_EXPORT_ROWS);

  const header = [
    "Employee No.",
    "Last Name",
    "First Name",
    "Middle Name",
    "Suffix",
    "Position Title",
    "Appointment Type",
    "Salary Grade",
    "Step",
    "Status",
    "Office",
    "Email",
    "Phone",
    "Date Hired",
    "Date Regularized",
    "Birth Date",
    "Gender",
    "Civil Status",
    "TIN",
    "GSIS No.",
    "PhilHealth No.",
    "Pag-IBIG No.",
  ];

  const lines: string[] = [header.map(csvCell).join(",")];

  for (const r of rows) {
    const apptLabel =
      APPOINTMENT_TYPE_LABELS[
        r.appointmentType as keyof typeof APPOINTMENT_TYPE_LABELS
      ] ?? r.appointmentType;
    const statusLabel = r.status
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    lines.push(
      [
        r.employeeNo,
        r.lastName,
        r.firstName,
        r.middleName ?? "",
        r.suffix ?? "",
        r.positionTitle,
        apptLabel,
        `SG-${r.salaryGrade}`,
        r.step,
        statusLabel,
        r.officeName ?? "",
        r.email ?? "",
        r.phone ?? "",
        r.dateHired,
        r.dateRegularized ?? "",
        r.birthDate,
        r.gender,
        r.civilStatus,
        r.tin ?? "",
        r.gsisNo ?? "",
        r.philhealthNo ?? "",
        r.pagibigNo ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  // BOM for Excel UTF-8 compatibility.
  const body = "\uFEFF" + lines.join("\n");
  const stamp = new Date().toISOString().slice(0, 10);

  await auditLog({
    userId: user.id,
    action: "export",
    table: "employees",
    recordId: "bulk",
    newValues: {
      exportedRows: rows.length,
      filters: {
        search,
        appointmentType,
        officeId,
        status,
        salaryGrade,
      },
    },
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pcso-employees-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
