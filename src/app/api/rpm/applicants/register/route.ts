import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { applicants } from "@/lib/db/schema/recruitment";
import { applicantRegisterSchema } from "@/lib/validations/recruitment";
import {
  generateVerificationToken,
  hashPassword,
} from "@/lib/utils/rpm/applicant-auth";

// TODO integrator (API-005): rate limit (e.g. 5 registrations per IP per hour).

export const runtime = "nodejs";

/**
 * Local email stub — TODO integrator (N-026): replace with the shared
 * src/lib/email sender once Agent 14 lands the applicant templates.
 */
async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/applicant/verify?token=${encodeURIComponent(token)}`;
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console -- dev-only visibility.
    console.info(`[rpm/register] verification link for ${to}: ${url}`);
  }
}

export async function POST(request: Request) {
  try {
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
          type: "about:blank",
          title: "Conflict",
          status: 409,
          detail: "An account with this email already exists.",
        },
        { status: 409 },
      );
    }

    const passwordHash = hashPassword(input.password);
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

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

    await sendVerificationEmail(inserted.email, verificationToken);

    return NextResponse.json(
      {
        data: {
          id: inserted.id,
          email: inserted.email,
          message: "Verification email sent. Check your inbox.",
        },
      },
      { status: 201 },
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
