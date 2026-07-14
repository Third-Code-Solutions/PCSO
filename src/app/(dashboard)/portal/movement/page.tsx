/**
 * /portal/movement — personnel movement requests (TOR 1.9.9 / EPM-011).
 *
 * Server Component: resolves the session, loads the employee's movement
 * request history and the office lookup, and delegates the submit form +
 * status list to the client.
 *
 * Workflow (PRD §12.5, pragmatic chain): submit → supervisor endorses →
 * HR approves & effects (office reassignment + designation history).
 */

import { requireAuth } from "@/lib/auth/guards";
import {
  getMyMovementRequests,
  getPortalOffices,
} from "@/lib/actions/portal-requests";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { MovementClient, type MovementRow } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Personnel Movement Requests",
};

export default async function PortalMovementPage() {
  const user = await requireAuth();

  if (!user.employeeId) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            No employee record is linked to your account. Contact HR to enable
            personnel movement requests.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [requestsResult, officesResult] = await Promise.all([
    getMyMovementRequests(),
    getPortalOffices(),
  ]);

  const requests =
    "data" in requestsResult ? (requestsResult.data as MovementRow[]) : [];
  const officeOptions = "data" in officesResult ? officesResult.data : [];
  const loadError = "error" in requestsResult ? requestsResult.error : null;

  return (
    <MovementClient
      requests={requests}
      offices={officeOptions}
      loadError={loadError}
    />
  );
}
