import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import type { CurrentUser } from "@/lib/auth/get-current-user";
import type { Role } from "@/lib/auth/permissions";
import { isLeaveHr } from "./workflow";

/**
 * Approver scope for assertApproverScope / approval queues: the session's
 * office, falling back to the approver's own employee record.
 */
export async function approverScopeOf(
  user: CurrentUser,
): Promise<{ role: Role; officeId: string | null }> {
  if (isLeaveHr(user.role) || user.officeId || !user.employeeId) return user;
  const [row] = await db
    .select({ officeId: employees.officeId })
    .from(employees)
    .where(eq(employees.id, user.employeeId))
    .limit(1);
  return { role: user.role, officeId: row?.officeId ?? null };
}
