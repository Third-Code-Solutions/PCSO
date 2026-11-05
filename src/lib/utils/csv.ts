/**
 * CSV/formula-injection guard (OWASP): text starting with = + - @ tab or CR is
 * prefixed with `'` so spreadsheets treat it as text. Plain numbers (`-1.5`,
 * `+639171234567`) are left untouched.
 */
export function guardFormula(str: string): string {
  if (/^[=+\-@\t\r]/.test(str) && !/^[+-]?\d+(\.\d+)?$/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/** Escape a single CSV cell per RFC 4180, with the formula-injection guard. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = guardFormula(String(value));
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}
