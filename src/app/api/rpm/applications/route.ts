import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { applications, vacancies } from "@/lib/db/schema/recruitment";
import { startApplicationSchema } from "@/lib/validations/recruitment";
import { authenticateApplicantRequest } from "@/lib/utils/rpm/applicant-auth";
import { enforceRateLimit } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

// API-005 per-IP limits: reads are generous, creation is scarce.
const LIST_RATE_LIMIT = {
  bucket: "rpm:applications:list",
  limit: 120,
  windowMs: 60_000,
};
const CREATE_RATE_LIMIT = {
  bucket: "rpm:applications:create",
  limit: 10,
  windowMs: 60 * 60_000,
};

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

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

export async function GET(request: Request) {
  try {
    const limited = enforceRateLimit(request, LIST_RATE_LIMIT);
    if (limited) return limited;

    const token = await authenticateApplicantRequest(request);
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
    console.error("[rpm/applications] GET failed", error);
    return problem(500, "Internal Server Error", "Unexpected server error");
  }
}

export async function POST(request: Request) {
  try {
    const limited = enforceRateLimit(request, CREATE_RATE_LIMIT);
    if (limited) return limited;

    const token = await authenticateApplicantRequest(request);
    if (!token) return unauthorized();

    const json: unknown = await request.json().catch(() => null);
    if (!json) return problem(400, "Bad Request", "Invalid JSON body");

    // Stub-create: the apply button only knows the vacancy. The applicant is
    // derived SOLELY from the bearer token so an authenticated applicant can
    // never create an application on behalf of someone else. Detail columns are
    // seeded empty and filled by the wizard at submit time.
    const parsed = startApplicationSchema.safeParse(json);
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
    const { vacancyId } = parsed.data;

    // Vacancy must be published & still open.
    const vacancyRows = await db
      .select({
        id: vacancies.id,
        status: vacancies.status,
        applicationDeadline: vacancies.applicationDeadline,
      })
      .from(vacancies)
      .where(eq(vacancies.id, vacancyId))
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
          eq(applications.vacancyId, vacancyId),
        ),
      )
      .limit(1);
    if (existingRows[0]) {
      return NextResponse.json({ data: existingRows[0] }, { status: 200 });
    }

    let inserted:
      | { id: string; status: string; applicationNumber: string }
      | undefined;
    for (let attempt = 0; attempt < 3 && !inserted; attempt += 1) {
      try {
        const insertedRows = await db
          .insert(applications)
          .values({
            vacancyId,
            applicantId: token.applicantId,
            applicationNumber: generateApplicationNumber(),
            status: "incomplete",
            // Empty-but-valid defaults for the NOT NULL JSONB columns. The wizard
            // fills these at submit (POST /api/rpm/applications/[id]).
            personalInfo: {} as Record<string, unknown>,
            educationalBackground: [] as Record<string, unknown>[],
            workExperience: [] as Record<string, unknown>[],
            eligibility: [] as Record<string, unknown>[],
            trainings: [] as Record<string, unknown>[],
            referencesJson: [] as Record<string, unknown>[],
          })
          .returning({
            id: applications.id,
            status: applications.status,
            applicationNumber: applications.applicationNumber,
          });
        inserted = insertedRows[0];
      } catch (error: unknown) {
        if (!isUniqueViolation(error) || attempt === 2) throw error;
      }
    }

    if (!inserted) {
      return problem(
        500,
        "Internal Server Error",
        "Could not create application",
      );
    }
    return NextResponse.json({ data: inserted }, { status: 201 });
  } catch (error: unknown) {
    console.error("[rpm/applications] POST failed", error);
    return problem(500, "Internal Server Error", "Unexpected server error");
  }
}
