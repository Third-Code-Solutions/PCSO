import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { generateAnnualNoticesCore } from "@/lib/utils/ewbm/annual-notices";
import { checkCronAuth } from "../_lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * EWB-003 / N-031 — Annual retirement notices.
 *
 * Scheduled via vercel.json: "0 1 1 1 *" (January 1, 01:00 UTC = 09:00 PH).
 * Generates retirement_notices rows for employees reaching optional
 * (age 60 + 15 yrs service) or compulsory (age 65) eligibility within the
 * next 12 months, and notifies HRD managers. Idempotent per year via the
 * (for_year, employee_id, retirement_type) unique index.
 *
 * Optional query param for manual/backfill runs: ?year=YYYY (defaults to
 * the current year).
 */
export async function GET(request: NextRequest) {
  const unauthorized = checkCronAuth(request);
  if (unauthorized) return unauthorized;

  let year = new Date().getFullYear();
  const yearParam = request.nextUrl.searchParams.get("year");
  if (yearParam !== null) {
    year = Number(yearParam);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json(
        { error: "Invalid 'year' parameter (expected 2000-2100)." },
        { status: 400 },
      );
    }
  }

  const startedAt = new Date();
  try {
    const { generated } = await generateAnnualNoticesCore(year);

    // Run-level audit entry (system actor).
    await db.insert(auditLogs).values({
      userId: null,
      action: "cron.annual_retirement_notices",
      tableName: "retirement_notices",
      newValues: {
        forYear: year,
        generated,
        durationMs: Date.now() - startedAt.getTime(),
      },
    });

    return NextResponse.json({
      success: true,
      forYear: year,
      generated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/annual-retirement-notices] Job failed:", error);

    await db
      .insert(auditLogs)
      .values({
        userId: null,
        action: "cron.annual_retirement_notices",
        tableName: "retirement_notices",
        newValues: { outcome: "failure", forYear: year, error: message },
      })
      .catch((auditErr) =>
        console.error(
          "[cron/annual-retirement-notices] Audit write failed:",
          auditErr,
        ),
      );

    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
