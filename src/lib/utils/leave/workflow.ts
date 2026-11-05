/**
 * Leave application workflow rules (PRD §12.1, H-04 / H-12). Pure — the
 * server actions load the row, call these, then write inside one transaction.
 */

import type { Role } from "@/lib/auth/permissions";
import { LEAVE_ATTACHMENTS_PREFIX } from "@/lib/constants/storage";

/** HR (hr_admin / super_admin) acts on every unit's leave. */
export function isLeaveHr(role: Role): boolean {
  return role === "super_admin" || role === "hr_admin";
}

/**
 * Approver unit scope: HR acts on every applicant; any other approver
 * (supervisor / leave_approver) only on applicants in their own office.
 * A missing office on either side fails closed.
 */
export function assertApproverScope(
  actor: { role: Role; officeId: string | null },
  applicantOfficeId: string | null,
): void {
  if (isLeaveHr(actor.role)) return;
  if (actor.officeId !== null && actor.officeId === applicantOfficeId) return;
  throw new Error(
    "Forbidden: you may only act on leave applications from your own office.",
  );
}

/**
 * N-001 audience for a new application: HR, plus the supervisors / leave
 * approvers of the applicant's office — the same people assertApproverScope
 * lets act on it. Applicants are never told about their own application.
 */
export function isLeaveApproverFor(
  approver: { role: Role; officeId: string | null; employeeId: string | null },
  applicant: { employeeId: string; officeId: string | null },
): boolean {
  if (approver.employeeId === applicant.employeeId) return false;
  if (isLeaveHr(approver.role)) return true;
  if (approver.role !== "supervisor" && approver.role !== "leave_approver") {
    return false;
  }
  return approver.officeId !== null && approver.officeId === applicant.officeId;
}

/**
 * Days applyLeave actually charged to `ledgerCode`, read from the
 * application's `create` audit entry. 0 when nothing was charged (no audit
 * entry, e.g. a row inserted outside applyLeave, or a legacy FL row).
 * H-10+ entries carry `ledgerCode`; older VL/SL entries were charged to
 * their own `leaveTypeCode`.
 */
export function chargedDays(createAudit: unknown, ledgerCode: string): number {
  if (!createAudit || typeof createAudit !== "object") return 0;
  const v = createAudit as Record<string, unknown>;
  const charged = "ledgerCode" in v ? v["ledgerCode"] : v["leaveTypeCode"];
  if (charged !== ledgerCode) return 0;
  const days = Number(v["workingDays"]);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

/**
 * True when `path` is an object uploadLeaveAttachments wrote for this
 * employee: `leave-attachments/{employeeId}/{name}`, one plain segment —
 * no URL, no traversal, no other employee's prefix.
 */
export function isOwnLeaveAttachmentPath(
  path: string,
  employeeId: string,
): boolean {
  const prefix = `${LEAVE_ATTACHMENTS_PREFIX}/${employeeId}/`;
  return (
    employeeId.length > 0 &&
    path.startsWith(prefix) &&
    /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/.test(path.slice(prefix.length))
  );
}

export type CancelOutcome =
  /** PENDING withdrawn, or HR cancels: → CANCELLED, credits restored. */
  | { kind: "cancel"; from: string }
  /** Owner asks to cancel APPROVED leave: → CANCELLATION_REQUESTED. */
  | { kind: "request"; from: string }
  /** Already in the target state — idempotent no-op. */
  | { kind: "noop" };

/**
 * Decide what a cancel click does.
 *  - Owner, PENDING → cancelled directly (withdraw before any approver action).
 *  - Owner, APPROVED and not fully in the past → cancellation_requested.
 *  - HR (non-owner) on PENDING / APPROVED / CANCELLATION_REQUESTED → cancelled.
 * Throws with a user-facing message otherwise.
 */
export function resolveCancel(params: {
  status: string;
  isOwner: boolean;
  isHr: boolean;
  /** Last day of leave (YYYY-MM-DD). */
  dateTo: string;
  /** Today (YYYY-MM-DD). */
  today: string;
}): CancelOutcome {
  const { status, isOwner, isHr, dateTo, today } = params;
  if (!isOwner && !isHr) {
    throw new Error(
      "Forbidden: you may only cancel your own leave applications.",
    );
  }
  if (status === "cancelled") return { kind: "noop" };

  if (isOwner) {
    if (status === "pending") return { kind: "cancel", from: status };
    if (status === "cancellation_requested") return { kind: "noop" };
    if (status === "approved") {
      if (dateTo < today) {
        throw new Error(
          "This leave has already been consumed and can no longer be cancelled.",
        );
      }
      return { kind: "request", from: status };
    }
  } else if (
    ["pending", "approved", "cancellation_requested"].includes(status)
  ) {
    return { kind: "cancel", from: status };
  }
  throw new Error(`Cannot cancel an application in '${status}' status.`);
}

/**
 * Approver decision on a cancellation request: confirm → CANCELLED (credits
 * restored), deny → back to APPROVED. Approvers may not decide their own.
 */
export function resolveCancellationDecision(params: {
  status: string;
  decision: "confirm" | "deny";
  isOwner: boolean;
}): "cancelled" | "approved" {
  if (params.isOwner) {
    throw new Error(
      "Forbidden: you cannot decide a cancellation request on your own leave.",
    );
  }
  if (params.status !== "cancellation_requested") {
    throw new Error(
      `No pending cancellation request (status is '${params.status}').`,
    );
  }
  return params.decision === "confirm" ? "cancelled" : "approved";
}

/** Nobody may approve or disapprove their own leave application. */
export function assertNotOwnApplication(
  actorEmployeeId: string | null,
  applicantEmployeeId: string,
): void {
  if (actorEmployeeId !== null && actorEmployeeId === applicantEmployeeId) {
    throw new Error(
      "Forbidden: you cannot approve or disapprove your own leave application.",
    );
  }
}

/** H-12: nobody may adjust their own leave balance. */
export function assertNotOwnBalance(
  actorEmployeeId: string | null,
  targetEmployeeId: string,
): void {
  if (actorEmployeeId !== null && actorEmployeeId === targetEmployeeId) {
    throw new Error("Forbidden: you cannot adjust your own leave balance.");
  }
}
