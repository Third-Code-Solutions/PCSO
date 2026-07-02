/**
 * LDM-010 — Certificate of Training serial number generator.
 *
 * Format: `CT-YYYY-NNNNNN` (e.g. `CT-2026-000123`).
 *
 * Backed by the shared `serial_sequences` table (PIM-016 centralized serial
 * system — see src/lib/db/schema/serial-sequences.ts and
 * src/lib/db/serial-sequence-helpers.ts, the same mechanism the PIMM document
 * generators use). One atomic INSERT ... ON CONFLICT increment per issuance,
 * keyed on (document_type='CT', year).
 *
 * Must be called inside the transaction that inserts the owning certificate
 * row so a rollback releases the reserved number without creating a gap.
 */
import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import type { Tx } from "@/lib/db/transaction";
import {
  DOCUMENT_TYPES,
  formatSerialNumber,
} from "@/lib/db/serial-sequence-helpers";

type DbOrTx = Database | Tx;

export interface CertificateSerial {
  /** Full `CT-YYYY-NNNNNN` token. */
  serial: string;
  /** Year component. */
  year: number;
  /** Monotonic counter for the year. */
  sequence: number;
}

/**
 * Reserve the next `CT-YYYY-NNNNNN` serial.
 *
 * @param tx Pass the active transaction handle so the sequence increment is
 *           atomic with the certificate insert.
 */
export async function nextCertificateSerial(
  tx: DbOrTx,
): Promise<CertificateSerial> {
  const year = new Date().getUTCFullYear();

  const rows = (await tx.execute(sql`
    INSERT INTO serial_sequences (document_type, year, last_sequence)
    VALUES (${DOCUMENT_TYPES.TRAINING_CERT}, ${year}, 1)
    ON CONFLICT (document_type, year)
    DO UPDATE SET
      last_sequence = serial_sequences.last_sequence + 1,
      updated_at = now()
    RETURNING last_sequence
  `)) as unknown as Array<{ last_sequence: number | string }>;

  const first = rows[0];
  if (!first) {
    throw new Error(`Failed to allocate CT serial for year=${year}`);
  }

  const raw = first.last_sequence;
  const sequence = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
  if (!Number.isFinite(sequence) || sequence < 1) {
    throw new Error(
      `serial_sequences returned an invalid CT sequence: ${String(raw)}`,
    );
  }

  return {
    serial: formatSerialNumber(DOCUMENT_TYPES.TRAINING_CERT, sequence, year),
    year,
    sequence,
  };
}
