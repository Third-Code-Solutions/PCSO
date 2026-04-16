-- =============================================================================
-- 2026-04-16 — Concurrency helpers
-- =============================================================================
-- Idempotent. Safe to re-run. Pairs with:
--   src/lib/db/transaction.ts       (withTx, withRetry)
--   src/lib/concurrency/index.ts    (lockKey, optimisticUpdate, withIdempotency)
--
-- What this adds:
--   1. `idempotency_keys` table — client-provided keys de-duplicate writes
--      (form resubmits, retried server actions, webhook deliveries).
--   2. Index on `created_at` for periodic cleanup.
--   3. Comments describing usage.
--
-- PG advisory locks (pg_advisory_xact_lock / pg_try_advisory_xact_lock) are
-- built into PostgreSQL — no schema needed. The application layer hashes
-- string keys via hashtextextended(key, 0) so any stable identifier works.
-- =============================================================================


-- ─── 1. Idempotency key store ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
  key        TEXT PRIMARY KEY,
  result     JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.idempotency_keys IS
  'Deduplicates write operations by client-provided key. Populated by '
  'withIdempotency() in src/lib/concurrency. Rows older than ~30 days '
  'should be pruned by a scheduled cleanup (no hard retention constraint).';

COMMENT ON COLUMN public.idempotency_keys.key IS
  'Caller-supplied idempotency key. Recommend namespacing: '
  '"<feature>:<user_id>:<form_token>" to avoid cross-feature collisions.';

COMMENT ON COLUMN public.idempotency_keys.result IS
  'Cached JSON result of the first successful run. NULL while a worker holds '
  'the reservation; populated once work finishes.';


-- ─── 2. Indexes ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idempotency_keys_created_at_idx
  ON public.idempotency_keys (created_at);


-- ─── 3. Usage notes (as DB-side comments for DBAs) ──────────────────────────

COMMENT ON INDEX public.idempotency_keys_created_at_idx IS
  'Supports periodic cleanup: DELETE FROM idempotency_keys WHERE created_at < now() - interval ''30 days''.';


-- ─── 4. Advisory lock sanity probe (no-op, just documents intent) ───────────
-- Advisory locks are per-connection OR per-transaction. We use the xact_lock
-- variant exclusively via lockKey(tx, key) — it releases on COMMIT/ROLLBACK,
-- so there's no leak risk even if the application crashes mid-transaction.

DO $$
BEGIN
  -- Probe: confirm pg_advisory_xact_lock is callable.  No-op.
  PERFORM pg_advisory_xact_lock(hashtextextended('concurrency-helpers-probe', 0));
END
$$;
