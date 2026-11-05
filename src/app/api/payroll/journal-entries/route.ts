import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards";
import { auditLog } from "@/lib/audit";
import { logError, describeError } from "@/lib/logging/error-log";
import {
  computeJournalEntriesForPeriod,
  journalEntriesToCsv,
} from "@/lib/api/v1/journal-entries";

export const dynamic = "force-dynamic";

/**
 * GET /api/payroll/journal-entries?periodId={uuid}&format={json|csv}
 *
 * Exports payroll journal entries for PCSO Computerized Accounting System (PAY-015).
 *
 * Shares the balanced entry builder with the v1 API (H-16): see
 * `@/lib/payroll/journal` for the account structure.
 */
export async function GET(request: NextRequest) {
  // Outside the try: requirePermission redirects by throwing NEXT_REDIRECT,
  // which the catch below would otherwise turn into a 500.
  const user = await requirePermission("payroll", "export");
  try {
    const { searchParams } = new URL(request.url);
    const periodId = searchParams.get("periodId");
    const outputFormat = searchParams.get("format") || "json";

    if (
      !periodId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        periodId,
      )
    ) {
      return NextResponse.json(
        { error: "Missing or invalid parameter: periodId" },
        { status: 400 },
      );
    }

    if (!["json", "csv"].includes(outputFormat)) {
      return NextResponse.json(
        { error: "Invalid format. Use json or csv." },
        { status: 400 },
      );
    }

    const result = await computeJournalEntriesForPeriod(periodId);
    if (!result.ok) {
      const status =
        result.code === "not_found" || result.code === "no_records"
          ? 404
          : result.code === "unbalanced"
            ? 409
            : 400;
      return NextResponse.json({ error: result.message }, { status });
    }
    const { journal } = result;

    void auditLog({
      userId: user.id,
      action: "export",
      table: "payroll_periods",
      recordId: periodId,
      newValues: {
        target: "journal_entries",
        format: outputFormat,
        totalDebit: journal.summary.total_debit,
        totalCredit: journal.summary.total_credit,
      },
    });

    if (outputFormat === "csv") {
      return new NextResponse(journalEntriesToCsv([journal]), {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="journal_entries_${journal.period_name.replace(/[^A-Za-z0-9_-]+/g, "_")}.csv"`,
        },
      });
    }

    return NextResponse.json({
      periodId: journal.period_id,
      periodName: journal.period_name,
      payDate: journal.pay_date,
      journalEntries: journal.entries,
      summary: {
        totalDebit: journal.summary.total_debit,
        totalCredit: journal.summary.total_credit,
      },
    });
  } catch (error) {
    console.error("Journal entries export error:", error);

    // TOR 3.4.4 / LOG-002: persist to error_logs (fire-and-forget).
    const described = describeError(error);
    void logError({
      errorCode: "PAYROLL_JOURNAL_EXPORT_FAILED",
      message: described.message,
      stack: described.stack,
      source: "api/payroll/journal-entries",
      affectedResource: "payroll_periods",
    });

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
