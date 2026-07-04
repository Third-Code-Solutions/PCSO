/**
 * /portal/shift-change — Employee work-schedule change requests (EPM-007).
 *
 * Server Component: resolves the session, loads the employee's request
 * history plus the selectable schedule options, and delegates all mutations
 * (submit / cancel) to the client component.
 *
 * Workflow: submit → supervisor endorses → HR commits (employeeSchedules).
 */

import { requireAuth } from "@/lib/auth/guards";
import {
  getMyShiftChangeRequests,
  getShiftChangeFormContext,
} from "@/lib/actions/portal/shift-change";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import type { WorkSchedule } from "@/lib/db/schema";
import { ShiftChangeClient, type ShiftChangeRow } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shift Change Requests",
};

export default async function PortalShiftChangePage() {
  const user = await requireAuth();

  if (!user.employeeId) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            No employee record is linked to your account. Contact HR to enable
            self-service shift change requests.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [requestsRes, contextRes] = await Promise.all([
    getMyShiftChangeRequests(),
    getShiftChangeFormContext(),
  ]);

  const requests =
    "data" in requestsRes ? (requestsRes.data as ShiftChangeRow[]) : [];
  const schedules: WorkSchedule[] =
    "data" in contextRes ? contextRes.data.schedules : [];
  const currentSchedule: WorkSchedule | null =
    "data" in contextRes ? contextRes.data.currentSchedule : null;
  const loadError =
    "error" in requestsRes
      ? requestsRes.error
      : "error" in contextRes
        ? contextRes.error
        : null;

  return (
    <ShiftChangeClient
      requests={requests}
      schedules={schedules}
      currentSchedule={currentSchedule}
      loadError={loadError}
    />
  );
}
