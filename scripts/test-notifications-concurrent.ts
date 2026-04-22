#!/usr/bin/env tsx
/**
 * Concurrent-delete test for notifications clear helpers.
 *
 * Scenario:
 *   1. Seed N notifications for a synthetic user (half read, half unread).
 *   2. Fire clearRead and clearAll in parallel via Promise.all — simulates
 *      two tabs clicking clear buttons at the same millisecond.
 *   3. Fire both again twice more to prove idempotency under repetition.
 *   4. Assert the inbox ends empty and no call threw.
 *
 * The test duplicates the server helpers' SQL shape directly to avoid the
 * `server-only` import guard from @/lib/notifications. The DELETE WHERE
 * predicate is identical, so this exercises the exact concurrency path the
 * production helpers use.
 *
 * Run:
 *   npx tsx scripts/test-notifications-concurrent.ts
 */
import { config } from "dotenv";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

config({ path: ".env.local" });
config({ path: ".env" });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set. Populate .env.local and retry.");
  process.exit(1);
}

const isTransactionPooler = DATABASE_URL.includes(":6543");
const sql = postgres(DATABASE_URL, {
  max: 5,
  ssl: DATABASE_URL.includes("supabase.co")
    ? { rejectUnauthorized: false }
    : false,
  prepare: !isTransactionPooler,
});

const SEED_TOTAL = 20;

async function seed(userId: string): Promise<void> {
  const rows = Array.from({ length: SEED_TOTAL }, (_, i) => ({
    user_id: userId,
    type: "generic",
    title: `Test notification ${i + 1}`,
    read_at: i % 2 === 0 ? new Date() : null,
  }));
  await sql`
    INSERT INTO public.notifications ${sql(rows, "user_id", "type", "title", "read_at")}
  `;
}

async function countFor(userId: string): Promise<number> {
  const rows = await sql<
    { c: number }[]
  >`SELECT count(*)::int as c FROM public.notifications WHERE user_id = ${userId}`;
  return rows[0]!.c;
}

async function clearRead(userId: string): Promise<number> {
  const rows = await sql`
    DELETE FROM public.notifications
    WHERE user_id = ${userId} AND read_at IS NOT NULL
    RETURNING id
  `;
  return rows.count;
}

async function clearAll(userId: string): Promise<number> {
  const rows = await sql`
    DELETE FROM public.notifications
    WHERE user_id = ${userId}
    RETURNING id
  `;
  return rows.count;
}

async function main() {
  const userId = randomUUID();
  console.log(`[test] synthetic user_id=${userId}`);

  await seed(userId);
  const initial = await countFor(userId);
  console.log(
    `[test] seeded ${initial} notifications (expected ${SEED_TOTAL})`,
  );

  // Pass 1 — fully populated inbox, concurrent clearRead + clearAll.
  const [r1, r2] = await Promise.all([clearRead(userId), clearAll(userId)]);
  console.log(
    `[test] concurrent pass 1 — clearRead=${r1} clearAll=${r2} (sum=${r1 + r2})`,
  );
  const afterPass1 = await countFor(userId);
  console.log(`[test] remaining after pass 1: ${afterPass1} (expected 0)`);

  // Pass 2 — empty inbox, both should return 0 and not throw.
  const [r3, r4] = await Promise.all([clearRead(userId), clearAll(userId)]);
  console.log(
    `[test] concurrent pass 2 (empty) — clearRead=${r3} clearAll=${r4}`,
  );

  // Pass 3 — stress: double clearAll on an already empty inbox.
  const [r5, r6] = await Promise.all([clearAll(userId), clearAll(userId)]);
  console.log(
    `[test] concurrent pass 3 (double clearAll on empty) — a=${r5} b=${r6}`,
  );

  // Pass 4 — reseed, fire TWO simultaneous clearAll calls on a populated
  // inbox. One wins the rows, the other sees 0. Neither throws.
  await seed(userId);
  const [r7, r8] = await Promise.all([clearAll(userId), clearAll(userId)]);
  console.log(
    `[test] concurrent pass 4 (race for same rows) — winner=${Math.max(r7, r8)} loser=${Math.min(r7, r8)}`,
  );
  const finalCount = await countFor(userId);

  const ok =
    finalCount === 0 &&
    r1 + r2 === SEED_TOTAL &&
    r3 === 0 &&
    r4 === 0 &&
    r5 === 0 &&
    r6 === 0 &&
    r7 + r8 === SEED_TOTAL;

  console.log("");
  console.log(
    ok
      ? "[test] PASS — concurrent clears are safe & idempotent"
      : "[test] FAIL",
  );
  await sql.end();
  process.exit(ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error("[test] threw:", err);
  try {
    await sql.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
