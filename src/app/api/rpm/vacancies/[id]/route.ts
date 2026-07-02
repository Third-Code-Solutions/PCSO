import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { vacancies } from "@/lib/db/schema/recruitment";
import { enforceRateLimit } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

// API-005: public read endpoint — generous per-IP limit.
const RATE_LIMIT = { bucket: "rpm:vacancies:read", limit: 120, windowMs: 60_000 };

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const limited = enforceRateLimit(request, RATE_LIMIT);
    if (limited) return limited;

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Bad Request",
          status: 400,
          detail: "Missing vacancy id",
        },
        { status: 400 },
      );
    }

    const [row] = await db
      .select()
      .from(vacancies)
      .where(eq(vacancies.id, id))
      .limit(1);

    if (!row || row.status !== "published") {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Not Found",
          status: 404,
          detail: "Vacancy not available",
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { data: row },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "unknown";
    return NextResponse.json(
      {
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        detail,
      },
      { status: 500 },
    );
  }
}
