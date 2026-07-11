/**
 * Payroll output signatories — TOR 1.8.6 (FM-022 chain).
 *
 * Loads the configurable signatory chain for a payroll document type from
 * fm_document_signatories (rows maintained via the existing FM UI) and falls
 * back to the standard COA 3-slot chain when nothing is configured:
 *
 *   Prepared by:  Payroll Officer
 *   Certified by: HRD Manager
 *   Approved by:  General Manager
 *
 * The resolution logic (`resolveSignatoryChain`) is pure so the PDF component
 * and tests can use it without a database. The DB loader dynamic-imports
 * `@/lib/db` inside the function body so importing this module from a client
 * component (e.g., the browser-rendered payroll register PDF) never pulls the
 * server-only Postgres client into the bundle.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal row shape read from fm_document_signatories. */
export interface SignatoryChainRow {
  signatoryRole: string;
  signatoryTitle: string;
  sequenceOrder: number;
}

/** A rendered signature block on a payroll output. */
export interface SignatoryBlock {
  /** Caption above the signature line, e.g. "Prepared by". */
  caption: string;
  /** Position title under the name line, e.g. "Payroll Officer". */
  title: string;
  /** Raw role code from FM (prepared_by / certified_by / approved_by / …). */
  role: string;
  sequenceOrder: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PAYROLL_REGISTER_DOC_TYPE = "PAYROLL_REGISTER";

/** Known FM role codes → display captions. */
const ROLE_CAPTIONS: Readonly<Record<string, string>> = {
  prepared_by: "Prepared by",
  certified_by: "Certified by",
  approved_by: "Approved by",
  reviewed_by: "Reviewed by",
  noted_by: "Noted by",
};

/** Positional captions used when a role code is not recognized. */
const POSITIONAL_CAPTIONS = ["Prepared by", "Certified by", "Approved by"];

/** TOR 1.8.6 default chain used when FM has no active configuration. */
export const DEFAULT_PAYROLL_REGISTER_SIGNATORIES: readonly SignatoryBlock[] = [
  {
    caption: "Prepared by",
    title: "Payroll Officer",
    role: "prepared_by",
    sequenceOrder: 1,
  },
  {
    caption: "Certified by",
    title: "HRD Manager",
    role: "certified_by",
    sequenceOrder: 2,
  },
  {
    caption: "Approved by",
    title: "General Manager",
    role: "approved_by",
    sequenceOrder: 3,
  },
];

// ---------------------------------------------------------------------------
// Pure resolution
// ---------------------------------------------------------------------------

/**
 * Resolve configured FM rows into ordered signature blocks, falling back to
 * the default chain when no rows are configured. Rows are sorted by
 * sequence_order; captions come from the role code when recognized, else from
 * the slot position ("Prepared by" / "Certified by" / "Approved by"), else a
 * generic "Signatory N".
 */
export function resolveSignatoryChain(
  rows: readonly SignatoryChainRow[] | null | undefined,
): SignatoryBlock[] {
  if (!rows || rows.length === 0) {
    return [...DEFAULT_PAYROLL_REGISTER_SIGNATORIES];
  }

  return [...rows]
    .sort((a, b) => a.sequenceOrder - b.sequenceOrder)
    .map((row, index) => {
      const roleKey = row.signatoryRole.trim().toLowerCase();
      const caption =
        ROLE_CAPTIONS[roleKey] ??
        POSITIONAL_CAPTIONS[index] ??
        `Signatory ${index + 1}`;
      return {
        caption,
        title: row.signatoryTitle,
        role: row.signatoryRole,
        sequenceOrder: row.sequenceOrder,
      };
    });
}

// ---------------------------------------------------------------------------
// DB loader (server-only at call time)
// ---------------------------------------------------------------------------

/**
 * Load the active signatory chain for a document type from
 * fm_document_signatories (read-only) and resolve it with fallback.
 *
 * Server-side only: dynamic imports keep the Postgres client out of client
 * bundles that import this module for types / the pure resolver.
 */
export async function getPayrollSignatories(
  documentTypeCode: string = PAYROLL_REGISTER_DOC_TYPE,
): Promise<SignatoryBlock[]> {
  const [{ db }, { fmDocumentSignatories }, { and, asc, eq, isNull }] =
    await Promise.all([
      import("@/lib/db"),
      import("@/lib/db/schema"),
      import("drizzle-orm"),
    ]);

  const rows: SignatoryChainRow[] = await db
    .select({
      signatoryRole: fmDocumentSignatories.signatoryRole,
      signatoryTitle: fmDocumentSignatories.signatoryTitle,
      sequenceOrder: fmDocumentSignatories.sequenceOrder,
    })
    .from(fmDocumentSignatories)
    .where(
      and(
        eq(fmDocumentSignatories.documentTypeCode, documentTypeCode),
        eq(fmDocumentSignatories.isActive, true),
        isNull(fmDocumentSignatories.deletedAt),
      ),
    )
    .orderBy(asc(fmDocumentSignatories.sequenceOrder));

  return resolveSignatoryChain(rows);
}
