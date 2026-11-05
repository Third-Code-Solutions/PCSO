import "server-only";

/**
 * Org-wide L&D gate (H-24). Not a "use server" module: helpers here are
 * internal and must not become public endpoints.
 */

import { requirePermission } from "@/lib/auth/guards";
import type { CurrentUser } from "@/lib/auth/get-current-user";

import { learningScopeFor } from "./scope";

/**
 * learning.view AND an organization-wide scope (HR or read-only oversight).
 * ESS, payroll_admin and supervisors hold learning.view but only for their
 * own / unit records, so org-wide spend and compliance rosters are off-limits.
 */
export async function requireLearningOversight(): Promise<CurrentUser> {
  const user = await requirePermission("learning", "view");
  if (learningScopeFor(user).kind !== "all") {
    throw new Error(
      "Forbidden: organization-wide L&D data is limited to HR and oversight roles.",
    );
  }
  return user;
}
