import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

/**
 * Shared authorization gate for /api/cron/* endpoints.
 *
 * Vercel Cron invokes these routes with `Authorization: Bearer ${CRON_SECRET}`
 * when the CRON_SECRET env var is set on the project. The same header lets an
 * external scheduler (system cron + curl, GitHub Actions, etc.) trigger the
 * jobs on non-Vercel deployments.
 *
 * @returns `null` when the request is authorized; otherwise the error
 *          response the route handler must return immediately:
 *          - 503 when CRON_SECRET is not configured (jobs are disabled)
 *          - 401 when the bearer token does not match
 */
export function checkCronAuth(request: NextRequest): NextResponse | null {
  const secret = env.CRON_SECRET;

  if (!secret) {
    return NextResponse.json(
      {
        error:
          "Cron endpoints are disabled: CRON_SECRET is not configured on this deployment.",
      },
      { status: 503 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
