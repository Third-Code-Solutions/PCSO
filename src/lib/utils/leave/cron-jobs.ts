/**
 * Leave module cron job examples - PCSO HRIS
 *
 * This file demonstrates how the LAM gap implementations should be scheduled:
 *
 * LAM-006: Auto-approve sick leave after 5 business days
 *   - Should run daily, ideally in the morning (e.g., 6:00 AM)
 *   - Checks for pending sick leave applications that have exceeded timeout
 *
 * LAM-009: Year-end forced leave auto-deduction
 *   - Should run once per year on December 31 at 23:55
 *   - Deducts unused forced leave from employees' VL balance
 *
 * These functions are designed to be called by:
 * 1. A cron service (like node-cron, or system cron)
 * 2. Vercel Cron Jobs (if deployed to Vercel)
 * 3. Next.js API routes with cron trigger
 * 4. External job scheduler (e.g., GitHub Actions, cloud scheduler)
 *
 * IMPORTANT: These are background jobs and should be protected by authentication
 * to prevent unauthorized execution. Use a secret token or internal service auth.
 */

import { autoApproveSickLeave } from "./auto-approve-sick-leave";
import { yearEndForcedLeaveDeduction } from "./year-end-forced-leave";

/**
 * Daily job: Auto-approve sick leave applications that have exceeded timeout
 *
 * Recommended schedule: Daily at 6:00 AM
 * Cron expression: 0 6 * * *
 *
 * Example usage in a Next.js API route:
 *
 * ```typescript
 * // app/api/cron/auto-approve-sick-leave/route.ts
 * import { NextRequest, NextResponse } from 'next/server';
 * import { runAutoApproveSickLeaveJob } from '@/lib/utils/leave/cron-jobs';
 *
 * export async function GET(request: NextRequest) {
 *   // Verify cron secret to prevent unauthorized access
 *   const authHeader = request.headers.get('authorization');
 *   if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *
 *   const result = await runAutoApproveSickLeaveJob();
 *   return NextResponse.json(result);
 * }
 * ```
 */
export async function runAutoApproveSickLeaveJob() {
  console.log("[cron] Starting auto-approve sick leave job...");

  try {
    const result = await autoApproveSickLeave(5); // 5 business days timeout

    console.log(
      `[cron] Auto-approve sick leave job completed:`,
      `Processed: ${result.processed}, Errors: ${result.errors.length}`,
    );

    if (result.errors.length > 0) {
      console.error(
        "[cron] Auto-approve sick leave job had errors:",
        result.errors,
      );
    }

    return {
      success: true,
      processed: result.processed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[cron] Auto-approve sick leave job failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Annual job: Year-end forced leave deduction
 *
 * Recommended schedule: December 31 at 23:55
 * Cron expression: 55 23 31 12 *
 *
 * Example usage in a Next.js API route:
 *
 * ```typescript
 * // app/api/cron/year-end-forced-leave/route.ts
 * import { NextRequest, NextResponse } from 'next/server';
 * import { runYearEndForcedLeaveJob } from '@/lib/utils/leave/cron-jobs';
 *
 * export async function GET(request: NextRequest) {
 *   // Verify cron secret to prevent unauthorized access
 *   const authHeader = request.headers.get('authorization');
 *   if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
 *     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   }
 *
 *   // Only run in December
 *   const now = new Date();
 *   if (now.getMonth() !== 11 || now.getDate() !== 31) {
 *     return NextResponse.json({
 *       success: false,
 *       error: 'This job should only run on December 31',
 *     }, { status: 400 });
 *   }
 *
 *   const result = await runYearEndForcedLeaveJob();
 *   return NextResponse.json(result);
 * }
 * ```
 */
export async function runYearEndForcedLeaveJob(year?: number) {
  console.log("[cron] Starting year-end forced leave deduction job...");

  try {
    const result = await yearEndForcedLeaveDeduction(year);

    console.log(
      `[cron] Year-end forced leave job completed:`,
      `Processed: ${result.processed}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`,
    );

    if (result.errors.length > 0) {
      console.error(
        "[cron] Year-end forced leave job had errors:",
        result.errors,
      );
    }

    return {
      success: true,
      processed: result.processed,
      skipped: result.skipped,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[cron] Year-end forced leave job failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Test runner for local development
 *
 * Usage:
 * ```bash
 * # In Node.js REPL or a test script
 * import { testAutoApproveSickLeave, testYearEndForcedLeave } from '@/lib/utils/leave/cron-jobs';
 *
 * await testAutoApproveSickLeave();
 * await testYearEndForcedLeave(2024);
 * ```
 */
export async function testAutoApproveSickLeave() {
  console.log("[test] Running auto-approve sick leave (test mode)...");
  return await runAutoApproveSickLeaveJob();
}

export async function testYearEndForcedLeave(year: number) {
  console.log(
    `[test] Running year-end forced leave for ${year} (test mode)...`,
  );
  return await runYearEndForcedLeaveJob(year);
}
