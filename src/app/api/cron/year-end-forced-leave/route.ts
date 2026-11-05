import { NextResponse, type NextRequest } from "next/server";
import { yearEndForcedLeaveDeduction } from "@/lib/utils/leave/year-end-forced-leave";
import { checkCronAuth } from "../_lib/auth";
import { recordCronRun } from "../_lib/record-run";

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
    const httpStatus = await recordCronRun({
      job: "year_end_forced_leave",
      table: "leave_credits",
      startedAtMs: startedAt.getTime(),
      summary: {
        year: year ?? new Date().getFullYear(),
        processed: result.processed,
        skipped: result.skipped,
      },
      errorCount: result.errors.length,
    });

    return NextResponse.json(
      {
        success: result.errors.length === 0,
        processed: result.processed,
        skipped: result.skipped,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      },
      { status: httpStatus },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/year-end-forced-leave] Job failed:", error);

    const failStatus = await recordCronRun({
      job: "year_end_forced_leave",
      table: "leave_credits",
      startedAtMs: startedAt.getTime(),
      summary: { year: year ?? new Date().getFullYear() },
      error,
    });

    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: failStatus },
    );
  }
}
