/**
 * API Platform — TOR 3.3 (API-001…API-006)
 *
 * `api_clients` backs BOTH credential styles required by TOR 3.3.3:
 *   • static API keys — the caller sends `Authorization: Bearer pcso_<clientId>.<secret>`
 *   • OAuth 2.0 client-credentials — POST /api/v1/oauth/token with
 *     client_id + client_secret returns a short-lived JWT
 * Secrets are stored as SHA-256 hashes only; the plaintext is shown once at
 * creation. Scopes gate v1 resources (e.g. "employees:read",
 * "employees:write", "payroll:read", "jobs:read").
 *
 * `api_jobs` is the async job queue for long-running operations
 * (TOR 3.3.15 / PERF-003): report generation, bulk exports.
 */

import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  pgEnum,
  text,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { timestamps, softDelete } from "./_shared";

export const apiJobStatusEnum = pgEnum("api_job_status", [
  "queued",
  "running",
  "completed",
  "failed",
]);

export const apiClients = pgTable(
  "api_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    clientId: varchar("client_id", { length: 64 }).notNull(),
    // SHA-256 hex of the client secret / API key secret part
    secretHash: varchar("secret_hash", { length: 64 }).notNull(),
    // e.g. ["employees:read", "payroll:read", "jobs:read"]
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    rateLimitPerMinute: integer("rate_limit_per_minute").notNull().default(60),
    isActive: boolean("is_active").notNull().default(true),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull(), // auth.users id
    ...timestamps,
    ...softDelete,
  },
  (t) => [
    uniqueIndex("api_clients_client_id_idx").on(t.clientId),
    index("api_clients_active_idx").on(t.isActive),
  ],
);

export const apiJobs = pgTable(
  "api_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // e.g. payroll_journal_export, employee_report, bulk_export
    jobType: varchar("job_type", { length: 60 }).notNull(),
    status: apiJobStatusEnum("status").notNull().default("queued"),
    params: jsonb("params"),
    // Where the finished artifact lives (Supabase Storage URL) or inline JSON
    resultUrl: text("result_url"),
    resultSummary: jsonb("result_summary"),
    error: text("error"),
    // Either an interactive user or an API client initiated the job
    requestedBy: uuid("requested_by"),
    apiClientId: uuid("api_client_id").references(() => apiClients.id),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    ...timestamps,
  },
  (t) => [
    index("api_jobs_status_idx").on(t.status),
    index("api_jobs_type_idx").on(t.jobType),
    index("api_jobs_client_idx").on(t.apiClientId),
  ],
);

export type ApiClient = typeof apiClients.$inferSelect;
export type NewApiClient = typeof apiClients.$inferInsert;
export type ApiJob = typeof apiJobs.$inferSelect;
export type NewApiJob = typeof apiJobs.$inferInsert;
