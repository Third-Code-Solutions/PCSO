/**
 * /portal/dtr-correction — Employee DTR correction requests (EPM-008).
 *
 * Server Component: resolves the session, loads the employee's correction
 * request history, and delegates the submit form + list to the client.
 *
 * Workflow: submit → supervisor endorses → HR applies to attendance_logs.
 */

import { requireAuth } from "@/lib/auth/guards";
import { getMyDtrCorrectionRequests } from "@/lib/actions/portal/dtr-correction";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { DtrCorrectionClient, type DtrCorrectionRow } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DTR Correction Requests",
};

export default async function PortalDtrCorrectionPage() {
  const user = await requireAuth();

  if (!user.employeeId) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardContent className="flex items-center gap-3 py-10 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            No employee record is linked to your account. Contact HR to enable
            self-service DTR correction requests.
          </CardContent>
        </Card>
      </div>
    );
  }

  const result = await getMyDtrCorrectionRequests();
  const requests = "data" in result ? (result.data as DtrCorrectionRow[]) : [];
  const loadError = "error" in result ? result.error : null;

  return <DtrCorrectionClient requests={requests} loadError={loadError} />;
}
