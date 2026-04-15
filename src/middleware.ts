import { NextResponse, type NextRequest } from 'next/server';
import { refreshSession } from '@/lib/supabase/middleware';
import { hasPermission, type Role, type Resource, type Action } from '@/lib/auth/permissions';

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

/**
 * Ordered list of route prefix → required permission pairs.
 * The FIRST matching entry wins.
 *
 * Prefixes are matched with `pathname.startsWith(prefix)`.
 */
const ROUTE_PERMISSIONS: ReadonlyArray<{ prefix: string; permission: RoutePermission | null }> = [
  // Admin panel — super_admin only
  { prefix: '/admin', permission: { resource: 'admin', action: 'view' } },

  // Payroll processing — payroll_admin or super_admin
  { prefix: '/payroll/process', permission: { resource: 'payroll', action: 'process' } },
  { prefix: '/payroll/approve', permission: { resource: 'payroll', action: 'approve' } },
  { prefix: '/payroll/remittances', permission: { resource: 'remittances', action: 'view' } },
  // Self-service payslips — any authenticated employee; query scopes to own records
  { prefix: '/payroll/payslips', permission: null },
  { prefix: '/payroll', permission: { resource: 'payroll', action: 'view' } },

  // Remittances (top-level)
  { prefix: '/remittances', permission: { resource: 'remittances', action: 'view' } },

  // Leave management
  { prefix: '/leave/approve', permission: { resource: 'leave', action: 'approve' } },
  { prefix: '/leave', permission: { resource: 'leave', action: 'view' } },

  // Employees
  { prefix: '/employees/new', permission: { resource: 'employees', action: 'create' } },
  { prefix: '/employees', permission: { resource: 'employees', action: 'view' } },

  // Plantilla
  { prefix: '/plantilla', permission: { resource: 'plantilla', action: 'view' } },

  // Attendance
  { prefix: '/attendance', permission: { resource: 'attendance', action: 'view' } },

  // Performance
  { prefix: '/performance', permission: { resource: 'performance', action: 'view' } },

  // SALN — highly restricted
  { prefix: '/saln', permission: { resource: 'saln', action: 'view' } },

  // Reports
  { prefix: '/reports', permission: { resource: 'reports', action: 'view' } },
];

function getRequiredPermission(pathname: string): RoutePermission | null {
  for (const { prefix, permission } of ROUTE_PERMISSIONS) {
    if (pathname === prefix || pathname.startsWith(prefix + '/') || pathname.startsWith(prefix)) {
      return permission;
    }
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

  // 5. Check route-level RBAC permissions.
  const requiredPermission = getRequiredPermission(pathname);
  if (requiredPermission) {
    const allowed = hasPermission(role, requiredPermission.resource, requiredPermission.action);
    if (!allowed) {
      // Redirect to dashboard with a descriptive error rather than a raw 403
      // so the user sees a friendly message instead of a blank screen.
      const forbiddenUrl = new URL('/dashboard', request.url);
      forbiddenUrl.searchParams.set('error', 'forbidden');
      return NextResponse.redirect(forbiddenUrl);
    }
  }

  return response;
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
