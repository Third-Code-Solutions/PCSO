/**
 * RFC 4122 v1–v5 UUID format check.
 * Used to guard dynamic route segments before passing them to the DB
 * (Postgres throws "invalid input syntax for type uuid" otherwise).
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string | null | undefined): s is string {
  return typeof s === 'string' && UUID_RE.test(s);
}
