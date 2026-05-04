/**
 * Serial sequence helpers for document number generation.
 *
 * Uses atomic INSERT...ON CONFLICT to guarantee monotonic, gap-free
 * serial numbers per document type per year.
 *
 * Document types (from PRD):
 *   RPM: MRF-YYYY-NNNNNN, CSC9-YYYY-NNNNNN, TRUN-YYYY-NNNNNN
 *   LDM: CT-YYYY-NNNNNN (training certificates)
 *   PIMM: COE-YYYY-NNNNNN, COER-YYYY-NNNNNN, SR-YYYY-NNNNNN,
 *          NOSI-YYYY-NNNNNN, NOSA-YYYY-NNNNNN
 *   EWBM: LOYAL-YYYY-NNNNNN, RET-YYYY-NNNNNN
 */

import { db, type Database } from "./index";
import { serialSequences } from "./schema";
import { sql, eq, and } from "drizzle-orm";

// Define all known document type prefixes
export const DOCUMENT_TYPES = {
  // RPM
  MRF: "MRF",
  CSC_FORM_9: "CSC9",
  TURNOVER: "TRUN",
  // PIMM
  COE: "COE",
  COE_REMUNERATION: "COER",
  SERVICE_RECORD: "SR",
  NOSI: "NOSI",
  NOSA: "NOSA",
  PDS: "PDS",
  CLEARANCE: "CLR",
  AD_HOC: "AHC",
  // LDM
  TRAINING_CERT: "CT",
  // EWBM
  LOYALTY_AWARD: "LOYAL",
  RETIREMENT_NOTICE: "RET",
  PRAISE_NOTICE: "PRAISE",
} as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

/**
 * Get the next sequence number for a document type in a specific year.
 *
 * This function uses an atomic INSERT...ON CONFLICT pattern to guarantee
 * monotonic, gap-free serial numbers even under concurrent access.
 *
 * @param documentType - The type of document (e.g., "COE", "MRF")
 * @param year - The year for the sequence (defaults to current year)
 * @param tx - Optional transaction context (defaults to db)
 * @returns The next sequence number (1-based)
 *
 * @example
 * const nextSeq = await getNextSequence("COE", 2026);
 * // Returns 1 for first call, 2 for second, etc.
 */
export async function getNextSequence(
  documentType: DocumentType,
  year?: number,
  tx?: Database,
): Promise<number> {
  const dbContext = tx ?? db;
  const targetYear = year ?? new Date().getFullYear();

  // Atomic increment using INSERT...ON CONFLICT
  // This pattern guarantees no gaps and handles concurrent access safely
  const result = await dbContext.execute<{ last_sequence: number }>(
    sql`
      INSERT INTO ${serialSequences} (document_type, year, last_sequence)
      VALUES (${documentType}, ${targetYear}, 1)
      ON CONFLICT (document_type, year)
      DO UPDATE SET
        last_sequence = ${serialSequences.lastSequence} + 1,
        updated_at = now()
      RETURNING last_sequence
    `,
  );

  const rows = Array.from(result);
  if (rows.length === 0) {
    throw new Error(
      `Failed to generate sequence for ${documentType}-${targetYear}`,
    );
  }

  return rows[0]!.last_sequence;
}

/**
 * Format a serial number in the standard format: {TYPE}-{YYYY}-{NNNNNN}
 *
 * @param documentType - The type of document
 * @param sequence - The sequence number (will be zero-padded to 6 digits)
 * @param year - The year (defaults to current year)
 * @returns Formatted serial number string
 *
 * @example
 * formatSerialNumber("COE", 42, 2026) // Returns "COE-2026-000042"
 * formatSerialNumber("MRF", 1) // Returns "MRF-2026-000001" (current year)
 */
export function formatSerialNumber(
  documentType: DocumentType,
  sequence: number,
  year?: number,
): string {
  const targetYear = year ?? new Date().getFullYear();

  // Zero-pad sequence to 6 digits
  const paddedSequence = sequence.toString().padStart(6, "0");

  return `${documentType}-${targetYear}-${paddedSequence}`;
}

/**
 * Generate a complete serial number (atomic increment + formatting).
 *
 * This is the main entry point for most callers. It combines getNextSequence
 * and formatSerialNumber into a single operation.
 *
 * @param documentType - The type of document
 * @param year - The year for the sequence (defaults to current year)
 * @param tx - Optional transaction context
 * @returns Formatted serial number string
 *
 * @example
 * const serialNo = await generateSerialNumber("COE");
 * // Returns "COE-2026-000001" on first call
 * const serialNo2 = await generateSerialNumber("COE");
 * // Returns "COE-2026-000002" on second call
 */
export async function generateSerialNumber(
  documentType: DocumentType,
  year?: number,
  tx?: Database,
): Promise<string> {
  const targetYear = year ?? new Date().getFullYear();
  const sequence = await getNextSequence(documentType, targetYear, tx);
  return formatSerialNumber(documentType, sequence, targetYear);
}

/**
 * Get the current sequence number for a document type (read-only).
 *
 * Returns 0 if no sequence record exists yet for the given document type and year.
 * This function does NOT increment the sequence.
 *
 * @param documentType - The type of document
 * @param year - The year (defaults to current year)
 * @param tx - Optional transaction context
 * @returns The current last_sequence value, or 0 if no record exists
 *
 * @example
 * const current = await getCurrentSequence("COE", 2026);
 * // Returns 0 if no COE documents issued in 2026 yet
 * // Returns N if N documents have been issued
 */
export async function getCurrentSequence(
  documentType: DocumentType,
  year?: number,
  tx?: Database,
): Promise<number> {
  const dbContext = tx ?? db;
  const targetYear = year ?? new Date().getFullYear();

  const result = await dbContext
    .select({ lastSequence: serialSequences.lastSequence })
    .from(serialSequences)
    .where(
      and(
        eq(serialSequences.documentType, documentType),
        eq(serialSequences.year, targetYear),
      ),
    )
    .limit(1);

  return result.length > 0 ? (result[0]?.lastSequence ?? 0) : 0;
}
