/**
 * Transaction + retry + concurrency primitives for Drizzle + postgres-js.
 *
 * When to use:
 *   - `withTx`: any multi-statement write that must be atomic (payroll run,
 *     leave approval + credit deduction, SALN submission + audit event).
 *     Throw inside the callback to rollback.
 *   - `withRetry`: wrap a whole `withTx` call when the work is idempotent and
 *     may race (serialization failure 40001, deadlock 40P01). Most server
 *     actions that lock rows + read-modify-write benefit from this.
 *   - `lockKey`: pessimistic per-key serialization inside a tx
 *     (e.g. `payroll:<period_id>`, `leave:<employee_id>`). Released on tx end.
 *   - `optimisticUpdate`: update-if-unchanged using `updated_at`. Returns
 *     `{ updated: boolean }` — `false` means someone else wrote first.
 *   - `withIdempotency`: deduplicate writes by a caller-provided key.
 *   - `withConcurrentGuard`: composed helper for common "approve/confirm" flows.
 *
 * Do NOT use retry for non-idempotent side effects outside the tx
 * (external HTTP calls, emails). Keep those after the tx commits.
 */

import { sql } from 'drizzle-orm';
import { db } from './index';

/** Drizzle tx handle — subset of `db` callable inside a transaction. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Run `fn` inside a database transaction. Throwing inside the callback
 * rolls back. Returning a value commits.
 */
export async function withTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}

/** Postgres error codes we retry: serialization failure + deadlock detected. */
const RETRYABLE_PG_CODES = new Set(['40001', '40P01']);
const DEFAULT_TRIES = 3;
const BASE_BACKOFF_MS = 50;

export interface WithRetryOptions {
  /** Total attempts. Defaults to 3. */
  retries?: number;
}

/**
 * Retry a function on transient concurrency errors. Uses linear backoff
 * (50ms, 100ms, 150ms by default). Non-retryable errors are re-thrown
 * immediately.
 *
 * Accepts either a numeric `tries` (legacy positional API) or a
 * `{ retries }` options object.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: number | WithRetryOptions,
): Promise<T> {
  const tries = normalizeTries(opts);
  let lastError: unknown;
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      return await fn();
    } catch (err: unknown) {
      const code = extractPgCode(err);
      if (!code || !RETRYABLE_PG_CODES.has(code)) {
        throw err;
      }
      lastError = err;
      await sleep(BASE_BACKOFF_MS * (attempt + 1));
    }
  }
  throw lastError;
}

function normalizeTries(opts: number | WithRetryOptions | undefined): number {
  if (typeof opts === 'number') return opts;
  if (opts && typeof opts.retries === 'number') return opts.retries;
  return DEFAULT_TRIES;
}

/**
 * Acquire a per-key PG advisory lock for the remainder of the transaction.
 * Other callers that request the same key on another connection will wait
 * until this transaction commits or rolls back. Keys are hashed via
 * `hashtext` so callers can use any string identifier.
 */
export async function lockKey(tx: Tx, key: string): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${key}))`,
  );
}

export interface OptimisticUpdateParams {
  tx?: Tx;
  table: string;
  idColumn?: string;
  updatedAtColumn?: string;
  id: string;
  expectedUpdatedAt: Date;
  set: Record<string, unknown>;
}

export interface OptimisticUpdateResult {
  updated: boolean;
}

/**
 * Optimistic update: only writes when `updated_at` still matches
 * `expectedUpdatedAt`. Returns `{ updated: boolean }` — `false` means the
 * row changed under us and the caller should re-read and retry.
 *
 * NOTE: `table`, `idColumn`, and `updatedAtColumn` are interpolated as raw
 * SQL identifiers. Callers must pass trusted constants, never user input.
 */
export async function optimisticUpdate(
  params: OptimisticUpdateParams,
): Promise<OptimisticUpdateResult> {
  const {
    tx,
    table,
    idColumn = 'id',
    updatedAtColumn = 'updated_at',
    id,
    expectedUpdatedAt,
    set,
  } = params;

  const runner = tx ?? db;
  const entries = Object.entries(set);
  if (entries.length === 0) return { updated: false };

  const assignments = sql.join(
    entries.map(([col, val]) => sql`${sql.identifier(col)} = ${val}`),
    sql`, `,
  );

  const result = (await runner.execute(sql`
    update ${sql.identifier(table)}
    set ${assignments}, ${sql.identifier(updatedAtColumn)} = now()
    where ${sql.identifier(idColumn)} = ${id}
      and ${sql.identifier(updatedAtColumn)} = ${expectedUpdatedAt}
  `)) as unknown as { count?: number; rowCount?: number; length?: number };

  const rows = result.count ?? result.rowCount ?? result.length ?? 0;
  return { updated: rows > 0 };
}

/**
 * Idempotency wrapper. Ensures `fn` runs at most once per `key`.
 * On a replay (same key) the cached JSON result is returned without running
 * `fn` again. Uses the `public.idempotency_keys` table + `ON CONFLICT DO NOTHING`.
 *
 * The returned value is round-tripped through JSON, so `fn` must return a
 * JSON-serializable result.
 */
export async function withIdempotency<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  // Fast path: already cached?
  const cached = (await db.execute(sql`
    select result from public.idempotency_keys where key = ${key} limit 1
  `)) as unknown as Array<{ result: unknown }>;

  const firstCached = cached[0];
  if (firstCached && firstCached.result !== null) {
    return firstCached.result as T;
  }

  // Reserve the key. If someone else wins the race, poll for their result.
  const reserved = (await db.execute(sql`
    insert into public.idempotency_keys (key, result)
    values (${key}, null)
    on conflict (key) do nothing
    returning key
  `)) as unknown as Array<{ key: string }>;

  if (reserved.length === 0) {
    return waitForIdempotentResult<T>(key);
  }

  // We own the key — run the work and persist the result.
  const result = await fn();
  await db.execute(sql`
    update public.idempotency_keys
    set result = ${JSON.stringify(result) as unknown as object}::jsonb
    where key = ${key}
  `);
  return result;
}

/**
 * Composed guard for common "approve"/"confirm" flows:
 *
 *   1. Open a transaction.
 *   2. Acquire an advisory lock on `key` (serializes concurrent approvers).
 *   3. Run `fn(tx)`.
 *   4. Automatically retry the whole thing on serialization / deadlock errors.
 *
 * Use when multiple approvers could legitimately race on the same resource
 * (e.g. two HR admins approving the same leave, two finance users locking
 * the same payroll period).
 */
export async function withConcurrentGuard<T>(
  key: string,
  fn: (tx: Tx) => Promise<T>,
  opts?: WithRetryOptions,
): Promise<T> {
  return withRetry(
    () =>
      withTx(async (tx) => {
        await lockKey(tx, key);
        return fn(tx);
      }),
    opts,
  );
}

function extractPgCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const maybe = err as { code?: unknown; originalError?: { code?: unknown } };
  if (typeof maybe.code === 'string') return maybe.code;
  if (maybe.originalError && typeof maybe.originalError.code === 'string') {
    return maybe.originalError.code;
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForIdempotentResult<T>(key: string): Promise<T> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const rows = (await db.execute(sql`
      select result from public.idempotency_keys where key = ${key} limit 1
    `)) as unknown as Array<{ result: unknown }>;
    const row = rows[0];
    if (row && row.result !== null) {
      return row.result as T;
    }
    await sleep(100);
  }
  throw new Error(`Idempotency timeout: key "${key}" reserved but unresolved`);
}
