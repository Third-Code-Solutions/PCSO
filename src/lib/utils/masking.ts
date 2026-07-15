/**
 * Data-masking helpers — TOR 3.2.8.
 *
 * Pure, dependency-free functions that redact sensitive identifiers for
 * display to viewers who lack full-record privileges. Masking is a DISPLAY
 * concern only: official documents (COE, Service Record, remittance files,
 * payslips) are generated from unmasked data by permission-gated code paths.
 *
 * Convention: every alphanumeric character is replaced with `*` except the
 * trailing `visible` characters; separator characters (`-`, `.`, `/`, spaces)
 * are preserved so the masked value keeps its familiar shape,
 * e.g. `123-456-1234` → `***-***-1234`.
 */

const DEFAULT_VISIBLE_CHARS = 4;
const MASK_CHAR = "*";

function isAlphaNumeric(char: string): boolean {
  return /[a-z0-9]/i.test(char);
}

/**
 * Core masker: hides all alphanumeric characters except the last `visible`,
 * preserving separators. When the value has `visible` or fewer alphanumeric
 * characters the ENTIRE value is masked (never reveal a whole short ID).
 *
 * Nullish / blank input passes through as `null` so callers keep their
 * existing "—" empty-state rendering.
 */
export function maskValue(
  value: string | null | undefined,
  visible: number = DEFAULT_VISIBLE_CHARS,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const alphaNumericCount = [...trimmed].filter(isAlphaNumeric).length;
  // Too short to safely reveal a suffix — mask everything.
  const revealCount = alphaNumericCount > visible ? visible : 0;

  let seenFromRight = 0;
  const chars = [...trimmed];
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const char = chars[i]!;
    if (!isAlphaNumeric(char)) continue; // keep separators as-is
    if (seenFromRight < revealCount) {
      seenFromRight += 1;
      continue;
    }
    chars[i] = MASK_CHAR;
  }
  return chars.join("");
}

/** BIR Taxpayer Identification Number — keep last 4, e.g. `***-***-1234`. */
export function maskTin(value: string | null | undefined): string | null {
  return maskValue(value, 4);
}

/** GSIS BP number — keep last 4. */
export function maskGsis(value: string | null | undefined): string | null {
  return maskValue(value, 4);
}

/** PhilHealth Identification Number — keep last 4. */
export function maskPhilhealth(
  value: string | null | undefined,
): string | null {
  return maskValue(value, 4);
}

/** Pag-IBIG / HDMF MID number — keep last 4. */
export function maskPagibig(value: string | null | undefined): string | null {
  return maskValue(value, 4);
}

/** SSS number (non-organic personnel) — keep last 4. */
export function maskSss(value: string | null | undefined): string | null {
  return maskValue(value, 4);
}

/** Bank account number — keep last 4 (matches bank-statement convention). */
export function maskBankAccount(
  value: string | null | undefined,
): string | null {
  return maskValue(value, 4);
}

/**
 * Email — keep the first character of the local part and the full domain:
 * `nicole@pcso.gov.ph` → `n*****@pcso.gov.ph`. Values without `@` fall back
 * to the standard suffix masking (last 3 visible).
 */
export function maskEmail(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === "") return null;

  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) return maskValue(trimmed, 3);

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex); // includes '@'
  const first = local[0]!;
  const maskedLocal = first + MASK_CHAR.repeat(Math.max(local.length - 1, 2));
  return `${maskedLocal}${domain}`;
}

// ─── Employee-shaped helper ──────────────────────────────────────────────────

/** Sensitive employee columns masked for viewers without `employees.edit`. */
const EMPLOYEE_FIELD_MASKERS: Readonly<
  Record<string, (v: string | null | undefined) => string | null>
> = {
  tin: maskTin,
  gsisNo: maskGsis,
  philhealthNo: maskPhilhealth,
  pagibigNo: maskPagibig,
  sssNo: maskSss,
  bankAccountNumber: maskBankAccount,
};

/**
 * Returns a NEW object with the government-ID / bank fields masked, or the
 * original object untouched when `canViewFull` is true (HR-privileged viewer).
 *
 * Only fields present on the input are touched; the function never adds keys,
 * so it is safe for both full rows and narrow projections.
 */
export function maskEmployeeSensitiveFields<T extends object>(
  employee: T,
  canViewFull: boolean,
): T {
  if (canViewFull) return employee;

  const copy = { ...(employee as Record<string, unknown>) };
  for (const [field, masker] of Object.entries(EMPLOYEE_FIELD_MASKERS)) {
    if (!(field in copy)) continue;
    const current = copy[field];
    if (current == null || typeof current === "string") {
      copy[field] = masker(current as string | null | undefined);
    }
  }
  return copy as T;
}
