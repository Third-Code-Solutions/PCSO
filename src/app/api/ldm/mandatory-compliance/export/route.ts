/**
 * GET /api/ldm/mandatory-compliance/export?year=YYYY&officeId=UUID
 *
 * Streams an .xlsx workbook with mandatory-training compliance for the
 * requested calendar year. Requires learning.export permission.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guards";
import { exportComplianceToExcel } from "@/lib/actions/ldm/mandatory-compliance";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Gate with `learning.export` — HR admin + super admin.
  await requirePermission("learning", "export");

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const officeIdParam = searchParams.get("officeId");

  // Server action validates 2000–2100; fall back to the current year for
  // out-of-range or malformed values instead of surfacing a validation error.
  const parsedYear = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : NaN;
  const year =
    parsedYear >= 2000 && parsedYear <= 2100
      ? parsedYear
      : new Date().getFullYear();

  try {
    const result = await exportComplianceToExcel({
      year,
      officeId: officeIdParam ?? undefined,
    });

    return new NextResponse(Buffer.from(result.bytes), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
