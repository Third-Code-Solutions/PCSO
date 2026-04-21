/**
 * LDM-010 — Certificate of Training serial number generator.
 *
 * Format: `CT-YYYY-NNNNNN` (e.g. `CT-2026-000123`).
 *
 * Strategy:
 *   1. If a `serial_sequences` table exists (document_type + year → next_number),
 *      atomically increment the year bucket via `nextCertificateSerialFromSequence()`.
 *   2. Otherwise fall back to a crypto-random suffix so callers can still issue
 *      certificates until the integrator wires up `serial_sequences`.
 *
 * NOTE: A proper `serial_sequences` Drizzle schema does not yet exist in this
 * worktree. The adapter is feature-flagged behind a runtime check and the
 * random fallback is explicitly flagged for integrator attention.
 */
import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import type { Database } from "@/lib/db";
import type { Tx } from "@/lib/db/transaction";

type DbOrTx = Database | Tx;

const DOCUMENT_TYPE = "certificate_of_training";

export interface CertificateSerial {
  /** Full `CT-YYYY-NNNNNN` token. */
  serial: string;
  /** Year component. */
  year: number;
  /** Zero-padded sequence number component. */
  sequence: string;
  /** `true` when the suffix came from `serial_sequences`; `false` for random fallback. */
  sequenced: boolean;
}

function pad6(n: number): string {
  return n.toString().padStart(6, "0");
}

function randomSuffix6(): string {
  // 24 bits of entropy → 6 hex characters (uppercase for visual consistency).
  return randomBytes(3).toString("hex").toUpperCase();
}

function currentYear(): number {
  return new Date().getUTCFullYear();
}

/**
 * Advance the `serial_sequences` row for (document_type, year) and return the
 * new `next_number`. Uses `INSERT ... ON CONFLICT DO UPDATE` so the first call
 * of a new year seeds the row atomically.
 *
 * Returns `null` if the `serial_sequences` table is not present — the caller
 * then falls back to `randomSuffix6()`.
 */
async function tryIncrementSequence(
  tx: DbOrTx,
  year: number,
): Promise<number | null> {
  try {
    const rows = await tx.execute(sql`
      INSERT INTO serial_sequences (document_type, year, next_number)
      VALUES (${DOCUMENT_TYPE}, ${year}, 2)
      ON CONFLICT (document_type, year)
      DO UPDATE SET next_number = serial_sequences.next_number + 1
      RETURNING next_number - 1 AS current_number
    `);
    // drizzle-orm postgres driver returns rows as an array-like result.
    const first = (
      rows as unknown as Array<{ current_number: number | string }>
    )[0];
    if (!first) return null;
    const raw = first.current_number;
    const n = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
    return Number.isFinite(n) ? n : null;
  } catch {
    // Table likely does not exist yet. Signal fallback.
    return null;
  }
}

/**
 * Generate the next certificate serial.
 *
 * @param tx Any active drizzle database (pass a transaction handle when called
 *           inside `db.transaction()` so the sequence increment is atomic with
 *           the certificate insert).
 */
export async function nextCertificateSerial(
  tx: DbOrTx,
): Promise<CertificateSerial> {
  const year = currentYear();
  const next = await tryIncrementSequence(tx, year);
  if (next !== null) {
    const sequence = pad6(next);
    return {
      serial: `CT-${year}-${sequence}`,
      year,
      sequence,
      sequenced: true,
    };
  }
  // TODO(integrator): add `serial_sequences` (document_type text, year int,
  // next_number int, PRIMARY KEY (document_type, year)) so this branch is not
  // hit in production.
  const suffix = randomSuffix6();
  return {
    serial: `CT-${year}-${suffix}`,
    year,
    sequence: suffix,
    sequenced: false,
  };
}
