import { beforeEach, describe, expect, it, vi } from "vitest";

const { auditLog, updateUserById, dbState } = vi.hoisted(() => ({
  auditLog: vi.fn(),
  updateUserById: vi.fn(),
  dbState: {
    selectRows: [] as unknown[],
    updateRows: [] as unknown[],
    updated: false,
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ auditLog }));
vi.mock("@/lib/auth/guards", () => ({
  requirePermission: vi.fn(async () => ({ id: "admin-auth-uid" })),
  requireAuth: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: { auth: { admin: { updateUserById } } },
}));
vi.mock("@/lib/db", () => {
  const chain = (rows: () => unknown[]) => {
    const c: Record<string, unknown> = {};
    for (const m of ["from", "where", "set", "values"]) c[m] = () => c;
    c.limit = async () => rows();
    c.returning = async () => {
      dbState.updated = true;
      return rows();
    };
    c.then = (resolve: (v: unknown) => unknown) => resolve(rows());
    return c;
  };
  return {
    db: {
      select: () => chain(() => dbState.selectRows),
      update: () => chain(() => dbState.updateRows),
    },
  };
});

import { updateUserRole } from "./settings";

const USER_ID = "3f0c6a1e-2b4d-4e5f-8a9b-0c1d2e3f4a5b";

beforeEach(() => {
  auditLog.mockReset();
  updateUserById.mockReset();
  updateUserById.mockResolvedValue({ error: null });
  dbState.selectRows = [{ role: "employee_self_service" }];
  dbState.updateRows = [
    { authUid: "target-uid", officeId: null, employeeId: null },
  ];
  dbState.updated = false;
});

describe("updateUserRole (H-34)", () => {
  it("rejects a role outside the system_role enum before touching the DB", async () => {
    await expect(updateUserRole(USER_ID, "god_mode")).rejects.toThrow(
      "Invalid role",
    );
    expect(dbState.updated).toBe(false);
    expect(auditLog).not.toHaveBeenCalled();
  });

  it("rejects a malformed user id", async () => {
    await expect(updateUserRole("not-a-uuid", "hr_admin")).rejects.toThrow(
      "Invalid user id",
    );
  });

  it("audits the change with old and new role", async () => {
    await expect(updateUserRole(USER_ID, "hr_admin")).resolves.toEqual({
      success: true,
    });
    expect(updateUserById).toHaveBeenCalledWith(
      "target-uid",
      expect.objectContaining({
        app_metadata: expect.objectContaining({ role: "hr_admin" }),
      }),
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "admin-auth-uid",
        action: "system_user.role_change",
        recordId: USER_ID,
        oldValues: { role: "employee_self_service" },
        newValues: { role: "hr_admin" },
        outcome: "success",
      }),
    );
  });

  it("audits a failure and throws when the auth claim sync fails", async () => {
    updateUserById.mockResolvedValue({ error: { message: "boom" } });
    await expect(updateUserRole(USER_ID, "hr_admin")).rejects.toThrow(
      /sign-in claim/,
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "failure", severity: "critical" }),
    );
  });
});
