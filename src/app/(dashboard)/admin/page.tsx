import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Users,
  DollarSign,
  Landmark,
  CalendarDays,
  ScrollText,
  Settings,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { PageHeader } from '@/components/layouts/page-header';
import { requirePermission } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import {
  systemUsers,
  offices,
  holidays,
  auditLogs,
  employees,
} from '@/lib/db/schema';
import { eq, count, desc, isNull, sql } from 'drizzle-orm';

export const metadata: Metadata = {
  title: 'Admin Panel — Senate HRIS',
};

interface NavCard {
  href: string;
  icon: typeof Users;
  title: string;
  description: string;
  stat?: string;
}

async function getAdminStats() {
  const currentYear = new Date().getFullYear();

  const [
    userCounts,
    officeCount,
    holidayCount,
    recentAudits,
  ] = await Promise.all([
    db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where ${systemUsers.isActive} = true)`,
      })
      .from(systemUsers),
    db
      .select({ value: count() })
      .from(offices)
      .where(isNull(offices.deletedAt)),
    db
      .select({ value: count() })
      .from(holidays)
      .where(eq(holidays.year, currentYear)),
    db
      .select({
        id: auditLogs.id,
        createdAt: auditLogs.createdAt,
        action: auditLogs.action,
        tableName: auditLogs.tableName,
        recordId: auditLogs.recordId,
        userEmail: systemUsers.email,
        empFirstName: employees.firstName,
        empLastName: employees.lastName,
      })
      .from(auditLogs)
      .leftJoin(systemUsers, eq(systemUsers.id, auditLogs.userId))
      .leftJoin(employees, eq(employees.id, systemUsers.employeeId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10),
  ]);

  const userStats = userCounts[0] ?? { total: 0, active: 0 };
  return {
    userCount: userStats.total,
    activeUserCount: Number(userStats.active),
    officeCount: officeCount[0]?.value ?? 0,
    holidayCountThisYear: holidayCount[0]?.value ?? 0,
    recentAudits: recentAudits.map((r) => ({
      id: r.id,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      action: r.action,
      tableName: r.tableName,
      recordId: r.recordId,
      userName:
        r.empFirstName && r.empLastName
          ? `${r.empFirstName} ${r.empLastName}`
          : (r.userEmail ?? 'System'),
    })),
  };
}

export default async function AdminHomePage() {
  await requirePermission('admin', 'view');
  const stats = await getAdminStats();

  const NAV_CARDS: NavCard[] = [
    {
      href: '/admin/users',
      icon: Users,
      title: 'User Management',
      description:
        'Create system accounts, assign roles and office scope, activate or deactivate users.',
      stat: `${stats.activeUserCount.toLocaleString()} active · ${stats.userCount.toLocaleString()} total`,
    },
    {
      href: '/admin/offices',
      icon: Building2,
      title: 'Offices',
      description:
        'Manage Senate offices, committees, departments, divisions, and their hierarchy.',
      stat: `${stats.officeCount.toLocaleString()} offices`,
    },
    {
      href: '/admin/salary-grades',
      icon: DollarSign,
      title: 'Salary Grades (SSL V)',
      description:
        'View and update the Salary Standardization Law V grade-step table. Historical rates are preserved.',
    },
    {
      href: '/admin/rates',
      icon: Landmark,
      title: 'Government Rates',
      description:
        'Manage GSIS, PhilHealth, Pag-IBIG, and BIR TRAIN tax table rates with effective-date versioning.',
    },
    {
      href: '/admin/holidays',
      icon: CalendarDays,
      title: 'Holiday Calendar',
      description:
        'Declare regular, special non-working, and special working holidays by proclamation reference.',
      stat: `${stats.holidayCountThisYear.toLocaleString()} declared ${new Date().getFullYear()}`,
    },
    {
      href: '/admin/audit-logs',
      icon: ScrollText,
      title: 'Audit Logs',
      description:
        'COA-ready immutable log of every create, update, delete, approve, and export operation.',
    },
    {
      href: '/admin/settings',
      icon: Settings,
      title: 'System Settings',
      description:
        'Configure organization name, logo, address, email sender, and payroll cutoff dates.',
    },
  ];

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Administration"
        description="System configuration, user management, government rates, and COA-ready audit logs."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin' },
        ]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_CARDS.map(({ href, icon: Icon, title, description, stat }) => (
          <Link
            key={href}
            href={href}
            className="group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-senate-navy/10">
                <Icon className="h-5 w-5 text-senate-navy" />
              </span>
              <div className="flex-1">
                <h2 className="font-semibold text-foreground group-hover:text-senate-navy transition-colors">
                  {title}
                </h2>
                {stat && (
                  <p className="text-xs font-medium text-senate-navy/70">{stat}</p>
                )}
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <section className="rounded-lg border border-border bg-card shadow-sm">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-semibold">Recent Activity</h2>
          <Link
            href="/admin/audit-logs"
            className="text-xs font-medium text-senate-navy hover:underline"
          >
            View full log
          </Link>
        </header>
        <ol className="divide-y divide-border">
          {stats.recentAudits.length === 0 ? (
            <li className="px-5 py-6 text-sm text-muted-foreground">
              No recorded activity yet.
            </li>
          ) : (
            stats.recentAudits.map((entry) => (
              <li key={entry.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
                <span className="w-24 shrink-0 rounded bg-muted px-2 py-0.5 text-center text-xs font-semibold capitalize">
                  {entry.action}
                </span>
                <span className="w-48 shrink-0 truncate font-medium">{entry.userName}</span>
                <span className="flex-1 truncate text-muted-foreground">
                  <code className="rounded bg-muted/60 px-1 py-0.5 text-xs">
                    {entry.tableName}
                  </code>
                  {entry.recordId && (
                    <span className="ml-2 font-mono text-xs">{entry.recordId.slice(0, 8)}…</span>
                  )}
                </span>
              </li>
            ))
          )}
        </ol>
      </section>
    </div>
  );
}
