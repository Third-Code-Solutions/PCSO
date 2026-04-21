/**
 * Serial number generator for LDM training runs.
 *
 * Format: TRUN-YYYY-NNNNNN (document_type = 'training_run').
 *
 * Uses the shared `serial_sequences` table (document_type, year) composite
 * key with a monotonic `last_sequence` counter per year. Must be called
 * inside the transaction that inserts the owning training run row so that
 * a rollback releases the reserved number.
 */

import { sql } from "drizzle-orm";
import type { Tx } from "@/lib/db/transaction";

export interface RunNumberAllocation {
  /** Formatted serial, e.g. "TRUN-2026-000001". */
  formatted: string;
  /** Calendar year bucket. */
  year: number;
  /** Monotonic counter for the year. */
  sequence: number;
}

interface SequenceRow {
  last_sequence: number;
}

const PAD_WIDTH = 6;

function padSequence(seq: number): string {
  return seq.toString().padStart(PAD_WIDTH, "0");
}

/**
 * Reserve the next TRUN-YYYY-NNNNNN inside the provided transaction.
 */
export async function nextTrainingRunNumber(
  tx: Tx,
): Promise<RunNumberAllocation> {
  const year = new Date().getUTCFullYear();
  const documentType = "training_run";

  // Ensure the row exists (idempotent).
  await tx.execute(sql`
    insert into public.serial_sequences (document_type, year, last_sequence)
    values (${documentType}, ${year}, 0)
    on conflict (document_type, year) do nothing
  `);

  const rows = (await tx.execute(sql`
    update public.serial_sequences
    set last_sequence = last_sequence + 1,
        updated_at = now()
    where document_type = ${documentType} and year = ${year}
    returning last_sequence
  `)) as unknown as SequenceRow[];

  const first = rows[0];
  if (!first) {
    throw new Error(`Failed to allocate TRUN number for year=${year}`);
  }

  const sequence = first.last_sequence;
  return {
    formatted: `TRUN-${year}-${padSequence(sequence)}`,
    year,
    sequence,
  };
}
