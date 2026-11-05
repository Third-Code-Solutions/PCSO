import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeTx = { pending: string[] };

const { createApiEmployee, updateApiEmployee, committed } = vi.hoisted(() => ({
  createApiEmployee: vi.fn(),
  updateApiEmployee: vi.fn(),
  committed: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/audit", () => ({ logTransaction: vi.fn() }));
vi.mock("@/lib/api/v1/auth", () => ({
  authenticateApiRequest: vi.fn(async () => ({
    ok: true,
    ctx: { clientRowId: "row", clientId: "client" },
  })),
}));
vi.mock("@/lib/api/v1/xml", () => ({
  apiResponse: (_req: Request, _root: string, body: unknown) =>
    Response.json(body, { status: 200 }),
}));
vi.mock("@/lib/api/v1/employees", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/v1/employees")>();
  return { ...actual, createApiEmployee, updateApiEmployee };
});
// Fake transaction: writes are buffered and only committed if fn resolves.
vi.mock("@/lib/db/transaction", () => ({
  withTx: async (fn: (tx: FakeTx) => Promise<unknown>) => {
    const tx: FakeTx = { pending: [] };
    const result = await fn(tx);
    committed.push(...tx.pending);
    return result;
  },
}));

import { POST } from "./route";

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

async function succeed(data: { employee_no: string }, tx: FakeTx) {
  tx.pending.push(data.employee_no);
  return {
    ok: true,
    created: true,
    employee: { id: `id-${data.employee_no}`, employeeNo: data.employee_no },
  };
}

function post(operations: unknown[]) {
  return POST(
    new Request("http://test/api/v1/employees/batch", {
      method: "POST",
      body: JSON.stringify({ operations }),
    }),
  );
}

beforeEach(() => {
  committed.length = 0;
  createApiEmployee.mockReset();
  updateApiEmployee.mockReset();
  createApiEmployee.mockImplementation(succeed);
});

describe("POST /api/v1/employees/batch — all-or-nothing (H-36)", () => {
  it("commits every operation when all succeed", async () => {
    const res = await post([
      { method: "create", data: createData("A-1") },
      { method: "create", data: createData("A-2") },
    ]);
    expect(res.status).toBe(200);
    expect(committed).toEqual(["A-1", "A-2"]);
  });

  it("rejects the whole batch with 422 and writes nothing when any item is invalid", async () => {
    const res = await post([
      { method: "create", data: createData("B-1") },
      { method: "create", data: { employee_no: "B-2" } },
    ]);
    expect(res.status).toBe(422);
    expect(res.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(createApiEmployee).not.toHaveBeenCalled();
    expect(committed).toEqual([]);
  });

  it("rolls back earlier writes when a later operation fails in the DB", async () => {
    createApiEmployee
      .mockImplementationOnce(succeed)
      .mockImplementationOnce(async () => ({
        ok: false,
        code: "conflict",
        message: "An employee with this employee_no already exists.",
      }));

    const res = await post([
      { method: "create", data: createData("C-1") },
      { method: "create", data: createData("C-2") },
    ]);
    const body = (await res.json()) as Record<string, unknown>;

    expect(res.status).toBe(409);
    expect(body.failed_index).toBe(1);
    expect(String(body.detail)).toMatch(/no changes were applied/);
    expect(committed).toEqual([]);
  });
});
