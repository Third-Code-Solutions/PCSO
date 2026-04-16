// ─── Core Types ──────────────────────────────────────────────────────────────

export type Role =
  | 'super_admin'
  | 'hr_admin'
  | 'payroll_admin'
  | 'leave_approver'
  | 'viewer'
  | 'employee_self_service';

export type Resource =
  | 'employees'
  | 'plantilla'
  | 'attendance'
  | 'leave'
  | 'payroll'
  | 'remittances'
  | 'performance'
  | 'saln'
  | 'reports'
  | 'admin';

export type Action = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export' | 'process';

/**
 * Sentinel that marks an action as self-only for `employee_self_service`.
 * Guards must verify `user.employeeId === record.employeeId` before granting access.
 */
export const SELF_ONLY = 'self_only' as const;
export type SelfOnly = typeof SELF_ONLY;

type RoleTuple = readonly Role[];

/**
 * A permission entry is either a plain role list or a role list with a self-only
 * constraint (meaning `employee_self_service` may only see their own records).
 */
export type PermissionEntry = RoleTuple | { roles: RoleTuple; selfOnly: SelfOnly };

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
// Sources: Plan.md Phase 03 + CSC / Senate HR rules.

export const permissionMatrix: PermissionMatrix = {
  // ── employees ─────────────────────────────────────────────────────────────
  // super_admin/hr_admin/payroll_admin/viewer see ALL employees.
  // employee_self_service sees only their own profile.
  employees: {
    view: {
      roles: ['super_admin', 'hr_admin', 'payroll_admin', 'viewer', 'employee_self_service'],
      selfOnly: SELF_ONLY,
    },
    create: ['super_admin', 'hr_admin'],
    edit: ['super_admin', 'hr_admin'],
    delete: ['super_admin'], // soft-delete only (CONVENTIONS.md rule 2)
    approve: ['super_admin', 'hr_admin'],
    export: ['super_admin', 'hr_admin'],
    process: ['super_admin', 'hr_admin'],
  },

  // ── plantilla ─────────────────────────────────────────────────────────────
  plantilla: {
    view: ['super_admin', 'hr_admin', 'viewer'],
    create: ['super_admin', 'hr_admin'],
    edit: ['super_admin', 'hr_admin'],
    delete: ['super_admin'],
    approve: ['super_admin'],
    export: ['super_admin', 'hr_admin'],
    process: ['super_admin', 'hr_admin'],
  },

  // ── attendance ────────────────────────────────────────────────────────────
  attendance: {
    view: {
      roles: ['super_admin', 'hr_admin', 'leave_approver', 'viewer', 'employee_self_service'],
      selfOnly: SELF_ONLY,
    },
    // employee_self_service may clock in/out (self-only). Permission helpers
    // must enforce the self-only constraint at the call site.
    create: {
      roles: ['super_admin', 'hr_admin', 'employee_self_service'],
      selfOnly: SELF_ONLY,
    },
    edit: ['super_admin', 'hr_admin'],
    delete: ['super_admin'],
    approve: ['super_admin', 'hr_admin', 'leave_approver'],
    export: ['super_admin', 'hr_admin'],
    process: ['super_admin', 'hr_admin'],
  },

  // ── leave ─────────────────────────────────────────────────────────────────
  // employee_self_service may apply (create) for their own leave.
  leave: {
    view: {
      roles: ['super_admin', 'hr_admin', 'leave_approver', 'viewer', 'employee_self_service'],
      selfOnly: SELF_ONLY,
    },
    create: ['super_admin', 'hr_admin', 'employee_self_service'],
    edit: ['super_admin', 'hr_admin'],
    delete: ['super_admin'],
    approve: ['super_admin', 'hr_admin', 'leave_approver'],
    export: ['super_admin', 'hr_admin'],
    process: ['super_admin', 'hr_admin'],
  },

  // ── payroll ───────────────────────────────────────────────────────────────
  // Historical payroll is append-only (CONVENTIONS.md rule 3).
  payroll: {
    view: ['super_admin', 'payroll_admin'],
    create: ['super_admin', 'payroll_admin'],
    edit: ['super_admin', 'payroll_admin'],
    delete: ['super_admin'],
    approve: ['super_admin'],
    export: ['super_admin', 'payroll_admin'],
    process: ['super_admin', 'payroll_admin'],
  },

  // ── remittances ───────────────────────────────────────────────────────────
  remittances: {
    view: ['super_admin', 'payroll_admin'],
    create: ['super_admin', 'payroll_admin'],
    edit: ['super_admin', 'payroll_admin'],
    delete: ['super_admin'],
    approve: ['super_admin'],
    export: ['super_admin', 'payroll_admin'],
    process: ['super_admin', 'payroll_admin'],
  },

  // ── performance ───────────────────────────────────────────────────────────
  performance: {
    view: {
      roles: ['super_admin', 'hr_admin', 'leave_approver', 'viewer', 'employee_self_service'],
      selfOnly: SELF_ONLY,
    },
    create: ['super_admin', 'hr_admin'],
    edit: ['super_admin', 'hr_admin'],
    delete: ['super_admin'],
    approve: ['super_admin', 'hr_admin'],
    export: ['super_admin', 'hr_admin'],
    process: ['super_admin', 'hr_admin'],
  },

  // ── saln (Statement of Assets, Liabilities, and Net Worth) ───────────────
  // Highly restricted: super_admin sees all records.
  // employee_self_service may view/file/edit only their own SALN.
  saln: {
    view: {
      roles: ['super_admin', 'employee_self_service'],
      selfOnly: SELF_ONLY,
    },
    create: ['super_admin', 'employee_self_service'],
    edit: ['super_admin', 'employee_self_service'],
    delete: ['super_admin'],
    approve: ['super_admin'],
    export: ['super_admin'],
    process: ['super_admin'],
  },

  // ── reports ───────────────────────────────────────────────────────────────
  reports: {
    view: ['super_admin', 'hr_admin', 'payroll_admin', 'viewer'],
    create: ['super_admin', 'hr_admin', 'payroll_admin'],
    edit: ['super_admin'],
    delete: ['super_admin'],
    approve: ['super_admin'],
    export: ['super_admin', 'hr_admin', 'payroll_admin'],
    process: ['super_admin'],
  },

  // ── admin (system config, user management) ────────────────────────────────
  admin: {
    view: ['super_admin'],
    create: ['super_admin'],
    edit: ['super_admin'],
    delete: ['super_admin'],
    approve: ['super_admin'],
    export: ['super_admin'],
    process: ['super_admin'],
  },
} as const;

// ─── Permission Helpers ───────────────────────────────────────────────────────

function resolveEntry(entry: PermissionEntry): RoleTuple {
  if (Array.isArray(entry)) return entry as RoleTuple;
  return (entry as { roles: RoleTuple; selfOnly: SelfOnly }).roles;
}

function hasSelfOnlyConstraint(entry: PermissionEntry): boolean {
  return !Array.isArray(entry) && 'selfOnly' in entry;
}

/**
 * Returns true when `role` is listed as permitted for `resource.action`.
 *
 * Low-level predicate used by server guards and the client hook.
 * Does NOT enforce the self-only constraint — callers must separately check
 * `user.employeeId === record.employeeId` when `isSelfOnly()` returns true.
 */
export function hasPermission(role: Role, resource: Resource, action: Action): boolean {
  const entry = permissionMatrix[resource][action];
  const roles = resolveEntry(entry);
  return (roles as Role[]).includes(role);
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
export function getRolesFor(resource: Resource, action: Action): readonly Role[] {
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
