import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const sysUserRows = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => ({ auth: { getUser } }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => sysUserRows() }) }),
    }),
  },
}));

import { getCurrentUser } from "./get-current-user";

function authUser(appMetadata: Record<string, unknown>) {
  return {
    data: {
      user: { id: "auth-1", email: "x@pcso.gov.ph", app_metadata: appMetadata },
    },
    error: null,
  };
}

describe("getCurrentUser", () => {
  beforeEach(() => {
    getUser.mockReset();
    sysUserRows.mockReset();
  });

  it("returns null without a session", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getCurrentUser()).toBeNull();
  });

  it("reads role and linkage from app_metadata", async () => {
    getUser.mockResolvedValue(
      authUser({ role: "hr_admin", employee_id: "emp-1", office_id: "off-1" }),
    );
    const user = await getCurrentUser();
    expect(user).toMatchObject({
      role: "hr_admin",
      employeeId: "emp-1",
      officeId: "off-1",
    });
    expect(sysUserRows).not.toHaveBeenCalled();
  });

  it("never takes the role from system_users (C-01)", async () => {
    getUser.mockResolvedValue(authUser({}));
    sysUserRows.mockResolvedValue([
      { role: "super_admin", officeId: "off-9", employeeId: "emp-9" },
    ]);
    const user = await getCurrentUser();
    expect(user?.role).toBe("employee_self_service");
    expect(user?.employeeId).toBe("emp-9");
    expect(user?.officeId).toBe("off-9");
  });

  it("keeps the app_metadata role when filling missing linkage", async () => {
    getUser.mockResolvedValue(authUser({ role: "supervisor" }));
    sysUserRows.mockResolvedValue([
      { role: "super_admin", officeId: null, employeeId: "emp-2" },
    ]);
    const user = await getCurrentUser();
    expect(user?.role).toBe("supervisor");
    expect(user?.employeeId).toBe("emp-2");
  });
});
