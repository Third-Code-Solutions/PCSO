import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { apiJobs } from "@/lib/db/schema";
import { authenticateApiRequest } from "@/lib/api/v1/auth";
import {
  problem,
  validationProblem,
  internalProblem,
} from "@/lib/api/v1/problem";
import { apiResponse } from "@/lib/api/v1/xml";
import {
  API_JOB_TYPES,
  enqueueApiJob,
  runApiJob,
  serializeApiJob,
  validateJobParams,
} from "@/lib/api/v1/jobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/**
 * Jobs are processed INLINE within this request (TOR 3.3.15 best-effort
 * serverless model — see src/lib/api/v1/jobs.ts). 300s is the ceiling for
 * the heaviest export; a dedicated worker/cron can take over later without
 * any route change.
 */
export const maxDuration = 300;

/**
 * /api/v1/jobs — async job queue (TOR 3.3.15 / API-006, PERF-003).
 *
 *   POST — submit a job.  Scope: jobs:write.
 *          Body: { "job_type": "payroll_journal_export"|"employee_report",
 *                  "params": { … } }
 *          The queued row is created first (durable), then processed inline;
 *          the response carries the FINAL job state (completed/failed) with
 *          `result_url` pointing at the artifact (7-day signed URL).
 *   GET  — list this client's jobs. Scope: jobs:read.
 *          Filters: status, job_type; pagination page/limit (max 100).
 */

const submitSchema = z.object({
  job_type: z.enum(API_JOB_TYPES),
  params: z.record(z.unknown()).optional(),
});

const listSchema = z.object({
  status: z.enum(["queued", "running", "completed", "failed"]).optional(),
  job_type: z.enum(API_JOB_TYPES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function POST(request: Request) {
  try {
    const auth = await authenticateApiRequest(request, ["jobs:write"]);
    if (!auth.ok) return auth.response;

    const json: unknown = await request.json().catch(() => null);
    if (json === null) {
      return problem({
        status: 400,
        title: "Bad Request",
        detail: "Request body must be valid JSON.",
      });
    }
    const parsed = submitSchema.safeParse(json);
    if (!parsed.success) {
      return validationProblem(parsed.error.flatten());
    }

    const paramsCheck = validateJobParams(
      parsed.data.job_type,
      parsed.data.params,
    );
    if (!paramsCheck.success) {
      return validationProblem(
        paramsCheck.error.flatten(),
        `Invalid params for job type ${parsed.data.job_type}`,
      );
    }

    const queued = await enqueueApiJob({
      jobType: parsed.data.job_type,
      params: paramsCheck.data,
      apiClientId: auth.ctx.clientRowId,
    });

    // Inline best-effort processing (queued → running → completed/failed).
    // runApiJob never throws for job-level failures — they land in the row.
    const finished = await runApiJob(queued.id);

    return apiResponse(
      request,
      "job",
      { data: serializeApiJob(finished) },
      {
        status: 201,
        headers: { Location: `/api/v1/jobs/${finished.id}` },
      },
    );
  } catch (error: unknown) {
    return internalProblem(error);
  }
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateApiRequest(request, ["jobs:read"]);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const parsed = listSchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      job_type: url.searchParams.get("job_type") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!parsed.success) {
      return validationProblem(parsed.error.flatten());
    }
    const query = parsed.data;

    // Tenant isolation: a client only ever sees its own jobs.
    const conditions: SQL[] = [eq(apiJobs.apiClientId, auth.ctx.clientRowId)];
    if (query.status) conditions.push(eq(apiJobs.status, query.status));
    if (query.job_type) conditions.push(eq(apiJobs.jobType, query.job_type));
    const where = and(...conditions);

    const [countRow] = await db
      .select({ total: sql<number>`cast(count(*) as int)` })
      .from(apiJobs)
      .where(where);
    const total = countRow?.total ?? 0;

    const rows = await db
      .select()
      .from(apiJobs)
      .where(where)
      .orderBy(desc(apiJobs.createdAt))
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);

    return apiResponse(request, "jobs", {
      data: rows.map(serializeApiJob),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        total_pages: Math.max(1, Math.ceil(total / query.limit)),
      },
    });
  } catch (error: unknown) {
    return internalProblem(error);
  }
}
