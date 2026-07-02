/**
 * Employer identity guards for remittance exports (PRD P0-003).
 *
 * Government remittance files (PhilHealth EPRS, Pag-IBIG virtual, GSIS portal,
 * BIR alphalist) must never be generated with a missing or placeholder
 * employer identifier. The seeded org_profile row ships with all-zero
 * placeholders (e.g. "000000000000", "000-000-000-000") until a PCSO admin
 * encodes the real numbers, so blank AND all-zero values are both rejected.
 */

/**
 * True when the identifier is absent, blank, or an obvious seed placeholder
 * (all zeros once separators like dashes/spaces are stripped).
 */
export function isPlaceholderEmployerIdentifier(
  value: string | null | undefined,
): boolean {
  if (value == null) return true;
  const significant = value.replace(/[\s-]/g, "");
  return significant.length === 0 || /^0+$/.test(significant);
}

/**
 * Returns the trimmed identifier or throws a configuration error naming the
 * field and where to fix it. Call before embedding an employer ID in any
 * remittance export so a placeholder never reaches a government file.
 */
export function requireEmployerIdentifier(
  value: string | null | undefined,
  label: string,
): string {
  if (value == null || isPlaceholderEmployerIdentifier(value)) {
    throw new Error(
      `${label} is not configured in the organization profile. ` +
        "Ask an administrator to set it under /admin/settings/org-profile before exporting — " +
        "remittance files must not be generated with a placeholder employer ID.",
    );
  }
  return value.trim();
}
