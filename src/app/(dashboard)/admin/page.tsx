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
} from 'lucide-react';
import { PageHeader } from '@/components/layouts/page-header';
import { requirePermission } from '@/lib/auth/guards';

export const metadata: Metadata = {
  title: 'Admin Panel — Senate HRIS',
};

const NAV_CARDS = [
  {
    href: '/admin/users',
    icon: Users,
    title: 'User Management',
    description: 'Create system accounts, assign roles and office scope, activate or deactivate users.',
  },
  {
    href: '/admin/salary-grades',
    icon: DollarSign,
    title: 'Salary Grades (SSL V)',
    description: 'View and update the Salary Standardization Law V grade-step table. Historical rates are preserved.',
  },
  {
    href: '/admin/rates',
    icon: Landmark,
    title: 'Government Rates',
    description: 'Manage GSIS, PhilHealth, Pag-IBIG, and BIR TRAIN tax table rates with effective-date versioning.',
  },
  {
    href: '/admin/holidays',
    icon: CalendarDays,
    title: 'Holiday Calendar',
    description: 'Declare regular, special non-working, and special working holidays by proclamation reference.',
  },
  {
    href: '/admin/audit-logs',
    icon: ScrollText,
    title: 'Audit Logs',
    description: 'COA-ready immutable log of every create, update, delete, approve, and export operation.',
  },
  {
    href: '/admin/settings',
    icon: Settings,
    title: 'System Settings',
    description: 'Configure organization name, logo, address, email sender, and payroll cutoff dates.',
  },
] as const;

export default async function AdminHomePage() {
  await requirePermission('admin', 'view');

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
        {NAV_CARDS.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-senate-navy/10">
                <Icon className="h-5 w-5 text-senate-navy" />
              </span>
              <h2 className="font-semibold text-foreground group-hover:text-senate-navy transition-colors">
                {title}
              </h2>
              <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
