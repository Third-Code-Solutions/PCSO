import { z } from "zod";

const ServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  DATABASE_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32).optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z
    .string()
    .default("Philippine Charity Sweepstakes Office HRIS"),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  /** Shared secret for /api/cron/* endpoints (Vercel Cron sends it as `Authorization: Bearer`). */
  CRON_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

function buildFallback(): ServerEnv {
  // Best-effort object used only during `next build` when runtime secrets are
  // absent. Downstream code does not read secret values at build time (routes
  // are only *loaded*, not executed), so empty placeholders are safe here.
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    NEXT_PUBLIC_APP_NAME:
      process.env.NEXT_PUBLIC_APP_NAME ??
      "Philippine Charity Sweepstakes Office HRIS",
    SENTRY_DSN: process.env.SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    CRON_SECRET: process.env.CRON_SECRET,
  };
}

function parseEnv(): ServerEnv {
  // Empty strings must be treated as "unset" so schema defaults apply. Build-time
  // inlining of NEXT_PUBLIC_* vars turns an unconfigured var into "" (not
  // undefined); z `.default()` only fills undefined, so a blank NEXT_PUBLIC_APP_URL
  // would otherwise fail `.url()` and crash every page that imports env.
  const normalized: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(process.env)) {
    normalized[key] = value === "" ? undefined : value;
  }

  const parsed = ServerEnvSchema.safeParse(normalized);
  if (parsed.success) return parsed.data;

  // During `next build` the runtime secrets may not be present on the build
  // host (e.g. Railway builds before env vars are injected). Don't fail the
  // build — validation still runs at request time in production. An explicit
  // SKIP_ENV_VALIDATION=1 provides the same escape hatch for other tooling.
  const isBuildPhase =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.SKIP_ENV_VALIDATION === "1";
  if (isBuildPhase) return buildFallback();

  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables. See .env.example.");
}

export const env = parseEnv();
