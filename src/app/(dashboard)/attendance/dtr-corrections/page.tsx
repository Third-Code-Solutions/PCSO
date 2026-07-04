/**
 * /attendance/dtr-corrections — HR queue for DTR correction requests (EPM-008).
 *
 * Server Component. Gated at attendance.edit (super_admin, hr_admin) because
 * approving a request commits the correction to attendance_logs via
 * processDtrCorrection (which enforces the same permission server-side).
 */

import { requirePermission } from "@/lib/auth/guards";
import { getAllDtrCorrectionsForHR } from "@/lib/actions/portal/dtr-correction";
import { PageHeader } from "@/components/layouts/page-header";
import { RealtimeBoundary } from "@/components/realtime/realtime-boundary";
import {
  DtrCorrectionsQueueClient,
  type DtrCorrectionQueueRow,
} from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DTR Corrections — HR Queue",
};

export default async function DtrCorrectionsQueuePage() {
  await requirePermission("attendance", "edit");

  const result = await getAllDtrCorrectionsForHR();
  const rows = "data" in result ? (result.data as DtrCorrectionQueueRow[]) : [];
  const loadError = "error" in result ? result.error : null;

  const awaitingHr = rows.filter((r) => r.status === "pending_hr").length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <RealtimeBoundary tables={["dtr_correction_requests"]} />
      <PageHeader
        title="DTR Correction Requests"
        description={`${awaitingHr} request${awaitingHr === 1 ? "" : "s"} awaiting HR action. Approving applies the correction to the employee's attendance record.`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Attendance", href: "/attendance" },
          { label: "DTR Corrections" },
        ]}
      />

      <DtrCorrectionsQueueClient rows={rows} loadError={loadError} />
    </main>
  );
}
