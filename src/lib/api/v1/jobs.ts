import "server-only";

/**
 * Async job queue for long-running API operations — TOR 3.3.15 (API-006 /
 * PERF-003).
 *
 * EXECUTION MODEL (serverless-first): POST /api/v1/jobs inserts a `queued`
 * `api_jobs` row and then runs the job INLINE within the same request
 * (route sets `maxDuration = 300`), transitioning queued → running →
 * completed/failed. This is best-effort "waitUntil-style" processing: the
 * row is durable, so if the invocation dies mid-run the job stays `running`
 * and a dedicated worker / cron sweeper can later re-drive or fail it. When
 * a real worker (queue consumer or Vercel cron) is introduced, point it at
 * `runApiJob()` — no route changes needed.
 *
 * Supported job types:
 *   - payroll_journal_export : journal entries for all approved/paid payroll
 *     periods inside a date range → JSON or CSV artifact in Supabase Storage.
 *   - employee_report        : ad hoc employee report (column subset of the
 *     PIMM ad hoc catalog, TOR 1.3.26) → CSV artifact in Supabase Storage.
 *
 * Artifacts land in the private `api-exports` bucket; `result_url` stores a
 * 7-day signed URL. The bucket is created on first use if missing.
 */

import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { apiJobs, employees, offices, type ApiJob } from "@/lib/db/schema";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logTransaction } from "@/lib/audit";
import {
  APPOINTMENT_TYPE_VALUES,
  EMPLOYEE_STATUS_VALUES,
} from "@/lib/validations/employees";
import {
  EMPLOYEE_ADHOC_CATALOG,
  appointmentCategoryLabel,
  appointmentTypeLabel,
  buildAdhocCsv,
  shapeAdhocReport,
  type EmployeeAdhocRow,
} from "@/lib/utils/pimm/adhoc-report";
import type { AppointmentType } from "@/lib/constants/appointment-types";
import {
  computeJournalEntriesForPeriod,
  findExportablePeriodsInRange,
  journalEntriesToCsv,
  type PeriodJournal,
} from "./journal-entries";

// ─── Job type registry ───────────────────────────────────────────────────────

export const API_JOB_TYPES = [
  "payroll_journal_export",
  "employee_report",
] as const;

export type ApiJobType = (typeof API_JOB_TYPES)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isoDate = z.string().regex(ISO_DATE, "Expected YYYY-MM-DD");

export const payrollJournalExportParamsSchema = z
  .object({
    date_from: isoDate,
    date_to: isoDate,
    format: z.enum(["json", "csv"]).default("json"),
  })
  .refine((value) => value.date_from <= value.date_to, {
    message: "date_from must be on or before date_to",
    path: ["date_from"],
  });

/**
 * Column subset of EMPLOYEE_ADHOC_CATALOG that resolves from the employees +
 * offices join alone (education / eligibility / training enrichment columns
 * need extra joins and are excluded from the API report v1).
 */
const EMPLOYEE_REPORT_COLUMNS = [
  "officeName",
  "positionTitle",
  "appointmentType",
  "appointmentCategory",
  "salaryGrade",
  "step",
  "status",
  "dateHired",
  "gender",
  "email",
] as const;

export const employeeReportParamsSchema = z.object({
  office_id: z.string().uuid().optional(),
  status: z.enum(EMPLOYEE_STATUS_VALUES).optional(),
  appointment_type: z.enum(APPOINTMENT_TYPE_VALUES).optional(),
  columns: z.array(z.enum(EMPLOYEE_REPORT_COLUMNS)).max(20).optional(),
});

/** Validate params for a given job type. Returns a zod SafeParse result. */
export function validateJobParams(jobType: ApiJobType, params: unknown) {
  if (jobType === "payroll_journal_export") {
    return payrollJournalExportParamsSchema.safeParse(params ?? {});
  }
  return employeeReportParamsSchema.safeParse(params ?? {});
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const API_EXPORTS_BUCKET = "api-exports";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

async function uploadArtifact(
  objectPath: string,
  body: string,
  contentType: string,
): Promise<string> {
  const buffer = Buffer.from(body, "utf8");
  let { error } = await supabaseAdmin.storage
    .from(API_EXPORTS_BUCKET)
    .upload(objectPath, buffer, { contentType, upsert: true });

  if (error && /bucket.*not.*found/i.test(error.message)) {
    // First run on a fresh project — create the private bucket and retry once.
    await supabaseAdmin.storage
      .createBucket(API_EXPORTS_BUCKET, { public: false })
      .catch(() => undefined);
    ({ error } = await supabaseAdmin.storage
      .from(API_EXPORTS_BUCKET)
      .upload(objectPath, buffer, { contentType, upsert: true }));
  }
  if (error) {
    throw new Error(`Failed to upload job artifact: ${error.message}`);
  }

  const { data, error: signError } = await supabaseAdmin.storage
    .from(API_EXPORTS_BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);
  if (signError || !data?.signedUrl) {
    throw new Error(
      `Artifact uploaded but signing the URL failed: ${signError?.message ?? "no URL returned"}`,
    );
  }
  return data.signedUrl;
}

// ─── Job runners ─────────────────────────────────────────────────────────────

interface JobRunOutput {
  resultUrl: string;
  resultSummary: Record<string, unknown>;
}

async function runPayrollJournalExport(
  jobId: string,
  rawParams: unknown,
): Promise<JobRunOutput> {
  const params = payrollJournalExportParamsSchema.parse(rawParams ?? {});
  const periods = await findExportablePeriodsInRange(
    params.date_from,
    params.date_to,
  );

  const journals: PeriodJournal[] = [];
  const skipped: Array<{ period_id: string; reason: string }> = [];
  for (const period of periods) {
    const result = await computeJournalEntriesForPeriod(period.id);
    if (result.ok) {
      journals.push(result.journal);
    } else {
      skipped.push({ period_id: period.id, reason: result.message });
    }
  }

  const isCsv = params.format === "csv";
  const body = isCsv
    ? journalEntriesToCsv(journals)
    : JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          date_from: params.date_from,
          date_to: params.date_to,
          periods: journals,
        },
        null,
        2,
      );

  const objectPath = `api-jobs/${jobId}/journal-entries.${isCsv ? "csv" : "json"}`;
  const resultUrl = await uploadArtifact(
    objectPath,
    body,
    isCsv ? "text/csv" : "application/json",
  );

  return {
    resultUrl,
    resultSummary: {
      periods_exported: journals.length,
      periods_skipped: skipped,
      entry_count: journals.reduce((sum, j) => sum + j.entries.length, 0),
      format: params.format,
    },
  };
}

/** Hard cap so a runaway report cannot exhaust the function's memory. */
const EMPLOYEE_REPORT_MAX_ROWS = 10_000;

async function runEmployeeReport(
  jobId: string,
  rawParams: unknown,
): Promise<JobRunOutput> {
  const params = employeeReportParamsSchema.parse(rawParams ?? {});

  const conditions = [isNull(employees.deletedAt)];
  if (params.office_id) {
    conditions.push(eq(employees.officeId, params.office_id));
  }
  if (params.status) conditions.push(eq(employees.status, params.status));
  if (params.appointment_type) {
    conditions.push(eq(employees.appointmentType, params.appointment_type));
  }

  const rows = await db
    .select({
      employeeNo: employees.employeeNo,
      firstName: employees.firstName,
      lastName: employees.lastName,
      officeName: offices.name,
      positionTitle: employees.positionTitle,
      appointmentType: employees.appointmentType,
      salaryGrade: employees.salaryGrade,
      step: employees.step,
      status: employees.status,
      dateHired: employees.dateHired,
      gender: employees.gender,
      email: employees.email,
    })
    .from(employees)
    .leftJoin(offices, eq(employees.officeId, offices.id))
    .where(and(...conditions))
    .orderBy(asc(employees.lastName), asc(employees.firstName))
    .limit(EMPLOYEE_REPORT_MAX_ROWS);

  const reportRows: EmployeeAdhocRow[] = rows.map((row) => ({
    employeeNo: row.employeeNo,
    fullName: `${row.lastName}, ${row.firstName}`,
    officeName: row.officeName ?? "",
    positionTitle: row.positionTitle,
    appointmentType: appointmentTypeLabel(row.appointmentType),
    appointmentCategory: appointmentCategoryLabel(
      row.appointmentType as AppointmentType,
    ),
    salaryGrade: String(row.salaryGrade),
    step: String(row.step),
    status: row.status,
    dateHired: row.dateHired,
    gender: row.gender,
    email: row.email ?? "",
    // Enrichment columns not included in API report v1 (extra joins).
    highestEducation: "",
    eligibilities: "",
    externalTrainings: "",
  }));

  const shaped = shapeAdhocReport(
    EMPLOYEE_ADHOC_CATALOG,
    reportRows,
    params.columns ?? [],
  );
  const csv = buildAdhocCsv(shaped);

  const objectPath = `api-jobs/${jobId}/employee-report.csv`;
  const resultUrl = await uploadArtifact(objectPath, csv, "text/csv");

  return {
    resultUrl,
    resultSummary: {
      row_count: shaped.total,
      columns: shaped.columns.map((c) => c.key),
      truncated: rows.length === EMPLOYEE_REPORT_MAX_ROWS,
    },
  };
}

// ─── Queue operations ────────────────────────────────────────────────────────

export async function enqueueApiJob(input: {
  jobType: ApiJobType;
  params: unknown;
  apiClientId: string;
  requestedBy?: string | null;
}): Promise<ApiJob> {
  const [row] = await db
    .insert(apiJobs)
    .values({
      jobType: input.jobType,
      status: "queued",
      params: input.params ?? null,
      apiClientId: input.apiClientId,
      requestedBy: input.requestedBy ?? null,
    })
    .returning();
  if (!row) throw new Error("Failed to enqueue job");
  return row;
}

/**
 * Drive one job to completion: queued → running → completed/failed. Safe to
 * call from a future worker/cron as well — a job that is no longer `queued`
 * is returned unchanged (at-most-once dispatch per state).
 */
export async function runApiJob(jobId: string): Promise<ApiJob> {
  const [job] = await db
    .select()
    .from(apiJobs)
    .where(eq(apiJobs.id, jobId))
    .limit(1);
  if (!job) throw new Error(`Job ${jobId} not found`);
  if (job.status !== "queued") return job;

  const startedAt = new Date();
  await db
    .update(apiJobs)
    .set({ status: "running", startedAt, updatedAt: startedAt })
    .where(eq(apiJobs.id, jobId));

  try {
    const output =
      job.jobType === "payroll_journal_export"
        ? await runPayrollJournalExport(jobId, job.params)
        : job.jobType === "employee_report"
          ? await runEmployeeReport(jobId, job.params)
          : null;

    if (!output) {
      throw new Error(`Unsupported job type: ${job.jobType}`);
    }

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const [updated] = await db
      .update(apiJobs)
      .set({
        status: "completed",
        resultUrl: output.resultUrl,
        resultSummary: output.resultSummary,
        finishedAt,
        durationMs,
        updatedAt: finishedAt,
      })
      .where(eq(apiJobs.id, jobId))
      .returning();

    void logTransaction({
      transactionType: `api.job.${job.jobType}`,
      status: "success",
      source: "api",
      destination: "supabase_storage",
      affectedData: { jobId, summary: output.resultSummary },
      durationMs,
    });

    return updated ?? { ...job, status: "completed" };
  } catch (error: unknown) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const message = error instanceof Error ? error.message : "Unknown error";
    const [updated] = await db
      .update(apiJobs)
      .set({
        status: "failed",
        error: message,
        finishedAt,
        durationMs,
        updatedAt: finishedAt,
      })
      .where(eq(apiJobs.id, jobId))
      .returning();

    void logTransaction({
      transactionType: `api.job.${job.jobType}`,
      status: "failure",
      source: "api",
      errorInfo: message,
      affectedData: { jobId },
      durationMs,
    });

    return updated ?? { ...job, status: "failed" };
  }
}

// ─── Serializer ──────────────────────────────────────────────────────────────

export interface ApiJobResource {
  id: string;
  job_type: string;
  status: string;
  params: unknown;
  result_url: string | null;
  result_summary: unknown;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

export function serializeApiJob(job: ApiJob): ApiJobResource {
  return {
    id: job.id,
    job_type: job.jobType,
    status: job.status,
    params: job.params ?? null,
    result_url: job.resultUrl ?? null,
    result_summary: job.resultSummary ?? null,
    error: job.error ?? null,
    started_at: job.startedAt ? job.startedAt.toISOString() : null,
    finished_at: job.finishedAt ? job.finishedAt.toISOString() : null,
    duration_ms: job.durationMs ?? null,
    created_at: job.createdAt.toISOString(),
  };
}
