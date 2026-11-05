import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "./get-current-user";
import type { AalStatus } from "./mfa";

const currentUser = vi.fn<() => Promise<CurrentUser | null>>();
const aalStatus = vi.fn<() => Promise<AalStatus>>();

vi.mock("./get-current-user", () => ({ getCurrentUser: () => currentUser() }));
vi.mock("./mfa", () => ({
  getAalStatus: () => aalStatus(),
  isMfaEnforcedRole: (role: string) =>
    role === "super_admin" || role === "hr_admin",
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { requireAuth, requirePermission } from "./guards";

const hrAdmin: CurrentUser = {
  id: "u1",
  email: "hr@pcso.gov.ph",
  role: "hr_admin",
  officeId: null,
  employeeId: null,
};

function aal(
  currentLevel: AalStatus["currentLevel"],
  hasVerifiedTotpFactor: boolean,
): AalStatus {
  return {
    currentLevel,
    nextLevel: hasVerifiedTotpFactor ? "aal2" : "aal1",
    needsMfaVerification: currentLevel === "aal1" && hasVerifiedTotpFactor,
    hasVerifiedTotpFactor,
  };
}

describe("requirePermission MFA enforcement (H-01)", () => {
  beforeEach(() => {
    currentUser.mockReset();
    aalStatus.mockReset();
  });

  it("sends enrolled admins on aal1 to the TOTP challenge", async () => {
    currentUser.mockResolvedValue(hrAdmin);
    aalStatus.mockResolvedValue(aal("aal1", true));
    await expect(requirePermission("employees", "view")).rejects.toThrow(
      "REDIRECT:/login/mfa",
    );
  });

  it("sends un-enrolled admins to enrollment", async () => {
    currentUser.mockResolvedValue(hrAdmin);
    aalStatus.mockResolvedValue(aal("aal1", false));
    await expect(requirePermission("employees", "view")).rejects.toThrow(
      "REDIRECT:/settings/security?mfa=required",
    );
  });

  it("fails closed when the assurance level is unreadable", async () => {
    currentUser.mockResolvedValue({ ...hrAdmin, role: "super_admin" });
    aalStatus.mockResolvedValue(aal(null, false));
    await expect(requirePermission("employees", "view")).rejects.toThrow(
      "REDIRECT:/settings/security?mfa=required",
    );
  });

  it("allows admins with an aal2 session", async () => {
    currentUser.mockResolvedValue(hrAdmin);
    aalStatus.mockResolvedValue(aal("aal2", true));
    await expect(requirePermission("employees", "export")).resolves.toBe(
      hrAdmin,
    );
  });

  it("does not require MFA for non-admin roles", async () => {
    const ess = { ...hrAdmin, role: "employee_self_service" as const };
    currentUser.mockResolvedValue(ess);
    await expect(requirePermission("employees", "view")).resolves.toBe(ess);
    expect(aalStatus).not.toHaveBeenCalled();
  });

  it("still denies non-admin roles the bulk export (C-02)", async () => {
    currentUser.mockResolvedValue({ ...hrAdmin, role: "supervisor" });
    await expect(requirePermission("employees", "export")).rejects.toThrow(
      /REDIRECT:\/login\?unauthorized=1/,
    );
  });
});

describe("requireAuth MFA enforcement (H-01 residual)", () => {
  beforeEach(() => {
    currentUser.mockReset();
    aalStatus.mockReset();
  });

  it("redirects admins on aal1 even on requireAuth-only paths", async () => {
    currentUser.mockResolvedValue(hrAdmin);
    aalStatus.mockResolvedValue(aal("aal1", true));
    await expect(requireAuth()).rejects.toThrow("REDIRECT:/login/mfa");
  });

  it("lets the enrollment page through on aal1 (no redirect loop)", async () => {
    currentUser.mockResolvedValue(hrAdmin);
    aalStatus.mockResolvedValue(aal("aal1", false));
    await expect(requireAuth({ allowAal1: true })).resolves.toBe(hrAdmin);
    expect(aalStatus).not.toHaveBeenCalled();
  });

  it("redirects anonymous visitors to login", async () => {
    currentUser.mockResolvedValue(null);
    await expect(requireAuth({ allowAal1: true })).rejects.toThrow(
      "REDIRECT:/login",
    );
  });
});
