#!/usr/bin/env tsx
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
config({ path: ".env.local" });

async function main() {
  const email = process.env.SMOKE_ADMIN_EMAIL;
  const password = process.env.SMOKE_ADMIN_PASSWORD;
  if (!email || !password)
    throw new Error(
      "Set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD (never commit credentials).",
    );
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const sb = createClient(url, anon);
  const { data } = await sb.auth.signInWithPassword({
    email,
    password,
  });
  if (!data.session) throw new Error("signin failed");
  const ref = url.replace(/^https?:\/\//, "").split(".")[0];
  const cookie =
    "sb-" +
    ref +
    "-auth-token=base64-" +
    Buffer.from(
      JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
        token_type: "bearer",
        user: data.session.user,
      }),
    ).toString("base64");

  const tests: { path: string; expect: number }[] = [
    { path: "/payroll", expect: 200 },
    { path: "/payroll/regular", expect: 404 },
    { path: "/payroll/jo-cos", expect: 200 },
    { path: "/payroll/payslips", expect: 200 },
    { path: "/payroll/history", expect: 200 },
    { path: "/payroll/not-a-uuid", expect: 404 },
  ];
  let pass = 0;
  for (const t of tests) {
    const r = await fetch("http://localhost:3000" + t.path, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    const ok = r.status === t.expect;
    pass += ok ? 1 : 0;
    console.log(`  ${ok ? "✓" : "✗"} ${r.status}/${t.expect}  ${t.path}`);
  }
  console.log(`\n${pass}/${tests.length} passed`);
  process.exit(pass === tests.length ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
