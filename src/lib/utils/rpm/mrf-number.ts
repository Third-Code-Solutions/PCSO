/**
 * Serial number generators for the RPM module.
 *
 * Format:
 *   MRF-YYYY-NNNNNN    (document_type = 'mrf')
 *   CSC9-YYYY-NNNNNN   (document_type = 'csc_form_9')
 *
 * Implementation:
 *   Uses a shared `serial_sequences` table with a composite PK
 *   (document_type, year) and a single `last_sequence` counter. The
 *   sequence row is created on-demand via INSERT ... ON CONFLICT ...
 *   so no upfront seeding is required.
 *
 *   The update uses `last_sequence = last_sequence + 1 RETURNING` to
 *   atomically reserve the next number. Must be called inside the
 *   transaction that writes the owning row so an aborted caller
 *   releases the reserved value.
 *
 * NOTE: The `serial_sequences` table is owned by the integrator
 * (Agent 15) / existing schema. At the time this file is written
 * the table does not exist yet in the Drizzle schema — we issue
 * raw SQL so TypeScript doesn't block on a missing typed export.
 * PRD FM-022 numbering rules.
 */

import { sql } from "drizzle-orm";
import type { Tx } from "@/lib/db/transaction";

export type SerialDocumentType = "mrf" | "csc_form_9";

export interface SerialAllocation {
  /** Formatted serial number, e.g. "MRF-2026-000001". */
  formatted: string;
  /** Four-digit calendar year used for the sequence bucket. */
  year: number;
  /** Monotonically increasing integer counter inside the year bucket. */
  sequence: number;
  /** Document type that was incremented. */
  documentType: SerialDocumentType;
}

interface SequenceRow {
  last_sequence: number;
}

const PREFIX: Record<SerialDocumentType, string> = {
  mrf: "MRF",
  csc_form_9: "CSC9",
};

const PAD_WIDTH = 6;

function padSequence(seq: number): string {
  return seq.toString().padStart(PAD_WIDTH, "0");
}

function formatSerial(
  documentType: SerialDocumentType,
  year: number,
  sequence: number,
): string {
  return `${PREFIX[documentType]}-${year}-${padSequence(sequence)}`;
}

/**
 * Reserve the next sequence number inside a live transaction.
 * Concurrent callers on the same (document_type, year) are
 * serialized by the atomic UPDATE ... RETURNING.
 */
async function allocateNext(
  tx: Tx,
  documentType: SerialDocumentType,
  year: number,
): Promise<SerialAllocation> {
  // Ensure the row exists.
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
    throw new Error(
      `Failed to allocate serial for document_type=${documentType} year=${year}`,
    );
  }

  const sequence = first.last_sequence;
  return {
    documentType,
    year,
    sequence,
    formatted: formatSerial(documentType, year, sequence),
  };
}

/**
 * Reserve the next MRF number. MRF-YYYY-NNNNNN.
 * Must be called inside the same transaction that inserts / updates
 * the owning MRF row so rollback releases the number.
 */
export async function nextMrfNumber(tx: Tx): Promise<SerialAllocation> {
  const year = new Date().getUTCFullYear();
  return allocateNext(tx, "mrf", year);
}

/**
 * Reserve the next CSC Form 9 publication number. CSC9-YYYY-NNNNNN.
 * Must be called inside the transaction that publishes the vacancy
 * so rollback releases the number.
 */
export async function nextCscForm9Number(tx: Tx): Promise<SerialAllocation> {
  const year = new Date().getUTCFullYear();
  return allocateNext(tx, "csc_form_9", year);
}
