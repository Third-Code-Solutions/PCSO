import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees, systemUsers } from "@/lib/db/schema";
import type { CurrentUser } from "@/lib/auth/get-current-user";
import type { Role } from "@/lib/auth/permissions";
import { isLeaveApproverFor, isLeaveHr } from "./workflow";

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

export interface LeaveApproverRecipient {
  id: string;
  email: string;
  name: string | null;
}

const NOTIFIED_APPROVER_ROLES: Role[] = [
  "hr_admin",
  "supervisor",
  "leave_approver",
];

/**
 * N-001 recipients for a new leave application (see isLeaveApproverFor).
 * An approver's office is system_users.office_id, else their employee record.
 * shortcut: an office set only in auth app_metadata is not seen here — that
 * approver still sees the item in their queue; sync office_id to system_users
 * if they must also be notified.
 */
export async function leaveApproverRecipients(applicant: {
  employeeId: string;
  officeId: string | null;
}): Promise<LeaveApproverRecipient[]> {
  const rows = await db
    .select({
      id: systemUsers.id,
      email: systemUsers.email,
      role: systemUsers.role,
      officeId: systemUsers.officeId,
      employeeId: systemUsers.employeeId,
      employeeOfficeId: employees.officeId,
      firstName: employees.firstName,
      lastName: employees.lastName,
    })
    .from(systemUsers)
    .leftJoin(employees, eq(employees.id, systemUsers.employeeId))
    .where(
      and(
        eq(systemUsers.isActive, true),
        inArray(systemUsers.role, NOTIFIED_APPROVER_ROLES),
      ),
    );

  return rows
    .filter((r) =>
      isLeaveApproverFor(
        {
          role: r.role as Role,
          officeId: r.officeId ?? r.employeeOfficeId,
          employeeId: r.employeeId,
        },
        applicant,
      ),
    )
    .map((r) => ({
      id: r.id,
      email: r.email,
      name: r.firstName ? `${r.firstName} ${r.lastName ?? ""}`.trim() : null,
    }));
}
