import "server-only";

import { and, count, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { errorLogs } from "@/lib/db/schema/audit";

/**
 * Read-side queries for the /admin/error-logs viewer (TOR 3.4.4 / LOG-002).
 * Mirrors the admin/audit-logs query pattern: server-side filters, cheap
 * count + page query in parallel, capped page size.
 */

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 50;

export interface ErrorLogQueryParams {
  level?: string;
  errorCode?: string;
  source?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface ErrorLogRow {
  id: string;
  level: string;
  errorCode: string | null;
  message: string;
  source: string | null;
  stackTrace: string | null;
  affectedResource: string | null;
  userId: string | null;
  createdAt: Date;
}

export interface ErrorLogPage {
  rows: ErrorLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const VALID_LEVELS = new Set(["fatal", "error", "warn"]);

function parseDateBoundary(
  value: string | undefined,
  endOfDay: boolean,
): Date | null {
  if (!value) return null;
  const parsed = new Date(
    `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function getErrorLogsPage(
  params: ErrorLogQueryParams,
): Promise<ErrorLogPage> {
  const pageSize = Math.min(
    Math.max(params.pageSize ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );
  const page = Math.max(params.page ?? 1, 1);

  const conditions = [];

  if (params.level && VALID_LEVELS.has(params.level)) {
    conditions.push(eq(errorLogs.level, params.level));
  }
  if (params.errorCode) {
    conditions.push(ilike(errorLogs.errorCode, `%${params.errorCode}%`));
  }
  if (params.source) {
    conditions.push(ilike(errorLogs.source, `%${params.source}%`));
  }
  const from = parseDateBoundary(params.dateFrom, false);
  if (from) conditions.push(gte(errorLogs.createdAt, from));
  const to = parseDateBoundary(params.dateTo, true);
  if (to) conditions.push(lte(errorLogs.createdAt, to));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalResult, rows] = await Promise.all([
    db.select({ count: count() }).from(errorLogs).where(whereClause),
    db
      .select({
        id: errorLogs.id,
        level: errorLogs.level,
        errorCode: errorLogs.errorCode,
        message: errorLogs.message,
        source: errorLogs.source,
        stackTrace: errorLogs.stackTrace,
        affectedResource: errorLogs.affectedResource,
        userId: errorLogs.userId,
        createdAt: errorLogs.createdAt,
      })
      .from(errorLogs)
      .where(whereClause)
      .orderBy(desc(errorLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ]);

  const total = totalResult[0]?.count ?? 0;

  return {
    rows,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Distinct error codes for the filter dropdown (capped). */
export async function getErrorCodeOptions(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ errorCode: errorLogs.errorCode })
    .from(errorLogs)
    .where(sql`${errorLogs.errorCode} IS NOT NULL`)
    .orderBy(errorLogs.errorCode)
    .limit(100);
  return rows
    .map((r) => r.errorCode)
    .filter((code): code is string => code !== null);
}
