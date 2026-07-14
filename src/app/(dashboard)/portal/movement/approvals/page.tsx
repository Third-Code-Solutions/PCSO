/**
 * /portal/movement/approvals — approver queue for personnel movement
 * requests (TOR 1.9.9 / EPM-011).
 *
 * Server Component. Two role-scoped sections:
 *   - Endorsements: supervisors (leave.approve) see submitted requests from
 *     their unit; endorsing forwards the request to HR.
 *   - HR decisions: employees.process (hr_admin, super_admin) approve &
 *     effect or reject endorsed requests.
 *
 * Server actions re-enforce both gates; this page only decides what to load.
 */

import { requireAuth } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getMovementRequestsForHR,
  getMovementRequestsForSupervisor,
} from "@/lib/actions/portal-requests";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { MovementApprovalsClient, type MovementQueueRow } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Movement Approvals",
};

export default async function MovementApprovalsPage() {
  const user = await requireAuth();

  const canEndorse = hasPermission(user.role, "leave", "approve");
  const canDecide = hasPermission(user.role, "employees", "process");

  if (!canEndorse && !canDecide) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            This queue is for supervisors and HR administrators. Your own
            movement requests are under Portal → Movement Requests.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [supervisorResult, hrResult] = await Promise.all([
    canEndorse
      ? getMovementRequestsForSupervisor()
      : Promise.resolve({ data: [] as MovementQueueRow[] }),
    canDecide
      ? getMovementRequestsForHR()
      : Promise.resolve({ data: [] as MovementQueueRow[] }),
  ]);

  const endorsementQueue =
    "data" in supervisorResult
      ? (supervisorResult.data as MovementQueueRow[])
      : [];
  const hrRows =
    "data" in hrResult ? (hrResult.data as MovementQueueRow[]) : [];
  const loadError =
    "error" in supervisorResult
      ? supervisorResult.error
      : "error" in hrResult
        ? hrResult.error
        : null;

  return (
    <MovementApprovalsClient
      endorsementQueue={endorsementQueue}
      hrRows={hrRows}
      canEndorse={canEndorse}
      canDecide={canDecide}
      loadError={loadError}
    />
  );
}
