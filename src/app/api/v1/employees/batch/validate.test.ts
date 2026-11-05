import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { validateBatch, type BatchOperation } from "./validate";

const createData = (employeeNo: string) => ({
  employee_no: employeeNo,
  first_name: "Ana",
  last_name: "Reyes",
  birth_date: "1990-01-15",
  gender: "female",
  civil_status: "single",
  appointment_type: "permanent",
  position_title: "Administrative Officer II",
  salary_grade: 15,
  step: 1,
  date_hired: "2020-03-01",
});

const ID = "9c7d4b6e-1f2a-4c3b-8d9e-0a1b2c3d4e5f";

describe("validateBatch (H-36)", () => {
  it("accepts a fully valid batch", () => {
    const ops: BatchOperation[] = [
      { method: "create", data: createData("PCSO-2026-0001") },
      { method: "update", id: ID, data: { status: "on_leave" } },
    ];
    const result = validateBatch(ops);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.operations.map((o) => o.index)).toEqual([0, 1]);
    }
  });

  it("reports every invalid operation, not just the first", () => {
    const ops: BatchOperation[] = [
      { method: "create", data: { employee_no: "X" } },
      { method: "create", data: createData("PCSO-2026-0002") },
      { method: "update", data: { status: "active" } },
      { method: "update", id: ID, data: {} },
    ];
    const result = validateBatch(ops);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.map((e) => e.index)).toEqual([0, 2, 3]);
      expect(result.errors[1]?.detail).toMatch(/require an/);
    }
  });

  it("rejects two operations claiming the same employee_no", () => {
    const ops: BatchOperation[] = [
      { method: "create", data: createData("PCSO-2026-0003") },
      { method: "update", id: ID, data: { employee_no: "PCSO-2026-0003" } },
    ];
    const result = validateBatch(ops);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({ index: 1, method: "update" });
    }
  });
});
