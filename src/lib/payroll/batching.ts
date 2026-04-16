/**
 * Batching helpers for payroll operations that must scale to 1000+ employees.
 *
 * Postgres is happy with INSERT ... VALUES lists of a few hundred rows but becomes
 * fragile past ~1000 rows per statement. We chunk inserts at 200 rows to stay well
 * inside the safe range while keeping round-trips low.
 */

export const PAYROLL_BATCH_SIZE = 200;

/**
 * Yields successive chunks of the input array of the given size.
 * Does not mutate the input array.
 */
export function chunkArray<T>(items: ReadonlyArray<T>, size: number): T[][] {
  if (size <= 0) throw new Error('chunkArray: size must be positive');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Runs the callback for each chunk of the given array sequentially.
 * Sequential execution is intentional to avoid flooding the database pool.
 */
export async function forEachChunk<T>(
  items: ReadonlyArray<T>,
  size: number,
  fn: (chunk: T[], index: number) => Promise<void>,
): Promise<void> {
  const chunks = chunkArray(items, size);
  for (let i = 0; i < chunks.length; i += 1) {
    await fn(chunks[i] as T[], i);
  }
}
