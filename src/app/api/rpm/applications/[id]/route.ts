import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  applicants,
  applications,
  interviewSchedules,
  vacancies,
} from "@/lib/db/schema/recruitment";
import { authenticateApplicantRequest } from "@/lib/utils/rpm/applicant-auth";
import {
  computeMatchScore,
  type ApplicantProfile,
  type VacancyQualificationStandards,
} from "@/lib/utils/rpm/qualification-score";
import { enforceRateLimit } from "@/lib/utils/rate-limit";
import { createApplicationSchema } from "@/lib/validations/recruitment";

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

    const token = await authenticateApplicantRequest(request);
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
        disqualificationReason: applications.disqualificationReason,
        interviewScheduledAt: interviewSchedules.scheduledAt,
        interviewVenue: interviewSchedules.venue,
        interviewMode: interviewSchedules.mode,
        interviewNotes: interviewSchedules.notes,
      })
      .from(applications)
      .leftJoin(
        interviewSchedules,
        and(
          eq(applications.interviewScheduleId, interviewSchedules.id),
          isNull(interviewSchedules.deletedAt),
        ),
      )
      .where(
        and(
          eq(applications.id, id),
          eq(applications.applicantId, token.applicantId),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return notFound();

    const {
      interviewScheduledAt,
      interviewVenue,
      interviewMode,
      interviewNotes,
      ...application
    } = row;

    return NextResponse.json({
      data: {
        ...application,
        // TOR 1.2.20 — surface the assigned interview batch to the applicant.
        interview: interviewScheduledAt
          ? {
              scheduledAt: interviewScheduledAt,
              venue: interviewVenue,
              mode: interviewMode,
              notes: interviewNotes,
            }
          : null,
      },
    });
  } catch (error: unknown) {
    console.error("[rpm/application] GET failed", error);
    return NextResponse.json(
      {
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        detail: "Unexpected server error",
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

    const token = await authenticateApplicantRequest(request);
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

    const completeApplication = createApplicationSchema.safeParse({
      vacancyId: row.vacancyId,
      applicantId: token.applicantId,
      personalInfo,
      educationalBackground,
      workExperience,
      eligibility,
      trainings,
      references: referencesJson,
    });
    if (!completeApplication.success) {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Unprocessable Entity",
          status: 422,
          detail: "Complete the required application fields before submitting.",
          errors: completeApplication.error.flatten(),
        },
        { status: 422 },
      );
    }

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

    const updatedRows = await db
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
      .where(
        and(
          eq(applications.id, id),
          eq(applications.applicantId, token.applicantId),
          eq(applications.status, "incomplete"),
        ),
      )
      .returning({ id: applications.id });
    if (!updatedRows[0]) {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Conflict",
          status: 409,
          detail:
            "Application was already submitted or is no longer available.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      data: {
        id,
        status: "submitted",
        matchScore: scored.total,
        breakdown: scored.breakdown,
      },
    });
  } catch (error: unknown) {
    console.error("[rpm/application] POST failed", error);
    return NextResponse.json(
      {
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        detail: "Unexpected server error",
      },
      { status: 500 },
    );
  }
}
