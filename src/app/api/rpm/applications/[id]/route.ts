import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { applicants, applications, vacancies } from "@/lib/db/schema/recruitment";
import { authenticateApplicantRequest } from "@/lib/utils/rpm/applicant-auth";
import {
  computeMatchScore,
  type ApplicantProfile,
  type VacancyQualificationStandards,
} from "@/lib/utils/rpm/qualification-score";
import { enforceRateLimit } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

// API-005 per-IP limits: reads are generous, submissions are scarce.
const READ_RATE_LIMIT = {
  bucket: "rpm:applications:read",
  limit: 120,
  windowMs: 60_000,
};
const SUBMIT_RATE_LIMIT = {
  bucket: "rpm:applications:submit",
  limit: 20,
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
    const limited = enforceRateLimit(request, READ_RATE_LIMIT);
    if (limited) return limited;

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
    const limited = enforceRateLimit(request, SUBMIT_RATE_LIMIT);
    if (limited) return limited;

    const token = authenticateApplicantRequest(request);
    if (!token) return unauthorized();
    const { id } = await params;

    const rows = await db
      .select({
        id: applications.id,
        applicantId: applications.applicantId,
        vacancyId: applications.vacancyId,
        status: applications.status,
        vacancyStandards: vacancies.qualificationStandards,
        firstName: applicants.firstName,
        lastName: applicants.lastName,
        middleName: applicants.middleName,
        email: applicants.email,
        contactNumber: applicants.contactNumber,
        dateOfBirth: applicants.dateOfBirth,
        gender: applicants.gender,
        currentAddress: applicants.currentAddress,
        profile: applicants.profile,
      })
      .from(applications)
      .innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
      .innerJoin(applicants, eq(applicants.id, applications.applicantId))
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

    // The wizard persists the applicant's history to `applicants.profile`
    // (PATCH /api/rpm/applicants/me). At submit we snapshot that profile onto
    // the application's NOT NULL detail columns and compute the deterministic
    // match score against the vacancy's qualification standards.
    const asArray = (v: unknown): Record<string, unknown>[] =>
      Array.isArray(v) ? (v as Record<string, unknown>[]) : [];
    const profile: Record<string, unknown> =
      row.profile && typeof row.profile === "object"
        ? (row.profile as Record<string, unknown>)
        : {};

    const educationalBackground = asArray(profile.education);
    const workExperience = asArray(profile.workExperience);
    const eligibility = asArray(profile.eligibility);
    const trainings = asArray(profile.trainings);
    const referencesJson = asArray(profile.references);

    const personalInfo: Record<string, unknown> = {
      firstName: row.firstName,
      lastName: row.lastName,
      middleName: row.middleName,
      email: row.email,
      contactNumber: row.contactNumber,
      dateOfBirth: row.dateOfBirth,
      gender: row.gender,
      currentAddress: row.currentAddress,
    };

    // computeMatchScore does its own defensive parsing (inputs are loose JSONB).
    const applicantProfile = {
      educationalBackground,
      workExperience,
      eligibility,
      trainings,
    } as unknown as ApplicantProfile;
    const standards: VacancyQualificationStandards =
      row.vacancyStandards && typeof row.vacancyStandards === "object"
        ? (row.vacancyStandards as VacancyQualificationStandards)
        : {};

    const scored = computeMatchScore(applicantProfile, standards);

    await db
      .update(applications)
      .set({
        status: "submitted",
        submittedAt: new Date(),
        personalInfo,
        educationalBackground,
        workExperience,
        eligibility,
        trainings,
        referencesJson,
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
