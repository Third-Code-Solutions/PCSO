#!/usr/bin/env tsx
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const APP = process.env.APP_URL ?? "http://localhost:3000";

async function main() {
  const email = process.env.SMOKE_ADMIN_EMAIL;
  const password = process.env.SMOKE_ADMIN_PASSWORD;
  if (!email || !password)
    throw new Error(
      "Set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD (never commit credentials).",
    );
  console.log("1. Sign in...");
  const supabase = createClient(url, anon);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.session)
    throw new Error(`Sign-in failed: ${error?.message}`);
  console.log("   ✓ Got session");

  const projectRef = url.replace(/^https?:\/\//, "").split(".")[0];
  const cookieName = `sb-${projectRef}-auth-token`;
  const cookieVal = `base64-${Buffer.from(
    JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      token_type: "bearer",
      user: data.session.user,
    }),
  ).toString("base64")}`;
  const Cookie = `${cookieName}=${cookieVal}`;

  console.log("2. Verify /dashboard returns 200 with cookie...");
  const r1 = await fetch(`${APP}/dashboard`, {
    headers: { Cookie },
    redirect: "manual",
  });
  console.log(`   ${r1.status === 200 ? "✓" : "✗"} status=${r1.status}`);

  console.log("3. Hit /api/auth/signout (POST)...");
  const r2 = await fetch(`${APP}/api/auth/signout`, {
    method: "POST",
    headers: { Cookie },
    redirect: "manual",
  });
  console.log(`   status=${r2.status}, location=${r2.headers.get("location")}`);
  const setCookie = r2.headers.get("set-cookie") ?? "";
  const cleared =
    /sb-[^=]+=;/.test(setCookie) ||
    /Max-Age=0/.test(setCookie) ||
    /expires=Thu, 01 Jan 1970/i.test(setCookie);
  console.log(
    `   ${r2.status >= 300 && r2.status < 400 ? "✓" : "✗"} redirect ${r2.headers.get("location")?.endsWith("/login") ? "to /login" : "WRONG"}`,
  );
  console.log(
    `   ${cleared ? "✓" : "✗"} session cookies cleared (set-cookie header attempts to clear): ${setCookie.slice(0, 200)}`,
  );

  console.log(
    "4. Verify GET /api/auth/signout also works (link-style sign-out)...",
  );
  const r3 = await fetch(`${APP}/api/auth/signout`, {
    headers: { Cookie },
    redirect: "manual",
  });
  console.log(
    `   ${r3.status >= 300 && r3.status < 400 ? "✓" : "✗"} status=${r3.status}, location=${r3.headers.get("location")}`,
  );

  console.log(
    "5. After sign-out, accessing /dashboard with stale cookie should redirect to /login...",
  );
  // Re-use original cookie (simulating the browser still has the auth cookie before navigation refresh)
  // The middleware should detect the invalidated session via getUser() and redirect.
  const r4 = await fetch(`${APP}/dashboard`, {
    headers: { Cookie },
    redirect: "manual",
  });
  console.log(`   status=${r4.status}, location=${r4.headers.get("location")}`);

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
