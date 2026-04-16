import type { ReactNode } from 'react';
import { isRouteAllowed, type Role } from '@/lib/auth/permissions';

// ─── RoleGate ────────────────────────────────────────────────────────────────
//
// Inline UI gate that hides (or replaces) `children` when the current user's
// role does not satisfy the gate. Pairs with the middleware route allowlist —
// use this for in-page affordances (buttons, tabs, panels) that a role can
// reach URL-wise but must not SEE.
//
// Prefer `roles` for explicit allowlists. Pass `pathname` to reuse the route
// access map as the single source of truth.

type RoleGateRolesProps = {
  role: Role;
  roles: ReadonlyArray<Role>;
  pathname?: never;
  fallback?: ReactNode;
  children: ReactNode;
};

type RoleGatePathnameProps = {
  role: Role;
  roles?: never;
  pathname: string;
  fallback?: ReactNode;
  children: ReactNode;
};

export type RoleGateProps = RoleGateRolesProps | RoleGatePathnameProps;

const DEFAULT_FALLBACK: ReactNode = (
  <div
    role="alert"
    className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-600"
  >
    You do not have access.
  </div>
);

/**
 * Gate a subtree on the current user's role.
 *
 * Two modes (mutually exclusive):
 *  - `roles={[...]}` — explicit allowlist.
 *  - `pathname="/foo/bar"` — resolve via the shared `ROUTE_ACCESS` map.
 *
 * When the gate fails, `fallback` is rendered (defaults to a neutral
 * "You do not have access" notice). Pass `fallback={null}` to render nothing.
 */
export function RoleGate(props: RoleGateProps) {
  const { role, children, fallback = DEFAULT_FALLBACK } = props;

  const allowed =
    'roles' in props && props.roles
      ? props.roles.includes(role)
      : isRouteAllowed(role, props.pathname);

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}

export default RoleGate;
