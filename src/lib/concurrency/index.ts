/**
 * Concurrency primitives for server actions.
 *
 * When to use:
 *   - `lockKey(tx, key)`: pessimistic, serialize workers that operate on the
 *     same logical resource (e.g. `payroll:<period_id>`, `leave:<employee_id>`).
 *     Released automatically at tx end.
 *   - `optimisticUpdate(...)`: update-if-unchanged using `updated_at`. Returns
 *     the count of rows updated — 0 means someone else wrote first.
 *   - `withIdempotency(key, fn)`: deduplicate write actions by a client-provided
 *     key (e.g. form submission token). Second call with same key returns the
 *     cached result instead of running `fn` again.
 *
 * All three compose with `withTx`/`withRetry` from `@/lib/db/transaction`.
 */

import { sql } from 'drizzle-orm';
import { db, dbClient } from '@/lib/db';
import type { Tx } from '@/lib/db/transaction';

/**
 * Acquire a per-key PG advisory lock for the remainder of the transaction.
 * Other callers that request the same key on another connection will wait
 * until this transaction commits or rolls back. Keys are hashed to int8 via
 * `hashtextextended` so callers can use any string identifier.
 */
export async function lockKey(tx: Tx, key: string): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
  );
}

/**
 * Try to acquire an advisory lock without waiting. Returns true if acquired,
 * false if another tx holds it. Use for "skip if busy" patterns.
 */
export async function tryLockKey(tx: Tx, key: string): Promise<boolean> {
  const rows = (await tx.execute(
    sql`select pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) as locked`,
  )) as unknown as Array<{ locked: boolean }>;
  return rows[0]?.locked === true;
}

/**
 * Optimistic update: only writes when `updated_at` still matches `expectedUpdatedAt`.
 * Returns the number of rows updated (0 means the row changed under us —
 * caller should re-read and retry).
 *
 * NOTE: `table` and `idColumn`/`updatedAtColumn` are interpolated as raw SQL
 * identifiers. Callers must pass trusted constants, never user input.
 */
export async function optimisticUpdate(params: {
  tx?: Tx;
  table: string;
  idColumn?: string;
  updatedAtColumn?: string;
  id: string;
  expectedUpdatedAt: Date;
  set: Record<string, unknown>;
}): Promise<number> {
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
  if (entries.length === 0) return 0;

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

  // postgres-js returns an array with `.count`; drizzle normalizes differently
  // across drivers — accept all three shapes.
  return result.count ?? result.rowCount ?? result.length ?? 0;
}

/**
 * Idempotency wrapper. Ensures `fn` runs at most once per `key`.
 * On a replay (same key) the cached JSON result is returned without running
 * `fn` again. Uses the `idempotency_keys` table + `ON CONFLICT DO NOTHING`.
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

  const first = cached[0];
  if (first && first.result !== null) {
    return first.result as T;
  }

  // Reserve the key. If someone else wins the race, read back their result.
  const reserved = (await db.execute(sql`
    insert into public.idempotency_keys (key, result)
    values (${key}, null)
    on conflict (key) do nothing
    returning key
  `)) as unknown as Array<{ key: string }>;

  if (reserved.length === 0) {
    // Another worker reserved it. Poll briefly for their result.
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
 * Run `fn` while holding a PG session-scoped advisory lock keyed by `key`.
 * Used for long-running workflows that span multiple connections (e.g. a
 * bulk process loop that issues many supabase queries). Other callers that
 * request the same key block until the holder releases.
 *
 * Implementation: reserves a dedicated postgres connection from the pool,
 * runs `pg_advisory_lock`, executes `fn`, and unlocks in a finally block.
 */
export async function withSessionAdvisoryLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  // postgres.js `reserve()` returns a handle with a `.release()` method.
  // We cast loosely because the postgres-js types don't expose reserve on
  // every version; it exists as of v3.4+.
  const reservable = dbClient as unknown as {
    reserve: () => Promise<{
      unsafe: (s: string, params?: unknown[]) => Promise<unknown>;
      release: () => void;
    }>;
  };
  const conn = await reservable.reserve();
  try {
    await conn.unsafe(
      `select pg_advisory_lock(hashtextextended($1, 0))`,
      [key],
    );
    try {
      return await fn();
    } finally {
      await conn.unsafe(
        `select pg_advisory_unlock(hashtextextended($1, 0))`,
        [key],
      );
    }
  } finally {
    conn.release();
  }
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
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Idempotency timeout: key "${key}" reserved but unresolved`);
}
