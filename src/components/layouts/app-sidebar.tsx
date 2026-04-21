"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Clock,
  Palmtree,
  Wallet,
  Building2,
  TrendingUp,
  FileText,
  Settings,
  Shield,
  User as UserIcon,
  Network,
  UserPlus,
  GraduationCap,
  Award,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  type Role,
  type Resource,
  type Action,
  hasPermission,
  effectiveRolesOf,
} from "@/lib/auth/permissions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

// ─── Nav tree types ──────────────────────────────────────────────────────────

/**
 * Permission gate for a nav item. A child or leaf is visible when:
 *   - `permission` (resource+action) is granted for the role, AND/OR
 *   - `roles` allowlist includes the role (if provided), AND
 *   - `selfOnly` is false OR the user has an `employeeId`.
 *
 * If a child declares both `permission` and `roles`, the role must satisfy
 * at least one of them (permissive OR). This lets us union permission-driven
 * admin links with role-explicit self-service links inside a single group.
 */
interface NavGate {
  permission?: { resource: Resource; action: Action };
  roles?: readonly Role[];
  /** If true, the link is hidden unless `user.employeeId` is non-null. */
  selfOnly?: boolean;
}

interface NavChild extends NavGate {
  label: string;
  href: string;
}

interface NavItem extends NavGate {
  label: string;
  href?: string;
  icon: React.ElementType;
  children?: NavChild[];
}

// ─── Role groupings (convenience constants) ──────────────────────────────────

const ALL_ROLES: readonly Role[] = [
  "super_admin",
  "hr_admin",
  "payroll_admin",
  "leave_approver",
  "viewer",
  "employee_self_service",
] as const;

// ─── Nav tree definition ─────────────────────────────────────────────────────
//
// Visibility is controlled by an explicit `roles: Role[]` allowlist on every
// leaf and group. A group is rendered only when at least one child is visible
// for the current role (see `isItemVisible` / `canSeeItem`).
//
// Per-role spec (enforced below):
//   - super_admin:           sees everything
//   - hr_admin:              no payroll, no remittances, no /admin/*, no /saln/*
//   - payroll_admin:         no plantilla, leave, performance, saln, admin;
//                            employees read-only (no /employees/new), and no
//                            attendance admin/timesheets/import/clock/overtime
//   - leave_approver:        narrow — leave + own attendance + self IPCRF
//   - employee_self_service: strictly self-service surfaces
//   - viewer:                read-only HR, included on view-only surfaces

const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: Home,
    roles: ALL_ROLES,
  },

  // ── Employees / Plantilla / Org ───────────────────────────────────────────
  {
    label: "Employees",
    icon: Users,
    roles: [
      "super_admin",
      "hr_admin",
      "payroll_admin",
      "leave_approver",
      "viewer",
    ],
    children: [
      {
        label: "Employee Records",
        href: "/employees",
        roles: [
          "super_admin",
          "hr_admin",
          "payroll_admin",
          "leave_approver",
          "viewer",
        ],
      },
      {
        label: "New Employee",
        href: "/employees/new",
        roles: ["super_admin", "hr_admin"],
      },
      {
        label: "Plantilla",
        href: "/plantilla",
        roles: ["super_admin", "hr_admin", "viewer"],
      },
      {
        label: "New Position",
        href: "/plantilla/new",
        roles: ["super_admin", "hr_admin"],
      },
      {
        label: "Vacancies",
        href: "/plantilla/vacancies",
        roles: ["super_admin", "hr_admin", "viewer"],
      },
      {
        label: "Org Chart",
        href: "/org-chart",
        roles: [
          "super_admin",
          "hr_admin",
          "payroll_admin",
          "leave_approver",
          "viewer",
        ],
      },
    ],
  },

  // ── Time & Attendance ─────────────────────────────────────────────────────
  {
    label: "Time & Attendance",
    icon: Clock,
    roles: [
      "super_admin",
      "hr_admin",
      "payroll_admin",
      "leave_approver",
      "viewer",
      "employee_self_service",
    ],
    children: [
      {
        label: "Overview",
        href: "/attendance",
        roles: [
          "super_admin",
          "hr_admin",
          "payroll_admin",
          "leave_approver",
          "viewer",
        ],
      },
      {
        label: "Admin Grid",
        href: "/attendance/admin",
        roles: ["super_admin", "hr_admin"],
      },
      {
        label: "DTR",
        href: "/attendance/dtr",
        // Admins/approvers see team DTR; self-service & payroll_admin see own
        roles: [
          "super_admin",
          "hr_admin",
          "payroll_admin",
          "leave_approver",
          "viewer",
          "employee_self_service",
        ],
      },
      {
        label: "Timesheets",
        href: "/attendance/timesheets",
        roles: ["super_admin", "hr_admin"],
      },
      {
        label: "Overtime Approvals",
        href: "/attendance/overtime",
        roles: ["super_admin", "hr_admin"],
      },
      {
        label: "Import Biometric",
        href: "/attendance/import",
        roles: ["super_admin", "hr_admin"],
      },
      // Self-service surfaces
      {
        label: "Clock In / Out",
        href: "/attendance/clock",
        roles: ["super_admin", "hr_admin", "employee_self_service"],
        selfOnly: true,
      },
      {
        label: "File Overtime",
        href: "/attendance/overtime/new",
        roles: ["super_admin", "hr_admin", "employee_self_service"],
        selfOnly: true,
      },
    ],
  },

  // ── Leave Management ──────────────────────────────────────────────────────
  {
    label: "Leave Management",
    icon: Palmtree,
    roles: [
      "super_admin",
      "hr_admin",
      "leave_approver",
      "viewer",
      "employee_self_service",
    ],
    children: [
      {
        label: "Applications",
        href: "/leave/applications",
        roles: ["super_admin", "hr_admin", "leave_approver", "viewer"],
      },
      {
        label: "Approvals Queue",
        href: "/leave/approvals",
        roles: ["super_admin", "hr_admin", "leave_approver"],
      },
      {
        label: "Credits (Admin)",
        href: "/leave/credits/admin",
        roles: ["super_admin", "hr_admin"],
      },
      {
        label: "Calendar",
        href: "/leave/calendar",
        roles: [
          "super_admin",
          "hr_admin",
          "leave_approver",
          "viewer",
          "employee_self_service",
        ],
      },
      // Self-service
      {
        label: "Apply for Leave",
        href: "/leave/apply",
        roles: [
          "super_admin",
          "hr_admin",
          "leave_approver",
          "employee_self_service",
        ],
        selfOnly: true,
      },
      {
        label: "My Credits",
        href: "/leave/credits",
        roles: [
          "super_admin",
          "hr_admin",
          "leave_approver",
          "employee_self_service",
        ],
        selfOnly: true,
      },
    ],
  },

  // ── Payroll ───────────────────────────────────────────────────────────────
  {
    label: "Payroll",
    icon: Wallet,
    roles: ["super_admin", "payroll_admin", "viewer", "employee_self_service"],
    children: [
      {
        label: "Payroll Periods",
        href: "/payroll",
        roles: ["super_admin", "payroll_admin"],
      },
      {
        label: "New Period",
        href: "/payroll/new",
        roles: ["super_admin", "payroll_admin"],
      },
      {
        label: "Payslips (Admin)",
        href: "/payroll/payslips",
        roles: ["super_admin", "payroll_admin"],
      },
      {
        label: "History",
        href: "/payroll/history",
        roles: ["super_admin", "payroll_admin", "viewer"],
      },
      {
        label: "JO / COS",
        href: "/payroll/jo-cos",
        roles: ["super_admin", "payroll_admin"],
      },
      {
        label: "My Payslips",
        href: "/payroll/payslips",
        roles: ["super_admin", "employee_self_service"],
        selfOnly: true,
      },
    ],
  },

  // ── Remittances ───────────────────────────────────────────────────────────
  {
    label: "Remittances",
    icon: Building2,
    roles: ["super_admin", "payroll_admin", "viewer"],
    children: [
      {
        label: "GSIS",
        href: "/remittances/gsis",
        roles: ["super_admin", "payroll_admin", "viewer"],
      },
      {
        label: "PhilHealth",
        href: "/remittances/philhealth",
        roles: ["super_admin", "payroll_admin", "viewer"],
      },
      {
        label: "Pag-IBIG",
        href: "/remittances/pagibig",
        roles: ["super_admin", "payroll_admin", "viewer"],
      },
      {
        label: "BIR",
        href: "/remittances/bir",
        roles: ["super_admin", "payroll_admin", "viewer"],
      },
      {
        label: "BIR 1601-C",
        href: "/remittances/bir/1601-c",
        roles: ["super_admin", "payroll_admin"],
      },
      {
        label: "BIR 2316",
        href: "/remittances/bir/2316",
        roles: ["super_admin", "payroll_admin"],
      },
      {
        label: "BIR 1604-C",
        href: "/remittances/bir/1604-c",
        roles: ["super_admin", "payroll_admin"],
      },
    ],
  },

  // ── Performance ───────────────────────────────────────────────────────────
  {
    label: "Performance",
    icon: TrendingUp,
    roles: [
      "super_admin",
      "hr_admin",
      "leave_approver",
      "viewer",
      "employee_self_service",
    ],
    children: [
      {
        label: "Cycles",
        href: "/performance/cycles",
        roles: ["super_admin", "hr_admin"],
      },
      {
        label: "IPCRF",
        href: "/performance/ipcrf",
        // Admins & viewer see all; approver & self-service see self
        roles: [
          "super_admin",
          "hr_admin",
          "leave_approver",
          "viewer",
          "employee_self_service",
        ],
      },
      {
        label: "OPCRF",
        href: "/performance/opcrf",
        roles: ["super_admin", "hr_admin", "viewer"],
      },
      {
        label: "Step Increments",
        href: "/performance/step-increments",
        roles: ["super_admin", "hr_admin"],
      },
      {
        label: "Analytics",
        href: "/performance/analytics",
        roles: ["super_admin", "hr_admin"],
      },
    ],
  },

  // ── SALN ──────────────────────────────────────────────────────────────────
  {
    label: "SALN",
    icon: FileText,
    roles: ["super_admin", "employee_self_service"],
    children: [
      {
        label: "Compliance Dashboard",
        href: "/saln/admin",
        roles: ["super_admin"],
      },
      {
        label: "Submissions",
        href: "/saln/submissions",
        roles: ["super_admin", "employee_self_service"],
        selfOnly: true,
      },
      {
        label: "Tracking",
        href: "/saln/tracking",
        roles: ["super_admin"],
      },
      {
        label: "Non-Filers",
        href: "/saln/admin/non-filers",
        roles: ["super_admin"],
      },
      {
        label: "File New SALN",
        href: "/saln/new",
        roles: ["super_admin", "employee_self_service"],
        selfOnly: true,
      },
    ],
  },

  // ── Recruitment (RPM — PRD §4.2) ─────────────────────────────────────────
  {
    label: "Recruitment",
    icon: UserPlus,
    roles: ["super_admin", "hr_admin", "leave_approver", "viewer"],
    children: [
      {
        label: "Overview",
        href: "/recruitment",
        roles: ["super_admin", "hr_admin", "leave_approver", "viewer"],
      },
      {
        label: "MRFs",
        href: "/recruitment/mrf",
        roles: ["super_admin", "hr_admin", "leave_approver", "viewer"],
      },
      {
        label: "Vacancies",
        href: "/recruitment/vacancies",
        roles: ["super_admin", "hr_admin", "leave_approver", "viewer"],
      },
      {
        label: "Applicants",
        href: "/recruitment/applicants",
        roles: ["super_admin", "hr_admin", "viewer"],
      },
      {
        label: "Selection",
        href: "/recruitment/selection",
        roles: ["super_admin", "hr_admin", "viewer"],
      },
      {
        label: "Appointments",
        href: "/recruitment/appointments",
        roles: ["super_admin", "hr_admin"],
      },
    ],
  },

  // ── Learning & Development (LDM — PRD §4.6 / M6) ─────────────────────────
  {
    label: "Learning & Development",
    icon: GraduationCap,
    roles: [
      "super_admin",
      "hr_admin",
      "leave_approver",
      "viewer",
      "employee_self_service",
    ],
    children: [
      {
        label: "Overview",
        href: "/learning",
        roles: [
          "super_admin",
          "hr_admin",
          "leave_approver",
          "viewer",
          "employee_self_service",
        ],
      },
      {
        label: "Catalog",
        href: "/learning/catalog",
        roles: ["super_admin", "hr_admin", "leave_approver", "viewer"],
      },
      {
        label: "Providers",
        href: "/learning/providers",
        roles: ["super_admin", "hr_admin", "viewer"],
      },
      {
        label: "Schedule",
        href: "/learning/schedule",
        roles: ["super_admin", "hr_admin", "leave_approver", "viewer"],
      },
      {
        label: "TNA (Training Needs Analysis)",
        href: "/learning/tna",
        roles: ["super_admin", "hr_admin", "viewer"],
      },
      {
        label: "Mandatory Compliance",
        href: "/learning/mandatory",
        roles: ["super_admin", "hr_admin", "viewer"],
      },
      {
        label: "Certificates",
        href: "/learning/certificates",
        roles: [
          "super_admin",
          "hr_admin",
          "leave_approver",
          "viewer",
          "employee_self_service",
        ],
      },
      {
        label: "Reports",
        href: "/learning/reports",
        roles: ["super_admin", "hr_admin", "viewer"],
      },
    ],
  },

  // ── Welfare & PRAISE (EWBM — PRD §4.10 / M10) ────────────────────────────
  {
    label: "Welfare & PRAISE",
    icon: Award,
    roles: ["super_admin", "hr_admin", "leave_approver", "viewer"],
    children: [
      {
        label: "Overview",
        href: "/welfare",
        roles: ["super_admin", "hr_admin", "leave_approver", "viewer"],
      },
      {
        label: "Loyalty Awards",
        href: "/welfare/loyalty",
        roles: ["super_admin", "hr_admin", "viewer"],
      },
      {
        label: "Retirement",
        href: "/welfare/retirement",
        roles: ["super_admin", "hr_admin", "viewer"],
      },
      {
        label: "PRAISE",
        href: "/welfare/praise",
        roles: ["super_admin", "hr_admin", "viewer"],
      },
      {
        label: "Wellness",
        href: "/welfare/wellness",
        roles: ["super_admin", "hr_admin", "viewer"],
      },
    ],
  },

  // ── Admin ─────────────────────────────────────────────────────────────────
  {
    label: "Admin",
    icon: Shield,
    roles: ["super_admin"],
    children: [
      { label: "Users", href: "/admin/users", roles: ["super_admin"] },
      {
        label: "Salary Grades",
        href: "/admin/salary-grades",
        roles: ["super_admin"],
      },
      { label: "Rates", href: "/admin/rates", roles: ["super_admin"] },
      { label: "Holidays", href: "/admin/holidays", roles: ["super_admin"] },
      { label: "Offices", href: "/admin/offices", roles: ["super_admin"] },
      {
        label: "Audit Logs",
        href: "/admin/audit-logs",
        roles: ["super_admin"],
      },
      {
        label: "System Settings",
        href: "/admin/settings",
        roles: ["super_admin"],
      },
    ],
  },

  // ── Org Chart (top-level shortcut) ────────────────────────────────────────
  // Renders for employee_self_service whose Employees group is hidden.
  {
    label: "Org Chart",
    href: "/org-chart",
    icon: Network,
    roles: ["employee_self_service"],
  },

  // ── Profile (self) ────────────────────────────────────────────────────────
  {
    label: "My Profile",
    href: "/profile",
    icon: UserIcon,
    roles: ALL_ROLES,
    selfOnly: true,
  },

  // ── Settings (personal preferences) ───────────────────────────────────────
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ALL_ROLES,
  },
];

// ─── Component types ──────────────────────────────────────────────────────────

interface AppSidebarProps {
  /** Whether the sidebar is expanded (icon+label) or collapsed (icon-only on desktop) */
  open: boolean;
  /** Whether a mobile drawer overlay is active */
  mobileOpen?: boolean;
  /** Role of the currently logged-in user for menu filtering */
  role?: Role;
  /**
   * Employee record id linked to the current auth user (if any).
   * Required to surface self-service items (Clock In, Apply Leave, My Payslips,
   * My SALN, etc.). When null, self-service-only links are hidden.
   * TODO(layout): wire from `useCurrentUser().user.employeeId`.
   */
  employeeId?: string | null;
  onClose?: () => void;
}

// ─── Visibility helpers ───────────────────────────────────────────────────────

/**
 * Role-allowlist check — every leaf and group in the nav tree carries an
 * explicit `roles: Role[]` that gates visibility. Returns true when the
 * current role is permitted by the item's allowlist.
 */
function canSeeItem(item: NavGate, role: Role | undefined): boolean {
  if (!role) return false;
  if (!item.roles) return false;
  // Expand the user's role through the alias map so the new seven PCSO
  // dashboards (supervisor / executive / auditor) inherit visibility from
  // their legacy equivalents (leave_approver / viewer) without editing
  // every `roles: [...]` array on every nav leaf.
  const effective = effectiveRolesOf(role);
  return effective.some((r) => item.roles!.includes(r));
}

function matchesGate(
  gate: NavGate,
  role: Role | undefined,
  employeeId: string | null,
): boolean {
  if (gate.selfOnly && !employeeId) return false;
  if (!role) return false;

  // Primary gate is the role allowlist. A permission-based gate is kept for
  // backwards compatibility on any items that still declare one (permissive OR).
  const roleAllowed = canSeeItem(gate, role);
  const permAllowed = gate.permission
    ? hasPermission(role, gate.permission.resource, gate.permission.action)
    : false;

  if (!gate.roles && !gate.permission) return true;

  return roleAllowed || permAllowed;
}

function isChildVisible(
  child: NavChild,
  role: Role | undefined,
  employeeId: string | null,
): boolean {
  return matchesGate(child, role, employeeId);
}

function isItemVisible(
  item: NavItem,
  role: Role | undefined,
  employeeId: string | null,
): boolean {
  // The item itself must clear its own gate. Groups additionally need at
  // least one visible child below to render.
  if (!matchesGate(item, role, employeeId)) return false;

  if (item.children && item.children.length > 0) {
    const anyVisible = item.children.some((c) =>
      isChildVisible(c, role, employeeId),
    );
    if (!anyVisible) return false;
  }
  return true;
}

function useActiveGroup(items: NavItem[], pathname: string): string | null {
  for (const item of items) {
    if (item.children) {
      for (const child of item.children) {
        if (pathname === child.href || pathname.startsWith(`${child.href}/`)) {
          return item.label;
        }
      }
    }
    if (
      item.href &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`))
    ) {
      return item.label;
    }
  }
  return null;
}

// ─── NavLink (leaf item inside a group) ──────────────────────────────────────

function NavChildLink({
  child,
  collapsed,
}: {
  child: NavChild;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const isActive =
    pathname === child.href || pathname.startsWith(`${child.href}/`);

  if (collapsed) return null;

  return (
    <Link
      href={child.href}
      className={cn(
        "flex items-center rounded-md px-3 py-1.5 text-sm transition-colors ml-6",
        isActive
          ? "bg-white/10 text-white font-medium border-l-2 border-senate-gold"
          : "text-white/60 hover:text-white hover:bg-white/5",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      {child.label}
    </Link>
  );
}

// ─── NavGroup (item with children) ───────────────────────────────────────────

function NavGroup({
  item,
  collapsed,
  defaultOpen,
  role,
  employeeId,
}: {
  item: NavItem;
  collapsed: boolean;
  defaultOpen: boolean;
  role?: Role;
  employeeId: string | null;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const Icon = item.icon;
  const visibleChildren =
    item.children?.filter((child) => isChildVisible(child, role, employeeId)) ??
    [];

  const button = (
    <button
      type="button"
      onClick={() => {
        if (!collapsed) setOpen((v) => !v);
      }}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        open && !collapsed
          ? "text-white bg-white/10"
          : "text-white/70 hover:text-white hover:bg-white/5",
      )}
      aria-expanded={collapsed ? undefined : open}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 text-left">{item.label}</span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-white/50" />
          ) : (
            <ChevronRight className="h-4 w-4 text-white/50" />
          )}
        </>
      )}
    </button>
  );

  return (
    <li>
      {collapsed ? (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {item.label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        button
      )}

      {!collapsed && open && visibleChildren.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {visibleChildren.map((child) => (
            <li key={`${item.label}:${child.href}:${child.label}`}>
              <NavChildLink child={child} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── NavLeaf (no children) ───────────────────────────────────────────────────

function NavLeaf({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const pathname = usePathname();
  const isActive = item.href ? pathname === item.href : false;
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href ?? "#"}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "text-white bg-white/10 border-l-2 border-senate-gold"
          : "text-white/70 hover:text-white hover:bg-white/5",
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );

  return (
    <li>
      {collapsed ? (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {item.label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        link
      )}
    </li>
  );
}

// ─── AppSidebar ───────────────────────────────────────────────────────────────

export function AppSidebar({
  open,
  mobileOpen = false,
  // TODO: Replace with real role from session. Defaulting to super_admin so all
  //       items are visible during development.
  role = "super_admin",
  employeeId = null,
  onClose,
}: AppSidebarProps) {
  const pathname = usePathname();
  const activeGroup = useActiveGroup(NAV_ITEMS, pathname);

  const visibleItems = NAV_ITEMS.filter((item) =>
    isItemVisible(item, role, employeeId),
  );

  const sidebarContent = (
    <nav
      className={cn(
        "flex h-full flex-col bg-senate-navy transition-all duration-200",
        open ? "w-64" : "w-16",
      )}
      aria-label="Main navigation"
    >
      {/* Branding */}
      <div
        className={cn(
          "flex h-14 items-center border-b border-white/10 px-3",
          open ? "gap-3" : "justify-center",
        )}
      >
        {/* PCSO seal */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/pcso-official.png"
          alt="PCSO seal"
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 rounded-full bg-white/95 object-contain p-0.5"
        />
        {open && (
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white leading-tight">
              Philippine Charity Sweepstakes Office
            </p>
            <p className="text-[10px] text-white/60 leading-tight">HRIS</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2">
        <ul className="space-y-0.5">
          {visibleItems.map((item) =>
            item.children ? (
              <NavGroup
                key={item.label}
                item={item}
                collapsed={!open}
                defaultOpen={activeGroup === item.label}
                role={role}
                employeeId={employeeId}
              />
            ) : (
              <NavLeaf key={item.label} item={item} collapsed={!open} />
            ),
          )}
        </ul>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 p-2">
        <Separator className="bg-white/10 mb-2" />
        {open && (
          <p className="px-3 text-[10px] text-white/30 text-center">
            v0.1.0 — Confidential
          </p>
        )}
      </div>
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex shrink-0">{sidebarContent}</aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            aria-hidden
            onClick={onClose}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
