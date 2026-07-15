import "server-only";

/**
 * Structured error logger — TOR 3.4.4 / LOG-002.
 *
 * Persists application errors into the `error_logs` table (see
 * `src/lib/db/schema/audit.ts`). Sentry (when configured) remains the
 * real-time alerting channel; this table is the COA-auditable record.
 *
 * CONTRACT: `logError` NEVER throws and never rejects — a broken error
 * pipeline must not cascade into the primary operation. Failures are
 * reported to stderr only.
 */

import { db } from "@/lib/db";
import { errorLogs } from "@/lib/db/schema/audit";

// Column-safe truncation caps (varchar limits + sane text ceilings).
const MAX_MESSAGE_CHARS = 8_000;
const MAX_STACK_CHARS = 20_000;
const MAX_SOURCE_CHARS = 200; // varchar(200)
const MAX_ERROR_CODE_CHARS = 60; // varchar(60)
const MAX_AFFECTED_RESOURCE_CHARS = 200; // varchar(200)
const MAX_SESSION_ID_CHARS = 500;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LogErrorParams {
  /** 'fatal' | 'error' | 'warn' — defaults to 'error'. */
  level?: "fatal" | "error" | "warn";
  /** Application error code, e.g. 'PAYROLL_JOURNAL_EXPORT_FAILED'. */
  errorCode?: string;
  message: string;
  /** Originating module/file/route, e.g. 'api/payroll/journal-entries'. */
  source?: string;
  stack?: string;
  /** Affected data/resource descriptor — never raw PII payloads. */
  affectedResource?: string;
  /** Supabase auth UID or system_users id; dropped when not a UUID. */
  userId?: string | null;
  sessionId?: string | null;
  /** Extra runtime context merged over the auto-captured environment info. */
  environment?: Record<string, unknown>;
}

function truncate(
  value: string | null | undefined,
  max: number,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/** Runtime/environment snapshot required by TOR 3.4.4. */
function captureEnvironment(
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    nodeEnv: process.env.NODE_ENV ?? null,
    nextRuntime: process.env.NEXT_RUNTIME ?? null,
    region: process.env.VERCEL_REGION ?? null,
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID ?? null,
    nodeVersion: process.version ?? null,
    ...extra,
  };
}

/**
 * Writes one row to `error_logs`. Fire-and-forget friendly:
 *
 * ```ts
 * try { ... } catch (err) {
 *   void logError({
 *     errorCode: "PAYROLL_JOURNAL_EXPORT_FAILED",
 *     message: err instanceof Error ? err.message : String(err),
 *     stack: err instanceof Error ? err.stack : undefined,
 *     source: "api/payroll/journal-entries",
 *   });
 *   throw err; // caller decides whether to rethrow
 * }
 * ```
 */
export async function logError(params: LogErrorParams): Promise<void> {
  try {
    const userId =
      params.userId && UUID_REGEX.test(params.userId) ? params.userId : null;

    await db.insert(errorLogs).values({
      level: params.level ?? "error",
      errorCode: truncate(params.errorCode, MAX_ERROR_CODE_CHARS),
      message:
        truncate(params.message, MAX_MESSAGE_CHARS) ?? "(empty error message)",
      source: truncate(params.source, MAX_SOURCE_CHARS),
      stackTrace: truncate(params.stack, MAX_STACK_CHARS),
      affectedResource: truncate(
        params.affectedResource,
        MAX_AFFECTED_RESOURCE_CHARS,
      ),
      environment: captureEnvironment(params.environment),
      userId,
      sessionId: truncate(params.sessionId, MAX_SESSION_ID_CHARS),
    });
  } catch (err) {
    // The error pipeline must never take down the primary operation.
    console.error("[error-log] Failed to persist error log:", err);
  }
}

/**
 * Convenience: extract message/stack from an unknown thrown value.
 */
export function describeError(err: unknown): {
  message: string;
  stack?: string;
} {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}
