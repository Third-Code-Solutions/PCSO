'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { type Role, canAccess } from '@/lib/auth/permissions';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';

// ─── Nav tree definition ─────────────────────────────────────────────────────

interface NavChild {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  /** If set, this item is only shown when the role can access this resource */
  resource?: Parameters<typeof canAccess>[1];
  children?: NavChild[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    // Accessible by all roles — no resource guard
  },
  {
    label: 'Employees',
    icon: Users,
    resource: 'employees',
    children: [
      { label: 'Employee Records', href: '/employees' },
      { label: 'Plantilla', href: '/plantilla' },
      { label: 'Org Chart', href: '/org-chart' },
    ],
  },
  {
    label: 'Time & Attendance',
    icon: Clock,
    resource: 'attendance',
    children: [
      { label: 'DTR', href: '/attendance/dtr' },
      { label: 'Overtime', href: '/attendance/overtime' },
      { label: 'Timesheets', href: '/attendance/timesheets' },
    ],
  },
  {
    label: 'Leave Management',
    icon: Palmtree,
    resource: 'leave',
    children: [
      { label: 'Applications', href: '/leave/applications' },
      { label: 'Credits', href: '/leave/credits' },
      { label: 'Calendar', href: '/leave/calendar' },
    ],
  },
  {
    label: 'Payroll',
    icon: Wallet,
    resource: 'payroll',
    children: [
      { label: 'Regular Payroll', href: '/payroll/regular' },
      { label: 'JO / COS', href: '/payroll/jo-cos' },
      { label: 'Payslips', href: '/payroll/payslips' },
      { label: 'History', href: '/payroll/history' },
    ],
  },
  {
    label: 'Remittances',
    icon: Building2,
    resource: 'remittances',
    children: [
      { label: 'GSIS', href: '/remittances/gsis' },
      { label: 'PhilHealth', href: '/remittances/philhealth' },
      { label: 'Pag-IBIG', href: '/remittances/pagibig' },
      { label: 'BIR', href: '/remittances/bir' },
    ],
  },
  {
    label: 'Performance',
    icon: TrendingUp,
    resource: 'performance',
    children: [
      { label: 'IPCRF / OPCRF', href: '/performance/ipcrf' },
      { label: 'Step Increments', href: '/performance/step-increments' },
    ],
  },
  {
    label: 'SALN',
    icon: FileText,
    resource: 'saln',
    children: [
      { label: 'Submissions', href: '/saln/submissions' },
      { label: 'Tracking', href: '/saln/tracking' },
    ],
  },
  {
    label: 'Admin',
    icon: Settings,
    resource: 'admin',
    children: [
      { label: 'Users', href: '/admin/users' },
      { label: 'Offices', href: '/admin/offices' },
      { label: 'Salary Grades', href: '/admin/salary-grades' },
      { label: 'Rates', href: '/admin/rates' },
      { label: 'Holidays', href: '/admin/holidays' },
      { label: 'Audit Logs', href: '/admin/audit-logs' },
    ],
  },
];

// ─── Component types ──────────────────────────────────────────────────────────

interface AppSidebarProps {
  /** Whether the sidebar is expanded (icon+label) or collapsed (icon-only on desktop) */
  open: boolean;
  /** Whether a mobile drawer overlay is active */
  mobileOpen?: boolean;
  /** Role of the currently logged-in user for menu filtering */
  // TODO: Source from Supabase session via layout.tsx
  role?: Role;
  onClose?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isItemVisible(item: NavItem, role: Role | undefined): boolean {
  if (!item.resource) return true; // Dashboard is always shown
  if (!role) return false;
  return canAccess(role, item.resource);
}

function useActiveGroup(items: NavItem[], pathname: string): string | null {
  for (const item of items) {
    if (item.children) {
      for (const child of item.children) {
        if (pathname.startsWith(child.href)) return item.label;
      }
    }
    if (item.href && pathname === item.href) return item.label;
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
  const isActive = pathname.startsWith(child.href);

  if (collapsed) return null;

  return (
    <Link
      href={child.href}
      className={cn(
        'flex items-center rounded-md px-3 py-1.5 text-sm transition-colors ml-6',
        isActive
          ? 'bg-white/10 text-white font-medium border-l-2 border-senate-gold'
          : 'text-white/60 hover:text-white hover:bg-white/5',
      )}
      aria-current={isActive ? 'page' : undefined}
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
}: {
  item: NavItem;
  collapsed: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const Icon = item.icon;

  const button = (
    <button
      type="button"
      onClick={() => {
        if (!collapsed) setOpen((v) => !v);
      }}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        open && !collapsed
          ? 'text-white bg-white/10'
          : 'text-white/70 hover:text-white hover:bg-white/5',
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

      {!collapsed && open && item.children && (
        <ul className="mt-1 space-y-0.5">
          {item.children.map((child) => (
            <li key={child.href}>
              <NavChildLink child={child} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// ─── NavLeaf (Dashboard — no children) ───────────────────────────────────────

function NavLeaf({
  item,
  collapsed,
}: {
  item: NavItem;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const isActive = item.href ? pathname === item.href : false;
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href ?? '#'}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'text-white bg-white/10 border-l-2 border-senate-gold'
          : 'text-white/70 hover:text-white hover:bg-white/5',
      )}
      aria-current={isActive ? 'page' : undefined}
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
  role = 'super_admin',
  onClose,
}: AppSidebarProps) {
  const pathname = usePathname();
  const activeGroup = useActiveGroup(NAV_ITEMS, pathname);

  const visibleItems = NAV_ITEMS.filter((item) => isItemVisible(item, role));

  const sidebarContent = (
    <nav
      className={cn(
        'flex h-full flex-col bg-senate-navy transition-all duration-200',
        open ? 'w-64' : 'w-16',
      )}
      aria-label="Main navigation"
    >
      {/* Branding */}
      <div
        className={cn(
          'flex h-14 items-center border-b border-white/10 px-3',
          open ? 'gap-3' : 'justify-center',
        )}
      >
        {/* Senate seal placeholder */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-senate-gold">
          <span className="text-xs font-bold text-senate-navy">S</span>
        </div>
        {open && (
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white leading-tight">
              Senate of the Philippines
            </p>
            <p className="text-[10px] text-white/50 leading-tight">HRIS</p>
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
