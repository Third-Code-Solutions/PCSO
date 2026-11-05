/**
 * GET /api/payroll/salary-adjustments/[id]/nosa
 *
 * Authorize-then-sign download of a Notice of Salary Adjustment (PIM-015,
 * H-19). The "documents" bucket is private; the row stores the object path
 * (legacy rows a public URL — toObjectPath accepts both). Payroll viewers
 * see every NOSA; an employee sees only their own.
 */

import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requirePermission } from "@/lib/auth/guards";
import { hasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { salaryAdjustments } from "@/lib/db/schema";
import { signedObjectUrl } from "@/lib/storage/signed-url";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const user = await requireAuth();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const [row] = await db
    .select({
      employeeId: salaryAdjustments.employeeId,
      nosaDocumentUrl: salaryAdjustments.nosaDocumentUrl,
    })
    .from(salaryAdjustments)
    .where(
      and(eq(salaryAdjustments.id, id), isNull(salaryAdjustments.deletedAt)),
    )
    .limit(1);

  const isOwner =
    !!row && !!user.employeeId && user.employeeId === row.employeeId;
  // Same 404 for missing and out-of-scope rows: no existence oracle.
  if (!row || (!isOwner && !hasPermission(user.role, "payroll", "view"))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  // Non-owner payroll viewers go through the full guard so the aal2 MFA
  // requirement (SEC-003) applies; its NEXT_REDIRECT propagates as a 307.
  if (!isOwner) await requirePermission("payroll", "view");

  const url = await signedObjectUrl("documents", row.nosaDocumentUrl);
  if (!url) {
    return NextResponse.json(
      { error: "NOSA document is not available." },
      { status: 404 },
    );
  }
  return NextResponse.redirect(url, {
    headers: { "Cache-Control": "no-store" },
  });
}
