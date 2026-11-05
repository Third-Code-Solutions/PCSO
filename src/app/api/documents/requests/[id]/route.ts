/**
 * /api/documents/requests/[id] — download a generated document-request PDF
 * (COE, COE w/ Remunerations, Service Record, PDS, ad hoc certificate).
 *
 * The `documents` bucket is private (H-19): document_requests stores the
 * object path, and this route authorizes the viewer against the owning request
 * before redirecting to a short-lived signed URL. Legacy rows that stored a
 * dead public URL are normalised by `signedObjectUrl`.
 *
 * Access (PRD §11 Document Generation): the requesting employee, HR, read-all
 * oversight roles, or a supervisor of the employee's office — see
 * canViewEmployeeRecord. Non-own access is also MFA-gated via requirePermission.
 */

import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { documentRequests, employees } from "@/lib/db/schema";
import { requireAuth, requirePermission } from "@/lib/auth/guards";
import { canViewEmployeeRecord } from "@/lib/auth/employee-record-access";
import { auditLog } from "@/lib/audit";
import { signedObjectUrl } from "@/lib/storage/signed-url";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await requireAuth();

  const [request] = await db
    .select({
      employeeId: documentRequests.employeeId,
      status: documentRequests.status,
      serialNumber: documentRequests.serialNumber,
      stored: documentRequests.generatedDocumentUrl,
      officeId: employees.officeId,
    })
    .from(documentRequests)
    .leftJoin(employees, eq(employees.id, documentRequests.employeeId))
    .where(eq(documentRequests.id, id))
    .limit(1);
  if (!request) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isOwn =
    user.employeeId != null && request.employeeId === user.employeeId;
  if (!isOwn) {
    if (
      !canViewEmployeeRecord(user, {
        id: request.employeeId,
        officeId: request.officeId,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await requirePermission("employees", "view");
  }

  if (!request.stored || !["ready", "released"].includes(request.status)) {
    return NextResponse.json(
      { error: "No generated document is available for this request" },
      { status: 404 },
    );
  }

  const url = await signedObjectUrl("documents", request.stored);
  if (!url) {
    return NextResponse.json(
      { error: "Could not generate a download link" },
      { status: 502 },
    );
  }

  await auditLog({
    userId: user.id,
    action: "document_request.download",
    table: "document_requests",
    recordId: id,
    module: "PIMM",
    subModule: "document_request",
    newValues: { serialNumber: request.serialNumber, ownRequest: isOwn },
  });

  return NextResponse.redirect(url, { status: 302 });
}
