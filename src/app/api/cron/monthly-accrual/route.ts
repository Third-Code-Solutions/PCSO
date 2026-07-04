import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { runMonthlyAccrual } from "@/lib/utils/leave/system-accrual";
import { checkCronAuth } from "../_lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * LAM-002 — Monthly leave credit accrual (PRD §10.1.1).
 *
 * Scheduled via vercel.json: "0 1 1 * *" (1st of each month, 01:00 UTC =
 * 09:00 PH). Accrues 1.25 VL + 1.25 SL for every eligible active employee.
 * Idempotent — employees already credited for the month are skipped, so
 * retries and manual re-runs are safe.
 *
 * Optional query params for manual/backfill runs: ?month=1-12&year=YYYY
 */
export async function GET(request: NextRequest) {
  const unauthorized = checkCronAuth(request);
  if (unauthorized) return unauthorized;

  const searchParams = request.nextUrl.searchParams;
  let month: number | undefined;
  let year: number | undefined;

  const monthParam = searchParams.get("month");
  if (monthParam !== null) {
    month = Number(monthParam);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { error: "Invalid 'month' parameter (expected 1-12)." },
        { status: 400 },
      );
    }
  }

  const yearParam = searchParams.get("year");
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
    const summary = await runMonthlyAccrual({ month, year });

    // Run-level audit entry (system actor).
    await db.insert(auditLogs).values({
      userId: null,
      action: "cron.monthly_accrual",
      tableName: "leave_credits",
      newValues: {
        month: summary.month,
        year: summary.year,
        processed: summary.processed,
        skipped: summary.skipped,
        errorCount: summary.errors.length,
        durationMs: Date.now() - startedAt.getTime(),
      },
    });

    return NextResponse.json({
      success: summary.errors.length === 0,
      ...summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cron/monthly-accrual] Job failed:", error);

    await db
      .insert(auditLogs)
      .values({
        userId: null,
        action: "cron.monthly_accrual",
        tableName: "leave_credits",
        newValues: { outcome: "failure", error: message },
      })
      .catch((auditErr) =>
        console.error("[cron/monthly-accrual] Audit write failed:", auditErr),
      );

    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
