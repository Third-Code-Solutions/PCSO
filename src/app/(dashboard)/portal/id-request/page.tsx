/**
 * /portal/id-request — ID replacement / issuance requests (TOR 1.9.12 /
 * EPM-013).
 *
 * Server Component: loads the employee's own requests + the FM size lookup.
 * For HR users (employees.process) it additionally loads the processing
 * queue, rendered as an HR section on the same page.
 */

import { requireAuth } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import {
  getIdRequestsForHR,
  getMyIdRequests,
  getPortalIdSizes,
} from "@/lib/actions/portal-requests";
import { IdRequestClient, type IdRequestRow } from "./_client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ID Requests",
};

export default async function PortalIdRequestPage() {
  const user = await requireAuth();
  const canProcess = hasPermission(user.role, "employees", "process");

  const [myResult, sizesResult, hrResult] = await Promise.all([
    user.employeeId
      ? getMyIdRequests()
      : Promise.resolve({ data: [] as IdRequestRow[] }),
    getPortalIdSizes(),
    canProcess
      ? getIdRequestsForHR()
      : Promise.resolve({ data: [] as IdRequestRow[] }),
  ]);

  const myRequests =
    "data" in myResult ? (myResult.data as IdRequestRow[]) : [];
  const sizes = "data" in sizesResult ? sizesResult.data : [];
  const hrRequests =
    "data" in hrResult ? (hrResult.data as IdRequestRow[]) : [];
  const loadError =
    "error" in myResult
      ? myResult.error
      : "error" in hrResult
        ? hrResult.error
        : null;

  return (
    <IdRequestClient
      myRequests={myRequests}
      hrRequests={hrRequests}
      sizes={sizes}
      canProcess={canProcess}
      hasEmployee={user.employeeId !== null}
      loadError={loadError}
    />
  );
}
