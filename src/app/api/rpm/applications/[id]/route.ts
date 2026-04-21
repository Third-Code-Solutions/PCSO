import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { applications, vacancies } from "@/lib/db/schema/recruitment";
import { authenticateApplicantRequest } from "@/lib/utils/rpm/applicant-auth";
import {
  computeMatchScore,
  type ApplicantProfile,
  type VacancyQualificationStandards,
} from "@/lib/utils/rpm/qualification-score";

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

function notFound() {
  return NextResponse.json(
    {
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: "Application not found",
    },
    { status: 404 },
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = authenticateApplicantRequest(request);
    if (!token) return unauthorized();
    const { id } = await params;

    const rows = await db
      .select({
        id: applications.id,
        applicantId: applications.applicantId,
        vacancyId: applications.vacancyId,
        status: applications.status,
        matchScore: applications.matchScore,
        matchBreakdown: applications.matchBreakdown,
        applicationNumber: applications.applicationNumber,
        submittedAt: applications.submittedAt,
        createdAt: applications.createdAt,
      })
      .from(applications)
      .where(
        and(
          eq(applications.id, id),
          eq(applications.applicantId, token.applicantId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return notFound();
    return NextResponse.json({ data: row });
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = authenticateApplicantRequest(request);
    if (!token) return unauthorized();
    const { id } = await params;

    const rows = await db
      .select({
        id: applications.id,
        applicantId: applications.applicantId,
        vacancyId: applications.vacancyId,
        status: applications.status,
        educationalBackground: applications.educationalBackground,
        workExperience: applications.workExperience,
        eligibility: applications.eligibility,
        trainings: applications.trainings,
        vacancyStandards: vacancies.qualificationStandards,
      })
      .from(applications)
      .innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
      .where(
        and(
          eq(applications.id, id),
          eq(applications.applicantId, token.applicantId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return notFound();
    if (row.status !== "incomplete") {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Conflict",
          status: 409,
          detail: `Application cannot be submitted from status "${row.status}".`,
        },
        { status: 409 },
      );
    }

    const asArray = <T>(v: unknown): readonly T[] =>
      Array.isArray(v) ? (v as T[]) : [];
    const profile: ApplicantProfile = {
      educationalBackground: asArray(row.educationalBackground),
      workExperience: asArray(row.workExperience),
      eligibility: asArray(row.eligibility),
      trainings: asArray(row.trainings),
    };
    const standards: VacancyQualificationStandards =
      row.vacancyStandards && typeof row.vacancyStandards === "object"
        ? (row.vacancyStandards as VacancyQualificationStandards)
        : {};

    const scored = computeMatchScore(profile, standards);

    await db
      .update(applications)
      .set({
        status: "submitted",
        submittedAt: new Date(),
        matchScore: scored.total.toFixed(2),
        matchBreakdown: scored.breakdown as unknown as Record<string, unknown>,
      })
      .where(eq(applications.id, id));

    return NextResponse.json({
      data: {
        id,
        status: "submitted",
        matchScore: scored.total,
        breakdown: scored.breakdown,
      },
    });
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
