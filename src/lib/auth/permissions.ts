// ─── Core Types ──────────────────────────────────────────────────────────────

/**
 * System roles. Aligns with PRD §3.4 — seven role-based dashboards:
 *
 *   super_admin           → SysAdmin dashboard (RBAC, health, integrations)
 *   hr_admin              → HR Administrator dashboard
 *   payroll_admin         → Payroll & Compensation dashboard
 *   supervisor            → Supervisor/Manager dashboard (NEW, replaces leave_approver)
 *   executive             → Executive/Leadership dashboard (NEW — read-only analytics)
 *   auditor               → Compliance & Audit dashboard (NEW — read-everything, write-nothing)
 *   employee_self_service → Employee Self-Service dashboard
 *
 * Legacy roles (`leave_approver`, `viewer`) are kept for backwards compatibility
 * and are auto-mapped to `supervisor` and `auditor` respectively via
 * `effectiveRolesOf()`. Existing DB rows keep working; new accounts use the
 * seven PCSO roles.
 */
export type Role =
  | "super_admin"
  | "hr_admin"
  | "payroll_admin"
  | "supervisor"
  | "executive"
  | "auditor"
  | "employee_self_service"
  // Legacy aliases — still valid in DB, auto-mapped at permission check time.
  | "leave_approver"
  | "viewer";

/**
 * Role aliasing map. When a user carries a legacy role, permission checks
 * behave as if they ALSO held the new equivalent (and vice-versa for aliases).
 *
 * This lets us rename roles without rewriting every permissionMatrix entry:
 * matrix entries still list `'leave_approver'` / `'viewer'`, and a user with
 * role=`supervisor` / `auditor` / `executive` satisfies those checks via the
 * expansion below.
 */
const ROLE_ALIASES: Readonly<Record<Role, readonly Role[]>> = {
  super_admin: ["super_admin"],
  hr_admin: ["hr_admin"],
  payroll_admin: ["payroll_admin"],
  supervisor: ["supervisor", "leave_approver"],
  executive: ["executive", "viewer"],
  auditor: ["auditor", "viewer"],
  employee_self_service: ["employee_self_service"],
  leave_approver: ["leave_approver", "supervisor"],
  viewer: ["viewer", "executive", "auditor"],
};

export function effectiveRolesOf(role: Role): readonly Role[] {
  return ROLE_ALIASES[role] ?? [role];
}

export type Resource =
  | "employees"
  | "plantilla"
  | "attendance"
  | "leave"
  | "learning"
  | "payroll"
  | "remittances"
  | "performance"
  | "saln"
  | "reports"
  | "admin";

export type Action =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "approve"
  | "export"
  | "process";

/**
 * Sentinel that marks an action as self-only for `employee_self_service`.
 * Guards must verify `user.employeeId === record.employeeId` before granting access.
 */
export const SELF_ONLY = "self_only" as const;
export type SelfOnly = typeof SELF_ONLY;

type RoleTuple = readonly Role[];

/**
 * A permission entry is either a plain role list or a role list with a self-only
 * constraint (meaning `employee_self_service` may only see their own records).
 */
export type PermissionEntry =
  | RoleTuple
  | { roles: RoleTuple; selfOnly: SelfOnly };

export type PermissionMatrix = {
  readonly [R in Resource]: {
    readonly [A in Action]: PermissionEntry;
  };
};

// ─── Permission Matrix ───────────────────────────────────────────────────────
//
// Conventions:
//   - List every role that may perform the action.
//   - Use `{ roles: [...], selfOnly: SELF_ONLY }` when `employee_self_service`
//     may only touch their own record (not arbitrary records).
//   - Roles with no access to an action must still be listed as `[]`.
//
// Sources: CLAUDE.md Section 11 + CSC / PCSO HR rules.

export const permissionMatrix: PermissionMatrix = {
  // ── employees ─────────────────────────────────────────────────────────────
  // super_admin/hr_admin/payroll_admin/viewer see ALL employees.
  // employee_self_service sees only their own profile.
  employees: {
    view: {
      roles: [
        "super_admin",
        "hr_admin",
        "payroll_admin",
        "leave_approver",
        "viewer",
        "employee_self_service",
      ],
      selfOnly: SELF_ONLY,
    },
    create: ["super_admin", "hr_admin"],
    edit: ["super_admin", "hr_admin"],
    delete: ["super_admin"], // soft-delete only (CONVENTIONS.md rule 2)
    approve: ["super_admin", "hr_admin"],
    export: ["super_admin", "hr_admin"],
    process: ["super_admin", "hr_admin"],
  },

  // ── plantilla ─────────────────────────────────────────────────────────────
  plantilla: {
    view: ["super_admin", "hr_admin", "leave_approver", "viewer"],
    create: ["super_admin", "hr_admin"],
    edit: ["super_admin", "hr_admin"],
    delete: ["super_admin"],
    approve: ["super_admin"],
    export: ["super_admin", "hr_admin"],
    process: ["super_admin", "hr_admin"],
  },

  // ── attendance ────────────────────────────────────────────────────────────
  attendance: {
    view: {
      roles: [
        "super_admin",
        "hr_admin",
        "leave_approver",
        "viewer",
        "employee_self_service",
      ],
      selfOnly: SELF_ONLY,
    },
    // employee_self_service may clock in/out (self-only). Permission helpers
    // must enforce the self-only constraint at the call site.
    create: {
      roles: ["super_admin", "hr_admin", "employee_self_service"],
      selfOnly: SELF_ONLY,
    },
    edit: ["super_admin", "hr_admin"],
    delete: ["super_admin"],
    approve: ["super_admin", "hr_admin", "leave_approver"],
    export: ["super_admin", "hr_admin"],
    process: ["super_admin", "hr_admin"],
  },

  // ── leave ─────────────────────────────────────────────────────────────────
  // employee_self_service may apply (create) for their own leave.
  leave: {
    view: {
      roles: [
        "super_admin",
        "hr_admin",
        "leave_approver",
        "viewer",
        "employee_self_service",
      ],
      selfOnly: SELF_ONLY,
    },
    create: [
      "super_admin",
      "hr_admin",
      "leave_approver",
      "employee_self_service",
    ],
    edit: ["super_admin", "hr_admin"],
    delete: ["super_admin"],
    approve: ["super_admin", "hr_admin", "leave_approver"],
    export: ["super_admin", "hr_admin"],
    process: ["super_admin", "hr_admin"],
  },

  // ── learning (L&D catalog, providers, schedule, TNA) ─────────────────────
  // Read is broad for dashboard visibility; writes are limited to HR admins.
  learning: {
    view: [
      "super_admin",
      "hr_admin",
      "payroll_admin",
      "leave_approver",
      "viewer",
      "employee_self_service",
    ],
    create: ["super_admin", "hr_admin"],
    edit: ["super_admin", "hr_admin"],
    delete: ["super_admin", "hr_admin"],
    approve: ["super_admin", "hr_admin"],
    export: ["super_admin", "hr_admin", "viewer"],
    process: ["super_admin", "hr_admin"],
  },

  // ── payroll ───────────────────────────────────────────────────────────────
  // Historical payroll is append-only (CONVENTIONS.md rule 3).
  payroll: {
    view: ["super_admin", "payroll_admin"],
    create: ["super_admin", "payroll_admin"],
    edit: ["super_admin", "payroll_admin"],
    delete: ["super_admin"],
    approve: ["super_admin"],
    export: ["super_admin", "payroll_admin"],
    process: ["super_admin", "payroll_admin"],
  },

  // ── remittances ───────────────────────────────────────────────────────────
  remittances: {
    view: ["super_admin", "payroll_admin"],
    create: ["super_admin", "payroll_admin"],
    edit: ["super_admin", "payroll_admin"],
    delete: ["super_admin"],
    approve: ["super_admin"],
    export: ["super_admin", "payroll_admin"],
    process: ["super_admin", "payroll_admin"],
  },

  // ── performance ───────────────────────────────────────────────────────────
  performance: {
    view: {
      roles: [
        "super_admin",
        "hr_admin",
        "leave_approver",
        "viewer",
        "employee_self_service",
      ],
      selfOnly: SELF_ONLY,
    },
    create: ["super_admin", "hr_admin"],
    edit: ["super_admin", "hr_admin"],
    delete: ["super_admin"],
    approve: ["super_admin", "hr_admin"],
    export: ["super_admin", "hr_admin"],
    process: ["super_admin", "hr_admin"],
  },

  // ── saln (Statement of Assets, Liabilities, and Net Worth) ───────────────
  // Highly restricted: super_admin sees all records.
  // employee_self_service may view/file/edit only their own SALN.
  saln: {
    view: {
      roles: ["super_admin", "employee_self_service"],
      selfOnly: SELF_ONLY,
    },
    create: ["super_admin", "employee_self_service"],
    edit: ["super_admin", "employee_self_service"],
    delete: ["super_admin"],
    approve: ["super_admin"],
    export: ["super_admin"],
    process: ["super_admin"],
  },

  // ── reports ───────────────────────────────────────────────────────────────
  reports: {
    view: ["super_admin", "hr_admin", "payroll_admin", "viewer"],
    create: ["super_admin", "hr_admin", "payroll_admin"],
    edit: ["super_admin"],
    delete: ["super_admin"],
    approve: ["super_admin"],
    export: ["super_admin", "hr_admin", "payroll_admin"],
    process: ["super_admin"],
  },

  // ── admin (system config, user management) ────────────────────────────────
  admin: {
    view: ["super_admin"],
    create: ["super_admin"],
    edit: ["super_admin"],
    delete: ["super_admin"],
    approve: ["super_admin"],
    export: ["super_admin"],
    process: ["super_admin"],
  },
} as const;

// ─── Permission Helpers ───────────────────────────────────────────────────────

function resolveEntry(entry: PermissionEntry): RoleTuple {
  if (Array.isArray(entry)) return entry as RoleTuple;
  return (entry as { roles: RoleTuple; selfOnly: SelfOnly }).roles;
}

function hasSelfOnlyConstraint(entry: PermissionEntry): boolean {
  return !Array.isArray(entry) && "selfOnly" in entry;
}

/**
 * Returns true when `role` is listed as permitted for `resource.action`.
 *
 * Low-level predicate used by server guards and the client hook.
 * Does NOT enforce the self-only constraint — callers must separately check
 * `user.employeeId === record.employeeId` when `isSelfOnly()` returns true.
 */
export function hasPermission(
  role: Role,
  resource: Resource,
  action: Action,
): boolean {
  const entry = permissionMatrix[resource][action];
  const roles = resolveEntry(entry) as Role[];
  const effective = effectiveRolesOf(role);
  return effective.some((r) => roles.includes(r));
}

/**
 * Returns true when `resource.action` carries a self-only constraint.
 * Guards must validate record ownership before granting access.
 */
export function isSelfOnly(resource: Resource, action: Action): boolean {
  return hasSelfOnlyConstraint(permissionMatrix[resource][action]);
}

/**
 * Returns all roles permitted to perform `resource.action`.
 */
export function getRolesFor(
  resource: Resource,
  action: Action,
): readonly Role[] {
  return resolveEntry(permissionMatrix[resource][action]);
}

/**
 * Returns true when a role has at least one permitted action on `resource`.
 */
export function canAccess(role: Role, resource: Resource): boolean {
  const resourceEntry = permissionMatrix[resource];
  return (Object.keys(resourceEntry) as Action[]).some((action) =>
    hasPermission(role, resource, action),
  );
}

// ─── Route Access Map ─────────────────────────────────────────────────────────
//
// Explicit role allowlist per URL prefix. Used by middleware AND client
// <RoleGate> components so there is a single source of truth for route-level
// RBAC. Longest-prefix match wins (see `isRouteAllowed`).
//
// NOTE: This is ADDITIVE to the permission matrix. The middleware applies BOTH
// gates — a route is allowed only when BOTH checks pass. This matrix remains
// the canonical permission source of truth; the route map constrains WHICH
// URLs each role may even reach.

type RoleList = ReadonlyArray<Role>;

/**
 * Paths that any authenticated user may access. Never present in ROUTE_ACCESS
 * so they short-circuit the allowlist check.
 */
const ALWAYS_AUTHENTICATED: ReadonlyArray<string> = [
  "/dashboard",
  "/profile",
  "/settings",
  "/org-chart",
];

/**
 * Ordered list of `[pathPrefix, allowedRoles]` tuples. Order does NOT matter
 * for correctness — the resolver picks the LONGEST matching prefix — but more
 * specific entries are grouped with their parents for readability.
 *
 * An entry of `undefined` (key missing) means: no explicit gate; fall through
 * to `ALWAYS_AUTHENTICATED` / permission matrix.
 */
export const ROUTE_ACCESS: Readonly<Record<string, RoleList>> = {
  // ── Admin panel ───────────────────────────────────────────────────────────
  "/admin/audit-logs": ["super_admin", "viewer"],
  "/admin": ["super_admin"],

  // ── Payroll ───────────────────────────────────────────────────────────────
  "/payroll/new": ["super_admin", "payroll_admin"],
  "/payroll/history": ["super_admin", "payroll_admin"],
  "/payroll/process": ["super_admin", "payroll_admin"],
  "/payroll/approve": ["super_admin"],
  "/payroll/remittances": ["super_admin", "payroll_admin"],
  "/payroll/payslips": [
    "super_admin",
    "hr_admin",
    "payroll_admin",
    "leave_approver",
    "supervisor",
    "viewer",
    "executive",
    "auditor",
    "employee_self_service",
  ],
  "/payroll/jo-cos": ["super_admin", "payroll_admin"],
  "/payroll/benefits": ["super_admin", "payroll_admin"],
  "/payroll/cash-advance": ["super_admin", "payroll_admin"],
  "/payroll/differential": ["super_admin", "payroll_admin"],
  "/payroll/loans": ["super_admin", "payroll_admin"],
  "/payroll/rata": ["super_admin", "payroll_admin"],
  "/payroll/special": ["super_admin", "payroll_admin"],
  "/payroll/magna-carta": ["super_admin", "payroll_admin"],
  "/payroll/bank-configs": ["super_admin", "payroll_admin"],
  "/payroll": ["super_admin", "payroll_admin"],

  // ── Remittances ───────────────────────────────────────────────────────────
  "/remittances/gsis/retirement": ["super_admin", "payroll_admin"],
  "/remittances/gsis/new": ["super_admin", "payroll_admin"],
  "/remittances/gsis": ["super_admin", "payroll_admin"],
  "/remittances/philhealth/new": ["super_admin", "payroll_admin"],
  "/remittances/philhealth": ["super_admin", "payroll_admin"],
  "/remittances/pagibig/new": ["super_admin", "payroll_admin"],
  "/remittances/pagibig": ["super_admin", "payroll_admin"],
  "/remittances/bir/1601-c": ["super_admin", "payroll_admin"],
  "/remittances/bir/2316": ["super_admin", "payroll_admin"],
  "/remittances/bir/1604-c": ["super_admin", "payroll_admin"],
  "/remittances/bir": ["super_admin", "payroll_admin"],
  "/remittances": [
    "super_admin",
    "payroll_admin",
    "viewer",
    "executive",
    "auditor",
  ],

  // ── Plantilla ─────────────────────────────────────────────────────────────
  "/plantilla": ["super_admin", "hr_admin", "viewer", "executive", "auditor"],

  // ── SALN ──────────────────────────────────────────────────────────────────
  "/saln/admin": ["super_admin", "hr_admin", "viewer"],
  "/saln": ["super_admin", "hr_admin", "viewer", "employee_self_service"],

  // ── Performance ───────────────────────────────────────────────────────────
  "/performance/cycles": ["super_admin", "hr_admin"],
  "/performance/opcrf": ["super_admin", "hr_admin"],
  "/performance/step-increments": ["super_admin", "hr_admin"],
  "/performance/analytics": ["super_admin", "hr_admin"],
  "/performance/dpcr": [
    "super_admin",
    "hr_admin",
    "hr_staff",
    "leave_approver",
    "supervisor",
    "employee_self_service",
  ],
  "/performance/bpcr": [
    "super_admin",
    "hr_admin",
    "hr_staff",
    "leave_approver",
    "supervisor",
    "employee_self_service",
  ],
  "/performance/ipcrf": [
    "super_admin",
    "hr_admin",
    "leave_approver",
    "supervisor",
    "viewer",
    "executive",
    "auditor",
    "employee_self_service",
  ],
  "/performance": [
    "super_admin",
    "hr_admin",
    "leave_approver",
    "supervisor",
    "viewer",
    "executive",
    "auditor",
    "employee_self_service",
  ],

  // ── Leave ─────────────────────────────────────────────────────────────────
  "/leave/approvals": [
    "super_admin",
    "hr_admin",
    "leave_approver",
    "supervisor",
  ],
  "/leave/approve": ["super_admin", "hr_admin", "leave_approver", "supervisor"],
  // Employee-facing applications list: employees see ONLY their own via
  // `selfOnly` enforcement in queries. Route-level access stays open to
  // authenticated leave-relevant roles.
  "/leave/applications": [
    "super_admin",
    "hr_admin",
    "leave_approver",
    "supervisor",
    "employee_self_service",
  ],
  "/leave/credits/admin": ["super_admin", "hr_admin"],
  "/leave/credits": [
    "super_admin",
    "hr_admin",
    "leave_approver",
    "supervisor",
    "viewer",
    "executive",
    "auditor",
    "employee_self_service",
  ],
  "/leave/apply": [
    "super_admin",
    "hr_admin",
    "leave_approver",
    "employee_self_service",
  ],
  "/leave/calendar": [
    "super_admin",
    "hr_admin",
    "leave_approver",
    "supervisor",
    "viewer",
    "executive",
    "auditor",
    "employee_self_service",
  ],
  "/leave": [
    "super_admin",
    "hr_admin",
    "leave_approver",
    "supervisor",
    "viewer",
    "executive",
    "auditor",
    "employee_self_service",
  ],

  // ── Attendance ────────────────────────────────────────────────────────────
  "/attendance/admin": ["super_admin", "hr_admin"],
  "/attendance/import": ["super_admin", "hr_admin"],
  "/attendance/timesheets": [
    "super_admin",
    "hr_admin",
    "payroll_admin",
    "viewer",
    "executive",
    "auditor",
  ],
  "/attendance/clock": [
    "super_admin",
    "hr_admin",
    "leave_approver",
    "supervisor",
    "employee_self_service",
  ],
  "/attendance/overtime/new": [
    "super_admin",
    "hr_admin",
    "leave_approver",
    "supervisor",
    "viewer",
    "executive",
    "auditor",
    "employee_self_service",
  ],
  "/attendance/overtime": [
    "super_admin",
    "hr_admin",
    "leave_approver",
    "supervisor",
    "viewer",
    "executive",
    "auditor",
    "employee_self_service",
  ],
  "/attendance/dtr": [
    "super_admin",
    "hr_admin",
    "leave_approver",
    "supervisor",
    "viewer",
    "executive",
    "auditor",
    "employee_self_service",
  ],
  "/attendance": [
    "super_admin",
    "hr_admin",
    "leave_approver",
    "supervisor",
    "viewer",
    "executive",
    "auditor",
    "employee_self_service",
  ],

  // ── Employees ─────────────────────────────────────────────────────────────
  "/employees/new": ["super_admin", "hr_admin"],
  "/employees": [
    "super_admin",
    "hr_admin",
    "payroll_admin",
    "leave_approver",
    "viewer",
    "executive",
    "auditor",
    "employee_self_service",
  ],

  // ── Learning & Development ────────────────────────────────────────────────
  "/learning/certificates": [
    "super_admin",
    "hr_admin",
    "hr_staff",
    "employee_self_service",
  ],

  // ── Reports ───────────────────────────────────────────────────────────────
  "/reports": [
    "super_admin",
    "hr_admin",
    "payroll_admin",
    "viewer",
    "executive",
    "auditor",
  ],
} as const;

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

function findLongestPrefix(pathname: string): string | null {
  let best: string | null = null;
  for (const prefix of Object.keys(ROUTE_ACCESS)) {
    if (!matchesPrefix(pathname, prefix)) continue;
    if (best === null || prefix.length > best.length) {
      best = prefix;
    }
  }
  return best;
}

/**
 * Returns true when `role` is permitted to access `pathname`.
 *
 * Resolution:
 *   1. If the path is in `ALWAYS_AUTHENTICATED` (or is a child thereof), allow.
 *   2. Find the longest matching prefix in `ROUTE_ACCESS`.
 *   3. If no prefix matches, allow (defer to the permission matrix in
 *      middleware / server guards).
 *   4. Otherwise, allow iff `role` is in the allowlist.
 *
 * Used by BOTH the Next.js middleware (hard redirect) and the client
 * `<RoleGate>` component (inline UI gating) to keep the allowlist in one place.
 */
export function isRouteAllowed(role: Role, pathname: string): boolean {
  // Always-allowed paths for any authenticated user.
  for (const prefix of ALWAYS_AUTHENTICATED) {
    if (matchesPrefix(pathname, prefix)) return true;
  }

  const prefix = findLongestPrefix(pathname);
  if (prefix === null) return true; // no explicit rule → defer to other gates

  const allowed = ROUTE_ACCESS[prefix];
  if (!allowed) return true;
  const effective = effectiveRolesOf(role);
  return effective.some((r) => (allowed as Role[]).includes(r));
}

/**
 * Exposed for tests / debugging — returns the matched prefix (or null).
 */
export function matchedRoutePrefix(pathname: string): string | null {
  return findLongestPrefix(pathname);
}
