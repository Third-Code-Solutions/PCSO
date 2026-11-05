import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/get-current-user";
import {
  hasPermission,
  type Resource,
  type Action,
} from "@/lib/auth/permissions";
import { getAalStatus, isMfaEnforcedRole } from "@/lib/auth/mfa";

// ─── Request-scoped user cache ───────────────────────────────────────────────
//
// `React.cache` dedupes calls WITHIN a single request (server-rendered tree or
// single server-action invocation). Across requests the cache is independent,
// so each HTTP request resolves a fresh Supabase session — we never leak a
// stale `user` object between users.
const getCurrentUserCached = cache(getCurrentUser);

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Best-effort recovery of the current request pathname. The Next.js
 * `headers()` helper exposes `x-invoke-path` (app router) or falls back to
 * the URL referer. Used purely for the `?path=` query hint on the
 * unauthorized redirect — never trusted for security.
 */
async function getCurrentPathname(): Promise<string> {
  try {
    const h = await headers();
    const invoked = h.get("x-invoke-path") ?? h.get("x-pathname");
    if (invoked) return invoked;
    const referer = h.get("referer");
    if (referer) {
      try {
        return new URL(referer).pathname;
      } catch {
        // ignore malformed referer
      }
    }
  } catch {
    // headers() throws outside a request context — fall through.
  }
  return "/";
}

function buildUnauthorizedUrl(pathname: string): string {
  const params = new URLSearchParams({ unauthorized: "1", path: pathname });
  return `/login?${params.toString()}`;
}

// ─── requireAuth ─────────────────────────────────────────────────────────────

/**
 * Asserts that a valid session exists.
 *
 * 307-redirects to `/login` when unauthenticated (via `next/navigation`
 * `redirect()` — it throws a `NEXT_REDIRECT` marker that the framework
 * converts into a redirect response, which the caller does not need to
 * handle).
 *
 * Returns the current user when authenticated. MFA-enforced roles on an aal1
 * session are redirected to the TOTP challenge or enrollment first.
 *
 * Use at the top of Server Components or Server Actions that require login.
 *
 * Concurrency: session is resolved FRESH on every request. `React.cache`
 * only dedupes calls within the same request scope, never across requests.
 */
export async function requireAuth(
  options: { allowAal1?: boolean } = {},
): Promise<CurrentUser> {
  const user = await getCurrentUserCached();
  if (!user) redirect("/login");

  // SEC-003 / TOR 3.2.6 (H-01): super_admin and hr_admin need an aal2 session
  // on every guarded page and action, not only requirePermission ones.
  // Enrolled accounts go to the TOTP challenge; accounts without a factor go
  // to self-service enrollment. Only the enrollment page and its actions pass
  // `allowAal1` (they are how an aal1 session reaches aal2 — no loop).
  // Fails closed: an unreadable assurance level is treated as aal1.
  if (!options.allowAal1 && isMfaEnforcedRole(user.role)) {
    const aal = await getAalStatus();
    if (aal.currentLevel !== "aal2") {
      redirect(
        aal.hasVerifiedTotpFactor
          ? "/login/mfa"
          : "/settings/security?mfa=required",
      );
    }
  }

  return user;
}

// ─── requirePermission ────────────────────────────────────────────────────────

/**
 * Asserts that the current user has the specified permission.
 *
 * 307-redirects to `/login?unauthorized=1&path=${pathname}` when the user is
 * authenticated but lacks the permission. 307-redirects to `/login` when
 * unauthenticated. NEVER THROWS — middleware / Next.js handles the redirect
 * marker internally, and a friendly unauthorized UI page is rendered from
 * the login route using the `unauthorized` + `path` query params.
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
  // requireAuth enforces aal2 for MFA-enforced roles (H-01).
  const user = await requireAuth();

  if (!hasPermission(user.role, resource, action)) {
    const pathname = await getCurrentPathname();
    redirect(buildUnauthorizedUrl(pathname));
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
