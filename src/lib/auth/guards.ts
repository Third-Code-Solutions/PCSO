import { redirect } from 'next/navigation';
import { getCurrentUser, type CurrentUser } from '@/lib/auth/get-current-user';
import { hasPermission, type Resource, type Action } from '@/lib/auth/permissions';

// ─── requireAuth ─────────────────────────────────────────────────────────────

/**
 * Asserts that a valid session exists.
 *
 * Redirects to `/login` when unauthenticated.
 * Returns the current user when authenticated.
 *
 * Use at the top of Server Components or Server Actions that require login.
 */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

// ─── requirePermission ────────────────────────────────────────────────────────

/**
 * Asserts that the current user has the specified permission.
 *
 * Redirects to `/login` when unauthenticated.
 * Throws a 403 error object when the user lacks the permission.
 *
 * @param resource - The resource being accessed.
 * @param action   - The action being performed.
 * @returns The authenticated user.
 *
 * @example
 * ```ts
 * // In a Server Action:
 * const user = await requirePermission('payroll', 'process');
 * ```
 */
export async function requirePermission(
  resource: Resource,
  action: Action,
): Promise<CurrentUser> {
  const user = await requireAuth();

  if (!hasPermission(user.role, resource, action)) {
    // Throw a plain object so callers can distinguish a 403 from other errors.
    throw Object.assign(new Error(`Forbidden: ${resource}.${action}`), { status: 403 });
  }

  return user;
}

// ─── withPermission HOF ───────────────────────────────────────────────────────

type AsyncHandler<TArgs extends unknown[], TReturn> = (
  user: CurrentUser,
  ...args: TArgs
) => Promise<TReturn>;

/**
 * Higher-order function that wraps a server action or API handler with
 * permission enforcement.
 *
 * The wrapped function receives the authenticated `CurrentUser` as its first
 * argument, followed by the original arguments.
 *
 * @param resource  - The resource being accessed.
 * @param action    - The action being performed.
 * @param handler   - The function to execute when permission is granted.
 * @returns A new async function with the same signature as `handler` minus the
 *          `user` first argument.
 *
 * @example
 * ```ts
 * export const createEmployee = withPermission(
 *   'employees',
 *   'create',
 *   async (user, input: unknown) => {
 *     const parsed = EmployeeSchema.parse(input);
 *     // ...
 *   },
 * );
 * ```
 */
export function withPermission<TArgs extends unknown[], TReturn>(
  resource: Resource,
  action: Action,
  handler: AsyncHandler<TArgs, TReturn>,
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const user = await requirePermission(resource, action);
    return handler(user, ...args);
  };
}
