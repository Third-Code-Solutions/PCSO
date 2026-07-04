import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { yearEndForcedLeaveDeduction } from "@/lib/utils/leave/year-end-forced-leave";
import { checkCronAuth } from "../_lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * LAM-009 — Year-end forced leave auto-deduction (PRD §10.1.3).
 *
 * Scheduled via vercel.json: "55 15 31 12 *" (December 31, 15:55 UTC =
 * 23:55 PH). Deducts 5 unused forced-leave days from employees whose VL
 * balance is >= 10 as of December 31.
 *
 * Optional query param for manual/backfill runs: ?year=YYYY (defaults to
 * the current year).
 */
export async function GET(request: NextRequest) {
  const unauthorized = checkCronAuth(request);
  if (unauthorized) return unauthorized;

  let year: number | undefined;
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
    const result = await yearEndForcedLeaveDeduction(year);

    // Run-level audit entry (system actor). Per-employee entries are written
    // inside yearEndForcedLeaveDeduction itself.
    await db.insert(auditLogs).values({
      userId: null,
      action: "cron.year_end_forced_leave",
      tableName: "leave_credits",
      newValues: {
        year: year ?? new Date().getFullYear(),
        processed: result.processed,
        skipped: result.skipped,
        errorCount: result.errors.length,
        durationMs: Date.now() - startedAt.getTime(),
      },
    });

    return NextResponse.json({
      success: result.errors.length === 0,
      processed: result.processed,
      skipped: result.skipped,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/year-end-forced-leave] Job failed:", error);

    await db
      .insert(auditLogs)
      .values({
        userId: null,
        action: "cron.year_end_forced_leave",
        tableName: "leave_credits",
        newValues: { outcome: "failure", error: message },
      })
      .catch((auditErr) =>
        console.error(
          "[cron/year-end-forced-leave] Audit write failed:",
          auditErr,
        ),
      );

    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
