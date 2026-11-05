import { z } from "zod";

import {
  apiEmployeeCreateSchema,
  apiEmployeeUpdateSchema,
  type ApiEmployeeCreateInput,
  type ApiEmployeeUpdateInput,
} from "@/lib/api/v1/employees";

/**
 * Pure pre-flight validation for POST /api/v1/employees/batch (H-36 / SEC-010).
 * Every operation is checked before any write, and ALL problems are reported
 * at once so the caller can fix the whole batch in one round trip.
 */

export const MAX_OPERATIONS = 500;

const operationSchema = z.object({
  method: z.enum(["create", "update"]),
  id: z.string().uuid().optional(),
  data: z.record(z.unknown()),
});

export const batchSchema = z.object({
  operations: z.array(operationSchema).min(1).max(MAX_OPERATIONS),
});

export type BatchOperation = z.infer<typeof operationSchema>;

export type ValidOperation =
  | { index: number; method: "create"; data: ApiEmployeeCreateInput }
  | {
      index: number;
      method: "update";
      id: string;
      data: ApiEmployeeUpdateInput;
    };

export interface OperationError {
  index: number;
  method: "create" | "update";
  detail: string;
  errors?: unknown;
}

export type BatchValidation =
  | { ok: true; operations: ValidOperation[] }
  | { ok: false; errors: OperationError[] };

export function validateBatch(operations: BatchOperation[]): BatchValidation {
  const valid: ValidOperation[] = [];
  const errors: OperationError[] = [];
  const firstIndexByEmployeeNo = new Map<string, number>();

  operations.forEach((op, index) => {
    let employeeNo: string | undefined;

    if (op.method === "create") {
      const item = apiEmployeeCreateSchema.safeParse(op.data);
      if (!item.success) {
        errors.push({
          index,
          method: "create",
          detail: "Validation failed",
          errors: item.error.flatten(),
        });
        return;
      }
      valid.push({ index, method: "create", data: item.data });
      employeeNo = item.data.employee_no;
    } else {
      if (!op.id) {
        errors.push({
          index,
          method: "update",
          detail: "update operations require an `id`",
        });
        return;
      }
      const item = apiEmployeeUpdateSchema.safeParse(op.data);
      if (!item.success) {
        errors.push({
          index,
          method: "update",
          detail: "Validation failed",
          errors: item.error.flatten(),
        });
        return;
      }
      valid.push({ index, method: "update", id: op.id, data: item.data });
      employeeNo = item.data.employee_no;
    }

    // Two operations claiming the same employee_no would always conflict.
    if (employeeNo !== undefined) {
      const first = firstIndexByEmployeeNo.get(employeeNo);
      if (first !== undefined) {
        errors.push({
          index,
          method: op.method,
          detail: `employee_no "${employeeNo}" is also used by operation ${first}`,
        });
      } else {
        firstIndexByEmployeeNo.set(employeeNo, index);
      }
    }
  });

  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, operations: valid };
}
