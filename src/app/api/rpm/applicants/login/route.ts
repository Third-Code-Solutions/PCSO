import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { applicants } from "@/lib/db/schema/recruitment";
import { applicantLoginSchema } from "@/lib/validations/recruitment";
import {
  signApplicantToken,
  verifyPassword,
} from "@/lib/utils/rpm/applicant-auth";
import { enforceRateLimit } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

// API-005 brute-force protection: counts every attempt (success or failure)
// so a credential-stuffing loop is throttled regardless of outcome.
const RATE_LIMIT = { bucket: "rpm:login", limit: 10, windowMs: 10 * 60_000 };

export async function POST(request: Request) {
  try {
    const limited = enforceRateLimit(request, RATE_LIMIT);
    if (limited) return limited;

    const json: unknown = await request.json().catch(() => null);
    const parsed = applicantLoginSchema.safeParse(json);
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

    const email = parsed.data.email.toLowerCase();
    const password = parsed.data.password;

    const [row] = await db
      .select({
        id: applicants.id,
        passwordHash: applicants.passwordHash,
        emailVerifiedAt: applicants.emailVerifiedAt,
        status: applicants.status,
      })
      .from(applicants)
      .where(eq(applicants.email, email))
      .limit(1);

    // Constant-ish response shape — do not leak which side failed.
    if (
      !row ||
      !row.passwordHash ||
      !verifyPassword(password, row.passwordHash)
    ) {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Unauthorized",
          status: 401,
          detail: "Invalid email or password",
        },
        { status: 401 },
      );
    }

    if (!row.emailVerifiedAt) {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Forbidden",
          status: 403,
          detail: "Please verify your email before signing in.",
        },
        { status: 403 },
      );
    }

    const token = signApplicantToken({ applicantId: row.id });
    return NextResponse.json({
      data: {
        token,
        applicant: { id: row.id, status: row.status },
        tokenType: "Bearer",
        expiresInSeconds: 24 * 60 * 60,
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
