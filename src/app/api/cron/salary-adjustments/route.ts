import { NextResponse, type NextRequest } from "next/server";
import { withTx } from "@/lib/db/transaction";
import {
  applyDueSalaryAdjustments,
  auditEffectedAdjustments,
} from "@/lib/payroll/salary-adjustment-effect";
import { manilaToday } from "@/lib/utils/payroll/salary-adjustment";
import { checkCronAuth } from "../_lib/auth";
import { recordCronRun } from "../_lib/record-run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * H-17 / PAY-011 — Effect approved salary adjustments on their effectivity
 * date even when no payroll run or approval happens that day.
 *
 * Scheduled via vercel.json: "5 16 * * *" (00:05 Manila).
 */
export async function GET(request: NextRequest) {
  const unauthorized = checkCronAuth(request);
  if (unauthorized) return unauthorized;

  const startedAt = Date.now();
  try {
    const today = manilaToday();
    const effected = await withTx((tx) => applyDueSalaryAdjustments(tx, today));
    auditEffectedAdjustments(effected, null);

    const httpStatus = await recordCronRun({
      job: "salary_adjustments_effect",
      table: "salary_adjustments",
      startedAtMs: startedAt,
      summary: { today, effected: effected.length },
    });
    return NextResponse.json(
      { success: true, today, effected: effected.length },
      { status: httpStatus },
    );
  } catch (error) {
    console.error("[cron/salary-adjustments] Job failed:", error);
    const failStatus = await recordCronRun({
      job: "salary_adjustments_effect",
      table: "salary_adjustments",
      startedAtMs: startedAt,
      error,
    });
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: failStatus },
    );
  }
}
