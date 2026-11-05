import "server-only";

/**
 * Document certifier resolution — FM-023 (TOR 1.1.16) for PIM-010 / PIM-012.
 *
 * COE and Service Record signature blocks print the NAME and POSITION of the
 * certifying officer configured in File Maintenance → Document Certifiers
 * (fm_document_certifiers). org_profile has no signatory fields, so there is
 * no fallback: when nothing is configured the generator refuses to issue
 * instead of printing a placeholder (H-18).
 */

import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees, fmDocumentCertifiers } from "@/lib/db/schema";

export interface CertifierCandidate {
  documentTypeCode: string;
  certifierName: string | null;
  certifierPosition: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  employee: {
    firstName: string;
    middleName: string | null;
    lastName: string;
    suffix: string | null;
    positionTitle: string | null;
  } | null;
}

export interface ResolvedCertifier {
  name: string;
  title: string;
}

function employeeDisplayName(e: NonNullable<CertifierCandidate["employee"]>) {
  const middleInitial = e.middleName?.trim()
    ? `${e.middleName.trim().charAt(0)}.`
    : "";
  return [e.firstName, middleInitial, e.lastName, e.suffix ?? ""]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

/**
 * Pure: pick the certifier for the first document type code (in preference
 * order) that has a row effective on `today` (YYYY-MM-DD) with both a name
 * and a position. A typed name/position wins over the linked employee's;
 * among overlapping rows the latest `effectiveFrom` wins.
 */
export function pickCertifier(
  rows: readonly CertifierCandidate[],
  codes: readonly string[],
  today: string,
): ResolvedCertifier | null {
  for (const code of codes) {
    const effective = rows
      .filter(
        (r) =>
          r.documentTypeCode.trim().toUpperCase() === code &&
          r.effectiveFrom <= today &&
          (r.effectiveTo === null || r.effectiveTo >= today),
      )
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));

    for (const row of effective) {
      const name =
        row.certifierName?.trim() ||
        (row.employee ? employeeDisplayName(row.employee) : "");
      const title =
        row.certifierPosition?.trim() || row.employee?.positionTitle?.trim();
      if (name && title) return { name, title };
    }
  }
  return null;
}

/** Today's date in Philippine time, YYYY-MM-DD. */
function manilaToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
}

/**
 * Loads active FM-023 rows for `codes` and resolves the effective certifier.
 * Throws a user-facing error when none is configured — callers surface it.
 */
export async function resolveDocumentCertifier(
  codes: readonly string[],
): Promise<ResolvedCertifier> {
  const rows = await db
    .select({
      documentTypeCode: fmDocumentCertifiers.documentTypeCode,
      certifierName: fmDocumentCertifiers.certifierName,
      certifierPosition: fmDocumentCertifiers.certifierPosition,
      effectiveFrom: fmDocumentCertifiers.effectiveFrom,
      effectiveTo: fmDocumentCertifiers.effectiveTo,
      employeeFirstName: employees.firstName,
      employeeMiddleName: employees.middleName,
      employeeLastName: employees.lastName,
      employeeSuffix: employees.suffix,
      employeePosition: employees.positionTitle,
    })
    .from(fmDocumentCertifiers)
    .leftJoin(
      employees,
      eq(employees.id, fmDocumentCertifiers.certifierEmployeeId),
    )
    .where(
      and(
        inArray(fmDocumentCertifiers.documentTypeCode, [...codes]),
        eq(fmDocumentCertifiers.isActive, true),
        isNull(fmDocumentCertifiers.deletedAt),
      ),
    );

  const certifier = pickCertifier(
    rows.map((r) => ({
      documentTypeCode: r.documentTypeCode,
      certifierName: r.certifierName,
      certifierPosition: r.certifierPosition,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
      employee:
        r.employeeFirstName && r.employeeLastName
          ? {
              firstName: r.employeeFirstName,
              middleName: r.employeeMiddleName,
              lastName: r.employeeLastName,
              suffix: r.employeeSuffix,
              positionTitle: r.employeePosition,
            }
          : null,
    })),
    codes,
    manilaToday(),
  );

  if (!certifier) {
    throw new Error(
      `No certifying officer is configured for document type ${codes.join(" / ")}. ` +
        "Add an active row with a name and position in File Maintenance → Document Certifiers before issuing this document.",
    );
  }
  return certifier;
}
