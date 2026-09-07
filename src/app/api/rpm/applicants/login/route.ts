import { NextResponse } from "next/server";
import { and, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/lib/db";
import { applicants } from "@/lib/db/schema/recruitment";
import { applicantLoginSchema } from "@/lib/validations/recruitment";
import {
  APPLICANT_TOKEN_COOKIE,
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
      .where(
        and(
          eq(applicants.email, email),
          ne(applicants.status, "inactive"),
          isNull(applicants.deletedAt),
        ),
      )
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
    const response = NextResponse.json({
      data: {
        applicant: { id: row.id, status: row.status },
        tokenType: "Cookie",
        expiresInSeconds: 24 * 60 * 60,
      },
    });
    response.cookies.set(APPLICANT_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });
    return response;
  } catch (error: unknown) {
    console.error("[rpm/login] applicant login failed", error);
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
