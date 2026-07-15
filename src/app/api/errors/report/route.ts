import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging/error-log";
import { enforceRateLimit } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/errors/report — client-side error ingestion (TOR 3.4.4 / LOG-002).
 *
 * Called fire-and-forget by the app's error boundaries (`app/error.tsx`,
 * `app/global-error.tsx`). Authentication is OPTIONAL: unauthenticated error
 * reports (e.g. a crash on the login screen) are still recorded, just without
 * a user id. The payload is zod-capped and the endpoint is rate limited per
 * IP so it cannot be used to flood the error_logs table.
 */

const RATE_LIMIT = { bucket: "errors:report", limit: 10, windowMs: 60_000 };
/** Reject bodies larger than this before parsing (defense in depth). */
const MAX_BODY_BYTES = 64_000;

const ErrorReportSchema = z.object({
  message: z.string().min(1).max(5_000),
  stack: z.string().max(20_000).optional(),
  /** Reporting surface, e.g. 'client:app-error-boundary'. */
  source: z.string().max(200).optional(),
  errorCode: z.string().max(60).optional(),
  level: z.enum(["fatal", "error", "warn"]).optional(),
  /** Next.js server-error digest for cross-referencing server logs. */
  digest: z.string().max(128).optional(),
  /** Path where the error surfaced (informational only). */
  url: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, RATE_LIMIT);
  if (limited) return limited;

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ErrorReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Best-effort user attribution — never a gate.
  let userId: string | null = null;
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Anonymous report — acceptable.
  }

  await logError({
    level: parsed.data.level ?? "error",
    errorCode: parsed.data.errorCode,
    message: parsed.data.message,
    source: parsed.data.source ?? "client:error-boundary",
    stack: parsed.data.stack,
    affectedResource: parsed.data.url,
    userId,
    environment: parsed.data.digest
      ? { digest: parsed.data.digest }
      : undefined,
  });

  return new NextResponse(null, { status: 204 });
}
