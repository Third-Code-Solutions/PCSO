import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { applicants } from "@/lib/db/schema/recruitment";

// TODO integrator (API-005): rate limit token verification attempts.

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    if (!token || typeof token !== "string" || token.length < 8) {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Bad Request",
          status: 400,
          detail: "Invalid verification token",
        },
        { status: 400 },
      );
    }

    const rows = await db
      .select({
        id: applicants.id,
        tokenExpiresAt: applicants.tokenExpiresAt,
        emailVerifiedAt: applicants.emailVerifiedAt,
      })
      .from(applicants)
      .where(eq(applicants.verificationToken, token))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Not Found",
          status: 404,
          detail: "Verification token not found",
        },
        { status: 404 },
      );
    }

    if (row.emailVerifiedAt) {
      return NextResponse.json({
        data: { id: row.id, alreadyVerified: true },
      });
    }

    if (
      !row.tokenExpiresAt ||
      new Date(row.tokenExpiresAt).getTime() < Date.now()
    ) {
      return NextResponse.json(
        {
          type: "about:blank",
          title: "Gone",
          status: 410,
          detail: "Verification token expired. Please register again.",
        },
        { status: 410 },
      );
    }

    await db
      .update(applicants)
      .set({
        emailVerifiedAt: new Date(),
        verificationToken: null,
        tokenExpiresAt: null,
        status: "email_verified",
      })
      .where(eq(applicants.id, row.id));

    return NextResponse.json({ data: { id: row.id, verified: true } });
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
