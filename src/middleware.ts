import { NextResponse, type NextRequest } from 'next/server';
import { refreshSession } from '@/lib/supabase/middleware';
import {
  hasPermission,
  isRouteAllowed,
  type Role,
  type Resource,
  type Action,
} from '@/lib/auth/permissions';

// ─── Public paths (no auth required) ─────────────────────────────────────────

const PUBLIC_PATHS = ['/login', '/forgot-password', '/reset-password'] as const;

const PUBLIC_PREFIXES = ['/api/auth/'] as const;

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) return true;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return false;
}

// ─── Route → required permission mapping ─────────────────────────────────────

interface RoutePermission {
  resource: Resource;
  action: Action;
}

interface RouteRule {
  prefix: string;
  /**
   * `null`           → any authenticated user (no permission check).
   * `RoutePermission` → must pass `hasPermission(role, resource, action)`.
   */
  permission: RoutePermission | null;
  /**
   * Optional explicit role allowlist. When provided, the role MUST be in this
   * list IN ADDITION TO satisfying `permission` (if set). Used to tighten
   * routes where the permission matrix is too permissive for a specific page.
   */
  roles?: ReadonlyArray<Role>;
  /**
   * When true, match only an EXACT path (not a prefix). Used for base routes
   * that must not swallow more-specific children (e.g., `/attendance/overtime`
   * vs `/attendance/overtime/new`).
   */
  exact?: boolean;
}

/**
 * Ordered list of route prefix → permission rules. FIRST MATCH WINS.
 *
 * Order matters: put more-specific entries before their parent prefix.
 * Example: `/leave/approvals` must appear before `/leave`.
 */
const ROUTE_PERMISSIONS: ReadonlyArray<RouteRule> = [
  // ── Admin panel — super_admin only ─────────────────────────────────────────
  { prefix: '/admin', permission: { resource: 'admin', action: 'view' } },

  // ── Cross-cutting: public org chart (any authenticated user) ──────────────
  { prefix: '/org-chart', permission: null },

  // ── Payroll ────────────────────────────────────────────────────────────────
  // Specific children first — new/history/process/approve/remittances/payslips.
  { prefix: '/payroll/new', permission: { resource: 'payroll', action: 'create' } },
  {
    prefix: '/payroll/history',
    permission: { resource: 'payroll', action: 'view' },
    roles: ['super_admin', 'payroll_admin', 'hr_admin'],
  },
  { prefix: '/payroll/process', permission: { resource: 'payroll', action: 'process' } },
  { prefix: '/payroll/approve', permission: { resource: 'payroll', action: 'approve' } },
  { prefix: '/payroll/remittances', permission: { resource: 'remittances', action: 'view' } },
  // Self-service payslips — any authenticated employee; page/query scopes records.
  { prefix: '/payroll/payslips', permission: null },
  { prefix: '/payroll', permission: { resource: 'payroll', action: 'view' } },

  // ── Remittances (top-level) ────────────────────────────────────────────────
  { prefix: '/remittances', permission: { resource: 'remittances', action: 'view' } },

  // ── Leave management ──────────────────────────────────────────────────────
  // Specific children first.
  { prefix: '/leave/approvals', permission: { resource: 'leave', action: 'approve' } },
  { prefix: '/leave/approve', permission: { resource: 'leave', action: 'approve' } },
  { prefix: '/leave/credits/admin', permission: { resource: 'leave', action: 'edit' } },
  // Employee-facing applications list — view required; page scopes to own records.
  { prefix: '/leave/applications', permission: { resource: 'leave', action: 'view' } },
  { prefix: '/leave', permission: { resource: 'leave', action: 'view' } },

  // ── Attendance ─────────────────────────────────────────────────────────────
  { prefix: '/attendance/admin', permission: { resource: 'attendance', action: 'edit' } },
  { prefix: '/attendance/timesheets', permission: { resource: 'attendance', action: 'approve' } },
  { prefix: '/attendance/import', permission: { resource: 'attendance', action: 'edit' } },
  // Overtime: /new is any-auth (employees file), base is view-only.
  { prefix: '/attendance/overtime/new', permission: null },
  { prefix: '/attendance/overtime', permission: { resource: 'attendance', action: 'view' } },
  { prefix: '/attendance', permission: { resource: 'attendance', action: 'view' } },

  // ── Employees ──────────────────────────────────────────────────────────────
  { prefix: '/employees/new', permission: { resource: 'employees', action: 'create' } },
  { prefix: '/employees', permission: { resource: 'employees', action: 'view' } },

  // ── Plantilla ──────────────────────────────────────────────────────────────
  { prefix: '/plantilla', permission: { resource: 'plantilla', action: 'view' } },

  // ── Performance ────────────────────────────────────────────────────────────
  { prefix: '/performance', permission: { resource: 'performance', action: 'view' } },

  // ── SALN ───────────────────────────────────────────────────────────────────
  { prefix: '/saln/admin', permission: { resource: 'saln', action: 'approve' } },
  // Submissions/tracking: view required; page scopes to self for employees.
  { prefix: '/saln/submissions', permission: { resource: 'saln', action: 'view' } },
  { prefix: '/saln/tracking', permission: { resource: 'saln', action: 'view' } },
  { prefix: '/saln', permission: { resource: 'saln', action: 'view' } },

  // ── Reports ────────────────────────────────────────────────────────────────
  { prefix: '/reports', permission: { resource: 'reports', action: 'view' } },
];

function matchRule(pathname: string, rule: RouteRule): boolean {
  if (rule.exact) return pathname === rule.prefix;
  return pathname === rule.prefix || pathname.startsWith(rule.prefix + '/');
}

function getMatchingRule(pathname: string): RouteRule | null {
  for (const rule of ROUTE_PERMISSIONS) {
    if (matchRule(pathname, rule)) return rule;
  }
  return null;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Refresh session cookies and obtain the validated user.
  const { response, user } = await refreshSession(request);

  // 2. Allow all public paths without further checks.
  if (isPublicPath(pathname)) {
    // Authenticated users visiting /login are redirected to the dashboard.
    if (user && (pathname === '/login' || pathname.startsWith('/login/'))) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  // 3. Unauthenticated access to a protected path → redirect to /login.
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Retrieve the role stored in user metadata (set by the signup trigger).
  const role = (user.user_metadata?.['role'] as Role | undefined) ?? 'employee_self_service';

  // 5. Route-level ROLE allowlist (hard gate — single source of truth lives
  //    in `ROUTE_ACCESS` inside `permissions.ts`). This runs BEFORE the
  //    permission-matrix check so that e.g. a payroll_admin hitting /admin/users
  //    is redirected to /dashboard rather than bounced to /login.
  if (!isRouteAllowed(role, pathname)) {
    return redirectForbidden(request);
  }

  // 6. Permission-matrix check (legacy `ROUTE_PERMISSIONS`).
  const rule = getMatchingRule(pathname);
  if (rule) {
    // 6a. Permission matrix check (if any).
    if (rule.permission) {
      const allowed = hasPermission(role, rule.permission.resource, rule.permission.action);
      if (!allowed) {
        return redirectUnauthorized(request, pathname);
      }
    }

    // 6b. Explicit role allowlist check (if any).
    if (rule.roles && !rule.roles.includes(role)) {
      return redirectUnauthorized(request, pathname);
    }
  }

  return response;
}

/**
 * Send users who are authenticated but lack access to a specific route back
 * to `/dashboard` with `?error=forbidden`. Dashboard is always reachable by
 * any authenticated role (see `ALWAYS_AUTHENTICATED` in `permissions.ts`).
 */
function redirectForbidden(request: NextRequest): NextResponse {
  const url = new URL('/dashboard', request.url);
  url.searchParams.set('error', 'forbidden');
  return NextResponse.redirect(url, 307);
}

function redirectUnauthorized(request: NextRequest, pathname: string): NextResponse {
  // Send users to /login with a descriptive query. A UI surface on the login
  // page should read `unauthorized=1` and show a friendly "no access" notice.
  const url = new URL('/login', request.url);
  url.searchParams.set('unauthorized', '1');
  url.searchParams.set('path', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static  (Next.js static assets)
     * - _next/image   (Next.js image optimisation)
     * - favicon.ico
     * - Public file extensions served from /public
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
