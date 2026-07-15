import { NextResponse } from "next/server";
import { z } from "zod";

import { logTransaction } from "@/lib/audit";
import { authenticateApiRequest } from "@/lib/api/v1/auth";
import {
  problem,
  validationProblem,
  internalProblem,
} from "@/lib/api/v1/problem";
import { apiResponse } from "@/lib/api/v1/xml";
import {
  computeJournalEntriesForPeriod,
  journalEntriesToCsv,
} from "@/lib/api/v1/journal-entries";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/v1/payroll/journal-entries?period_id=<uuid>[&format=json|xml|csv]
 *
 * PCSO Computerized Accounting System integration (PAY-015 / API-007 /
 * TOR 3.3.1, 3.3.10). Scope: payroll:read.
 *
 * This is the machine-to-machine twin of the session-authenticated
 * `/api/payroll/journal-entries` route: it authenticates via API key /
 * OAuth 2.0 instead of a Supabase session, and adds XML output for legacy
 * accounting systems. The query logic lives in
 * `src/lib/api/v1/journal-entries.ts` (duplicated from the interactive
 * route — see the note there).
 *
 * `periodId` is accepted as an alias for `period_id` for parity with the
 * legacy route's parameter naming.
 */

const querySchema = z.object({
  period_id: z.string().uuid(),
});

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiRequest(request, ["payroll:read"]);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      period_id:
        url.searchParams.get("period_id") ??
        url.searchParams.get("periodId") ??
        undefined,
    });
    if (!parsed.success) {
      return validationProblem(
        parsed.error.flatten(),
        "period_id (uuid) is required",
      );
    }

    const result = await computeJournalEntriesForPeriod(parsed.data.period_id);
    if (!result.ok) {
      const status =
        result.code === "not_found" || result.code === "no_records" ? 404 : 409;
      return problem({
        status,
        title: status === 404 ? "Not Found" : "Conflict",
        detail: result.message,
        extensions: { code: result.code },
      });
    }

    void logTransaction({
      transactionType: "api.payroll.journal_entries.export",
      status: "success",
      source: "api",
      destination: "accounting_system",
      affectedData: {
        apiClientId: auth.ctx.clientRowId,
        clientId: auth.ctx.clientId,
        periodId: result.journal.period_id,
        totalDebit: result.journal.summary.total_debit,
      },
    });

    // CSV keeps parity with the interactive route; JSON/XML negotiated.
    const formatParam = url.searchParams.get("format")?.toLowerCase();
    if (formatParam === "csv") {
      return new NextResponse(journalEntriesToCsv([result.journal]), {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Cache-Control": "no-store",
          "Content-Disposition": `attachment; filename="journal_entries_${result.journal.period_name.replace(/\s+/g, "_")}.csv"`,
        },
      });
    }

    // apiResponse negotiates ?format=xml|json and the Accept header.
    return apiResponse(request, "journal", { data: result.journal });
  } catch (error: unknown) {
    return internalProblem(error);
  }
}
