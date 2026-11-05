/**
 * GET /api/learning/certificates/[id]
 *
 * Authorize-then-sign download for a Certificate of Training PDF (H-19).
 * The "certificates" bucket is private; rows store the object path. The
 * viewer must be in scope for the certificate holder (H-24): HR and read-only
 * oversight see all, supervisors their own office, everyone else own only.
 */

import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import {
  trainingCertificates,
  trainingParticipants,
} from "@/lib/db/schema/learning";
import { employees } from "@/lib/db/schema/employees";
import { learningScopeFor, scopeAllowsEmployee } from "@/lib/actions/ldm/scope";
import { signedObjectUrl } from "@/lib/storage/signed-url";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await requirePermission("learning", "view");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const [row] = await db
    .select({
      pdfUrl: trainingCertificates.pdfUrl,
      employeeId: employees.id,
      officeId: employees.officeId,
    })
    .from(trainingCertificates)
    .innerJoin(
      trainingParticipants,
      eq(trainingParticipants.id, trainingCertificates.participantId),
    )
    .innerJoin(employees, eq(employees.id, trainingParticipants.employeeId))
    .where(eq(trainingCertificates.id, id))
    .limit(1);

  // Same 404 for missing and out-of-scope rows: no existence oracle.
  if (
    !row ||
    !scopeAllowsEmployee(learningScopeFor(user), {
      id: row.employeeId,
      officeId: row.officeId,
    })
  ) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const url = await signedObjectUrl("certificates", row.pdfUrl);
  if (!url) {
    return NextResponse.json(
      { error: "Certificate file is not available yet." },
      { status: 404 },
    );
  }
  return NextResponse.redirect(url, {
    headers: { "Cache-Control": "no-store" },
  });
}
