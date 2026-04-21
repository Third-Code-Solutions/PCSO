import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { applications, vacancies } from "@/lib/db/schema/recruitment";
import { createApplicationSchema } from "@/lib/validations/recruitment";
import { authenticateApplicantRequest } from "@/lib/utils/rpm/applicant-auth";

// TODO integrator (API-005): rate limit.

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    {
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Missing or invalid applicant token",
    },
    { status: 401 },
  );
}

function problem(status: number, title: string, detail: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail },
    { status },
  );
}

function generateApplicationNumber(): string {
  const year = new Date().getUTCFullYear();
  // 6-digit random component — collisions resolved by the DB UNIQUE index
  // (the client can retry; acceptable given low volumes).
  const suffix = Math.floor(100_000 + Math.random() * 900_000).toString();
  return `APP-${year}-${suffix}`;
}

export async function GET(request: Request) {
  try {
    const token = authenticateApplicantRequest(request);
    if (!token) return unauthorized();

    const rows = await db
      .select({
        id: applications.id,
        vacancyId: applications.vacancyId,
        status: applications.status,
        matchScore: applications.matchScore,
        applicationNumber: applications.applicationNumber,
        submittedAt: applications.submittedAt,
        createdAt: applications.createdAt,
      })
      .from(applications)
      .where(eq(applications.applicantId, token.applicantId))
      .orderBy(desc(applications.createdAt))
      .limit(200);

    return NextResponse.json({ data: rows });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "unknown";
    return problem(500, "Internal Server Error", detail);
  }
}

export async function POST(request: Request) {
  try {
    const token = authenticateApplicantRequest(request);
    if (!token) return unauthorized();

    const json: unknown = await request.json().catch(() => null);
    if (!json) return problem(400, "Bad Request", "Invalid JSON body");

    // createApplicationSchema requires `applicantId`; enforce that it matches
    // the bearer token's applicantId so an authenticated applicant cannot
    // create an application on behalf of someone else.
    const parsed = createApplicationSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Unprocessable Entity",
          status: 422,
          detail: "Validation failed",
          errors: parsed.error.flatten(),
        },
        { status: 422 },
      );
    }
    const input = parsed.data;
    if (input.applicantId !== token.applicantId) {
      return problem(
        403,
        "Forbidden",
        "applicantId does not match authenticated session",
      );
    }

    // Vacancy must be published & still open.
    const vacancyRows = await db
      .select({
        id: vacancies.id,
        status: vacancies.status,
        applicationDeadline: vacancies.applicationDeadline,
      })
      .from(vacancies)
      .where(eq(vacancies.id, input.vacancyId))
      .limit(1);

    const vacancy = vacancyRows[0];
    if (!vacancy || vacancy.status !== "published") {
      return problem(404, "Not Found", "Vacancy not available");
    }
    if (
      vacancy.applicationDeadline &&
      new Date(vacancy.applicationDeadline).getTime() < Date.now()
    ) {
      return problem(410, "Gone", "This vacancy has closed.");
    }

    // Idempotent (vacancyId + applicantId unique): return existing row if any.
    const existingRows = await db
      .select({
        id: applications.id,
        status: applications.status,
        applicationNumber: applications.applicationNumber,
      })
      .from(applications)
      .where(
        and(
          eq(applications.applicantId, token.applicantId),
          eq(applications.vacancyId, input.vacancyId),
        ),
      )
      .limit(1);
    if (existingRows[0]) {
      return NextResponse.json({ data: existingRows[0] }, { status: 200 });
    }

    // Narrow JSONB payloads to the DB's expected shape.
    const toJson = (v: unknown): Record<string, unknown> =>
      v as Record<string, unknown>;

    const insertedRows = await db
      .insert(applications)
      .values({
        vacancyId: input.vacancyId,
        applicantId: token.applicantId,
        applicationNumber: generateApplicationNumber(),
        status: "incomplete",
        personalInfo: toJson(input.personalInfo),
        educationalBackground: input.educationalBackground as unknown as Record<
          string,
          unknown
        >[],
        workExperience: input.workExperience as unknown as Record<
          string,
          unknown
        >[],
        eligibility: input.eligibility as unknown as Record<string, unknown>[],
        trainings: input.trainings as unknown as Record<string, unknown>[],
        referencesJson: input.references as unknown as Record<
          string,
          unknown
        >[],
      })
      .returning({
        id: applications.id,
        status: applications.status,
        applicationNumber: applications.applicationNumber,
      });

    const inserted = insertedRows[0];
    if (!inserted) {
      return problem(
        500,
        "Internal Server Error",
        "Could not create application",
      );
    }
    return NextResponse.json({ data: inserted }, { status: 201 });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "unknown";
    return problem(500, "Internal Server Error", detail);
  }
}

// Silence unused-import lint in edge-runtime builds.
void sql;
