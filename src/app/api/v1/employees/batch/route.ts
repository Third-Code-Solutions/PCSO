import { logTransaction } from "@/lib/audit";
import { authenticateApiRequest } from "@/lib/api/v1/auth";
import {
  problem,
  validationProblem,
  internalProblem,
} from "@/lib/api/v1/problem";
import { apiResponse } from "@/lib/api/v1/xml";
import {
  createApiEmployee,
  updateApiEmployee,
  type EmployeeMutationResult,
} from "@/lib/api/v1/employees";
import { withTx } from "@/lib/db/transaction";
import { batchSchema, validateBatch } from "./validate";

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
 * SEMANTICS: ALL-OR-NOTHING (SEC-010). Every operation is validated first;
 * any invalid item returns 422 listing every failing index and nothing is
 * written. Valid batches run in one database transaction; the first DB-level
 * failure (conflict, missing record, bad reference) rolls the whole batch
 * back and returns an RFC 7807 problem naming `failed_index`.
 */

interface BatchItemResult {
  index: number;
  method: "create" | "update";
  status: number;
  id: string;
  employee_no: string;
}

type FailedMutation = Extract<EmployeeMutationResult, { ok: false }>;

/** Thrown inside the transaction to force a rollback. */
class BatchAbort extends Error {
  constructor(
    readonly index: number,
    readonly method: "create" | "update",
    readonly failure: FailedMutation,
  ) {
    super(failure.message);
  }
}

const FAILURE_STATUS: Record<FailedMutation["code"], number> = {
  not_found: 404,
  conflict: 409,
  invalid_reference: 422,
};

const FAILURE_TITLE: Record<FailedMutation["code"], string> = {
  not_found: "Not Found",
  conflict: "Conflict",
  invalid_reference: "Unprocessable Entity",
};

export async function POST(request: Request) {
  const startedAtMs = Date.now();
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

    const validation = validateBatch(parsed.data.operations);
    if (!validation.ok) {
      return validationProblem(
        validation.errors,
        `${validation.errors.length} operation(s) are invalid. No changes were applied.`,
      );
    }

    const logRun = (
      status: "success" | "failure",
      extra: Record<string, unknown>,
      errorInfo?: string,
    ) =>
      logTransaction({
        transactionType: "api.employees.batch",
        status,
        source: "api",
        destination: "employees",
        affectedData: {
          apiClientId: auth.ctx.clientRowId,
          clientId: auth.ctx.clientId,
          total: validation.operations.length,
          ...extra,
        },
        errorInfo,
        durationMs: Date.now() - startedAtMs,
      });

    try {
      const results = await withTx(async (tx) => {
        const applied: BatchItemResult[] = [];
        for (const op of validation.operations) {
          const outcome =
            op.method === "create"
              ? await createApiEmployee(op.data, tx)
              : await updateApiEmployee(op.id, op.data, tx);
          if (!outcome.ok) throw new BatchAbort(op.index, op.method, outcome);
          applied.push({
            index: op.index,
            method: op.method,
            status: op.method === "create" ? 201 : 200,
            id: outcome.employee.id,
            employee_no: outcome.employee.employeeNo,
          });
        }
        return applied;
      });

      await logRun("success", { succeeded: results.length });
      return apiResponse(request, "batch_result", {
        results,
        summary: {
          total: results.length,
          succeeded: results.length,
          failed: 0,
        },
      });
    } catch (error: unknown) {
      if (!(error instanceof BatchAbort)) {
        await logRun(
          "failure",
          { succeeded: 0 },
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }
      await logRun(
        "failure",
        { succeeded: 0, failedIndex: error.index },
        error.failure.message,
      );
      return problem({
        status: FAILURE_STATUS[error.failure.code],
        title: FAILURE_TITLE[error.failure.code],
        detail: `Operation ${error.index} (${error.method}) failed: ${error.failure.message} The batch was rolled back; no changes were applied.`,
        extensions: {
          failed_index: error.index,
          method: error.method,
          code: error.failure.code,
        },
      });
    }
  } catch (error: unknown) {
    return internalProblem(error);
  }
}
