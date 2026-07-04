/**
 * /attendance/approvals — Supervisor pending-approvals queue (EPM-007/008).
 *
 * Server Component. Shows DTR correction and shift change requests submitted
 * by the current user's direct reports (rows where supervisor_id = me) that
 * are awaiting endorsement. Endorsing forwards the request to HR; rejecting
 * ends it with a reason.
 *
 * Gated at attendance.approve (super_admin, hr_admin, supervisor) — matches
 * the server-side gate on supervisorReviewDtrCorrection.
 */

import { requirePermission } from "@/lib/auth/guards";
import { getPendingDtrCorrectionsForSupervisor } from "@/lib/actions/portal/dtr-correction";
import { getPendingShiftChangeRequestsForSupervisor } from "@/lib/actions/portal/shift-change";
import { PageHeader } from "@/components/layouts/page-header";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import {
  SupervisorApprovalsClient,
  type SupervisorDtrRow,
  type SupervisorShiftRow,
} from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pending Approvals — Attendance",
};

export default async function AttendanceApprovalsPage() {
  await requirePermission("attendance", "approve");

  const [dtrRes, shiftRes] = await Promise.all([
    getPendingDtrCorrectionsForSupervisor(),
    getPendingShiftChangeRequestsForSupervisor(),
  ]);

  const dtrRows = "data" in dtrRes ? (dtrRes.data as SupervisorDtrRow[]) : [];
  const shiftRows =
    "data" in shiftRes ? (shiftRes.data as SupervisorShiftRow[]) : [];
  const loadError =
    "error" in dtrRes
      ? dtrRes.error
      : "error" in shiftRes
        ? shiftRes.error
        : null;

  const total = dtrRows.length + shiftRows.length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <RealtimeBoundary
        tables={["dtr_correction_requests", "shift_change_requests"]}
      />
      <PageHeader
        title="Pending Approvals"
        description={`${total} request${total === 1 ? "" : "s"} from your team awaiting your endorsement. Endorsed requests proceed to HR for final processing.`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Attendance", href: "/attendance" },
          { label: "Approvals" },
        ]}
      />

      <SupervisorApprovalsClient
        dtrRows={dtrRows}
        shiftRows={shiftRows}
        loadError={loadError}
      />
    </main>
  );
}
