import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { vacancies } from "@/lib/db/schema/recruitment";

export const dynamic = "force-dynamic";

// TODO integrator (API-005): add rate limiting to all public RPM endpoints.

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() ?? "";
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const perPage = Math.min(
      100,
      Math.max(1, Number(searchParams.get("perPage") ?? 20)),
    );
    const offset = (page - 1) * perPage;

    const conditions = [eq(vacancies.status, "published")];
    if (search) {
      const term = `%${search}%`;
      conditions.push(
        or(
          ilike(vacancies.itemNumber, term),
          ilike(vacancies.cscForm9Number, term),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const rows = await db
      .select({
        id: vacancies.id,
        itemNumber: vacancies.itemNumber,
        cscForm9Number: vacancies.cscForm9Number,
        officeId: vacancies.officeId,
        positionId: vacancies.positionId,
        qualificationStandards: vacancies.qualificationStandards,
        status: vacancies.status,
        publishedAt: vacancies.publishedAt,
        applicationDeadline: vacancies.applicationDeadline,
      })
      .from(vacancies)
      .where(whereClause)
      .orderBy(desc(vacancies.publishedAt))
      .limit(perPage)
      .offset(offset);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vacancies)
      .where(whereClause);

    return NextResponse.json(
      {
        data: rows,
        meta: { total: countRow?.count ?? 0, page, perPage },
      },
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
