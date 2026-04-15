'use client';

import { useCurrentUser } from '@/hooks/use-current-user';
import {
  hasPermission,
  isSelfOnly,
  canAccess,
  type Resource,
  type Action,
  type Role,
} from '@/lib/auth/permissions';

export interface UsePermissionsResult {
  /** The current user's role, or null while loading / unauthenticated. */
  role: Role | null;
  /**
   * Returns true when the current user may perform `action` on `resource`.
   *
   * Does NOT enforce the self-only constraint — callers must separately
   * hide/disable UI elements that require ownership when `checkSelfOnly` is true.
   */
  can: (resource: Resource, action: Action) => boolean;
  /**
   * Returns true when the `resource.action` pair carries a self-only constraint.
   * Use this to decide whether to additionally pass an ownership check.
   */
  checkSelfOnly: (resource: Resource, action: Action) => boolean;
  /**
   * Returns true when the current user has at least one permitted action on
   * `resource`. Useful for conditionally rendering whole sections.
   */
  canAccessResource: (resource: Resource) => boolean;
  /** True while the auth session is being resolved. */
  isLoading: boolean;
}

/**
 * Client-side hook for RBAC permission checks.
 *
 * Combines `useCurrentUser()` with the static `permissionMatrix` so that
 * components can gate rendering without making an extra network request.
 *
 * @example
 * ```tsx
 * const { can } = usePermissions();
 *
 * if (!can('payroll', 'view')) return null;
 * ```
 */
export function usePermissions(): UsePermissionsResult {
  const result = useCurrentUser();

  const role: Role | null = result.status === 'authenticated' ? result.user.role : null;
  const isLoading = result.status === 'loading';

  function can(resource: Resource, action: Action): boolean {
    if (!role) return false;
    return hasPermission(role, resource, action);
  }

  function checkSelfOnly(resource: Resource, action: Action): boolean {
    return isSelfOnly(resource, action);
  }

  function canAccessResource(resource: Resource): boolean {
    if (!role) return false;
    return canAccess(role, resource);
  }

  return { role, can, checkSelfOnly, canAccessResource, isLoading };
}
