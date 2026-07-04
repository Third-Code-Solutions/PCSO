/**
 * /attendance/shift-changes — HR queue for shift change requests (EPM-007).
 *
 * Server Component. Gated at employees.edit (super_admin, hr_admin) because
 * approving a request commits a new employee schedule assignment via
 * processShiftChange (which enforces the same permission server-side).
 */

import { requirePermission } from "@/lib/auth/guards";
import { getAllShiftChangeRequestsForHR } from "@/lib/actions/portal/shift-change";
import { PageHeader } from "@/components/layouts/page-header";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import { ShiftChangesQueueClient, type ShiftChangeQueueRow } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shift Changes — HR Queue",
};

export default async function ShiftChangesQueuePage() {
  await requirePermission("employees", "edit");

  const result = await getAllShiftChangeRequestsForHR();
  const rows = "data" in result ? (result.data as ShiftChangeQueueRow[]) : [];
  const loadError = "error" in result ? result.error : null;

  const awaitingHr = rows.filter((r) => r.status === "pending_hr").length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <RealtimeBoundary tables={["shift_change_requests"]} />
      <PageHeader
        title="Shift Change Requests"
        description={`${awaitingHr} request${awaitingHr === 1 ? "" : "s"} awaiting HR action. Approving commits the new schedule assignment from the effective date.`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Attendance", href: "/attendance" },
          { label: "Shift Changes" },
        ]}
      />

      <ShiftChangesQueueClient rows={rows} loadError={loadError} />
    </main>
  );
}
