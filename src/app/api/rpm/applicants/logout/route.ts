import { NextResponse } from "next/server";

import { APPLICANT_TOKEN_COOKIE } from "@/lib/utils/rpm/applicant-auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ data: { signedOut: true } });
  response.cookies.set(APPLICANT_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
