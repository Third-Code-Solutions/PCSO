/**
 * Batch-insert helpers for remittance lines.
 * Remittance batches commonly hit 1000+ lines (one per employee) and must be
 * inserted in chunks to avoid exceeding Postgres' default max parameter budget.
 */

export const REMITTANCE_BATCH_SIZE = 200;

export function chunkRemittance<T>(
  items: ReadonlyArray<T>,
  size: number = REMITTANCE_BATCH_SIZE,
): T[][] {
  if (size <= 0) throw new Error('chunkRemittance: size must be positive');
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function insertInChunks<T>(
  rows: ReadonlyArray<T>,
  size: number,
  insert: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  if (rows.length === 0) return;
  const chunks = chunkRemittance(rows, size);
  for (const c of chunks) {
    await insert(c);
  }
}
