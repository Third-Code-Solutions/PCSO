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
  apiEmployeeCreateSchema,
  apiEmployeeUpdateSchema,
  createApiEmployee,
  updateApiEmployee,
} from "@/lib/api/v1/employees";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Large batches (≤500 ops) can exceed the default serverless window.
export const maxDuration = 300;

/**
 * POST /api/v1/employees/batch — bulk operations (TOR 3.3.6 / API-003).
 * Scope: employees:write.
 *
 * Body: { "operations": [ { "method": "create"|"update", "id"?, "data": {…} } ] }
 * Max 500 operations per request.
 *
 * SEMANTICS: per-item, NOT all-or-nothing. Each operation is applied
 * independently and reported in `results[]` with its own status code; a
 * failing item never rolls back the others. Callers needing atomicity
 * should submit one operation per request.
 */

const MAX_OPERATIONS = 500;

const operationSchema = z.object({
  method: z.enum(["create", "update"]),
  id: z.string().uuid().optional(),
  data: z.record(z.unknown()),
});

const batchSchema = z.object({
  operations: z.array(operationSchema).min(1).max(MAX_OPERATIONS),
});

interface BatchItemResult {
  index: number;
  method: "create" | "update";
  status: number;
  id?: string;
  employee_no?: string;
  detail?: string;
  errors?: unknown;
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
    const parsed = batchSchema.safeParse(json);
    if (!parsed.success) {
      return validationProblem(parsed.error.flatten());
    }

    const results: BatchItemResult[] = [];

    for (let index = 0; index < parsed.data.operations.length; index += 1) {
      const operation = parsed.data.operations[index]!;
      try {
        if (operation.method === "create") {
          const item = apiEmployeeCreateSchema.safeParse(operation.data);
          if (!item.success) {
            results.push({
              index,
              method: "create",
              status: 422,
              detail: "Validation failed",
              errors: item.error.flatten(),
            });
            continue;
          }
          const created = await createApiEmployee(item.data);
          if (!created.ok) {
            results.push({
              index,
              method: "create",
              status: created.code === "conflict" ? 409 : 422,
              detail: created.message,
            });
            continue;
          }
          results.push({
            index,
            method: "create",
            status: 201,
            id: created.employee.id,
            employee_no: created.employee.employeeNo,
          });
        } else {
          if (!operation.id) {
            results.push({
              index,
              method: "update",
              status: 400,
              detail: "update operations require an `id`",
            });
            continue;
          }
          const item = apiEmployeeUpdateSchema.safeParse(operation.data);
          if (!item.success) {
            results.push({
              index,
              method: "update",
              status: 422,
              detail: "Validation failed",
              errors: item.error.flatten(),
            });
            continue;
          }
          const updated = await updateApiEmployee(operation.id, item.data);
          if (!updated.ok) {
            results.push({
              index,
              method: "update",
              status:
                updated.code === "not_found"
                  ? 404
                  : updated.code === "conflict"
                    ? 409
                    : 422,
              detail: updated.message,
            });
            continue;
          }
          results.push({
            index,
            method: "update",
            status: 200,
            id: updated.employee.id,
            employee_no: updated.employee.employeeNo,
          });
        }
      } catch (error: unknown) {
        results.push({
          index,
          method: operation.method,
          status: 500,
          detail: error instanceof Error ? error.message : "Unexpected error",
        });
      }
    }

    const succeeded = results.filter((r) => r.status < 400).length;
    const summary = {
      total: results.length,
      succeeded,
      failed: results.length - succeeded,
    };

    void logTransaction({
      transactionType: "api.employees.batch",
      status:
        summary.failed === 0
          ? "success"
          : summary.succeeded === 0
            ? "failure"
            : "partial",
      source: "api",
      destination: "employees",
      affectedData: {
        apiClientId: auth.ctx.clientRowId,
        clientId: auth.ctx.clientId,
        ...summary,
      },
    });

    return apiResponse(request, "batch_result", { results, summary });
  } catch (error: unknown) {
    return internalProblem(error);
  }
}
