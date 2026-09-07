import { NextResponse } from "next/server";

import { exportRunToExcelOrCsv } from "@/lib/actions/ewbm/loyalty";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const result = await exportRunToExcelOrCsv({ runId });

  if (!("data" in result)) {
    return NextResponse.json(
      {
        type: "about:blank",
        title: "Export unavailable",
        status: 403,
        detail: "This loyalty run cannot be exported.",
      },
      { status: 403 },
    );
  }

  return new NextResponse(result.data.content, {
    status: 200,
    headers: {
      "Content-Type": result.data.contentType,
      "Content-Disposition":
        'attachment; filename="' + result.data.filename + '"',
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
