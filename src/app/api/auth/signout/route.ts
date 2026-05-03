import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Signs the current user out and clears session cookies.
 *
 * Accepts both POST (from a form action) and GET (from a link).
 * Always redirects to /login after sign-out.
 */
async function handleSignOut(request: NextRequest) {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.auth.signOut();
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const POST = handleSignOut;
export const GET = handleSignOut;
