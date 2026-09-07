import { NextResponse } from "next/server";
import { and, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { applicants } from "@/lib/db/schema/recruitment";
import { applicantProfileUpdateSchema } from "@/lib/validations/recruitment";
import { authenticateApplicantRequest } from "@/lib/utils/rpm/applicant-auth";
import { enforceRateLimit } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

// API-005 per-IP limits.
const READ_RATE_LIMIT = {
  bucket: "rpm:applicants:me:read",
  limit: 120,
  windowMs: 60_000,
};
const UPDATE_RATE_LIMIT = {
  bucket: "rpm:applicants:me:update",
  limit: 30,
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

const PROFILE_COLUMNS = {
  id: applicants.id,
  email: applicants.email,
  firstName: applicants.firstName,
  lastName: applicants.lastName,
  middleName: applicants.middleName,
  contactNumber: applicants.contactNumber,
  dateOfBirth: applicants.dateOfBirth,
  gender: applicants.gender,
  currentAddress: applicants.currentAddress,
  profile: applicants.profile,
  status: applicants.status,
} as const;

export async function GET(request: Request) {
  try {
    const limited = enforceRateLimit(request, READ_RATE_LIMIT);
    if (limited) return limited;

    const token = await authenticateApplicantRequest(request);
    if (!token) return unauthorized();

    const rows = await db
      .select(PROFILE_COLUMNS)
      .from(applicants)
      .where(
        and(
          eq(applicants.id, token.applicantId),
          ne(applicants.status, "inactive"),
          isNull(applicants.deletedAt),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return problem(404, "Not Found", "Applicant not found");
    return NextResponse.json({ data: row });
  } catch (error: unknown) {
    console.error("[rpm/applicants/me] GET failed", error);
    return problem(500, "Internal Server Error", "Unexpected server error");
  }
}

/**
 * PATCH /api/rpm/applicants/me — applicant updates their own profile
 * (RPM-010). Scalar name/contact fields update the applicant columns;
 * `profile` replaces the wizard-collected history JSONB wholesale (the
 * wizard always sends the full set it holds).
 */
export async function PATCH(request: Request) {
  try {
    const limited = enforceRateLimit(request, UPDATE_RATE_LIMIT);
    if (limited) return limited;

    const token = await authenticateApplicantRequest(request);
    if (!token) return unauthorized();

    const json: unknown = await request.json().catch(() => null);
    if (!json) return problem(400, "Bad Request", "Invalid JSON body");

    const parsed = applicantProfileUpdateSchema.safeParse(json);
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

    const updates: Partial<typeof applicants.$inferInsert> = {};
    if (input.firstName !== undefined) updates.firstName = input.firstName;
    if (input.lastName !== undefined) updates.lastName = input.lastName;
    if (input.middleName !== undefined) updates.middleName = input.middleName;
    if (input.contactNumber !== undefined) {
      updates.contactNumber = input.contactNumber;
    }
    if (input.currentAddress !== undefined) {
      updates.currentAddress = input.currentAddress;
    }
    if (input.profile !== undefined) {
      updates.profile = input.profile as Record<string, unknown>;
    }

    const updatedRows = await db
      .update(applicants)
      .set(updates)
      .where(
        and(
          eq(applicants.id, token.applicantId),
          ne(applicants.status, "inactive"),
          isNull(applicants.deletedAt),
        ),
      )
      .returning(PROFILE_COLUMNS);

    const updated = updatedRows[0];
    if (!updated) return problem(404, "Not Found", "Applicant not found");
    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    console.error("[rpm/applicants/me] PATCH failed", error);
    return problem(500, "Internal Server Error", "Unexpected server error");
  }
}
