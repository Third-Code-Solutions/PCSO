import { NextResponse } from "next/server";
import { z } from "zod";

import { logTransaction } from "@/lib/audit";
import { authenticateApiRequest } from "@/lib/api/v1/auth";
import {
  problem,
  validationProblem,
  internalProblem,
} from "@/lib/api/v1/problem";
import { apiResponse } from "@/lib/api/v1/xml";
import {
  apiEmployeeUpdateSchema,
  findApiEmployee,
  serializeEmployee,
  softDeleteApiEmployee,
  updateApiEmployee,
} from "@/lib/api/v1/employees";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * /api/v1/employees/[id] — TOR 3.3.5.
 *
 *   GET    — read one employee.  Scope: employees:read.
 *   PATCH  — partial update.     Scope: employees:write.
 *   DELETE — soft delete.        Scope: employees:write.
 *            (PIM-009: personnel records are never hard-deleted.)
 */

type RouteContext = { params: Promise<{ id: string }> };

const idSchema = z.string().uuid();

function notFound() {
  return problem({
    status: 404,
    title: "Not Found",
    detail: "Employee not found",
  });
}

async function resolveId(context: RouteContext) {
  const { id } = await context.params;
  return idSchema.safeParse(id);
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request, ["employees:read"]);
    if (!auth.ok) return auth.response;

    const id = await resolveId(context);
    if (!id.success) return notFound();

    const row = await findApiEmployee(id.data);
    if (!row) return notFound();

    return apiResponse(request, "employee", { data: serializeEmployee(row) });
  } catch (error: unknown) {
    return internalProblem(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request, ["employees:write"]);
    if (!auth.ok) return auth.response;

    const id = await resolveId(context);
    if (!id.success) return notFound();

    const json: unknown = await request.json().catch(() => null);
    if (json === null) {
      return problem({
        status: 400,
        title: "Bad Request",
        detail: "Request body must be valid JSON.",
      });
    }
    const parsed = apiEmployeeUpdateSchema.safeParse(json);
    if (!parsed.success) {
      return validationProblem(parsed.error.flatten());
    }

    const result = await updateApiEmployee(id.data, parsed.data);
    if (!result.ok) {
      if (result.code === "not_found") return notFound();
      return problem({
        status: result.code === "conflict" ? 409 : 422,
        title: result.code === "conflict" ? "Conflict" : "Unprocessable Entity",
        detail: result.message,
      });
    }

    void logTransaction({
      transactionType: "api.employees.update",
      status: "success",
      source: "api",
      destination: "employees",
      affectedData: {
        apiClientId: auth.ctx.clientRowId,
        clientId: auth.ctx.clientId,
        employeeId: result.employee.id,
        fields: Object.keys(parsed.data),
      },
    });

    return apiResponse(request, "employee", {
      data: serializeEmployee(result.employee),
    });
  } catch (error: unknown) {
    return internalProblem(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request, ["employees:write"]);
    if (!auth.ok) return auth.response;

    const id = await resolveId(context);
    if (!id.success) return notFound();

    const result = await softDeleteApiEmployee(id.data);
    if (!result.ok) return notFound();

    void logTransaction({
      transactionType: "api.employees.delete",
      status: "success",
      source: "api",
      destination: "employees",
      affectedData: {
        apiClientId: auth.ctx.clientRowId,
        clientId: auth.ctx.clientId,
        employeeId: result.employee.id,
        softDelete: true,
      },
    });

    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    return internalProblem(error);
  }
}
