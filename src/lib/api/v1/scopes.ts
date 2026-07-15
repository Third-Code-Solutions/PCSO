/**
 * PCSO HRIS Public API v1 — scope catalog + scope checking (TOR 3.3 / API-001).
 *
 * Pure module (no server-only imports) so it is shared by:
 *   - the v1 auth layer (`src/lib/api/v1/auth.ts`) for enforcement,
 *   - the admin UI (`/admin/api-clients`) for the scope multi-select,
 *   - unit tests.
 *
 * Scope format: `<resource>:<action>` (e.g. `employees:read`). A client's
 * granted scopes live in `api_clients.scopes` (jsonb string[]). OAuth access
 * tokens carry a `scope` claim (space-delimited, RFC 6749 §3.3); the
 * effective scope set is the intersection of the token's scopes and the
 * client's currently-granted scopes, so revoking a scope on the client
 * takes effect immediately even for already-issued tokens.
 */

export interface ApiScopeDefinition {
  /** Canonical scope string, e.g. "employees:read". */
  scope: string;
  /** Human-readable description shown in the admin UI + docs page. */
  description: string;
}

/**
 * Catalog of every scope the v1 API understands. The admin UI offers exactly
 * this list; `api_clients.scopes` values outside this list are ignored by
 * the checker (defense against stale rows after a catalog change).
 */
export const API_SCOPES: readonly ApiScopeDefinition[] = [
  {
    scope: "employees:read",
    description:
      "List and read employee records (GET /employees, GET /employees/{id}).",
  },
  {
    scope: "employees:write",
    description:
      "Create, update, soft-delete employees, including batch operations.",
  },
  {
    scope: "leave:read",
    description: "Read leave credit balances (GET /leave-balances).",
  },
  {
    scope: "payroll:read",
    description:
      "Read payroll journal entries for the accounting system integration.",
  },
  {
    scope: "jobs:read",
    description: "Read async job status and results (GET /jobs, /jobs/{id}).",
  },
  {
    scope: "jobs:write",
    description: "Submit async jobs (POST /jobs) — exports, reports.",
  },
] as const;

/** Flat list of valid scope strings, for zod enums and validation. */
export const API_SCOPE_VALUES: readonly string[] = API_SCOPES.map(
  (s) => s.scope,
);

/** True when `value` is a scope this API version knows about. */
export function isKnownScope(value: string): boolean {
  return API_SCOPE_VALUES.includes(value);
}

/**
 * Returns the required scopes NOT present in `granted` (empty array when the
 * check passes). Unknown granted values are harmless — they simply never
 * match a required scope.
 */
export function missingScopes(
  granted: readonly string[],
  required: readonly string[],
): string[] {
  const grantedSet = new Set(granted);
  return required.filter((scope) => !grantedSet.has(scope));
}

/** True when every scope in `required` is present in `granted`. */
export function hasRequiredScopes(
  granted: readonly string[],
  required: readonly string[],
): boolean {
  return missingScopes(granted, required).length === 0;
}

/**
 * Intersection of two scope lists, deduplicated, preserving the order of
 * `a`. Used to derive a token's effective scopes (token ∩ client grants).
 */
export function intersectScopes(
  a: readonly string[],
  b: readonly string[],
): string[] {
  const bSet = new Set(b);
  return [...new Set(a)].filter((scope) => bSet.has(scope));
}

/**
 * Parse an RFC 6749 `scope` parameter / claim (space-delimited) into a
 * deduplicated list. Blank input → empty list.
 */
export function parseScopeParam(value: string | null | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(/\s+/).filter(Boolean))];
}
