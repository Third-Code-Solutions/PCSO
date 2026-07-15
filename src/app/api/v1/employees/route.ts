import { and, asc, eq, gte, isNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { logTransaction } from "@/lib/audit";
import { authenticateApiRequest } from "@/lib/api/v1/auth";
import {
  problem,
  validationProblem,
  internalProblem,
} from "@/lib/api/v1/problem";
import { apiResponse } from "@/lib/api/v1/xml";
import {
  apiEmployeeCreateSchema,
  createApiEmployee,
  serializeEmployee,
} from "@/lib/api/v1/employees";
import {
  APPOINTMENT_TYPE_VALUES,
  EMPLOYEE_STATUS_VALUES,
} from "@/lib/validations/employees";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * /api/v1/employees — TOR 3.3.5 (RESTful CRUD) + 3.3.9 (JSON/XML).
 *
 *   GET  — list employees. Scope: employees:read.
 *          Filters: office_id, status, appointment_type, updated_since.
 *          Pagination: page (1-based), limit (max 200, default 25).
 *   POST — create employee. Scope: employees:write.
 */

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 200;

const listQuerySchema = z.object({
  office_id: z.string().uuid().optional(),
  status: z.enum(EMPLOYEE_STATUS_VALUES).optional(),
  appointment_type: z.enum(APPOINTMENT_TYPE_VALUES).optional(),
  updated_since: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "updated_since must be an ISO 8601 date/datetime",
    })
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
});

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiRequest(request, ["employees:read"]);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const parsed = listQuerySchema.safeParse({
      office_id: url.searchParams.get("office_id") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      appointment_type: url.searchParams.get("appointment_type") ?? undefined,
      updated_since: url.searchParams.get("updated_since") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      return validationProblem(parsed.error.flatten());
    }
    const query = parsed.data;

    const conditions: SQL[] = [isNull(employees.deletedAt)];
    if (query.office_id) {
      conditions.push(eq(employees.officeId, query.office_id));
    }
    if (query.status) conditions.push(eq(employees.status, query.status));
    if (query.appointment_type) {
      conditions.push(eq(employees.appointmentType, query.appointment_type));
    }
    if (query.updated_since) {
      conditions.push(gte(employees.updatedAt, new Date(query.updated_since)));
    }
    const where = and(...conditions);

    const [countRow] = await db
      .select({ total: sql<number>`cast(count(*) as int)` })
      .from(employees)
      .where(where);
    const total = countRow?.total ?? 0;

    const rows = await db
      .select()
      .from(employees)
      .where(where)
      .orderBy(asc(employees.lastName), asc(employees.firstName))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);

    return apiResponse(request, "employees", {
      data: rows.map(serializeEmployee),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        total_pages: Math.max(1, Math.ceil(total / query.limit)),
      },
    });
  } catch (error: unknown) {
    return internalProblem(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiRequest(request, ["employees:write"]);
    if (!auth.ok) return auth.response;

    const json: unknown = await request.json().catch(() => null);
    if (json === null) {
      return problem({
        status: 400,
        title: "Bad Request",
        detail: "Request body must be valid JSON.",
      });
    }
    const parsed = apiEmployeeCreateSchema.safeParse(json);
    if (!parsed.success) {
      return validationProblem(parsed.error.flatten());
    }

    const result = await createApiEmployee(parsed.data);
    if (!result.ok) {
      return problem({
        status: result.code === "conflict" ? 409 : 422,
        title: result.code === "conflict" ? "Conflict" : "Unprocessable Entity",
        detail: result.message,
      });
    }

    void logTransaction({
      transactionType: "api.employees.create",
      status: "success",
      source: "api",
      destination: "employees",
      affectedData: {
        apiClientId: auth.ctx.clientRowId,
        clientId: auth.ctx.clientId,
        employeeId: result.employee.id,
        employeeNo: result.employee.employeeNo,
      },
    });

    return apiResponse(
      request,
      "employee",
      { data: serializeEmployee(result.employee) },
      {
        status: 201,
        headers: { Location: `/api/v1/employees/${result.employee.id}` },
      },
    );
  } catch (error: unknown) {
    return internalProblem(error);
  }
}
