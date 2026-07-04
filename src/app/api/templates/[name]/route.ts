import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/guards";
import { LEAVE_LEDGER_CSV_HEADERS } from "@/lib/utils/leave/bulk-ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * CLI-004 / TOR 3.5.8 — Standardized upload templates.
 *
 * Serves downloadable CSV templates whose header rows exactly match what the
 * corresponding importers parse:
 *
 *  - leave-ledger        → parseLeaveLedgerCsv (src/lib/utils/leave/bulk-ledger.ts),
 *                          consumed by the /leave/bulk-upload flow (LAM-001).
 *  - attendance-import   → importBiometric with its default column config
 *                          (src/app/(dashboard)/attendance/import/actions.ts).
 *
 * Example rows use an obviously-dummy employee number; importers reject
 * unknown employees at validation, so accidentally committing the template
 * as-is cannot write bad data.
 */

interface CsvTemplate {
  filename: string;
  /** Header row + example data rows, in final CSV order. */
  lines: string[];
}

const TEMPLATES: Record<string, CsvTemplate> = {
  // Headers from LEAVE_LEDGER_CSV_HEADERS:
  // employeeNo,leaveTypeCode,year,balance,totalCredits,usedCredits,carryOver
  "leave-ledger": {
    filename: "leave-ledger-template.csv",
    lines: [
      LEAVE_LEDGER_CSV_HEADERS.join(","),
      "PCSO-2024-0001,VL,2026,15.000,15.000,0.000,0.000",
      "PCSO-2024-0001,SL,2026,12.500,15.000,2.500,0.000",
    ],
  },
  // Default column names expected by the biometric importer. Dates are
  // YYYY-MM-DD, times are HH:MM (24-hour); employee_id accepts either the
  // employee number or the internal UUID.
  "attendance-import": {
    filename: "attendance-import-template.csv",
    lines: [
      "employee_id,date,time_in,time_out",
      "PCSO-2024-0001,2026-06-01,08:00,17:00",
      "PCSO-2024-0001,2026-06-02,08:05,17:02",
    ],
  },
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  await requireAuth();

  const { name } = await params;
  const template = TEMPLATES[name];

  if (!template) {
    return NextResponse.json(
      {
        error: `Unknown template "${name}". Available: ${Object.keys(TEMPLATES).join(", ")}`,
      },
      { status: 404 },
    );
  }

  // BOM for Excel UTF-8 compatibility (matches the CSV export convention).
  const body = String.fromCharCode(0xfeff) + template.lines.join("\n") + "\n";

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${template.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
