import { auditLog, logTransaction } from "@/lib/audit";
import { logError, describeError } from "@/lib/logging/error-log";

/**
 * Run-level bookkeeping shared by the /api/cron/* jobs (H-35, TOR 3.4.3-3.4.5).
 *
 * Every run writes one audit_logs row and one transaction_logs row whose
 * outcome reflects what actually happened; a thrown job also gets an
 * error_logs row. The returned HTTP status is non-2xx whenever anything
 * failed, so the scheduler (Vercel Cron / external) surfaces the failure.
 */

export type CronRunStatus = "success" | "partial" | "failure";

export interface CronRunInput {
  /** Snake-case job id, e.g. "monthly_accrual" → action "cron.monthly_accrual". */
  job: string;
  /** Primary table the job writes to. */
  table: string;
  startedAtMs: number;
  /** Counts/ids only — never raw PII. */
  summary?: Record<string, unknown>;
  /** Item-level failures inside an otherwise completed run. */
  errorCount?: number;
  /** The error that aborted the run, if any. */
  error?: unknown;
}

export interface CronOutcome {
  status: CronRunStatus;
  httpStatus: number;
  severity: "info" | "warn" | "critical";
}

/** Pure: classify a run. Any failure (whole-run or per-item) is non-2xx. */
export function cronOutcome(
  errorCount: number,
  hasThrown: boolean,
): CronOutcome {
  if (hasThrown)
    return { status: "failure", httpStatus: 500, severity: "critical" };
  if (errorCount > 0)
    return { status: "partial", httpStatus: 500, severity: "warn" };
  return { status: "success", httpStatus: 200, severity: "info" };
}

/** Writes audit + transaction (+ error) logs for a cron run; returns HTTP status. */
export async function recordCronRun(input: CronRunInput): Promise<number> {
  const hasThrown = input.error !== undefined;
  const errorCount = input.errorCount ?? 0;
  const outcome = cronOutcome(errorCount, hasThrown);
  const durationMs = Date.now() - input.startedAtMs;
  const action = `cron.${input.job}`;
  const described = hasThrown ? describeError(input.error) : null;
  const reason = described
    ? described.message
    : errorCount > 0
      ? `${errorCount} item(s) failed`
      : undefined;

  await Promise.all([
    auditLog({
      userId: null,
      action,
      table: input.table,
      newValues: { ...input.summary, errorCount, durationMs },
      outcome: outcome.status === "success" ? "success" : "failure",
      reason,
      module: "SYSTEM",
      subModule: "cron",
      severity: outcome.severity,
    }),
    logTransaction({
      transactionType: action,
      status: outcome.status,
      source: "cron",
      destination: input.table,
      affectedData: input.summary,
      errorInfo: reason,
      durationMs,
    }),
    described
      ? logError({
          level: "error",
          errorCode: `CRON_${input.job.toUpperCase()}_FAILED`,
          message: described.message,
          stack: described.stack,
          source: `api/cron/${input.job.replace(/_/g, "-")}`,
        })
      : Promise.resolve(),
  ]);

  return outcome.httpStatus;
}
