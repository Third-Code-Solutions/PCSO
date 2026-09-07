import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { applicants } from "@/lib/db/schema/recruitment";
import { applicantRegisterSchema } from "@/lib/validations/recruitment";
import {
  generateVerificationToken,
  hashPassword,
} from "@/lib/utils/rpm/applicant-auth";
import { enforceRateLimit } from "@/lib/utils/rate-limit";
import {
  ApplicantVerificationEmail,
  applicantVerificationPlainText,
} from "@/lib/email/templates/applicant-verification";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

// API-005: registrations are scarce per IP.
const RATE_LIMIT = { bucket: "rpm:register", limit: 5, windowMs: 60 * 60_000 };

const VERIFICATION_TTL_HOURS = 24;

/**
 * Send the verification email via Resend. When RESEND_API_KEY is absent
 * (dev/test) we log the link instead and registration still succeeds.
 * Delivery failure is logged but never blocks registration.
 */
async function sendVerificationEmail(
  to: string,
  firstName: string,
  token: string,
): Promise<boolean> {
  const verifyUrl = `${env.NEXT_PUBLIC_APP_URL}/applicant/verify?token=${encodeURIComponent(token)}`;

  if (!env.RESEND_API_KEY) {
    if (process.env.NODE_ENV !== "production") {
      // Dev-only visibility when no email provider is configured.
      console.info(`[rpm/register] verification link for ${to}: ${verifyUrl}`);
    }
    return false;
  }

  try {
    const resend = new Resend(env.RESEND_API_KEY);
    const from = env.RESEND_FROM_EMAIL ?? "noreply@pcso.gov.ph";
    const props = {
      firstName,
      verifyUrl,
      expiresInHours: VERIFICATION_TTL_HOURS,
    };
    const { error } = await resend.emails.send({
      from: `PCSO HRIS <${from}>`,
      to,
      subject: "Verify your PCSO applicant account",
      react: ApplicantVerificationEmail(props),
      text: applicantVerificationPlainText(props),
    });
    if (error) {
      console.error("[rpm/register] verification email failed:", error);
      return false;
    }
    return true;
  } catch (error: unknown) {
    console.error("[rpm/register] verification email failed:", error);
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const limited = enforceRateLimit(request, RATE_LIMIT);
    if (limited) return limited;

    const json: unknown = await request.json().catch(() => null);
    if (!json) {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Bad Request",
          status: 400,
          detail: "Invalid JSON body",
        },
        { status: 400 },
      );
    }

    const parsed = applicantRegisterSchema.safeParse(json);
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
    const emailLower = input.email.toLowerCase();

    const existingRows = await db
      .select({ id: applicants.id })
      .from(applicants)
      .where(eq(applicants.email, emailLower))
      .limit(1);
    if (existingRows[0]) {
      return NextResponse.json(
        {
          data: {
            message:
              "If an account can be created for this email, verification instructions will be sent.",
          },
        },
        { status: 202 },
      );
    }

    const passwordHash = hashPassword(input.password);
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(
      Date.now() + VERIFICATION_TTL_HOURS * 60 * 60 * 1000,
    );

    // dateOfBirth is an ISO datetime on the wire; the DB column is `date`
    // (YYYY-MM-DD). Keep only the date portion.
    const dobDateOnly = input.dateOfBirth.slice(0, 10);

    const insertedRows = await db
      .insert(applicants)
      .values({
        email: emailLower,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        middleName: input.middleName ?? null,
        contactNumber: input.contactNumber,
        dateOfBirth: dobDateOnly,
        gender: input.gender,
        currentAddress: input.currentAddress,
        status: "registered",
        verificationToken,
        tokenExpiresAt: verificationExpires,
      })
      .returning({ id: applicants.id, email: applicants.email });

    const inserted = insertedRows[0];
    if (!inserted) {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Internal Server Error",
          status: 500,
          detail: "Could not create applicant",
        },
        { status: 500 },
      );
    }

    const emailSent = await sendVerificationEmail(
      inserted.email,
      input.firstName,
      verificationToken,
    );

    return NextResponse.json(
      {
        data: {
          id: inserted.id,
          email: inserted.email,
          message: emailSent
            ? "Verification email sent. Check your inbox."
            : "Registration received, but verification email delivery is temporarily unavailable. Please contact support.",
        },
      },
      { status: emailSent ? 201 : 202 },
    );
  } catch (error: unknown) {
    console.error("[rpm/register] applicant registration failed", error);
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
