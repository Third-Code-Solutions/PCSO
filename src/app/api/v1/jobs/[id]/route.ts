import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { apiJobs } from "@/lib/db/schema";
import { authenticateApiRequest } from "@/lib/api/v1/auth";
import { problem, internalProblem } from "@/lib/api/v1/problem";
import { apiResponse } from "@/lib/api/v1/xml";
import { serializeApiJob } from "@/lib/api/v1/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/v1/jobs/[id] — job status + result (TOR 3.3.15).
 * Scope: jobs:read.
 *
 * Jobs are tenant-isolated: a job submitted by another API client answers
 * 404 (never 403) so job ids cannot be enumerated across clients.
 */

type RouteContext = { params: Promise<{ id: string }> };

const idSchema = z.string().uuid();

function notFound() {
  return problem({
    status: 404,
    title: "Not Found",
    detail: "Job not found",
  });
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const auth = await authenticateApiRequest(request, ["jobs:read"]);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) return notFound();

    const [job] = await db
      .select()
      .from(apiJobs)
      .where(
        and(
          eq(apiJobs.id, parsedId.data),
          eq(apiJobs.apiClientId, auth.ctx.clientRowId),
        ),
      )
      .limit(1);
    if (!job) return notFound();

    return apiResponse(request, "job", { data: serializeApiJob(job) });
  } catch (error: unknown) {
    return internalProblem(error);
  }
}
